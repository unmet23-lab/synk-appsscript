#!/usr/bin/env node
/**
 * 선배 소개 시안에 드는 소리(2026-11-17).
 *
 *   node 소리.mjs 굽기     한유나의 새 줄을 일레븐랩스 공식 eleven_v4(Mono Beige)로 굽는다 → 공용 작업본 .tmp/senior-intro/소리/받음/<id>.mp3
 *   node 소리.mjs 맞추기   시안이 쓰는 소리를 모두 −18 LUFS · 44.1kHz 모노 mp3로 맞춘다 → .tmp/senior-intro/소리/판/<id>.mp3
 *
 * 태오(Julian)는 힉스필드 프리셋이라 새 줄을 굽지 않는다. 태오의 게시판 인사는 1화 둘째 줄에서 「나는 3학년 권태오예요. 편하게 선배라고 불러요.」만 잘라 쓴다.
 * 한유나의 게시판 인사도 같은 방법으로 식당 둘째 줄에서 「나는 3학년 한유나예요. 그냥 선배라고 불러요.」만 잘라 쓴다. 처음에는 「모르는 거 있으면 물어봐요」로 따로 구웠는데,
 * 첫 시험에서 아홉 모두 한유나를 골랐고 이 인사가 서하의 물음 「누구한테 물어볼래요?」에 곧바로 답해서였다. 두 인사의 꼴을 맞췄다(11-17 밤).
 * 키는 ~/SYNK_보안/elevenlabs.txt에서 메모리로만 읽고 찍지 않는다.
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
const 공용 = 공용작업본(뿌리);
const 작업 = path.join(공용, '.tmp', 'senior-intro', '소리');
const 받음 = path.join(작업, '받음');
const 판 = path.join(작업, '판');
const 모노베이지 = 'SE9upoSoM2ipDUdAVW8q';

// 한유나의 새 줄. 가장 쉬운 낱말로 쓰고 밥을 사 준다는 말을 넣지 않는다(이야기 지도 3-5 지킬 것 7 · 8).
export const 새줄 = [
  { id: 'yuna-ep-02', tag: '[calm, friendly]', text: '여기 처음 오면 다 그래요. 나는 3학년 한유나예요. 그냥 선배라고 불러요.' },
  { id: 'yuna-today', tag: '[casually, matter-of-fact]', text: '그때 그 대사요. 오늘 한 번만 더 해요.' },
];

// 시안이 쓰는 소리와 그 원천. 자르기는 [시작 초, 끝 초].
export const 소리 = [
  { id: 'taeo-intro', 글: '나는 3학년 권태오예요. 편하게 선배라고 불러요.', 원천: path.join(뿌리, 'experiences/drama/s1/소리/ep01-senior-02.mp3'), 자르기: [3.48, 7.3] },
  { id: 'taeo-ep-01', 글: '저기, 혹시 신입생이에요? 아까 정문 안내 지도 앞에서 빙빙 돌고 있었죠?', 원천: path.join(뿌리, 'experiences/drama/s1/소리/ep01-senior-01.mp3') },
  { id: 'taeo-ep-02', 글: '하하, 여기 처음 오면 다 헤매요. 나는 3학년 권태오예요. 편하게 선배라고 불러요.', 원천: path.join(뿌리, 'experiences/drama/s1/소리/ep01-senior-02.mp3') },
  { id: 'taeo-today', 글: '그때 했던 대사, 오늘 한 번 더 해 봐요.', 원천: path.join(뿌리, 'experiences/drama/pilot/media/today-taeo-review.mp4') },
  { id: 'yuna-intro', 글: '나는 3학년 한유나예요. 그냥 선배라고 불러요.', 원천: path.join(받음, 'yuna-ep-02.mp3'), 자르기: [2.13, 5.86] },
  { id: 'yuna-ep-01', 글: '저기, 신입생이죠? 나도 1학년 때 정문 지도 앞에서 세 바퀴 돌았는데, 아까 그랬죠?', 원천: path.join(공용, '.tmp/senior-f-voice/받음/mono/01.mp3') },
  { id: 'yuna-ep-02', 글: 새줄[0].text, 원천: path.join(받음, 'yuna-ep-02.mp3') },
  { id: 'yuna-today', 글: 새줄[1].text, 원천: path.join(받음, 'yuna-today.mp3') },
];

const 직접 = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const 명령 = 직접 ? process.argv[2] : '가져옴';

if (명령 === '굽기') {
  const 키 = fs.readFileSync(path.join(os.homedir(), 'SYNK_보안', 'elevenlabs.txt'), 'utf8').trim().split(/\s+/).pop();
  fs.mkdirSync(받음, { recursive: true });
  let 받은 = 0, 값 = 0;
  for (const l of 새줄) {
    const 끝 = path.join(받음, `${l.id}.mp3`);
    if (fs.existsSync(끝)) continue;
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${모노베이지}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': 키, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `${l.tag} ${l.text}`, model_id: 'eleven_v4', language_code: 'ko', voice_settings: { stability: 0.5 } }),
    });
    const b = Buffer.from(await r.arrayBuffer());
    if (!r.ok) { console.error(`${l.id} 실패 ${r.status}: ${b.toString('utf8').slice(0, 300)}`); process.exit(1); }
    fs.writeFileSync(끝, b);
    받은 += 1; 값 += Number(r.headers.get('character-cost') || 0);
    console.log('받음', l.id, b.length);
  }
  console.log(`새로 받은 줄 ${받은} · 쓴 크레딧 ${값}`);
} else if (명령 === '맞추기') {
  fs.mkdirSync(판, { recursive: true });
  const 길이 = {};
  for (const s of 소리) {
    if (!fs.existsSync(s.원천)) { console.log(s.id, '원천이 없어 건너뜀'); continue; }
    const 끝 = path.join(판, `${s.id}.mp3`);
    const 자름 = s.자르기 ? `atrim=${s.자르기[0]}:${s.자르기[1]},asetpts=PTS-STARTPTS,afade=t=in:d=0.04,afade=t=out:st=${(s.자르기[1] - s.자르기[0] - 0.08).toFixed(2)}:d=0.08,` : '';
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', s.원천, '-vn', '-af', `${자름}aresample=44100,aformat=channel_layouts=mono,loudnorm=I=-18:TP=-1.5:LRA=11`, '-ar', '44100', '-ac', '1', '-b:a', '128k', 끝], { encoding: 'utf8' });
    if (r.status !== 0) { console.error(s.id, '맞추기 실패', (r.stderr || '').slice(0, 300)); process.exit(1); }
    const d = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 끝], { encoding: 'utf8' });
    길이[s.id] = Number((d.stdout || '0').trim());
    console.log('맞춤', s.id, 길이[s.id].toFixed(2) + '초');
  }
  fs.writeFileSync(path.join(작업, '길이.json'), JSON.stringify(길이, null, 1));
} else if (직접) {
  console.error('명령: 굽기 | 맞추기');
  process.exit(2);
}
