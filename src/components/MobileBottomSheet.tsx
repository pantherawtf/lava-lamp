import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Droplets,
  Layers,
  Palette,
  SunMedium,
  X,
} from 'lucide-react';
import type { InspectorTab, LavaConfig } from '../types/lava';
import { InspectorControlsBody } from './InspectorPanel';

export type MobileSheetState = 'closed' | 'half' | 'full';

interface MobileBottomSheetProps {
  sheetState: MobileSheetState;
  onSheetStateChange: (next: MobileSheetState) => void;
  isMobileLandscape: boolean;
  config: LavaConfig;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onUpdate: <K extends keyof LavaConfig>(key: K, value: LavaConfig[K]) => void;
  onBatchUpdate: (partial: Partial<LavaConfig>) => void;
  onCommitHistory: () => void;
}

const SHEET_TABS: {
  value: InspectorTab;
  label: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { value: 'frasco', label: 'Frasco', Icon: Layers },
  { value: 'interno', label: 'Interno', Icon: Droplets },
  { value: 'cores', label: 'Cores', Icon: Palette },
  { value: 'cena', label: 'Cena', Icon: SunMedium },
];

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  sheetState,
  onSheetStateChange,
  isMobileLandscape,
  config,
  activeTab,
  onTabChange,
  onUpdate,
  onBatchUpdate,
  onCommitHistory,
}) => {
  const isOpen = sheetState !== 'closed';
  const [dragDeltaY, setDragDeltaY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startY: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    moved: boolean;
  }>({
    active: false,
    pointerId: -1,
    startY: 0,
    lastY: 0,
    lastTime: 0,
    velocityY: 0,
    moved: false,
  });

  // Reset drag delta when sheet closes or state changes externally
  useEffect(() => {
    setDragDeltaY(0);
    setIsDragging(false);
  }, [sheetState]);

  if (!isOpen) return null;

  const halfFraction = isMobileLandscape ? 0.56 : 0.45;
  const fullFraction = isMobileLandscape ? 0.88 : 0.85;
  const targetHeightDvh = sheetState === 'full' ? fullFraction * 100 : halfFraction * 100;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Allow interactive buttons inside header to receive their own clicks cleanly
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const now = performance.now();
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      lastTime: now,
      velocityY: 0,
      moved: false,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active) return;

    const now = performance.now();
    const dt = Math.max(8, now - d.lastTime);
    d.velocityY = (e.clientY - d.lastY) / dt; // px per ms (positive = downward)
    d.lastY = e.clientY;
    d.lastTime = now;

    const rawDelta = e.clientY - d.startY;
    if (Math.abs(rawDelta) > 6) {
      d.moved = true;
    }

    // Clamp upward stretch softly so sheet stays nicely anchored
    const vh = window.innerHeight || 700;
    const maxUp = sheetState === 'full' ? -36 : -vh * (fullFraction - halfFraction) - 24;
    const clamped = Math.max(maxUp, rawDelta);
    setDragDeltaY(clamped);
  };

  const finishDrag = () => {
    const d = dragRef.current;
    if (!d.active) return;
    d.active = false;
    setIsDragging(false);

    const delta = dragDeltaY;
    const vel = d.velocityY;
    setDragDeltaY(0);

    // Quick tap on handle toggles half <-> full
    if (!d.moved) {
      onSheetStateChange(sheetState === 'half' ? 'full' : 'half');
      return;
    }

    // Fast downward flick or large downward pull
    if (vel > 0.55 || delta > 95) {
      if (sheetState === 'full' && vel < 1.1 && delta < 220) {
        onSheetStateChange('half');
      } else {
        onSheetStateChange('closed');
      }
      return;
    }

    // Fast upward flick or pulled upward past threshold
    if (vel < -0.45 || delta < -65) {
      onSheetStateChange('full');
      return;
    }

    // Otherwise stay on current snap point
  };

  // Compute live height/translate during drag using compositor-only transform
  const liveHeight =
    isDragging && dragDeltaY < 0 && sheetState === 'half'
      ? `min(${fullFraction * 100}dvh, calc(${halfFraction * 100}dvh + ${Math.abs(dragDeltaY)}px))`
      : `${targetHeightDvh}dvh`;

  const liveTranslateY = isDragging && dragDeltaY > 0 ? dragDeltaY : 0;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end pointer-events-none"
      role="dialog"
      aria-modal="false"
      aria-label="Parâmetros da lâmpada"
    >
      {/* Upper tap-to-close zone: keeps live canvas 100% visible and clear above the sheet */}
      <button
        type="button"
        aria-label="Fechar painel de parâmetros"
        onClick={() => onSheetStateChange('closed')}
        className={`flex-1 w-full pointer-events-auto cursor-default transition-colors duration-200 focus:outline-none ${
          sheetState === 'full' ? 'bg-black/25 dark:bg-black/40' : 'bg-transparent'
        }`}
      />

      {/* Bottom Sheet Surface */}
      <section
        style={{
          height: liveHeight,
          transform: `translate3d(0, ${liveTranslateY}px, 0)`,
        }}
        className={`pointer-events-auto w-full flex flex-col rounded-t-3xl bg-white/96 dark:bg-[#111115]/96 backdrop-blur-xl border-t border-black/[0.09] dark:border-white/[0.1] shadow-[0_-16px_48px_rgba(0,0,0,0.18)] dark:shadow-[0_-16px_54px_rgba(0,0,0,0.68)] overflow-hidden ${
          isDragging
            ? 'transition-none'
            : 'transition-[height,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]'
        }`}
      >
        {/* Drag Handle + Sheet Header (pinned at top, never scrolls) */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          className="shrink-0 touch-none select-none pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
        >
          {/* Centered Grab Handle with generous 44px drag zone */}
          <div className="pt-2.5 pb-1 flex items-center justify-center">
            <span
              aria-hidden="true"
              className="w-10 h-1.5 rounded-full bg-black/[0.16] dark:bg-white/[0.22]"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pb-1.5">
            <h2 className="text-[14px] font-semibold tracking-tight text-[#14141A] dark:text-[#F4F4F6] pl-1">
              Parâmetros
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSheetStateChange(sheetState === 'full' ? 'half' : 'full')}
                aria-label={sheetState === 'full' ? 'Reduzir painel' : 'Expandir painel'}
                className="h-11 w-11 inline-flex items-center justify-center rounded-xl text-[#5A5A6A] dark:text-[#A4A4B4] active:bg-black/[0.07] dark:active:bg-white/[0.1] active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5C35]"
              >
                {sheetState === 'full' ? (
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ChevronUp className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onSheetStateChange('closed')}
                aria-label="Fechar parâmetros"
                className="h-11 w-11 inline-flex items-center justify-center rounded-xl text-[#5A5A6A] dark:text-[#A4A4B4] active:bg-black/[0.07] dark:active:bg-white/[0.1] active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5C35]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Fixed Horizontally Scrollable Category Tabs (min 44px touch height) */}
        <div
          role="tablist"
          aria-label="Categorias de parâmetros"
          className="shrink-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2.5 border-b border-black/[0.07] dark:border-white/[0.08] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
        >
          {SHEET_TABS.map(({ value, label, Icon }) => {
            const active = activeTab === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(value)}
                className={`min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-xl text-[13px] font-medium whitespace-nowrap shrink-0 transition-all active:scale-[0.96] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5C35] ${
                  active
                    ? 'bg-[#14141A] dark:bg-[#F4F4F6] text-white dark:text-[#14141A] shadow-xs'
                    : 'bg-black/[0.045] dark:bg-white/[0.06] text-[#525262] dark:text-[#A4A4B4] active:bg-black/[0.09] dark:active:bg-white/[0.12]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Isolated Scrollable Sheet Body (overscroll-behavior: contain) */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain studio-scroll pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
        >
          <InspectorControlsBody
            config={config}
            activeTab={activeTab}
            onUpdate={onUpdate}
            onBatchUpdate={onBatchUpdate}
            onCommitHistory={onCommitHistory}
            isTouchSheet={true}
          />
        </div>
      </section>
    </div>
  );
};
