#!/usr/bin/env node
'use strict';
// 드라마 말하기 시범판의 학습 기록 묶음: experiences/drama/pilot/learning-entry.cjs(Atlas 게임 어댑터 + 말하기 지도 + WORLD 학습 호스트)
// → experiences/drama/pilot/atlas-learning.js. 지도(strata/maps/ko-speaking.json)는 tools/build-game-learning.js가 만든다.
// Usage: node tools/build-drama-learning.js [--check]
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
if (args.some(a => a !== '--check')) throw new Error('Usage: node tools/build-drama-learning.js [--check]');
const check = args.includes('--check');
const destination = path.join(root, 'experiences/drama/pilot/atlas-learning.js');
const esbuild = require(require.resolve('esbuild', { paths: [root, path.join(root, '영상')] }));
const bundled = esbuild.buildSync({ absWorkingDir: root, entryPoints: ['experiences/drama/pilot/learning-entry.cjs'], bundle: true,
  write: false, platform: 'browser', format: 'iife', globalName: 'DramaLearning', target: ['es2022'], charset: 'utf8',
  banner: { js: '// Generated from atlas/, strata/, experiences/synk-account/src/generated/world-learning-host.cjs and experiences/drama/pilot/learning-entry.cjs. Change those sources; run tools/build-drama-learning.js.' } });
const data = Buffer.from(bundled.outputFiles[0].contents);
const same = fs.existsSync(destination) && fs.readFileSync(destination, 'utf8').replace(/\r\n/g, '\n') === data.toString('utf8').replace(/\r\n/g, '\n');
if (check && !same) throw new Error(`Drama learning bundle differs: ${path.relative(root, destination)}`);
if (!check && !same) fs.writeFileSync(destination, data);
console.log(`${check ? 'verified' : same ? 'unchanged' : 'built'} ${path.relative(root, destination)}`);
