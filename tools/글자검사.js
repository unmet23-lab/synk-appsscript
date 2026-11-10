#!/usr/bin/env node
'use strict';
/* 글자 검사기(2026-11-10 LAB 하루 두 편 · 39계정 — 설계 11, docs/마케팅/LAB_하루두편_설계_20261110/README.md). 영상 · 글은 바꾸지 않는다.
 *
 *   node tools/글자검사.js 전 <판본 글.json> [--엔진없이] [--json]
 *       렌더 전 — 판본 글(tools/lib/판본글.js 꼴)의 규칙 · 글꼴(네모 글자 · 결합 깨짐) · 읽기 시간과, 「상자」가 있는 줄은 크롬 엔진 잼
 *       (상자 넘침 · 테두리 닿음 · 엔진 줄바꿈의 낱말 중간 · 줄머리 금칙 · 시스템 대체 글꼴 · x · y가 있으면 안전 영역).
 *   node tools/글자검사.js 뒤 <영상.mp4> --언어 <코드> [--기준 <같은 정본의 다른 판 영상>]… [--플랫폼 <tiktok|instagram|youtube|…>] [--밖 <폴더>] [--json]
 *       렌더 뒤 — 0.5초마다 프레임의 글 자리(OCR이 믿을 만한 언어는 OCR 상자 + 기준 영상과의 픽셀 차이)로 안전 영역 · 플랫폼 단추 가림을 보고,
 *       여백이 가장 좁은 장면 셋을 원본 해상도로 잘라 <밖>/좁은여백_*.png로 남긴다(눈으로 본다).
 *   node tools/글자검사.js 판본 <편 폴더> <판본 키> [--기준 <판본 키|영상>]… [--엔진없이] [--기록] [--눈확인 "<본 것>"] [--json]
 *       원본 편 게시/준비.json 「돌림」.판본[키]의 「파일」(영상) · 「글」(판본 글)로 전 + 뒤를 다 돌린다. --기준을 안 주면 같은 원본의
 *       다른 판본 가운데 OCR이 읽는 언어(라틴 · 키릴) 판 영상 둘까지를 기준으로 쓴다.
 *       --기록이면 돌림.판본[키].검수.글자 = { 결과, 지문: <영상 SHA-256>, 시각, 도구, 기록 }을 쓴다(tools/돌림표.js가 지문으로 무효를 가른다).
 *       --눈확인은 좁은 여백 그림과 확인할 것을 다 본 뒤 그 메모와 함께 「통과」로 적는다(고칠 것은 못 넘긴다).
 *       편 폴더에 판본지도.json이 있으면(판본 틀의 판본 글에서 글.json을 뽑는 편 — tools/lib/판본잇기.js) 검사 전에 글.json을 원천에 맞추고,
 *       영상이 지금 판본 글로 구운 것이 아니면(렌더.json 글 지문) 「영상낡음」 고칠 것을 낸다.
 * 결과 파일: .tmp/글자검사/<편>/<판본>/결과.json(전 · 뒤 단독은 .tmp/글자검사/<이름>-<시각>/).
 * 종료 코드: 0 통과 · 1 고칠 것 · 3 확인할 것만 · 2 사용법 · 실행 오류.
 */
const fs = require('node:fs');
const path = require('node:path');
const 검사 = require('./lib/글자검사.js');
const 판본글 = require('./lib/판본글.js');
const 프로필 = require('./lib/현지화프로필.js');
const 잇기 = require('./lib/판본잇기.js');

const REPO = path.resolve(__dirname, '..');
const 도구 = 'tools/글자검사.js';

function kst(ms = Date.now()) {
  return new Date(ms + 9 * 3600 * 1000).toISOString().replace(/\.\d+Z$/, '+09:00');
}
const rel = (p) => path.relative(REPO, p).split(path.sep).join('/');

function 인자들(argv) {
  const 값 = {}, 여럿 = { 기준: [] }, 위치 = [];
  const 깃발 = new Set(['--엔진없이', '--기록', '--json']);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (깃발.has(a)) 값[a.slice(2)] = true;
    else if (a === '--기준') 여럿.기준.push(argv[++i]);
    else if (a.startsWith('--')) 값[a.slice(2)] = argv[++i];
    else 위치.push(a);
  }
  return { 값, 여럿, 위치 };
}

async function 렌더전(글파일, L, { 엔진 = true } = {}) {
  const 판 = 판본글.읽기(글파일);
  const 찾음 = [...검사.규칙검사(판, L)];
  const 글꼴 = 검사.글꼴검사(판, L);
  찾음.push(...글꼴.찾음);
  let 잰것 = [];
  if (엔진) {
    const e = await 검사.엔진재기(판, L);
    찾음.push(...e.찾음);
    잰것 = e.잰것;
  }
  return { 판, 찾음, 잰것, 글꼴: 글꼴.줄 };
}

function 보이기(결과, json) {
  if (json) { console.log(JSON.stringify(결과, null, 2)); return; }
  console.log(`글자 검사 · ${결과.이름} · ${결과.언어} · ${결과.판정}${결과.눈확인 ? ` (눈확인: ${결과.눈확인})` : ''}`);
  const 고칠것 = 결과.찾음.filter((f) => f.수준 === 검사.고칠);
  const 확인할것 = 결과.찾음.filter((f) => f.수준 === 검사.확인);
  if (고칠것.length) { console.log(`고칠 것 ${고칠것.length}`); 고칠것.forEach((f) => console.log(`  ✗ ${f.줄 ? `[${f.줄}] ` : ''}${f.말}`)); }
  if (확인할것.length) { console.log(`확인할 것 ${확인할것.length}`); 확인할것.forEach((f) => console.log(`  ? ${f.줄 ? `[${f.줄}] ` : ''}${f.말}`)); }
  for (const g of 결과.좁은 || []) console.log(`  좁은 여백 ${g.초}초 · ${g.자리} ${g.여백}px → ${rel(g.자른)}`);
  console.log(`  기록: ${rel(결과.결과파일)}`);
}

function 종료코드(판정) {
  return 판정 === 검사.고칠 ? 1 : (판정 === 검사.확인 ? 3 : 0);
}

// 같은 원본의 다른 판본 가운데 OCR로 읽히는 언어(라틴 · 키릴 — 언어 프로필 글자인식.쓸만함) 판 영상, 씨앗 판(EN · MN) 먼저
function 기본기준(편, 키, prep) {
  const 판본들 = prep.돌림?.판본 || {};
  const 후보 = Object.entries(판본들).filter(([k, v]) => k !== 키 && v.파일).map(([k, v]) => {
    const L = 프로필.언어(v.언어);
    const 파일 = path.isAbsolute(v.파일) ? v.파일 : path.join(path.resolve(편), v.파일);
    return { k, 파일, 좋음: Boolean(L && L.글자인식?.쓸만함 && /라틴|키릴/.test(L.문자)) };
  }).filter((x) => x.좋음 && fs.existsSync(x.파일));
  후보.sort((a, b) => (['EN', 'MN'].indexOf(b.k) >= 0) - (['EN', 'MN'].indexOf(a.k) >= 0) || a.k.localeCompare(b.k));
  return 후보.slice(0, 2).map((x) => x.파일);
}

async function main(argv) {
  const { 값, 여럿, 위치 } = 인자들(argv);
  const 명령 = 위치[0];
  const 쓰는법 = '쓰는 법: node tools/글자검사.js 전 <판본 글.json> | 뒤 <영상> --언어 <코드> [--기준 <영상>] | 판본 <편 폴더> <판본 키> [--기준 …] [--기록] [--눈확인 "<본 것>"]   (머리말 참고)';
  const 시각 = kst();
  const 도장 = 시각.replace(/[-:]/g, '').slice(0, 13);

  if (명령 === '전') {
    const 글파일 = 위치[1];
    if (!글파일) { console.error(쓰는법); return 2; }
    const 자료 = 판본글.readJson(글파일);
    const L = 프로필.언어(자료.언어);
    if (!L) { console.error(`언어 프로필에 없는 언어: ${자료.언어}`); return 2; }
    const r = await 렌더전(글파일, L, { 엔진: !값.엔진없이 });
    const 밖 = path.resolve(값.밖 || path.join(REPO, '.tmp', '글자검사', `${path.basename(글파일, '.json')}-${도장}`));
    fs.mkdirSync(밖, { recursive: true });
    const 결과 = { 도구, 시각, 단계: '렌더 전', 이름: path.basename(글파일), 언어: L.코드, 글: 글파일, 글지문: r.판.지문, 판정: 검사.판정하기(r.찾음), 찾음: r.찾음, 잰것: r.잰것, 글꼴: r.글꼴, 결과파일: path.join(밖, '결과.json') };
    fs.writeFileSync(결과.결과파일, JSON.stringify(결과, null, 2) + '\n');
    보이기(결과, 값.json);
    return 종료코드(결과.판정);
  }

  if (명령 === '뒤') {
    const 영상 = 위치[1];
    const L = 프로필.언어(값.언어);
    if (!영상 || !L) { console.error(`${쓰는법}\n  --언어는 언어 프로필 코드(${프로필.언어목록().join(' ')})`); return 2; }
    const 밖 = path.resolve(값.밖 || path.join(REPO, '.tmp', '글자검사', `${path.basename(영상, path.extname(영상))}-${도장}`));
    const 찾음 = [];
    let 글지문 = null;
    if (값.글) { const r = await 렌더전(값.글, L, { 엔진: !값.엔진없이 }); 찾음.push(...r.찾음); 글지문 = r.판.지문; }
    const f = 검사.프레임검사({ 영상: path.resolve(영상), 기준: 여럿.기준.map((x) => path.resolve(x)), 언어p: L, 플랫폼: 값.플랫폼 || null, 밖 });
    찾음.push(...f.찾음);
    const 결과 = { 도구, 시각, 단계: '렌더 뒤', 이름: path.basename(영상), 언어: L.코드, 영상, 지문: 판본글.sha256(영상), 글: 값.글 || null, 글지문, 기준: 여럿.기준, 판정: 검사.판정하기(찾음), 찾음, 좁은: f.좁은, 결과파일: path.join(밖, '결과.json') };
    fs.writeFileSync(결과.결과파일, JSON.stringify(결과, null, 2) + '\n');
    보이기(결과, 값.json);
    return 종료코드(결과.판정);
  }

  if (명령 === '판본') {
    const [, 편, 키] = 위치;
    if (!편 || !키) { console.error(쓰는법); return 2; }
    const 찾은 = 판본글.판본찾기(편, 키);
    const L = 프로필.언어(찾은.판본.언어);
    if (!L) { console.error(`판본 ${키}의 언어(${찾은.판본.언어})가 언어 프로필에 없다`); return 2; }
    if (!찾은.영상 || !fs.existsSync(찾은.영상)) { console.error(`판본 ${키}의 영상이 없다: ${찾은.판본.파일}`); return 2; }
    const 밖 = path.resolve(값.밖 || path.join(REPO, '.tmp', '글자검사', path.basename(path.resolve(편)), 키));
    const 찾음 = [];
    // 판본 틀에서 뽑는 글(편 폴더 판본지도.json — tools/lib/판본잇기.js)이면 검사 전에 글.json을 원천에 맞추고, 영상이 지금 글로 구운 것인지 본다
    const 이음 = 잇기.검사전(편, 키, 찾은.판본);
    if (이음 && !이음.이음) 찾음.push(검사.찾음(검사.확인, '글이음', `준비.json 판본의 「글」(${찾은.판본.글 || '칸 없음'})이 판본 지도가 뽑는 글(${이음.바른글})이 아니다 — node tools/판본글잇기.js 돌림`));
    if (이음?.바뀜) console.error(`  판본 글 원천이 바뀌어 글.json을 다시 뽑았다 — 뜻 검사 지문도 바뀐다(${이음.바른글})`);
    if (이음?.영상낡음) 찾음.push(검사.찾음(검사.고칠, '영상낡음', `영상이 지금 판본 글로 구운 것이 아니다(렌더 뒤 판본 글이 바뀜) — node 판본렌더.mjs ${키} 뒤 다시 검사한다`));
    let 글지문 = null;
    if (찾은.글 && fs.existsSync(찾은.글)) {
      const r = await 렌더전(찾은.글, L, { 엔진: !값.엔진없이 });
      찾음.push(...r.찾음);
      글지문 = r.판.지문;
    } else {
      찾음.push(검사.찾음(검사.확인, '글없음', `판본 「글」 파일이 없다(${찾은.판본.글 || '칸 없음'}) — 렌더 전 규칙 · 글꼴 · 엔진 잼을 못 했다`));
    }
    const 기준 = 여럿.기준.length
      ? 여럿.기준.map((x) => { try { return 판본글.판본찾기(편, x).영상; } catch { return path.resolve(x); } })
      : 기본기준(편, 키, 찾은.prep);
    const 플랫폼 = 값.플랫폼 || null;
    const f = 검사.프레임검사({ 영상: 찾은.영상, 기준, 언어p: L, 플랫폼, 밖 });
    찾음.push(...f.찾음);
    const 눈확인 = 값.눈확인 || null;
    const 결과 = { 도구, 시각, 단계: '판본', 이름: `${path.basename(path.resolve(편))} · ${키}`, 편: path.basename(path.resolve(편)), 판본: 키, 언어: L.코드,
      영상: 찾은.영상, 지문: 판본글.sha256(찾은.영상), 글: 찾은.글, 글지문, 기준, 판정: 검사.판정하기(찾음, { 눈확인 }), 눈확인, 찾음, 좁은: f.좁은, 결과파일: path.join(밖, '결과.json') };
    fs.mkdirSync(밖, { recursive: true });
    fs.writeFileSync(결과.결과파일, JSON.stringify(결과, null, 2) + '\n');
    if (값.기록) {
      const 기록 = { 결과: 결과.판정, 지문: 결과.지문, 시각, 도구, 기록: rel(결과.결과파일),
        고칠것: 찾음.filter((x) => x.수준 === 검사.고칠).length, 확인할것: 찾음.filter((x) => x.수준 === 검사.확인).length };
      if (눈확인) 기록.눈확인 = 눈확인;
      if (글지문) 기록.글지문 = 글지문;
      const 준비 = 판본글.검수쓰기(편, 키, '글자', 기록);
      결과.기록한곳 = rel(준비);
    }
    보이기(결과, 값.json);
    if (결과.기록한곳) console.log(`  준비.json 「돌림」.판본[${키}].검수.글자 = ${결과.판정} (${결과.기록한곳})`);
    return 종료코드(결과.판정);
  }

  console.error(쓰는법);
  return 2;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((e) => { console.error(e.stack || e.message); process.exitCode = 2; });
}

module.exports = { main, 인자들, 기본기준 };
