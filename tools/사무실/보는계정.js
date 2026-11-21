#!/usr/bin/env node
'use strict';
/**
 * 솔리오 「사무실」을 볼 SYNK 계정(설계: docs/디자인/솔리오_사무실_20261119/구현설계.md 11.1 · 13절).
 * PC 앱(desktop/src/office.cjs)이 남긴 대기 파일(viewer-pending\<계정 번호>.json, 물은 계정의 번호와 이름과 때)을 유호님께 보여
 * 맞다고 하신 줄의 번호로 viewers.json에 옮긴다. 방문자 분석의 `모으기.js 보는계정`과 같은 꼴이다. 옛 판이 남긴 viewer-pending.json(한 파일)도 함께 읽는다.
 *
 *   node tools/사무실/보는계정.js                    볼 수 있는 계정과 물은 계정(번호 · 이름 · 물은 때)을 보인다
 *   node tools/사무실/보는계정.js --받기 <번호>       그 줄의 계정을 viewers.json에 더하고, 그 계정의 대기 파일 하나만 지운다
 *
 * 하는 일은 이 둘뿐이다(11-21, GPT 검수 solio-office-be5 묶음 B). 대기 폴더를 통째로 지우거나 잠금을 푸는 명령은 두지 않는다.
 * 두 명령이 겹쳐 돌 때 남의 잠금이나 남의 대기 파일을 지우는 일이 거기서 생겼기 때문이다. 볼 계정이 정해지면 앱은 대기 파일을 더 쓰지 않는다.
 * 남은 대기 파일(물은 계정의 번호와 이름)은 이 PC의 사용자 폴더에만 있다. 다 받은 뒤 지우려면 폴더를 손으로 지운다.
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

/* 받기는 한 번에 하나만 viewers.json을 고친다. 그 파일 이름 뒤에 .lock을 붙인 잠금을 새로 만들 수 있을 때만 읽고 고치고 쓴다(GPT 검수 GB5).
   잠금 이름을 목록 이름에서 지어 목록 파일과 겹치지 않는다(be4 GB1). 오래된 잠금은 도구가 치우지 않는다. 사람이 다른 받기가 돌지 않는 것을 보고 지운다 */
function 잠그기(잠금자리) {
  let fd;
  try { fd = fs.openSync(잠금자리, 'wx'); } catch (e) {
    if (e && e.code === 'EEXIST') return false;
    throw e;
  }
  // 만든 뒤에 쓰지 못하면(디스크가 찼다) 손잡이를 닫고 그 잠금을 지운다. 남기면 다음 받기가 막힌다(be4 GB4)
  let closed = false;
  try { fs.writeSync(fd, `${process.pid} ${new Date().toISOString()}`); fs.closeSync(fd); closed = true; return true; } catch (e) {
    if (!closed) { try { fs.closeSync(fd); } catch { /* 이미 닫혔다 */ } }
    try { fs.rmSync(잠금자리, { force: true }); } catch { /* 남으면 사람이 지운다 */ }
    throw e;
  }
}
function 잠금알림(잠금자리) {
  let 때 = null;
  try { 때 = fs.statSync(잠금자리).mtime; } catch { return; }
  console.error(`잠금이 있다(${잠금자리}, ${때.toISOString()}). 다른 받기가 돌고 있지 않으면 그 파일을 지운 뒤 다시 부른다.`);
}

/* 대기 폴더의 대기 파일 이름(<계정 번호>.json)들. 폴더가 없으면 빈 목록이고, 읽지 못하면 던진다(없는 것과 못 읽은 것을 가른다, be4 GB5) */
const 대기이름 = (n) => /\.json$/.test(n) && 보는쪽.ID.test(n.slice(0, -5));
function 대기이름들(물음폴더) {
  try { return fs.readdirSync(물음폴더).filter(대기이름); } catch (e) {
    if (e && e.code === 'ENOENT') return [];
    throw e;
  }
}
/* 대기 파일 하나: 이름의 번호와 안의 번호가 같은 줄만 받는다 */
function 대기줄(파일, 이름) {
  const x = JSON.parse(fs.readFileSync(파일, 'utf8'));
  if (!x || typeof x.synk_user_id !== 'string' || !보는쪽.ID.test(x.synk_user_id) || 이름 !== `${x.synk_user_id}.json`) return null;
  return { synk_user_id: x.synk_user_id, display_name: typeof x.display_name === 'string' ? x.display_name.slice(0, 80) : '', asked_at: typeof x.asked_at === 'string' ? x.asked_at.slice(0, 40) : '' };
}
/* 대기 줄: 계정마다의 파일과 옛 한 파일. 번호 꼴이 틀린 줄은 버리고, 같은 번호는 늦게 물은 것 하나로.
   읽지 못한 대기 파일은 그 수를 함께 돌려준다(be5 GB6). 그사이 앱이 지운 파일(ENOENT)은 세지 않는다 */
function 물은계정들(물음폴더, 옛물음자리) {
  const 줄 = [...보는쪽.pendingEntries(JSON읽기(옛물음자리, null))];
  let 못읽음 = 0;
  for (const n of 대기이름들(물음폴더)) {
    try { const x = 대기줄(path.join(물음폴더, n), n); if (x) 줄.push(x); } catch (e) { if (!e || e.code !== 'ENOENT') 못읽음 += 1; }
  }
  const 마지막 = new Map();
  for (const x of 줄) { const 앞 = 마지막.get(x.synk_user_id); if (!앞 || String(x.asked_at) > String(앞.asked_at)) 마지막.set(x.synk_user_id, x); }
  return { 줄: [...마지막.values()].sort((a, b) => String(a.asked_at).localeCompare(String(b.asked_at))), 못읽음 };
}
/* 받은 계정의 대기 줄만 지운다. 계정마다의 파일은 안의 번호가 그 계정일 때만 지운다. 다른 파일과 다른 계정의 대기 파일은 건드리지 않는다(be5 GB3).
   옛 한 파일(viewer-pending.json)에서는 그 계정의 줄만 빼고 다시 쓴다. 남은 줄이 없으면 파일을 지운다(be6 GA1). 지금 앱은 옛 한 파일을 쓰지 않는다 */
function 받은대기지우기(물음폴더, 옛물음자리, id) {
  let 다 = true;
  const 파일 = path.join(물음폴더, `${id}.json`);
  try { if (대기줄(파일, `${id}.json`)?.synk_user_id === id) fs.rmSync(파일, { force: true }); } catch (e) { if (!e || e.code !== 'ENOENT') 다 = false; }
  try {
    const 옛 = JSON읽기(옛물음자리, null);
    if (옛 && Array.isArray(옛.asked) && 옛.asked.some((x) => x?.synk_user_id === id)) {
      const 남김 = 옛.asked.filter((x) => x?.synk_user_id !== id);
      if (남김.length) JSON쓰기(옛물음자리, { ...옛, asked: 남김 }); else fs.rmSync(옛물음자리, { force: true });
    } else if (옛 && !Array.isArray(옛.asked) && 옛.synk_user_id === id) fs.rmSync(옛물음자리, { force: true }); // 줄 하나만 적던 더 옛 꼴
  } catch { 다 = false; }
  return 다;
}

/**
 * 본 것과 받는 것을 번호로 묶는다. 그 사이에 다른 계정이 사무실을 물어도 다른 계정이 들어가지 않는다. 깨진 viewers.json은 덮지 않고 멈춘다.
 * @param 옵션.받기 받을 계정 번호(목록의 줄과 글자까지 같아야 한다)
 * @param 목록자리 viewers.json의 자리(기본은 PC 앱과 같은 자리)
 */
function 보는계정({ 받기 = null } = {}, 목록자리 = defaultViewersFile()) {
  if (!목록자리) { console.error('볼 계정 파일의 자리를 정하지 못했다. Windows에서 부르거나 SYNK_OFFICE_VIEWERS에 viewers.json의 자리를 준다.'); return 1; }
  const 폴더 = path.dirname(목록자리);
  const 물음폴더 = path.join(폴더, 'viewer-pending'), 옛물음자리 = path.join(폴더, 'viewer-pending.json'), 잠금자리 = `${목록자리}.lock`;
  // 목록 파일이 대기 파일의 이름과 겹치면 아무것도 하지 않는다(be4 GB1)
  if ([물음폴더, 옛물음자리].some((p) => path.resolve(p).toLowerCase() === path.resolve(목록자리).toLowerCase())) {
    console.error(`${목록자리}는 대기 파일의 이름과 겹친다. 볼 계정 파일의 이름을 viewers.json으로 둔다.`); return 1;
  }
  if (받기 == null) { 잠금알림(잠금자리); return 보기({ 목록자리, 물음폴더, 옛물음자리 }); }
  fs.mkdirSync(폴더, { recursive: true });
  let 잠금 = false;
  try { 잠금 = 잠그기(잠금자리); } catch (e) { console.error(`잠금을 만들지 못했다(${e?.code || e?.message}). 옮기지 않았다.`); return 1; }
  if (!잠금) { console.error('다른 받기가 viewers.json을 고치는 중이거나 멈춘 받기가 잠금을 남겼다. 옮기지 않았다.'); 잠금알림(잠금자리); return 1; }
  let 끝 = 1;
  try { 끝 = 보기({ 목록자리, 물음폴더, 옛물음자리 }, 받기); } finally {
    // 잠금을 지우지 못해도 받기의 결과는 그대로다. 남은 잠금은 알린다(be5 GB5)
    try { fs.rmSync(잠금자리, { force: true }); } catch (e) { console.error(`잠금을 지우지 못했다(${e?.code || e?.message}). 다음 받기 전에 ${잠금자리}를 지운다.`); }
  }
  return 끝;
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
  let 물은;
  try { 물은 = 물은계정들(물음폴더, 옛물음자리); } catch (e) { console.error(`대기 폴더를 읽지 못했다(${e?.code || e?.message}). 물은 계정이 없다는 뜻이 아니다. 옮기지 않았다.`); return 1; }
  if (물은.못읽음) console.error(`대기 파일 ${물은.못읽음}개를 읽지 못했다. 그 계정은 아래 목록에 없다.`);
  // 이미 받은 계정은 대기 목록에서 뺀다. 앱이 받기 직전에 쓰기 시작한 대기 줄이 받은 뒤에 남아도 다시 묻지 않는다(GPT 검수 GB6)
  const 물음 = 물은.줄.filter((x) => !목록.synk_user_ids.includes(x.synk_user_id));
  if (!물음.length) {
    if (!물은.못읽음) console.log('PC 앱이 남긴 물은 계정이 없다. 로그인한 채 솔리오를 열면 남는다(볼 계정이 정해진 뒤에는 남지 않는다).');
    return 받기 == null && !물은.못읽음 ? 0 : 1;
  }
  console.log('물은 계정(오래된 차례):');
  for (const x of 물음) console.log(`  ${x.asked_at} · 이름 「${x.display_name || '이름 없음'}」 · 번호 ${x.synk_user_id}`);
  if (받기 == null) { console.log('유호님께 이름과 시각을 보여 유호님 계정이 맞다고 하시면, 그 줄의 번호를 붙여 「보는계정.js --받기 <번호>」로 다시 부른다. 받은 계정에게는 솔리오의 「사무실」이 보인다.'); return 물은.못읽음 ? 1 : 0; }
  const 고른 = 물음.find((x) => x.synk_user_id === 받기);
  if (!고른) { console.error(`위 목록에 번호 「${String(받기).slice(0, 80)}」인 줄이 없다. 옮기지 않았다. 목록의 번호를 글자 그대로 붙인다.`); return 1; }
  const ids = [...new Set([...목록.synk_user_ids, 고른.synk_user_id])];
  JSON쓰기(목록자리, { ...목록, synk_user_ids: ids, 받은때: new Date().toISOString() });
  console.log(`옮겼다 — 「${고른.display_name || '이름 없음'}」(${보임(고른.synk_user_id)}). 사무실을 볼 수 있는 계정 ${ids.length}개. PC 앱은 다음에 사무실을 물을 때 읽는다.`);
  // 받기는 이미 됐다. 그 계정의 대기 파일을 지우지 못해도 0이다. 목록은 받은 계정을 보이지 않는다
  if (!받은대기지우기(물음폴더, 옛물음자리, 고른.synk_user_id)) console.error(`받은 계정의 대기 줄을 지우지 못했다. 목록에는 다시 보이지 않는다. 지우려면 ${path.join(물음폴더, `${고른.synk_user_id}.json`)}이나 ${옛물음자리}에서 손으로 지운다.`);
  return 0;
}

function main(argv) {
  const 있나 = (f) => argv.includes(f);
  const 값 = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const 모르는것 = argv.filter((a, i) => a !== '--받기' && argv[i - 1] !== '--받기');
  if (모르는것.length || argv.filter((a) => a === '--받기').length > 1) { console.error('사용: node tools/사무실/보는계정.js [--받기 <번호>]'); return 1; }
  if (있나('--받기') && !보는쪽.ID.test(값('--받기') || '')) { console.error('--받기 뒤에 받을 계정의 번호를 붙인다(「보는계정.js」만 부르면 물은 계정과 번호가 보인다).'); return 1; }
  return 보는계정({ 받기: 있나('--받기') ? 값('--받기') : null });
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { 보는계정, main };
