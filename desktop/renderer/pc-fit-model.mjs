// 「이 PC에 이렇게 맞췄습니다」 판(솔리오 PC 진단 설계 5.2 · 8절 셋째 조각). 본체 src/pc-profile.cjs가 잰 값을 받아
// 갈래마다 잰 값과 「그래서 이렇게 맞췄습니다」를 함께 쓴다. 이 PC에서 안 되는 것은 솔리오가 실제로 주는 기능에 대해서만 쓴다.
// 지금 실제로 하는 일만 쓴다: 사무실 수용 인원(office-model officeCapacity), 원클릭 판의 드라이브, 업무 백업 엔진의 전원 · 회선 쉼(엔진 power.rs).
// 아직 없는 맞춤(가벼운 구 판 따위)은 쓰지 않는다. 사무실 · 원클릭(업무 백업)은 볼 계정에만 열려 있어, 그 계정이 아니면 그 기능의 문장을 쓰지 않는다
// (Fable 최종 P1 — 컨트롤러가 features로 넘긴다). 시험: desktop/tests/pc-fit-model.test.mjs
import { officeCapacity, countWord } from './office-model.mjs';
import { josa } from './solio-today.mjs';
import { hiddenSentence } from './solio-backup-model.mjs';

const GB = 1024 ** 3;
const pad = n => String(n).padStart(2, '0');
const flags = (...list) => list.filter(Boolean).join(' ');
const rowLabel = parts => parts.filter(Boolean).join(', ') + '. 자세한 내용은 이 줄 아래에 펼쳐집니다.';
const known = v => typeof v === 'number' && Number.isFinite(v);
/* 1000GB부터는 TB로 쓴다(원클릭 판과 같다) */
export const sizeWords = n => (n >= 1000 * GB ? `${(n / 1024 ** 4).toFixed(1)}TB` : `${Math.round(n / GB)}GB`);
const freeWords = n => (n >= 100 * GB ? `${Math.round(n / GB)}GB` : `${(n / GB).toFixed(1)}GB`);
const particle = (word, pair) => josa(word, pair).slice(word.length);
/* 그래픽 메모리는 MB로 받는다. 1GB 아래(내장 그래픽의 128MB 따위)는 MB로 쓴다(Fable 최종 P2-5) */
const gpuWords = mb => (mb >= 1024 ? `${Math.round(mb / 1024)}GB` : `${mb}MB`);

const PC_KIND = p => (p?.power?.laptop === true ? '노트북' : p?.power?.laptop === false ? '데스크톱' : 'PC');
const memOf = p => (known(p?.mem?.totalGb) ? Math.round(p.mem.totalGb) : null);
const coresOf = p => (Number.isSafeInteger(p?.cpu?.cores) && p.cpu.cores > 0 ? p.cpu.cores : null);
const shownDrives = p => (Array.isArray(p?.drives?.shown) ? p.drives.shown : []);
const row = (key, nm, mid, more, val = '') => ({ key, nm, mid, val, when: '', label: rowLabel([nm, mid, val]), more });

/* 맨 위 두 문장(설계 5.2): 「이 PC는 논리 코어 24개 · 메모리 64GB 노트북입니다.」 「드라이브 둘(C: 953GB, D: 1.9TB)을 씁니다.」 */
export function pcSummary(p) {
  const cores = coresOf(p), mem = memOf(p), drives = shownDrives(p);
  // 한쪽만 읽혔으면 읽힌 쪽을 쓰고 못 읽은 쪽만 말한다. 아래 「처리」 줄과 어긋나지 않게(카본 A4)
  const say = cores && mem != null ? `이 PC는 논리 코어 ${cores}개 · 메모리 ${mem}GB ${PC_KIND(p)}입니다.`
    : cores ? `이 PC는 논리 코어 ${cores}개 ${PC_KIND(p)}입니다. 메모리는 읽지 못했습니다.`
      : mem != null ? `이 PC는 메모리 ${mem}GB ${PC_KIND(p)}입니다. 프로세서는 읽지 못했습니다.` : '이 PC의 프로세서와 메모리를 읽지 못했습니다.';
  if (!drives.length) return { say, drives: p?.drives ? '판에 세울 드라이브를 찾지 못했습니다.' : '드라이브 목록을 읽지 못했습니다.' };
  const w = countWord(drives.length);
  return { say, drives: `드라이브 ${w}(${drives.map(d => `${d.letter}: ${sizeWords(d.size)}`).join(', ')})${particle(w, ['을', '를'])} 씁니다.` };
}

/* 바뀜(설계 6절). 사무실 수용 인원은 늘 지금 값으로 세므로 따로 말하지 않는다 */
function changedWords(changed) {
  const list = Array.isArray(changed) ? changed : [];
  const parts = list.map(c => (c.what === 'memory' ? `메모리가 ${c.from}GB에서 ${c.to}GB로 바뀌었습니다.`
    : c.what === 'gpu' ? `그래픽 메모리가 ${gpuWords(c.from)}에서 ${gpuWords(c.to)}로 바뀌었습니다.` : '')).filter(Boolean);
  return parts.length ? `이 PC의 ${parts.join(' ')}` : '';
}

/* C:가 빠듯하고 다른 드라이브가 넉넉하면 새 프로젝트와 다운로드를 그쪽에 두라고 한 번 권한다(설계 4.1). 엔진의 정한 선은 이 판에 없어
   PC 앱 값으로만 본다: C:의 남은 공간이 32GB와 크기의 10% 가운데 큰 쪽보다 적고, 다른 드라이브가 100GB 넘게 그리고 C:의 세 배 넘게 남았을 때 */
function roomyOther(p) {
  const drives = shownDrives(p), c = drives.find(d => d.letter === 'C');
  if (!c || c.free >= Math.max(32 * GB, c.size * 0.1)) return null;
  return drives.filter(d => d.letter !== 'C' && d.free >= 100 * GB && d.free >= c.free * 3).sort((a, b) => b.free - a.free)[0] || null;
}

function diskRow(p, st, f) {
  const d = p.drives;
  if (!d) return row('disk', '저장', '드라이브를 읽지 못했습니다', [['note', `회사 PC처럼 PowerShell이 막힌 PC에서는 드라이브 목록을 읽지 못합니다.${f.backup ? ' 업무 백업 엔진이 공간을 재면 원클릭 판에는 엔진 값이 보입니다.' : ''}`]]);
  const shown = shownDrives(p), other = roomyOther(p);
  const mid = shown.length ? `드라이브 ${countWord(shown.length)}${other ? ' · C:가 거의 참' : ''}` : '세울 드라이브 없음';
  // 선은 남은 몫을 긋는다. 원클릭 판 막대와 같은 방향이다(Fable 최종 P2-1)
  const more = shown.map(x => ['gauge', `${x.letter}:`, x.size ? Math.round((x.free / x.size) * 100) : 0, `${freeWords(x.free)} 남음`, sizeWords(x.size)]);
  const hid = hiddenSentence(d.hidden);
  if (hid) more.push(['note', hid]);
  if (d.unread > 0) more.push(['note', `크기를 읽지 못한 드라이브가 ${d.unread}개 있습니다. BitLocker로 잠긴 드라이브는 풀기 전까지 읽지 못합니다.`]);
  const skip = [d.removable > 0 ? `USB 메모리 · SD 카드 ${d.removable}개` : '', d.network > 0 ? `네트워크 드라이브 ${d.network}개` : ''].filter(Boolean);
  if (skip.length) more.push(['note', `${skip.join('와 ')}는 재지 않습니다.`]);
  if (shown.length && f.backup) more.push(['note', `그래서 원클릭 판에 ${shown.length > 1 ? '이 드라이브들을 모두' : '이 드라이브를'} 보입니다. 외장 · USB · 가상 드라이브의 파일은 지우지 않습니다.`]);
  if (other) {
    more.push(['note', `새 프로젝트와 다운로드는 ${other.letter}:에 두면 C:가 덜 찹니다. Windows 설정의 「새 콘텐츠를 저장할 위치」에서 바꿉니다. 솔리오는 폴더를 옮기지 않습니다.`]);
    more.push(['acts', [['Windows 저장 위치 열기', 'pc-storage', '', flags(st.busy && 'off')]]]);
  }
  more.push(['live', st.notes?.get?.('disk') || '']);
  return row('disk', '저장', mid, more, other ? '권할 것 하나' : '');
}

function cpuRow(p, f) {
  const cores = coresOf(p), mem = memOf(p);
  if (!cores) return row('cpu', '처리', '프로세서를 읽지 못했습니다', [['note', f.office ? '사무실은 수를 셀 수 없을 때 한 번에 한 사람씩 맡깁니다. 사무실 방의 수용 인원 줄에서 직접 정할 수 있습니다.' : '「다시 진단」을 누르면 다시 잽니다.']]);
  const free = known(p.mem?.freeGb) ? ` · 지금 ${Math.round(p.mem.freeGb * 10) / 10}GB 비어 있음` : '';
  const mid = `논리 코어 ${cores}개 · ${mem == null ? '메모리를 읽지 못했습니다' : `메모리 ${mem}GB`}`;
  const memRow = ['row', '메모리', mem == null ? '읽지 못했습니다' : `${mem}GB${free}`];
  // 사무실을 볼 계정이 아니면 잰 값만 보인다(Fable 최종 P1)
  if (!f.office) return row('cpu', '처리', mid, [['row', '프로세서', `논리 코어 ${cores}개`, '', ''], [...memRow, '', '']]);
  // 사무실에서 수를 직접 정했으면 그 수가 이긴다. 판도 사무실 방과 같은 수를 쓴다(Fable 최종 P2-3)
  const c = officeCapacity({ cores, totalMemGb: mem, manual: f.officeCap ?? null });
  const byCores = Math.floor(cores / 2), byMem = mem == null ? null : Math.floor(mem / 4);
  const basis = byMem == null ? '' : byMem < byCores ? `메모리 ${mem}GB` : byMem > byCores ? `논리 코어 ${cores}개` : `논리 코어 ${cores}개와 메모리 ${mem}GB`;
  const mine = c.source === 'manual';
  const val = mine ? `사무실 ${countWord(c.cap)}까지 · 직접 정함` : c.memKnown ? `사무실 ${countWord(c.pcCap)}까지` : '';
  const why = mine ? `사무실에서는 직접 정한 ${countWord(c.cap)}까지 함께 일합니다.${c.memKnown ? ` 이 PC만 보면 ${countWord(c.pcCap)}입니다. ${basis}를 보고 셈했습니다.` : ''}`
    : !c.memKnown ? '메모리를 읽지 못해 사무실은 자동으로는 세지 않습니다. 사무실 방의 수용 인원 줄에서 직접 정할 수 있습니다.'
      : `그래서 사무실에서는 ${countWord(c.pcCap)}까지 함께 일합니다. ${basis}를 보고 정했습니다. 구독이 적게 남으면 그보다 줄고, 사무실 방의 수용 인원 줄에서 직접 정할 수도 있습니다.`;
  return row('cpu', '처리', mid, [
    ['row', '프로세서', `논리 코어 ${cores}개`, `둘마다 한 사람 · ${byCores >= 1 ? countWord(byCores) : '없음'}`, ''],
    [...memRow, mem == null ? '' : `4GB마다 한 사람 · ${byMem >= 1 ? countWord(byMem) : '없음'}`, ''],
    ['note', why],
  ], val);
}

function gpuRow(p) {
  const g = p.gpu, failed = Array.isArray(p.failed) && p.failed.includes('gpu');
  const mid = g ? (known(g.memMb) && g.memMb > 0 ? `그래픽 메모리 ${gpuWords(g.memMb)}${g.adapters > 1 ? ` · 장치 ${g.adapters}개` : ''}` : g.adapters ? `그래픽 장치 ${g.adapters}개 · 메모리 값 없음` : '그래픽 장치를 찾지 못했습니다')
    : failed ? '읽지 못했습니다' : '읽는 중';
  return row('gpu', '그래픽', mid, [['note', '솔리오에는 아직 그래픽 카드로 하는 일이 없어 값만 봅니다. 장치 이름은 읽지 않습니다.']]);
}

/* 전원 · 회선 줄은 업무 백업을 볼 계정에만 둔다. 그 밖의 계정에게는 이 값으로 맞추는 일이 없다(Fable 최종 P1) */
function powerRow(p) {
  const w = p.power;
  if (!w || w.laptop == null) return row('power', '전원', '모릅니다', [['note', '배터리로만 돌 때 30% 아래이거나 절전 모드가 켜지면 업무 백업은 쉽니다.']]);
  const mid = w.laptop ? `노트북${w.battery ? ' · 배터리 있음' : ''}` : `데스크톱${w.battery ? ' · 배터리(UPS 따위) 있음' : ''}`;
  const note = w.laptop ? '그래서 전원선을 뺀 채 배터리가 30% 아래이거나 절전 모드가 켜지면 업무 백업을 쉽니다. 다음 회차에 이어서 합니다.'
    : w.battery ? '정전으로 배터리로만 돌 때 30% 아래면 업무 백업을 쉽니다.' : '배터리가 없어 전원 때문에 업무 백업을 쉬는 일은 없습니다.';
  return row('power', '전원', mid, [['note', note]]);
}

const NET_NAME = Object.freeze({ wifi: 'Wi-Fi', wired: '유선', cellular: '모바일 데이터', offline: '인터넷에 연결되지 않음' });
function netRow(p) {
  const n = p.net;
  const mid = !n ? '읽지 못했습니다' : `${NET_NAME[n.kind] || '모름'}${n.metered === true ? ' · 종량제' : n.metered === false ? ' · 종량제 아님' : ''}`;
  const note = n?.metered === true ? '그래서 업무 백업을 쉽니다. 종량제가 아닌 회선에 이으면 다음 회차에 이어서 합니다.'
    : '종량제 회선에 이으면 그동안 업무 백업은 쉽니다. Wi-Fi 이름은 읽지 않습니다.';
  return row('net', '회선', mid, [['note', note]]);
}

function screenRow(p, f) {
  const s = p.screen;
  const mid = s ? `${s.width}×${s.height} · 배율 ${s.scale}%` : '읽지 못했습니다';
  const board = !f.backup ? '' : s?.narrow ? '화면 폭이 좁아 원클릭 판을 한 단으로 쌓아 보입니다. ' : '창 폭에 맞춰 원클릭 판을 두 단이나 한 단으로 놓습니다. ';
  return row('screen', '화면', mid, [['note', `${board}글자 크기는 설정의 「화면」에서 바꿉니다.`]]);
}

function osRow(p, f) {
  const o = p.os;
  const mid = o ? `${o.version}${o.arm ? ' · ARM' : ''}` : '읽지 못했습니다';
  const apps = f.backup ? 'SYNK 앱과 업무 백업 엔진' : 'SYNK 앱';
  // 펼치는 줄에는 늘 내용이 있다(카본 A1)
  return row('os', '운영체제', mid, [['note', !o ? '운영체제 판을 읽지 못했습니다. PowerShell이 막힌 PC에서는 읽지 못합니다.'
    : o.arm ? `ARM PC라 ${apps}이 에뮬레이션으로 돕니다. 느릴 수 있습니다.` : `${apps}은 64비트 Windows 10 · 11에서 돕니다.`]]);
}

const AI_TOOLS = Object.freeze([['claude', 'Claude Code'], ['codex', 'Codex'], ['gemini', 'Gemini CLI']]);
const DEV_TOOLS = Object.freeze([['vscode', 'VS Code'], ['cursor', 'Cursor'], ['node', 'Node'], ['python', 'Python'], ['git', 'Git'], ['wsl', 'WSL']]);
function toolsRow(p, f) {
  const t = p.tools || {};
  const have = [...AI_TOOLS.filter(([k]) => t[k]?.installed), ...DEV_TOOLS.filter(([k]) => t[k] === true)].map(([, n]) => n);
  const mid = have.length ? have.join(' · ') : '찾은 도구 없음';
  const more = AI_TOOLS.map(([k, n]) => ['row', n, !t[k] ? '모름' : t[k].installed ? `있음 · 로그인한 흔적 ${t[k].signedIn ? '있음' : '없음'}` : '없음', '', '']);
  const dev = DEV_TOOLS.filter(([k]) => t[k] === true).map(([, n]) => n);
  more.push(['row', '개발 도구', dev.length ? dev.join(' · ') : '없음', '', '']);
  if (f.office) {
    const office = [['claude', 'Claude Code'], ['codex', 'Codex']], ready = office.filter(([k]) => t[k]?.installed), missing = office.filter(([k]) => t[k] && !t[k].installed);
    if (ready.length) more.push(['note', `사무실 직원은 이 PC의 ${ready.map(([, n]) => n).join('와 ')}로 일합니다.`]);
    if (missing.length) { const names = missing.map(([, n]) => n).join('와 '); more.push(['note', `${names}${particle(names, ['이', '가'])} 이 PC에 없습니다. 사무실 직원으로 쓰려면 구독 방의 계정 관리에서 설치하고 로그인합니다.`]); }
  }
  more.push(['note', '로그인은 자격 파일이 있는지만 보고 내용은 읽지 않습니다.']);
  return row('tools', '도구', mid, more);
}

/* 판 하나(aside 'pc'). snap: 본체 pcProfile.snapshot()의 답 { ok, available, reading, profile, changed }.
   st: 방 상태(busy · notes · changedShown)와 features { backup: 원클릭(업무 백업)이 이 계정에 보이는가, office: 사무실이 보이는가, officeCap: 사무실에서 직접 정한 수 } */
export function pcRoom(snap = null, st = {}, now = Date.now()) {
  const f = st.features && typeof st.features === 'object' ? st.features : {};
  // 다른 방의 일이 도는 동안에도 「다시 진단」은 흐리게 둔다. 「다시 재는 중」은 이 판의 일일 때만 쓴다(카본 A3)
  const busy = st.busy === 'pc:pc-again' || snap?.reading === true;
  const act = ['다시 진단', 'pc-again', flags((busy || !!st.busy) && 'off')];
  if (snap && snap.ok === true && snap.available === false) return { say: '이 PC는 아직 진단하지 않습니다.', then: 'Windows PC에서만 잽니다.', rows: [], foot: '', act: null };
  const p = snap?.ok === true ? snap.profile : null;
  if (!p) {
    const failed = snap && snap.ok === false;
    return { say: failed ? '이 PC의 사양을 읽지 못했습니다.' : '이 PC의 사양을 읽고 있습니다.', then: failed ? '잠시 뒤 「다시 진단」을 눌러 주세요.' : '이 PC 밖으로 보내지 않습니다. 몇 초면 끝나고 PC를 바꾸지 않습니다.', rows: [], foot: st.roomNote || '', act };
  }
  const sum = pcSummary(p), change = changedWords(st.changedShown || snap.changed);
  const at = Date.parse(p.readAt || '');
  const when = Number.isFinite(at) ? (d => `${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`)(new Date(at)) : '';
  const foot = st.roomNote || (busy ? '다시 재는 중입니다.' : [when ? `${when}에 쟀습니다.` : '', '이 PC 밖으로 보내지 않습니다.'].filter(Boolean).join(' '));
  return {
    say: sum.say, then: [change, sum.drives].filter(Boolean).join(' '),
    rows: [diskRow(p, st, f), cpuRow(p, f), gpuRow(p), f.backup ? powerRow(p) : null, f.backup ? netRow(p) : null, screenRow(p, f), osRow(p, f), toolsRow(p, f)].filter(Boolean),
    foot, act,
  };
}

/* 설정 방의 줄 하나. 누르면 「이 PC에 이렇게 맞췄습니다」 판을 연다. 읽는 중과 읽지 못함을 판과 같은 말로 쓴다(Fable 최종 P2-4) */
/* features는 판과 같다. 맞춰 주는 기능(원클릭 · 사무실)이 없는 계정에게는 잰 값만 모았다고 쓴다(Fable 다시 검수 FA1) */
export function pcSettingsRow(snap = null, st = {}, features = null) {
  const fits = !!(features && (features.backup || features.office));
  if (snap && snap.ok === true && snap.available === false) return null;
  const p = snap?.ok === true ? snap.profile : null, cores = coresOf(p), mem = memOf(p), n = shownDrives(p).length;
  const mid = p ? [cores ? `논리 코어 ${cores}개` : '', mem != null ? `메모리 ${mem}GB` : '', n ? `드라이브 ${countWord(n)}` : ''].filter(Boolean).join(' · ') || '읽지 못한 값이 있습니다'
    : snap && snap.ok === false ? '읽지 못했습니다' : snap?.ok === true ? '아직 재지 않았습니다' : '읽는 중입니다';
  const val = Array.isArray(snap?.changed) && snap.changed.length ? '바뀜' : '';
  return { key: 'pc', nm: '이 PC', mid, val, when: '', label: rowLabel(['이 PC', mid, val]), more: [
    ['note', fits ? '솔리오가 이 PC를 어떻게 보고 기능마다 무엇을 맞췄는지 한 장에 모았습니다. 이 PC 밖으로 보내지 않습니다.' : '솔리오가 잰 이 PC의 사양을 한 장에 모았습니다. 이 PC 밖으로 보내지 않습니다.'],
    ['acts', [['내 PC 진단 보기', 'pc-open', '', '']]],
    ['live', st.notes?.get?.('pc') || ''],
  ] };
}
