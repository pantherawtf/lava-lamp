import React from 'react';
import {
  Droplets,
  Layers,
  Moon,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Sun,
  SunMedium,
  X,
} from 'lucide-react';
import { CURATED_PALETTES, PRESETS } from '../data/presets';
import type {
  BackgroundMode,
  InspectorTab,
  LavaConfig,
  MetalFinish,
  PresetDefinition,
  VesselShape,
} from '../types/lava';
import {
  ColorControl,
  SectionBlock,
  SegmentedControl,
  SliderControl,
} from './ControlPrimitives';

interface InspectorPanelProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  onOpenTab: (tab: InspectorTab) => void;
  config: LavaConfig;
  activeTab: InspectorTab;
  activePresetId: string | null;
  onTabChange: (tab: InspectorTab) => void;
  onUpdate: <K extends keyof LavaConfig>(key: K, value: LavaConfig[K]) => void;
  onBatchUpdate: (partial: Partial<LavaConfig>) => void;
  onCommitHistory: () => void;
  onSelectPreset: (preset: PresetDefinition) => void;
  isMobileDrawer?: boolean;
}

const VESSEL_SHAPES: { id: VesselShape; label: string; svg: React.ReactNode }[] = [
  {
    id: 'astro',
    label: 'Astro',
    svg: (
      <svg viewBox="0 0 28 40" className="w-6 h-8" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11 3h6l1.5 6h-9L11 3z" />
        <path d="M9.5 9h9l3 14.5-2.5 2H9l-2.5-2L9.5 9z" fill="currentColor" fillOpacity="0.16" />
        <path d="M9 25.5h10l-3 5.5h-4l-3-5.5z" />
        <path d="M12 31h4l3.5 6h-11L12 31z" />
      </svg>
    ),
  },
  {
    id: 'capsule',
    label: 'Cápsula',
    svg: (
      <svg viewBox="0 0 28 40" className="w-6 h-8" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8.5 9c0-3.5 2.5-5.5 5.5-5.5s5.5 2 5.5 5.5h-11z" />
        <rect x="8.5" y="9" width="11" height="17" fill="currentColor" fillOpacity="0.16" />
        <path d="M8.5 26h11v6.5c0 1.2-1 2.2-2.2 2.2h-6.6c-1.2 0-2.2-1-2.2-2.2V26z" />
        <path d="M7 37h14" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'bullet',
    label: 'Projétil',
    svg: (
      <svg viewBox="0 0 28 40" className="w-6 h-8" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11.2 9.5C11.8 4.8 12.8 3 14 3s2.2 1.8 2.8 6.5h-5.6z" />
        <path d="M11.2 9.5h5.6c1.5 5 1.7 10.5.7 15h-7c-1-4.5-.8-10 .7-15z" fill="currentColor" fillOpacity="0.16" />
        <path d="M10.5 24.5h7l-1.8 10h-3.4l-1.8-10z" />
        <path d="M8.5 37h11l-2.5-2.5h-6L8.5 37z" />
      </svg>
    ),
  },
  {
    id: 'organic',
    label: 'Ampola',
    svg: (
      <svg viewBox="0 0 28 40" className="w-6 h-8" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11 8.5c0-3 1.3-5 3-5s3 2 3 5h-6z" />
        <path d="M11 8.5h6c2.8 4.5 3.6 10.5.6 16.5H10.4c-3-6-2.2-12 .6-16.5z" fill="currentColor" fillOpacity="0.16" />
        <path d="M10.4 25h7.2c-1.8 3.2-1.8 7 1.4 11.5H9c3.2-4.5 3.2-8.3 1.4-11.5z" />
      </svg>
    ),
  },
  {
    id: 'fluid',
    label: 'Fluido',
    svg: (
      <svg viewBox="0 0 28 40" className="w-6 h-8" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="14" cy="14" r="5.5" fill="currentColor" fillOpacity="0.18" />
        <circle cx="11" cy="27" r="4" fill="currentColor" fillOpacity="0.18" />
        <circle cx="18.5" cy="24" r="3" fill="currentColor" fillOpacity="0.18" />
      </svg>
    ),
  },
];

const METAL_FINISHES: { id: MetalFinish; label: string; preview: string }[] = [
  {
    id: 'brushedSilver',
    label: 'Alumínio',
    preview: 'linear-gradient(135deg, #E2E5EB 0%, #8A909B 55%, #D2D6DE 100%)',
  },
  {
    id: 'darkChrome',
    label: 'Cromo Escuro',
    preview: 'linear-gradient(135deg, #52525C 0%, #16161B 55%, #3C3C45 100%)',
  },
  {
    id: 'roseCopper',
    label: 'Cobre Rosé',
    preview: 'linear-gradient(135deg, #F6C5B1 0%, #9E5947 55%, #E7AE99 100%)',
  },
  {
    id: 'matteObsidian',
    label: 'Preto Fosco',
    preview: 'linear-gradient(135deg, #25222B 0%, #0D0B10 100%)',
  },
  {
    id: 'frostedGlass',
    label: 'Vidro Fosco',
    preview: 'linear-gradient(135deg, rgba(220,226,240,0.75) 0%, rgba(160,175,210,0.35) 100%)',
  },
];

const TABS: { value: InspectorTab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { value: 'frasco', label: 'Frasco', Icon: Layers },
  { value: 'interno', label: 'Interno', Icon: Droplets },
  { value: 'cores', label: 'Cores', Icon: Palette },
  { value: 'cena', label: 'Cena', Icon: SunMedium },
];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  isOpen,
  onToggleOpen,
  onOpenTab,
  config,
  activeTab,
  activePresetId,
  onTabChange,
  onUpdate,
  onBatchUpdate,
  onCommitHistory,
  onSelectPreset,
  isMobileDrawer = false,
}) => {
  const toggleThemeMode = () => {
    onUpdate('bgMode', config.bgMode === 'light' ? 'dark' : 'light');
    onCommitHistory();
  };

  // Collapsed Lateral Rail (Desktop synchronized side menu)
  if (!isMobileDrawer && !isOpen) {
    return (
      <aside
        aria-label="Menu lateral de parâmetros"
        className="w-14 h-full flex flex-col items-center justify-between py-3 bg-white dark:bg-[#111115] border-l border-black/[0.08] dark:border-white/[0.07] shrink-0 transition-[width,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onToggleOpen}
            title="Expandir parâmetros"
            aria-label="Expandir parâmetros"
            aria-expanded={false}
            className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-[#4A4A58] dark:text-[#B4B4C2] hover:text-[#14141A] dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35]"
          >
            <PanelRightOpen className="w-4 h-4" aria-hidden="true" />
          </button>

          <div className="w-6 h-px bg-black/[0.08] dark:bg-white/[0.08] my-1" aria-hidden="true" />

          {TABS.map(({ value, label, Icon }) => {
            const active = activeTab === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onOpenTab(value)}
                title={`Abrir ${label}`}
                aria-label={`Abrir aba ${label}`}
                className={`group relative w-10 h-10 inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35] ${
                  active
                    ? 'bg-black/[0.06] dark:bg-white/[0.08] text-[#14141A] dark:text-[#F4F4F6]'
                    : 'text-[#6A6A7A] dark:text-[#8A8A9A] hover:text-[#14141A] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
              </button>
            );
          })}
        </div>

        {/* Bottom quick Light/Dark toggle synced with the whole page */}
        <button
          type="button"
          onClick={toggleThemeMode}
          title={config.bgMode === 'light' ? 'Mudar para Modo Escuro' : 'Mudar para Modo Claro'}
          aria-label={config.bgMode === 'light' ? 'Mudar para Modo Escuro' : 'Mudar para Modo Claro'}
          className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-[#5A5A6A] dark:text-[#A4A4B4] hover:text-[#14141A] dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35]"
        >
          {config.bgMode === 'light' ? (
            <Moon className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Sun className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Painel de parâmetros"
      className={`${
        isMobileDrawer ? 'w-[344px] max-w-[92vw]' : 'w-[372px]'
      } h-full flex flex-col bg-white dark:bg-[#111115] border-l border-black/[0.08] dark:border-white/[0.07] shrink-0 overflow-hidden transition-[width,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`}
    >
      <div className={`${isMobileDrawer ? 'w-full' : 'w-[372px]'} h-full flex flex-col overflow-hidden`}>
        {/* Synchronized Panel Header with Collapse Button */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.07] dark:border-white/[0.07] shrink-0">
          <h2 className="text-[13px] font-semibold text-[#14141A] dark:text-[#F4F4F6]">
            Parâmetros
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleThemeMode}
              title={config.bgMode === 'light' ? 'Mudar para Modo Escuro' : 'Mudar para Modo Claro'}
              aria-label={config.bgMode === 'light' ? 'Mudar para Modo Escuro' : 'Mudar para Modo Claro'}
              className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#5A5A6A] dark:text-[#9A9AA8] hover:text-[#14141A] dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              {config.bgMode === 'light' ? (
                <Moon className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Sun className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={onToggleOpen}
              title="Recolher parâmetros"
              aria-label="Recolher parâmetros"
              aria-expanded={true}
              className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#5A5A6A] dark:text-[#9A9AA8] hover:text-[#14141A] dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              {isMobileDrawer ? (
                <X className="w-4 h-4" aria-hidden="true" />
              ) : (
                <PanelRightClose className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Curated Presets Strip */}
        <div className="px-4 pt-3.5 pb-3 border-b border-black/[0.07] dark:border-white/[0.07] shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-[#14141A] dark:text-[#F4F4F6]">
              Modelos de Lava Lamp
            </span>
            <span className="text-[11px] text-[#707080] dark:text-[#7D7D8C] font-mono-num">
              {PRESETS.length} modelos
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((preset) => {
              const selected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectPreset(preset)}
                  className={`group text-left px-2.5 py-2 rounded-lg border transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35] ${
                    selected
                      ? 'bg-[#FFF5F2] dark:bg-[#1D1D24] border-[#FF5C35]/70'
                      : 'bg-[#F6F6F9] dark:bg-[#0B0B0E] border-black/[0.06] dark:border-white/[0.06] hover:border-black/[0.16] dark:hover:border-white/[0.15] hover:bg-[#EFEFF4] dark:hover:bg-[#15151B]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium text-[#14141A] dark:text-[#EFEFF4] truncate">
                      {preset.name}
                    </span>
                    <span className="flex items-center -space-x-1 shrink-0" aria-hidden="true">
                      {preset.swatches.map((hex, idx) => (
                        <span
                          key={idx}
                          className="w-2.5 h-2.5 rounded-full border border-black/25 dark:border-black/50"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-[#6A6A7A] dark:text-[#7A7A88] truncate mt-0.5">
                    {preset.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-4 py-3 border-b border-black/[0.07] dark:border-white/[0.07] shrink-0">
          <SegmentedControl
            value={activeTab}
            options={TABS.map(({ value, label }) => ({ value, label }))}
            onChange={onTabChange}
            columns={4}
          />
        </div>

        {/* Active Tab Controls */}
        <div className="flex-1 overflow-y-auto studio-scroll px-4 pb-8">
          {activeTab === 'frasco' && (
            <>
              <SectionBlock title="Tipo de Lava Lamp">
                <div className="grid grid-cols-5 gap-1.5">
                  {VESSEL_SHAPES.map((item) => {
                    const active = config.vesselShape === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onUpdate('vesselShape', item.id);
                          onCommitHistory();
                        }}
                        className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35] ${
                          active
                            ? 'bg-[#FFF5F2] dark:bg-[#212129] border-[#FF5C35]/70 text-[#14141A] dark:text-[#F4F4F6]'
                            : 'bg-[#F6F6F9] dark:bg-[#0B0B0E] border-black/[0.06] dark:border-white/[0.06] text-[#666676] dark:text-[#848494] hover:text-[#14141A] dark:hover:text-[#D8D8E2] hover:border-black/[0.16] dark:hover:border-white/[0.14]'
                        }`}
                      >
                        {item.svg}
                        <span className="text-[10.5px] font-medium whitespace-nowrap truncate max-w-full">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </SectionBlock>

              {config.vesselShape !== 'fluid' && (
                <SectionBlock title="Acabamento da Base e Tampa">
                  <div className="grid grid-cols-5 gap-1.5">
                    {METAL_FINISHES.map((fin) => {
                      const active = config.metalFinish === fin.id;
                      return (
                        <button
                          key={fin.id}
                          type="button"
                          onClick={() => {
                            onUpdate('metalFinish', fin.id);
                            onCommitHistory();
                          }}
                          className={`flex flex-col items-center gap-1.5 p-1.5 rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35] ${
                            active
                              ? 'bg-[#FFF5F2] dark:bg-[#212129] border-[#FF5C35]/70 text-[#14141A] dark:text-[#F4F4F6]'
                              : 'bg-[#F6F6F9] dark:bg-[#0B0B0E] border-black/[0.06] dark:border-white/[0.06] text-[#666676] dark:text-[#848494] hover:text-[#14141A] dark:hover:text-[#D8D8E2]'
                          }`}
                        >
                          <span
                            className="w-7 h-7 rounded-full border border-black/15 dark:border-white/15 shrink-0"
                            style={{ background: fin.preview }}
                            aria-hidden="true"
                          />
                          <span className="text-[10px] font-medium truncate max-w-full">
                            {fin.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </SectionBlock>
              )}

              <SectionBlock title="Proporção e Enquadramento">
                <SliderControl
                  label="Escala"
                  value={config.scale}
                  min={0.25}
                  max={1.0}
                  step={0.01}
                  displayValue={`${Math.round(config.scale * 100)}%`}
                  onChange={(v) => onUpdate('scale', v)}
                  onCommit={onCommitHistory}
                />
                {config.vesselShape !== 'fluid' && (
                  <SliderControl
                    label="Largura do Frasco"
                    value={config.widthRatio}
                    min={0.7}
                    max={1.38}
                    step={0.01}
                    displayValue={`${Math.round(config.widthRatio * 100)}%`}
                    onChange={(v) => onUpdate('widthRatio', v)}
                    onCommit={onCommitHistory}
                  />
                )}
                <SliderControl
                  label="Inclinação"
                  value={config.tilt}
                  min={-0.3}
                  max={0.3}
                  step={0.005}
                  displayValue={`${Math.round((config.tilt * 180) / Math.PI)}°`}
                  onChange={(v) => onUpdate('tilt', v)}
                  onCommit={onCommitHistory}
                />
                <SliderControl
                  label="Posição Horizontal"
                  value={config.offsetX}
                  min={-0.45}
                  max={0.45}
                  step={0.01}
                  onChange={(v) => onUpdate('offsetX', v)}
                  onCommit={onCommitHistory}
                />
                <SliderControl
                  label="Posição Vertical"
                  value={config.offsetY}
                  min={-0.25}
                  max={0.25}
                  step={0.01}
                  onChange={(v) => onUpdate('offsetY', v)}
                  onCommit={onCommitHistory}
                />
              </SectionBlock>
            </>
          )}

          {activeTab === 'interno' && (
            <>
              <SectionBlock title="Composição da Cera">
                <SliderControl
                  label="Quantidade de Gotas"
                  value={config.blobCount}
                  min={3}
                  max={14}
                  step={1}
                  onChange={(v) => onUpdate('blobCount', Math.round(v))}
                  onCommit={onCommitHistory}
                />
                <SliderControl
                  label="Volume das Gotas"
                  value={config.waxScale}
                  min={0.55}
                  max={1.45}
                  step={0.01}
                  displayValue={`${Math.round(config.waxScale * 100)}%`}
                  onChange={(v) => onUpdate('waxScale', v)}
                  onCommit={onCommitHistory}
                />
                <SliderControl
                  label="Viscosidade e Fusão"
                  value={config.viscosity}
                  min={0.04}
                  max={0.4}
                  step={0.005}
                  onChange={(v) => onUpdate('viscosity', v)}
                  onCommit={onCommitHistory}
                />
                <SliderControl
                  label="Velocidade Térmica"
                  value={config.flowSpeed}
                  min={0}
                  max={2.4}
                  step={0.02}
                  displayValue={`${config.flowSpeed.toFixed(2)}x`}
                  onChange={(v) => onUpdate('flowSpeed', v)}
                  onCommit={onCommitHistory}
                />
              </SectionBlock>

              <SectionBlock title="Detalhes Internos e Vidro">
                <SliderControl
                  label="Organicidade da Cera"
                  value={config.turbulence}
                  min={0}
                  max={0.65}
                  step={0.01}
                  displayValue={`${Math.round((config.turbulence / 0.65) * 100)}%`}
                  onChange={(v) => onUpdate('turbulence', v)}
                  onCommit={onCommitHistory}
                />
                <SliderControl
                  label="Microbolhas e Glitter Suspenso"
                  value={config.particles}
                  min={0}
                  max={1}
                  step={0.01}
                  displayValue={`${Math.round(config.particles * 100)}%`}
                  onChange={(v) => onUpdate('particles', v)}
                  onCommit={onCommitHistory}
                />
                <SliderControl
                  label="Refração e Brilho do Vidro"
                  value={config.glassRefraction}
                  min={0}
                  max={1}
                  step={0.01}
                  displayValue={`${Math.round(config.glassRefraction * 100)}%`}
                  onChange={(v) => onUpdate('glassRefraction', v)}
                  onCommit={onCommitHistory}
                />
                <SliderControl
                  label="Densidade do Líquido"
                  value={config.liquidDensity}
                  min={0}
                  max={1}
                  step={0.01}
                  displayValue={`${Math.round(config.liquidDensity * 100)}%`}
                  onChange={(v) => onUpdate('liquidDensity', v)}
                  onCommit={onCommitHistory}
                />
              </SectionBlock>
            </>
          )}

          {activeTab === 'cores' && (
            <>
              <SectionBlock title="Paletas Curadas">
                <div className="grid grid-cols-2 gap-1.5">
                  {CURATED_PALETTES.map((pal) => (
                    <button
                      key={pal.name}
                      type="button"
                      onClick={() => {
                        onBatchUpdate({
                          waxColorHot: pal.waxColorHot,
                          waxColorCool: pal.waxColorCool,
                          liquidColor: pal.liquidColor,
                          liquidDensity: pal.liquidDensity,
                        });
                      }}
                      className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[#F6F6F9] dark:bg-[#0B0B0E] border border-black/[0.06] dark:border-white/[0.06] hover:border-black/[0.16] dark:hover:border-white/[0.16] transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35]"
                    >
                      <span className="text-[11.5px] font-medium text-[#2A2A36] dark:text-[#D8D8E4] truncate">
                        {pal.name}
                      </span>
                      <span className="flex items-center gap-0.5 shrink-0" aria-hidden="true">
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/15"
                          style={{ backgroundColor: pal.waxColorHot }}
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/15"
                          style={{ backgroundColor: pal.waxColorCool }}
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/15"
                          style={{ backgroundColor: pal.liquidColor }}
                        />
                      </span>
                    </button>
                  ))}
                </div>
              </SectionBlock>

              <SectionBlock title="Cores da Cera e Líquido">
                <ColorControl
                  label="Cera Quente (Base)"
                  value={config.waxColorHot}
                  onChange={(hex) => onUpdate('waxColorHot', hex)}
                />
                <ColorControl
                  label="Cera Fria (Topo)"
                  value={config.waxColorCool}
                  onChange={(hex) => onUpdate('waxColorCool', hex)}
                />
                <ColorControl
                  label="Cor do Líquido"
                  value={config.liquidColor}
                  onChange={(hex) => onUpdate('liquidColor', hex)}
                />
                <SliderControl
                  label="Transparência / Densidade"
                  value={config.liquidDensity}
                  min={0}
                  max={1}
                  step={0.01}
                  displayValue={`${Math.round(config.liquidDensity * 100)}%`}
                  onChange={(v) => onUpdate('liquidDensity', v)}
                  onCommit={onCommitHistory}
                />
              </SectionBlock>

              <SectionBlock title="Ajuste Cromático">
                <SliderControl
                  label="Saturação"
                  value={config.saturation}
                  min={0.4}
                  max={1.6}
                  step={0.02}
                  displayValue={`${Math.round(config.saturation * 100)}%`}
                  onChange={(v) => onUpdate('saturation', v)}
                  onCommit={onCommitHistory}
                />
                <SliderControl
                  label="Contraste"
                  value={config.contrast}
                  min={0.7}
                  max={1.5}
                  step={0.02}
                  displayValue={`${Math.round(config.contrast * 100)}%`}
                  onChange={(v) => onUpdate('contrast', v)}
                  onCommit={onCommitHistory}
                />
              </SectionBlock>
            </>
          )}

          {activeTab === 'cena' && (
            <>
              <SectionBlock title="Fundo Infinito">
                <div className="space-y-1.5">
                  <div className="text-[12px] text-[#3C3C48] dark:text-[#B6B6C2] font-medium">
                    Modo do Fundo
                  </div>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#EAEBF0] dark:bg-[#0A0A0C] border border-black/[0.06] dark:border-white/[0.06]">
                    {(
                      [
                        { value: 'light', label: 'Modo Claro', Icon: Sun },
                        { value: 'dark', label: 'Modo Escuro', Icon: Moon },
                      ] as const
                    ).map(({ value, label, Icon }) => {
                      const active = config.bgMode === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            onUpdate('bgMode', value as BackgroundMode);
                            onCommitHistory();
                          }}
                          className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-[12px] font-medium rounded-md transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35] ${
                            active
                              ? 'bg-white dark:bg-[#222229] text-[#14141A] dark:text-[#F4F4F6] shadow-xs dark:shadow-none'
                              : 'text-[#626272] dark:text-[#848494] hover:text-[#14141A] dark:hover:text-[#D4D4DE]'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <SliderControl
                  label="Luminosidade do Fundo"
                  value={config.bgLuminance}
                  min={0}
                  max={1}
                  step={0.01}
                  displayValue={`${Math.round(config.bgLuminance * 100)}%`}
                  onChange={(v) => onUpdate('bgLuminance', v)}
                  onCommit={onCommitHistory}
                />

                {config.vesselShape !== 'fluid' && (
                  <>
                    <SliderControl
                      label="Sombra de Estúdio"
                      value={config.studioShadow}
                      min={0}
                      max={1}
                      step={0.01}
                      displayValue={`${Math.round(config.studioShadow * 100)}%`}
                      onChange={(v) => onUpdate('studioShadow', v)}
                      onCommit={onCommitHistory}
                    />
                    <SliderControl
                      label="Reflexo no Chão"
                      value={config.floorReflection}
                      min={0}
                      max={1}
                      step={0.01}
                      displayValue={`${Math.round(config.floorReflection * 100)}%`}
                      onChange={(v) => onUpdate('floorReflection', v)}
                      onCommit={onCommitHistory}
                    />
                  </>
                )}

                <SliderControl
                  label="Granulação Fotográfica"
                  value={config.filmGrain}
                  min={0}
                  max={0.4}
                  step={0.01}
                  displayValue={`${Math.round((config.filmGrain / 0.4) * 100)}%`}
                  onChange={(v) => onUpdate('filmGrain', v)}
                  onCommit={onCommitHistory}
                />
              </SectionBlock>

              <SectionBlock title="Iluminação Interna">
                <SliderControl
                  label="Incandescência da Base"
                  value={config.bottomGlow}
                  min={0}
                  max={1.8}
                  step={0.02}
                  displayValue={`${Math.round(config.bottomGlow * 100)}%`}
                  onChange={(v) => onUpdate('bottomGlow', v)}
                  onCommit={onCommitHistory}
                />
                <SliderControl
                  label="Translucidez da Cera"
                  value={config.subsurface}
                  min={0}
                  max={1}
                  step={0.01}
                  displayValue={`${Math.round(config.subsurface * 100)}%`}
                  onChange={(v) => onUpdate('subsurface', v)}
                  onCommit={onCommitHistory}
                />
                <SliderControl
                  label="Halo Luminoso (Bloom)"
                  value={config.bloom}
                  min={0}
                  max={1.1}
                  step={0.01}
                  displayValue={`${Math.round(config.bloom * 100)}%`}
                  onChange={(v) => onUpdate('bloom', v)}
                  onCommit={onCommitHistory}
                />
              </SectionBlock>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
