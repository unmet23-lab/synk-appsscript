#!/usr/bin/env node
// WORLD 창 시안을 자립형 HTML 한 장으로 굽는다: 보관함의 그림 셋을 심고, 브랜드 글꼴을 심는다.
//   node docs/디자인/WORLD창_20261121/빌드.cjs <나갈 파일.html>
// 그림 원본은 공개 저장소에 넣지 않고 보관함(연구/WORLD창_20261121)에 둔다.
'use strict';
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const out = process.argv[2];
if (!out) { console.error('사용: node docs/디자인/WORLD창_20261121/빌드.cjs <나갈 파일.html>'); process.exit(2); }
const vault = 'C:/Users/q1212/Documents/SYNK-보관함/연구/WORLD창_20261121';
const img = name => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(vault, name)).toString('base64');
let html = fs.readFileSync(path.join(__dirname, '시안_원고.html'), 'utf8');
html = html.split('__IMG_ROOM__').join(img('room.jpg')).split('__IMG_STUDENT__').join(img('student.jpg')).split('__IMG_TEACHER__').join(img('teacher.jpg'));
fs.writeFileSync(out, html);
execFileSync(process.execPath, [path.join(__dirname, '../../../tools/lib/브랜드폰트.js'), '--심기', out], { stdio: 'inherit' });
