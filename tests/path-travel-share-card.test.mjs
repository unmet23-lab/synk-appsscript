// 서울 하루(/try/travel/) 공유 카드가 쪽과 어긋나지 않는지 본다(2026-11-14).
// 카드는 서울 하루 첫 화면을 찍은 그림(experiences/path-travel/assets/og-travel-ko.jpg)이고,
// 다시 굽는 명령은 node experiences/path-travel/qa/make-share-card.cjs 이다.
// 첫 화면의 제목이나 고르기 이름이 바뀌었는데 카드를 다시 굽지 않으면 이 시험이 알려 준다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'experiences', 'path-travel');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const meta = (attr, name) => (html.match(new RegExp(`<meta ${attr}="${name.replace(/[.:]/g, '\\$&')}" content="([^"]*)">`)) || [])[1];

// JPEG의 SOF 표식에서 가로 · 세로를 읽는다
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

test('서울 하루 공유 카드는 쪽 자신의 그림이고, 주소 표식이 그림 바이트와 맞는다', () => {
  const og = meta('property', 'og:image');
  const m = /^https:\/\/synk\.im\/try\/travel\/assets\/(og-travel-ko\.jpg)\?v=([0-9a-f]{12})$/.exec(og || '');
  assert.ok(m, 'og:image는 서울 하루 카드다: ' + og);
  assert.equal(meta('name', 'twitter:image'), og, 'twitter:image도 같은 카드');
  const file = path.join(dir, 'assets', m[1]);
  const buf = fs.readFileSync(file);
  assert.equal(m[2], crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12), '?v=는 그림 sha256 앞 12자리 — 다시 구웠으면 make-share-card.cjs가 고쳐 쓴다');
  assert.deepEqual(jpegSize(buf), { w: 1200, h: 630 }, '1200×630');
  assert.equal(meta('property', 'og:image:width'), '1200');
  assert.equal(meta('property', 'og:image:height'), '630');
  assert.ok(buf.length < 200 * 1024, '카드는 200KB 아래');
});

test('서울 하루 카드의 그림 설명은 지금 첫 화면의 제목과 고르기 여섯을 모두 말한다', () => {
  const alt = meta('property', 'og:image:alt') || '';
  const title = (html.match(/<h1 class="chooser-title"[^>]*>([^<]+)</) || [])[1];
  const names = [...html.matchAll(/class="intent-name">([^<]+)</g)].map(x => x[1]);
  assert.ok(title, '첫 화면 제목');
  assert.equal(names.length, 6, '고르기 여섯');
  assert.ok(alt.includes(title), '그림 설명에 제목 「' + title + '」');
  for (const n of names) assert.ok(alt.includes(n), '그림 설명에 고르기 「' + n + '」');
  assert.doesNotMatch(alt, /면접|함께 준비합니다/, 'PATH 첫 화면 카드의 옛 설명이 남지 않는다');
});
