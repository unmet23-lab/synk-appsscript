'use strict';

const path = require('node:path');
const sharp = require(process.env.SYNK_SHARP_MODULE || 'C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');

const dir = __dirname;
const darkFelt = path.resolve(dir, '../../../홍보물/첫게시물_20260910/assets/felt-dark.webp');
const src = name => path.join(dir, name);

async function cover(input, output, width, height, position='centre') {
  await sharp(input)
    .resize(width, height, {fit:'cover', position, kernel:'lanczos3'})
    .sharpen({sigma:.35})
    .png()
    .toFile(output);
}

async function stripOnFelt(input, output, width, height, stripWidth) {
  const strip = await sharp(input)
    .resize({width:stripWidth, withoutEnlargement:false, kernel:'lanczos3'})
    .png()
    .toBuffer();
  const meta = await sharp(strip).metadata();
  const mask = Buffer.from(`<svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="white" stop-opacity="0"/><stop offset=".12" stop-color="white"/><stop offset=".88" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#fade)"/></svg>`);
  const feathered = await sharp(strip).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
  const background = await sharp(darkFelt).resize(width,height,{fit:'cover'}).modulate({brightness:.72}).png().toBuffer();
  await sharp(background)
    .composite([{input:feathered,left:Math.round((width-meta.width)/2),top:Math.round((height-meta.height)/2)}])
    .sharpen({sigma:.35})
    .png()
    .toFile(output);
}

async function extractCover(input, output, left, top, width, height, outWidth, outHeight) {
  await sharp(input)
    .extract({left,top,width,height})
    .resize(outWidth,outHeight,{fit:'fill',kernel:'lanczos3'})
    .sharpen({sigma:.35})
    .png()
    .toFile(output);
}

async function main() {
  const shift = src('shift-master-gpt-source.png');
  const brief = src('synkbrief-master-gpt-source.png');
  const lab = src('lab-master-gpt-source.png');

  await Promise.all([
    stripOnFelt(shift,src('yuhobuilds-youtube-gpt.png'),2560,1440,2280),
    stripOnFelt(brief,src('synkbrief-youtube-gpt.png'),2560,1440,1540),
    stripOnFelt(lab,src('lab-youtube-gpt.png'),2560,1440,1540),
    cover(shift,src('yuhobuilds-x-gpt.png'),1500,500),
    cover(shift,src('yuho-linkedin-primary-gpt.png'),1584,396),
    cover(shift,src('shift-tistory-gpt.png'),2400,900),
    stripOnFelt(shift,src('shift-tistory-mobile-gpt.png'),390,300,370),
    cover(shift,src('shift-naverblog-gpt.png'),966,360),
    extractCover(shift,src('shift-pinterest-gpt.png'),600,0,1287,724,1600,900),
    extractCover(shift,src('shift-behance-gpt.png'),0,216,2172,278,3200,410),
    cover(lab,src('lab-facebook-gpt.png'),1640,924),
  ]);
  console.log(JSON.stringify({count:11,output:dir}));
}

main().catch(error=>{console.error(error);process.exitCode=1;});
