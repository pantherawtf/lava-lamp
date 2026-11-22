import React, { useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, Film, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { ASPECT_RATIOS } from '../data/presets';
import { LavaRenderer, renderHighResImage } from '../engine/LavaRenderer';
import { LavaPhysics } from '../engine/physics';
import type { AspectRatioId, LavaConfig } from '../types/lava';
import { SegmentedControl } from './ControlPrimitives';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LavaConfig;
  aspectRatio: AspectRatioId;
  onAspectRatioChange: (id: AspectRatioId) => void;
  viewportRatioRef: React.MutableRefObject<number>;
  physicsRef: React.MutableRefObject<LavaPhysics>;
  parallaxRef: React.MutableRefObject<[number, number]>;
}

type ExportMode = 'image' | 'video';
type ImageResPreset = '1080' | '2048' | '3840';
type ImageFormat = 'png' | 'png-alpha' | 'webp';
type VideoResPreset = '720' | '1080' | '1440';

function computeExportDimensions(
  longEdge: number,
  aspectRatio: AspectRatioId,
  liveViewportRatio: number
): { width: number; height: number } {
  const found = ASPECT_RATIOS.find((a) => a.id === aspectRatio);
  const ar = found?.ratio ?? (Number.isFinite(liveViewportRatio) && liveViewportRatio > 0.2 ? liveViewportRatio : 16 / 9);
  let w: number;
  let h: number;
  if (ar >= 1) {
    w = longEdge;
    h = Math.round(longEdge / ar);
  } else {
    h = longEdge;
    w = Math.round(longEdge * ar);
  }
  w = Math.max(256, Math.round(w / 2) * 2);
  h = Math.max(256, Math.round(h / 2) * 2);
  return { width: w, height: h };
}

function getBestVideoCodec(): { mimeType: string; ext: 'mp4' | 'webm'; label: string } {
  const candidates: { mimeType: string; ext: 'mp4' | 'webm'; label: string }[] = [
    { mimeType: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4', label: 'MP4 (H.264)' },
    { mimeType: 'video/mp4', ext: 'mp4', label: 'MP4' },
    { mimeType: 'video/webm;codecs=vp9', ext: 'webm', label: 'WebM (VP9 Alta Qualidade)' },
    { mimeType: 'video/webm;codecs=vp8', ext: 'webm', label: 'WebM (VP8)' },
    { mimeType: 'video/webm', ext: 'webm', label: 'WebM' },
  ];
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: '', ext: 'webm', label: 'Indisponível' };
  }
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mimeType)) {
      return c;
    }
  }
  return { mimeType: 'video/webm', ext: 'webm', label: 'WebM' };
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  config,
  aspectRatio,
  onAspectRatioChange,
  viewportRatioRef,
  physicsRef,
  parallaxRef,
}) => {
  const [mode, setMode] = useState<ExportMode>('image');
  const [imgRes, setImgRes] = useState<ImageResPreset>('2048');
  const [imgFormat, setImgFormat] = useState<ImageFormat>('png');

  const [vidRes, setVidRes] = useState<VideoResPreset>('1080');
  const [vidDuration, setVidDuration] = useState<string>('6');
  const [vidFps, setVidFps] = useState<string>('60');

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const cancelRecordRef = useRef<boolean>(false);

  const codec = useMemo(() => getBestVideoCodec(), []);

  if (!isOpen) return null;

  const liveRatio = viewportRatioRef.current;
  const imgDims = computeExportDimensions(Number(imgRes), aspectRatio, liveRatio);
  const vidDims = computeExportDimensions(Number(vidRes), aspectRatio, liveRatio);

  const aspectOptions: { value: AspectRatioId; label: string }[] = [
    { value: '4:5', label: '4:5' },
    { value: '1:1', label: '1:1' },
    { value: '16:9', label: '16:9' },
    { value: '9:16', label: '9:16' },
    { value: 'free', label: 'Tela' },
  ];

  const handleExportImage = async () => {
    setIsExporting(true);
    setErrorMsg(null);
    setStatusMessage('Renderizando quadro em alta resolução...');

    try {
      const physics = physicsRef.current;
      const blobData = physics.packUniformArray(config.blobCount);
      const mimeType = imgFormat === 'webp' ? 'image/webp' : 'image/png';
      const transparentBg = imgFormat === 'png-alpha';

      const blob = await renderHighResImage(
        config,
        blobData,
        physics.time,
        parallaxRef.current,
        imgDims.width,
        imgDims.height,
        mimeType,
        transparentBg
      );

      const ext = imgFormat === 'webp' ? 'webp' : 'png';
      const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
      triggerDownload(blob, `lumina-${imgDims.width}x${imgDims.height}-${stamp}.${ext}`);
      setStatusMessage(`Imagem ${imgDims.width} × ${imgDims.height}px exportada com sucesso.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao exportar imagem.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportVideo = async () => {
    if (typeof MediaRecorder === 'undefined' || !codec.mimeType) {
      setErrorMsg('Seu navegador não suporta gravação de vídeo via MediaRecorder.');
      return;
    }

    setIsExporting(true);
    setErrorMsg(null);
    setProgress(0);
    cancelRecordRef.current = false;
    setStatusMessage('Preparando gravador em alta taxa de bits...');

    const durationSec = Number(vidDuration);
    const fps = Number(vidFps);

    const offscreen = document.createElement('canvas');
    offscreen.width = vidDims.width;
    offscreen.height = vidDims.height;

    let renderer: LavaRenderer | null = null;
    try {
      renderer = new LavaRenderer(offscreen, false);
      const exportPhysics = new LavaPhysics();
      exportPhysics.loadState(physicsRef.current.cloneState());

      const stream = offscreen.captureStream(fps);
      const recorder = new MediaRecorder(stream, {
        mimeType: codec.mimeType,
        videoBitsPerSecond: Number(vidRes) >= 1440 ? 18_000_000 : 12_000_000,
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const recordingDone = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: codec.mimeType }));
        };
        recorder.onerror = () => {
          reject(new Error('Erro durante a codificação do vídeo.'));
        };
      });

      recorder.start(250);
      setStatusMessage(`Gravando vídeo (${durationSec}s · ${fps} fps)...`);

      const startMs = performance.now();
      let lastMs = startMs;
      const totalMs = durationSec * 1000;

      await new Promise<void>((resolve) => {
        const stepFrame = (now: number) => {
          if (cancelRecordRef.current) {
            resolve();
            return;
          }
          const elapsed = now - startMs;
          const dt = Math.min((now - lastMs) / 1000, 0.05);
          lastMs = now;

          exportPhysics.step(dt, config.flowSpeed, config.blobCount, config.waxScale);
          const blobData = exportPhysics.packUniformArray(config.blobCount);
          renderer?.render(config, blobData, exportPhysics.time, parallaxRef.current, false);

          const pct = Math.min(100, Math.round((elapsed / totalMs) * 100));
          setProgress(pct);

          if (elapsed >= totalMs) {
            resolve();
          } else {
            requestAnimationFrame(stepFrame);
          }
        };
        requestAnimationFrame(stepFrame);
      });

      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
      stream.getTracks().forEach((t) => t.stop());

      const videoBlob = await recordingDone;

      if (!cancelRecordRef.current) {
        const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
        triggerDownload(
          videoBlob,
          `lumina-${vidDims.width}x${vidDims.height}-${durationSec}s-${stamp}.${codec.ext}`
        );
        setStatusMessage(
          `Vídeo ${vidDims.width} × ${vidDims.height}px (${codec.ext.toUpperCase()}) salvo com sucesso.`
        );
      } else {
        setStatusMessage('Gravação cancelada.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao gerar vídeo.');
    } finally {
      renderer?.dispose();
      setIsExporting(false);
      setProgress(0);
    }
  };

  const handleCancelOrClose = () => {
    if (isExporting) {
      cancelRecordRef.current = true;
    } else {
      onClose();
    }
  };

  const handleCopyRecipe = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      setErrorMsg('Não foi possível copiar o JSON para a área de transferência.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/75 backdrop-blur-sm"
    >
      <div className="w-full max-w-[460px] rounded-xl bg-white dark:bg-[#131318] border border-black/[0.1] dark:border-white/[0.1] shadow-[0_32px_90px_rgba(0,0,0,0.3)] dark:shadow-[0_32px_90px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.08] dark:border-white/[0.07]">
          <h2
            id="export-modal-title"
            className="text-[15px] font-semibold text-[#14141A] dark:text-[#F4F4F6]"
          >
            Exportar Mídia
          </h2>
          <button
            type="button"
            onClick={handleCancelOrClose}
            aria-label="Fechar janela de exportação"
            className="p-1.5 rounded-lg text-[#6A6A7A] dark:text-[#8E8E9E] hover:text-[#14141A] dark:hover:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Export Mode Switcher */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#EAEBF0] dark:bg-[#0A0A0C] border border-black/[0.06] dark:border-white/[0.06]">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => {
                setMode('image');
                setStatusMessage(null);
                setErrorMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 text-[12.5px] font-medium rounded-md transition-colors cursor-pointer ${
                mode === 'image'
                  ? 'bg-white dark:bg-[#22222A] text-[#14141A] dark:text-[#F4F4F6] shadow-xs dark:shadow-none'
                  : 'text-[#626272] dark:text-[#848494] hover:text-[#14141A] dark:hover:text-[#D4D4DF]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Imagem Estática</span>
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={() => {
                setMode('video');
                setStatusMessage(null);
                setErrorMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 text-[12.5px] font-medium rounded-md transition-colors cursor-pointer ${
                mode === 'video'
                  ? 'bg-white dark:bg-[#22222A] text-[#14141A] dark:text-[#F4F4F6] shadow-xs dark:shadow-none'
                  : 'text-[#626272] dark:text-[#848494] hover:text-[#14141A] dark:hover:text-[#D4D4DF]'
              }`}
            >
              <Film className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Vídeo Animado</span>
            </button>
          </div>

          {/* Aspect Ratio configured exclusively in export settings */}
          <SegmentedControl<AspectRatioId>
            label="Proporção de Exportação"
            value={aspectRatio}
            options={aspectOptions}
            onChange={onAspectRatioChange}
            columns={5}
          />

          {mode === 'image' ? (
            <div className="space-y-4">
              <SegmentedControl<ImageResPreset>
                label="Resolução"
                value={imgRes}
                options={[
                  { value: '1080', label: 'HD (1080px)' },
                  { value: '2048', label: '2K (2048px)' },
                  { value: '3840', label: '4K (3840px)' },
                ]}
                onChange={setImgRes}
                columns={3}
              />

              <SegmentedControl<ImageFormat>
                label="Formato de Arquivo"
                value={imgFormat}
                options={[
                  { value: 'png', label: 'PNG' },
                  { value: 'png-alpha', label: 'PNG Transparente' },
                  { value: 'webp', label: 'WebP' },
                ]}
                onChange={setImgFormat}
                columns={3}
              />

              <div className="flex items-center justify-between pt-2 text-[12px] text-[#6A6A7A] dark:text-[#8A8A9A] border-t border-black/[0.07] dark:border-white/[0.06]">
                <span>Dimensões finais</span>
                <span className="font-mono-num text-[#14141A] dark:text-[#E4E4EC]">
                  {imgDims.width} × {imgDims.height} px
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <SegmentedControl<VideoResPreset>
                label="Resolução do Vídeo"
                value={vidRes}
                options={[
                  { value: '720', label: '720p' },
                  { value: '1080', label: '1080p Full HD' },
                  { value: '1440', label: '1440p 2K' },
                ]}
                onChange={setVidRes}
                columns={3}
              />

              <div className="grid grid-cols-2 gap-3">
                <SegmentedControl
                  label="Duração"
                  value={vidDuration}
                  options={[
                    { value: '4', label: '4s' },
                    { value: '6', label: '6s' },
                    { value: '10', label: '10s' },
                    { value: '15', label: '15s' },
                  ]}
                  onChange={setVidDuration}
                  columns={4}
                />
                <SegmentedControl
                  label="Taxa de Quadros"
                  value={vidFps}
                  options={[
                    { value: '30', label: '30 fps' },
                    { value: '60', label: '60 fps' },
                  ]}
                  onChange={setVidFps}
                  columns={2}
                />
              </div>

              <div className="space-y-1.5 pt-2 text-[12px] text-[#6A6A7A] dark:text-[#8A8A9A] border-t border-black/[0.07] dark:border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span>Dimensões</span>
                  <span className="font-mono-num text-[#14141A] dark:text-[#E4E4EC]">
                    {vidDims.width} × {vidDims.height} px
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Codec detectado</span>
                  <span className="text-[#3C3C48] dark:text-[#C8C8D4]">{codec.label}</span>
                </div>
              </div>
            </div>
          )}

          {/* Recording Progress */}
          {isExporting && mode === 'video' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-[#3C3C48] dark:text-[#C8C8D4]">{statusMessage}</span>
                <span className="font-mono-num text-[#FF5C35] dark:text-[#FF8A6B]">{progress}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-black/[0.08] dark:bg-white/[0.08] overflow-hidden">
                <div
                  className="h-full bg-[#FF5C35] transition-[width] duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Feedback messages */}
          {!isExporting && statusMessage && (
            <p className="text-[12px] text-emerald-700 dark:text-[#98E2B4]">{statusMessage}</p>
          )}
          {errorMsg && <p className="text-[12px] text-red-600 dark:text-[#FF7A7A]">{errorMsg}</p>}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-black/[0.08] dark:border-white/[0.07] bg-[#F6F6F9] dark:bg-[#0D0D11]">
          <button
            type="button"
            onClick={handleCopyRecipe}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-[#5A5A6A] dark:text-[#A4A4B4] hover:text-[#14141A] dark:hover:text-white rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40"
          >
            {copiedJson ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-[#98E2B4]" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{copiedJson ? 'Receita copiada' : 'Copiar JSON'}</span>
          </button>

          <div className="flex items-center gap-2">
            {isExporting && mode === 'video' ? (
              <button
                type="button"
                onClick={() => {
                  cancelRecordRef.current = true;
                }}
                className="px-4 py-2 text-[12.5px] font-medium text-[#14141A] dark:text-[#E4E4EC] bg-black/[0.08] dark:bg-white/[0.08] hover:bg-black/[0.14] dark:hover:bg-white/[0.14] rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            ) : (
              <button
                type="button"
                disabled={isExporting}
                onClick={mode === 'image' ? handleExportImage : handleExportVideo}
                className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white bg-[#FF5C35] hover:bg-[#FF6D49] active:scale-[0.98] rounded-lg transition-all whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>
                  {mode === 'image' ? `Baixar ${imgFormat === 'webp' ? 'WebP' : 'PNG'}` : 'Gravar Vídeo'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
