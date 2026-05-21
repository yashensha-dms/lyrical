import React from 'react';
import { FileText, BookOpen, Settings, Disc } from 'lucide-react';

interface ActivityBarProps {
  activePanel: 'explorer' | 'scrapbook' | 'settings';
  setActivePanel: (panel: 'explorer' | 'scrapbook' | 'settings') => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activePanel,
  setActivePanel,
  isSidebarOpen,
  setIsSidebarOpen,
}) => {
  const handleItemClick = (panel: 'explorer' | 'scrapbook' | 'settings') => {
    if (activePanel === panel && isSidebarOpen) {
      setIsSidebarOpen(false);
    } else {
      setActivePanel(panel);
      setIsSidebarOpen(true);
    }
  };

  const navItems = [
    { id: 'explorer' as const, label: 'Drafts Explorer', icon: FileText },
    { id: 'scrapbook' as const, label: 'Method Scrapbook', icon: BookOpen },
    { id: 'settings' as const, label: 'Workspace Settings', icon: Settings },
  ];

  return (
    <div className="w-14 h-full bg-paper-dark border-r border-paper-darker flex flex-col justify-between items-center py-4 flex-shrink-0 z-10 select-none">
      <div className="flex flex-col items-center gap-4 w-full">
        {/* Brand Logo / Icon */}
        <div className="mb-4 text-terracotta flex items-center justify-center animate-pulse" title="Lyrical Songwriter">
          <Disc className="w-7 h-7 stroke-[1.5]" />
        </div>

        {/* Activity Buttons */}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id && isSidebarOpen;
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-paper-darker text-terracotta shadow-inner'
                  : 'text-ink-muted hover:text-ink hover:bg-paper-active/50'
              }`}
              title={item.label}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5 stroke-[1.5]" />
            </button>
          );
        })}
      </div>
      
      {/* Bottom decorative bar */}
      <div className="text-ink-light text-xs font-mono select-none pointer-events-none">
        v1.0
      </div>
    </div>
  );
};
