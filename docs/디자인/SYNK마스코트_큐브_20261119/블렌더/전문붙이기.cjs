// 요청문 끝에 앞 회차의 스크립트 전문을 붙인 글을 작업 폴더에 만든다(읽기 전용 실행에서는 모델이 파일을 못 읽는다).
//   node docs/디자인/SYNK마스코트_큐브_20261119/블렌더/전문붙이기.cjs <요청문.md> <붙일 스크립트.py> <나갈 글.md>
const fs = require('node:fs');
const [요청, 스크립트, 나갈] = process.argv.slice(2);
const 울타리 = String.fromCharCode(96).repeat(3);
const 글 = fs.readFileSync(요청, 'utf8').trimEnd() + '\n\n## 앞 회차 스크립트 전문\n\n' + 울타리 + 'python\n' + fs.readFileSync(스크립트, 'utf8').trimEnd() + '\n' + 울타리 + '\n';
fs.writeFileSync(나갈, 글);
console.log('붙였다 ' + 글.length + '자');
