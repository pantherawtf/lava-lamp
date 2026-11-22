import type {
  BackgroundMode,
  LavaConfig,
  MetalFinish,
  VesselShape,
} from '../types/lava';
import { MAX_BLOBS } from './physics';
import { FULLSCREEN_VERT_SHADER, SCENE_FRAG_SHADER } from './shaders';

const VESSEL_MAP: Record<VesselShape, number> = {
  astro: 0,
  capsule: 1,
  bullet: 2,
  organic: 3,
  fluid: 4,
};

const FINISH_MAP: Record<MetalFinish, number> = {
  brushedSilver: 0,
  darkChrome: 1,
  roseCopper: 2,
  matteObsidian: 3,
  frostedGlass: 4,
};

const BG_MODE_MAP: Record<BackgroundMode, number> = {
  light: 0,
  dark: 1,
};

function hexToRgbNorm(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [1, 1, 1];
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [
    Number.isFinite(r) ? r : 1,
    Number.isFinite(g) ? g : 1,
    Number.isFinite(b) ? b : 1,
  ];
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create WebGL shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'Unknown shader compile error';
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed:\n${log}`);
  }
  return shader;
}

function linkProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create WebGL program');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || 'Unknown link error';
    gl.deleteProgram(program);
    throw new Error(`Program linking failed:\n${log}`);
  }
  return program;
}

export class LavaRenderer {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject | null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  constructor(canvas: HTMLCanvasElement, preserveDrawingBuffer = false) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer,
      powerPreference: 'high-performance',
    });

    if (!gl) {
      throw new Error('WebGL2 não disponível neste navegador.');
    }

    this.gl = gl;
    this.program = linkProgram(gl, FULLSCREEN_VERT_SHADER, SCENE_FRAG_SHADER);
    this.vao = gl.createVertexArray();
    this.cacheUniforms();
  }

  private cacheUniforms(): void {
    const gl = this.gl;
    const names = [
      'uResolution',
      'uTime',
      'uTransparentBg',
      'uVesselShape',
      'uMetalFinish',
      'uScale',
      'uWidthRatio',
      'uTilt',
      'uOffset',
      'uFloorReflection',
      'uStudioShadow',
      'uBlobCount',
      'uBlobs',
      'uViscosity',
      'uTurbulence',
      'uParticles',
      'uGlassRefraction',
      'uWaxHot',
      'uWaxCool',
      'uLiquidColor',
      'uLiquidDensity',
      'uBgLuminance',
      'uBgMode',
      'uBottomGlow',
      'uSubsurface',
      'uBloom',
      'uSaturation',
      'uContrast',
      'uFilmGrain',
      'uParallax',
    ];
    for (const name of names) {
      this.uniforms[name] = gl.getUniformLocation(this.program, name);
    }
  }

  public render(
    config: LavaConfig,
    blobData: Float32Array,
    time: number,
    parallax: [number, number] = [0, 0],
    transparentBg = false
  ): void {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w <= 0 || h <= 0) return;

    gl.viewport(0, 0, w, h);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    const u = this.uniforms;
    gl.uniform2f(u.uResolution, w, h);
    gl.uniform1f(u.uTime, time);
    gl.uniform1i(u.uTransparentBg, transparentBg ? 1 : 0);

    gl.uniform1i(u.uVesselShape, VESSEL_MAP[config.vesselShape]);
    gl.uniform1i(u.uMetalFinish, FINISH_MAP[config.metalFinish]);
    gl.uniform1f(u.uScale, config.scale);
    gl.uniform1f(u.uWidthRatio, config.widthRatio);
    gl.uniform1f(u.uTilt, config.tilt);
    gl.uniform2f(u.uOffset, config.offsetX, config.offsetY);
    gl.uniform1f(u.uFloorReflection, config.floorReflection);
    gl.uniform1f(u.uStudioShadow, config.studioShadow);

    gl.uniform1i(u.uBlobCount, Math.min(MAX_BLOBS, Math.max(1, config.blobCount)));
    gl.uniform4fv(u.uBlobs, blobData);
    gl.uniform1f(u.uViscosity, config.viscosity);
    gl.uniform1f(u.uTurbulence, config.turbulence);
    gl.uniform1f(u.uParticles, config.particles);
    gl.uniform1f(u.uGlassRefraction, config.glassRefraction);

    const waxHot = hexToRgbNorm(config.waxColorHot);
    const waxCool = hexToRgbNorm(config.waxColorCool);
    const liqCol = hexToRgbNorm(config.liquidColor);

    gl.uniform3f(u.uWaxHot, waxHot[0], waxHot[1], waxHot[2]);
    gl.uniform3f(u.uWaxCool, waxCool[0], waxCool[1], waxCool[2]);
    gl.uniform3f(u.uLiquidColor, liqCol[0], liqCol[1], liqCol[2]);
    gl.uniform1f(u.uLiquidDensity, config.liquidDensity);
    gl.uniform1f(u.uBgLuminance, config.bgLuminance);
    gl.uniform1i(u.uBgMode, BG_MODE_MAP[config.bgMode]);
    gl.uniform1f(u.uBottomGlow, config.bottomGlow);
    gl.uniform1f(u.uSubsurface, config.subsurface);
    gl.uniform1f(u.uBloom, config.bloom);
    gl.uniform1f(u.uSaturation, config.saturation);
    gl.uniform1f(u.uContrast, config.contrast);
    gl.uniform1f(u.uFilmGrain, config.filmGrain);
    gl.uniform2f(u.uParallax, parallax[0], parallax[1]);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  public dispose(): void {
    const gl = this.gl;
    if (this.vao) gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
  }
}

/**
 * Renders a crisp high-resolution offscreen snapshot at arbitrary resolution (up to 4K).
 */
export async function renderHighResImage(
  config: LavaConfig,
  blobData: Float32Array,
  time: number,
  parallax: [number, number],
  width: number,
  height: number,
  mimeType: 'image/png' | 'image/webp',
  transparentBg: boolean
): Promise<Blob> {
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;

  const renderer = new LavaRenderer(offscreen, true);
  try {
    renderer.render(config, blobData, time, parallax, transparentBg);
    const blob = await new Promise<Blob | null>((resolve) =>
      offscreen.toBlob(resolve, mimeType, mimeType === 'image/webp' ? 0.96 : 1.0)
    );
    if (!blob) throw new Error('Falha ao codificar imagem de alta resolução.');
    return blob;
  } finally {
    renderer.dispose();
  }
}
