'use strict';
// Copy approved source assets without recolouring or rebuilding the SYNK mark.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),target=path.join(root,'desktop/assets/launcher');
const account='experiences/synk-account/assets/';
const sources={
  'synk.svg':account+'synk-logo.svg','SUIT.woff2':account+'SUIT-Variable.woff2',
  'InterTight.woff2':account+'InterTight-700.woff2','DMMono.ttf':account+'DMMono-Medium.ttf',
  'button.webp':account+'slab-coral-long.webp','button-soft.webp':account+'slab-cream-long.webp',
  'chip.webp':account+'chip-blush-long.webp','laptop.webp':account+'laptop-felt.webp',
  'world.png':'desktop/assets/world.png','messenger.png':'desktop/assets/messenger.png',
  'world-cover.webp':'experiences/korean-rhythm/assets/signal-stage.webp',
  'teacher-cover.png':'docs/디자인/웹_단락이미지/20260919/lab-presentation.png',
  'shift-cover.png':'docs/디자인/웹_단락이미지/20260919/shift-ai-workshop.png',
  'path-cover.png':'docs/디자인/웹_단락이미지/20260919/path-study-plan.png',
  'pulse-cover.png':'docs/디자인/웹_단락이미지/20260919/pulse-music-rights.png',
  'studio-camera.webp':'experiences/entry-check/assets/items/camera.webp',
  'wide-coral.webp':'docs/디자인/펠트부품/assets/ui/wide-coral.webp',
  'wide-lapis.webp':'docs/디자인/펠트부품/assets/배경/wide-lapis.webp',
  'wide-cream.webp':'docs/디자인/펠트부품/assets/배경/wide-cream.webp',
  'wide-black.webp':'docs/디자인/펠트부품/assets/배경/wide-black.webp',
  'wide-butter.webp':'docs/디자인/펠트부품/assets/배경/wide-butter.webp',
  'engine.js':'atlas/engine.js','personalization.js':'atlas/personalization.js',
  'racing.jpg':'experiences/korean-racing/qa/ui-refinement-playing-20261002.jpg',
  'runner.jpg':'experiences/korean-runner/qa/v6-run-blossom-mobile.jpg',
  'rhythm.jpg':'experiences/korean-rhythm/qa/listening-20261001/play-desktop.jpg',
};
fs.mkdirSync(target,{recursive:true});
const assets=Object.entries(sources).map(([name,source])=>{const bytes=fs.readFileSync(path.join(root,source));fs.writeFileSync(path.join(target,name),bytes);return {name,source,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
fs.writeFileSync(path.join(target,'sources.json'),JSON.stringify({note:'Approved assets copied unchanged. Screenshots show existing development content, not released content or learning-effect evidence.',assets},null,2)+'\n');
console.log('Launcher assets:',assets.length);
