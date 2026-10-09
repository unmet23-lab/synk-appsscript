const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const files = {
  'assets/mongle.webp':'docs/캐릭터/화면_1024/몽글_본체.webp',
  'assets/mongle-smile.webp':'docs/캐릭터/화면_1024/몽글_눈웃음.webp',
  'assets/town.webp':'experiences/word-magic/assets/scenes/village.webp',
  'assets/rhythm.webp':'experiences/korean-rhythm/assets/signal-stage.webp',
  'assets/runner.jpg':'desktop/assets/launcher/runner.jpg',
  'assets/scarf.webp':'docs/Loom_자산/옷층/옷_몽글_첫목소리목도리.webp',
  'assets/headphones.webp':'docs/Loom_자산/옷층/옷_몽글_펠트헤드폰.webp',
  'assets/logo.webp':'docs/디자인/SNS키트/assets/logo-synk.webp',
  'assets/button-coral.webp':'docs/디자인/펠트부품/assets/ui/slab-coral-long.webp',
  'assets/button-white.webp':'docs/디자인/펠트부품/assets/ui/slab-cream-long.webp',
  'assets/quality-cream.webp':'docs/디자인/펠트부품/assets/cushion/cushion-cream.webp',
  'assets/quality-blush.webp':'docs/디자인/펠트부품/assets/cushion/cushion-blush.webp',
  'assets/chip.webp':'docs/디자인/펠트부품/assets/ui/chip-blush-long.webp',
  'assets/badge.webp':'docs/디자인/펠트부품/assets/ui/badge-cream.webp',
  'assets/felt-coral.webp':'docs/디자인/펠트부품/assets/ui/tex-coral.webp',
  'assets/felt-blue.webp':'docs/디자인/펠트부품/assets/배경/tex-lapis.webp',
  'assets/felt-butter.webp':'docs/디자인/펠트부품/assets/배경/tex-butter.webp',
  'assets/SUIT.woff2':'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2',
  'assets/InterTight.woff2':'desktop/assets/launcher/InterTight.woff2',
  'assets/DMMono.woff2':'experiences/word-magic/kit/fonts/DMMono-Medium.woff2',
  'assets/songs/vowel-dance.mp3':'experiences/hangul-stage/assets/songs/vowel-dance.mp3',
  'assets/songs/geu-a-ga.mp3':'experiences/hangul-stage/assets/songs/geu-a-ga.mp3',
  'assets/songs/batchim.mp3':'experiences/hangul-stage/assets/songs/batchim.mp3',
  'songs.mjs':'experiences/hangul-stage/songs.mjs'
};
for (const [to, from] of Object.entries(files)) {
  const destination=path.join(__dirname,to);
  fs.mkdirSync(path.dirname(destination), {recursive:true});
  fs.copyFileSync(path.join(root,from),destination);
}
const videoRoot=path.resolve(root,'../synk-vendor/hangul-mascot-video');
const videos={'vowel-dance':'vowel-dance-full-v5/모음댄스_전곡_v5.mp4','geu-a-ga':'geu-a-ga-v3/그아가_앱판_v3.mp4','batchim':'batchim-v1/받침_앱판_v1.mp4'};
fs.mkdirSync(path.join(__dirname,'assets/videos'),{recursive:true});
for(const [name,from] of Object.entries(videos))fs.copyFileSync(path.join(videoRoot,from),path.join(__dirname,'assets/videos',name+'.mp4'));
fs.writeFileSync(path.join(__dirname,'asset-sources.json'), JSON.stringify({copiedAt:new Date().toISOString(),files,videos:{root:videoRoot,files:videos}},null,2));
console.log(`Copied ${Object.keys(files).length} existing assets and ${Object.keys(videos).length} existing videos; no generation.`);
