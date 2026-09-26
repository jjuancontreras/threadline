// Opt-in generative score with raw Web Audio. Muted by default; the AudioContext is
// only created after the user presses the sound toggle (autoplay policy friendly).

function noiseBuffer(ctx, seconds = 2) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < d.length; i++) {
    b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); // soft brown-ish noise
    d[i] = b * 6;
  }
  return buf;
}

export function createAudio() {
  let ctx = null;
  let master;
  let windGain;
  let windFilter;
  let padGain;
  let enabled = false;
  let nextBeat = 0;
  let bpm = 0;

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);

    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuffer(ctx);
    wind.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 0.7;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter).connect(windGain).connect(master);
    wind.start();

    // night-city pad: detuned saws through a slow low-pass
    padGain = ctx.createGain();
    padGain.gain.value = 0.05;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    padGain.connect(lp).connect(master);
    [55, 82.4, 110.2, 164.8].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = (i % 2 ? 1 : -1) * 7;
      const g = ctx.createGain();
      g.gain.value = 0.25;
      o.connect(g).connect(padGain);
      o.start();
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();
  }

  function thump(time, freq, gain) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(freq, time);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, time + 0.12);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    o.connect(g).connect(master);
    o.start(time);
    o.stop(time + 0.25);
  }

  return {
    get enabled() {
      return enabled;
    },
    async toggle() {
      if (!ctx) build();
      enabled = !enabled;
      if (enabled && ctx.state === 'suspended') await ctx.resume();
      master.gain.setTargetAtTime(enabled ? 0.8 : 0, ctx.currentTime, 0.15);
      return enabled;
    },
    /** Called every frame. speed01 drives wind; heart (bpm, 0 = off). */
    update(speed01, heartBpm = 0) {
      if (!ctx || !enabled) return;
      const t = ctx.currentTime;
      windGain.gain.setTargetAtTime(0.02 + speed01 * 0.5, t, 0.2);
      windFilter.frequency.setTargetAtTime(300 + speed01 * 1600, t, 0.2);
      bpm = heartBpm;
      if (bpm > 0 && t >= nextBeat) {
        const beat = 60 / bpm;
        thump(t + 0.02, 62, 0.9);
        thump(t + 0.02 + beat * 0.28, 55, 0.6);
        nextBeat = t + beat;
      }
      padGain.gain.setTargetAtTime(bpm > 0 ? 0.02 : 0.05, t, 0.5);
    },
    boom(size = 1) {
      if (!ctx || !enabled) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, 1.2);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(1800, t);
      f.frequency.exponentialRampToValueAtTime(80, t + 1.0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.9 * size, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
      src.connect(f).connect(g).connect(master);
      src.start(t);
      thump(t, 70, 1.0 * size);
    },
    zap() {
      if (!ctx || !enabled) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(1800, t);
      o.frequency.exponentialRampToValueAtTime(220, t + 0.18);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.22);
    },
  };
}
