#!/usr/bin/env node
'use strict';
/**
 * 솔리오 「사무실」을 볼 SYNK 계정(설계: docs/디자인/솔리오_사무실_20261119/구현설계.md 11.1 · 13절).
 * PC 앱(desktop/src/office.cjs)이 남긴 대기 파일(viewer-pending\<계정 번호>.json, 물은 계정의 번호와 이름과 때)을 유호님께 보여
 * 맞다고 하신 줄의 번호로 viewers.json에 옮긴다. 방문자 분석의 `모으기.js 보는계정`과 같은 꼴이다. 옛 판이 남긴 viewer-pending.json(한 파일)도 함께 읽는다.
 *
 *   node tools/사무실/보는계정.js                    볼 수 있는 계정과 물은 계정(번호 · 이름 · 물은 때)을 보인다
 *   node tools/사무실/보는계정.js --받기 <번호>       그 줄의 계정을 viewers.json에 더하고 대기 파일을 지운다
 *   node tools/사무실/보는계정.js --버리기            대기 파일만 지운다
 *   node tools/사무실/보는계정.js --잠금풀기          멈춘 받기가 남긴 잠금(viewers.lock)을 푼다. 다른 받기가 돌고 있지 않을 때만 쓴다
 *
 * 파일은 %LOCALAPPDATA%\synk\office\(저장소 밖)에 있다. 자리는 PC 앱과 같은 함수(defaultViewersFile)로 정하고,
 * 환경 변수 SYNK_OFFICE_VIEWERS가 있으면 그 자리의 viewers.json과 같은 폴더를 쓴다(시험용).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { defaultViewersFile } = require('../../desktop/src/office.cjs');
const 보는쪽 = require('../../desktop/src/site-visits.cjs'); // 옛 대기 파일을 읽는 법과 계정 번호 꼴을 PC 앱과 하나로 쓴다

function JSON읽기(p, 기본) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return 기본; } }
/* 같은 폴더의 임시 파일에 쓰고 이름을 바꿔 넣는다. PC 앱이 쓰다 만 파일을 읽지 않게 한다 */
function JSON쓰기(p, x) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try { fs.writeFileSync(tmp, `${JSON.stringify(x, null, 2)}\n`, 'utf8'); fs.renameSync(tmp, p); } catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
}

/* 받기는 한 번에 하나만 viewers.json을 고친다. 같은 폴더의 viewers.lock을 새로 만들 수 있을 때만 읽고 고치고 쓴다(GPT 검수 GB5).
   오래된 잠금을 저절로 치우지 않는다. 두 받기가 같은 오래된 잠금을 보고 서로의 새 잠금을 지울 수 있기 때문이다(GPT 검수 be3 GA8).
   멈춘 받기가 남긴 잠금은 --잠금풀기로 푼다. 앱은 이 잠금을 쥐지 않는다(설계 검토 solio-office-hooks 고칠 것 8) */
function 잠그기(잠금자리) {
  try { const fd = fs.openSync(잠금자리, 'wx'); fs.writeSync(fd, `${process.pid} ${new Date().toISOString()}`); fs.closeSync(fd); return true; } catch (e) {
    if (e && e.code === 'EEXIST') return false;
    throw e;
  }
}
function 잠금알림(잠금자리) {
  let 때 = null;
  try { 때 = fs.statSync(잠금자리).mtime; } catch { return; }
  console.error(`잠금이 있다(${잠금자리}, ${때.toISOString()}). 다른 받기가 돌고 있지 않으면 「보는계정.js --잠금풀기」로 푼 뒤 다시 부른다.`);
}

/* 대기 줄: 계정마다의 파일과 옛 한 파일. 번호 꼴이 틀린 줄은 버리고, 같은 번호는 늦게 물은 것 하나로 */
function 물은계정들(물음폴더, 옛물음자리) {
  const 줄 = [...보는쪽.pendingEntries(JSON읽기(옛물음자리, null))];
  let 이름들 = [];
  try { 이름들 = fs.readdirSync(물음폴더).filter((n) => /\.json$/.test(n)); } catch { 이름들 = []; }
  for (const n of 이름들) {
    const x = JSON읽기(path.join(물음폴더, n), null);
    if (x && typeof x.synk_user_id === 'string' && 보는쪽.ID.test(x.synk_user_id) && n === `${x.synk_user_id}.json`) {
      줄.push({ synk_user_id: x.synk_user_id, display_name: typeof x.display_name === 'string' ? x.display_name.slice(0, 80) : '', asked_at: typeof x.asked_at === 'string' ? x.asked_at.slice(0, 40) : '' });
    }
  }
  const 마지막 = new Map();
  for (const x of 줄) { const 앞 = 마지막.get(x.synk_user_id); if (!앞 || String(x.asked_at) > String(앞.asked_at)) 마지막.set(x.synk_user_id, x); }
  return [...마지막.values()].sort((a, b) => String(a.asked_at).localeCompare(String(b.asked_at)));
}
function 대기지우기(물음폴더, 옛물음자리) {
  fs.rmSync(물음폴더, { recursive: true, force: true });
  fs.rmSync(옛물음자리, { force: true });
}

/**
 * 본 것과 받는 것을 번호로 묶는다. 그 사이에 다른 계정이 사무실을 물어도 다른 계정이 들어가지 않는다. 깨진 viewers.json은 덮지 않고 멈춘다.
 * @param 옵션.받기 받을 계정 번호(목록의 줄과 글자까지 같아야 한다) · 옵션.버리기 물은 계정 목록을 지운다 · 옵션.잠금풀기 남은 잠금을 푼다
 * @param 목록자리 viewers.json의 자리(기본은 PC 앱과 같은 자리)
 */
function 보는계정({ 받기 = null, 버리기 = false, 잠금풀기 = false } = {}, 목록자리 = defaultViewersFile()) {
  if (!목록자리) { console.error('볼 계정 파일의 자리를 정하지 못했다. Windows에서 부르거나 SYNK_OFFICE_VIEWERS에 viewers.json의 자리를 준다.'); return 1; }
  const 폴더 = path.dirname(목록자리);
  const 물음폴더 = path.join(폴더, 'viewer-pending'), 옛물음자리 = path.join(폴더, 'viewer-pending.json'), 잠금자리 = path.join(폴더, 'viewers.lock');
  if (잠금풀기) {
    if (!fs.existsSync(잠금자리)) { console.log('풀 잠금이 없다.'); return 0; }
    fs.rmSync(잠금자리, { force: true });
    console.log('잠금을 풀었다. 이제 「보는계정.js --받기 <번호>」를 다시 부를 수 있다.');
    return 0;
  }
  // 버리기는 볼 계정 파일과 상관없이 대기 파일만 지운다. 볼 계정 파일이 깨져 앱이 대기 줄을 새로 쓴 때에도 지울 수 있다(GPT 검수 GB13)
  if (버리기) { 대기지우기(물음폴더, 옛물음자리); console.log('물은 계정 목록을 지웠다.'); return 0; }
  if (받기 == null) { 잠금알림(잠금자리); return 보기({ 목록자리, 물음폴더, 옛물음자리 }); }
  fs.mkdirSync(폴더, { recursive: true });
  if (!잠그기(잠금자리)) { console.error('다른 받기가 viewers.json을 고치는 중이거나 멈춘 받기가 잠금을 남겼다. 옮기지 않았다.'); 잠금알림(잠금자리); return 1; }
  try { return 보기({ 목록자리, 물음폴더, 옛물음자리 }, 받기); } finally { fs.rmSync(잠금자리, { force: true }); }
}

function 보기({ 목록자리, 물음폴더, 옛물음자리 }, 받기 = null) {
  let 목록 = { synk_user_ids: [] };
  if (fs.existsSync(목록자리)) {
    목록 = JSON읽기(목록자리, null);
    if (!목록 || typeof 목록 !== 'object' || !Array.isArray(목록.synk_user_ids) || !목록.synk_user_ids.every((id) => typeof id === 'string' && 보는쪽.ID.test(id))) {
      console.error(`${목록자리}를 읽지 못했다(깨졌거나 꼴이 다르다). 덮어쓰지 않고 멈춘다 — 파일을 고치거나 지운 뒤 다시 부른다. 그동안 솔리오의 사무실은 아무에게도 보이지 않는다.`);
      return 1;
    }
  }
  const 보임 = (id) => `${String(id).slice(0, 6)}…`;
  console.log(`사무실을 볼 수 있는 계정: ${목록.synk_user_ids.length ? 목록.synk_user_ids.map(보임).join(', ') : '없음(아무에게도 보이지 않는다)'}`);
  // 이미 받은 계정은 대기 목록에서 뺀다. 앱이 받기 직전에 쓰기 시작한 대기 줄이 받은 뒤에 남아도 다시 묻지 않는다(GPT 검수 GB6)
  const 물음 = 물은계정들(물음폴더, 옛물음자리).filter((x) => !목록.synk_user_ids.includes(x.synk_user_id));
  if (!물음.length) {
    console.log('PC 앱이 남긴 물은 계정이 없다. 로그인한 채 솔리오를 열면 남는다(볼 계정이 정해진 뒤에는 남지 않는다).');
    return 받기 == null ? 0 : 1;
  }
  console.log('물은 계정(오래된 차례):');
  for (const x of 물음) console.log(`  ${x.asked_at} · 이름 「${x.display_name || '이름 없음'}」 · 번호 ${x.synk_user_id}`);
  if (받기 == null) { console.log('유호님께 이름과 시각을 보여 유호님 계정이 맞다고 하시면, 그 줄의 번호를 붙여 「보는계정.js --받기 <번호>」로 다시 부른다. 받은 계정에게는 솔리오의 「사무실」이 보인다.'); return 0; }
  const 고른 = 물음.find((x) => x.synk_user_id === 받기);
  if (!고른) { console.error(`위 목록에 번호 「${String(받기).slice(0, 80)}」인 줄이 없다. 옮기지 않았다. 목록의 번호를 글자 그대로 붙인다.`); return 1; }
  const ids = [...new Set([...목록.synk_user_ids, 고른.synk_user_id])];
  JSON쓰기(목록자리, { ...목록, synk_user_ids: ids, 받은때: new Date().toISOString() });
  // 볼 계정이 정해지면 PC 앱은 대기 줄을 더 쓰지 않는다. 남은 줄(시험 · 시연 계정의 번호와 이름)은 지운다.
  대기지우기(물음폴더, 옛물음자리);
  console.log(`옮겼다 — 「${고른.display_name || '이름 없음'}」(${보임(고른.synk_user_id)}). 사무실을 볼 수 있는 계정 ${ids.length}개. PC 앱은 다음에 사무실을 물을 때 읽는다.`);
  return 0;
}

function main(argv) {
  const 있나 = (f) => argv.includes(f);
  const 값 = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const 아는것 = new Set(['--받기', '--버리기', '--잠금풀기']);
  const 모르는것 = argv.filter((a, i) => !아는것.has(a) && argv[i - 1] !== '--받기');
  if (모르는것.length || [있나('--받기'), 있나('--버리기'), 있나('--잠금풀기')].filter(Boolean).length > 1) { console.error('사용: node tools/사무실/보는계정.js [--받기 <번호> | --버리기 | --잠금풀기]'); return 1; }
  if (있나('--받기') && !보는쪽.ID.test(값('--받기') || '')) { console.error('--받기 뒤에 받을 계정의 번호를 붙인다(「보는계정.js」만 부르면 물은 계정과 번호가 보인다).'); return 1; }
  return 보는계정({ 받기: 있나('--받기') ? 값('--받기') : null, 버리기: 있나('--버리기'), 잠금풀기: 있나('--잠금풀기') });
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { 보는계정, main };
