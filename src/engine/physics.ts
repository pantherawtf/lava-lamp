import type { BlobState } from '../types/lava';

export const MAX_BLOBS = 14;

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
