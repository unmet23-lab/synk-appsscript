// Original PULSE score and acoustic synthesis. No third-party recordings or samples.
export const SCORE = Object.freeze({ title: '밤이 건네는 불빛', composer: 'SYNK PULSE · original procedural composition', bpm: 72, beatsPerBar: 4, bars: 32 });
const BEAT = 60 / SCORE.bpm;
export const BAR_SECONDS = BEAT * SCORE.beatsPerBar;
const harmony = [
  [38,57,61,64,66], [35,54,57,61,66], [31,54,57,59,62], [33,52,57,59,64],
  [38,54,57,61,64], [30,54,57,61,64], [31,54,57,59,62], [33,52,55,59,61],
  [35,54,57,61,66], [31,54,57,59,62], [38,54,57,61,64], [33,52,57,59,64],
  [28,55,59,62,66], [31,54,57,59,62], [33,52,55,59,61], [33,52,57,59,64],
  [31,54,57,59,62], [33,52,57,59,64], [35,54,57,61,66], [30,52,57,61,64],
  [28,55,59,62,66], [31,54,57,59,62], [38,54,57,61,64], [33,52,55,59,61],
  [38,54,57,61,64], [35,54,57,61,66], [31,54,57,59,62], [33,52,57,59,64],
  [28,55,59,62,66], [31,54,57,59,62], [33,52,55,59,61], [33,52,57,59,64],
];
// [beat, MIDI pitch, held beats, velocity]. Phrases breathe; the melody is not an arpeggio loop.
const melody = [
  [[.5,66,1.25,.78],[2,69,.65,.7],[3,73,.7,.78]], [[0,71,1.45,.77],[2,69,.65,.62],[3,66,.65,.68]],
  [[.5,67,1.4,.75],[2.5,66,.6,.58],[3.25,64,.55,.64]], [[0,64,2.1,.67]],
  [[.5,66,.6,.72],[1.25,69,.6,.72],[2,74,1.4,.86]], [[0,73,1.6,.78],[2.25,69,1,.62]],
  [[0,71,1.2,.78],[1.5,69,.6,.65],[2.5,66,1,.68]], [[.25,64,2.1,.67]],
  [[0,66,.6,.72],[1,69,.6,.7],[2,73,.65,.78],[3,78,.65,.81]], [[0,76,1.5,.81],[2,74,1.15,.72]],
  [[.25,73,1.1,.77],[1.75,69,.6,.65],[2.75,66,.7,.62]], [[.5,64,2.4,.64]],
  [[0,67,.65,.7],[1,71,1,.76],[2.5,74,.9,.78]], [[.25,73,.6,.73],[1.25,71,.6,.69],[2.25,69,1.15,.67]],
  [[0,67,1,.65],[1.5,64,1,.63],[3,61,.6,.58]], [[0,64,1.25,.63]],
  [[.5,71,1.5,.72],[2.5,74,.8,.78]], [[0,73,1.5,.74],[2,69,1.15,.67]],
  [[0,78,1.2,.84],[1.75,76,.65,.71],[2.75,73,.8,.75]], [[.5,69,2,.66]],
  [[.5,71,.7,.69],[1.5,74,.65,.75],[2.5,78,1,.79]], [[0,76,1.5,.74],[2.25,74,1.15,.7]],
  [[.25,73,1,.73],[1.5,69,.65,.65],[2.5,66,1,.67]], [[.5,64,2.25,.6]],
  [[.5,66,1.25,.76],[2,69,.65,.68],[3,73,.7,.77]], [[0,71,1.45,.73],[2,69,.65,.6],[3,66,.65,.65]],
  [[.5,67,1.4,.7],[2.5,66,.6,.55],[3.25,64,.55,.6]], [[0,64,2.1,.61]],
  [[.5,67,.8,.67],[1.75,71,1.3,.72]], [[.5,69,1.15,.65],[2.25,66,1,.62]],
  [[.5,64,1.2,.59],[2.25,61,1,.54]], [],
];
const midi = note => 440 * 2 ** ((note - 69) / 12);
const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
export function seededRandom(seed = 71910) { return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }; }

export function smoothParam(param, value, now, seconds = .16) {
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
  else { const current = param.value; param.cancelScheduledValues(now); param.setValueAtTime(current, now); }
  param.linearRampToValueAtTime(value, now + seconds);
}

function wave(context, partials) {
  return context.createPeriodicWave(new Float32Array(partials.length + 1), new Float32Array([0, ...partials]), { disableNormalization: false });
}

export function createSoundGraph(context, { music = .68, effects = .74, master = .82 } = {}) {
  const musicBus = context.createGain(), effectsBus = context.createGain(), masterBus = context.createGain();
  musicBus.gain.value = music; effectsBus.gain.value = effects; masterBus.gain.value = master;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -15; compressor.knee.value = 14; compressor.ratio.value = 2.5;
  compressor.attack.value = .012; compressor.release.value = .28;
  musicBus.connect(masterBus); effectsBus.connect(masterBus); masterBus.connect(compressor); compressor.connect(context.destination);
  return { musicBus, effectsBus, masterBus, compressor, destroy() { for (const node of [musicBus,effectsBus,masterBus,compressor]) node.disconnect(); } };
}

export function createAcousticPalette(context, destination, { wet = .25, seed = 61939 } = {}) {
  const random = seededRandom(seed), reverb = context.createConvolver(), wetGain = context.createGain();
  const ir = context.createBuffer(2, Math.floor(context.sampleRate * 2.9), context.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = ir.getChannelData(c);
    let low = 0;
    for (let i = 0; i < data.length; i++) { low = low * .56 + (random() * 2 - 1) * .44; data[i] = low * Math.exp(-i / context.sampleRate * 2.35) * Math.min(1, i / (context.sampleRate * .021)); }
  }
  reverb.buffer = ir; wetGain.gain.value = wet; reverb.connect(wetGain); wetGain.connect(destination);
  const pianoWave = wave(context, [1,.31,.11,.045,.025,.011]);
  const padWave = wave(context, [1,.075,.055,.009,.014]);
  const noiseBuffer = context.createBuffer(1, context.sampleRate * 8, context.sampleRate);
  const samples = noiseBuffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < samples.length; i++) { brown = (brown + (random() * 2 - 1) * .032) / 1.025; samples[i] = brown * 3.4; }
  const whiteBuffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
  const whites = whiteBuffer.getChannelData(0);
  for (let i = 0; i < whites.length; i++) whites[i] = random() * 2 - 1;
  const voices = new Set();
  function route(node, pan = 0, amount = .25) {
    const panner = context.createStereoPanner(), send = context.createGain();
    panner.pan.value = clamp(pan, -1, 1); send.gain.value = amount;
    node.connect(panner); panner.connect(destination); panner.connect(send); send.connect(reverb);
    return [panner, send];
  }
  function track(source, nodes) {
    voices.add(source);
    source.addEventListener('ended', () => { voices.delete(source); for (const node of [source, ...nodes]) try { node.disconnect(); } catch {} }, { once: true });
  }
  function piano(note, at, duration = 2, velocity = 1, pan = 0) {
    const oscillator = context.createOscillator(), filter = context.createBiquadFilter(), gain = context.createGain();
    oscillator.setPeriodicWave(pianoWave); oscillator.frequency.value = midi(note);
    filter.type = 'lowpass'; filter.Q.value = .25;
    filter.frequency.setValueAtTime(2600 + velocity * 1100, at); filter.frequency.exponentialRampToValueAtTime(620, at + Math.max(.3, duration));
    const peak = .24 * velocity;
    gain.gain.setValueAtTime(.00001, at); gain.gain.linearRampToValueAtTime(peak, at + .009);
    gain.gain.exponentialRampToValueAtTime(peak * .42, at + .12); gain.gain.exponentialRampToValueAtTime(.00001, at + duration + 2.1);
    oscillator.connect(filter); filter.connect(gain); const routed = route(gain, pan, .30);
    oscillator.start(at); oscillator.stop(at + duration + 2.14); track(oscillator, [filter, gain, ...routed]);
  }
  function pad(notes, at, duration = BAR_SECONDS, intensity = 1) {
    notes.forEach((note, index) => {
      const oscillator = context.createOscillator(), filter = context.createBiquadFilter(), gain = context.createGain();
      oscillator.setPeriodicWave(padWave); oscillator.frequency.value = midi(note); oscillator.detune.value = [-2.4,1.6,-.8,2.1][index % 4];
      filter.type = 'lowpass'; filter.frequency.value = 1150; filter.Q.value = .25;
      gain.gain.setValueAtTime(.00001, at); gain.gain.linearRampToValueAtTime(.028 * intensity, at + 1.1);
      gain.gain.setValueAtTime(.028 * intensity, at + Math.max(1.1, duration - .4)); gain.gain.exponentialRampToValueAtTime(.00001, at + duration + 1.9);
      oscillator.connect(filter); filter.connect(gain); const routed = route(gain, (index - 1.5) * .27, .55);
      oscillator.start(at); oscillator.stop(at + duration + 2); track(oscillator, [filter,gain,...routed]);
    });
  }
  function bass(note, at, duration, velocity = 1) {
    const oscillator = context.createOscillator(), gain = context.createGain(); oscillator.type = 'sine'; oscillator.frequency.value = midi(note);
    gain.gain.setValueAtTime(.00001, at); gain.gain.linearRampToValueAtTime(.085 * velocity, at + .1);
    gain.gain.exponentialRampToValueAtTime(.026 * velocity + .00001, at + Math.max(.11, duration * .7)); gain.gain.exponentialRampToValueAtTime(.00001, at + duration + .4);
    oscillator.connect(gain); const routed = route(gain, 0, .03); oscillator.start(at); oscillator.stop(at + duration + .5); track(oscillator,[gain,...routed]);
  }
  function noise(at, duration, { gain: level = .1, low = 1800, high = 100, pan = 0, attack = .015, wet: amount = .06, white = false } = {}) {
    const source = context.createBufferSource(), lowpass = context.createBiquadFilter(), highpass = context.createBiquadFilter(), envelope = context.createGain();
    source.buffer = white ? whiteBuffer : noiseBuffer; source.loop = true;
    lowpass.type = 'lowpass'; lowpass.frequency.value = low; highpass.type = 'highpass'; highpass.frequency.value = high;
    envelope.gain.setValueAtTime(.00001, at); envelope.gain.linearRampToValueAtTime(level, at + Math.min(attack, duration * .25));
    envelope.gain.exponentialRampToValueAtTime(.00001, at + duration);
    source.connect(highpass); highpass.connect(lowpass); lowpass.connect(envelope); const routed = route(envelope, pan, amount);
    source.start(at, random() * 2); source.stop(at + duration + .03); track(source,[lowpass,highpass,envelope,...routed]);
  }
  function tone(frequency, at, duration, { gain: level = .06, pan = 0, type = 'sine', end = frequency, wet: amount = .12 } = {}) {
    const oscillator = context.createOscillator(), envelope = context.createGain(); oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at); oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end), at + duration);
    envelope.gain.setValueAtTime(.00001, at); envelope.gain.linearRampToValueAtTime(level, at + .006); envelope.gain.exponentialRampToValueAtTime(.00001, at + duration);
    oscillator.connect(envelope); const routed = route(envelope, pan, amount);
    oscillator.start(at); oscillator.stop(at + duration + .02); track(oscillator,[envelope,...routed]);
  }
  function effect(name, at = context.currentTime, options = {}) {
    const pan = clamp(Number(options.pan) || 0, -1, 1), force = clamp(Number(options.intensity) || 1, .2, 1.4);
    if (name === 'step') {
      noise(at,.16,{gain:.095*force,low:1550,high:150,pan,attack:.025}); tone(91,at,.12,{gain:.028*force,end:55,pan,wet:.02});
    } else if (name === 'paper' || name === 'inspect') {
      for (const [offset,level] of [[0,.07],[.09,.035],[.19,.052]]) noise(at+offset,.14,{gain:level*force,low:3100,high:700,pan,white:true,attack:.025,wet:.035});
    } else if (name === 'switch' || name === 'vote') {
      noise(at,.06,{gain:.12*force,low:2100,high:900,pan,white:true}); tone(220,at,.1,{gain:.035*force,end:138,pan,wet:.02});
      noise(at+.085,.035,{gain:.044*force,low:2700,high:700,pan,white:true});
    } else if (name === 'tram') {
      [310,621,944,1585].forEach((f,i)=>tone(f,at+i*.003,1.3-i*.17,{gain:.034*force/(1+i*.65),pan,wet:.35}));
      noise(at,.5,{gain:.036*force,low:950,high:180,pan});
    } else if (name === 'radio') {
      noise(at,.52,{gain:.035*force,low:2300,high:630,pan,white:true,wet:.01});
      tone(118,at+.08,.65,{gain:.012*force,end:104,pan,wet:.015});
    } else if (name === 'share') {
      effect('paper',at,{pan,intensity:.65*force}); tone(328,at+.08,.24,{gain:.033*force,end:328,pan,wet:.20});
    } else if (name === 'confirm') {
      effect('switch',at,{pan,intensity:.8*force}); [146.83,220,293.66].forEach((f,i)=>tone(f,at+.12+i*.085,1.35,{gain:.036*force,pan,wet:.45}));
    } else return false;
    return true;
  }
  return { piano,pad,bass,noise,tone,effect,activeVoices:()=>voices.size, destroy() { for (const source of voices) try { source.stop(); } catch {} voices.clear(); reverb.disconnect(); wetGain.disconnect(); } };
}

export function scheduleScoreBar(palette, barIndex, at, { phase = 'explore', ending = null } = {}) {
  const index = ((barIndex % SCORE.bars) + SCORE.bars) % SCORE.bars;
  if (phase === 'ended') {
    const endings = {
      lighthouse: [[38,54,57,61,66],[31,54,57,59,62],[35,54,57,61,66],[33,52,57,59,64]],
      station: [[31,54,57,59,62],[38,54,57,61,64],[28,55,59,62,66],[38,54,57,61,66]],
      homes: [[35,54,57,61,66],[31,54,57,59,62],[28,55,59,62,66],[38,54,57,61,64]],
    };
    const chord = (endings[ending] || endings.lighthouse)[index % 4];
    palette.pad(chord.slice(1),at,BAR_SECONDS,1.15); palette.bass(chord[0],at,2.7,.76);
    const line = ending === 'lighthouse' ? [74,78,76,73,74,81,78,74] : ending === 'station' ? [69,71,74,73,69,66,64,66] : [66,69,71,69,67,66,64,66];
    if (index % 8 < 6) { palette.piano(line[(index*2)%line.length],at+.35,1.7,.66,-.12); palette.piano(line[(index*2+1)%line.length],at+1.85,1.3,.58,.1); }
    return;
  }
  const chord = harmony[index], quiet = ['entry','lobby','prologue'].includes(phase), tension = phase === 'vote';
  palette.pad(chord.slice(1),at,BAR_SECONDS,quiet?.6:tension?.9:1);
  palette.bass(chord[0],at,2.4,quiet?.48:.74);
  if (!quiet && index % 4 !== 3) palette.piano(chord[2],at+BEAT*2.5,.6,.20,-.38);
  for (const [beat,note,held,velocity] of melody[index]) palette.piano(note,at+beat*BEAT,held*BEAT,velocity*(quiet?.54:tension?.8:1), Math.sin(index*.9)*.22);
  if (!quiet && index >= 16 && index < 24) palette.piano(chord[4]+12,at+BEAT*3.5,.65,.18,.42);
}

export function createHarborAmbience(context, palette, destination) {
  const random = seededRandom(4410910), sources = [], nodes = [];
  const layers = {};
  const noise = context.createBuffer(2, Math.floor(context.sampleRate * 11.3), context.sampleRate);
  for (let c=0;c<2;c++) {
    const data=noise.getChannelData(c); let low=0;
    for(let i=0;i<data.length;i++){low=(low+(random()*2-1)*.028)/1.02;data[i]=low*3.6;}
    const seam=Math.floor(context.sampleRate*.12);
    for(let i=0;i<seam;i++){const t=i/seam;data[data.length-seam+i]=data[data.length-seam+i]*(1-t)+data[i]*t;}
  }
  function layer(name,{gain,low,high,pan,rate=.05,depth=.2}) {
    const source=context.createBufferSource(), lp=context.createBiquadFilter(),hp=context.createBiquadFilter(),envelope=context.createGain(),panner=context.createStereoPanner();
    source.buffer=noise;source.loop=true;source.loopStart=.12;source.loopEnd=noise.duration;lp.type='lowpass';lp.frequency.value=low;hp.type='highpass';hp.frequency.value=high;panner.pan.value=pan;
    envelope.gain.value=gain;source.connect(hp);hp.connect(lp);lp.connect(envelope);envelope.connect(panner);panner.connect(destination);
    const lfo=context.createOscillator(),amount=context.createGain();lfo.frequency.value=rate;amount.gain.value=gain*depth;lfo.connect(amount);amount.connect(envelope.gain);
    const at=context.currentTime; source.start(at);lfo.start(at);sources.push(source,lfo);nodes.push(lp,hp,envelope,panner,amount);layers[name]={envelope,gain};
  }
  layer('sea',{gain:.14,low:1300,high:65,pan:-.12,rate:.073,depth:.47});
  layer('wind',{gain:.072,low:3300,high:760,pan:.35,rate:.039,depth:.38});
  layer('radio',{gain:.002,low:2100,high:720,pan:.46,rate:1.3,depth:.35});
  let zone='square',nextDetail=context.currentTime+4, detail=0;
  return {
    update(nextZone='square') {
      zone=nextZone; const now=context.currentTime;
      smoothParam(layers.sea.envelope.gain,zone==='harbor'?.205:zone==='tram'?.075:zone==='radio'?.055:.12,now,1.5);
      smoothParam(layers.wind.envelope.gain,zone==='harbor'?.09:.042,now,1.4);
      smoothParam(layers.radio.envelope.gain,zone==='radio'?.017:.0015,now,.65);
    },
    tick(at=context.currentTime) {
      if(at<nextDetail)return; nextDetail=at+7+random()*8;detail++;
      if(zone==='tram')palette.effect('tram',at+.05,{pan:-.35,intensity:.5});
      else if(zone==='radio')palette.effect('radio',at+.05,{pan:.4,intensity:.55});
      else if(zone==='harbor'&&detail%2===0){palette.tone(196,at,2.2,{gain:.012,end:194,pan:-.55,wet:.25});palette.tone(294,at+.15,1.5,{gain:.006,pan:-.4,wet:.3});}
    },
    destroy() { for(const source of sources)try{source.stop();source.disconnect();}catch{} for(const node of nodes)node.disconnect(); },
  };
}
