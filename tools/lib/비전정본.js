'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sourcePath = path.resolve(__dirname, '../../docs/비전_정본.md');
const brands = { synk: 'SYNK', lab: 'SYNK LAB', shift: 'SYNK SHIFT', pulse: 'SYNK PULSE' };

function loadVisions() {
  const source = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n');
  const result = {};
  for (const [key, name] of Object.entries(brands)) {
    const section = source.split('## ' + name + '\n')[1]?.split('\n## ')[0];
    const headline = section?.match(/### 전면 비전\n+([^\n]+)/)?.[1].trim();
    const subtext = section?.match(/### 서브텍스트\n+([^\n]+)/)?.[1].trim();
    if (!headline || !subtext) throw new Error('비전 정본에서 전면 문장과 서브텍스트를 찾을 수 없습니다: ' + name);
    result[key] = { name, headline, subtext };
  }
  return result;
}

function sourceDigest() {
  return crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
}

function withVisionBlock(markdown, key) {
  const vision = loadVisions()[key];
  if (!vision) throw new Error('알 수 없는 비전 브랜드: ' + key);
  const block = '<!-- synk-vision:start -->\n## 우리가 지향하는 미래\n\n**' + vision.headline + '**\n\n' + vision.subtext + '\n<!-- synk-vision:end -->';
  const source = markdown.replace(/\r\n/g, '\n');
  const existing = /<!-- synk-vision:start -->[\s\S]*?<!-- synk-vision:end -->/;
  if (existing.test(source)) return source.replace(existing, block);
  return source.replace(/^(# [^\n]+)\n+/, '$1\n\n' + block + '\n\n');
}

module.exports = { loadVisions, sourcePath, sourceDigest, withVisionBlock };
if (require.main === module) process.stdout.write(JSON.stringify(loadVisions(), null, 2) + '\n');
