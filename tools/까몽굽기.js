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
 * ■ 장치 — **CPU 가 기본이다** (08-25 실측으로 못 박았다)
 *   🔴 GPU(Arc ONEAPI)는 이 캐릭터에서 **되물릴 틈도 없이 통째로 죽는다.** 17:40 굽기 실측:
 *     본체 한 장에 10.9분을 쓰고 파일 없이 끝났다. `요소굽기.py` 의 되물림은 파이썬 `RuntimeError`
 *     를 잡는 장치인데, 새 털 정본(③조합판 = 섬유+잔털 두 겹, 5백만 가닥대)에서는 예외가 아니라
 *     **프로세스가 통째로 나간다** — 잡을 것이 없다. 옛 털 자에서 「OOM → CPU 41분」이던 기록은
 *     이제 유효하지 않다(그때는 예외가 잡혔다).
 *   ⇒ 그래서 «GPU 먼저»를 안 쓴다. 죽는 줄 아는 문을 매번 두드려 10.9분씩 버리지 않는다.
 *     `--장치 GPU` 로 다시 재볼 수는 있다(털 자가 또 바뀌면 그때 다시 잰다).
 *   그래도 되물림 판정은 남겨 둔다 — GPU 로 부를 때를 위해서다. 표지는 **인코딩 안 타는 ASCII**
 *   (`OUT_OF_RESOURCES`)와 «걸린 시간»: 한글 로그는 CP949 로 깨져 표지로 못 쓴다(트랙 §0).
 *
 * 사용:  node tools/까몽굽기.js [--다시] [--표정 본체,눈감음,눈웃음] [--너비 1024] [--샘플 96]
 *                              [--장치 CPU] [--품질 조율] [--시트없이]
 *        블렌더 자식의 출력은 «판마다» 임시 폴더에 남긴다 — 안 남기면 죽은 까닭을 못 본다
 *        (17:40 굽기가 그랬다: 실패는 찍혔는데 왜인지가 어디에도 없었다).
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

/* 「--누끼」 — 받침천을 걷고 알파로 뽑는다(요소굽기 §133 «부품» 통로 · 몽글친구굽기 판=None).
 *   🔑 왜 별도 세트인가: 2D 워프(tools/워프시연.js)는 **알파 실루엣에서 깊이를 역산**한다.
 *     배경천이 박힌 컷은 실루엣이 프레임 전체가 되어 그 역산이 통째로 거짓이 된다.
 *     그리고 구운 뒤에 색으로 떼어내는 것은 원리상 불가능하다 — 08-26 실측:
 *     까몽 본체는 알파가 전부 255 이고 털 (31,25,23) 과 그림자 (32,25,23) 이 **같은 색**이다
 *     (flood fill·밝기·채도·색온도 넷 다 실패). 누끼는 «굽기에서» 나와야 한다.
 *   산출은 `누끼/` 아래에 둔다 — 워프 통로가 그 폴더 규약으로 «누끼임»을 판정한다. */
const 누끼 = !!인자['누끼'];
/* 🔴 09-05 저녁 — 옛 세트(친구공방_0825)를 지우면서 현행 정본으로 옮겼다.
 *   ⚠ 위 「산출은 `누끼/` 아래에 둔다」는 **옛 세트 시절의 규약**이다. 새 세트(정본_4K)는
 *     굽기 자체가 투명으로 나와서 몸판/누끼를 가를 것이 없고, 그래서 하위 폴더도 없다.
 *     `--누끼` 를 줘도 같은 폴더로 간다 — 인자는 부르는 자리가 많아 남겨 두었다. */
const 방 = path.join(루트, require('./lib/마스코트자산.js').까몽폴더.split('/').join(path.sep));
const 접두 = '까몽';
/* 무엇을 굽나 — 기본은 «확정 세트 열 장»이다(유호 확정 08-31 「다섯을 확정 세트로 올리자 ·
 *   랜더도 5/5로 전부 꽉 채워줘」 — 옛 확정 「3장에서 멈춘다」(08-26)와 「우34·좌34 는 값이
 *   안 맞는다」(장당 100분대 시절)를 이것이 대체한다. 굽기 근거가 8마디 꼬리로 장당 41~58분이
 *   되며 판이 바뀌었다 · 결정.md 08-31).
 *   `--표정 놀람,윙크` 로 다른 목록을 줄 수 있다 — 새 감정 시안이 그 통로로 돈다. */
const 확정셋 = ['본체', '눈감음', '눈웃음', '우34', '좌34', '놀람', '윙크', '졸림', '으쓱', '민망'];
const 표정들 = (인자['표정'] ? String(인자['표정']).split(',').map((v) => v.trim()).filter(Boolean) : 확정셋);
const 너비 = 인자['너비'] || '1024';
const 샘플 = 인자['샘플'] || '96';
const 다시 = !!인자['다시'];
const 장치기본 = (인자['장치'] || 'CPU').toUpperCase();   // GPU 는 이 캐릭터에서 죽는다 — 위 ■장치 참조
const 로그방 = require('node:os').tmpdir();

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
  말(`■ 까몽 굽기 — ${너비}px · 샘플 ${샘플} · 장치 ${장치기본} · 굽기 자 ${new Date(자).toLocaleString('ko-KR', { hour12: false })}`);
  말(`   판별 로그 ${path.join(로그방, '까몽-<표정>.log')}`);

  let 장치 = 장치기본;
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
      `너비=${너비}`, '비율=1.0', `샘플=${샘플}`, '조리개=2.8', `장치=${장치}`,
      ...(누끼 ? ['투명=1'] : []),
      ...(인자['품질'] ? [`품질=${인자['품질']}`] : [])],
      { cwd: 루트, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

    /* 성공 판정은 «두 축이 같이» 답해야 선다 — mtime 하나로는 모자란다(codex 검수 08-25 P3).
     *   · mtime — 「있나」로 물으면 옛 판이 늘 그 자리에 있어 죽은 굽기도 ✅ 로 읽힌다(`644716a4` 실사고).
     *   · 종료상태 — 블렌더가 파일을 쓴 «뒤» 비정상 종료해도 mtime 은 갱신돼 있다. 그 한 축만 보면
     *     깨진 판을 성공으로 읽고, 아래 「옛 판 소각」이 그 오인 위에 서서 **멀쩡한 구판까지 지운다.**
     *   둘이 어긋나면 조용히 한쪽을 고르지 않고 **소리 내어 적는다** — 조용한 선택이 오진의 씨앗이다. */
    let 새로 = false;
    try { 새로 = fs.statSync(파일).mtimeMs >= t0 - 1000; } catch (_) { 새로 = false; }
    const 정상 = !r.error && r.status === 0;
    if (새로 !== 정상) {
      말(`   ⚠ 갈린다 — 파일은 ${새로 ? '새로 났고' : '안 났고'} 블렌더는 `
        + `${정상 ? '정상 종료' : `비정상(${r.error ? r.error.code || r.error.message : `코드 ${r.status}`})`}. 실패로 친다.`);
    }
    const 성공 = 새로 && 정상;
    const 걸림 = Date.now() - t0;
    /* 자식 출력을 판마다 남긴다 — 이걸 안 남겨서 17:40 굽기의 「🔴 본체 10.9분」이 왜인지
     * 아무 데도 없었다. 실패는 «찍히는» 것으로 끝나면 안 되고 «읽히는» 것이라야 한다. */
    try {
      fs.writeFileSync(path.join(로그방, `까몽-${표정}.log`),
        `[${장치}] ${분(걸림)}분 · 종료 ${r.status}${r.error ? ` · ${r.error.message}` : ''}\n`
        + String(r.stdout || '') + '\n--- stderr ---\n' + String(r.stderr || ''), 'utf8');
    } catch (_) { /* 로그 실패로 굽기를 멈추지 않는다 */ }
    if (장치 === 'GPU' && (/OUT_OF_RESOURCES/.test(String(r.stdout || '') + String(r.stderr || ''))
                           || 걸림 > 15 * 60000)) {
      장치 = 'CPU';
      말('   ↩ GPU 가 못 버텼다 — 남은 넷은 처음부터 CPU 로 간다');
    }
    말(`   ${성공 ? '✅' : '🔴'} ${접두}_${표정} · ${분(걸림)}분 · ${장치}`);
    if (성공) { 구움 += 1; } else { 실패 += 1; }
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

  /* 🔴 **시트 실패는 굽기 실패다** — 「굽기와 판정 지면은 한 벌」(트랙 §0 · 08-24 에 세 얼굴로 배웠다).
   *   종료코드를 버리면 ffmpeg·펠트문서가 죽어도 「전부 끝」이 찍히고, 유호님은 **옛 지면**을 보신다.
   *   그게 08-24 의 그 자리다: 지면이 실물보다 네 시간 반 뒤처져 «옛 그림으로 새 판을 판정»할 뻔했다.
   *   (codex 검수 08-25 P1 — ② 엔진 세션 경유로 받았다.) */
  let 지면탈 = 0;
  const 확정판 = 표정들.length === 확정셋.length && 확정셋.every((v, i) => 표정들[i] === v);
  /* 시안 판은 지면을 안 그린다 — 시안이 판정 지면을 덮으면 「지금 선 것」이 흔들린다. */
  if (!인자['시트없이'] && 확정판 && 실패 < 표정들.length) {
    말('■ 판정 지면');
    const r = spawnSync(process.execPath, [path.join(루트, 'tools', '까몽시트.js')],
      { cwd: 루트, stdio: 'inherit' });
    지면탈 = (r.error || r.status !== 0) ? 1 : 0;
    말(`■ 지면 ${지면탈 ? `🔴 실패(${r.error ? r.error.code || r.error.message : `코드 ${r.status}`})` : '✅'}`);
  }
  process.exit((실패 || 지면탈) ? 1 : 0);
}

if (require.main === module) main();
