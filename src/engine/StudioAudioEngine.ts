export interface StudioTrack {
  id: string;
  title: string;
  subtitle: string;
  bpm: number;
  /** MIDI note voicings for each 1-bar chord (4-bar loop) */
  chords: number[][];
  /** Bass pattern per 16th-note step (null = rest, number = MIDI note) */
  bassPattern: (number | null)[][];
  /** Sparse lyrical melody notes across the 64-step (4-bar) cycle: [stepIndex, midiNote, durationSteps] */
  melodyPhrases: [number, number, number][];
}

/**
 * Four original quiet-storm / smooth-jazz studio compositions inspired by
 * Sade's minimalist London studio aesthetic (warm Rhodes, fretless bass, brushed groove).
 */
export const STUDIO_TRACKS: StudioTrack[] = [
  {
    id: 'noite-em-londres',
    title: 'Noite em Londres',
    subtitle: 'Quiet Storm · Fm9',
    bpm: 82,
    chords: [
      [53, 56, 60, 63, 67], // Fm9
      [49, 53, 56, 60, 63], // DbMaj9
      [46, 53, 56, 60, 65], // Bbm9
      [48, 52, 58, 63, 68], // C7#9b13
    ],
    bassPattern: [
      [41, null, null, null, null, null, 41, null, null, null, 44, null, null, 48, null, null],
      [37, null, null, null, null, null, 37, null, null, null, 41, null, null, 44, null, null],
      [34, null, null, null, null, null, 34, null, null, null, 37, null, null, 41, null, null],
      [36, null, null, null, null, null, 43, null, null, null, 40, null, null, null, 39, null],
    ],
    melodyPhrases: [
      [4, 72, 6],
      [11, 70, 4],
      [16, 68, 8],
      [26, 65, 5],
      [36, 72, 7],
      [44, 75, 5],
      [50, 72, 6],
      [58, 67, 5],
    ],
  },
  {
    id: 'veludo-e-chuva',
    title: 'Veludo & Chuva',
    subtitle: 'Rhodes Lounge · Am9',
    bpm: 76,
    chords: [
      [57, 60, 64, 67, 71], // Am9
      [50, 57, 60, 64, 69], // Dm9
      [53, 57, 60, 64, 67], // FMaj9
      [52, 55, 59, 62, 67], // Em7(9)
    ],
    bassPattern: [
      [45, null, null, null, null, null, null, 45, null, null, 48, null, null, null, 43, null],
      [38, null, null, null, null, null, 45, null, null, null, 41, null, null, 43, null, null],
      [41, null, null, null, null, null, null, 41, null, null, 45, null, null, null, 48, null],
      [40, null, null, null, null, null, 47, null, null, null, 43, null, null, 42, null, null],
    ],
    melodyPhrases: [
      [2, 76, 7],
      [10, 74, 4],
      [15, 72, 6],
      [24, 69, 7],
      [34, 71, 6],
      [42, 72, 5],
      [48, 76, 8],
      [58, 74, 5],
    ],
  },
  {
    id: 'sopro-de-ambar',
    title: 'Sopro de Âmbar',
    subtitle: 'Velvet Groove · Ebm9',
    bpm: 84,
    chords: [
      [51, 54, 58, 61, 65], // Ebm9
      [56, 60, 63, 66, 68], // Ab13
      [49, 53, 56, 60, 63], // DbMaj9
      [46, 50, 56, 61, 65], // Bb7#9
    ],
    bassPattern: [
      [39, null, null, null, null, null, 39, null, null, null, 42, null, null, 46, null, null],
      [44, null, null, null, null, null, null, 44, null, null, 42, null, null, 39, null, null],
      [37, null, null, null, null, null, 37, null, null, null, 41, null, null, 44, null, null],
      [34, null, null, null, null, null, 41, null, null, null, 38, null, null, null, 37, null],
    ],
    melodyPhrases: [
      [6, 70, 6],
      [13, 68, 4],
      [18, 66, 8],
      [28, 63, 5],
      [38, 68, 7],
      [46, 70, 5],
      [52, 66, 6],
      [60, 65, 4],
    ],
  },
  {
    id: 'mare-serena',
    title: 'Maré Serena',
    subtitle: 'Studio Dub · Gm9',
    bpm: 72,
    chords: [
      [55, 58, 62, 65, 69], // Gm9
      [48, 55, 58, 62, 67], // Cm9
      [51, 55, 58, 62, 65], // EbMaj9
      [50, 54, 60, 63, 69], // D7b9
    ],
    bassPattern: [
      [43, null, null, null, null, null, null, 43, null, null, 46, null, null, null, 41, null],
      [36, null, null, null, null, null, 43, null, null, null, 39, null, null, 41, null, null],
      [39, null, null, null, null, null, null, 39, null, null, 43, null, null, null, 46, null],
      [38, null, null, null, null, null, 45, null, null, null, 42, null, null, 41, null, null],
    ],
    melodyPhrases: [
      [4, 74, 8],
      [14, 72, 4],
      [20, 70, 7],
      [29, 67, 6],
      [36, 70, 7],
      [45, 74, 6],
      [52, 72, 6],
      [59, 69, 5],
    ],
  },
];

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Generates a warm procedural stereo studio plate reverb impulse response.
 */
function createStudioReverbBuffer(ctx: AudioContext, duration = 2.6, decay = 2.8): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * duration);
  const buffer = ctx.createBuffer(2, length, rate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const env = Math.pow(1 - t, decay);
      const white = Math.random() * 2 - 1;
      // Warm analog plate damping
      lp = lp * 0.72 + white * 0.28;
      data[i] = lp * env;
    }
  }
  return buffer;
}

/**
 * Generates a soft filtered studio noise buffer for brushed percussion & vinyl room bed.
 */
function createNoiseBuffer(ctx: AudioContext, seconds = 2.0): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private busInput: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private delaySend: GainNode | null = null;
  private roomBedGain: GainNode | null = null;
  private roomBedSource: AudioBufferSourceNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private isPlaying = false;
  private volume = 0.45;
  private trackIndex = 0;
  private step = 0;
  private nextStepTime = 0;
  private schedulerId: number | null = null;

  public getTrack(): StudioTrack {
    return STUDIO_TRACKS[this.trackIndex];
  }

  public getTrackIndex(): number {
    return this.trackIndex;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private ensureContext(): AudioContext {
    if (this.ctx) return this.ctx;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    this.ctx = ctx;
    this.noiseBuffer = createNoiseBuffer(ctx, 2.5);

    // Master studio output chain
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.0001;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.015;
    compressor.release.value = 0.25;

    const warmthFilter = ctx.createBiquadFilter();
    warmthFilter.type = 'lowpass';
    warmthFilter.frequency.value = 7800;
    warmthFilter.Q.value = 0.55;

    const busInput = ctx.createGain();
    busInput.gain.value = 0.85;

    // Procedural Studio Plate Reverb
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.42;
    const convolver = ctx.createConvolver();
    convolver.buffer = createStudioReverbBuffer(ctx, 2.7, 2.9);
    const reverbFilter = ctx.createBiquadFilter();
    reverbFilter.type = 'lowpass';
    reverbFilter.frequency.value = 2800;

    // Gentle Warm Tape Delay for Rhodes & sparse lead breath
    const delaySend = ctx.createGain();
    delaySend.gain.value = 0.22;
    const delayNode = ctx.createDelay(1.0);
    delayNode.delayTime.value = 0.36;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.34;
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 1900;

    busInput.connect(warmthFilter);
    busInput.connect(reverbSend);
    reverbSend.connect(convolver);
    convolver.connect(reverbFilter);
    reverbFilter.connect(warmthFilter);

    delaySend.connect(delayNode);
    delayNode.connect(delayFilter);
    delayFilter.connect(warmthFilter);
    delayFilter.connect(delayFeedback);
    delayFeedback.connect(delayNode);

    warmthFilter.connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Subtle warm studio room air / vinyl ambiance bed
    const roomSrc = ctx.createBufferSource();
    roomSrc.buffer = this.noiseBuffer;
    roomSrc.loop = true;

    const roomFilter = ctx.createBiquadFilter();
    roomFilter.type = 'bandpass';
    roomFilter.frequency.value = 520;
    roomFilter.Q.value = 0.65;

    const roomBedGain = ctx.createGain();
    roomBedGain.gain.value = 0.011;

    roomSrc.connect(roomFilter);
    roomFilter.connect(roomBedGain);
    roomBedGain.connect(masterGain);
    roomSrc.start();

    this.masterGain = masterGain;
    this.busInput = busInput;
    this.reverbSend = reverbSend;
    this.delaySend = delaySend;
    this.roomBedGain = roomBedGain;
    this.roomBedSource = roomSrc;

    return ctx;
  }

  private startPlayback(ctx: AudioContext): void {
    this.isPlaying = true;
    const now = ctx.currentTime;
    this.nextStepTime = now + 0.06;

    if (this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now);
      this.masterGain.gain.linearRampToValueAtTime(this.volume, now + 0.35);
    }

    if (this.schedulerId === null) {
      this.schedulerId = window.setInterval(() => this.schedulerTick(), 55);
    }
    this.schedulerTick();
  }

  public async tryStart(): Promise<boolean> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await Promise.race([
        ctx.resume().catch(() => {}),
        new Promise<void>((resolve) => window.setTimeout(resolve, 90)),
      ]);
    }
    if (ctx.state !== 'running') {
      return false;
    }
    this.startPlayback(ctx);
    return true;
  }

  public async play(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    this.startPlayback(ctx);
  }

  public pause(): void {
    this.isPlaying = false;
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(0.0001, now, 0.09);
    }
  }

  public async togglePlay(): Promise<boolean> {
    if (this.isPlaying) {
      this.pause();
      return false;
    } else {
      await this.play();
      return true;
    }
  }

  public nextTrack(): StudioTrack {
    this.trackIndex = (this.trackIndex + 1) % STUDIO_TRACKS.length;
    this.step = 0;

    if (this.ctx && this.isPlaying) {
      const now = this.ctx.currentTime;
      this.nextStepTime = now + 0.08;
      // Gentle studio crossfade dip when changing track
      if (this.masterGain) {
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(this.volume * 0.25, now + 0.06);
        this.masterGain.gain.linearRampToValueAtTime(this.volume, now + 0.32);
      }
    }
    return this.getTrack();
  }

  public setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.ctx && this.masterGain && this.isPlaying) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(Math.max(0.0001, this.volume), now, 0.03);
    }
  }

  private schedulerTick(): void {
    if (!this.ctx || !this.isPlaying) return;
    const lookaheadSec = 0.16;
    const track = this.getTrack();
    const sixteenthDur = 60 / track.bpm / 4;

    while (this.nextStepTime < this.ctx.currentTime + lookaheadSec) {
      this.scheduleStep(track, this.step, this.nextStepTime, sixteenthDur);
      // Slight subtle swing on odd 16th steps for relaxed quiet-storm groove
      const swing = this.step % 2 === 0 ? 1.04 : 0.96;
      this.nextStepTime += sixteenthDur * swing;
      this.step = (this.step + 1) % 64;
    }
  }

  private scheduleStep(track: StudioTrack, stepIndex: number, time: number, stepDur: number): void {
    const bar = Math.floor(stepIndex / 16);
    const stepInBar = stepIndex % 16;
    const chord = track.chords[bar % track.chords.length];

    // 1. Warm Fender Rhodes Electric Piano Chords (downbeat + soft syncopated breath on step 10)
    if (stepInBar === 0) {
      this.playRhodesChord(chord, time, stepDur * 14.5, 0.14);
    } else if (stepInBar === 10) {
      this.playRhodesChord(chord.slice(1), time, stepDur * 5.2, 0.065);
    }

    // 2. Silky Fretless Bass
    const bassNote = track.bassPattern[bar % track.bassPattern.length][stepInBar];
    if (bassNote !== null) {
      this.playFretlessBass(bassNote, time, stepDur * 4.4);
    }

    // 3. Minimalist Brushed Studio Percussion
    if (stepInBar === 0 || stepInBar === 10) {
      this.playSoftKick(time, stepInBar === 0 ? 0.22 : 0.15);
    }
    if (stepInBar === 4 || stepInBar === 12) {
      this.playBrushedRim(time, stepInBar === 4 ? 0.075 : 0.065);
    }
    if (stepInBar % 2 === 0 || stepInBar === 15) {
      this.playShaker(time, stepInBar % 4 === 2 ? 0.036 : 0.02);
    }

    // 4. Sparse Smooth Sax / Velvet Pad Lead Phrase
    for (let i = 0; i < track.melodyPhrases.length; i++) {
      const [phraseStep, midi, durSteps] = track.melodyPhrases[i];
      if (phraseStep === stepIndex) {
        this.playVelvetLead(midi, time, durSteps * stepDur);
      }
    }
  }

  private playRhodesChord(notes: number[], startTime: number, duration: number, velocity: number): void {
    if (!this.ctx || !this.busInput || !this.delaySend) return;
    const ctx = this.ctx;
    const perNoteGain = velocity / Math.sqrt(notes.length);

    notes.forEach((midi, idx) => {
      const t = startTime + idx * 0.016; // Humanized strum
      const freq = midiToFreq(midi);

      // Warm sine body
      const bodyOsc = ctx.createOscillator();
      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(freq, t);

      // Delicate Rhodes tine overtone (2x harmonic decaying swiftly)
      const tineOsc = ctx.createOscillator();
      tineOsc.type = 'triangle';
      tineOsc.frequency.setValueAtTime(freq * 2.0, t);

      const tineGain = ctx.createGain();
      tineGain.gain.setValueAtTime(perNoteGain * 0.22, t);
      tineGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);

      const noteFilter = ctx.createBiquadFilter();
      noteFilter.type = 'lowpass';
      noteFilter.frequency.setValueAtTime(2100, t);
      noteFilter.frequency.exponentialRampToValueAtTime(720, t + duration);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(perNoteGain, t + 0.028);
      env.gain.exponentialRampToValueAtTime(perNoteGain * 0.28, t + duration * 0.72);
      env.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.55);

      bodyOsc.connect(noteFilter);
      tineOsc.connect(tineGain);
      tineGain.connect(noteFilter);
      noteFilter.connect(env);
      env.connect(this.busInput!);
      env.connect(this.delaySend!);

      bodyOsc.start(t);
      tineOsc.start(t);
      bodyOsc.stop(t + duration + 0.6);
      tineOsc.stop(t + 0.45);
    });
  }

  private playFretlessBass(midi: number, time: number, duration: number): void {
    if (!this.ctx || !this.busInput) return;
    const ctx = this.ctx;
    const freq = midiToFreq(midi);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    // Gentle fretless upward slide into pitch
    osc.frequency.setValueAtTime(freq * 0.975, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.045);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(freq, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, time);
    filter.Q.value = 1.2;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(0.24, time + 0.032);
    env.gain.exponentialRampToValueAtTime(0.11, time + duration * 0.75);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(env);
    env.connect(this.busInput);

    osc.start(time);
    sub.start(time);
    osc.stop(time + duration + 0.05);
    sub.stop(time + duration + 0.05);
  }

  private playSoftKick(time: number, gainAmt: number): void {
    if (!this.ctx || !this.busInput) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(94, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainAmt, time + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);

    osc.connect(env);
    env.connect(this.busInput);
    osc.start(time);
    osc.stop(time + 0.26);
  }

  private playBrushedRim(time: number, gainAmt: number): void {
    if (!this.ctx || !this.busInput || !this.noiseBuffer) return;
    const ctx = this.ctx;

    // Soft wooden cross-stick click
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, time);
    osc.frequency.exponentialRampToValueAtTime(210, time + 0.022);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(gainAmt * 0.55, time);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    osc.connect(oscGain);
    oscGain.connect(this.busInput);
    osc.start(time);
    osc.stop(time + 0.045);

    // Delicate wire brush whisper
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, time);
    bp.Q.value = 1.4;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainAmt * 0.65, time + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);

    src.connect(bp);
    bp.connect(env);
    env.connect(this.busInput);
    src.start(time, Math.random() * 1.2, 0.16);
  }

  private playShaker(time: number, gainAmt: number): void {
    if (!this.ctx || !this.busInput || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(6400, time);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainAmt, time + 0.014);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.065);

    src.connect(hp);
    hp.connect(env);
    env.connect(this.busInput);
    src.start(time, Math.random() * 1.5, 0.08);
  }

  private playVelvetLead(midi: number, time: number, duration: number): void {
    if (!this.ctx || !this.reverbSend || !this.delaySend || !this.busInput) return;
    const ctx = this.ctx;
    const freq = midiToFreq(midi);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    // Subtle warm vibrato LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(4.9, time);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(freq * 0.0055, time);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(580, time);
    filter.frequency.linearRampToValueAtTime(1180, time + duration * 0.4);
    filter.frequency.exponentialRampToValueAtTime(520, time + duration);
    filter.Q.value = 1.6;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(0.055, time + 0.14);
    env.gain.exponentialRampToValueAtTime(0.032, time + duration * 0.72);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.45);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.busInput);
    env.connect(this.reverbSend);
    env.connect(this.delaySend);

    osc.start(time);
    lfo.start(time);
    osc.stop(time + duration + 0.5);
    lfo.stop(time + duration + 0.5);
  }

  public dispose(): void {
    this.pause();
    try {
      this.roomBedSource?.stop();
    } catch {
      // Ignore if already stopped
    }
    this.roomBedSource = null;
    this.roomBedGain = null;
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
