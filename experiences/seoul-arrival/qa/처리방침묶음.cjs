'use strict';
// 서울행의 synk.im/privacy 공개 재료(2026-11-05): 공개본 HTML에 이 일의 줄만 정확히 한 번씩 얹은 두 폴더를 만든다(me2-photo-처리방침묶음.cjs와 같은 길).
//   node experiences/seoul-arrival/qa/처리방침묶음.cjs <개정일 YYYY-MM-DD> [--보기]
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const { execFileSync } = require('node:child_process');
const { 공용작업본 } = require('../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../..');
const 값 = process.argv.slice(2);
const 날 = 값[0];
if (!/^\d{4}-\d{2}-\d{2}$/.test(날 || '')) throw Error('개정일 YYYY-MM-DD를 준다');
const OUT = path.join(공용작업본(ROOT), '.tmp', 'seoul-privacy-20261105');
const [y, m, d] = 날.split('-').map(Number);
const 영월 = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1];
const 사본 = path.join(os.homedir(), 'Documents', 'synk-vendor', 'synk-policy-publish.git');
execFileSync('git', ['-C', 사본, 'fetch', '-q', 'origin', 'main'], { stdio: 'ignore' });
const live = execFileSync('git', ['-C', 사본, '-c', 'core.autocrlf=false', 'show', 'FETCH_HEAD:privacy/index.html'], { maxBuffer: 1 << 28 }).toString('utf8');
if (값.includes('--보기')) {
  const 찾기 = (s) => { const i = live.indexOf(s); console.log(`--- ${s} @${i}\n${i < 0 ? '' : live.slice(Math.max(0, i - 80), i + 500)}\n`); };
  for (const s of ['SYNK account and learning records', 'What we do not', 'What SYNK does not', 'do not guess', 'Only if you choose', 'If you choose']) 찾기(s);
  process.exit(0);
}
const 자리 = [
  // 「SYNK 계정과 학습 기록」 — 「직접 고를 때만」 뒤, 「하지 않는 것」 앞에 따로 한 문단(진행 기록은 저절로 남으니 「직접 고를 때만」에 묶지 않는다 — 아르곤 11-05 A3)
  // 「나중에 말할래요」는 칸마다(A1), 로그인한 채 하면 묻지 않고 계정에 · 계정에 이미 있으면 묻지 않음(A2), 「선배를 부르는 말」(A4)
  // 묻는 경우와 안 묻는 경우는 두 문장으로 나누고(Fable FA1), 「아니요」 뒤 「처음부터 시작」은 늘 그렇지 않아 적지 않는다(FA2 — 튜터를 고른 학생은 서울행 없이 보통 입구로 간다)
  ['<strong>하지 않는 것:</strong>', `<strong>SYNK WORLD 첫 이야기:</strong> 직접 적거나 고른 이름과 나라(칸마다 「나중에 말할래요」를 고르면 그 칸은 받지 않습니다), 선배를 부르는 말, 꿈, 준비된 얼굴 가운데 고른 것, 쪽지에 고른 답과, 이야기를 하며 저절로 남는 진행 기록(장면을 끝낸 때, 말한 줄 수, 테이크 2 · 새 상황까지 했는지). 학생증과 이야기를 이어 가는 데만 씁니다. 로그인하지 않았으면 그 기기에만 남고, 로그인한 채 진행하면 계정에 저장합니다. 손님으로 진행한 뒤 로그인하면 그 계정에 저장할지 한 번 묻고, 저장하지 않으면 기기에 남은 것을 지웁니다. 다만 계정에 이미 첫 이야기 기록이 있으면 묻지 않고 계정 기록을 이어 쓰며, 기기에 남은 것은 지웁니다. 보관과 삭제는 아래 「보관과 선택」을 따릅니다(계정을 지우면 학습 기록과 함께 지웁니다).</p>\n    <p><strong>하지 않는 것:</strong>`],
  ['<p>Only if you choose to give them:', `<p>In the first SYNK WORLD story: the name and country you enter (choose “I’ll tell you later” for either and we don’t collect that one), what you call the seniors, your dream, the prepared face you chose and your reply to the note, plus the progress the story keeps automatically as you play (when you finished each scene, how many lines you spoke, and whether you did take 2 and the new situation). These are used only for your student ID and to continue the story. If you are not signed in they stay only on that device; if you play while signed in they are saved to your account. If you played as a guest and then sign in, we ask once whether to save them to that account; if you say no, the copy on the device is deleted. If the account already has a first-story record, we keep using it without asking and delete the copy on the device. They are kept and deleted like your learning records below (deleted with your account).</p>\n      <p>Only if you choose to give them:`],
];
let html = live;
for (const [from, to] of 자리) {
  if (html.split(from).length !== 2) throw Error('공개본에 정확히 한 번 있어야 한다: ' + from.slice(0, 70));
  html = html.replace(from, () => to);
}
// 「적용일」 줄(한국어)과 영문 문단 끝의 개정 날짜에 추가 기록
const 추가 = [[/싱크타운 이용 요약 보관 30일로: 2026년 10월 28일/, (s) => `${s} · 첫 이야기 기록 추가: ${y}년 ${m}월 ${d}일`],
  [/SYNK TOWN usage summary kept for 30 days from 28 October 2026\./, (s) => `${s} First-story records added ${d} ${영월} ${y}.`]];
for (const [re, fn] of 추가) { if (!re.test(html)) throw Error('적용일 줄을 못 찾음'); html = html.replace(re, fn); }
// base · new만 새로 쓴다. 후보 폴더는 앞 회차 검수의 배포 증거(검수묶음 다시가 읽는다)라 지우지 않고, 다음 후보는 빈 새 이름으로 준다
// (11-05: OUT을 통째로 지웠다가 다시 검수가 앞 후보.json ENOENT로 멈췄다).
for (const [dir, text] of [['base', live], ['new', html]]) {
  fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
  const file = path.join(OUT, dir, 'privacy', 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
let 후보 = path.join(OUT, '후보');
for (let n = 2; fs.existsSync(후보); n++) 후보 = path.join(OUT, '후보' + n);
const posix = (p) => p.replaceAll('\\', '/');
console.log(['node tools/공개.js 올리기', '--원본', posix(path.join(OUT, 'new')), '--기준폴더', posix(path.join(OUT, 'base')), 'privacy/index.html', '--후보폴더', posix(후보)].join(' '));
