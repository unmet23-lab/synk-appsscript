// 공개본 계정 묶음의 계정 라이브러리 모듈(자료·계정 노트·라이브러리 계정·보기)을 master 판으로 갈아 끼운다 — 2026-10-22.
//   node patch-live.cjs 받기 <폴더> [synk-policy 커밋]   공개본 넷을 바이트 그대로 받는다(../synk-policy, 기본 origin/main)
//   node patch-live.cjs 옛판 <폴더>                     옛 판 원천을 되살려(<폴더>/old-src) 같은 충돌 환경에서 컴파일 → 공개본 두 구역과 바이트 대조
//   node patch-live.cjs 후보 <폴더> <후보 폴더>          이 저장소의 master 원천을 컴파일해 두 구역에 끼운 후보 셋(묶음·페이지 ?v=·라이브러리 CSS) + 보고
//   node patch-live.cjs 시험모듈 <후보 폴더> <출력.mjs>   후보 묶음에서 라이브러리 코드를 떼어 ESM으로(run-tests.cjs가 쓴다)
// 폴더 파일 이름은 copy-audit-live-20261022/compare-live.cjs와 같은 꼴(account__dist__platform.js …)이다.
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { execFileSync } = require('node:child_process');
const L = require('./live-modules.cjs');
const repo = path.resolve(__dirname, '../../../..'), policy = path.resolve(L.SHARED, '../synk-policy');
const PUBLIC = { 'account/dist/platform.js': 'account__dist__platform.js', 'account/platform.html': 'account__platform.html', 'account/src/platform-library.css': 'account__src__platform-library.css',
  // 옛 자료 모듈의 바탕: 10-09 압축 전 판(SYNK-appsscript에는 커밋되지 않은 blob 4ceeeb3a4) — 공개본 /try/ 사본이 같은 blob이다.
  'try/travel/synk-account/src/platform-library-data.mjs': 'try__platform-library-data.mjs' };
const [command, ...args] = process.argv.slice(2);
const read = (dir, name) => fs.readFileSync(path.join(dir, name), 'utf8');
const sha12 = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
function edit(label, text, list) {
  for (const [from, to, count = 1] of list) {
    const c = text.split(from).length - 1;
    if (c !== count) throw Error(label + ': expected ' + count + ' of ' + JSON.stringify(from.slice(0, 80)) + ', found ' + c);
    text = text.split(from).join(to);
  }
  return text;
}
const SRC = 'experiences/synk-account/src';
// 계정 노트·라이브러리 계정 옛 판의 바탕 커밋(10-22 글 전수조사 — 641fb16이 공개본에 얹은 판)
const NOTE_BASE = 'b4b28e17a';
const show = (rev, file) => execFileSync('git', ['show', `${rev}:${file}`], { cwd: repo, maxBuffer: 1 << 26 }).toString('utf8').replace(/\r\n/g, '\n');

// 10-18 GPT 은퇴 공개(synk-policy b45319c)가 컴파일 없이 공개본 R에 글자로 얹은 네 자리 — esbuild라면 인자 id를 id2로, ''를 ""로 찍는다.
const HAND = [['.filter(id=>!["rehearsal","family-album"].includes(id))', '.filter(id2=>!["rehearsal","family-album"].includes(id2))', 3], [`이어가기</button>':'')+`, `이어가기</button>':"")+`, 1]];

function makeOld(dir) {
  const live = read(dir, PUBLIC['account/dist/platform.js']), out = path.join(dir, 'old-src', SRC);
  fs.rmSync(path.join(dir, 'old-src'), { recursive: true, force: true });
  // 옛 판 묶음(로그인 뒤 캡처)에 쓰도록 이 저장소 원천 전체를 깔고 넷만 옛 판으로 덮는다.
  fs.cpSync(path.join(repo, SRC), out, { recursive: true });
  // 1) 자료 = 압축 전 판 + 10-18 은퇴 앱 거르기(b45319c) + 10-22 글 둘(641fb16)
  fs.writeFileSync(path.join(out, 'platform-library-data.mjs'), edit('data', read(dir, PUBLIC['try/travel/synk-account/src/platform-library-data.mjs']).replace(/\r\n/g, '\n'), [
    ["if (['favorite','launch','note','edit-note'].includes(action.type) && !PLATFORM_APP_IDS.includes(action.id)) invalid();",
     "if (['favorite','launch','note','edit-note'].includes(action.type) && (!PLATFORM_APP_IDS.includes(action.id) || ['rehearsal','family-album'].includes(action.id) && action.type !== 'edit-note')) invalid();"],
    ["'플랫폼 기록 형식을 확인해 주세요.'", "'라이브러리 기록 형식이 맞지 않아요.'"],
    ["'계정에 저장할 항목을 확인하고 연결을 켜 주세요.'", "'「계정 저장 켜기」를 먼저 눌러 주세요.'"]]));
  // 2) 계정 노트 = b4b28e17a에서 874a15cdc(10-20, 검사 함수를 인자로)만 되돌림 — 공개본은 personal-data 검사를 쓴다.
  fs.writeFileSync(path.join(out, 'account-notebook.mjs'), edit('notebook', show(NOTE_BASE, SRC + '/account-notebook.mjs'), [
    ["import { createDocumentSync, documentSyncErrorMessage } from './document-sync.mjs';\n", "import { createDocumentSync, documentSyncErrorMessage } from './document-sync.mjs';\nimport { validatePersonalState } from './personal-data.mjs';\n"],
    ['export function createAccountNotebook({ resource, validateState, mount,', 'export function createAccountNotebook({ resource, mount,'],
    ["if (!mount || !getState || !applyState || !emptyDocument || typeof validateState !== 'function') throw new TypeError('계정 기록 화면 계약이 필요해요.');",
     "if (!mount || !getState || !applyState || !emptyDocument) throw new TypeError('계정 기록 화면 계약이 필요해요.');\n  const validateState = value => validatePersonalState(resource, value);"]]));
  // 3) 라이브러리 계정 = b4b28e17a에서 PC 앱 재시도(retryNativeIdentity·retryConnection, 7b2318e5c에 처음 커밋)를 뺌
  fs.writeFileSync(path.join(out, 'platform-library-account.mjs'), edit('account', show(NOTE_BASE, SRC + '/platform-library-account.mjs'), [
    [',notification=0,nativeRetry=null;', ',notification=0;'], ['async function nativeAction(action,recheck=false){', 'async function nativeAction(action){'],
    ['    const readObserved=recheck?notification:observed;\n', ''],
    ['if(recheck||observed===notification){const value=await host.authStatus();if(!closed&&attempt===epoch&&readObserved===notification)receive(value);}', 'if(observed===notification){const value=await host.authStatus();if(!closed&&attempt===epoch&&observed===notification)receive(value);}'],
    ["  async function retryNativeIdentity(){\n    if(closed)return {...current};\n    if(nativeRetry)return nativeRetry;\n    if(typeof host.accountRequest!=='function')throw Object.assign(new Error('저장된 로그인을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.'),{code:'AUTH_REQUEST_UNAVAILABLE',retryable:true});\n    const task=nativeAction(()=>host.accountRequest('load',{}),true);nativeRetry=task;\n    try{return await task;}finally{if(nativeRetry===task)nativeRetry=null;}\n  }\n", ''],
    ['if(native)return !current.signedIn&&current.error?.retryable===true?retryNativeIdentity():nativeAction(()=>host.authSignIn());', 'if(native)return nativeAction(()=>host.authSignIn());'],
    ['    async retryConnection(){if(!native||closed||current.signedIn||current.error?.retryable!==true)return {...current};return retryNativeIdentity();},\n', '']]));
  // 4) 보기 = 공개본 조각(names … mountPlatformLibrary)에서 esbuild가 붙인 번호만 원천 이름으로 되돌림.
  //    같은 충돌 환경에서 다시 같은 번호가 붙으면(바이트 같음) 환경이 맞다는 뜻이다. 내력(10-09 blob 35bc27e52 대비)은 README.
  const list = L.statements(live), first = list.findIndex(st => st.declared.includes('names') && live.startsWith('var names={world:', st.start)), last = list.findIndex(st => st.declared.includes('mountPlatformLibrary'));
  if (first < 0 || last !== first + 3) throw Error('view statements ' + first + ' ' + last);
  const viewText = live.slice(list[first].start, list[last].end);
  const back = { esc2: 'esc', root2: 'root', storage2: 'storage', note2: 'note', render2: 'render', id2: 'id', button2: 'button', text4: 'text', status2: 'status' };
  let view = '', at = 0;
  for (const t of L.acorn.tokenizer(viewText, { ecmaVersion: 'latest' })) if (t.type.label === 'name' && Object.hasOwn(back, t.value)) { view += viewText.slice(at, t.start) + back[t.value]; at = t.end; }
  view += viewText.slice(at);
  fs.writeFileSync(path.join(out, 'platform-library-view.mjs'), "import { createAccountNotebook } from './account-notebook.mjs';\nimport { emptyPlatformLibrary, validatePlatformLibrary, updatePlatformLibrary, PLATFORM_APP_IDS, PLATFORM_NOTE_LIMIT } from './platform-library-data.mjs';\nimport { platformLibraryAccount } from './platform-library-account.mjs';\n"
    + edit('view', view, [['function mountPlatformLibrary(', 'export function mountPlatformLibrary(']]) + '\n');
  // 옛 판 실행용 대역(check-live.cjs의 로그인 뒤 캡처): 공개본 personal-data의 platform-library 검사와 같은 일(64KB JSON 복사 → validatePlatformLibrary)
  fs.writeFileSync(path.join(out, 'personal-data.mjs'), "// 옛 판 실행용 대역 — 공개본 personal-data의 platform-library 검사와 같은 일\nimport { validatePlatformLibrary } from './platform-library-data.mjs';\nexport function validatePersonalState(resource, value) { if (resource !== 'platform-library') throw new TypeError('platform-library only'); const text = JSON.stringify(value); if (new TextEncoder().encode(text).length > 64 * 1024) throw Object.assign(new TypeError('저장할 개인 기록이 허용 크기를 넘었어요.'), { code: 'PERSONAL_DATA_TOO_LARGE' }); return validatePlatformLibrary(JSON.parse(text)); }\n");
  return path.join(dir, 'old-src');
}

(async () => {
  if (command === '받기') {
    const [dir, rev = 'origin/main'] = args; if (!dir) throw Error('node patch-live.cjs 받기 <폴더> [커밋]');
    fs.mkdirSync(dir, { recursive: true });
    const commit = execFileSync('git', ['rev-parse', rev], { cwd: policy }).toString().trim();
    for (const [file, name] of Object.entries(PUBLIC)) fs.writeFileSync(path.join(dir, name), execFileSync('git', ['show', `${commit}:${file}`], { cwd: policy, maxBuffer: 1 << 27 }));
    fs.writeFileSync(path.join(dir, 'SOURCE.json'), JSON.stringify({ repository: 'unmet23-lab/synk-policy', commit, files: PUBLIC }, null, 1) + '\n');
    console.log('synk-policy ' + commit.slice(0, 7) + ' → ' + dir);
  } else if (command === '옛판') {
    const [dir] = args; if (!dir) throw Error('node patch-live.cjs 옛판 <폴더>');
    const live = read(dir, PUBLIC['account/dist/platform.js']), root = makeOld(dir);
    const r = await L.build({ srcRoot: root, live }), list = r.list;
    const liveA = live.slice(list[r.regions.A[0]].start, list[r.regions.A[1]].end);
    let liveR = live.slice(list[r.regions.R[0]].start, list[r.regions.R[1]].end);
    liveR = edit('hand patches', liveR, HAND);
    const report = { regions: r.regions, A: r.A === liveA, R: r.R === liveR, bytes: { A: liveA.length, R: liveR.length }, renamedCollide: r.renamedCollide, stray: r.stray, handPatches: HAND.map(([from, , count]) => ({ from, count })) };
    console.log(JSON.stringify(report, null, 1));
    if (!report.A || !report.R || r.renamedCollide.length || r.stray.length) process.exit(1);
  } else if (command === '후보') {
    const [dir, outDir] = args; if (!dir || !outDir) throw Error('node patch-live.cjs 후보 <폴더> <후보 폴더>');
    const live = read(dir, PUBLIC['account/dist/platform.js']);
    const r = await L.build({ srcRoot: repo, live });
    if (r.renamedCollide.length || r.stray.length) throw Error('environment: ' + JSON.stringify({ renamed: r.renamedCollide, stray: r.stray }));
    const list = r.list, [a0, a1] = r.regions.A, [r0, r1] = r.regions.R;
    const A = { start: list[a0].start, end: list[a1].end }, R = { start: list[r0].start, end: list[r1].end };
    const candidate = live.slice(0, A.start) + r.A + live.slice(A.end, R.start) + r.R + live.slice(R.end);
    // 옛 구역 이름 가운데 구역 밖에서 쓰인 것이 새 구역에도 있어야 한다(속성 이름은 뺀다 — 별도 빌드인 회원 성향 묶음의 지역 이름도 걸리지만 모두 남는지 본다).
    const oldNames = new Set([...list.slice(a0, a1 + 1), ...list.slice(r0, r1 + 1)].flatMap(st => st.declared)), usedOutside = new Set();
    for (const t of L.acorn.tokenizer(live, { ecmaVersion: 'latest' })) {
      if (t.type.label !== 'name' || !oldNames.has(t.value) || (t.start >= A.start && t.start < A.end) || (t.start >= R.start && t.start < R.end)) continue;
      if (live[t.start - 1] === '.') continue;
      usedOutside.add(t.value);
    }
    const counts = new Map(); for (const st of L.statements(candidate)) for (const n of st.declared) counts.set(n, (counts.get(n) || 0) + 1);
    const liveGlobals = L.globalsOf(live), candidateGlobals = L.globalsOf(candidate);
    const html = read(dir, PUBLIC['account/platform.html']), from = './dist/platform.js?v=' + sha12(Buffer.from(live, 'utf8')), to = './dist/platform.js?v=' + sha12(Buffer.from(candidate, 'utf8'));
    if (html.split(from).length !== 2) throw Error('platform.html ?v= anchor ' + from);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, PUBLIC['account/dist/platform.js']), candidate);
    fs.writeFileSync(path.join(outDir, PUBLIC['account/platform.html']), html.replace(from, to));
    // 라이브러리 CSS는 master 판을 공개본 줄끝(LF)으로 — 작업본은 autocrlf로 CRLF일 수 있다.
    const liveCss = read(dir, PUBLIC['account/src/platform-library.css']), css = fs.readFileSync(path.join(repo, SRC, 'platform-library.css'), 'utf8');
    fs.writeFileSync(path.join(outDir, PUBLIC['account/src/platform-library.css']), liveCss.includes('\r\n') ? css.replace(/\r?\n/g, '\r\n') : css.replace(/\r\n/g, '\n'));
    const rev = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo }).toString().trim();
    const report = { master: rev, live: { bytes: Buffer.byteLength(live), v: sha12(Buffer.from(live, 'utf8')) }, candidate: { bytes: Buffer.byteLength(candidate), v: sha12(Buffer.from(candidate, 'utf8')) },
      regionA: { statements: [a0, a1], bytes: [A.end - A.start, r.A.length] }, regionR: { statements: [r0, r1], bytes: [R.end - R.start, r.R.length] },
      missing: [...usedOutside].filter(n => !r.outputNames.has(n)), duplicateTopLevel: [...counts].filter(([, c]) => c > 1).map(([n]) => n),
      added: [...r.outputNames].filter(n => !oldNames.has(n)), removed: [...oldNames].filter(n => !r.outputNames.has(n)),
      globals: { live: liveGlobals.size, candidate: candidateGlobals.size, onlyCandidate: [...candidateGlobals].filter(n => !liveGlobals.has(n)), onlyLive: [...liveGlobals].filter(n => !candidateGlobals.has(n)) },
      newStatements: r.Rstatements.map(st => st.owner.replace(SRC + '/', '') + ' ' + (st.declared.join(',') || '(식)')) };
    fs.writeFileSync(path.join(outDir, 'patch-report.json'), JSON.stringify(report, null, 1) + '\n');
    console.log(JSON.stringify(report, null, 1));
    if (report.missing.length || report.duplicateTopLevel.length || report.globals.onlyCandidate.length) process.exit(1);
  } else if (command === '시험모듈') {
    const [dir, out] = args; if (!dir || !out) throw Error('node patch-live.cjs 시험모듈 <후보 폴더> <출력.mjs>');
    fs.writeFileSync(out, L.testModule(read(dir, PUBLIC['account/dist/platform.js'])));
    console.log(out);
  } else throw Error('node patch-live.cjs 받기|옛판|후보|시험모듈 …');
})().catch(e => { console.error(e.stack || e); process.exit(1); });
