#!/usr/bin/env node
// TOPIK 듣기 문항의 두 사람 대화 음성 — 대본(script)을 tools/나레이션굽기.mjs 계획으로 옮겨 Typecast로 굽는다.
// 목소리는 역할(남자·여자)마다 하나를 끝까지 쓴다(메모 「역할마다 목소리 하나」, 짝은 아래 DEFAULT_PAIR).
//   node tools/topik-audio.mjs 견본                       목소리 짝 후보마다 견본 대화 둘(output/topik-audio/견본/)
//   node tools/topik-audio.mjs 굽기 <묶음|id…> [--짝 <이름>] [--최대 20000]   대본 → 줄마다 굽기 → 이어 붙여 audio/<id>.mp3(64k 모노)
//   node tools/topik-audio.mjs 미리보기 <묶음|id…> [--짝 <이름>]             살 글자 수만(키·네트워크 없음)
// 재생 횟수(1·2번)는 소리 파일에 넣지 않는다 — 화면이 audio.plays만큼 들려준다(공식 규칙은 strata/topik-types.json).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bankDir = path.join(root, 'experiences/topik-items');
const workDir = path.join(root, 'output/topik-audio');
// 승인된 Typecast 목소리(experiences/hangul-stage/assets/voice/voices.json·talkers.json). 듣기 대화 짝은 하나-범수로 정했다
// (10-21 유호님 위임 → 견본 받아쓰기 오류율 1.6%·남녀 높낮이 한 옥타브 넘게 갈림 + Fable 검수).
export const PAIRS = Object.freeze({
  '진희-재영': { 여자: { id: 'tc_6731b2b2478a48710ecc9158', name: '진희' }, 남자: { id: 'tc_65571d3fb22102b993a24350', name: '재영' } },
  '하나-범수': { 여자: { id: 'tc_61659cc118732016a95fe7c6', name: '하나' }, 남자: { id: 'tc_5c3c52cb5827e00008dd7f3b', name: '범수' } },
});
export const DEFAULT_PAIR = '하나-범수';
const TEMPO = { 'topik-i': 0.95, 'topik-ii': 1 };
// 목소리마다 덮는 값(10-21 Fable 굽기 권고): 범수는 느리게 구우면 말끝이 뭉개져 시험과 상관없이 1.0(0.97 아래로 내리지 않는다),
// 낮은 남자 목소리가 폰 스피커에서 작게 들려 줄 음량을 1.5dB 올린다. 감정은 모두 normal 그대로.
export const VOICE_TUNE = Object.freeze({ 범수: { tempo: 1, lufs: -15.5 } });
// 줄마다 고른 seed(<단위>/<줄> → seed, 없으면 기본 1003). 10-28 잘림 고침으로 다시 사니 받아쓰기가 옛 판보다 못하거나
// 목소리가 거칠어진 줄만 후보 seed 서넛을 사서 받아쓰기·엉킴(tools/목소리엉킴.py)으로 골랐다. 대본 줄 순서를 바꾸면 이 표도 고친다.
export const LINE_SEEDS = Object.freeze({
  'ti-l-b-008/l04': 1005, // 「있어요」가 「써요」로
  'ti-l-d-004/l04': 1004, // 「역에서」가 「여기서」로
  'ti-l-d-027/l04': 1008, // 하나 엉킴 44% → 26%, 「잘못 탔어요」 그대로 들림(1005는 8%지만 「왔어요」로)
  'tii-l-a-010/l01': 1004, // 「부스」가 「보스」로
  'tii-l-b-003/l01': 1004, // 「자전거」가 「자전과」로
});
const SAMPLES = [
  { id: 'sample-topik1', exam: 'topik-i', script: [
    { speaker: '여자', text: '민수 씨, 이번 주 토요일에 시간 있어요?' },
    { speaker: '남자', text: '토요일 오전에는 수영을 배워요. 오후에는 괜찮아요.' },
    { speaker: '여자', text: '그럼 오후 세 시에 같이 박물관에 갈까요?' },
    { speaker: '남자', text: '좋아요. 박물관 앞에서 만나요.' }] },
  { id: 'sample-topik2', exam: 'topik-ii', script: [
    { speaker: '남자', text: '안녕하세요. 지난주에 주문한 책상이 아직 도착하지 않아서 전화했습니다.' },
    { speaker: '여자', text: '불편을 드려서 죄송합니다. 주문하신 분 성함을 말씀해 주시겠어요?' },
    { speaker: '남자', text: '김준호입니다. 이번 주 금요일까지는 꼭 받아야 하는데요.' },
    { speaker: '여자', text: '확인해 보니 내일 오후에 배송될 예정입니다. 출발하면 문자로 알려 드리겠습니다.' }] },
];

export function planFor(unit, pair, outDir) {
  const voices = PAIRS[pair];
  if (!voices) throw new Error(`모르는 짝 ${pair} — ${Object.keys(PAIRS).join(', ')}`);
  return { voices: { 남자: voices.남자, 여자: voices.여자 },
    defaults: { model: 'ssfm-v30', lang: 'ko', emotion: 'normal', intensity: 1, tempo: TEMPO[unit.exam] || 1, seed: 1003, lufs: -17 },
    out: path.join(outDir, 'lines'), trim: 'both',
    lines: unit.script.map((line, index) => {
      const id = `l${String(index + 1).padStart(2, '0')}`, seed = LINE_SEEDS[`${unit.id}/${id}`];
      return { id, role: line.speaker, text: line.text, ...VOICE_TUNE[voices[line.speaker]?.name], ...(seed ? { seed } : {}) };
    }),
    take: { lead: 0.4, gap: 0.7, tail: 0.6, lufs: -16, limiter: 0.89, wav: path.join(outDir, 'take.wav'), mp3: path.join(outDir, 'take.mp3') } };
}

// 묶음 이름이나 문항 id로 굽을 단위(세트는 대본 하나)를 고른다.
export function units(selectors) {
  const files = fs.readdirSync(path.join(bankDir, 'items')).filter(name => name.endsWith('.json'));
  const out = new Map();
  for (const name of files) {
    const data = JSON.parse(fs.readFileSync(path.join(bankDir, 'items', name), 'utf8'));
    for (const item of data.items.filter(item => item.section === 'listening')) {
      if (!selectors.includes(data.batch) && !selectors.includes(item.id) && !selectors.includes(item.set?.id)) continue;
      const id = item.set?.id || item.id;
      if (!out.has(id)) out.set(id, { id, exam: item.exam, script: item.script, file: name, items: [] });
      out.get(id).items.push(item.id);
    }
  }
  return [...out.values()];
}

function bake(unit, pair, { cap, preview }) {
  const dir = path.join(workDir, pair, unit.id);
  fs.mkdirSync(dir, { recursive: true });
  const planFile = path.join(dir, 'plan.json');
  fs.writeFileSync(planFile, JSON.stringify(planFor(unit, pair, dir), null, 2));
  const args = [path.join(root, 'tools/나레이션굽기.mjs'), planFile, ...(preview ? [] : ['--굽기', '--최대', String(cap)])];
  return execFileSync(process.execPath, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

function encode(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  execFileSync(process.env.SYNK_FFMPEG_EXE || 'ffmpeg', ['-y', '-loglevel', 'error', '-i', source, '-ac', '1', '-ar', '24000', '-b:a', '64k', target]);
  const seconds = Number(execFileSync(process.env.SYNK_FFPROBE_EXE || 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', target], { encoding: 'utf8' }).trim());
  return Math.round(seconds * 10) / 10;
}

function markReady(unit, pair, seconds) {
  const file = path.join(bankDir, 'items', unit.file), data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const item of data.items.filter(item => unit.items.includes(item.id))) {
    item.audio = { ...item.audio, file: `audio/${unit.id}.mp3`, status: 'ready', voices: { 남자: PAIRS[pair].남자.name, 여자: PAIRS[pair].여자.name }, seconds };
  }
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n'); fs.renameSync(tmp, file);
}

async function main([command, ...argv]) {
  const flag = name => { const i = argv.indexOf(name); return i < 0 ? null : argv[i + 1]; };
  if (command === '견본') {
    for (const pair of Object.keys(PAIRS)) for (const sample of SAMPLES) {
      console.log(bake(sample, pair, { cap: 2000 }).trim().split('\n').slice(-2).join(' '));
      const target = path.join(workDir, '견본', `${sample.id}_${pair}.mp3`);
      console.log(`${target} · ${encode(path.join(workDir, pair, sample.id, 'take.mp3'), target)}초`);
    }
    return 0;
  }
  if (command === '굽기' || command === '미리보기') {
    const pair = flag('--짝') || DEFAULT_PAIR, cap = Number(flag('--최대') || 20000);
    if (!PAIRS[pair]) throw new Error(`--짝 ${Object.keys(PAIRS).join(' | ')} (기본 ${DEFAULT_PAIR})`);
    const selectors = argv.filter((arg, index) => !arg.startsWith('--') && !argv[index - 1]?.startsWith('--'));
    const list = units(selectors);
    for (const unit of list) {
      const log = bake(unit, pair, { cap, preview: command === '미리보기' });
      if (command === '미리보기') { console.log(`${unit.id}: ${log.trim().split('\n').slice(-1)[0]}`); continue; }
      // 산 양과 경고(원본 잘림·받아쓰기로 볼 줄)는 굽기 기록을 삼키지 말고 보인다
      for (const note of log.split('\n').filter(l => l.startsWith('사기 끝') || l.startsWith('⚠'))) console.log(`${unit.id}: ${note}`);
      const seconds = encode(path.join(workDir, pair, unit.id, 'take.mp3'), path.join(bankDir, 'audio', `${unit.id}.mp3`));
      markReady(unit, pair, seconds);
      console.log(`${unit.id} → audio/${unit.id}.mp3 · ${seconds}초 · 문항 ${unit.items.join(',')}`);
    }
    return 0;
  }
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 7).join('\n'));
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => { console.error(error.stack || error.message); process.exitCode = 2; });
}
