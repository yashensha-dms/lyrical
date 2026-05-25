import React from 'react';
import { ChevronRight } from 'lucide-react';
import { ProjectInfoPanel } from './ProjectInfoPanel';
import { ScrapbookPanel } from './ScrapbookPanel';
import { VoiceMemosPanel } from './VoiceMemosPanel';
import { RhymePanel } from './RhymePanel';
import type { Draft } from '../hooks/useDrafts';

interface RightPanelProps {
  activeDraft: Draft;
  updateActiveDraft: (updates: Partial<Omit<Draft, 'id' | 'createdAt'>>) => void;
  setIsSidebarOpen: (open: boolean) => void;
  activePanel: 'info' | 'scrapbook' | 'audio' | 'rhyme';
  lookupWord: string | null;
  rhymeResults: any | null;
  loadingRhymes: boolean;
  rhymeError: string | null;
  synonymResults: string[] | null;
  loadingSynonyms: boolean;
  synonymError: string | null;
  onClearRhymes: () => void;
  onSearchRhymes: (word: string) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  activeDraft,
  updateActiveDraft,
  setIsSidebarOpen,
  activePanel,
  lookupWord,
  rhymeResults,
  loadingRhymes,
  rhymeError,
  synonymResults,
  loadingSynonyms,
  synonymError,
  onClearRhymes,
  onSearchRhymes,
}) => {
  const getHeaderLabel = () => {
    switch (activePanel) {
      case 'info':
        return 'Project Info';
      case 'scrapbook':
        return 'Scrapbook';
      case 'audio':
        return 'Voice Memos';
      case 'rhyme':
        return 'Rhyme Finder';
      default:
        return '';
    }
  };

  return (
    <div className="w-80 h-full bg-paper-dark/70 border-l border-paper-darker flex flex-col flex-shrink-0 z-10">
      {/* Header */}
      <div className="h-14 px-4 border-b border-paper-darker flex items-center justify-between select-none flex-shrink-0">
        <span className="font-semibold tracking-wide text-ink text-sm uppercase">
          {getHeaderLabel()}
        </span>
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="text-ink-muted hover:text-ink hover:bg-paper-darker p-1 rounded cursor-pointer"
          title="Collapse Panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Panel Content */}
      {activePanel === 'info' ? (
        <ProjectInfoPanel
          activeDraft={activeDraft}
          updateActiveDraft={updateActiveDraft}
        />
      ) : activePanel === 'scrapbook' ? (
        <ScrapbookPanel projectId={activeDraft.id} />
      ) : activePanel === 'audio' ? (
        <VoiceMemosPanel projectId={activeDraft.id} />
      ) : (
        <RhymePanel
          lookupWord={lookupWord}
          data={rhymeResults}
          isLoading={loadingRhymes}
          error={rhymeError}
          synonymResults={synonymResults}
          loadingSynonyms={loadingSynonyms}
          synonymError={synonymError}
          onClear={onClearRhymes}
          onSearch={onSearchRhymes}
        />
      )}
    </div>
  );
};
