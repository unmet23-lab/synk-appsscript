/**
 * **철학열람빌드 매니페스트가 가리키는 원본이 전부 실재하고, 없으면 빌드가 소리 내 실패한다.**
 *
 * 왜 기계로 막나: 2026-08-10 실측 — LAB철학.md 가 docs/_archive/ 로 이관됐는데 매니페스트가
 * 옛 경로를 그대로 물고 있었고, 빌드는 「없음」 한 줄만 찍고 exit 0 으로 지나갔다. 그래서
 * 바탕화면 02 사본이 하루 넘게 낡은 채 「갱신된 척」 남았다(00·01·03 만 갱신 — 유호님이 발견).
 * 문서 이관은 앞으로도 있고, 그때마다 이 매니페스트를 기억할 사람은 없다.
 *
 * 탐지력은 픽스처가 진다(없는 경로를 일부러 넣어 throw 를 확인) — 실저장소 검사는 실존 단언뿐.
 * repo 밖(레지스트리·진짜 바탕화면)은 안 만진다 — require 는 부작용 0 이고, 빌드는 out·docs 를
 * 파라미터로 받아 임시 디렉터리에 굽는다. 그래서 CI 에서 안전하다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { DOCS, 빌드 } = require('../tools/철학열람빌드.js');

test('철학열람빌드: 매니페스트 원본이 전부 실재한다', () => {
  assert.ok(Array.isArray(DOCS) && DOCS.length > 0, 'DOCS 가 비었다 — 빌드가 0건을 「성공」으로 낸다');
  for (const [rel, name] of DOCS) {
    assert.ok(
      fs.existsSync(path.join(ROOT, rel)),
      `원본 없음: ${rel} (→ ${name}.html) — 문서를 이관했으면 매니페스트도 같은 커밋에서 고치고, 항목을 뺐으면 바탕화면 사본도 걷는다`
    );
  }
});

test('철학열람빌드: 산출물 이름이 겹치지 않는다', () => {
  const names = DOCS.map(([, name]) => name);
  assert.strictEqual(new Set(names).size, names.length, '같은 이름이 둘이면 뒤가 앞을 조용히 덮는다');
});

test('철학열람빌드: 원본 없는 항목은 조용히 지나가지 않는다(있는 항목은 굽고, 끝에 던진다)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '철학열람빌드-'));
  try {
    assert.throws(
      () => 빌드({ out: tmp, docs: [['docs/SYNK_철학.md', '01_있는것'], ['docs/이런파일은없다.md', 'XX_없는것']] }),
      /원본 없는 항목 1건/
    );
    assert.ok(fs.existsSync(path.join(tmp, '01_있는것.html')), '실패 신호 전에 있는 항목은 이미 구워져 있어야 한다(부분 산출 유지)');
    assert.ok(!fs.existsSync(path.join(tmp, 'XX_없는것.html')), '없는 원본의 산출물이 생기면 안 된다');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
