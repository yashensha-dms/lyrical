import { Settings, PanelLeftClose, PanelLeft, Sparkles, Skull } from 'lucide-react';

interface ActivityBarProps {
  activePanel: 'settings' | 'phrases' | 'graveyard';
  setActivePanel: (panel: 'settings' | 'phrases' | 'graveyard') => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activePanel,
  setActivePanel,
  isSidebarOpen,
  setIsSidebarOpen,
}) => {
  const handleItemClick = (panel: 'settings' | 'phrases' | 'graveyard') => {
    if (activePanel === panel && isSidebarOpen) {
      setIsSidebarOpen(false);
    } else {
      setActivePanel(panel);
      setIsSidebarOpen(true);
    }
  };

  const navItems = [
    { id: 'phrases' as const, label: 'Phrase Catcher', icon: Sparkles },
    { id: 'graveyard' as const, label: 'Graveyard', icon: Skull },
    { id: 'settings' as const, label: 'Workspace Settings', icon: Settings },
  ];

  return (
    <div className="w-14 h-full bg-paper-dark border-r border-paper-darker flex flex-col justify-between items-center py-4 flex-shrink-0 z-10 select-none">
      <div className="flex flex-col items-center gap-4 w-full">
        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`w-10 h-10 mb-4 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
            isSidebarOpen
              ? 'bg-paper-darker text-terracotta shadow-inner'
              : 'text-ink-muted hover:text-ink hover:bg-paper-active/50'
          }`}
          title={isSidebarOpen ? "Collapse Left Sidebar" : "Expand Left Sidebar"}
          aria-label="Toggle Left Sidebar"
        >
          {isSidebarOpen ? <PanelLeftClose className="w-5 h-5 stroke-[1.5]" /> : <PanelLeft className="w-5 h-5 stroke-[1.5]" />}
        </button>

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
        v2.5.0
      </div>
    </div>
  );
};
