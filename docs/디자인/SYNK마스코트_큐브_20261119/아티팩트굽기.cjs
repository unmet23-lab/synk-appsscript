// 큐브.html을 아티팩트에 올릴 한 파일로 굽는다. 문서 뼈대를 벗기고 SUIT 글꼴과 assets의 webp를 파일 안에 심는다. 저장소 뿌리에서 돌린다.
//   node docs/디자인/SYNK마스코트_큐브_20261119/아티팩트굽기.cjs <나갈 파일> [같은 내용을 쓸 둘째 파일]
const fs = require('fs');
const path = require('path');
const 폰트 = require(path.resolve('tools/lib/브랜드폰트.js'));
const 편 = __dirname;
const 원고 = fs.readFileSync(path.join(편, '큐브.html'), 'utf8');
const 머리 = 원고.match(/<head>([^]*?)<[/]head>/i)[1].replace(/<meta charset[^>]*>[ \t\r\n]*/i, '').replace(/<meta name="viewport"[^>]*>[ \t\r\n]*/i, '');
let 몸 = 원고.match(/<body>([^]*?)<[/]body>/i)[1];
const 면찾기 = /@font-face[{]font-family:'SUIT Variable'[^}]*[}]/;
if (!면찾기.test(머리)) throw new Error('SUIT 줄 없음');
let 심은 = 0;
몸 = 몸.replace(/src="assets[/]([a-z-]+[.]webp)"/g, (_, name) => { 심은++; return 'src="data:image/webp;base64,' + fs.readFileSync(path.join(편, 'assets', name)).toString('base64') + '"'; });
if (/src="assets[/]/.test(몸)) throw new Error('심지 못한 그림이 남았다');
const 판 = (머리.replace(면찾기, () => 폰트.면()) + 몸).trim() + '\n';
for (const 나갈 of process.argv.slice(2)) fs.writeFileSync(나갈, 판);
console.log('구웠다 ' + Math.round(Buffer.byteLength(판) / 1024) + 'KB, 그림 ' + 심은 + '장');
