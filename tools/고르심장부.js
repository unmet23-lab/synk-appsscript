#!/usr/bin/env node
'use strict';
/* 고르심 장부 — 후보를 유호님께 보이기 전에 심사(눈)의 고름을 먼저 적어 두고, 유호님 고르심과 견준다(2026-11-11).
 *
 * 왜: 유호님 「결국 고퀄리티 영상은 내 미감을 제대로 학습하고 같이 발전시켜야 최종 완성」(11-11). 심사가 유호님 판정을 맞히는지는
 *   11-08 눈가림 한 번(기각 8장 · 채택 4장 — tools/lib/맹검눈_적중.json)으로만 쟀고, 고르실 때마다 쌓이는 기록은 없었다.
 *   맞히는 비율이 단계 · 장르마다 쌓여야 「이 자리는 표본만 보셔도 된다」를 숫자로 말할 수 있다(하루 10편 목표의 문턱).
 *
 *   node tools/고르심장부.js 예측 --묶음 <id> --편 "<편>" --단계 <기획|콘티|이미지|영상|글자|소리|모델|화면|기타> [--장르 "<장르>"]
 *        --후보 "<이름>=<중립 설명>" --후보 … --누가 <아르곤|gpt|opus|fable|claude|…> (--고름 <이름>[,<이름>] | --고름 없음)
 *        [--순위 <이름>,<이름>,…] [--까닭 "…"] [--근거 <경로 · 링크>]
 *     · --맹검 <미학맹검 결과.json>을 주면 눈 · 고름 · 순위를 그 결과에서 읽는다 — 후보 순서 = 맹검에 넘긴 그림 순서(화면 번호 순).
 *       후보가 둘이고 그 쌍의 고름이 있으면 그것, 아니면 기각이 아닌 판 가운데 점수가 가장 높은 판, 모두 기각이면 「없음」.
 *   node tools/고르심장부.js 고르심 --묶음 <id> (--고름 <이름>[,<이름>] | --고름 없음) --말씀 "<유호님 말씀 그대로>"
 *   node tools/고르심장부.js 집계 [--누가 <눈>] [--단계 <단계>] [--장르 <장르>] [--json]
 *   node tools/고르심장부.js 목록                 고르심을 기다리는 묶음
 *
 * 규칙:
 *   · 예측은 보이기 전에 적는다. 그 묶음에 고르심이 이미 있으면 예측을 받지 않는다 — --뒤늦게를 붙이면 적되 집계에서 뺀다.
 *   · 「없음」은 「이 가운데 고를 것이 없다 — 다시」다. 유호님이 모두 물리셨으면 고르심도 「없음」으로 적는다.
 *   · 맞힘 = 그 눈의 첫째 고름이 유호님 고르심 안에 있다(둘 다 「없음」이면 맞힘). 한 묶음에 같은 눈의 예측이 여럿이면 고르심 전 마지막 것.
 *     유호님이 뒤에 고르심을 바꾸시면 마지막 고르심으로 견주되, 예측은 첫 고르심보다 먼저 적힌 것만 센다.
 *   · 후보 설명은 판정이 드러나지 않게 쓴다(「새 판」 「고친」 「옛」 금지). 그림 · 영상 파일은 장부에 넣지 않는다(이름 · 경로만).
 * 장부: docs/_ops/고르심기록.jsonl — 한 줄에 사건 하나, 덧붙이기만 한다. 공용 작업본에서는 쓴 뒤 그 파일만 바로 올린다(tools/lib/장부올리기.js).
 * 끝 코드: 0 됨 · 1 받지 않음(빠진 칸 · 없는 후보 이름 · 고르심 뒤의 예측).
 * 시험: node --test tests/고르심장부.test.js
 */
const fs = require('node:fs');
const path = require('node:path');

const 뿌리 = path.resolve(__dirname, '..');
const 기본장부 = path.join(뿌리, 'docs', '_ops', '고르심기록.jsonl');
const 단계들 = ['기획', '콘티', '이미지', '영상', '글자', '소리', '모델', '화면', '기타'];
const 없음말 = new Set(['없음', '모두기각', '다시']);

class 받지않음 extends Error {}

function 인자(argv) {
  const o = { 명령: argv[0] || '', 후보: [], 뒤늦게: false, json: false };
  const 값있는 = ['묶음', '편', '단계', '장르', '누가', '고름', '순위', '까닭', '근거', '맹검', '말씀', '장부', '때'];
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--뒤늦게') { o.뒤늦게 = true; continue; }
    if (a === '--json') { o.json = true; continue; }
    const 이름 = a.startsWith('--') ? a.slice(2) : null;
    if (이름 !== '후보' && !값있는.includes(이름)) throw new 받지않음(`모르는 선택: ${a}`);
    const v = argv[++i];
    if (v === undefined || (v.startsWith('--') && v !== '--')) throw new 받지않음(`${a} 뒤에 값이 없다`);
    if (이름 === '후보') o.후보.push(v); else o[이름] = v;
  }
  return o;
}

function 읽기(장부) {
  if (!fs.existsSync(장부)) return [];
  return fs.readFileSync(장부, 'utf8').split(/\r?\n/).map((줄, i) => {
    if (!줄.trim()) return null;
    try { return JSON.parse(줄); } catch (e) { throw new Error(`${path.basename(장부)} ${i + 1}번째 줄이 JSON이 아니다: ${e.message}`); }
  }).filter(Boolean);
}

function 덧붙이기(장부, 사건) {
  fs.mkdirSync(path.dirname(장부), { recursive: true });
  const 앞 = fs.existsSync(장부) ? fs.readFileSync(장부, 'utf8') : '';
  fs.appendFileSync(장부, `${앞 && !앞.endsWith('\n') ? '\n' : ''}${JSON.stringify(사건)}\n`, 'utf8');
}

const 쉼표 = (글) => String(글 || '').split(',').map((x) => x.trim()).filter(Boolean);

/** 사건들 → Map(묶음 id → {편, 단계, 장르, 후보: [{이름, 설명}], 예측: […], 고르심: […]}) — 적힌 차례 그대로 */
function 묶음들(사건들) {
  const 모음 = new Map();
  for (const e of 사건들) {
    if (!e || typeof e.묶음 !== 'string') continue;
    const m = 모음.get(e.묶음) || { 묶음: e.묶음, 편: '', 단계: '', 장르: '', 후보: [], 예측: [], 고르심: [] };
    for (const k of ['편', '단계', '장르']) if (!m[k] && e[k]) m[k] = e[k];
    if (!m.후보.length && Array.isArray(e.후보)) m.후보 = e.후보;
    if (e.종류 === '예측') m.예측.push(e); else if (e.종류 === '고르심') m.고르심.push(e);
    모음.set(e.묶음, m);
  }
  return 모음;
}

function 고름풀기(글, 이름들, 무엇) {
  if (글 === undefined) throw new 받지않음(`--${무엇}이 없다(고를 것이 없으면 「없음」)`);
  if (없음말.has(String(글).trim())) return [];
  const 고름 = 쉼표(글);
  if (!고름.length) throw new 받지않음(`--${무엇}이 비었다(고를 것이 없으면 「없음」)`);
  const 모름 = 고름.filter((x) => !이름들.includes(x));
  if (모름.length) throw new 받지않음(`후보에 없는 이름: ${모름.join(', ')} — 후보는 ${이름들.join(', ')}`);
  return [...new Set(고름)];
}

/** 미학맹검 결과.json → {누가, 고름, 순위, 까닭} — 후보 순서 = 화면 번호 순 */
function 맹검읽기(파일, 이름들) {
  const 결과 = JSON.parse(fs.readFileSync(파일, 'utf8'));
  const 번호들 = (결과.화면 || []).map((h) => String(h.번호)).sort();
  if (번호들.length !== 이름들.length) throw new 받지않음(`맹검 결과의 화면 ${번호들.length}장과 후보 ${이름들.length}개의 수가 다르다 — 후보 순서를 맹검에 넘긴 그림 순서와 맞춘다`);
  const 이름of = new Map(번호들.map((n, i) => [n, 이름들[i]]));
  const 낱장 = (결과.낱장 || []).filter((x) => 이름of.has(String(x.번호)));
  if (낱장.length !== 이름들.length) throw new 받지않음(`맹검 결과에 판정이 없는 화면이 있다(${낱장.length}/${이름들.length}) — 답을 못 받은 맹검으로는 예측을 적지 않는다`);
  const 순위 = [...낱장].sort((a, b) => (Number(b.점수) || 0) - (Number(a.점수) || 0)).map((x) => 이름of.get(String(x.번호)));
  const 살아남은 = 낱장.filter((x) => x.판정 !== '기각').sort((a, b) => (Number(b.점수) || 0) - (Number(a.점수) || 0));
  let 고름 = 살아남은.length ? [이름of.get(String(살아남은[0].번호))] : [];
  let 까닭 = 살아남은.length ? `맹검 점수 ${살아남은[0].점수}(${살아남은[0].판정})` : '맹검이 모두 기각';
  const 쌍 = 이름들.length === 2 ? (결과.쌍 || []).find((p) => String(p.쌍).split('-').map((n) => n.trim()).sort().join('-') === 번호들.join('-')) : null;
  if (쌍 && 이름of.has(String(쌍.고름)) && 살아남은.length) { 고름 = [이름of.get(String(쌍.고름))]; 까닭 = `맹검 쌍 고름 — ${쌍.까닭 || ''}`.trim(); }
  return { 누가: String(결과.눈 || '아르곤'), 고름, 순위, 까닭 };
}

function 예측(o, 장부) {
  if (!o.묶음) throw new 받지않음('--묶음이 없다');
  const 사건들 = 읽기(장부); const 지금 = 묶음들(사건들).get(o.묶음);
  let 후보 = o.후보.map((x) => { const i = x.indexOf('='); return i < 0 ? { 이름: x.trim(), 설명: '' } : { 이름: x.slice(0, i).trim(), 설명: x.slice(i + 1).trim() }; });
  if (후보.some((c) => !c.이름) || new Set(후보.map((c) => c.이름)).size !== 후보.length) throw new 받지않음('--후보의 이름이 비었거나 겹친다');
  if (지금 && 지금.후보.length) {
    if (후보.length && JSON.stringify(후보.map((c) => c.이름)) !== JSON.stringify(지금.후보.map((c) => c.이름))) throw new 받지않음(`이 묶음의 후보는 이미 ${지금.후보.map((c) => c.이름).join(', ')}로 적혀 있다 — 후보가 바뀌었으면 새 묶음 id로 적는다`);
    후보 = 지금.후보;
  }
  if (후보.length < 1) throw new 받지않음('--후보가 없다(묶음의 첫 예측에는 후보를 모두 적는다)');
  const 편 = o.편 || (지금 && 지금.편); const 단계 = o.단계 || (지금 && 지금.단계); const 장르 = o.장르 || (지금 && 지금.장르) || '';
  if (!편) throw new 받지않음('--편이 없다');
  if (!단계들.includes(단계)) throw new 받지않음(`--단계는 ${단계들.join(' · ')} 가운데 하나다`);
  if (지금 && 지금.고르심.length && !o.뒤늦게) throw new 받지않음(`묶음 ${o.묶음}에는 고르심이 이미 적혀 있다 — 예측은 보이기 전에 적는다(그래도 남기려면 --뒤늦게, 집계에서는 빠진다)`);
  const 이름들 = 후보.map((c) => c.이름);
  const 맹검 = o.맹검 ? 맹검읽기(o.맹검, 이름들) : null;
  const 누가 = o.누가 || (맹검 && 맹검.누가);
  if (!누가) throw new 받지않음('--누가가 없다(아르곤 · gpt · opus · fable · claude …)');
  const 고름 = o.고름 !== undefined ? 고름풀기(o.고름, 이름들, '고름') : 맹검 ? 맹검.고름 : 고름풀기(undefined, 이름들, '고름');
  const 순위 = o.순위 ? 고름풀기(o.순위, 이름들, '순위') : 맹검 ? 맹검.순위 : [];
  const 사건 = { 때: o.때 || new Date().toISOString(), 묶음: o.묶음, 종류: '예측', 편, 단계, ...(장르 ? { 장르 } : {}), 후보, 누가, 고름, ...(순위.length ? { 순위 } : {}),
    ...(o.까닭 || (맹검 && 맹검.까닭) ? { 까닭: o.까닭 || 맹검.까닭 } : {}), ...(o.근거 || o.맹검 ? { 근거: o.근거 || o.맹검 } : {}), ...(o.뒤늦게 ? { 뒤늦게: true } : {}) };
  덧붙이기(장부, 사건);
  return `예측 적음 — ${o.묶음} · ${누가} → ${고름.length ? 고름.join(', ') : '없음'}${o.뒤늦게 ? '(뒤늦게 — 집계에서 뺀다)' : ''}`;
}

function 고르심(o, 장부) {
  if (!o.묶음) throw new 받지않음('--묶음이 없다');
  const 지금 = 묶음들(읽기(장부)).get(o.묶음);
  if (!지금 || !지금.후보.length) throw new 받지않음(`묶음 ${o.묶음}이 장부에 없다 — 보이기 전에 예측부터 적는다(예측 없이 보여 드렸으면 그 묶음은 적지 않는다)`);
  if (!o.말씀 || !o.말씀.trim()) throw new 받지않음('--말씀이 없다(유호님 말씀을 그대로 적는다)');
  const 고름 = 고름풀기(o.고름, 지금.후보.map((c) => c.이름), '고름');
  덧붙이기(장부, { 때: o.때 || new Date().toISOString(), 묶음: o.묶음, 종류: '고르심', 고름, 말씀: o.말씀.trim() });
  const 줄 = 맞힘표(묶음들(읽기(장부)).get(o.묶음)).map((x) => `${x.누가} ${x.맞힘 ? '맞힘' : '빗나감'}(${x.예측.length ? x.예측.join(', ') : '없음'})`);
  return `고르심 적음 — ${o.묶음} → ${고름.length ? 고름.join(', ') : '없음'} · ${줄.join(' · ') || '센 예측 없음'}`;
}

/** 한 묶음 → 눈마다 {누가, 예측: [고름], 맞힘, 둘안} — 첫 고르심보다 먼저 적힌 마지막 예측만 */
function 맞힘표(m) {
  if (!m || !m.고르심.length) return [];
  const 첫 = m.고르심[0].때; const 답 = m.고르심[m.고르심.length - 1].고름 || [];
  const 눈들 = new Map();
  for (const e of m.예측) if (!e.뒤늦게 && String(e.때) <= String(첫)) 눈들.set(e.누가, e);
  return [...눈들.values()].map((e) => {
    const 고름 = e.고름 || []; const 앞둘 = (e.순위 && e.순위.length ? e.순위 : 고름).slice(0, 2);
    const 맞힘 = 고름.length ? 답.includes(고름[0]) : !답.length;
    return { 누가: e.누가, 예측: 고름, 맞힘, 둘안: 맞힘 || (답.length > 0 && 고름.length > 0 && 앞둘.some((x) => 답.includes(x))) };
  });
}

function 집계(사건들, { 누가, 단계, 장르 } = {}) {
  const 줄 = new Map();
  const 넣기 = (열쇠, x) => { const v = 줄.get(열쇠) || { 묶음: 0, 맞힘: 0, 둘안: 0 }; v.묶음++; if (x.맞힘) v.맞힘++; if (x.둘안) v.둘안++; 줄.set(열쇠, v); };
  let 닫힌 = 0; const 기다림 = [];
  for (const m of 묶음들(사건들).values()) {
    if (단계 && m.단계 !== 단계) continue;
    if (장르 && m.장르 !== 장르) continue;
    if (!m.고르심.length) { 기다림.push(m.묶음); continue; }
    닫힌++;
    for (const x of 맞힘표(m)) {
      if (누가 && x.누가 !== 누가) continue;
      넣기(`${x.누가}\t전체\t`, x); 넣기(`${x.누가}\t단계\t${m.단계}`, x);
      if (m.장르) 넣기(`${x.누가}\t장르\t${m.장르}`, x);
    }
  }
  const 표 = [...줄.entries()].map(([k, v]) => { const [눈, 갈래, 값] = k.split('\t'); return { 눈, 갈래, 값, ...v, 비율: Math.round((v.맞힘 / v.묶음) * 100) }; })
    .sort((a, b) => a.눈.localeCompare(b.눈) || ['전체', '단계', '장르'].indexOf(a.갈래) - ['전체', '단계', '장르'].indexOf(b.갈래) || b.묶음 - a.묶음);
  return { 닫힌, 기다림, 표 };
}

function 집계글({ 닫힌, 기다림, 표 }) {
  const 줄 = [`고르심이 적힌 묶음 ${닫힌} · 고르심을 기다리는 묶음 ${기다림.length}`];
  if (!표.length) 줄.push('아직 견줄 예측이 없다 — 후보를 보이기 전에 「예측」부터 적는다.');
  for (const x of 표) 줄.push(`  ${x.눈} · ${x.갈래 === '전체' ? '전체' : `${x.갈래} ${x.값}`}: ${x.맞힘}/${x.묶음} 맞힘(${x.비율}%) · 앞 둘 안 ${x.둘안}/${x.묶음}`);
  if (표.some((x) => x.갈래 === '전체' && x.묶음 < 10)) 줄.push('묶음이 열 개 아래인 눈은 비율을 근거로 쓰지 않는다(표본이 작다).');
  return 줄.join('\n');
}

async function main(argv) {
  let o;
  try {
    o = 인자(argv);
    const 장부 = o.장부 ? path.resolve(o.장부) : 기본장부;
    if (o.명령 === '집계') { const r = 집계(읽기(장부), o); console.log(o.json ? JSON.stringify(r, null, 1) : 집계글(r)); return 0; }
    if (o.명령 === '목록') {
      const 열린 = [...묶음들(읽기(장부)).values()].filter((m) => !m.고르심.length);
      console.log(열린.length ? 열린.map((m) => `${m.묶음} · ${m.편} · ${m.단계} · 후보 ${m.후보.map((c) => c.이름).join(', ')} · 예측 ${[...new Set(m.예측.map((e) => e.누가))].join(', ')}`).join('\n') : '고르심을 기다리는 묶음 없음');
      return 0;
    }
    if (o.명령 !== '예측' && o.명령 !== '고르심') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('\n').slice(2).join('\n')); return o.명령 ? 1 : 0; }
    console.log(o.명령 === '예측' ? 예측(o, 장부) : 고르심(o, 장부));
    if (!o.장부) {   // 정본 장부에 썼을 때만 — 공용 작업본이면 그 파일만 바로 올린다(워크트리는 그 세션의 커밋에 같이 올린다)
      const { 장부올리기, 장부올리기글 } = require('./lib/장부올리기.js');
      const 글 = 장부올리기글(await 장부올리기(['docs/_ops/고르심기록.jsonl'], `chore(장부): 고르심 기록 — ${o.묶음} ${o.명령}`), '고르심 장부');
      if (글) console.log(글);
    }
    return 0;
  } catch (e) {
    if (e instanceof 받지않음) { console.error(`받지 않음: ${e.message}`); return 1; }
    throw e;
  }
}

module.exports = { 읽기, 묶음들, 맞힘표, 집계, 맹검읽기, 단계들 };
if (require.main === module) main(process.argv.slice(2)).then((코드) => { process.exitCode = 코드; }, (e) => { console.error(e); process.exitCode = 1; });
