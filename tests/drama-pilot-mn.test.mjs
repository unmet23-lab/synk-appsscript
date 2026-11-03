// 드라마 시범판 몽골어 화면(11-03, docs/드라마말하기_몽골시범_20261103.md §7 ②): 글 묶음이 한 · 영과 같은 키를 갖고, 대사 뜻 · 상황 카드에
// 몽골어가 실리며, 화면 언어가 WORLD에서 고른 언어(localStorage 'synk.world.lang')를 따른다. 몽골어 글의 확인 회차는 qa/몽골어-20261103.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STR } from '../experiences/drama/pilot/strings.mjs';
import PILOT from '../experiences/drama/pilot/content.mjs';
import { buildWorldLesson } from '../tools/build-drama-world.mjs';
import { findIn, HIT } from '../tools/lib/드라마판정.mjs';
import { LANG_KEY } from '../experiences/brand-opening/world-lang.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pilot = fs.readFileSync(path.join(REPO, 'experiences/drama/pilot/pilot.mjs'), 'utf8');

test('몽골어 글 묶음은 영어와 같은 키 · 같은 꼴(함수는 함수로)이고 빈 글이 없다', () => {
  assert.deepEqual(Object.keys(STR.mn).sort(), Object.keys(STR.en).sort());
  for (const [k, v] of Object.entries(STR.en)) {
    assert.equal(typeof STR.mn[k], typeof v, k);
    if (typeof v === 'string') assert.ok(STR.mn[k].trim(), k);
    if (v && typeof v === 'object') assert.deepEqual(Object.keys(STR.mn[k]).sort(), Object.keys(v).sort(), k);
  }
  assert.equal(STR.mn.noteMissing('도서관').includes('도서관'), true);
  // 문장 안에서 가리키는 단추 이름이 실제 단추 글과 같다.
  assert.ok(STR.mn.noteHedge.includes(`«${STR.mn.differs}»`));
  assert.ok(STR.mn.readAlong.includes(`«${STR.mn.next}»`) && STR.mn.readAlongTransfer.includes(`«${STR.mn.finish}»`));
});

test('장면 대사마다 몽골어 뜻, 새 상황 · C 카드에 몽골어 상황 글 — 카드에는 한국어 답 낱말 · 모범 문장이 없다', async () => {
  for (const line of PILOT.scene) assert.ok(line.meaningMn?.trim(), line.id);
  for (const item of [PILOT.transfer, PILOT.delayed]) {
    assert.ok(item.promptMn && !/[가-힣]/.test(item.promptMn), `${item.id} 몽골어 카드에 한글이 없다`);
    for (const k of item.spec.keys) for (const w of [k.word, ...(k.alts || [])]) assert.ok(findIn(w, item.promptMn) < HIT, w);
  }
  const built = await buildWorldLesson();
  assert.equal(built.lesson.transfer.promptMn, PILOT.transfer.promptMn);
  assert.equal(built.lesson.delayed.promptMn, PILOT.delayed.promptMn);
  assert.ok(built.lesson.scene.every((x) => x.meaningMn));
});

test('화면 언어: 주소 ?lang= → WORLD에서 고른 언어(같은 키) → 기기 언어, 언어 단추는 한국어와 학습자 언어를 오간다', () => {
  assert.equal(LANG_KEY, 'synk.world.lang');
  assert.match(pilot, /localStorage\.getItem\('synk\.world\.lang'\)/);
  assert.match(pilot, /const LANGS = \['ko', 'en', 'mn'\];/);
  assert.match(pilot, /S\.lang = S\.lang === 'ko' \? S\.home : 'ko';/);
  assert.match(pilot, /promptMn \|\| tr\.prompt/);
  assert.doesNotMatch(pilot, /item\.meaning \?/, '뜻은 meaningOf로만');
});

test('표지 제목은 낱말 사이에서만 줄이 바뀌고(긴 몽골어 제목), 카드 확인은 보이는 카드가 바뀔 때만 첫 화면을 다시 그린다(칩으로 연 창이 닫히지 않게)', () => {
  assert.match(pilot, /title\.split\(' '\)\.flatMap/);
  assert.match(pilot, /querySelectorAll\('\.w > span'\)/);
  assert.match(fs.readFileSync(path.join(REPO, 'experiences/drama/pilot/pilot.css'), 'utf8'), /\.slate \.t \.w \{ white-space: nowrap; \}/);
  assert.match(pilot, /\(due === true\) !== \(S\.delayedDue === true\)/);
  assert.match(pilot, /\(held === true\) !== \(S\.pendingB === true\)/);
});
