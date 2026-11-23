'use strict';
// 꺼진 판 결과 대조의 견주기: 같은 상태 · 같은 화면 크기의 두 판(예: live · cand) 결과 JSON을 견준다.
//   node offdiff.cjs <결과 폴더> <판 A> <판 B> [화면 크기=390]
// 견주는 것(설계 주인 11-20 18:30): 홈 첫 화면 · 탭 화면 글(이번 주 계획 줄 · 놀이 해금이 여기 든다) · 튜터 후보(첫 실행 튜터 고르기) ·
// 나 칸 · 계정 서버 요청(저장 요청) · 계정 서버에 남은 놀이 기록 · 학습 사건 · 이 기기 저장소 · IndexedDB 열기 · 오류 · 막은 요청.
// 시각 · uuid · 임의 꼬리처럼 판과 무관하게 매번 바뀌는 값은 같은 자리표로 바꾼 뒤 견준다.
const fs = require('node:fs'), path = require('node:path');
const [DIR, LA, LB, VIEW = '390'] = process.argv.slice(2);
const norm = v => {
  if (typeof v === 'string') return v
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/g, '<iso>')
    .replace(/\b1[789]\d{11}\b/g, '<ms>')
    .replace(/initial\.[a-z0-9]+-[a-z0-9]+/g, 'initial.<rnd>')
    // 사건 · 보임 번호: 앞 9자는 시각(36진수), 뒤는 차례 · 씨앗 무작위 — 시각 자리만 바꾼다
    .replace(/\b[a-z0-9]{9}-(\d+)-([a-z0-9]{8})\b/g, '<t>-$1-$2');
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [norm(k), norm(x)]));
  return typeof v === 'number' && v > 1.7e12 && v < 1.9e12 ? '<ms>' : v;
};
// 저장소 값 안의 JSON 문자열도 풀어서 자리표를 바꾼다(놀이 기록 · 이 기기 저장소 값은 JSON 문자열이다).
const deep = v => {
  if (typeof v === 'string') { try { const p = JSON.parse(v); if (p && typeof p === 'object') return deep(p); } catch { /* 글 */ } return norm(v); }
  if (Array.isArray(v)) return v.map(deep);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [norm(k), deep(x)]));
  return norm(v);
};
const words = s => s.split(/\s+/).filter(Boolean);
function textDiff(a, b) {
  if (a === b) return null;
  const wa = words(a), wb = words(b);
  const ca = new Map(), cb = new Map();
  for (const w of wa) ca.set(w, (ca.get(w) || 0) + 1);
  for (const w of wb) cb.set(w, (cb.get(w) || 0) + 1);
  const onlyA = [], onlyB = [];
  for (const [w, n] of ca) if ((cb.get(w) || 0) < n) onlyA.push(`${w}×${n - (cb.get(w) || 0)}`);
  for (const [w, n] of cb) if ((ca.get(w) || 0) < n) onlyB.push(`${w}×${n - (ca.get(w) || 0)}`);
  // 처음 갈리는 자리 앞뒤
  let i = 0; while (i < a.length && a[i] === b[i]) i++;
  return { onlyA: onlyA.slice(0, 40), onlyB: onlyB.slice(0, 40), at: i, ctxA: a.slice(Math.max(0, i - 60), i + 120), ctxB: b.slice(Math.max(0, i - 60), i + 120) };
}
const J = x => JSON.stringify(x);
const states = [...new Set(fs.readdirSync(DIR).filter(f => f.endsWith(`-${VIEW}-${LA}.json`)).map(f => f.slice(0, -(`-${VIEW}-${LA}.json`).length)))].sort();
let total = 0;
for (const st of states) {
  const fa = path.join(DIR, `${st}-${VIEW}-${LA}.json`), fb = path.join(DIR, `${st}-${VIEW}-${LB}.json`);
  if (!fs.existsSync(fb)) { console.log(`■ ${st}: ${LB} 결과 없음`); continue; }
  const a = JSON.parse(fs.readFileSync(fa, 'utf8')), b = JSON.parse(fs.readFileSync(fb, 'utf8'));
  const out = [];
  if (J(a.steps) !== J(b.steps)) out.push(`첫 실행 걸음: ${J(a.steps)} ↔ ${J(b.steps)}`);
  if (J(a.tutors) !== J(b.tutors)) out.push(`튜터 후보: ${J(a.tutors)} ↔ ${J(b.tutors)}`);
  const vn = [...new Set([...a.views.map(v => v.name), ...b.views.map(v => v.name)])];
  for (const n of vn) {
    const va = a.views.find(v => v.name === n), vb = b.views.find(v => v.name === n);
    if (!va || !vb) { out.push(`화면 ${n}: 한쪽에만 있음(${va ? LA : LB})`); continue; }
    const d = textDiff(norm(va.text), norm(vb.text));
    if (d) out.push(`화면 ${n}: ${LA}에만 [${d.onlyA.join(' ')}] · ${LB}에만 [${d.onlyB.join(' ')}]\n    ${LA}: …${d.ctxA}…\n    ${LB}: …${d.ctxB}…`);
  }
  const call = c => `${c.method} ${c.path}${c.query.length ? '?' + c.query.map(([k, v]) => `${k}=${v}`).join('&') : ''} ${J(deep(c.body))}`;
  const ca = a.calls.map(call), cb = b.calls.map(call);
  if (J(ca) !== J(cb)) {
    const sa = new Map(), sb = new Map();
    for (const c of ca) sa.set(c, (sa.get(c) || 0) + 1);
    for (const c of cb) sb.set(c, (sb.get(c) || 0) + 1);
    const onlyA = [...sa].filter(([c, n]) => (sb.get(c) || 0) < n).map(([c, n]) => `${n - (sb.get(c) || 0)}× ${c.slice(0, 400)}`);
    const onlyB = [...sb].filter(([c, n]) => (sa.get(c) || 0) < n).map(([c, n]) => `${n - (sa.get(c) || 0)}× ${c.slice(0, 400)}`);
    if (onlyA.length || onlyB.length) out.push(`계정 요청(개수 ${ca.length} ↔ ${cb.length}):\n    ${LA}에만: ${onlyA.join('\n      ') || '없음'}\n    ${LB}에만: ${onlyB.join('\n      ') || '없음'}`);
    else out.push(`계정 요청: 같은 요청들, 차례만 다름(${ca.length})`);
  }
  if (J(deep(a.playRecords)) !== J(deep(b.playRecords))) out.push(`계정 놀이 기록: ${J(deep(a.playRecords)).slice(0, 600)}\n    ↔ ${J(deep(b.playRecords)).slice(0, 600)}`);
  if (J(deep(a.learningEvents)) !== J(deep(b.learningEvents))) out.push(`학습 사건: ${a.learningEvents.length} ↔ ${b.learningEvents.length} · ${J(deep(a.learningEvents)).slice(0, 400)} ↔ ${J(deep(b.learningEvents)).slice(0, 400)}`);
  const la = deep(a.after?.local || {}), lb = deep(b.after?.local || {});
  for (const k of [...new Set([...Object.keys(la), ...Object.keys(lb)])].sort()) {
    if (J(la[k]) !== J(lb[k])) out.push(`이 기기 저장소 ${k}: ${J(la[k] ?? null).slice(0, 300)} ↔ ${J(lb[k] ?? null).slice(0, 300)}`);
  }
  if (J(a.after?.idb) !== J(b.after?.idb)) out.push(`IndexedDB 열기: ${J(a.after?.idb)} ↔ ${J(b.after?.idb)}`);
  if (J(a.after?.session) !== J(b.after?.session)) out.push(`세션 저장소 열쇠: ${J(a.after?.session)} ↔ ${J(b.after?.session)}`);
  if (J(norm(a.errors)) !== J(norm(b.errors))) out.push(`오류: ${J(a.errors).slice(0, 400)} ↔ ${J(b.errors).slice(0, 400)}`);
  if (J(a.failed) !== J(b.failed)) out.push(`실패 응답: ${J(a.failed).slice(0, 300)} ↔ ${J(b.failed).slice(0, 300)}`);
  if (J(a.blocked) !== J(b.blocked)) out.push(`막은 요청: ${J(a.blocked).slice(0, 300)} ↔ ${J(b.blocked).slice(0, 300)}`);
  const ga = new Set(a.worldGets), gb = new Set(b.worldGets);
  const getsA = [...ga].filter(x => !gb.has(x)), getsB = [...gb].filter(x => !ga.has(x));
  const info = (getsA.length || getsB.length) ? `  (참고 · 받은 파일: ${LA}에만 ${J(getsA)} · ${LB}에만 ${J(getsB)})` : '';
  total += out.length;
  console.log(`■ ${st} ${VIEW}: ${out.length ? '다름 ' + out.length : '같음'}${info}`);
  for (const line of out) console.log('  - ' + line);
}
console.log(`합계 다름 ${total}`);
