/* 「자리만 보는 시험」이 얼마나 되나 — 09-08 에 세 번 밟은 무늬를 저장소 전체로 센다.
 *
 * 무엇을 세나: 단언(assert)이 **소스 문자열**을 과녁으로 삼는 줄.
 *   예) assert.match(소스, /…/) · assert.ok(/…/.test(src)) · assert.ok(code.includes('…'))
 *   그런 단언은 「그 글자가 있나」를 재지 «그것이 도나»를 안 잰다.
 *
 * 🚫 이 수는 «결함 수»가 아니다. 소스 글자를 재는 것이 옳은 자리도 많다
 *   (버전 문자열·표식 존재·「이 줄을 다시 적지 마라」 같은 규약). 그래서 판정이 아니라
 *   **어디를 먼저 볼지 고르는 재료**로 낸다.
 */
const fs = require('node:fs');
const path = require('node:path');

const 방 = 'C:/Users/q1212/Documents/SYNK-appsscript/tests';
/* 소스를 담는 흔한 이름들 — 이 저장소가 실제로 쓰는 것만 */
const 소스이름 = '(소스|src|code|SRC|CODE|본문|talkSrc|상담Src|engineSource\\(\\)|합본)';
const 자 = new RegExp('assert\\.(match|ok|strictEqual|notStrictEqual)\\([^\\n]*\\b' + 소스이름 + '\\b[^\\n]*', 'g');

const 표 = [];
let 단언합 = 0, 글자합 = 0;
for (const f of fs.readdirSync(방).filter((x) => x.endsWith('.test.js'))) {
  const s = fs.readFileSync(path.join(방, f), 'utf8');
  const 단언 = (s.match(/assert\.[a-zA-Z]+\(/g) || []).length;
  const 글자 = (s.match(자) || []).length;
  단언합 += 단언; 글자합 += 글자;
  if (글자) 표.push({ f, 단언, 글자, 비율: 단언 ? Math.round(글자 / 단언 * 100) : 0 });
}
표.sort((a, b) => b.글자 - a.글자);

console.log('■ 시험 파일 ' + fs.readdirSync(방).filter((x) => x.endsWith('.test.js')).length + '개');
console.log('  단언 ' + 단언합 + '개 중 «소스 글자»를 과녁으로 삼은 것 ' + 글자합 + '개 ('
  + Math.round(글자합 / 단언합 * 100) + '%)');
console.log('');
console.log('■ 글자 단언이 많은 파일 (글자/전체 · 비율)');
표.slice(0, 15).forEach((r) => console.log('  ' + String(r.글자).padStart(3) + '/' + String(r.단언).padEnd(4)
  + ' ' + String(r.비율).padStart(3) + '%  ' + r.f));
console.log('');
console.log('■ 글자 단언이 «전부»인 파일 (비율 100% — 도는 것을 하나도 안 잰다)');
const 전부 = 표.filter((r) => r.비율 === 100);
if (!전부.length) console.log('  없음');
else 전부.forEach((r) => console.log('  ' + r.글자 + '개  ' + r.f));
