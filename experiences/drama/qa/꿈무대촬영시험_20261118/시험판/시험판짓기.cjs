#!/usr/bin/env node
/* 꿈 무대 촬영 시험판(2026-11-18) — 원고.htm에 브랜드 서체를 심어 git 밖 .tmp/꿈무대촬영시험_20261118/시험판/index.html로 쓰고,
   영상/ 폴더에 클립을 모은다. 새로 구운 컷(.tmp/꿈무대촬영시험_20261118/영상/N*.mp4)이 없으면 11-17 옥상 컷을 자리 표시로 쓴다.
   쓰기: node experiences/drama/qa/꿈무대촬영시험_20261118/시험판/시험판짓기.cjs
   보기: node tools/지면서버.js 4911 .tmp/꿈무대촬영시험_20261118/시험판 (launch.json 「꿈무대촬영시험판」) */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const 폰트 = require(path.join(ROOT, 'tools', 'lib', '브랜드폰트.js'));
const 새컷 = path.join(ROOT, '.tmp', '꿈무대촬영시험_20261118', '영상');
const 옛컷 = path.join(ROOT, '.tmp', '꿈무대영상-20261117');
const 밖 = path.join(ROOT, '.tmp', '꿈무대촬영시험_20261118', '시험판');
const 다시씀 = { V1d: path.join(옛컷, '드레드', '영상', 'V1d-남.mp4'), V3: path.join(옛컷, '옥상영상', 'V3-남.mp4') };
const 자리표시 = { 친구: 다시씀.V1d, 듣는: 다시씀.V3, 감독: path.join(옛컷, '드레드', '영상', 'V4g-남.mp4') };
const 새컷이름 = { N1: '친구', N2: '친구', N3: '친구', N4: '친구', N5: '친구', N6: '친구', N7: '친구', N8: '친구', N9: '듣는', N10: '듣는', N11: '감독', N12: '감독' };

fs.mkdirSync(path.join(밖, '영상'), { recursive: true });
const 쓴것 = [];
for (const [이름, 원본] of Object.entries(다시씀)) { fs.copyFileSync(원본, path.join(밖, '영상', `${이름}.mp4`)); 쓴것.push(`${이름} 다시씀`); }
// 11-19: 다시 구운 판을 고르면 받음 폴더의 _고름.json({"N2": "N2__2.mp4"})에 적는다. 없으면 <컷>.mp4다
const 고름경로 = path.join(새컷, '_고름.json');
const 고름 = fs.existsSync(고름경로) ? JSON.parse(fs.readFileSync(고름경로, 'utf8')) : {};
for (const [이름, 갈래] of Object.entries(새컷이름)) {
  const 새 = path.join(새컷, 고름[이름] || `${이름}.mp4`);
  const 있음 = fs.existsSync(새);
  fs.copyFileSync(있음 ? 새 : 자리표시[갈래], path.join(밖, '영상', `${이름}.mp4`));
  쓴것.push(`${이름} ${있음 ? path.basename(새) : '자리 표시'}`);
}
// 11-19: 첫 화면 영상 칸의 바탕 그림(N1 시작 그림). 없으면 검은 칸이다
const 첫장면 = path.join(ROOT, '.tmp', '꿈무대촬영시험_20261118', '정지', 'N1.png');
if (fs.existsSync(첫장면)) { fs.copyFileSync(첫장면, path.join(밖, '영상', '첫장면.png')); 쓴것.push('첫장면 N1.png'); }
const 원고 = fs.readFileSync(path.join(__dirname, '원고.htm'), 'utf8');
const { html } = 폰트.심기(원고);
fs.writeFileSync(path.join(밖, 'index.html'), html);
console.log(`시험판 → ${path.relative(ROOT, 밖)}/index.html\n${쓴것.join(' · ')}`);
