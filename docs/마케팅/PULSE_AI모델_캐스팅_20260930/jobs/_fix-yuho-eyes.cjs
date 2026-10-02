// 유호 대표 사진을 사용자가 고른 후보 5로 정한다(2026-10-01). 눈은 후보 5 그대로 유지한다.
const fs = require('node:fs'), path = require('node:path');
const file = path.join(__dirname, '..', 'roster-v2.json');
const r = JSON.parse(fs.readFileSync(file, 'utf8'));
const m = r.models.find((x) => x.key === 'Myuho');
m.hero = 'raw/M-yuho-hero-5.png';
m.heroEngine = 'Google Nano Banana Pro (Vertex) · 본인 인터뷰 영상 6장면 참조 · 사용자 선택 후보 5';
m.keepTraits = 'Keep his eyelids and eye shape exactly as in the first reference photo. He looks youthful, mid-twenties, with smooth skin and minimal lines.';
m.eyes = '흑갈색';
fs.writeFileSync(file, JSON.stringify(r, null, 2) + '\n');
console.log('updated', m.hero);
