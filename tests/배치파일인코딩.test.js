/* .cmd·.bat 인코딩 회귀 — 배치 파일에 비ASCII를 넣지 않는다 (F069)
 *
 * 왜 있나: 2026-08-04, `.cmd` 주석에 한글을 넣어 배치 파일이 깨졌다.
 *   cmd.exe 는 파일을 **CP949**(시스템 ANSI 코드페이지)로 읽는데 편집기는 UTF-8 로 쓴다.
 *   주석 한 줄이라도 비ASCII 가 섞이면 그 바이트열이 CP949 로 재해석돼 명령이 뭉개진다.
 *   🔑 특히 나쁜 점은 **주석에서 났다**는 것이다 — 실행에 아무 영향이 없어야 할 자리라
 *      「설명을 친절하게 달았을 뿐」인데 파일이 죽는다.
 *
 * 왜 훅이 아니라 회귀인가: 표면이 아주 좁다(이 저장소의 배치 파일은 2개). 훅은 매 편집마다
 *   프로세스를 띄우는 비용이 있고, 이 사고는 **파일에 남는** 종류라 CI 가 배포 전에 잡는다.
 *   표면이 넓어지면(배치 파일이 늘거나 같은 사고가 재발하면) 그때 훅으로 옮긴다.
 *
 * 탐지 능력은 픽스처로 못박고, 실저장소에는 거짓양성만 검사한다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

/** 비ASCII 문자의 위치를 짚는다(코드포인트 기준 — 바이트로 세면 한글이 3배로 부풀어 층이 갈린다 · F052) */
function 비ASCII(본문) {
  const out = [];
  본문.split(/\r?\n/).forEach((line, i) => {
    const bad = [...line].filter((c) => c.charCodeAt(0) > 127);
    if (bad.length) out.push({ 행: i + 1, 개수: bad.length, 미리: line.trim().slice(0, 40) });
  });
  return out;
}

// ── 탐지 능력 (픽스처) ──────────────────────────────────────────────────────

test('한글이 든 배치 파일을 잡아낸다 — 주석이어도 잡는다', () => {
  const 나쁜 = 'REM 이 파일은 메모리를 밀어 올린다\r\n@echo off\r\ngit push\r\n';
  const 결과 = 비ASCII(나쁜);
  assert.strictEqual(결과.length, 1, '주석 안의 한글을 못 잡았다 — 실행에 무관해 보이는 자리가 실제 사고 지점이다');
  assert.strictEqual(결과[0].행, 1);
});

test('ASCII 만 있는 배치 파일은 통과한다 (거짓양성이 없어야 쓴다)', () => {
  const 좋은 = 'REM push memory files\r\n@echo off\r\ngit add -- memory\r\ngit commit -m "sync"\r\n';
  assert.deepStrictEqual(비ASCII(좋은), []);
});

test('행 번호는 1부터 센다 (사람이 편집기에서 찾는 번호와 같아야 한다)', () => {
  const s = '@echo off\r\nREM 두 번째 줄에 한글\r\n';
  assert.strictEqual(비ASCII(s)[0].행, 2);
});

// ── 실저장소 (거짓양성만 · 파일이 없으면 skip 으로 드러낸다) ────────────────

test('실저장소: 배치 파일에 비ASCII 가 없다', (t) => {
  let files = [];
  try {
    files = execFileSync('git', ['-c', 'core.quotepath=false', 'ls-files', '*.cmd', '*.bat'],
      { cwd: ROOT, encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (_) {
    return t.skip('git ls-files 실패 — 저장소 밖에서는 이 검사가 의미 없다');
  }
  if (!files.length) {
    // 「통과」와 「검사할 것이 없음」이 같은 모양이면 안 된다 — 목록이 조용히 비면 초록으로 보인다
    return t.skip('배치 파일이 없다 — 검사 대상 0건');
  }
  const 위반 = [];
  for (const f of files) {
    let src;
    try { src = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (_) { continue; }
    for (const v of 비ASCII(src)) 위반.push(`${f}:${v.행} 비ASCII ${v.개수}자 — ${v.미리}`);
  }
  assert.deepStrictEqual(위반, [],
    '\n  cmd.exe 는 배치 파일을 CP949 로 읽는다 — 주석이라도 비ASCII 가 섞이면 명령이 뭉개진다(F069).'
    + '\n  설명이 필요하면 영어로 쓰거나, 문서(.md)로 빼고 배치 파일에는 포인터만 남긴다.\n  '
    + 위반.join('\n  '));
});
