import { useCallback, useEffect, useRef, useState } from 'react';
import { CanvasStage } from './components/CanvasStage';
import { ExportModal } from './components/ExportModal';
import { InspectorPanel } from './components/InspectorPanel';
import { MobileBottomSheet, type MobileSheetState } from './components/MobileBottomSheet';
import { TopBar } from './components/TopBar';
import { PRESETS, randomizeLampConfig } from './data/presets';
import { LavaPhysics } from './engine/physics';
import type {
  AspectRatioId,
  InspectorTab,
  LavaConfig,
} from './types/lava';

const MAX_HISTORY = 40;

function detectMobileViewport(): { isMobileLayout: boolean; isMobileLandscape: boolean } {
  if (typeof window === 'undefined') {
    return { isMobileLayout: false, isMobileLandscape: false };
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  const isMobileLandscape = h < 500 && (w < 960 || isCoarse);
  const isMobileLayout = w < 768 || isMobileLandscape;
  return { isMobileLayout, isMobileLandscape };
}

export default function App() {
  const initialPreset = PRESETS[0];

  const [config, setConfig] = useState<LavaConfig>(() => ({ ...initialPreset.config }));
  const [exportAspectRatio, setExportAspectRatio] = useState<AspectRatioId>('4:5');
  const [activeTab, setActiveTab] = useState<InspectorTab>('frasco');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [exportOpen, setExportOpen] = useState<boolean>(false);

  // Desktop synchronized collapsible lateral rail/sidebar (100% preserved)
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(false);

  // Mobile portrait/landscape detection + Bottom Sheet snap state ('closed' | 'half' | 'full')
  const [viewportInfo, setViewportInfo] = useState(detectMobileViewport);
  const [mobileSheetState, setMobileSheetState] = useState<MobileSheetState>('closed');

  const [history, setHistory] = useState<LavaConfig[]>(() => [{ ...initialPreset.config }]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const physicsRef = useRef<LavaPhysics>(new LavaPhysics(2026));
  const parallaxRef = useRef<[number, number]>([0, 0]);
  const viewportRatioRef = useRef<number>(16 / 9);
  const configRef = useRef<LavaConfig>(config);
  configRef.current = config;

  // Synchronize page-wide Light / Dark theme class with the infinite background mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', config.bgMode === 'dark');
  }, [config.bgMode]);

  // Listen to resize / orientation changes for responsive portrait & landscape handling
  useEffect(() => {
    const updateViewport = () => {
      const next = detectMobileViewport();
      setViewportInfo((prev) =>
        prev.isMobileLayout === next.isMobileLayout &&
        prev.isMobileLandscape === next.isMobileLandscape
          ? prev
          : next
      );
      if (!next.isMobileLayout) {
        setMobileSheetState('closed');
      }
    };
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  const pushHistory = useCallback(
    (nextCfg: LavaConfig) => {
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        const last = sliced[sliced.length - 1];
        if (last && JSON.stringify(last) === JSON.stringify(nextCfg)) {
          return prev;
        }
        const appended = [...sliced, { ...nextCfg }];
        if (appended.length > MAX_HISTORY) {
          appended.shift();
        }
        setHistoryIndex(appended.length - 1);
        return appended;
      });
    },
    [historyIndex]
  );

  const handleUpdate = useCallback(
    <K extends keyof LavaConfig>(key: K, value: LavaConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleBatchUpdate = useCallback(
    (partial: Partial<LavaConfig>) => {
      setConfig((prev) => {
        const next = { ...prev, ...partial };
        pushHistory(next);
        return next;
      });
    },
    [pushHistory]
  );

  const handleCommitHistory = useCallback(() => {
    pushHistory(configRef.current);
  }, [pushHistory]);

  const handleOpenTabFromRail = useCallback((tab: InspectorTab) => {
    setActiveTab(tab);
    setInspectorOpen(true);
  }, []);

  const handleStirFluid = useCallback(() => {
    physicsRef.current.stirOpposite(configRef.current.blobCount);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prevIdx = historyIndex - 1;
    setHistoryIndex(prevIdx);
    setConfig({ ...history[prevIdx] });
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextIdx = historyIndex + 1;
    setHistoryIndex(nextIdx);
    setConfig({ ...history[nextIdx] });
  }, [history, historyIndex]);

  const handleRandomizeLamp = useCallback(() => {
    const next = randomizeLampConfig(configRef.current);
    setConfig(next);
    physicsRef.current.reset(Math.floor(Math.random() * 999999));
    pushHistory(next);
  }, [pushHistory]);

  // Keyboard shortcuts (Space: play/pause, Ctrl/Cmd+Z: undo/redo, ]: toggle side panel)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (e.key === ']') {
        e.preventDefault();
        setInspectorOpen((o) => !o);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  const handleToggleBgMode = useCallback(() => {
    const nextMode = configRef.current.bgMode === 'light' ? 'dark' : 'light';
    const next: LavaConfig = { ...configRef.current, bgMode: nextMode };
    setConfig(next);
    pushHistory(next);
  }, [pushHistory]);

  const { isMobileLayout, isMobileLandscape } = viewportInfo;

  return (
    <div className="h-[100dvh] w-[100dvw] min-h-[100dvh] flex bg-[#F2F3F7] dark:bg-[#0A0A0C] text-[#14141A] dark:text-[#F4F4F6] overflow-hidden transition-colors duration-200">
      {/* Full-Height, Full-Width Studio Stage with Floating TopBar */}
      <div className="relative flex-1 min-w-0 h-full overflow-hidden">
        <TopBar
          bgMode={config.bgMode}
          onToggleBgMode={handleToggleBgMode}
          onOpenExport={() => setExportOpen(true)}
          isMobileLandscape={isMobileLandscape}
        />

        <CanvasStage
          config={config}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onStirFluid={handleStirFluid}
          onRandomizeLamp={handleRandomizeLamp}
          onMobileBlobCountChange={(nextCount) => handleUpdate('blobCount', nextCount)}
          physicsRef={physicsRef}
          parallaxRef={parallaxRef}
          viewportRatioRef={viewportRatioRef}
          isMobileLayout={isMobileLayout}
          isMobileLandscape={isMobileLandscape}
          mobileSheetState={mobileSheetState}
          onOpenMobileSheet={() => setMobileSheetState('half')}
        />
      </div>

      {/* Desktop Synchronized Collapsible Lateral Rail / Sidebar (100% preserved) */}
      {!isMobileLayout && (
        <div className="hidden md:flex h-full shrink-0">
          <InspectorPanel
            isOpen={inspectorOpen}
            onToggleOpen={() => setInspectorOpen((o) => !o)}
            onOpenTab={handleOpenTabFromRail}
            config={config}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onUpdate={handleUpdate}
            onBatchUpdate={handleBatchUpdate}
            onCommitHistory={handleCommitHistory}
          />
        </div>
      )}

      {/* Mobile Interactive Bottom Sheet (~45% / ~85%) */}
      {isMobileLayout && (
        <MobileBottomSheet
          sheetState={mobileSheetState}
          onSheetStateChange={setMobileSheetState}
          isMobileLandscape={isMobileLandscape}
          config={config}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onUpdate={handleUpdate}
          onBatchUpdate={handleBatchUpdate}
          onCommitHistory={handleCommitHistory}
        />
      )}

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        config={config}
        aspectRatio={exportAspectRatio}
        onAspectRatioChange={setExportAspectRatio}
        viewportRatioRef={viewportRatioRef}
        physicsRef={physicsRef}
        parallaxRef={parallaxRef}
      />
    </div>
  );
}
