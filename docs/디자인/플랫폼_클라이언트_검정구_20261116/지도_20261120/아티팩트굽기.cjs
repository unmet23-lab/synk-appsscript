// 이 폴더의 시안을 아티팩트에 올릴 한 파일로 굽는다. 문서 뼈대를 벗기고 SUIT 글꼴과 이 폴더의 webp를 파일 안에 심는다.
//   node docs/디자인/플랫폼_클라이언트_검정구_20261116/지도_20261120/아티팩트굽기.cjs [--원고 지도.html] <나갈 파일>      (저장소 뿌리에서)
// 원고를 주지 않으면 변신.html을 굽는다.
const fs = require('fs');
const path = require('path');
const 폰트 = require(path.resolve('tools/lib/브랜드폰트.js'));
const 곳 = __dirname;
const 인자 = process.argv.slice(2);
const 자리 = 인자.indexOf('--원고');
const 원고이름 = 자리 >= 0 ? 인자.splice(자리, 2)[1] : '변신.html';
const 그림수 = { '변신.html': 0, '지도.html': 2 }[원고이름];
if (그림수 === undefined || !인자.length) throw new Error('원고는 변신.html이나 지도.html이고, 나갈 파일을 하나 넘게 준다');
const 원고 = fs.readFileSync(path.join(곳, 원고이름), 'utf8');
const 머리 = 원고.match(/<head>([^]*?)<[/]head>/i)[1].replace(/<meta charset[^>]*>[ \t\r\n]*/i, '').replace(/<meta name="viewport"[^>]*>[ \t\r\n]*/i, '');
let 몸 = 원고.match(/<body>([^]*?)<[/]body>/i)[1];
const 면찾기 = /@font-face[{]font-family:'SUIT Variable'[^}]*[}]/;
if (!면찾기.test(머리)) throw new Error('SUIT 줄 없음');
let 심은 = 0;
몸 = 몸.replace(/src="([a-z-]+[.]webp)"/g, (_, name) => { 심은++; return 'src="data:image/webp;base64,' + fs.readFileSync(path.join(곳, name)).toString('base64') + '"'; });
if (심은 !== 그림수) throw new Error('그림을 ' + 심은 + '장 심었다(' + 그림수 + '장이어야 한다)');
const 판 = (머리.replace(면찾기, () => 폰트.면()) + 몸).trim() + '\n';
for (const 나갈 of 인자) fs.writeFileSync(나갈, 판);
console.log('구웠다 ' + 원고이름 + ' ' + Math.round(Buffer.byteLength(판) / 1024) + 'KB, 그림 ' + 심은 + '장');
