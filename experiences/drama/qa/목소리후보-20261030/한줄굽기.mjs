#!/usr/bin/env node
/**
 * 고른 목소리로 한 줄만 다시 굽기(2026-10-30) — 나눈 줄을 다시 받아 적었더니 대본과 다르게 들린 줄(겹친 낱말 · 다른 끝맺음)을 손질하지 않고
 * 그 줄만 다시 뽑는다(제작 방식 「후보정 최대한 안 함 · 못 나오면 다시 뽑기」). 크기는 원래 자른 줄과 같은 소리 크기(LUFS)로 맞춘다.
 *
 *   node 한줄굽기.mjs <작업> <역> <일레븐 목소리 이름> <줄 번호> <바꿀 mp3>
 *   예: node 한줄굽기.mjs .tmp/drama-voices-20261030 선배 Julian 5 experiences/drama/s1/소리/ep01-senior-05.mp3
 * 바꾸기 전 파일은 <작업>/한줄굽기/<이름>.전.mp3로 남긴다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { 후보 } from './후보.mjs';

const [작업, 역, 이름, 번호, 바꿀] = process.argv.slice(2);
if (!바꿀) { console.error('쓰는 법: node 한줄굽기.mjs <작업> <역> <목소리> <줄 번호> <바꿀 mp3>'); process.exit(2); }
const 줄 = JSON.parse(fs.readFileSync(path.join(작업, `${역}_줄.json`), 'utf8'))[Number(번호) - 1];
const id = 후보[역]?.eleven?.[이름];
if (!줄 || !id) { console.error('줄이나 목소리를 찾지 못했다'); process.exit(2); }
const 집 = path.join(os.homedir(), '.ai-accounts', 'higgsfield-founder');
const hf = (인자) => {
 const r = spawnSync(path.join(process.env.APPDATA, 'npm', 'higgsfield'), [...인자, '--json'], { encoding: 'utf8', env: { ...process.env, HOME: 집, USERPROFILE: 집 }, timeout: 15 * 60 * 1000 });
 try { return JSON.parse((r.stdout || '').trim()); } catch { console.error(`힉스필드 답을 못 읽었다: ${(r.stdout || r.stderr || '').slice(0, 300)}`); process.exit(1); }
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const 번호찾기 = (o) => { if (!o || typeof o !== 'object') return null; for (const k of ['id', 'job_id']) if (typeof o[k] === 'string' && UUID.test(o[k])) return o[k]; for (const v of Object.values(o)) { const x = 번호찾기(v); if (x) return x; } return null; };
const 주소찾기 = (o) => { if (!o || typeof o !== 'object') return null; if (typeof o.result_url === 'string') return o.result_url; for (const v of Object.values(o)) { const x = 주소찾기(v); if (x) return x; } return null; };

const 대화 = JSON.stringify([{ text: `${줄.꼬리표} ${줄.소리}`, voice_id: id, voice_type: 'preset' }]);
const 이전 = Date.now();
let 작업번호 = 번호찾기(hf(['generate', 'create', 'elevenlabs_v4', '--dialogue', 대화, '--stability', '0.5']));
if (!작업번호) {
 const 목록 = hf(['generate', 'list', '--size', '3']);
 const a = Array.isArray(목록) ? 목록 : 목록.jobs || 목록.items || 목록.data || [];
 작업번호 = a.find((x) => x.job_type === 'elevenlabs_v4' && Date.parse(x.created_at) >= 이전 - 5000)?.id;
}
if (!작업번호) { console.error('접수 번호를 못 찾았다'); process.exit(1); }
const 주소 = 주소찾기(hf(['generate', 'wait', 작업번호]));
if (!주소) { console.error(`결과 주소가 없다: ${작업번호}`); process.exit(1); }
const 폴더 = path.join(작업, '한줄굽기');
fs.mkdirSync(폴더, { recursive: true });
const 받은 = path.join(폴더, `${path.basename(바꿀, '.mp3')}.받은${path.extname(new URL(주소).pathname) || '.mp3'}`);
fs.writeFileSync(받은, Buffer.from(await (await fetch(주소)).arrayBuffer()));
// 원래 자른 줄의 소리 크기에 맞춘다.
const 잼 = spawnSync('ffmpeg', ['-hide_banner', '-i', 바꿀, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const 크기 = Number((잼.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop()?.match(/-?[\d.]+/)?.[0] ?? -18);
fs.copyFileSync(바꿀, path.join(폴더, `${path.basename(바꿀, '.mp3')}.전.mp3`));
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', 받은, '-af', `silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.3,loudnorm=I=${크기}:TP=-1.5:LRA=11`, '-ar', '24000', '-ac', '1', '-b:a', '96k', 바꿀], { encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr.slice(0, 300)); process.exit(1); }
console.log(`[한줄] ${path.basename(바꿀)} 바꿈 · 작업 ${작업번호} · 크기 ${크기} LUFS에 맞춤`);
