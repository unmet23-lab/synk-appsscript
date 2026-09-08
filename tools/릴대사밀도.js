#!/usr/bin/env node
'use strict';
/* 리드크루 클립 대사 밀도 자 — 18초 안에 학생이 «따라 말할 틈»이 남는지 센다.
 *
 * 왜 있나 (2026-09-08): 이종 심문(아스트라)이 옛 대본을 「한국어만 초당 8음절 이상이라
 *   느린 시범과 학생 발화를 넣기 «전»부터 시간이 없다」고 잡았다. 그 뒤 아홉 벌을 전면
 *   개정했는데, 개정판을 세어 보니 45화 중 셋이 여전히 8을 넘었고 그중 하나(09편 5화)는
 *   **개정 전보다 굵었다**(9.00). 사람 눈으로는 안 보이는 결함이라 자가 필요하다.
 *
 * 🔴 이 자가 처음에 두 번 «거짓 0»을 냈다. 그 둘을 여기 박아 둔다.
 *   ① 편 제목 꼴이 셋이다 — `## N편` · `## 클립 N` · `## N.`. 하나만 보면 네 벌이 조용히
 *      0 이 되고, 그 0 은 「굵은 화 없음」과 똑같은 얼굴을 한다. 그래서 편을 하나도 못 찾은
 *      파일은 «못 쟀다»로 따로 낸다(0 이 아니다).
 *   ② 클로징을 교육 대사와 같이 세면 자가 거짓 빨강을 낸다. 따라 말할 틈을 막는 것은
 *      가르치는 대사이지 마지막에 한 번 읽고 끝나는 클로징이 아니다. 그래서 갈라 센다.
 *
 * ⚠ 안 잰 것: 실제 낭독 시간·쉼·몽골어 음성 길이. 이 자는 «한국어 음절 수»라는 대리 값이다.
 *   낭독 속도 6음절/초도 실측이 아니라 지금 45화의 가운뎃값에서 잡은 가정이다.
 *
 * node tools/릴대사밀도.js [--뿌리 <폴더>] [--상한 7.5]
 * 종료: 0 = 전부 상한 아래, 1 = 상한을 넘는 화가 있다, 2 = 확인 불가(편을 못 찾은 파일)
 */

const fs = require('node:fs');
const path = require('node:path');

const 저장소 = path.resolve(__dirname, '..');
const 기본뿌리 = '.claude/skills/synk-content/references/리드크루클립';
const 기본상한 = 7.5;
const 초당낭독 = 6;
const 클립초 = 18;

const 한글음절 = (s) => (s.match(/[가-힣]/g) || []).length;

/** 편 제목 꼴 셋을 한 자로 댄다 — `## 3편` · `## 클립 3` · `## 3. ㅇㅈ`. */
function 편번호(줄) {
  const m = String(줄).match(/^##\s+(?:클립\s*)?(\d+)\s*(?:편|\.|—|-)/);
  return m ? m[1] : null;
}

/** 대본 한 벌을 읽어 편마다 {번호, 교육, 클로징, 밀도} 를 낸다. */
function 대본재기(글) {
  const 편들 = [];
  let 지금 = null;
  for (const 줄 of String(글).split(/\r\n|[\n\r\u2028\u2029]/)) {
    const 번호 = 편번호(줄);
    if (번호) { 지금 = { 번호, 교육: 0, 클로징: 0 }; 편들.push(지금); continue; }
    if (!지금 || !/^-\s+/.test(줄)) continue;
    const 칸 = /\(클로징\)/.test(줄) ? '클로징' : '교육';
    for (const 조각 of 줄.match(/"[^"]*"/g) || []) 지금[칸] += 한글음절(조각);
  }
  for (const 편 of 편들) {
    편.남는초 = 클립초 - 편.클로징 / 초당낭독;
    편.밀도 = 편.남는초 > 0 ? 편.교육 / 편.남는초 : Infinity;
  }
  return 편들;
}

function 검사({ 뿌리 = path.join(저장소, 기본뿌리), 상한 = 기본상한 } = {}) {
  let 파일들;
  try { 파일들 = fs.readdirSync(뿌리).filter((f) => /^\d\d_.*\.md$/.test(f)).sort(); }
  catch (_) { return { 종료코드: 2, 출력: [`확인 불가: 대본 폴더를 읽을 수 없다 — ${뿌리}`], 셈: null }; }
  if (!파일들.length) return { 종료코드: 2, 출력: [`확인 불가: 대본 파일이 0벌이다 — ${뿌리}`], 셈: null };

  const 출력 = [];
  const 굵은것 = [];
  const 못잰것 = [];
  let 화수 = 0;
  for (const 이름 of 파일들) {
    let 편들;
    try { 편들 = 대본재기(fs.readFileSync(path.join(뿌리, 이름), 'utf8')); }
    catch (_) { 못잰것.push(`${이름} — 파일을 못 읽었다`); continue; }
    if (!편들.length) { 못잰것.push(`${이름} — 편을 하나도 못 찾았다(제목 꼴이 바뀌었을 수 있다)`); continue; }
    화수 += 편들.length;
    출력.push(`${이름.slice(0, 2)}  ` + 편들.map((p) => {
      if (p.밀도 >= 상한) 굵은것.push(`${이름.slice(0, 2)}편 ${p.번호}화 — 교육 ${p.교육}음절 ÷ ${p.남는초.toFixed(1)}초 = ${p.밀도.toFixed(2)}`);
      return `${p.번호}화 ${String(p.교육).padStart(3)}+${String(p.클로징).padStart(2)}=${p.밀도.toFixed(2)}${p.밀도 >= 상한 ? '🔴' : ''}`;
    }).join(' · '));
  }

  /* 🔴 «못 쟀다»가 있으면 굵은 화가 0이어도 통과가 아니다 — 0 과 미측정을 가른다. */
  if (못잰것.length) {
    출력.push(`⚠ 못 잰 파일 ${못잰것.length}벌 — 「굵은 화 0」이 아니라 「안 재봤다」이다:`);
    for (const 줄 of 못잰것) 출력.push(`  · ${줄}`);
    출력.push(`대본 ${파일들.length}벌 · 잰 화 ${화수} · 못 잰 파일 ${못잰것.length} · 상한 ${상한}`);
    return { 종료코드: 2, 출력, 셈: null };
  }
  for (const 줄 of 굵은것) 출력.push(`🔴 ${줄}`);
  출력.push(`대본 ${파일들.length}벌 · 잰 화 ${화수} · 상한 ${상한} 넘는 화 ${굵은것.length}`);
  return { 종료코드: 굵은것.length ? 1 : 0, 출력, 셈: { 대본수: 파일들.length, 화수, 굵은화수: 굵은것.length } };
}

module.exports = { 검사, 대본재기, 편번호 };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const 값 = (이름) => { const i = argv.indexOf(이름); return i >= 0 ? argv[i + 1] : undefined; };
  const 뿌리인자 = 값('--뿌리');
  const 상한인자 = 값('--상한');
  const 결과 = 검사({
    뿌리: 뿌리인자 ? path.resolve(저장소, 뿌리인자) : undefined,
    상한: 상한인자 === undefined ? undefined : Number(상한인자),
  });
  for (const 줄 of 결과.출력) console.log(줄);
  process.exitCode = 결과.종료코드;
}
