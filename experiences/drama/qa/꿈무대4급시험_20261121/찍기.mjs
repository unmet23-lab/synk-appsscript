#!/usr/bin/env node
// 꿈 무대 4급 시험판을 휴대폰 크기(390×844, 3배)로 실제로 눌러 가며 찍는다(2026-11-21).
// 학생 목소리 대신 이 PC의 한국어 음성(Windows SAPI Heami)으로 대답을 읽혀 가짜 마이크로 넣는다. 대답 3만 「탄 바람에」로 틀리게 읽힌다.
// 받아쓰기(이 PC의 faster-whisper) · 판정 · 코치 노트 · 놓친 곳 · 3일 뒤 다시 만나기는 시험판 코드 그대로 돈다. 날 넘김은 시험판 고리(window.시험판.날넘김)로 한다.
//   node experiences/drama/qa/꿈무대4급시험_20261121/찍기.mjs --밖 <PNG 폴더> [--포트 4914]
// 먼저 짓기.cjs로 시험판을 짓는다. Playwright는 공용 작업본의 node_modules, 브라우저는 설치된 크롬을 쓴다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 나줄 } from './대본.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 자리 = createRequire(import.meta.url)('./자리.cjs');
const 인자 = (이름, 기본) => { const i = process.argv.indexOf(이름); return i >= 0 ? process.argv[i + 1] : 기본; };
const 밖 = 인자('--밖');
const 포트 = Number(인자('--포트', 4914));
if (!밖) { console.error('--밖 <PNG 폴더>를 주세요'); process.exit(1); }
fs.mkdirSync(밖, { recursive: true });

/* ── 목소리 ── */
const 소리폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-dream-g4-voice-'));
const 틀린줄 = { d3: '처음엔 지하철을 잘못 탄 바람에 수업에 자주 늦었어요.' };
const 읽을것 = [...나줄.map((x) => [`scene-${x.id}`, 틀린줄[x.id] || x.대본]), ['take2-d3', 나줄.find((x) => x.id === 'd3').대본], ['review-d3', 나줄.find((x) => x.id === 'd3').대본]];
const ps1 = path.join(소리폴더, '읽기.ps1');
fs.writeFileSync(ps1, `param([string]$out, [string]$textFile)
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft Heami Desktop')
$s.Rate = -1
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$s.SetOutputToWaveFile($out, $fmt)
$s.Speak([System.IO.File]::ReadAllText($textFile, [System.Text.Encoding]::UTF8))
$s.Dispose()
`, 'utf8');
for (const [이름, 글] of 읽을것) {
  const 글파일 = path.join(소리폴더, `${이름}.txt`);
  fs.writeFileSync(글파일, 글, 'utf8');
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-out', path.join(소리폴더, `${이름}.wav`), '-textFile', 글파일]);
}
console.log(`목소리 ${읽을것.length}줄 → ${소리폴더}`);

/* ── 서버 ── */
const 서버 = spawn(process.execPath, [path.join(여기, '서버.mjs'), String(포트)], { stdio: ['ignore', 'pipe', 'pipe'] });
서버.stdout.on('data', (d) => process.stdout.write(`  [서버] ${d}`));
서버.stderr.on('data', (d) => process.stdout.write(`  [서버] ${d}`));
const 주소 = `http://127.0.0.1:${포트}/`;
for (let i = 0; ; i++) {
  try { const r = await fetch(`${주소}stt/status`); const j = await r.json(); if (j.ok) { console.log(`받아쓰기 ${j.모델} · ${j.장치}`); break; } throw new Error(j.까닭 || '받아쓰기 없음'); }
  catch (e) { if (i > 240) { 서버.kill(); throw e; } await new Promise((r) => setTimeout(r, 1000)); }
}

/* ── 브라우저 ── */
const { chromium } = createRequire(path.join(자리.공용, 'package.json'))('playwright');
const 브라우저 = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'] });
const 문맥 = await 브라우저.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
await 문맥.grantPermissions(['microphone'], { origin: 주소 });
await 문맥.route('**/__voice/**', (route) => {
  const 이름 = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop());
  route.fulfill({ status: 200, contentType: 'audio/wav', body: fs.readFileSync(path.join(소리폴더, 이름)) });
});
// 가짜 마이크: getUserMedia가 웹 오디오의 출력 흐름을 주고, __시험소리(주소)가 그 흐름에 소리 파일을 한 번 튼다.
await 문맥.addInitScript(() => {
  let 틀 = null, 출구 = null;
  const 준비 = () => { if (!틀) { 틀 = new AudioContext(); 출구 = 틀.createMediaStreamDestination(); } return 출구; };
  window.__시험소리 = async (주소) => {
    준비(); await 틀.resume();
    const 소리 = await 틀.decodeAudioData(await (await fetch(주소)).arrayBuffer());
    const 원 = 틀.createBufferSource(); 원.buffer = 소리; 원.connect(출구); 원.start();
    await new Promise((됨) => { 원.onended = 됨; });
  };
  const 본래 = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => (c && c.audio ? 준비().stream : 본래(c));
});
const 쪽 = await 문맥.newPage();
쪽.on('console', (m) => { if (m.type() === 'error') console.log(`  [화면 오류] ${m.text()}`); });
쪽.on('pageerror', (e) => console.log(`  [화면 오류] ${e.message}`));
// 영상을 바꿀 때 브라우저가 앞 영상의 남은 구간 요청을 끊는다(net::ERR_ABORTED). 그 밖의 실패만 센다.
const 실패요청 = [];
쪽.on('requestfailed', (r) => { const 까닭 = r.failure()?.errorText || ''; if (!/ERR_ABORTED/.test(까닭)) 실패요청.push(`${decodeURIComponent(r.url())} (${까닭})`); });
쪽.on('response', (r) => { if (r.status() >= 400) 실패요청.push(`${decodeURIComponent(r.url())} (HTTP ${r.status()})`); });

const 화면 = (이름, 시간 = 240000) => 쪽.waitForSelector(`body[data-화면="${이름}"]`, { timeout: 시간 });
const 쉬기 = (ms) => 쪽.waitForTimeout(ms);
async function 찍기(파일) {
  await 쪽.evaluate(() => document.fonts.ready);
  // 짧은 움직임(판 올라옴 · 자막 · 받아 적기 · 고칠 꼴 · 불꽃)이 끝날 때까지 기다린다. 끝없는 움직임(구 · 깜빡임 · 크롬)과 9초 밀림은 기다리지 않는다.
  await 쪽.waitForFunction(() => document.getAnimations().every((a) => {
    if (a.playState !== 'running') return true;
    const t = a.effect?.getComputedTiming?.();
    return !t || t.iterations === Infinity || t.endTime > 4000;
  }), null, { timeout: 8000 }).catch(() => {});
  await 쉬기(300);
  await 쪽.screenshot({ path: path.join(밖, 파일) });
  console.log(`찍음 ${파일}`);
}
// 내 차례 한 번: 말하기 → 소리 넣기 → 다 말했어요 → 다음
async function 말하기(소리이름, { 찍을 } = {}) {
  await 화면('turn');
  await 쉬기(900);
  if (찍을) await 찍기(찍을);
  await 쪽.click('#말하기');
  await 화면('rec');
  await 쪽.evaluate((u) => window.__시험소리(u), `${주소}__voice/${소리이름}.wav`);
  await 쉬기(400);
  await 쪽.click('#그만');
  await 화면('after');
  await 쪽.click('#다음');
}

try {
  await 쪽.goto(주소);
  await 쪽.evaluate(() => localStorage.clear());
  await 쪽.reload();
  await 화면('intro');
  await 찍기('g2_4급_0_대본.png');
  await 쪽.click('#시작');
  for (const 줄 of 나줄) await 말하기(`scene-${줄.id}`, { 찍을: 줄.id === 'd3' ? 'g2_4급_1_대사차례.png' : null });
  await 화면('coach', 600000);
  await 찍기('g2_4급_2_코치노트.png');
  const 들림 = await 쪽.evaluate(() => JSON.parse(localStorage.getItem('synk.꿈무대4급.v1')).기록.map((r) => `${r.줄} ${r.결과}${r.갈래 ? `/${r.갈래}` : ''} 「${r.들림}」`));
  console.log(`장면 판정\n  ${들림.join('\n  ')}`);

  await 쪽.click('#테이크2');
  await 말하기('take2-d3');
  await 화면('take2-done');
  await 찍기('g2_4급_2b_테이크2.png');
  await 쪽.click('#놓친곳');
  await 화면('missed');
  await 찍기('g2_4급_3_놓친곳.png');

  // 날 넘김은 제품 화면에 단추로 두지 않는다 — 시험판 고리로 넘긴다(주소에 ?시험 을 붙이면 사람도 놓친 곳 아래에서 누를 수 있다).
  await 쪽.evaluate(() => window.시험판.날넘김());
  await 화면('intro');
  await 찍기('g2_4급_4_다시만나는날.png');
  await 쪽.click('#다시만나기');
  await 말하기('review-d3', { 찍을: 'g2_4급_4b_대본가림.png' });
  await 화면('review-done');
  await 찍기('g2_4급_5_혼자해냄.png');
  await 쪽.click('#다른자리');
  await 화면('item');
  const 정답 = await 쪽.evaluate(async () => (await (await fetch('문항.json')).json())['tii-g4-a-059'].answer);
  await 쪽.locator('.보기').nth(정답).click();
  await 화면('item-done');
  await 찍기('g2_4급_6_다른자리.png');
  await 쪽.click('#놓친곳');
  await 화면('missed');
  await 찍기('g2_4급_7_놓친곳_닫힘.png');
  const 끝기록 = await 쪽.evaluate(() => JSON.parse(localStorage.getItem('synk.꿈무대4급.v1')).기록.filter((r) => r.판 !== 'scene').map((r) => `${r.판} ${r.줄} ${r.결과} 「${r.들림 || ''}」`));
  console.log(`뒤 판정\n  ${끝기록.join('\n  ')}`);
  if (실패요청.length) console.log(`실패한 요청 ${실패요청.length}: ${실패요청.slice(0, 5).join(' · ')}`);
} finally {
  await 브라우저.close();
  서버.kill();
  fs.rmSync(소리폴더, { recursive: true, force: true });
}
