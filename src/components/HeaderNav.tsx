import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export interface HeaderNavProps {
  title?: string;
  userEmail?: string;
  onSignOut?: () => void;
  onLogoClick?: () => void;
  subconsciousActive?: boolean;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  title,
  userEmail,
  onSignOut,
  onLogoClick,
  subconsciousActive = false,
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <header
      className={`h-10 w-full bg-paper border-b border-paper-darker flex items-center justify-between px-4 select-none flex-shrink-0 transition-all duration-500 ${
        subconsciousActive ? 'opacity-10 pointer-events-none' : ''
      }`}
    >
      {/* Left: Logo + back to home / title */}
      <div className="flex items-center gap-2">
        <button
          onClick={onLogoClick}
          className="font-extrabold text-terracotta tracking-wider text-base hover:text-terracotta-hover transition cursor-pointer"
          title="All Songs"
        >
          Lyrical
        </button>
        {title && (
          <span className="text-[10px] bg-paper-dark border border-paper-darker text-ink-muted px-1.5 py-0.5 rounded font-mono font-medium">
            {title}
          </span>
        )}
      </div>

      {/* Right: Theme toggle + User + Sign Out */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="text-ink-muted hover:text-terracotta transition p-1 rounded cursor-pointer focus:outline-none"
          title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {resolvedTheme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
        {userEmail && (
          <span className="text-[11px] text-ink-muted hidden sm:inline">
            {userEmail}
          </span>
        )}
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="text-[10px] uppercase font-bold text-ink-muted hover:text-terracotta transition border border-paper-darker hover:border-terracotta/30 px-2 py-1 rounded bg-paper-dark cursor-pointer focus:outline-none"
          >
            Sign Out
          </button>
        )}
      </div>
    </header>
  );
};
