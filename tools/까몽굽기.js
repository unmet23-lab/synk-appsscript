#!/usr/bin/env node
/**
 * 까몽 굽기 — 몽글 친구 «까몽» 표정 다섯을 정본 규격으로 굽고, 판정 지면까지 한 벌로 낸다.
 *   이름 = 까몽(까맣다 + 몽글의 「몽」 · 유호 확정 2026-08-25).
 *
 * ■ 왜 도구로 있나
 *   🔑 **굽기와 «판정 지면»은 한 벌이다**(트랙 §0). 굽고 시트를 안 그리면 유호님은 폴더를 보셔야 한다.
 *   🔑 그리고 밤굽기·손굽기가 **같은 자**를 쓰게 한 자리에 둔다 — 손으로 blender 를 부르면
 *     샘플·해상도가 판마다 갈리고, 갈린 세트는 나중에 못 알아본다.
 *
 * ■ 「이미 새것이면 안 굽는다」 — 이 도구의 핵심 규율
 *   산출이 **굽기 자(몽글친구굽기.py · 요소굽기.py)보다 새것**이면 건너뛴다.
 *   까닭은 bake-from-a-moving-canon 의 뒤집힌 얼굴이다: 자가 안 움직였는데 다시 굽는 것은
 *   3.5시간을 태우는 무동작이다. 반대로 자가 움직였으면 «있어도» 다시 굽는다 —
 *   「파일이 있나」로 물으면 옛 판이 늘 그 자리에 있어 죽은 굽기도 ✅ 로 읽힌다(`644716a4` 실사고).
 *   `--다시` 로 강제 전량 재굽기.
 *
 * ■ 장치
 *   첫 장만 GPU-먼저로 재고, 되물렸으면 **남은 넷은 처음부터 CPU** — 되물림 준비를 네 번 더 안 치른다.
 *   되물림 표지는 **인코딩 안 타는 ASCII**(`OUT_OF_RESOURCES`)와 «걸린 시간» 둘을 같이 본다:
 *   한글 로그는 CP949 로 깨져 표지로 못 쓴다(트랙 §0 · 52장 굽기가 그것으로 완주를 놓쳤다).
 *
 * 사용:  node tools/까몽굽기.js [--다시] [--너비 1024] [--샘플 96] [--시트없이]
 */
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 인자 = (() => {
  const a = {}; const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i += 1) {
    if (!v[i].startsWith('--')) continue;
    a[v[i].slice(2)] = (v[i + 1] && !v[i + 1].startsWith('--')) ? v[i += 1] : '1';
  }
  return a;
})();

const 방 = path.join(루트, 'docs', '캐릭터', '친구공방_0825');
const 접두 = '까몽';
const 표정들 = ['본체', '눈감음', '눈웃음', '우34', '좌34'];
const 너비 = 인자['너비'] || '1024';
const 샘플 = 인자['샘플'] || '96';
const 다시 = !!인자['다시'];

const 분 = (ms) => (ms / 60000).toFixed(1);
const 말 = (s) => console.log(`[${new Date().toTimeString().slice(0, 8)}] ${s}`);

/** 블렌더 찾기 — NPC굽기.js·밤굽기.js 와 같은 순서(환경변수 → 설치 폴더 최신). */
function 블렌더() {
  for (const k of ['BLENDER_EXE', 'BLENDER']) {
    if (process.env[k] && fs.existsSync(process.env[k])) return process.env[k];
  }
  for (const b of ['C:\\Program Files\\Blender Foundation', 'C:\\Program Files (x86)\\Blender Foundation']) {
    if (!fs.existsSync(b)) continue;
    for (const d of fs.readdirSync(b).sort().reverse()) {
      const p = path.join(b, d, 'blender.exe');
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/** 굽기 «자»가 마지막으로 움직인 시각 — 이보다 새 산출은 다시 구울 까닭이 없다. */
function 자의시각() {
  return Math.max(...['몽글친구굽기.py', '요소굽기.py']
    .map((f) => fs.statSync(path.join(루트, 'tools', f)).mtimeMs));
}

function main() {
  const BL = 블렌더();
  if (!BL) { console.error('🔴 blender.exe 를 못 찾았다 — BLENDER_EXE 로 경로를 준다.'); process.exit(1); }
  fs.mkdirSync(방, { recursive: true });

  const 자 = 자의시각();
  말(`■ 까몽 굽기 — ${너비}px · 샘플 ${샘플} · 굽기 자 ${new Date(자).toLocaleString('ko-KR', { hour12: false })}`);

  let 장치 = 'GPU';          // 첫 장이 답한다
  let 실패 = 0; let 건너뜀 = 0; let 구움 = 0;
  for (const 표정 of 표정들) {
    const 파일 = path.join(방, `${접두}_${표정}.png`);
    if (!다시 && fs.existsSync(파일) && fs.statSync(파일).mtimeMs > 자) {
      말(`   ⏭ ${접두}_${표정} — 자보다 새것이라 건너뛴다`);
      건너뜀 += 1;
      continue;
    }
    const t0 = Date.now();
    const r = spawnSync(BL, ['-b', '-P', path.join(루트, 'tools', '몽글친구굽기.py'), '--',
      `저장소=${루트}`, `출력=${파일}`, `표정=${표정}`,
      `너비=${너비}`, '비율=1.0', `샘플=${샘플}`, '조리개=2.8', `장치=${장치}`],
      { cwd: 루트, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

    /* 성공 판정은 «이 굽기가 새로 썼나»(mtime). 「있나」는 옛 판을 성공으로 읽는다. */
    let 새로 = false;
    try { 새로 = fs.statSync(파일).mtimeMs >= t0 - 1000; } catch (_) { 새로 = false; }
    const 걸림 = Date.now() - t0;
    if (장치 === 'GPU' && (/OUT_OF_RESOURCES/.test(String(r.stdout || '') + String(r.stderr || ''))
                           || 걸림 > 15 * 60000)) {
      장치 = 'CPU';
      말('   ↩ GPU 가 못 버텼다 — 남은 넷은 처음부터 CPU 로 간다');
    }
    말(`   ${새로 ? '✅' : '🔴'} ${접두}_${표정} · ${분(걸림)}분 · ${장치}`);
    if (새로) { 구움 += 1; } else { 실패 += 1; }
  }

  /* 「합계 = 갈래 + 갈래」로 찍는다 — 좋은 0 과 「안 재봤다」를 가른다(유호 지시). */
  말(`■ 합계 ${표정들.length} = 구움 ${구움} + 건너뜀 ${건너뜀} + 실패 ${실패}`);

  /* 옛 정본을 그 자리에서 지운다 — 남겨두면 반드시 다시 참조된다(CLAUDE.md).
   * 다섯이 다 선 뒤에만 지운다: 반쯤 된 세트가 옛 판까지 잃으면 볼 것이 없다. */
  const 옛판 = path.join(방, '몽글친구_v2.png');
  if (실패 === 0 && fs.existsSync(옛판)) {
    fs.unlinkSync(옛판);
    말('   🗑 옛 판 몽글친구_v2.png 를 지웠다 — 새 털 자의 본체가 그 자리를 대신한다');
  }

  if (!인자['시트없이'] && 실패 < 표정들.length) {
    말('■ 판정 지면');
    const s = spawnSync(process.execPath, [path.join(루트, 'tools', '까몽시트.js')],
      { cwd: 루트, stdio: 'inherit' }).status;
    말(`■ 지면 종료코드 ${s}`);
  }
  process.exit(실패 ? 1 : 0);
}

if (require.main === module) main();
