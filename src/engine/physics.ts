import type { BlobState, LavaConfig, VesselShape } from '../types/lava';

export const MAX_BLOBS = 14;

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

  constructor(seed = 1337) {
    this.reset(seed);
  }

  public reset(seed = Math.floor(Math.random() * 100000)): void {
    this.time = 0;
    this.blobs = [];
    let s = seed >>> 0;
    const rand = () => {
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 4294967296;
    };

    for (let i = 0; i < MAX_BLOBS; i++) {
      const baseRadius = 0.068 + rand() * 0.072;
      // Distribute nicely from bottom pool to top so initial frame immediately looks iconic
      const t = i / (MAX_BLOBS - 1);
      const y = -0.34 + t * 0.68 + (rand() - 0.5) * 0.1;
      const angle = rand() * Math.PI * 2;
      const radial = rand() * 0.085;
      this.blobs.push({
        x: Math.cos(angle) * radial,
        y,
        z: Math.sin(angle) * radial * 0.7,
        vx: 0,
        vy: (rand() - 0.5) * 0.05,
        vz: 0,
        radius: baseRadius,
        baseRadius,
        temp: y < 0 ? 0.65 + rand() * 0.35 : rand() * 0.45,
        phase: rand() * Math.PI * 2,
        driftFreq: 0.4 + rand() * 0.7,
      });
    }
  }

  public cloneState(): { time: number; blobs: BlobState[] } {
    return {
      time: this.time,
      blobs: this.blobs.map((b) => ({ ...b })),
    };
  }

  public loadState(state: { time: number; blobs: BlobState[] }): void {
    this.time = state.time;
    this.blobs = state.blobs.map((b) => ({ ...b }));
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
    transientOffset?: { offsetX: number; offsetY: number; tilt: number }
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
    const safeScale = Math.max(0.12, config.scale * 0.7);
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
    const k = Math.max(0.035, config.viscosity * 0.92);
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
        const poolR = vesselRadiusCpu(shape, gMin + 0.02, w) * 0.86;
        const qpx = px - Math.sin(this.time * 0.55) * 0.02;
        const qpy = (py - (gMin + 0.015)) * 2.4;
        const qpz = pz - Math.cos(this.time * 0.48) * 0.02;
        const dPool = Math.hypot(qpx, qpy, qpz) - poolR;
        d = smin(d, dPool, k * 1.15);

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
    child.x = clamp(hit.physX + dirX * 0.028, -0.13, 0.13);
    child.y = clamp(hit.physY + dirY * 0.032, -0.36, 0.34);
    child.z = clamp(hit.physZ + dirZ * 0.022, -0.1, 0.1);
    child.vx = dirX * 0.34;
    child.vy = dirY * 0.42;
    child.vz = dirZ * 0.24;
    child.baseRadius = 0.068 + ((newIndex * 37) % 100) * 0.00052;
    child.radius = child.baseRadius * waxScale;
    child.temp = dirY > 0 ? 0.82 : 0.28;
    child.phase = angle;

    // Subtle opposite recoil on parent blob so the split feels genuinely elastic
    if (parent && parent !== child) {
      parent.vx = clamp(parent.vx - dirX * 0.2, -0.9, 0.9);
      parent.vy = clamp(parent.vy - dirY * 0.16, -0.9, 0.9);
      parent.vz = clamp(parent.vz - dirZ * 0.15, -0.7, 0.7);
    }
  }

  /**
   * Resets cleanly back to 1 iconic molten wax drop after reaching max blob count (14 -> 1)
   */
  public coalesceToSingleBlob(hit: WaxHitResult, waxScale: number): void {
    const primary = this.blobs[0];
    primary.x = clamp(hit.physX * 0.45, -0.06, 0.06);
    primary.y = clamp(hit.physY, -0.22, 0.22);
    primary.z = clamp(hit.physZ * 0.4, -0.05, 0.05);
    primary.vx = (hit.physX >= 0 ? -1 : 1) * 0.14;
    primary.vy = hit.physY > 0 ? -0.26 : 0.34;
    primary.vz = 0;
    primary.baseRadius = 0.122;
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

      // Surge toward the opposite side of the glass chamber
      b.vx = b.vx * 0.15 + oppX * (0.48 + Math.abs(b.x) * 1.6);
      b.vz = b.vz * 0.15 + oppZ * (0.32 + Math.abs(b.z) * 1.2);
      b.vy = b.vy * 0.15 + oppY * (0.58 + Math.abs(b.y) * 0.9);

      // Invert thermal buoyancy so rising drops cool & sink, and pooled drops heat & rise
      b.temp = oppY > 0 ? Math.min(1.0, Math.max(b.temp, 0.88)) : Math.max(0.0, Math.min(b.temp, 0.12));

      // Reverse convection swirl phase so ongoing currents reinforce the opposite sweep
      b.phase += Math.PI;
    }
  }

  public step(dt: number, speed: number, activeCount: number, waxScale: number): void {
    const clampedDt = Math.min(dt, 0.05) * Math.max(0, speed);
    this.time += clampedDt;

    const bottomY = -0.4;
    const topY = 0.39;

    for (let i = 0; i < MAX_BLOBS; i++) {
      const b = this.blobs[i];

      // Heat near bottom bulb, cool near top cap
      if (b.y < -0.22) {
        const heatRate = (0.34 + 0.16 * Math.sin(this.time * 0.6 + b.phase)) * (-0.22 - b.y + 0.18);
        b.temp = Math.min(1.0, b.temp + heatRate * clampedDt * 1.45);
      } else if (b.y > 0.22) {
        const coolRate = (0.32 + 0.14 * Math.cos(this.time * 0.5 + b.phase)) * (b.y - 0.22 + 0.18);
        b.temp = Math.max(0.0, b.temp - coolRate * clampedDt * 1.35);
      } else {
        // Subtle ambient drift in middle
        b.temp += Math.sin(this.time * 0.45 + b.phase) * 0.03 * clampedDt;
        b.temp = Math.min(1.0, Math.max(0.0, b.temp));
      }

      // Buoyancy force from temperature
      const buoyancy = (b.temp - 0.5) * 0.42;
      b.vy += buoyancy * clampedDt;

      // Gentle swirling convection currents in X/Z
      const swirlX = Math.sin(this.time * b.driftFreq + b.phase + b.y * 3.0) * 0.075;
      const swirlZ = Math.cos(this.time * b.driftFreq * 0.85 + b.phase * 1.3 - b.y * 2.5) * 0.055;
      b.vx += (swirlX - b.x * 0.45) * clampedDt;
      b.vz += (swirlZ - b.z * 0.55) * clampedDt;

      // Soft repulsion between active blobs so they don't collapse into one point forever
      for (let j = i + 1; j < activeCount; j++) {
        const o = this.blobs[j];
        const dx = b.x - o.x;
        const dy = b.y - o.y;
        const dz = b.z - o.z;
        const d2 = dx * dx + dy * dy + dz * dz + 0.002;
        const minD = (b.baseRadius + o.baseRadius) * 0.72;
        if (d2 < minD * minD) {
          const d = Math.sqrt(d2);
          const push = ((minD - d) / minD) * 0.09 * clampedDt;
          const nx = dx / d;
          const ny = dy / d;
          const nz = dz / d;
          b.vx += nx * push;
          b.vy += ny * push * 0.45;
          b.vz += nz * push;
          o.vx -= nx * push;
          o.vy -= ny * push * 0.45;
          o.vz -= nz * push;
        }
      }

      // Viscous drag
      const drag = Math.exp(-2.1 * clampedDt);
      b.vx *= drag;
      b.vy *= drag;
      b.vz *= drag;

      b.x += b.vx * clampedDt;
      b.y += b.vy * clampedDt;
      b.z += b.vz * clampedDt;

      // Keep inside glass vertical bounds
      if (b.y < bottomY) {
        b.y = bottomY;
        b.vy = Math.abs(b.vy) * 0.25;
      } else if (b.y > topY) {
        b.y = topY;
        b.vy = -Math.abs(b.vy) * 0.25;
      }

      // Taper radial constraint loosely matching conical vessels
      const maxR = Math.max(0.06, 0.145 - (b.y + 0.4) * 0.065);
      const rXZ = Math.hypot(b.x, b.z);
      if (rXZ > maxR) {
        const k = maxR / rXZ;
        b.x *= k;
        b.z *= k;
        b.vx *= -0.25;
        b.vz *= -0.25;
      }

      // Thermal expansion + subtle breathing pulse
      const pulse = 1.0 + 0.08 * Math.sin(this.time * 1.1 + b.phase) + (b.temp - 0.5) * 0.14;
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
