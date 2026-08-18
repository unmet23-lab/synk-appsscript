#!/usr/bin/env node
/* 백업 — **노트북이 사라져도 일이 안 죽게** 한다 (유호님 지시 2026-08-10).
 *
 * 왜 있나 (2026-08-10 실측):
 *   유호님 작업 본체(`Documents\SYNK-*`)는 **OneDrive 밖**이다. 바탕화면·문서·그림은
 *   OneDrive 로 리디렉션돼 있는데 `C:\Users\q1212\Documents` 만 그 밖에 남아 있어,
 *   저장소 2개가 클라우드 백업을 **전혀** 못 받고 있었다. 그 시점 무보호분:
 *   미push 13커밋 + 미커밋 30건. 노트북이 죽으면 그대로 소멸이다.
 *
 * 무엇을 하나 — 층마다 사는 곳이 다르다:
 *   ① **커밋** → GitHub(`safety/*` 브랜치). master 를 안 건드리므로 남의 세션 작업과 무관하고,
 *      뒤처져 있어도(behind) 밀린다. 되찾기는 clone 한 벌이면 끝난다.
 *   ② **미커밋·미추적 파일** → OneDrive 스냅샷. git 이력 어디에도 없는 **유일한 무보호 상태**라
 *      (F025) 커밋을 기다리지 않고 파일째 복사한다. 남의 세션이 든 작업본도 **읽기만** 한다.
 *   ③ **저장소 밖 낱개 파일** → OneDrive 스냅샷. 시간표·투자자덱처럼 git 에 없는 것들.
 *
 * ⚠ .gitignore 된 파일은 담지 않는다 — `git status --porcelain` 이 애초에 안 보여준다.
 *   그 자리에 사는 게 자격증명이라(CLAUDE.md: 자격증명만 영원히 git 눈 밖) 백업에도 안 실린다.
 *   그건 유호님이 password manager 로 따로 지킨다 — 이 도구가 대신할 수 없는 층이다.
 *
 * 쓰는 법: node tools/백업.js          (진단 + 실행)
 *          node tools/백업.js --진단   (재기만 — 아무것도 안 바꾼다)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { 찾기: 바탕화면찾기 } = require('./lib/바탕화면.js');
const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));

const 스냅샷폴더명 = 'SYNK_안전백업';
const 큰파일한계 = 100 * 1024 * 1024; // 100MB — 넘으면 건너뛰고 소리 낸다(조용한 누락 금지)

function git(저장소, 인자, { 조용히 = false } = {}) {
  try {
    return execFileSync('git', ['-C', 저장소, '-c', 'core.quotepath=false', ...인자], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
      /* 🔴 `trim()` 이 아니라 `trimEnd()` 다. `status --porcelain` 의 첫 칸은 **공백이 값**이라
       * (` M path` = 작업본만 수정), 앞을 깎으면 경로가 한 글자씩 밀려 `docs/…` 가 `ocs/…` 가 된다.
       * 2026-08-10 실측: 그 상태로 파일 1건이 ENOENT 로 안 담겼다 — 읽는 층이 값을 깨뜨린 자리다. */
    }).trimEnd();
  } catch (e) {
    if (조용히) return null;
    throw e;
  }
}

/** 이 저장소의 **본진**(워크트리에서 불러도 메인 트리를 가리킨다 — 워크트리를 백업해도 소용없다). */
function 본진() {
  const 공통 = path.resolve(git('.', ['rev-parse', '--git-common-dir']));
  return path.dirname(공통);
}

/** 백업 대상 저장소 — 본진의 형제 중 `.git` 이 있는 것 전부. **손 목록을 만들지 않는다**
 *  (새 저장소가 생기면 목록을 고쳐야 하는 설계는 고치는 걸 잊는 날 조용히 샌다). */
function 저장소들(부모) {
  const 낸것 = [];
  for (const e of fs.readdirSync(부모, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const p = path.join(부모, e.name);
    if (fs.existsSync(path.join(p, '.git'))) 낸것.push(p);
  }
  return 낸것;
}

/** 클라우드가 실제로 동기화하는 루트. 없으면 null — 「있는 척」하지 않는다. */
function 클라우드루트() {
  if (process.env.OneDrive && fs.existsSync(process.env.OneDrive)) return process.env.OneDrive;
  const b = 바탕화면찾기(); // 바탕화면이 OneDrive 안이면 그 부모가 루트다(통로 재사용)
  if (b.존재 && /OneDrive/i.test(b.경로)) return path.dirname(b.경로);
  return null;
}

/** `git status --porcelain` 한 줄에서 경로를 뽑는다. 순수 함수 — 이름 바뀜(R)은 뒤쪽(새 이름)이 실물이다. */
function 상태줄경로(줄) {
  if (!줄 || 줄.length < 4) return null;
  const 표식 = 줄.slice(0, 2);
  if (표식[0] === 'D' || 표식[1] === 'D') return null; // 지워진 파일은 복사할 실물이 없다
  let 경로 = 줄.slice(3);
  const 화살 = 경로.indexOf(' -> ');
  if (화살 >= 0) 경로 = 경로.slice(화살 + 4);
  return 경로.replace(/^"|"$/g, '');
}

/** 한 건을 담는다. **던지지 않는다** — 백업은 하나가 막혀도 나머지를 담아야 한다.
 *  (실측 2026-08-10: `Documents\My Music` 은 정션이라 copyFile 이 EPERM 을 던졌고,
 *   그 한 건이 백업 **전체**를 죽였다. 실패는 삼키지 말고 목록으로 올린다.) */
function 파일복사(원본, 목적) {
  let st;
  try { st = fs.lstatSync(원본); } catch (e) { return { 실패: e.code || String(e) }; }
  if (st.isSymbolicLink() || !st.isFile()) return { 실패: '실물 파일이 아니다(링크·정션·폴더)' };
  if (st.size > 큰파일한계) return { 건너뜀: true, 바이트: st.size };
  try {
    fs.mkdirSync(path.dirname(목적), { recursive: true });
    fs.copyFileSync(원본, 목적);
  } catch (e) {
    return { 실패: e.code || String(e) };
  }
  return { 바이트: st.size };
}

function 오늘() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function 실행({ 진단만 = false } = {}) {
  const 본 = 본진();
  const 부모 = path.dirname(본);
  const 클라우드 = 클라우드루트();
  const 스냅 = 클라우드 ? path.join(클라우드, 스냅샷폴더명, 오늘()) : null;
  const 보고 = { 스냅, 저장소: [], 낱개: { 담음: 0, 건너뜀: [] }, 경고: [] };

  if (!클라우드) 보고.경고.push('OneDrive 루트를 못 찾았다 — 파일 스냅샷은 통째로 건너뛴다(커밋 백업만 돈다)');

  for (const r of 저장소들(부모)) {
    const 이름 = path.basename(r);
    const 칸 = { 이름, 미push: 0, 밀었나: null, 담음: 0, 건너뜀: [], 실패: [] };
    git(r, ['fetch', 'origin'], { 조용히: true });

    const ahead = git(r, ['log', '--oneline', 'origin/master..master'], { 조용히: true });
    칸.미push = ahead ? ahead.split('\n').filter(Boolean).length : 0;

    // ① 커밋 → safety 브랜치 (master 를 안 건드린다 = 남의 세션 작업과 무관)
    if (칸.미push > 0 && !진단만) {
      const 가지 = `safety/local-master-${오늘().replace(/-/g, '')}`;
      const r2 = git(r, ['push', '--force', 'origin', `master:refs/heads/${가지}`], { 조용히: true });
      칸.밀었나 = r2 === null ? '실패' : 가지;
      if (r2 === null) 보고.경고.push(`${이름}: safety 브랜치 push 실패 — 네트워크·인증을 본다`);
    }

    // ② 미커밋·미추적 파일 → 스냅샷 (남의 작업본도 **읽기만** 한다)
    const 상태 = git(r, ['status', '--porcelain'], { 조용히: true }) || '';
    const 경로들 = 상태.split('\n').map(상태줄경로).filter(Boolean);
    if (스냅 && !진단만) {
      for (const 상대 of 경로들) {
        const res = 파일복사(path.join(r, 상대), path.join(스냅, 이름, 상대));
        if (res.실패) 칸.실패.push(`${상대} — ${res.실패}`);
        else if (res.건너뜀) 칸.건너뜀.push(`${상대} (${(res.바이트 / 1024 / 1024).toFixed(0)}MB)`);
        else 칸.담음 += 1;
      }
    } else {
      칸.담음 = 경로들.length; // 진단만: 몇 건이 무보호인지
    }
    칸.미커밋 = 경로들.length;
    보고.저장소.push(칸);
  }

  // ③ 저장소 밖 낱개 파일 (git 이 아예 안 보는 자리)
  if (스냅) {
    보고.낱개.실패 = [];
    for (const e of fs.readdirSync(부모, { withFileTypes: true })) {
      if (!e.isFile()) continue; // 정션·심볼릭(My Music 등)은 실물이 아니다
      if (진단만) { 보고.낱개.담음 += 1; continue; }
      const res = 파일복사(path.join(부모, e.name), path.join(스냅, '_저장소밖', e.name));
      if (res.실패) 보고.낱개.실패.push(`${e.name} — ${res.실패}`);
      else if (res.건너뜀) 보고.낱개.건너뜀.push(`${e.name} (${(res.바이트 / 1024 / 1024).toFixed(0)}MB)`);
      else 보고.낱개.담음 += 1;
    }
  }
  return 보고;
}

function 찍기(보고, 진단만) {
  const 머리 = 진단만 ? '진단(아무것도 안 바꿨다)' : '백업 완료';
  console.log(`■ ${머리}`);
  if (보고.스냅) console.log(`  스냅샷: ${보고.스냅}`);
  for (const c of 보고.저장소) {
    const 밀린것 = c.밀었나 ? ` → ${c.밀었나}` : c.미push ? ' (안 밀었다)' : '';
    console.log(`  · ${c.이름}: 미push ${c.미push}${밀린것} · 미커밋 ${c.미커밋}건 → 스냅샷 ${c.담음}건`);
    c.건너뜀.forEach((s) => console.log(`      ⚠ 너무 커서 건너뜀: ${s}`));
    c.실패.forEach((s) => console.log(`      🔴 못 담았다: ${s}`));
  }
  console.log(`  · 저장소 밖 낱개: ${보고.낱개.담음}건`);
  보고.낱개.건너뜀.forEach((s) => console.log(`      ⚠ 너무 커서 건너뜀: ${s}`));
  (보고.낱개.실패 || []).forEach((s) => console.log(`      🔴 못 담았다: ${s}`));
  보고.경고.forEach((w) => console.log(`  🔴 ${w}`));
  if (!보고.경고.length) console.log('  ✅ 경고 없음');
  console.log('\n  ⚠ 이 도구가 못 지키는 층: 계정 열쇠(GitHub·Microsoft 2FA 백업코드)와 .gitignore 된 자격증명.');
  console.log('     그건 노트북과 함께 사라진다 — 종이·다른 기기에 따로 둬야 한다.');
}

module.exports = { 상태줄경로, 파일복사, 저장소들, 클라우드루트, 본진, 실행, 스냅샷폴더명, 큰파일한계 };

if (require.main === module) {
  /* 🔑 목록은 눈으로 정하지 않았다 — `CLI도구들()` 이 재고, 회귀 ④ 가 매번 다시 센다.
   * 🔴 **`실행()` 보다 먼저** 판정한다 — 오타를 친 실행이 백업을 다 하고 죽으면 안 된다. */
  const 아는플래그 = ['--진단'];
  const 플래그오류 = 인자게이트('백업', process.argv.slice(2), 아는플래그);
  if (플래그오류) { console.error(`\n🔴 ${플래그오류}\n`); process.exit(1); }
  const 진단만 = process.argv.includes('--진단');
  찍기(실행({ 진단만 }), 진단만);
}
