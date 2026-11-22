import { useCallback, useEffect, useRef, useState } from 'react';
import { CanvasStage } from './components/CanvasStage';
import { ExportModal } from './components/ExportModal';
import { InspectorPanel } from './components/InspectorPanel';
import { TopBar } from './components/TopBar';
import { PRESETS } from './data/presets';
import { LavaPhysics } from './engine/physics';
import type {
  AspectRatioId,
  InspectorTab,
  LavaConfig,
  PresetDefinition,
} from './types/lava';

const MAX_HISTORY = 40;

export default function App() {
  const initialPreset = PRESETS[0];

  const [config, setConfig] = useState<LavaConfig>(() => ({ ...initialPreset.config }));
  const [activePresetId, setActivePresetId] = useState<string | null>(initialPreset.id);
  const [exportAspectRatio, setExportAspectRatio] = useState<AspectRatioId>('4:5');
  const [activeTab, setActiveTab] = useState<InspectorTab>('frasco');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [exportOpen, setExportOpen] = useState<boolean>(false);

  // Collapsible lateral parameter panel (starts collapsed, synchronized with stage)
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState<boolean>(false);

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
      setActivePresetId(null);
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleBatchUpdate = useCallback(
    (partial: Partial<LavaConfig>) => {
      setActivePresetId(null);
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

  const handleSelectPreset = useCallback(
    (preset: PresetDefinition) => {
      const next: LavaConfig = {
        ...preset.config,
        bgMode: configRef.current.bgMode,
        bgLuminance: configRef.current.bgLuminance,
      };
      setConfig(next);
      setActivePresetId(preset.id);
      pushHistory(next);
    },
    [pushHistory]
  );

  const handleOpenTabFromRail = useCallback((tab: InspectorTab) => {
    setActiveTab(tab);
    setInspectorOpen(true);
  }, []);

  const handleStirFluid = useCallback(() => {
    physicsRef.current.applyImpulse(
      (Math.random() - 0.5) * 0.5,
      -0.25,
      (Math.random() - 0.5) * 0.7,
      0.55
    );
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prevIdx = historyIndex - 1;
    setHistoryIndex(prevIdx);
    setConfig({ ...history[prevIdx] });
    setActivePresetId(null);
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextIdx = historyIndex + 1;
    setHistoryIndex(nextIdx);
    setConfig({ ...history[nextIdx] });
    setActivePresetId(null);
  }, [history, historyIndex]);

  const handleResetPreset = useCallback(() => {
    const base = PRESETS.find((p) => p.id === activePresetId) ?? PRESETS[0];
    const next: LavaConfig = {
      ...base.config,
      bgMode: configRef.current.bgMode,
      bgLuminance: configRef.current.bgLuminance,
    };
    setConfig(next);
    setActivePresetId(base.id);
    physicsRef.current.reset(2026);
    pushHistory(next);
  }, [activePresetId, pushHistory]);

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

  return (
    <div className="h-screen w-screen flex bg-[#F2F3F7] dark:bg-[#0A0A0C] text-[#14141A] dark:text-[#F4F4F6] overflow-hidden transition-colors duration-200">
      {/* Full-Height, Full-Width Studio Stage with Floating TopBar */}
      <div className="relative flex-1 min-w-0 h-full overflow-hidden">
        <TopBar onOpenExport={() => setExportOpen(true)} />

        <CanvasStage
          config={config}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onStirFluid={handleStirFluid}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          onResetPreset={handleResetPreset}
          physicsRef={physicsRef}
          parallaxRef={parallaxRef}
          viewportRatioRef={viewportRatioRef}
          onToggleMobileInspector={() => setMobileInspectorOpen(true)}
        />
      </div>

      {/* Desktop Synchronized Collapsible Lateral Rail / Sidebar */}
      <div className="hidden md:flex h-full shrink-0">
        <InspectorPanel
          isOpen={inspectorOpen}
          onToggleOpen={() => setInspectorOpen((o) => !o)}
          onOpenTab={handleOpenTabFromRail}
          config={config}
          activeTab={activeTab}
          activePresetId={activePresetId}
          onTabChange={setActiveTab}
          onUpdate={handleUpdate}
          onBatchUpdate={handleBatchUpdate}
          onCommitHistory={handleCommitHistory}
          onSelectPreset={handleSelectPreset}
        />
      </div>

      {/* Mobile Slide-over Inspector Drawer */}
      {mobileInspectorOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileInspectorOpen(false);
          }}
          className="md:hidden fixed inset-0 z-40 flex justify-end bg-black/45 dark:bg-black/65 backdrop-blur-xs"
        >
          <InspectorPanel
            isOpen={true}
            isMobileDrawer={true}
            onToggleOpen={() => setMobileInspectorOpen(false)}
            onOpenTab={handleOpenTabFromRail}
            config={config}
            activeTab={activeTab}
            activePresetId={activePresetId}
            onTabChange={setActiveTab}
            onUpdate={handleUpdate}
            onBatchUpdate={handleBatchUpdate}
            onCommitHistory={handleCommitHistory}
            onSelectPreset={handleSelectPreset}
          />
        </div>
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
