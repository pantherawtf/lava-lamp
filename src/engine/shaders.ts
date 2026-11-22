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
uniform int uBgMode;        // 0: light, 1: dark
uniform float uBgLuminance;
uniform float uBottomGlow;
uniform float uSubsurface;
uniform float uBloom;
uniform float uSaturation;
uniform float uContrast;
uniform float uFilmGrain;

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

// Fast 3D gyroid turbulence (single evaluation, zero 3D lattice hashes)
float fastGyroid(vec3 p) {
  return dot(sin(p), cos(p.yzx));
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

// Vessel outer radius profile R(y) in normalized lamp coordinates y in [-0.92, 0.92]
// Glass spans approximately y in [-0.36, 0.56] depending on shape
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

float vesselRadius(int shape, float y) {
  float w = uWidthRatio;
  if (shape == 0) {
    // Classic Mathmos Astro
    if (y < -0.58) {
      // Lower hourglass cone foot [-0.90, -0.58]
      float t = clamp((y + 0.90) / 0.32, 0.0, 1.0);
      return mix(0.245, 0.115, t) * w;
    } else if (y < -0.26) {
      // Upper hourglass base [-0.58, -0.26]
      float t = clamp((y + 0.58) / 0.32, 0.0, 1.0);
      return mix(0.115, 0.255, t) * w;
    } else if (y < 0.56) {
      // Conical glass vessel with soft lower bulge
      float t = clamp((y + 0.26) / 0.82, 0.0, 1.0);
      float belly = sin(clamp(t * 4.2, 0.0, PI)) * 0.018 * (1.0 - t);
      return (mix(0.255, 0.128, pow(t, 0.94)) + belly) * w;
    } else {
      // Conical aluminum cap [0.56, 0.88]
      float t = clamp((y - 0.56) / 0.32, 0.0, 1.0);
      return mix(0.128, 0.078, t) * w;
    }
  } else if (shape == 1) {
    // Modern Cylindrical Capsule
    if (y < -0.84) {
      // Flat plinth disc
      return 0.242 * w;
    } else if (y < -0.76) {
      // Recessed pedestal neck
      return 0.172 * w;
    } else if (y < -0.34) {
      // Rounded cylindrical base cup
      float t = clamp((y + 0.76) / 0.12, 0.0, 1.0);
      float arc = sin(t * PI * 0.5);
      return mix(0.176, 0.228, arc) * w;
    } else if (y < 0.62) {
      // Straight glass cylinder
      return 0.226 * w;
    } else {
      // Domed rounded metallic cap [0.62, 0.88]
      float t = clamp((y - 0.70) / 0.18, 0.0, 1.0);
      return 0.228 * sqrt(max(0.0, 1.0 - t * t)) * w;
    }
  } else if (shape == 2) {
    // Sleek Tall Rose-Copper Bullet
    if (y < -0.78) {
      // Trumpet flared saucer base [-0.90, -0.78]
      float t = clamp((y + 0.90) / 0.12, 0.0, 1.0);
      return mix(0.255, 0.088, pow(t, 0.68)) * w;
    } else if (y < -0.24) {
      // Tall tapering chalice base [-0.78, -0.24]
      float t = clamp((y + 0.78) / 0.54, 0.0, 1.0);
      return (mix(0.09, 0.188, pow(t, 0.88)) + sin(t * PI) * 0.012) * w;
    } else if (y < 0.56) {
      // Curved spindle glass [-0.24, 0.56]
      float t = clamp((y + 0.24) / 0.80, 0.0, 1.0);
      float swell = sin(pow(t, 0.74) * PI) * 0.038;
      return (mix(0.188, 0.118, pow(t, 1.1)) + swell) * w;
    } else {
      // Parabolic ogive nose cap [0.56, 0.90]
      float t = clamp((y - 0.56) / 0.34, 0.0, 1.0);
      return 0.118 * pow(max(0.0, 1.0 - t), 0.62) * w;
    }
  } else {
    // Organic Sculpted Ampoule (shape == 3)
    if (y < -0.30) {
      float t = clamp((y + 0.88) / 0.58, 0.0, 1.0);
      float pinch = sin(t * PI) * 0.095;
      return (mix(0.24, 0.18, t) - pinch) * w;
    } else if (y < 0.56) {
      float t = clamp((y + 0.30) / 0.86, 0.0, 1.0);
      float swell = sin(pow(t, 0.7) * PI) * 0.085;
      return (mix(0.18, 0.118, t) + swell) * w;
    } else {
      float t = clamp((y - 0.56) / 0.30, 0.0, 1.0);
      return 0.118 * pow(max(0.0, cos(t * PI * 0.5)), 0.72) * w;
    }
  }
}

// Signed distance to outer lamp body; returns vec2(dist, matId)
// matId: 1.0 = metal base/cap, 2.0 = glass vessel
vec2 mapLampOuter(vec3 p) {
  if (uVesselShape == 4) {
    return vec2(1e4, 0.0);
  }
  float yBottom = -0.90;
  float yTop = (uVesselShape == 2) ? 0.90 : 0.88;
  float yc = clamp(p.y, yBottom, yTop);
  float r = vesselRadius(uVesselShape, yc);
  float dRad = length(p.xz) - r;
  float dCap = max(yBottom - p.y, p.y - yTop);
  // Smooth outer shell distance scaled conservatively for steep slopes
  float d = (dCap > 0.0) ? length(vec2(max(dRad, 0.0), dCap)) : max(dRad * 0.82, dCap);

  float gMin = vesselGlassYMin(uVesselShape);
  float gMax = vesselGlassYMax(uVesselShape);
  float matId = (p.y >= gMin && p.y <= gMax) ? 2.0 : 1.0;
  return vec2(d, matId);
}

// Signed distance to internal molten wax metaballs
float mapWax(vec3 p) {
  float gMin = vesselGlassYMin(uVesselShape);
  float gMax = vesselGlassYMax(uVesselShape);
  float gSpan = gMax - gMin;
  float w = uWidthRatio;
  float k = max(0.035, uViscosity * 0.92);

  float d = 1e4;
  for (int i = 0; i < 14; i++) {
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
    float poolR = vesselRadius(uVesselShape, gMin + 0.02) * 0.86;
    vec3 qp = p - vec3(sin(uTime * 0.55) * 0.02, gMin + 0.015, cos(uTime * 0.48) * 0.02);
    qp.y *= 2.4;
    float dPool = length(qp) - poolR;
    d = smin(d, dPool, k * 1.15);
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

// 4-tap tetrahedron normal for outer shell
vec3 calcOuterNormal(vec3 p) {
  const vec2 e = vec2(0.0018, -0.0018);
  return normalize(
    e.xyy * mapLampOuter(p + e.xyy).x +
    e.yyx * mapLampOuter(p + e.yyx).x +
    e.yxy * mapLampOuter(p + e.yxy).x +
    e.xxx * mapLampOuter(p + e.xxx).x
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

// Studio environment reflection color (softbox strips + cool/warm studio sweep)
vec3 sampleStudioEnv(vec3 refDir, float isDark) {
  float up = refDir.y * 0.5 + 0.5;
  vec3 baseEnv = isDark > 0.5
    ? mix(vec3(0.04, 0.045, 0.06), vec3(0.20, 0.22, 0.28), up)
    : mix(vec3(0.58, 0.60, 0.64), vec3(0.95, 0.96, 0.99), up);

  // Two crisp vertical studio softbox strips
  float stripL = smoothstep(0.76, 0.96, dot(normalize(refDir.xz), normalize(vec2(-0.78, 0.62))))
               * smoothstep(0.92, 0.15, abs(refDir.y));
  float stripR = smoothstep(0.80, 0.97, dot(normalize(refDir.xz), normalize(vec2(0.82, 0.57))))
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

// Shade metallic / frosted base and cap
vec3 shadeMetal(vec3 p, vec3 n, vec3 rd, float isDark) {
  vec3 viewDir = -rd;
  vec3 refDir = reflect(rd, n);
  vec3 env = sampleStudioEnv(refDir, isDark);

  vec3 keyDir = normalize(vec3(0.65, 0.55, 0.52));
  vec3 rimDir = normalize(vec3(-0.72, 0.35, -0.58));
  float ndotl = max(dot(n, keyDir), 0.0);
  float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 4.0);

  vec3 albedo = vec3(0.80, 0.82, 0.86);
  float metalness = 0.90;
  float rough = 0.25;

  if (uMetalFinish == 0) {
    // Brushed speckled spun aluminum (Mathmos Astro)
    float grain = hash12(floor(vec2(atan(p.z, p.x) * 95.0, p.y * 190.0)));
    float band = sin(p.y * 220.0) * 0.03;
    albedo = vec3(0.76, 0.78, 0.82) + (grain - 0.5) * 0.14 + band;
    metalness = 0.86;
    rough = 0.30 + grain * 0.12;
  } else if (uMetalFinish == 1) {
    // Dark gunmetal chrome
    float brush = sin(p.y * 260.0) * 0.015;
    albedo = vec3(0.24, 0.25, 0.29) + brush;
    metalness = 0.96;
    rough = 0.14;
  } else if (uMetalFinish == 2) {
    // Polished rose copper
    float brush = sin(p.y * 240.0) * 0.012;
    albedo = vec3(0.92, 0.64, 0.54) + brush;
    metalness = 0.95;
    rough = 0.13;
  } else if (uMetalFinish == 3) {
    // Matte obsidian anodized
    albedo = vec3(0.11, 0.11, 0.13);
    metalness = 0.25;
    rough = 0.58;
  } else {
    // Frosted quartz glass
    albedo = vec3(0.84, 0.87, 0.93);
    metalness = 0.10;
    rough = 0.32;
  }

  vec3 halfV = normalize(keyDir + viewDir);
  float specPow = mix(90.0, 12.0, rough);
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

  // Dark seam groove at glass collar & Astro waist
  float seam = smoothstep(0.008, 0.0, abs(p.y - gMin)) + smoothstep(0.007, 0.0, abs(p.y - gMax));
  if (uVesselShape == 0) {
    seam += smoothstep(0.009, 0.0, abs(p.y + 0.58)) * 0.7;
  }
  col *= (1.0 - clamp(seam, 0.0, 0.65));

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

void main() {
  vec2 uv = vUv;
  vec2 pScreen = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float isDark = float(uBgMode);

  vec3 bgCol = renderStudioBackground(uv, pScreen);

  // Camera setup with subtle interactive parallax
  vec3 ro = vec3(uParallax.x * 0.28, uParallax.y * 0.16, 2.75);
  vec3 ta = vec3(0.0, 0.0, 0.0);
  vec3 cw = normalize(ta - ro);
  vec3 cu = normalize(cross(cw, vec3(0.0, 1.0, 0.0)));
  vec3 cv = cross(cu, cw);
  vec3 rd = normalize(pScreen.x * cu + pScreen.y * cv + 1.85 * cw);

  // Transform ray into lamp local space (offset, scale, tilt)
  vec3 roL = ro - vec3(uOffset.x * 1.45, uOffset.y * 1.45, 0.0);
  vec3 rdL = rd;
  mat2 tiltM = rot2(-uTilt);
  roL.xy = tiltM * roL.xy;
  rdL.xy = tiltM * rdL.xy;
  roL /= max(0.12, uScale);

  // Fast analytical bounding-cylinder rejection for background pixels
  float boundR = (uVesselShape == 4 ? 0.56 : 0.34) * uWidthRatio + 0.05;
  vec2 cylHit = intersectBoundingCylinder(roL, rdL, boundR);

  vec3 color = bgCol;
  float alpha = (uTransparentBg == 1) ? 0.0 : 1.0;

  if (cylHit.y > 0.0 && cylHit.x < cylHit.y) {
    float tStart = max(0.05, cylHit.x);
    float tEnd = min(32.0, cylHit.y);
    float yA = roL.y + rdL.y * tStart;
    float yB = roL.y + rdL.y * tEnd;
    if (max(yA, yB) >= -0.96 && min(yA, yB) <= 0.96) {

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
        color = lit;
        alpha = 1.0;
      }
    } else {
      // Raymarch outer lamp silhouette within tight bounding cylinder
      float t = tStart;
      vec2 hit = vec2(1e4, 0.0);
      bool hitOuter = false;
      for (int i = 0; i < 36; i++) {
        vec3 p = roL + rdL * t;
        if (p.y > 0.96 || p.y < -0.96) {
          t += 0.035;
          if (t > tEnd) break;
          continue;
        }
        hit = mapLampOuter(p);
        if (hit.x < 0.0018) {
          hitOuter = true;
          break;
        }
        t += max(hit.x * 0.85, 0.005);
        if (t > tEnd) break;
      }

      if (hitOuter) {
        vec3 pOut = roL + rdL * t;
        vec3 nOut = calcOuterNormal(pOut);
        alpha = 1.0;

        if (hit.y < 1.5) {
          // Metallic / frosted base & top cap
          color = shadeMetal(pOut, nOut, rdL, isDark);
        } else {
          // Optical Glass Vessel: refract ray into colored liquid + 3D wax metaballs
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

          // Add glittering suspended microbubbles
          vec3 sparkleCol = mix(vec3(1.0), uWaxHot, 0.35);
          interiorCol += sparkleCol * clamp(particleAcc, 0.0, 1.25);

          // Crisp borosilicate outer glass speculars & softbox reflections
          vec3 envRefl = sampleStudioEnv(reflect(rdL, nOut), isDark);
          float glassSpec = (0.14 + 0.86 * fresnel) * (0.45 + 0.72 * uGlassRefraction);
          color = interiorCol + envRefl * glassSpec * (isDark > 0.5 ? 0.58 : 0.44);

          // Crisp refractive glass edge rim line
          float glassEdge = pow(1.0 - ndotv, 5.5) * (0.35 + 0.45 * uGlassRefraction);
          color += mix(uLiquidColor, vec3(1.0), 0.7) * glassEdge * 0.32;

          // Subtle top liquid meniscus highlight
          float meniscus = smoothstep(0.955, 0.992, heightT) * smoothstep(1.0, 0.992, heightT);
          color += vec3(0.28) * meniscus;
        }
      }
    }
    }
  }

  // Analytic soft bloom halo around the glowing glass vessel (zero FBO cost)
  if (uBloom > 0.01 && uTransparentBg == 0) {
    vec2 lampCenter = vec2(uOffset.x, uOffset.y + 0.08 * uScale);
    vec2 dHalo = (pScreen - lampCenter) / max(0.12, uScale);
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
