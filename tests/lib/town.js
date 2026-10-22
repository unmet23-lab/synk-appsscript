'use strict';
/* 싱크타운 세로 조각 시험의 공용 도우미(설계 §15-5) — tests/town-*.test.js가 쓴다.
 * 런타임 층(experiences/synk-town/town/*.mjs)과 도구(tools/town-*.mjs)는 ESM이라 import()로 부른다.
 * 시간대를 바꿔 돌릴 때는 자식 node의 환경에 TZ를 직접 준다 — Git Bash는 `America/…`처럼 `/`가 든 TZ를
 * node에 넘기지 않는다(현장 노트 · 윈도우 셸 「Git Bash의 시각과 시간대를 믿지 않는다」). */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const TOWN = path.join(ROOT, 'experiences', 'synk-town', 'town');

const townModule = name => import(pathToFileURL(path.join(TOWN, `${name}.mjs`)).href);
const toolModule = name => import(pathToFileURL(path.join(ROOT, 'tools', `${name}.mjs`)).href);

/** 같은 node 명령을 시간대만 바꿔 돌리고 마지막 JSON 줄을 읽는다. */
function runUnderTimezone(args, tz) {
  const result = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, TZ: tz }, timeout: 60000 });
  if (result.status !== 0) throw new Error(`TZ=${tz} ${args.join(' ')} 실패: ${result.stderr || result.stdout}`);
  const line = result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  return JSON.parse(line);
}

/** 런타임 층 파일 목록 — 결정성 규칙(§2-4)을 지켜야 하는 코드다. */
function runtimeFiles(dir = TOWN) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'data' ? [] : runtimeFiles(full);
    return entry.name.endsWith('.mjs') && !entry.name.endsWith('.gen.mjs') ? [full] : [];
  }).sort();
}

module.exports = { ROOT, TOWN, townModule, toolModule, runUnderTimezone, runtimeFiles };
