'use strict';
// synk.im/brief/profile-photo(synkbrief 「셀카 한 장으로 프로필 사진」 나눔 자료) — 원고 글이 그대로 실리는지, 명령어마다 복사 단추, 그림 표시 없음.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HERE = path.join(__dirname, '../docs/마케팅/맞춤도구/profile-photo');
const page = require(path.join(HERE, 'page.js'));
const data = page.read();
const html = page.renderPage(data);

test('원고 검사를 통과하고 그림 일곱 장이 다 있다', () => {
  assert.deepEqual(page.check(data), []);
  assert.deepEqual(page.missingShots(data), []);
  assert.equal((html.match(/<figure class="shot">/g) || []).length, page.SHOTS.length);
});

test('원고의 보이는 글이 한 조각도 빠지지 않고 쪽에 있다', () => {
  const text = page.pageText(html);
  const pieces = page.sourceTexts(data.md);
  assert.ok(pieces.length > 80, `글 조각 ${pieces.length}개`);
  for (const t of pieces) assert.ok(text.includes(t), t);
});

test('보내 본 명령어에는 복사 단추가, 「이렇게 쓰면 안 돼요」의 말에는 단추가 없다', () => {
  const blocks = page.parse(data.md);
  const parts = page.sections(blocks);
  const bad = parts.find((p) => p.title === '이렇게 쓰면 안 돼요').blocks.filter((b) => b.type === 'quote').map((b) => b.text);
  const good = parts.flatMap((p) => (p.title === '이렇게 쓰면 안 돼요' ? [] : p.blocks)).filter((b) => b.type === 'quote').map((b) => b.text);
  const table = blocks.find((b) => b.type === 'table').rows.map((r) => r[1]);
  const copyable = [...html.matchAll(/<p class="cmd-text" id="(cmd-\d+)">([^<]*)<\/p><button type="button" class="copy" data-copy="\1"/g)].map((m) => m[2]);
  assert.deepEqual(copyable.sort(), [...good, ...table].sort());
  assert.equal(bad.length, 3);
  for (const t of bad) {
    assert.ok(html.includes(`<blockquote class="bad"><p>${t}</p></blockquote>`), t);
    assert.ok(!copyable.includes(t), t);
  }
});

test('머리 큰 제목은 원고 첫 줄, AI 인물 표시가 제목 바로 아래와 원고 끝에 있다', () => {
  assert.equal(page.TITLE_LINES.join(' '), page.sections(page.parse(data.md))[0].title);
  assert.ok(/<p class="ai-note">예시 셀카는 AI로 만든 가상 인물이에요<\/p>\s*<figure class="shot">/.test(html));
  assert.ok(page.pageText(html).includes('예시 사진: AI로 만든 가상 인물 두 명'));
});

test('링크 미리보기(og.html) 제목 줄 · 작은 글이 쪽과 같다', () => {
  const og = fs.readFileSync(path.join(HERE, 'og.html'), 'utf8');
  assert.ok(og.includes(`<span>${page.TITLE_LINES[0]}</span><span>${page.TITLE_LINES[1]}</span><span class="hl">${page.TITLE_LINES[2]}</span>`));
  assert.ok(og.includes(page.EYEBROW) && og.includes(page.AI_NOTE));
});

test('바깥 자원을 부르지 않고 추적 · 전송 코드가 없다', () => {
  const srcs = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  for (const s of srcs) assert.ok(!/^(https?:)?\/\//.test(s) || /^https:\/\/(synk\.im\/|www\.instagram\.com\/synkbrief\/|www\.youtube\.com\/@synkbrief)/.test(s), s);
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage|document\.cookie|gtag|analytics/.test(html));
});

test('그림 파일에 생성 도구 표시(EXIF · XMP · C2PA)가 없다 — webp 조각은 그림 조각만', () => {
  const files = [...page.SHOTS.map((s) => path.join(HERE, 'shots', s.file)), path.join(HERE, 'brand-shift-sm.webp')];
  for (const f of files) {
    const b = fs.readFileSync(f);
    assert.equal(b.toString('latin1', 0, 4), 'RIFF');
    const chunks = [];
    for (let i = 12; i < b.length;) { const n = b.readUInt32LE(i + 4); chunks.push(b.toString('latin1', i, i + 4)); i += 8 + n + (n & 1); }
    for (const c of chunks) assert.ok(['VP8 ', 'VP8L', 'VP8X', 'ALPH'].includes(c), `${path.basename(f)}: ${c}`);
    assert.ok(!/c2pa|jumb|openai|google|gemini/i.test(b.toString('latin1')), path.basename(f));
  }
});
