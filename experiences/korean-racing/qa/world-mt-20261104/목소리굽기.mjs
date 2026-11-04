#!/usr/bin/env node
/**
 * MT 바닷가 레이스(WORLD 판, 2026-11-04) — 태오 선배 말 일곱 줄을 드라마 1화 · 말 랠리와 같은 배역 목소리(힉스필드 일레븐 v4 Julian, stability 0.5, 줄마다 연기 꼬리표 하나)로 굽는다.
 * 줄이 짧고 일곱뿐이라 묶지 않고 한 줄씩 낸다(접수 한 번 약 0.23크레딧 → 약 1.6크레딧, 말 랠리 실측 값). 글은 ride/ride-lines.mjs 한 곳.
 *   node 목소리굽기.mjs 준비        # 밖/voice/<key>.json(대사 배열)
 *   bash 목소리내기.sh               # founder 계정으로 접수 → 기다림 → 받기(받은 줄은 다시 내지 않음)
 *   node 목소리굽기.mjs 다듬기       # 앞뒤 무음 자르기 · −18 LUFS · 24kHz 모노 96k → assets/world/voice/taeo-<key>.mp3
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { TAEO_LINES } from '../../ride/ride-lines.mjs';
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const { 공용작업본 } = createRequire(import.meta.url)('../../../../tools/lib/공용작업본.js');
const 폴더 = path.join(공용작업본(path.resolve(여기, '../../../..')), '.tmp', 'world-mt-20261104', 'voice');
const 낼 = path.resolve(여기, '../../assets/world/voice');
const JULIAN = '95429266-c0ac-4137-a209-63b8812b0f23';
fs.mkdirSync(폴더, { recursive: true });
if (process.argv[2] === '준비') {
  for (const [key, line] of Object.entries(TAEO_LINES)) fs.writeFileSync(path.join(폴더, `${key}.json`), JSON.stringify([{ text: `[${line.tag}] ${line.text}`, voice_id: JULIAN, voice_type: 'preset' }]));
  console.log(폴더, Object.keys(TAEO_LINES).length, '줄');
}
if (process.argv[2] === '다듬기') {
  fs.mkdirSync(낼, { recursive: true });
  for (const key of Object.keys(TAEO_LINES)) {
    const raw = fs.readdirSync(폴더).find((f) => f.startsWith(`${key}.받은.`));
    if (!raw) { console.log('없음', key); continue; }
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(폴더, raw), '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse,loudnorm=I=-18:TP=-1.5:LRA=7', '-ar', '24000', '-ac', '1', '-b:a', '96k', path.join(낼, `taeo-${key}.mp3`)], { stdio: 'inherit' });
    console.log(key, execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(낼, `taeo-${key}.mp3`)], { encoding: 'utf8' }).trim(), '초');
  }
}
