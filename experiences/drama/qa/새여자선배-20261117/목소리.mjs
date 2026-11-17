#!/usr/bin/env node
/**
 * 새 여자 선배 목소리 후보 굽기 (2026-11-17) — 유호님 「네, 시안 만들어」.
 *
 * 태오(Julian)는 힉스필드 프리셋이지만 새 배역의 일레븐 v4는 일레븐랩스 공식 계정에서 굽는다(docs/AI_계정과_크레딧.md 「일레븐랩스」).
 * 후보는 공유 목소리(한국어 · 젊은 여성 105개) 가운데 말투 설명이 대화 쪽이고 공지 기간이 730일인 것을 추려,
 * 한국어 미리듣기의 음높이(중앙값)로 낮은 쪽부터 가운데까지 여섯을 골랐다. 대사는 1화 식당 장면의 선배 줄 넷을 새 선배의 말맛으로 쓴 예시다
 * (이야기 지도 3-5 「두 판이 같은 것과 다른 것」 — 학생 줄은 두 판이 같으니 그 줄에 맞물리게 썼다). 이름은 아직 정하지 않아 대사에 넣지 않았다.
 *
 *   node 목소리.mjs 줄                 후보 · 줄 · 글자 수(돈 안 듦)
 *   node 목소리.mjs 굽기 [후보…]       일레븐랩스 공식 eleven_v4로 굽는다 → 공용 작업본 .tmp/senior-f-voice/받음/<후보>/<줄>.mp3 (받은 줄은 다시 사지 않는다)
 *   node 목소리.mjs 맞추기             줄을 0.6초 쉼으로 이어 −18 LUFS · 44.1kHz 모노 mp3 한 개로 → .tmp/senior-f-voice/판/<후보>.mp3
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
const 작업 = path.join(공용작업본(뿌리), '.tmp', 'senior-f-voice');
const 받음 = path.join(작업, '받음');

// 미리듣기 음높이(중앙값, 11-17 잼)와 목록의 말투 설명. 공지 기간은 모두 730일.
export const 후보 = {
  yimi: { 이름: 'Yimi', id: 'TLp6VWy7y0kTr5KDx4gQ', 음높이: 183, 결: '가장 낮고 차분하다' },
  mono: { 이름: 'Mono Beige', id: 'SE9upoSoM2ipDUdAVW8q', 음높이: 197, 결: '도시적이고 덤덤하다' },
  han: { 이름: 'Han', id: '8jHHF8rMqMlg8if2mOUe', 음높이: 213, 결: '꾸미지 않은 대화 말투다' },
  hanna: { 이름: 'Hanna', id: 'zgDzx5jLLCqEp6Fl7Kl7', 음높이: 214, 결: '또박또박하고 담백하다' },
  chaemong: { 이름: 'Chaemong', id: 'DGDjWy2CQ8Ishu0meQte', 음높이: 215, 결: '젊고 톡 쏘는 맛이 있다' },
  kanna: { 이름: 'Kanna', id: '5I7B1di44aCL15NkP0jn', 음높이: 221, 결: '가까운 친구처럼 따뜻하다' },
};

// 꼬리표는 모든 후보가 같다. 학생 줄(「네, 맞아요…」 · 「네, 선배님! 그런데 혹시 도서관이…」 · 「선배님 덕분에 살았어요」 · 「네, 꼭 살게요!」) 사이에 들어가는 말이다.
export const 줄들 = [
  { id: '01', tag: '[casually, matter-of-fact]', text: '저기, 신입생이죠? 나도 1학년 때 정문 지도 앞에서 세 바퀴 돌았는데, 아까 그랬죠?' },
  { id: '02', tag: '[calm, friendly]', text: '여기 처음 오면 다 그래요. 나는 3학년이에요. 그냥 선배라고 불러요.' },
  { id: '03', tag: '[holding back a laugh]', text: '선배님… 음, 편한 대로 해요. 도서관이요? 밥 먹고 같이 가요. 어차피 가는 길이에요.' },
  { id: '04', tag: '[dry, teasing]', text: '살았으면 됐어요. 대신 다음 주 동아리 박람회 때 커피 한 잔 사요. 자리는 내가 알려 줄게요.' },
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
