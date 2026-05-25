import React from 'react';
import { Info, PanelLeftClose, PanelLeft, BookOpen, Mic, Search } from 'lucide-react';

interface RightActivityBarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  activePanel: 'info' | 'scrapbook' | 'audio' | 'rhyme';
  setActivePanel: (panel: 'info' | 'scrapbook' | 'audio' | 'rhyme') => void;
}

export const RightActivityBar: React.FC<RightActivityBarProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  activePanel,
  setActivePanel,
}) => {
  const handleItemClick = (panel: 'info' | 'scrapbook' | 'audio' | 'rhyme') => {
    if (activePanel === panel && isSidebarOpen) {
      setIsSidebarOpen(false);
    } else {
      setActivePanel(panel);
      setIsSidebarOpen(true);
    }
  };

  return (
    <div className="w-14 h-full bg-paper-dark border-l border-paper-darker flex flex-col justify-between items-center py-4 flex-shrink-0 z-10 select-none">
      <div className="flex flex-col items-center gap-4 w-full">
        {/* Sidebar Toggle Button (Mirrored PanelLeftClose/PanelLeft for Right side) */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`w-10 h-10 mb-4 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
            isSidebarOpen
              ? 'bg-paper-darker text-terracotta shadow-inner'
              : 'text-ink-muted hover:text-ink hover:bg-paper-active/50'
          }`}
          title={isSidebarOpen ? "Collapse Right Sidebar" : "Expand Right Sidebar"}
          aria-label="Toggle Right Sidebar"
        >
          {/* Using same icons but they mirror/represent right sidebar actions */}
          {isSidebarOpen ? (
            <PanelLeftClose className="w-5 h-5 stroke-[1.5] rotate-180" />
          ) : (
            <PanelLeft className="w-5 h-5 stroke-[1.5] rotate-180" />
          )}
        </button>

        {/* Activity Buttons */}
        <button
          onClick={() => handleItemClick('info')}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
            isSidebarOpen && activePanel === 'info'
              ? 'bg-paper-darker text-terracotta shadow-inner'
              : 'text-ink-muted hover:text-ink hover:bg-paper-active/50'
          }`}
          title="Project Info"
          aria-label="Project Info"
        >
          <Info className="w-5 h-5 stroke-[1.5]" />
        </button>

        <button
          onClick={() => handleItemClick('scrapbook')}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
            isSidebarOpen && activePanel === 'scrapbook'
              ? 'bg-paper-darker text-terracotta shadow-inner'
              : 'text-ink-muted hover:text-ink hover:bg-paper-active/50'
          }`}
          title="Scrapbook"
          aria-label="Scrapbook"
        >
          <BookOpen className="w-5 h-5 stroke-[1.5]" />
        </button>

        <button
          onClick={() => handleItemClick('audio')}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
            isSidebarOpen && activePanel === 'audio'
              ? 'bg-paper-darker text-terracotta shadow-inner'
              : 'text-ink-muted hover:text-ink hover:bg-paper-active/50'
          }`}
          title="Voice Memos"
          aria-label="Voice Memos"
        >
          <Mic className="w-5 h-5 stroke-[1.5]" />
        </button>

        <button
          onClick={() => handleItemClick('rhyme')}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
            isSidebarOpen && activePanel === 'rhyme'
              ? 'bg-paper-darker text-terracotta shadow-inner'
              : 'text-ink-muted hover:text-ink hover:bg-paper-active/50'
          }`}
          title="Rhyme Finder"
          aria-label="Rhyme Finder"
        >
          <Search className="w-5 h-5 stroke-[1.5]" />
        </button>
      </div>

      {/* Bottom version string placeholder to match Left ActivityBar */}
      <div className="text-ink-light text-xs font-mono select-none pointer-events-none opacity-0">
        v2.5.0
      </div>
    </div>
  );
};
