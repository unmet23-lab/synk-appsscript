// Freeze approved originals for the shared opening; never redraw or recolor them.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const assets = path.join(__dirname, 'assets');
fs.mkdirSync(assets, {recursive:true});
const items = [
  ['synk-paper.png', 'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-Paper.png'],
  ['mongle.webp', 'docs/캐릭터/화면_1024/몽글_눈웃음.webp'],
  ['button.webp', 'docs/디자인/펠트부품/assets/ui/slab-coral-long.webp'],
  ['SUIT.woff2', 'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2'],
  ['InterTight.woff2', 'desktop/assets/launcher/InterTight.woff2'],
  ['SUIT-LICENSE_OFL.txt', 'docs/브랜드_폰트/SUIT/LICENSE_OFL.txt'],
  ['InterTight-OFL.txt', 'docs/브랜드_폰트/InterTight/OFL.txt'],
];
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const records = [];
for (const [name, source] of items) {
  const bytes = fs.readFileSync(path.join(root, source));
  if (name === 'synk-paper.png' && digest(bytes) !== '78de96ceb567f245281df78d01b82e5c3aba9fc0cc959dc3763967367fc3b7fe') throw Error('Approved logo fingerprint changed; inspect the canonical placement manifest.');
  fs.writeFileSync(path.join(assets, name), bytes);
  records.push({file:`assets/${name}`, source, transform:'byte-identical copy', sha256:digest(bytes)});
}
const python = 'C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
execFileSync(python, ['-c', 'from PIL import Image; import sys; im=Image.open(sys.argv[1]); im.resize((1100,541),Image.Resampling.LANCZOS).save(sys.argv[2],"WEBP",lossless=True)', path.join(assets,'synk-paper.png'),path.join(assets,'synk-paper.webp')]);
records.push({file:'assets/synk-paper.webp',source:'assets/synk-paper.png',transform:'proportional 1100 x 541 lossless WebP; no recoloring',sha256:digest(fs.readFileSync(path.join(assets,'synk-paper.webp')))});

// Audition candidate only. This does not change the approved sound-kit tokens.
const rate=44100, duration=.38, samples=Math.round(rate*duration);
const voices=[{frequency:523.251,onset:0,gain:.16},{frequency:783.991,onset:.052,gain:.12},{frequency:1046.502,onset:.116,gain:.095}];
const pcm=Buffer.alloc(samples*2);
let peak=0,sumSquares=0;
for(let i=0;i<samples;i++){
  const time=i/rate;
  let sample=0;
  for(const voice of voices){
    const t=time-voice.onset;
    if(t<0)continue;
    const attack=Math.min(1,t/.008);
    const tail=Math.max(0,Math.min(1,(duration-time)/.035));
    const envelope=attack*Math.exp(-t/.07)*tail;
    const phase=2*Math.PI*voice.frequency*t;
    const triangle=2/Math.PI*Math.asin(Math.sin(phase));
    sample+=voice.gain*envelope*(.9*Math.sin(phase)+.1*triangle);
  }
  peak=Math.max(peak,Math.abs(sample));sumSquares+=sample*sample;
  pcm.writeInt16LE(Math.round(Math.max(-1,Math.min(1,sample))*32767),i*2);
}
const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVE',8);header.write('fmt ',12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
const wave=Buffer.concat([header,pcm]);fs.writeFileSync(path.join(assets,'opening-candidate.wav'),wave);
records.push({file:'assets/opening-candidate.wav',source:'prepare-assets.cjs',transform:'deterministic sine / triangle synthesis',approval:'audition candidate; not adopted into canonical sound kit',duration,sampleRate:rate,channels:1,peakDbfs:Number((20*Math.log10(peak)).toFixed(2)),rmsDbfs:Number((10*Math.log10(sumSquares/samples)).toFixed(2)),sha256:digest(wave)});
for(const variant of ['desktop','mobile']){
  const input=path.join(assets,`world-scene-${variant}.png`);
  if(!fs.existsSync(input))continue;
  const output=path.join(assets,`world-scene-${variant}.jpg`);
  execFileSync(python,['-c','from PIL import Image; import sys; im=Image.open(sys.argv[1]).convert("RGB"); im.thumbnail((1920,1920),Image.Resampling.LANCZOS); im.save(sys.argv[2],"JPEG",quality=91,subsampling=0)',input,output]);
  records.push({file:`assets/world-scene-${variant}.jpg`,source:`assets/world-scene-${variant}.png`,transform:'actual environment-v8 WebGL capture; proportional resize and JPEG encoding only',evidence:`qa/world-scene-${variant}.json`,sha256:digest(fs.readFileSync(output))});
}
fs.writeFileSync(path.join(__dirname,'asset-sources.json'),JSON.stringify({date:'2026-10-09',files:records},null,2)+'\n');
console.log(JSON.stringify({files:records.length,logo:'approved Paper original',sound:records.find(item=>item.file.endsWith('.wav'))},null,2));
