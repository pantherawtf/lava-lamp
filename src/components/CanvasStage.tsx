import React, { useEffect, useRef, useState } from 'react';
import {
  Pause,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Waves,
} from 'lucide-react';
import { LavaRenderer, type TransientMotion } from '../engine/LavaRenderer';
import { LavaPhysics, MAX_BLOBS } from '../engine/physics';
import type { LavaConfig } from '../types/lava';
import type { MobileSheetState } from './MobileBottomSheet';

interface CanvasStageProps {
  config: LavaConfig;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStirFluid: () => void;
  onRandomizeLamp: () => void;
  onMobileBlobCountChange: (nextCount: number) => void;
  physicsRef: React.MutableRefObject<LavaPhysics>;
  parallaxRef: React.MutableRefObject<[number, number]>;
  viewportRatioRef: React.MutableRefObject<number>;
  isMobileLayout: boolean;
  isMobileLandscape: boolean;
  mobileSheetState: MobileSheetState;
  onOpenMobileSheet?: () => void;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  config,
  isPlaying,
  onTogglePlay,
  onStirFluid,
  onRandomizeLamp,
  onMobileBlobCountChange,
  physicsRef,
  parallaxRef,
  viewportRatioRef,
  isMobileLayout,
  isMobileLandscape,
  mobileSheetState,
  onOpenMobileSheet,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<LavaRenderer | null>(null);

  const configRef = useRef<LavaConfig>(config);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const isMobileLayoutRef = useRef<boolean>(isMobileLayout);
  const isMobileLandscapeRef = useRef<boolean>(isMobileLandscape);
  const mobileSheetStateRef = useRef<MobileSheetState>(mobileSheetState);

  const [webglError, setWebglError] = useState<string | null>(null);

  const dragState = useRef<{
    active: boolean;
    isMobile: boolean;
    startX: number;
    startY: number;
    startTime: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    prevVx: number;
    prevVy: number;
    movedPx: number;
    isDragging: boolean;
  }>({
    active: false,
    isMobile: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    prevVx: 0,
    prevVy: 0,
    movedPx: 0,
    isDragging: false,
  });

  // Mobile-only transient elastic shake spring & falling internal glass glitter
  const mobileMotionRef = useRef<{
    offsetX: number;
    offsetY: number;
    velX: number;
    velY: number;
    tilt: number;
    tiltVel: number;
    glitterIntensity: number;
    glitterFallDist: number;
    glitterClearFront: number;
    glitterSwirl: number;
    shakeCooldown: number;
  }>({
    offsetX: 0,
    offsetY: 0,
    velX: 0,
    velY: 0,
    tilt: 0,
    tiltVel: 0,
    glitterIntensity: 0,
    glitterFallDist: 0,
    glitterClearFront: 0,
    glitterSwirl: 0,
    shakeCooldown: 0,
  });

  // Smoothly interpolated mobile framing (auto width/height fit + sheet top-half lift)
  const framingRef = useRef<{ offsetY: number; scaleMul: number }>({
    offsetY: 0,
    scaleMul: 1,
  });

  const transientMotionRef = useRef<TransientMotion>({
    offsetX: 0,
    offsetY: 0,
    tilt: 0,
    scaleMultiplier: 1,
    shakeGlitter: [0, 0, 0, 0],
  });

  const targetParallax = useRef<[number, number]>([0, 0]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isMobileLayoutRef.current = isMobileLayout;
  }, [isMobileLayout]);

  useEffect(() => {
    isMobileLandscapeRef.current = isMobileLandscape;
  }, [isMobileLandscape]);

  useEffect(() => {
    mobileSheetStateRef.current = mobileSheetState;
  }, [mobileSheetState]);

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

    const MAX_LIVE_PIXELS = 2_400_000; // Crisp native Full HD / Retina live stage; export remains full 2K/4K

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

      // Gently adapt internal render scale if GPU frame time creeps above 23ms
      if (isPlayingRef.current && rawMs < 200) {
        smoothFrameMs = smoothFrameMs * 0.9 + rawMs * 0.1;
        if (smoothFrameMs > 23 && adaptiveScale > 0.65) {
          adaptiveScale = Math.max(0.65, adaptiveScale - 0.03);
        } else if (smoothFrameMs < 16.5 && adaptiveScale < 1.0) {
          adaptiveScale = Math.min(1.0, adaptiveScale + 0.015);
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
      const aspect = clientW / clientH;
      viewportRatioRef.current = aspect;

      const baseDpr = Math.min(window.devicePixelRatio || 1, 2.0);
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

      // Compute mobile-only auto-framing (never clips width/height; lifts smoothly above bottom sheet)
      let targetFrameOffsetY = 0;
      let targetFrameScaleMul = 1;
      if (isMobileLayoutRef.current) {
        const s = Math.max(0.12, cfg.scale * 0.7);
        const curHalfW = (cfg.vesselShape === 'fluid' ? 0.34 : 0.21) * cfg.widthRatio * s;
        const curHalfH = 0.61 * s;
        const maxHalfW = 0.5 * aspect * 0.84;
        const widthFitMul = curHalfW > maxHalfW ? maxHalfW / curHalfW : 1;

        const sheet = mobileSheetStateRef.current;
        const landscape = isMobileLandscapeRef.current;

        if (sheet === 'half') {
          // Reframe lamp cleanly inside the visible top ~55% above the bottom sheet
          targetFrameOffsetY = landscape ? 0.13 : 0.205;
          const maxSheetHalfH = landscape ? 0.175 : 0.215;
          const heightFitMul = Math.min(0.76, maxSheetHalfH / Math.max(0.05, curHalfH));
          targetFrameScaleMul = Math.max(0.35, Math.min(1, widthFitMul, heightFitMul));
        } else if (sheet === 'full') {
          targetFrameOffsetY = landscape ? 0.16 : 0.24;
          const heightFitMul = Math.min(0.7, 0.19 / Math.max(0.05, curHalfH));
          targetFrameScaleMul = Math.max(0.35, Math.min(1, widthFitMul, heightFitMul));
        } else {
          // Closed sheet: centered cleanly above floating dock with safe margins
          targetFrameOffsetY = landscape ? 0.035 : 0.03;
          const maxHalfH = landscape ? 0.38 : 0.39;
          const heightFitMul = curHalfH > maxHalfH ? maxHalfH / curHalfH : 1;
          targetFrameScaleMul = Math.max(0.4, Math.min(1, widthFitMul, heightFitMul));
        }
      }

      const fr = framingRef.current;
      const frameLerp = prefersReducedMotion ? 1 : 1 - Math.exp(-11 * Math.max(dt, 0.008));
      const frameDelta =
        Math.abs(targetFrameOffsetY - fr.offsetY) + Math.abs(targetFrameScaleMul - fr.scaleMul);
      if (frameDelta > 0.0005) {
        fr.offsetY += (targetFrameOffsetY - fr.offsetY) * frameLerp;
        fr.scaleMul += (targetFrameScaleMul - fr.scaleMul) * frameLerp;
      } else {
        fr.offsetY = targetFrameOffsetY;
        fr.scaleMul = targetFrameScaleMul;
      }

      // Integrate mobile-only elastic shake spring & falling internal glass glitter
      const m = mobileMotionRef.current;
      const hasSpring =
        Math.abs(m.offsetX) > 0.0004 ||
        Math.abs(m.offsetY) > 0.0004 ||
        Math.abs(m.velX) > 0.0004 ||
        Math.abs(m.velY) > 0.0004 ||
        Math.abs(m.tilt) > 0.0004 ||
        Math.abs(m.tiltVel) > 0.0004;

      if (hasSpring) {
        const subDt = Math.min(dt, 0.033);
        const ax = -135 * m.offsetX - 9.2 * m.velX;
        const ay = -135 * m.offsetY - 9.2 * m.velY;
        const at = -115 * m.tilt - 8.4 * m.tiltVel;
        m.velX += ax * subDt;
        m.velY += ay * subDt;
        m.tiltVel += at * subDt;
        m.offsetX = Math.max(-0.18, Math.min(0.18, m.offsetX + m.velX * subDt));
        m.offsetY = Math.max(-0.12, Math.min(0.12, m.offsetY + m.velY * subDt));
        m.tilt = Math.max(-0.32, Math.min(0.32, m.tilt + m.tiltVel * subDt));
      } else {
        m.offsetX = 0;
        m.offsetY = 0;
        m.velX = 0;
        m.velY = 0;
        m.tilt = 0;
        m.tiltVel = 0;
      }

      const hasGlitter = m.glitterIntensity > 0.002;
      if (hasGlitter) {
        const fallSpeed = m.shakeCooldown > 0 ? 0.16 : 0.42;
        m.glitterFallDist += dt * fallSpeed;
        m.glitterSwirl += dt * (m.shakeCooldown > 0 ? 2.4 : 0.75);

        if (m.shakeCooldown > 0) {
          m.shakeCooldown = Math.max(0, m.shakeCooldown - dt);
        } else {
          // Sweeps clearing front from top of glass down to bottom so sparkles fade downward
          m.glitterClearFront += dt * 0.3;
          if (m.glitterClearFront >= 1.15) {
            m.glitterIntensity = 0;
            m.glitterClearFront = 0;
            m.glitterFallDist = 0;
          }
        }
      }

      const needsRender =
        isPlayingRef.current ||
        resized ||
        parallaxDelta > 0.0005 ||
        frameDelta > 0.0005 ||
        hasSpring ||
        hasGlitter ||
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
        const tm = transientMotionRef.current;
        tm.offsetX = m.offsetX;
        tm.offsetY = m.offsetY + fr.offsetY;
        tm.tilt = m.tilt;
        tm.scaleMultiplier = fr.scaleMul;
        tm.shakeGlitter[0] = m.glitterIntensity;
        tm.shakeGlitter[1] = m.glitterFallDist;
        tm.shakeGlitter[2] = m.glitterClearFront;
        tm.shakeGlitter[3] = m.glitterSwirl;

        const blobData = physics.packUniformArray(cfg.blobCount);
        rendererRef.current.render(cfg, blobData, physics.time, parallaxRef.current, false, tm);
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

  const isMobileGesture = (e: React.PointerEvent<HTMLCanvasElement>): boolean =>
    e.pointerType === 'touch' || isMobileLayoutRef.current;

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const mobile = isMobileGesture(e);
    const now = performance.now();

    dragState.current = {
      active: true,
      isMobile: mobile,
      startX: e.clientX,
      startY: e.clientY,
      startTime: now,
      lastX: e.clientX,
      lastY: e.clientY,
      lastTime: now,
      prevVx: 0,
      prevVy: 0,
      movedPx: 0,
      isDragging: false,
    };

    if (!mobile) {
      // Desktop behavior preserved untouched
      const rect = e.currentTarget.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      physicsRef.current.applyImpulse(nx, ny, 0, 0.24);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

    const ds = dragState.current;
    if (ds.active && ds.isMobile) {
      const now = performance.now();
      const dxPx = e.clientX - ds.lastX;
      const dyPx = e.clientY - ds.lastY;
      const stepPx = Math.hypot(dxPx, dyPx);
      ds.movedPx += stepPx;

      if (ds.movedPx > 8) {
        ds.isDragging = true;
      }

      if (ds.isDragging && stepPx > 0.5) {
        const dtMove = Math.max(0.008, (now - ds.lastTime) / 1000);
        const dxNorm = dxPx / Math.max(1, rect.width);
        const dyNorm = -dyPx / Math.max(1, rect.height);
        const vx = dxNorm / dtMove;
        const vy = dyNorm / dtMove;
        const dvx = vx - ds.prevVx;
        const dvy = vy - ds.prevVy;
        const speed = Math.hypot(vx, vy);
        const jerk = Math.hypot(dvx, dvy);
        const shakeEnergy = Math.min(2.4, speed * 0.48 + jerk * 0.14);

        // Elastic spring-damper lamp rock + tilt (no haptic vibration)
        const m = mobileMotionRef.current;
        m.offsetX = Math.max(-0.18, Math.min(0.18, m.offsetX + dxNorm * 0.34));
        m.offsetY = Math.max(-0.12, Math.min(0.12, m.offsetY + dyNorm * 0.24));
        m.velX = Math.max(-2.4, Math.min(2.4, m.velX + dxNorm * 5.2));
        m.velY = Math.max(-1.8, Math.min(1.8, m.velY + dyNorm * 3.8));
        m.tiltVel = Math.max(-4.5, Math.min(4.5, m.tiltVel - dxNorm * 11.5));

        // Vigorous wax agitation inside the vessel
        physicsRef.current.applyShakeImpulse(
          vx * 0.38,
          vy * 0.38,
          shakeEnergy,
          configRef.current.blobCount
        );

        // Release internal glass glitter that falls & clears top-to-bottom after shaking
        if (shakeEnergy > 0.2) {
          m.glitterIntensity = Math.min(1.0, m.glitterIntensity + Math.min(0.45, shakeEnergy * 0.28));
          m.glitterClearFront = Math.max(0, m.glitterClearFront - Math.min(0.38, shakeEnergy * 0.24));
          m.glitterSwirl += Math.min(0.6, shakeEnergy * 0.25);
          m.shakeCooldown = 0.3;
        }

        ds.prevVx = vx;
        ds.prevVy = vy;
        ds.lastX = e.clientX;
        ds.lastY = e.clientY;
        ds.lastTime = now;
      }
      return;
    }

    // Desktop hover parallax & drag impulse preserved untouched
    if (!isMobileGesture(e)) {
      targetParallax.current = [nx * 0.45, ny * 0.35];
      if (ds.active) {
        const dx = (e.clientX - ds.lastX) / rect.width;
        const dy = -(e.clientY - ds.lastY) / rect.height;
        physicsRef.current.applyImpulse(nx, ny, dx * 4.2, dy * 4.2);
        ds.lastX = e.clientX;
        ds.lastY = e.clientY;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ds = dragState.current;
    if (ds.active && ds.isMobile && !ds.isDragging && ds.movedPx < 12) {
      const tapDuration = performance.now() - ds.startTime;
      if (tapDuration < 400) {
        const rect = e.currentTarget.getBoundingClientRect();
        const cfg = configRef.current;
        const m = mobileMotionRef.current;
        const fr = framingRef.current;
        const hit = physicsRef.current.hitTestWax(
          e.clientX,
          e.clientY,
          rect,
          cfg,
          parallaxRef.current,
          {
            offsetX: m.offsetX,
            offsetY: m.offsetY + fr.offsetY,
            tilt: m.tilt,
            scaleMultiplier: fr.scaleMul,
          }
        );
        if (hit) {
          const currentCount = cfg.blobCount;
          if (currentCount < MAX_BLOBS) {
            const nextCount = currentCount + 1;
            physicsRef.current.splitBlobAt(hit, nextCount, cfg.waxScale);
            onMobileBlobCountChange(nextCount);
          } else {
            physicsRef.current.coalesceToSingleBlob(hit, cfg.waxScale);
            onMobileBlobCountChange(1);
          }
        }
      }
    }
    ds.active = false;
    ds.isDragging = false;
  };

  const handlePointerCancel = () => {
    dragState.current.active = false;
    dragState.current.isDragging = false;
  };

  const handlePointerLeave = () => {
    if (!dragState.current.isMobile) {
      dragState.current.active = false;
      targetParallax.current = [0, 0];
    }
  };

  const hideMobileDock = isMobileLayout && mobileSheetState !== 'closed';

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
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerLeave}
          className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
        />
      )}

      {/* Floating Bottom Studio Control Dock */}
      <div
        style={
          isMobileLayout
            ? {
                bottom: isMobileLandscape
                  ? 'max(0.625rem, env(safe-area-inset-bottom))'
                  : 'max(1rem, env(safe-area-inset-bottom))',
              }
            : undefined
        }
        className={`absolute ${
          isMobileLayout ? '' : 'bottom-5'
        } left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 md:gap-1.5 px-1.5 md:px-2.5 py-1.5 md:py-2 rounded-2xl md:rounded-xl bg-white/88 dark:bg-[#121216]/88 backdrop-blur-md border border-black/[0.08] dark:border-white/[0.09] shadow-[0_12px_36px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.55)] max-w-[calc(100dvw-1.5rem)] overflow-x-auto no-scrollbar transition-all duration-200 ${
          hideMobileDock ? 'opacity-0 translate-y-6 pointer-events-none' : 'opacity-100 translate-y-0'
        }`}
      >
        <button
          type="button"
          onClick={onTogglePlay}
          title={isPlaying ? 'Pausar simulação (Espaço)' : 'Reproduzir simulação (Espaço)'}
          aria-label={isPlaying ? 'Pausar simulação' : 'Reproduzir simulação'}
          className={`${
            isMobileLayout ? 'h-11 w-11 px-0 justify-center rounded-xl' : 'h-9 px-3 gap-1.5 rounded-lg'
          } inline-flex items-center text-[12.5px] font-medium text-[#1C1C24] dark:text-[#E4E4EC] md:hover:bg-black/[0.06] md:dark:hover:bg-white/[0.08] active:bg-black/[0.1] dark:active:bg-white/[0.14] active:scale-[0.94] transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35]`}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Play className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0" aria-hidden="true" />
          )}
          {!isMobileLayout && <span>{isPlaying ? 'Pausar' : 'Reproduzir'}</span>}
        </button>

        <div className="w-px h-5 bg-black/[0.09] dark:bg-white/[0.08] mx-0.5 shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={onStirFluid}
          title="Aplicar impulso térmico na cera interna"
          className={`${
            isMobileLayout ? 'h-11 px-3.5 rounded-xl' : 'h-9 px-3.5 rounded-lg'
          } inline-flex items-center gap-1.5 text-[12.5px] font-medium bg-black/[0.05] dark:bg-white/[0.07] md:hover:bg-black/[0.1] md:dark:hover:bg-white/[0.13] active:bg-black/[0.14] dark:active:bg-white/[0.18] text-[#14141A] dark:text-[#F4F4F6] active:scale-[0.96] transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35]`}
        >
          <Waves className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0 text-[#4A4A58] dark:text-[#D4D4E0]" aria-hidden="true" />
          <span>Shake</span>
        </button>

        <div className="w-px h-5 bg-black/[0.09] dark:bg-white/[0.08] mx-0.5 shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={onRandomizeLamp}
          title="Gerar nova configuração de lava lamp"
          aria-label="Randomizar configurações da lâmpada"
          className={`${
            isMobileLayout ? 'h-11 w-11 rounded-xl' : 'h-9 w-9 rounded-lg'
          } inline-flex items-center justify-center text-[#5A5A6A] dark:text-[#9A9AA8] md:hover:text-[#14141A] md:dark:hover:text-white md:hover:bg-black/[0.06] md:dark:hover:bg-white/[0.08] active:bg-black/[0.1] dark:active:bg-white/[0.14] active:rotate-90 active:scale-[0.94] transition-all duration-150 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35]`}
        >
          <RefreshCw className="w-4 h-4 md:w-3.5 md:h-3.5" aria-hidden="true" />
        </button>

        {isMobileLayout && onOpenMobileSheet && (
          <>
            <div className="w-px h-5 bg-black/[0.09] dark:bg-white/[0.08] mx-0.5 shrink-0" aria-hidden="true" />
            <button
              type="button"
              onClick={onOpenMobileSheet}
              aria-label="Abrir parâmetros"
              title="Abrir parâmetros"
              className="h-11 w-11 inline-flex items-center justify-center rounded-xl bg-black/[0.06] dark:bg-white/[0.09] active:bg-black/[0.14] dark:active:bg-white/[0.18] active:scale-[0.94] text-[#14141A] dark:text-[#F4F4F6] transition-all shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35]"
            >
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </main>
  );
};
