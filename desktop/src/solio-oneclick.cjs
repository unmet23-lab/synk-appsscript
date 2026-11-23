'use strict';
// 솔리오 「원클릭」(2026-11-23): 백업 방이 원클릭 방이 되며 더한 본체 쪽 함수들. 묶는 곳은 src/solio-backup.cjs의 createSolioBackup이다.
// 설계: docs/디자인/솔리오_원클릭_20261123/PC앱_옮기기.md. 계약: experiences/solo-backup-rust/contract/solio/README.md.
// 하는 일은 넷이다.
//   1. run-now 요청을 쓴다. setup 요청과 같은 이름 꼴 · 같은 쓰기(점 임시 이름에 쓰고 같은 동기 구간에서 이름 바꾸기)다.
//      setup 요청의 치우기(sweepRequests)는 본문이 setup인 것만 거두므로 이 요청을 건드리지 않는다.
//   2. 엔진의 요청 작업(작업 스케줄러 「요청 - <계정 이름> · <SID 표 6자>」)을 깨운다. 한글 이름은 환경 변수로만 넘긴다.
//   3. 요청이 어디까지 갔는지(requests · claimed · 결과) 보고, 결과 파일은 읽은 뒤 지운다(계약 「솔리오가 읽고 지운다」).
//   4. 공간 보고서(space.json)를 읽어 합계만 낸다. 후보의 경로 · 이름 · 번호와 「지난 7일 늘어난 자리」는 이 파일 밖으로 내보내지 않는다.
//   5. 공간 비우기 2판(SPACE_DESIGN.md 12.4): 엔진이 열어 둔 PC(상태 파일 spaceFree가 off · on)에서는 run-now 다음 이름으로 pick free를
//      쓴다. 넘기는 것은 보고서 번호와 2판 종류의 가 등급 후보 번호뿐이고, 이 번호들도 본체 밖으로 내보내지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const FORMAT = 1;
const RESULT_MAX = 4096;
const SPACE_MAX = 1024 * 1024;
const REQUEST_NAME = /^[0-9]{13}-[a-z0-9]{8,32}\.json$/;
/* 계약 「결과 파일」의 낱말. 모르는 낱말은 unknown이다 */
const RESULTS = Object.freeze(['done', 'rejected', 'confirm-in-engine', 'rested', 'failed']);
const REASONS = Object.freeze(['invalid', 'version', 'expired', 'set-up', 'moved', 'restore-only', 'not-set-up', 'no-report', 'old-report', 'not-available', 'not-yet', 'no-drive', 'paused', 'clock', 'busy', 'interrupted', 'battery', 'saver', 'metered', 'network', 'error', 'cancelled']);
/* 솔리오가 공간 후보를 접는 낱말(설계 표). 엔진 space.rs의 kind와 reason에서 정한다. 모르는 kind는 other다 */
const GROUPS = Object.freeze(['temp', 'temp-profile', 'build', 'cache', 'worktree', 'ai-app-copy', 'project-temp', 'ai-history', 'models', 'cloud-drive', 'vm-disk', 'big-old-file', 'trash', 'other']);
const GRADES = Object.freeze(['auto', 'suggest', 'view']);
/* 2판이 비우는 종류(엔진 solio.cjs FREE_KINDS와 같다). 이 밖의 번호는 넘기지 않는다 */
const FREE_KINDS = Object.freeze(['node_modules', 'target', 'venv', 'pycache', 'temp', 'temp-profile']);
const FREE_ITEMS_MAX = 100;
const REPORT_ID = /^[A-Za-z0-9-]{8,64}$/;

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fault = code => Object.assign(new Error(code), { backupCode: code });
const iso = value => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)) ? value : null;
const bytes = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

/* 세 폴더(SynkWorkBackup · solio · requests)가 연결점이 아닌 진짜 폴더인가. 쓰기 직전 같은 동기 구간에서 본다 */
function realFoldersSync(paths, fsSync) {
  for (const dir of [paths.root, paths.solio, paths.requests]) {
    const stat = fsSync.lstatSync(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return false;
  }
  return true;
}

/* 요청 하나를 쓰고 이름을 돌려준다. 이름의 시각이 요청의 차례다(엔진은 이름 차례로 처리한다) */
function writeRequest({ paths, now, owner, random, fsSync, body }) {
  if (!paths || typeof owner !== 'string' || !/^[0-9a-z]{8}$/.test(owner)) throw fault('INVALID');
  try { fsSync.mkdirSync(paths.requests, { recursive: true }); } catch {}
  const name = `${String(Math.trunc(now)).padStart(13, '0')}-${owner}${random()}.json`;
  if (!REQUEST_NAME.test(name)) throw fault('INVALID');
  const temp = path.join(paths.requests, `.${owner}${random()}.tmp`), file = path.join(paths.requests, name);
  // 폴더 확인 · 임시 이름에 쓰기 · 이름 바꾸기를 한 동기 구간에서 한다. 치우기(동기)가 그 사이에 끼어 이 실행의 임시 파일을 지우지 못한다
  try {
    if (!realFoldersSync(paths, fsSync)) throw fault('STORAGE');
    fsSync.writeFileSync(temp, JSON.stringify(body), { flag: 'wx' });
    fsSync.renameSync(temp, file);
  } catch (error) { try { fsSync.unlinkSync(temp); } catch {} throw error?.backupCode ? error : fault('STORAGE'); }
  return name;
}
/* run-now 요청 하나를 쓰고 이름을 돌려준다. 본문은 {"v":1,"kind":"run-now"}뿐이다(계약: 칸 없음) */
function writeRunNow({ paths, now = Date.now(), owner, random = () => crypto.randomBytes(8).toString('hex'), fsSync = fs }) {
  return writeRequest({ paths, now, owner, random, fsSync, body: { v: FORMAT, kind: 'run-now' } });
}
/* 2판 pick free 요청(계약 4.13 · SPACE_DESIGN.md 12.4). 같은 누름의 run-now보다 1ms 뒤 이름으로 써서 백업이 먼저 돈다.
   지울지 미리 볼지는 엔진이 동의로 정한다. 솔리오는 preview 칸을 쓰지 않는다 */
function writePickFree({ paths, now = Date.now(), owner, random = () => crypto.randomBytes(8).toString('hex'), fsSync = fs, pick }) {
  if (!isObject(pick) || typeof pick.report !== 'string' || !REPORT_ID.test(pick.report) || !Array.isArray(pick.items) || !pick.items.length
    || pick.items.length > FREE_ITEMS_MAX || !pick.items.every(n => Number.isSafeInteger(n) && n >= 1 && n <= 1000) || new Set(pick.items).size !== pick.items.length) throw fault('INVALID');
  return writeRequest({ paths, now, owner, random, fsSync, body: { v: FORMAT, kind: 'pick', action: 'free', report: pick.report, items: [...pick.items] } });
}

/* ── 요청 작업 깨우기. 이 사용자의 SID로 표 6자(SHA-256 앞 6자, 엔진 schedule.rs sid_tag)를 셈하고,
   \SYNK 업무 백업\ 다음 뿌리 폴더에서 이름이 「요청 - … · <표>」인 작업을 찾아 실행한다(4.13 「읽는 때」).
   폴더 이름과 이름 앞뒤의 한글 · 가운뎃점은 환경 변수로 넘겨 명령 줄에 두지 않는다. 답은 started · no-task 낱말 하나다 ── */
// 엔진 schedule.rs의 FOLDER와 글자 그대로 같아야 한다(끝에 역빗금이 없다). 시험이 엔진 원천과 견준다
const TASK_FOLDER = '\\SYNK 업무 백업';
const TASK_PREFIX = '요청 - ';
const TASK_JOIN = ' · ';
const WAKE_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  '[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)',
  '$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
  "$tag=(-join ([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($sid))|ForEach-Object{$_.ToString('x2')})).Substring(0,6)",
  '$s=New-Object -ComObject Schedule.Service;$s.Connect()',
  "foreach($p in @($env:SWB_TASK_FOLDER,'\\')){$f=$null;try{$f=$s.GetFolder($p)}catch{};if($f -eq $null){continue}",
  // 이름 꼴만으로 돌리지 않는다. 동작이 엔진의 WorkBackupRun.exe를 「--run request」로 부르는 작업만 깨운다(Fable 설계 검토 8)
  'foreach($t in @($f.GetTasks(1))){if($t.Name.StartsWith($env:SWB_TASK_PREFIX) -and $t.Name.EndsWith($env:SWB_TASK_JOIN+$tag)){',
  "$ok=$false;foreach($a in @($t.Definition.Actions)){if($a.Type -eq 0 -and ([string]$a.Path).Trim().Trim([char]34).EndsWith('\\WorkBackupRun.exe') -and ([string]$a.Arguments).Trim() -eq '--run request'){$ok=$true}}",
  "if($ok){[void]$t.Run($null);[Console]::Out.Write('started');exit 0}}}}",
  "[Console]::Out.Write('no-task')",
].join(';');
async function wakeRequestTask({ run }) {
  const out = await run(WAKE_SCRIPT, { env: { SWB_TASK_FOLDER: TASK_FOLDER, SWB_TASK_PREFIX: TASK_PREFIX, SWB_TASK_JOIN: TASK_JOIN } });
  const word = typeof out === 'string' ? out.trim() : '';
  return word === 'started' || word === 'no-task' ? word : 'failed';
}

/* 작은 JSON 파일 하나를 읽기 전용으로 연다. 없으면 missing, 연결점 · 큰 파일 · 깨진 파일은 invalid다(상태 파일 readStatus와 같은 방법) */
async function readSmallJson(file, max, fsImpl = fs.promises) {
  let stat;
  try { stat = await fsImpl.lstat(file); } catch (error) { return { format: error?.code === 'ENOENT' || error?.code === 'ENOTDIR' ? 'missing' : 'invalid' }; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > max) return { format: 'invalid' };
  let handle = null;
  try {
    if (!samePath(await fsImpl.realpath(file), file)) return { format: 'invalid' };
    handle = await fsImpl.open(file, 'r');
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size > max) return { format: 'invalid' };
    const buffer = Buffer.alloc(max + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > max) return { format: 'invalid' };
    return { format: 'ok', value: JSON.parse(buffer.subarray(0, bytesRead).toString('utf8').replace(/^﻿/, '')) };
  } catch { return { format: 'invalid' }; }
  finally { await handle?.close().catch(() => {}); }
}

function resultsDir(paths) { return path.join(paths.solio, 'results'); }
/* 결과 폴더와 두 조상이 진짜 폴더인가. 연결점이면 읽지도 지우지도 않는다 */
async function realResults(paths, fsImpl) {
  for (const dir of [paths.root, paths.solio, resultsDir(paths)]) {
    try { const stat = await fsImpl.lstat(dir); if (!stat.isDirectory() || stat.isSymbolicLink()) return false; } catch { return false; }
  }
  return true;
}
/* 이 요청의 결과를 읽고 지운다. 답이 아직 없으면 null. 꼴이 틀린 답도 지우고 unknown으로 돌려준다 */
async function takeResult({ paths, name, fsImpl = fs.promises }) {
  if (!paths || !REQUEST_NAME.test(name) || !(await realResults(paths, fsImpl))) return null;
  const file = path.join(resultsDir(paths), name);
  const read = await readSmallJson(file, RESULT_MAX, fsImpl);
  if (read.format === 'missing') return null;
  // 보통 파일이 아니면(폴더 · 링크) 건드리지 않고 답이 없는 것으로 둔다. 엔진이 하루 뒤 치운다
  if (read.format === 'invalid') {
    try { const stat = await fsImpl.lstat(file); if (!stat.isFile() || stat.isSymbolicLink()) return null; } catch { return null; }
  }
  // 지우기 직전에 폴더와 파일을 한 번 더 본다. 그 사이 연결점으로 바뀌었으면 지우지 않는다(Fable 설계 검토 10)
  try {
    const stat = await fsImpl.lstat(file);
    if (stat.isFile() && !stat.isSymbolicLink() && await realResults(paths, fsImpl)) await fsImpl.unlink(file);
  } catch {}
  const v = read.format === 'ok' && isObject(read.value) ? read.value : {};
  const result = v.v === FORMAT && RESULTS.includes(v.result) ? v.result : 'unknown';
  // 2판 pick free의 done만 수 다섯을 싣는다(계약 「결과 파일」). 꼴이 틀리면 싣지 않는다
  const free = result === 'done' && typeof v.preview === 'boolean' ? { preview: v.preview, freed: bytes(v.freed) ?? 0, items: bytes(v.items) ?? 0, kept: bytes(v.kept) ?? 0, busy: bytes(v.busy) ?? 0 } : null;
  return { result, reason: REASONS.includes(v.reason) ? v.reason : null, at: iso(v.at), ...(free ? { free } : {}) };
}
/* 요청이 어디까지 갔는가: sent(requests에 있음) · claimed(엔진이 가져감) · gone(어디에도 없음) · unknown(보지 못함) */
async function requestStage({ paths, name, fsImpl = fs.promises }) {
  if (!paths || !REQUEST_NAME.test(name)) return 'unknown';
  const where = async file => { try { const stat = await fsImpl.lstat(file); return stat.isFile() ? 'yes' : 'no'; } catch (error) { return error?.code === 'ENOENT' ? 'no' : 'unknown'; } };
  const sent = await where(path.join(paths.requests, name));
  if (sent === 'yes') return 'sent';
  const claimed = await where(path.join(paths.requests, 'claimed', name));
  if (claimed === 'yes') return 'claimed';
  return sent === 'unknown' || claimed === 'unknown' ? 'unknown' : 'gone';
}

/* 후보 하나를 솔리오의 묶음 낱말로 접는다(설계 표) */
function groupOf(kind, reason) {
  if (kind === 'temp' || kind === 'temp-profile' || kind === 'project-temp') return kind;
  if (['node_modules', 'target', 'venv', 'pycache'].includes(kind)) return 'build';
  if (/^[a-z]+-cache$/.test(kind) || kind === 'pnpm-store') return 'cache';
  if (kind === 'worktree') return reason === 'ai-app-copy' ? 'ai-app-copy' : 'worktree';
  if (['ai-history', 'models', 'cloud-drive', 'vm-disk', 'big-old-file', 'trash'].includes(kind)) return kind;
  return 'other';
}
/* 보고서 값에서 합계만 남긴다. 경로 · 이름 · 번호는 읽지 않는다. 정한 선에 가장 가까운 드라이브 하나를 고른다 */
function summarizeSpace(value) {
  if (!isObject(value) || value.v !== FORMAT) return null;
  const drives = (Array.isArray(value.drives) ? value.drives : []).filter(d => isObject(d) && typeof d.drive === 'string' && /^[A-Z]$/.test(d.drive) && bytes(d.size) && bytes(d.free) !== null)
    .map(d => ({
      letter: d.drive, size: d.size, free: d.free,
      growthPerDay: Number.isSafeInteger(d.growthPerDay) ? d.growthPerDay : null,
      startLineGb: Number.isSafeInteger(d.startLineGb) && d.startLineGb > 0 ? d.startLineGb : null,
      daysToStartLine: Number.isSafeInteger(d.daysToStartLine) && d.daysToStartLine >= 0 ? d.daysToStartLine : null,
    }));
  const margin = d => d.free - (d.startLineGb || 0) * 1024 ** 3;
  const drive = drives.length ? drives.reduce((a, b) => (margin(b) < margin(a) ? b : a)) : null;
  const totals = new Map();
  for (const c of (Array.isArray(value.candidates) ? value.candidates : []).slice(0, 1000)) {
    if (!isObject(c) || !GRADES.includes(c.grade) || typeof c.kind !== 'string' || bytes(c.bytes) === null) continue;
    const key = `${c.grade}|${groupOf(c.kind, typeof c.reason === 'string' ? c.reason : '')}`;
    const t = totals.get(key) || { bytes: 0, count: 0 };
    t.bytes = Math.min(Number.MAX_SAFE_INTEGER, t.bytes + c.bytes);
    t.count += 1;
    totals.set(key, t);
  }
  const groups = [...totals].map(([key, t]) => { const [grade, group] = key.split('|'); return { grade, group, bytes: t.bytes, count: t.count }; })
    .sort((a, b) => GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade) || b.bytes - a.bytes);
  // 첫 바퀴를 다 훑기 전에는 후보가 없다. 「비울 것 없음」과 가르려고 훑는 중인 날수를 넘긴다(Fable 설계 검토 9)
  const scanningDays = isObject(value.scanning) && Number.isSafeInteger(value.scanning.days) && value.scanning.days >= 0 ? value.scanning.days : null;
  return {
    createdAt: iso(value.createdAt),
    lapFinishedAt: isObject(value.lap) ? iso(value.lap.finishedAt) : null,
    scanningDays,
    drive, otherDrives: Math.max(0, drives.length - 1), groups,
  };
}
/* 2판 pick free에 넘길 것: 24시간 안의 보고서 번호와, 그 보고서의 2판 종류 가 등급 후보 번호(많아야 100개). 없으면 null.
   번호는 본체 안에서 요청 파일에만 쓴다 — 화면으로도, 로그로도 넘기지 않는다 */
async function readFreePick({ paths, now = Date.now(), fsImpl = fs.promises }) {
  if (!paths) return null;
  for (const dir of [paths.root, paths.solio]) {
    try { const stat = await fsImpl.lstat(dir); if (!stat.isDirectory() || stat.isSymbolicLink()) return null; } catch { return null; }
  }
  const read = await readSmallJson(path.join(paths.solio, 'space.json'), SPACE_MAX, fsImpl);
  const v = read.format === 'ok' && isObject(read.value) ? read.value : null;
  if (!v || v.v !== FORMAT || typeof v.report !== 'string' || !REPORT_ID.test(v.report)) return null;
  const made = Date.parse(v.createdAt || '');
  if (!Number.isFinite(made) || now - made > 24 * 3600000 || made - now > 5 * 60000) return null;
  const items = (Array.isArray(v.candidates) ? v.candidates : []).filter(c => isObject(c) && c.grade === 'auto' && FREE_KINDS.includes(c.kind) && Number.isSafeInteger(c.n) && c.n >= 1 && c.n <= 1000)
    .map(c => c.n).filter((n, i, all) => all.indexOf(n) === i).slice(0, FREE_ITEMS_MAX);
  return items.length ? { report: v.report, items } : null;
}
/* 공간 보고서를 읽어 합계를 낸다. { format: 'ok', space } · { format: 'missing' | 'invalid' }.
   cache({key, read})를 주면 크기와 고친 시각이 같을 때 다시 해석하지 않는다(방은 2초마다 읽는다, Fable 설계 검토 6).
   해석 오류의 글(원문 조각이 든다)은 어디에도 싣지 않고 invalid 하나로 접는다 */
async function readSpace({ paths, fsImpl = fs.promises, cache = null }) {
  if (!paths) return { format: 'missing' };
  for (const dir of [paths.root, paths.solio]) {
    try { const stat = await fsImpl.lstat(dir); if (!stat.isDirectory() || stat.isSymbolicLink()) return { format: 'invalid' }; }
    catch (error) { return { format: error?.code === 'ENOENT' ? 'missing' : 'invalid' }; }
  }
  const file = path.join(paths.solio, 'space.json');
  let key = null;
  try { const stat = await fsImpl.lstat(file); key = `${stat.size}:${stat.mtimeMs}:${stat.isFile() ? 1 : 0}`; } catch { key = null; }
  if (cache && key && cache.key === key && cache.read) return cache.read;
  const read = await readSmallJson(file, SPACE_MAX, fsImpl);
  const space = read.format === 'ok' ? summarizeSpace(read.value) : null;
  const out = read.format !== 'ok' ? { format: read.format } : space ? { format: 'ok', space } : { format: 'invalid' };
  if (cache) { cache.key = key; cache.read = out; }
  return out;
}

module.exports = {
  writeRunNow, writePickFree, readFreePick, FREE_KINDS, wakeRequestTask, takeResult, requestStage, readSpace, summarizeSpace, groupOf,
  WAKE_SCRIPT, TASK_FOLDER, TASK_PREFIX, TASK_JOIN, RESULTS, REASONS, GROUPS, GRADES,
};
