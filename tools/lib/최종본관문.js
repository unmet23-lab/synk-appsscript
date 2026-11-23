'use strict';
// ⑳ 최종본 검사(11-13) — 다 만든 영상 하나에서 사람 굳음 · 같은 판 잘라 붙임 · 같은 장면 반복 · 끝 3초를 잰다(tools/최종본검사.py).
// 왜: 11-13 유호님 「실수한것들이나 검수에서 지적받은부분들 다음에 참고해서 더 효율적으로 제작할수있게 어느정도 반영되고있어 ?」 → 「응, 고쳐」.
//   B38 v10 → B39 v10 → B39 v16 → 메일비서 v12까지 이 지적들이 편마다 마지막 컷 전수 검수에서야 잡혔다(검사가 받은 판 · 틀 2 컷표만 봐서
//   옛 컷표 · 컷표 없는 SNS 편과 편집에서 잘라 키운 컷에 닿지 않았다).
// 누구에게: 사람이 나오는 재연 · 진행자 편 — 브랜드 synkbrief · yuhobuilds, 또는 준비.json 「사람편」: true. 슬롯이 FINAL_FROM 뒤인 편만(나간 편은 묻지 않는다).
// 등급: 실사 재연(synkbrief · 「사람편」)의 굳음 · 같은판은 고칠 것(점검표 26 · 50 — 「미흡하면 다시」의 미흡 목록), 그 밖은 확인할 것.
//   yuhobuilds는 펠트 캐릭터 · 화면 캡처를 일부러 멈추거나 당겨 보여 주는 컷이 많아(Y41 실측 — 굳음 여섯이 모두 멈춘 캡처) 모두 확인할 것.
//   같은판의 고칠 것은 11-12 B39 v10 컷 전수의 기준(같은 판을 배율 · 자리만 바꿔 이음 — 컷인 · 다시 짠 구도 모두)을 따른다. 11-11 B38 v14는 이 기준을
//   느슨하게 봐 같은 판 이음 열한 곳을 통과시켰다(이 도구가 11-13에 찾음).
//   일부러 둔 자리는 준비.json 「최종본판단」: {"같은판@5.5": "까닭", "굳음": "까닭(편 전체)"} — 고칠 것이 확인할 것으로 내려가고 까닭이 같이 적힌다.
//   조용구간(가운데 10초 넘게 조용함, 11-15 흠 장부 설계 3단계)은 모든 브랜드 · 「사람편」에서 확인할 것이다 — HARD에 넣지 않는다. 고칠 것이 되면
//   작업실 등록이 막혀 게시가 더 빈다(11-15 「작은 흠은 올리기」). 시험: tests/최종본관문.test.js 「조용구간」.
//   화면멈춤(화면 전체가 2초 넘게 그대로, 11-16 흠 장부 「멈춘 화면」)도 같은 까닭으로 어디서나 확인할 것이다.
//   첫머리굳음(컷 첫 0.25초가 굳은 채로 시작, 11-18 서울로 1:48 · 점검표 26)도 어디서나 확인할 것이다 — SNS 최종본 23편에서 헛걸림이 그래픽 카드 한 곳이었다.
// 잰 값은 게시/최종본검사.json에 영상 바이트 · 수정 시각과 함께 둔다 — 같은 영상이면 다시 재지 않는다(한 편 2~4분).
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const { FIX, LOOK } = require('./게시글규칙.js');
const 묶음 = require('./게시묶음.js');

const FINAL_FROM = '2026-11-14';
const BRANDS = new Set(['synkbrief', 'yuhobuilds']);
const HARD = new Set(['굳음', '같은판']);
const TOOL = path.join(__dirname, '..', '최종본검사.py');
const MOTION = path.join(__dirname, '..', '..', 'docs', '마케팅', 'PULSE_포트폴리오_제작준비_20261012', '시댄스무제한', '사람움직임.py');
const HOW = {
  굳음: '사람이 숨 · 눈 · 시선 · 손으로 살아 있는 판으로 바꾸거나 그 구간을 줄인다(점검표 26 — 굳은 판을 다시 굽는 지시문에는 ACTION 박자)',
  구간굳음: '멎은 뒤 절반을 잘라 내거나 움직이는 판으로 바꾼다(점검표 26)',
  같은판: '한 판으로 두거나, 듣는 사람 · 손 컷을 끼워 각도를 바꾼다 — 같은 판을 배율만 바꿔 이으면 관객에겐 같은 장면이 튄다(점검표 50)',
  같은구도: '한 판으로 잇거나 다른 각도를 끼운다(점검표 50)',
  되풀이: '나중 컷을 다른 각도 · 다른 판으로 바꾼다 — 같은 그림이 두 번 나오면 「똑같은 장면이 반복」으로 읽힌다(점검표 50 · 11-12 서울로)',
  끝소리: '끝 3초에 소리 한 방(사건 소리 · 음악 마지막 박)을 둔다 — 방 소리만 남으면 끝이 맹하다(점검표 2)',
  끝화소: '끝 근접은 잘라 키우지 말고 근접으로 굽는다(점검표 48 · 2)',
  조용구간: '그 구간에 말(해설 · 대사)이나 사건 소리를 두거나 구간을 줄인다 — 화면 글만 읽히는 긴 구간은 폰 스피커로 비어 들린다. 일부러 둔 정적이면 그대로 둔다',
  화면멈춤: '그 사이에 박마다 바뀌는 것(다음 글 · 표시 · 숫자 · 손짓)을 하나씩 넣거나 멈춘 칸을 2초 안으로 줄인다 — 말이 이어져도 화면이 서 있으면 가장 심심한 구간이 된다. 글을 읽으라고 일부러 세운 판이면 그대로 둔다',
  첫머리굳음: '그 컷의 원본 시작을 사람 · 탈것이 제 빠르기가 된 뒤로 옮기고(원본 여유 안에서), 첫머리를 미는 창은 ease 대신 고른 빠르기로 민다(점검표 26 · 서울로 편집_감동.py 「옆흐름」). 그래픽 카드처럼 일부러 세웠다가 움직이는 판이면 그대로 둔다',
};

// 관문에 드는 편인가 — 슬롯이나 판 시각 가운데 하나라도 FINAL_FROM 뒤면(슬롯은 그대로 두고 판 시각만 옮긴 편도 — Fable 검수 12)
function inWindow(prep, from) {
  if (String(prep.슬롯 || '') >= from) return true;
  return [].concat(prep.판 || []).some((p) => p && String(p.시각 || '').slice(0, 10) >= from);
}

function applies(prep) {
  if (!(BRANDS.has(prep.브랜드) || prep.사람편 === true)) return false;
  return inWindow(prep, FINAL_FROM);
}

function runTool(file) {
  const py = process.env.SYNK_PYTHON || 'python';
  // 검사이력은 올리기 전 검사가 이 결과까지 한 줄로 남긴다 — 여기서 부른 최종본 검사는 따로 줄을 쓰지 않게 끈다(흠 장부 설계 1단계)
  const r = spawnSync(py, ['-I', '-X', 'utf8', TOOL, file, '--json'], { encoding: 'utf8', windowsHide: true, timeout: 30 * 60 * 1000, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, SYNK_검사이력: '끔' } });
  if (r.error) throw r.error;
  const line = String(r.stdout || '').trim().split(/\r?\n/).filter((l) => l.startsWith('{')).pop();
  if (!line) throw Error((r.stderr || '').trim().split(/\r?\n/).pop() || `끝 코드 ${r.status}`);
  const j = JSON.parse(line);
  if (j.오류) throw Error(j.오류);
  return j;   // 「못잼」(항목 몇이 죽음)이 있어도 잰 것은 쓴다
}

// 도구 판 — 측정 코드가 바뀌면 같은 영상도 다시 잰다(Fable 검수 10)
let toolStamp = null;
function stamp() {
  if (toolStamp) return toolStamp;
  const h = crypto.createHash('sha1');
  for (const f of [TOOL, process.env.SYNK_MOTION_PY || MOTION]) { try { h.update(fs.readFileSync(f)); } catch { h.update('없음'); } }
  toolStamp = h.digest('hex').slice(0, 12);
  return toolStamp;
}

function cacheKey(bundle, file) { return 묶음.rel(bundle, file) || path.basename(file); }   // 폴더만 다른 같은 이름 둘이 서로 덮지 않게(Fable 검수 9)

function cached(cacheFile, key, file) {
  try {
    const stat = fs.statSync(file);
    const row = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))[key];
    if (row && row.바이트 === stat.size && row.수정 === new Date(stat.mtimeMs).toISOString() && row.도구 === stamp()) return row.결과;
  } catch { /* 없다 */ }
  return null;
}

function remember(cacheFile, key, file, result) {
  let all = {};
  try { all = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { /* 처음 */ }
  const stat = fs.statSync(file);
  const { 파일: _abs, ...kept } = result;   // 이 PC 절대 경로는 공개 저장소에 올리지 않는다(Fable 검수 7)
  // 잰때: 흠 장부가 이 기록을 「그 판정 전에 기계가 띄운 것」으로 읽을 때 쓴다 — 판정 뒤에 다시 잰 기록을 앞선 경고로 세지 않게(11-15 3단계 GPT 검수 GA1)
  // 처음: 같은 영상(바이트 · 수정 시각)을 도구 판이 바뀌어 다시 잴 때 그 영상을 처음 잰 때와 걸린 항목 이름을 넘겨 둔다 — 다시 재도 앞서 띄운 증거가
  //   사라지지 않게(잰때가 없는 옛 줄은 영상 수정 시각). 영상이 바뀌면 새로 시작한다
  const 수정 = new Date(stat.mtimeMs).toISOString();
  const prev = all[key];
  const 같은영상 = prev && prev.바이트 === stat.size && prev.수정 === 수정;
  const 처음 = 같은영상 ? (prev.처음 || { 잰때: prev.잰때 || prev.수정, 걸림항목: [...new Set([].concat(prev.결과?.걸림 || []).map((h) => h && h.항목).filter(Boolean))] }) : undefined;
  all[key] = { 바이트: stat.size, 수정, 도구: stamp(), 잰때: new Date().toISOString(), ...(처음 ? { 처음 } : {}), 결과: kept };
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(all, null, 2) + '\n');
}

function reasonFor(prep, hit) {
  const table = prep.최종본판단 && typeof prep.최종본판단 === 'object' ? prep.최종본판단 : {};
  const exact = table[`${hit.항목}@${hit.초}`];
  const whole = table[hit.항목];
  const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  return text(exact) || text(whole);
}

// ── 까닭 없이 넘기지 않는다(11-23, 설계 검토 .tmp/검수/설계검토_넘김막기_20261123.md) ──
// 왜: 11-23 흠 장부 — 최근 20편에서 기계가 띄운 흠을 넘긴 21번 가운데 11번이 검사가 「확인할 것」으로 띄운 채 까닭 없이 최종 확인으로 갔다.
//   그 가운데 10번이 이 검사의 글자 가림(#5) · 같은 구도 · 되풀이(#50) · 끝(#2)이었다. 확인할 것은 한 번에 15~20개가 나와(시각 · 오마주 · 지난 편 닮음 같은
//   운영 항목) 점검표 번호가 붙은 품질 항목이 그 사이에 묻혔다.
// 무엇: 최종 확인을 아직 받지 않은 두 브랜드 편(차례 제작 중 · 다시 볼 차례 · 고칠 차례)에서, 아래 항목이 「확인할 것」이면 준비.json 「최종본판단」에 까닭이
//   없을 때 고칠 것으로 올린다. 고칠 것이 있는 편은 최종 확인 대기열에 들지 않는다(최종확인.js ready). 최종 확인을 받은 영상(열림)과 이미 걸린 편은 그대로다.
//   항목은 넘김이 실제로 난 것만 코드에 적는다 — 흠갈래.json에 규칙을 더해도 조용히 등록을 막는 항목이 되지 않게(설계 검토 GA13, 시험이 번호를 맞춘다).
//   yuhobuilds 굳음 · 화면멈춤 · 조용구간은 위 머리말의 까닭으로 확인할 것 그대로다.
// 까닭 열쇠: final-cut 항목은 위 reasonFor 그대로(「같은구도@초」 · 「되풀이」). 글자 자리는 「<code>@<군데 수>」 — 한 줄이 여러 자리를 합치므로, 까닭을 적은 뒤
//   다시 렌더해 군데가 늘면 다시 고칠 것이 된다(GA4). 최종 확인이 「미흡」이고 그 갈래에 같은 번호가 있으면 까닭이 있어도 고칠 것이다(새 판정 기록이 생길 때까지).
const 까닭항목 = { 같은구도: 50, 되풀이: 50, 끝소리: 2 };
const 까닭코드 = { 'text-right': 5, 'text-top': 5, 'text-bottom': 5, 'text-left': 5, 'cover-safe-area': 5 };
const 지난차례 = new Set(['관문 밖', '이미 나감', '이미 걸림', '열림', '등록 기다림', '판정 끝', '못 읽음']);

// 갈래 이름 · 번호 → 점검표 번호(흠갈래.json 「항목」). 못 읽으면 숫자 갈래만 센다
function 갈래번호들(갈래) {
  let 항목 = {};
  try { 항목 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'docs', '마케팅', '제작양식', '흠갈래.json'), 'utf8')).항목 || {}; } catch { /* 숫자만 */ }
  const out = new Set();
  for (const g of [].concat(갈래 || [])) {
    const m = /^[Kk#]?(\d{1,3})$/.exec(String(g).trim());
    if (m) out.add(Number(m[1]));
    else if (Number.isInteger(항목[g]?.번호)) out.add(항목[g].번호);
  }
  return out;
}

// 이 편에 까닭 관문이 켜지나 → { 켬, 미흡: Set(점검표 번호) }. 최종 확인 차례를 못 읽으면 켜지 않는다(검사 결과를 막는 쪽으로 틀리지 않게)
function 까닭관문(bundle, 확인 = require('./최종확인.js')) {
  try {
    if (!확인.required(bundle.prep || {})) return { 켬: false, 미흡: new Set() };
    const s = 확인.stage(bundle);
    if (지난차례.has(s.차례)) return { 켬: false, 미흡: new Set() };
    const r = 확인.read(bundle);
    return { 켬: true, 미흡: r && r.결과 === '미흡' ? 갈래번호들(r.갈래) : new Set(), 차례: s.차례 };
  } catch { return { 켬: false, 미흡: new Set() }; }
}

function 까닭붙이는법(열쇠, 번호) {
  return ` — 최종 확인 전에 고치거나, 일부러 둔 자리면 준비.json 「최종본판단」 {"${열쇠}": "까닭"}에 적는다(점검표 ${번호} · 기계가 띄운 흠은 까닭 없이 최종 확인으로 넘기지 않는다)`;
}

// 글자 자리 확인할 것(올리기 전 검사 ⑤)을 까닭이 없으면 고칠 것으로 — findings를 고쳐 돌려준다
function 글자까닭올림(findings, prep, 관문) {
  if (!관문 || !관문.켬) return findings;
  const table = prep && prep.최종본판단 && typeof prep.최종본판단 === 'object' ? prep.최종본판단 : {};
  return findings.map((f) => {
    const 번호 = 까닭코드[f && f.code];
    if (!번호 || f.level !== LOOK) return f;
    const 군데 = (/(\d+)군데/.exec(String(f.message || '')) || [])[1] || '1';
    const 열쇠 = `${f.code}@${군데}`;
    const why = typeof table[열쇠] === 'string' ? table[열쇠].trim() : '';
    if (why && !관문.미흡.has(번호)) return { ...f, message: `${f.message} · 「최종본판단」: ${why}` };
    const 미흡글 = why ? ` — 최종 확인이 이 흠(점검표 ${번호})으로 미흡이라 까닭이 있어도 고친다` : 까닭붙이는법(열쇠, 번호);
    return { ...f, level: FIX, message: `${f.message}${미흡글}` };
  });
}

// 잴 영상: 준비.json 「최종본」에 적힌 영상 + 판이 쓰는 영상 가운데 「최종본」에 없고 화질 낮춘 사본(올리기판)도 아닌 것.
// 올리기판은 최종본을 다시 누른 같은 그림이라 두 번 재지 않지만, 다른 렌더(끝 말 바꾼 틱톡판 등)는 따로 잰다(Fable 검수 6)
function targets(bundle, videoFiles) {
  const isVideo = (f) => 묶음.VIDEO ? 묶음.VIDEO.test(f) : /\.(mp4|mov|m4v|webm)$/i.test(f);
  const listed = [].concat(bundle.prep?.최종본 || []).filter((v) => typeof v === 'string' && v.trim()).map((v) => 묶음.resolve(bundle, v))
    .filter((f) => f && isVideo(f) && fs.existsSync(f));
  const seen = new Set(listed.map((f) => path.resolve(f).toLowerCase()));
  const extra = [...new Set(videoFiles)].filter((f) => !seen.has(path.resolve(f).toLowerCase()) && !(listed.length && 묶음.REDUCED.test(path.basename(f))));
  return [...listed, ...extra];
}

// bundle: 게시묶음 · videoFiles: 판이 쓰는 영상 파일 절대 경로 · run: 시험에서 바꿔 끼운다 · save: false면 기록을 쓰지 않는다(--저장안함)
function finalCutFindings(bundle, videoFiles, { run = runTool, save = true, 관문 = null } = {}) {
  const findings = [];
  const prep = bundle.prep || {};
  if (!applies(prep)) return findings;
  const cacheFile = path.join(bundle.dir, '게시', '최종본검사.json');
  const live = prep.브랜드 === 'synkbrief' || prep.사람편 === true;     // 실사 재연 — 모든 컷이 사람이 움직이는 영상
  for (const file of targets(bundle, videoFiles)) {
    const where = `최종본 ${path.basename(file)}`;
    const key = cacheKey(bundle, file);
    let result = cached(cacheFile, key, file);
    if (!result) {
      try {
        result = run(file);
      } catch (error) {
        findings.push({ level: LOOK, code: 'final-cut-failed', where, message: `최종본 검사를 못 했다(${error.message}) — python -I -X utf8 tools/최종본검사.py <영상>으로 직접 돌려 보거나 컷 전수에서 눈으로 본다` });
        continue;
      }
      if (save && !(result.못잼 || []).length) remember(cacheFile, key, file, result);   // 못 잰 항목이 있으면 다음에 다시 잰다
    }
    for (const hit of result.걸림 || []) {
      const why = reasonFor(prep, hit);
      const hard = HARD.has(hit.항목) && !why && live;
      const tail = why ? ` · 「최종본판단」: ${why}` : ` — ${HOW[hit.항목] || '컷 전수에서 눈으로 본다'}${HARD.has(hit.항목) && live ? `. 사진 · 화면 속 인물처럼 일부러 둔 자리면 준비.json 「최종본판단」 {"${hit.항목}@${hit.초}": "까닭"}` : ''}`;
      // 까닭 관문(위 까닭항목): 최종 확인 전 편에서 까닭이 없거나, 최종 확인 「미흡」 갈래에 같은 번호가 있으면 고칠 것
      const 번호 = 까닭항목[hit.항목];
      const 올림 = !hard && 관문 && 관문.켬 && 번호 && (!why || 관문.미흡.has(번호));
      const 올림글 = 올림 ? (why ? ` — 최종 확인이 이 흠(점검표 ${번호})으로 미흡이라 까닭이 있어도 고친다` : 까닭붙이는법(`${hit.항목}@${hit.초}`, 번호)) : '';
      findings.push({ level: hard || 올림 ? FIX : LOOK, code: `final-cut-${hit.항목}`, where, message: `${hit.글}${tail}${올림글}` });
    }
    for (const miss of result.못잼 || []) {
      findings.push({ level: LOOK, code: 'final-cut-unmeasured', where, message: `${miss.항목}을 못 쟀다(${miss.오류}) — 이 항목은 컷 전수에서 1/8초 띠로 눈으로 본다${live && /굳음|같은판/.test(miss.항목) ? '(실사 재연의 고칠 것 항목이다)' : ''}` });
    }
  }
  return findings;
}

module.exports = { finalCutFindings, applies, inWindow, reasonFor, targets, FINAL_FROM, BRANDS, HARD, 까닭관문, 글자까닭올림, 까닭항목, 까닭코드 };
