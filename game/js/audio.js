// Solmar City — every sound is synthesized with WebAudio: no audio files.
// Engine hum, police sirens, gunshots, pickups and a small bassline loop.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicOn = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.wanted = 0;
  }

  // Must be called from a user gesture (Enter key / click) to unlock audio.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startEngineHum();
    this.startMusic();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (!this.musicOn) this.stopMusic();
    else this.startMusic();
    return this.musicOn;
  }

  startEngineHum() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngine(speed01, driving) {
    if (!this.ctx || !this.engineOsc) return;
    const target = driving ? 0.05 + speed01 * 0.09 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 110, this.ctx.currentTime, 0.1);
  }

  setSiren(active) {
    if (!this.ctx) return;
    if (active && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this.sirenLfo = lfo;
    } else if (!active && this.sirenOsc) {
      try {
        this.sirenOsc.stop();
        this.sirenLfo.stop();
      } catch (e) { /* already stopped */ }
      this.sirenOsc = null;
      this.sirenLfo = null;
    }
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  noiseBurst(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1800;
    const gain = this.ctx.createGain();
    gain.gain.value = vol || 0.25;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  shot() {
    this.noiseBurst(0.14, 0.3, 2400);
    this.blip(160, 0.08, 'square', 0.1);
  }

  enemyShot() {
    this.noiseBurst(0.12, 0.14, 1600);
  }

  pickup() {
    this.blip(880, 0.09, 'sine', 0.16);
    setTimeout(() => this.blip(1318, 0.12, 'sine', 0.16), 70);
  }

  cash() {
    this.blip(1046, 0.07, 'triangle', 0.14);
    setTimeout(() => this.blip(1568, 0.1, 'triangle', 0.14), 60);
  }

  hit() {
    this.noiseBurst(0.1, 0.2, 900);
  }

  crash() {
    this.noiseBurst(0.3, 0.35, 500);
  }

  missionStart() {
    [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.14, 'triangle', 0.16), i * 110));
  }

  missionComplete() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.16), i * 120));
  }

  wasted() {
    [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.1), i * 220));
  }

  // A lazy sunset bassline: A minor groove, one note per step, plus a hat.
  startMusic() {
    if (!this.ctx || this.musicTimer || !this.musicOn) return;
    const bass = [55, 0, 55, 65.41, 0, 55, 82.41, 73.42, 55, 0, 55, 65.41, 98, 82.41, 73.42, 65.41];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.musicOn) return;
      const step = this.musicStep % 16;
      const note = bass[step];
      if (note) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = note;
        gain.gain.setValueAtTime(0.09, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.24);
      }
      if (step % 2 === 0) this.noiseBurst(0.03, 0.03, 6000);
      this.musicStep++;
    }, 240);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
