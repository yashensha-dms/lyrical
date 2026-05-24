import React from 'react';
import { Plus, Music, Clock, Cloud, HardDrive } from 'lucide-react';
import type { Draft } from '../hooks/useDrafts';

interface LandingPageProps {
  drafts: Draft[];
  isCloudMode: boolean;
  healthStatus: 'checking' | 'connected' | 'disconnected';
  onSelectDraft: (id: string) => void;
  onCreateDraft: () => void;
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
}) => {
  return (
    <div className="w-screen h-screen bg-paper flex flex-col overflow-hidden">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {drafts.map((draft) => (
                <button
                  key={draft.id}
                  id={`landing-draft-${draft.id}`}
                  onClick={() => onSelectDraft(draft.id)}
                  className="group text-left bg-paper border border-paper-darker rounded-xl p-4 hover:border-terracotta/40 hover:bg-paper-dark transition-all duration-150 active:scale-[0.99] card-warm cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-ink leading-snug line-clamp-2 group-hover:text-terracotta transition-colors">
                      {draft.title || 'Untitled Song'}
                    </h3>
                    <span className="text-[10px] text-ink-light font-mono flex-shrink-0 flex items-center gap-0.5 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {timeAgo(draft.updatedAt)}
                    </span>
                  </div>

                  {draft.content && (
                    <p className="text-[11px] text-ink-muted font-serif italic leading-relaxed line-clamp-2 mb-3">
                      {draft.content.replace(/^\[.*?\]\n?/gm, '').trim().split('\n')[0]}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-ink-light font-mono">
                    <span>{wordCount(draft.content)} words</span>
                  </div>                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
