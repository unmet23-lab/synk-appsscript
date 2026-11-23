'use strict';
// app-shell.mjs 셋째 후보 c = 검수한 후보 b(라이브 f6a4872ef + 새 길 조각)를 앞면 세션이 올린 새 라이브(f50ef5c71 — 첫날 끝 · 맞춤 앞면 1차 공개)에
// 3방향으로 얹는다. 겹침 둘은 master(origin)의 차례대로 둘 다 남긴다 — ① 로그아웃: 새 길 표지 · clearMonthAnswer(후보) + 앞면 갈래
// (front?.active() → front.drop · startOpening, 라이브) ② 입구 관문: offer는 후보의 새 길 블록(master의 한글 기록 옮기기 조각은 공개 전이라 뺀다),
// read는 라이브의 앞면 튜터 줄. 앞면 커밋은 이제 라이브라 되돌리지 않는다.
//   node rebase-shell-c.cjs            → 겹침을 풀어 보고만 한다
//   node rebase-shell-c.cjs --쓰기     → <새 폴더>/pub/world/app-shell.mjs · pubbase/world/app-shell.mjs(새 라이브)
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync, execFileSync } = require('node:child_process');
const E = 'D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp';
const OLD = `${E}/cand-step1`, NEW = `${E}/cand-step1c`;
const LIVE = 'f50ef5c71';
const lf = s => s.replace(/\r\n/g, '\n');
const pubRaw = fs.readFileSync(`${OLD}/pub/world/app-shell.mjs`, 'utf8');
const crlf = pubRaw.includes('\r\n');
const pub = lf(pubRaw), base = lf(fs.readFileSync(`${OLD}/pubbase/world/app-shell.mjs`, 'utf8'));
const liveBytes = execFileSync('curl', ['-s', '-f', `https://raw.githubusercontent.com/unmet23-lab/synk-policy/${LIVE}/world/app-shell.mjs`], { maxBuffer: 1 << 26 });
const live = liveBytes.toString('utf8');
if (live.includes('\r')) throw Error('라이브 app-shell에 CR이 있다 — 줄끝을 다시 본다');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rbc-'));
const [c, b, o] = ['c', 'b', 'o'].map(n => path.join(tmp, n));
fs.writeFileSync(c, live); fs.writeFileSync(b, base); fs.writeFileSync(o, pub);
const r = spawnSync('git', ['merge-file', '-p', '-L', 'live', '-L', 'base', '-L', 'ours', c, b, o], { encoding: 'utf8', maxBuffer: 1 << 28 });
let text = r.stdout;
const re = /^<{7} live\n([\s\S]*?)^={7}\n([\s\S]*?)^>{7} ours\n/gm;
const blocks = [];
text.replace(re, (all, l, m) => { blocks.push({ all, live: l, ours: m }); return all; });
if (blocks.length !== 2) throw Error(`겹침 ${blocks.length}개 — 둘을 기대했다`);
const once = (s, frag, label) => { if (s.split(frag).length !== 2) throw Error(`${label}: 「${frag.slice(0, 60)}」이 꼭 한 번이 아니다`); };
// ① 로그아웃
const FRONT = 'close();if(front?.active()){front.drop();entryDestinationHandled=false;void startOpening();}else if(home.isMaru)await entryGate.start();else welcome();}catch(e)';
const PLAIN = 'close();if(home.isMaru)await entryGate.start();else welcome();}catch(e)';
{
  const { live: l, ours: m } = blocks[0];
  if (l.split('\n').length !== 2 || !l.startsWith(' logout:async()=>{')) throw Error('① 라이브 쪽이 로그아웃 한 줄이 아니다');
  once(l, FRONT, '① 라이브'); once(m, PLAIN, '① 후보'); once(m, 'leavingAtlas.noteLogout()', '① 후보'); once(m, 'clearMonthAnswer(localStorage,leaving)', '① 후보');
  // 라이브 줄은 후보 줄에서 새 길 조각을 뺀 것과 같아야 한다(다른 고침이 섞이지 않았다)
  const oursPlain = m.split('\n').filter(x => !x.includes('leavingAtlas') && !x.includes('Atlas 새 길의 로그아웃 표지')).join('');
  const expectLive = oursPlain.replace('   await client.logout()', 'await client.logout()').replace('if(leaving){noteDeviceAccount(localStorage,leaving,signedOutAt);clearMonthAnswer(localStorage,leaving);}', 'if(leaving)noteDeviceAccount(localStorage,leaving,signedOutAt);').replace(PLAIN, FRONT);
  if (expectLive !== l.replace(/\n$/, '')) throw Error('① 라이브 줄이 「후보 − 새 길 조각 + 앞면 갈래」와 다르다');
  blocks[0].fix = m.replace(PLAIN, FRONT);
}
// ② 입구 관문
{
  const { live: l, ours: m } = blocks[1];
  const ll = l.split('\n').filter(Boolean), mm = m.split('\n').filter(Boolean);
  if (ll.length !== 2 || ll[0] !== ' offer:identity=>deviceRecords.offer(identity),') throw Error('② 라이브 offer 줄');
  if (!ll[1].startsWith(' read:()=>(') || !ll[1].includes("front?.free()&&!dramaInvite.language?'front':null")) throw Error('② 라이브 read 줄');
  const read = mm.at(-1);
  if (read !== ll[1].replace("(front?.free()&&!dramaInvite.language?'front':null)", 'null')) throw Error('② 후보 read 줄이 라이브 read 줄의 앞면 조각만 다른 것이 아니다');
  if (mm[0] !== ' offer:identity=>{' || !m.includes('next.guestMove(input)')) throw Error('② 후보 offer 블록');
  blocks[1].fix = [...mm.slice(0, -1), ll[1]].join('\n') + '\n';
}
for (const block of blocks) text = text.replace(block.all, () => block.fix);
if (/^(<{7}|={7}|>{7})/m.test(text)) throw Error('표식이 남았다');
// 앞면 묶음의 newEngine: 라이브는 atlasNextOn이 없어 ()=>false다. 새 길을 얹으면 master처럼 새 엔진 계정이 앞면 대신 새 길로 가게 한다
// (앞면 세션 11-20). 꺼진 판에서는 atlasNextOn이 false라 라이브와 같다.
once(text, 'newEngine:()=>false', '앞면 newEngine');
once(text, 'const atlasNextGuestOn=atlasNextOn&&', '새 길 손님 스위치');
text = text.replace('newEngine:()=>false', "newEngine:owner=>atlasNextOn&&(owner!=='guest'||atlasNextGuestOn)");
// 검수 모델 이름이 남지 않았는지(라이브의 앞면 조각 포함)
const names = text.match(/카본|아르곤|Opus|Fable|Claude|GPT|Codex|그록/g) || [];
console.log(`겹침 2 풂 · 바이트 ${Buffer.byteLength(text)} · 검수 모델 이름 ${names.length}${names.length ? ' — ' + [...new Set(names)].join(',') : ''}`);
// master와 견줌: master에서 공개 전 한글 기록 옮기기 조각을 빼면 같은 줄 차례인지는 사람이 본다 — 여기서는 앞면 조각 셋이 모두 실렸는지만
for (const frag of ['front?.active()){front.drop()', "front?.free()&&!dramaInvite.language?'front':null", 'next.guestMove(input)', 'leavingAtlas.noteLogout()']) once(text, frag, '결과');
if (process.argv.includes('--쓰기')) {
  if (names.length) throw Error('검수 모델 이름이 남아 쓰지 않는다');
  fs.rmSync(NEW, { recursive: true, force: true });
  fs.cpSync(OLD, NEW, { recursive: true });
  const out = crlf ? text.replace(/\n/g, '\r\n') : text;
  fs.writeFileSync(`${NEW}/pub/world/app-shell.mjs`, out);
  fs.writeFileSync(`${NEW}/pubbase/world/app-shell.mjs`, liveBytes);
  fs.writeFileSync(`${NEW}/new/world/app-shell.mjs`, out);
  console.log(`씀 ${NEW} (pub · new의 app-shell = 풀린 판${crlf ? '(CRLF)' : ''}, pubbase의 app-shell = 라이브 ${LIVE})`);
}
