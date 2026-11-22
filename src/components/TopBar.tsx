import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Download, Moon, Sun } from 'lucide-react';
import type { BackgroundMode } from '../types/lava';
import { StudioRadio } from './StudioRadio';

interface TopBarProps {
  bgMode: BackgroundMode;
  onToggleBgMode: () => void;
  onOpenExport: () => void;
  isMobileLandscape?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  bgMode,
  onToggleBgMode,
  onOpenExport,
  isMobileLandscape = false,
}) => {
  const isDark = bgMode === 'dark';
  const [landscapeBarOpen, setLandscapeBarOpen] = useState(false);

  // Automatically tuck top bar away when entering mobile landscape (< 500px height)
  useEffect(() => {
    if (isMobileLandscape) {
      setLandscapeBarOpen(false);
    }
  }, [isMobileLandscape]);

  // Mobile landscape (< 500px height): hide top bar by default behind a discreet 44x44 trigger
  if (isMobileLandscape && !landscapeBarOpen) {
    return (
      <div
        className="pointer-events-none absolute top-0 left-0 z-20"
        style={{
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        }}
      >
        <button
          type="button"
          onClick={() => setLandscapeBarOpen(true)}
          aria-label="Mostrar barra superior"
          title="Mostrar barra superior"
          className="pointer-events-auto h-11 w-11 inline-flex items-center justify-center rounded-full bg-white/82 dark:bg-[#141419]/85 backdrop-blur-md border border-black/[0.09] dark:border-white/[0.11] text-[#14141A] dark:text-[#F4F4F6] shadow-[0_2px_10px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)] active:scale-95 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5C35]"
        >
          <ChevronDown className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <header
      className="pointer-events-none absolute top-0 left-0 right-0 z-20 min-h-16 md:h-16 flex items-center justify-between gap-2.5 md:gap-4 pt-[max(0.5rem,env(safe-area-inset-top))] md:pt-0 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:px-6"
    >
      {/* Left: Brand wordmark + quick Light/Dark toggle + collapsible Studio Radio */}
      <div className="pointer-events-auto flex items-center gap-2 md:gap-3 shrink-0">
        {isMobileLandscape && (
          <button
            type="button"
            onClick={() => setLandscapeBarOpen(false)}
            aria-label="Recolher barra superior"
            title="Recolher barra superior"
            className="h-11 w-11 inline-flex items-center justify-center rounded-full bg-white/82 dark:bg-[#141419]/85 backdrop-blur-md border border-black/[0.09] dark:border-white/[0.11] text-[#14141A] dark:text-[#F4F4F6] active:scale-95 transition-transform shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5C35]"
          >
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          </button>
        )}

        <a
          href="#stage"
          onClick={(e) => e.preventDefault()}
          className="text-[18px] font-bold tracking-[-0.02em] text-[#14141A] dark:text-[#F4F4F6] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35] rounded transition-colors duration-200"
        >
          Lumina
        </a>

        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label={
            isDark
              ? 'Fundo escuro ativo. Alternar para fundo claro'
              : 'Fundo claro ativo. Alternar para fundo escuro'
          }
          title={isDark ? 'Mudar para fundo claro' : 'Mudar para fundo escuro'}
          onClick={onToggleBgMode}
          className="group inline-flex items-center justify-center px-2 md:px-1.5 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:h-8 rounded-full bg-white/82 dark:bg-[#141419]/85 backdrop-blur-md border border-black/[0.09] dark:border-white/[0.11] shadow-[0_2px_10px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.35)] md:hover:border-black/[0.18] md:dark:hover:border-white/[0.2] active:scale-95 transition-all duration-150 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5C35]"
        >
          <span
            aria-hidden="true"
            className="relative w-10 h-5 rounded-full bg-black/[0.08] dark:bg-white/[0.12] transition-colors duration-200 flex items-center px-0.5"
          >
            <span
              className={`w-4 h-4 rounded-full bg-white dark:bg-[#F4F4F6] text-[#14141A] shadow-xs flex items-center justify-center transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isDark ? 'translate-x-5' : 'translate-x-0'
              }`}
            >
              {isDark ? <Moon className="w-2.5 h-2.5" /> : <Sun className="w-2.5 h-2.5" />}
            </span>
          </span>
        </button>

        <StudioRadio />
      </div>

      {/* Right: Single primary CTA */}
      <div className="pointer-events-auto shrink-0">
        <button
          type="button"
          onClick={onOpenExport}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] md:min-h-0 px-3.5 md:px-4 py-2 text-[13px] font-semibold text-white bg-[#FF5C35] md:hover:bg-[#FF6D49] active:scale-[0.96] active:bg-[#E84D27] rounded-xl md:rounded-lg shadow-[0_4px_16px_rgba(255,92,53,0.28)] transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5C35]/60 cursor-pointer"
        >
          <Download className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0" aria-hidden="true" />
          <span>Exportar</span>
        </button>
      </div>
    </header>
  );
};
