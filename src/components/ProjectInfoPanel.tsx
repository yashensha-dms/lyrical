import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, Edit2, Plus, Save } from 'lucide-react';
import * as Select from '@radix-ui/react-select';
import { supabase } from '../utils/supabaseClient';
import type { Draft } from '../hooks/useDrafts';

interface ProjectInfoPanelProps {
  activeDraft: Draft;
  updateActiveDraft: (updates: Partial<Omit<Draft, 'id' | 'createdAt'>>) => void;
}

// ── Multi-entry tag input ──────────────────────────────────────────────────
// Each saved tag is shown as a chip with an ✕ remove button.
// A single text input sits below; clicking "+" commits the value and resets
// the input so the user can type the next entry.
interface TagInputProps {
  label: string;
  tags: string[];
  onChange: (newTags: string[]) => void;
}

const TagInput: React.FC<TagInputProps> = ({ label, tags, onChange }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commitCurrent = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
    inputRef.current?.focus();
  }, [inputValue, tags, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitCurrent();
    }
  };

  const handleRemove = (tagToRemove: string) => {
    onChange(tags.filter((t) => t !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-ink uppercase tracking-wider">
        {label}
      </label>

      {/* Committed tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 bg-paper-dark text-ink text-xs px-2 py-0.5 rounded border border-paper-darker font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemove(tag)}
                className="text-ink-muted hover:text-terracotta p-0.5 rounded cursor-pointer transition-colors"
                aria-label={`Remove ${tag}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input row with + button */}
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          placeholder="Add name…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-paper border border-paper-darker rounded px-2.5 py-1.5 text-xs text-ink placeholder-ink-light focus:outline-none focus:border-terracotta transition-colors"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={commitCurrent}
          disabled={!inputValue.trim()}
          aria-label={`Add ${label}`}
          className={`flex items-center justify-center w-7 h-7 rounded border transition-colors ${
            inputValue.trim()
              ? 'bg-terracotta border-terracotta text-white hover:bg-terracotta-hover cursor-pointer'
              : 'bg-paper border-paper-darker text-ink-light cursor-not-allowed'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ── Main panel ─────────────────────────────────────────────────────────────
export const ProjectInfoPanel: React.FC<ProjectInfoPanelProps> = ({
  activeDraft,
  updateActiveDraft,
}) => {
  // ── Local shadow state (committed on Save) ─────────────────────────────
  const [title, setTitle] = useState(activeDraft.title);
  const [status, setStatus] = useState(activeDraft.status || 'Demo');
  const [writers, setWriters] = useState<string[]>(activeDraft.writers || []);
  const [producers, setProducers] = useState<string[]>(activeDraft.producers || []);
  const [featuredArtists, setFeaturedArtists] = useState<string[]>(
    activeDraft.featuredArtists || [],
  );
  const [isDirty, setIsDirty] = useState(false);

  // Inline title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Load project metadata from REST API when project opens
  useEffect(() => {
    let isMounted = true;

    async function loadInfo() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const res = await fetch(`/api/projects/${activeDraft.id}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setTitle(data.title || '');
            setStatus(data.status || 'Demo');
            setWriters(Array.isArray(data.writers) ? data.writers : []);
            setProducers(Array.isArray(data.producers) ? data.producers : []);
            setFeaturedArtists(Array.isArray(data.featured_artists) ? data.featured_artists : []);
            setIsDirty(false);
          }
        }
      } catch (err) {
        console.error('Error fetching project metadata in panel:', err);
      }
    }

    // Set initial loading values from prop
    setTitle(activeDraft.title);
    setStatus(activeDraft.status || 'Demo');
    setWriters(activeDraft.writers || []);
    setProducers(activeDraft.producers || []);
    setFeaturedArtists(activeDraft.featuredArtists || []);
    setIsDirty(false);

    loadInfo();

    return () => {
      isMounted = false;
    };
  }, [activeDraft.id]);

  // Sync title changes from activeDraft (Yjs collaboration)
  useEffect(() => {
    if (!isEditingTitle && !isDirty) {
      setTitle(activeDraft.title);
    }
  }, [activeDraft.title, isEditingTitle, isDirty]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Mark dirty whenever any local field changes
  const markDirty = () => setIsDirty(true);

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') setIsEditingTitle(false);
    if (e.key === 'Escape') {
      setTitle(activeDraft.title);
      setIsEditingTitle(false);
    }
  };

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = () => {
    const trimmedTitle = title.trim() || activeDraft.title;
    updateActiveDraft({
      title: trimmedTitle,
      status,
      writers,
      producers,
      featuredArtists,
    });
    setTitle(trimmedTitle);
    setIsDirty(false);
  };

  const statuses = ['Demo', 'In Progress', 'Final', 'Released'];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent text-ink select-none">
      {/* Scrollable form area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* Song Title */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Song Title
          </label>
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); markDirty(); }}
                onKeyDown={handleTitleKeyDown}
                onBlur={() => setIsEditingTitle(false)}
                className="flex-1 bg-paper border border-terracotta rounded px-3 py-1.5 text-sm font-semibold text-ink focus:outline-none transition select-text"
                spellCheck={false}
              />
              <button
                onClick={() => setIsEditingTitle(false)}
                className="p-1.5 bg-terracotta text-white rounded hover:bg-terracotta-hover transition cursor-pointer"
                title="Confirm Title"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => setIsEditingTitle(true)}
              className="group flex items-center justify-between p-2 hover:bg-paper-darker rounded cursor-pointer border border-transparent hover:border-paper-darker transition-all"
              title="Click to edit title"
            >
              <span className="font-serif font-bold text-lg text-ink truncate mr-2">
                {title || 'Untitled Song'}
              </span>
              <Edit2 className="w-3.5 h-3.5 text-ink-light group-hover:text-ink-muted transition flex-shrink-0" />
            </div>
          )}
        </div>

        {/* Status */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Status
          </label>
          <Select.Root
            value={status}
            onValueChange={(val) => { setStatus(val); markDirty(); }}
          >
            <Select.Trigger
              className="w-full flex items-center justify-between bg-paper border border-paper-darker rounded px-3 py-2 text-xs text-ink focus:outline-none focus:border-terracotta transition select-none cursor-pointer"
              aria-label="Project Status"
            >
              <Select.Value />
              <Select.Icon>
                <Plus className="w-4 h-4 text-ink-muted rotate-45 transform" />
              </Select.Icon>
            </Select.Trigger>

            <Select.Portal>
              <Select.Content className="radix-menu-content z-50">
                <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-paper text-ink cursor-default" />
                <Select.Viewport className="p-1">
                  {statuses.map((s) => (
                    <Select.Item key={s} value={s} className="radix-menu-item">
                      <Select.ItemText>{s}</Select.ItemText>
                      <Select.ItemIndicator>
                        <Check className="w-4 h-4 text-terracotta" />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Viewport>
                <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-paper text-ink cursor-default" />
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* Writers */}
        <TagInput
          label="Writers"
          tags={writers}
          onChange={(t) => { setWriters(t); markDirty(); }}
        />

        {/* Producers */}
        <TagInput
          label="Producers"
          tags={producers}
          onChange={(t) => { setProducers(t); markDirty(); }}
        />

        {/* Featured Artists */}
        <TagInput
          label="Featured Artists"
          tags={featuredArtists}
          onChange={(t) => { setFeaturedArtists(t); markDirty(); }}
        />
      </div>

      {/* ── Sticky Save bar ─────────────────────────────────────────────── */}
      <div className="border-t border-paper-darker px-4 py-3 bg-paper flex-shrink-0">
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className={`w-full flex items-center justify-center gap-2 rounded px-4 py-2 text-xs font-semibold tracking-wide transition-all ${
            isDirty
              ? 'bg-terracotta text-white hover:bg-terracotta-hover shadow-sm cursor-pointer'
              : 'bg-paper-dark text-ink-light border border-paper-darker cursor-not-allowed'
          }`}
        >
          <Save className="w-3.5 h-3.5" />
          {isDirty ? 'Save Changes' : 'No Changes'}
        </button>
      </div>
    </div>
  );
};
