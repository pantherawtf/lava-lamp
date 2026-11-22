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
uniform float uFloorReflection;
uniform float uStudioShadow;

// Fluid & Wax
uniform int uBlobCount;
uniform vec4 uBlobs[14];
uniform float uViscosity;
uniform float uTurbulence;
uniform float uParticles;
uniform float uGlassRefraction;

// Colors, Lighting & Finishing
uniform vec3 uWaxHot;
uniform vec3 uWaxCool;
uniform vec3 uLiquidColor;
uniform float uLiquidDensity;
uniform float uBgLuminance;
uniform int uBgMode;          // 0=light, 1=dark
uniform float uBottomGlow;
uniform float uSubsurface;
uniform float uBloom;
uniform float uSaturation;
uniform float uContrast;
uniform float uFilmGrain;

// Interactive tilt parallax
uniform vec2 uParallax;

// --- Fast Utilities ---

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
    return vec4(-0.34, 0.45, -0.68, 0.59);
  } else if (shape == 2) {
    return vec4(-0.18, 0.48, -0.72, 0.68);
  } else if (shape == 3) {
    return vec4(-0.30, 0.46, -0.68, 0.62);
  } else {
    return vec4(-0.22, 0.42, -0.72, 0.62);
  }
}

float getMaxVesselRadius(int shape) {
  if (shape == 1) return 0.192 * uWidthRatio;
  if (shape == 2) return 0.195 * uWidthRatio;
  if (shape == 3) return 0.232 * uWidthRatio;
  return 0.222 * uWidthRatio;
}

float getVesselRadius(float y, int shape) {
  float r = 0.16;
  if (shape == 0) {
    if (y >= 0.42) {
      float t = clamp((y - 0.42) * 5.0, 0.0, 1.0);
      r = mix(0.106, 0.056, t);
    } else if (y >= -0.22) {
      float t = (y + 0.22) * 1.5625;
      float cone = mix(0.214, 0.106, pow(t, 0.92));
      r = mix(0.194, cone, smoothstep(0.0, 0.12, t));
    } else if (y >= -0.47) {
      float t = (y + 0.47) * 4.0;
      r = mix(0.088, 0.194, t);
    } else {
      float t = clamp((-0.47 - y) * 4.0, 0.0, 1.0);
      r = mix(0.088, 0.202, t);
    }
  } else if (shape == 1) {
    if (y >= 0.45) {
      float t = clamp((y - 0.45) * 7.1428, 0.0, 1.0);
      r = 0.174 * pow(max(0.0, 1.0 - pow(t, 2.5)), 0.42);
    } else if (y >= -0.55) {
      r = 0.174;
    } else if (y >= -0.64) {
      float t = clamp((-0.55 - y) * 11.111, 0.0, 1.0);
      r = mix(0.174, 0.118, smoothstep(0.0, 1.0, t));
    } else {
      float t = clamp((-0.64 - y) * 25.0, 0.0, 1.0);
      r = mix(0.125, 0.188, smoothstep(0.0, 0.6, t));
    }
  } else if (shape == 2) {
    if (y >= 0.48) {
      float t = clamp((y - 0.48) * 5.0, 0.0, 1.0);
      r = 0.092 * pow(max(0.0, 1.0 - pow(t, 2.2)), 0.48);
    } else if (y >= -0.18) {
      float t = (y + 0.18) * 1.5151;
      r = mix(0.142, 0.092, t) + sin(t * 3.14159) * 0.032;
    } else if (y >= -0.64) {
      float t = (-0.18 - y) * 2.1739;
      r = mix(0.142, 0.058, pow(t, 0.85));
    } else {
      float t = clamp((-0.64 - y) * 12.5, 0.0, 1.0);
      r = mix(0.062, 0.192, smoothstep(0.0, 1.0, t));
    }
  } else {
    if (y >= 0.46) {
      float t = clamp((y - 0.46) * 6.25, 0.0, 1.0);
      r = 0.115 * pow(max(0.0, 1.0 - pow(t, 2.2)), 0.45);
    } else if (y >= -0.30) {
      float t = (y + 0.30) * 1.3157;
      r = 0.16 + 0.065 * sin(t * 3.6128 - 0.2) - 0.045 * t;
    } else {
      float t = clamp((-0.30 - y) * 2.6315, 0.0, 1.0);
      r = 0.148 - 0.055 * sin(t * 3.14159) + 0.04 * t;
    }
  }
  return r * uWidthRatio;
}

float sdVesselOuter(vec3 p, int shape, vec4 b) {
  float cy = clamp(p.y, b.z, b.w);
  float r = getVesselRadius(cy, shape);
  float dr = length(p.xz) - r;
  float dy = max(b.z - p.y, p.y - b.w);
  float d = (dr > 0.0 && dy > 0.0) ? length(vec2(dr, dy)) : max(dr, dy);
  return d * 0.72;
}

// Fast 4-tap Tetrahedron Normal (33% fewer SDF evaluations)
vec3 calcVesselNormal(vec3 p, int shape, vec4 b) {
  const vec2 e = vec2(0.0025, -0.0025);
  return normalize(
    e.xyy * sdVesselOuter(p + e.xyy, shape, b) +
    e.yyx * sdVesselOuter(p + e.yyx, shape, b) +
    e.yxy * sdVesselOuter(p + e.yxy, shape, b) +
    e.xxx * sdVesselOuter(p + e.xxx, shape, b)
  );
}

// --- Fast 3D Wax Metaball SDF ---
float mapWax(vec3 p, vec4 bounds, bool isPureFluid) {
  vec3 bp = p;
  if (!isPureFluid) {
    float glassMid = 0.5 * (bounds.x + bounds.y);
    float invHalf = 0.88 / max(bounds.y - bounds.x, 0.01);
    bp.y = (p.y - glassMid) * invHalf;
    bp.xz /= max(uWidthRatio, 0.4);
  } else {
    bp *= 0.62;
  }

  float d = 10.0;
  float k = uViscosity;

  for (int i = 0; i < 14; i++) {
    if (i >= uBlobCount) break;
    vec4 b = uBlobs[i];
    vec3 q = bp - b.xyz;
    q.y *= 0.86;
    d = smin(d, length(q) - b.w, k);
  }

  if (!isPureFluid) {
    float poolH = -0.435 + 0.022 * sin(bp.x * 11.0 + uTime * 0.9);
    d = smin(d, bp.y - poolH, k * 1.15);
    float topCap = (0.455 + 0.014 * cos(bp.x * 9.0 - uTime * 0.7)) - bp.y;
    d = smin(d, topCap, k * 0.65);
  }

  // Ultra-fast smooth 3D gyroid organic contour (replaces expensive 16-hash 3D noise)
  if (uTurbulence > 0.005) {
    vec3 tp = bp * 9.5 + vec3(0.0, -uTime * 0.55, uTime * 0.25);
    float gyroid = dot(sin(tp), cos(tp.yzx)) * 0.3333;
    d += gyroid * 0.048 * uTurbulence;
  }

  return d * (isPureFluid ? 1.0 : 0.76);
}

vec3 calcWaxNormal(vec3 p, vec4 bounds, bool isPureFluid) {
  const vec2 e = vec2(0.0032, -0.0032);
  return normalize(
    e.xyy * mapWax(p + e.xyy, bounds, isPureFluid) +
    e.yyx * mapWax(p + e.yyx, bounds, isPureFluid) +
    e.yxy * mapWax(p + e.yxy, bounds, isPureFluid) +
    e.xxx * mapWax(p + e.xxx, bounds, isPureFluid)
  );
}

// --- Suspended Glitter / Micro-Bubbles ---
float evalGlitter(vec3 p, vec4 bounds) {
  float hNorm = clamp((p.y - bounds.x) / max(bounds.y - bounds.x, 0.01), 0.0, 1.0);
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
  float size = mix(0.08, 0.21, fract(h * 41.3));
  float dotVal = smoothstep(size, size * 0.18, dist);
  float bottomBoost = mix(1.75, 0.65, pow(hNorm, 0.65));
  float twinkle = 0.68 + 0.32 * sin(uTime * 3.5 + h * 62.8);
  return dotVal * bottomBoost * twinkle * uParticles;
}

// --- Metallic Cap & Base Shading ---
vec3 shadeMetal(vec3 p, vec3 n, vec3 rd, int finish, vec4 bounds) {
  vec3 ref = reflect(rd, n);
  float fresnel = pow(1.0 - max(dot(-rd, n), 0.0), 4.0);

  float softboxL = smoothstep(0.25, 0.88, dot(ref, normalize(vec3(-0.78, 0.32, 0.55))));
  float softboxR = smoothstep(0.35, 0.92, dot(ref, normalize(vec3(0.82, 0.18, 0.52))));
  float topLight = smoothstep(0.1, 0.9, ref.y) * 0.35;
  float darkBand = smoothstep(-0.35, 0.25, ref.z);

  float distToGlass = min(abs(p.y - bounds.x), abs(p.y - bounds.y));
  float glassBounce = exp(-distToGlass * 11.0) * (0.45 + 0.35 * uBottomGlow);
  vec3 glowColor = mix(uWaxHot, uLiquidColor, 0.35);

  if (finish == 0) {
    float grain = hash12(floor(p.xy * 260.0 + p.z * 90.0));
    float brush = hash12(vec2(floor(p.y * 190.0), floor(atan(p.z, p.x) * 28.0)));
    float sparkle = smoothstep(0.84, 0.99, grain) * 0.35;
    vec3 baseCol = vec3(0.66, 0.68, 0.72) * (0.85 + 0.18 * brush);
    float diff = 0.35 + 0.65 * max(dot(n, normalize(vec3(-0.6, 0.45, 0.7))), 0.0);
    float spec = pow(max(dot(ref, normalize(vec3(-0.55, 0.35, 0.75))), 0.0), 18.0) * 0.75;
    vec3 col = baseCol * diff + vec3(0.95, 0.97, 1.0) * (spec + softboxL * 0.38 + softboxR * 0.22 + sparkle);
    return col + glowColor * glassBounce * 0.22;
  } else if (finish == 1) {
    float brush = hash12(vec2(floor(p.y * 160.0), 1.0)) * 0.07;
    vec3 baseCol = vec3(0.14, 0.13, 0.15) + brush;
    vec3 env = mix(vec3(0.05, 0.05, 0.06), vec3(0.82, 0.80, 0.84), softboxL * 0.92 + softboxR * 0.65 + topLight);
    vec3 col = mix(baseCol, env, 0.48 + 0.45 * fresnel) * (0.65 + 0.35 * darkBand);
    return col + glowColor * glassBounce * 0.45;
  } else if (finish == 2) {
    vec3 copperTint = vec3(0.94, 0.68, 0.58);
    vec3 copperDark = vec3(0.32, 0.16, 0.13);
    float sheen = softboxL * 1.15 + softboxR * 0.75 + topLight * 0.6;
    float midGrad = 0.5 + 0.5 * dot(n, normalize(vec3(-0.4, 0.3, 0.85)));
    vec3 col = mix(copperDark, copperTint, smoothstep(0.05, 0.92, midGrad * 0.72 + sheen * 0.55));
    col += vec3(1.0, 0.92, 0.88) * pow(max(dot(ref, normalize(vec3(-0.6, 0.25, 0.75))), 0.0), 28.0) * 0.85;
    return col + copperTint * fresnel * 0.25 + glowColor * glassBounce * 0.28;
  } else if (finish == 3) {
    vec3 baseCol = vec3(0.055, 0.048, 0.062);
    float diff = max(dot(n, normalize(vec3(-0.4, 0.5, 0.75))), 0.0);
    return baseCol * (0.65 + 0.65 * diff) + vec3(0.18, 0.16, 0.2) * fresnel * 0.45 + glowColor * glassBounce * 0.52;
  } else {
    vec3 baseCol = mix(vec3(0.22, 0.24, 0.3), glowColor, 0.48);
    float rim = pow(1.0 - max(dot(-rd, n), 0.0), 2.5);
    return baseCol * (0.45 + 0.55 * (softboxL + softboxR * 0.6)) + vec3(0.95) * rim * 0.48 + glowColor * glassBounce * 0.75;
  }
}

// --- Render Lava Lamp Instance with Analytical Bounding Cylinder Clip ---
vec4 renderLamp(vec2 p, int shape, float scale, vec3 bgBehind) {
  vec2 lp = p / max(scale, 0.1);
  if (abs(uTilt) > 0.0001) {
    lp = rot2(uTilt) * lp;
  }

  vec3 ro = vec3(uParallax.x * 0.22, uParallax.y * 0.14, 2.35);
  vec3 rd = normalize(vec3(lp - ro.xy * 0.08, -2.15));
  vec4 bounds = getVesselBounds(shape);

  // Mode 4: Pure Borderless Fluid
  if (shape == 4) {
    float t = 0.0;
    bool hit = false;
    vec3 hitPos = vec3(0.0);
    for (int i = 0; i < 28; i++) {
      vec3 q = ro + rd * t;
      float d = mapWax(q, bounds, true);
      if (d < 0.003) {
        hit = true;
        hitPos = q;
        break;
      }
      t += max(d, 0.022);
      if (t > 4.2) break;
    }

    vec3 bgFluid = mix(bgBehind, uLiquidColor, uLiquidDensity * 0.85);
    float bottomRad = exp(-length(lp - vec2(0.0, -0.58)) * 2.1) * uBottomGlow;
    bgFluid += mix(uWaxHot, uLiquidColor, 0.3) * bottomRad * 0.55;

    if (uParticles > 0.01) {
      float g1 = evalGlitter(vec3(lp * 0.65, 0.1), bounds);
      bgFluid += mix(uWaxHot, vec3(1.0), 0.55) * g1 * 1.1;
    }

    if (!hit) {
      return vec4(bgFluid, uTransparentBg == 1 ? clamp(uLiquidDensity * 0.6 + bottomRad * 0.4, 0.0, 1.0) : 1.0);
    }

    vec3 n = calcWaxNormal(hitPos, bounds, true);
    float fres = pow(1.0 - max(dot(-rd, n), 0.0), 2.2);
    float heat = clamp(1.0 - (hitPos.y + 0.55) * 0.85, 0.0, 1.0);
    vec3 waxCol = mix(uWaxCool, uWaxHot, pow(heat, 0.85));
    float diff = 0.35 + 0.65 * max(dot(n, normalize(vec3(-0.4, -0.55, 0.72))), 0.0);
    float spec = pow(max(dot(reflect(rd, n), normalize(vec3(-0.5, 0.45, 0.74))), 0.0), 26.0);
    vec3 col = waxCol * (diff + uSubsurface * (0.45 + 0.65 * fres)) + uWaxHot * bottomRad * 0.4;
    col += vec3(1.0) * spec * 0.45 * uGlassRefraction;
    return vec4(col, 1.0);
  }

  // Exact analytical ray vs bounding cylinder clip (skips >80% of screen pixels instantly!)
  float maxR = getMaxVesselRadius(shape) + 0.018;
  if (lp.y < bounds.z - 0.12 || lp.y > bounds.w + 0.12) {
    return vec4(0.0);
  }

  float a = dot(rd.xz, rd.xz);
  float b = dot(ro.xz, rd.xz);
  float c = dot(ro.xz, ro.xz) - maxR * maxR;
  float disc = b * b - a * c;
  if (disc < 0.0) {
    return vec4(0.0);
  }

  float sqrtDisc = sqrt(disc);
  float tNear = max((-b - sqrtDisc) / a, 0.0);
  float tFar = (-b + sqrtDisc) / a;
  if (tFar < 0.0) {
    return vec4(0.0);
  }

  // Tight raymarch starting right on the bounding cylinder
  float t = tNear;
  bool hitShell = false;
  vec3 pos = vec3(0.0);

  for (int i = 0; i < 18; i++) {
    pos = ro + rd * t;
    float d = sdVesselOuter(pos, shape, bounds);
    if (d < 0.0016) {
      hitShell = true;
      break;
    }
    t += max(d, 0.01);
    if (t > tFar + 0.02) break;
  }

  if (!hitShell) {
    return vec4(0.0);
  }

  vec3 nOuter = calcVesselNormal(pos, shape, bounds);
  bool isGlass = (pos.y > bounds.x + 0.004 && pos.y < bounds.y - 0.004);

  if (!isGlass) {
    vec3 metalCol = shadeMetal(pos, nOuter, rd, uMetalFinish, bounds);
    float seamDist = min(abs(pos.y - bounds.x), abs(pos.y - bounds.y));
    metalCol *= mix(0.62, 1.0, smoothstep(0.0, 0.012, seamDist));
    return vec4(metalCol, 1.0);
  }

  // --- Inside Glass Body ---
  float ndotv = max(dot(-rd, nOuter), 0.0);
  float fresnel = pow(1.0 - ndotv, 3.2);
  float glassRim = pow(1.0 - ndotv, 1.6);

  vec3 rdIn = normalize(mix(rd, refract(rd, nOuter, 1.0 / (1.0 + 0.28 * uGlassRefraction)), 0.75));

  float tIn = 0.012;
  float maxIn = maxR * 2.15;
  bool hitWax = false;
  vec3 waxPos = vec3(0.0);
  float waxGlowAccum = 0.0;
  float glitterAccum = 0.0;
  float liquidPath = 0.0;

  for (int i = 0; i < 24; i++) {
    vec3 q = pos + rdIn * tIn;
    float rWall = getVesselRadius(clamp(q.y, bounds.x, bounds.y), shape);
    if (length(q.xz) > rWall + 0.006 || q.y < bounds.x - 0.01 || q.y > bounds.y + 0.01) {
      liquidPath = tIn;
      break;
    }

    float dw = mapWax(q, bounds, false);
    waxGlowAccum += exp(-max(dw, 0.0) * 16.0) * 0.036;

    if (uParticles > 0.01 && (i == 5 || i == 13)) {
      glitterAccum += evalGlitter(q, bounds) * 1.45;
    }

    if (dw < 0.0028) {
      hitWax = true;
      waxPos = q;
      liquidPath = tIn;
      break;
    }

    tIn += clamp(dw * 0.85, 0.01, 0.042);
    if (tIn > maxIn) {
      liquidPath = maxIn;
      break;
    }
  }

  float hNorm = clamp((pos.y - bounds.x) / max(bounds.y - bounds.x, 0.01), 0.0, 1.0);
  float bulbDist = length(vec2(pos.x, (pos.y - bounds.x) * 1.15));
  float bulbLight = exp(-bulbDist * 3.4) * uBottomGlow;
  float bulbCore = exp(-bulbDist * 9.5) * uBottomGlow;

  float liqAlpha = clamp(uLiquidDensity * (0.55 + 1.45 * liquidPath), 0.0, 0.96);
  vec3 liquidCol = uLiquidColor * (0.62 + 0.55 * (1.0 - hNorm * 0.45));
  vec3 bulbTint = mix(uWaxHot, vec3(1.0, 0.96, 0.9), 0.45);
  liquidCol += bulbTint * bulbLight * (0.42 + 0.35 * (1.0 - uLiquidDensity * 0.5));
  liquidCol += mix(uWaxCool, uWaxHot, 0.5) * waxGlowAccum * (0.45 + 0.4 * uSubsurface);

  vec3 interiorColor = mix(bgBehind, liquidCol, liqAlpha);
  interiorColor += uLiquidColor * glassRim * (0.18 + 0.35 * uLiquidDensity);

  if (hitWax) {
    vec3 nw = calcWaxNormal(waxPos, bounds, false);
    float waxH = clamp((waxPos.y - bounds.x) / max(bounds.y - bounds.x, 0.01), 0.0, 1.0);

    float innerD = mapWax(waxPos + rdIn * 0.045, bounds, false);
    float thinness = smoothstep(-0.045, 0.008, innerD);
    float waxRim = pow(1.0 - max(dot(-rdIn, nw), 0.0), 1.85);

    float heatFactor = clamp(pow(1.0 - waxH, 1.35) * (0.65 + 0.55 * uBottomGlow) + bulbCore * 0.55, 0.0, 1.0);
    vec3 baseWax = mix(uWaxCool, uWaxHot, heatFactor);

    vec3 bulbDir = normalize(vec3(0.0, bounds.x - 0.12, 0.08) - waxPos);
    float bulbDiff = max(dot(nw, bulbDir), 0.0);
    float keyDiff = max(dot(nw, normalize(vec3(-0.55, 0.35, 0.78))), 0.0);

    float sss = (0.35 + 0.65 * thinness + 0.45 * waxRim) * uSubsurface;
    vec3 waxShaded = baseWax * (0.28 + 0.52 * keyDiff + 0.65 * bulbDiff * (0.5 + 0.5 * uBottomGlow) + sss * 0.78);
    waxShaded += bulbTint * bulbCore * (0.65 + 0.45 * thinness);

    float waxSpec = pow(max(dot(reflect(rdIn, nw), normalize(vec3(-0.52, 0.32, 0.8))), 0.0), 22.0);
    waxShaded += mix(vec3(1.0), uWaxHot, 0.35) * waxSpec * 0.42;

    float frontTint = clamp(uLiquidDensity * liquidPath * 2.1, 0.0, 0.68);
    interiorColor = mix(waxShaded, liquidCol, frontTint * 0.58);
  } else {
    interiorColor += bulbTint * bulbCore * 0.58;
  }

  if (glitterAccum > 0.001) {
    vec3 sparkleCol = mix(uWaxHot, vec3(0.95, 0.99, 1.0), 0.55);
    interiorColor += sparkleCol * glitterAccum * 1.15;
  }

  vec3 refOut = reflect(rd, nOuter);
  float stripL = smoothstep(0.62, 0.94, dot(nOuter, normalize(vec3(-0.82, 0.08, 0.56))));
  float stripR = smoothstep(0.76, 0.97, dot(nOuter, normalize(vec3(0.86, 0.05, 0.50))));
  float specSharp = pow(max(dot(refOut, normalize(vec3(-0.72, 0.2, 0.66))), 0.0), 40.0);

  vec3 studioRefTint = uBgMode == 0 ? vec3(0.96, 0.97, 1.0) : vec3(0.78, 0.82, 0.90);
  vec3 glassReflectCol = mix(studioRefTint, vec3(uBgLuminance) + vec3(0.28), 0.2);
  interiorColor += glassReflectCol * (stripL * 0.34 + stripR * 0.24 + specSharp * 0.45) * uGlassRefraction;

  vec3 rimTint = mix(glassReflectCol, uWaxHot, 0.2);
  interiorColor = mix(interiorColor, rimTint, fresnel * 0.44 * uGlassRefraction);

  float seamTop = smoothstep(0.0, 0.025, bounds.y - pos.y);
  float seamBot = smoothstep(0.0, 0.022, pos.y - bounds.x);
  interiorColor *= mix(0.68, 1.0, seamTop);
  interiorColor += bulbTint * (1.0 - seamBot) * 0.38 * uBottomGlow;

  return vec4(interiorColor, 1.0);
}

// --- Unified Infinite Studio Cyclorama Backdrop (Light & Dark Modes) ---
vec3 renderBackground(vec2 p, int shape) {
  vec4 bounds = getVesselBounds(shape == 4 ? 0 : shape);
  float baseY = bounds.z * uScale + uOffset.y;
  float coveY = baseY + 0.07;

  float coveCurve = exp(-pow((p.y - coveY) * 2.75, 2.0));
  float floorMask = smoothstep(coveY + 0.38, coveY - 0.52, p.y);
  float wallSoftbox = exp(-length((p - vec2(-0.14, 0.26)) * vec2(0.72, 0.62)) * 1.12);
  float radialVignette = clamp(1.0 - dot(p * vec2(0.72, 0.85), p * vec2(0.72, 0.85)) * 0.16, 0.55, 1.0);

  float lumTune = clamp(uBgLuminance, 0.0, 1.0);
  vec3 col;

  if (uBgMode == 0) {
    float lift = mix(0.78, 1.04, lumTune);
    vec3 wallTop = vec3(0.955, 0.958, 0.966) * lift;
    vec3 wallKey = vec3(0.995, 0.995, 1.000) * lift;
    vec3 floorTone = vec3(0.905, 0.910, 0.922) * lift;

    col = mix(wallTop, wallKey, wallSoftbox * 0.55);
    col = mix(col, floorTone, floorMask * 0.58);
    col *= (1.0 - coveCurve * 0.042);
    col *= mix(0.91, 1.0, radialVignette);

    if (shape != 4) {
      vec2 spillP = (p - vec2(uOffset.x, baseY - 0.02)) * vec2(1.05, 2.8);
      float spill = exp(-dot(spillP, spillP) * 2.4) * (0.045 + 0.03 * uBottomGlow);
      col += mix(uLiquidColor, uWaxHot, 0.45) * spill;
    }
  } else {
    float lift = mix(0.35, 1.55, lumTune);
    vec3 darkWall = vec3(0.052, 0.055, 0.068) * lift;
    vec3 darkKey = vec3(0.105, 0.110, 0.132) * lift;
    vec3 darkFloor = vec3(0.038, 0.040, 0.050) * lift;

    col = mix(darkWall, darkKey, wallSoftbox * 0.65);
    col = mix(col, darkFloor, floorMask * 0.62);
    col *= (1.0 - coveCurve * 0.18);
    col *= mix(0.62, 1.0, radialVignette);

    if (shape != 4) {
      vec2 backSpillP = (p - vec2(uOffset.x, uOffset.y + 0.05)) * vec2(1.1, 0.78);
      float backSpill = exp(-dot(backSpillP, backSpillP) * 2.2) * (0.085 + 0.06 * uBottomGlow);
      vec2 floorSpillP = (p - vec2(uOffset.x, baseY - 0.03)) * vec2(0.95, 3.1);
      float floorSpill = exp(-dot(floorSpillP, floorSpillP) * 2.6) * (0.14 + 0.09 * uBottomGlow);
      vec3 lampSpillCol = mix(uLiquidColor, uWaxHot, 0.52);
      col += lampSpillCol * (backSpill + floorSpill);
    }
  }

  if (uStudioShadow > 0.01 && shape != 4) {
    vec2 sp = (p - uOffset) / max(uScale, 0.1);
    float shadowStrength = uBgMode == 0 ? 1.0 : 0.65;

    vec2 wallP = sp - vec2(0.42, -0.02);
    wallP.x -= (wallP.y - bounds.z) * 0.11;
    if (wallP.y > bounds.z - 0.05 && wallP.y < bounds.w + 0.05 && abs(wallP.x) < 0.45) {
      float r = getVesselRadius(clamp(wallP.y, bounds.z, bounds.w), shape) * 1.06;
      float edge = smoothstep(r + 0.09, r - 0.04, abs(wallP.x));
      float vFade = smoothstep(bounds.w + 0.04, bounds.w - 0.09, wallP.y) *
                    smoothstep(bounds.z - 0.04, bounds.z + 0.05, wallP.y);
      float isGlassShadow = smoothstep(bounds.x, bounds.x + 0.06, wallP.y) *
                            smoothstep(bounds.y, bounds.y - 0.06, wallP.y);
      float shadowMask = edge * vFade * uStudioShadow * 0.20 * shadowStrength;
      col = mix(col, col * (0.56 + 0.24 * isGlassShadow) + uLiquidColor * isGlassShadow * 0.05, shadowMask);
    }

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
  vec3 col = bg;
  float alpha = uTransparentBg == 1 ? 0.0 : 1.0;

  // Tightly culled Floor Reflection
  if (uFloorReflection > 0.01 && uVesselShape != 4) {
    vec4 bounds = getVesselBounds(uVesselShape);
    float floorY = bounds.z * uScale + uOffset.y;
    float maxR = getMaxVesselRadius(uVesselShape) * uScale * 1.38;
    float distBelow = floorY - p.y;
    if (distBelow > 0.0 && distBelow < 0.78 * uScale && abs(p.x - uOffset.x) < maxR) {
      vec2 reflP = vec2(p.x, floorY + distBelow * 1.05) - uOffset;
      vec4 reflLamp = renderLamp(reflP, uVesselShape, uScale, bg);
      float fade = exp(-distBelow * 3.8) * uFloorReflection * 0.65;
      col = mix(col, reflLamp.rgb, reflLamp.a * fade);
      if (uTransparentBg == 1) {
        alpha = max(alpha, reflLamp.a * fade);
      }
    }
  }

  // Primary Hero Lamp
  vec4 hero = renderLamp(p - uOffset, uVesselShape, uScale, bg);
  if (hero.a > 0.001) {
    col = mix(col, hero.rgb, hero.a);
    if (uTransparentBg == 1) alpha = max(alpha, hero.a);
  }

  // Analytic Optical Bloom (zero FBO / texture fetches, silky smooth glow)
  if (uBloom > 0.005) {
    vec4 bounds = getVesselBounds(uVesselShape == 4 ? 0 : uVesselShape);
    vec2 lp = (p - uOffset) / max(uScale, 0.1);
    float cy = clamp(lp.y, bounds.x, bounds.y);
    float dGlass = length(vec2(lp.x, lp.y - cy));
    float aura = exp(-dGlass * 3.6) * 0.55 + exp(-dGlass * 8.5) * 0.45;
    vec3 bloomCol = mix(uWaxCool, uWaxHot, clamp(1.0 - (cy - bounds.x) / max(bounds.y - bounds.x, 0.01), 0.0, 1.0));
    bloomCol = mix(bloomCol, uLiquidColor, 0.25);
    float modeAtten = uBgMode == 0 ? 0.32 : 0.72;
    col += bloomCol * aura * uBloom * (0.45 + 0.35 * uBottomGlow) * modeAtten;
    if (uTransparentBg == 1) {
      alpha = max(alpha, clamp(aura * uBloom * 0.45, 0.0, 1.0));
    }
  }

  // Inline Contrast, Saturation & ACES Filmic Tone Mapping
  col = (col - 0.5) * uContrast + 0.5;
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(luma), col, uSaturation), vec3(0.0));
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);

  // Subtle Photographic Film Grain
  if (uFilmGrain > 0.005) {
    float grain = hash12(gl_FragCoord.xy + fract(uTime * 17.3) * 1000.0) - 0.5;
    col += grain * 0.12 * uFilmGrain;
  }

  fragColor = vec4(clamp(col, 0.0, 1.0), uTransparentBg == 1 ? clamp(alpha, 0.0, 1.0) : 1.0);
}
`;
