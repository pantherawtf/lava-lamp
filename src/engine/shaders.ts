export const FULLSCREEN_VERT_SHADER = `#version 300 es
precision highp float;

out vec2 vUv;

void main() {
  vec2 pos = vec2(
    (gl_VertexID == 1) ? 3.0 : -1.0,
    (gl_VertexID == 2) ? 3.0 : -1.0
  );
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
uniform vec2 uParallax;
uniform int uTransparentBg;

// Vessel & Composition
uniform int uVesselShape;   // 0: astro, 1: capsule, 2: bullet, 3: organic, 4: fluid
uniform int uMetalFinish;   // 0: brushedSilver, 1: darkChrome, 2: roseCopper, 3: matteObsidian, 4: frostedGlass
uniform float uScale;
uniform float uWidthRatio;
uniform float uTilt;
uniform vec2 uOffset;
uniform float uFloorReflection;
uniform float uStudioShadow;

// Fluid & Wax
uniform int uBlobCount;
uniform vec4 uBlobs[9];
uniform float uViscosity;
uniform float uTurbulence;
uniform float uParticles;
uniform float uGlassRefraction;

// Colors & Lighting
uniform vec3 uWaxHot;
uniform vec3 uWaxCool;
uniform vec3 uLiquidColor;
uniform float uLiquidDensity;
uniform int uBgMode;        // 0: light, 1: dark
uniform float uBgLuminance;
uniform float uBottomGlow;
uniform float uSubsurface;
uniform float uBloom;
uniform float uSaturation;
uniform float uContrast;
uniform float uFilmGrain;
uniform vec4 uShakeGlitter; // x: intensity, y: fallDistance, z: clearFront (0..1.15), w: swirlPhase

const float PI = 3.14159265;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

// Smoothly interpolated 2D value noise for Moire-free brushed metal grain
float valueNoise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fast 3D gyroid turbulence (single evaluation, zero 3D lattice hashes)
float fastGyroid(vec3 p) {
  return dot(sin(p), cos(p.yzx));
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / max(k, 0.0001), 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float smax(float a, float b, float k) {
  return -smin(-a, -b, k);
}

mat2 rot2(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

// Analytical infinite cylinder intersection in XZ for instant background ray skipping
vec2 intersectBoundingCylinder(vec3 ro, vec3 rd, float r) {
  float a = dot(rd.xz, rd.xz);
  float b = dot(ro.xz, rd.xz);
  float c = dot(ro.xz, ro.xz) - r * r;
  float disc = b * b - a * c;
  if (disc < 0.0 || a < 1e-6) return vec2(1e5, -1e5);
  float sq = sqrt(disc);
  return vec2((-b - sq) / a, (-b + sq) / a);
}

// Vessel outer radius profile R(y) in normalized lamp coordinates y in [-0.90, 0.90]
// Glass spans approximately y in [-0.34, 0.62] depending on shape
float vesselGlassYMin(int shape) {
  if (shape == 0) return -0.26; // astro
  if (shape == 1) return -0.34; // capsule
  if (shape == 2) return -0.24; // bullet
  if (shape == 3) return -0.30; // organic
  return -0.70;                 // fluid
}

float vesselGlassYMax(int shape) {
  if (shape == 0) return 0.56;  // astro
  if (shape == 1) return 0.62;  // capsule
  if (shape == 2) return 0.56;  // bullet
  if (shape == 3) return 0.56;  // organic
  return 0.70;                  // fluid
}

// C1-smooth vessel profiles with subtle machined fillets at waist & collar transitions
float vesselRadius(int shape, float y) {
  float w = uWidthRatio;
  if (shape == 0) {
    // Classic Mathmos Astro with subtle machined fillets at waist (-0.58) & collars (-0.26, 0.56)
    float rFoot = 0.245 + (y + 0.90) * ((0.115 - 0.245) / 0.32);
    float rUpperBase = 0.115 + (y + 0.58) * ((0.255 - 0.115) / 0.32);
    float rBase = smax(rFoot, rUpperBase, 0.013);

    float tG = clamp((y + 0.26) / 0.82, 0.0, 1.0);
    float belly = sin(clamp(tG * 4.2, 0.0, PI)) * 0.018 * (1.0 - tG);
    float rGlass = mix(0.255, 0.128, pow(max(tG, 1e-5), 0.94)) + belly;

    float tC = clamp((y - 0.56) / 0.32, 0.0, 1.0);
    float rCap = mix(0.128, 0.078, tC);

    float m1 = smoothstep(-0.274, -0.246, y);
    float m2 = smoothstep(0.548, 0.572, y);
    float r = mix(mix(rBase, rGlass, m1), rCap, m2);

    // Subtle recessed machined seam grooves at glass/metal collars
    float groove = exp(-pow((y + 0.26) / 0.005, 2.0)) * 0.0016
                 + exp(-pow((y - 0.56) / 0.0045, 2.0)) * 0.0014;
    return max(0.02, r - groove) * w;
  } else if (shape == 1) {
    // Modern Cylindrical Capsule with smooth plinth bevels & dome join
    float rPlinth = 0.242;
    float rNeck = 0.172;
    float tCup = clamp((y + 0.76) / 0.12, 0.0, 1.0);
    float rCup = mix(0.176, 0.228, sin(tCup * PI * 0.5));
    float rGlass = 0.226;
    float tDome = clamp((y - 0.70) / 0.18, 0.0, 0.998);
    float rDome = 0.228 * sqrt(max(0.0004, 1.0 - tDome * tDome));

    float mPlinth = smoothstep(-0.848, -0.832, y);
    float mCup = smoothstep(-0.768, -0.752, y);
    float mGlass = smoothstep(-0.352, -0.328, y);
    float mDome = smoothstep(0.610, 0.630, y);

    float r = mix(rPlinth, rNeck, mPlinth);
    r = mix(r, rCup, mCup);
    r = mix(r, rGlass, mGlass);
    r = mix(r, rDome, mDome);

    float groove = exp(-pow((y + 0.34) / 0.005, 2.0)) * 0.0015
                 + exp(-pow((y - 0.62) / 0.0045, 2.0)) * 0.0014;
    return max(0.01, r - groove) * w;
  } else if (shape == 2) {
    // Sleek Tall Rose-Copper Bullet with smooth chalice & nose transitions
    float tSaucer = clamp((y + 0.90) / 0.12, 0.0, 1.0);
    float rSaucer = mix(0.255, 0.088, pow(max(tSaucer, 1e-5), 0.68));

    float tChalice = clamp((y + 0.78) / 0.54, 0.0, 1.0);
    float rChalice = mix(0.09, 0.188, pow(max(tChalice, 1e-5), 0.88)) + sin(tChalice * PI) * 0.012;

    float tSpindle = clamp((y + 0.24) / 0.80, 0.0, 1.0);
    float rSpindle = mix(0.188, 0.118, pow(max(tSpindle, 1e-5), 1.1)) + sin(pow(max(tSpindle, 1e-5), 0.74) * PI) * 0.038;

    float tNose = clamp((y - 0.56) / 0.34, 0.0, 0.998);
    float rNose = 0.118 * pow(max(0.0004, 1.0 - tNose), 0.62);

    float m1 = smoothstep(-0.794, -0.766, y);
    float m2 = smoothstep(-0.254, -0.226, y);
    float m3 = smoothstep(0.548, 0.572, y);

    float r = mix(rSaucer, rChalice, m1);
    r = mix(r, rSpindle, m2);
    r = mix(r, rNose, m3);

    float groove = exp(-pow((y + 0.24) / 0.005, 2.0)) * 0.0014
                 + exp(-pow((y - 0.56) / 0.0045, 2.0)) * 0.0013;
    return max(0.006, r - groove) * w;
  } else {
    // Organic Sculpted Ampoule (shape == 3)
    float tBase = clamp((y + 0.88) / 0.58, 0.0, 1.0);
    float rBase = mix(0.24, 0.18, tBase) - sin(tBase * PI) * 0.095;

    float tBody = clamp((y + 0.30) / 0.86, 0.0, 1.0);
    float rBody = mix(0.18, 0.118, tBody) + sin(pow(max(tBody, 1e-5), 0.7) * PI) * 0.085;

    float tCap = clamp((y - 0.56) / 0.30, 0.0, 0.996);
    float rCap = 0.118 * pow(max(0.0004, cos(tCap * PI * 0.5)), 0.72);

    float m1 = smoothstep(-0.314, -0.286, y);
    float m2 = smoothstep(0.548, 0.572, y);
    float r = mix(mix(rBase, rBody, m1), rCap, m2);

    float groove = exp(-pow((y + 0.30) / 0.005, 2.0)) * 0.0014
                 + exp(-pow((y - 0.56) / 0.0045, 2.0)) * 0.0013;
    return max(0.008, r - groove) * w;
  }
}

#ifndef LITE
// Exact slope-corrected Euclidean SDF to outer lamp body with subtle top/bottom micro-chamfers
float mapLampOuterDist(vec3 p) {
  if (uVesselShape == 4) {
    return 1e4;
  }
  float yBottom = -0.90;
  float yTop = (uVesselShape == 2) ? 0.90 : 0.88;
  float bevelBot = 0.0075;
  float bevelTop = (uVesselShape == 0) ? 0.0075 : 0.0028;

  float yc = clamp(p.y, yBottom + bevelBot, yTop - bevelTop);
  float r = vesselRadius(uVesselShape, yc);

  // Slope correction converts radial difference into true Euclidean cone/curve distance
  float epsY = 0.0025;
  float yHi = min(yTop - 0.001, yc + epsY);
  float yLo = max(yBottom + 0.001, yc - epsY);
  float drdy = clamp((vesselRadius(uVesselShape, yHi) - vesselRadius(uVesselShape, yLo)) / max(0.0005, yHi - yLo), -2.2, 2.2);
  float invSlope = inversesqrt(1.0 + drdy * drdy);

  float bevel = (p.y < 0.0) ? min(bevelBot, r * 0.45) : min(bevelTop, max(0.0008, r * 0.45));
  float dRad = (length(p.xz) - r) * invSlope + bevel;
  float dBot = (yBottom + bevelBot) - p.y;
  float dTop = p.y - (yTop - bevelTop);
  float dCap = max(dBot, dTop);

  vec2 q = vec2(dRad, dCap);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - bevel;
}

// Signed distance to internal molten wax metaballs (unchanged per user preference)
float mapWax(vec3 p) {
  float gMin = vesselGlassYMin(uVesselShape);
  float gMax = vesselGlassYMax(uVesselShape);
  float gSpan = gMax - gMin;
  float w = uWidthRatio;
  float k = max(0.025, uViscosity * 0.56);

  float d = 1e4;
  for (int i = 0; i < 9; i++) {
    if (i >= uBlobCount) break;
    vec4 b = uBlobs[i];
    if (b.w <= 0.001) continue;

    // Map physics y in [-0.46, 0.46] to vessel glass interior
    float yNorm = clamp((b.y + 0.46) / 0.92, 0.0, 1.0);
    float by = gMin + 0.06 + yNorm * (gSpan - 0.12);
    float br = b.w * (uVesselShape == 4 ? 1.55 : 1.18) * sqrt(w);
    float wallR = (uVesselShape == 4) ? 0.45 * w : max(0.05, vesselRadius(uVesselShape, by) - 0.022);
    br = min(br, wallR * 0.78);

    float maxCenter = max(0.01, wallR - br * 0.72);
    vec2 bxz = b.xz * (uVesselShape == 4 ? 1.45 : 0.95 * w);
    float distXZ = length(bxz);
    if (distXZ > maxCenter) {
      bxz *= maxCenter / distXZ;
    }

    vec3 q = p - vec3(bxz.x, by, bxz.y);
    // Gentle teardrop vertical stretch
    q.y *= 0.86;
    float sd = length(q) - br;
    d = smin(d, sd, k);
  }

  // Heated molten wax pool resting on bottom bulb (for physical vessels)
  if (uVesselShape != 4) {
    float poolR = vesselRadius(uVesselShape, gMin + 0.02) * 0.84;
    vec3 qp = p - vec3(sin(uTime * 0.55) * 0.02, gMin + 0.014, cos(uTime * 0.48) * 0.02);
    qp.y *= 2.45;
    float dPool = length(qp) - poolR;
    d = smin(d, dPool, k * 0.85);
  }

  // Fast organic surface turbulence
  if (uTurbulence > 0.002) {
    float g = fastGyroid(p * 11.5 + vec3(0.0, -uTime * 1.1, uTime * 0.45));
    d += g * uTurbulence * 0.026;
  }

  // Strict interior confinement so wax never pokes outside the glass wall
  if (uVesselShape != 4) {
    float innerWall = vesselRadius(uVesselShape, clamp(p.y, gMin, gMax)) - 0.016;
    float dWall = length(p.xz) - innerWall;
    float dCaps = max((gMin + 0.008) - p.y, p.y - (gMax - 0.022));
    d = max(d, max(dWall, dCaps));
  }

  return d;
}

// High-precision adaptive 4-tap tetrahedron normal for outer shell
vec3 calcOuterNormal(vec3 p, float pxSize) {
  float h = clamp(pxSize * 0.35, 0.00055, 0.0016);
  vec2 e = vec2(h, -h);
  return normalize(
    e.xyy * mapLampOuterDist(p + e.xyy) +
    e.yyx * mapLampOuterDist(p + e.yyx) +
    e.yxy * mapLampOuterDist(p + e.yxy) +
    e.xxx * mapLampOuterDist(p + e.xxx)
  );
}

// 4-tap tetrahedron normal for wax metaballs
vec3 calcWaxNormal(vec3 p) {
  const vec2 e = vec2(0.003, -0.003);
  return normalize(
    e.xyy * mapWax(p + e.xyy) +
    e.yyx * mapWax(p + e.yyx) +
    e.yxy * mapWax(p + e.yxy) +
    e.xxx * mapWax(p + e.xxx)
  );
}

#endif

// Studio environment reflection color (softbox strips + cool/warm studio sweep)
vec3 sampleStudioEnv(vec3 refDir, float isDark) {
  float up = refDir.y * 0.5 + 0.5;
  vec3 baseEnv = isDark > 0.5
    ? mix(vec3(0.04, 0.045, 0.06), vec3(0.20, 0.22, 0.28), up)
    : mix(vec3(0.58, 0.60, 0.64), vec3(0.95, 0.96, 0.99), up);

  // Two crisp vertical studio softbox strips
  vec2 xzDir = normalize(refDir.xz + vec2(1e-5, 0.0));
  float stripL = smoothstep(0.76, 0.96, dot(xzDir, normalize(vec2(-0.78, 0.62))))
               * smoothstep(0.92, 0.15, abs(refDir.y));
  float stripR = smoothstep(0.80, 0.97, dot(xzDir, normalize(vec2(0.82, 0.57))))
               * smoothstep(0.88, 0.12, abs(refDir.y));
  float topBox = smoothstep(0.78, 0.96, refDir.y);

  float boost = isDark > 0.5 ? 1.05 : 0.85;
  baseEnv += vec3(1.0, 0.99, 0.98) * stripL * 1.15 * boost;
  baseEnv += vec3(1.0, 0.96, 0.92) * stripR * 0.88 * boost;
  baseEnv += vec3(0.95, 0.97, 1.0) * topBox * 0.55;
  return baseEnv;
}

// Infinite seamless studio cyclorama backdrop (Light & Dark modes)
vec3 renderStudioBackground(vec2 uv, vec2 pScreen) {
  float isDark = float(uBgMode);
  float lum = clamp(uBgLuminance, 0.0, 1.0);

  vec3 col;
  if (isDark > 0.5) {
    vec3 topC = vec3(0.032, 0.034, 0.046) + lum * vec3(0.06, 0.065, 0.085);
    vec3 midC = vec3(0.055, 0.058, 0.075) + lum * vec3(0.085, 0.09, 0.115);
    vec3 floorC = vec3(0.025, 0.026, 0.034) + lum * vec3(0.05, 0.052, 0.068);
    float horizon = smoothstep(0.18, 0.52, uv.y);
    col = mix(floorC, mix(midC, topC, smoothstep(0.45, 1.0, uv.y)), horizon);
  } else {
    vec3 topC = vec3(0.82, 0.835, 0.865) + (lum - 0.5) * 0.22;
    vec3 midC = vec3(0.915, 0.922, 0.942) + (lum - 0.5) * 0.18;
    vec3 floorC = vec3(0.855, 0.865, 0.892) + (lum - 0.5) * 0.20;
    float horizon = smoothstep(0.14, 0.46, uv.y);
    col = mix(floorC, mix(midC, topC, smoothstep(0.45, 1.0, uv.y)), horizon);
  }

  // Subtle architectural studio vignette
  float vig = 1.0 - dot(pScreen * vec2(0.32, 0.26), pScreen * vec2(0.32, 0.26));
  col *= clamp(0.84 + 0.18 * vig, 0.72, 1.06);

  // Grounded studio shadow & colored floor glow beneath the lamp foot
  if (uVesselShape != 4) {
    vec2 lampFootScreen = vec2(uOffset.x, uOffset.y - 0.62 * uScale);
    vec2 dFoot = (pScreen - lampFootScreen) / max(0.12, uScale);

    // Tight elliptical contact shadow directly under base
    float contactR = length(vec2(dFoot.x / (0.28 * uWidthRatio), dFoot.y / 0.055));
    float contact = exp(-contactR * contactR * 1.45);

    // Soft cast shadow falling subtly to the right
    vec2 castOff = dFoot - vec2(0.16, -0.01);
    float castR = length(vec2(castOff.x / (0.48 * uWidthRatio), castOff.y / 0.085));
    float castSh = exp(-castR * castR * 1.35) * 0.48;

    float shadowAmt = clamp((contact + castSh) * uStudioShadow * (isDark > 0.5 ? 0.72 : 0.34), 0.0, 0.85);
    col *= (1.0 - shadowAmt);

    // Subtle colored studio floor reflection / bounce glow
    float glowR = length(vec2(dFoot.x / (0.45 * uWidthRatio), (dFoot.y + 0.04) / 0.14));
    float glowPool = exp(-glowR * glowR * 1.25) * uFloorReflection * min(1.3, uBottomGlow);
    vec3 bounceCol = mix(uWaxHot, uLiquidColor, 0.35);
    col += bounceCol * glowPool * (isDark > 0.5 ? 0.32 : 0.12);
  }

  return max(col, vec3(0.0));
}

// Shade metallic / frosted base and cap with analytic pixel-footprint filtering (zero Moire)
vec3 shadeMetal(vec3 p, vec3 n, vec3 rd, float isDark, float pxSize) {
  vec3 viewDir = -rd;
  vec3 refDir = reflect(rd, n);
  vec3 env = sampleStudioEnv(refDir, isDark);

  vec3 keyDir = normalize(vec3(0.65, 0.55, 0.52));
  vec3 rimDir = normalize(vec3(-0.72, 0.35, -0.58));
  float ndotl = max(dot(n, keyDir), 0.0);
  float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 4.0);

  // Seamless angular coordinate for lathe-spun anisotropic brushing
  float angle = atan(p.z, p.x);
  // Analytic frequency attenuation prevents pixel shimmer and Moire at every zoom level
  float filterCoarse = exp(-pow(pxSize * 78.0, 2.0));
  float filterFine = exp(-pow(pxSize * 155.0, 2.0));

  vec3 albedo = vec3(0.80, 0.82, 0.86);
  float metalness = 0.90;
  float rough = 0.25;

  if (uMetalFinish == 0) {
    // Satin lathe-spun brushed aluminum (Mathmos Astro) — smooth, filtered, Moire-free
    float brushed1 = valueNoise2(vec2(angle * 7.5, p.y * 105.0)) - 0.5;
    float brushed2 = valueNoise2(vec2(angle * 19.0 + 3.7, p.y * 210.0)) - 0.5;
    float fineRings = sin(p.y * 190.0) * 0.018 * filterFine;
    float grain = brushed1 * 0.065 * filterCoarse + brushed2 * 0.038 * filterFine + fineRings;

    albedo = vec3(0.77, 0.79, 0.83) + grain;
    metalness = 0.87;
    rough = clamp(0.28 + brushed1 * 0.06 * filterCoarse, 0.20, 0.42);
  } else if (uMetalFinish == 1) {
    // Dark gunmetal chrome
    float brush = (valueNoise2(vec2(angle * 6.0, p.y * 135.0)) - 0.5) * 0.024 * filterCoarse
                + sin(p.y * 220.0) * 0.008 * filterFine;
    albedo = vec3(0.24, 0.25, 0.29) + brush;
    metalness = 0.96;
    rough = 0.14;
  } else if (uMetalFinish == 2) {
    // Polished rose copper
    float brush = (valueNoise2(vec2(angle * 6.0, p.y * 130.0)) - 0.5) * 0.022 * filterCoarse
                + sin(p.y * 210.0) * 0.007 * filterFine;
    albedo = vec3(0.92, 0.64, 0.54) + brush;
    metalness = 0.95;
    rough = 0.13;
  } else if (uMetalFinish == 3) {
    // Matte obsidian anodized
    float micro = (valueNoise2(vec2(angle * 14.0, p.y * 90.0)) - 0.5) * 0.012 * filterCoarse;
    albedo = vec3(0.11, 0.11, 0.13) + micro;
    metalness = 0.25;
    rough = 0.58;
  } else {
    // Frosted quartz glass
    albedo = vec3(0.84, 0.87, 0.93);
    metalness = 0.10;
    rough = 0.32;
  }

  vec3 halfV = normalize(keyDir + viewDir);
  float specPow = mix(92.0, 14.0, rough);
  float spec = pow(max(dot(n, halfV), 0.0), specPow) * (1.25 - rough);
  float rimSpec = pow(max(dot(n, normalize(rimDir + viewDir)), 0.0), 24.0) * 0.55;

  vec3 diff = albedo * (1.0 - metalness * 0.82) * (0.35 + 0.75 * ndotl);
  vec3 refl = env * mix(vec3(0.08), albedo, metalness) * (0.65 + 0.65 * (1.0 - rough));
  vec3 col = diff + refl + vec3(1.0, 0.98, 0.95) * (spec + rimSpec) * mix(vec3(1.0), albedo, metalness * 0.55);
  col += env * fresnel * 0.28;

  // Subtle colored bounce from internal bulb onto lower collar & cap rim
  float gMin = vesselGlassYMin(uVesselShape);
  float gMax = vesselGlassYMax(uVesselShape);
  float nearGlass = exp(-abs(p.y - gMin) * 14.0) + exp(-abs(p.y - gMax) * 18.0) * 0.45;
  col += mix(uWaxHot, uLiquidColor, 0.3) * nearGlass * uBottomGlow * 0.24;

  // Pixel-aware smooth seam groove darkening at glass collars & Astro waist
  float seamW = max(0.0075, pxSize * 1.4);
  float seam = smoothstep(seamW, 0.0, abs(p.y - gMin)) * 0.78
             + smoothstep(seamW * 0.9, 0.0, abs(p.y - gMax)) * 0.72;
  if (uVesselShape == 0) {
    seam += smoothstep(max(0.010, pxSize * 1.6), 0.0, abs(p.y + 0.58)) * 0.38;
  }
  col *= (1.0 - clamp(seam, 0.0, 0.58));

  return col;
}

// Fast suspended microbubbles & glitter sparkle inside glass chamber
float evalMicroParticles(vec3 p, vec3 rd, float gMin, float gMax) {
  if (uParticles < 0.01) return 0.0;
  float sparkle = 0.0;
  // Two lightweight drifting 3D voxel-grid particle layers
  for (int layer = 0; layer < 2; layer++) {
    float freq = (layer == 0) ? 24.0 : 38.0;
    float spd = (layer == 0) ? 0.14 : 0.22;
    vec3 q = p * freq + vec3(float(layer) * 7.3, -uTime * spd * freq * 0.15, float(layer) * 3.1);
    vec3 cell = floor(q);
    vec3 f = fract(q) - 0.5;
    float rnd = hash31(cell);
    float threshold = 1.0 - uParticles * (layer == 0 ? 0.16 : 0.24);
    if (rnd > threshold) {
      vec3 jitter = vec3(
        fract(rnd * 17.3) - 0.5,
        fract(rnd * 31.7) - 0.5,
        fract(rnd * 53.1) - 0.5
      ) * 0.58;
      float d = length(f - jitter);
      float twinkle = 0.6 + 0.4 * sin(uTime * 3.2 + rnd * 60.0);
      sparkle += smoothstep(0.16, 0.02, d) * twinkle;
    }
  }
  float verticalFade = smoothstep(gMin, gMin + 0.08, p.y) * smoothstep(gMax, gMax - 0.06, p.y);
  return sparkle * verticalFade * (0.55 + uParticles * 0.65);
}

// Falling mobile-shake volumetric glitter strictly inside the glass chamber (vanishes top-to-bottom)
float evalShakeGlitter(vec3 p, float gMin, float gMax) {
  if (uShakeGlitter.x < 0.005) return 0.0;

  float heightT = clamp((p.y - gMin) / max(0.001, gMax - gMin), 0.0, 1.0);
  // Descending clearing curtain sweeps from top (1.0) down to bottom (0.0)
  float topCutoff = 1.08 - uShakeGlitter.z * 1.28;
  float topToBottomMask = smoothstep(topCutoff + 0.16, topCutoff - 0.18, heightT);
  float bottomFade = smoothstep(0.0, 0.075, heightT);
  float envelope = uShakeGlitter.x * topToBottomMask * bottomFade;
  if (envelope < 0.004) return 0.0;

  float fallY = uShakeGlitter.y;
  float swirl = uShakeGlitter.w;
  float sparkle = 0.0;

  // Three dense falling 3D glitter layers drifting downward (+fallY in sample space = downward motion)
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer);
    float freq = (layer == 0) ? 20.0 : (layer == 1 ? 33.0 : 48.0);
    float fallMul = (layer == 0) ? 0.82 : (layer == 1 ? 1.08 : 1.36);
    float flutterX = sin(uTime * (1.8 + fl * 0.6) + p.y * (9.0 + fl * 3.0) + swirl + fl * 2.1) * 0.022;
    float flutterZ = cos(uTime * (1.5 + fl * 0.5) + p.y * (8.0 + fl * 2.5) - swirl + fl * 1.7) * 0.022;

    vec3 sampleP = vec3(p.x + flutterX, p.y + fallY * fallMul, p.z + flutterZ);
    vec3 q = sampleP * freq + vec3(fl * 11.7, fl * 5.3, fl * 19.1);
    vec3 cell = floor(q);
    vec3 f = fract(q) - 0.5;
    float rnd = hash31(cell);

    float threshold = 1.0 - clamp(0.24 + uShakeGlitter.x * 0.28, 0.15, 0.56);
    if (rnd > threshold) {
      vec3 jitter = vec3(
        fract(rnd * 19.7) - 0.5,
        fract(rnd * 37.3) - 0.5,
        fract(rnd * 61.9) - 0.5
      ) * 0.62;
      float d = length(f - jitter);
      float twinkle = 0.45 + 0.55 * sin(uTime * (6.0 + fl * 2.5) + rnd * 85.0 + swirl * 2.0);
      float size = (layer == 0) ? 0.21 : (layer == 1 ? 0.17 : 0.14);
      sparkle += smoothstep(size, 0.015, d) * twinkle * (layer == 0 ? 1.25 : 0.95);
    }
  }

  return sparkle * envelope;
}

#ifndef LITE
// Shade borosilicate glass chamber & internal wax (wax tracing preserved verbatim)
vec3 shadeGlassVessel(
  vec3 pOut,
  vec3 nOut,
  vec3 rdL,
  vec2 uv,
  vec2 pScreen,
  float boundR,
  float isDark,
  float pxSize
) {
  float gMin = vesselGlassYMin(uVesselShape);
  float gMax = vesselGlassYMax(uVesselShape);
  float gSpan = gMax - gMin;

  float ior = mix(1.04, 1.24, uGlassRefraction);
  vec3 rdIn = refract(rdL, nOut, 1.0 / ior);
  if (length(rdIn) < 0.01) rdIn = rdL;
  vec3 roIn = pOut + rdIn * 0.008;

  // Trace wax metaballs & gather subtle microbubbles inside chamber
  float tIn = 0.0;
  bool hitWax = false;
  float maxInDist = boundR * 2.1;
  float particleAcc = 0.0;
  float shakeGlitterAcc = 0.0;

  for (int j = 0; j < 34; j++) {
    vec3 pIn = roIn + rdIn * tIn;
    if (pIn.y < gMin - 0.02 || pIn.y > gMax + 0.02 || tIn > maxInDist) break;

    float wallR = vesselRadius(uVesselShape, clamp(pIn.y, gMin, gMax));
    if (length(pIn.xz) > wallR + 0.018 && tIn > 0.03) break;

    float dW = mapWax(pIn);
    if (dW < 0.0025) {
      hitWax = true;
      break;
    }

    if (uParticles > 0.01 && j < 18 && (j & 1) == 0) {
      particleAcc += evalMicroParticles(pIn, rdIn, gMin, gMax) * 0.28;
    }

    if (uShakeGlitter.x > 0.005 && j < 26 && (j & 1) == 0) {
      shakeGlitterAcc += evalShakeGlitter(pIn, gMin, gMax) * 0.42;
    }

    tIn += clamp(dW * 0.82, 0.009, 0.045);
  }

  // Refracted background behind the glass
  vec2 refrUv = uv + nOut.xy * (0.045 * uGlassRefraction);
  vec2 refrScreen = pScreen + nOut.xy * (0.065 * uGlassRefraction);
  vec3 behindCol = (uTransparentBg == 1)
    ? mix(uLiquidColor * 0.25, vec3(0.08), 0.3)
    : renderStudioBackground(clamp(refrUv, 0.0, 1.0), refrScreen);

  float heightT = clamp((pOut.y - gMin) / gSpan, 0.0, 1.0);
  float ndotv = clamp(abs(dot(nOut, -rdL)), 0.0, 1.0);
  float fresnel = pow(1.0 - ndotv, 3.4);

  // Beer-Lambert optical liquid tint
  float pathDepth = mix(0.65, 1.65, 1.0 - ndotv);
  float liqStrength = clamp(uLiquidDensity * pathDepth, 0.0, 1.45);
  vec3 transmittance = exp(-max(vec3(0.04), (1.0 - uLiquidColor) * 2.45 + 0.22) * liqStrength * 1.15);
  vec3 liquidBase = behindCol * transmittance + uLiquidColor * (1.0 - transmittance) * (0.58 + 0.28 * (1.0 - heightT));

  // Warm upward heater bulb glow inside lower liquid
  float bulbHeat = pow(clamp(1.0 - heightT, 0.0, 1.0), 2.55) * uBottomGlow;
  vec3 hotCoreCol = mix(uWaxHot, vec3(1.0, 0.95, 0.94), 0.42);
  liquidBase += hotCoreCol * bulbHeat * (0.42 + 0.24 * ndotv);

  vec3 interiorCol = liquidBase;

  if (hitWax) {
    vec3 pWax = roIn + rdIn * tIn;
    vec3 nWax = calcWaxNormal(pWax);
    float wHeight = clamp((pWax.y - gMin) / gSpan, 0.0, 1.0);

    vec3 waxAlbedo = mix(uWaxHot, uWaxCool, smoothstep(0.06, 0.84, wHeight));
    vec3 keyDir = normalize(vec3(0.55, 0.62, 0.56));
    float diff = max(dot(nWax, keyDir), 0.0);
    float wNdotV = clamp(abs(dot(nWax, -rdIn)), 0.0, 1.0);
    float bottomUp = clamp(-nWax.y * 0.55 + 0.5, 0.0, 1.0);

    // Backlit translucent molten wax shading
    float coreGlow = mix(0.32, 1.0, pow(wNdotV, 1.15)) * uSubsurface;
    float baseIncandescence = pow(clamp(1.0 - wHeight, 0.0, 1.0), 2.4) * uBottomGlow;

    vec3 waxLit = waxAlbedo * (0.34 + 0.62 * diff + coreGlow * 0.72)
                + hotCoreCol * baseIncandescence * (0.48 + 0.55 * bottomUp);

    // Subtle glossy wax highlight
    float wSpec = pow(max(dot(nWax, normalize(keyDir - rdIn)), 0.0), 34.0);
    waxLit += vec3(1.0, 0.97, 0.95) * wSpec * 0.22;

    // Attenuate wax gently by liquid in front of it (tIn)
    float frontLiquid = clamp(tIn * 2.2 * uLiquidDensity, 0.0, 0.82);
    vec3 frontTrans = exp(-max(vec3(0.03), (1.0 - uLiquidColor) * 2.1 + 0.15) * frontLiquid);
    interiorCol = waxLit * frontTrans + uLiquidColor * (1.0 - frontTrans) * 0.35;
  }

  // Add glittering suspended microbubbles & falling mobile shake-glitter
  vec3 sparkleCol = mix(vec3(1.0), uWaxHot, 0.35);
  interiorCol += sparkleCol * clamp(particleAcc, 0.0, 1.25);

  if (shakeGlitterAcc > 0.001) {
    vec3 shakeSparkleCol = mix(vec3(1.0, 0.97, 0.90), mix(uWaxHot, vec3(1.0), 0.55), 0.32);
    interiorCol += shakeSparkleCol * clamp(shakeGlitterAcc, 0.0, 2.1);
  }

  // Crisp borosilicate outer glass speculars & softbox reflections
  vec3 envRefl = sampleStudioEnv(reflect(rdL, nOut), isDark);
  float glassSpec = (0.14 + 0.86 * fresnel) * (0.45 + 0.72 * uGlassRefraction);
  vec3 col = interiorCol + envRefl * glassSpec * (isDark > 0.5 ? 0.58 : 0.44);

  // Smooth refractive glass edge rim line
  float glassEdge = pow(1.0 - ndotv, 5.2) * (0.35 + 0.45 * uGlassRefraction);
  col += mix(uLiquidColor, vec3(1.0), 0.7) * glassEdge * 0.30;

  // Subtle top liquid meniscus highlight
  float meniscus = smoothstep(0.955, 0.992, heightT) * smoothstep(1.0, 0.992, heightT);
  col += vec3(0.28) * meniscus;

  // Soft collar contact shadow on glass edges meeting metal base/cap
  float collarShade = smoothstep(max(0.008, pxSize * 1.6), 0.0, abs(pOut.y - gMin)) * 0.32
                    + smoothstep(max(0.007, pxSize * 1.4), 0.0, abs(pOut.y - gMax)) * 0.28;
  col *= (1.0 - clamp(collarShade, 0.0, 0.42));

  return col;
}

// Trace a single ray against the scene; sets outNeedsEdgeAA=true only on silhouette/seam pixels
vec4 traceSceneRay(
  vec2 pScreen,
  vec2 uv,
  vec3 ro,
  vec3 cu,
  vec3 cv,
  vec3 cw,
  mat2 tiltM,
  float invScale,
  float boundR,
  float pxFactor,
  float isDark,
  out bool outNeedsEdgeAA
) {
  outNeedsEdgeAA = false;

  vec3 rd = normalize(pScreen.x * cu + pScreen.y * cv + 1.85 * cw);

  // Transform ray into lamp local space (offset, scale, tilt)
  vec3 roL = ro - vec3(uOffset.x * 1.45, uOffset.y * 1.45, 0.0);
  vec3 rdL = rd;
  roL.xy = tiltM * roL.xy;
  rdL.xy = tiltM * rdL.xy;
  roL *= invScale;

  // Fast analytical bounding-cylinder rejection for background pixels
  vec2 cylHit = intersectBoundingCylinder(roL, rdL, boundR);
  float alphaBg = (uTransparentBg == 1) ? 0.0 : 1.0;

  if (!(cylHit.y > 0.0 && cylHit.x < cylHit.y)) {
    vec3 bgCol = (uTransparentBg == 1) ? vec3(0.0) : renderStudioBackground(uv, pScreen);
    return vec4(bgCol, alphaBg);
  }

  float tStart = max(0.05, cylHit.x);
  float tEnd = min(32.0, cylHit.y);
  float yA = roL.y + rdL.y * tStart;
  float yB = roL.y + rdL.y * tEnd;
  if (max(yA, yB) < -0.97 || min(yA, yB) > 0.97) {
    vec3 bgCol = (uTransparentBg == 1) ? vec3(0.0) : renderStudioBackground(uv, pScreen);
    return vec4(bgCol, alphaBg);
  }

  if (uVesselShape == 4) {
    // Free-floating fluid metaballs mode (no vessel shell)
    float t = tStart;
    bool hitWax = false;
    for (int i = 0; i < 40; i++) {
      vec3 p = roL + rdL * t;
      float d = mapWax(p);
      if (d < 0.002) {
        hitWax = true;
        break;
      }
      t += max(d * 0.85, 0.006);
      if (t > tEnd) break;
    }
    if (hitWax) {
      vec3 p = roL + rdL * t;
      vec3 n = calcWaxNormal(p);
      float hNorm = clamp((p.y + 0.55) / 1.1, 0.0, 1.0);
      vec3 waxCol = mix(uWaxHot, uWaxCool, smoothstep(0.05, 0.88, hNorm));
      vec3 keyDir = normalize(vec3(0.55, 0.65, 0.52));
      float diff = max(dot(n, keyDir), 0.0);
      float ndotv = clamp(abs(dot(n, -rdL)), 0.0, 1.0);
      float spec = pow(max(dot(n, normalize(keyDir - rdL)), 0.0), 42.0);
      float sss = (0.35 + 0.65 * pow(ndotv, 1.1)) * uSubsurface;
      vec3 lit = waxCol * (0.38 + 0.68 * diff + sss * 0.72) + vec3(1.0) * spec * 0.48;
      lit += uWaxHot * pow(1.0 - hNorm, 2.2) * uBottomGlow * 0.55;
      return vec4(lit, 1.0);
    }
    vec3 bgCol = (uTransparentBg == 1) ? vec3(0.0) : renderStudioBackground(uv, pScreen);
    return vec4(bgCol, alphaBg);
  }

  // High-precision outer shell raymarching with closest-approach tracking
  float t = tStart;
  float prevT = tStart;
  bool hitOuter = false;
  float minRatio = 1e4;

  for (int i = 0; i < 64; i++) {
    vec3 p = roL + rdL * t;
    float pxSize = max(0.0005, t * pxFactor);
    float d = mapLampOuterDist(p);
    minRatio = min(minRatio, d / pxSize);

    float hitEps = max(0.00035, pxSize * 0.14);
    if (d < hitEps) {
      hitOuter = true;
      if (d < 0.0) {
        // 3-iteration binary-search refinement brackets exact zero-crossing
        float tLo = prevT;
        float tHi = t;
        for (int b = 0; b < 3; b++) {
          float tMid = 0.5 * (tLo + tHi);
          if (mapLampOuterDist(roL + rdL * tMid) < 0.0) {
            tHi = tMid;
          } else {
            tLo = tMid;
          }
        }
        t = 0.5 * (tLo + tHi);
      } else {
        t += d;
      }
      break;
    }

    prevT = t;
    t += max(d * 0.78, hitEps * 0.65);
    if (t > tEnd) break;
  }

  if (!hitOuter) {
    // Flag rays passing within 1.45 pixels of the outer silhouette for selective 4x RGSS
    if (minRatio < 1.45) {
      outNeedsEdgeAA = true;
    }
    vec3 bgCol = (uTransparentBg == 1) ? vec3(0.0) : renderStudioBackground(uv, pScreen);
    return vec4(bgCol, alphaBg);
  }

  vec3 pOut = roL + rdL * t;
  float pxSize = max(0.0005, t * pxFactor);
  vec3 nOut = calcOuterNormal(pOut, pxSize);
  float ndotv = abs(dot(nOut, -rdL));

  float gMin = vesselGlassYMin(uVesselShape);
  float gMax = vesselGlassYMax(uVesselShape);
  float yBottom = -0.90;
  float yTop = (uVesselShape == 2) ? 0.90 : 0.88;

  // Flag outer grazing silhouettes, cap bevel rims, and glass/metal seams for selective 4x RGSS
  float seamAlert = max(0.012, pxSize * 2.2);
  bool nearCollar = abs(pOut.y - gMin) < seamAlert || abs(pOut.y - gMax) < seamAlert;
  bool nearCapRim = abs(pOut.y - yBottom) < max(0.016, pxSize * 2.4)
                 || abs(pOut.y - yTop) < max(0.016, pxSize * 2.4);
  bool nearWaist = (uVesselShape == 0) && abs(pOut.y + 0.58) < max(0.016, pxSize * 2.2);
  if (ndotv < 0.34 || nearCollar || nearCapRim || nearWaist) {
    outNeedsEdgeAA = true;
  }

  // Smooth sub-pixel transition between metal base/cap and borosilicate glass chamber
  float seamBlendW = max(0.0022, pxSize * 1.15);
  float glassMask = smoothstep(gMin - seamBlendW, gMin + seamBlendW, pOut.y)
                  * smoothstep(gMax + seamBlendW, gMax - seamBlendW, pOut.y);

  vec3 col;
  if (glassMask <= 0.001) {
    col = shadeMetal(pOut, nOut, rdL, isDark, pxSize);
  } else if (glassMask >= 0.999) {
    col = shadeGlassVessel(pOut, nOut, rdL, uv, pScreen, boundR, isDark, pxSize);
  } else {
    vec3 metalCol = shadeMetal(pOut, nOut, rdL, isDark, pxSize);
    vec3 glassCol = shadeGlassVessel(pOut, nOut, rdL, uv, pScreen, boundR, isDark, pxSize);
    col = mix(metalCol, glassCol, glassMask);
  }

  return vec4(col, 1.0);
}

#endif

#ifdef LITE
// ===================== LITE MODE: no raymarching =====================
// Silhouette, normals and wax come from closed-form math (surface of revolution + 2D metaballs).
vec4 gLiteBlob[9];
int gLiteN = 0;
float gLiteK = 0.03;
float gLiteGMin = 0.0;
float gLiteGMax = 0.0;
float gLitePoolR = 0.1;

void liteSetupWax() {
  gLiteGMin = vesselGlassYMin(uVesselShape);
  gLiteGMax = vesselGlassYMax(uVesselShape);
  float gSpan = gLiteGMax - gLiteGMin;
  float w = uWidthRatio;
  gLiteK = max(0.025, uViscosity * 0.56);
  gLiteN = 0;
  for (int i = 0; i < 9; i++) {
    if (i >= uBlobCount) break;
    vec4 b = uBlobs[i];
    if (b.w <= 0.001) continue;
    float yNorm = clamp((b.y + 0.46) / 0.92, 0.0, 1.0);
    float by = gLiteGMin + 0.06 + yNorm * (gSpan - 0.12);
    float br = b.w * (uVesselShape == 4 ? 1.55 : 1.18) * sqrt(w);
    float wallR = (uVesselShape == 4) ? 0.45 * w : max(0.05, vesselRadius(uVesselShape, by) - 0.022);
    br = min(br, wallR * 0.78);
    float maxCenter = max(0.01, wallR - br * 0.72);
    vec2 bxz = b.xz * (uVesselShape == 4 ? 1.45 : 0.95 * w);
    float distXZ = length(bxz);
    if (distXZ > maxCenter) bxz *= maxCenter / distXZ;
    gLiteBlob[gLiteN] = vec4(bxz.x, by, br, 0.0);
    gLiteN++;
  }
  if (uVesselShape != 4) {
    gLitePoolR = vesselRadius(uVesselShape, gLiteGMin + 0.02) * 0.84;
  }
}

// Signed distance (2D) to the wax silhouette seen from the front
float liteWaxD(vec2 p) {
  float k = gLiteK;
  float d = 1e4;
  for (int i = 0; i < 9; i++) {
    if (i >= gLiteN) break;
    vec4 b = gLiteBlob[i];
    vec2 q = p - b.xy;
    q.y *= 0.86;
    d = smin(d, length(q) - b.z, k);
  }
  if (uVesselShape != 4) {
    vec2 qp = p - vec2(sin(uTime * 0.55) * 0.02, gLiteGMin + 0.014);
    qp.y *= 2.45;
    d = smin(d, length(qp) - gLitePoolR, k * 0.85);
  }
  if (uTurbulence > 0.002) {
    d += fastGyroid(vec3(p * 11.5, 0.0) + vec3(0.0, -uTime * 1.1, uTime * 0.45)) * uTurbulence * 0.026;
  }
  if (uVesselShape != 4) {
    float innerWall = vesselRadius(uVesselShape, clamp(p.y, gLiteGMin, gLiteGMax)) - 0.016;
    float dWall = abs(p.x) - innerWall;
    float dCaps = max((gLiteGMin + 0.008) - p.y, p.y - (gLiteGMax - 0.022));
    d = max(d, max(dWall, dCaps));
  }
  return d;
}

// Dome-like pseudo normal for the wax from the 2D distance field
vec3 liteWaxNormal(vec2 p, float d0) {
  const float e = 0.004;
  vec2 g = vec2(liteWaxD(p + vec2(e, 0.0)) - d0, liteWaxD(p + vec2(0.0, e)) - d0);
  vec2 gdir = g / max(length(g), 1e-5);
  const float R = 0.12;
  float rho = clamp(R + d0, 0.0, R);
  return normalize(vec3(gdir * rho, sqrt(max(R * R - rho * rho, 1e-4))));
}

vec3 liteShadeGlass(
  vec3 pOut, vec3 nOut, vec3 rdL, vec2 uv, vec2 pScreen, float isDark, float pxSize
) {
  float gMin = vesselGlassYMin(uVesselShape);
  float gMax = vesselGlassYMax(uVesselShape);
  float gSpan = gMax - gMin;

  float ior = mix(1.04, 1.24, uGlassRefraction);
  vec3 rdIn = refract(rdL, nOut, 1.0 / ior);
  if (length(rdIn) < 0.01) rdIn = rdL;

  // Where the refracted ray crosses the middle of the chamber
  vec2 p2 = pOut.xy + rdIn.xy * (pOut.z / max(-rdIn.z, 0.35));
  float d0 = liteWaxD(p2);
  float waxCov = smoothstep(pxSize * 0.9, -pxSize * 0.9, d0);

  vec2 refrUv = uv + nOut.xy * (0.045 * uGlassRefraction);
  vec2 refrScreen = pScreen + nOut.xy * (0.065 * uGlassRefraction);
  vec3 behindCol = (uTransparentBg == 1)
    ? mix(uLiquidColor * 0.25, vec3(0.08), 0.3)
    : renderStudioBackground(clamp(refrUv, 0.0, 1.0), refrScreen);

  float heightT = clamp((pOut.y - gMin) / gSpan, 0.0, 1.0);
  float ndotv = clamp(abs(dot(nOut, -rdL)), 0.0, 1.0);
  float fresnel = pow(1.0 - ndotv, 3.4);

  float pathDepth = mix(0.65, 1.65, 1.0 - ndotv);
  float liqStrength = clamp(uLiquidDensity * pathDepth, 0.0, 1.45);
  vec3 transmittance = exp(-max(vec3(0.04), (1.0 - uLiquidColor) * 2.45 + 0.22) * liqStrength * 1.15);
  vec3 liquidBase = behindCol * transmittance + uLiquidColor * (1.0 - transmittance) * (0.58 + 0.28 * (1.0 - heightT));

  float bulbHeat = pow(clamp(1.0 - heightT, 0.0, 1.0), 2.55) * uBottomGlow;
  vec3 hotCoreCol = mix(uWaxHot, vec3(1.0, 0.95, 0.94), 0.42);
  liquidBase += hotCoreCol * bulbHeat * (0.42 + 0.24 * ndotv);

  vec3 interiorCol = liquidBase;

  if (waxCov > 0.001) {
    vec3 nWax = liteWaxNormal(p2, d0);
    float wHeight = clamp((p2.y - gMin) / gSpan, 0.0, 1.0);
    vec3 waxAlbedo = mix(uWaxHot, uWaxCool, smoothstep(0.06, 0.84, wHeight));
    vec3 keyDir = normalize(vec3(0.55, 0.62, 0.56));
    float diff = max(dot(nWax, keyDir), 0.0);
    float wNdotV = clamp(abs(dot(nWax, -rdIn)), 0.0, 1.0);
    float bottomUp = clamp(-nWax.y * 0.55 + 0.5, 0.0, 1.0);
    float coreGlow = mix(0.32, 1.0, pow(wNdotV, 1.15)) * uSubsurface;
    float baseIncandescence = pow(clamp(1.0 - wHeight, 0.0, 1.0), 2.4) * uBottomGlow;
    vec3 waxLit = waxAlbedo * (0.34 + 0.62 * diff + coreGlow * 0.72)
                + hotCoreCol * baseIncandescence * (0.48 + 0.55 * bottomUp);
    float wSpec = pow(max(dot(nWax, normalize(keyDir - rdIn)), 0.0), 34.0);
    waxLit += vec3(1.0, 0.97, 0.95) * wSpec * 0.22;
    float frontLiquid = clamp(pOut.z * 2.0 * uLiquidDensity, 0.0, 0.82);
    vec3 frontTrans = exp(-max(vec3(0.03), (1.0 - uLiquidColor) * 2.1 + 0.15) * frontLiquid);
    vec3 waxCol = waxLit * frontTrans + uLiquidColor * (1.0 - frontTrans) * 0.35;
    interiorCol = mix(interiorCol, waxCol, waxCov);
  }

  // Sparkles are sampled once (not along a ray) and only show in the clear liquid
  vec3 pMid = vec3(p2, 0.0);
  float particleAcc = (uParticles > 0.01) ? evalMicroParticles(pMid, rdIn, gMin, gMax) * 1.1 : 0.0;
  float shakeAcc = (uShakeGlitter.x > 0.005) ? evalShakeGlitter(pMid, gMin, gMax) * 1.2 : 0.0;
  float clear = 1.0 - waxCov;
  interiorCol += mix(vec3(1.0), uWaxHot, 0.35) * clamp(particleAcc * clear, 0.0, 1.25);
  if (shakeAcc > 0.001) {
    vec3 shakeCol = mix(vec3(1.0, 0.97, 0.90), mix(uWaxHot, vec3(1.0), 0.55), 0.32);
    interiorCol += shakeCol * clamp(shakeAcc * clear, 0.0, 2.1);
  }

  vec3 envRefl = sampleStudioEnv(reflect(rdL, nOut), isDark);
  float glassSpec = (0.14 + 0.86 * fresnel) * (0.45 + 0.72 * uGlassRefraction);
  vec3 col = interiorCol + envRefl * glassSpec * (isDark > 0.5 ? 0.58 : 0.44);

  float glassEdge = pow(1.0 - ndotv, 5.2) * (0.35 + 0.45 * uGlassRefraction);
  col += mix(uLiquidColor, vec3(1.0), 0.7) * glassEdge * 0.30;

  float meniscus = smoothstep(0.955, 0.992, heightT) * smoothstep(1.0, 0.992, heightT);
  col += vec3(0.28) * meniscus;

  float collarShade = smoothstep(max(0.008, pxSize * 1.6), 0.0, abs(pOut.y - gMin)) * 0.32
                    + smoothstep(max(0.007, pxSize * 1.4), 0.0, abs(pOut.y - gMax)) * 0.28;
  col *= (1.0 - clamp(collarShade, 0.0, 0.42));
  return col;
}

vec4 traceSceneRayLite(
  vec2 pScreen, vec2 uv, vec3 ro, vec3 cu, vec3 cv, vec3 cw,
  mat2 tiltM, float invScale, float boundR, float isDark
) {
  float alphaBg = (uTransparentBg == 1) ? 0.0 : 1.0;
  vec3 dir = normalize(pScreen.x * cu + pScreen.y * cv + 1.85 * cw);
  float sPlane = -ro.z / min(dir.z, -0.2);
  vec2 pt = ro.xy + dir.xy * sPlane;
  vec2 lp = tiltM * (pt - uOffset * 1.45) * invScale;
  vec3 rdL = normalize(vec3(tiltM * dir.xy, dir.z));
  float pxL = max(0.0005, sPlane * invScale / uResolution.y);

  float yBottom = -0.90;
  float yTop = (uVesselShape == 2) ? 0.90 : 0.88;

  // Cheap rejection of background pixels
  if (abs(lp.x) > boundR + 0.05 || lp.y < -0.95 || lp.y > 0.95) {
    return vec4((uTransparentBg == 1) ? vec3(0.0) : renderStudioBackground(uv, pScreen), alphaBg);
  }

  if (uVesselShape == 4) {
    liteSetupWax();
    float d0 = liteWaxD(lp);
    float cov = smoothstep(pxL * 0.9, -pxL * 0.9, d0);
    vec3 bgCol = (uTransparentBg == 1) ? vec3(0.0) : renderStudioBackground(uv, pScreen);
    if (cov < 0.002) return vec4(bgCol, alphaBg);
    vec3 n = liteWaxNormal(lp, d0);
    float hNorm = clamp((lp.y + 0.55) / 1.1, 0.0, 1.0);
    vec3 waxCol = mix(uWaxHot, uWaxCool, smoothstep(0.05, 0.88, hNorm));
    vec3 keyDir = normalize(vec3(0.55, 0.65, 0.52));
    float diff = max(dot(n, keyDir), 0.0);
    float ndotv = clamp(abs(dot(n, -rdL)), 0.0, 1.0);
    float spec = pow(max(dot(n, normalize(keyDir - rdL)), 0.0), 42.0);
    float sss = (0.35 + 0.65 * pow(ndotv, 1.1)) * uSubsurface;
    vec3 lit = waxCol * (0.38 + 0.68 * diff + sss * 0.72) + vec3(1.0) * spec * 0.48;
    lit += uWaxHot * pow(1.0 - hNorm, 2.2) * uBottomGlow * 0.55;
    return (uTransparentBg == 1) ? vec4(lit, cov) : vec4(mix(bgCol, lit, cov), 1.0);
  }

  float yc = clamp(lp.y, yBottom, yTop);
  float r = vesselRadius(uVesselShape, yc);
  float hh = 0.004;
  float drdy = (vesselRadius(uVesselShape, clamp(yc + hh, yBottom, yTop))
              - vesselRadius(uVesselShape, clamp(yc - hh, yBottom, yTop))) / (2.0 * hh);
  float dEdge = (r - abs(lp.x)) * inversesqrt(1.0 + drdy * drdy);
  float cov = smoothstep(-0.75 * pxL, 0.75 * pxL, dEdge)
            * clamp((lp.y - yBottom) / pxL + 0.5, 0.0, 1.0)
            * clamp((yTop - lp.y) / pxL + 0.5, 0.0, 1.0);

  vec3 bgCol = (uTransparentBg == 1) ? vec3(0.0) : renderStudioBackground(uv, pScreen);
  if (cov < 0.002) return vec4(bgCol, alphaBg);

  float xs = clamp(lp.x, -r, r);
  float zz = sqrt(max(r * r - xs * xs, 1e-5));
  vec3 pOut = vec3(xs, yc, zz);
  vec3 nOut = normalize(vec3(xs, -r * drdy, zz));

  float gMin = vesselGlassYMin(uVesselShape);
  float gMax = vesselGlassYMax(uVesselShape);
  float seamBlendW = max(0.0022, pxL * 1.15);
  float glassMask = smoothstep(gMin - seamBlendW, gMin + seamBlendW, yc)
                  * smoothstep(gMax + seamBlendW, gMax - seamBlendW, yc);

  vec3 col;
  if (glassMask <= 0.001) {
    col = shadeMetal(pOut, nOut, rdL, isDark, pxL);
  } else {
    liteSetupWax();
    vec3 glassCol = liteShadeGlass(pOut, nOut, rdL, uv, pScreen, isDark, pxL);
    col = (glassMask >= 0.999) ? glassCol : mix(shadeMetal(pOut, nOut, rdL, isDark, pxL), glassCol, glassMask);
  }

  return (uTransparentBg == 1) ? vec4(col, cov) : vec4(mix(bgCol, col, cov), 1.0);
}
#endif

void main() {
  vec2 uv = vUv;
  vec2 pScreen = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float isDark = float(uBgMode);

  // Camera setup with subtle interactive parallax
  vec3 ro = vec3(uParallax.x * 0.28, uParallax.y * 0.16, 2.75);
  vec3 ta = vec3(0.0, 0.0, 0.0);
  vec3 cw = normalize(ta - ro);
  vec3 cu = normalize(cross(cw, vec3(0.0, 1.0, 0.0)));
  vec3 cv = cross(cu, cw);

  mat2 tiltM = rot2(-uTilt);
  float safeScale = max(0.12, uScale);
  float invScale = 1.0 / safeScale;
  float boundR = (uVesselShape == 4 ? 0.56 : 0.34) * uWidthRatio + 0.065;
  float pxFactor = 1.0 / (1.85 * uResolution.y * safeScale);

#ifdef LITE
  vec4 result = traceSceneRayLite(pScreen, uv, ro, cu, cv, cw, tiltM, invScale, boundR, isDark);
#else
  // Primary center ray (covers ~98% of screen pixels in a single sample)
  bool needsEdgeAA = false;
  vec4 result = traceSceneRay(
    pScreen, uv, ro, cu, cv, cw, tiltM, invScale, boundR, pxFactor, isDark, needsEdgeAA
  );

  // Selective 4x Rotated Grid Supersampling (RGSS) strictly on outer silhouette & seams
  if (needsEdgeAA) {
    vec2 invRes = 1.0 / uResolution;
    float invH = invRes.y;
    const vec2 rgss[4] = vec2[4](
      vec2(-0.375, -0.125),
      vec2( 0.125, -0.375),
      vec2( 0.375,  0.125),
      vec2(-0.125,  0.375)
    );

    if (uTransparentBg == 1) {
      // Premultiplied accumulation eliminates dark halo fringes on transparent PNG edges
      vec3 accRgb = vec3(0.0);
      float accA = 0.0;
      for (int s = 0; s < 4; s++) {
        bool dummy = false;
        vec2 off = rgss[s];
        vec4 sub = traceSceneRay(
          pScreen + off * invH,
          uv + off * invRes,
          ro, cu, cv, cw, tiltM, invScale, boundR, pxFactor, isDark, dummy
        );
        accRgb += sub.rgb * sub.a;
        accA += sub.a;
      }
      result.a = accA * 0.25;
      result.rgb = (accA > 0.001) ? (accRgb / accA) : vec3(0.0);
    } else {
      vec3 accRgb = vec3(0.0);
      for (int s = 0; s < 4; s++) {
        bool dummy = false;
        vec2 off = rgss[s];
        vec4 sub = traceSceneRay(
          pScreen + off * invH,
          uv + off * invRes,
          ro, cu, cv, cw, tiltM, invScale, boundR, pxFactor, isDark, dummy
        );
        accRgb += sub.rgb;
      }
      result.rgb = accRgb * 0.25;
      result.a = 1.0;
    }
  }

#endif

  vec3 color = result.rgb;
  float alpha = result.a;

  // Analytic soft bloom halo around the glowing glass vessel (zero FBO cost)
  if (uBloom > 0.01 && uTransparentBg == 0) {
    vec2 lampCenter = vec2(uOffset.x, uOffset.y + 0.08 * uScale);
    vec2 dHalo = (pScreen - lampCenter) / safeScale;
    float haloDist = length(vec2(dHalo.x / (0.28 * uWidthRatio), dHalo.y / 0.52));
    float halo = exp(-haloDist * haloDist * 1.45) * uBloom * (0.45 + 0.45 * uBottomGlow);
    vec3 haloCol = mix(uWaxHot, uWaxCool, 0.35);
    color += haloCol * halo * (isDark > 0.5 ? 0.42 : 0.16);
  }

  // Color grading: saturation & contrast
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, uSaturation);
  color = (color - 0.5) * uContrast + 0.5;
  color = max(color, vec3(0.0));

  // Subtle photographic film grain
  if (uFilmGrain > 0.002) {
    float g = (hash12(gl_FragCoord.xy + fract(uTime * 17.3) * 100.0) - 0.5) * uFilmGrain * 0.22;
    color = clamp(color + g, 0.0, 1.0);
  }

  // Smooth Filmic-like highlight roll-off
  color = color / (1.0 + color * 0.18);
  color = clamp(color, 0.0, 1.0);

  fragColor = vec4(color, alpha);
}
`;
