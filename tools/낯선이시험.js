#!/usr/bin/env node
'use strict';
/* 낯선 사람 이해 시험 재료 (2026-10-23). 영상은 읽기만 하고 재료는 .tmp에 만든다.
 *
 * 10-23 유호님 「synkbrief랑 yuhobuilds가 뭘 말하려는건지 도저히 이해가 안가」 — 두 편 모두 사실 검수는 통과했었다.
 * 같은 날 「synk lab은 훌륭해」라고 하신 관용구 퀴즈 #5와 견주어 본 차이는 알아듣기였다. 영상을 2초마다 한 장씩
 * 초를 찍어 묶고 들리는 말을 초와 함께 적은 뒤, 이 대화 맥락이 없는 새 하위 에이전트에게 줄 질문(그 계정의
 * 시청자 한 사람 역할)을 만든다. 판정은 답을 받은 세션이 한 장 기획의 「한 문장」과 견줘서 한다
 * (docs/마케팅/기획장부/제작절차.md §3 「낯선 사람 이해 시험」).
 *
 *   node tools/낯선이시험.js <영상.mp4> --말 <말.txt|.srt> --브랜드 <lab-en|lab-mn|lab-cn|lab-mm|synkbrief|yuhobuilds|pulse> [--밖 <폴더>] [--컷 <초,초,…>]
 *
 * 만드는 것: <밖>/정지컷_2초마다.jpg · <밖>/말.txt · <밖>/질문.md(하위 에이전트에 그대로 줄 글).
 * 2초보다 짧은 컷이 많은 영상은 --컷에 컷이 시작하는 초를 주면 정지컷_컷마다.jpg(컷마다 한 장)로 찍는다.
 * 말.txt는 줄마다 「12.3s  들리는 말」 꼴이 좋다. .srt를 주면 그 꼴로 바꾼다.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

const 시청자 = {
  'lab-en': { 곳: '유튜브 쇼츠', 사람: '한국어를 이제 막 배우기 시작한 영어 사용자' },
  'lab-mn': { 곳: '인스타 릴스', 사람: '한국어를 이제 막 배우기 시작한 몽골 사람(몽골어로 생각한다)' },
  // 10-25 두 채널 판(기획장부/LAB.md 머리말) — 원본 편이 통과한 뒤 옮긴 판의 최종본을 그 나라 사람이 본다.
  'lab-cn': { 곳: '샤오훙수 영상 노트', 사람: '한국어를 이제 막 배우기 시작한 중국 사람(간체 중국어로 생각한다)' },
  'lab-mm': { 곳: '틱톡', 사람: '한국어를 이제 막 배우기 시작한 미얀마 사람(버마어로 생각한다)' },
  synkbrief: { 곳: '인스타 릴스', 사람: 'AI 도구를 가끔 쓰는 30대 한국인 직장인' },
  yuhobuilds: { 곳: '인스타 릴스', 사람: 'AI 도구를 일에 자주 쓰지만 개발자는 아닌 30대 한국인 직장인·1인 사업가' },
  // 10-26 PULSE 포트폴리오 광고(이야기 한 장의 애니매틱 · 완성본) — 광고를 건너뛰지 않고 처음 본 사람.
  pulse: { 곳: '유튜브', 사람: '광고를 건너뛰지 않고 끝까지 볼지 고민하는 20~30대 한국인 직장인' },
};

// .srt를 「12.3s  말」 줄로 바꾼다. 번호·시각 줄만 있는 블록은 건너뛴다.
function srtToLines(text) {
  return String(text).replace(/\r\n/g, '\n').trim().split(/\n\s*\n+/).map((block) => {
    const lines = block.split('\n');
    const timeAt = lines.findIndex((line) => line.includes('-->'));
    if (timeAt < 0) return null;
    const m = lines[timeAt].match(/(\d+):(\d+):(\d+)[,.](\d+)/);
    if (!m) return null;
    const sec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(`0.${m[4]}`);
    const words = lines.slice(timeAt + 1).join(' ').trim();
    return words ? `${sec.toFixed(1)}s  ${words}` : null;
  }).filter(Boolean);
}

function readSpeech(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (/\.srt$/i.test(file)) return srtToLines(text).join('\n') + '\n';
  return text.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

function buildPrompt({ brand, sheet, speech, cuts = false }) {
  const who = 시청자[brand];
  if (!who) throw new Error(`브랜드는 ${Object.keys(시청자).join(' · ')} 가운데 하나다: ${brand}`);
  const every = cuts
    ? '컷이 바뀔 때마다 한 장(그 컷의 가운데 장면), 각 칸 왼쪽 위 숫자는 그 컷이 화면에 나오는 초(시작-끝)다 — 짧은 컷은 그만큼 잠깐 지나간다.'
    : '2초마다 한 장, 각 칸 왼쪽 위 숫자가 영상의 초다.';
  return [
    `너는 ${who.곳}를 넘기다가 이 영상을 처음 본 사람이다. ${who.사람}이고, 이 계정도 만든 사람도 이 영상의 배경도 모른다. 아래 두 파일만 Read 도구로 열어 보고 답해라. 다른 파일·폴더·인터넷은 보지 마라.`,
    '',
    `- 정지컷 묶음(그림): ${sheet} — ${every} 왼쪽에서 오른쪽, 위에서 아래 순서.`,
    `- 들리는 말: ${speech} — 줄 앞 숫자는 그 말이 시작하는 초. 배경음악은 따로 깔려 있다.`,
    '',
    '한국어로, 아래 양식 그대로 답해라(전체 500자 안팎). 겉치레 칭찬은 하지 말고, 모르는 것은 모른다고 써라.',
    '1. 이 영상이 말하려는 것 — 친구에게 전하듯 한 문장.',
    '2. 보고 나서 내가 바로 할 수 있게 된 것 — 없으면 「없음」.',
    '3. 무슨 말인지 모르겠던 낱말·장면 — 초와 함께 전부. 없으면 「없음」.',
    '4. 넘겼을 것 같은 초와 까닭 — 끝까지 봤을 것 같으면 「끝까지」와 까닭.',
    '5. 이해 점수 1~5(5 = 한 번 보고 다 알겠다)와 한 줄 까닭.',
    '',
  ].join('\n');
}

function duration(video) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video],
    { encoding: 'utf8', windowsHide: true });
  const sec = Number(String(r.stdout).trim());
  if (r.status !== 0 || !(sec > 0)) throw new Error('ffprobe로 길이를 못 읽었다: ' + String(r.stderr || '').trim());
  return sec;
}

// 가로 영상(PULSE 16:9 광고)은 세로 칸(300×534)에 넣으면 찌그러진다 — 화면 비율대로 칸을 고른다(10-26).
function cellSize(video) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', video],
    { encoding: 'utf8', windowsHide: true });
  const [w, h] = String(r.stdout).trim().split(',').map(Number);
  return w > h ? '480:270' : '300:534';
}

// 2초마다 한 장, 왼쪽 위에 초를 찍어 6칸씩 묶는다. fps=1/2는 2초 칸의 끝 프레임을 골라 표시보다 약 1초 늦은 장면이
// 찍혔다(10-23 yuhobuilds 보완 때) — 그래서 각 2초 지점의 첫 프레임을 select로 고르고, 표시는 그 프레임의 실제 시각이다.
function makeSheet(video, out) {
  const rows = Math.ceil((Math.floor(duration(video) / 2) + 1) / 6);
  const font = "C\\:/Windows/Fonts/arial.ttf";
  const vf = `select='isnan(prev_selected_t)+gte(t-prev_selected_t\\,2)',scale=${cellSize(video)},drawtext=fontfile='${font}':text='%{eif\\:t\\:d}s':x=8:y=8:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=6,tile=6x${rows}:padding=6:color=white`;
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', video, '-vf', vf, '-frames:v', '1', '-q:v', '3', out],
    { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error('ffmpeg 실패: ' + String(r.stderr || '').trim().split('\n').slice(-2).join(' '));
}

// --컷 「0,3.56,4.52,…」(컷이 시작하는 초). 2초보다 짧은 컷이 많은 영상은 2초 정지컷이 컷을 통째로 빠뜨린다 — 원본 1:1
// 리메이크 「옆집의 크리스마스」 36컷/60초는 10컷이 묶음에 없었다(10-26). 그래서 컷마다 그 컷 가운데 장면 한 장을 찍는다.
// 칸이 모두 같은 크기라 0.5초 컷도 3초 컷만큼 무게를 얻으니, 표시는 그 컷이 나오는 「시작-끝」 초로 한다.
function parseCuts(text, end) {
  const starts = String(text).split(',').map((x) => Number(x.trim()));
  if (!starts.length || starts.some((s, i) => !(s >= 0) || s >= end || (i > 0 && s <= starts[i - 1]))) {
    throw new Error(`--컷은 0 이상 ${end.toFixed(2)}초 미만에서 커지는 초를 쉼표로 잇는다: ${text}`);
  }
  return starts;
}

function makeCutSheet(video, out, starts, end) {
  const font = "C\\:/Windows/Fonts/arial.ttf";
  const dir = fs.mkdtempSync(path.join(path.dirname(out), '.컷-'));
  try {
    starts.forEach((s, i) => {
      const e = i + 1 < starts.length ? starts[i + 1] : end;
      const mid = (s + e) / 2;
      const vf = `scale=${cellSize(video)},drawtext=fontfile='${font}':text='${s.toFixed(1)}-${e.toFixed(1)}s':x=8:y=8:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=6`;
      const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-ss', mid.toFixed(3), '-i', video, '-vf', vf, '-frames:v', '1',
        path.join(dir, `${String(i).padStart(3, '0')}.png`)], { encoding: 'utf8', windowsHide: true });
      if (r.status !== 0) throw new Error(`ffmpeg 실패(${s}초 컷): ` + String(r.stderr || '').trim().split('\n').slice(-2).join(' '));
    });
    const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(dir, '%03d.png'),
      '-vf', `tile=6x${Math.ceil(starts.length / 6)}:padding=6:color=white`, '-frames:v', '1', '-q:v', '3', out],
    { encoding: 'utf8', windowsHide: true });
    if (r.status !== 0) throw new Error('ffmpeg 실패: ' + String(r.stderr || '').trim().split('\n').slice(-2).join(' '));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function main(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1], i += 1;
    else args._.push(argv[i]);
  }
  const video = args._[0];
  if (!video || !args['말'] || !args['브랜드']) {
    console.error('쓰는 법: node tools/낯선이시험.js <영상.mp4> --말 <말.txt|.srt> --브랜드 <lab-en|lab-mn|lab-cn|lab-mm|synkbrief|yuhobuilds|pulse> [--밖 <폴더>] [--컷 <초,초,…>]');
    return 2;
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
  const out = path.resolve(args['밖'] || path.join(ROOT, '.tmp', '낯선이시험', `${path.basename(video, path.extname(video))}-${stamp}`));
  fs.mkdirSync(out, { recursive: true });
  const cuts = args['컷'] !== undefined;
  const sheet = path.join(out, cuts ? '정지컷_컷마다.jpg' : '정지컷_2초마다.jpg');
  const speech = path.join(out, '말.txt');
  if (cuts) {
    const end = duration(path.resolve(video));
    makeCutSheet(path.resolve(video), sheet, parseCuts(args['컷'], end), end);
  } else {
    makeSheet(path.resolve(video), sheet);
  }
  fs.writeFileSync(speech, readSpeech(path.resolve(args['말'])));
  const prompt = buildPrompt({ brand: args['브랜드'], sheet, speech, cuts });
  fs.writeFileSync(path.join(out, '질문.md'), prompt);
  console.log(`재료: ${out}`);
  console.log('다음: 질문.md를 이 대화 맥락이 없는 새 하위 에이전트(Agent model sonnet)에 그대로 주고, 답을 한 장 기획의 「한 문장」과 견준다(제작절차 §3).');
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { srtToLines, readSpeech, buildPrompt, parseCuts, 시청자 };
