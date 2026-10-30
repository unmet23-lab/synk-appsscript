#!/usr/bin/env node
'use strict';
/**
 * 업종 반응 브리핑 — 업종 설정 하나로 공개 자료를 모아 숫자를 세고, Claude가 나누고 쓴 글을 붙여 한 장짜리 HTML을 만든다(2026-10-30).
 * 설계: docs/마케팅/PULSE_반응브리핑/도구_설계.md · 첫 견본: docs/마케팅/PULSE_반응브리핑/README.md
 *
 *   node tools/업종브리핑/브리핑.js 돌리기 <설정 이름> [--받는사람 "…"] [--날짜 YYYY-MM-DD] [--다시 <단계>] [--건너뛰기 네이버,메타] [--출력 <폴더>] [--한도무시]
 *   node tools/업종브리핑/브리핑.js 검사 <설정 이름> [--날짜 …]       네트워크 없이: 남은 자료로 다시 세어 지표·글·페이지가 맞는지
 *   node tools/업종브리핑/브리핑.js 분류찾기 <낱말…> [--새로]          네이버 쇼핑 분류 id 찾기(처음 한 번 ego로 분류 나무를 받아 둔다)
 *   node tools/업종브리핑/브리핑.js 새업종 "<업종>" [--이름 <파일 이름>]   설정 초안(Claude) — git 밖 초안 폴더에 쓰고, 확인 뒤 설정/로 옮긴다
 *
 * 단계: 유튜브 → 네이버 → 메타 → 나누기 → 집계 → 글 → 그리기. 결과는 <공용 작업본>/.tmp/업종브리핑/<설정 이름>/<날짜>/(git 밖)에
 * 단계마다 JSON으로 남고 이미 끝난 단계는 건너뛴다. 어느 단계든 새로 돌면 그 뒤 단계는 모두 다시 돈다(옛 지표·페이지와 섞이지 않게).
 * 막힌 갈래는 「못 읽음」으로 남기고 다음으로 간다. 남에게 보내기 · 게시는 하지 않는다.
 * 설정 파일(저장소)에는 업종 몫만 둔다 — 받는 사람(고객사 이름)은 --받는사람이나 git 밖 받는사람.json으로(공개 저장소).
 * 유튜브는 LAB 프로젝트 하루 몫(1만 단위)을 업로드 · 수요 스캔과 나눠 쓴다 — 이 도구 몫은 태평양 날짜 하루 3,000단위까지(--한도무시로만 넘김).
 * 네이버 · 메타는 ego(lite)가 떠 있어야 한다(단계마다 시간 상한, 넘으면 받은 만큼만). Claude는 tools/lib/클로드키.js 크레딧 키로.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { 공용작업본 } = require('../lib/공용작업본.js');

const 여기 = __dirname;
const 저장소 = path.resolve(여기, '..', '..');
const 단계들 = ['유튜브', '네이버', '메타', '나누기', '집계', '글', '그리기'];
const 하루 = 24 * 60 * 60 * 1000;
const 유튜브하루몫 = 3000;
const ego상한분 = { 네이버: 10, 메타: 6, 분류: 15 };

function 인자(argv) {
  const o = { 명령: argv[0], 낱말: [], 다시: null, 건너뛰기: [], 날짜: null, 출력: null, 받는사람: null, 이름: null, 새로: false, 한도무시: false };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--다시') o.다시 = argv[++i];
    else if (a === '--건너뛰기') o.건너뛰기 = String(argv[++i] || '').split(',').filter(Boolean);
    else if (a === '--날짜') o.날짜 = argv[++i];
    else if (a === '--출력') o.출력 = argv[++i];
    else if (a === '--받는사람') o.받는사람 = argv[++i];
    else if (a === '--이름') o.이름 = argv[++i];
    else if (a === '--새로') o.새로 = true;
    else if (a === '--한도무시') o.한도무시 = true;
    else o.낱말.push(a);
  }
  return o;
}

const 오늘서울 = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const 오늘태평양 = () => new Date(Date.now() - 7 * 3600 * 1000).toISOString().slice(0, 10); // 유튜브 몫은 태평양 자정에 돈다(PDT 기준, 겨울엔 한 시간 어긋나도 어림이면 된다)
const 날짜더하기 = (s, 일) => new Date(Date.parse(`${s}T00:00:00Z`) + 일 * 하루).toISOString().slice(0, 10);
const 읽기 = (p, 기본 = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return 기본; } };
const 쓰기 = (p, x) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(`${p}.tmp`, JSON.stringify(x, null, 1)); fs.renameSync(`${p}.tmp`, p); };
const 바탕폴더 = () => path.join(공용작업본(저장소), '.tmp', '업종브리핑');

function 설정읽기(이름) {
  const p = path.join(여기, '설정', `${이름}.json`);
  const s = 읽기(p);
  if (!s) throw new Error(`설정이 없다: ${p}`);
  const 문제 = [];
  if (!s.업종) 문제.push('업종');
  if (!s.유튜브?.검색어?.length) 문제.push('유튜브.검색어');
  if (s.유튜브?.검색어?.length > 15) 문제.push('유튜브.검색어는 15개까지(검색 한 번에 100단위)');
  if (s.네이버?.검색어묶음?.length > 5) 문제.push('네이버.검색어묶음은 5개까지');
  if (문제.length) throw new Error(`설정 ${이름}: ${문제.join(', ')}`);
  return s;
}

/** 받는 사람: --받는사람 > 그 실행 폴더의 받는사람.json > git 밖 업종 폴더의 받는사람.json > 설정(일반 문장만) > 「<업종>를 파는 브랜드」 */
function 받는사람(설정, o, 폴더 = null) {
  if (o.받는사람) return o.받는사람;
  const 실행 = 폴더 ? 읽기(path.join(폴더, '받는사람.json')) : null;
  const 밖 = 읽기(path.join(바탕폴더(), 설정.이름, '받는사람.json'));
  return 실행?.받는사람 || 밖?.받는사람 || 설정.받는사람 || `${설정.업종}를 파는 브랜드`;
}

/** ego 안에서 스크립트를 돌린다(릴스.js와 같은 꼴: JOB을 앞에 붙여 표준 입력으로). 시간 상한을 넘으면 프로세스 나무를 끝내고 받은 만큼만 */
function ego돌리기(스크립트, job, 상한분) {
  return new Promise((풀기) => {
    const body = fs.readFileSync(path.join(여기, 스크립트), 'utf8');
    const 자식 = spawn('ego-browser nodejs', { shell: true, windowsHide: true });
    let 출력 = '', 끊음 = false;
    자식.stdout.on('data', (b) => { 출력 += b; });
    자식.stderr.on('data', (b) => { 출력 += b; });
    const 타이머 = setTimeout(() => {
      끊음 = true;
      // 셸 아래 ego 실행기까지 끝낸다 — 남으면 다음 ego 스크립트가 출력 없이 막힌다(현장 노트 브라우저)
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(자식.pid), '/T', '/F'], { windowsHide: true });
      else 자식.kill('SIGKILL');
    }, 상한분 * 60_000);
    자식.on('close', (코드) => {
      clearTimeout(타이머);
      const 받은 = 읽기(job.out);
      if (받은) 풀기({ ...받은, ...(끊음 ? { 시간초과: `${상한분}분 상한을 넘어 받은 만큼만` } : {}) });
      else 풀기({ 실패: 끊음 ? `${상한분}분 상한을 넘었고 받은 것이 없다` : `ego 실행 실패(코드 ${코드}): ${출력.trim().split('\n').slice(-3).join(' ').slice(0, 200)}` });
    });
    자식.stdin.end(`globalThis.JOB = ${JSON.stringify(job)};\n${body}`);
  });
}

function 기록기(폴더) {
  return (줄) => {
    const 한줄 = { 시각: new Date().toISOString(), ...(typeof 줄 === 'string' ? { 글: 줄 } : 줄) };
    fs.appendFileSync(path.join(폴더, '기록.jsonl'), JSON.stringify(한줄) + '\n');
    console.log(typeof 줄 === 'string' ? 줄 : JSON.stringify(줄));
  };
}

// ── 유튜브 몫 장부(이 도구 몫만, 태평양 날짜) ─────────────────────────────
function 유튜브장부(어림, 한도무시) {
  const p = path.join(바탕폴더(), '_유튜브단위.jsonl');
  const 날 = 오늘태평양();
  const 쓴 = (fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }) : [])
    .filter((x) => x && x.날 === 날).reduce((n, x) => n + (x.단위 || 0), 0);
  if (쓴 + 어림 > 유튜브하루몫 && !한도무시) throw new Error(`유튜브 몫: 오늘(태평양 ${날}) 이 도구가 ${쓴}단위를 썼고 이번 어림이 ${어림}단위라 하루 ${유튜브하루몫}을 넘는다 — 내일 돌리거나 --한도무시`);
  return { 쓴, 적기: (단위) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.appendFileSync(p, JSON.stringify({ 날, 단위, 시각: new Date().toISOString() }) + '\n'); } };
}

// ── 단계 ──────────────────────────────────────────────────────────────
async function 유튜브단계(설정, 기준일, 남기기, 폴더, o) {
  const { API부르개 } = require('../수요스캔/수요수집.js');
  const 유튜브 = require('./유튜브.js');
  const 검색캐시경로 = path.join(폴더, '유튜브_검색.json');
  const 검색캐시 = 읽기(검색캐시경로, {});
  const 어림 = 유튜브.단위어림(설정, 검색캐시);
  const 장부 = 유튜브장부(어림, o.한도무시);
  남기기(`유튜브 어림 ${어림}단위(오늘 이 도구 ${장부.쓴}단위 씀)`);
  // 호출마다 한 줄 — 화면에는 내지 않고 파일에만(수백 줄이라)
  const 부르개 = new API부르개({ 기록: (줄) => fs.appendFileSync(path.join(폴더, '유튜브api.jsonl'), JSON.stringify(줄) + '\n') });
  const 시작일 = 날짜더하기(기준일, -(설정.유튜브.창일 || 45));
  const 전검색 = Object.keys(검색캐시).length;
  try {
    return await 유튜브.모으기(설정, { 부르개, 시작일, 검색캐시, 알림: 남기기 });
  } finally {
    쓰기(검색캐시경로, 검색캐시);
    // search는 한 번에 100단위, 나머지는 1단위 — 호출 수에 새 검색 몫을 더한다
    장부.적기((부르개.셈?.호출 || 0) + 99 * (Object.keys(검색캐시).length - 전검색));
  }
}

function 네이버일감(설정, 기준일, 폴더) {
  const N = 설정.네이버 || {};
  const 어제 = 날짜더하기(기준일, -1);
  const 일감 = { out: path.join(폴더, '네이버_원자료.json'), 공간: `업종 브리핑 · 네이버 · ${설정.이름}`, 쇼핑: null, 검색: null };
  if (N.분류?.cid) {
    const 네주 = 날짜더하기(어제, -27);
    const 순위 = [{ 이름: '이번 4주', 시작: 네주, 끝: 어제 }, { 이름: '최근 7일', 시작: 날짜더하기(어제, -6), 끝: 어제 }];
    // 작년 다음 달: 기준일 다음 달의 1일~말일, 한 해 앞
    const d = new Date(Date.parse(`${기준일}T00:00:00Z`));
    const 시작 = new Date(Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth() + 1, 1));
    const 끝 = new Date(Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth() + 2, 0));
    순위.push({ 이름: '작년 다음 달', 시작: 시작.toISOString().slice(0, 10), 끝: 끝.toISOString().slice(0, 10) });
    for (const 나이 of ['10', '20', '30', '40', '50', '60']) 순위.push({ 이름: `${나이}대`, 시작: 네주, 끝: 어제, 나이, 성별: N.성별 || '' });
    for (const h of N.분류.하위 || []) 순위.push({ 이름: h.이름, cid: h.cid, 시작: 네주, 끝: 어제 });
    일감.쇼핑 = { cid: N.분류.cid, 순위, 비중: { 시작: 네주, 끝: 어제 }, 하위: N.분류.하위 || [], 클릭: { 시작: 날짜더하기(어제, -400), 끝: 어제 } };
  }
  if (N.검색어묶음?.length) {
    const 시작 = new Date(Date.parse(`${기준일}T00:00:00Z`)); 시작.setUTCFullYear(시작.getUTCFullYear() - 3); 시작.setUTCMonth(0, 1);
    일감.검색 = { 묶음: N.검색어묶음, 성별: N.성별 || '', 시작: 시작.toISOString().slice(0, 10), 끝: 어제 };
  }
  return 일감;
}

/** ego 결과(또는 실패)를 단계 꼴로 — 실패면 갈래마다 「못 읽음」 */
function 네이버꼴(r, 일감) {
  if (r.실패) return { 상태: { 쇼핑: 일감.쇼핑 ? `못 읽음: ${r.실패}` : '설정 없음', 검색: 일감.검색 ? `못 읽음: ${r.실패}` : '설정 없음' } };
  const 상태 = { ...(r.상태 || {}) };
  for (const k of ['쇼핑', '검색']) if (!상태[k]) 상태[k] = 일감[k] ? `못 읽음: ${r.시간초과 || '결과 없음'}` : '설정 없음';
  return { ...r, 상태 };
}

function 나누기항목(유튜브결과, 메타결과) {
  const 집계 = require('./집계.js');
  const 댓글 = [], 영상 = [], 광고 = [];
  if (유튜브결과?.상태 === '됨') {
    for (const [id, cs] of Object.entries(유튜브결과.댓글 || {})) cs.forEach((c, i) => { if (!c.주인 && String(c.글).trim()) 댓글.push({ 키: `${id}#${i}`, 글: c.글 }); });
    for (const v of 유튜브결과.후보 || []) 영상.push({ 키: v.id, 글: `${v.제목}${v.설명 ? ` / ${v.설명.slice(0, 100)}` : ''}` });
  }
  if (메타결과) for (const a of 집계.광고모으기(메타결과)) 광고.push({ 키: a.id, 글: `${a.본문} ${a.제목}`.trim() || '(문구 없음)' });
  return { 댓글, 영상, 광고 };
}

function 그리기입력(모음, 글결과, 설정, 기준일, 받는) {
  return { 지표: 모음.지표, 그림: 모음.그림, 표본: 모음.표본, 글: 글결과?.상태 === '됨' ? 글결과.글 : null, 글까닭: 글결과?.상태 === '됨' ? null : (글결과?.까닭 || '글 단계를 돌리지 않음'), 상태: 모음.상태, 설정: { ...설정, 받는사람: 받는 }, 기준일 };
}

async function 돌리기(o) {
  const 이름 = o.낱말[0];
  if (!이름) throw new Error('설정 이름을 주세요(tools/업종브리핑/설정/<이름>.json)');
  const 설정 = 설정읽기(이름);
  const 기준일 = o.날짜 || 오늘서울();
  const 폴더 = o.출력 || path.join(바탕폴더(), 이름, 기준일);
  fs.mkdirSync(폴더, { recursive: true });
  // 준 받는 사람은 실행 폴더(git 밖)에 남겨, 나중에 단계만 다시 돌려도 같은 이름으로 그린다
  if (o.받는사람) 쓰기(path.join(폴더, '받는사람.json'), { 받는사람: o.받는사람 });
  const 받는 = 받는사람(설정, o, 폴더);
  const 남기기 = 기록기(폴더);
  const 파일 = Object.fromEntries(단계들.map((d) => [d, path.join(폴더, `${d}.json`)]));
  const 다시부터 = o.다시 ? 단계들.indexOf(o.다시) : -1;
  if (o.다시 && 다시부터 < 0) throw new Error(`모르는 단계: ${o.다시} (${단계들.join('·')})`);
  // 한 단계가 새로 돌면 그 뒤는 모두 다시 — 옛 지표 · 글 · 페이지와 섞이지 않게(Fable 설계 검토 1)
  let 새로돈 = false;
  const 할까 = (d) => {
    if (o.건너뛰기.includes(d)) return false;
    const 해야 = 새로돈 || !fs.existsSync(파일[d]) || (다시부터 >= 0 && 단계들.indexOf(d) >= 다시부터);
    if (해야) 새로돈 = true;
    return 해야;
  };
  남기기({ 단계: '시작', 설정: 이름, 기준일, 폴더 });

  if (할까('유튜브')) {
    try { 쓰기(파일.유튜브, await 유튜브단계(설정, 기준일, 남기기, 폴더, o)); } catch (e) { 쓰기(파일.유튜브, { 상태: '못 읽음', 까닭: String(e.message || e).slice(0, 200) }); 남기기(`유튜브 못 읽음: ${e.message}`); }
  }
  if (할까('네이버')) {
    const 일감 = 네이버일감(설정, 기준일, 폴더);
    if (!일감.쇼핑 && !일감.검색) 쓰기(파일.네이버, { 상태: { 쇼핑: '설정 없음', 검색: '설정 없음' } });
    else 쓰기(파일.네이버, 네이버꼴(await ego돌리기('네이버읽기.mjs', 일감, ego상한분.네이버), 일감));
    남기기({ 단계: '네이버', 상태: 읽기(파일.네이버)?.상태 });
  }
  if (할까('메타')) {
    if (!설정.메타?.검색어?.length) 쓰기(파일.메타, { 상태: { 메타: '설정 없음' }, 검색: [] });
    else {
      const r = await ego돌리기('메타읽기.mjs', { out: path.join(폴더, '메타_원자료.json'), 공간: `업종 브리핑 · 메타 · ${설정.이름}`, 나라: 'KR', 검색어: 설정.메타.검색어, 내림: 4 }, ego상한분.메타);
      쓰기(파일.메타, r.실패 ? { 상태: { 메타: `못 읽음: ${r.실패}` }, 검색: [] } : r);
    }
    남기기({ 단계: '메타', 상태: 읽기(파일.메타)?.상태 });
  }
  const 유튜브결과 = 읽기(파일.유튜브);
  const 네이버결과 = 읽기(파일.네이버);
  const 메타결과 = 읽기(파일.메타);

  if (할까('나누기')) {
    const 클로드 = require('../lib/클로드키.js');
    const { 나누기 } = require('./나누기.js');
    const 캐시경로 = path.join(바탕폴더(), 이름, '나누기캐시.json');
    const 캐시 = 읽기(캐시경로, {});
    const 항목 = 나누기항목(유튜브결과, 메타결과);
    const 결과 = { 주제: {}, 못나눔: {}, 낱말로: {} };
    for (const 종류 of ['댓글', '영상', '광고']) {
      if (!항목[종류].length) { 결과[종류] = {}; continue; }
      const r = await 나누기({ 보내기: 클로드.보내기, 종류, 설정, 항목: 항목[종류], 캐시, 알림: 남기기 });
      결과[종류] = r.표; 결과.주제[종류] = r.주제; 결과.못나눔[종류] = r.못나눔; 결과.낱말로[종류] = r.낱말로;
      쓰기(캐시경로, 캐시);
    }
    쓰기(파일.나누기, 결과);
  }
  const 나눔 = 읽기(파일.나누기, {});

  if (할까('집계')) {
    const { 집계 } = require('./집계.js');
    쓰기(파일.집계, 집계({ 유튜브: 유튜브결과, 네이버: 네이버결과, 메타: 메타결과, 나누기: 나눔, 기준일, 설정 }));
  }
  const 모음 = 읽기(파일.집계);

  if (할까('글')) {
    try {
      const 클로드 = require('../lib/클로드키.js');
      const { 쓰기: 글쓰기 } = require('./글.js');
      const r = await 글쓰기({ 보내기: 클로드.보내기, 설정: { ...설정, 받는사람: 받는 }, 지표: 모음.지표, 표본: 모음.표본, 상태: 모음.상태, 알림: 남기기 });
      쓰기(파일.글, { 상태: '됨', 글: r.글, 회차: r.번 });
    } catch (e) { 쓰기(파일.글, { 상태: '못 씀', 까닭: String(e.message).slice(0, 300) }); 남기기(`글 못 씀: ${e.message}`); }
  }
  const 글결과 = 읽기(파일.글, {});

  if (할까('그리기')) {
    const { 그리기 } = require('./그리기.js');
    const { 문서, 조각 } = 그리기(그리기입력(모음, 글결과, 설정, 기준일, 받는));
    fs.writeFileSync(path.join(폴더, '브리핑.html'), 문서);
    fs.writeFileSync(path.join(폴더, '브리핑_조각.html'), 조각);
    쓰기(파일.그리기, { 상태: '됨', 문서: path.join(폴더, '브리핑.html'), 조각: path.join(폴더, '브리핑_조각.html'), 바이트: Buffer.byteLength(문서) });
  }
  남기기({ 단계: '끝', 상태: 모음?.상태, 글: 글결과.상태, 페이지: path.join(폴더, '브리핑.html') });
  return { 폴더, 페이지: path.join(폴더, '브리핑.html') };
}

/** 네트워크 없이: 남은 원자료로 다시 세어 집계.json과 같은지, 글이 검사를 지나는지, 페이지에 자리표시자가 남지 않았는지 */
function 검사(o) {
  const 이름 = o.낱말[0];
  const 설정 = 설정읽기(이름);
  const 기준일 = o.날짜 || 오늘서울();
  const 폴더 = o.출력 || path.join(바탕폴더(), 이름, 기준일);
  const 문제 = [];
  const { 집계 } = require('./집계.js');
  const { 검사하기 } = require('./글.js');
  const 모음 = 읽기(path.join(폴더, '집계.json'));
  if (!모음) throw new Error(`집계.json이 없다: ${폴더}`);
  const 다시 = 집계({ 유튜브: 읽기(path.join(폴더, '유튜브.json')), 네이버: 읽기(path.join(폴더, '네이버.json')), 메타: 읽기(path.join(폴더, '메타.json')), 나누기: 읽기(path.join(폴더, '나누기.json'), {}), 기준일, 설정 });
  if (JSON.stringify(다시.지표) !== JSON.stringify(모음.지표)) 문제.push('지표가 다시 센 값과 다르다(원자료나 집계가 바뀜)');
  const 글결과 = 읽기(path.join(폴더, '글.json'), {});
  if (글결과.상태 === '됨') {
    const 표본댓글 = {};
    for (const cs of Object.values(모음.표본?.댓글 || {})) for (const c of cs) 표본댓글[c.키] = c.글;
    문제.push(...검사하기(글결과.글, { 지표: 모음.지표, 표본댓글, 상태: 모음.상태 }).map((x) => `글: ${x}`));
  }
  const 페이지 = fs.existsSync(path.join(폴더, '브리핑.html')) ? fs.readFileSync(path.join(폴더, '브리핑.html'), 'utf8') : '';
  if (!페이지) 문제.push('브리핑.html이 없다');
  if (페이지.includes('{{')) 문제.push('페이지에 채우지 못한 자리표시자가 있다');
  const { 그리기 } = require('./그리기.js');
  const 같은판 = 그리기(그리기입력(모음, 글결과, 설정, 기준일, 받는사람(설정, o, 폴더))).문서;
  if (페이지 && 같은판 !== 페이지) 문제.push('같은 지표·글로 다시 그린 페이지가 다르다');
  return { 폴더, 문제 };
}

// ── 분류찾기 · 새업종 ─────────────────────────────────────────────────
async function 분류나무(새로) {
  const p = path.join(바탕폴더(), '_네이버분류.json');
  const 있는것 = 읽기(p);
  if (있는것 && !새로) return 있는것.분류;
  console.log('네이버 쇼핑 분류 나무를 받는다(ego, 2분 안팎)…');
  const r = await ego돌리기('분류찾기.mjs', { out: p, 공간: '업종 브리핑 · 분류', 깊이: 3 }, ego상한분.분류);
  if (r.실패 || !r.분류) throw new Error(r.실패 || '분류 나무를 못 받음');
  return r.분류;
}

async function 분류찾기(낱말들, 새로) {
  const 나무 = await 분류나무(새로);
  return 나무.filter((c) => 낱말들.every((w) => c.경로.includes(w))).sort((a, b) => b.단계 - a.단계).slice(0, 20);
}

async function 새업종(o) {
  const 업종 = o.낱말[0];
  if (!업종) throw new Error('새업종 "<업종>" [--이름 <파일 이름>]');
  const 클로드 = require('../lib/클로드키.js');
  const 견본 = 읽기(path.join(여기, '설정', '여성_겨울아우터.json'));
  const 쌍 = { type: 'object', additionalProperties: false, required: ['이름', '설명'], properties: { 이름: { type: 'string' }, 설명: { type: 'string' } } };
  const 스키마 = {
    type: 'object', additionalProperties: false,
    required: ['유튜브검색어', '제외낱말', '최소조회', '네이버검색어묶음', '성별', '분류낱말', '메타검색어', '플랫폼낱말', '댓글고유', '영상고유', '광고고유', '제안관점'],
    properties: {
      유튜브검색어: { type: 'array', items: { type: 'string' } },
      제외낱말: { type: 'array', items: { type: 'string' } },
      최소조회: { type: 'integer' },
      네이버검색어묶음: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['이름', '낱말'], properties: { 이름: { type: 'string' }, 낱말: { type: 'array', items: { type: 'string' } } } } },
      성별: { type: 'string', enum: ['f', 'm', ''] },
      분류낱말: { type: 'array', items: { type: 'string' } },
      메타검색어: { type: 'array', items: { type: 'string' } },
      플랫폼낱말: { type: 'array', items: { type: 'string' } },
      댓글고유: { type: 'array', items: 쌍 }, 영상고유: { type: 'array', items: 쌍 }, 광고고유: { type: 'array', items: 쌍 },
      제안관점: { type: 'string' },
    },
  };
  const { 응답 } = await 클로드.보내기({
    model: 'claude-opus-5-5', max_tokens: 8000,
    system: '너는 PULSE(광고 영상 제작사)의 시장 조사 담당이다. 업종 반응 브리핑 도구의 설정 초안을 쓴다. 한국 시장, 한국어 검색어. 유튜브 검색어는 그 업종 고객이 쇼츠를 찾을 때 실제로 칠 말(추천·후기·비교·나이·피부·체형처럼 반응이 갈리는 말 포함). 네이버 검색어 묶음은 계절·유행이 갈리는 대표 품목 이름(묶음마다 같은 뜻의 낱말 1~5개). 분류낱말은 네이버 쇼핑 분류 경로에 들어갈 낱말(예: 화장품/미용, 스킨케어). 제외낱말은 이 업종 고객이 아닌 영상을 거를 낱말(없으면 빈 목록). 최소조회는 이 업종 쇼츠에서 의미 있는 조회 수(보통 5천~2만). 플랫폼낱말은 이 업종에서 광고를 많이 내는 국내 큰 판매 앱·체인 이름(예: 올리브영) — 브랜드 직영 광고와 가르는 데 쓴다. 고유 주제는 이 업종에서만 갈리는 반응(예: 옷은 키·사이즈·핏, 화장품은 피부 타입·자극). 제안관점은 PULSE가 이 업종 광고에 줄 수 있는 것 — PULSE는 나이·체형이 다른 AI 모델로 착용·사용 장면을 만들 수 있고, AI 모델임을 밝히며, 실제 연예인 얼굴·이름은 쓰지 않는다.',
    messages: [{ role: 'user', content: `업종: ${업종}\n\n견본(여성 겨울 아우터) 설정:\n${JSON.stringify({ 유튜브: 견본.유튜브, 네이버: { 성별: 견본.네이버.성별, 검색어묶음: 견본.네이버.검색어묶음 }, 메타: 견본.메타, 주제: 견본.주제, 제안관점: 견본.제안관점 })}` }],
    output_config: { effort: 'high', format: { type: 'json_schema', schema: 스키마 } },
  }, { 용도: '업종브리핑-새업종', 시간제한: 300000 });
  if (응답.stop_reason === 'refusal') throw new Error('거절됨');
  const j = JSON.parse((응답.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(''));
  // 구조화 출력은 배열 개수를 못 묶는다 — 상한은 여기서 자른다
  j.유튜브검색어 = j.유튜브검색어.slice(0, 12); j.네이버검색어묶음 = j.네이버검색어묶음.slice(0, 5).map((g) => ({ ...g, 낱말: g.낱말.slice(0, 5) }));
  j.분류낱말 = j.분류낱말.slice(0, 3); j.메타검색어 = j.메타검색어.slice(0, 3); j.플랫폼낱말 = j.플랫폼낱말.slice(0, 8);
  j.댓글고유 = j.댓글고유.slice(0, 3); j.영상고유 = j.영상고유.slice(0, 2); j.광고고유 = j.광고고유.slice(0, 3);
  let 분류 = null, 후보 = [];
  try {
    후보 = await 분류찾기(j.분류낱말, false);
    // 업종 이름과 같은 마디를 가장 얕은 데서 고르고(없으면 가장 깊은 후보), 바로 아래 분류를 하위로 채운다
    const 끝 = j.분류낱말[j.분류낱말.length - 1];
    const 고른 = 후보.filter((c) => c.이름 === 끝).sort((a, b) => a.단계 - b.단계)[0] || 후보[0];
    if (고른) {
      const 나무 = await 분류나무(false);
      const 하위 = 나무.filter((c) => c.경로.startsWith(`${고른.경로} > `) && c.단계 === 고른.단계 + 1).slice(0, 8).map((c) => ({ 이름: c.이름, cid: c.cid }));
      분류 = { cid: 고른.cid, 이름: 고른.경로.split(' > ').slice(-2).join(' › '), 하위 };
    }
  } catch (e) { console.log(`분류찾기 못 함(ego): ${e.message}`); }
  const 파일이름 = o.이름 || 업종.replace(/[\s/]+/g, '_');
  const 설정 = {
    이름: 파일이름, 업종, 근거: `새업종 초안(${오늘서울()}) — 확인 전`,
    유튜브: { 검색어: j.유튜브검색어, 창일: 45, 최소조회: j.최소조회, 제외낱말: j.제외낱말, 댓글영상: 50 },
    네이버: { 성별: j.성별, 검색어묶음: j.네이버검색어묶음, 분류, 분류후보: 후보.slice(0, 8).map((c) => ({ cid: c.cid, 경로: c.경로 })) },
    메타: { 검색어: j.메타검색어, 플랫폼낱말: j.플랫폼낱말 },
    주제: { 댓글고유: j.댓글고유, 영상고유: j.영상고유, 광고고유: j.광고고유 },
    제안관점: j.제안관점,
  };
  const p = path.join(바탕폴더(), '_설정초안', `${파일이름}.json`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(설정, null, 2) + '\n');
  console.log(`설정 초안(git 밖): ${p}\n분류: ${분류 ? `${분류.이름} (${분류.cid}) — 하위 분류는 분류찾기로 채운다` : '못 정함 — 분류후보를 보고 채운다'}\n확인 뒤 tools/업종브리핑/설정/${파일이름}.json 으로 옮겨 돌린다(고객사 이름은 넣지 않는다).`);
  return p;
}

async function main() {
  const o = 인자(process.argv.slice(2));
  if (o.명령 === '돌리기') { const r = await 돌리기(o); console.log(`페이지: ${r.페이지}`); return; }
  if (o.명령 === '검사') { const r = 검사(o); console.log(r.문제.length ? `문제 ${r.문제.length}건\n- ${r.문제.join('\n- ')}` : `통과: ${r.폴더}`); if (r.문제.length) process.exitCode = 1; return; }
  if (o.명령 === '분류찾기') { for (const c of await 분류찾기(o.낱말, o.새로)) console.log(`${c.cid}\t${c.경로}`); return; }
  if (o.명령 === '새업종') { await 새업종(o); return; }
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 20).map((l) => l.replace(/^ \*\s?/, '')).join('\n'));
}

if (require.main === module) main().catch((e) => { console.error(`멈춤: ${e.message}`); process.exit(1); });

module.exports = { 인자, 설정읽기, 받는사람, 네이버일감, 네이버꼴, 나누기항목, 날짜더하기, 단계들, 검사 };
