#!/usr/bin/env node
'use strict';
/**
 * 그림굽기 — 편의 그림 한 장을 GPT 이미지(ChatGPT 구독 · Codex CLI)로 굽는 공용 도구 (2026-11-11).
 *
 *   node tools/그림굽기.js <편 폴더> <지시문.txt> <이름> [참고 그림…] [--판 <폴더>] [--참고제한없음]
 *
 *   예) node tools/그림굽기.js docs/마케팅/<편> 판/바다.txt 바다 판/참고/몽글.jpg
 *   → <편 폴더>/판/바다_<시분초>.png, 기록은 <편 폴더>/판/_기록/바다_<시분초>_답.txt · _사건.jsonl
 *   지시문 · 참고 그림 경로는 지금 폴더 기준으로 먼저 찾고, 없으면 편 폴더 기준으로 찾는다(위 예는 저장소 뿌리에서 친 것).
 *   두 기준에 서로 다른 파일이 다 있으면 고르지 않고 멈춘다(종료 2) — 절대 경로로 준다.
 *
 * 왜 있나: 편 폴더마다 `굽기.cjs`를 앞 편에서 복사해 머리 주석 · 임시 폴더 이름만 고쳐 썼다. 11-11 origin에 그 이름의 파일이 84벌(6,885줄)이고
 *   77벌은 주석을 지우면 같은 코드였다 — 다른 곳은 저장소 뿌리까지의 깊이와 구운 판 폴더 이름(판 · 구운판 · 그림)뿐이다. 한 벌에 넣은
 *   고침(10-21 「한도에 걸려 계정이 바뀌면 그림은 마지막 thread에 있다」)은 그 뒤에 복사한 벌에만 있다. 그래서 편 폴더를 인자로 받는 한 벌로 둔다.
 *   옛 사본은 그대로 둔다(그 편 · 그 도구가 부르던 것은 계속 부른다). 새 편에는 복사하지 않는다 — tests/굽기사본금지.test.js가 새 사본을 막는다.
 *
 * 하는 일(옛 사본과 같다):
 *   - `node tools/codex계정.js exec --json --skip-git-repo-check -C <빈 임시 폴더> -s read-only [-i 참고…] -o <답> -`를 저장소 뿌리에서 부르고
 *     지시문 파일을 표준입력으로 넘긴다. 굽기 계정 고르기 · 한도에 걸렸을 때 다음 계정으로 넘기기는 codex계정.js가 한다.
 *   - 그림은 그 계정 폴더의 generated_images/<thread>/에 생긴다. --json 사건에서 thread_id를 읽어(계정이 바뀌면 마지막 것) 구운 판 폴더로 옮겨 적는다.
 *     「가장 새 그림」을 집지 않는다 — 같은 시각에 다른 세션이 같은 계정으로 굽는다.
 *   - 참고 그림은 넘긴 순서 그대로다. 첫 장이 고칠 장면인지는 지시문이 말한다.
 * 옛 사본과 다른 곳:
 *   - 구운 판 폴더는 `<편 폴더>/판`이고 `--판 <폴더>`로 바꾼다(편 폴더 기준 상대 경로나 절대 경로 — 옛 사본의 「구운판」 · 「그림」 · git 밖 자리).
 *   - 부르기 전에 멈추는 것(종료 2): 지시문이 없거나 비었다 · 참고 그림이 없다 · 참고 그림이 다섯 장을 넘는다(Codex 그림 도구는 다섯 장까지만
 *     받고, 넘기면 제멋대로 빼서 지시문의 Image 번호가 어긋난다 — 현장 노트 그림_굽기_오리기. 한도가 바뀌었으면 --참고제한없음).
 *   - 같은 이름 · 같은 초에 구운 것이 있으면 덮지 않는다 — 사건 기록 파일을 먼저 잡아 `<이름>_<시분초>_2` · `_3`…을 그림 · 답 · 사건이 함께 쓴다.
 *   - 계정 폴더는 codex계정.js가 굽는 자리만 본다 — CODEX_BAKE_DIR(없으면 ~/.codex-bake) 아래 폴더들(연결 폴더 포함)과 ~/.codex.
 *   - 사건 기록을 다 쓴 뒤 판정하고, 쓰고 난 빈 임시 폴더를 치운다.
 * 종료 코드: codex계정.js의 것을 그대로 낸다(3 = 쓸 수 있는 굽기 계정이 없다). 인자가 틀리면 2, 그림을 못 찾으면 1.
 * 기록(_사건.jsonl · _답.txt)에는 계정 메일이 들어가지 않는다. 이 도구의 화면 출력을 편 폴더의 파일로 받아 두지 않는다 — 저장소가 공개다.
 * 시험용 이음매: SYNK_CODEX_ROTATE(codex계정.js 대신 부를 파일 — tools/GPT콘티굽기.mjs와 같은 이름) · SYNK_굽기_시각(이름에 붙일 시분초 여섯 자리).
 * 시험: node --test tests/그림굽기.test.js tests/굽기사본금지.test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const 뿌리 = path.resolve(__dirname, '..');
const 참고한도 = 5;
const 사용법 = '사용: node tools/그림굽기.js <편 폴더> <지시문.txt> <이름> [참고 그림…] [--판 <폴더>] [--참고제한없음]';

function 인자읽기(argv) {
  const 위치 = [];
  let 판 = '판';
  let 참고제한 = true;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--판') {
      판 = argv[++i];
      if (!판) throw new Error('--판 뒤에 폴더가 없다');
    } else if (argv[i] === '--참고제한없음') 참고제한 = false;
    else if (argv[i].startsWith('--')) throw new Error(`모르는 인자: ${argv[i]}`);
    else 위치.push(argv[i]);
  }
  const [편, 지시문, 이름, ...참고] = 위치;
  if (!편 || !지시문 || !이름) throw new Error('편 폴더 · 지시문 · 이름이 모두 있어야 한다');
  if (/[\\/:*?"<>|]/.test(이름) || 이름 === '.' || 이름 === '..') throw new Error(`이름은 파일 이름으로 쓴다 — 경로 글자를 넣지 않는다: ${이름}`);
  if (참고제한 && 참고.length > 참고한도) {
    throw new Error(`참고 그림은 ${참고한도}장까지다(${참고.length}장을 줬다) — 넘기면 Codex 그림 도구가 제멋대로 빼서 Image 번호가 어긋난다. 한도가 바뀌었으면 --참고제한없음`);
  }
  return { 편, 지시문, 이름, 참고, 판 };
}

/** 지금 폴더 기준으로 먼저, 없으면 편 폴더 기준으로 찾는다. 없으면 null. 두 기준에 서로 다른 파일이 다 있으면 고르지 않고 던진다. */
function 찾기(p, 편) {
  const 여기 = path.resolve(p);
  const 편안 = path.resolve(편, p);
  const 여기있음 = fs.existsSync(여기);
  if (여기있음 && 여기 !== 편안 && fs.existsSync(편안) && fs.realpathSync(여기) !== fs.realpathSync(편안)) {
    throw new Error(`같은 경로가 지금 폴더와 편 폴더에 다 있다 — 절대 경로로 준다: ${p}`);
  }
  if (여기있음) return 여기;
  return fs.existsSync(편안) ? 편안 : null;
}

/** 그림이 생길 수 있는 계정 폴더들 — codex계정.js가 CODEX_HOME으로 넘기는 보조 계정 폴더와, 보조 계정이 없을 때 쓰는 ~/.codex. */
function 계정폴더들(env = process.env) {
  const 집들 = [path.join(os.homedir(), '.codex')];
  const 굽기뿌리 = env.CODEX_BAKE_DIR || path.join(os.homedir(), '.codex-bake');
  let 안 = [];
  try { 안 = fs.readdirSync(굽기뿌리); } catch { /* 보조 계정 폴더가 없다 */ }
  for (const 이름 of 안.sort()) {
    const p = path.join(굽기뿌리, 이름);
    // 연결(junction · 심링크)로 둔 계정 폴더도 따라가서 본다
    try { if (fs.statSync(p).isDirectory()) 집들.push(p); } catch { /* 끊긴 연결 */ }
  }
  return 집들;
}

/** 덮지 않는 이름 — <폴더>/<머리><꼬리>가 있으면 <머리>_2<꼬리>, _3 … */
function 빈이름(폴더, 머리, 꼬리) {
  let 낼 = path.join(폴더, `${머리}${꼬리}`);
  for (let n = 2; fs.existsSync(낼); n++) 낼 = path.join(폴더, `${머리}_${n}${꼬리}`);
  return 낼;
}

/**
 * 이 굽기의 이름 줄기를 잡는다 — 사건 기록 파일을 「없을 때만 만들기」로 열어, 같은 이름 · 같은 초의 다른 굽기(옛 사본 포함)와 겹치지 않는
 * 줄기(<이름>_<시분초> · _2 · _3 …)를 차지한다. 그림 · 답 · 사건이 이 줄기를 함께 쓴다. 돌려주는 것: { 줄기, 사건(경로), fd }
 */
function 줄기잡기(기록, 구운판, 머리) {
  for (let n = 1; n < 1000; n++) {
    const 줄기 = n === 1 ? 머리 : `${머리}_${n}`;
    const 사건 = path.join(기록, `${줄기}_사건.jsonl`);
    // 기록 없이 그림만 있는 같은 줄기(손으로 옮긴 판)도 피한다
    if (fs.existsSync(path.join(기록, `${줄기}_답.txt`)) || fs.readdirSync(구운판).some((f) => f.startsWith(`${줄기}.`) || f.startsWith(`${줄기}_1.`))) continue;
    try { return { 줄기, 사건, fd: fs.openSync(사건, 'wx') }; } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  throw new Error(`이름 줄기를 못 잡았다: ${머리}`);
}

function 멈춤(말, 코드) {
  console.error(`[굽기] ${말}`);
  process.exit(코드);
}

function main(argv = process.argv.slice(2)) {
  let o;
  try { o = 인자읽기(argv); } catch (e) { console.error(`[굽기] ${e.message}\n${사용법}`); process.exit(2); }
  const 편 = path.resolve(o.편);
  if (!fs.existsSync(편) || !fs.statSync(편).isDirectory()) 멈춤(`편 폴더가 없다: ${o.편}`, 2);
  const 찾아 = (p) => { try { return 찾기(p, 편); } catch (e) { return 멈춤(e.message, 2); } };
  const 지시문 = 찾아(o.지시문);
  if (!지시문 || !fs.statSync(지시문).isFile()) 멈춤(`지시문 파일이 없다(지금 폴더 · 편 폴더 기준 모두): ${o.지시문}`, 2);
  if (!fs.readFileSync(지시문, 'utf8').trim()) 멈춤(`지시문이 비었다: ${o.지시문}`, 2);
  const 참고 = o.참고.map((p) => 찾아(p) || 멈춤(`참고 그림이 없다(지금 폴더 · 편 폴더 기준 모두): ${p}`, 2));

  const 구운판 = path.resolve(편, o.판);
  const 기록 = path.join(구운판, '_기록');
  fs.mkdirSync(기록, { recursive: true });
  const 때 = new Date();
  const 시각 = /^\d{6}$/.test(process.env.SYNK_굽기_시각 || '') ? process.env.SYNK_굽기_시각
    : [때.getHours(), 때.getMinutes(), 때.getSeconds()].map((n) => String(n).padStart(2, '0')).join('');
  const { 줄기, 사건, fd } = 줄기잡기(기록, 구운판, `${o.이름}_${시각}`);
  const 답 = path.join(기록, `${줄기}_답.txt`);
  const 일터 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-bake-'));

  const 돌림 = process.env.SYNK_CODEX_ROTATE || path.join(뿌리, 'tools', 'codex계정.js');
  const 인자 = [돌림, 'exec', '--json', '--skip-git-repo-check', '-C', 일터, '-s', 'read-only'];
  for (const p of 참고) 인자.push('-i', p);
  인자.push('-o', 답, '-');

  const 시작 = Date.now();
  const 자식 = spawn(process.execPath, 인자, { cwd: 뿌리, stdio: ['pipe', 'pipe', 'inherit'] });
  자식.stdin.on('error', () => { /* 자식이 먼저 끝나면 EPIPE — 종료 코드로 알린다 */ });
  fs.createReadStream(지시문).pipe(자식.stdin);
  const 사건줄 = fs.createWriteStream(사건, { fd });
  let 남은 = '';
  let 실 = null;
  const 줄읽기 = (줄) => {
    // 한도에 걸리면 codex계정.js가 다른 계정으로 다시 부르며 thread가 새로 열린다 — 그림은 마지막 thread에 있다(10-21 지유 K5)
    const m = /"thread_id"\s*:\s*"([^"]+)"/.exec(줄);
    if (m) 실 = m[1];
  };
  자식.stdout.on('data', (d) => {
    사건줄.write(d);
    남은 += d.toString('utf8');
    const 줄들 = 남은.split('\n');
    남은 = 줄들.pop();
    줄들.forEach(줄읽기);
  });
  자식.on('error', (e) => 멈춤(`${o.이름} codex계정을 띄우지 못했다 — ${e.message}`, 1));
  // 사건 기록을 다 쓴 뒤에 판정한다 — 실패로 끝낼 때 기록이 잘리지 않게
  자식.on('close', (code) => 사건줄.end(() => {
    줄읽기(남은);
    try { fs.rmdirSync(일터); } catch { /* 비어 있지 않으면 둔다 */ }
    const 초 = Math.round((Date.now() - 시작) / 1000);
    if (code !== 0) 멈춤(`${o.이름} 실패 — 종료 ${code} · ${초}초 (사건 ${사건})`, code || 1);
    if (!실) 멈춤(`${o.이름} thread_id를 못 읽었다 — ${사건}`, 1);
    // thread_id는 경로 조각으로 쓴다 — 폴더 밖을 가리키는 꼴이면 읽지 않는다
    if (/[\\/]|^\.\.?$/.test(실)) 멈춤(`${o.이름} thread_id 꼴이 이상하다 — ${사건}`, 1);
    const 그림들 = [];
    for (const 집 of 계정폴더들()) {
      const 폴더 = path.join(집, 'generated_images', 실);
      if (!fs.existsSync(폴더)) continue;
      for (const f of fs.readdirSync(폴더).sort()) if (/\.(png|jpe?g|webp)$/i.test(f)) 그림들.push({ 집: path.basename(집), 파일: path.join(폴더, f) });
    }
    if (!그림들.length) 멈춤(`${o.이름} 그림을 못 찾았다(thread ${실})`, 1);
    그림들.forEach((g, i) => {
      const 머리 = `${줄기}${그림들.length > 1 ? `_${i + 1}` : ''}`;
      let 낼 = path.join(구운판, `${머리}${path.extname(g.파일)}`);
      try { fs.copyFileSync(g.파일, 낼, fs.constants.COPYFILE_EXCL); } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        낼 = 빈이름(구운판, 머리, path.extname(g.파일)); // 줄기를 잡은 뒤 누가 같은 이름의 그림을 놓았다 — 덮지 않는다
        fs.copyFileSync(g.파일, 낼, fs.constants.COPYFILE_EXCL);
      }
      console.log(`[굽기] ${o.이름} → ${path.relative(뿌리, 낼)} · 계정 ${g.집} · thread ${실} · ${초}초`);
    });
  }));
}

if (require.main === module) main();

module.exports = { 인자읽기, 계정폴더들, 빈이름, 줄기잡기, 찾기 };
