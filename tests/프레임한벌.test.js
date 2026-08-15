/* 프레임 «한 벌» 회귀 — 렌더 폴더를 mp4 로 굽기 전에 두 벌이 섞였는지 잡는 가드.
 *
 * 실사고 2026-08-15: 블렌더 anim2 렌더가 도는 중에 맨손 ffmpeg 로 구웠더니
 * 앞 절반은 새 렌더·뒤 절반은 «앞 렌더(v2)가 남긴 낡은 파일»인 mp4 가 나왔다
 * (코랄_3D라이브_v3.mp4 의 f300·f450·f480 이 v2 와 바이트 동일 · MAE 0.00).
 * 그 영상을 라이브 판으로 읽고 「좌 +75° 큰 턴이 착지 안 됐다」는 **없는 결함**을 진단해,
 * 다음 세션의 첫 일감으로 인계까지 됐다. 렌더 폴더는 덮어쓰기라 «렌더 머리»보다 뒤 번호는
 * 늘 지난 판이고, 그 상태가 정상 폴더와 **완전히 같은 모양**이라는 게 급소다.
 *
 * 두 축을 분리한다(CLAUDE.md 「가드·회귀의 네 맹점」):
 *   · **탐지력은 픽스처가 진다** — 임시 폴더에 사고를 재현해 거절되는지 본다.
 *     실저장소가 깨끗해지면 아무도 탐지력을 증명하지 않게 되므로, 실저장소에는 탐지를 안 건다.
 *   · **자기 처방을 되먹인다**(맹점 ③) — 거절문이 알려주는 `--재굽기` 를 그대로 써서
 *     ①정당한 재굽기는 통과하고 ②이번 사고는 그 면제로도 못 지나는지 둘 다 본다.
 *     통과만 검사하면 면제가 사고를 세탁하는 자리가 그대로 열려 있게 된다.
 *   · **소스 통로**는 파이썬 없이도 돈다 — 닫은 옛 통로(맨손 ffmpeg 한 줄)가 머리말로
 *     되돌아오는 커밋을 잡는 게 목적이라 탐지 대상이 런타임이 아니라 문서다.
 *
 * python 은 repo 밖 환경이라 없으면 **skip 으로 드러낸다**(통과와 미실행이 같은 모양이면 안 된다).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 도구 = path.join(__dirname, '..', 'tools', '마스코트인형리깅.py');
const N = 40; // 사고 구조만 재현하면 되니 600 장을 만들 이유가 없다

/* ── 파이썬 없이 도는 층: 옛 통로가 문서로 되살아나는 것을 막는다 ─────────────── */
test('머리말이 맨손 ffmpeg 조립을 다시 안내하지 않는다 (그게 사고의 통로였다)', () => {
  const src = fs.readFileSync(도구, 'utf8');
  const 머리말 = src.slice(0, src.indexOf('import sys'));
  assert.ok(/조립 <프레임폴더>/.test(머리말), '조립 통로 안내가 머리말에서 사라졌다 — 누가 다시 맨손으로 굽는다');
  // 「ffmpeg 가 필요하다」는 언급은 통로가 아니다 — 잡을 것은 **붙여넣을 수 있는 명령줄**이다
  // (ffmpeg 뒤에 플래그가 붙은 줄). 넓게 잡으면 의존성 한 줄에 거짓양성이 나고, 그런 회귀는 꺼진다.
  const 맨손 = 머리말.split('\n').filter((l) => /ffmpeg\s+-/.test(l));
  assert.deepStrictEqual(맨손, [], `머리말이 맨손 ffmpeg 명령을 다시 안내한다:\n${맨손.join('\n')}`);
});

/* ── 픽스처 층 ──────────────────────────────────────────────────────────── */
function 파이썬() {
  for (const py of ['python', 'python3']) {
    const r = spawnSync(py, ['-c', 'print(1)'], { encoding: 'utf8', timeout: 20000 });
    if (r.status === 0) return py;
  }
  return null;
}

/** 프레임 폴더를 만든다. 때(i) 가 i 번 프레임의 mtime(초, 기준시각으로부터). */
function 폴더(때) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-frames-'));
  const 기준 = Math.floor(Date.now() / 1000) - 7200;
  for (let i = 1; i <= N; i += 1) {
    const p = path.join(d, `f_${String(i).padStart(4, '0')}.png`);
    fs.writeFileSync(p, ''); // --검사만 은 mtime·이름만 읽는다 — 디코딩 안 한다
    const t = 기준 + 때(i);
    fs.utimesSync(p, t, t);
  }
  return d;
}

function 검사(py, dir, 덧붙임 = []) {
  const r = spawnSync(py, [도구, '조립', dir, path.join(dir, 'out.mp4'), String(N), '60', '--검사만', ...덧붙임],
    { encoding: 'utf8', timeout: 60000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  return { code: r.status, 글: (r.stdout || '') + (r.stderr || '') };
}

const 임시들 = [];
test.after(() => 임시들.forEach((d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } }));
function 새폴더(때) { const d = 폴더(때); 임시들.push(d); return d; }

test('가드 픽스처 — 한 벌·빠짐·섞임·거짓선언을 가른다', (t) => {
  const py = 파이썬();
  if (!py) return t.skip('python 없음 — 픽스처 층을 **안 돌렸다**(통과 아님)');

  /* ① 정상: 번호 순으로 mtime 단조증가 = 한 벌 */
  {
    const { code, 글 } = 검사(py, 새폴더((i) => i * 2));
    assert.strictEqual(code, 0, `깨끗한 한 벌을 거절했다(거짓양성):\n${글}`);
    assert.match(글, /검사 OK/);
  }

  /* ② 빠짐: 렌더가 도중에 죽어 꼬리가 없다 */
  {
    const d = 새폴더((i) => i * 2);
    for (let i = 31; i <= N; i += 1) fs.rmSync(path.join(d, `f_${String(i).padStart(4, '0')}.png`));
    const { code, 글 } = 검사(py, d);
    assert.strictEqual(code, 2, `빠진 프레임 10장을 통과시켰다:\n${글}`);
    assert.match(글, /장이 없다/);
    assert.match(글, /31/, '빠진 첫 번호를 안 알려주면 처방이 안 된다');
  }

  /* ③ 섞임(이번 사고 그대로): 1~20 은 새 렌더, 21~40 은 앞 렌더가 남긴 낡은 파일 */
  const 사고 = (i) => (i <= 20 ? 3600 + i * 2 : i * 2);
  {
    const { code, 글 } = 검사(py, 새폴더(사고));
    assert.strictEqual(code, 2, `두 벌이 섞인 폴더를 통과시켰다 — 이번 사고가 그대로 재현된다:\n${글}`);
    assert.match(글, /섞였다/);
    assert.match(글, /f_0020.*f_0021/s, '어디서 갈렸는지를 안 짚으면 사람이 못 고친다');
  }

  /* ④ 자기 처방 ㉠ — 정당한 «중간 구간 재굽기»는 선언하면 통과한다(따를 수 있는 처방인가) */
  {
    const 재굽기 = (i) => (i >= 15 && i <= 25 ? 3600 + i * 2 : i * 2);
    const d = 새폴더(재굽기);
    assert.strictEqual(검사(py, d).code, 2, '재굽기 섬도 일단은 역행으로 잡혀야 한다(선언 전)');
    const { code, 글 } = 검사(py, d, ['--재굽기=15-25']);
    assert.strictEqual(code, 0, `정당한 재굽기를 선언했는데도 거절한다 — 처방을 따를 수 없다:\n${글}`);
  }

  /* ⑤ 자기 처방 ㉡ — 그 면제로 «이번 사고»를 세탁할 수는 없다(맹점 ③·④) */
  {
    const { code, 글 } = 검사(py, 새폴더(사고), ['--재굽기=21-40']);
    assert.strictEqual(code, 2, `낡은 꼬리를 「내가 다시 구웠다」고 적자 통과했다 — 면제가 사고를 세탁한다:\n${글}`);
    assert.match(글, /오래됐다/);
  }
  {
    // 경계 한 칸만 선언하는 최소 세탁도 막혀야 한다
    const { code } = 검사(py, 새폴더(사고), ['--재굽기=21-21']);
    assert.strictEqual(code, 2, '역행 지점 한 칸만 면제해도 나머지 낡은 판은 자기들끼리 단조증가라 통과한다');
  }
});
