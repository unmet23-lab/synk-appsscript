#!/usr/bin/env node
'use strict';

// 비전 정본에서 GAS 상담 지식과 대외 FAQ의 표시 구간만 갱신한다.
// 수동 제작: node tools/비전동기화.js / 읽기 전용 대조: --check
// 이어하기 꾸러미의 실제 갱신에서도 실행한다. GAS 런타임은 이 도구를 호출하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const { loadVisions } = require('./lib/비전정본.js');
const ROOT = path.resolve(__dirname, '..');

const targets = [
  {
    file: 'contents_상담AI.js',
    start: '    // synk-vision:lab:start',
    end: '    // synk-vision:lab:end',
    body: visions => '    내용: ' + JSON.stringify(
      'SYNK LAB의 비전은 다음과 같습니다.\n\n' + visions.lab.headline + '\n\n' + visions.lab.subtext
    ),
  },
  {
    file: 'docs/정본/SYNK/SYNK FAQ.txt',
    start: '<!-- synk-vision:faq:start -->',
    end: '<!-- synk-vision:faq:end -->',
    body: visions => ['synk', 'lab'].map(key =>
      '**' + visions[key].name + '의 비전**\n\n**' + visions[key].headline + '**\n\n' + visions[key].subtext
    ).join('\n\n'),
  },
];

function replaceBlock(source, target, visions) {
  const start = source.indexOf(target.start);
  const end = source.indexOf(target.end);
  if (start < 0 || end < start || start !== source.lastIndexOf(target.start) || end !== source.lastIndexOf(target.end)) {
    throw new Error('비전 표시 구간이 없거나 중복되었습니다: ' + target.file);
  }
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const block = [target.start, target.body(visions), target.end].join('\n').replace(/\n/g, eol);
  return source.slice(0, start) + block + source.slice(end + target.end.length);
}

function syncVisionSources({ root = ROOT, check = false, visions = loadVisions() } = {}) {
  // 모든 표시 구간을 먼저 읽고 확인한다. 뒤의 원문이 잘못됐으면 앞 파일도 쓰지 않는다.
  const changes = targets.map(target => {
    const filePath = path.join(root, target.file);
    const before = fs.readFileSync(filePath, 'utf8');
    return { file: target.file, filePath, before, after: replaceBlock(before, target, visions) };
  }).filter(row => row.before !== row.after);
  if (!check) for (const row of changes) fs.writeFileSync(row.filePath, row.after, 'utf8');
  return { checked: targets.length, changed: changes.map(row => row.file), written: check ? 0 : changes.length };
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const result = syncVisionSources({ check });
  console.log(JSON.stringify(result));
  if (check && result.changed.length) process.exitCode = 1;
}

module.exports = { syncVisionSources };
