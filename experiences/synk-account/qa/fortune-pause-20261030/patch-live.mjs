// 무료 운세 잠시 내림(2026-10-30) — 공개본 account/dist/platform.js에 이번 원천 고침만 글자로 얹는다.
// 공개본 묶음은 master 빌드와 구성이 달라 다시 묶어 덮지 않는다(현장 노트 「공개본 account/dist/platform.js를 master 빌드로 덮으면」).
// 고칠 곳마다 공개본에서 정확히 한 번 맞는지, 넣는 글이 같은 원천으로 만든 master 빌드에 그대로 있는지, 혜택 목록이 원천과 같은지 단언한다.
// 쓰기: node patch-live.mjs <공개본 platform.js> <master 빌드 dist/platform.js> <출력 platform.js>
import fs from 'node:fs';
import { MEMBER_BENEFITS } from '../../../../desktop/renderer/benefits.mjs';

const [livePath, buildPath, outPath] = process.argv.slice(2);
if (!outPath) { console.error('쓰기: node patch-live.mjs <공개본 platform.js> <master 빌드 platform.js> <출력>'); process.exit(2); }
const live = fs.readFileSync(livePath, 'utf8'), build = fs.readFileSync(buildPath, 'utf8');
const fail = message => { console.error('멈춤: ' + message); process.exit(1); };
const count = (text, part) => text.split(part).length - 1;

// 1. 혜택 목록에서 무료 운세 칸을 뺀다(목록의 마지막 칸).
const start = ',{"id":"fortune","name":"무료 운세"', tail = '풀이는 재미로 보는 참고예요."}', after = '];function memberBenefit(';
if (count(live, start) !== 1 || count(live, tail + after) !== 1) fail('공개본의 무료 운세 칸 경계가 한 번씩 맞지 않는다');
const from = live.indexOf(start), to = live.indexOf(tail + after) + tail.length;
if (!(from < to) || live.slice(from + 1, to).includes('{"id":"', 1)) fail('무료 운세 칸 안에 다른 칸이 들어 있다');
let text = live.slice(0, from) + live.slice(to);

// 2~10. 글과 계정 라이브러리 칸. [공개본 글, 새 글] — 새 글은 master 빌드에 그대로 있어야 한다.
const swaps = [
  ['<p>내 성향, AI 구독 계정판, 무료 운세, 플레저.<br>SYNK ID 하나로 넷 다 써요.</p>', '<p>내 성향, AI 구독 계정판, 플레저.<br>SYNK ID 하나로 셋 다 써요.</p>'],
  ['data-action="scroll-benefits">네 가지 보기 <span', 'data-action="scroll-benefits">세 가지 보기 <span'],
  ['<p class="benefit-disclosure">네 가지 모두 무료예요.<br>플레저와 무료 운세는 로그인 없이도 열려요.</p>', '<p class="benefit-disclosure">세 가지 모두 무료예요.<br>플레저는 로그인 없이도 열려요.</p>'],
  ['<h2 id="benefit-collection-title">네 가지 회원 혜택</h2>', '<h2 id="benefit-collection-title">세 가지 회원 혜택</h2>'],
  ['<p>플레저와 무료 운세는 웹(synk.im)에서 바로 열려요. AI 구독 계정판은 PC 앱에서만 써요.</p>', '<p>플레저는 웹(synk.im)에서 바로 열려요. AI 구독 계정판은 PC 앱에서만 써요.</p>'],
  ['(query?"찾은 회원 혜택":"네 가지 회원 혜택")', '(query?"찾은 회원 혜택":"세 가지 회원 혜택")'],
  ['WORLD 미니게임, PATH 면접 연습, 플레저와 무료 운세는 웹에서 바로 열려요.', 'WORLD 미니게임, PATH 면접 연습, 플레저는 웹에서 바로 열려요.'],
  ['RETIRED_PLATFORM_APP_IDS=new Set(["rehearsal","family-album"])', 'RETIRED_PLATFORM_APP_IDS=new Set(["rehearsal","family-album","fortune"])'],
];
const newsAt = build.indexOf('var news=[{id:"fortune-pause",');
if (newsAt < 0) fail('master 빌드에 새소식 칸이 없다');
const newsItem = build.slice(newsAt + 'var news=['.length, build.indexOf('},{id:"world-settings",', newsAt) + 2);
if (!/^\{id:"fortune-pause",[^{}]*\},$/.test(newsItem)) fail('master 빌드의 새소식 칸 모양이 예상과 다르다: ' + newsItem.slice(0, 80));
swaps.push(['var news=[{id:"world-settings",', 'var news=[' + newsItem + '{id:"world-settings",']);
for (const [before, after2] of swaps) {
  if (count(text, before) !== 1) fail(`공개본에서 ${count(text, before)}번 맞음: ${before.slice(0, 60)}`);
  if (!build.includes(after2.replace(/^var news=\[/, 'var news=['))) fail('master 빌드에 없는 새 글: ' + after2.slice(0, 60));
  if (build.includes(before)) fail('master 빌드에 옛 글이 남아 있다: ' + before.slice(0, 60));
  text = text.replace(before, () => after2);
}

// 혜택 목록이 원천(desktop/renderer/benefits.mjs)과 같은지 — 공개본 목록은 따옴표 붙은 JSON 꼴이다.
const listAt = text.indexOf('MEMBER_BENEFITS=[{"id":"insight"');
if (listAt < 0) fail('공개본 혜택 목록을 못 찾았다');
const listText = text.slice(listAt + 'MEMBER_BENEFITS='.length, text.indexOf(after, listAt) + 1);
const liveList = JSON.parse(listText), sourceList = JSON.parse(JSON.stringify(MEMBER_BENEFITS));
const differences = [];
if (liveList.map(item => item.id).join() !== sourceList.map(item => item.id).join()) fail('혜택 순서가 원천과 다르다: ' + liveList.map(item => item.id).join());
for (const [index, item] of liveList.entries()) for (const key of new Set([...Object.keys(item), ...Object.keys(sourceList[index])])) {
  if (JSON.stringify(item[key]) !== JSON.stringify(sourceList[index][key])) differences.push(`${item.id}.${key}`);
}

fs.writeFileSync(outPath, text);
const left = [...text.matchAll(/운세|fortune/g)].map(match => text.slice(Math.max(0, match.index - 50), match.index + 30).replace(/\s+/g, ' '));
console.log(JSON.stringify({ 바꾼곳: swaps.length + 1, 줄어든바이트: Buffer.byteLength(live) - Buffer.byteLength(text), 혜택: liveList.map(item => item.id), 원천과다른칸: differences, 남은운세낱말: left }, null, 1));
