'use strict';
/* 심문 장부 개명 사슬 회귀 — 2026-09-01 (유호님 「개명 사건 줄 받게 지어줘」)
 *
 * 무엇을 지키나: **개명된 문서에서 두 자가 서로 다르게 틀리지 않는가.**
 *   09-01 실물 — `docs/학생ID_종단_설계_v1.md` 가 `_v1` 없이 개명되자
 *     · ai스택점검  → 「추적 끊김」으로 **영원히 운다**(재심문해도 옛 줄은 그대로 남는다)
 *     · review-runs → 파일이 없으니 `continue` 로 **영원히 침묵한다**
 *   한쪽은 쉬지 않고 울고, 한쪽은 눈이 멀었다. 장부의 유일한 심문 이력이 그 상태였다.
 *
 * 🔑 그래서 이 파일이 재는 것은 «개명 줄을 적을 수 있나»가 아니라
 *   **적고 나면 두 자가 같은 최종 이름을 보는가**다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const 해석 = require(path.join(REPO, 'tools', 'lib', '심문장부.js'));
const 자 = path.join(REPO, 'tools', 'ai스택점검.js');

// ───────────────────────────── 사슬 해석 (순수 함수)

test('개명 한 번 — 최종 이름을 따라간다', () => {
  const 맵 = 해석.개명맵([{ 종류: '개명', 옛대상: 'a.md', 새대상: 'b.md' }]);
  assert.deepStrictEqual(해석.최종이름(맵, 'a.md'), { 이름: 'b.md', 사슬: ['b.md'], 순환: false });
});

test('개명 여러 번 — 사슬 끝까지 간다(중간 이름에서 멈추지 않는다)', () => {
  const 맵 = 해석.개명맵([
    { 종류: '개명', 옛대상: 'a.md', 새대상: 'b.md' },
    { 종류: '개명', 옛대상: 'b.md', 새대상: 'c.md' },
  ]);
  assert.strictEqual(해석.최종이름(맵, 'a.md').이름, 'c.md');
});

test('🔴 사슬이 돌면 «끊고 사실대로 알린다» — 훅이 멈추면 세션 시작이 안 열린다', () => {
  const 맵 = 해석.개명맵([
    { 종류: '개명', 옛대상: 'a.md', 새대상: 'b.md' },
    { 종류: '개명', 옛대상: 'b.md', 새대상: 'a.md' },
  ]);
  const r = 해석.최종이름(맵, 'a.md');
  assert.strictEqual(r.순환, true, '순환을 숨기지 않는다');
  assert.ok(['a.md', 'b.md'].includes(r.이름));
});

test('같은 옛 이름이 두 번 개명되면 나중 줄이 이긴다(장부는 시간 순)', () => {
  const 맵 = 해석.개명맵([
    { 종류: '개명', 옛대상: 'a.md', 새대상: 'b.md' },
    { 종류: '개명', 옛대상: 'a.md', 새대상: 'c.md' },
  ]);
  assert.strictEqual(해석.최종이름(맵, 'a.md').이름, 'c.md');
});

test('🔑 지문은 «심문할 때» 것이고 이름만 최종으로 바뀐다 — 그래야 개명 뒤에도 드리프트를 잰다', () => {
  const 접힘 = 해석.요약([
    { 종류: '심문', 상태: '완료', 대상: 'docs/옛.md', 대상지문: 'abcabcabcabc' },
    { 종류: '개명', 옛대상: 'docs/옛.md', 새대상: 'docs/새.md', 사유: '판번호를 뗐다' },
  ]);
  assert.ok(접힘.심문됨.has('docs/새.md'), '심문 이력이 새 이름으로 따라와야 한다');
  assert.ok(!접힘.심문됨.has('docs/옛.md'));
  const v = 접힘.대상들.get('docs/새.md');
  assert.strictEqual(v.지문, 'abcabcabcabc', '지문은 심문 때 그대로');
  assert.strictEqual(v.원본, 'docs/옛.md');
  assert.strictEqual(v.개명됨, true);
});

test('한 줄이 깨져도 나머지를 읽는다 — 통짜 try/catch 면 장부 하나 깨져 전부 침묵한다', () => {
  const { 행, 못읽음 } = 해석.파싱('{"종류":"심문","대상":"a.md"}\n{깨진 줄\n{"종류":"심문","대상":"b.md"}\n');
  assert.strictEqual(행.length, 2);
  assert.strictEqual(못읽음, 1, '못 읽은 줄 수를 «세어» 알린다');
});

// ───────────────────────────── 두 자가 같은 이름을 보는가

function 픽스처() {
  const 집 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-개명-'));
  fs.mkdirSync(path.join(집, 'docs', '_ops'), { recursive: true });
  return 집;
}
const 지문 = (s) => crypto.createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex').slice(0, 12);

function 장부쓰기(집, 줄들) {
  fs.writeFileSync(path.join(집, 'docs', '_ops', '심문기록.jsonl'),
    줄들.map((o) => JSON.stringify(o)).join('\n') + '\n', 'utf8');
}

function 자돌리기(집, 인자 = ['--json']) {
  return spawnSync(process.execPath, [자, ...인자], {
    encoding: 'utf8',
    env: {
      ...process.env,
      SYNK_AISTACK_ROOT: 집,
      SYNK_MN_LEDGER: path.join(집, 'docs', '_ops', '몽골어검문.jsonl'),
      SYNK_OUTSIDE_LEDGER: path.join(집, 'docs', '_ops', '밖의사실.jsonl'),
      SYNK_AISTACK_STAMP: path.join(집, '도장.json'),
    },
  });
}

const 심문축 = '②설계 심문 (Codex)';

test('🔴 개명 전 — 자는 «추적 끊김»으로 운다(이게 09-01 의 실물이다)', () => {
  const 집 = 픽스처();
  fs.writeFileSync(path.join(집, 'docs', '새이름_설계.md'), '<!-- 심문: 소급불가 -->\n본문\n', 'utf8');
  장부쓰기(집, [{ 종류: '심문', 상태: '완료', 대상: 'docs/옛이름_설계_v1.md', 대상지문: 'aaaaaaaaaaaa' }]);
  const j = JSON.parse(자돌리기(집).stdout);
  assert.strictEqual(j.축[심문축].끊김, 1);
  assert.strictEqual(j.축[심문축].미심문, 1, '새 이름은 심문 이력이 없는 것으로 보인다');
});

test('🔑 개명 줄을 얹으면 — 끊김이 닫히고 심문 이력이 새 이름으로 따라온다', () => {
  const 집 = 픽스처();
  fs.writeFileSync(path.join(집, 'docs', '새이름_설계.md'), '<!-- 심문: 소급불가 -->\n본문\n', 'utf8');
  장부쓰기(집, [
    { 종류: '심문', 상태: '완료', 대상: 'docs/옛이름_설계_v1.md', 대상지문: 'aaaaaaaaaaaa' },
    { 종류: '개명', 옛대상: 'docs/옛이름_설계_v1.md', 새대상: 'docs/새이름_설계.md', 사유: '판번호를 뗐다' },
  ]);
  const j = JSON.parse(자돌리기(집).stdout);
  assert.strictEqual(j.축[심문축].끊김, 0, '끊김이 닫혀야 한다');
  assert.strictEqual(j.축[심문축].미심문, 0, '심문 이력이 새 이름으로 따라와야 한다');
  assert.strictEqual(j.축[심문축].개명, 1);
  /* 🔑 과녁은 «개명 사슬»이다 — 자의 «다른 축»이 내는 적색까지 0 으로 묶으면 개명과 무관한 일로
   *   이 시험이 빨개지고, 다음 사람이 원인을 처음부터 다시 캔다.
   *   09-03 실측이 그 자리였다: 픽스처는 빈 저장소라 제미나이 열쇠가 없고, 자가 그것으로 적색 11건을
   *   냈다(「글」 열쇠 파일 부재 · 「돈」 크레딧 소진). 그동안 개명 축은 끊김 0 · 미심문 0 · 순환 0 으로
   *   내내 정상이었다 — 즉 이 줄은 «이 시험이 재려는 것»을 한 번도 안 재고 환경만 재고 있었다.
   *   과녁만 잰다. 환경 적색은 ai스택점검 자신이 세션 첫머리에 짖는다(그게 그쪽 통로다). */
  const 개명적색 = j.적색.filter((l) => /개명|끊김|미심문|심문 이력/.test(l));
  assert.deepStrictEqual(개명적색, [], '개명 사슬 쪽 적색이 있다');
});

test('개명 사슬이 도는 장부는 자가 «적색»으로 말한다', () => {
  const 집 = 픽스처();
  fs.writeFileSync(path.join(집, 'docs', 'a_설계.md'), '본문\n', 'utf8');
  장부쓰기(집, [
    { 종류: '심문', 상태: '완료', 대상: 'docs/a_설계.md', 대상지문: 'aaaaaaaaaaaa' },
    { 종류: '개명', 옛대상: 'docs/a_설계.md', 새대상: 'docs/b_설계.md' },
    { 종류: '개명', 옛대상: 'docs/b_설계.md', 새대상: 'docs/a_설계.md' },
  ]);
  const j = JSON.parse(자돌리기(집).stdout);
  assert.strictEqual(j.축[심문축].순환, 1);
  assert.ok(j.적색.some((l) => /개명 사슬이 돈다/.test(l)));
});

// ───────────────────────────── --개명 이 거절하는 자리 넷

test('--개명 은 사실이 아니면 적지 않는다 — 거절 넷', () => {
  const 집 = 픽스처();
  fs.writeFileSync(path.join(집, 'docs', '있다.md'), 'x', 'utf8');
  fs.writeFileSync(path.join(집, 'docs', '옛것도있다.md'), 'x', 'utf8');
  장부쓰기(집, [{ 종류: '심문', 상태: '완료', 대상: 'docs/장부에있다.md', 대상지문: 'aaaaaaaaaaaa' }]);

  const 거절 = (인자, 무늬, 왜) => {
    const r = 자돌리기(집, 인자);
    assert.notStrictEqual(r.status, 0, `${왜} — 거절해야 한다`);
    assert.match(r.stderr, 무늬, 왜);
  };
  거절(['--개명', 'docs/장부에있다.md'], /옛경로.*새경로|실행 오류/, '값이 모자라면');
  거절(['--개명', 'docs/장부에있다.md', 'docs/있다.md'], /--사유 가 필요하다/, '사유가 없으면');
  거절(['--개명', 'docs/장부에있다.md', 'docs/없는것.md', '--사유', 'ㅇ'], /새 경로가 없다/, '새 파일이 없으면(오타)');
  거절(['--개명', 'docs/옛것도있다.md', 'docs/있다.md', '--사유', 'ㅇ'], /옛 경로가 아직 있다/, '둘 다 있으면(사본이다)');
  거절(['--개명', 'docs/안가리킨다.md', 'docs/있다.md', '--사유', 'ㅇ'], /가리키는 심문 줄이 없다/, '장부가 그 이름을 안 가리키면');
});

test('--개명 이 실제로 줄을 얹고, 그 줄을 자가 곧바로 읽는다', () => {
  const 집 = 픽스처();
  fs.writeFileSync(path.join(집, 'docs', '새것_설계.md'), '<!-- 심문: 소급불가 -->\n본문\n', 'utf8');
  장부쓰기(집, [{ 종류: '심문', 상태: '완료', 대상: 'docs/옛것_설계_v1.md', 대상지문: 'aaaaaaaaaaaa' }]);

  const r = 자돌리기(집, ['--개명', 'docs/옛것_설계_v1.md', 'docs/새것_설계.md', '--사유', '판번호를 파일명에서 뗐다']);
  assert.strictEqual(r.status, 0, r.stderr);

  const 줄들 = fs.readFileSync(path.join(집, 'docs', '_ops', '심문기록.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  const 개명줄 = 줄들.find((x) => x.종류 === '개명');
  assert.ok(개명줄, '개명 줄이 장부에 붙어야 한다');
  assert.strictEqual(개명줄.사유, '판번호를 파일명에서 뗐다');
  assert.strictEqual(줄들[0].종류, '심문', '옛 줄은 그대로 남는다 — 장부는 고쳐 쓰지 않는다');

  const j = JSON.parse(자돌리기(집).stdout);
  assert.strictEqual(j.축[심문축].끊김, 0);
  assert.strictEqual(j.축[심문축].미심문, 0);
});

// ───────────────────────────── review-runs 도 같은 이름을 보는가 (이번 변경의 값)

test('🔑 개명 뒤에도 review-runs 가 «심문 뒤 자란 것»을 잡는다 — 그전엔 영원히 침묵했다', () => {
  const 집 = 픽스처();
  const 지금본문 = '심문 뒤에 자란 본문\n';
  fs.writeFileSync(path.join(집, 'docs', '새이름_설계.md'), 지금본문, 'utf8');
  // 심문 때 지문은 지금과 «다르다» = 문서가 그 뒤 바뀌었다
  장부쓰기(집, [
    { 종류: '심문', 상태: '완료', 대상: 'docs/옛이름_설계_v1.md', 대상지문: '000000000000' },
    { 종류: '개명', 옛대상: 'docs/옛이름_설계_v1.md', 새대상: 'docs/새이름_설계.md', 사유: 'ㅇ' },
  ]);
  // 훅은 tools/lib 을 ROOT 밑에서 찾는다 — 픽스처에 모듈을 놔 준다.
  fs.mkdirSync(path.join(집, 'tools', 'lib'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'tools', 'lib', '심문장부.js'), path.join(집, 'tools', 'lib', '심문장부.js'));

  const 훅경로 = path.join(REPO, '.claude', 'hooks', 'review-runs.js');
  const r = spawnSync(process.execPath, ['-e',
    `process.env.SYNK_REVIEW_RUNS_ROOT=${JSON.stringify(집)};` +
    `const h=require(${JSON.stringify(훅경로)});` +
    'console.log(JSON.stringify(h.심문드리프트줄들()));'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  const 줄 = JSON.parse(r.stdout);
  assert.ok(줄.length, '드리프트를 내야 한다(그전엔 파일이 없어 continue 로 빠져 침묵했다)');
  assert.ok(줄.some((l) => /새이름_설계\.md/.test(l)), '최종 이름으로 말해야 한다');
  assert.ok(줄.some((l) => /개명 전/.test(l)), '개명됐다는 사실을 함께 알려야 한다');
  assert.ok(줄.some((l) => new RegExp(지문(지금본문)).test(l)), '지금 지문을 정확히 재야 한다');
});

test('개명 뒤에도 «안 자랐으면» 조용하다 — 개명 자체가 드리프트가 아니다', () => {
  const 집 = 픽스처();
  const 본문 = '그대로인 본문\n';
  fs.writeFileSync(path.join(집, 'docs', '새이름_설계.md'), 본문, 'utf8');
  장부쓰기(집, [
    { 종류: '심문', 상태: '완료', 대상: 'docs/옛이름_설계_v1.md', 대상지문: 지문(본문) },
    { 종류: '개명', 옛대상: 'docs/옛이름_설계_v1.md', 새대상: 'docs/새이름_설계.md', 사유: 'ㅇ' },
  ]);
  fs.mkdirSync(path.join(집, 'tools', 'lib'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'tools', 'lib', '심문장부.js'), path.join(집, 'tools', 'lib', '심문장부.js'));

  const 훅경로 = path.join(REPO, '.claude', 'hooks', 'review-runs.js');
  const r = spawnSync(process.execPath, ['-e',
    `process.env.SYNK_REVIEW_RUNS_ROOT=${JSON.stringify(집)};` +
    `const h=require(${JSON.stringify(훅경로)});` +
    'console.log(JSON.stringify(h.심문드리프트줄들()));'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.deepStrictEqual(JSON.parse(r.stdout), []);
});
