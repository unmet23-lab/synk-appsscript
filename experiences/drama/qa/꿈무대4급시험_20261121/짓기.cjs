#!/usr/bin/env node
/* 꿈 무대 4급 시험판 짓기(2026-11-21). 여학생용 옥상 촬영 시험판의 영상 · 그림을 그대로 모으고, 원고.htm에 브랜드 서체를 심어
   git 밖 공용 작업본 .tmp/꿈무대4급시험_20261121/시험판/에 쓴다. 새로 굽는 영상 · 그림은 없다.
   쓰기: node experiences/drama/qa/꿈무대4급시험_20261121/짓기.cjs
   보기: node experiences/drama/qa/꿈무대4급시험_20261121/서버.mjs 4913  (launch.json 「꿈무대4급시험판」) */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const 자리 = require('./자리.cjs');
const 폰트 = require(path.join(자리.저장소, 'tools', 'lib', '브랜드폰트.js'));

async function main() {
  const 대본 = await import(pathToFileURL(path.join(__dirname, '대본.mjs')).href);
  const 영상원천 = path.join(자리.원천, '영상'), 정지원천 = path.join(자리.원천, '정지');
  if (!fs.existsSync(영상원천)) throw new Error(`여학생용 시험판 영상이 없다: ${영상원천}`);
  const 고름경로 = path.join(영상원천, '_고름.json');
  const 고름 = fs.existsSync(고름경로) ? JSON.parse(fs.readFileSync(고름경로, 'utf8')) : {};
  const 밖 = 자리.밖;
  fs.mkdirSync(path.join(밖, '영상'), { recursive: true });
  fs.mkdirSync(path.join(밖, '그림'), { recursive: true });
  const 쓴것 = [];

  // 영상: 차례에 나오는 컷 모두(친구 · 감독 · 듣는 컷). 다시 구운 판은 _고름.json을 따른다.
  const 컷들 = [...new Set(대본.차례.map((x) => x.클립))];
  for (const 컷 of 컷들) {
    const 원 = path.join(영상원천, 고름[컷] || `${컷}.mp4`);
    if (!fs.existsSync(원)) throw new Error(`컷이 없다: ${원}`);
    fs.copyFileSync(원, path.join(밖, '영상', `${컷}.mp4`));
    쓴것.push(`${컷}${고름[컷] ? `(${고름[컷]})` : ''}`);
  }
  // 그림: 첫 화면(N1), 코치가 듣는 동안(N12), 줄마다 앞 친구 컷. 고른 시작 그림이 있으면 그것을, 없으면(W1) 고른 영상의 1초 장면을 쓴다.
  const 그림들 = new Set(['N1', 'N12', ...대본.나줄.map((x) => 대본.앞친구(x.id)?.클립).filter(Boolean)]);
  for (const 컷 of 그림들) {
    const 정지 = path.join(정지원천, `${컷}.png`);
    const 밖그림 = path.join(밖, '그림', `${컷}.jpg`);
    const 입력 = fs.existsSync(정지) ? ['-i', 정지] : ['-ss', '1', '-i', path.join(밖, '영상', `${컷}.mp4`), '-frames:v', '1'];
    execFileSync('ffmpeg', ['-y', '-v', 'error', ...입력, '-vf', 'scale=1280:-2', '-q:v', '3', 밖그림]);
    쓴것.push(`그림 ${컷}${fs.existsSync(정지) ? '' : '(영상 1초)'}`);
  }
  // 모듈: 대본 · 판정 · 1화 시범판의 다시 만나기 규칙(takes.mjs). 판정의 가져오기 주소를 시험판 폴더 안으로 바꾼다.
  fs.copyFileSync(path.join(__dirname, '대본.mjs'), path.join(밖, '대본.mjs'));
  const 판정원 = fs.readFileSync(path.join(__dirname, '판정.mjs'), 'utf8');
  const 판정밖 = 판정원.replace("from '../../pilot/takes.mjs'", "from './takes.mjs'");
  if (판정밖 === 판정원) throw new Error('판정.mjs의 takes.mjs 가져오기 주소를 못 바꿨다');
  fs.writeFileSync(path.join(밖, '판정.mjs'), 판정밖);
  fs.copyFileSync(path.join(자리.저장소, 'experiences', 'drama', 'pilot', 'takes.mjs'), path.join(밖, 'takes.mjs'));
  // 다른 자리의 읽기 문항: 은행(AI 2중 검수 통과)의 글 그대로.
  const 은행 = JSON.parse(fs.readFileSync(path.join(자리.저장소, 'experiences', 'topik-items', 'items', 'tii-g4-a.json'), 'utf8'));
  const 문항목록 = Array.isArray(은행) ? 은행 : 은행.items;
  const 문항 = {};
  for (const id of Object.values(대본.다른자리)) {
    const x = 문항목록.find((y) => y.id === id);
    if (!x || x.reviewStatus !== 'ai-reviewed') throw new Error(`검수 통과 문항이 아니다: ${id}`);
    문항[id] = { id, passage: x.passage, question: x.question, choices: x.choices, answer: x.answer,
      explanation: { ko: x.explanation.ko, mn: x.explanation.mn }, choiceNotes: x.choiceNotes };
  }
  fs.writeFileSync(path.join(밖, '문항.json'), JSON.stringify(문항, null, 1));
  // 음성 구: 1화 시범판이 묶어 둔 Orbloom(MIT, 머리에 고지) 사본을 그대로 쓴다.
  fs.copyFileSync(path.join(자리.저장소, 'experiences', 'drama', 'pilot', 'orbloom.mjs'), path.join(밖, 'orbloom.mjs'));
  // 글꼴: Inter Tight(라틴 · 키릴 — 몽골어 Ө ө Ү ү 포함)를 python fontTools로 줄여 글꼴/에 둔다(1화 시범판 빌드와 같은 방식). 화면 말은 한국어라 영문 고정폭 라벨 글꼴은 쓰지 않는다.
  // fontTools가 없으면 건너뛴다 — 화면은 SUIT와 기기 고정폭 글꼴로 대신한다.
  const 글꼴밖 = path.join(밖, '글꼴');
  fs.mkdirSync(글꼴밖, { recursive: true });
  const 라틴 = 'U+0020-007E,U+00A0-00FF,U+2010-2027,U+2030-203A,U+2190-2193,U+2713';
  const 키릴 = 'U+0400-04FF';
  const 글꼴들 = [
    ['InterTight/InterTight-Medium.ttf', 'InterTight-Medium.woff2', `${라틴},${키릴}`],
    ['InterTight/InterTight-SemiBold.ttf', 'InterTight-SemiBold.woff2', `${라틴},${키릴}`],
    ['InterTight/InterTight-Bold.ttf', 'InterTight-Bold.woff2', `${라틴},${키릴}`],
  ];
  for (const [원, 이름, 범위] of 글꼴들) {
    const 받은 = path.join(글꼴밖, 이름);
    const 원파일 = path.join(자리.저장소, 'docs', '브랜드_폰트', 원);
    // 이미 줄인 파일이 원본보다 새로우면 다시 줄이지 않는다(fontTools가 한 벌에 수십 초 걸린다).
    if (fs.existsSync(받은) && fs.statSync(받은).mtimeMs > fs.statSync(원파일).mtimeMs) { 쓴것.push(`글꼴 ${이름}(있음)`); continue; }
    try {
      execFileSync('python', ['-m', 'fontTools.subset', path.join(자리.저장소, 'docs', '브랜드_폰트', 원), `--unicodes=${범위}`, `--output-file=${받은}`, '--flavor=woff2', '--layout-features=*', '--no-hinting'], { stdio: 'pipe' });
      쓴것.push(`글꼴 ${이름}`);
    } catch (e) { console.error(`${이름}: 글꼴을 줄이지 못했다(python fontTools 필요) — 화면은 SUIT로 대신한다`); }
  }
  // 화면
  const { html } = 폰트.심기(fs.readFileSync(path.join(__dirname, '원고.htm'), 'utf8'));
  fs.writeFileSync(path.join(밖, 'index.html'), html);
  console.log(`시험판 → ${밖}\n${쓴것.join(' · ')}\n문항 ${Object.keys(문항).join(' · ')}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
