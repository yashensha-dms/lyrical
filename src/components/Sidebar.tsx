import React from 'react';
import { FileDown, FileUp, ChevronLeft } from 'lucide-react';

interface SidebarProps {
  activePanel: 'settings';
  exportAllDrafts: () => void;
  importDrafts: (jsonString: string) => boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isCloudMode: boolean;
  isMobile?: boolean;
  penName?: string;
  setPenName?: (name: string) => void;
  googleDefaultName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePanel,
  exportAllDrafts,
  importDrafts,
  setIsSidebarOpen,
  isMobile = false,
  penName,
  setPenName,
  googleDefaultName,
}) => {
  const [localPenName, setLocalPenName] = React.useState(penName || '');

  React.useEffect(() => {
    if (penName !== undefined) {
      setLocalPenName(penName);
    }
  }, [penName]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importDrafts(content);
      if (success) {
        alert('Drafts imported successfully!');
      } else {
        alert('Failed to import drafts. Make sure the file format is correct.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  return (
    <div className={`${isMobile ? 'w-full' : 'w-64'} h-full bg-paper-dark/70 border-r border-paper-darker flex flex-col flex-shrink-0 z-10`}>
      {/* Sidebar Header */}
      <div className="h-14 px-4 border-b border-paper-darker flex items-center justify-between select-none">
        <span className="font-semibold tracking-wide text-ink text-sm uppercase">
          Settings
        </span>
        {!isMobile && (
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="text-ink-muted hover:text-ink hover:bg-paper-darker p-1 rounded cursor-pointer"
            title="Collapse Panel"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Settings Panel */}
      {activePanel === 'settings' && (
        <div className="flex-1 p-4 flex flex-col justify-between select-none bg-transparent">
          <div className="space-y-4">
            {penName !== undefined && setPenName && (
              <div className="border-b border-paper-darker pb-4">
                <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">Pen Name</h4>
                <p className="text-[11px] text-ink-muted leading-relaxed mb-2">
                  Configure your display name for real-time collaboration. Defaults to your Google account name.
                </p>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder={googleDefaultName || 'Enter your pen name...'}
                    value={localPenName}
                    onChange={(e) => setLocalPenName(e.target.value)}
                    spellCheck="false"
                    className="w-full bg-paper border border-paper-darker rounded px-3 py-1.5 text-xs text-ink placeholder-ink-light focus:outline-none focus:border-terracotta transition select-text"
                  />
                  <button
                    onClick={() => setPenName(localPenName)}
                    className="w-full self-end px-4 py-1.5 bg-terracotta hover:bg-terracotta-hover text-white rounded text-xs font-bold transition cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">Backups</h4>
              <p className="text-[11px] text-ink-muted leading-relaxed mb-3">
                Export or import your songwriting workspace. All files remain strictly local in your browser.
              </p>
              
              <div className="space-y-2">
                <button
                  onClick={exportAllDrafts}
                  className="w-full flex items-center justify-center gap-2 bg-paper border border-paper-darker hover:bg-paper-darker text-ink text-xs py-2 rounded-md transition cursor-pointer shadow-paper-sm focus-visible:ring-2 focus-visible:ring-terracotta focus:outline-none"
                  aria-label="Backup all drafts library to JSON"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Backup Library (JSON)
                </button>

                <label
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      const fileInput = document.getElementById('restore-file-input');
                      if (fileInput) fileInput.click();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-paper border border-paper-darker hover:bg-paper-darker text-ink text-xs py-2 rounded-md transition cursor-pointer shadow-paper-sm focus-visible:ring-2 focus-visible:ring-terracotta focus:outline-none"
                  aria-label="Restore library from JSON backup"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  Restore Library
                  <input
                    id="restore-file-input"
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-paper-darker pt-4">
              <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">About Lyrical</h4>
              <p className="text-[11px] text-ink-muted leading-relaxed">
                Lyrical is designed around the pop math principles of Swedish hitmakers and emotional lyric design.
              </p>
            </div>
          </div>
          
          <div className="text-[10px] text-ink-light text-center">
            Songwriter's Workspace v2.5.0
          </div>
        </div>
      )}
    </div>
  );
};
