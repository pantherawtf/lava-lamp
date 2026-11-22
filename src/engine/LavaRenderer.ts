import type {
  BackgroundMode,
  LavaConfig,
  MetalFinish,
  SymmetryMode,
  VesselShape,
} from '../types/lava';
import { MAX_BLOBS } from './physics';
import { FULLSCREEN_VERT_SHADER, POST_FRAG_SHADER, SCENE_FRAG_SHADER } from './shaders';

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

const SYMMETRY_MAP: Record<SymmetryMode, number> = {
  none: 0,
  mirrorX: 1,
  mirrorY: 2,
  quad: 3,
  kaleidoscope: 4,
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
  private sceneProgram: WebGLProgram;
  private postProgram: WebGLProgram;
  private vao: WebGLVertexArrayObject | null;

  private fbo: WebGLFramebuffer | null = null;
  private fboTex: WebGLTexture | null = null;
  private fboWidth = 0;
  private fboHeight = 0;

  private sceneUniforms: Record<string, WebGLUniformLocation | null> = {};
  private postUniforms: Record<string, WebGLUniformLocation | null> = {};

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
    this.sceneProgram = linkProgram(gl, FULLSCREEN_VERT_SHADER, SCENE_FRAG_SHADER);
    this.postProgram = linkProgram(gl, FULLSCREEN_VERT_SHADER, POST_FRAG_SHADER);
    this.vao = gl.createVertexArray();

    this.cacheUniforms();
  }

  private cacheUniforms(): void {
    const gl = this.gl;
    const sceneNames = [
      'uResolution',
      'uTime',
      'uTransparentBg',
      'uVesselShape',
      'uMetalFinish',
      'uScale',
      'uWidthRatio',
      'uTilt',
      'uOffset',
      'uEchoCount',
      'uEchoSpread',
      'uEchoOpacity',
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
      'uBgColor',
      'uBgStyle',
      'uBottomGlow',
      'uSubsurface',
      'uParallax',
    ];
    for (const name of sceneNames) {
      this.sceneUniforms[name] = gl.getUniformLocation(this.sceneProgram, name);
    }

    const postNames = [
      'uSceneTex',
      'uResolution',
      'uTime',
      'uTransparentBg',
      'uBloom',
      'uSaturation',
      'uContrast',
      'uWarpAmount',
      'uWarpScale',
      'uChromatic',
      'uSymmetry',
      'uFlutedGlass',
      'uFlutedDensity',
      'uSlitScan',
      'uFilmGrain',
      'uHalftone',
      'uPosterize',
    ];
    for (const name of postNames) {
      this.postUniforms[name] = gl.getUniformLocation(this.postProgram, name);
    }
  }

  private ensureFbo(width: number, height: number): void {
    if (this.fbo && this.fboTex && this.fboWidth === width && this.fboHeight === height) {
      return;
    }
    const gl = this.gl;
    if (this.fboTex) gl.deleteTexture(this.fboTex);
    if (this.fbo) gl.deleteFramebuffer(this.fbo);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.fbo = fbo;
    this.fboTex = tex;
    this.fboWidth = width;
    this.fboHeight = height;
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

    this.ensureFbo(w, h);
    gl.bindVertexArray(this.vao);

    // --- PASS 1: 3D Raymarched Lava Lamp Scene -> FBO ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.sceneProgram);

    const su = this.sceneUniforms;
    gl.uniform2f(su.uResolution, w, h);
    gl.uniform1f(su.uTime, time);
    gl.uniform1i(su.uTransparentBg, transparentBg ? 1 : 0);

    gl.uniform1i(su.uVesselShape, VESSEL_MAP[config.vesselShape]);
    gl.uniform1i(su.uMetalFinish, FINISH_MAP[config.metalFinish]);
    gl.uniform1f(su.uScale, config.scale);
    gl.uniform1f(su.uWidthRatio, config.widthRatio);
    gl.uniform1f(su.uTilt, config.tilt);
    gl.uniform2f(su.uOffset, config.offsetX, config.offsetY);
    gl.uniform1i(su.uEchoCount, config.echoCount);
    gl.uniform1f(su.uEchoSpread, config.echoSpread);
    gl.uniform1f(su.uEchoOpacity, config.echoOpacity);
    gl.uniform1f(su.uFloorReflection, config.floorReflection);
    gl.uniform1f(su.uStudioShadow, config.studioShadow);

    gl.uniform1i(su.uBlobCount, Math.min(MAX_BLOBS, Math.max(1, config.blobCount)));
    gl.uniform4fv(su.uBlobs, blobData);
    gl.uniform1f(su.uViscosity, config.viscosity);
    gl.uniform1f(su.uTurbulence, config.turbulence);
    gl.uniform1f(su.uParticles, config.particles);
    gl.uniform1f(su.uGlassRefraction, config.glassRefraction);

    const waxHot = hexToRgbNorm(config.waxColorHot);
    const waxCool = hexToRgbNorm(config.waxColorCool);
    const liqCol = hexToRgbNorm(config.liquidColor);

    gl.uniform3f(su.uWaxHot, waxHot[0], waxHot[1], waxHot[2]);
    gl.uniform3f(su.uWaxCool, waxCool[0], waxCool[1], waxCool[2]);
    gl.uniform3f(su.uLiquidColor, liqCol[0], liqCol[1], liqCol[2]);
    gl.uniform1f(su.uLiquidDensity, config.liquidDensity);
    gl.uniform3f(su.uBgColor, config.bgLuminance, config.bgLuminance, config.bgLuminance);
    gl.uniform1i(su.uBgStyle, BG_MODE_MAP[config.bgMode]);
    gl.uniform1f(su.uBottomGlow, config.bottomGlow);
    gl.uniform1f(su.uSubsurface, config.subsurface);
    gl.uniform2f(su.uParallax, parallax[0], parallax[1]);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Build mip chain of the scene (used by the soft bloom in the post pass)
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
    gl.generateMipmap(gl.TEXTURE_2D);

    // --- PASS 2: Experimental Distortions & Optical Finishing -> Screen ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.postProgram);

    const pu = this.postUniforms;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
    gl.uniform1i(pu.uSceneTex, 0);
    gl.uniform2f(pu.uResolution, w, h);
    gl.uniform1f(pu.uTime, time);
    gl.uniform1i(pu.uTransparentBg, transparentBg ? 1 : 0);

    gl.uniform1f(pu.uBloom, config.bloom);
    gl.uniform1f(pu.uSaturation, config.saturation);
    gl.uniform1f(pu.uContrast, config.contrast);

    gl.uniform1f(pu.uWarpAmount, config.warpAmount);
    gl.uniform1f(pu.uWarpScale, config.warpScale);
    gl.uniform1f(pu.uChromatic, config.chromaticAberration);
    gl.uniform1i(pu.uSymmetry, SYMMETRY_MAP[config.symmetryMode]);
    gl.uniform1f(pu.uFlutedGlass, config.flutedGlass);
    gl.uniform1f(pu.uFlutedDensity, config.flutedDensity);
    gl.uniform1f(pu.uSlitScan, config.slitScan);
    gl.uniform1f(pu.uFilmGrain, config.filmGrain);
    gl.uniform1f(pu.uHalftone, config.halftone);
    gl.uniform1f(pu.uPosterize, config.posterize);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  public dispose(): void {
    const gl = this.gl;
    if (this.fboTex) gl.deleteTexture(this.fboTex);
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    if (this.vao) gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.sceneProgram);
    gl.deleteProgram(this.postProgram);
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
