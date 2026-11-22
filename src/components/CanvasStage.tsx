import React, { useEffect, useRef, useState } from 'react';
import {
  Pause,
  Play,
  Redo2,
  RefreshCw,
  SlidersHorizontal,
  Undo2,
  Waves,
} from 'lucide-react';
import { LavaRenderer } from '../engine/LavaRenderer';
import { LavaPhysics } from '../engine/physics';
import type { LavaConfig } from '../types/lava';

interface CanvasStageProps {
  config: LavaConfig;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStirFluid: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onRandomizeLamp: () => void;
  physicsRef: React.MutableRefObject<LavaPhysics>;
  parallaxRef: React.MutableRefObject<[number, number]>;
  viewportRatioRef: React.MutableRefObject<number>;
  onToggleMobileInspector?: () => void;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  config,
  isPlaying,
  onTogglePlay,
  onStirFluid,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onRandomizeLamp,
  physicsRef,
  parallaxRef,
  viewportRatioRef,
  onToggleMobileInspector,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<LavaRenderer | null>(null);

  const configRef = useRef<LavaConfig>(config);
  const isPlayingRef = useRef<boolean>(isPlaying);

  const [webglError, setWebglError] = useState<string | null>(null);

  const dragState = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });
  const targetParallax = useRef<[number, number]>([0, 0]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: LavaRenderer | null = null;
    try {
      renderer = new LavaRenderer(canvas, false);
      rendererRef.current = renderer;
      setWebglError(null);
    } catch (err) {
      setWebglError(err instanceof Error ? err.message : 'Erro ao inicializar WebGL2.');
      return;
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('Contexto WebGL interrompido. Restaurando...');
    };

    const handleContextRestored = () => {
      try {
        renderer?.dispose();
        renderer = new LavaRenderer(canvas, false);
        rendererRef.current = renderer;
        setWebglError(null);
      } catch (err) {
        setWebglError(err instanceof Error ? err.message : 'Erro ao restaurar WebGL2.');
      }
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    let rafId = 0;
    let lastTs = performance.now();
    let adaptiveScale = 1.0;
    let smoothFrameMs = 16.6;
    let lastRenderedConfig: LavaConfig | null = null;
    let lastW = 0;
    let lastH = 0;

    const MAX_LIVE_PIXELS = 950_000; // Crisp ~1280x740 equivalent on live stage; export remains full 2K/4K

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);

      if (document.hidden) {
        lastTs = now;
        return;
      }

      const rawMs = now - lastTs;
      const dt = Math.min(rawMs / 1000, 0.05);
      lastTs = now;

      // Gently adapt internal render scale if GPU frame time creeps above 22ms
      if (isPlayingRef.current && rawMs < 200) {
        smoothFrameMs = smoothFrameMs * 0.9 + rawMs * 0.1;
        if (smoothFrameMs > 24 && adaptiveScale > 0.6) {
          adaptiveScale = Math.max(0.6, adaptiveScale - 0.04);
        } else if (smoothFrameMs < 15.5 && adaptiveScale < 1.0) {
          adaptiveScale = Math.min(1.0, adaptiveScale + 0.02);
        }
      }

      const cfg = configRef.current;
      const physics = physicsRef.current;

      const parallaxDelta =
        Math.abs(targetParallax.current[0] - parallaxRef.current[0]) +
        Math.abs(targetParallax.current[1] - parallaxRef.current[1]);

      if (parallaxDelta > 0.0005) {
        parallaxRef.current[0] += (targetParallax.current[0] - parallaxRef.current[0]) * 0.1;
        parallaxRef.current[1] += (targetParallax.current[1] - parallaxRef.current[1]) * 0.1;
      }

      const clientW = Math.max(1, canvas.clientWidth);
      const clientH = Math.max(1, canvas.clientHeight);
      viewportRatioRef.current = clientW / clientH;

      const baseDpr = Math.min(window.devicePixelRatio || 1, 1.35);
      let targetW = Math.floor(clientW * baseDpr * adaptiveScale);
      let targetH = Math.floor(clientH * baseDpr * adaptiveScale);

      const pixelCount = targetW * targetH;
      if (pixelCount > MAX_LIVE_PIXELS) {
        const shrink = Math.sqrt(MAX_LIVE_PIXELS / pixelCount);
        targetW = Math.max(1, Math.floor(targetW * shrink));
        targetH = Math.max(1, Math.floor(targetH * shrink));
      }

      const resized = canvas.width !== targetW || canvas.height !== targetH;
      if (resized) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const needsRender =
        isPlayingRef.current ||
        resized ||
        parallaxDelta > 0.0005 ||
        cfg !== lastRenderedConfig ||
        lastW !== targetW ||
        lastH !== targetH;

      if (!needsRender) {
        return;
      }

      if (isPlayingRef.current) {
        const motionScale = prefersReducedMotion ? 0.25 : 1.0;
        physics.step(dt * motionScale, cfg.flowSpeed, cfg.blobCount, cfg.waxScale);
      }

      if (rendererRef.current) {
        const blobData = physics.packUniformArray(cfg.blobCount);
        rendererRef.current.render(cfg, blobData, physics.time, parallaxRef.current, false);
        lastRenderedConfig = cfg;
        lastW = targetW;
        lastH = targetH;
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [physicsRef, parallaxRef, viewportRatioRef]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { active: true, lastX: e.clientX, lastY: e.clientY };

    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    physicsRef.current.applyImpulse(nx, ny, 0, 0.24);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    targetParallax.current = [nx * 0.45, ny * 0.35];

    if (dragState.current.active) {
      const dx = (e.clientX - dragState.current.lastX) / rect.width;
      const dy = -(e.clientY - dragState.current.lastY) / rect.height;
      physicsRef.current.applyImpulse(nx, ny, dx * 4.2, dy * 4.2);
      dragState.current.lastX = e.clientX;
      dragState.current.lastY = e.clientY;
    }
  };

  const handlePointerUp = () => {
    dragState.current.active = false;
  };

  const handlePointerLeave = () => {
    dragState.current.active = false;
    targetParallax.current = [0, 0];
  };

  return (
    <main
      id="stage"
      className="relative w-full h-full overflow-hidden select-none bg-[#ECEEF3] dark:bg-[#08080A]"
    >
      {/* Full-Width, Full-Height Edge-to-Edge Infinite Studio Canvas */}
      {webglError ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-[#F4F5F8] dark:bg-gradient-to-b dark:from-[#16161C] dark:to-[#0B0B0F]">
          <p className="text-[14px] font-medium text-[#14141A] dark:text-[#F4F4F6] mb-1">
            Renderização WebGL2 indisponível
          </p>
          <p className="text-[12px] text-[#666676] dark:text-[#8E8E9E] max-w-xs">{webglError}</p>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
        />
      )}

      {/* Floating Bottom Studio Control Dock */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/88 dark:bg-[#121216]/88 backdrop-blur-md border border-black/[0.08] dark:border-white/[0.09] shadow-[0_12px_36px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.55)] max-w-[calc(100%-24px)] overflow-x-auto transition-colors duration-200">
        <button
          type="button"
          onClick={onTogglePlay}
          title={isPlaying ? 'Pausar simulação (Espaço)' : 'Reproduzir simulação (Espaço)'}
          aria-label={isPlaying ? 'Pausar simulação' : 'Reproduzir simulação'}
          className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-[12.5px] font-medium text-[#1C1C24] dark:text-[#E4E4EC] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35]"
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{isPlaying ? 'Pausar' : 'Reproduzir'}</span>
        </button>

        <div className="w-px h-5 bg-black/[0.09] dark:bg-white/[0.08] mx-0.5 shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Desfazer (Ctrl+Z)"
          aria-label="Desfazer"
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-[#565666] dark:text-[#B6B6C4] hover:text-[#14141A] dark:hover:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35]"
        >
          <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Refazer (Ctrl+Shift+Z)"
          aria-label="Refazer"
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-[#565666] dark:text-[#B6B6C4] hover:text-[#14141A] dark:hover:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35]"
        >
          <Redo2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>

        <div className="w-px h-5 bg-black/[0.09] dark:bg-white/[0.08] mx-0.5 shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={onStirFluid}
          title="Aplicar impulso térmico na cera interna"
          className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg text-[12.5px] font-medium bg-black/[0.05] dark:bg-white/[0.07] hover:bg-black/[0.1] dark:hover:bg-white/[0.13] text-[#14141A] dark:text-[#F4F4F6] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35]"
        >
          <Waves className="w-3.5 h-3.5 shrink-0 text-[#4A4A58] dark:text-[#D4D4E0]" aria-hidden="true" />
          <span>Agitar Cera</span>
        </button>

        <div className="w-px h-5 bg-black/[0.09] dark:bg-white/[0.08] mx-0.5 shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={onRandomizeLamp}
          title="Gerar nova configuração de lava lamp"
          aria-label="Randomizar configurações da lâmpada"
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-[#5A5A6A] dark:text-[#9A9AA8] hover:text-[#14141A] dark:hover:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.08] active:rotate-90 transition-all duration-150 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35]"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        </button>

        {onToggleMobileInspector && (
          <button
            type="button"
            onClick={onToggleMobileInspector}
            aria-label="Abrir parâmetros"
            className="md:hidden h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-[12.5px] font-medium bg-black/[0.06] dark:bg-white/[0.08] text-[#14141A] dark:text-[#F4F4F6] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Parâmetros</span>
          </button>
        )}
      </div>
    </main>
  );
};
