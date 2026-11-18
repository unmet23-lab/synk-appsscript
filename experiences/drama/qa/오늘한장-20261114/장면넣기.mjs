// 「오늘」 장면 판의 장면 컷을 재생 사본으로 넣는다(11-18 유호님 「앱에 옮겨」).
//   node experiences/drama/qa/오늘한장-20261114/장면넣기.mjs [--확인]
// 구운 판(공용 작업본 .tmp/senior-f-face/out/<구운 이름>.png — 지시문은 장면판_20261118/그림.mjs)을 원천 폴더(~/Documents/synk-vendor/drama-today-20261116/장면/)에
// 두고, 메타를 뺀 960×540 webp를 공용 작업본(git 밖 미디어 자리)의 pilot/media/today-scene-<칸>.webp로 만든다. 입장 검사 근무지 그림은 그 게임의
// 실사 장면(VENUE_SOURCE — 없으면 그 게임의 그림 experiences/entry-check/assets/scenes/<id>-m.webp)을 16:9로 잘라 today-venue-<id>.webp로 둔다. 드라마 manifest에는 넣지 않는다(공개 빌드가 싣지 않게 —
// 「오늘」은 깃발 뒤다). 원천에 이미 있으면 구운 판을 다시 읽지 않는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { SCENES, VENUE_IDS } from '../../pilot/today/content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const { 공용작업본 } = createRequire(import.meta.url)(path.join(ROOT, 'tools', 'lib', '공용작업본.js'));
const SHARED = 공용작업본(ROOT);
const BAKED = path.join(SHARED, '.tmp', 'senior-f-face', 'out');
const VENDOR = path.join(os.homedir(), 'Documents', 'synk-vendor', 'drama-today-20261116', '장면');
const MEDIA = path.join(SHARED, 'experiences', 'drama', 'pilot', 'media');
// 칸 → 구운 이름(그림.mjs의 id). cafe는 어깨 너머로 본 1화 식당의 태오다.
export const SOURCE = Object.freeze({ cafe: 'scene-review', transfer: 'scene-transfer', office: 'scene-office', libdesk: 'scene-libdesk', dorm: 'scene-dorm', hall: 'scene-hall', prof: 'scene-prof', bus: 'scene-bus' });
const CLEAN = ['-map_metadata', '-1', '-fflags', '+bitexact'];
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-nostdin', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
const check = process.argv.includes('--확인');

fs.mkdirSync(VENDOR, { recursive: true });
fs.mkdirSync(MEDIA, { recursive: true });
const rows = [];
for (const [key, s] of Object.entries(SCENES)) {
 const keep = path.join(VENDOR, `${key}.png`), baked = path.join(BAKED, `${SOURCE[key]}.png`), out = path.join(SHARED, 'experiences', 'drama', 'pilot', s.img);
 if (!fs.existsSync(keep) && fs.existsSync(baked) && !check) fs.copyFileSync(baked, keep);
 if (!fs.existsSync(keep)) { rows.push([key, '원천 없음(아직 안 구움)']); continue; }
 if (!check) ff(['-i', keep, '-vf', 'scale=960:540:force_original_aspect_ratio=increase:flags=lanczos,crop=960:540', '-c:v', 'libwebp', '-quality', '80', ...CLEAN, out]);
 rows.push([key, fs.existsSync(out) ? `${fs.statSync(out).size}바이트` : '사본 없음']);
}
// 근무지 → 구운 실사 장면(11-18 앱 화면 GPT 맹검: 게임의 그림 근무지가 작은 칸에서 「양산형 모바일 게임의 상점 배경」 같았다). 실사가 아직 없으면 게임 그림으로.
export const VENUE_SOURCE = Object.freeze({ pool: 'scene-venue-pool', library: 'scene-gate2', museum: 'scene-venue-museum', concert: 'scene-venue-concert' });
for (const id of VENUE_IDS) {
 const keep = path.join(VENDOR, `venue-${id}.png`), baked = path.join(BAKED, `${VENUE_SOURCE[id]}.png`);
 if (!fs.existsSync(keep) && fs.existsSync(baked) && !check) fs.copyFileSync(baked, keep);
 const game = path.join(ROOT, 'experiences', 'entry-check', 'assets', 'scenes', `${id}-m.webp`), out = path.join(MEDIA, `today-venue-${id}.webp`);
 const src = fs.existsSync(keep) ? keep : game;
 if (!fs.existsSync(src)) { rows.push([`venue-${id}`, '근무지 그림 없음']); continue; }
 if (!check) ff(['-i', src, '-vf', 'scale=960:540:force_original_aspect_ratio=increase:flags=lanczos,crop=960:540', '-c:v', 'libwebp', '-quality', '80', ...CLEAN, out]);
 rows.push([`venue-${id}`, (fs.existsSync(out) ? `${fs.statSync(out).size}바이트` : '사본 없음') + (src === keep ? ' · 실사' : ' · 게임 그림(실사 아직 없음)')]);
}
for (const [k, v] of rows) console.log(k.padEnd(14), v);
