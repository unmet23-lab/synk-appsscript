'use strict';
/* AI 스택 점검 회귀 — 2026-09-01
 *
 * 무엇을 지키나: **이 자가 「0건」을 성공 얼굴로 내지 않는가.**
 *   실저장소에서 도는 초록은 「깨끗하다」와 「자가 죽었다」를 못 가른다. 그래서 탐지력은
 *   여기 픽스처가 진다(말투가드·검수런 회귀와 같은 정신).
 *
 * 🔴 첫 시험이 지키는 것이 이 도구의 실제 첫 사고다: 워크트리(`.claude/worktrees/…`)에서 돌리자
 *   SKIP 의 `worktrees` 가 **자기 저장소 문서 229벌을 통째로** 걸러내고 「후보 0 · 걸린 것 없음」을
 *   냈다. 절대경로에 자를 대면 저장소가 어디 놓였느냐로 답이 갈린다 — 그 회귀를 못 박는다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const 도구 = path.join(REPO, 'tools', 'ai스택점검.js');

/** 픽스처 저장소. `하위` 로 경로를 깊게 만들 수 있다(워크트리 회귀용). */
function 픽스처(하위) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ai스택-'));
  const 집 = 하위 ? path.join(뿌리, ...하위) : 뿌리;
  fs.mkdirSync(path.join(집, 'docs', '_ops'), { recursive: true });
  return 집;
}

function 문서(집, 이름, 본문) {
  fs.writeFileSync(path.join(집, 'docs', 이름), 본문, 'utf8');
}

function 장부(집, 파일, 줄들) {
  fs.writeFileSync(path.join(집, 'docs', '_ops', 파일), 줄들.map((o) => JSON.stringify(o)).join('\n') + '\n', 'utf8');
}

function 돌린다(집) {
  const r = spawnSync(process.execPath, [도구, '--json'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      SYNK_AISTACK_ROOT: 집,
      SYNK_MN_LEDGER: path.join(집, 'docs', '_ops', '몽골어검문.jsonl'),
      SYNK_OUTSIDE_LEDGER: path.join(집, 'docs', '_ops', '밖의사실.jsonl'),
      SYNK_AISTACK_STAMP: path.join(집, '도장.json'),
    },
  });
  assert.strictEqual(r.status, 0, `자가 못 돌았다(종료 ${r.status}): ${r.stderr}`);
  return JSON.parse(r.stdout);
}

const 심문축 = '②설계 심문 (Codex)';
const 몽골축 = '몽골어 검문 (Gemini)';
const 밖축 = '㉠밖의 사실 (DR 둘)';

// ───────────────────────────── 워크트리 회귀 (실제 첫 사고)

test('🔴 경로에 worktrees 가 들어 있어도 자기 문서를 센다 — 절대경로에 자를 대면 「0건」이 성공 얼굴이 된다', () => {
  const 집 = 픽스처(['.claude', 'worktrees', 'lane+x']);
  문서(집, '아무_설계.md', '이 계약은 소급 불가라 동결 뒤엔 못 고친다.\n');
  const j = 돌린다(집);
  assert.strictEqual(j.축[심문축].후보, 1, '워크트리 밑이라고 문서를 걸러내면 안 된다');
});

test('진짜 _archive·_ops 는 여전히 걸러낸다 — 회귀를 고치면서 자가 헐거워지지 않았는가', () => {
  const 집 = 픽스처();
  fs.mkdirSync(path.join(집, 'docs', '_archive'), { recursive: true });
  fs.writeFileSync(path.join(집, 'docs', '_archive', '옛_설계.md'), '소급 불가\n', 'utf8');
  assert.strictEqual(돌린다(집).축[심문축].후보, 0);
});

// ───────────────────────────── ㉠ 심문 커버리지

test('표식을 선언했는데 심문 장부에 없으면 «미심문»으로 운다', () => {
  const 집 = 픽스처();
  문서(집, '계약_설계.md', '<!-- 심문: 소급불가 -->\n본문\n');
  const j = 돌린다(집);
  assert.strictEqual(j.축[심문축].선언, 1);
  assert.strictEqual(j.축[심문축].미심문, 1);
  assert.ok(j.적색.some((l) => /장부에 심문 기록이 없는/.test(l)), '적색이어야 한다');
  /* 🔑 자가 아는 것은 «장부»뿐이라는 것을 말로도 남겨야 한다 — 09-01 실측에서 장부(08-29 이후)가
   *   못 본 심문이 넷 있었다(엔진도달 v1 은 P0 12건 동결 불가까지 받았는데 장부엔 0줄).
   *   「안 받았다」로 단정하는 문면으로 되돌아가면 이 시험이 막는다. */
  assert.ok(j.적색.some((l) => /「안 받았다」가 아니라/.test(l)), '자의 한계를 함께 말해야 한다');
});

test('심문을 받았으면 조용하다 — 장부의 대상 경로로 대조한다', () => {
  const 집 = 픽스처();
  문서(집, '계약_설계.md', '<!-- 심문: 소급불가 -->\n본문\n');
  장부(집, '심문기록.jsonl', [{ 종류: '심문', 상태: '완료', 대상: 'docs/계약_설계.md', 대상지문: 'abc123456789' }]);
  assert.strictEqual(돌린다(집).축[심문축].미심문, 0);
});

test('면제는 세되 안 운다 — 다만 **사유 없는 면제**는 적색이다(「검토했다」와 「껐다」가 같은 모양이면 안 된다)', () => {
  const 집 = 픽스처();
  문서(집, '가_설계.md', '<!-- 심문: 면제 · 학생 데이터에 안 닿는다 -->\n');
  문서(집, '나_설계.md', '<!-- 심문: 면제 -->\n');
  const j = 돌린다(집);
  assert.strictEqual(j.축[심문축].면제, 2);
  assert.strictEqual(j.축[심문축].미심문, 0);
  assert.ok(j.적색.some((l) => /사유가 없다/.test(l)));
  assert.ok(!j.적색.some((l) => /가_설계/.test(l)), '사유를 적은 면제는 안 운다');
});

test('🔑 장부가 가리키는 파일이 없으면 «추적 끊김»으로 운다 — review-runs 는 여기서 침묵한다(:206)', () => {
  const 집 = 픽스처();
  장부(집, '심문기록.jsonl', [{ 종류: '심문', 상태: '완료', 대상: 'docs/사라진_설계_v1.md', 대상지문: 'aaaaaaaaaaaa' }]);
  const j = 돌린다(집);
  assert.strictEqual(j.축[심문축].끊김, 1);
  assert.ok(j.적색.some((l) => /추적 끊김/.test(l)));
});

test('표식이 없고 본문이 「소급 불가」를 말하는 설계·계약·규격만 후보다 — 목록을 짓지 않는다', () => {
  const 집 = 픽스처();
  문서(집, '가_설계.md', '소급 불가한 칸이 있다\n');        // 후보
  문서(집, '나_규격.md', '소급불가\n');                     // 후보(붙여 쓴 꼴)
  문서(집, '다_설계.md', '평범한 설계다\n');                 // 본문이 말하지 않는다
  문서(집, '라_회고.md', '소급 불가\n');                     // 이름이 설계·계약·규격이 아니다
  assert.strictEqual(돌린다(집).축[심문축].후보, 2);
});

test('🔴 규약을 «설명»하는 문서가 «선언»으로 안 읽힌다 — 코드 표기 안의 표식은 말하는 것이지 선언이 아니다', () => {
  const 집 = 픽스처();
  // 09-01 실물: 표식 규약을 적어 둔 AI_스택_가이드 가 스스로 「심문 대상 · 미심문」으로 잡혔다.
  문서(집, '규약_설계.md', '표식은 `<!-- 심문: 소급불가 -->` 처럼 둔다.\n\n```\n<!-- 심문: 면제 -->\n```\n');
  const j = 돌린다(집);
  assert.strictEqual(j.축[심문축].선언, 0, '인라인 코드 안의 표식은 선언이 아니다');
  assert.strictEqual(j.축[심문축].면제, 0, '펜스 블록 안의 표식도 선언이 아니다');
  assert.strictEqual(j.적색.length, 0);
});

test('raw 로 놓인 표식은 그대로 선언이다 — 위 회귀가 진짜 선언까지 죽이지 않았는가', () => {
  const 집 = 픽스처();
  문서(집, '진짜_설계.md', '머리말\n<!-- 심문: 소급불가 -->\n본문에 `코드` 도 있다.\n');
  assert.strictEqual(돌린다(집).축[심문축].선언, 1);
});

// ───────────────────────────── ㉡ 몽골어 검문

test('장부가 없는 것과 0건을 가른다 — 없으면 «안 재봤다»(줄=null)', () => {
  const j = 돌린다(픽스처());
  assert.strictEqual(j.축[몽골축].줄, null, '장부 없음은 0이 아니라 null 이다');
  assert.ok(j.알림.some((l) => /안 재봤다/.test(l)));
});

test('🔑 검문 뒤 문안이 바뀌면 운다 — 도장은 «내용 지문»에 찍힌다', () => {
  const 집 = 픽스처();
  문서(집, '문안.md', '바뀐 뒤의 내용\n');
  장부(집, '몽골어검문.jsonl', [{ 시각: 't', 대상: 'docs/문안.md', 대상지문: '000000000000', 통과: true }]);
  const j = 돌린다(집);
  assert.strictEqual(j.축[몽골축].바뀜, 1);
  assert.ok(j.적색.some((l) => /검문 뒤 문안이 바뀐/.test(l)));
});

test('지문이 그대로면 조용하다', () => {
  const 집 = 픽스처();
  const 본문 = '그대로인 내용\n';
  문서(집, '문안.md', 본문);
  const 지문 = require('node:crypto').createHash('sha256').update(Buffer.from(본문, 'utf8')).digest('hex').slice(0, 12);
  장부(집, '몽골어검문.jsonl', [{ 시각: 't', 대상: 'docs/문안.md', 대상지문: 지문, 통과: true }]);
  assert.strictEqual(돌린다(집).축[몽골축].바뀜, 0);
});

test('인자 모드만 있으면 «드리프트를 원리상 못 잰다»고 말한다 — 통과로 위장하지 않는다', () => {
  const 집 = 픽스처();
  장부(집, '몽골어검문.jsonl', [{ 시각: 't', 대상: '(인자)', 번역지문: 'x', 통과: true }]);
  const j = 돌린다(집);
  assert.strictEqual(j.축[몽골축].파일대상, 0);
  assert.ok(j.알림.some((l) => /원리상 못 잰다/.test(l)));
});

// ───────────────────────────── ㉢ 밖의 사실

test('🔑 반박을 안 받은 명제는 «열림»으로 운다 — 「안 물어봤다」와 「통과」가 갈린다', () => {
  const 집 = 픽스처();
  장부(집, '밖의사실.jsonl', [{ 종류: '세움', 시각: 't', 키: 'k1', 명제: '어떤 법이 이렇다', 걸린것: '돈', 내답: '맞다' }]);
  const j = 돌린다(집);
  assert.strictEqual(j.축[밖축].열림, 1);
  assert.ok(j.적색.some((l) => /안 물어봤다/.test(l)));
});

test('반박이 오면 열림에서 빠지고, 판정이 없으면 «반박받음»에 선다', () => {
  const 집 = 픽스처();
  장부(집, '밖의사실.jsonl', [
    { 종류: '세움', 시각: 't', 키: 'k1', 명제: 'p', 걸린것: '돈', 내답: '맞다' },
    { 종류: '반박', 시각: 't2', 키: 'k1', 조사원: '제미나이 DR', 결과: '갈린다' },
  ]);
  const j = 돌린다(집);
  assert.strictEqual(j.축[밖축].열림, 0);
  assert.strictEqual(j.축[밖축].반박받음, 1);
});

test('판정까지 나야 «판정완료»다 — DR 답은 자료지 판정이 아니다', () => {
  const 집 = 픽스처();
  장부(집, '밖의사실.jsonl', [
    { 종류: '세움', 시각: 't', 키: 'k1', 명제: 'p', 걸린것: '돈', 내답: '맞다' },
    { 종류: '반박', 시각: 't2', 키: 'k1', 조사원: 'GPT DR', 결과: '갈린다' },
    { 종류: '판정', 시각: 't3', 키: 'k1', 결론: '내 답이 틀렸다', 사유: '조문 확인' },
  ]);
  const j = 돌린다(집);
  assert.strictEqual(j.축[밖축].판정완료, 1);
  assert.strictEqual(j.축[밖축].반박받음, 0);
});

// ───────────────────────────── 자 자신

test('🔴 워크트리에서도 스로틀 도장이 찍힌다 — `.git` 이 **파일**이면 gitdir 포인터를 따라간다', () => {
  const 집 = 픽스처();
  const 진짜git = path.join(집, 'git본체');
  fs.mkdirSync(진짜git, { recursive: true });
  fs.writeFileSync(path.join(집, '.git'), `gitdir: ${진짜git}\n`, 'utf8');   // 워크트리의 실제 꼴
  장부(집, '심문기록.jsonl', [{ 종류: '심문', 상태: '완료', 대상: 'docs/없다.md', 대상지문: 'a' }]);

  const env = {
    ...process.env,
    SYNK_AISTACK_ROOT: 집,
    SYNK_MN_LEDGER: path.join(집, 'docs', '_ops', '몽골어검문.jsonl'),
    SYNK_OUTSIDE_LEDGER: path.join(집, 'docs', '_ops', '밖의사실.jsonl'),
    SYNK_AISTACK_STAMP: '',                                                 // 기본 경로 결정을 그대로 재게 둔다
  };
  const 훅 = () => spawnSync(process.execPath, [도구, '--훅'], { encoding: 'utf8', env });

  const 첫판 = 훅();
  assert.match(첫판.stdout, /추적 끊김/, '적색이 한 번은 나와야 한다');
  assert.doesNotMatch(첫판.stdout, /도장을 못 썼다/, '도장 실패를 삼키지도, 나지도 않아야 한다');
  assert.ok(fs.existsSync(path.join(진짜git, 'synk-ai스택도장.json')), 'gitdir 포인터가 가리키는 폴더에 찍혀야 한다');

  assert.strictEqual(훅().stdout.trim(), '', '같은 날 두 번째는 침묵한다(스로틀이 실제로 먹는다)');
});

test('걸린 것이 하나도 없으면 적색 0 — 다만 그때도 축은 다 세어져 있다(초록은 분모와 함께 읽는다)', () => {
  const 집 = 픽스처();
  문서(집, '평범.md', '아무 말도 안 한다\n');
  장부(집, '몽골어검문.jsonl', [{ 시각: 't', 대상: '(인자)', 통과: true }]);
  장부(집, '밖의사실.jsonl', [
    { 종류: '세움', 시각: 't', 키: 'k1', 명제: 'p', 걸린것: '돈', 내답: '맞다' },
    { 종류: '판정', 시각: 't3', 키: 'k1', 결론: 'ok', 사유: 'ok' },
  ]);
  const j = 돌린다(집);
  assert.strictEqual(j.적색.length, 0);
  assert.strictEqual(j.축[심문축].후보, 0);
  assert.strictEqual(j.축[밖축].합, 1);
});
