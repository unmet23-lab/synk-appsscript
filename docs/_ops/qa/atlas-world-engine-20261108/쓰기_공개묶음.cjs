'use strict';
// 쓰기 연습을 말하기(E)와 같은 길로(2026-11-09, 쓰기_같은길.md)의 synk.im/world 공개 재료 — 공개본(synk-policy-publish origin/main) 위에 이 고침만 얹는다.
//  · 앱 셸 · 배우기 화면 · 알림 기기: 공개본 + (바탕 → 내 판) 3방향(git merge-file, 충돌이면 멈춤). 얹은 뒤 거꾸로(후보 + (내 판 → 바탕)) 돌려 공개본과 바이트가 같은지
//    본다 — 후보 = 공개본 + 이 고침뿐(master에만 있는 남의 미공개 변경이 안 실린다)을 도구가 증명한다.
//  · 쓰기 모듈: 공개본은 10-21 판이다(master의 「한 가지 고치기」 · 도움 기록은 GPT 작업으로 공개 대기 — 트랙). 3방향이 아니라 같은 고침을 그 판의 record() 글에
//    앵커로 끼운다(앵커는 하나만 맞아야 한다). 그 판의 기록 꼴(도움은 자동 피드백 hint 하나)은 그대로다.
//  · 새 이름을 정적으로 부르는 줄은 없다(앱 셸은 쓰기 모듈의 새 이름을 부르지 않는다) — 옛 판이 캐시에 남은 10분 동안 깨지지 않는다.
//  · check/: 후보 네 파일 + 그 파일들과 공개본 계정 묶음이 부르는 공개본 파일(import를 따라 모은다). 쓰기_공개검사.mjs가 돌린다.
//   node docs/_ops/qa/atlas-world-engine-20261108/쓰기_공개묶음.cjs [바탕=HEAD] [내 판=작업본] [--판 <이름>]
//   → 공용 작업본 .tmp/atlas-world-writing-pub-20261109[-<판>]/{base,new,check}/…, 목록 · 검사 · 미리 보기 명령을 찍는다.
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..');
const argv = process.argv.slice(2), 판at = argv.indexOf('--판'), 판 = 판at >= 0 ? argv[판at + 1] : '';
if (판at >= 0 && !/^[A-Za-z0-9_-]{1,40}$/.test(판 || '')) throw Error(`--판은 영문 · 숫자 · - · _ 1~40자다: ${판}`);
const [BASE = 'HEAD', NEW = '작업본'] = argv.filter((x, i) => !x.startsWith('--') && !(판at >= 0 && i === 판at + 1));
const TMP = path.join(공용작업본(ROOT), '.tmp'), OUT = path.join(TMP, `atlas-world-writing-pub-20261109${판 ? `-${판}` : ''}`);
if (path.dirname(path.resolve(OUT)) !== path.resolve(TMP)) throw Error(`지울 폴더가 .tmp 바로 아래가 아니다: ${OUT}`);
const LIVE = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const show = (rev, file) => { try { return execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const read = (rev, file) => rev === '작업본' ? (fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file)) : null) : show(rev, file);
const live = pub => { try { return execFileSync('git', ['-C', LIVE, 'cat-file', '-p', `origin/main:${pub}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const head = () => execFileSync('git', ['-C', LIVE, 'rev-parse', 'origin/main'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim();
const config = JSON.parse(live('world/world-config.json')?.toString('utf8') || 'null');
if (!config?.account?.learningUrl || config.basePath !== '/world/') throw Error('공개본 world-config.json을 못 읽었다 — 공개 저장소 사본을 먼저 fetch한다');
// build-world-app-public.mjs rewrite()와 같은 글(E_공개묶음.cjs와 같다). relative는 공개 묶음 안 경로(world/ 뒤).
function rewrite(text, relative) {
  text = text.replaceAll('../synk-world-home/', relative.startsWith('brand-opening/') ? '../' : './').replaceAll('href="../learning-hub/"', `href="${config.account.learningUrl}"`);
  if (!relative.includes('/')) text = text.replaceAll('../brand-opening/', './brand-opening/');
  return text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g, (_, quote, folder) => quote + config.basePath + folder);
}
const lf = buffer => buffer.toString('utf8').replace(/\r\n/g, '\n');

// 공개본 쓰기 모듈(10-21 판)의 record() 글과, 같은 고침을 그 판 꼴(도움은 assisted → hint 하나)로 쓴 글.
const WRITING = 'world/world-writing-practice.mjs';
const LIVE_RECORD = [
  ' function record(it,{assisted}){',
  "  const c=typeof coach==='function'?(()=>{try{return coach();}catch{return null;}})():null;if(!c)return;",
  '  try{',
  "   pids[it.id]??=c.present({id:`writing-${it.id}`,itemKey:`writing.${it.id}`,familyKey:`writing.${it.id}`,skillId:WRITING_SKILLS[it.type],modality:'writing',difficulty:2,responseFormat:'unknown',audioRequired:false});",
  "   if(assisted)c.help(pids[it.id],'hint');",
  '   tries[it.id]=(tries[it.id]||0)+1;c.answer(pids[it.id],{correct:null,assessable:false,attemptNo:tries[it.id]});',
  '  }catch{/* 코치 지도에 TOPIK II 쓰기 항목이 없으면 기기 기록만 남는다 */}',
  ' }', ''].join('\n');
const NEW_RECORD = [
  ' // 판(제시)은 그 코치 안에서만 산다. 코치가 바뀌었거나(게임을 연 뒤 새 계정 통로 — 앱 셸 practiceCoach) 판이 끝났으면(기기 장부 접힘 · 다른 탭이 기록을 새로',
  ' // 시작) 판 호출이 던진다 — 그 판을 버리고 새 판으로 그 시도를 한 번 더 남긴다(말하기 attempted와 같은 길, 쓰기는 11-09 Edge로 재현). 시도 번호는 남긴 뒤에만',
  ' // 올린다(던진 시도로 번호가 비면 그 판의 뒤 시도가 모두 「번호가 이어지지 않음」으로 막힌다).',
  ' function record(it,{assisted},retry=true){',
  "  const c=typeof coach==='function'?(()=>{try{return coach();}catch{return null;}})():null;if(!c)return;",
  '  const fresh=!pids[it.id];',
  '  try{',
  "   pids[it.id]??=c.present({id:`writing-${it.id}`,itemKey:`writing.${it.id}`,familyKey:`writing.${it.id}`,skillId:WRITING_SKILLS[it.type],modality:'writing',difficulty:2,responseFormat:'unknown',audioRequired:false});",
  "   if(assisted)c.help(pids[it.id],'hint');",
  '   const attemptNo=(tries[it.id]||0)+1;c.answer(pids[it.id],{correct:null,assessable:false,attemptNo});tries[it.id]=attemptNo;',
  '  }catch{delete pids[it.id];delete tries[it.id];if(retry&&!fresh)record(it,{assisted},false);/* 코치 지도에 TOPIK II 쓰기 항목이 없으면 기기 기록만 남는다 */}',
  ' }', ''].join('\n');

// 검사 폴더에 옮길 공개본 파일의 뿌리 — 후보가 부르는 모듈과, 검사가 쓰는 계정 묶음 · 생활 진도 · 생활 내용 · 문항 은행. import를 따라 나머지를 모은다.
const CHECK_ROOTS = ['world-account.bundle.mjs', 'life-progress.mjs', 'life-content.mjs', 'world-writing-items.json'];
const importsOf = text => [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"'?#]+)(?:\?[^"']*)?\1/g)].map(m => m[2]);

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const write = (dir, pub, text) => { const target = path.join(OUT, dir, pub); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); };
  const items = [], merges = [];
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'writing-pub-'));
  const merge = (ours, older, theirs) => {
    const files = ['ours', 'older', 'theirs'].map(name => path.join(scratch, name));
    [ours, older, theirs].forEach((text, i) => fs.writeFileSync(files[i], text));
    const r = spawnSync('git', ['merge-file', '-p', '-L', 'a', '-L', 'b', '-L', 'c', ...files], { encoding: 'utf8', maxBuffer: 1 << 28 });
    return { status: r.status, text: r.stdout };
  };

  // ① 앱 셸 · 배우기 화면 · 알림 기기: 공개본 + (바탕 → 내 판), 그리고 거꾸로 돌려 공개본이 되는지.
  const RAW = [
    ['experiences/synk-world-app/app-shell.mjs', 'app-shell.mjs'],
    ['experiences/synk-world-app/world-learning-ui.mjs', 'world-learning-ui.mjs'],
    ['experiences/synk-world-app/world-reminder-device.mjs', 'world-reminder-device.mjs'],
  ];
  for (const [src, relative] of RAW) {
    const pub = `world/${relative}`, now = live(pub), base = show(BASE, src), mine = read(NEW, src);
    if (!now || !base || !mine) throw Error(`파일이 없다: ${pub}`);
    const [l, b, m] = [lf(now), rewrite(lf(base), relative), rewrite(lf(mine), relative)];
    if (b === m) throw Error(`바탕과 내 판이 같다: ${pub}`);
    const forward = merge(l, b, m);
    if (forward.status !== 0) throw Error(`3방향 충돌 ${forward.status}곳: ${pub} — 공개본에서 내 줄을 손으로 다시 맞춘다`);
    const back = merge(forward.text, m, b);
    if (back.status !== 0 || back.text !== l) throw Error(`거꾸로 돌려 공개본이 안 된다: ${pub} — 후보에 이 고침 밖의 차이가 섞였다`);
    write('base', pub, l); write('new', pub, forward.text);
    merges.push({ pub, liveEqualsBase: l === b, reversible: true });
    items.push(pub);
  }

  // ② 쓰기 모듈: 공개본 10-21 판에 같은 고침을 앵커로.
  const liveWriting = lf(live(WRITING) || Buffer.from(''));
  const count = liveWriting.split(LIVE_RECORD).length - 1;
  if (count !== 1) throw Error(`쓰기 모듈: record() 앵커가 하나가 아니다(${count}) — 공개본이 바뀌었다, 앵커를 다시 맞춘다`);
  if (liveWriting.includes('world-writing-focus.mjs')) throw Error('쓰기 모듈: 공개본에 「한 가지 고치기」가 있다 — 3방향으로 바꿔 짓는다');
  const patchedWriting = liveWriting.replace(LIVE_RECORD, () => NEW_RECORD);
  if (patchedWriting.replace(NEW_RECORD, () => LIVE_RECORD) !== liveWriting) throw Error('쓰기 모듈: 되돌려 공개본이 안 된다');
  write('base', WRITING, liveWriting); write('new', WRITING, patchedWriting);
  merges.push({ pub: WRITING, anchored: true, reversible: true });
  items.push(WRITING);

  // ③ 검사 폴더: 후보 네 파일 + import를 따라 모은 공개본 파일(world/ 안만). 앱 셸은 검사가 글로만 읽어(문서 없이 import되지 않는다) 그 import는 따라가지 않는다.
  const candidate = new Map(items.map(pub => [pub.slice('world/'.length), fs.readFileSync(path.join(OUT, 'new', pub), 'utf8')]));
  const copied = new Set(), queue = [...candidate.keys(), ...CHECK_ROOTS];
  while (queue.length) {
    const relative = path.posix.normalize(queue.shift());
    if (copied.has(relative) || relative.startsWith('..')) continue;
    copied.add(relative);
    const text = candidate.get(relative) ?? (() => { const bytes = live(`world/${relative}`); if (!bytes) throw Error(`공개본에 없다: world/${relative}`); return lf(bytes); })();
    write('check', relative, text);
    if (/\.m?js$/.test(relative) && relative !== 'app-shell.mjs') for (const spec of importsOf(text)) queue.push(path.posix.join(path.posix.dirname(relative), spec));
  }
  // 공개본 판은 같은 폴더에 <이름>.live.mjs로 둔다(상대 import가 그대로 산다) — 검사가 공개본 판의 결함을 재현한다.
  for (const pub of items) write('check', pub.slice('world/'.length).replace(/\.mjs$/, '.live.mjs'), fs.readFileSync(path.join(OUT, 'base', pub)));
  fs.rmSync(scratch, { recursive: true, force: true });

  fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify({ live: head(), base: BASE, new: NEW, items, merges, check: [...copied].sort() }, null, 1) + '\n');
  console.log(JSON.stringify({ out: OUT, live: head(), items, merges, check: copied.size }, null, 1));
  console.log(`끼운 줄 돌리기: node docs/_ops/qa/atlas-world-engine-20261108/쓰기_공개검사.mjs "${path.join(OUT, 'check')}"`);
  console.log(`미리 보기: node tools/공개.js 올리기 --원본 "${path.join(OUT, 'new')}" --기준폴더 "${path.join(OUT, 'base')}" ${items.join(' ')} --후보폴더 "${path.join(OUT, 'candidate')}"`);
}
main().catch(error => { console.error(error); process.exit(1); });
