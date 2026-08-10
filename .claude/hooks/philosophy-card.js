#!/usr/bin/env node
/**
 * philosophy-card — 세션 시작에 **판단 정본의 게이트 문장만** 띄운다.
 *
 * 왜 있나 (2026-08-10 · 유호님 질문 「지금 이 철학도 니가 읽고 있나?」에서 실측):
 *   메모리 autonomous-build-mode 에 「판단 정본 = docs/SYNK_철학.md 정독(상시 08-09)」이 적혀 있는데
 *   **그걸 발화시키는 장치가 하나도 없었다.** SessionStart 훅 6개(rot-check·session-handoff·인계문수거·
 *   작업본소유자·session-decisions·대기열) 어디에도 철학이 없어서, 세션은 그 파일을 **열 이유가 생길 때만**
 *   열었다. 자율주행은 유호님이 안 보는 사이 판정을 쌓는 트랙이라, 기준이 안 실린 채 도는 것이 가장 비싸다.
 *   CLAUDE.md — 「프로즈보다 기계 강제로 옮긴다 · 스스로 발화하지 않는 장치는 안 돈다」.
 *
 * 설계:
 *   ① **전문을 싣지 않는다** — 철학 정본은 13,459자(29KB)로 매 턴 상주하는 CLAUDE.md(21KB)보다 크다.
 *      컨텍스트 비용은 남은 턴 수만큼 곱해지므로(CLAUDE.md 실행 §), 실제로 **판정을 가르는 두 자리**만
 *      싣고 나머지는 주소로 넘긴다: Ⅰ 한 문장(궁극 가치) + Ⅰ-3(「똑똑하게」 3층 = 전 산출물이 지나는 게이트).
 *   ② **판정을 두 곳에 적지 않는다** — 카드 문구를 여기 베끼지 않고 정본에서 **뽑아 온다**.
 *      베끼면 정본이 개정될 때 카드만 낡아, 세션은 낡은 기준으로 판정하면서 초록을 본다.
 *      (v1.1→v1.3 처럼 하루에 세 번 개정되는 문서다 — 사본은 반드시 갈라진다.)
 *   ③ **못 뽑으면 조용히 넘어가지 않는다** — 앵커가 깨졌는데 빈 출력을 내면 「기준 없음」이 「통과」처럼 보인다.
 *      미실행과 통과는 같은 모양이면 안 된다(F207). 무엇이 왜 안 됐는지 말하고 비정상 종료한다.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');
const 정본 = path.join(ROOT, 'docs', 'SYNK_철학.md');

/** 터미널 한 줄로 읽히게 — 굵게·표식 문법만 걷는다(뜻은 안 건드린다) */
function 평문(s) {
  return s.replace(/\*\*/g, '').replace(/`/g, '').trim();
}

/**
 * 정본에서 한 자리를 뽑는다.
 * @param {string} md   정본 전문
 * @param {RegExp} 앵커  그 자리를 여는 줄
 * @param {boolean} 다음줄  true = 앵커 다음 줄이 본문(소제목-본문 두 줄 구조)
 */
function 뽑기(md, 앵커, 다음줄) {
  const lines = md.split(/\r?\n/);
  const i = lines.findIndex((l) => 앵커.test(l));
  if (i < 0) return null;
  const body = 다음줄 ? lines[i + 1] : lines[i];
  return body && body.trim() ? 평문(body) : null;
}

function main() {
  if (!fs.existsSync(정본)) {
    console.error(`[철학카드] 판단 정본이 없다: ${정본} — 이 세션은 기준 없이 도는 중이다(워크트리면 정상).`);
    process.exit(1);
  }
  const md = fs.readFileSync(정본, 'utf8');
  const ver = (md.match(/<!--\s*정본:\s*(v[\d.]+)\s*-->/) || [, '(판 미상)'])[1];

  // 앵커 = 정본의 구조 그 자체. 절 번호가 바뀌면 여기서 빨개져야 한다(조용한 낡음 금지).
  const 가치 = 뽑기(md, /^\*\*한 문장:/, false);
  const 게이트 = 뽑기(md, /^\*\*3\. 「똑똑하게」/, true);

  if (!가치 || !게이트) {
    console.error('[철학카드] 정본에서 게이트 문장을 못 찾았다 — 절 구조가 바뀌었다.'
      + `\n  · Ⅰ 한 문장: ${가치 ? 'OK' : '못 찾음(앵커 **한 문장:)'}`
      + `\n  · Ⅰ-3 「똑똑하게」: ${게이트 ? 'OK' : '못 찾음(앵커 **3. 「똑똑하게」)'}`
      + '\n  → 이 세션은 판단 기준이 안 실린 채 돈다. 정본을 직접 열거나 앵커를 고쳐라: docs/SYNK_철학.md');
    process.exit(1);
  }

  console.log(`📐 판단 정본 — docs/SYNK_철학.md ${ver} · **모든 기능·콘텐츠·마케팅 판정이 이 두 자리를 지난다**`);
  console.log(`\n【궁극 가치】 ${가치}`);
  console.log(`\n【「똑똑하게」 3층 = 산출물 게이트】 ${게이트}`);
  console.log('\n▶ 여기 실린 것은 게이트 둘뿐이다 — Ⅱ 교육·Ⅲ 대외 철학과 부록 A(실물 대장)는 안 실렸다.'
    + ' 굵직한 기획·외부 공개물·새 기능은 정본을 직접 열고 판정한다(전문 13,459자는 매 턴 상주시키지 않는다).');
}

if (require.main === module) main();
module.exports = { 뽑기, 평문 };
