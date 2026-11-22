import type { AspectRatioOption, PresetDefinition } from '../types/lava';

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: 'free', label: 'Livre', ratio: null },
];

export const PRESETS: PresetDefinition[] = [
  {
    id: 'capsula-cobalto',
    name: 'Cápsula Cobalto',
    subtitle: 'Cilindro cromo e núcleo magenta',
    swatches: ['#FF2A5F', '#1824FF', '#3A3A44'],
    config: {
      vesselShape: 'capsule',
      metalFinish: 'darkChrome',
      scale: 1.0,
      widthRatio: 0.95,
      tilt: 0.0,
      offsetX: 0.0,
      offsetY: 0.0,
      echoCount: 1,
      echoSpread: 0.35,
      echoOpacity: 0.45,
      floorReflection: 0.16,
      studioShadow: 0.48,
      blobCount: 4,
      viscosity: 0.14,
      flowSpeed: 0.88,
      turbulence: 0.04,
      waxScale: 0.64,
      particles: 0.69,
      glassRefraction: 0.86,
      waxColorHot: '#FF94C2',
      waxColorCool: '#FF173D',
      liquidColor: '#161EFF',
      liquidDensity: 0.47,
      bgMode: 'light',
      bgLuminance: 0.55,
      bottomGlow: 1.38,
      subsurface: 0.72,
      bloom: 0.28,
      saturation: 1.16,
      contrast: 1.05,
      warpAmount: 0.0,
      warpScale: 4.0,
      chromaticAberration: 0.0,
      symmetryMode: 'none',
      flutedGlass: 0.0,
      flutedDensity: 22,
      slitScan: 0.0,
      filmGrain: 0.04,
      halftone: 0.0,
      posterize: 0.0,
    },
  },
  {
    id: 'astro-classica',
    name: 'Astro Clássica',
    subtitle: 'Alumínio escovado e azul safira',
    swatches: ['#FF1E1E', '#0A4DFF', '#C2C6CE'],
    config: {
      vesselShape: 'astro',
      metalFinish: 'brushedSilver',
      scale: 0.98,
      widthRatio: 1.0,
      tilt: 0.0,
      offsetX: 0.0,
      offsetY: 0.0,
      echoCount: 1,
      echoSpread: 0.35,
      echoOpacity: 0.4,
      floorReflection: 0.12,
      studioShadow: 0.62,
      blobCount: 4,
      viscosity: 0.14,
      flowSpeed: 0.78,
      turbulence: 0.04,
      waxScale: 0.64,
      particles: 0.69,
      glassRefraction: 0.82,
      waxColorHot: '#FF2A14',
      waxColorCool: '#B80012',
      liquidColor: '#0048E8',
      liquidDensity: 0.47,
      bgMode: 'light',
      bgLuminance: 0.55,
      bottomGlow: 0.88,
      subsurface: 0.58,
      bloom: 0.18,
      saturation: 1.1,
      contrast: 1.04,
      warpAmount: 0.0,
      warpScale: 3.0,
      chromaticAberration: 0.0,
      symmetryMode: 'none',
      flutedGlass: 0.0,
      flutedDensity: 24,
      slitScan: 0.0,
      filmGrain: 0.06,
      halftone: 0.0,
      posterize: 0.0,
    },
  },
  {
    id: 'cobre-rose',
    name: 'Cobre Rosé',
    subtitle: 'Projétil metálico e coral luminoso',
    swatches: ['#FFA575', '#F02E6B', '#D9A08B'],
    config: {
      vesselShape: 'bullet',
      metalFinish: 'roseCopper',
      scale: 1.02,
      widthRatio: 0.88,
      tilt: 0.0,
      offsetX: 0.0,
      offsetY: 0.0,
      echoCount: 1,
      echoSpread: 0.35,
      echoOpacity: 0.4,
      floorReflection: 0.2,
      studioShadow: 0.42,
      blobCount: 4,
      viscosity: 0.14,
      flowSpeed: 0.86,
      turbulence: 0.04,
      waxScale: 0.64,
      particles: 0.69,
      glassRefraction: 0.88,
      waxColorHot: '#FFD29E',
      waxColorCool: '#FF2A3B',
      liquidColor: '#D62888',
      liquidDensity: 0.47,
      bgMode: 'light',
      bgLuminance: 0.55,
      bottomGlow: 1.15,
      subsurface: 0.86,
      bloom: 0.26,
      saturation: 1.12,
      contrast: 1.04,
      warpAmount: 0.0,
      warpScale: 4.0,
      chromaticAberration: 0.0,
      symmetryMode: 'none',
      flutedGlass: 0.0,
      flutedDensity: 24,
      slitScan: 0.0,
      filmGrain: 0.03,
      halftone: 0.0,
      posterize: 0.0,
    },
  },
  {
    id: 'rubi-cristal',
    name: 'Rubi Cristal',
    subtitle: 'Líquido límpido e cera vermelhão',
    swatches: ['#FF140A', '#E8DAD4', '#B8B9BD'],
    config: {
      vesselShape: 'astro',
      metalFinish: 'brushedSilver',
      scale: 0.98,
      widthRatio: 1.0,
      tilt: 0.0,
      offsetX: 0.0,
      offsetY: 0.0,
      echoCount: 1,
      echoSpread: 0.35,
      echoOpacity: 0.4,
      floorReflection: 0.12,
      studioShadow: 0.62,
      blobCount: 4,
      viscosity: 0.14,
      flowSpeed: 0.84,
      turbulence: 0.03,
      waxScale: 0.64,
      particles: 0.69,
      glassRefraction: 0.92,
      waxColorHot: '#FF3814',
      waxColorCool: '#D9000E',
      liquidColor: '#F5DDD4',
      liquidDensity: 0.47,
      bgMode: 'light',
      bgLuminance: 0.55,
      bottomGlow: 0.92,
      subsurface: 0.64,
      bloom: 0.16,
      saturation: 1.14,
      contrast: 1.05,
      warpAmount: 0.0,
      warpScale: 3.0,
      chromaticAberration: 0.0,
      symmetryMode: 'none',
      flutedGlass: 0.0,
      flutedDensity: 24,
      slitScan: 0.0,
      filmGrain: 0.05,
      halftone: 0.0,
      posterize: 0.0,
    },
  },
];

export interface ColorPaletteSwatch {
  name: string;
  waxColorHot: string;
  waxColorCool: string;
  liquidColor: string;
  liquidDensity: number;
}

export const CURATED_PALETTES: ColorPaletteSwatch[] = [
  {
    name: 'Cobalto & Rubi',
    waxColorHot: '#FF94C2',
    waxColorCool: '#FF173D',
    liquidColor: '#161EFF',
    liquidDensity: 0.84,
  },
  {
    name: 'Coral & Magenta',
    waxColorHot: '#FFD4A3',
    waxColorCool: '#FF2A42',
    liquidColor: '#D62888',
    liquidDensity: 0.64,
  },
  {
    name: 'Rubi Cristalino',
    waxColorHot: '#FF3E14',
    waxColorCool: '#CF0010',
    liquidColor: '#F5DDD4',
    liquidDensity: 0.14,
  },
  {
    name: 'Âmbar Solar',
    waxColorHot: '#FFF28F',
    waxColorCool: '#FF6A14',
    liquidColor: '#B8470A',
    liquidDensity: 0.58,
  },
  {
    name: 'Turquesa Abissal',
    waxColorHot: '#D8FFF4',
    waxColorCool: '#19DCE8',
    liquidColor: '#0B4961',
    liquidDensity: 0.56,
  },
  {
    name: 'Violeta & Menta',
    waxColorHot: '#ECFF70',
    waxColorCool: '#26E896',
    liquidColor: '#5B18F0',
    liquidDensity: 0.72,
  },
  {
    name: 'Mercúrio Prata',
    waxColorHot: '#FFFFFF',
    waxColorCool: '#9BA8BF',
    liquidColor: '#1E2430',
    liquidDensity: 0.62,
  },
  {
    name: 'Framboesa & Ouro',
    waxColorHot: '#FFEB85',
    waxColorCool: '#FF0066',
    liquidColor: '#4A0E3C',
    liquidDensity: 0.7,
  },
];

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const lig = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toByte = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`.toUpperCase();
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a fresh, clean lava lamp configuration (vessel, finish, internal wax/liquid colors,
 * fluid dynamics, particles, and lighting) without image distortions, preserving the current Light/Dark backdrop.
 */
export function randomizeLampConfig(current: import('../types/lava').LavaConfig): import('../types/lava').LavaConfig {
  const shapes = ['astro', 'capsule', 'bullet', 'organic'] as const;
  const finishes = [
    'brushedSilver',
    'darkChrome',
    'roseCopper',
    'matteObsidian',
    'frostedGlass',
  ] as const;

  // Pick a different vessel shape most of the time so each click feels noticeably fresh
  const otherShapes = shapes.filter((s) => s !== current.vesselShape);
  const vesselShape = Math.random() < 0.78 ? pick(otherShapes) : pick(shapes);
  const metalFinish = pick(finishes);

  // 45% curated studio palette, 55% freshly synthesized harmonious color pairing
  let waxColorHot: string;
  let waxColorCool: string;
  let liquidColor: string;
  let liquidDensity: number;

  if (Math.random() < 0.45) {
    const pal = pick(CURATED_PALETTES);
    waxColorHot = pal.waxColorHot;
    waxColorCool = pal.waxColorCool;
    liquidColor = pal.liquidColor;
    liquidDensity = Math.max(0.14, Math.min(0.86, pal.liquidDensity + (Math.random() - 0.5) * 0.2));
  } else {
    const waxHue = Math.random() * 360;
    const liquidOffset = pick([140, 175, 205, 230, -35, 35]);
    waxColorCool = hslToHex(waxHue, 82 + Math.random() * 16, 46 + Math.random() * 12);
    waxColorHot = hslToHex(waxHue + 22, 85 + Math.random() * 15, 72 + Math.random() * 16);
    liquidColor = hslToHex(waxHue + liquidOffset, 68 + Math.random() * 30, 32 + Math.random() * 26);
    liquidDensity = 0.16 + Math.random() * 0.68;
  }

  return {
    ...current,
    vesselShape,
    metalFinish,
    scale: 0.94 + Math.random() * 0.14,
    widthRatio: 0.86 + Math.random() * 0.24,
    tilt: 0.0,
    offsetX: 0.0,
    offsetY: 0.0,
    echoCount: 1,
    floorReflection: 0.08 + Math.random() * 0.24,
    studioShadow: 0.36 + Math.random() * 0.34,

    blobCount: Math.floor(3 + Math.random() * 6),
    viscosity: 0.09 + Math.random() * 0.18,
    flowSpeed: 0.68 + Math.random() * 0.52,
    turbulence: Math.random() * 0.12,
    waxScale: 0.58 + Math.random() * 0.34,
    particles: 0.1 + Math.random() * 0.82,
    glassRefraction: 0.68 + Math.random() * 0.26,

    waxColorHot,
    waxColorCool,
    liquidColor,
    liquidDensity,
    bottomGlow: 0.85 + Math.random() * 0.62,
    subsurface: 0.58 + Math.random() * 0.3,
    bloom: 0.16 + Math.random() * 0.28,
    saturation: 1.05 + Math.random() * 0.16,
    contrast: 1.02 + Math.random() * 0.08,
    filmGrain: 0.03 + Math.random() * 0.06,
  };
}

