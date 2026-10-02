#!/usr/bin/env node
'use strict';

// 이 파일은 검사와 견적만 지원한다. 유료 생성 명령은 의도적으로 없다.
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {existsSync, readFileSync} = require('node:fs');
const {createHash} = require('node:crypto');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const prompt = readFileSync(path.join(__dirname, '제작프롬프트.txt'), 'utf8').trim();
const avatarFile = path.join(__dirname, '발표자.json');
const avatars = JSON.parse(readFileSync(avatarFile, 'utf8'));
const mascot = require(path.join(root, 'tools/lib/마스코트자산.js'))
  .절대경로('본체', {누끼: true});
const book = path.join(root, 'docs/홍보물/브랜드소개_20260909/assets/book.webp');

const approvedLines = [
  '학생만 공부하나요?',
  '선생님도 공부해야죠.',
  '학생을요.',
  '뭘 좋아하고, 어디서 막히고, 뭘 꿈꾸는지.',
  '그걸 알아야, 그 사람에게 맞게 가르치죠.',
  '학생마다 자기만의 선생님. 싱크 랩.',
];
for (const line of approvedLines) assert.ok(prompt.includes(line), `대사 누락: ${line}`);
assert.equal(avatars.length, 1, '발표자는 한 명이어야 한다.');
assert.equal(avatars[0].type, 'custom', '임의 발표자를 쓰지 않는다.');
assert.equal(avatars[0].id, 'f513630b-96a4-4b42-81ee-f62399cb831e');
for (const asset of [avatarFile, mascot, book]) assert.ok(existsSync(asset), `자산 없음: ${asset}`);

const args = [
  'generate', 'cost', 'marketing_studio_video',
  '--avatars', `@${avatarFile}`,
  '--image', mascot, '--image', book,
  '--mode', 'ugc', '--duration', '20', '--resolution', '1080p',
  '--aspect_ratio', '9:16', '--generate_audio', 'true', '--json',
  '--prompt', prompt,
];

// npm.cmd/cmd.exe를 거치지 않고 네이티브 프로세스의 인수 배열로 전달한다.
// 개행, 따옴표, 한글 경로를 포함한 전체 인수가 보존되는지 로컬에서 확인한다.
const probe = spawnSync(process.execPath, [
  '-e', 'process.stdout.write(JSON.stringify(process.argv.slice(1)))', ...args,
], {encoding: 'utf8', shell: false, windowsHide: true, maxBuffer: 1024 * 1024});
if (probe.error) throw probe.error;
assert.equal(probe.status, 0, probe.stderr || '인수 전달 검사 실패');
assert.deepEqual(JSON.parse(probe.stdout), args, '전달 과정에서 인수가 변했다.');

const report = {
  check: 'passed',
  checkedSpeechLines: `${approvedLines.length}/${approvedLines.length}`,
  promptCharacters: prompt.length,
  promptLines: prompt.split(/\r?\n/).length,
  promptSha256: createHash('sha256').update(prompt).digest('hex'),
  customPresenters: '1/1',
  referenceImages: '2/2',
  duration: 20,
  resolution: '1080p',
  aspectRatio: '9:16',
  audio: true,
  nativeArgumentRoundTrip: 'exact',
  generationEnabled: false,
};

const mode = process.argv[2] || 'check';
if (mode === 'check') {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else if (mode === 'cost') {
  const cli = process.argv[3];
  assert.ok(cli && path.isAbsolute(cli) && existsSync(cli), '공식 hf.exe의 절대 경로가 필요하다.');
  assert.equal(path.basename(cli).toLowerCase(), 'hf.exe', '명령 래퍼가 아닌 hf.exe만 허용한다.');
  process.stderr.write('입력 검사 통과. 비용만 조회하며 영상 생성은 하지 않습니다. 참조 이미지는 CLI가 업로드할 수 있습니다.\n');
  const quote = spawnSync(cli, args, {
    encoding: 'utf8', shell: false, windowsHide: true,
    maxBuffer: 1024 * 1024, timeout: 60000,
    env: {...process.env, HIGGSFIELD_INSTALL_METHOD: 'npm', HIGGSFIELD_PACKAGE_MANAGER: 'npm'},
  });
  if (quote.error) throw quote.error;
  if (quote.stderr) process.stderr.write(quote.stderr);
  process.stdout.write(quote.stdout || '');
  process.exitCode = quote.status || 0;
} else {
  throw new Error('지원 동작은 check, cost뿐입니다. 유료 생성은 지원하지 않습니다.');
}
