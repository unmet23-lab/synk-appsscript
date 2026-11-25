#!/usr/bin/env node
/**
 * 한국어 동아리장 목소리 후보 굽기 (2026-11-26) — 유호님 「네, 후보 만들기」. 새여자선배-20261117/목소리.mjs를 옮겨 후보 · 줄 · 폴더만 바꿨다.
 *
 * 새 배역이라 일레븐 v4를 일레븐랩스 공식 계정에서 굽는다(docs/AI_계정과_크레딧.md 「일레븐랩스」 — Creator 월정액 안이면 묻지 않고 쓴 양만 보고).
 * 후보는 공유 목소리(한국어 · 젊은 남성, 한국어가 모국어이고 v4로 검증 · 공지 기간 730일, 182개) 가운데 대화 · 캐릭터 쪽 열셋을 추려
 * 한국어 미리듣기의 음높이(중앙값)를 재고, 낮은 쪽(따뜻한)부터 높은 쪽(밝은)까지 여섯을 남겼다(11-26 잼, git 밖 .tmp/club-head-voice/).
 * 대사는 처음 만남에서 동아리장이 실제로 하는 반말 줄 넷이다(world-front/club.mjs m1 · m2 · m3_none · m4 · m5). 이름은 아직 정하지 않아 넣지 않았다.
 *
 *   node 목소리.mjs 줄                 후보 · 줄 · 글자 수(돈 안 듦)
 *   node 목소리.mjs 굽기 [후보…]       일레븐랩스 공식 eleven_v4로 굽는다 → 공용 작업본 .tmp/club-head-voice/받음/<후보>/<줄>.mp3 (받은 줄은 다시 사지 않는다)
 *   node 목소리.mjs 맞추기             줄을 0.6초 쉼으로 이어 −18 LUFS · 44.1kHz 모노 mp3 한 개로 → .tmp/club-head-voice/판/<후보>.mp3
 *
 * 키는 ~/SYNK_보안/elevenlabs.txt에서 메모리로만 읽고 찍지 않는다. 쓴 크레딧은 응답 머리글 character-cost를 더한다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..');
const { 공용작업본 } = createRequire(import.meta.url)(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const 작업 = path.join(공용작업본(뿌리), '.tmp', 'club-head-voice');
const 받음 = path.join(작업, '받음');

// 미리듣기 음높이(중앙값, 11-26 잼)와 목록의 말투 설명. 공지 기간은 모두 730일.
export const 후보 = {
  ko: { 이름: 'KO', id: 'L4az9Gb378GIycFl2nAB', 음높이: 126, 결: '따뜻하고 차분하다' },
  chris: { 이름: 'Chris', id: 'PDoCXqBQFGsvfO0hNkEs', 음높이: 135, 결: '밝고 또렷하다' },
  mike: { 이름: 'Mike', id: 'mgugV8tLa3KQE4mfYTw5', 음높이: 142, 결: '친근하고 고르다' },
  deoksu: { 이름: 'Deoksu', id: 'IAETYMYM3nJvjnlkVTKI', 음높이: 160, 결: '푸근하고 귀여운 캐릭터 목소리다' },
  krys: { 이름: 'Krys', id: '1W00IGEmNmwmsDeYy7ag', 음높이: 168, 결: '쾌활하다' },
  taehyung: { 이름: 'Taehyung', id: 'm3gJBS8OofDJfycyA2Ip', 음높이: 169, 결: '꾸미지 않은 친구 말투다' },
};

// 꼬리표는 모든 후보가 같다. 처음 만남에서 동아리장이 하는 반말 줄이다(이름 자리는 뺐다).
export const 줄들 = [
  { id: '01', tag: '[cheerful, friendly]', text: '안녕! 나는 한국어 동아리장이야. 혹시 한국어 잘해?' },
  { id: '02', tag: '[warm, reassuring]', text: '괜찮아, 다들 거기서 시작해. 딱 맞는 선배를 붙여 줄게.' },
  { id: '03', tag: '[upbeat]', text: '우리 동아리 튜터들이야. 마음에 드는 스타일로 한 명 골라 봐.' },
  { id: '04', tag: '[excited]', text: '좋아, 선배한테 말해 둘게. 곧 연락 올 거야!' },
];

// 다른 스크립트(받아쓰기.py · 판만들기.mjs)가 후보 · 줄들만 가져갈 때는 아무 명령도 돌리지 않는다.
const 직접 = process.argv[1] === fileURLToPath(import.meta.url);
const 명령 = 직접 ? process.argv[2] : '가져옴';
const 고른 = 직접 ? process.argv.slice(3) : [];
const 대상 = Object.entries(후보).filter(([k]) => !고른.length || 고른.includes(k));

if (명령 === '줄') {
  const 글자 = 줄들.reduce((n, l) => n + [...l.text].length, 0);
  console.log(`줄 ${줄들.length} · 글자 ${글자} · 후보 ${대상.length}`);
  for (const [k, c] of 대상) console.log(k, c.이름, `${c.음높이}Hz`, c.결);
  fs.mkdirSync(작업, { recursive: true });
  fs.writeFileSync(path.join(작업, '줄.json'), JSON.stringify({ 후보, 줄들 }, null, 1)); // 받아쓰기.py · 판만들기.mjs가 읽는다
} else if (명령 === '굽기') {
  const 키 = fs.readFileSync(path.join(os.homedir(), 'SYNK_보안', 'elevenlabs.txt'), 'utf8').trim().split(/\s+/).pop();
  let 받은 = 0, 값 = 0;
  for (const [k, c] of 대상) {
    fs.mkdirSync(path.join(받음, k), { recursive: true });
    for (const l of 줄들) {
      const 끝 = path.join(받음, k, `${l.id}.mp3`);
      if (fs.existsSync(끝)) continue;
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${c.id}?output_format=mp3_44100_128`, {
        method: 'POST', headers: { 'xi-api-key': 키, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `${l.tag} ${l.text}`, model_id: 'eleven_v4', language_code: 'ko', voice_settings: { stability: 0.5 } }),
      });
      const b = Buffer.from(await r.arrayBuffer());
      if (!r.ok) { console.error(`${k}/${l.id} 실패 ${r.status}: ${b.toString('utf8').slice(0, 300)}`); process.exit(1); }
      fs.writeFileSync(끝, b);
      받은 += 1; 값 += Number(r.headers.get('character-cost') || 0);
      console.log('받음', k, l.id, b.length);
    }
  }
  console.log(`새로 받은 줄 ${받은} · 쓴 크레딧 ${값}`);
} else if (명령 === '맞추기') {
  const 판 = path.join(작업, '판');
  fs.mkdirSync(판, { recursive: true });
  for (const [k] of 대상) {
    const 파일들 = 줄들.map((l) => path.join(받음, k, `${l.id}.mp3`));
    if (!파일들.every((f) => fs.existsSync(f))) { console.log(k, '줄이 모자라 건너뜀'); continue; }
    const 인자 = ['-y', '-loglevel', 'error'];
    for (const f of 파일들) 인자.push('-i', f);
    const 잇기 = 파일들.map((_, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=mono,apad=pad_dur=0.6[a${i}]`).join(';')
      + `;${파일들.map((_, i) => `[a${i}]`).join('')}concat=n=${파일들.length}:v=0:a=1,loudnorm=I=-18:TP=-1.5:LRA=11[o]`;
    인자.push('-filter_complex', 잇기, '-map', '[o]', '-ar', '44100', '-ac', '1', '-b:a', '128k', path.join(판, `${k}.mp3`));
    const r = spawnSync('ffmpeg', 인자, { encoding: 'utf8' });
    if (r.status !== 0) { console.error(k, '맞추기 실패', (r.stderr || '').slice(0, 300)); process.exit(1); }
    console.log('맞춤', k, fs.statSync(path.join(판, `${k}.mp3`)).size);
  }
} else if (직접) {
  console.error('명령: 줄 | 굽기 [후보…] | 맞추기');
  process.exit(2);
}
