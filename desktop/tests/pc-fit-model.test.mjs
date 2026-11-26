// 「이 PC에 이렇게 맞췄습니다」 판(renderer/pc-fit-model.mjs, 설계 5.2 · 9절 견본)과 설정 방 줄 · 방 동작 · 원클릭 판의 PC 값 대신 쓰기.
// 견본 값은 꾸민 것이다(이 PC의 실제 값은 쓰지 않는다).
import test from 'node:test';
import assert from 'node:assert/strict';
import { pcRoom, pcSettingsRow, pcSummary } from '../renderer/pc-fit-model.mjs';
import { createOrbRooms } from '../renderer/orb-rooms.mjs';
import { settingsRoom } from '../renderer/solio-rooms.mjs';
import { solioBackupView, hiddenSentence } from '../renderer/solio-backup-model.mjs';

const GB = 1024 ** 3;
const NOW = Date.parse('2026-11-24T05:00:00Z');
const d = (letter, sizeGb, freeGb) => ({ letter, size: sizeGb * GB, free: freeGb * GB });
const none = { installed: false, signedIn: false };
function profile(o = {}) {
  return {
    readAt: new Date(NOW - 60000).toISOString(), slowAt: new Date(NOW - 60000).toISOString(),
    cpu: { cores: 16 }, mem: { totalGb: 31.7, freeGb: 12.3 }, gpu: { adapters: 1, memMb: 8192 },
    drives: { shown: [d('C', 953, 118)], hidden: [], unread: 0, removable: 0, network: 0 },
    power: { laptop: true, battery: true }, net: { kind: 'wifi', metered: false }, os: { build: 26100, version: 'Windows 11 24H2', arm: false },
    screen: { width: 2560, height: 1600, scale: 150, narrow: false },
    tools: { claude: { installed: true, signedIn: true }, codex: { installed: true, signedIn: true }, gemini: none, vscode: true, cursor: false, node: true, python: true, git: true, wsl: false },
    failed: [], ...o,
  };
}
const snap = (p, o = {}) => ({ ok: true, available: true, reading: false, profile: p, changed: [], ...o });
const row = (room, key) => room.rows.find(r => r.key === key);
/* 원클릭 · 사무실을 볼 계정(지금은 유호님 계정)의 판 */
const ALL = { features: { backup: true, office: true } };
const notes = r => r.more.filter(m => m[0] === 'note').map(m => m[1]);
const text = room => [room.say, room.then, ...room.rows.flatMap(r => [r.mid, r.val, ...r.more.flatMap(m => m.slice(1).filter(x => typeof x === 'string'))])].join('\n');

/* 설계 9절 견본 일곱 */
const SAMPLES = {
  light: profile({ cpu: { cores: 4 }, mem: { totalGb: 7.8, freeGb: 1.6 }, gpu: { adapters: 1, memMb: null }, drives: { shown: [d('C', 256, 60)], hidden: [], unread: 0, removable: 0, network: 0 }, tools: { claude: none, codex: none, gemini: none, vscode: false, cursor: false, node: false, python: false, git: false, wsl: false } }),
  twoDrive: profile({ cpu: { cores: 8 }, mem: { totalGb: 15.7, freeGb: 6 }, power: { laptop: false, battery: false }, net: { kind: 'wired', metered: false }, drives: { shown: [d('C', 512, 140), d('D', 2000, 1300)], hidden: [], unread: 0, removable: 0, network: 0 } }),
  dev: profile({ cpu: { cores: 16 }, mem: { totalGb: 31.7, freeGb: 18 }, drives: { shown: [d('C', 1000, 400), d('E', 2000, 1500)], hidden: [], unread: 0, removable: 0, network: 0 }, tools: { claude: { installed: true, signedIn: true }, codex: { installed: true, signedIn: false }, gemini: none, vscode: true, cursor: true, node: true, python: true, git: true, wsl: true } }),
  dMain: profile({ cpu: { cores: 8 }, mem: { totalGb: 15.7, freeGb: 5 }, drives: { shown: [d('C', 128, 9), d('D', 1000, 640)], hidden: [], unread: 0, removable: 0, network: 0 } }),
  virtual: profile({ drives: { shown: [d('C', 953, 118)], hidden: [{ letter: 'E', why: 'small' }, { letter: 'G', why: 'virtual' }], unread: 0, removable: 0, network: 0 } }),
  removable: profile({ drives: { shown: [d('C', 512, 200)], hidden: [], unread: 0, removable: 1, network: 1 } }),
  five: profile({ drives: { shown: [d('C', 953, 30), d('D', 1907, 90), d('E', 476, 300), d('F', 238, 100)], hidden: [], unread: 1, removable: 0, network: 0 } }),
};

test('the two top sentences name the PC and its drives (설계 5.2)', () => {
  assert.deepEqual(pcSummary(SAMPLES.twoDrive), { say: '이 PC는 논리 코어 8개 · 메모리 16GB 데스크톱입니다.', drives: '드라이브 둘(C: 512GB, D: 2.0TB)을 씁니다.' });
  assert.deepEqual(pcSummary(SAMPLES.light), { say: '이 PC는 논리 코어 4개 · 메모리 8GB 노트북입니다.', drives: '드라이브 하나(C: 256GB)를 씁니다.' });
  assert.equal(pcSummary(SAMPLES.five).drives, '드라이브 넷(C: 953GB, D: 1.9TB, E: 476GB, F: 238GB)을 씁니다.');
  assert.equal(pcSummary(profile({ drives: null })).drives, '드라이브 목록을 읽지 못했습니다.');
  // 한쪽만 읽혔으면 그쪽을 쓴다(카본 A4)
  assert.equal(pcSummary(profile({ cpu: { cores: null } })).say, '이 PC는 메모리 32GB 노트북입니다. 프로세서는 읽지 못했습니다.');
  assert.equal(pcSummary(profile({ mem: { totalGb: null } })).say, '이 PC는 논리 코어 16개 노트북입니다. 메모리는 읽지 못했습니다.');
  assert.equal(pcSummary(profile({ cpu: { cores: null }, mem: { totalGb: null } })).say, '이 PC의 프로세서와 메모리를 읽지 못했습니다.');
  // 펼치는 줄에는 늘 내용이 있다(카본 A1)
  for (const p of [profile(), profile({ os: null }), profile({ os: { build: 26100, version: 'Windows 11 24H2', arm: true } })]) {
    for (const r of pcRoom(snap(p), {}, NOW).rows) assert.ok(r.more.some(m => m[0] !== 'live'), r.key);
  }
  // 다른 방의 일이 도는 동안 「다시 진단」은 흐리고, 「다시 재는 중」은 쓰지 않는다(카본 A3)
  const other = pcRoom(snap(SAMPLES.twoDrive), { busy: 'settings:diag-copy' }, NOW);
  assert.deepEqual([other.act[2], /다시 재는 중/.test(other.foot)], ['off', false]);
});

test('the light laptop: office takes two because of memory, no graphics memory value, Claude Code and Codex are missing', () => {
  const room = pcRoom(snap(SAMPLES.light), ALL, NOW);
  const cpu = row(room, 'cpu');
  assert.equal(cpu.val, '사무실 둘까지');
  assert.match(notes(cpu)[0], /^그래서 사무실에서는 둘까지 함께 일합니다\. 논리 코어 4개와 메모리 8GB를 보고 정했습니다\./, 'both sides allow two');
  assert.match(notes(row(pcRoom(snap(profile({ cpu: { cores: 24 }, mem: { totalGb: 7.8 } })), ALL, NOW), 'cpu'))[0], /둘까지 함께 일합니다\. 메모리 8GB를 보고 정했습니다\./, 'memory is the smaller side');
  assert.equal(row(room, 'gpu').mid, '그래픽 장치 1개 · 메모리 값 없음');
  const tools = row(room, 'tools');
  assert.equal(tools.mid, '찾은 도구 없음');
  assert.ok(notes(tools).some(n => n.startsWith('Claude Code와 Codex가 이 PC에 없습니다. 사무실 직원으로 쓰려면 구독 방의 계정 관리에서 설치하고 로그인합니다.')), notes(tools).join('|'));
  assert.match(notes(row(room, 'power'))[0], /배터리가 30% 아래이거나 절전 모드가 켜지면 업무 백업을 쉽니다/);
});

test('the two-drive desktop: both drives as gauges, the desktop power line, the wired line', () => {
  const room = pcRoom(snap(SAMPLES.twoDrive), ALL, NOW);
  const disk = row(room, 'disk');
  assert.equal(disk.mid, '드라이브 둘');
  assert.deepEqual(disk.more.filter(m => m[0] === 'gauge').map(m => [m[1], m[3], m[4]]), [['C:', '140GB 남음', '512GB'], ['D:', '1300GB 남음', '2.0TB']]);
  assert.ok(notes(disk).includes('그래서 원클릭 판에 이 드라이브들을 모두 보입니다. 외장 · USB · 가상 드라이브의 파일은 지우지 않습니다.'));
  assert.equal(row(room, 'power').mid, '데스크톱');
  assert.equal(notes(row(room, 'power'))[0], '배터리가 없어 전원 때문에 업무 백업을 쉬는 일은 없습니다.');
  assert.equal(row(room, 'net').mid, '유선 · 종량제 아님');
  assert.equal(row(room, 'cpu').val, '사무실 넷까지');
});

test('the dev laptop: tools listed, office works with the two AI tools, a Codex login trace is missing', () => {
  const tools = row(pcRoom(snap(SAMPLES.dev), ALL, NOW), 'tools');
  assert.equal(tools.mid, 'Claude Code · Codex · VS Code · Cursor · Node · Python · Git · WSL');
  assert.deepEqual(tools.more.filter(m => m[0] === 'row').map(m => [m[1], m[2]]), [['Claude Code', '있음 · 로그인한 흔적 있음'], ['Codex', '있음 · 로그인한 흔적 없음'], ['Gemini CLI', '없음'], ['개발 도구', 'VS Code · Cursor · Node · Python · Git · WSL']]);
  assert.ok(notes(tools).includes('사무실 직원은 이 PC의 Claude Code와 Codex로 일합니다.'));
});

test('C: nearly full and D: roomy: one suggestion with the Windows save-locations button; Solio does not move folders', () => {
  const disk = row(pcRoom(snap(SAMPLES.dMain), ALL, NOW), 'disk');
  assert.deepEqual([disk.mid, disk.val], ['드라이브 둘 · C:가 거의 참', '권할 것 하나']);
  assert.ok(notes(disk).some(n => n.includes('새 프로젝트와 다운로드는 D:에 두면 C:가 덜 찹니다') && n.includes('솔리오는 폴더를 옮기지 않습니다.')));
  assert.deepEqual(disk.more.find(m => m[0] === 'acts')[1][0].slice(0, 2), ['Windows 저장 위치 열기', 'pc-storage']);
  // C:가 넉넉하면 권하지 않는다
  assert.equal(row(pcRoom(snap(SAMPLES.twoDrive), ALL, NOW), 'disk').val, '');
});

test('virtual and recovery drives are named with their reason; the particle does not touch the letter', () => {
  const disk = row(pcRoom(snap(SAMPLES.virtual), {}, NOW), 'disk');
  assert.ok(notes(disk).includes('G: 드라이브는 Google Drive 같은 가상 드라이브로 보여 뺐습니다. E: 드라이브는 32GB보다 작아(복구 파티션 따위) 뺐습니다.'));
  assert.equal(hiddenSentence([{ letter: 'M', why: 'small' }]), 'M: 드라이브는 32GB보다 작아(복구 파티션 따위) 뺐습니다.', 'no 「M:는」 (Fable 다시 검수 FA1)');
});

test('USB and network drives are not measured; an unreadable drive is counted', () => {
  assert.ok(notes(row(pcRoom(snap(SAMPLES.removable), {}, NOW), 'disk')).includes('USB 메모리 · SD 카드 1개와 네트워크 드라이브 1개는 재지 않습니다.'));
  assert.ok(notes(row(pcRoom(snap(SAMPLES.five), {}, NOW), 'disk')).some(n => n.startsWith('크기를 읽지 못한 드라이브가 1개 있습니다.')));
});

test('nothing the app does not do is promised: no light orb, no local model, no names, no paths', () => {
  for (const [name, p] of Object.entries(SAMPLES)) {
    const all = text(pcRoom(snap(p), {}, NOW));
    assert.doesNotMatch(all, /가벼운 판|로컬 모델|\\|[A-Z]:\\/, name);
  }
});

test('metered, ARM, narrow screen and a blocked PowerShell', () => {
  const room = pcRoom(snap(profile({ net: { kind: 'cellular', metered: true }, os: { build: 26100, version: 'Windows 11 24H2', arm: true }, screen: { width: 1366, height: 768, scale: 100, narrow: true } })), ALL, NOW);
  assert.equal(row(room, 'net').mid, '모바일 데이터 · 종량제');
  assert.match(notes(row(room, 'net'))[0], /^그래서 업무 백업을 쉽니다/);
  assert.match(notes(row(room, 'os'))[0], /에뮬레이션으로 돕니다/);
  assert.equal(notes(row(room, 'screen'))[0], '화면 폭이 좁아 원클릭 판을 한 단으로 쌓아 보입니다. 글자 크기는 설정의 「화면」에서 바꿉니다.');
  const blocked = pcRoom(snap(profile({ drives: null, power: null, net: null, os: null, gpu: null, failed: ['system', 'gpu'] })), ALL, NOW);
  assert.deepEqual(['disk', 'power', 'net', 'os', 'gpu'].map(k => row(blocked, k).mid), ['드라이브를 읽지 못했습니다', '모릅니다', '읽지 못했습니다', '읽지 못했습니다', '읽지 못했습니다']);
});

test('loading, failed, not Windows, and a change since the last look', () => {
  assert.equal(pcRoom(null, {}, NOW).say, '이 PC의 사양을 읽고 있습니다.');
  assert.equal(pcRoom({ ok: false }, {}, NOW).say, '이 PC의 사양을 읽지 못했습니다.');
  assert.deepEqual([pcRoom({ ok: true, available: false }, {}, NOW).say, pcRoom({ ok: true, available: false }, {}, NOW).act], ['이 PC는 아직 진단하지 않습니다.', null]);
  const changed = pcRoom(snap(SAMPLES.twoDrive), { changedShown: [{ what: 'memory', from: 8, to: 16 }] }, NOW);
  assert.equal(pcRoom(snap(SAMPLES.twoDrive), { changedShown: [{ what: 'gpu', from: 2048, to: 512 }] }, NOW).then.split('. ')[0], '이 PC의 그래픽 메모리가 2GB에서 512MB로 바뀌었습니다');
  assert.equal(changed.then, '이 PC의 메모리가 8GB에서 16GB로 바뀌었습니다. 드라이브 둘(C: 512GB, D: 2.0TB)을 씁니다.');
  const busy = pcRoom(snap(SAMPLES.twoDrive, { reading: true }), {}, NOW);
  assert.deepEqual([busy.act, busy.foot], [['다시 진단', 'pc-again', 'off'], '다시 재는 중입니다.']);
  assert.match(pcRoom(snap(SAMPLES.twoDrive), ALL, NOW).foot, /에 쟀습니다\. 이 PC 밖으로 보내지 않습니다\.$/);
});

test('the settings room gets an 「이 PC」 row only when the bridge exists', () => {
  const r = pcSettingsRow(snap(SAMPLES.twoDrive), {});
  assert.deepEqual([r.key, r.nm, r.mid, r.val], ['pc', '이 PC', '논리 코어 8개 · 메모리 16GB · 드라이브 둘', '']);
  // 맞춰 주는 기능이 없는 계정에게는 잰 값만 모았다고 쓴다(Fable 다시 검수 FA1)
  assert.deepEqual([r.more[0][1], r.more.find(m => m[0] === 'acts')[1][0].slice(0, 2)], ['솔리오가 잰 이 PC의 사양을 한 장에 모았습니다. 이 PC 밖으로 보내지 않습니다.', ['내 PC 진단 보기', 'pc-open']]);
  const fit = pcSettingsRow(snap(SAMPLES.twoDrive), {}, { backup: true });
  assert.deepEqual([fit.more[0][1], fit.more.find(m => m[0] === 'acts')[1][0][0]], ['솔리오가 이 PC를 어떻게 보고 기능마다 무엇을 맞췄는지 한 장에 모았습니다. 이 PC 밖으로 보내지 않습니다.', '내 PC 진단 보기']);
  assert.equal(pcSettingsRow(snap(SAMPLES.twoDrive, { changed: [{ what: 'memory', from: 8, to: 16 }] }), {}).val, '바뀜');
  // 읽는 중 · 읽지 못함은 판과 같은 말로(Fable 최종 P2-4)
  assert.deepEqual([pcSettingsRow(null, {}).mid, pcSettingsRow({ ok: false }, {}).mid, pcSettingsRow({ ok: true, available: true, profile: null }, {}).mid], ['읽는 중입니다', '읽지 못했습니다', '아직 재지 않았습니다']);
  // 걸러져 보일 드라이브가 없으면 원클릭 판을 가리키지 않고 말한다(Fable F2)
  assert.equal(pcSummary({ drives: [] }).drives, '보일 드라이브를 찾지 못했습니다.');
  // 첫 진단이 도는 동안과 다시 재기를 누른 동안은 읽는 중이다(카본 F1)
  assert.deepEqual([pcSettingsRow({ ok: true, available: true, reading: true, profile: null }, {}).mid, pcSettingsRow({ ok: true, available: true, profile: null }, { busy: 'pc:pc-again' }).mid], ['읽는 중입니다', '읽는 중입니다']);
  assert.equal(pcSettingsRow({ ok: true, available: false }, {}), null);
  assert.ok(settingsRoom({ pc: snap(SAMPLES.twoDrive) }, {}, NOW).rows.some(x => x.key === 'pc'));
  assert.ok(!settingsRoom({}, {}, NOW).rows.some(x => x.key === 'pc'), 'no bridge, no row');
});

test('the rooms controller: opening the board reads, shows a change once and tells the app it was seen; again and the storage button', async () => {
  const calls = [];
  let answer = snap(SAMPLES.dMain, { changed: [{ what: 'memory', from: 8, to: 16 }] });
  const pcProfile = {
    snapshot: async () => { calls.push('snapshot'); return answer; },
    again: async () => { calls.push('again'); return snap(SAMPLES.dMain); },
    seen: async () => { calls.push('seen'); return { ok: true }; },
    openStorage: async () => { calls.push('storage'); return { ok: true }; },
  };
  let painted = 0;
  const rooms = createOrbRooms({ pc: { pcProfile }, changed: () => { painted += 1; } });
  rooms.open('pc');
  assert.equal(rooms.scene({ aside: 'pc' }).pc.say, '이 PC의 사양을 읽고 있습니다.');
  await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(calls, ['snapshot', 'seen']);
  let room = rooms.scene({ aside: 'pc' }).pc;
  assert.match(room.then, /^이 PC의 메모리가 8GB에서 16GB로 바뀌었습니다\./);
  answer = snap(SAMPLES.dMain);
  await rooms.handle({ room: 'pc', key: '', act: 'pc-again' });
  room = rooms.scene({ aside: 'pc' }).pc;
  assert.match(room.then, /^이 PC의 메모리가/, 'the change stays while the board is open');
  assert.deepEqual(calls.slice(-1), ['again']);
  await rooms.handle({ room: 'pc', key: 'disk', act: 'pc-storage' });
  assert.deepEqual(calls.slice(-1), ['storage']);
  room = rooms.scene({ aside: 'pc' }).pc;
  assert.equal(room.rows.find(r => r.key === 'disk').more.find(m => m[0] === 'live')[1], 'Windows 설정을 열었습니다. 「새 콘텐츠를 저장할 위치」에서 고릅니다.');
  rooms.close();
  rooms.open('pc');
  await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0));
  assert.doesNotMatch(rooms.scene({ aside: 'pc' }).pc.then, /바뀌었습니다/, 'seen once, not again');
  assert.ok(painted > 0);
  // 판을 닫은 뒤에 끝난 저장 위치 열기는 알림을 남기지 않는다(카본 A3)
  let release;
  pcProfile.openStorage = () => new Promise(r => { release = () => r({ ok: true }); });
  const late = rooms.handle({ room: 'pc', key: 'disk', act: 'pc-storage' });
  rooms.close();
  release(); await late;
  rooms.open('pc');
  await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0));
  assert.equal(rooms.scene({ aside: 'pc' }).pc.rows.find(r => r.key === 'disk').more.find(m => m[0] === 'live')[1], '');
  // 설정 방은 열 때 PC 값을 읽어 줄을 세운다. 돌아오면 그 방을 연 단추에 초점을 둔다
  rooms.close();
  rooms.open('settings', { back: { key: 'pc', act: 'pc-open' } });
  await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0));
  const set = rooms.scene({ aside: 'settings' }).settings;
  assert.ok(set.rows.some(r => r.key === 'pc'));
  assert.deepEqual([set.focus.key, set.focus.act], ['pc', 'pc-open']);
});

test('the oneclick board uses the PC drives while the engine report is missing, with no line and no prediction', () => {
  const STATUS = { v: 1, state: 'safe', writer: true, lastSuccessAt: new Date(NOW - 3600e3).toISOString(), nextRunAt: new Date(NOW + 1800e3).toISOString(), updatedAt: new Date(NOW - 60e3).toISOString() };
  const base = { ok: true, available: true, view: 'status', now: new Date(NOW).toISOString(), engine: { installed: true, version: '0.7.1' }, status: STATUS, feed: { state: 'available', version: '0.7.1' }, install: { phase: 'idle' }, oneclick: null, app: null };
  const pc = { readAt: new Date(NOW - 60e3).toISOString(), drives: [d('C', 953, 118), d('D', 1907, 299)].map(x => ({ ...x, growthPerDay: null, startLineGb: null, daysToStartLine: null })), hiddenDrives: [{ letter: 'G', why: 'virtual' }] };
  const card = solioBackupView({ ...base, space: { missing: true, invalid: false, pc } }, NOW).board.drive;
  assert.deepEqual([card.label, /^PC 앱이 오늘 .+에 잰 값$/.test(card.at), card.linePct, card.lineLabel, card.pred], ['C: 드라이브 953GB', true, null, '', '첫 공간 훑기를 마치면 정한 선과 언제 닿을지를 보입니다.']);
  assert.deepEqual(card.rows.map(r => [r.label, r.linePct]), [['D:', null]]);
  assert.equal(card.hidden, 'G: 드라이브는 Google Drive 같은 가상 드라이브로 보여 뺐습니다.');
  // PC 값이 없으면 전처럼 빈 칸 글
  assert.equal(solioBackupView({ ...base, space: { missing: true, invalid: false } }, NOW).board.drive.empty, '아직 공간을 재지 않았습니다. 하루 한 번 잽니다.');
  // 보고서가 깨졌으면 PC 값으로 덮지 않는다
  assert.equal(solioBackupView({ ...base, space: { missing: false, invalid: true, pc } }, NOW).board.drive.empty, '공간 보고서를 읽지 못했습니다.');
});

test('an account without 원클릭 and 사무실 reads only the measured values, not features it does not have (Fable 최종 P1)', () => {
  for (const [name, p] of Object.entries(SAMPLES)) {
    const room = pcRoom(snap(p), {}, NOW), all = text(room);
    assert.doesNotMatch(all, /사무실|원클릭|업무 백업/, name);
    assert.deepEqual(room.rows.map(r => r.key), ['disk', 'cpu', 'gpu', 'screen', 'os', 'tools'], 'power and line rows only matter for 업무 백업');
    assert.equal(row(room, 'cpu').val, '');
  }
  // 사무실만 보이는 계정은 사무실 문장만, 원클릭은 말하지 않는다
  const officeOnly = pcRoom(snap(SAMPLES.twoDrive), { features: { office: true } }, NOW);
  assert.match(text(officeOnly), /사무실에서는 넷까지/);
  assert.doesNotMatch(text(officeOnly), /원클릭|업무 백업/);
});

test('a number set by hand in 사무실 wins on the board too (Fable 최종 P2-3)', () => {
  const cpu = row(pcRoom(snap(SAMPLES.twoDrive), { features: { office: true, officeCap: 6 } }, NOW), 'cpu');
  assert.equal(cpu.val, '사무실 여섯까지 · 직접 정함');
  assert.equal(notes(cpu)[0], '사무실에서는 직접 정한 여섯까지 함께 일합니다. 이 PC만 보면 넷입니다. 논리 코어 8개와 메모리 16GB를 보고 셈했습니다.');
});

test('the drive line draws what is left, like the oneclick bar (Fable 최종 P2-1), and graphics under 1GB is written in MB (P2-5)', () => {
  const g = row(pcRoom(snap(SAMPLES.dMain), ALL, NOW), 'disk').more.filter(m => m[0] === 'gauge').map(m => [m[1], m[2]]);
  assert.deepEqual(g, [['C:', 7], ['D:', 64]], 'C: 9GB of 128GB left is a short line');
  assert.equal(row(pcRoom(snap(profile({ gpu: { adapters: 1, memMb: 128 } })), {}, NOW), 'gpu').mid, '그래픽 메모리 128MB');
});

test('the oneclick card from PC values says when they were measured (Fable 최종 P2-2)', () => {
  const STATUS = { v: 1, state: 'safe', writer: true, lastSuccessAt: new Date(NOW - 3600e3).toISOString(), nextRunAt: new Date(NOW + 1800e3).toISOString(), updatedAt: new Date(NOW - 60e3).toISOString() };
  const base = { ok: true, available: true, view: 'status', now: new Date(NOW).toISOString(), engine: { installed: true, version: '0.7.1' }, status: STATUS, feed: { state: 'available', version: '0.7.1' }, install: { phase: 'idle' }, oneclick: null, app: null };
  const pc = { readAt: new Date(NOW - 26 * 3600e3).toISOString(), drives: [{ ...d('C', 953, 118), growthPerDay: null, startLineGb: null, daysToStartLine: null }], hiddenDrives: [] };
  assert.match(solioBackupView({ ...base, space: { missing: true, invalid: false, pc } }, NOW).board.drive.at, /^PC 앱이 어제 .+에 잰 값$/);
});

test('the board and settings opened outside Solio still ask whether 원클릭 · 사무실 are open to this account (Fable 다시 검수 FA2)', async () => {
  const { readFileSync } = await import('node:fs');
  const face = readFileSync(new URL('../renderer/orb-face.mjs', import.meta.url), 'utf8');
  assert.match(face, /if \(name === 'pc' \|\| name === 'settings'\) \{ syncRead\('backup', \{ anywhere: true \}\); syncRead\('office', \{ anywhere: true \}\); \}/);
  assert.match(face, /\(space !== 'solio' && !anywhere\)/, 'only these reads may run outside Solio');
  assert.match(face, /features: aside === 'pc' \|\| aside === 'settings' \? pcFeatures\(state\) : null/);
});
