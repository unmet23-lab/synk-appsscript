'use strict';
const path = require('node:path');
const fs = require('node:fs');
const sharp = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const at = name => path.join(__dirname, name);
const felt = path.resolve(__dirname, '../../../홍보물/첫게시물_20260910/assets/felt-dark.webp');

function horizontalMask(width,height) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="h" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0" stop-color="white" stop-opacity="0"/><stop offset=".11" stop-color="white"/><stop offset=".9" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#h)"/></svg>`);
}

async function feltCanvas(width, height) {
  return sharp(felt).resize(width, height, {fit:'cover'}).modulate({brightness:.72}).png().toBuffer();
}
async function main() {
  // ImageGen composes the material and objects; these exports only fit the exact platform canvases.
  const company = await sharp(at('synk-company-safe-gpt-source.png'))
    .resize({width:1280}).png().toBuffer();
  const band = await sharp(company).extract({left:0,top:86,width:1280,height:256})
    .composite([{input:horizontalMask(1280,256),blend:'dest-in'}]).png().toBuffer();
  await sharp(await feltCanvas(1512,256)).composite([{input:band,left:80,top:0}]).png().toFile(at('synk-linkedin-company.png'));
  const scene = await sharp(at('shift-centered-gpt-source.png')).resize({width:1780}).png().toBuffer();
  const meta = await sharp(scene).metadata();
  const mask = Buffer.from(`<svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="v" x2="0" y2="1"><stop offset="0" stop-color="white" stop-opacity="0"/><stop offset=".18" stop-color="white"/><stop offset=".82" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#v)"/></svg>`);
  const soft = await sharp(scene).composite([{input:mask,blend:'dest-in'},{input:horizontalMask(meta.width,meta.height),blend:'dest-in'}]).png().toBuffer();
  await sharp(await feltCanvas(2560,1440)).composite([{input:soft,left:390,top:Math.round((1440-meta.height)/2)}]).png().toFile(at('yuhobuilds-youtube.png'));
  await sharp(at('shift-centered-gpt-source.png')).resize(1600,900,{fit:'cover'}).png().toFile(at('shift-pinterest.png'));
  for (const id of ['synk-linkedin-company','yuhobuilds-youtube','shift-pinterest']) {
    fs.copyFileSync(at(`${id}.png`),at(`${id}-safe-gpt.png`));
  }
  console.log(JSON.stringify({exports:['synk-linkedin-company.png','yuhobuilds-youtube.png','shift-pinterest.png']}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
