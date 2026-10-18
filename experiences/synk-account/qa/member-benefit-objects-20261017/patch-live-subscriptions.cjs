// 0.4.24 공개본(GPT 판, synk-policy cb7005c) 위에 71a499eb6의 두 변경만 얹는다: 구독 카드 단추 글, PC 앱 안 혜택 소개의 PC 앱 받기 링크.
// 각 원문이 공개본에 정확히 한 번 있는지 보고 바꾼다. 사용: node patch-live-subscriptions.cjs <공개본 platform.js> <출력 platform.js> — 그 뒤 platform.html의 ?v=를 출력 sha256 앞 12자로(현장 노트 배포·공개). 10-18 synk-policy e9cf357.
const fs = require('fs');
const [livePath, outPath] = process.argv.slice(2);
let s = fs.readFileSync(livePath, 'utf8'); const live = s;
const swaps = [
  ['${item.embedded?"내 기록 살펴보기":', '${item.id==="insight"?"내 기록 살펴보기":'],
  [`!publicEntry2?'<a class="benefit-link" href="./client.html?product=platform">SYNK ID 알아보기 ↗</a>':""`,
   `!publicEntry2?item.embedded?'<a class="benefit-link" href="#downloads">PC 앱 받기 →</a>':'<a class="benefit-link" href="./client.html?product=platform">SYNK ID 알아보기 ↗</a>':""`],
];
for (const [a, b] of swaps) { const n = s.split(a).length - 1; if (n !== 1) throw Error(`expected one occurrence, found ${n}: ${a.slice(0, 50)}`); s = s.replace(a, b); }
new Function(s); // 문법 확인
fs.writeFileSync(outPath, s);
console.log('patched', Buffer.byteLength(live), '->', Buffer.byteLength(s));
