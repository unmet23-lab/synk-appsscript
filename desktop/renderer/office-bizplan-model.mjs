/* 기획부 「사업계획서」 작업 화면의 장면(사업계획서_설계.md 6절). 순수 함수다.
   snap: 본체의 기능 판(office-feature-bizplan.cjs snapshot), task: 이 부서의 가장 최근 기능 업무 줄, ui: 방의 화면 상태 */

const WORD = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
export const countWord = n => (n > 0 && n <= 10 ? WORD[n] : n > 10 && n < 20 ? '열' + WORD[n - 10] : String(n));
const batchim = w => { const c = String(w).charCodeAt(String(w).length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0; };
export const iga = w => w + (batchim(w) ? '이' : '가');
export const eul = w => w + (batchim(w) ? '을' : '를');
const wa = w => w + (batchim(w) ? '과' : '와');
export const eseo = w => w + '에';
export const eunneun = w => w + (batchim(w) ? '은' : '는');
const kindLabel = { mismatch: '자료와 다른 숫자', unsupported: '근거를 찾지 못한 문장', thin: '빈약한 평가 항목', empty: '비어 있는 장' };

/* 직접 쓰기의 일곱 장(사업계획서_설계.md 14.2). 본체 office-feature-bizplan.cjs CHAPTERS와 같은 차례.
   물음과 솔리오의 까닭은 쓰기 시안의 글 그대로, 예시는 그래놀라 가게 하나로 잇는다 */
export const WRITE = [
  { name: '문제 인식', q: '누가, 어떤 불편을 겪고 있나요?', num: true, why: '다 쓰면 직원이 이 계획서를 읽는데, 가장 먼저 보는 장이에요. 누가, 얼마나 불편한지 숫자 하나만 있어도 문제가 진짜로 보여요.', ex: '바쁜 직장인은 아침을 거르기 쉽습니다. 시중 그래놀라는 설탕이 많아 매일 먹기 어렵습니다.' },
  { name: '해결책', q: '그 불편을 어떻게 풀어 주나요?', num: false, why: '문제와 해결이 짝이 맞는지 보는 장이에요. 손님이 겪게 될 하루를 그려 주시면 돼요.', ex: '설탕을 절반으로 줄인 그래놀라를 매일 굽습니다. 홈페이지에서 주문합니다.' },
  { name: '고객과 시장', q: '누가 사고, 지금까지 얼마나 팔았나요?', num: true, why: '처음 살 사람이 분명해야 첫 매출이 보여요. 그 숫자를 어디서 셌는지도 같이 적어 주세요.', ex: '2025년 9월부터 온라인으로 팔아 왔습니다. 단골 손님 300명이 매달 다시 삽니다.' },
  { name: '경쟁과 차별점', q: '이미 있는 것과 무엇이 다른가요?', num: false, why: '「이미 있지 않나요?」는 심사에서 꼭 나오는 물음이에요. 손님이 지금 쓰는 것과 견줘 주세요.', ex: '마트 그래놀라보다 설탕이 절반이고, 그날 구운 것을 보냅니다.' },
  { name: '비즈니스 모델', q: '누가, 얼마를, 왜 내나요?', num: true, why: '누가 얼마를 내고 그 돈이 남는지 보여야 해요. 받는 돈과 나가는 돈을 같이 적어 주세요.', ex: '한 봉지 9,800원에 팝니다. 재료와 포장에 한 봉지 4,100원이 듭니다.' },
  { name: '팀', q: '이 일을 해낼 사람은 누구인가요?', num: false, why: '같은 계획이라도 해낼 사람이 보이면 믿음이 달라져요. 맡을 일과 해 본 일을 짝지어 주세요.', ex: '대표가 직접 굽고, 포장은 동네 자활센터와 함께합니다.' },
  { name: '실행 계획과 자금', q: '앞으로 무엇을 하고, 돈은 얼마가 필요한가요?', num: true, why: '마지막이에요! 언제 무엇을 하고 돈이 어디에 드는지 보이면 계획이 현실이 돼요.', ex: '3년 뒤 매출 5억 원을 목표로 합니다.' },
];
// 숫자 뒤 마침표(1. · 2025.)에서는 끊지 않는다(카본 A3)
const firstLine = t => (String(t || '').trim().split(/(?<=[^0-9\s][.!?。])\s|\n/)[0] || '').slice(0, 90);

/* 실패 까닭 → 둘째 줄(설계 6절 까닭 표) */
/* 「다음」이 갈 장. 앞으로 가며 아직 안 쓴 장을 찾는다. 읽은 뒤 빈 장(read.empty)을 채우는 중이면 건너뛴 장도 빈 장이면 들르고,
   앞쪽의 빈 장으로도 돌아간다. 빈 장마다 다시 읽기가 한 번씩 돌지 않게(Opus 대체 검수 r3 P2).
   이번 쓰기에서 「다음」 · 「건너뛰기」로 지나간 장(seen)은 다시 들르지 않는다. 건너뛰기만 눌러 두 장 사이를 오가지 않게(r4 P1). 갈 장이 없으면 -1 */
export function nextWrite(q, dr, writeText = {}, empty = [], seen = []) {
  const emp = new Set(empty), passed = new Set(seen);
  const txt = k => String(writeText?.[k] ?? dr?.chapters?.[k] ?? '').trim();
  const open = k => !txt(k) && !passed.has(k) && (!(dr?.skipped || []).includes(k) || emp.has(k));
  for (let k = q + 1; k < WRITE.length; k++) if (open(k)) return k;
  for (let k = 0; k < q; k++) if (emp.has(k) && open(k)) return k;
  return -1;
}

/* 파일이 정본이다. 파일에서 고친 글은 쓰기 화면에 없다는 알림(설계 검토 지적 2) */
function editedNote(name, where) {
  return `파일에서 고친 글은 ${where} 없습니다. 여기서 고쳐 다시 만들면 새 파일이 생기고 ${name ? eunneun(name) : '앞 초안은'} 그대로 둡니다.`;
}

export function reasonText(reason, { provider = 'claude', failedChunks = 0, totalChunks = 0, dataName = '' } = {}) {
  const tool = provider === 'codex' ? 'Codex' : 'Claude Code';
  switch (reason) {
    case 'LIMIT': return '구독 사용량이 다 차서 읽지 못했습니다. 다시 차면 읽을 수 있습니다.';
    case 'LOGIN': return `이 PC의 ${tool}에 로그인이 필요합니다.`;
    case 'NO_CLI': return `이 PC의 ${tool}를 찾지 못했거나 판이 낮습니다. 새 판으로 올린 뒤 다시 읽어 주세요.`;
    case 'PLAN_MISSING': return '계획서 파일을 찾지 못했습니다. 다시 골라 주세요.';
    case 'PLAN_FORMAT': return '한글과 PDF는 아직 읽지 못합니다. Word(.docx)로 저장해 넣어 주세요.';
    case 'PLAN_LOCKED': return '이 파일은 Word 문서로 열리지 않습니다. 암호나 문서 보안이 걸렸으면 풀고 다시 저장해 주세요.';
    case 'PLAN_EMPTY': return '계획서 본문에서 글을 찾지 못했습니다. 글상자에만 쓴 양식이면 본문에 옮겨 주세요.';
    case 'PLAN_TOO_LONG': case 'TOO_BIG': return '계획서가 너무 깁니다. 20만 자, 10MB까지 읽습니다.';
    case 'DATA_MISSING': return `회사 자료 ${dataName ? '「' + dataName + '」' : ''}를 찾지 못했습니다. 빼거나 다시 골라 주세요.`;
    case 'DATA_LOCKED': case 'DATA_FORMAT': return `회사 자료 ${dataName ? '「' + dataName + '」' : ''}를 읽지 못했습니다.`;
    case 'DATA_TOO_BIG': case 'DATA_TOO_LONG': return '회사 자료가 너무 깁니다. 파일 하나에 5MB, 모두 합쳐 40만 자까지 읽습니다.';
    case 'CHUNKS': return `묶음 ${countWord(totalChunks)} 가운데 ${eul(countWord(failedChunks))} 읽지 못했습니다.`;
    case 'LIST': return '목록 파일을 읽지 못했습니다. 기록 지우기를 누르면 처음부터 할 수 있습니다.';
    case 'FOLDER': return '읽는 데 쓰는 폴더가 비어 있지 않습니다. 잠시 뒤 다시 읽어 주세요.';
    default: return '직원이 답을 주지 못했습니다. 다시 읽기로 다시 할 수 있습니다.';
  }
}

export function privacyLine(provider, others = false) {
  // 기술 이름(Claude Code, Anthropic, SYNK)을 빼고 쉬운 말로. 자료가 어디로 가는지는 그대로 말한다(11-23 미학 맹검 2차 「이해」)
  // 「다른 회사 심사위원도 부르기」를 켜면 심사에 쓰는 계획서가 다른 회사로도 간다(설계 14.7 유호님 답)
  const also = !others ? '' : provider === 'codex'
    ? ' 심사에는 Claude를 만든 회사로도 계획서가 가고, 내 Claude 구독 사용량도 씁니다.'
    : ' 심사에는 GPT를 만든 회사로도 계획서가 가고, 내 ChatGPT 구독 사용량도 씁니다.';
  return provider === 'codex'
    ? `내 ChatGPT 구독으로 읽습니다. 계획서와 고른 자료는 ChatGPT를 만든 회사로 가고, 사용량은 그 구독에서 나갑니다.${also} 솔리오 서버로는 보내지 않습니다.`
    : `내 Claude 구독으로 읽습니다. 계획서와 고른 자료는 Claude를 만든 회사로 가고, 사용량은 그 구독에서 나갑니다.${also} 솔리오 서버로는 보내지 않습니다.`;
}

/* ── 심사위원 셋의 점수와 무대(사업계획서_설계.md 14.3) ──
   자리와 차례는 늘 Opus · Sol · Sonnet. 고른 직원 회사의 심사위원만 앉고, 「다른 회사 심사위원도 부르기」를 켜면 셋이 앉는다 */
export const JUDGES = [
  { id: 'opus', name: 'Opus', provider: 'claude', co: 'Claude', eye: '투자자의 눈', tag: '투자자의 눈' },
  { id: 'sol', name: 'Sol', provider: 'codex', co: 'GPT', eye: '실행 심사위원의 눈', tag: '실행의 눈' },
  { id: 'sonnet', name: 'Sonnet', provider: 'claude', co: 'Claude', eye: '공공기관 심사위원의 눈', tag: '공공기관의 눈' },
];
export const seatedFor = (provider, others = false) => JUDGES.filter(j => others || j.provider === (provider === 'codex' ? 'codex' : 'claude')).map(j => j.id);
const judgeOf = id => JUDGES.find(j => j.id === id);
const f1 = n => (Math.round(n * 10) / 10).toFixed(1);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const ADJ = ['', '한', '두', '세'];
/* 앉은 심사위원을 이르는 말: 「GPT 심사위원」 · 「심사위원 둘」 · 「심사위원 셋」 */
function panelOf(ids) {
  if (ids.length === 1) return ids[0] === 'sol' ? 'GPT 심사위원' : `${judgeOf(ids[0])?.name || ''} 심사위원`;
  return `심사위원 ${countWord(ids.length)}`;
}
const SAT_OUT = { LIMIT: '이번 주 사용량을 다 써서 이번에는 쉬었습니다.', LOGIN: '로그인이 풀려 이번에는 쉬었습니다.', OFF: '다른 회사 심사위원 부르기가 꺼져 있어 이번에는 쉬었습니다.' };
export const satOut = reason => SAT_OUT[reason] || '답을 받지 못해 이번에는 쉬었습니다.';
const FIXED_WHY = /점수의 까닭을 확인하지 못했습니다\.$/;
const planTitle = name => String(name || '').replace(/\.[^.]+$/, '').slice(0, 24) || '사업계획서';
/* 인용이 든 문단(1부터)의 묶음: 번호와 제목 */
function secOfPara(read, para) {
  const i = para - 1, secs = read?.sections || [];
  const k = Number.isInteger(para) && para > 0 ? secs.findIndex(s => s.head === i || (s.paras || []).includes(i)) : -1;
  return k < 0 ? null : { no: String(k + 1).padStart(2, '0'), title: secs[k].title || '' };
}

/* 항목 × 앉은 심사위원 점수표. 다시 심사면 앞 점수(prev)와 견준다 */
export function scoreBoard(scores, read) {
  const ok = (scores?.judges || []).filter(j => j.status === 'ok' && Array.isArray(j.scores));
  const prev = scores?.prev || null, crits = Array.isArray(scores?.criteria) ? scores.criteria : [];
  const rows = crits.map(crit => {
    const cells = ok.map(j => {
      const s = j.scores.find(x => x.crit === crit), was = prev?.[j.id]?.[crit];
      return { judge: j.id, s: s || null, score: Number.isInteger(s?.score) ? s.score : null, up: s && Number.isInteger(was) && s.score > was ? s.score - was : 0 };
    });
    const pts = cells.map(c => c.score).filter(Number.isInteger);
    const was = ok.map(j => prev?.[j.id]?.[crit]).filter(Number.isInteger);
    return { crit, cells, avg: pts.length ? mean(pts) : null, spread: pts.length > 1 ? Math.max(...pts) - Math.min(...pts) : 0, prevAvg: was.length ? mean(was) : null };
  });
  const judgeAvg = j => { const v = crits.map(c => j.scores.find(x => x.crit === c)?.score).filter(Number.isInteger); return v.length ? mean(v) : null; };
  const prevAvg = id => { const v = crits.map(c => prev?.[id]?.[c]).filter(Number.isInteger); return v.length ? mean(v) : null; };
  const scored = rows.filter(r => r.avg != null);
  const weak = scores?.sum?.weakest?.crit || (scored.length ? scored.reduce((m, r) => (r.avg < m.avg - 1e-9 ? r : m), scored[0]).crit : null);
  return { ok, rows, weak, judgeAvg, prevAvg };
}

/* 점수가 나온 뒤 짧게 보이는 무대(12초 안). 받은 혼잣말(reacts) 셋까지 · 심사위원마다 점수판 · 평균 */
export function revealPlan(scores, read) {
  const ok = (scores?.judges || []).filter(j => j.status === 'ok' && Array.isArray(j.scores));
  if (!scores?.sum || !ok.length) return null;
  const secs = read?.sections || [], order = id => secs.findIndex(s => s.id === id);
  const pools = ok.map(j => (j.reacts || []).filter(r => order(r.sec) >= 0 && r.say).map(r => ({ judge: j.id, sec: r.sec, tone: r.kind === 'oh' ? 'oh' : 'hmm', say: r.say })));
  const picks = [];
  for (let round = 0; picks.length < 3 && pools.some(p => p.length > round); round++) for (const p of pools) if (p[round] && picks.length < 3) picks.push(p[round]);
  picks.sort((a, b) => order(a.sec) - order(b.sec));
  const beats = [{ kind: 'sit', at: 0 }];
  let t = 700;
  for (const r of picks) { beats.push({ kind: 'react', at: t, ...r }); t += 2400; }
  for (const j of ok) { beats.push({ kind: 'paddle', at: t, judge: j.id }); t += 550; }
  t += 250;
  beats.push({ kind: 'total', at: t }); t += 2200;
  beats.push({ kind: 'end', at: t });
  return { at: scores.at, beats };
}

const STATE_TEXT = { wait: '기다리는 중', read: '읽는 중', passed: '차례를 마쳤습니다', done: '점수를 매겼습니다', off: '이번에는 쉽니다', rest: '이번에는 쉬었습니다' };
const judgeRow = (j, k, state, extra = {}) => ({ id: j.id, name: j.name, co: j.co, eye: j.eye, tag: j.tag, seat: k, seated: state !== 'off', state, status: STATE_TEXT[state], bubble: null, paddle: null, ...extra });

/* 심사하는 동안: 업무 줄의 차례(「심사 · 이름」)만 보인다. 지어낸 반응은 없다 */
function judgingShow(task, p, planName, panel = null) {
  const rescore = task.featureKind === 'score';
  const name = p?.title?.startsWith('심사 · ') ? p.title.slice(5) : null;
  const reading = name ? JUDGES.find(j => j.name === name)?.id || null : null;
  // 다시 심사는 첫 심사의 심사단만 앉는다(설계 14.3)
  const seated = JUDGES.map(j => j.id).filter(id => (!panel || panel.includes(id)) && seatedFor(task.provider, !!task.others).includes(id) || id === reading);
  const at = reading ? seated.indexOf(reading) : -1;
  const judges = JUDGES.map((j, k) => {
    const s = seated.indexOf(j.id);
    // 앞 차례가 쉬었는지는 끝나야 안다. 심사 중에는 「차례를 마쳤습니다」로 쓴다(Opus 대체 화면 검수 P2)
    const state = s < 0 ? 'off' : at < 0 ? 'wait' : s < at ? 'passed' : s === at ? 'read' : 'wait';
    return judgeRow(j, k, state, state === 'read' ? { bubble: { kind: 'dots', say: '' } } : {});
  });
  const r = reading && judgeOf(reading);
  return {
    head: [rescore ? '고친 계획서로 다시 심사받습니다.' : `${iga(panelOf(seated))} 읽고 있습니다.`, '심사위원마다 1~2분 걸립니다.'],
    show: {
      key: 'task:' + task.id, mode: 'judging', presenter: 'nervous', judges, total: null,
      sign: { key: 'plan', top: '사업계획서', title: planTitle(planName) },
      cap: r ? [[r.name, true], [' 심사위원이 계획서를 읽고 있습니다.', false]] : [['심사위원이 자리에 앉았습니다.', false]],
    },
  };
}

/* 점수가 나온 뒤의 무대 한 장면. step은 revealPlan의 몇 번째 박자까지 왔는지 */
function revealShow(scores, read, plan, step, key) {
  const b = plan.beats, s = Math.max(0, Math.min(step, b.length - 1)), cur = b[s], shown = b.slice(0, s + 1);
  const board = scoreBoard(scores, read), again = !!scores.prev;
  const up = (now, was) => (was != null && now - was > 0.04 ? '+' + f1(now - was) : '');
  const paddles = new Set(shown.filter(x => x.kind === 'paddle').map(x => x.judge));
  const react = cur.kind === 'react' ? cur : null;
  const lastReact = shown.filter(x => x.kind === 'react').at(-1);
  const judges = JUDGES.map((j, k) => {
    const row = (scores.judges || []).find(x => x.id === j.id);
    if (!row) return judgeRow(j, k, 'off');
    if (row.status !== 'ok' || !Array.isArray(row.scores)) return judgeRow(j, k, 'rest');
    const avg = board.judgeAvg(row), on = paddles.has(j.id);
    return judgeRow(j, k, 'done', {
      status: on && avg != null ? `평균 ${f1(avg)}점` : STATE_TEXT.done, fin: on,
      bubble: react && react.judge === j.id ? { kind: react.tone, say: react.say } : null,
      paddle: on && avg != null ? { value: f1(avg), up: again ? up(avg, board.prevAvg(j.id)) : '', name: j.name } : null,
    });
  });
  const secs = read?.sections || [], si = lastReact ? secs.findIndex(x => x.id === lastReact.sec) : -1;
  const sign = si >= 0 ? { key: 'sec:' + secs[si].id, top: `${String(si + 1).padStart(2, '0')} / ${String(secs.length).padStart(2, '0')}`, title: secs[si].title || '' } : { key: 'plan', top: '사업계획서', title: planTitle(read?.plan?.name) };
  const avg = scores.sum.avg, was = scores.prevSum?.avg ?? null, ok = board.ok.map(j => j.id);
  const totalOn = shown.some(x => x.kind === 'total');
  let cap;
  if (totalOn) cap = again
    ? (was != null && Math.abs(avg - was) > 0.04 ? [['심사가 끝났습니다. 평균이 ' + f1(was) + '점에서 ', false], [f1(avg) + '점', true], ['으로 바뀌었습니다.', false]] : [['심사가 끝났습니다. 평균은 그대로 ', false], [f1(avg) + '점', true], ['입니다.', false]])
    : [['심사가 끝났습니다. 평균 ', false], [f1(avg) + '점', true], [board.weak ? `이고, 가장 약한 곳은 ${board.weak}입니다.` : '입니다.', false]];
  else if (paddles.size) cap = [['심사위원이 점수판을 듭니다.', false]];
  else if (react) { const t = secs.find(x => x.id === react.sec)?.title || ''; cap = [[t, true], [` · ${judgeOf(react.judge)?.name || ''} 심사위원이 ${react.tone === 'oh' ? '좋게 본 곳입니다.' : '걸린다고 한 곳입니다.'}`, false]]; }
  else cap = [[shown.some(x => x.kind === 'react') || b.some(x => x.kind === 'react') ? '읽다가 한 말부터 봅니다.' : '점수판을 듭니다.', false]];
  const mood = totalOn ? (again && was != null && avg - was > 0.04 ? 'happy' : 'look') : react ? (react.tone === 'oh' ? 'happy' : 'nervous') : paddles.size ? 'look' : 'nervous';
  return {
    head: [again ? '다시 심사한 점수가 나왔습니다.' : `${panelOf(ok)}의 점수가 나왔습니다.`, ''],
    show: {
      key, mode: 'reveal', presenter: mood, judges, sign, cap,
      total: totalOn ? { value: f1(avg), small: ok.length === 1 ? `${panelOf(ok)} 점수` : `${ADJ[ok.length] || countWord(ok.length)} 심사위원 평균`, up: again ? up(avg, was) : '' } : null,
    },
  };
}

/* 점수 결과(w06): 큰 평균, 가장 약한 항목과 까닭 하나, 항목 × 심사위원 점수표, 심사위원의 한 줄 */
function scoreView(scores, read, ui, open, total) {
  const board = scoreBoard(scores, read), again = !!scores.prev;
  const avg = scores.sum?.avg ?? null, was = scores.prevSum?.avg ?? null, diff = avg != null && was != null ? avg - was : 0;
  const openRow = ui.scoreRow === undefined ? board.weak : ui.scoreRow;
  let head, sub;
  if (avg == null) { head = '이번에는 심사하지 못했습니다.'; sub = '심사위원이 모두 쉬었습니다. 고칠 곳은 그대로 볼 수 있습니다.'; }
  else if (again) {
    head = diff > 0.04 ? `${f1(was)}점에서 ${f1(avg)}점으로 올랐습니다.` : diff < -0.04 ? `${f1(was)}점에서 ${f1(avg)}점으로 내려갔습니다.` : '점수가 그대로입니다.';
    sub = board.weak ? `지금 가장 약한 것은 ${board.weak}입니다.` : '';
  } else {
    head = board.weak ? `${iga(board.weak)} 가장 약합니다.` : '심사를 마쳤습니다.';
    sub = board.ok.map(j => j.scores.find(s => s.crit === board.weak)?.why).find(w => w && !FIXED_WHY.test(w)) || '';
  }
  const rows = board.rows.map(r => ({
    crit: r.crit, avg: r.avg == null ? '' : f1(r.avg), w: r.avg == null ? 0 : Math.round(r.avg / 5 * 100),
    weak: r.crit === board.weak, split: board.ok.length > 1 && r.spread >= 2, fixed: r.prevAvg != null && r.avg != null && r.avg > r.prevAvg + 0.04,
    open: openRow === r.crit,
    cells: r.cells.map(c => ({ score: c.score == null ? '' : String(c.score), up: c.up > 0 ? '+' + c.up : '' })),
    more: r.cells.filter(c => c.s).map(c => {
      const sec = c.s.quote ? secOfPara(read, c.s.para) : null;
      // 묶음 제목이 「2. 지금까지 한 일」처럼 제 번호로 시작하면 앞 번호를 붙이지 않는다(11-27 앱 창 확인)
      return { name: judgeOf(c.judge)?.name || c.judge, score: String(c.s.score), why: c.s.why || '', held: !!c.s.held, quote: c.s.quote || '', where: sec ? (/^\s*(?:\d|제\s*\d)/.test(sec.title) ? sec.title : `${sec.no} ${sec.title}`) : '' };
    }),
  }));
  const judges = (scores.judges || []).map(row => {
    const j = judgeOf(row.id) || { name: row.name || row.id, co: '', eye: '' };
    const ok = row.status === 'ok' && Array.isArray(row.scores), a = ok ? board.judgeAvg(row) : null;
    return { id: row.id, name: j.name, co: j.co, eye: j.eye, avg: a == null ? '' : f1(a), line: ok ? row.line || '' : satOut(row.reason), rest: !ok };
  });
  return {
    head: [head, sub], avg: avg == null ? '' : f1(avg), up: again && diff > 0.04 ? '+' + f1(diff) : '', raised: again && diff > 0.04,
    cols: board.ok.map(j => judgeOf(j.id)?.name || j.name || j.id), rows, judges,
    go: open ? `고칠 곳 ${countWord(open)} 보기` : total ? '고칠 곳 다시 보기' : '읽은 결과 보기',
    fine: '연습 심사입니다. 실제 지원사업의 결과를 미리 알려 주지 않습니다. 심사는 앉은 심사위원 수만큼 구독 사용량을 씁니다.',
  };
}

/* 메모 하나의 글과 단추 */
function noteView(n, ui, depts) {
  const c = n.choice;
  const state = !c ? 'open' : c.kind === 'handed' ? 'handed' : c.kind === 'keep' ? 'kept' : 'done';
  const done = { fix: '고친 문장으로 바꿨습니다.', edit: '직접 고쳤습니다.', keep: '그대로 둡니다.' }[c?.kind] ||
    (c?.kind === 'handed' ? `${eseo(depts.find(d => d.id === c.departmentId)?.name || '다른 부서')} 맡겼습니다.` : '');
  const acts = [];
  if (state === 'open') {
    // 근거 없는 문장도 고친 문장이 있으면 넣을 수 있다. 보이기만 하고 단추가 없던 것(11-23 앱 창 확인)
    if (n.fix && n.canReplace) acts.push(['고친 문장으로 바꾸기', 'biz-choose', n.key + '|fix', 'main']);
    if (n.canReplace) acts.push(['직접 고치기', 'biz-edit', n.key, 'ghost']);
    // 「만들어서 사실로 맡기기」는 뜻이 안 읽혔다(11-23 미학 맹검 2차 「이해」). 맡을 부서 이름과 할 일로 말한다
    const handTo = depts.find(d => /개발/.test(d.name)) || depts[0];
    if (n.kind === 'unsupported' && handTo) acts.push([`${handTo.name}에 만들어 달라기`, 'biz-hand', n.key, 'ghost']);
    acts.push(['그대로 두기', 'biz-choose', n.key + '|keep', 'quiet']);
  } else if (state !== 'handed') acts.push(['되돌리기', 'biz-choose', n.key + '|undo', 'quiet']);
  return {
    key: n.key, kind: n.kind, label: kindLabel[n.kind], what: n.why, quote: n.quote, fix: n.fix,
    evidence: n.evidence ? { text: n.evidence.replace(/\s*(?:,(?!\d)|(?<!\d),)\s*|\s*[|\t]\s*/g, ' · ').trim(), from: n.sourceName } : null,
    locked: !n.canReplace ? '이 문장은 표나 필드에 걸쳐 있어 Word에서 직접 고쳐 주세요.' : '',
    state, done, acts, sel: ui.sel === n.key,
    editing: ui.edit === n.key ? { text: ui.editText ?? (c?.kind === 'edit' ? c.text : n.fix || n.quote) } : null,
    handing: ui.hand === n.key ? { text: n.handoff, depts: depts.map(d => [d.name, d.id]), dept: ui.handDept || (depts.find(d => /개발/.test(d.name)) || depts[0])?.id || '', provider: ui.handProvider || 'claude' } : null,
  };
}

/* 한 장씩 보일 때의 자리: 장 이름과 문단. 짚은 문장 앞뒤가 길면 줄인다(사업계획서_설계.md 14.1) */
const CUT = 150;
function placeOf(read, n) {
  const sec = read.sections.find(s => s.paras.includes(n.para));
  const text = read.paragraphs[n.para]?.text || '';
  const c = n.choice, next = c?.kind === 'fix' ? n.fix : c?.kind === 'edit' ? c.text : null;
  // 같은 문단에서 이미 고친 다른 문장은 고친 대로 보인다(뒤에서부터 바꿔 자리가 밀리지 않게)
  const rep = o => (o.choice?.kind === 'fix' ? o.fix : o.choice?.kind === 'edit' ? o.choice.text : null);
  const others = read.notes.filter(o => o !== n && o.para === n.para && rep(o) != null);
  const put = (seg, base, list) => list.sort((a, b) => b.from - a.from).reduce((s, o) => s.slice(0, o.from - base) + rep(o) + s.slice(o.to - base), seg);
  let before = put(text.slice(0, n.from), 0, others.filter(o => o.to <= n.from)), after = put(text.slice(n.to), n.to, others.filter(o => o.from >= n.to));
  if (before.length > CUT) before = '… ' + before.slice(-CUT).replace(/^\S*\s/, '');
  if (after.length > CUT) after = after.slice(0, CUT).replace(/\s\S*$/, '') + ' …';
  return { title: sec?.title || '', before, mark: next || n.quote, after, changed: !!next };
}
function itemPlaceOf(read, it) {
  const secs = read.sections.filter(s => it.secs.includes(s.id));
  const first = secs.map(s => s.paras.map(i => read.paragraphs[i]?.text || '').find(t => t.trim())).find(Boolean) || '';
  return { title: secs.map(s => s.title).filter(Boolean).join(' · ') || it.item, before: first.length > CUT * 2 ? first.slice(0, CUT * 2).replace(/\s\S*$/, '') + ' …' : first, mark: '', after: '', changed: false };
}

/* 빈약한 평가 항목 메모(같이 쓰기) */
function itemView(it, ui, drafts) {
  const draft = drafts[it.item];
  const asking = ui.ask === it.item;
  const answers = ui.answers?.[it.item] || draft?.answers || [];
  return {
    key: 'i:' + it.item, kind: 'thin', label: kindLabel.thin, what: it.why, item: it.item,
    state: draft ? 'done' : 'open', done: draft ? `「${it.item}」에 초안을 넣었습니다.` : '',
    sel: ui.sel === 'i:' + it.item,
    acts: draft ? [['초안 빼기', 'biz-draft-remove', it.item, 'quiet']] : it.asks.length ? [['같이 쓰기', 'biz-ask', it.item, 'main']] : [],
    asking: asking ? {
      asks: it.asks.map((a, j) => ({ q: a.q, opts: a.opts.map((o, k) => [o.label, `${it.item}|${j}|${k}`, answers[j] === k]) })),
      draft: it.asks.every((_, j) => Number.isInteger(answers[j])) ? it.asks.map((a, j) => a.opts[answers[j]].sentence).join(' ') : '',
      ready: it.asks.every((_, j) => Number.isInteger(answers[j])),
    } : null,
    draft: draft?.text || '',
  };
}

/* 종이 위 문단: 고른 고침을 그 자리에 넣어 보인다 */
function paperOf(read, notes, drafts, progress, reading, sel = null) {
  const byPara = new Map();
  for (const n of read.notes) { if (!byPara.has(n.para)) byPara.set(n.para, []); byPara.get(n.para).push(n); }
  const lit = reading && progress ? Math.max(0, (progress.part || 1) - 1) : null;
  const secs = read.sections.map((s, si) => {
    const paras = s.paras.map(i => {
      let text = read.paragraphs[i]?.text || '';
      const ns = (byPara.get(i) || []).slice().sort((a, b) => b.from - a.from);
      let changed = false;
      for (const n of ns) {
        const c = n.choice;
        const next = c?.kind === 'fix' ? n.fix : c?.kind === 'edit' ? c.text : null;
        if (next) { text = text.slice(0, n.from) + next + text.slice(n.to); changed = true; }
      }
      const mark = (byPara.get(i) || []).map(n => n.key);
      return { i, text, changed, notes: mark, inTable: !!read.paragraphs[i]?.inTable };
    });
    const item = read.items.find(it => it.secs.includes(s.id) && drafts[it.item]);
    const last = item && Math.max(...read.sections.filter(x => item.secs.includes(x.id)).map(x => x.id)) === s.id;
    // 빈약한 평가 항목이 걸린 절도 고칠 곳이다. 그 항목을 고르면 절에 막대를 세운다(11-23 앱 창 확인)
    const thin = read.items.filter(it => it.thin && it.secs.includes(s.id));
    return { id: s.id, title: s.title, paras, draft: last ? drafts[item.item].text : '', has: paras.some(p => p.notes.length) || thin.length > 0,
      pick: !!sel && thin.some(it => sel === 'i:' + it.item), dim: lit != null && si > lit, on: lit != null && si === lit };
  });
  return { secs };
}

/* 장면 */
export function bizplanScene(snap, task, ui = {}, { departments = [], deptName = '기획부' } = {}) {
  const depts = departments.filter(d => d && d.id !== ui.departmentId).map(d => ({ id: d.id, name: d.name }));
  if (!snap || snap.ok === false) {
    if (snap?.ok === false && snap.code !== 'NOT_AVAILABLE')
      return { stage: 'error', head: ['사업계획서 기록을 읽지 못했습니다.', '기록 지우기를 누르면 처음부터 할 수 있습니다. 계획서와 회사 자료 파일은 그대로 둡니다.'], back: '← 사무실', live: ui.live || '', busy: ui.busy || null, clearAsk: !!ui.clearAsk };
    return { stage: 'loading', head: [snap?.code === 'NOT_AVAILABLE' ? '이 판에서는 사업계획서 기능을 쓸 수 없습니다.' : '사업계획서를 여는 중입니다.', ''], back: '← 사무실', live: ui.live || '' };
  }
  const read = snap.read;
  const running = task && ['queued', 'running', 'terminal', 'paused'].includes(task.status);
  const provider = ui.provider || read?.provider || task?.provider || 'claude';
  const others = snap.list?.settings?.others === true;
  const base = {
    back: '← 사무실', provider, privacy: privacyLine(provider, others), live: ui.live || '', busy: ui.busy || null,
    list: snap.list, broken: !!snap.broken || !!snap.draft?.broken, planChanged: !!snap.planChanged && !running && snap.read?.status !== 'failed',
    criteria: { mode: ui.criteriaMode || snap.list.criteria.mode, text: ui.criteriaText ?? snap.list.criteria.text, open: !!ui.criteriaOpen },
    clearAsk: !!ui.clearAsk, menu: ui.menu || null,
    // 손님 설정(설계 14.7): 다른 회사 심사위원도 부르기, 기본 끔
    others: { on: others, label: '다른 회사 심사위원도 부르기', small: provider === 'codex' ? 'Claude 심사위원 둘도 앉습니다. 켜 두는 동안 이 부서에서 심사하는 계획서는 모두 Claude를 만든 회사로도 갑니다.' : 'GPT 심사위원도 앉습니다. 켜 두는 동안 이 부서에서 심사하는 계획서는 모두 GPT를 만든 회사로도 갑니다.' },
  };
  const scoreTask = task?.featureKind === 'score';
  if (running) {
    const reading = task.status === 'running';
    const p = snap.progress && snap.progress.taskId === task.id ? snap.progress : null;
    // 심사 차례(14.3): 다시 심사이거나, 읽기 업무 줄이 「심사 · 이름」 차례에 왔을 때
    if (reading && (scoreTask || p?.title?.startsWith('심사 · '))) {
      const panel = scoreTask && Array.isArray(snap.scores?.judges) ? snap.scores.judges.map(j => j.id) : null;
      return { ...base, stage: 'judging', ...judgingShow(task, p, snap.list.plan?.name || read?.plan?.name, panel), progress: p, taskId: task.id };
    }
    return {
      ...base, stage: reading ? 'reading' : 'waiting',
      head: reading ? [`${iga(deptName)} 계획서를 읽고 있습니다.`, p ? `${p.total}번 가운데 ${p.part}번째 · ${p.title}` : '종이에서 어디까지 읽었는지 보입니다.']
        : scoreTask ? ['자리가 비면 다시 심사합니다.', '앞에 맡긴 일이 끝나면 심사위원이 읽기 시작합니다.'] : ['자리가 비면 읽습니다.', `앞에 맡긴 일이 끝나면 ${deptName} 직원이 읽기 시작합니다.`],
      paper: read && read.status !== 'failed' && read.plan?.samePlan && !scoreTask ? paperOf({ ...read, notes: [] }, [], {}, p, reading) : null,
      planName: snap.list.plan?.name || '', progress: p, taskId: task.id,
    };
  }
  // 직접 쓰기(14.2): 한 장에 물음 하나. 쓴 글은 「다음」 · 「나중에 쓰기」 때만 본체에 남긴다
  const dr = snap.draft && Array.isArray(snap.draft.chapters) ? snap.draft : { chapters: WRITE.map(() => ''), skipped: [], isPlan: false };
  const textOf = k => ui.writeText?.[k] ?? dr.chapters[k] ?? '';
  const skipped = k => (dr.skipped || []).includes(k);
  if (Number.isInteger(ui.write) && ui.write >= 0 && ui.write < WRITE.length) {
    const q = ui.write;
    const nx = nextWrite(q, dr, ui.writeText, (snap.read?.empty || []).map(e => e.chapter), [...(ui.writeSeen || []), q]);
    return {
      ...base, stage: 'write', edited: !!dr.isPlan && !!snap.draft?.edited, draftName: snap.draft?.name || '', editedNote: editedNote(snap.draft?.name, '이 화면에'), head: [`${q + 1}번째 장, ${WRITE[q].name}`, WRITE[q].q], q, chapter: { ...WRITE[q], no: String(q + 1).padStart(2, '0') }, text: textOf(q),
      segs: WRITE.map((c, k) => ({ name: c.name, state: k === q ? 'on' : textOf(k).trim() ? 'ok' : skipped(k) ? 'skip' : '' })), last: nx < 0,
    };
  }
  const written = WRITE.filter((_, k) => dr.chapters[k]?.trim()).length;
  const resume = Math.max(0, WRITE.findIndex((_, k) => !dr.chapters[k]?.trim() && !skipped(k)));
  base.writing = { written, resume, isPlan: !!dr.isPlan, edited: !!dr.isPlan && !!snap.draft?.edited, name: snap.draft?.name || '', note: editedNote(snap.draft?.name, '쓰기 화면에') };
  const taskNewer = task && read ? task.updatedAt > read.at + 1000 : !!task;
  // 읽기 업무는 읽은 기록을 먼저 쓰고 심사위원을 부른다. 심사 중에 멈추거나 못 해도 이 업무가 쓴 읽은 기록은 그대로 보인다(Opus 대체 화면 검수 P1)
  const ownRead = !!task && !scoreTask && !!read && typeof read.id === 'string' && read.id.endsWith('-' + task.id) && ['ok', 'partial'].includes(read.status);
  // 다시 심사가 멈추거나 못 해도 읽은 결과와 고른 것은 그대로다. 고칠 곳 화면에 한 줄로 알린다
  if (task && taskNewer && task.status === 'interrupted' && !scoreTask && !ownRead) {
    return { ...base, stage: 'stopped', head: ['읽기를 멈췄습니다.', '다시 읽기를 누르면 처음부터 읽습니다.'], paper: null };
  }
  if (task && taskNewer && task.status === 'failed' && !scoreTask && !ownRead) {
    return { ...base, stage: 'failed', head: ['이번에는 읽지 못했습니다.', reasonText(task.reason, { provider: task.provider })], paper: null };
  }
  const scores = snap.scores && Array.isArray(snap.scores.judges) ? snap.scores : null;
  base.notice = ownRead && taskNewer && task.status === 'interrupted' ? '심사를 멈췄습니다. 찾은 고칠 곳은 그대로 봅니다.'
    : ownRead && taskNewer && task.status === 'failed' ? '심사는 하지 못했습니다. 찾은 고칠 곳은 그대로 봅니다.'
    : !scoreTask || !taskNewer ? '' : task.status === 'interrupted' ? '다시 심사를 멈췄습니다.' : task.status === 'failed' ? '이번에는 다시 심사하지 못했습니다.'
    : task.status === 'completed' && Number.isFinite(task.createdAt) && (!scores || scores.at < task.createdAt - 1000) ? (task.answer || '이번에는 다시 심사하지 못했습니다.') : '';
  if (!read) {
    // 계획서를 고른 뒤에도 「넣어 주세요」가 남던 것(11-23 앱 창 확인). 고른 뒤에는 다음에 누를 것을 말한다
    const dataCount = snap.list.data?.length || 0;
    if (dr.isPlan && snap.list.plan) {
      return { ...base, stage: 'start', draftReady: true, head: ['사업계획서 초안이 생겼습니다.', '직원이 읽고 고칠 곳과 비어 있는 장을 짚습니다. 몇 분 걸립니다.'], paper: null,
        chapters: WRITE.map((c, k) => ({ name: c.name, first: firstLine(dr.chapters[k]) })) };
    }
    const head = !snap.list.plan ? ['사업계획서 파일을 넣어 주세요.', '회사 자료와 견주어 다른 숫자와 빠진 내용을 짚고, 고친 문장을 새 파일로 저장합니다.']
      : dataCount ? ['준비가 끝났습니다.', `직원이 계획서를 회사 자료 ${wa(countWord(dataCount))} 견주어 다른 숫자와 빠진 내용을 찾습니다. 몇 분 걸립니다.`]
      : ['회사 자료를 더하면 숫자까지 견줍니다.', '자료 없이도 근거 없는 문장과 빈약한 평가 항목은 찾습니다.'];
    return { ...base, stage: 'start', head, paper: null };
  }
  if (read.status === 'failed') {
    return { ...base, stage: 'failed', head: ['이번에는 읽지 못했습니다.', reasonText(read.reason, { provider: read.provider, failedChunks: read.failedChunks, totalChunks: read.totalChunks, dataName: read.dataName })], paper: null };
  }
  const drafts = snap.drafts || {};
  const notes = read.notes.map(n => ({ ...noteView(n, ui, depts), place: placeOf(read, n) }));
  const thin = read.items.filter(it => it.thin).map(it => ({ ...itemView(it, ui, drafts), place: itemPlaceOf(read, it) }));
  const empty = (read.empty || []).filter(e => Number.isInteger(e.chapter) && e.chapter >= 0 && e.chapter < WRITE.length).map(e => {
    // 「나중에 쓰기」는 draft.json만 바꾸고 계획서 파일은 그대로다. 초안을 다시 만들어 계획서가 바뀌었을 때만 「썼습니다」(카본 A2)
    const filled = !!dr.chapters[e.chapter]?.trim() && !!snap.planChanged;
    return {
      key: 'e:' + e.chapter, kind: 'empty', label: kindLabel.empty, chapter: e.chapter, name: WRITE[e.chapter].name,
      what: `「${WRITE[e.chapter].name}」 장이 비어 있어요. 한두 문장만 적어 주세요.`, state: filled ? 'done' : 'open',
      done: filled ? `「${WRITE[e.chapter].name}」 장을 썼어요. 다시 읽으면 반영돼요.` : '',
      acts: filled ? [] : [['직접 쓰기', 'biz-write-open', e.chapter, 'main']], sel: false,
      place: { title: `${String(e.chapter + 1).padStart(2, '0')} ${WRITE[e.chapter].name}`, before: WRITE[e.chapter].q, mark: '', after: '', changed: false },
    };
  });
  const all = [...empty, ...notes, ...thin];
  const open = all.filter(n => n.state === 'open').length;
  // 다 고른 뒤에는 고른 장이 없다(끝 화면). 「다시 보기」로 한 장을 고르면 그 장을 보인다(14.1)
  // 「끝으로」(biz-go '')는 남은 고칠 곳이 있어도 끝 화면을 보인다
  const sel = ui.sel === '' ? null : ui.sel && all.some(n => n.key === ui.sel) ? ui.sel : all.find(n => n.state === 'open')?.key || null;
  for (const n of all) n.sel = n.key === sel;
  const items = read.items.filter(it => !it.unread).map(it => ({ item: it.item, state: it.thin ? '약함' : '있음', secs: it.secs }));
  const unreadItems = read.items.filter(it => it.unread).length;
  const changes = read.notes.filter(n => ['fix', 'edit'].includes(n.choice?.kind)).length + Object.keys(drafts).length;
  const partial = read.status === 'partial' ? `묶음 ${countWord(read.totalChunks)} 가운데 ${eunneun(countWord(read.failedChunks))} 읽지 못했습니다. 다시 읽으면 그 묶음도 봅니다.` : '';
  let head;
  if (snap.saved) head = ['고친 계획서를 새 파일로 저장했습니다.', `원본은 그대로 두고 같은 폴더에 고친 판을 만들었습니다.${snap.saved.skipped ? ` 바꿀 수 없는 고침 ${eunneun(countWord(snap.saved.skipped))} 빼고 저장했습니다.` : ''}`];
  else if (!all.length) head = [read.dataNames.length ? '회사 자료와 다른 숫자를 찾지 못했습니다.' : '회사 자료 없이 읽어 숫자는 견주지 않았습니다.',
    partial || (unreadItems ? `평가 항목 ${eunneun(countWord(unreadItems))} 읽지 못했습니다.` : `평가 항목 ${countWord(items.length)} 모두 계획서에 있습니다.`)];
  else if (open) head = [`고칠 곳이 ${countWord(open)} 있습니다.`, partial || '메모를 하나씩 보고 고치면 새 파일로 저장할 수 있습니다.'];
  else head = ['고를 것을 다 골랐습니다.', changes ? '새 파일로 저장하면 원본 옆에 고친 판이 생깁니다.' : '바꾼 문장이 없어 저장할 것이 없습니다.'];
  const changed = [
    ...read.notes.filter(n => ['fix', 'edit'].includes(n.choice?.kind)).map(n => ({ text: n.choice.kind === 'fix' ? n.fix : n.choice.text, tag: '' })),
    ...read.notes.filter(n => n.choice?.kind === 'handed').map(n => ({ text: n.quote, tag: `${eseo(depts.find(d => d.id === n.choice.departmentId)?.name || '다른 부서')} 맡김`, hand: true })),
    ...Object.entries(drafts).map(([item, d]) => ({ text: d.text, tag: `「${item}」에 넣음` })),
  ];
  // 점수가 나오면 먼저 짧은 무대(방이 박자를 센다), 그다음 점수 결과. 「고칠 곳 n 보기」로 고칠 곳에 온다
  if (scores && ui.reveal && ui.reveal.at === scores.at) {
    const plan = revealPlan(scores, read);
    if (plan) return { ...base, stage: 'reveal', ...revealShow(scores, read, plan, ui.reveal.step || 0, 'scores:' + scores.at) };
  }
  if (scores && ui.results === scores.at) {
    const v = scoreView(scores, read, ui, open, all.length);
    return { ...base, stage: 'score', head: v.head, score: v };
  }
  return {
    ...base, stage: 'notes', head, notes: all, sel, at: Math.max(0, all.findIndex(n => n.key === sel)), open, changed, sheet: !!ui.sheet, toast: ui.toast || null, items, changes, saved: snap.saved || null,
    planName: read.plan.name, samePlan: read.plan.samePlan, dataNames: read.dataNames,
    paper: paperOf(read, notes, drafts, null, false, sel),
    // 점수 다시 보기와 다시 심사(14.3): 고른 고침이 있고 계획서가 그대로일 때만 다시 심사한다
    scoreLink: scores ? { avg: scores.sum ? f1(scores.sum.avg) : '' } : null,
    rescore: changes > 0 && !base.planChanged && !snap.planChanged,
  };
}

/* 사무실의 부서 안쪽 기능 줄(기능줄_경쟁사_설계.md 6.3과 같은 꼴): 한 문장과 때 */
export function bizplanLine(task, now = Date.now()) {
  const hm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  if (!task) return { line: '계획서를 넣으면 회사 자료와 견주어 고칠 곳을 짚어 드립니다', when: '시작' };
  const score = task.featureKind === 'score';
  if (task.status === 'queued') return { line: score ? '자리가 비면 다시 심사합니다' : '자리가 비면 읽습니다', when: '기다림' };
  if (task.status === 'running') return score ? { line: '고친 계획서로 다시 심사받고 있습니다', when: '심사 중' } : { line: '계획서를 읽고 있습니다', when: '읽는 중' };
  if (task.status === 'completed') return { line: task.answer.replace(/\.$/, ''), when: hm(task.updatedAt) + (score ? ' 심사' : ' 읽음'), alert: !!task.featureAlert };
  // 읽기를 멈춘 업무는 심사 중에 멈췄을 수도 있다. 열어서 보게 하고 다시 읽으라고 하지 않는다(Opus 대체 화면 검수 P1)
  if (task.status === 'interrupted') return score ? { line: '다시 심사를 멈췄습니다', when: '고칠 곳' } : { line: '읽기를 멈췄습니다', when: '열어 보기' };
  return score ? { line: '이번에는 다시 심사하지 못했습니다', when: '고칠 곳' } : { line: '이번에는 읽지 못했습니다', when: '다시 읽기' };
}
export const attachesBizplan = dept => /기획/.test(String(dept?.name || ''));
