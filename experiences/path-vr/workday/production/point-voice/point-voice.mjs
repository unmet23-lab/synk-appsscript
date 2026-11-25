#!/usr/bin/env node
// 둘러보기 점 이름의 녹음을 만든다(2026-11-25, 유호님 「응, 둘 다 바꿔」 — 기기 음성 대신 녹음).
//   node experiences/path-vr/workday/production/point-voice/point-voice.mjs 계획
//       모든 직업의 점 이름으로 plan.json을 쓴다(글자 · 크레딧을 쓰지 않음)
//   node tools/나레이션굽기.mjs experiences/path-vr/workday/production/point-voice/plan.json [--굽기]
//       캐시에 없는 줄만 사서 vo/에 다듬는다(vo/는 git에 올리지 않는다)
//   node experiences/path-vr/workday/production/point-voice/point-voice.mjs 싣기 [--jobs care-home,…]
//       vo/의 줄을 jobs/<직업>/audio/<자리>-<점>.mp3로 옮기고 job.json의 점에 audio를 적는다
// 이 폴더는 로컬 서버와 공개 묶음에 실리지 않는다.
// 목소리는 소진(LAB 해설 · 몽글 · 서울행 이름 쓰기와 같은 목소리)이다. 같은 글을 하나로도 구워 tools/목소리엉킴.py로 재니
// 배음이 엉킨 프레임이 앞면 대사에서 하나 28.3%, 소진 9.4%였다.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), JOBS = path.resolve(HERE, '../../jobs');
const FFMPEG = process.env.SYNK_FFMPEG_EXE || 'ffmpeg';
// 화면 글자를 그대로 읽으면 어색한 이름: 괄호와 가운뎃점을 쉼으로 읽는다(화면 글자는 그대로).
const READ = {
  '고객등록카드(레지카드)': '고객 등록 카드, 레지 카드.',
  '인계 일지(로그북)': '인계 일지, 로그북.',
  '판매용 상품(본품)': '판매용 상품, 본품.',
  '판매 화면(포스)': '판매 화면, 포스.',
  '영수증·교환권 프린터': '영수증, 교환권 프린터.',
  '줄 서는 곳(대기 줄)': '줄 서는 곳, 대기 줄.',
  '상태 버튼(대기 · 후처리 · 휴식)': '상태 버튼. 대기, 후처리, 휴식.',
  '스크립트(상담 매뉴얼)': '스크립트, 상담 매뉴얼.',
  '역할극(롤플레잉) 전화기': '역할극, 롤플레잉 전화기.',
  '견본(샘플)': '견본, 샘플.',
  '상자 겉 표시(화인)': '상자 겉 표시, 화인.',
  '핸드 팔레트(자키)': '핸드 팔레트, 자키.',
};
// 받아쓰기나 음높이 확인에서 걸려 씨앗을 바꾼 줄(글이 같으면 모두 같은 소리를 쓴다).
const SEED = {
  '호출 벨.': 1006, '사물함.': 1004, '벨 데스크.': 1004, '안전금고.': 1007, '쇼핑백.': 1007, '탁상 달력.': 1004,
  '외국인 환자 대기석.': 1007, '회복실.': 1004, '도움 요청 깃발.': 1004, '역할극, 롤플레잉 전화기.': 1006,
};

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const jobIds = () => readJson(path.join(JOBS, 'index.json')).jobs.map((job) => job.id).filter((id) => fs.existsSync(path.join(JOBS, id, 'job.json')));
const read = (label) => READ[label] || `${label}.`;
const audioOf = (place, point) => `audio/${place}-${point}.mp3`;

export function points(id) {
  return Object.entries(readJson(path.join(JOBS, id, 'job.json')).places).flatMap(([place, value]) => value.points.map((point) => ({
    id: `${id}.${place}.${point.id}`, place, point: point.id, label: point.label, file: audioOf(place, point.id),
  })));
}

function plan() {
  const lines = jobIds().flatMap(points).map((row) => {
    const text = read(row.label);
    return { id: row.id, text, ...(text === `${row.label}.` ? {} : { show: row.label }), ...(SEED[text] ? { seed: SEED[text] } : {}) };
  });
  fs.writeFileSync(path.join(HERE, 'plan.json'), `${JSON.stringify({
    voice: { id: 'tc_666a9871abcf27a5169850d0', name: '소진' },
    defaults: { model: 'ssfm-v30', lang: 'ko', emotion: 'normal', intensity: 1, tempo: 0.95, seed: 1003, lufs: -17 },
    out: 'vo', trim: 'both', lines,
  }, null, 1)}\n`);
  console.log(`점 이름 ${lines.length}개, 다른 글 ${new Set(lines.map((line) => line.text)).size}개, ${[...new Set(lines.map((line) => line.text))].join('').length}자`);
}

/** job.json은 직업마다 줄 나눔이 달라서 글로 고친다: 점의 label 바로 뒤에 audio를 넣고 나머지 글자는 그대로 둔다. */
function withAudio(text, id) {
  let out = text;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  for (const row of points(id)) {
    const places = out.indexOf('"places"'), place = out.indexOf(`"${row.place}": {`, places), list = out.indexOf('"points"', place);
    const start = out.indexOf(`"id": "${row.point}"`, list), label = `"label": ${JSON.stringify(row.label)}`, at = out.indexOf(label, start);
    if ([places, place, list, start, at].some((n) => n < 0) || at - start > 120) throw Error(`점을 찾지 못했습니다: ${row.id}`);
    const end = at + label.length;
    if (/^\s*,\s*"audio"/.test(out.slice(end, end + 40))) continue;
    const indent = out.slice(start, at).includes('\n') ? `${eol}${/[ \t]*$/.exec(out.slice(0, at))[0]}` : ' ';
    out = `${out.slice(0, end)},${indent}"audio": ${JSON.stringify(row.file)}${out.slice(end)}`;
  }
  for (const [place, value] of Object.entries(JSON.parse(out).places)) for (const point of value.points) {
    if (point.audio !== audioOf(place, point.id)) throw Error(`잘못 적었습니다: ${id} ${place} ${point.id} ${point.audio}`);
  }
  return out;
}

function put(only) {
  for (const id of jobIds().filter((job) => !only || only.includes(job))) {
    const rows = points(id), file = path.join(JOBS, id, 'job.json'), raw = fs.readFileSync(file, 'utf8');
    fs.mkdirSync(path.join(JOBS, id, 'audio'), { recursive: true });
    for (const row of rows) {
      const wav = path.join(HERE, 'vo', `${row.id}.wav`);
      if (!fs.existsSync(wav)) throw Error(`다듬은 줄이 없습니다: ${row.id}`);
      // 한 사람 목소리라 홑 소리로, 태그는 싣지 않는다.
      execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-nostdin', '-i', wav, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact',
        '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k', '-write_xing', '0', '-id3v2_version', '0', path.join(JOBS, id, row.file)]);
    }
    const kept = new Set(rows.map((row) => path.basename(row.file)));
    for (const name of fs.readdirSync(path.join(JOBS, id, 'audio'))) if (name.endsWith('.mp3') && !kept.has(name)) throw Error(`점이 없는 녹음이 남았습니다: ${id} ${name}`);
    const text = withAudio(raw, id);
    if (text !== raw) fs.writeFileSync(file, text);
    console.log(`${id}: 녹음 ${rows.length}개`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2);
  if (command === '계획') plan();
  else if (command === '싣기') put(rest[0] === '--jobs' ? rest[1].split(',') : null);
  else throw Error('계획 · 싣기 가운데 하나를 적는다');
}
