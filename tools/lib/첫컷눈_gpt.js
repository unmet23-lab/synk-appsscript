#!/usr/bin/env node
'use strict';
/* 첫컷검사의 다른 눈 — GPT(구독 Codex, 돈 안 나감). tools/첫컷검사.py가 부른다(2026-11-18 유호님 「응, 고쳐」).
 *
 * 작업 폴더(첫컷검사가 만든 빈 임시 폴더)의 컷연결.jpg · 초_*.jpg · 기준_*.jpg(배역 기준 얼굴, 11-23) · 얼굴판.jpg(이 구간 칸의 얼굴, 11-24)
 * · 얼굴판_다른컷.jpg(같은 배역이 혼자 나오는 다른 컷의 얼굴, 11-24)를 이 순서로 첨부하고
 * 표준입력의 글을 그대로 보인다. 답 글은 표준출력에 쓴다.
 * 모델과 추론은 GPT 검수와 같은 값(lib/GPT검수모델.js)이고, 계정 돌려쓰기 · 읽기 전용 · 도구 금지 머리는 lib/그림눈.js GPT묻기가 맡는다.
 * 끝 코드: 0 답 받음 · 3 쓸 수 있는 GPT 계정 없음 · 1 그 밖에 막힘. 첫컷검사는 0이 아니면 판정 없이 멈춘다.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { GPT묻기 } = require('./그림눈.js');
const { GPT검수 } = require('./GPT검수모델.js');

(async () => {
  const 글 = fs.readFileSync(0, 'utf8');
  const 그림들 = fs.readdirSync(process.cwd()).filter((f) => /^초_\d+\.jpg$/.test(f)).sort().map((f) => path.resolve(f));
  if (!그림들.length) {
    process.stderr.write('[첫컷눈] 작업 폴더에 초_*.jpg가 없다\n');
    process.exit(1);
  }
  const 연결판 = path.resolve('컷연결.jpg');
  if (fs.existsSync(연결판)) 그림들.unshift(연결판);
  그림들.push(...fs.readdirSync(process.cwd()).filter((f) => /^기준_.+\.jpg$/.test(f)).sort().map((f) => path.resolve(f)));
  for (const f of ['얼굴판.jpg', '얼굴판_다른컷.jpg']) if (fs.existsSync(f)) 그림들.push(path.resolve(f));
  const 답파일 = path.join(os.tmpdir(), `synk-firstcut-gpt-${process.pid}-${Date.now()}.md`);
  const r = await GPT묻기({ 그림들, 글, 답파일, 시간: 15 * 60 * 1000 });
  fs.rmSync(답파일, { force: true });
  if (r.결과 !== '받음') {
    process.stderr.write(`[첫컷눈] GPT 막힘(${r.꼴}): ${r.첫줄}\n`);
    process.exit(r.꼴 === '계정 없음' ? 3 : 1);
  }
  process.stderr.write(`[첫컷눈] 경로=GPT(${GPT검수.모델}·${GPT검수.추론}) ${r.초}초\n`);
  process.stdout.write(r.답);
})().catch((e) => {
  process.stderr.write(`[첫컷눈] ${e.message}\n`);
  process.exit(1);
});
