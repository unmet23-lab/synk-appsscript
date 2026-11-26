// 솔리오 「사무실」에서 눌린 직원이 하는 한마디(솔리오_사무실한마디_20261126). DOM이 없다.
// 화면이 이미 아는 것만 말한다: 직원의 상태(office-model.mjs), 마지막 도구와 파일, 그 부서에 맡긴 일. AI를 부르지 않고 지어내지 않는다.
// 같은 직원을 다시 누르면 다음 말을 한다(lines의 차례). 끝나면 알리겠다는 약속은 하지 않는다 — 앱이 지키지 못하는 세션이 있다.
import { countWord, officeFolderName, officeOwnWorkCwd } from './office-model.mjs';
import { officeTaskTurn } from './office-chat-model.mjs';

const TOOL_NAME = Object.freeze({ claude: 'Claude Code', codex: 'Codex' });
const RECENT = 24 * 3600e3;
const clip = (t, n = 22) => { const a = [...String(t ?? '').replace(/\s+/g, ' ').trim()]; return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join(''); };
const firstLine = t => String(t ?? '').split('\n').map(l => l.trim()).find(Boolean) || '';

/* officeActivity의 글(「shop · 쓰기 · 블로그.md」)에서 도구 낱말과 파일을 가른다. 폴더 이름이 앞에 있으면 뗀다 */
function actOf(v) {
  const act = String(v.activity || ''), folder = String(v.folder || '');
  const rest = folder && (act === folder || act.startsWith(folder + ' · ')) ? act.slice(folder.length).replace(/^ · /, '') : act;
  const at = rest.indexOf(' · ');
  return at < 0 ? { word: rest, what: '' } : { word: rest.slice(0, at), what: rest.slice(at + 3) };
}
function doing(v) {
  const { word, what } = actOf(v), f = what ? friendly(what) : null;
  switch (word) {
    case '쓰기': return f ? `${obj(f.what)} ${f.kind === '코드' || f.kind === '설정' ? '고치고' : f.kind === '그림' || f.kind === '영상' || f.kind === '소리' ? '만들고' : '쓰고'} 있었습니다.` : '파일을 쓰고 있었습니다.';
    case '읽기': return f ? `${obj(f.what)} 읽고 있었습니다.` : '파일을 읽고 있었습니다.';
    case '명령': return '명령을 돌려 확인하고 있었습니다.';
    case '찾기': return '파일을 찾아보고 있었습니다.';
    case '웹 읽기': return '웹 글을 읽고 있었습니다.';
    case '웹 찾기': return '웹에서 찾아보고 있었습니다.';
    case '도우미': return '도우미와 일하고 있었습니다.';
    default: return '';
  }
}
/* 파일 이름을 사람 말로: 「블로그_11월.md」 → 「‘블로그 11월’ 문서」. 확장자로 무엇인지만 말하고, 모르는 것은 「파일」이다 */
const KIND = [
  [/^(md|txt|docx?|hwpx?|pdf|rtf|odt|pages)$/, '문서'], [/^(html?|css|scss|vue|svelte)$/, '화면'],
  [/^(js|mjs|cjs|ts|tsx|jsx|py|java|kt|go|rs|c|cc|cpp|h|cs|rb|php|swift|dart|sh|ps1|sql)$/, '코드'],
  [/^(json|ya?ml|toml|ini|env|cfg|conf|xml|lock)$/, '설정'], [/^(csv|tsv|xlsx?|ods|numbers)$/, '표'],
  [/^(png|jpe?g|gif|svg|webp|avif|heic|psd|ai|fig)$/, '그림'], [/^(mp4|mov|webm|mkv|avi)$/, '영상'], [/^(mp3|wav|m4a|ogg|flac)$/, '소리'],
  [/^(pptx?|key|odp)$/, '발표 자료'],
];
const hasBatchim = w => { const c = String(w).trim().slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 > 0; };
function friendly(file) {
  const name = String(file || '').split(/[\\/]/).pop();
  const dot = name.lastIndexOf('.'), ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '', stem = (dot > 0 ? name.slice(0, dot) : name).replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  const kind = (KIND.find(([re]) => re.test(ext)) || [null, '파일'])[1];
  return stem ? { what: `‘${clip(stem, 16)}’ ${kind}`, kind } : { what: kind, kind };
}
const obj = w => w + (hasBatchim(w) ? '을' : '를');
const quietFor = v => /^(\d+분째) 조용합니다$/.exec(String(v.say || ''))?.[1] || '';
const silentFor = v => /^(\d+분째) 소식이 없습니다$/.exec(String(v.say || ''))?.[1] || '';

/* 직원 하나의 말. tasks: 그 부서 · 그 도구에 맡긴 일(기능 업무는 뺀 것). tasking: 이 앱에서 일을 맡길 수 있는가 */
export function officeGreet(v, { tasks = [], tasking = false, now = Date.now(), done = null } = {}) {
  const name = v.lookName || TOOL_NAME[v.tool] || '직원';
  const tool = TOOL_NAME[v.tool] || '';
  const mine = (Array.isArray(tasks) ? tasks : []).filter(t => t && typeof t === 'object').sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
  const give = tasking ? '일을 주세요.' : tool ? `${tool} 창에서 말씀해 주세요.` : '';
  const lines = [];
  const say = (...parts) => { const line = parts.filter(Boolean).join(' '); if (line && !lines.includes(line)) lines.push(line); };
  const running = mine.find(t => t.status === 'running');
  const ask = t => clip(firstLine(t?.prompt), 18);

  if (v.status === 'asked') {
    say('여쭌 것이 있어서 답을 기다리고 있었습니다.');
    if (tool) say(`${tool} 창에서 승인을 기다리고 있었습니다.`);
  } else if (v.status === 'working') {
    // 무엇을 하는지는 사람이 알아듣는 것부터: 맡기신 일의 말, Claude Code가 붙인 일의 제목, 파일, 그다음 폴더
    const title = clip(v.title, 30), now_ = doing(v);
    if (running && ask(running)) say(`맡기신 「${ask(running)}」 일을 하고 있었습니다.`);
    else if (title) say(`「${title}」 일을 하고 있었습니다.`);
    else say(now_ || (v.departmentId == null && v.folder && !officeOwnWorkCwd(v.cwd) ? `${clip(officeFolderName(v.cwd) || v.folder)} 폴더에서 일하고 있었습니다.` : '맡은 일을 하고 있었습니다.'));
    if ((running || title) && now_) say(`지금은 ${now_.replace(/있었습니다.$/, '있습니다.')}`);
    if (v.subagents > 0) say(`도우미 ${countWord(v.subagents)} 데리고 일하고 있었습니다.`);
    say(tasking ? '일하는 중입니다. 새 일은 아래에 적어 주세요.' : '일하는 중이었습니다.');
  } else if (v.status === 'silent') {
    say(silentFor(v) ? `${silentFor(v)} 진행을 알리지 못했습니다.` : '진행을 알리지 못했습니다.', tool ? `${tool} 창을 한번 봐 주세요.` : '');
  } else {
    const wait = mine.find(t => officeTaskTurn(t, now, done) === 'wait');
    const failed = !wait && mine.find(t => officeTaskTurn(t, now, done) === 'failed');
    const ended = mine.find(t => t.status === 'completed' && now - (Number(t.updatedAt) || 0) < RECENT);
    if (wait) say('확인해 주실 일이 있습니다.', ask(wait) ? `「${ask(wait)}」 일입니다.` : '');
    else if (failed) say('못 끝낸 일이 있습니다.', ask(failed) ? `「${ask(failed)}」 일입니다.` : '');
    else if (v.status === 'done') say('하던 일을 끝냈습니다. 확인해 주세요.');
    if (ended && ask(ended)) say(`「${ask(ended)}」 일은 끝내 두었습니다.`, tasking ? '다음 일을 주세요.' : '');
    // 맡기기가 꺼진 판은 말이 길어 둘로 나눠, 다시 누를 때 둘째를 말한다
    const rest = v.status === 'resting' ? '쉬고 있었습니다.' : v.status === 'quiet' ? (quietFor(v) ? `${quietFor(v)} 조용히 있었습니다.` : '조용히 있었습니다.') : '';
    // 조용한 시간은 방 머리가 이미 말한다. 마지막으로 하던 일(제목)이 있으면 그것이 먼저다. 끝냈는지는 모르므로 「끝냈다」고 하지 않는다
    const last = clip(v.title, 30) && !ended ? `마지막으로 「${clip(v.title, 30)}」 일을 했습니다.` : '';
    if (last) say(last, tasking ? give : '');
    if (tasking) say(rest, give); else { say(rest); say(give); }
  }
  return { name, lines: lines.length ? lines : ['여기 있었습니다.'] };
}

/* 앞선 직원: 책상을 눌렀을 때 말할 직원 */
const RANK = Object.freeze({ asked: 0, done: 1, silent: 2, working: 3, quiet: 4, resting: 5 });

/* 선 직원 모두의 말. seated: officeSeated의 차례. 돌려주는 값: { by: { 직원 번호: { name, lines } }, lead: { 구역 열쇠: 직원 번호 } } */
export function officeGreets(seated, { tasks = null, now = Date.now(), done = null } = {}) {
  const list = Array.isArray(seated) ? seated : [], tasking = Array.isArray(tasks), by = {}, lead = {}, rank = {};
  // 맡긴 일은 부서와 도구로만 직원에 잇는다(화면에 오는 일에는 세션 번호가 없다). 같은 부서에 같은 도구의 직원이 둘 이상이면
  // 누구의 일인지 모르므로 맡긴 일을 잇지 않고 저마다의 제목과 파일로 말한다(Fable 최종 F1)
  const same = new Map();
  for (const v of list) if (v.departmentId != null) { const k = v.departmentId + '|' + v.tool; same.set(k, (same.get(k) || 0) + 1); }
  for (const v of list) {
    const zone = v.departmentId == null ? 'lobby' : 'd:' + v.departmentId;
    const alone = v.departmentId != null && same.get(v.departmentId + '|' + v.tool) === 1;
    const mine = tasking && alone ? tasks.filter(t => t && t.departmentId === v.departmentId && t.provider === v.tool) : [];
    by[v.id] = officeGreet(v, { tasks: mine, tasking, now, done });
    const r = RANK[v.status] ?? 9;
    if (lead[zone] === undefined || r < rank[zone]) { lead[zone] = v.id; rank[zone] = r; }
  }
  return { by, lead };
}
