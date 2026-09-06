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
      // 회귀는 **네트워크를 안 탄다** — 키 생존은 아래 전용 시험이 픽스처로 두 방향을 다 잰다.
      SYNK_GEMINI_PROBE: 'off',
      SYNK_GEMINI_STATE: path.join(집, '생존캐시.json'),
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

/* 🔴 09-03 실물: 안내가 «반쪽»이라 그대로 쳤더니 도구가 「파일 형식이 아니다」로 죽었다.
 *   캐러셀 원고는 몽골어만 들고 한국어는 옆 파일에 산다 — 짝이 있으면 `--원문` 까지 박아야
 *   복사해서 그대로 칠 수 있다. 안내가 막다른 길이면 그건 「0건」과 같은 얼굴을 한다. */
test('🔴 재검문 안내에 «짝 한국어 파일»이 붙는다 — 반쪽 명령은 그대로 치면 죽는다', () => {
  const 집 = 픽스처();
  문서(집, '문안.md', '바뀐 뒤의 몽골어\n');
  문서(집, '문안.한국어.md', '한국어 짝\n');
  장부(집, '몽골어검문.jsonl', [{ 시각: 't', 대상: 'docs/문안.md', 대상지문: '000000000000', 통과: false }]);
  const j = 돌린다(집);
  const 명령 = j.적색.filter((l) => l.includes('몽골어대조.js'));
  assert.strictEqual(명령.length, 1, `재기 명령이 한 줄이어야 한다: ${JSON.stringify(명령)}`);
  assert.match(명령[0], /--파일 "docs\/문안\.md" --원문 "docs\/문안\.한국어\.md"/);
});

test('짝이 «없으면» --원문 을 안 붙인다 — 없는 경로를 박으면 또 다른 막다른 길이다', () => {
  const 집 = 픽스처();
  문서(집, '문안.md', '바뀐 뒤의 몽골어\n');   // 짝 파일을 일부러 안 만든다
  장부(집, '몽골어검문.jsonl', [{ 시각: 't', 대상: 'docs/문안.md', 대상지문: '000000000000', 통과: false }]);
  const 명령 = 돌린다(집).적색.filter((l) => l.includes('몽골어대조.js'));
  assert.strictEqual(명령.length, 1);
  assert.doesNotMatch(명령[0], /--원문/, '짝이 없는데 붙였다 — 그 경로를 열면 도구가 죽는다');
});

test('지문이 그대로면 조용하다', () => {
  const 집 = 픽스처();
  const 본문 = '그대로인 내용\n';
  문서(집, '문안.md', 본문);
  const 지문 = require('node:crypto').createHash('sha256').update(Buffer.from(본문, 'utf8')).digest('hex').slice(0, 12);
  장부(집, '몽골어검문.jsonl', [{ 시각: 't', 대상: 'docs/문안.md', 대상지문: 지문, 통과: true }]);
  assert.strictEqual(돌린다(집).축[몽골축].바뀜, 0);
});

test('🔴 저장소 «밖» 대상은 드리프트에서 빼되 «바깥»으로 세어 적는다 — 안 빼면 영원히 「추적 끊김」으로 운다', () => {
  // 09-01 실물: 옆 세션이 scratchpad 워밍업 파일을 검문해 장부에 `../../AppData/…` 가 남았다.
  const 집 = 픽스처();
  장부(집, '몽골어검문.jsonl', [
    { 시각: 't', 대상: '../../AppData/Local/Temp/워밍업.txt', 대상지문: 'aaaaaaaaaaaa', 통과: true },
  ]);
  const j = 돌린다(집);
  assert.strictEqual(j.축[몽골축].바깥, 1);
  assert.strictEqual(j.축[몽골축].끊김, 0, '저장소 밖을 끊김으로 세면 영원히 운다');
  assert.strictEqual(j.적색.length, 0);
  assert.ok(j.알림.some((l) => /저장소 밖 1/.test(l)), '0으로 위장하지 않고 세어 적어야 한다');
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
    SYNK_GEMINI_PROBE: 'off',
    SYNK_GEMINI_STATE: path.join(집, '생존캐시.json'),
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

// ───────────────────────────── 제미나이 «키 생존» — 열쇠 둘 (2026-09-01 신설 · 09-03 둘로 갈림)
//
// 🔴 이 축이 생긴 까닭이 곧 그 시험이다: 09-02 저녁 열쇠가 429 로 죽었는데 다음 날 세션 첫머리가
//   **조용했다.** 커버리지 축은 「장부에 몇 줄 있나」를 세는데 장부는 «부른 적이 있어야» 자란다 —
//   아무도 안 부르면 침묵이 정상 얼굴이다.
// 🔑 09-03 부터 열쇠가 **둘**이다(유호 확정 「글은 공짜, 그림은 유료」). 하나만 재면 다른 하나의
//   죽음이 안 보이므로 **둘 다** 세고, 죽었을 때 «무엇이 멈추는지»가 용도마다 다르다.

const { 키생존축 } = require(도구);

const 산것 = (용도) => ({ 때: new Date(Date.now() - 90 * 60000).toISOString(), 캐시: true, 기록: { 살았나: true, 용도, 모델: 'gemini-3.8-flash' } });
const 죽은것 = (용도, o) => ({ 때: new Date(Date.now() - 60000).toISOString(), 캐시: false, 기록: { 살았나: false, 용도, ...o } });

/* 🔑 «우는 크기»가 용도마다 다르다 — 상시 도는 자리가 죽으면 적색, 예비가 죽으면 알림.
 *   (09-03 「항상 무료먼저」 때는 글이 상시라 글 = 적색 · 돈 = 알림이었다.)
 * 🔄 09-05 밤 유호 확정(「앞으로 제미나이 열쇠는 vertex로해야해」 · 결정.md)으로 상시 자리가 「돈」(Vertex · 크레딧)이 됐다 —
 *   몽골어 검문 · 검수 둘째 눈 · 설계 심문이 전부 거기 매달리고, 「글」(AI Studio 공짜)은 `--글` 을 손으로 준 예비다.
 *   그래서 이제 돈은 «적색», 글은 «알림»이다. 원리는 같다 — 안 쓰는 자리가 매 세션 빨갛게 울면 진짜 적색이 파묻힌다. */
test('🔴 「돈」 열쇠가 죽으면 **적색**이다(09-05 밤부터 상시 문) — 매달린 것과 충전 처방까지 말한다', () => {
  const a = 키생존축({
    글: 산것('글'),
    돈: 죽은것('돈', { 상태: 429, 종류: '한도·결제', 사유: 'prepayment credits are depleted' }),
  });
  assert.ok(a.적색.length > 0, '상시 문이 죽었는데 적색이 아니면 09-02 의 그 사고(조용한 죽음)다');
  const 전문 = a.적색.join('\n');
  assert.match(전문, /「돈」 열쇠/);
  assert.match(전문, /몽골어 검문/, '무엇이 매달렸는지를 그 줄에서 알아야 한다 — 이제 검문이 돈 문에 매달린다');
  assert.match(전문, /prepayment credits/, '구글이 한 말을 그대로 물고 와야 유호님이 어느 화면을 열지 안다');
  assert.match(전문, /크레딧 충전/, '잔액 소진이면 처방은 충전(유호님 손)이다');
  assert.doesNotMatch(전문, /새 칸/, '돈 문에 「공짜 열쇠를 새로 만들라」는 처방이 붙으면 틀린 처방이다');
  assert.strictEqual(a.셈.돈열쇠, '**아니오**');
  assert.strictEqual(a.셈.글열쇠, '예');
});

test('🟠 「글」 열쇠가 죽으면 **알림**이다(09-05 밤부터 예비 문) — 지금 멈추는 것이 없으므로 적색으로 울지 않는다', () => {
  const a = 키생존축({ 글: 죽은것('글', { 상태: 429, 종류: '한도·결제', 사유: 'quota' }), 돈: 산것('돈') });
  assert.strictEqual(a.적색.length, 0, '예비 자리가 적색으로 울면 진짜 적색이 파묻힌다');
  const 전문 = a.알림.join('\n');
  assert.ok(a.알림.length > 0, '죽었는데 아무 말도 안 하면 그게 09-02 의 그 사고다');
  assert.match(전문, /「글」 열쇠/);
  assert.match(전문, /예비/, '왜 급하지 않은지(예비 문)를 그 줄에서 말해야 한다');
  assert.match(전문, /지금 멈추는 것은 없다/, '급한 일이 아니라는 것까지 말해야 사람이 안 뛴다');
  assert.doesNotMatch(전문, /몽골어 검문/, '🔑 검문은 이제 돈 문에 매달린다 — 글이 죽어도 검문이 멈춘 것처럼 말하면 안 된다');
  assert.doesNotMatch(전문, /크레딧 충전/, '공짜 문에 충전을 권하면 틀린 처방이다');
  assert.strictEqual(a.셈.글열쇠, '**아니오**');
  assert.strictEqual(a.셈.돈열쇠, '예');
});

/* 🔴 09-05 실측 — 구글이 503 「high demand」 한 발을 냈는데 자가 「글 열쇠가 죽어 있다 · 새 열쇠를 만들라」고
 *   세션마다 울렸다. 5xx 는 구글 쪽이 지금 못 받는 것이라 새 열쇠도 같은 503 을 받는다 — 처방이 틀린 적색이었다.
 * 📏 자 = 화면이 무엇을 시키나. 「새 칸」「키 교체」「충전」 셋 다 없어야 하고, «잠시 뒤 다시»만 있어야 한다. */
test('🟠 서버 쪽 5xx 는 열쇠 죽음이 아니다 — 알림으로 내리고 처방은 «잠시 뒤 다시»뿐이다', () => {
  const a = 키생존축({ 글: 산것('글'), 돈: 죽은것('돈', { 상태: 503, 종류: '서버·일시', 사유: 'This model is currently experiencing high demand.' }) });
  assert.strictEqual(a.적색.length, 0, '구글 과부하를 적색으로 울리면 진짜 열쇠 죽음과 같은 얼굴이 된다');
  const 전문 = a.알림.join('\n');
  assert.match(전문, /잠시 막혔다|과부하/);
  assert.match(전문, /high demand/, '구글이 한 말을 그대로 물고 와야 한다');
  assert.match(전문, /다시 잰다/, '처방은 «잠시 뒤 다시» 하나다');
  assert.doesNotMatch(전문, /새 칸|키 교체|크레딧 충전/, '열쇠를 만들거나 바꾸라고 하면 그게 틀린 처방이다');
  assert.match(전문, /몽골어 검문/, '그 사이 안 도는 것은 그대로 적는다 — «살았다»가 아니다');
  assert.strictEqual(a.셈.돈열쇠, '**아니오**', '셈 칸은 «답 못 받았다»를 그대로 둔다');
});

test('자격(401·403)이면 처방이 또 다르다 — 글(API 키)은 키 교체 · 돈(OAuth 토큰)은 clasp login · 둘 다 충전이 아니다', () => {
  const 글쪽 = 키생존축({ 글: 죽은것('글', { 상태: 403, 종류: '자격', 사유: 'API key not valid' }), 돈: 산것('돈') });
  assert.match(글쪽.알림.join('\n'), /키 교체/, '글은 예비라 알림이되, 처방은 키 교체다');
  assert.doesNotMatch(글쪽.알림.join('\n'), /크레딧 충전/);
  const 돈쪽 = 키생존축({ 글: 산것('글'), 돈: 죽은것('돈', { 상태: 401, 종류: '자격', 사유: 'invalid authentication credentials' }) });
  assert.match(돈쪽.적색.join('\n'), /clasp login/, 'Vertex 는 OAuth 토큰이라 처방은 재로그인(유호님 손)이다');
  assert.doesNotMatch(돈쪽.적색.join('\n'), /크레딧 충전|키 교체/, '토큰 죽음에 충전이나 키 교체를 권하면 틀린 처방이다');
});

test('🔴 열쇠 파일이 «아직 없는» 것은 적색이고, 만드는 법까지 준다 — 「없다」만 말하면 다음 수를 모른다', () => {
  const a = 키생존축({
    글: { 때: null, 기록: { 살았나: null, 용도: '글', 종류: '키없음', 사유: '키 파일을 못 읽었다(…)', 안내: '공짜 몫 열쇠 파일이 없다: X\n만드는 법: aistudio…' } },
    돈: 산것('돈'),
  });
  const 전문 = a.적색.join('\n');
  assert.match(전문, /열쇠 파일이 없다/);
  assert.match(전문, /만드는 법/, '처방 없는 적색은 사람을 멈춰 세우기만 한다');
});

test('🔴 못 물어본 것은 «살았다»가 아니다 — 알림으로 갈라 말한다(0건이 성공 얼굴이 되는 자리)', () => {
  const a = 키생존축({
    글: { 때: null, 기록: { 살았나: null, 용도: '글', 종류: '네트워크', 사유: 'timeout' } },
    돈: 산것('돈'),
  });
  assert.strictEqual(a.적색.length, 0, '못 잰 것을 적색으로 울리면 자가 요란해진다');
  assert.match(a.알림.join('\n'), /못 물어봤다/);
  assert.strictEqual(a.셈.글열쇠, null, 'null 은 «안 재봤다»로 나가야 한다(예/아니오가 아니다)');
});

test('둘 다 살아 있으면 조용하다 — 다만 «언제 쟀나»는 남고, 세계시를 그대로 찍지 않는다', () => {
  const a = 키생존축({ 글: 산것('글'), 돈: 산것('돈') });
  assert.strictEqual(a.적색.length + a.알림.length, 0);
  assert.strictEqual(a.셈.글열쇠, '예');
  assert.strictEqual(a.셈.돈열쇠, '예');
  /* 🔑 «몇 분 전»으로 적는다 — 장부는 세계시라 그대로 찍으면 방금 잰 것이 「어제」로 읽힌다.
   *   첫 실물이 그랬다(09-03 00:20 에 잰 값이 「09-02 15:20 실측」으로 나갔다). */
  assert.match(a.셈.글잰때, /2시간 전 실측/);
  assert.doesNotMatch(a.셈.글잰때, /\d{4}-\d{2}-\d{2}/, '유호님이 읽는 줄에 세계시를 그대로 찍지 않는다');
});

test('열쇠 하나짜리 «옛» 모양으로 불러도 글로 읽는다 — 옛 캐시가 자를 깨뜨리지 않는다', () => {
  const a = 키생존축({ 때: new Date().toISOString(), 기록: { 살았나: false, 상태: 429, 종류: '한도·결제', 사유: 'x' } });
  // 09-05 밤부터 글은 예비 문이라 죽음이 «알림»에 실린다 — 옛 모양이 글로 읽히는지만 본다.
  assert.match(a.알림.join('\n'), /「글」 열쇠/, '옛 모양(열쇠 하나짜리)이 글로 안 읽혔다');
  assert.strictEqual(a.적색.length, 0, '예비 문(글)의 죽음이 적색으로 올라왔다');
});

// ───────────────────────────── ③실행자 (GPT) — 「던졌나」와 「탔나」를 갈라 센다 (2026-09-06)

const 실행축 = '③실행자 (GPT)';

test('🟠 실행자 장부가 0줄이면 «한 번도 안 돌았다»고 말한다 — 넷째 벤더 자리의 침묵이 초록으로 읽히던 자리', () => {
  const 집 = 픽스처();
  const a = 돌린다(집).축[실행축];
  assert.strictEqual(a.합, 0);
  assert.strictEqual(a.제품, 0);
});

test('시험 런(probe-)은 제품 런이 아니다 — 섞어 세면 「돌고 있다」는 거짓 초록이 난다', () => {
  const 집 = 픽스처();
  장부(집, '실행기록.jsonl', [
    { 시각: '2026-09-03T15:56:53.488Z', 저장소: 'probe-exec', 라운드들: [{ 라운드: 1 }], 상태: '완주' },
  ]);
  const a = 돌린다(집).축[실행축];
  assert.strictEqual(a.합, 1);
  assert.strictEqual(a.제품, 0, 'probe- 런을 제품으로 세면 안 된다');
  assert.strictEqual(a.완주, 0);
});

test('발주만 던지고 «실행자를 못 태운» 런은 완주가 아니다 — 라운드가 비었으면 그 자리에서 멈춘 것이다', () => {
  const 집 = 픽스처();
  장부(집, '실행기록.jsonl', [
    { 시각: '2026-09-03T21:05:29.236Z', 저장소: 'SYNK-appsscript', 발주: { 제목: '발주 — 아무것' }, 검토: { 구멍들: [{}, {}] }, 라운드들: [], 상태: '발주보완필요' },
    { 시각: '2026-09-04T01:00:00.000Z', 저장소: 'SYNK-appsscript', 발주: { 제목: '발주 — 다른것' }, 라운드들: [{ 라운드: 1 }], 상태: '완주' },
  ]);
  const a = 돌린다(집).축[실행축];
  assert.strictEqual(a.제품, 2);
  assert.strictEqual(a.완주, 1);
  assert.strictEqual(a.못탐, 1, '라운드 0 인 런을 완주 옆에 세우면 발주 검토가 돌려보낸 것이 안 보인다');
});
