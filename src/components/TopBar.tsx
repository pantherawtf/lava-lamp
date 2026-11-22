import React from 'react';
import { Download } from 'lucide-react';

interface TopBarProps {
  onOpenExport: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenExport }) => {
  return (
    <header className="pointer-events-none absolute top-0 left-0 right-0 z-20 h-16 px-6 flex items-center justify-between gap-8">
      {/* Zone 1: Single-line brand wordmark */}
      <a
        href="#stage"
        onClick={(e) => e.preventDefault()}
        className="pointer-events-auto text-[18px] font-bold tracking-[-0.02em] text-[#14141A] dark:text-[#F4F4F6] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35] rounded transition-colors duration-200"
      >
        Lumina
      </a>

      {/* Zone 3: Single primary CTA */}
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
