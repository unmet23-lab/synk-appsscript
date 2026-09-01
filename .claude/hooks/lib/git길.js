'use strict';
/**
 * git길 — 훅 안에서 git 을 부를 때의 «경로 형식»과 «실패의 얼굴»을 한 곳에서 정한다.
 *
 * ■ 왜 있나 (2026-09-01 실측 · 새 훅 셋을 시험하다 잡았다)
 *   Stop 훅이 미커밋 1건 앞에서 **완전히 침묵했다.** 원인은 git 이 없어서가 아니라
 *   **cwd 가 POSIX 경로(`/c/Users/...`)로 들어와** Windows node 의 `spawnSync` 가
 *   그 디렉터리를 못 찾고 **ENOENT** 를 낸 것이다. 그런데 그 ENOENT 를 훅이 `catch` 로
 *   삼켜서 **「미커밋 0건」과 똑같은 얼굴**이 됐다.
 *   ⇒ 이 저장소가 가장 경계하는 무늬 그대로다: **미실행과 통과가 같은 모양**([[zero-is-a-success-face-taxonomy]]).
 *      훅은 bash(`shell: "bash"`)로 도는데 그 안의 node 는 Windows 네이티브라 두 세계가 갈린다.
 *
 * ■ 무엇을 하나 — 둘뿐이다
 *   ① `길(cwd)` — POSIX 경로를 Windows 경로로 돌린다(`/c/x` → `C:/x` · `//c/x` 도 같다).
 *   ② `깃(cwd, 인자[])` — git 을 부르고 **{ok, out, why}** 로 답한다. **던지지 않는다.**
 *      실패했을 때 `ok:false` 와 `why` 를 주므로, 부르는 쪽이 «0건»과 «못 쟀다»를 갈라 말할 수 있다.
 *
 * ■ 대가
 *   - git 실행 파일 후보를 순서대로 시도한다(PATH 우선 → Git for Windows 기본 자리 둘).
 *     넷 다 죽으면 `why` 에 마지막 사유가 담긴다 — 그때 부르는 쪽은 **침묵하면 안 된다.**
 */
const { execFileSync } = require('child_process');
const fs = require('fs');

/** POSIX(`/c/...`·`//c/...`) → Windows(`C:/...`). 이미 Windows 형식이면 그대로. */
function 길(p) {
  if (!p) return p;
  const s = String(p).replace(/\\/g, '/');
  const m = s.match(/^\/{1,2}([A-Za-z])(\/.*)?$/);
  if (m) return m[1].toUpperCase() + ':' + (m[2] || '/');
  return s;
}

const 후보 = [
  'git',
  'C:/Program Files/Git/cmd/git.exe',
  'C:/Program Files/Git/bin/git.exe',
  'C:/Program Files (x86)/Git/cmd/git.exe',
];

/**
 * git 을 부른다. 던지지 않는다.
 * @returns {{ok:boolean, out:string, why:string|null}}
 */
function 깃(cwd, 인자) {
  const dir = 길(cwd);
  if (dir && !fs.existsSync(dir)) {
    return { ok: false, out: '', why: `작업 폴더를 못 찾았다: ${dir}` };
  }
  let 마지막 = null;
  for (const bin of 후보) {
    try {
      const out = execFileSync(bin, 인자, {
        cwd: dir, encoding: 'utf8', timeout: 15000, windowsHide: true,
      });
      return { ok: true, out: String(out).trim(), why: null };
    } catch (e) {
      // 실행 파일 자체를 못 찾은 것(ENOENT)이면 다음 후보로. 그 밖(git 이 0 아닌 종료)은 그대로 답한다.
      if (e && e.code === 'ENOENT') { 마지막 = `${bin}: 실행 파일 없음`; continue; }
      return { ok: false, out: String((e && e.stdout) || '').trim(), why: `${bin}: ${(e && e.message) || '알 수 없는 실패'}` };
    }
  }
  return { ok: false, out: '', why: 마지막 || 'git 을 못 찾았다' };
}

module.exports = { 길, 깃 };
