// Audio manager - procedural SFX and generative music
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicPlaying = false;
  private musicOscs: OscillatorNode[] = [];
  sfxVolume = 0.6;
  musicVolume = 0.3;

  private ensureCtx() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  // Crisis alarm - rising tone
  playAlarm() {
    const ctx = this.ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }

  // Station interact - click
  playInteract() {
    const ctx = this.ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  // Success chime
  playSuccess() {
    const ctx = this.ensureCtx();
    const notes = [523, 659, 784]; // C E G
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.3);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.35);
    });
  }

  // Failure buzz
  playFailure() {
    const ctx = this.ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 100;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }

  // Pump/press sound
  playPump() {
    const ctx = this.ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  // Sequence button tone (one of 4 tones)
  playTone(index: number) {
    const ctx = this.ensureCtx();
    const freqs = [262, 330, 392, 523]; // C D# G C'
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freqs[index % 4];
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  // Critical warning
  playCritical() {
    const ctx = this.ensureCtx();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.1);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.12);
    }
  }

  // Game over sound
  playGameOver() {
    const ctx = this.ensureCtx();
    const notes = [392, 330, 262, 196]; // descending
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.4);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(ctx.currentTime + i * 0.2);
      osc.stop(ctx.currentTime + i * 0.2 + 0.45);
    });
  }

  // Ambient generative music
  startMusic() {
    if (this.musicPlaying) return;
    this.musicPlaying = true;

    const ctx = this.ensureCtx();

    // Drone pad
    const drone1 = ctx.createOscillator();
    const drone1Gain = ctx.createGain();
    drone1.type = 'sine';
    drone1.frequency.value = 55; // A1
    drone1Gain.gain.value = 0.08;
    drone1.connect(drone1Gain);
    drone1Gain.connect(this.musicGain!);
    drone1.start();

    const drone2 = ctx.createOscillator();
    const drone2Gain = ctx.createGain();
    drone2.type = 'sine';
    drone2.frequency.value = 82.4; // E2
    drone2Gain.gain.value = 0.06;
    drone2.connect(drone2Gain);
    drone2Gain.connect(this.musicGain!);
    drone2.start();

    // LFO modulation on drone
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 3;
    lfo.connect(lfoGain);
    lfoGain.connect(drone1.frequency);
    lfo.start();

    this.musicOscs.push(drone1, drone2, lfo);
  }

  stopMusic() {
    this.musicPlaying = false;
    const ctx = this.ctx;
    if (!ctx) return;
    this.musicOscs.forEach(o => {
      try { o.stop(); } catch (_e) { /* already stopped */ }
    });
    this.musicOscs = [];
  }
}
