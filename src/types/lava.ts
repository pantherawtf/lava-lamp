export type VesselShape = 'astro' | 'capsule' | 'bullet' | 'organic' | 'fluid';

export type MetalFinish =
  | 'brushedSilver'
  | 'darkChrome'
  | 'roseCopper'
  | 'matteObsidian'
  | 'frostedGlass';

export type BackgroundMode = 'light' | 'dark';

export type SymmetryMode = 'none' | 'mirrorX' | 'mirrorY' | 'quad' | 'kaleidoscope';

export type AspectRatioId = '4:5' | '1:1' | '16:9' | '9:16' | 'free';

export type InspectorTab = 'frasco' | 'interno' | 'cores' | 'cena';

export interface LavaConfig {
  // Vessel & Composition
  vesselShape: VesselShape;
  metalFinish: MetalFinish;
  scale: number;
  widthRatio: number;
  tilt: number;
  offsetX: number;
  offsetY: number;
  echoCount: number; // 1, 2, or 3
  echoSpread: number;
  echoOpacity: number;
  floorReflection: number;
  studioShadow: number;

  // Fluid & Wax
  blobCount: number;
  viscosity: number;
  flowSpeed: number;
  turbulence: number;
  waxScale: number;
  particles: number;
  glassRefraction: number;

  // Colors & Lighting
  waxColorHot: string;
  waxColorCool: string;
  liquidColor: string;
  liquidDensity: number;
  bgMode: BackgroundMode;
  bgLuminance: number; // 0.0 to 1.0 fine adjustment within light or dark mode
  bottomGlow: number;
  subsurface: number;
  bloom: number;
  saturation: number;
  contrast: number;

  // Experimental Distortions
  warpAmount: number;
  warpScale: number;
  chromaticAberration: number;
  symmetryMode: SymmetryMode;
  flutedGlass: number;
  flutedDensity: number;
  slitScan: number;
  filmGrain: number;
  halftone: number;
  posterize: number;
}

export interface PresetDefinition {
  id: string;
  name: string;
  subtitle: string;
  swatches: [string, string, string];
  config: LavaConfig;
}

export interface AspectRatioOption {
  id: AspectRatioId;
  label: string;
  ratio: number | null; // width / height, null for free
}

export interface BlobState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  baseRadius: number;
  temp: number; // 0 = cool (sinks), 1 = hot (rises)
  phase: number;
  driftFreq: number;
  thermalRate: number;
  buoyancyBias: number;
  orbitRadius: number;
  orbitSign: number;
  wanderSeed: number;
  counterRole: boolean;
}
