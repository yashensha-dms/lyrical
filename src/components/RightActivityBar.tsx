import React from 'react';
import { Info, PanelLeftClose, PanelLeft } from 'lucide-react';

interface RightActivityBarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

export const RightActivityBar: React.FC<RightActivityBarProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
}) => {
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
          onClick={() => setIsSidebarOpen(!isSidebarOpen || true)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
            isSidebarOpen
              ? 'bg-paper-darker text-terracotta shadow-inner'
              : 'text-ink-muted hover:text-ink hover:bg-paper-active/50'
          }`}
          title="Project Info"
          aria-label="Project Info"
        >
          <Info className="w-5 h-5 stroke-[1.5]" />
        </button>
      </div>

      {/* Bottom version string placeholder to match Left ActivityBar */}
      <div className="text-ink-light text-xs font-mono select-none pointer-events-none opacity-0">
        v2.5.0
      </div>
    </div>
  );
};
