'use strict';
// GG3(후보만): 은행이 다 온 뒤 repaint가 닫히는 중인 판(판 종류가 빈 값)을 다시 열지 않게 — master에는 10-31(b239280fc2)부터 같은 막이가 있다.
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'world-learning-ui.mjs');
let s = fs.readFileSync(file, 'utf8');
const find = "   if(openPosition.pending||heldMock())return;";
const n = s.split(find).length - 1;
if (n !== 1) throw Error(`${n}번`);
s = s.replace(find, () => "   if(home.openPanel?.()===''||openPosition.pending||heldMock())return;");
fs.writeFileSync(file, s);
console.log('GG3 고침(후보)');
