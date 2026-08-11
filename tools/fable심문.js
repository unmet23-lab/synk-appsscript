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

function 값(argv, 이름, 기본) {
  const i = argv.indexOf(이름);
  if (i === -1) return 기본;
  const v = argv[i + 1];
  if (v === undefined || /^--/.test(v)) throw 확인불가(`${이름} 에 값이 없다`);
  return v;
}

/** 지시문을 조립해 파일로 쓰고, 심문자에게 줄 경로·조건 지문을 돌려준다. */
function 준비(argv) {
  const 대상 = 값(argv, '--준비');
  const 범위 = Number(값(argv, '--범위', '2'));
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
    범위: Number(값(argv, '--범위', '2')),
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

function main(argv) {
  if (argv.includes('--준비')) return 준비(argv);
  if (argv.includes('--기록')) return 기록(argv);
  if (argv.includes('--현황')) return 현황();
  console.error([
    '사용 — 실행은 세션이 Agent(subagent_type: "심문자", model: "fable") 로 한다. 이 도구는 그 앞뒤만 맡는다.',
    '  node tools/fable심문.js --준비 <문서경로> [--범위 1-4] [--회차 N]',
    '      → 지시문을 조립해 파일로 쓰고 경로·금지지문·결과경로를 JSON 으로 낸다',
    '  node tools/fable심문.js --기록 --대상 <경로> --범위 N --금지지문 <sha12> --결과 <경로> --P0 n --P1 n --P2 n',
    '      → 장부 1행. 못 돈 판은 --확인불가 "사유" 로 남긴다(통과로 세지 않는다)',
    '  node tools/fable심문.js --현황          몇 판이 실제로 돌았나 · 금지 지문이 갈렸나',
    '',
    '  🚫 배포 검수(코드 diff)에는 쓰지 않는다 — 그건 node tools/codex-review.js 다.',
  ].join('\n'));
  return 2;
}

module.exports = { 렌즈덧붙이기, 추가렌즈, 장부, 픽이름, 모델 };

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    const 앞 = e && e.확인불가 ? '🔴 확인 불가 — 심문이 **안 돌았다**(통과가 아니다): ' : '🔴 ';
    console.error(앞 + String((e && e.message) || e));
    process.exit(2);
  }
}
