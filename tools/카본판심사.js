#!/usr/bin/env node
'use strict';
/* 카본 판 심사 — 광고 · 공모전 · 포트폴리오 영상의 최종본을 Fable 마감 관문(/마감작업)에 넣기 전에, 관문과 같은 「전체 판」과
 * 컷표 요약을 카본(Gemini 웹)에게 주고 네 가지만 물어 먼저 거른다(2026-11-16 시험 도입, 유호님 「응, 시험으로 넣어」).
 *
 * 왜: 11-15 서울로 시험에서 영상을 통째로 넓은 심사 지시문 하나로 보낸 카본은 Fable 관문 지적 일곱 가운데 하나만 짚었다.
 *   11-16 새벽 같은 카본에 관문의 전체 판 일곱과 끝 그림, 컷표 요약을 주고 물음을 넷으로 좁히자 판에 보이는 여섯을 모두 맞혔다
 *   (대화마다 8~9분, 돈 안 듦, 50여 지적 가운데 미심쩍은 것 넷쯤). 기록: docs/마케팅/PULSE_AI모델_캐스팅_20260930/검수방식_시험_완성영상_카본과Fable_20261115.md
 *   이 도구는 그 덧붙인 시험의 대화 A · B 꼴을 그대로 다시 만든다. 다음 광고 · 공모전 · 포트폴리오 세 편에서 관문 첫 회차 지적 수 ·
 *   관문을 다시 돈 횟수 · 유호님 지적 수를 재서 계속 쓸지 정한다(시험 기록 「다음 세 편」 표).
 *
 *   node tools/카본판심사.js <편 폴더> --최종 <최종.mp4> [--컷표 <컷표.json>] [--출력 <폴더>] [--미리보기]
 *   node tools/카본판심사.js <편 폴더> --판 <이미 만든 관문 판 폴더> [--출력 <폴더>] [--미리보기]
 *   node tools/카본판심사.js <편 폴더> --판 <이번 마감 판> --최종 <최종.mp4> --미리보기
 *   마지막 명령은 같은 최종 영상과 컷표로 만든 전체 판과 끝 그림을 확인하고 <판>/공유준비/카본에 보관한다.
 *
 *   --최종을 주면 먼저 tools/영상관문판.py(--관문 마감)로 판을 <출력>/판에 만든다(9분 안팎). --판을 주면 그 판을 쓴다.
 *   기본: 컷표 = <편>/컷표.json, 출력 = <편>/검수/카본판_<YYYYMMDD-HHmm>.
 *   --미리보기: 컷표 요약 · 지시문 · 작업 파일만 만들고 보내지 않는다.
 *
 * 만드는 것(<출력>/카본/): 컷표요약.txt · 지시문_<n>.txt · 작업_<n>.json · 카본답_<n>.md(받은 답) · 보고.md(무엇을 보냈고 무엇을 받았나)
 * 보내기는 tools/아르곤웹.js 보내기 --여러줄(공용 차례의 먼저 비는 줄), 답 없는 작업은 한 번 더 읽기(미학맹검과 같은 길).
 * 한 대화에 그림 4장까지라 전체 판을 넷씩 묶고 끝 그림은 마지막 묶음에 붙인다(자리가 없으면 따로 한 대화).
 *
 * 볼 줄 모르는 것: 컷 안의 움직임(판은 컷마다 한 장), 짧게 겹치는 자막(띠를 보내지 않는다), 소리. 이것은 Fable 관문 · 기계 검사 몫이다.
 * 답의 지적은 프레임으로 확인한 뒤 고친다 — 11-16 시험에서도 미심쩍은 지적이 있었다.
 * 끝 코드: 0 모든 묶음의 답을 받음 · 2 답을 못 받은 묶음이 있음 · 1 입력 오류. 시험: node --test tests/카본판심사.test.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');

const 뿌리 = path.join(__dirname, '..');
const 판칸 = 8; // tools/영상관문판.py 판칸과 같다 — 전체 판 한 장의 컷 수
const 그림한도 = 4; // 아르곤웹 한 대화 그림

const 초글 = (t) => { const s = Math.max(0, Number(t) || 0); const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`; };
const 한줄 = (x) => String(x ?? '').replace(/\s+/g, ' ').trim();

/** 컷표 → 컷마다 「보여야 할 것」 요약 글. Fable 관문 검수자가 받는 컷표에서 판과 견줄 칸만 옮긴다. */
function 컷표요약(컷표) {
  const 줄 = ['컷표 요약 — 이 영상의 설계표다. 컷마다 「시각 · 장면 · 나와야 할 인물 · 보이는 소품 · 그 컷의 내용」을 적었다.'];
  if (컷표.이기는것) 줄.push(`이기는 것: ${한줄(컷표.이기는것)}`);
  if (컷표.한문장) 줄.push(`한 문장: ${한줄(컷표.한문장)}`);
  const 인물 = 컷표.인물 && typeof 컷표.인물 === 'object' ? Object.entries(컷표.인물) : [];
  if (인물.length) {
    줄.push('인물(주인공과 배역):');
    for (const [이름, v] of 인물) {
      const 반복 = v && v.설정 && v.설정.반복장치 ? ` · 되풀이 장치: ${한줄(v.설정.반복장치)}` : '';
      줄.push(`- ${이름}: ${한줄([v && v.묘사, v && v.옷].filter(Boolean).join(' '))}${반복}`);
    }
  }
  const 소품 = 컷표.소품 && typeof 컷표.소품 === 'object' ? Object.entries(컷표.소품) : [];
  if (소품.length) {
    줄.push('소품:');
    for (const [이름, v] of 소품) 줄.push(`- ${이름}: ${한줄((v && (v.생김새 || v.색)) || '')}`);
  }
  const 장면 = 컷표.장면 && typeof 컷표.장면 === 'object' ? Object.entries(컷표.장면) : [];
  if (장면.length) {
    줄.push('장면(시대 · 때)과 빛:');
    for (const [이름, v] of 장면) 줄.push(`- ${이름}: ${한줄([v && v.시간대, v && v.빛].filter(Boolean).join(' — '))}`);
  }
  줄.push('', '컷마다:');
  for (const d of 컷표.detail || []) {
    const t0 = Number(d.t) || 0;
    const t1 = t0 + (Number(d.dur) || 0);
    const 보임 = Object.entries(d.소품 || {}).filter(([, v]) => v === '보임').map(([k]) => k);
    줄.push(`${d.cut} · ${초글(t0)}~${초글(t1)} · 장면 ${d.장면 || '-'} · 인물 ${(d.인물 || []).join(', ') || '없음'} · 보이는 소품 ${보임.join(', ') || '없음'} · 내용: ${한줄(d.line)}`);
  }
  return 줄.join('\n') + '\n';
}

/** 전체 판을 넷씩 묶고 끝 그림은 마지막 묶음에(자리가 없으면 따로). 묶음마다 든 컷 이름도 붙인다(판 한 장에 판칸 컷, 컷 순서대로). */
function 묶기(전체, 끝, 컷들) {
  const 판들 = 전체.map((그림, i) => ({ 그림, 컷: 컷들.slice(i * 판칸, (i + 1) * 판칸) }));
  const 묶음 = [];
  for (let i = 0; i < 판들.length; i += 그림한도) 묶음.push({ 판: 판들.slice(i, i + 그림한도), 끝: '' });
  if (끝) {
    const 마지막 = 묶음[묶음.length - 1];
    if (마지막 && 마지막.판.length < 그림한도) 마지막.끝 = 끝;
    else 묶음.push({ 판: [], 끝 });
  }
  return 묶음.map((b, i) => ({ ...b, 번호: i + 1, 컷: b.판.flatMap((p) => p.컷), 그림: [...b.판.map((p) => p.그림), ...(b.끝 ? [b.끝] : [])] }));
}

/** 묶음 하나의 지시문 — 11-16 시험의 대화 A · B 물음 그대로(편 설명만 컷표에서). 한 줄로 쓴다(빈 줄이 있으면 보내기 전 확인이 멈춘다). */
function 지시문(묶음, 모두, 편이름) {
  const 판수 = 묶음.판.length;
  const 머리 = `완성 영상의 검수를 부탁합니다. 「${편이름}」입니다. 붙인 그림은 영상에서 뽑은 판이고, 붙인 글 「컷표요약」은 컷마다 무엇이 보여야 하는지 적은 설계표입니다. 좋은 점은 적지 말고 흠만 적어 주세요. 확실하지 않으면 「추측」이라고 적어 주세요.`;
  const 판설명 = [
    판수 ? `그림 ${판수}장은 「전체 판」입니다. 한 장에 컷 ${판칸}개 이하가 위에서 아래로 시간 순서대로 있고, 컷마다 그 컷 가운데 장면 한 장입니다. 칸 왼쪽 위의 글자가 컷 이름이고, 화면 아래 글자는 그 순간의 말자막입니다. 이 대화의 판에 든 컷은 ${묶음.컷[0]}부터 ${묶음.컷[묶음.컷.length - 1]}까지입니다.` : '',
    묶음.끝 ? `${판수 ? '마지막 한 장은' : '그림은'} 끝 컷 3초를 0.25초 간격으로 뽑은 끝 판입니다.` : '',
    모두 > 1 ? `나머지 컷은 다른 대화에서 따로 봅니다(모두 ${모두}개 대화 가운데 ${묶음.번호}번째).` : '',
  ].filter(Boolean).join(' ');
  const 물음 = '아래 넷을 봐 주세요. '
    + '① 자막과 그림이 맞는가: 자막이 말하는 사람이나 물건이 그 컷 그림에 있는가, 자막이 그 그림보다 한 컷 늦거나 이르게 걸쳐 있는가. '
    + '② 붙은 컷 사이가 이어지는가: 같은 인물이나 물건의 옷 · 색 · 크기 · 빛 · 시간대가 갑자기 바뀌는가, 앞 컷에 있던 사람들이 다음 컷에서 까닭 없이 사라지는가, 같은 장소의 배경(건물 · 들판 · 방향)이 바뀌는가. '
    + '③ 주인공과 헷갈리는 다른 인물이 주인공 자리에 놓여 보는 사람이 착각할 곳이 있는가. '
    + '④ 컷표요약과 그림이 다른 곳(나와야 할 인물이나 소품이 없거나, 장면의 빛 · 시간대가 다름). '
    + '답 꼴: 지적마다 한 줄에 「컷 이름 · 무엇이 문제인가 · 근거(몇 번째 판의 어느 칸) · 등급(P1 처음 보는 사람이 바로 걸림 / P2 눈여겨보면 걸림 / P3 사소함)」. 네 물음마다 지적이 없으면 「없음」이라고 적어 주세요. 마지막에 이 판으로는 확인할 수 없었던 것을 한 줄로 적어 주세요.';
  return `${머리} ${판설명} ${물음}`;
}

function 지금글() {
  const d = new Date(Date.now() + 9 * 3600 * 1000); // 한국 시각 — 폴더 이름만
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

function 인자읽기(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--미리보기') o.미리보기 = true;
    else if (['--최종', '--컷표', '--판', '--출력'].includes(a)) { if (i + 1 >= argv.length) throw new Error(`${a} 뒤에 경로가 없다`); o[a.slice(2)] = argv[++i]; }
    else if (a.startsWith('--')) throw new Error(`모르는 선택: ${a}`);
    else o._.push(a);
  }
  return o;
}

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

async function 공유자료읽기(판폴더, 컷표경로, 최종) {
  const 목록 = JSON.parse(fs.readFileSync(path.join(판폴더, '판목록.json'), 'utf8'));
  const 입력 = 목록.카본입력;
  if (목록.관문 !== '마감' || !입력?.그림 || 입력.고른컷 !== '' || !목록.판?.끝) throw Error('이번 최종 영상의 전체 마감 판과 끝 그림이 필요합니다.');
  if (path.relative(컷표경로, 목록.컷표) || path.relative(최종, 목록.최종)) throw Error('판을 만든 컷표 또는 최종 영상의 경로가 다릅니다.');
  const 표내용 = fs.readFileSync(컷표경로), 컷표 = JSON.parse(표내용);
  if (sha(표내용) !== 입력.컷표) throw Error('판을 만든 뒤 컷표 내용이 바뀌었습니다.');
  const h = createHash('sha256');
  for await (const 조각 of fs.createReadStream(최종)) h.update(조각);
  if (h.digest('hex') !== 입력.최종) throw Error('판을 만든 뒤 최종 영상이 바뀌었습니다.');
  const 전체 = 목록.판.전체, 컷 = 컷표.detail.map(c => String(c.cut));
  if (!Array.isArray(전체) || !전체.length || !컷.length || !Array.isArray(입력.판배치)
      || 전체.length !== 입력.판배치.length || 전체.length !== Math.ceil(컷.length / 판칸)
      || !입력.판배치.every((p,i) => JSON.stringify(p) === JSON.stringify(컷.slice(i*판칸, (i+1)*판칸)))
      || JSON.stringify(목록.컷.map(c => String(c.cut))) !== JSON.stringify(컷)) throw Error('전체 판에 이번 컷표의 모든 컷이 순서대로 있어야 합니다.');
  const 그림 = new Map();
  const 순서 = [...전체, 목록.판.끝];
  if (JSON.stringify(입력.그림순서) !== JSON.stringify(순서)) throw Error('판 그림 순서가 이 마감 회차와 다릅니다.');
  for (const 파일 of 순서) {
    if (그림.has(파일) || path.relative(fs.realpathSync(판폴더), path.dirname(fs.realpathSync(파일)))) throw Error('판 폴더에 중복되지 않은 원본 그림이 있어야 합니다.');
    const 내용 = fs.readFileSync(파일);
    if (sha(내용) !== 입력.그림[파일]) throw Error('판을 만든 뒤 그림이 바뀌었습니다. ' + path.basename(파일));
    그림.set(파일, { 이름:path.join('그림', String(그림.size+1), path.basename(파일)), 내용 });
  }
  return { 목록, 컷표, 그림, 지문:sha(JSON.stringify([입력.최종, 입력.컷표, [...그림.keys()].map(f => 입력.그림[f])])) };
}

function 고정준비(카본, 자료) {
  const 대조 = () => {
    for (const [이름, 내용] of 자료) {
      const 기존 = path.join(카본, 이름);
      if (!fs.existsSync(기존) || !fs.readFileSync(기존).equals(Buffer.from(내용))) throw Error('기존 준비 자료가 없거나 다릅니다. 기존 파일을 보존했습니다. ' + 이름);
    }
  };
  if (fs.existsSync(카본)) return 대조();
  const 부모 = path.dirname(카본);
  fs.mkdirSync(부모, {recursive:true});
  const 임시 = fs.mkdtempSync(path.join(부모, '.카본준비-'));
  try {
    for (const [이름, 내용] of 자료) {
      const 파일 = path.join(임시, 이름);
      fs.mkdirSync(path.dirname(파일), {recursive:true});
      fs.writeFileSync(파일, 내용, {flag:'wx'});
    }
    try { fs.renameSync(임시, 카본); }
    catch (e) { if (!fs.existsSync(카본)) throw e; 대조(); }
  } finally { fs.rmSync(임시, {recursive:true, force:true}); }
}

/** 작업 파일들을 만든다(보내지 않는다). 공유 미리보기는 검증한 그림 바이트를 같은 요청의 사본에 담는다. */
function 준비(편, 컷표경로, 판폴더, 출력, 공유) {
  const 컷표 = 공유?.컷표 || JSON.parse(fs.readFileSync(컷표경로, 'utf8'));
  const 목록 = 공유?.목록 || JSON.parse(fs.readFileSync(path.join(판폴더, '판목록.json'), 'utf8'));
  const 판 = 목록.판 || {};
  const 전체 = 공유 ? 판.전체 : (판.전체 || []).filter((f) => fs.existsSync(f));
  if (!전체.length) throw new Error(`전체 판이 없다: ${path.join(판폴더, '판목록.json')}`);
  const 끝 = 공유 ? 판.끝 : (판.끝 && fs.existsSync(판.끝) ? 판.끝 : '');
  const 컷들 = (목록.컷 || []).map((c) => c.cut);
  const 카본 = path.join(출력, '카본');
  const 요약 = path.join(카본, '컷표요약.txt');
  const 자료 = new Map([['컷표요약.txt', 컷표요약(컷표)]]);
  const 편칸 = 컷표.편 && typeof 컷표.편 === 'object' ? 컷표.편 : { 이름: 컷표.편 };
  const 편이름 = 한줄([편칸.이름 || path.basename(편), 편칸.비율, 편칸.길이 ? `${편칸.길이}초` : ''].filter(Boolean).join(' · '));
  const 묶음들 = 묶기(전체, 끝, 컷들);
  const 작업들 = 묶음들.map((b) => {
    const 지 = path.join(카본, `지시문_${b.번호}.txt`);
    자료.set(path.basename(지), 지시문(b, 묶음들.length, 편이름) + '\n');
    const 답 = path.join(카본, `카본답_${b.번호}.md`);
    const 작업 = path.join(카본, `작업_${b.번호}.json`);
    const 그림 = 공유 ? b.그림.map(f => path.join(카본, 공유.그림.get(f).이름)) : b.그림;
    자료.set(path.basename(작업), JSON.stringify({ files: [...그림, 요약], promptFile: 지, out: 답 }, null, 1));
    return { 작업, 답, 묶음: b };
  });
  if (공유) {
    자료.set('입력.sha256', 공유.지문 + '\n');
    for (const {이름, 내용} of 공유.그림.values()) 자료.set(이름, 내용);
    고정준비(카본, 자료);
  } else {
    fs.mkdirSync(카본, {recursive:true});
    for (const [이름, 내용] of 자료) fs.writeFileSync(path.join(카본, 이름), 내용, 'utf8');
  }
  return { 카본폴더: 카본, 작업들 };
}

async function 아르곤부르기(작업들) {
  const 아르곤 = path.join(뿌리, 'tools', '아르곤웹.js');
  const { 답있음 } = require('./아르곤웹.js');
  const 한번 = (명령) => new Promise((resolve) => {
    const 남은 = 작업들.filter((w) => !답있음(w.답)).map((w) => w.작업);
    if (!남은.length) return resolve(0);
    const c = spawn(process.execPath, [아르곤, 명령, ...남은, '--여러줄'], { cwd: 뿌리, stdio: ['inherit', 'inherit', 'inherit'] });
    c.on('error', () => resolve(1));
    c.on('close', (code) => resolve(code ?? 1));
  });
  await 한번('보내기');
  if (작업들.some((w) => !답있음(w.답))) await 한번('읽기');
}

function 보고쓰기(카본폴더, 작업들, 편, 판폴더) {
  const { 답있음 } = require('./아르곤웹.js');
  const 줄 = ['# 카본 판 심사', '', `편: ${편}`, `판: ${판폴더}`, ''];
  for (const w of 작업들) {
    const 받음 = 답있음(w.답);
    줄.push(`- ${w.묶음.번호}번 대화 · ${w.묶음.컷.length ? `${w.묶음.컷[0]}~${w.묶음.컷[w.묶음.컷.length - 1]}` : ''}${w.묶음.끝 ? ' · 끝 판' : ''} · ${받음 ? `받음 ${w.답}` : '답 없음 — node tools/아르곤웹.js 읽기 ' + w.작업}`);
  }
  줄.push('', '지적은 판과 프레임으로 확인한 뒤 고친다(맞음 · 틀림을 이 파일 아래에 적는다). 컷 안의 움직임 · 짧은 자막 겹침 · 소리는 이 심사로 못 본다 — Fable 관문 · 기계 검사 몫이다.');
  fs.writeFileSync(path.join(카본폴더, '보고.md'), 줄.join('\n') + '\n', 'utf8');
  return 작업들.every((w) => 답있음(w.답));
}

async function main(argv) {
  let o;
  try { o = 인자읽기(argv); } catch (e) { console.error(e.message); return 1; }
  const 편 = o._[0] ? path.resolve(o._[0]) : '';
  if (!편 || !fs.existsSync(편)) { console.error('쓰는 법: node tools/카본판심사.js <편 폴더> --최종 <최종.mp4> | --판 <판 폴더> [--컷표 <컷표.json>] [--출력 <폴더>] [--미리보기]'); return 1; }
  if (!o.최종 && !o.판) { console.error('--최종(판을 새로 만든다)이나 --판(이미 만든 관문 판) 가운데 하나를 준다'); return 1; }
  const 컷표경로 = path.resolve(o.컷표 || path.join(편, '컷표.json'));
  if (!fs.existsSync(컷표경로)) { console.error(`컷표가 없다: ${컷표경로}`); return 1; }
  const 공유미리보기 = o.판 && o.최종 && o.미리보기;
  const 출력 = path.resolve(o.출력 || (공유미리보기 ? path.join(o.판, '공유준비') : path.join(편, '검수', `카본판_${지금글()}`)));
  let 판폴더 = o.판 ? path.resolve(o.판) : path.join(출력, '판');
  if (!o.판) {
    console.log(`판 만들기 — tools/영상관문판.py --관문 마감 → ${판폴더}`);
    const r = spawnSync('python', ['-I', '-X', 'utf8', path.join(뿌리, 'tools', '영상관문판.py'), 컷표경로, '--관문', '마감', '--최종', path.resolve(o.최종), '--출력', 판폴더], { cwd: 뿌리, stdio: 'inherit' });
    if (r.status === 1 || r.error) { console.error('판을 못 만들었다(영상관문판.py 끝 코드 1)'); return 1; }
  }
  if (!fs.existsSync(path.join(판폴더, '판목록.json'))) { console.error(`판목록이 없다: ${판폴더}`); return 1; }
  let 준비됨;
  try {
    const 공유 = 공유미리보기 ? await 공유자료읽기(판폴더, 컷표경로, path.resolve(o.최종)) : null;
    준비됨 = 준비(편, 컷표경로, 판폴더, 출력, 공유);
  } catch (e) { console.error(e.message); return 1; }
  const { 카본폴더, 작업들 } = 준비됨;
  const { 점검, 작업읽기, 작업문제 } = require('./아르곤웹.js');
  const 점검결과 = 점검(작업들.map((w) => w.묶음 && path.join(카본폴더, `지시문_${w.묶음.번호}.txt`)));
  if (점검결과.막힘) { console.error('지시문 점검에서 막혔다 — node tools/아르곤웹.js 점검 ' + 카본폴더 + '/지시문_*.txt'); return 1; }
  for (const w of 작업들) {
    const 문제 = 작업문제(작업읽기(w.작업));
    if (문제.length) { console.error(`${w.작업}: ${문제.join(' · ')}`); return 1; }
  }
  console.log(`카본 판 심사 — 대화 ${작업들.length}개(${작업들.map((w) => `${w.묶음.그림.length}장`).join(' · ')}) · ${카본폴더}`);
  if (o.미리보기) { console.log('미리보기 — 보내지 않았다.'); return 0; }
  await 아르곤부르기(작업들);
  const 다받음 = 보고쓰기(카본폴더, 작업들, 편, 판폴더);
  console.log(`${다받음 ? '모두 받음' : '답을 못 받은 대화가 있다'} — ${path.join(카본폴더, '보고.md')}`);
  return 다받음 ? 0 : 2;
}

if (require.main === module) main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });

module.exports = { 컷표요약, 묶기, 지시문, 준비, 인자읽기, 보고쓰기, 판칸, 그림한도 };
