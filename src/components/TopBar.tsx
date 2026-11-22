import React from 'react';
import { Download, Moon, Sun } from 'lucide-react';
import type { BackgroundMode } from '../types/lava';
import { StudioRadio } from './StudioRadio';

interface TopBarProps {
  bgMode: BackgroundMode;
  onToggleBgMode: () => void;
  onOpenExport: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  bgMode,
  onToggleBgMode,
  onOpenExport,
}) => {
  const isDark = bgMode === 'dark';

  return (
    <header className="pointer-events-none absolute top-0 left-0 right-0 z-20 h-16 px-6 flex items-center justify-between gap-4">
      {/* Left: Brand wordmark + quick Light/Dark toggle + collapsible Studio Radio */}
      <div className="pointer-events-auto flex items-center gap-3 shrink-0">
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
          aria-label={isDark ? 'Fundo escuro ativo. Alternar para fundo claro' : 'Fundo claro ativo. Alternar para fundo escuro'}
          title={isDark ? 'Mudar para fundo claro' : 'Mudar para fundo escuro'}
          onClick={onToggleBgMode}
          className="group inline-flex items-center gap-2 pl-1.5 pr-3 h-8 rounded-full bg-white/82 dark:bg-[#141419]/85 backdrop-blur-md border border-black/[0.09] dark:border-white/[0.11] shadow-[0_2px_10px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.35)] hover:border-black/[0.18] dark:hover:border-white/[0.2] transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5C35]"
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
              {isDark ? (
                <Moon className="w-2.5 h-2.5" />
              ) : (
                <Sun className="w-2.5 h-2.5" />
              )}
            </span>
          </span>
          <span className="text-[12px] font-medium text-[#2A2A36] dark:text-[#D8D8E4]">
            {isDark ? 'Escuro' : 'Claro'}
          </span>
        </button>

        <StudioRadio />
      </div>

      {/* Right: Single primary CTA */}
      <div className="pointer-events-auto shrink-0">
        <button
          type="button"
          onClick={onOpenExport}
          className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white bg-[#FF5C35] hover:bg-[#FF6D49] active:scale-[0.98] rounded-lg shadow-[0_4px_16px_rgba(255,92,53,0.28)] transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5C35]/60 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Exportar</span>
        </button>
      </div>
    </header>
  );
};
