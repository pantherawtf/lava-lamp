import type { BlobState, LavaConfig, VesselShape } from '../types/lava';

export const MAX_BLOBS = 9;

// Stratified vertical slots spanning bottom-to-top so ANY active count (1..9, including default 4)
// starts moderately spaced across the full chamber with natural pair-forming potential
const STRATIFIED_Y = [-0.24, 0.25, 0.03, -0.09, 0.33, -0.33, 0.16, -0.17, 0.09];

// Guarantees >= 33% (33%..50%) of active blobs act as organic counter-current swayers for every count 2..9
const COUNTER_ROLE_MASK = [false, true, false, true, false, false, true, false, false];

export interface WaxHitResult {
  /** Hit point in physics wax coordinate space */
  physX: number;
  physY: number;
  physZ: number;
  closestBlobIndex: number;
}

const PI = Math.PI;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function smin(a: number, b: number, k: number): number {
  const h = clamp(0.5 + (0.5 * (b - a)) / Math.max(k, 0.0001), 0, 1);
  return mix(b, a, h) - k * h * (1 - h);
}

function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

function vesselGlassYMin(shape: VesselShape): number {
  if (shape === 'astro') return -0.26;
  if (shape === 'capsule') return -0.34;
  if (shape === 'bullet') return -0.24;
  if (shape === 'organic') return -0.3;
  return -0.7;
}

function vesselGlassYMax(shape: VesselShape): number {
  if (shape === 'astro') return 0.56;
  if (shape === 'capsule') return 0.62;
  if (shape === 'bullet') return 0.56;
  if (shape === 'organic') return 0.56;
  return 0.7;
}

function vesselRadiusCpu(shape: VesselShape, y: number, widthRatio: number): number {
  const w = widthRatio;
  if (shape === 'astro') {
    const rFoot = 0.245 + (y + 0.9) * ((0.115 - 0.245) / 0.32);
    const rUpperBase = 0.115 + (y + 0.58) * ((0.255 - 0.115) / 0.32);
    const rBase = smax(rFoot, rUpperBase, 0.013);
    const tG = clamp((y + 0.26) / 0.82, 0, 1);
    const belly = Math.sin(clamp(tG * 4.2, 0, PI)) * 0.018 * (1 - tG);
    const rGlass = mix(0.255, 0.128, Math.pow(Math.max(tG, 1e-5), 0.94)) + belly;
    const tC = clamp((y - 0.56) / 0.32, 0, 1);
    const rCap = mix(0.128, 0.078, tC);
    const m1 = smoothstep(-0.274, -0.246, y);
    const m2 = smoothstep(0.548, 0.572, y);
    return Math.max(0.02, mix(mix(rBase, rGlass, m1), rCap, m2)) * w;
  }
  if (shape === 'capsule') {
    const tCup = clamp((y + 0.76) / 0.12, 0, 1);
    const rCup = mix(0.176, 0.228, Math.sin(tCup * PI * 0.5));
    const tDome = clamp((y - 0.7) / 0.18, 0, 0.998);
    const rDome = 0.228 * Math.sqrt(Math.max(0.0004, 1 - tDome * tDome));
    let r = mix(0.242, 0.172, smoothstep(-0.848, -0.832, y));
    r = mix(r, rCup, smoothstep(-0.768, -0.752, y));
    r = mix(r, 0.226, smoothstep(-0.352, -0.328, y));
    r = mix(r, rDome, smoothstep(0.61, 0.63, y));
    return Math.max(0.01, r) * w;
  }
  if (shape === 'bullet') {
    const tSaucer = clamp((y + 0.9) / 0.12, 0, 1);
    const rSaucer = mix(0.255, 0.088, Math.pow(Math.max(tSaucer, 1e-5), 0.68));
    const tChalice = clamp((y + 0.78) / 0.54, 0, 1);
    const rChalice = mix(0.09, 0.188, Math.pow(Math.max(tChalice, 1e-5), 0.88)) + Math.sin(tChalice * PI) * 0.012;
    const tSpindle = clamp((y + 0.24) / 0.8, 0, 1);
    const rSpindle =
      mix(0.188, 0.118, Math.pow(Math.max(tSpindle, 1e-5), 1.1)) +
      Math.sin(Math.pow(Math.max(tSpindle, 1e-5), 0.74) * PI) * 0.038;
    const tNose = clamp((y - 0.56) / 0.34, 0, 0.998);
    const rNose = 0.118 * Math.pow(Math.max(0.0004, 1 - tNose), 0.62);
    let r = mix(rSaucer, rChalice, smoothstep(-0.794, -0.766, y));
    r = mix(r, rSpindle, smoothstep(-0.254, -0.226, y));
    r = mix(r, rNose, smoothstep(0.548, 0.572, y));
    return Math.max(0.006, r) * w;
  }
  // organic
  const tBase = clamp((y + 0.88) / 0.58, 0, 1);
  const rBase = mix(0.24, 0.18, tBase) - Math.sin(tBase * PI) * 0.095;
  const tBody = clamp((y + 0.3) / 0.86, 0, 1);
  const rBody = mix(0.18, 0.118, tBody) + Math.sin(Math.pow(Math.max(tBody, 1e-5), 0.7) * PI) * 0.085;
  const tCap = clamp((y - 0.56) / 0.3, 0, 0.996);
  const rCap = 0.118 * Math.pow(Math.max(0.0004, Math.cos(tCap * PI * 0.5)), 0.72);
  const r = mix(mix(rBase, rBody, smoothstep(-0.314, -0.286, y)), rCap, smoothstep(0.548, 0.572, y));
  return Math.max(0.008, r) * w;
}

/**
 * Simulates thermal convection inside the lava lamp vessel.
 * Coordinate space inside glass:
 *   y in [-0.46, 0.46] (bottom bulb at -0.46, top cap at +0.46)
 *   x, z in [-0.22, 0.22] scaled by vessel taper in shader
 */
export class LavaPhysics {
  public blobs: BlobState[] = [];
  public time = 0;
  private uniformBuffer = new Float32Array(MAX_BLOBS * 4);
  private pairContact = new Float32Array(MAX_BLOBS * MAX_BLOBS);

  constructor(seed = 1337) {
    this.reset(seed);
  }

  public reset(seed = Math.floor(Math.random() * 100000)): void {
    this.time = 0;
    this.blobs = [];
    this.pairContact.fill(0);
    let s = seed >>> 0;
    const rand = () => {
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 4294967296;
    };

    const baseAngleOffset = rand() * Math.PI * 2;

    for (let i = 0; i < MAX_BLOBS; i++) {
      const baseRadius = 0.068 + rand() * 0.056;
      const y = clamp(STRATIFIED_Y[i] + (rand() - 0.5) * 0.065, -0.35, 0.34);
      const angle = baseAngleOffset + i * 2.39996 + (rand() - 0.5) * 0.45;
      const orbitRadius = 0.052 + (i % 3) * 0.022 + rand() * 0.018;
      const radial = orbitRadius * (0.78 + rand() * 0.35);
      const counterRole = COUNTER_ROLE_MASK[i] ?? i % 3 === 1;

      // Alternate hot/cool temperatures by vertical band & counter role so blobs immediately move in opposing currents
      const baseTemp =
        y < -0.12
          ? 0.7 + rand() * 0.24
          : y > 0.12
            ? 0.12 + rand() * 0.24
            : counterRole
              ? 0.22 + rand() * 0.22
              : 0.58 + rand() * 0.24;

      this.blobs.push({
        x: Math.cos(angle) * radial,
        y,
        z: Math.sin(angle) * radial * 0.78,
        vx: (rand() - 0.5) * 0.06,
        vy: (baseTemp - 0.5) * 0.12,
        vz: (rand() - 0.5) * 0.05,
        radius: baseRadius,
        baseRadius,
        temp: clamp(baseTemp, 0.08, 0.94),
        phase: rand() * Math.PI * 2,
        driftFreq: 0.34 + rand() * 0.58,
        thermalRate: 0.72 + rand() * 0.62,
        buoyancyBias: (rand() - 0.5) * 0.085,
        orbitRadius,
        orbitSign: counterRole ? -1 : i % 2 === 0 ? 1 : -1,
        wanderSeed: rand() * Math.PI * 2,
        counterRole,
      });
    }
  }

  public cloneState(): { time: number; blobs: BlobState[]; pairContact: number[] } {
    return {
      time: this.time,
      blobs: this.blobs.map((b) => ({ ...b })),
      pairContact: Array.from(this.pairContact),
    };
  }

  public loadState(state: { time: number; blobs: BlobState[]; pairContact?: number[] }): void {
    this.time = state.time;
    this.blobs = state.blobs.map((b) => ({ ...b }));
    this.pairContact.fill(0);
    if (state.pairContact) {
      const len = Math.min(this.pairContact.length, state.pairContact.length);
      for (let i = 0; i < len; i++) {
        this.pairContact[i] = state.pairContact[i];
      }
    }
  }

  /**
   * Injects a gentle buoyancy / stir impulse from user interaction on the canvas
   */
  public applyImpulse(normX: number, normY: number, dx: number, dy: number): void {
    const targetX = normX * 0.22;
    const targetY = normY * 0.44;
    for (const b of this.blobs) {
      const distSq = (b.x - targetX) ** 2 + (b.y - targetY) ** 2;
      const influence = Math.exp(-distSq * 14.0);
      b.vx += dx * 0.65 * influence;
      b.vy += dy * 0.65 * influence;
      b.temp = Math.min(1, Math.max(0, b.temp + dy * 0.45 * influence));
    }
  }

  /**
   * Injects vigorous sloshing agitation inside the glass chamber during mobile drag/shake
   */
  public applyShakeImpulse(vx: number, vy: number, energy: number, activeCount: number): void {
    const count = Math.max(1, Math.min(activeCount, this.blobs.length));
    const clampedEnergy = clamp(energy, 0, 2.4);
    for (let i = 0; i < this.blobs.length; i++) {
      const b = this.blobs[i];
      const swirlSign = i % 2 === 0 ? 1 : -1;
      const jitter = Math.sin(this.time * 7.5 + b.phase + i * 1.7);
      const scale = i < count ? 1.0 : 0.65;
      b.vx += (vx * 0.36 + swirlSign * jitter * 0.14 * clampedEnergy) * scale;
      b.vy += (vy * 0.32 + Math.cos(this.time * 6.2 + b.phase) * 0.16 * clampedEnergy) * scale;
      b.vz += (swirlSign * vx * 0.22 + jitter * 0.12 * clampedEnergy) * scale;
      // Keep velocities bounded so blobs remain smoothly physical inside the vessel
      b.vx = clamp(b.vx, -1.35, 1.35);
      b.vy = clamp(b.vy, -1.35, 1.35);
      b.vz = clamp(b.vz, -1.0, 1.0);
      b.temp = clamp(b.temp + (vy * 0.08 + jitter * 0.04 * clampedEnergy), 0.08, 0.94);
    }
  }

  /**
   * Exact 3D raycast against the visible wax metaballs (matching shader projection & SDF).
   * Returns hit details strictly when the tap lands on the molten wax space, or null otherwise.
   */
  public hitTestWax(
    clientX: number,
    clientY: number,
    rect: DOMRect,
    config: LavaConfig,
    parallax: [number, number],
    transientOffset?: { offsetX: number; offsetY: number; tilt: number; scaleMultiplier?: number }
  ): WaxHitResult | null {
    if (rect.width <= 0 || rect.height <= 0) return null;

    // Match GLSL gl_FragCoord convention (origin bottom-left)
    const pScreenX = (clientX - rect.left - 0.5 * rect.width) / rect.height;
    const pScreenY = -(clientY - rect.top - 0.5 * rect.height) / rect.height;

    // Camera basis identical to shaders.ts
    const roX = parallax[0] * 0.28;
    const roY = parallax[1] * 0.16;
    const roZ = 2.75;
    const cwLen = Math.hypot(-roX, -roY, -roZ);
    const cwX = -roX / cwLen;
    const cwY = -roY / cwLen;
    const cwZ = -roZ / cwLen;

    // cu = normalize(cross(cw, (0,1,0))) = normalize((-cwZ, 0, cwX))
    const cuLen = Math.hypot(-cwZ, cwX) || 1;
    const cuX = -cwZ / cuLen;
    const cuY = 0;
    const cuZ = cwX / cuLen;

    // cv = cross(cu, cw)
    const cvX = cuY * cwZ - cuZ * cwY;
    const cvY = cuZ * cwX - cuX * cwZ;
    const cvZ = cuX * cwY - cuY * cwX;

    let rdX = pScreenX * cuX + pScreenY * cvX + 1.85 * cwX;
    let rdY = pScreenX * cuY + pScreenY * cvY + 1.85 * cwY;
    let rdZ = pScreenX * cuZ + pScreenY * cvZ + 1.85 * cwZ;
    const rdLen = Math.hypot(rdX, rdY, rdZ) || 1;
    rdX /= rdLen;
    rdY /= rdLen;
    rdZ /= rdLen;

    const effOffsetX = config.offsetX + (transientOffset?.offsetX ?? 0);
    const effOffsetY = config.offsetY + (transientOffset?.offsetY ?? 0);
    const effTilt = config.tilt + (transientOffset?.tilt ?? 0);
    const safeScale = Math.max(0.12, config.scale * 0.7 * (transientOffset?.scaleMultiplier ?? 1));
    const invScale = 1 / safeScale;

    // Transform into lamp local space (matches GLSL column-major mat2(c, -s, s, c))
    const c = Math.cos(-effTilt);
    const s = Math.sin(-effTilt);
    const ox = roX - effOffsetX * 1.45;
    const oy = roY - effOffsetY * 1.45;
    const roLX = (c * ox + s * oy) * invScale;
    const roLY = (-s * ox + c * oy) * invScale;
    const roLZ = roZ * invScale;

    const rdLX = c * rdX + s * rdY;
    const rdLY = -s * rdX + c * rdY;
    const rdLZ = rdZ;

    const shape = config.vesselShape;
    const w = config.widthRatio;
    const boundR = (shape === 'fluid' ? 0.56 : 0.34) * w + 0.06;

    // Intersect bounding cylinder in XZ
    const a = rdLX * rdLX + rdLZ * rdLZ;
    const b = roLX * rdLX + roLZ * rdLZ;
    const cc = roLX * roLX + roLZ * roLZ - boundR * boundR;
    const disc = b * b - a * cc;
    if (disc < 0 || a < 1e-6) return null;
    const sq = Math.sqrt(disc);
    const tStart = Math.max(0.05, (-b - sq) / a);
    const tEnd = Math.min(32.0, (-b + sq) / a);
    if (tStart >= tEnd) return null;

    const gMin = vesselGlassYMin(shape);
    const gMax = vesselGlassYMax(shape);
    const gSpan = gMax - gMin;
    const k = Math.max(0.025, config.viscosity * 0.56);
    const activeCount = Math.max(1, Math.min(config.blobCount, this.blobs.length));

    // Precompute mapped blob centers in lamp-local space (matches shader mapWax)
    const mappedBlobs: { x: number; y: number; z: number; r: number }[] = [];
    for (let i = 0; i < activeCount; i++) {
      const bl = this.blobs[i];
      if (bl.radius <= 0.001) continue;
      const yNorm = clamp((bl.y + 0.46) / 0.92, 0, 1);
      const by = gMin + 0.06 + yNorm * (gSpan - 0.12);
      let br = bl.radius * (shape === 'fluid' ? 1.55 : 1.18) * Math.sqrt(w);
      const wallR = shape === 'fluid' ? 0.45 * w : Math.max(0.05, vesselRadiusCpu(shape, by, w) - 0.022);
      br = Math.min(br, wallR * 0.78);
      const maxCenter = Math.max(0.01, wallR - br * 0.72);
      let bxzX = bl.x * (shape === 'fluid' ? 1.45 : 0.95 * w);
      let bxzZ = bl.z * (shape === 'fluid' ? 1.45 : 0.95 * w);
      const distXZ = Math.hypot(bxzX, bxzZ);
      if (distXZ > maxCenter) {
        const sc = maxCenter / distXZ;
        bxzX *= sc;
        bxzZ *= sc;
      }
      mappedBlobs.push({ x: bxzX, y: by, z: bxzZ, r: br });
    }

    const evalWaxSdf = (px: number, py: number, pz: number): number => {
      let d = 1e4;
      for (let i = 0; i < mappedBlobs.length; i++) {
        const mb = mappedBlobs[i];
        const qx = px - mb.x;
        const qy = (py - mb.y) * 0.86;
        const qz = pz - mb.z;
        const sd = Math.hypot(qx, qy, qz) - mb.r;
        d = smin(d, sd, k);
      }
      if (shape !== 'fluid') {
        const poolR = vesselRadiusCpu(shape, gMin + 0.02, w) * 0.84;
        const qpx = px - Math.sin(this.time * 0.55) * 0.02;
        const qpy = (py - (gMin + 0.014)) * 2.45;
        const qpz = pz - Math.cos(this.time * 0.48) * 0.02;
        const dPool = Math.hypot(qpx, qpy, qpz) - poolR;
        d = smin(d, dPool, k * 0.85);

        const innerWall = vesselRadiusCpu(shape, clamp(py, gMin, gMax), w) - 0.016;
        const dWall = Math.hypot(px, pz) - innerWall;
        const dCaps = Math.max(gMin + 0.008 - py, py - (gMax - 0.022));
        d = Math.max(d, Math.max(dWall, dCaps));
      }
      return d;
    };

    // Determine ray entry into glass chamber (or free fluid volume)
    let roInX = roLX + rdLX * tStart;
    let roInY = roLY + rdLY * tStart;
    let roInZ = roLZ + rdLZ * tStart;
    let rdInX = rdLX;
    let rdInY = rdLY;
    let rdInZ = rdLZ;
    let maxTrace = tEnd - tStart;

    if (shape !== 'fluid') {
      // First intersect outer lamp shell to confirm tap hit the glass chamber (not metal base/cap)
      let tOut = tStart;
      let hitGlass = false;
      for (let i = 0; i < 48; i++) {
        const px = roLX + rdLX * tOut;
        const py = roLY + rdLY * tOut;
        const pz = roLZ + rdLZ * tOut;
        const yBot = -0.9;
        const yTop = shape === 'bullet' ? 0.9 : 0.88;
        const yc = clamp(py, yBot, yTop);
        const r = vesselRadiusCpu(shape, yc, w);
        const dRad = (Math.hypot(px, pz) - r) * 0.82;
        const dCap = Math.max(yBot - py, py - yTop);
        const dOuter = dCap > 0 ? Math.hypot(Math.max(dRad, 0), dCap) : Math.max(dRad, dCap);
        if (dOuter < 0.004) {
          if (py >= gMin && py <= gMax) {
            hitGlass = true;
            // Approximate outward radial normal for refraction matching shader
            const xzLen = Math.hypot(px, pz) || 1;
            const nx = px / xzLen;
            const nz = pz / xzLen;
            const ior = mix(1.04, 1.24, config.glassRefraction);
            const eta = 1 / ior;
            const dotNI = nx * rdLX + nz * rdLZ;
            const kRef = 1 - eta * eta * (1 - dotNI * dotNI);
            if (kRef >= 0) {
              const sRef = eta * dotNI + Math.sqrt(kRef);
              rdInX = eta * rdLX - sRef * nx;
              rdInY = eta * rdLY;
              rdInZ = eta * rdLZ - sRef * nz;
              const rl = Math.hypot(rdInX, rdInY, rdInZ) || 1;
              rdInX /= rl;
              rdInY /= rl;
              rdInZ /= rl;
            }
            roInX = px + rdInX * 0.008;
            roInY = py + rdInY * 0.008;
            roInZ = pz + rdInZ * 0.008;
            maxTrace = boundR * 2.1;
          }
          break;
        }
        tOut += Math.max(dOuter * 0.82, 0.004);
        if (tOut > tEnd) break;
      }
      if (!hitGlass) return null;
    }

    // Raymarch the internal wax SDF
    let tIn = 0;
    for (let j = 0; j < 44; j++) {
      const px = roInX + rdInX * tIn;
      const py = roInY + rdInY * tIn;
      const pz = roInZ + rdInZ * tIn;
      if (tIn > maxTrace) break;
      if (shape !== 'fluid') {
        if (py < gMin - 0.02 || py > gMax + 0.02) break;
        const wallR = vesselRadiusCpu(shape, clamp(py, gMin, gMax), w);
        if (Math.hypot(px, pz) > wallR + 0.02 && tIn > 0.03) break;
      }

      const dW = evalWaxSdf(px, py, pz);
      // Slight touch-friendly tolerance (0.015) hugging the exact visible wax contour
      if (dW < 0.015) {
        // Find closest active blob for natural budding origin
        let closestIdx = 0;
        let closestDist = Infinity;
        for (let i = 0; i < mappedBlobs.length; i++) {
          const mb = mappedBlobs[i];
          const dist = Math.hypot(px - mb.x, py - mb.y, pz - mb.z);
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = i;
          }
        }
        const physY = clamp(((py - (gMin + 0.06)) / Math.max(0.05, gSpan - 0.12)) * 0.92 - 0.46, -0.38, 0.36);
        const invXZ = shape === 'fluid' ? 1 / 1.45 : 1 / Math.max(0.2, 0.95 * w);
        const physX = clamp(px * invXZ, -0.14, 0.14);
        const physZ = clamp(pz * invXZ, -0.11, 0.11);
        return { physX, physY, physZ, closestBlobIndex: closestIdx };
      }

      tIn += clamp(dW * 0.8, 0.008, 0.042);
    }

    return null;
  }

  /**
   * Splits a new daughter blob organically from the tapped wax blob when multiplying (+1)
   */
  public splitBlobAt(hit: WaxHitResult, nextCount: number, waxScale: number): void {
    const newIndex = clamp(nextCount - 1, 0, this.blobs.length - 1);
    const parent = this.blobs[clamp(hit.closestBlobIndex, 0, Math.max(0, newIndex - 1))];
    const child = this.blobs[newIndex];

    const angle = this.time * 3.7 + newIndex * 2.39996;
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle) * 0.7;
    const dirY = hit.physY > 0.18 ? -0.75 : 0.85;

    // Spawn daughter blob overlapping the tapped point and kick it gently apart
    child.x = clamp(hit.physX + dirX * 0.036, -0.14, 0.14);
    child.y = clamp(hit.physY + dirY * 0.038, -0.36, 0.34);
    child.z = clamp(hit.physZ + dirZ * 0.026, -0.11, 0.11);
    child.vx = dirX * 0.36;
    child.vy = dirY * 0.44;
    child.vz = dirZ * 0.26;
    child.baseRadius = 0.068 + ((newIndex * 37) % 100) * 0.00048;
    child.radius = child.baseRadius * waxScale;
    child.temp = dirY > 0 ? 0.82 : 0.24;
    child.phase = angle;
    child.counterRole = COUNTER_ROLE_MASK[newIndex] ?? newIndex % 3 === 1;

    // Reset contact dwell for the newly split blob so it separates cleanly
    for (let k = 0; k < MAX_BLOBS; k++) {
      this.pairContact[newIndex * MAX_BLOBS + k] = 0;
      this.pairContact[k * MAX_BLOBS + newIndex] = 0;
    }

    // Subtle opposite recoil on parent blob so the split feels genuinely elastic
    if (parent && parent !== child) {
      parent.vx = clamp(parent.vx - dirX * 0.2, -0.9, 0.9);
      parent.vy = clamp(parent.vy - dirY * 0.16, -0.9, 0.9);
      parent.vz = clamp(parent.vz - dirZ * 0.15, -0.7, 0.7);
    }
  }

  /**
   * Resets cleanly back to 1 iconic molten wax drop after reaching max blob count (9 -> 1)
   */
  public coalesceToSingleBlob(hit: WaxHitResult, waxScale: number): void {
    this.pairContact.fill(0);
    const primary = this.blobs[0];
    primary.x = clamp(hit.physX * 0.45, -0.06, 0.06);
    primary.y = clamp(hit.physY, -0.22, 0.22);
    primary.z = clamp(hit.physZ * 0.4, -0.05, 0.05);
    primary.vx = (hit.physX >= 0 ? -1 : 1) * 0.14;
    primary.vy = hit.physY > 0 ? -0.26 : 0.34;
    primary.vz = 0;
    primary.baseRadius = 0.118;
    primary.radius = primary.baseRadius * waxScale;
    primary.temp = hit.physY > 0 ? 0.24 : 0.82;
  }

  /**
   * Pushes the molten wax cleanly to the opposite side (horizontally and vertically)
   * of where it is currently positioned, reversing convection phase so it glides across.
   */
  public stirOpposite(activeCount: number): void {
    const count = Math.max(1, Math.min(activeCount, this.blobs.length));
    let avgX = 0;
    let avgY = 0;
    let avgZ = 0;
    for (let i = 0; i < count; i++) {
      avgX += this.blobs[i].x;
      avgY += this.blobs[i].y;
      avgZ += this.blobs[i].z;
    }
    avgX /= count;
    avgY /= count;
    avgZ /= count;

    for (let i = 0; i < this.blobs.length; i++) {
      const b = this.blobs[i];

      // Determine current horizontal side (fallback to cluster side, then alternating if dead-center)
      const refX =
        Math.abs(b.x) > 0.012 ? b.x : Math.abs(avgX) > 0.008 ? avgX : i % 2 === 0 ? 0.06 : -0.06;
      const refZ =
        Math.abs(b.z) > 0.012 ? b.z : Math.abs(avgZ) > 0.008 ? avgZ : i % 2 === 0 ? -0.05 : 0.05;
      const refY = Math.abs(b.y) > 0.04 ? b.y : avgY;

      const oppX = refX >= 0 ? -1 : 1;
      const oppZ = refZ >= 0 ? -1 : 1;
      const oppY = refY >= 0 ? -1 : 1;

      // Gently glide toward the opposite side with a slight curved arc (+30% intensity)
      const curveX = -refZ * b.orbitSign * 0.585;
      const curveZ = refX * b.orbitSign * 0.585;

      b.vx = clamp(b.vx * 0.45 + oppX * (0.169 + Math.abs(b.x) * 0.442) + curveX, -0.39, 0.39);
      b.vz = clamp(b.vz * 0.45 + oppZ * (0.124 + Math.abs(b.z) * 0.338) + curveZ, -0.312, 0.312);
      b.vy = clamp(b.vy * 0.45 + oppY * (0.195 + Math.abs(b.y) * 0.338), -0.416, 0.416);

      // Softly nudge thermal buoyancy instead of abruptly snapping to extremes
      const targetTemp = oppY > 0 ? 0.76 : 0.24;
      b.temp = clamp(mix(b.temp, targetTemp, 0.6), 0.12, 0.88);

      // Staggered phase shift keeps the sweep fluid and desynchronized
      b.phase += 1.25 + (i % 3) * 0.32;
    }
  }

  public step(dt: number, speed: number, activeCount: number, waxScale: number): void {
    // 0..1 normalized slider scale where 0.50 (50%) maps exactly to legacy 2.22x speed (factor = 4.44)
    const effectiveSpeed = Math.max(0, speed) * 4.44;
    const totalSimDt = Math.min(dt, 0.05) * effectiveSpeed;
    if (totalSimDt <= 0) {
      for (let i = 0; i < MAX_BLOBS; i++) {
        const b = this.blobs[i];
        const pulse = 1.0 + 0.08 * Math.sin(this.time * 1.05 + b.phase) + (b.temp - 0.5) * 0.13;
        b.radius = b.baseRadius * waxScale * pulse;
      }
      return;
    }

    const subSteps = Math.min(6, Math.max(1, Math.ceil(totalSimDt / 0.045)));
    const subDt = totalSimDt / subSteps;
    for (let s = 0; s < subSteps; s++) {
      this.stepSub(subDt, activeCount, waxScale);
    }
  }

  private stepSub(clampedDt: number, activeCount: number, waxScale: number): void {
    this.time += clampedDt;

    const count = Math.max(1, Math.min(activeCount, MAX_BLOBS));
    const bottomY = -0.39;
    const topY = 0.38;

    // 1. Individual desynchronized thermal convection + aperiodic 3D lane wandering
    for (let i = 0; i < MAX_BLOBS; i++) {
      const b = this.blobs[i];
      const t1 = this.time * b.driftFreq * 0.52 + b.phase;
      const t2 = this.time * (b.driftFreq * 0.31 + 0.17) + b.wanderSeed;
      const aperiodicWave = Math.sin(t1) * Math.cos(t2 * 0.83) + 0.45 * Math.sin(t2 * 1.41 + i);

      // Desynchronized heating near bottom bulb & cooling near top cap
      if (b.y < -0.19) {
        const heatRate =
          (0.32 + 0.18 * (0.5 + 0.5 * aperiodicWave)) * b.thermalRate * (-0.19 - b.y + 0.19);
        b.temp = Math.min(1.0, b.temp + heatRate * clampedDt * 1.38);
      } else if (b.y > 0.19) {
        const coolRate =
          (0.3 + 0.16 * (0.5 - 0.5 * aperiodicWave)) * b.thermalRate * (b.y - 0.19 + 0.19);
        b.temp = Math.max(0.0, b.temp - coolRate * clampedDt * 1.32);
      } else {
        // Gentle mid-vessel thermal wander so drops occasionally turn mid-height like real lava wax
        const midDrift = (0.055 * aperiodicWave + (b.counterRole ? Math.cos(t2 * 1.2) * 0.045 : 0)) * b.thermalRate;
        b.temp = clamp(b.temp + midDrift * clampedDt, 0.05, 0.95);
      }

      // Buoyancy force from individual temperature & neutral point
      const buoyancy = (b.temp - (0.5 + b.buoyancyBias)) * 0.39;
      b.vy += (buoyancy + Math.sin(t2 * 0.95 + b.phase) * 0.032) * clampedDt;

      // Preferred lateral 3D lane so drops spread organically across the vessel instead of stacking at x=0
      const maxR = Math.max(0.068, 0.158 - (b.y + 0.4) * 0.068);
      const laneR = Math.min(maxR * 0.86, b.orbitRadius * (0.74 + 0.36 * Math.sin(t2 * 0.78)));
      const orbitAngle = b.orbitSign * (t1 * 0.62 + 0.68 * Math.sin(t2 * 0.72) + b.y * 2.1);
      const targetX = Math.cos(orbitAngle) * laneR;
      const targetZ = Math.sin(orbitAngle) * laneR * 0.8;

      const wanderX = Math.sin(t1 * 1.27 + b.y * 3.4) * 0.052 + Math.cos(t2 * 1.63) * 0.036;
      const wanderZ = Math.cos(t1 * 1.13 - b.y * 2.8) * 0.044 + Math.sin(t2 * 1.49) * 0.03;

      b.vx += ((targetX - b.x) * 0.38 + wanderX) * clampedDt;
      b.vz += ((targetZ - b.z) * 0.42 + wanderZ) * clampedDt;
    }

    // 2. Organic counter-current swaying (~33%..50% of active drops sway gently against nearby peers)
    for (let i = 0; i < count; i++) {
      const b = this.blobs[i];
      if (!b.counterRole) continue;

      let weightSum = 0;
      let peerVx = 0;
      let peerVy = 0;
      let peerVz = 0;
      let peerX = 0;
      let peerY = 0;
      let peerZ = 0;

      for (let j = 0; j < count; j++) {
        if (i === j) continue;
        const o = this.blobs[j];
        const dx = o.x - b.x;
        const dy = o.y - b.y;
        const dz = o.z - b.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 0.42) {
          const w = 1 - dist / 0.42;
          weightSum += w;
          peerVx += o.vx * w;
          peerVy += o.vy * w;
          peerVz += o.vz * w;
          peerX += o.x * w;
          peerY += o.y * w;
          peerZ += o.z * w;
        }
      }

      if (weightSum > 0.001) {
        const invW = 1 / weightSum;
        peerVx *= invW;
        peerVy *= invW;
        peerVz *= invW;
        peerX *= invW;
        peerY *= invW;
        peerZ *= invW;

        // Smooth harmonic sway perpendicular to neighbor axis + gentle opposing counter-current
        const swayWave = Math.sin(this.time * (0.95 + b.driftFreq * 0.5) + b.phase);
        const relX = b.x - peerX;
        const relY = b.y - peerY;
        const relZ = b.z - peerZ;
        const relLen = Math.hypot(relX, relZ) + 0.04;
        const perpX = -relZ / relLen;
        const perpZ = relX / relLen;

        b.vx += (-peerVx * 0.34 + perpX * swayWave * 0.095) * clampedDt;
        b.vy += (-peerVy * 0.24 + Math.cos(this.time * 0.85 + b.wanderSeed) * 0.042) * clampedDt;
        b.vz += (-peerVz * 0.34 + perpZ * swayWave * 0.075) * clampedDt;

        // Subtle opposing thermal lean when locked at nearly the same height as peers
        if (Math.abs(relY) < 0.14) {
          const thermalPush = (relY >= 0 ? 1 : -1) * 0.075;
          b.temp = clamp(b.temp + thermalPush * clampedDt, 0.06, 0.94);
        }
      }
    }

    // 3. Pairwise moderate spacing + "kiss and quick separate" elastic dynamics
    for (let i = 0; i < count; i++) {
      const b = this.blobs[i];
      for (let j = i + 1; j < count; j++) {
        const o = this.blobs[j];
        const pairIdx = i * MAX_BLOBS + j;
        const dx = b.x - o.x;
        const dy = b.y - o.y;
        const dz = b.z - o.z;
        const d2 = dx * dx + dy * dy + dz * dz + 0.0008;
        const d = Math.sqrt(d2);

        const sumR = Math.max(0.08, b.radius + o.radius);
        // Moderate comfort zone keeps natural spacing while still welcoming occasional close pairs
        const comfortD = Math.max(0.19, sumR * 2.15);
        // Visual metaball fusion/kiss threshold
        const kissD = Math.max(0.122, sumR * 1.48);

        if (d < comfortD) {
          const nx = dx / d;
          const ny = dy / d;
          const nz = dz / d;

          // Gentle comfort spacing (lateral-biased so pairs glide past rather than stacking vertically)
          const comfortOverlap = (comfortD - d) / comfortD;
          const softPush = comfortOverlap * 0.065 * clampedDt;
          b.vx += nx * softPush;
          b.vy += ny * softPush * 0.55;
          b.vz += nz * softPush;
          o.vx -= nx * softPush;
          o.vy -= ny * softPush * 0.55;
          o.vz -= nz * softPush;

          if (d < kissD) {
            // Brief silky merge upon contact, then rapidly escalating separation + tangential glide
            const dwell = Math.min(1.6, this.pairContact[pairIdx] + clampedDt * 1.5);
            this.pairContact[pairIdx] = dwell;

            const kissOverlap = (kissD - d) / kissD;
            // Light during initial brief kiss (<0.22), strong and silky right after so drops never stay glued
            const releaseRamp = smoothstep(0.14, 0.72, dwell);
            const sepPush = (0.14 + releaseRamp * 0.68 + kissOverlap * 0.28) * clampedDt;

            // Smooth tangential swirl so drops roll and peel off each other organically
            const swirlDir = (i + j) % 2 === 0 ? 1 : -1;
            const xzLen = Math.hypot(nx, nz) + 0.05;
            const tx = (-nz / xzLen) * swirlDir;
            const tz = (nx / xzLen) * swirlDir;
            const shear = (0.065 + releaseRamp * 0.14) * clampedDt;

            b.vx += nx * sepPush + tx * shear;
            b.vy += ny * sepPush * 0.85;
            b.vz += nz * sepPush + tz * shear;
            o.vx -= nx * sepPush + tx * shear;
            o.vy -= ny * sepPush * 0.85;
            o.vz -= nz * sepPush + tz * shear;

            // Slight opposite thermal nudge helps one rise and the other drift lower after kissing
            if (releaseRamp > 0.15) {
              const tempSign = b.y >= o.y ? 1 : -1;
              const tempSplit = tempSign * 0.14 * releaseRamp * clampedDt;
              b.temp = clamp(b.temp + tempSplit, 0.06, 0.94);
              o.temp = clamp(o.temp - tempSplit, 0.06, 0.94);
            }
          } else {
            this.pairContact[pairIdx] = Math.max(0, this.pairContact[pairIdx] - clampedDt * 1.9);
          }
        } else {
          this.pairContact[pairIdx] = Math.max(0, this.pairContact[pairIdx] - clampedDt * 2.2);
        }
      }
    }

    // 4. Integrate viscous drag, position, soft vessel bounds, and thermal breathing
    const drag = Math.exp(-1.95 * clampedDt);
    for (let i = 0; i < MAX_BLOBS; i++) {
      const b = this.blobs[i];
      b.vx *= drag;
      b.vy *= drag;
      b.vz *= drag;

      b.x += b.vx * clampedDt;
      b.y += b.vy * clampedDt;
      b.z += b.vz * clampedDt;

      // Keep inside glass vertical bounds with soft cushion
      if (b.y < bottomY) {
        b.y = bottomY;
        b.vy = Math.abs(b.vy) * 0.3;
      } else if (b.y > topY) {
        b.y = topY;
        b.vy = -Math.abs(b.vy) * 0.3;
      }

      // Taper radial constraint loosely matching conical vessels
      const maxR = Math.max(0.068, 0.158 - (b.y + 0.4) * 0.068);
      const rXZ = Math.hypot(b.x, b.z);
      if (rXZ > maxR) {
        const k = maxR / rXZ;
        b.x *= k;
        b.z *= k;
        b.vx *= -0.28;
        b.vz *= -0.28;
      }

      // Thermal expansion + subtle breathing pulse
      const pulse = 1.0 + 0.08 * Math.sin(this.time * 1.05 + b.phase) + (b.temp - 0.5) * 0.13;
      b.radius = b.baseRadius * waxScale * pulse;
    }
  }

  public packUniformArray(activeCount: number): Float32Array {
    const data = this.uniformBuffer;
    for (let i = 0; i < MAX_BLOBS; i++) {
      const b = this.blobs[i];
      data[i * 4 + 0] = b.x;
      data[i * 4 + 1] = b.y;
      data[i * 4 + 2] = b.z;
      data[i * 4 + 3] = i < activeCount ? b.radius : 0.0;
    }
    return data;
  }
}
