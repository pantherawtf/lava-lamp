import React, { useEffect, useRef, useState } from 'react';
import {
  Pause,
  Play,
  Radio,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  STUDIO_TRACKS,
  StudioAudioEngine,
  type StudioTrack,
} from '../engine/StudioAudioEngine';

export const StudioRadio: React.FC = () => {
  const engineRef = useRef<StudioAudioEngine | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [track, setTrack] = useState<StudioTrack>(STUDIO_TRACKS[0]);
  const [volume, setVolume] = useState(0.45);
  const [isMuted, setIsMuted] = useState(false);
  const lastVolumeRef = useRef(0.45);

  useEffect(() => {
    const engine = new StudioAudioEngine();
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleTogglePlay = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setVolume(isMuted ? 0 : volume);
    const playing = await engine.togglePlay();
    setIsPlaying(playing);
  };

  const handleNext = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = engine.nextTrack();
    setTrack(next);
    if (!isPlaying) {
      engine.setVolume(isMuted ? 0 : volume);
      await engine.play();
      setIsPlaying(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (v > 0) {
      lastVolumeRef.current = v;
      setIsMuted(false);
    } else {
      setIsMuted(true);
    }
    engineRef.current?.setVolume(v);
  };

  const handleToggleMute = () => {
    if (isMuted || volume === 0) {
      const restored = lastVolumeRef.current > 0.05 ? lastVolumeRef.current : 0.45;
      setIsMuted(false);
      setVolume(restored);
      engineRef.current?.setVolume(restored);
    } else {
      lastVolumeRef.current = volume;
      setIsMuted(true);
      engineRef.current?.setVolume(0);
    }
  };

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="relative flex items-center">
      <div
        className={`flex items-center rounded-full bg-white/82 dark:bg-[#141419]/85 backdrop-blur-md border border-black/[0.09] dark:border-white/[0.11] shadow-[0_2px_10px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.35)] transition-all duration-200 ${
          isOpen ? 'md:pr-3' : ''
        }`}
      >
        {/* Compact Radio Toggle Button (>=44px on mobile, 32px on desktop) */}
        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Fechar rádio de estúdio' : 'Abrir rádio de estúdio'}
          title={
            isOpen
              ? 'Recolher rádio'
              : isPlaying
                ? `Rádio tocando: ${track.title}`
                : 'Rádio de estúdio (estilo Sade)'
          }
          className={`h-11 w-11 md:h-8 md:w-8 inline-flex items-center justify-center rounded-full transition-all active:scale-95 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5C35] ${
            isPlaying
              ? 'text-[#FF5C35]'
              : 'text-[#4A4A58] dark:text-[#C4C4D2] md:hover:text-[#14141A] md:dark:hover:text-white active:bg-black/[0.06] dark:active:bg-white/[0.08]'
          }`}
        >
          <Radio className="w-4 h-4 md:w-3.5 md:h-3.5" aria-hidden="true" />
        </button>

        {/* Expandable Inline Mini-Radio Controls (Desktop/Tablet >= md) */}
        {isOpen && (
          <div className="hidden md:flex items-center gap-1.5 pl-0.5">
            <div className="w-px h-4 bg-black/[0.09] dark:bg-white/[0.1]" aria-hidden="true" />

            <button
              type="button"
              onClick={handleTogglePlay}
              aria-label={isPlaying ? 'Pausar rádio' : 'Tocar rádio'}
              title={isPlaying ? 'Pausar' : 'Tocar'}
              className="h-6 w-6 inline-flex items-center justify-center rounded-full text-[#14141A] dark:text-[#F4F4F6] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35]"
            >
              {isPlaying ? (
                <Pause className="w-3 h-3 fill-current" aria-hidden="true" />
              ) : (
                <Play className="w-3 h-3 fill-current translate-x-[0.5px]" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Próxima faixa"
              title={`Próxima faixa (atual: ${track.title})`}
              className="h-6 w-6 inline-flex items-center justify-center rounded-full text-[#5A5A6A] dark:text-[#B4B4C4] hover:text-[#14141A] dark:hover:text-white hover:bg-black/[0.07] dark:hover:bg-white/[0.1] transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35]"
            >
              <SkipForward className="w-3 h-3" aria-hidden="true" />
            </button>

            <span
              className="text-[11.5px] font-medium text-[#2A2A36] dark:text-[#DCDCE6] max-w-[116px] truncate select-none pl-0.5"
              title={`${track.title} · ${track.subtitle}`}
            >
              {track.title}
            </span>

            <div className="w-px h-4 bg-black/[0.09] dark:bg-white/[0.1] mx-0.5" aria-hidden="true" />

            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={isMuted ? 'Ativar som' : 'Silenciar'}
              title={isMuted ? 'Ativar som' : 'Silenciar'}
              className="h-6 w-6 inline-flex items-center justify-center rounded-full text-[#5A5A6A] dark:text-[#B4B4C4] hover:text-[#14141A] dark:hover:text-white transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35]"
            >
              <VolumeIcon className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            <div className="w-16 flex items-center shrink-0">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Volume do rádio"
                className="studio-slider"
              />
            </div>
          </div>
        )}
      </div>

      {/* Touch-Friendly Popover for Mobile Viewports (< md) */}
      {isOpen && (
        <div className="md:hidden fixed left-4 right-4 top-[calc(env(safe-area-inset-top)+4.25rem)] z-30 mx-auto max-w-[360px] flex items-center justify-between gap-1.5 px-2 py-1 rounded-2xl bg-white/95 dark:bg-[#141419]/95 backdrop-blur-md border border-black/[0.1] dark:border-white/[0.12] shadow-[0_12px_32px_rgba(0,0,0,0.2)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.65)]">
          <div className="flex items-center gap-0.5 min-w-0">
            <button
              type="button"
              onClick={handleTogglePlay}
              aria-label={isPlaying ? 'Pausar rádio' : 'Tocar rádio'}
              className="h-11 w-11 inline-flex items-center justify-center rounded-xl text-[#14141A] dark:text-[#F4F4F6] active:bg-black/[0.08] dark:active:bg-white/[0.12] active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
              ) : (
                <Play className="w-4 h-4 fill-current translate-x-[0.5px]" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Próxima faixa"
              className="h-11 w-11 inline-flex items-center justify-center rounded-xl text-[#5A5A6A] dark:text-[#B4B4C4] active:bg-black/[0.08] dark:active:bg-white/[0.12] active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <SkipForward className="w-4 h-4" aria-hidden="true" />
            </button>

            <span className="text-[12.5px] font-medium text-[#2A2A36] dark:text-[#DCDCE6] truncate px-1">
              {track.title}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={isMuted ? 'Ativar som' : 'Silenciar'}
              className="h-11 w-11 inline-flex items-center justify-center rounded-xl text-[#5A5A6A] dark:text-[#B4B4C4] active:bg-black/[0.08] dark:active:bg-white/[0.12] active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <VolumeIcon className="w-4 h-4" aria-hidden="true" />
            </button>

            <div className="w-20 pr-2 flex items-center shrink-0">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                onTouchMove={(e) => e.stopPropagation()}
                aria-label="Volume do rádio"
                className="studio-slider studio-slider-compact"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
