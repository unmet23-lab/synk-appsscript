#!/usr/bin/env node
'use strict';
/* 수요 스캔(매주 월요일) — 브랜드마다 같은 시청자를 노린 짧은 영상 가운데 채널 평소보다 크게 튄 편과 그 댓글을 모은다.
 * 정본 제안: docs/마케팅/시청자수요조사_20261022.md 6-7. 쓰는 법은 같은 폴더 README.md.
 *
 *   node tools/수요스캔/스캔.js 전부                      네 브랜드(lab-en·lab-mn·synkbrief·yuhobuilds)
 *   node tools/수요스캔/스캔.js lab-en --채널 5 --검색 1   작게(시드 채널 5곳·검색어 1개)
 *   node tools/수요스캔/스캔.js --설정검사                 설정 넷만 검사(네트워크 없음)
 *
 * 읽기만 한다 — 로그인·게시·좋아요·댓글 쓰기·구독을 하지 않고 영상 파일은 받지 않는다(메타데이터·댓글 본문만).
 * 결과: <공용 작업본>/.tmp/수요스캔/<날짜>/요약.md·요약.json·댓글/<브랜드>/<영상ID>.json·원자료/<브랜드>.json·기록.jsonl(git 밖)
 * 누적: tools/수요스캔/누적/수요_<브랜드>.json(채널·편 ID·숫자·날짜만 — 회차 기획과 같은 커밋으로 올린다)
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const 판정 = require('./수요판정.js');
const 수집 = require('./수요수집.js');
const { 공용작업본 } = require('../lib/공용작업본.js');

const 여기 = __dirname;
const 저장소 = path.resolve(여기, '..', '..');
const 설정폴더 = path.join(여기, '설정');
const RSS멈춤한도 = 3;
// 설정·누적 파일 이름에 「수요_」를 붙인다 — 'synkbrief.json'처럼 다른 시험 글에 흔한 이름이면 관련 시험 고르기(tools/관련시험.js)가 상관없는 시험을 끌어온다
const 파일이름 = 브랜드 => `수요_${브랜드}.json`;

const 도움글 = `쓰는 법: node tools/수요스캔/스캔.js <lab-en|lab-mn|synkbrief|yuhobuilds|전부> [선택…]
  --채널 N     유튜브 채널을 앞에서 N곳만(시드 → 우리 → 검색으로 찾은 채널 순)
  --검색 N     이번 회차 검색어 수(설정 「회차당」 대신, 0이면 검색 안 함)
  --찾기 N     검색으로 찾은 새 채널을 이번에 몇 곳까지 읽을지(설정 「찾기상한」 대신)
  --틱톡 N     틱톡 계정을 앞에서 N곳만(0이면 안 읽음)
  --댓글 N     새 튄 편 가운데 조회 많은 N편의 댓글을 모은다(기본 ${판정.기본.댓글편수}, 0이면 안 모음)
  --댓글수 N   편마다 댓글 몇 개(기본 ${판정.기본.댓글개수})
  --우리댓글 N 우리 유튜브 계정의 창 안 최근 편 가운데 N편의 댓글을 모은다(기본 ${판정.기본.우리댓글편수}, 0이면 안 모음)
  --상세 N     영상 정보(길이·날짜·좋아요)를 읽을 편 수 상한(기본 ${판정.기본.상세상한})
  --창 N       판정 창(일, 기본 ${판정.기본.창})
  --기준선 N   쇼츠 탭(기준선·구독)을 다시 읽는 간격(일, 기본 ${판정.기본.기준선갱신일}, 0이면 매번)
  --간격 S     유튜브·틱톡 호출 사이 최소 간격(초, 기본 2.5)
  --유튜브 api|ytdlp  유튜브 채널 숫자를 읽는 길(기본 api — Data API, 안 되면 그 채널부터 쇼츠 탭·RSS로. ytdlp는 처음부터 쇼츠 탭·RSS)
  --날짜 YYYY-MM-DD  회차 날짜(기본 오늘 서울)
  --누적 <폴더>  누적 폴더(기본 tools/수요스캔/누적)
  --출력 <폴더>  결과 폴더(기본 <공용 작업본>/.tmp/수요스캔/<날짜>)
  --누적안씀   누적을 고치지 않는다(시험 돌리기)
  --설정검사   설정 넷만 검사하고 끝낸다`;

function 인자(argv) {
  const o = {
    브랜드: [], 채널: null, 검색: null, 찾기: null, 틱톡: null, 댓글: 판정.기본.댓글편수, 댓글수: 판정.기본.댓글개수, 우리댓글: 판정.기본.우리댓글편수,
    상세: 판정.기본.상세상한, 창: 판정.기본.창, 기준선: 판정.기본.기준선갱신일, 간격: 2.5, 날짜: null, 누적: null, 출력: null,
    유튜브: 'api', 누적안씀: false, 설정검사: false, 도움: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const 수 = () => {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v) || v < 0) throw new Error(`${a} 뒤에 0 이상의 수가 와야 한다`);
      return v;
    };
    const 글 = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} 뒤에 값이 와야 한다`);
      return v;
    };
    if (a === '--채널') o.채널 = Math.floor(수());
    else if (a === '--검색') o.검색 = Math.floor(수());
    else if (a === '--찾기') o.찾기 = Math.floor(수());
    else if (a === '--틱톡') o.틱톡 = Math.floor(수());
    else if (a === '--댓글') o.댓글 = Math.floor(수());
    else if (a === '--댓글수') o.댓글수 = Math.max(1, Math.min(100, Math.floor(수())));
    else if (a === '--우리댓글') o.우리댓글 = Math.floor(수());
    else if (a === '--상세') o.상세 = Math.floor(수());
    else if (a === '--창') o.창 = Math.max(1, Math.floor(수()));
    else if (a === '--기준선') o.기준선 = Math.floor(수());
    else if (a === '--간격') o.간격 = 수();
    else if (a === '--날짜') { o.날짜 = 글(); if (!/^\d{4}-\d{2}-\d{2}$/.test(o.날짜)) throw new Error('--날짜는 YYYY-MM-DD'); }
    else if (a === '--누적') o.누적 = path.resolve(글());
    else if (a === '--출력') o.출력 = path.resolve(글());
    else if (a === '--유튜브') { o.유튜브 = 글(); if (!['api', 'ytdlp'].includes(o.유튜브)) throw new Error('--유튜브는 api 또는 ytdlp'); }
    else if (a === '--누적안씀') o.누적안씀 = true;
    else if (a === '--설정검사') o.설정검사 = true;
    else if (a === '-h' || a === '--help' || a === '--도움') o.도움 = true;
    else if (a === '전부') o.브랜드.push(...판정.브랜드목록);
    else if (판정.브랜드목록.includes(a)) o.브랜드.push(a);
    else throw new Error(`모르는 인자: ${a}`);
  }
  o.브랜드 = 판정.브랜드목록.filter(b => o.브랜드.includes(b));
  return o;
}

function 설정읽기(브랜드, 폴더 = 설정폴더) {
  const 파일 = path.join(폴더, 파일이름(브랜드));
  let raw;
  try { raw = JSON.parse(fs.readFileSync(파일, 'utf8')); } catch (e) { return { 설정: null, 오류: [`${path.basename(파일)}을 못 읽었다: ${e.message}`] }; }
  return 판정.설정검사(raw, 브랜드);
}

function 누적읽기(폴더, 브랜드) {
  const 경로 = path.join(폴더, 파일이름(브랜드));
  if (!fs.existsSync(경로)) return { 누적: 판정.빈누적(브랜드), 경로, 처음: true };
  const raw = JSON.parse(fs.readFileSync(경로, 'utf8')); // 깨진 누적은 덮지 않고 멈춘다
  const { 누적, 새로 } = 판정.누적검사(raw, 브랜드);
  if (새로) throw new Error(`${경로}의 판·브랜드가 이 도구와 다르다 — 덮지 않고 멈춘다(판 ${raw?.판}, 브랜드 ${raw?.브랜드})`);
  return { 누적, 경로, 처음: false };
}

// ── 잠금(2차 검수 GB2) — 같은 누적 폴더를 두 회차가 함께 읽고 쓰면 나중에 끝난 쪽이 앞 회차의 보고 기록을 덮는다 ──
// 잠금 파일은 저장소 밖(%TEMP%)에 둔다 — 누적 폴더에 두면 끊긴 회차가 남긴 잠금이 git 변경으로 보인다.
const 잠금오래됨ms = 12 * 3600_000;

function 잠금경로(누적폴더) {
  const 열쇠 = crypto.createHash('sha1').update(path.resolve(누적폴더).toLowerCase()).digest('hex').slice(0, 16);
  return path.join(os.tmpdir(), `synk-수요스캔-${열쇠}.lock`);
}

function 살아있나(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

const 빈잠금기다림ms = 60_000;

/**
 * → {풀기()} | {막힘: 까닭}. 죽은 회차(프로세스 없음)나 12시간 넘은 잠금은 걷어 내고 잡는다.
 * 잠금은 내용을 다 쓴 임시 파일을 하드 링크로 걸어 만든다 — 만들어진 순간부터 내용이 있다(재확인 GB2: openSync('wx') 뒤 내용을 쓰기
 * 전에 다른 회차가 빈 잠금을 「깨진 것」으로 지워 둘 다 잡았다). 그래도 비었거나 못 읽는 잠금은 만든 지 1분 안이면 살아 있는 것으로 본다.
 */
function 잠그기(누적폴더) {
  const 경로 = 잠금경로(누적폴더);
  const 내용 = JSON.stringify({ pid: process.pid, 때: new Date().toISOString(), 누적: path.resolve(누적폴더) });
  const 풀기 = () => {
    try { if (JSON.parse(fs.readFileSync(경로, 'utf8')).pid === process.pid) fs.rmSync(경로, { force: true }); } catch { /* 이미 없다 */ }
  };
  for (let 번 = 0; 번 < 2; 번 += 1) {
    const 임시 = `${경로}.${process.pid}.${번}.tmp`;
    try {
      fs.writeFileSync(임시, 내용);
      try {
        fs.linkSync(임시, 경로); // 있으면 EEXIST — 없으면 내용과 함께 한 번에 생긴다
      } catch (e) {
        if (e.code === 'EEXIST') throw e;
        // 하드 링크를 못 거는 곳이면 wx로(내용 쓰기 전 틈은 아래 「갓 생긴 빈 잠금」 판단이 막는다)
        const fd = fs.openSync(경로, 'wx');
        try { fs.writeSync(fd, 내용); } finally { fs.closeSync(fd); }
      }
      return { 풀기 };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let 남 = null;
      let 만든ms = null;
      try { 만든ms = fs.statSync(경로).mtimeMs; } catch { /* 그사이 풀렸다 */ }
      try { 남 = JSON.parse(fs.readFileSync(경로, 'utf8')); } catch { /* 비었거나 깨졌다 */ }
      if (!남 && 만든ms !== null && Date.now() - 만든ms < 빈잠금기다림ms) return { 막힘: '다른 회차가 잠금을 막 잡는 중이다 — 끝난 뒤 다시 돌린다' };
      if (남 && 살아있나(남.pid) && Date.now() - Date.parse(남.때) < 잠금오래됨ms) return { 막힘: `다른 수요 스캔이 같은 누적을 쓰고 있다(pid ${남.pid}, ${남.때}) — 끝난 뒤 다시 돌린다` };
      fs.rmSync(경로, { force: true }); // 죽은 회차·오래된 잠금·1분 넘게 빈 잠금
    } finally {
      fs.rmSync(임시, { force: true });
    }
  }
  return { 막힘: '잠금을 잡지 못했다' };
}

function 파일쓰기(경로, 글) {
  fs.mkdirSync(path.dirname(경로), { recursive: true });
  const 임시 = `${경로}.${process.pid}.tmp`;
  fs.writeFileSync(임시, 글, 'utf8');
  fs.renameSync(임시, 경로);
}

const 까닭글 = r => {
  const 말 = { 막힘: '막힘(403·429·봇 확인)', 없음: '없음·비공개', 실패: '실패', 멈춤: '이번 회차 멈춤(연달아 막힘)' }[r?.상태] || '못 읽음';
  return r?.오류 ? `${말} — ${r.오류}` : 말;
};

const 숫자인가 = v => typeof v === 'number' && Number.isFinite(v);
const 표시이름 = c => c.이름 || c.핸들 || c.id;
const 이름없음 = c => !c.이름 || c.이름 === c.핸들 || c.이름 === c.id;
const 일부글 = r => `일부만 읽음${r.막힘 ? '(막힘)' : ''} — ${r.오류 || '오류로 끝남'}`;

function 규칙글() {
  const p = 판정.기본.판정;
  const t = 판정.기본.틱톡판정;
  return `그 채널 최근 쇼츠 ${p.기준편수}편 조회 중앙값의 ${p.배수}배 이상(브랜드별 최소 조회 이상) · 작은 채널(구독 ${판정.짧은수(p.작은채널구독상한)} 이하)은 조회 ≥ 구독 · 쇼츠가 ${p.최소편수}편 안 되면 평소를 못 재 판정하지 않는다. 틱톡은 최근 ${t.기준편수}편 중앙값의 ${t.배수}배 이상(구독 수를 못 읽어 작은 채널 규칙 없음). 창 안(올린 지 ${판정.기본.창}일 안)이고 지난 회차까지 보고하지 않은 편만 「새 튄 편」이다.`;
}

/** 브랜드 하나를 돈다 → {요약, 원자료} (누적은 그 자리에서 고친다)
 *  api(수집.API부르개)를 주면 유튜브 채널은 Data API로 먼저 읽고, 못 읽은 채널만 쇼츠 탭·RSS(yt-dlp)로 읽는다. */
async function 브랜드스캔({ 설정, 누적, o, 부르개, api = null, 캐시, 오늘, 출력, 남의채널 = new Set() }) {
  const 판 = 설정.판정;
  const 창시작 = 판정.날짜빼기(오늘, o.창);
  const 지난스캔 = 누적.마지막스캔;
  const 튄편 = 누적.튄편;
  const 못잼 = [];
  const 우리 = [];
  const 유튜브후보 = [];
  const 원자료 = { 채널: [], 검색: [], 틱톡: [] };
  const 표본 = {
    유튜브: { 대상: 0, 읽음: 0, 탭: 0, rss: 0, api: 0, 지난기준선: 0, 편: 0, 창안: 0 },
    틱톡: { 대상: 0, 읽음: 0, 편: 0 },
    검색: { 어: [], 결과: 0, 쇼츠: 0, 새채널: 0 },
    상세: { 시도: 0, 됨: 0, api: 0 }, 댓글: { 편: 0, 개: 0 },
  };
  const API쓰기 = () => Boolean(api) && !api.셈.멈춤;
  // Data API로 읽은 편의 상세(길이·좋아요·댓글 수·정확한 조회) — 4·5단계가 yt-dlp를 부르지 않게. 회차 하나에 하나(브랜드를 건너서 쓴다)
  const api상세 = 캐시.api상세 || (캐시.api상세 = new Map());

  const 핸들로id = 핸들 => {
    if (!핸들) return null;
    const 낮춤 = 핸들.toLowerCase();
    const 찾음 = Object.entries(누적.채널).find(([, v]) => String(v.핸들 || '').toLowerCase() === 낮춤);
    return 찾음 ? 찾음[0] : null;
  };
  const 이번읽은 = new Set(); // 이번 회차에 읽은 채널 ID
  const 시드핸들 = new Set(설정.유튜브.map(c => c.핸들 && c.핸들.toLowerCase()).filter(Boolean));
  const 시드인가 = id => 설정.유튜브.some(c => c.id === id) || (누적.채널[id]?.핸들 && 시드핸들.has(String(누적.채널[id].핸들).toLowerCase()));

  async function 읽기탭(c, id) {
    const 열쇠 = `탭:${id || String(c.핸들).toLowerCase()}`;
    if (캐시.has(열쇠)) return 캐시.get(열쇠);
    const r = await 부르개.yt('탭', { id, 핸들: c.핸들, 수: 판.기준편수 });
    let 결과;
    if ((r.상태 === '됨' || r.상태 === '일부') && r.줄들[0]) {
      const 탭 = 수집.탭읽기(r.줄들[0]);
      // 「일부」(JSON은 왔는데 오류로 끝남)는 쓰되 요약에 남긴다(2차 검수 GB3)
      결과 = 탭 ? { 탭, 일부: r.상태 === '일부' ? 일부글(r) : null } : { 상태: '실패', 오류: '쇼츠 탭 응답을 못 읽음' };
    } else 결과 = { 상태: r.상태, 오류: r.오류 };
    캐시.set(열쇠, 결과);
    if (결과.탭?.채널id) 캐시.set(`탭:${결과.탭.채널id}`, 결과);
    return 결과;
  }

  async function 읽기rss(id, 지난갈래) {
    const 열쇠 = `rss:${id}`;
    if (캐시.has(열쇠)) return 캐시.get(열쇠);
    // RSS가 채널 셋을 연달아 다 실패하면(10-23 실측: 40번쯤 부른 뒤 404·500만 왔다) 이번 회차 남은 채널은 쇼츠 탭으로만 읽는다.
    // 브랜드를 건너서 센다(캐시가 회차 하나에 하나).
    if ((캐시.rss연속실패 || 0) >= RSS멈춤한도) {
      표본.유튜브.rss멈춤 = true;
      return { 상태: '멈춤', 오류: 'RSS가 채널 셋을 연달아 실패해 이번 회차에서는 쇼츠 탭으로 읽는다' };
    }
    let 결과 = { 상태: '실패', 오류: '' };
    // 10-23 실측: 같은 채널의 쇼츠 RSS가 한 회차에는 되고 다음 회차에는 404, 채널 RSS가 500·404를 번갈아 냈다(있는 채널인데도).
    // 그래서 404도 「없음」으로 굳히지 않는다 — 지난번에 된 갈래부터, 다른 갈래, 3초 쉬고 처음 갈래 한 번 더(많아야 세 번).
    const 처음 = 지난갈래 === '채널' ? '채널' : '쇼츠';
    const 차례들 = [처음, 처음 === '쇼츠' ? '채널' : '쇼츠', 처음];
    for (const [i, 갈래] of 차례들.entries()) {
      if (i === 2 && typeof 부르개.쉬기 === 'function') await 부르개.쉬기(3000);
      const r = await 부르개.rss(수집.rss주소(id, 갈래));
      if (r.상태 === '됨') { 결과 = { rss: 수집.rss읽기(r.글), 갈래 }; break; }
      결과 = { 상태: r.상태, 오류: r.오류 };
      if (r.상태 === '막힘' || r.상태 === '멈춤') break;
    }
    캐시.rss연속실패 = 결과.rss ? 0 : (캐시.rss연속실패 || 0) + 1;
    캐시.set(열쇠, 결과);
    return 결과;
  }

  // 유튜브 채널을 Data API로(10-25) — 쇼츠 목록 30편 + 그 편들의 정확한 숫자(50편 한 번) + 구독. 쇼츠 탭·RSS 둘을 대신해서
  // 탭 꼴(기준선·구독)과 RSS 꼴(정확한 조회·올린 날)을 같이 돌려준다 — 판정(채널정리)은 그대로 쓴다. 못 읽으면 {상태, 오류}.
  async function 읽기api(c, id) {
    const 열쇠 = `api:${id || String(c.핸들).toLowerCase()}`;
    if (캐시.has(열쇠)) return 캐시.get(열쇠);
    let 결과 = null;
    let 채널 = null;
    if (id) {
      채널 = (await api.채널들([id])).get(id) || null;
    } else {
      const r = await api.핸들채널(c.핸들);
      if (r.상태 === '됨') { 채널 = r.채널; id = 채널.채널id; } else 결과 = { 상태: r.상태, 오류: r.오류 };
    }
    if (!결과) {
      const 목록 = await api.쇼츠목록(id, 판.기준편수);
      if (목록.상태 !== '됨') 결과 = { 상태: 목록.상태, 오류: 목록.오류 };
      else {
        const 받음 = await api.영상들(목록.ids);
        const 편 = 목록.ids.map(v => 받음.상세.get(v)).filter(Boolean);
        if (받음.상태 !== '됨' && !편.length) 결과 = { 상태: 받음.상태, 오류: 받음.오류 };
        else {
          for (const d of 편) api상세.set(d.id, { ...d, 핸들: 채널?.핸들 || null, 구독: 채널?.구독 ?? null });
          const 채널이름 = 채널?.채널이름 || 편[0]?.채널이름 || '';
          결과 = {
            탭: { 채널id: id, 채널이름, 핸들: 채널?.핸들 || null, 구독: 채널?.구독 ?? null, 편: 편.map(d => ({ id: d.id, 제목: d.제목, 조회: d.조회 })) },
            rss: { 채널id: id, 채널이름, 전체수: 편.length, 편: 편.map(d => ({ id: d.id, 제목: d.제목, 날짜: d.올린때, 쇼츠: true, 조회: d.조회 })) },
            일부: 받음.상태 === '됨' ? null : `일부만 읽음 — 영상 숫자 ${편.length}/${목록.ids.length}편(${받음.오류})`,
          };
        }
      }
    }
    캐시.set(열쇠, 결과);
    if (결과.탭?.채널id) 캐시.set(`api:${결과.탭.채널id}`, 결과);
    return 결과;
  }

  async function 채널하나(c) {
    표본.유튜브.대상 += 1;
    let id = c.id || 핸들로id(c.핸들);
    if (id && 이번읽은.has(id)) { 표본.유튜브.대상 -= 1; return; }
    const 이전 = id ? 누적.채널[id] : undefined;
    let 탭 = null;
    let 이름 = 표시이름(c);
    let 탭실패 = null;
    let 탭일부 = null;
    // Data API로 읽히면 쇼츠 탭·RSS를 부르지 않는다. 목록이 없거나(404) 실패·멈춤이면 이 채널은 아래 yt-dlp 길로
    const 바로 = API쓰기() ? await 읽기api(c, id) : null;
    if (바로?.탭) {
      탭 = 바로.탭;
      탭일부 = 바로.일부;
      id = id || 바로.탭.채널id;
      표본.유튜브.api += 1;
    }
    const 탭필요 = !바로?.탭 && (!id || 판정.탭다시읽기(이전, 오늘, o.기준선));
    if (탭필요) {
      const r = await 읽기탭(c, id);
      if (r.탭) {
        탭 = r.탭;
        탭일부 = r.일부;
        id = id || r.탭.채널id;
        표본.유튜브.탭 += 1;
      } else if (r.상태 === '없음') {
        못잼.push({ 곳: '유튜브', 계정: 이름, 까닭: `쇼츠 탭 없음 — ${r.오류 || '쇼츠를 안 올리는 채널'}` });
        // 기준선 갱신일 동안은 다시 묻지 않게 「쇼츠 0편」으로 적어 둔다
        if (id) 누적.채널[id] = { ...(이전 || {}), 핸들: 이전?.핸들 || c.핸들 || undefined, 편수: 0, 중앙값: null, 기준선잰날: 오늘, 편: 이전?.편 || {}, 막힘: `${오늘} 쇼츠 탭 없음` };
        return;
      } else 탭실패 = r;
    }
    if (!id) { 못잼.push({ 곳: '유튜브', 계정: 이름, 까닭: `채널을 못 찾음 — ${까닭글(탭실패)}` }); return; }
    // 핸들로 늦게 알게 된 ID까지, 한 회차에 한 채널은 한 번만(2차 검수 B2 — 핸들 시드와 찾은 채널이 같은 채널이면 두 번 셌다)
    if (이번읽은.has(id)) { 표본.유튜브.대상 -= 1; return; }
    이번읽은.add(id);
    const 지금이전 = 누적.채널[id] || 이전;
    const rr = 바로?.탭 ? { rss: 바로.rss } : await 읽기rss(id, 지금이전?.rss);
    const rss = rr.rss || null;
    if (rss && !바로?.탭) 표본.유튜브.rss += 1;
    if (!rss && !탭 && !탭필요) {
      // 탭을 안 읽는 주에 RSS가 막히면 쇼츠 탭을 읽는다(조회는 지금 것, 날짜는 누적에서)
      const r = await 읽기탭(c, id);
      if (r.탭) { 탭 = r.탭; 탭일부 = r.일부; 표본.유튜브.탭 += 1; } else 탭실패 = r;
    }
    // 이름은 설정에 없으면 이번에 읽은 쇼츠 탭이나 RSS 머리에서(2차 검수 B3 — 찾은 채널이 탭을 안 읽는 주에 ID로만 보였다)
    if (이름없음(c)) 이름 = 탭?.채널이름 || rss?.채널이름 || 이름;
    if (탭일부) 못잼.push({ 곳: '유튜브', 계정: 이름, 까닭: `${바로?.탭 ? 'Data API' : '쇼츠 탭'} ${탭일부}` });
    if (!탭 && !rss) {
      못잼.push({ 곳: '유튜브', 계정: 이름, 까닭: `쇼츠 탭·RSS 둘 다 못 읽음 — 탭 ${탭실패 ? 까닭글(탭실패) : '(이번엔 안 읽음)'} · RSS ${까닭글(rr)}` });
      if (지금이전) 누적.채널[id] = { ...지금이전, 막힘: `${오늘} ${rr.상태 || '실패'}` };
      return;
    }
    const 결과 = 판정.채널정리({ 이전: 지금이전, 탭, rss, 튄편, 오늘, 판정: 판, 창: o.창, 보관일: o.창 + 판정.기본.여유 });
    const 상태 = 결과.상태;
    if (rr.갈래) 상태.rss = rr.갈래;
    if (!상태.핸들 && c.핸들) 상태.핸들 = c.핸들;
    delete 상태.막힘;
    if (탭실패) 상태.막힘 = `${오늘} 쇼츠 탭 ${탭실패.상태}`;
    누적.채널[id] = 상태;
    표본.유튜브.읽음 += 1;
    표본.유튜브.편 += 결과.본편;
    표본.유튜브.창안 += 결과.창안;
    if (결과.기준 && 결과.기준.출처 !== '이번') 표본.유튜브.지난기준선 += 1;
    원자료.채널.push({ id, 이름, 핸들: 상태.핸들 || null, 구독: 결과.기준?.구독 ?? null, 기준: 결과.기준, 찾은길: c.찾은길,
      편: [...(탭?.편 || []).map(p => ({ id: p.id, 제목: p.제목, 조회: p.조회, 날짜: 상태.편?.[p.id] || null })),
        ...(rss?.편 || []).filter(p => p.쇼츠 !== false && !(탭?.편 || []).some(t => t.id === p.id)).map(p => ({ id: p.id, 제목: p.제목, 조회: p.조회, 날짜: (p.날짜 || '').slice(0, 10) }))] });
    if (!결과.기준 || !(결과.기준.편수 >= 판.최소편수) || 결과.기준.중앙값 === null) {
      못잼.push({ 곳: '유튜브', 계정: 이름, 까닭: 결과.기준 ? `쇼츠 ${결과.기준.편수}편뿐 — 평소(중앙값)를 못 잼` : `기준선 없음 — 쇼츠 탭 ${까닭글(탭실패)}` });
      if (!c.우리) return;
    }
    if (c.우리) {
      우리.push(판정.우리줄('유튜브', 상태.핸들 || 이름, 결과.기준, 결과.창안편));
      return;
    }
    // 찾은 채널의 마지막튐은 여기(후보)가 아니라 영상 정보로 확인해 실제로 실은 때 적는다(재확인 B4)
    for (const h of 결과.후보) 유튜브후보.push({ ...h, 채널: 이름, 채널id: id, 핸들: 상태.핸들 || c.핸들 || null, 기준: 결과.기준, 찾은길: c.찾은길 });
  }

  // 1) 유튜브 시드·우리·지난 회차에 찾은 채널
  let 대상 = 설정.유튜브.map(c => ({ ...c, 찾은길: c.우리 ? '우리' : '시드' }));
  대상.sort((a, b) => Number(a.우리) - Number(b.우리));
  for (const [id, f] of Object.entries(누적.찾은채널)) {
    // 실은 시드 채널(핸들만 적은 시드가 검색으로 먼저 잡힌 것)이면 찾은 채널에서 뺀다 — 시드 쪽에서 읽는다(2차 검수 B2)
    if (시드인가(id)) { delete 누적.찾은채널[id]; continue; }
    // 짝 브랜드의 시드 · 찾은 채널이면 뺀다 — 두 브랜드가 같은 채널의 튄 편을 근거로 쓰지 않게(10-28)
    if (남의채널.has(id)) { delete 누적.찾은채널[id]; continue; }
    대상.push({ id, 핸들: 누적.채널[id]?.핸들 || null, 이름: null, 우리: false, 찾은길: `검색으로 찾음(${f.찾은날})` });
  }
  if (o.채널 !== null) 대상 = 대상.slice(0, o.채널);
  // ID를 아는 채널의 이름·핸들·구독은 50곳에 한 번(1단위)으로 미리 — 채널마다 따로 부르지 않게
  if (API쓰기()) await api.채널들(대상.map(c => c.id || 핸들로id(c.핸들)).filter(Boolean));
  for (const c of 대상) await 채널하나(c);

  // 2) 검색 — 아직 모르는 채널 가운데 쇼츠가 하한 넘게 나온 채널을 몇 곳 더 읽는다
  const 검색수 = o.검색 === null ? 설정.검색.회차당 : o.검색;
  const { 이번 } = 판정.검색차례(설정.검색.어, 누적.검색차례, 검색수);
  const 검색결과 = [];
  let 돈수 = 0;
  let 끊김 = false;
  for (const q of 이번) {
    const 글 = 판정.검색글(q, 설정.검색.붙임);
    const r = await 부르개.yt('검색', { 어: 글, 필터: 설정.검색.필터, 수: 설정.검색.결과수 });
    표본.검색.어.push(q);
    if (r.상태 === '됨' || r.상태 === '일부') {
      if (!끊김) 돈수 += 1;
      const 줄 = 수집.검색읽기(r.줄들);
      표본.검색.결과 += 줄.length;
      표본.검색.쇼츠 += 줄.filter(x => x.길이 !== null && x.길이 <= 180).length;
      for (const x of 줄) 검색결과.push({ ...x, 검색어: q });
      원자료.검색.push({ 어: q, 보낸글: 글, 결과: 줄 });
      if (r.상태 === '일부') 못잼.push({ 곳: '유튜브 검색', 계정: `「${q}」`, 까닭: 일부글(r) });
    } else {
      끊김 = true;
      원자료.검색.push({ 어: q, 보낸글: 글, 결과: [], 상태: r.상태 });
      못잼.push({ 곳: '유튜브 검색', 계정: `「${q}」`, 까닭: 까닭글(r) });
    }
  }
  // 검색 차례는 앞에서부터 실제로 돈 만큼만 넘긴다 — 막힌 검색어는 다음 회차에 그것부터(2차 검수 B1)
  누적.검색차례 = 판정.검색차례(설정.검색.어, 누적.검색차례, 돈수).다음차례;
  const 아는채널 = new Set([...설정.유튜브.map(c => c.id || 핸들로id(c.핸들)).filter(Boolean), ...Object.keys(누적.채널), ...Object.keys(누적.찾은채널), ...남의채널]);
  const 찾기 = { ...설정.검색, 찾기상한: o.찾기 === null ? 설정.검색.찾기상한 : o.찾기 };
  for (const n of 판정.새채널고르기(검색결과, 아는채널, 찾기, 판)) {
    표본.검색.새채널 += 1;
    누적.찾은채널[n.채널id] = { 찾은날: 오늘, 마지막튐: null };
    await 채널하나({ id: n.채널id, 핸들: null, 이름: n.채널이름 || null, 우리: false, 찾은길: `검색 「${n.검색어}」` });
    // 읽고 보니 핸들이 시드와 같으면(핸들만 적은 시드의 ID를 아직 몰랐다) 찾은 채널이 아니다
    if (시드인가(n.채널id)) { delete 누적.찾은채널[n.채널id]; 표본.검색.새채널 -= 1; }
  }
  // 찾은 채널 상한 정리는 맨 끝에서(실제로 실은 편으로 마지막튐을 적은 뒤)

  // 3) 틱톡 고정 목록(공개 프로필)
  const 틱톡후보 = [];
  const 틱톡대상 = o.틱톡 === null ? 설정.틱톡 : 설정.틱톡.slice(0, o.틱톡);
  for (const t of 틱톡대상) {
    표본.틱톡.대상 += 1;
    const 열쇠 = `틱톡:${t.핸들.toLowerCase()}`;
    let r = 캐시.get(열쇠);
    if (!r) {
      const 받음 = await 부르개.yt('틱톡', { 핸들: t.핸들, 수: 35 });
      r = (받음.상태 === '됨' || 받음.상태 === '일부')
        ? { 목록: 수집.틱톡읽기(받음.줄들), 일부: 받음.상태 === '일부' ? 일부글(받음) : null }
        : { 상태: 받음.상태, 오류: 받음.오류 };
      캐시.set(열쇠, r);
    }
    if (!r.목록 || !r.목록.length) { 못잼.push({ 곳: '틱톡', 계정: `@${t.핸들}`, 까닭: r.목록 ? '공개 영상 없음' : 까닭글(r) }); continue; }
    if (r.일부) 못잼.push({ 곳: '틱톡', 계정: `@${t.핸들}`, 까닭: `공개 프로필 ${r.일부}` });
    const 결과 = 판정.틱톡정리({ 이전: 누적.틱톡[t.핸들], 목록: r.목록, 튄편, 오늘, 판정: 설정.틱톡판정, 창: o.창, 보관일: o.창 + 판정.기본.여유 });
    누적.틱톡[t.핸들] = 결과.상태;
    표본.틱톡.읽음 += 1;
    표본.틱톡.편 += 결과.본편;
    원자료.틱톡.push({ 핸들: t.핸들, 기준: 결과.기준, 편: r.목록 });
    if (결과.기준.중앙값 === null) 못잼.push({ 곳: '틱톡', 계정: `@${t.핸들}`, 까닭: `공개 영상 ${결과.기준.편수}편뿐 — 평소를 못 잼` });
    if (t.우리) {
      우리.push(판정.우리줄('틱톡', `@${t.핸들}`, 결과.기준, 결과.창안편));
      continue;
    }
    for (const h of 결과.후보) {
      const 줄 = { 곳: '틱톡', id: h.id, 주소: `https://www.tiktok.com/@${t.핸들}/video/${h.id}`, 채널: `@${t.핸들}`, 채널id: null, 핸들: `@${t.핸들}`,
        구독: null, 중앙값: 결과.기준.중앙값, 기준편수: 결과.기준.편수, 기준출처: '이번', 조회: h.조회, 배수: h.배수, 규칙: h.규칙,
        날짜: h.날짜, 길이: h.길이, 좋아요: h.좋아요, 댓글수: h.댓글수, 저장: h.저장, 공유: h.공유, 제목: h.제목, 찾은길: '고정 목록' };
      줄.인용 = 판정.인용글(줄);
      틱톡후보.push(줄);
    }
  }

  // 4) 유튜브 새 후보의 영상 정보(길이·날짜·좋아요)와 댓글 — 조회 많은 순으로, 상한까지.
  //    지난 회차에 날짜를 몰라 근거에서 뺀 편(다시볼)도 쇼츠 탭을 안 읽는 주에 잃지 않게 후보로 다시 넣는다.
  const 후보id = new Set(유튜브후보.map(h => h.id));
  for (const h of 판정.다시볼후보(누적.다시볼, 누적.채널, 튄편, 판, 창시작)) {
    if (후보id.has(h.id)) continue;
    후보id.add(h.id);
    유튜브후보.push({ ...h, 채널: h.핸들 || h.채널id, 찾은길: '지난 회차에 날짜를 확인 못 함' });
  }
  유튜브후보.sort((a, b) => (b.조회 || 0) - (a.조회 || 0) || a.id.localeCompare(b.id));
  // API로 읽은 채널의 편은 상세가 이미 있다 — 다시볼·지난 보충처럼 이번에 목록에 없던 편만 50편 묶음으로 한 번에(1단위)
  if (API쓰기()) {
    const 모자람 = [...유튜브후보.map(h => h.id), ...판정.보충후보(튄편, 누적.채널, 창시작).map(h => h.id)].filter(v => !api상세.has(v));
    if (모자람.length) for (const [v, d] of (await api.영상들(모자람)).상세) api상세.set(v, d);
  }
  // 상세 상한(--상세)은 yt-dlp로 읽는 편에만 건다 — API 상세는 공짜에 가깝다
  let 상세남음 = o.상세;
  let 댓글남음 = o.댓글;

  /** 영상 하나 → {상세, 댓글:{목록, 전체}|null, 일부, api} | {실패} — API 상세가 있으면 그것을 쓰고 댓글 본문만 yt-dlp로.
   *  없으면 yt-dlp로 클라이언트를 바꿔 가며, 막히면 바로 그친다 */
  async function 영상받기(id, 댓글수) {
    const 미리 = api상세.get(id);
    if (미리) {
      if (!(댓글수 > 0)) return { 상세: { ...미리 }, 댓글: null, 일부: null, api: true };
      // 숫자·길이·전체 댓글 수는 API 값 그대로 — 쓴 사람 칸은 댓글줄이기가 버린다. 댓글을 못 받으면 부르는 쪽이 「댓글을 못 받음」으로 적는다
      const r = await 부르개.yt('영상', { id, 댓글수, 시도: 0 });
      const 받은 = (r.상태 === '됨' || r.상태 === '일부') && r.줄들[0] ? r.줄들[0] : null;
      const 댓글 = 받은 ? { 목록: 판정.댓글줄이기(받은.comments, 댓글수), 전체: 숫자인가(미리.댓글수) ? 미리.댓글수 : 수집.댓글총수(r.오류글) } : null;
      return { 상세: { ...미리 }, 댓글, 일부: null, api: true };
    }
    let 마지막 = null;
    for (let 시도 = 0; 시도 < 수집.영상시도.length; 시도 += 1) {
      const r = await 부르개.yt('영상', { id, 댓글수, 시도 });
      if ((r.상태 === '됨' || r.상태 === '일부') && r.줄들[0]) {
        const 상세 = 수집.영상읽기(r.줄들[0]);
        let 댓글 = null;
        if (댓글수 > 0) {
          // 댓글을 받은 호출의 comment_count는 받은 개수라 쓰지 않는다 — 전체 수는 --verbose 출력에서
          상세.댓글수 = 수집.댓글총수(r.오류글);
          댓글 = { 목록: 판정.댓글줄이기(r.줄들[0].comments, 댓글수), 전체: 상세.댓글수 };
        }
        return { 상세, 댓글, 일부: r.상태 === '일부' ? 일부글(r) : null };
      }
      마지막 = r;
      if (r.상태 === '막힘' || r.상태 === '없음' || r.상태 === '멈춤') break;
    }
    return { 실패: 마지막 };
  }

  const 새튄편 = [];
  const 날짜모름 = [];
  for (const h of 유튜브후보) {
    let 받음 = null;
    // 댓글은 창 안이고 조회가 정확한 수로 확정된 편에만 같이 부른다 — 날짜 모르는 옛 히트·반올림 조회 편은 영상 정보부터(재확인 B3)
    const 확정 = Boolean(h.날짜) && h.정확 === true;
    let 댓글물음 = false;
    const api있음 = api상세.has(h.id);
    if (api있음 || 상세남음 > 0) {
      if (!api있음) 상세남음 -= 1;
      표본.상세.시도 += 1;
      댓글물음 = 확정 && 댓글남음 > 0;
      받음 = await 영상받기(h.id, 댓글물음 ? o.댓글수 : 0);
      if (받음.상세) 표본.상세.됨 += 1;
      if (받음.api) 표본.상세.api += 1;
    }
    const 상세 = 받음?.상세 || null;
    const 반영 = 판정.상세반영(h, 상세, h.기준, 판, 창시작);
    const 칸 = 누적.채널[h.채널id];
    if (반영.밖 || 반영.아님) {
      if (칸 && 반영.날짜) 칸.편 = { ...(칸.편 || {}), [h.id]: 반영.날짜 };
      continue;
    }
    let 댓글 = 받음?.댓글 || null;
    if (상세 && !댓글물음 && 댓글남음 > 0 && 반영.줄.날짜) {
      // 확정 안 된 채로 영상 정보를 읽은 편이 창 안 튄 편으로 드러났다 — 댓글은 그때 따로 부른다
      const 둘 = await 영상받기(h.id, o.댓글수);
      if (둘.댓글) 댓글 = { ...둘.댓글, 전체: 숫자인가(상세.댓글수) ? 상세.댓글수 : 둘.댓글.전체 };
      댓글물음 = true;
    }
    const 줄 = { 곳: '유튜브', ...반영.줄, 주소: `https://www.youtube.com/shorts/${h.id}`, 채널: 상세?.채널이름 || h.채널, 채널id: h.채널id, 핸들: h.핸들,
      중앙값: h.기준?.중앙값 ?? null, 기준편수: h.기준?.편수 ?? null, 기준출처: h.기준?.출처 || null, 찾은길: h.찾은길,
      상세: 상세 ? (받음.일부 ? '일부' : '됨') : (받음?.실패 ? '못 잼' : '상한') };
    if (받음?.일부) {
      줄.확인 = `영상 정보 ${받음.일부}`;
      못잼.push({ 곳: '유튜브 영상', 계정: h.id, 까닭: 줄.확인 });
    }
    if (!줄.날짜) {
      날짜모름.push({ ...줄, 까닭: 상세 ? '영상 정보에 날짜가 없다' : (받음?.실패 ? `영상 정보 못 읽음 — ${까닭글(받음.실패)}` : '영상 정보 상한(--상세)을 넘었다') });
      continue;
    }
    if (칸) 칸.편 = { ...(칸.편 || {}), [h.id]: 줄.날짜 };
    if (!상세) 줄.확인 = 받음?.실패 ? `영상 정보 못 읽음 — ${까닭글(받음.실패)} — 다음 회차에 길이를 읽어 보충에 적는다` : '영상 정보 상한(--상세)을 넘어 길이·좋아요를 안 읽음 — 다음 회차에 보충에 적는다';
    else if (!숫자인가(줄.길이)) 줄.확인 = [줄.확인, '영상 정보에 길이가 없다 — 다음 회차에 다시 읽는다'].filter(Boolean).join(' · ');
    if (댓글 && 댓글.목록.length) {
      댓글남음 -= 1;
      const 파일 = path.join(출력, '댓글', 설정.브랜드, `${h.id}.json`);
      파일쓰기(파일, JSON.stringify({ id: h.id, 제목: 줄.제목, 채널: 줄.채널, 조회: 줄.조회, 댓글수: 댓글.전체, 읽은수: 댓글.목록.length,
        읽은때: new Date().toISOString(), 모은법: '좋아요 많은 순(고정 댓글 먼저) · 답글 빼고 · 본문만(쓴 사람 이름·아이디 없음)', 댓글: 댓글.목록 }, null, 1) + '\n');
      줄.댓글 = { 파일: path.relative(출력, 파일).split(path.sep).join('/'), 읽은수: 댓글.목록.length, 위: 댓글.목록.slice(0, 3) };
      표본.댓글.편 += 1;
      표본.댓글.개 += 댓글.목록.length;
    } else if (댓글물음) {
      // 댓글 0개(막힘·닫힘)면 몫을 깎지 않고 빈 파일도 만들지 않는다 — 뒤 편이 그 몫을 쓴다(재확인 B3)
      줄.확인 = [줄.확인, '댓글을 못 받음(0개)'].filter(Boolean).join(' · ');
    }
    줄.인용 = 판정.인용글(줄);
    새튄편.push(줄);
    // 날짜가 확정된 편은 실은 때 「보고한 편」으로 적는다 — 영상 정보만 실패해도 다음 회차에 새 튄 편으로 또 내지 않는다(재확인 B2②).
    // 길이가 없으면 「보충」을 달아 다음 회차에 마저 읽는다(재확인 GB3 — 날짜·길이가 다 있어야 다 본 편이다).
    튄편[h.id] = { 곳: '유튜브', 채널: h.채널id, 날짜: 줄.날짜, 조회: 줄.조회, 배수: 줄.배수, 규칙: 줄.규칙, 잡은날: 오늘,
      ...(숫자인가(줄.길이) ? { 길이: 줄.길이 } : { 보충: true }) };
    if (누적.찾은채널[h.채널id]) 누적.찾은채널[h.채널id].마지막튐 = 오늘; // 실제로 실은 편이 있을 때만(재확인 B4)
  }

  // 4-2) 우리 편 댓글(10-28) — 우리 유튜브 계정의 창 안 최근 편 댓글을 모은다. 기획 근거 A(우리 숫자 · 댓글에 적힌 까닭)의 재료다
  //      (10-23 뒤로 우리 편 댓글 파일이 없어 기획이 남의 튄 편에만 기댔다). 숫자로 댓글 0인 편은 부르지 않는다
  for (const u of 우리.filter(x => x.곳 === '유튜브')) {
    let 남음 = o.우리댓글;
    for (const p of u.편 || []) {
      if (남음 <= 0) break;
      const 미리 = api상세.get(p.id);
      if (미리 && 숫자인가(미리.댓글수) && 미리.댓글수 === 0) continue;
      남음 -= 1;
      const 받음 = await 영상받기(p.id, o.댓글수);
      const 목록 = 받음.댓글?.목록 || [];
      if (!목록.length) {
        if (받음.실패 || (미리 && 미리.댓글수 > 0)) 못잼.push({ 곳: '유튜브 우리 편 댓글', 계정: p.id, 까닭: 받음.실패 ? 까닭글(받음.실패) : '댓글을 못 받음' });
        continue;
      }
      const 파일 = path.join(출력, '댓글', 설정.브랜드, `우리_${p.id}.json`);
      파일쓰기(파일, JSON.stringify({ id: p.id, 제목: 받음.상세?.제목 || null, 채널: u.계정, 조회: p.조회, 댓글수: 받음.댓글.전체, 읽은수: 목록.length,
        읽은때: new Date().toISOString(), 모은법: '우리 편 · 좋아요 많은 순(고정 댓글 먼저) · 답글 빼고 · 본문만(쓴 사람 이름·아이디 없음)', 댓글: 목록 }, null, 1) + '\n');
      (u.댓글 || (u.댓글 = [])).push({ id: p.id, 파일: path.relative(출력, 파일).split(path.sep).join('/'), 댓글수: 받음.댓글.전체, 읽은수: 목록.length, 위: 목록.slice(0, 3) });
      표본.댓글.편 += 1;
      표본.댓글.개 += 목록.length;
    }
  }

  // 5) 보충 — 앞 회차에 길이 없이 실은 편의 영상 정보를 마저 읽는다(새 튄 편으로 다시 싣지 않는다). API 상세가 있는 편은 모두,
  //    yt-dlp로 읽을 편은 상한이 남는 만큼
  const 보충 = [];
  for (const h of 판정.보충후보(튄편, 누적.채널, 창시작)) {
    const api있음 = api상세.has(h.id);
    if (!api있음 && 상세남음 <= 0) continue;
    if (!api있음) 상세남음 -= 1;
    표본.상세.시도 += 1;
    const 받음 = await 영상받기(h.id, 0);
    if (!받음.상세) continue; // 다음 회차에 다시
    표본.상세.됨 += 1;
    if (받음.api) 표본.상세.api += 1;
    const 칸튄 = 튄편[h.id];
    const 반영 = 판정.상세반영(h, 받음.상세, h.기준, 판, 창시작);
    const 이름 = 받음.상세.채널이름 || h.핸들 || h.채널id;
    if (반영.밖 || 반영.아님) {
      delete 칸튄.보충;
      보충.push({ id: h.id, 채널: 이름, 보고한날: h.보고한날, 고침: 반영.밖 ? `올린 날 ${반영.날짜} — 창 밖` : (반영.까닭 || '튄 편이 아니다') });
      continue;
    }
    if (!숫자인가(반영.줄.길이)) continue; // 아직 길이가 없다 — 다음 회차에
    Object.assign(칸튄, { 길이: 반영.줄.길이, 조회: 반영.줄.조회, 배수: 반영.줄.배수 });
    delete 칸튄.보충;
    const 줄 = { 곳: '유튜브', ...반영.줄, 주소: `https://www.youtube.com/shorts/${h.id}`, 채널: 이름, 채널id: h.채널id, 핸들: h.핸들, 보고한날: h.보고한날, 상세: '됨' };
    줄.인용 = 판정.인용글(줄);
    보충.push(줄);
  }

  for (const r of 틱톡후보) {
    새튄편.push(r);
    튄편[r.id] = { 곳: '틱톡', 채널: r.핸들, 날짜: r.날짜, 조회: r.조회, 배수: r.배수, 규칙: r.규칙, 잡은날: 오늘, ...(숫자인가(r.길이) ? { 길이: r.길이 } : {}) };
  }
  새튄편.sort((a, b) => (b.조회 || 0) - (a.조회 || 0) || a.id.localeCompare(b.id));

  누적.튄편 = 판정.튄편정리(튄편, 오늘, o.창 + 판정.기본.여유);
  누적.다시볼 = 판정.다시볼정리(날짜모름, 누적.다시볼, 오늘);
  // 찾은 채널 상한 — 밀린 채널은 누적.채널에서도 지운다. 남겨 두면 대상에서 빠져 다시 읽지도 않고, 「아는 채널」이라 검색으로
  // 다시 찾지도 못하며, 누적만 커진다(재확인 B1·GB4). 시드도 찾은 채널도 아닌 채널 칸은 함께 덜어 낸다.
  누적.찾은채널 = 판정.찾은채널정리(누적.찾은채널, 설정.검색.찾은채널상한);
  for (const id of Object.keys(누적.채널)) {
    if (!시드인가(id) && !Object.prototype.hasOwnProperty.call(누적.찾은채널, id)) delete 누적.채널[id];
  }
  누적.마지막스캔 = new Date().toISOString();
  if (api?.셈.멈춤) 못잼.push({ 곳: '유튜브', 계정: 'Data API', 까닭: `이 회차에서 멈췄다 — ${api.셈.까닭} · 그 뒤 채널은 쇼츠 탭·RSS(yt-dlp)로 읽었다` });
  for (const m of 설정.못잼) 못잼.push({ ...m });

  const 요약 = {
    이름: 설정.이름, 근거: 설정.근거, 창: { 부터: 창시작, 까지: 오늘 }, 지난스캔, 하한: { 유튜브: 판.최소조회, 작은채널: 판.작은채널최소조회, 틱톡: 설정.틱톡판정.최소조회 },
    표본, 새튄편, 보충, 날짜모름, 우리, 못잼,
  };
  return { 요약, 원자료 };
}

/** 주입(시험용): {부르개, api, 설정폴더} — 시험이 네트워크 없이 main을 돌린다. 가짜 부르개만 주면 Data API는 쓰지 않는다 */
async function main(argv, 주입 = {}) {
  const o = 인자(argv);
  if (o.도움) { console.log(도움글); return 0; }
  const 대상 = o.설정검사 && !o.브랜드.length ? [...판정.브랜드목록] : o.브랜드;
  if (!대상.length) { console.log(도움글); return 1; }
  const 설정들 = {};
  let 틀림 = 0;
  for (const b of 대상) {
    const { 설정, 오류 } = 설정읽기(b, 주입.설정폴더);
    if (오류.length) { 틀림 += 1; for (const e of 오류) console.error(`✗ ${b}: ${e}`); }
    else 설정들[b] = 설정;
  }
  // 짝 브랜드(synkbrief · yuhobuilds)는 시드가 겹치면 멈춘다 — 대상이 한쪽뿐이어도 짝 설정을 읽어 본다(10-28)
  const 짝설정 = {};
  for (const b of Object.keys(설정들)) {
    const 짝 = 판정.나눌짝[b];
    if (!짝) continue;
    짝설정[b] = 설정들[짝] || 설정읽기(짝, 주입.설정폴더).설정;
    if (!짝설정[b]) continue;
    const 겹침 = 판정.시드겹침(설정들[b], 짝설정[b]);
    if (겹침.length) { 틀림 += 1; console.error(`✗ ${b}: 시드 채널 ${겹침.length}곳이 ${짝}와 겹친다(한 채널은 한 브랜드만) — ${겹침.join(' · ')}`); }
  }
  if (틀림) return 1;
  if (o.설정검사) {
    for (const [b, s] of Object.entries(설정들)) console.log(`✓ ${b} — 유튜브 ${s.유튜브.length}곳(우리 ${s.유튜브.filter(c => c.우리).length}) · 검색어 ${s.검색.어.length}개(회차당 ${s.검색.회차당}) · 틱톡 ${s.틱톡.length}곳 · 못 잼 ${s.못잼.length}곳`);
    return 0;
  }

  const 오늘 = o.날짜 || 판정.서울날짜();
  const 출력 = o.출력 || path.join(공용작업본(저장소), '.tmp', '수요스캔', 오늘);
  const 누적폴더 = o.누적 || path.join(여기, '누적');
  fs.mkdirSync(출력, { recursive: true });
  const 기록파일 = path.join(출력, '기록.jsonl');
  const 기록 = 줄 => fs.appendFileSync(기록파일, JSON.stringify(줄) + '\n', 'utf8');
  const 부르개 = 주입.부르개 || new 수집.부르개({ 간격초: o.간격, 기록 });
  const api = 주입.api !== undefined ? 주입.api : (주입.부르개 || o.유튜브 !== 'api' ? null : new 수집.API부르개({ 기록 }));
  const 캐시 = new Map();
  const 요약파일 = path.join(출력, '요약.json');
  let 읽은곳 = 0;
  const 잠금 = 잠그기(누적폴더);
  if (잠금.막힘) { console.error(`❌ ${잠금.막힘}`); return 1; }
  try {
    for (const b of 대상) {
      const { 누적, 경로, 처음 } = 누적읽기(누적폴더, b);
      const 시작 = Date.now();
      const 짝 = 판정.나눌짝[b];
      const 남의 = 짝 ? 판정.남의채널(짝설정[b], 누적읽기(누적폴더, 짝).누적) : new Set();
      const { 요약, 원자료 } = await 브랜드스캔({ 설정: 설정들[b], 누적, o, 부르개, api, 캐시, 오늘, 출력, 남의채널: 남의 });
      const 이번읽음 = 요약.표본.유튜브.읽음 + 요약.표본.틱톡.읽음;
      읽은곳 += 이번읽음;
      // 한 곳도 못 읽은 회차(모두 막힘)는 누적을 덮지 않는다 — 검색 차례·마지막 스캔이 헛돌지 않게(2차 검수 B1)
      const 누적쓰기 = !o.누적안씀 && 이번읽음 > 0;
      if (!o.누적안씀 && !누적쓰기) 요약.누적 = '그대로 두었다 — 이번 회차에 한 곳도 못 읽었다';
      // 요약·원자료를 먼저 쓰고 누적(보고한 편)은 맨 뒤에 — 요약을 못 남겼는데 보고한 편으로 적히면 그 편을 영영 놓친다(2차 검수 GB1)
      파일쓰기(path.join(출력, '원자료', `${b}.json`), JSON.stringify(원자료, null, 1) + '\n');
      let 이전요약 = null;
      try { 이전요약 = JSON.parse(fs.readFileSync(요약파일, 'utf8')); } catch { /* 첫 브랜드 */ }
      const 호출 = { ...부르개.셈, ...(api ? { api: { ...api.셈 } } : {}) };
      const 합친 = 판정.요약합치기(이전요약, { 판: 1, 날짜: 오늘, 만든때: new Date().toISOString(), 규칙: 규칙글(), 브랜드: { [b]: 요약 }, 호출 });
      파일쓰기(요약파일, JSON.stringify(합친, null, 1) + '\n');
      파일쓰기(path.join(출력, '요약.md'), 판정.요약글(합친));
      if (누적쓰기) 파일쓰기(경로, 판정.줄맞춰(누적) + '\n');
      const p = 요약.표본;
      const 유튜브수 = 요약.새튄편.filter(r => r.곳 === '유튜브').length;
      console.log(`[${b}] 유튜브 ${p.유튜브.읽음}/${p.유튜브.대상}채널${p.유튜브.api ? `(API ${p.유튜브.api})` : ''} · 검색 ${p.검색.어.length}개(새 채널 ${p.검색.새채널}) · 틱톡 ${p.틱톡.읽음}/${p.틱톡.대상}`
        + ` · 새 튄 편 ${요약.새튄편.length}(유튜브 ${유튜브수}·틱톡 ${요약.새튄편.length - 유튜브수}) · 보충 ${(요약.보충 || []).length} · 날짜 모름 ${요약.날짜모름.length} · 못 잼 ${요약.못잼.length}`
        + ` · ${Math.round((Date.now() - 시작) / 1000)}초${처음 ? ' · 첫 스캔' : ''}${o.누적안씀 ? ' · 누적 안 씀' : (누적쓰기 ? '' : ' · 한 곳도 못 읽어 누적 그대로')}`);
    }
  } finally {
    잠금.풀기();
  }
  if (부르개.셈.멈춘서비스.length) console.log(`⚠ 연달아 막혀 멈춘 곳: ${부르개.셈.멈춘서비스.join('·')} — 다음 회차에 다시 읽는다`);
  if ((캐시.rss연속실패 || 0) >= RSS멈춤한도) console.log('⚠ 유튜브 RSS가 연달아 실패해 남은 채널은 쇼츠 탭으로만 읽었다(새 편 날짜는 영상 정보로 확인)');
  if (api?.셈.멈춤) console.log(`⚠ Data API가 이 회차에서 멈췄다(${api.셈.까닭}) — 그 뒤 유튜브 채널은 쇼츠 탭·RSS(yt-dlp)로 읽었다`);
  console.log(`→ ${path.join(출력, '요약.md')}`);
  return 읽은곳 > 0 ? 0 : 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => { console.error(`❌ ${error.message}`); process.exitCode = 1; });
}

module.exports = { 인자, 설정읽기, 누적읽기, 브랜드스캔, main, 잠금경로 };
