import React from 'react';
import { ChevronRight } from 'lucide-react';
import { ProjectInfoPanel } from './ProjectInfoPanel';
import { ScrapbookPanel } from './ScrapbookPanel';
import { VoiceMemosPanel } from './VoiceMemosPanel';
import { RhymePanel } from './RhymePanel';
import { RhymeDensityPanel } from './RhymeDensityPanel';
import { PhoneticSwapPanel } from './PhoneticSwapPanel';
import { MalayalamWordFinderPanel } from './MalayalamWordFinderPanel';
import type { Draft } from '../hooks/useDrafts';

interface RightPanelProps {
  activeDraft: Draft;
  updateActiveDraft: (updates: Partial<Omit<Draft, 'id' | 'createdAt'>>) => void;
  setIsSidebarOpen: (open: boolean) => void;
  activePanel: 'info' | 'scrapbook' | 'audio' | 'rhyme' | 'density' | 'swap' | 'malayalam';
  lookupWord: string | null;
  rhymeResults: any | null;
  loadingRhymes: boolean;
  rhymeError: string | null;
  onClearRhymes: () => void;
  onSearchRhymes: (word: string) => void;
  onSelectMalayalamWord?: (word: string) => void;
  isMalayalamMode?: boolean;
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
  onClearRhymes,
  onSearchRhymes,
  isMalayalamMode = false,
}) => {
  const getHeaderLabel = () => {
    if (isMalayalamMode && (activePanel === 'rhyme' || activePanel === 'density' || activePanel === 'swap' || activePanel === 'malayalam')) {
      return 'മലയാളം നിഘണ്ടു & മീറ്റർ';
    }
    switch (activePanel) {
      case 'info':
        return 'Project Info';
      case 'scrapbook':
        return 'Scrapbook';
      case 'audio':
        return 'Voice Memos';
      case 'rhyme':
        return 'Rhyme Finder';
      case 'density':
        return 'Rhyme Density';
      case 'swap':
        return 'Word Swap';
      case 'malayalam':
        return 'മലയാളം നിഘണ്ടു & മീറ്റർ';
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
      ) : isMalayalamMode ? (
        <MalayalamWordFinderPanel
          lookupWord={lookupWord}
          onSelectWord={onSearchRhymes}
          onClearLookup={onClearRhymes}
        />
      ) : activePanel === 'rhyme' ? (
        <RhymePanel
          lookupWord={lookupWord}
          data={rhymeResults}
          isLoading={loadingRhymes}
          error={rhymeError}
          onClear={onClearRhymes}
          onSearch={onSearchRhymes}
        />
      ) : activePanel === 'density' ? (
        <RhymeDensityPanel />
      ) : activePanel === 'swap' ? (
        <PhoneticSwapPanel />
      ) : (
        <MalayalamWordFinderPanel
          lookupWord={lookupWord}
          onSelectWord={onSearchRhymes}
          onClearLookup={onClearRhymes}
        />
      )}
    </div>
  );
};
