export const FULLSCREEN_VERT_SHADER = `#version 300 es
precision highp float;

const vec2 POSITIONS[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2( 3.0, -1.0),
  vec2(-1.0,  3.0)
);

out vec2 vUv;

void main() {
  vec2 pos = POSITIONS[gl_VertexID];
  vUv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

export const SCENE_FRAG_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;
uniform int uTransparentBg;

// Vessel & Composition
uniform int uVesselShape;     // 0=astro, 1=capsule, 2=bullet, 3=organic, 4=fluid
uniform int uMetalFinish;     // 0=brushedSilver, 1=darkChrome, 2=roseCopper, 3=matteObsidian, 4=frostedGlass
uniform float uScale;
uniform float uWidthRatio;
uniform float uTilt;
uniform vec2 uOffset;
uniform int uEchoCount;       // 1, 2, 3
uniform float uEchoSpread;
uniform float uEchoOpacity;
uniform float uFloorReflection;
uniform float uStudioShadow;

// Fluid & Wax
uniform int uBlobCount;
uniform vec4 uBlobs[14];
uniform float uViscosity;
uniform float uTurbulence;
uniform float uParticles;
uniform float uGlassRefraction;

// Colors & Lighting
uniform vec3 uWaxHot;
uniform vec3 uWaxCool;
uniform vec3 uLiquidColor;
uniform float uLiquidDensity;
uniform vec3 uBgColor;
uniform int uBgStyle;         // 0=void, 1=halo, 2=studio, 3=concrete
uniform float uBottomGlow;
uniform float uSubsurface;

// Interactive tilt parallax from drag
uniform vec2 uParallax;

// --- Math & Noise Utilities ---

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float noise3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));

  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);

  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / max(k, 0.0001), 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

mat2 rot2(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

// --- Vessel Geometry Profiles ---
// Returns vec4(glassBottom, glassTop, totalBottom, totalTop)
vec4 getVesselBounds(int shape) {
  if (shape == 1) {
    // Capsule cylinder (Image 1)
    return vec4(-0.34, 0.45, -0.68, 0.59);
  } else if (shape == 2) {
    // Slender bullet (Image 3)
    return vec4(-0.18, 0.48, -0.72, 0.68);
  } else if (shape == 3) {
    // Organic sculpted vase
    return vec4(-0.30, 0.46, -0.68, 0.62);
  } else {
    // Classic Astro hourglass (Images 2, 4, 5, 6, 7)
    return vec4(-0.22, 0.42, -0.72, 0.62);
  }
}

// Returns radius of the revolved vessel at height y
float getVesselRadius(float y, int shape) {
  float r = 0.16;
  if (shape == 0) {
    // Astro classic hourglass
    if (y >= 0.42) {
      // Tapered cap
      float t = clamp((y - 0.42) / 0.20, 0.0, 1.0);
      r = mix(0.106, 0.056, t);
    } else if (y >= -0.22) {
      // Conical glass with slight bottom curve inward
      float t = (y + 0.22) / 0.64;
      float cone = mix(0.214, 0.106, pow(t, 0.92));
      float belly = smoothstep(0.0, 0.12, t);
      r = mix(0.194, cone, belly);
    } else if (y >= -0.47) {
      // Upper base cone pinching inward
      float t = (y + 0.47) / 0.25;
      r = mix(0.088, 0.194, t);
    } else {
      // Lower base cone flaring out
      float t = clamp((-0.47 - y) / 0.25, 0.0, 1.0);
      r = mix(0.088, 0.202, t);
    }
  } else if (shape == 1) {
    // Capsule cylinder (Image 1)
    if (y >= 0.45) {
      float t = clamp((y - 0.45) / 0.14, 0.0, 1.0);
      // Superellipse rounded chrome dome
      r = 0.174 * pow(max(0.0, 1.0 - pow(t, 2.5)), 0.42);
    } else if (y >= -0.55) {
      r = 0.174;
    } else if (y >= -0.64) {
      // Tapered bottom collar
      float t = clamp((-0.55 - y) / 0.09, 0.0, 1.0);
      r = mix(0.174, 0.118, smoothstep(0.0, 1.0, t));
    } else {
      // Sleek flat disc foot
      float t = clamp((-0.64 - y) / 0.04, 0.0, 1.0);
      r = mix(0.125, 0.188, smoothstep(0.0, 0.6, t));
    }
  } else if (shape == 2) {
    // Tall slender bullet (Image 3)
    if (y >= 0.48) {
      float t = clamp((y - 0.48) / 0.20, 0.0, 1.0);
      r = 0.092 * pow(max(0.0, 1.0 - pow(t, 2.2)), 0.48);
    } else if (y >= -0.18) {
      float t = (y + 0.18) / 0.66;
      float bulge = sin(t * 3.14159) * 0.032;
      r = mix(0.142, 0.092, t) + bulge;
    } else if (y >= -0.64) {
      float t = (-0.18 - y) / 0.46;
      r = mix(0.142, 0.058, pow(t, 0.85));
    } else {
      // Flared rose-copper foot
      float t = clamp((-0.64 - y) / 0.08, 0.0, 1.0);
      r = mix(0.062, 0.192, smoothstep(0.0, 1.0, t));
    }
  } else {
    // Organic mid-century vase
    if (y >= 0.46) {
      float t = clamp((y - 0.46) / 0.16, 0.0, 1.0);
      r = 0.115 * pow(max(0.0, 1.0 - pow(t, 2.2)), 0.45);
    } else if (y >= -0.30) {
      float t = (y + 0.30) / 0.76;
      r = 0.16 + 0.065 * sin(t * 3.14159 * 1.15 - 0.2) - 0.045 * t;
    } else {
      float t = clamp((-0.30 - y) / 0.38, 0.0, 1.0);
      r = 0.148 - 0.055 * sin(t * 3.14159) + 0.04 * t;
    }
  }
  return r * uWidthRatio;
}

float sdVesselOuter(vec3 p, int shape) {
  vec4 b = getVesselBounds(shape);
  float cy = clamp(p.y, b.z, b.w);
  float r = getVesselRadius(cy, shape);
  float dr = length(p.xz) - r;
  float dy = max(b.z - p.y, p.y - b.w);
  float d = max(dr, dy);
  if (dr > 0.0 && dy > 0.0) {
    d = length(vec2(dr, dy));
  }
  return d * 0.65;
}

vec3 calcVesselNormal(vec3 p, int shape) {
  const float e = 0.0025;
  return normalize(vec3(
    sdVesselOuter(p + vec3(e, 0.0, 0.0), shape) - sdVesselOuter(p - vec3(e, 0.0, 0.0), shape),
    sdVesselOuter(p + vec3(0.0, e, 0.0), shape) - sdVesselOuter(p - vec3(0.0, e, 0.0), shape),
    sdVesselOuter(p + vec3(0.0, 0.0, e), shape) - sdVesselOuter(p - vec3(0.0, 0.0, e), shape)
  ));
}

// --- 3D Wax Metaball SDF ---
float mapWax(vec3 p, vec4 bounds, float timeOffset, bool isPureFluid) {
  float glassMid = 0.5 * (bounds.x + bounds.y);
  float glassHalf = 0.5 * (bounds.y - bounds.x);

  // Normalize coordinate into blob physics space
  vec3 bp = p;
  if (!isPureFluid) {
    bp.y = (p.y - glassMid) / max(glassHalf, 0.01) * 0.44;
    bp.xz /= max(uWidthRatio, 0.4);
  } else {
    bp *= 0.62;
  }

  // Organic turbulence displacement
  float turb = 0.0;
  if (uTurbulence > 0.005) {
    vec3 tp = bp * 5.2 + vec3(0.0, -uTime * 0.45 + timeOffset, uTime * 0.2);
    turb = (noise3D(tp) - 0.5) * 0.09 * uTurbulence;
    turb += (noise3D(tp * 2.1 + 7.3) - 0.5) * 0.035 * uTurbulence;
  }

  float d = 10.0;
  float k = uViscosity;

  for (int i = 0; i < 14; i++) {
    if (i >= uBlobCount) break;
    vec4 b = uBlobs[i];
    if (b.w <= 0.001) continue;
    vec3 center = b.xyz;
    // Slight phase offset for echoed lamps so their blobs look organically distinct
    if (abs(timeOffset) > 0.01) {
      center.y = clamp(center.y + sin(timeOffset * 2.3 + float(i) * 1.7) * 0.14, -0.38, 0.36);
      center.x += cos(timeOffset * 1.9 + float(i) * 2.1) * 0.04;
    }
    // Slight vertical teardrop stretch for realistic lava lamp wax
    vec3 q = bp - center;
    q.y *= 0.86;
    float sd = length(q) - b.w;
    d = smin(d, sd, k);
  }

  // Heated bottom wax pool inside glass vessel
  if (!isPureFluid) {
    float poolH = -0.435 + 0.025 * sin(bp.x * 11.0 + uTime * 0.9 + timeOffset);
    float pool = bp.y - poolH;
    d = smin(d, pool, k * 1.15);

    // Subtle tiny top wax meniscus cap
    float topCap = (0.455 + 0.015 * cos(bp.x * 9.0 - uTime * 0.7)) - bp.y;
    d = smin(d, topCap, k * 0.65);
  }

  return (d + turb) * (isPureFluid ? 1.0 : 0.72);
}

vec3 calcWaxNormal(vec3 p, vec4 bounds, float timeOffset, bool isPureFluid) {
  const float e = 0.003;
  return normalize(vec3(
    mapWax(p + vec3(e, 0.0, 0.0), bounds, timeOffset, isPureFluid) - mapWax(p - vec3(e, 0.0, 0.0), bounds, timeOffset, isPureFluid),
    mapWax(p + vec3(0.0, e, 0.0), bounds, timeOffset, isPureFluid) - mapWax(p - vec3(0.0, e, 0.0), bounds, timeOffset, isPureFluid),
    mapWax(p + vec3(0.0, 0.0, e), bounds, timeOffset, isPureFluid) - mapWax(p - vec3(0.0, 0.0, e), bounds, timeOffset, isPureFluid)
  ));
}

// --- Suspended Bioluminescent Glitter / Micro-Bubbles ---
float evalGlitter(vec3 p, vec4 bounds) {
  if (uParticles <= 0.01) return 0.0;
  float hNorm = clamp((p.y - bounds.x) / max(bounds.y - bounds.x, 0.01), 0.0, 1.0);
  // Subtle upward drift
  vec3 gp = p * 34.0 + vec3(0.0, -uTime * 0.85, 0.0);
  vec3 cell = floor(gp);
  vec3 f = fract(gp) - 0.5;
  float h = hash13(cell);
  float threshold = mix(0.985, 0.72, uParticles);
  if (h < threshold) return 0.0;

  vec3 jitterPos = vec3(
    hash13(cell + 13.7) - 0.5,
    hash13(cell + 29.1) - 0.5,
    hash13(cell + 53.3) - 0.5
  ) * 0.65;
  float dist = length(f - jitterPos);
  float size = mix(0.07, 0.2, fract(h * 41.3));
  float dotVal = smoothstep(size, size * 0.18, dist);
  // Stronger concentration and brilliance near bottom light source (Image 6)
  float bottomBoost = mix(1.8, 0.65, pow(hNorm, 0.65));
  float twinkle = 0.65 + 0.35 * sin(uTime * 3.5 + h * 62.8);
  return dotVal * bottomBoost * twinkle * uParticles;
}

// --- Metallic Cap & Base Shading ---
vec3 shadeMetal(vec3 p, vec3 n, vec3 rd, int finish, vec4 bounds) {
  vec3 ref = reflect(rd, n);
  float fresnel = pow(1.0 - max(dot(-rd, n), 0.0), 4.0);

  // Studio environment light rig (key softbox left, fill right, crisp rim)
  float softboxL = smoothstep(0.25, 0.88, dot(ref, normalize(vec3(-0.78, 0.32, 0.55))));
  float softboxR = smoothstep(0.35, 0.92, dot(ref, normalize(vec3(0.82, 0.18, 0.52))));
  float topLight = smoothstep(0.1, 0.9, ref.y) * 0.35;
  float darkBand = smoothstep(-0.35, 0.25, ref.z);

  // Warm colored bounce light onto cap/base from the glowing glass!
  float distToGlass = min(abs(p.y - bounds.x), abs(p.y - bounds.y));
  float glassBounce = exp(-distToGlass * 11.0) * (0.45 + 0.35 * uBottomGlow);
  vec3 glowColor = mix(uWaxHot, uLiquidColor, 0.35);

  if (finish == 0) {
    // Brushed speckled aluminum silver (Images 2 & 4)
    float grain = hash12(floor(p.xy * 260.0 + p.z * 90.0));
    float brush = hash12(vec2(floor(p.y * 190.0), floor(atan(p.z, p.x) * 28.0)));
    float sparkle = smoothstep(0.84, 0.99, grain) * 0.35;
    vec3 baseCol = vec3(0.66, 0.68, 0.72) * (0.85 + 0.18 * brush);
    float diff = 0.35 + 0.65 * max(dot(n, normalize(vec3(-0.6, 0.45, 0.7))), 0.0);
    float spec = pow(max(dot(ref, normalize(vec3(-0.55, 0.35, 0.75))), 0.0), 18.0) * 0.75;
    vec3 col = baseCol * diff + vec3(0.95, 0.97, 1.0) * (spec + softboxL * 0.38 + softboxR * 0.22 + sparkle);
    col += glowColor * glassBounce * 0.22;
    return col;
  } else if (finish == 1) {
    // Dark brushed chrome / gunmetal (Image 1)
    float brush = hash12(vec2(floor(p.y * 160.0), 1.0)) * 0.07;
    vec3 baseCol = vec3(0.14, 0.13, 0.15) + brush;
    vec3 env = mix(vec3(0.05, 0.05, 0.06), vec3(0.82, 0.80, 0.84), softboxL * 0.92 + softboxR * 0.65 + topLight);
    vec3 col = mix(baseCol, env, 0.48 + 0.45 * fresnel);
    col *= (0.65 + 0.35 * darkBand);
    col += glowColor * glassBounce * 0.45;
    return col;
  } else if (finish == 2) {
    // Polished Rose Copper (Image 3)
    vec3 copperTint = vec3(0.94, 0.68, 0.58);
    vec3 copperDark = vec3(0.32, 0.16, 0.13);
    float sheen = softboxL * 1.15 + softboxR * 0.75 + topLight * 0.6;
    float midGrad = 0.5 + 0.5 * dot(n, normalize(vec3(-0.4, 0.3, 0.85)));
    vec3 col = mix(copperDark, copperTint, smoothstep(0.05, 0.92, midGrad * 0.72 + sheen * 0.55));
    col += vec3(1.0, 0.92, 0.88) * pow(max(dot(ref, normalize(vec3(-0.6, 0.25, 0.75))), 0.0), 28.0) * 0.85;
    col += copperTint * fresnel * 0.25;
    col += glowColor * glassBounce * 0.28;
    return col;
  } else if (finish == 3) {
    // Matte Obsidian / Dark Plum (Images 5, 6, 7)
    vec3 baseCol = vec3(0.055, 0.048, 0.062);
    float diff = max(dot(n, normalize(vec3(-0.4, 0.5, 0.75))), 0.0);
    vec3 col = baseCol * (0.65 + 0.65 * diff) + vec3(0.18, 0.16, 0.2) * fresnel * 0.45;
    col += glowColor * glassBounce * 0.52;
    return col;
  } else {
    // Frosted Translucent Glass Cap/Base
    vec3 baseCol = mix(vec3(0.22, 0.24, 0.3), glowColor, 0.48);
    float rim = pow(1.0 - max(dot(-rd, n), 0.0), 2.5);
    vec3 col = baseCol * (0.45 + 0.55 * (softboxL + softboxR * 0.6)) + vec3(0.95) * rim * 0.48;
    col += glowColor * glassBounce * 0.75;
    return col;
  }
}

// --- Render a Single Lava Lamp Instance ---
// Returns vec4(color, alpha)
vec4 renderLampInstance(vec2 p, int shape, float scale, float timeOffset, vec3 bgBehind) {
  vec2 lp = p / max(scale, 0.1);
  // Subtle tilt rotation
  lp = rot2(uTilt) * lp;

  vec3 ro = vec3(uParallax.x * 0.22, uParallax.y * 0.14, 2.35);
  vec3 rd = normalize(vec3(lp - ro.xy * 0.08, -2.15));

  vec4 bounds = getVesselBounds(shape);

  // --- Mode 4: Pure Borderless Fluid Art ---
  if (shape == 4) {
    float t = 0.0;
    float tMax = 4.5;
    bool hit = false;
    vec3 hitPos = vec3(0.0);
    for (int i = 0; i < 42; i++) {
      vec3 q = ro + rd * t;
      float d = mapWax(q, bounds, timeOffset, true);
      if (d < 0.0025) {
        hit = true;
        hitPos = q;
        break;
      }
      t += max(d, 0.015);
      if (t > tMax) break;
    }

    vec3 bgFluid = mix(bgBehind, uLiquidColor, uLiquidDensity * 0.85);
    float bottomRad = exp(-length(lp - vec2(0.0, -0.58)) * 2.1) * uBottomGlow;
    bgFluid += mix(uWaxHot, uLiquidColor, 0.3) * bottomRad * 0.55;

    // Glitter inside pure fluid
    float g1 = evalGlitter(vec3(lp * 0.65, 0.1), bounds);
    float g2 = evalGlitter(vec3(lp * 0.65 + 0.2, -0.2), bounds);
    bgFluid += mix(uWaxHot, vec3(1.0), 0.55) * (g1 + g2 * 0.6) * 0.9;

    if (!hit) {
      return vec4(bgFluid, uTransparentBg == 1 ? clamp(uLiquidDensity * 0.6 + bottomRad * 0.4, 0.0, 1.0) : 1.0);
    }

    vec3 n = calcWaxNormal(hitPos, bounds, timeOffset, true);
    float fres = pow(1.0 - max(dot(-rd, n), 0.0), 2.2);
    float heat = clamp(1.0 - (hitPos.y + 0.55) * 0.85, 0.0, 1.0);
    vec3 waxCol = mix(uWaxCool, uWaxHot, pow(heat, 0.85));
    float diff = 0.35 + 0.65 * max(dot(n, normalize(vec3(-0.4, -0.55, 0.72))), 0.0);
    float spec = pow(max(dot(reflect(rd, n), normalize(vec3(-0.5, 0.45, 0.74))), 0.0), 26.0);
    vec3 col = waxCol * (diff + uSubsurface * (0.45 + 0.65 * fres)) + uWaxHot * bottomRad * 0.4;
    col += vec3(1.0) * spec * 0.45 * uGlassRefraction;
    return vec4(col, 1.0);
  }

  // --- Standard Vessel Raymarch (Outer Shell) ---
  // Fast bounding check in X/Y to skip empty pixels completely
  float maxPossibleR = 0.27 * uWidthRatio + 0.06;
  if (abs(lp.x) > maxPossibleR * 1.45 || lp.y < bounds.z - 0.15 || lp.y > bounds.w + 0.15) {
    return vec4(0.0);
  }

  float t = 1.6;
  float tMax = 3.2;
  bool hitShell = false;
  vec3 pos = vec3(0.0);

  for (int i = 0; i < 38; i++) {
    pos = ro + rd * t;
    float d = sdVesselOuter(pos, shape);
    if (d < 0.0014) {
      hitShell = true;
      break;
    }
    t += max(d, 0.008);
    if (t > tMax) break;
  }

  if (!hitShell) {
    return vec4(0.0);
  }

  vec3 nOuter = calcVesselNormal(pos, shape);

  // Smoothly determine whether we hit Cap, Base, or Glass Body
  bool isGlass = (pos.y > bounds.x + 0.004 && pos.y < bounds.y - 0.004);

  if (!isGlass) {
    // Metallic Cap or Base
    vec3 metalCol = shadeMetal(pos, nOuter, rd, uMetalFinish, bounds);
    // Subtle dark seam line where glass meets metal
    float seamDist = min(abs(pos.y - bounds.x), abs(pos.y - bounds.y));
    float seamAO = smoothstep(0.0, 0.012, seamDist);
    metalCol *= mix(0.62, 1.0, seamAO);
    return vec4(metalCol, 1.0);
  }

  // --- Inside Glass Body: Refraction, Liquid Absorption, 3D Wax & Glitter ---
  float fresnel = pow(1.0 - max(dot(-rd, nOuter), 0.0), 3.2);
  float glassRim = pow(1.0 - max(dot(-rd, nOuter), 0.0), 1.6);

  // Gently refract ray entering glass cylinder/cone
  vec3 rdIn = normalize(mix(rd, refract(rd, nOuter, 1.0 / (1.0 + 0.28 * uGlassRefraction)), 0.75));

  // March inside the glass volume to find wax intersection and back-wall exit
  float tIn = 0.012;
  float maxIn = 0.56 * uWidthRatio;
  bool hitWax = false;
  vec3 waxPos = vec3(0.0);
  float waxGlowAccum = 0.0;
  float glitterAccum = 0.0;
  float liquidPath = 0.0;

  for (int i = 0; i < 42; i++) {
    vec3 q = pos + rdIn * tIn;
    float rWall = getVesselRadius(clamp(q.y, bounds.x, bounds.y), shape);
    if (length(q.xz) > rWall + 0.006 || q.y < bounds.x - 0.01 || q.y > bounds.y + 0.01) {
      liquidPath = tIn;
      break;
    }

    float dw = mapWax(q, bounds, timeOffset, false);

    // Accumulate soft translucent glow halo around wax inside liquid
    waxGlowAccum += exp(-max(dw, 0.0) * 18.0) * 0.022;

    // Sample glitter particles at sparse steps
    if (uParticles > 0.01 && (i == 4 || i == 11 || i == 19 || i == 27)) {
      glitterAccum += evalGlitter(q, bounds);
    }

    if (dw < 0.0022) {
      hitWax = true;
      waxPos = q;
      liquidPath = tIn;
      break;
    }

    tIn += clamp(dw * 0.72, 0.007, 0.032);
    if (tIn > maxIn) {
      liquidPath = maxIn;
      break;
    }
  }

  // Height normalized from glass bottom (0.0) to glass top (1.0)
  float hNorm = clamp((pos.y - bounds.x) / max(bounds.y - bounds.x, 0.01), 0.0, 1.0);

  // Internal incandescent bulb light radiating from bottom center
  float bulbDist = length(vec2(pos.x, (pos.y - bounds.x) * 1.15));
  float bulbLight = exp(-bulbDist * 3.4) * uBottomGlow;
  float bulbCore = exp(-bulbDist * 9.5) * uBottomGlow;

  // Liquid transmission (Beer-Lambert style)
  float liqAlpha = clamp(uLiquidDensity * (0.55 + 1.45 * liquidPath), 0.0, 0.96);
  vec3 liquidCol = uLiquidColor * (0.62 + 0.55 * (1.0 - hNorm * 0.45));
  // Bottom incandescent lamp illuminates liquid from below
  vec3 bulbTint = mix(uWaxHot, vec3(1.0, 0.96, 0.9), 0.45);
  liquidCol += bulbTint * bulbLight * (0.42 + 0.35 * (1.0 - uLiquidDensity * 0.5));
  // Liquid glows slightly around wax blobs
  liquidCol += mix(uWaxCool, uWaxHot, 0.5) * waxGlowAccum * (0.45 + 0.4 * uSubsurface);

  vec3 interiorColor = mix(bgBehind, liquidCol, liqAlpha);
  // Even in clear liquid (Image 4), glass refracts & catches slight tinted edges
  interiorColor += uLiquidColor * glassRim * (0.18 + 0.35 * uLiquidDensity);

  if (hitWax) {
    vec3 nw = calcWaxNormal(waxPos, bounds, timeOffset, false);
    float waxH = clamp((waxPos.y - bounds.x) / max(bounds.y - bounds.x, 0.01), 0.0, 1.0);

    // Estimate thinness / subsurface transmission by marching one step deeper into wax
    float innerD = mapWax(waxPos + rdIn * 0.045, bounds, timeOffset, false);
    float thinness = smoothstep(-0.045, 0.008, innerD);
    float waxRim = pow(1.0 - max(dot(-rdIn, nw), 0.0), 1.85);

    // Bottom incandescent heat gradient across the wax (Images 1, 3, 5)
    float heatFactor = clamp(pow(1.0 - waxH, 1.35) * (0.65 + 0.55 * uBottomGlow) + bulbCore * 0.55, 0.0, 1.0);
    vec3 baseWax = mix(uWaxCool, uWaxHot, heatFactor);

    // Directional lighting from bottom bulb + studio key light
    vec3 bulbDir = normalize(vec3(0.0, bounds.x - 0.12, 0.08) - waxPos);
    float bulbDiff = max(dot(nw, bulbDir), 0.0);
    float keyDiff = max(dot(nw, normalize(vec3(-0.55, 0.35, 0.78))), 0.0);

    // Subsurface inner luminescence
    float sss = (0.35 + 0.65 * thinness + 0.45 * waxRim) * uSubsurface;
    vec3 waxShaded = baseWax * (0.28 + 0.52 * keyDiff + 0.65 * bulbDiff * (0.5 + 0.5 * uBottomGlow) + sss * 0.78);

    // Hot white/peach glowing core right at the bottom wax pool (Image 1 & 5)
    waxShaded += bulbTint * bulbCore * (0.65 + 0.45 * thinness);

    // Glossy wet wax specular highlight (Images 2 & 4)
    float waxSpec = pow(max(dot(reflect(rdIn, nw), normalize(vec3(-0.52, 0.32, 0.8))), 0.0), 22.0);
    waxShaded += mix(vec3(1.0), uWaxHot, 0.35) * waxSpec * 0.42;

    // Tint the wax subtly by the depth of liquid in front of it
    float frontTint = clamp(uLiquidDensity * liquidPath * 2.1, 0.0, 0.68);
    interiorColor = mix(waxShaded, liquidCol, frontTint * 0.58);
  } else {
    // Add extra luminous core glow at bottom when looking through liquid directly at bulb
    interiorColor += bulbTint * bulbCore * 0.58;
  }

  // Add sparkling suspended glitter / micro-bubbles (Image 6)
  if (glitterAccum > 0.001) {
    vec3 sparkleCol = mix(uWaxHot, vec3(0.95, 0.99, 1.0), 0.55);
    interiorColor += sparkleCol * glitterAccum * 1.15;
  }

  // --- Outer Glass Reflections & Studio Softboxes ---
  vec3 refOut = reflect(rd, nOuter);
  // Crisp vertical left/right studio softbox strips along curved glass
  float stripL = smoothstep(0.62, 0.94, dot(nOuter, normalize(vec3(-0.82, 0.08, 0.56))));
  float stripR = smoothstep(0.76, 0.97, dot(nOuter, normalize(vec3(0.86, 0.05, 0.50))));
  float specSharp = pow(max(dot(refOut, normalize(vec3(-0.72, 0.2, 0.66))), 0.0), 40.0);

  vec3 studioRefTint = uBgStyle == 0 ? vec3(0.96, 0.97, 1.0) : vec3(0.78, 0.82, 0.90);
  vec3 glassReflectCol = mix(studioRefTint, uBgColor + vec3(0.28), 0.2);
  interiorColor += glassReflectCol * (stripL * 0.34 + stripR * 0.24 + specSharp * 0.45) * uGlassRefraction;

  // Bright glass rim edge reflection
  vec3 rimTint = mix(glassReflectCol, uWaxHot, 0.2);
  interiorColor = mix(interiorColor, rimTint, fresnel * 0.44 * uGlassRefraction);

  // Soft shadow lip where cap and base meet the glass
  float seamTop = smoothstep(0.0, 0.025, bounds.y - pos.y);
  float seamBot = smoothstep(0.0, 0.022, pos.y - bounds.x);
  interiorColor *= mix(0.68, 1.0, seamTop);
  // Bright glowing ring right at glass bottom lip
  interiorColor += bulbTint * (1.0 - seamBot) * 0.38 * uBottomGlow;

  return vec4(interiorColor, 1.0);
}

// --- Unified Infinite Studio Cyclorama Backdrop (Light & Dark Modes) ---
vec3 renderBackground(vec2 p, int shape) {
  vec4 bounds = getVesselBounds(shape == 4 ? 0 : shape);
  float baseY = bounds.z * uScale + uOffset.y;
  float coveY = baseY + 0.07;

  // Seamless photographic infinity sweep (wall curving smoothly into floor, zero hard seam)
  float coveCurve = exp(-pow((p.y - coveY) * 2.75, 2.0));
  float floorMask = smoothstep(coveY + 0.38, coveY - 0.52, p.y);
  float wallSoftbox = exp(-length((p - vec2(-0.14, 0.26)) * vec2(0.72, 0.62)) * 1.12);
  float radialVignette = clamp(1.0 - dot(p * vec2(0.72, 0.85), p * vec2(0.72, 0.85)) * 0.16, 0.55, 1.0);

  // uBgColor.r carries luminance tuning (0.0 .. 1.0) for the selected mode
  float lumTune = clamp(uBgColor.r, 0.0, 1.0);
  vec3 col;

  if (uBgStyle == 0) {
    // MODO CLARO: Seamless gallery white / soft platinum infinity studio
    float lift = mix(0.78, 1.04, lumTune);
    vec3 wallTop = vec3(0.955, 0.958, 0.966) * lift;
    vec3 wallKey = vec3(0.995, 0.995, 1.000) * lift;
    vec3 floorTone = vec3(0.905, 0.910, 0.922) * lift;

    col = mix(wallTop, wallKey, wallSoftbox * 0.55);
    col = mix(col, floorTone, floorMask * 0.58);
    // Subtle concave shadow along the curved infinity sweep
    col *= (1.0 - coveCurve * 0.042);
    col *= mix(0.91, 1.0, radialVignette);

    // Subtle colored ambient light spill onto the floor around the lamp
    if (shape != 4) {
      vec2 spillP = (p - vec2(uOffset.x, baseY - 0.02)) * vec2(1.05, 2.8);
      float spill = exp(-dot(spillP, spillP) * 2.4) * (0.045 + 0.03 * uBottomGlow);
      col += mix(uLiquidColor, uWaxHot, 0.45) * spill;
    }
  } else {
    // MODO ESCURO: Seamless obsidian darkroom infinity studio
    float lift = mix(0.35, 1.55, lumTune);
    vec3 darkWall = vec3(0.052, 0.055, 0.068) * lift;
    vec3 darkKey = vec3(0.105, 0.110, 0.132) * lift;
    vec3 darkFloor = vec3(0.038, 0.040, 0.050) * lift;

    col = mix(darkWall, darkKey, wallSoftbox * 0.65);
    col = mix(col, darkFloor, floorMask * 0.62);
    col *= (1.0 - coveCurve * 0.18);
    col *= mix(0.62, 1.0, radialVignette);

    // Soft realistic lamp light spill onto the darkroom infinite sweep & floor
    if (shape != 4) {
      vec2 backSpillP = (p - vec2(uOffset.x, uOffset.y + 0.05)) * vec2(1.1, 0.78);
      float backSpill = exp(-dot(backSpillP, backSpillP) * 2.2) * (0.085 + 0.06 * uBottomGlow);
      vec2 floorSpillP = (p - vec2(uOffset.x, baseY - 0.03)) * vec2(0.95, 3.1);
      float floorSpill = exp(-dot(floorSpillP, floorSpillP) * 2.6) * (0.14 + 0.09 * uBottomGlow);
      vec3 lampSpillCol = mix(uLiquidColor, uWaxHot, 0.52);
      col += lampSpillCol * (backSpill + floorSpill);
    }
  }

  // Grounded Studio Contact Shadow & Soft Wall Projection
  if (uStudioShadow > 0.01 && shape != 4) {
    vec2 sp = (p - uOffset) / max(uScale, 0.1);
    float shadowStrength = uBgStyle == 0 ? 1.0 : 0.65;

    // Soft angled studio wall shadow behind lamp
    vec2 wallP = sp - vec2(0.42, -0.02);
    wallP.x -= (wallP.y - bounds.z) * 0.11;
    if (wallP.y > bounds.z - 0.05 && wallP.y < bounds.w + 0.05) {
      float r = getVesselRadius(clamp(wallP.y, bounds.z, bounds.w), shape) * 1.06;
      float edge = smoothstep(r + 0.09, r - 0.04, abs(wallP.x));
      float vFade = smoothstep(bounds.w + 0.04, bounds.w - 0.09, wallP.y) *
                    smoothstep(bounds.z - 0.04, bounds.z + 0.05, wallP.y);
      float isGlassShadow = smoothstep(bounds.x, bounds.x + 0.06, wallP.y) *
                            smoothstep(bounds.y, bounds.y - 0.06, wallP.y);
      float shadowMask = edge * vFade * uStudioShadow * 0.20 * shadowStrength;
      col = mix(col, col * (0.56 + 0.24 * isGlassShadow) + uLiquidColor * isGlassShadow * 0.05, shadowMask);
    }

    // Crisp ambient-occlusion contact shadow directly under base foot
    vec2 footP = (sp - vec2(0.01, bounds.z - 0.012)) * vec2(1.0, 5.4);
    float contact = exp(-dot(footP, footP) * 10.0) * uStudioShadow * 0.58 * shadowStrength;
    vec2 softFootP = (sp - vec2(0.04, bounds.z - 0.02)) * vec2(0.65, 3.4);
    float softContact = exp(-dot(softFootP, softFootP) * 4.5) * uStudioShadow * 0.22 * shadowStrength;
    col *= (1.0 - clamp(contact + softContact, 0.0, 0.78));
  }

  return max(col, vec3(0.0));
}

void main() {
  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec2 p = (vUv * 2.0 - 1.0) * aspect;

  vec3 bg = renderBackground(p, uVesselShape);
  vec3 finalCol = bg;
  float finalAlpha = uTransparentBg == 1 ? 0.0 : 1.0;

  // Floor Mirror Reflection (Image 7)
  if (uFloorReflection > 0.01 && uVesselShape != 4) {
    vec4 bounds = getVesselBounds(uVesselShape);
    float floorY = bounds.z * uScale + uOffset.y;
    if (p.y < floorY) {
      float distBelow = floorY - p.y;
      vec2 reflP = vec2(p.x, floorY + distBelow * 1.05) - uOffset;
      vec4 reflLamp = renderLampInstance(reflP, uVesselShape, uScale, 0.0, bg);
      float fade = exp(-distBelow * 3.8) * uFloorReflection * 0.65;
      finalCol = mix(finalCol, reflLamp.rgb, reflLamp.a * fade);
      if (uTransparentBg == 1) {
        finalAlpha = max(finalAlpha, reflLamp.a * fade);
      }
    }
  }

  // Secondary Echoed Lamps (Image 5 & experimental multi-lamp trios)
  if (uEchoCount >= 2 && uVesselShape != 4) {
    // Echo 1 (back-left ghost lamp, inspired by Image 5)
    vec2 echoOffset1 = vec2(-uEchoSpread * 0.72, -0.02);
    vec4 echo1 = renderLampInstance(p - uOffset - echoOffset1, uVesselShape, uScale * 0.84, 2.4, bg);
    if (echo1.a > 0.001) {
      vec3 echoCol = echo1.rgb * 0.82;
      finalCol = mix(finalCol, echoCol, echo1.a * uEchoOpacity);
      if (uTransparentBg == 1) finalAlpha = max(finalAlpha, echo1.a * uEchoOpacity);
    }
  }

  if (uEchoCount >= 3 && uVesselShape != 4) {
    // Echo 2 (back-right ghost lamp)
    vec2 echoOffset2 = vec2(uEchoSpread * 0.72, 0.03);
    vec4 echo2 = renderLampInstance(p - uOffset - echoOffset2, uVesselShape, uScale * 0.76, -3.1, bg);
    if (echo2.a > 0.001) {
      vec3 echoCol = echo2.rgb * 0.76;
      finalCol = mix(finalCol, echoCol, echo2.a * uEchoOpacity * 0.88);
      if (uTransparentBg == 1) finalAlpha = max(finalAlpha, echo2.a * uEchoOpacity * 0.88);
    }
  }

  // Primary Hero Lamp
  vec4 hero = renderLampInstance(p - uOffset, uVesselShape, uScale, 0.0, bg);
  if (hero.a > 0.001) {
    finalCol = mix(finalCol, hero.rgb, hero.a);
    if (uTransparentBg == 1) finalAlpha = max(finalAlpha, hero.a);
  }

  fragColor = vec4(max(finalCol, vec3(0.0)), clamp(finalAlpha, 0.0, 1.0));
}
`;

export const POST_FRAG_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSceneTex;
uniform vec2 uResolution;
uniform float uTime;
uniform int uTransparentBg;

// Color & Glow
uniform float uBloom;
uniform float uSaturation;
uniform float uContrast;

// Experimental Distortions
uniform float uWarpAmount;
uniform float uWarpScale;
uniform float uChromatic;
uniform int uSymmetry;       // 0=none, 1=mirrorX, 2=mirrorY, 3=quad, 4=kaleidoscope
uniform float uFlutedGlass;
uniform float uFlutedDensity;
uniform float uSlitScan;
uniform float uFilmGrain;
uniform float uHalftone;
uniform float uPosterize;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec2 applySymmetry(vec2 uv) {
  if (uSymmetry == 1) {
    // Mirror Horizontal
    return vec2(abs(uv.x - 0.5) + 0.5, uv.y);
  } else if (uSymmetry == 2) {
    // Mirror Vertical
    return vec2(uv.x, abs(uv.y - 0.5) + 0.5);
  } else if (uSymmetry == 3) {
    // Quad Mirror
    return vec2(abs(uv.x - 0.5) + 0.5, abs(uv.y - 0.5) + 0.5);
  } else if (uSymmetry == 4) {
    // 6-fold Kaleidoscope
    vec2 c = uv - 0.5;
    float r = length(c);
    float a = atan(c.y, c.x);
    float sector = 3.14159265 / 3.0;
    a = mod(a, sector);
    a = abs(a - sector * 0.5);
    return vec2(cos(a), sin(a)) * r + 0.5;
  }
  return uv;
}

vec2 distortUv(vec2 uv) {
  vec2 p = applySymmetry(uv);

  // 1. Slit-Scan / Horizontal Wave Phase Distortion
  if (uSlitScan > 0.001) {
    float wave = sin(p.y * 16.0 + uTime * 2.1) * 0.6 + sin(p.y * 42.0 - uTime * 1.4) * 0.4;
    float bands = floor(p.y * 70.0) / 70.0;
    float jitter = (hash12(vec2(bands * 120.0, floor(uTime * 3.0))) - 0.5) * 0.5;
    p.x += (wave * 0.065 + jitter * 0.04) * uSlitScan;
  }

  // 2. Liquid Domain Warp
  if (uWarpAmount > 0.001) {
    vec2 wp = p * uWarpScale;
    float t = uTime * 0.45;
    float wx = valueNoise(wp + vec2(t, -t * 0.6)) - 0.5;
    float wy = valueNoise(wp + vec2(-t * 0.7 + 4.3, t * 0.8 + 1.9)) - 0.5;
    float wx2 = valueNoise(wp * 2.0 + vec2(wx * 2.2, wy * 2.2)) - 0.5;
    float wy2 = valueNoise(wp * 2.0 + vec2(wy * 2.2 + 9.1, -wx * 2.2)) - 0.5;
    p += vec2(wx + wx2 * 0.5, wy + wy2 * 0.5) * 0.18 * uWarpAmount;
  }

  // 3. Fluted / Ribbed Optical Glass Refraction
  if (uFlutedGlass > 0.001) {
    float rib = fract(p.x * uFlutedDensity);
    float refractOffset = (rib - 0.5) * 2.0;
    // Cylindrical lens profile per vertical flute
    float bend = sin(refractOffset * 3.14159265) * 0.028 * uFlutedGlass;
    p.x += bend;
  }

  return clamp(p, vec2(0.001), vec2(0.999));
}

vec4 sampleScene(vec2 uv) {
  return texture(uSceneTex, clamp(uv, vec2(0.001), vec2(0.999)));
}

void main() {
  vec2 uv = distortUv(vUv);

  // Chromatic Aberration / Optical Prism Dispersion
  vec4 baseSample = sampleScene(uv);
  vec3 col = baseSample.rgb;
  float alpha = baseSample.a;

  if (uChromatic > 0.001) {
    vec2 fromCenter = uv - 0.5;
    float dist = length(fromCenter);
    vec2 dir = normalize(fromCenter + vec2(0.0001)) * (0.003 + 0.022 * dist) * uChromatic;
    // Add slight horizontal prism component
    dir.x += 0.009 * uChromatic;

    vec4 sR = sampleScene(uv + dir);
    vec4 sG = sampleScene(uv);
    vec4 sB = sampleScene(uv - dir);
    col = vec3(sR.r, sG.g, sB.b);
    alpha = max(alpha, max(sR.a, sB.a));
  }

  // Subtle vertical specular highlight on fluted glass ridges
  if (uFlutedGlass > 0.001) {
    float rib = fract(applySymmetry(vUv).x * uFlutedDensity);
    float ridgeSpec = pow(max(0.0, 1.0 - abs(rib - 0.18) * 6.0), 2.0);
    col += vec3(0.11, 0.12, 0.14) * ridgeSpec * uFlutedGlass * (0.4 + 0.6 * length(col));
  }

  // Dual-radius Optical Bloom
  if (uBloom > 0.005) {
    vec2 texel = 1.0 / max(uResolution, vec2(1.0));
    vec3 bloomAccum = vec3(0.0);
    float weightSum = 0.0;

    const vec2 dirs[8] = vec2[8](
      vec2( 1.0,  0.0), vec2(-1.0,  0.0),
      vec2( 0.0,  1.0), vec2( 0.0, -1.0),
      vec2( 0.707,  0.707), vec2(-0.707,  0.707),
      vec2( 0.707, -0.707), vec2(-0.707, -0.707)
    );

    for (int i = 0; i < 8; i++) {
      vec3 c1 = sampleScene(uv + dirs[i] * texel * 10.0).rgb;
      vec3 c2 = sampleScene(uv + dirs[i] * texel * 26.0).rgb;
      float l1 = dot(c1, vec3(0.299, 0.587, 0.114));
      float l2 = dot(c2, vec3(0.299, 0.587, 0.114));
      bloomAccum += c1 * smoothstep(0.32, 1.05, l1) * 1.1;
      bloomAccum += c2 * smoothstep(0.38, 1.1, l2) * 0.8;
      weightSum += 1.9;
    }
    bloomAccum /= weightSum;
    col += bloomAccum * uBloom * 1.35;
    if (uTransparentBg == 1) {
      alpha = max(alpha, clamp(length(bloomAccum) * uBloom * 0.9, 0.0, 1.0));
    }
  }

  // Contrast & Saturation Grading
  col = (col - 0.5) * uContrast + 0.5;
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, uSaturation);
  col = max(col, vec3(0.0));

  // Soft Filmic Highlight Compression (keeps incandescent cores luminous, never ugly flat clip)
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);

  // Posterization / Graphic Print Quantization
  if (uPosterize > 0.005) {
    float levels = mix(18.0, 3.2, uPosterize);
    vec3 posterCol = floor(col * levels + 0.5) / levels;
    col = mix(col, posterCol, clamp(uPosterize * 1.25, 0.0, 1.0));
  }

  // Editorial Halftone Print Dot Matrix
  if (uHalftone > 0.005) {
    float dotScale = min(uResolution.x, uResolution.y) / 105.0;
    float angle = 0.5236; // 30 deg print angle
    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 grid = fract(rot * (gl_FragCoord.xy / max(dotScale, 3.0))) - 0.5;
    float d = length(grid);
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    float radius = sqrt(clamp(lum, 0.0, 1.0)) * 0.58;
    float mask = smoothstep(radius + 0.07, radius - 0.07, d);
    vec3 htCol = mix(col * 0.14, col * 1.28, mask);
    col = mix(col, htCol, uHalftone * 0.85);
  }

  // Analog Film Grain
  if (uFilmGrain > 0.005) {
    float grain = hash12(gl_FragCoord.xy + fract(uTime * 17.3) * 1000.0) - 0.5;
    col += grain * 0.14 * uFilmGrain;
  }

  fragColor = vec4(clamp(col, 0.0, 1.0), uTransparentBg == 1 ? clamp(alpha, 0.0, 1.0) : 1.0);
}
`;
