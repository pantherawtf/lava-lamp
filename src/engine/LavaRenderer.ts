import type { LavaConfig, MetalFinish, VesselShape } from '../types/lava';
import { FULLSCREEN_VERT_SHADER, SCENE_FRAG_SHADER } from './shaders';

const VESSEL_SHAPE_MAP: Record<VesselShape, number> = {
  astro: 0,
  capsule: 1,
  bullet: 2,
  organic: 3,
  fluid: 4,
};

export interface TransientMotion {
  offsetX: number;
  offsetY: number;
  tilt: number;
  scaleMultiplier?: number;
  shakeGlitter: [number, number, number, number];
}

const METAL_FINISH_MAP: Record<MetalFinish, number> = {
  brushedSilver: 0,
  darkChrome: 1,
  roseCopper: 2,
  matteObsidian: 3,
  frostedGlass: 4,
};

function hexToRgbLinear(hex: string, out: [number, number, number]): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean, 16);
  if (Number.isNaN(num)) {
    out[0] = 1;
    out[1] = 0.2;
    out[2] = 0.4;
    return out;
  }
  out[0] = ((num >> 16) & 255) / 255;
  out[1] = ((num >> 8) & 255) / 255;
  out[2] = (num & 255) / 255;
  return out;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Falha ao alocar shader WebGL2.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Erro de compilação GLSL.';
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new Error('Falha ao criar programa WebGL2.');
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'Erro ao vincular programa WebGL2.';
    gl.deleteProgram(program);
    throw new Error(info);
  }
  return program;
}

export class LavaRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject | null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  private rgbHot: [number, number, number] = [1, 0.5, 0.7];
  private rgbCool: [number, number, number] = [1, 0.1, 0.25];
  private rgbLiquid: [number, number, number] = [0.1, 0.15, 1];

  constructor(canvas: HTMLCanvasElement, preserveDrawingBuffer = false) {
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
      throw new Error('WebGL2 não suportado neste navegador.');
    }

    this.gl = gl;
    this.program = createProgram(gl, FULLSCREEN_VERT_SHADER, SCENE_FRAG_SHADER);
    this.vao = gl.createVertexArray();

    const uniformNames = [
      'uResolution',
      'uTime',
      'uParallax',
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
      'uBgMode',
      'uBgLuminance',
      'uBottomGlow',
      'uSubsurface',
      'uBloom',
      'uSaturation',
      'uContrast',
      'uFilmGrain',
      'uShakeGlitter',
    ];

    for (const name of uniformNames) {
      this.uniforms[name] = gl.getUniformLocation(this.program, name);
    }
  }

  public render(
    config: LavaConfig,
    blobData: Float32Array,
    time: number,
    parallax: [number, number],
    transparentBg = false,
    transientMotion?: TransientMotion
  ): void {
    const gl = this.gl;
    const width = gl.canvas.width;
    const height = gl.canvas.height;
    if (width <= 0 || height <= 0) return;

    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    const u = this.uniforms;
    gl.uniform2f(u.uResolution, width, height);
    gl.uniform1f(u.uTime, time);
    gl.uniform2f(u.uParallax, parallax[0], parallax[1]);
    gl.uniform1i(u.uTransparentBg, transparentBg ? 1 : 0);

    gl.uniform1i(u.uVesselShape, VESSEL_SHAPE_MAP[config.vesselShape] ?? 0);
    gl.uniform1i(u.uMetalFinish, METAL_FINISH_MAP[config.metalFinish] ?? 0);
    gl.uniform1f(u.uScale, config.scale * 0.7 * (transientMotion?.scaleMultiplier ?? 1));
    gl.uniform1f(u.uWidthRatio, config.widthRatio);
    gl.uniform1f(u.uTilt, config.tilt + (transientMotion?.tilt ?? 0));
    gl.uniform2f(
      u.uOffset,
      config.offsetX + (transientMotion?.offsetX ?? 0),
      config.offsetY + (transientMotion?.offsetY ?? 0)
    );
    gl.uniform1f(u.uFloorReflection, config.floorReflection);
    gl.uniform1f(u.uStudioShadow, config.studioShadow);

    gl.uniform1i(u.uBlobCount, Math.max(1, Math.min(9, config.blobCount)));
    gl.uniform4fv(u.uBlobs, blobData);
    gl.uniform1f(u.uViscosity, config.viscosity);
    gl.uniform1f(u.uTurbulence, config.turbulence);
    gl.uniform1f(u.uParticles, config.particles);
    gl.uniform1f(u.uGlassRefraction, config.glassRefraction);

    hexToRgbLinear(config.waxColorHot, this.rgbHot);
    hexToRgbLinear(config.waxColorCool, this.rgbCool);
    hexToRgbLinear(config.liquidColor, this.rgbLiquid);

    gl.uniform3f(u.uWaxHot, this.rgbHot[0], this.rgbHot[1], this.rgbHot[2]);
    gl.uniform3f(u.uWaxCool, this.rgbCool[0], this.rgbCool[1], this.rgbCool[2]);
    gl.uniform3f(u.uLiquidColor, this.rgbLiquid[0], this.rgbLiquid[1], this.rgbLiquid[2]);
    gl.uniform1f(u.uLiquidDensity, config.liquidDensity);
    gl.uniform1i(u.uBgMode, config.bgMode === 'dark' ? 1 : 0);
    gl.uniform1f(u.uBgLuminance, config.bgLuminance);
    gl.uniform1f(u.uBottomGlow, config.bottomGlow);
    gl.uniform1f(u.uSubsurface, config.subsurface);
    gl.uniform1f(u.uBloom, config.bloom * 1.96);
    gl.uniform1f(u.uSaturation, config.saturation);
    gl.uniform1f(u.uContrast, config.contrast);
    gl.uniform1f(u.uFilmGrain, config.filmGrain);

    const sg = transientMotion?.shakeGlitter;
    gl.uniform4f(u.uShakeGlitter, sg ? sg[0] : 0, sg ? sg[1] : 0, sg ? sg[2] : 0, sg ? sg[3] : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  public dispose(): void {
    const gl = this.gl;
    if (this.vao) {
      gl.deleteVertexArray(this.vao);
      this.vao = null;
    }
    gl.deleteProgram(this.program);
  }
}

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
      offscreen.toBlob(resolve, mimeType, mimeType === 'image/webp' ? 0.94 : undefined)
    );
    if (!blob) {
      throw new Error('Não foi possível gerar a imagem em alta resolução.');
    }
    return blob;
  } finally {
    renderer.dispose();
  }
}
