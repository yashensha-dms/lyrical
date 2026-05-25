import React from 'react';
import { ChevronRight } from 'lucide-react';
import { ProjectInfoPanel } from './ProjectInfoPanel';
import type { Draft } from '../hooks/useDrafts';

interface RightPanelProps {
  activeDraft: Draft;
  updateActiveDraft: (updates: Partial<Omit<Draft, 'id' | 'createdAt'>>) => void;
  setIsSidebarOpen: (open: boolean) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  activeDraft,
  updateActiveDraft,
  setIsSidebarOpen,
}) => {
  return (
    <div className="w-64 h-full bg-paper-dark/70 border-l border-paper-darker flex flex-col flex-shrink-0 z-10">
      {/* Header */}
      <div className="h-14 px-4 border-b border-paper-darker flex items-center justify-between select-none flex-shrink-0">
        <span className="font-semibold tracking-wide text-ink text-sm uppercase">
          Project Info
        </span>
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="text-ink-muted hover:text-ink hover:bg-paper-darker p-1 rounded cursor-pointer"
          title="Collapse Panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Info Content */}
      <ProjectInfoPanel
        activeDraft={activeDraft}
        updateActiveDraft={updateActiveDraft}
      />
    </div>
  );
};
