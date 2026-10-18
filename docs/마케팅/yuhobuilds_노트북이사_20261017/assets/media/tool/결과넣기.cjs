// 맞춤 도구가 실제로 낸 세 사람 결과(tool-results.json, 캡처 때 함께 적힘)를 9장면 카드용 tool-results.js로 옮긴다.
// 글은 고치지 않는다 — 제목은 도구의 결과 제목 그대로, 아래 줄은 ① 「절대 두고 가면 안 되는 것」의 첫 줄 그대로.
// 실행(이 폴더에서): node 결과넣기.cjs
const fs = require('fs');
const path = require('path');

const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'tool-results.json'), 'utf8'));
// 카드 위 칩은 252px 폭이라 짧은 이름표를 쓴다(누가 어떤 답을 했는지는 tool-results.json의 note에 그대로 있다)
const SHORT = { 가: 'AI·코딩', 나: '영상·사진', 다: '문서·웹' };
const people = j.people.map((p) => ({ who: SHORT[p.name] || p.who, title: p.title, first: '① ' + p.first['①'] }));
if (people.length !== 3) throw new Error('세 사람이 아니다: ' + people.length);
fs.writeFileSync(path.join(__dirname, 'tool-results.js'),
  `// 결과넣기.cjs가 tool-results.json(${j.recordedAt}, ${j.source})에서 만든다. 손으로 고치지 않는다.\nwindow.TOOL_RESULTS = ${JSON.stringify({ people }, null, 1)};\n`);
console.log(people.map((p) => `${p.who} | ${p.title} | ${p.first}`).join('\n'));
