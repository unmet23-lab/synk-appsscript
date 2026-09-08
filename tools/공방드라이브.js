#!/usr/bin/env node
'use strict';
// 고화질 자산은 네 브랜드 핵심 자료 갱신 도구에서 함께 관리한다.
// 예전 폴더·시험 원본을 다시 복제하거나 로컬 제작 원본을 자동 삭제하지 않는다.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const args = process.argv.slice(2);
if (args.includes('--치움')) {
  console.error('로컬 원본 자동 삭제는 종료했습니다. 확정 원본은 보존합니다.');
  process.exitCode = 1;
} else {
  execFileSync(process.execPath, [path.join(__dirname, '이어하기꾸러미.js'),
    args.includes('--재본다') ? '--재기' : '--구글'], { stdio: 'inherit' });
}
