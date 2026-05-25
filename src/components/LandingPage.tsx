import React, { useState, useEffect } from 'react';
import { Plus, Music, Clock, Cloud, HardDrive, MoreHorizontal } from 'lucide-react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import type { Draft } from '../hooks/useDrafts';

interface LandingPageProps {
  drafts: Draft[];
  isCloudMode: boolean;
  healthStatus: 'checking' | 'connected' | 'disconnected';
  onSelectDraft: (id: string) => void;
  onCreateDraft: () => void;
  onDeleteDraft: (id: string) => void;
  onRenameDraft: (id: string, newTitle: string) => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function wordCount(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  drafts,
  isCloudMode,
  healthStatus,
  onSelectDraft,
  onCreateDraft,
  onDeleteDraft,
  onRenameDraft,
}) => {
  const [renamingDraftId, setRenamingDraftId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleStartRename = (draft: Draft) => {
    setRenamingDraftId(draft.id);
    setRenameTitle(draft.title || 'Untitled Song');
  };

  const handleRenameSubmit = (id: string) => {
    if (renameTitle.trim() && renameTitle.trim() !== drafts.find(d => d.id === id)?.title) {
      onRenameDraft(id, renameTitle.trim());
    }
    setRenamingDraftId(null);
  };

  const handleShare = (id: string) => {
    const shareUrl = `${window.location.origin}/draft/${id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setToastMessage('Invite link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy share link:', err);
    });
  };

  return (
    <div className="w-screen h-screen bg-paper flex flex-col overflow-hidden select-none">
      {/* Top bar */}
      <header className="h-12 border-b border-paper-darker flex items-center justify-between px-6 flex-shrink-0 bg-paper">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-terracotta" />
          <span className="font-extrabold text-terracotta tracking-wider text-sm">Lyrical</span>
        </div>
        <div className="flex items-center gap-2">
          {healthStatus === 'connected' && !isCloudMode ? null : (
            <span className={`flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
              isCloudMode
                ? 'bg-[#EDF7F2] border-[#BDE8D4] text-[#2D7A56]'
                : healthStatus === 'disconnected'
                ? 'bg-amber-light border-[#F5DDA8] text-amber-DEFAULT'
                : 'bg-paper-dark border-paper-darker text-ink-muted'
            }`}>
              {isCloudMode ? <Cloud className="w-3 h-3" /> : <HardDrive className="w-3 h-3" />}
              {isCloudMode ? 'Cloud' : healthStatus === 'checking' ? 'Connecting…' : 'Local'}
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-12">

          {/* Hero */}
          <div className="mb-10">
            <h1 className="text-3xl font-serif font-bold text-ink mb-2 leading-tight">
              Your Songs
            </h1>
            <p className="text-sm text-ink-muted">
              Pick up where you left off, or start something new.
            </p>
          </div>

          {/* New draft CTA */}
          <button
            id="landing-new-song"
            onClick={onCreateDraft}
            className="w-full flex items-center gap-3 bg-terracotta hover:bg-terracotta-hover text-white rounded-xl px-5 py-4 mb-8 transition-all duration-150 active:scale-[0.99] shadow-paper-md cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 group-hover:bg-white/25 transition">
              <Plus className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold">New Song</div>
              <div className="text-[11px] text-white/70">Start with a blank canvas</div>
            </div>
          </button>

          {/* Drafts grid */}
          {drafts.length === 0 ? (
            <div className="text-center py-16 text-ink-muted">
              <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No songs yet. Create your first one above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {drafts.map((draft) => (
                <ContextMenu.Root key={draft.id}>
                  <ContextMenu.Trigger asChild>
                    <div
                      id={`landing-draft-${draft.id}`}
                      onClick={() => {
                        if (renamingDraftId !== draft.id) {
                          onSelectDraft(draft.id);
                        }
                      }}
                      className="group text-left bg-paper border border-paper-darker hover:border-terracotta/30 hover:bg-paper-dark/30 rounded-xl p-5 transition-all duration-200 card-warm cursor-pointer relative flex flex-col justify-between min-h-[130px]"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-4 mb-2.5">
                          {renamingDraftId === draft.id ? (
                            <input
                              type="text"
                              value={renameTitle}
                              onChange={(e) => setRenameTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleRenameSubmit(draft.id);
                                } else if (e.key === 'Escape') {
                                  setRenamingDraftId(null);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 bg-transparent text-sm font-semibold text-ink border-b border-terracotta focus:outline-none py-0.5"
                              autoFocus
                              onBlur={() => handleRenameSubmit(draft.id)}
                            />
                          ) : (
                            <h3 className="text-sm font-bold text-ink leading-snug line-clamp-2 group-hover:text-terracotta transition-colors flex-1 pr-6">
                              {draft.title || 'Untitled Song'}
                            </h3>
                          )}
                          
                          {/* Three dot dropdown button */}
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger asChild>
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-7 h-7 flex items-center justify-center rounded-md border border-paper-darker bg-paper hover:bg-paper-active text-ink-muted hover:text-ink transition cursor-pointer"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                  className="radix-menu-content"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <DropdownMenu.Item
                                    className="radix-menu-item"
                                    onSelect={() => handleStartRename(draft)}
                                  >
                                    Rename
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Item
                                    className="radix-menu-item text-terracotta hover:bg-terracotta-light"
                                    onSelect={() => setDeletingDraftId(draft.id)}
                                  >
                                    Delete
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Item
                                    className="radix-menu-item"
                                    onSelect={() => handleShare(draft.id)}
                                  >
                                    Share
                                  </DropdownMenu.Item>
                                </DropdownMenu.Content>
                              </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                          </div>
                        </div>

                        {draft.content && (
                          <p className="text-[11px] text-ink-muted font-serif italic leading-relaxed line-clamp-2 mb-3 pr-2">
                            {draft.content.replace(/^\[.*?\]\n?/gm, '').trim().split('\n')[0]}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-ink-light font-mono mt-2 pt-2 border-t border-paper-darker/40">
                        <span>{wordCount(draft.content)} words</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeAgo(draft.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </ContextMenu.Trigger>
                  
                  {/* Context menu overlay */}
                  <ContextMenu.Portal>
                    <ContextMenu.Content className="radix-menu-content">
                      <ContextMenu.Item
                        className="radix-menu-item"
                        onSelect={() => handleStartRename(draft)}
                      >
                        Rename
                      </ContextMenu.Item>
                      <ContextMenu.Item
                        className="radix-menu-item text-terracotta hover:bg-terracotta-light"
                        onSelect={() => setDeletingDraftId(draft.id)}
                      >
                        Delete
                      </ContextMenu.Item>
                      <ContextMenu.Item
                        className="radix-menu-item"
                        onSelect={() => handleShare(draft.id)}
                      >
                        Share
                      </ContextMenu.Item>
                    </ContextMenu.Content>
                  </ContextMenu.Portal>
                </ContextMenu.Root>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Delete confirmation dialog */}
      <AlertDialog.Root open={!!deletingDraftId} onOpenChange={(open: boolean) => !open && setDeletingDraftId(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="radix-overlay" />
          <AlertDialog.Content className="radix-dialog-content">
            <AlertDialog.Title className="text-sm font-bold text-ink mb-2">Delete Song</AlertDialog.Title>
            <AlertDialog.Description className="text-xs text-ink-muted mb-5">
              Are you sure you want to delete this song? This action cannot be undone and will remove it permanently.
            </AlertDialog.Description>
            <div className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button className="px-3.5 py-1.5 border border-paper-darker rounded-md text-xs font-semibold text-ink-muted hover:bg-paper-active transition cursor-pointer">
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={() => {
                    if (deletingDraftId) {
                      onDeleteDraft(deletingDraftId);
                      setDeletingDraftId(null);
                    }
                  }}
                  className="px-3.5 py-1.5 bg-terracotta hover:bg-terracotta-hover text-white rounded-md text-xs font-semibold transition cursor-pointer"
                >
                  Delete
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-ink text-paper border border-paper-darker shadow-paper-md rounded-lg px-4 py-3 flex items-center gap-2.5 z-50 text-xs font-medium animate-[radix-slide-up_150ms_ease-out]">
          <div className="w-1.5 h-1.5 rounded-full bg-terracotta"></div>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
