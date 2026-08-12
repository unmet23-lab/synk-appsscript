#!/usr/bin/env node
'use strict';
/* Fable 전용 설계 심문 — 조립·지문·결과경로는 **codex-review 의 것을 그대로 쓴다.**
 *
 * 왜 도구가 있나 (2026-08-11 · 유호님 지시 「원할 때 페이블로 따로 돌려보고 싶다」):
 *   Fable 은 codex CLI 가 아니라 **Agent 위임**으로 돈다. 그래서 실행은 세션이 하는데,
 *   실행 앞의 조립(금지목록 전량·템플릿 머리말 자르기·지문 박기)을 세션이 손으로 하면
 *   회차마다 갈리고 **그 순간 판끼리 대조가 원리상 무효가 된다**(F281 실측 — 금지 지문 4판 상이).
 *   그래서 이 파일의 존재 이유는 심문이 아니라 **손 조립을 없애는 것**이다.
 *
 * 🔑 사본을 만들지 않는다. 프롬프트 정본은 `docs/_ops/동결심문_프롬프트.md` 하나이고,
 *   `심문프롬프트`·`금지지문`·`심문결과경로` 는 codex-review 에서 **가져다 쓴다.**
 *   여기서 다시 구현하면 두 통로가 갈리고, 갈린 쪽은 언제나 조용히 통과한다.
 *
 * 🔑 지시문을 stdout 으로 뱉지 않는다 — 대상 문서가 112KB 인 것도 있어 세션 컨텍스트를
 *   통째로 지나간다. **파일로 쓰고 경로만 준다**: 심문자 에이전트가 스스로 열어 읽는다.
 *
 * 장부는 `심문기록.jsonl`(codex 몫)과 **섞지 않는다** — 대상이 다른 기록은 장부도 다르다.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const cr = require(path.join(ROOT, 'tools', 'codex-review.js'));

const 픽이름 = 'fable';
const 모델 = 'claude-fable-5';
const 장부 = process.env.SYNK_FABLE_LEDGER || path.join(ROOT, 'docs', '_ops', '심문기록_fable.jsonl');

/* 확인 불가 = 통과가 아니다. codex-review 와 같은 어휘를 쓴다. */
function 확인불가(msg) {
  const e = new Error(msg);
  e.확인불가 = true;
  return e;
}

/* 범위별 추가 렌즈 — **정본은 여기다.** 스킬 문서에 본문을 사본하면 두 곳이 갈린다.
 * ①② 는 템플릿의 렌즈 7개 그대로. ③ 은 코드 실물, ④ 는 운영 실물까지 연다. */
const 추가렌즈 = {
  3: [
    '8. **문서↔코드 배신**: 이 문서가 규정한 필드·엔드포인트·상태 전이가 실제 코드에 있는가?',
    '   `Grep` 으로 직접 확인하라 — 「있다고 쓰여 있다」는 근거가 아니다.',
    '9. **미착지**: 문서엔 확정으로 적혔는데 코드에 흔적이 0인 항목.',
    '10. **역방향**: 코드가 하는 일 중 어느 문서도 규정하지 않은 것(= 아무도 안 지키는 계약).',
    '11. **회귀 공백**: 문서가 「막았다」고 주장하는 것에 테스트가 실재하는가?',
  ],
  4: [
    '12. **라이브 배신**: 저장소 HEAD 와 라이브 배포본이 갈린 자리. 소급 불가 데이터가 걸렸는가?',
    '13. **스키마 실물**: 문서의 열·테이블이 운영 DB·시트에 실재하는가?',
    '   ⚠ 운영 실물 스냅샷이 이 지시문에 첨부돼 있지 않으면 **「못 열었다」고 적어라.**',
    '   안 읽고 낸 「지적 0건」은 통과의 얼굴을 한 미실행이다.',
  ],
};

/* 렌즈를 「## 출력 형식」 **앞**에 끼운다. 마커가 없으면 던진다 — 조용히 안 붙이면
 * 범위 ③④ 를 골랐는데 ② 를 돌린 것이 되고, 그건 「통과」와 같은 모양으로 나온다.
 *
 * 🔑 **범위 판정은 여기 한 곳에서만 한다.** 회귀가 잡은 첫 구멍이 그거다(2026-08-11):
 *   범위 검사를 `준비()` 에도 적었더니 이 함수는 모르는 범위(5)를 `추가렌즈[5] || []` 로
 *   조용히 삼켜 **범위 4 를 돌고 「5 로 돌았다」고 말했다.** 호출부가 하나뿐이라 실사고는
 *   안 났지만, 두 곳에 적힌 판정은 갈리고 갈린 쪽은 언제나 통과 방향이다. */
const 범위상한 = 4;
function 렌즈덧붙이기(지시문, 범위) {
  if (!Number.isInteger(범위) || 범위 < 1 || 범위 > 범위상한) {
    throw 확인불가(`범위는 1~${범위상한} 의 정수다: ${범위}`);
  }
  if (범위 <= 2) return 지시문;
  const 마커 = '## 출력 형식';
  const i = 지시문.indexOf(마커);
  if (i === -1) throw 확인불가(`템플릿에 「${마커}」 절이 없다 — 추가 렌즈를 끼울 자리를 못 찾았다`);
  const 줄 = [];
  for (let n = 3; n <= 범위; n += 1) {
    // 상한 안인데 렌즈가 비어 있으면 그건 표가 깨진 것이다 — 빈 채로 붙이고 넘어가지 않는다.
    if (!추가렌즈[n] || !추가렌즈[n].length) throw 확인불가(`범위 ${n} 의 추가 렌즈 표가 비었다`);
    줄.push(...추가렌즈[n]);
  }
  return `${지시문.slice(0, i)}${줄.join('\n')}\n\n${지시문.slice(i)}`;
}

/* ── 심문 «대상» 목록 — 정본은 여기다 (2026-08-12) ──────────────────────────────
 * 🔴 무엇이 고장나 있었나: 이 파일 머리는 「존재 이유는 심문이 아니라 **손 조립을 없애는 것**」
 *   이라고 적어 두고도, **가장 큰 손 조립인 「무엇을 심문할지」는 밖(SKILL.md)에 남겨 뒀다.**
 *   실측(트랜스크립트 1,272개 전수): 이 도구가 7판 돌았는데 그 세션들의 `Skill` 호출 0 ·
 *   `/fable심문` 0 · **SKILL.md 를 Read 조차 0회**다. 즉 대상은 매번 손으로 정해졌다.
 *   회차마다 대상이 갈리면 합집합은 되지만 **판끼리 대조가 원리상 무효**다(F281) —
 *   렌즈를 스킬이 아니라 여기 둔 이유와 정확히 같은 이유다.
 * 🔑 그래서 스킬을 거치든 안 거치든 **같은 대상**이 나오게 한다. 목록을 지키는 것은
 *   문서의 당부가 아니라 이 함수다(CLAUDE.md 「3번째 = 잘못 쓸 수 없는 공용 통로」).
 */

/** 범위 ① 핵심 4종 — 먼저 보고 늘릴지 정하는 자리. */
const 핵심4 = [
  '../SYNK-talk/docs/L0_데이터계약.md',
  '../SYNK-talk/docs/C0_API계약.md',
  'docs/엔진도달_설계.md',
  '../SYNK-talk/docs/발주_게임모듈.md',
];

/** 범위 ②~④ 가 ① 에 더하는 설계·계약 정본. ③④ 는 **같은 문서 집합**에 렌즈만 두꺼워진다. */
const 설계전량 = [
  '../SYNK-talk/docs/P0_제품계약.md',
  '../SYNK-talk/docs/M2_라벨회로_설계.md',
  '../SYNK-talk/docs/발주_수집파이프라인.md',
  '../SYNK-talk/docs/발주_기준선마이그레이션.md',
  '../SYNK-talk/docs/발주_게임콘텐츠팩.md',
  '../SYNK-talk/docs/검수_내부계약.md',
  '../SYNK-talk/docs/말하기_설계.md',
  '../SYNK-talk/docs/개발_분업.md',
  '../SYNK-talk/docs/배포_경로.md',
  'docs/코어엔진_설계.md',
  'docs/제품방향.md',
  'docs/SYNK_철학.md',
  'docs/미니게임_게임층_설계.md',
  'docs/관찰태그_자동화_설계.md',
  'docs/출석체크인_설계_v1.md',
  'docs/마케팅_개편_설계_v1.md',
  'docs/수집층_실행지.md',
  'docs/SYNK_동기화_구조.md',
  'docs/라디오24_설계.md',
  'docs/설계전층감사.md',
  'docs/포인트경제_재설계_v1.md',
  'docs/반편성_정본_v2.md',
];

/** 실측 보강에서 빼는 것 — **이유를 여기 적는다.**
 *  회차마다 세션이 「이건 설계 정본인가」를 다시 판단하면 그 판단이 갈리고, 갈리면 대조가 무효다(F281).
 *  빼는 축은 하나뿐이다: **제품 설계·계약 정본인가.** 애매하면 넣는다(빠뜨리는 쪽이 더 비싸다). */
const 보강제외 = {
  'docs/glide_업데이트_실측설계.md': 'Glide 폐기 · 네이티브 재구축 확정 — 심문해도 고칠 대상이 없다',
  '../SYNK-talk/docs/공용지침.md': '작업 규약이지 제품 설계가 아니다',
  '../SYNK-talk/docs/이_저장소_규약.md': '작업 규약이지 제품 설계가 아니다',
};

/** 폴더 하나를 훑어 조건에 맞는 repo 상대 경로를 낸다. 못 읽으면 빈 배열(=그 자리는 못 봤다). */
function 훑기(상대폴더, 조건) {
  const dir = path.resolve(ROOT, 상대폴더);
  let 목록;
  try { 목록 = fs.readdirSync(dir); } catch (_) { return []; }
  return 목록.filter(조건).map((f) => `${상대폴더}/${f}`).sort();
}

/** 표에 없는 새 정본을 **실측으로** 보강한다 — 문서는 계속 생긴다.
 *  스킬 문서엔 「목록을 믿지 말고 Glob 으로 훑어라」고 적혀 있었는데, **지시는 안 읽히면 안 돈다.** */
function 보강(이미) {
  const 있음 = new Set(이미);
  const 후보 = [
    ...훑기('docs', (f) => /\.md$/.test(f) && /(설계|계약)/.test(f)),
    ...훑기('../SYNK-talk/docs', (f) => /\.md$/.test(f)),
    // 계약 JSON 은 문서와 **한 판으로** 묶는다 — 계약과 그 설계문이 갈린 자리가 주 사냥감이다.
    ...훑기('../SYNK-talk/계약', (f) => /\.json$/.test(f)),
  ];
  return 후보.filter((p) => !있음.has(p));
}

/** 그 범위가 실제로 볼 대상. 표 → 보강 → 실재 확인 순.
 *  ⚠ 없는 파일을 **조용히 빼지 않는다** — 목록이 낡은 것과 대상이 준 것은 다른 사건이고,
 *    조용히 빼면 「26판 돌 것을 24판 돌고 전부 돌았다」가 된다(F207). */
function 대상목록(범위) {
  if (!Number.isInteger(범위) || 범위 < 1 || 범위 > 범위상한) {
    throw 확인불가(`범위는 1~${범위상한} 의 정수다: ${범위}`);
  }
  const 표 = 범위 === 1 ? [...핵심4] : [...핵심4, ...설계전량];
  const 훑은것 = 범위 === 1 ? [] : 보강(표);       // ① 은 「핵심 4종」이 정의라 안 넓힌다
  const 더한것 = 훑은것.filter((p) => !보강제외[p]);
  const 뺀것 = 훑은것.filter((p) => 보강제외[p]).map((p) => ({ 경로: p, 사유: 보강제외[p] }));
  const 전부 = [...표, ...더한것];
  const 있는 = 전부.filter((p) => fs.existsSync(path.resolve(ROOT, p)));
  const 없는 = 표.filter((p) => !fs.existsSync(path.resolve(ROOT, p)));
  return { 범위, 표, 보강: 더한것, 제외: 뺀것, 없음: 없는, 대상: 있는 };
}

function 값(argv, 이름, 기본) {
  const i = argv.indexOf(이름);
  if (i === -1) {
    if (기본 === undefined) throw 확인불가(`${이름} 이 없다`);
    return 기본;
  }
  const v = argv[i + 1];
  if (v === undefined || /^--/.test(v)) throw 확인불가(`${이름} 에 값이 없다`);
  return v;
}

/** `--범위` 는 **기본값을 주지 않는다.**
 *  스킬 문서의 「인자가 없으면 묻는다 — 추측해서 4번을 돌리지 않는다」는 안 읽히면 안 돈다.
 *  옛 판은 조용히 2 로 떨어졌다: 세션은 ④를 시켰다고 믿고 장부엔 ②가 적히는 모양이 가능했다. */
function 범위값(argv) {
  const v = 값(argv, '--범위', null);
  if (v === null) {
    throw 확인불가('--범위 가 없다. 1~4 중 **유호님이 고른 숫자**를 준다(추측 금지 · 1 핵심4종 · 2 설계전량 · 3 +코드대조 · 4 +운영실물).');
  }
  return Number(v);
}

/** 지시문을 조립해 파일로 쓰고, 심문자에게 줄 경로·조건 지문을 돌려준다. */
function 준비(argv) {
  const 대상 = 값(argv, '--준비');
  const 범위 = 범위값(argv);
  const 회차 = Number(값(argv, '--회차', '1'));
  // 범위 판정은 `렌즈덧붙이기` 한 곳에서만 한다 — 여기 사본하면 두 판정이 갈린다(회귀가 잡은 자리).

  const 절대 = path.resolve(ROOT, 대상);
  if (!fs.existsSync(절대)) throw 확인불가(`심문 대상이 없다: ${절대}`);

  // 조립은 codex-review 의 것을 그대로 — 머리말 자르기·마커 검사·금지목록 전량이 거기 들어 있다.
  const 지시문 = 렌즈덧붙이기(cr.심문프롬프트(절대, cr.심문템플릿, undefined), 범위);
  const 지문 = cr.금지지문(undefined);
  const { 경로: 결과경로, 지문: 대상지문 } = cr.심문결과경로(절대, 픽이름, 회차);

  // repo 에 남기지 않는다 — 대상 전문이 통째로 들어가 있고, 그건 이미 git 에 있는 것의 사본이다.
  const 방 = path.join(os.tmpdir(), 'synk-fable심문');
  fs.mkdirSync(방, { recursive: true });
  const 지시문경로 = path.join(방, `${path.basename(절대, '.md')}-${대상지문}-${범위}-${회차}.txt`);
  fs.writeFileSync(지시문경로, 지시문, 'utf8');

  console.log(JSON.stringify({
    지시문경로, 결과경로, 대상: path.relative(ROOT, 절대).replace(/\\/g, '/'),
    범위, 회차, 금지지문: 지문, 대상지문, 모델,
    바이트: Buffer.byteLength(지시문, 'utf8'),
  }, null, 2));
  return 0;
}

/** 장부 1행. 확인 불가도 **행으로 남긴다** — 안 남기면 미실행이 미기록과 같은 모양이 된다. */
function 기록(argv) {
  const 행 = {
    대상: 값(argv, '--대상'),
    모델,
    범위: 범위값(argv),   // 장부에도 기본값을 안 준다 — 범위가 어긋난 장부는 대조에 못 쓴다
    회차: Number(값(argv, '--회차', '1')),
    금지지문: 값(argv, '--금지지문'),
    대상지문: 값(argv, '--대상지문', ''),
    시각: new Date().toISOString(),
    P0: Number(값(argv, '--P0', '0')),
    P1: Number(값(argv, '--P1', '0')),
    P2: Number(값(argv, '--P2', '0')),
    결과: 값(argv, '--결과', ''),
  };
  if (argv.includes('--확인불가')) {
    행.확인불가 = 값(argv, '--확인불가');
    delete 행.P0; delete 행.P1; delete 행.P2;
  }
  fs.mkdirSync(path.dirname(장부), { recursive: true });
  fs.appendFileSync(장부, `${JSON.stringify(행)}\n`, 'utf8');
  console.log(`기록: ${path.relative(ROOT, 장부).replace(/\\/g, '/')} ← ${행.대상}${행.확인불가 ? ' [확인불가]' : ''}`);
  return 0;
}

/** 장부 조회 — 몇 판이 실제로 돌았나. 초록은 분모와 함께만 읽는다. */
function 현황() {
  if (!fs.existsSync(장부)) { console.log('심문기록_fable.jsonl 없음 — Fable 심문 0판'); return 0; }
  const 행들 = fs.readFileSync(장부, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const 불가 = 행들.filter((r) => r.확인불가);
  console.log(`총 ${행들.length}판 (확인불가 ${불가.length})`);
  for (const r of 행들) {
    console.log(r.확인불가
      ? `  🔴 ${r.대상} · 범위${r.범위} · ${r.시각} — 확인불가: ${r.확인불가}`
      : `  ${r.대상} · 범위${r.범위}·회차${r.회차} · P0 ${r.P0}·P1 ${r.P1}·P2 ${r.P2} · 금지 ${r.금지지문} · ${r.시각}`);
  }
  const 지문들 = new Set(행들.filter((r) => !r.확인불가).map((r) => r.금지지문));
  if (지문들.size > 1) {
    console.log(`\n⚠ 금지 지문이 ${지문들.size}종이다 — 그 사이 결정이 바뀌었다. 판끼리 직접 대조하면 안 된다(F281).`);
  }
  return 0;
}

/** 그 범위가 볼 대상 전량. **여기서 시작한다** — 대상을 손으로 고르면 판끼리 대조가 무효다. */
function 대상목록출력(argv) {
  const r = 대상목록(범위값(argv));
  console.log(JSON.stringify(r, null, 2));
  console.error(`범위 ${r.범위} — 표 ${r.표.length} + 실측 보강 ${r.보강.length} = 심문 ${r.대상.length}판`
    + (r.제외.length ? `\n· 보강에서 뺀 것 ${r.제외.length}건(사유는 도구에 박혀 있다 — 회차마다 다시 판단하지 않는다):\n   · ${r.제외.map((x) => `${x.경로} — ${x.사유}`).join('\n   · ')}` : '')
    + (r.없음.length ? `\n🔴 표에 있는데 **없는 파일 ${r.없음.length}건** — 목록이 낡았거나 문서가 옮겨졌다(조용히 빼지 않는다):\n   · ${r.없음.join('\n   · ')}` : ''));
  return 0;
}

function main(argv) {
  if (argv.includes('--대상목록')) return 대상목록출력(argv);
  if (argv.includes('--준비')) return 준비(argv);
  if (argv.includes('--기록')) return 기록(argv);
  if (argv.includes('--현황')) return 현황();
  console.error([
    '사용 — 실행은 세션이 Agent(subagent_type: "심문자", model: "fable") 로 한다. 이 도구는 그 앞뒤만 맡는다.',
    '  ⚠ 스킬(`/fable심문`)을 거치는 것이 정상 통로다. 직접 부르더라도 **대상은 손으로 고르지 않는다** —',
    '     아래 --대상목록 이 정본이다(범위별 목록·실측 보강이 여기 들어 있다 · F281).',
    '',
    '  node tools/fable심문.js --대상목록 --범위 1-4',
    '      → 그 범위가 볼 문서 전량(표 + 실측 보강). 여기서 나온 목록으로만 --준비 를 돈다',
    '  node tools/fable심문.js --준비 <문서경로> --범위 1-4 [--회차 N]',
    '      → 지시문을 조립해 파일로 쓰고 경로·금지지문·결과경로를 JSON 으로 낸다',
    '  node tools/fable심문.js --기록 --대상 <경로> --범위 N --금지지문 <sha12> --결과 <경로> --P0 n --P1 n --P2 n',
    '      → 장부 1행. 못 돈 판은 --확인불가 "사유" 로 남긴다(통과로 세지 않는다)',
    '  node tools/fable심문.js --현황          몇 판이 실제로 돌았나 · 금지 지문이 갈렸나',
    '',
    '  🚫 배포 검수(코드 diff)에는 쓰지 않는다 — 그건 node tools/codex-review.js 다.',
  ].join('\n'));
  return 2;
}

module.exports = { 렌즈덧붙이기, 추가렌즈, 장부, 픽이름, 모델, 대상목록, 핵심4, 설계전량, 범위값 };

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    const 앞 = e && e.확인불가 ? '🔴 확인 불가 — 심문이 **안 돌았다**(통과가 아니다): ' : '🔴 ';
    console.error(앞 + String((e && e.message) || e));
    process.exit(2);
  }
}
