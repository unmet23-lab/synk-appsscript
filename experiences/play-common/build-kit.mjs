// SYNK LAB PLAY 키트 사본 만들기. 원본 play-common/kit/를 게임마다 kit/로 그대로 복사한다.
// 게임 폴더는 synk.im에 따로따로 공개되므로(SYNK-website sync-play-games.mjs) 사본을 둔다. 사본은 직접 고치지 않는다.
// 쓰는 법: node experiences/play-common/build-kit.mjs   (확인: node --test experiences/play-common/kit.test.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const KIT_SRC = path.join(here, 'kit');
// 키트로 옮긴 게임. 옮길 때마다 여기에 더한다.
export const KIT_GAMES = ['talk-rally', 'order-rush', 'story-classroom', 'korean-rhythm', 'korean-runner', 'korean-racing', 'blank-slice', 'entry-check', 'word-magic'];
// 키트 화면을 쓰지 않는 게임도 받침 조사는 같은 원본을 쓴다 — kit/에 josa.mjs 한 파일만 복사한다.
export const JOSA_ONLY_GAMES = ['hangul-stage', 'daily-fortune'];
export const JOSA_FILE = 'josa.mjs';

export function kitFiles(dir = KIT_SRC, base = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const rel = base ? `${base}/${d.name}` : d.name;
    return d.isDirectory() ? kitFiles(path.join(dir, d.name), rel) : [rel];
  }).sort();
}

export function buildKit(games = KIT_GAMES) {
  const files = kitFiles();
  for (const game of games) {
    const dst = path.join(here, '..', game, 'kit');
    if (fs.existsSync(dst)) for (const rel of kitFiles(dst)) if (!files.includes(rel)) fs.rmSync(path.join(dst, rel));   // 원본에서 빠진 파일은 사본에서도 뺀다
    for (const rel of files) {
      const to = path.join(dst, rel);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(KIT_SRC, rel), to);
    }
    console.log(`${game}/kit ← ${files.length}개`);
  }
}

export function buildJosa(games = JOSA_ONLY_GAMES) {
  for (const game of games) {
    const dst = path.join(here, '..', game, 'kit');
    if (fs.existsSync(dst)) for (const rel of kitFiles(dst)) if (rel !== JOSA_FILE) fs.rmSync(path.join(dst, rel));
    fs.mkdirSync(dst, { recursive: true });
    fs.copyFileSync(path.join(KIT_SRC, JOSA_FILE), path.join(dst, JOSA_FILE));
    console.log(`${game}/kit ← ${JOSA_FILE}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { buildKit(); buildJosa(); }
