#!/usr/bin/env node
/* 이어하기 꾸러미 — 노트북을 잃어도 다음 날 이어할 수 있게, 두 클라우드에 사본을 둔다.
 *
 * 왜 이게 필요한가 (실측 2026-09-05):
 *   깃허브 저장소 넷은 이미 최신이었다(안 민 커밋 0). 그런데 **깃이 못 쥐는 것 셋**이 있었다 —
 *   ①`C:\Users\q1212\SYNK_보안\` 의 로그인 정보 8벌(이 노트북에만 있다) ②미커밋 238건 1.4GB
 *   ③옛 원드라이브 백업이 26일째 멈춰 있었다. 그리고 깃허브 «계정»에 못 들어가는 날이 오면
 *   저장소 넷이 멀쩡해도 손이 닿지 않는다. 그래서 저장소 밖에 사본을 둔다.
 *
 * 🔒 자격증명은 **절대** 담지 않는다. 아래 `금지패턴` 이 기계로 막고, 하나라도 걸리면
 *   그 자리에서 죽는다(조용히 건너뛰면 「담긴 줄 알았다」와 「안 담긴 줄 알았다」가 둘 다 생긴다).
 *   ⇒ 로그인 정보를 옮기는 것은 유호님 손이다(0_먼저읽기.md 가 그 절차를 쥔다).
 *
 * 두 곳이 하는 일이 다르다:
 *   · 원드라이브 = **글**(md 477 + 운영 장부 266 ≈ 21MB). 폰에서도 열린다. 「무엇을 정했나」가 여기 있다.
 *   · 구글드라이브 = **전부**(깃이 추적하는 2,222 파일 2.09GB + 저장소 이력 통째 bundle 4.75GB).
 *     계정이 2TB 라 이력째 담아도 남는다.
 *
 * 쓰는 법:
 *   node tools/이어하기꾸러미.js            문서·자산 갱신(양쪽)
 *   node tools/이어하기꾸러미.js --재기      얼마나 담기는지만 세고 «쓰지 않는다»
 *   node tools/이어하기꾸러미.js --저장소    + 저장소 이력 통째(bundle · 무겁다 · 주 1회면 충분)
 *   node tools/이어하기꾸러미.js --원드라이브 / --구글   한 쪽만
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const 저장소 = path.resolve(__dirname, '..');
const 원드라이브 = process.env.OneDrive || 'C:\\Users\\q1212\\OneDrive';
const 구글 = 'G:\\내 드라이브';
const 꾸러미이름 = 'SYNK_이어하기';

/* 🔒 이 무늬가 이름에 있으면 그 자리에서 죽는다. 자격증명이 사본으로 새는 통로를 기계가 막는다.
 *    (.gitignore 가 이미 막지만, 이 도구는 «깃 밖 파일»도 만지므로 자기 가드가 따로 있어야 한다) */
const 금지패턴 = [
  /SYNK_보안/i, /로그인\.txt/, /비밀번호/, /password/i, /\.env(\.|$)/,
  /\.clasprc\.json$/, /(^|[\\/])secrets[\\/]/i, /백업코드/,
];

function 금지인가(상대경로) {
  return 금지패턴.some((p) => p.test(상대경로));
}

/* ── 담을 것 고르기 ─────────────────────────────────────────────
 * 「확정된 것」의 자 = **깃이 추적하는가**. 이 저장소는 그 규율로 서 있다 —
 * 후보·중간판·다시 구울 수 있는 생성물은 .gitignore 가 이미 밖에 세워 두었고
 * (마린 후보 64장 1.4GB · 영상 out · 인쇄본 PDF …), 확정된 것만 추적한다.
 * 그래서 「확정만 담아 달라」는 요청은 `git ls-files` 한 줄로 정확히 답이 된다. */
function 추적파일() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: 저장소, maxBuffer: 1 << 28 });
  return out.toString('utf8').split('\0').filter(Boolean);
}

const 문서인가 = (p) =>
  p.endsWith('.md') ||
  p.startsWith('docs/_ops/') ||
  (p.startsWith('docs/') && p.endsWith('.json'));

/* ── 복사 (증분) ─────────────────────────────────────────────
 * 크기와 수정시각이 같으면 건너뛴다. 구글드라이브는 «쓰면 곧 올린다» —
 * 안 바뀐 2GB 를 매일 다시 올리면 그 자체가 회선을 먹는다. */
function 복사(src, dst) {
  try {
    const a = fs.statSync(src);
    let b = null;
    try { b = fs.statSync(dst); } catch { /* 없으면 새로 쓴다 */ }
    if (b && b.size === a.size && Math.abs(b.mtimeMs - a.mtimeMs) < 2000) return { 건너뜀: true, 바이트: a.size };
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    fs.utimesSync(dst, a.atime, a.mtime);   // 다음 실행이 「안 바뀌었다」를 알아보게 시각을 맞춘다
    return { 건너뜀: false, 바이트: a.size };
  } catch (e) {
    return { 오류: e.message, 바이트: 0 };
  }
}

function 사람크기(바이트) {
  if (바이트 >= 1 << 30) return (바이트 / (1 << 30)).toFixed(2) + 'GB';
  if (바이트 >= 1 << 20) return (바이트 / (1 << 20)).toFixed(1) + 'MB';
  return (바이트 / 1024).toFixed(0) + 'KB';
}

/* ── 저장소 이력 통째 (bundle) ─────────────────────────────────
 * bundle 은 저장소 하나를 **파일 하나**로 만든다. 되살릴 때는 그 파일에서 clone 하면 끝이고
 * 깃허브도 인터넷도 필요 없다. 여러 날짜를 쌓을 까닭이 없다 — 최신 한 벌 안에 과거가 전부 들어 있다. */
function 이력굽기(클론경로, 이름, 목적지) {
  if (!fs.existsSync(path.join(클론경로, '.git')) && !fs.existsSync(path.join(클론경로, 'HEAD'))) return null;
  const 임시 = path.join(process.env.TEMP || 'C:\\Windows\\Temp', `${이름}.bundle`);
  try {
    execFileSync('git', ['bundle', 'create', 임시, '--all'], { cwd: 클론경로, stdio: 'pipe', maxBuffer: 1 << 26 });
    const 최종 = path.join(목적지, `${이름}.bundle`);
    fs.mkdirSync(목적지, { recursive: true });
    fs.copyFileSync(임시, 최종);
    const 크기 = fs.statSync(최종).size;
    fs.unlinkSync(임시);
    return 크기;
  } catch (e) {
    try { fs.unlinkSync(임시); } catch { /* 이미 없다 */ }
    return { 오류: (e.stderr ? e.stderr.toString() : e.message).slice(0, 300) };
  }
}

/* 이 노트북에 클론이 «없는» 저장소 — 임시로 받아서 굽고 그 자리에서 지운다.
 * 🔑 폴더를 남기지 않는 것이 핵심이다: 남기면 그 클론이 낡고, 낡은 클론에서 구운 이력은
 *   「담긴 줄 알았는데 옛날 것」이 된다(이 저장소가 사본을 싫어하는 바로 그 까닭).
 * ⚠ 여기만 네트워크를 탄다. 못 받으면 «건너뛰었다»가 아니라 «실패»로 적는다 —
 *   조용히 빠지면 유호님은 담긴 줄 아신다. */
function 원격이력굽기(주소, 이름, 목적지) {
  const 임시클론 = path.join(process.env.TEMP || 'C:\\Windows\\Temp', `_${이름}_clone`);
  try { fs.rmSync(임시클론, { recursive: true, force: true }); } catch { /* 없으면 그만 */ }
  try {
    execFileSync('git', ['clone', '--quiet', '--mirror', 주소, 임시클론], { stdio: 'pipe', maxBuffer: 1 << 26 });
    const r = 이력굽기(임시클론, 이름, 목적지);
    fs.rmSync(임시클론, { recursive: true, force: true });
    return r;
  } catch (e) {
    try { fs.rmSync(임시클론, { recursive: true, force: true }); } catch { /* 이미 없다 */ }
    return { 오류: (e.stderr ? e.stderr.toString() : e.message).slice(0, 300) };
  }
}

/* ── 안내문 ─────────────────────────────────────────────
 * 이 꾸러미의 **가장 값진 파일**이다. 파일이 아무리 많아도 「무엇부터 하나」를 모르면
 * 잃은 날 아침에 못 쓴다. 그래서 클릭 단위로 적는다. */
function 먼저읽기(상태) {
  /* ⚠ 상태.이력 은 «객체»다 — 그대로 문자열에 붙이면 `[object Object]` 가 찍힌다(09-05 에 실제로 찍혔다).
   *   안내문은 잃은 날 아침에 읽는 것이라, 거기 깨진 글자가 있으면 나머지도 안 믿게 된다. */
  const 이력줄 = 상태.이력
    ? ' · 저장소 이력 ' + Object.entries(상태.이력).map(([k, v]) => `${k} ${v}`).join(' · ')
    : '';
  return `# 노트북을 잃었을 때 — 먼저 30분

> 이 파일이 만들어진 때: **${상태.만든때}**
> 담긴 것: 문서 ${상태.문서수}벌 · 확정 자산 ${상태.자산수}벌${이력줄}

## 순서 (위에서부터 그대로)

### 1. 새 컴퓨터에서 인터넷만 되면 — 바로 일할 수 있습니다
브라우저에서 **claude.ai/code** 로 갑니다 → 로그인(작업 계정 \`unmet23@gmail.com\`) →
\`+ 새로 생성\` → **\`+ 레포 선택\` 에서 둘 다 고릅니다**: \`synk-appsscript\` 와 \`synk-memory\` →
아무 말이나 겁니다.

그러면 클로드가 **기억 ${상태.기억수 || '400여'}벌을 그대로 안 채로** 대화를 시작합니다.
프로그램을 깔 것도, 파일을 옮길 것도 없습니다. **여기까지 5분입니다.**

### 2. 로그인 정보는 이 꾸러미에 없습니다 — 일부러 뺐습니다
비밀번호·열쇠는 \`C:\\Users\\q1212\\SYNK_보안\\\` 폴더에만 있었고, 클라우드에 올리지 않습니다.

되찾는 길:
- **구글 계정** — 구글이 보내는 문자로 되찾습니다. 휴대폰 번호가 그대로면 됩니다.
- **깃허브** — 구글 계정 메일(\`unmet23@gmail.com\`)로 비밀번호를 다시 정합니다.
- **나머지(텔레그램·제미나이 열쇠 등)** — 각 서비스에서 새로 발급받습니다. 옛 열쇠는 버립니다.

> 💡 **미리 해 두면 좋은 것 하나**: 그 폴더를 **비밀번호 관리 앱**(1Password·Bitwarden 같은)에
> 옮겨 두시면 이 단계가 통째로 사라집니다. 클라우드 폴더에 그냥 두는 것과 다릅니다 —
> 관리 앱은 내용을 잠가서 보관하고, 폰에서도 열립니다.

### 3. 새 컴퓨터에 제대로 차릴 때 (급하지 않습니다)
1. **깃 설치** → \`git clone git@github.com:unmet23-lab/synk-appsscript.git\`
   (열쇠가 없으면 \`https://github.com/unmet23-lab/synk-appsscript.git\` 로 받습니다)
2. **기억 붙이기** — 그 폴더 안에서 \`node tools/기억데려오기.js\`
3. **노드(Node.js) 설치** → nodejs.org 에서 LTS 판

### 4. 인터넷도 깃허브도 못 쓸 때 (마지막 길)
이 꾸러미의 \`3_저장소사본\` 폴더 안 \`.bundle\` 파일 하나로 저장소 전체가 되살아납니다:

\`\`\`
git clone synk-appsscript.bundle synk-appsscript
\`\`\`

과거 커밋까지 **전부** 들어 있습니다. 인터넷이 필요 없습니다.

---

## 이 꾸러미 안에 무엇이 있나

| 폴더 | 무엇 |
|---|---|
| \`1_문서\` | 글 전부 — 무엇을 정했나(\`docs/_ops/결정.md\`) · 무엇이 남았나(\`docs/_ops/트랙.md\`) · 설계도·철학 |
| \`2_확정자산\` | 확정된 그림·소리·글꼴. **후보와 중간판은 안 담습니다** — 「확정」의 자는 «깃이 쥐고 있는가» 하나입니다 |
| \`3_저장소사본\` | 저장소 통째(과거 이력 포함). 구글드라이브에만 둡니다 |
| \`9_상태.json\` | 이 꾸러미가 언제 · 몇 개로 만들어졌나 |

## 어디에 사본이 있나

| 곳 | 무엇이 | 계정 |
|---|---|---|
| **깃허브** | 저장소 넷(코드·기억·앱·방침) | \`unmet23-lab\` |
| **구글드라이브** \`내 드라이브/${꾸러미이름}\` | 전부 + 저장소 이력 | \`unmet23@gmail.com\` |
| **원드라이브** \`${꾸러미이름}\` | 글 위주 | \`q121235@outlook.com\` |

> ⚠ 이 셋은 **같은 계정 묶음이 아닙니다.** 구글 계정 하나가 막혀도 원드라이브와 깃허브는 삽니다.

## 이 꾸러미를 다시 굽는 법
\`\`\`
node tools/이어하기꾸러미.js          (글·자산 갱신)
node tools/이어하기꾸러미.js --저장소  (+ 저장소 이력까지 · 무겁다)
\`\`\`
`;
}

/* ── 본문 ───────────────────────────────────────────── */
function main() {
  const 인자 = process.argv.slice(2);
  const 재기만 = 인자.includes('--재기');
  const 이력도 = 인자.includes('--저장소');
  const 원드만 = 인자.includes('--원드라이브');
  const 구글만 = 인자.includes('--구글');

  const 파일들 = 추적파일();
  const 샌것 = 파일들.filter(금지인가);
  if (샌것.length) {
    console.error('🔒 멈춘다 — 담을 목록에 자격증명 무늬가 들어왔다:');
    샌것.slice(0, 10).forEach((f) => console.error('   ' + f));
    process.exit(2);
  }

  const 문서목록 = 파일들.filter(문서인가);
  const 자산목록 = 파일들.filter((p) => !문서인가(p));

  const 잰다 = (목록) => 목록.reduce((s, p) => {
    try { return s + fs.statSync(path.join(저장소, p)).size; } catch { return s; }
  }, 0);
  const 문서바이트 = 잰다(문서목록);
  const 자산바이트 = 잰다(자산목록);

  console.log(`📦 담을 것 — 글 ${문서목록.length}벌 ${사람크기(문서바이트)} · 확정 자산 ${자산목록.length}벌 ${사람크기(자산바이트)}`);

  if (재기만) {
    console.log(`   원드라이브(글만)  ≈ ${사람크기(문서바이트)}`);
    console.log(`   구글드라이브(전부) ≈ ${사람크기(문서바이트 + 자산바이트)}${이력도 ? ' + 저장소 이력 ≈ 4.8GB' : ''}`);
    console.log('   («--재기» 라 아무것도 쓰지 않았다)');
    return;
  }

  const 갈곳 = [];
  if (!구글만) 갈곳.push({ 이름: '원드라이브', 뿌리: path.join(원드라이브, 꾸러미이름), 글만: true });
  if (!원드만) 갈곳.push({ 이름: '구글드라이브', 뿌리: path.join(구글, 꾸러미이름), 글만: false });

  const 상태 = {
    만든때: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
    문서수: 문서목록.length, 자산수: 자산목록.length,
    커밋: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: 저장소 }).toString().trim(),
    곳: {},
  };

  for (const 곳 of 갈곳) {
    if (!fs.existsSync(path.dirname(곳.뿌리))) {
      console.log(`⚠ ${곳.이름} 를 못 찾았다 — 건너뛴다 (${path.dirname(곳.뿌리)})`);
      continue;
    }
    const 목록 = 곳.글만 ? 문서목록 : [...문서목록, ...자산목록];
    let 쓴것 = 0, 건너뛴것 = 0, 바이트 = 0, 오류 = 0;
    for (const 상대 of 목록) {
      const 하위 = 문서인가(상대) ? '1_문서' : '2_확정자산';
      const r = 복사(path.join(저장소, 상대), path.join(곳.뿌리, 하위, 상대));
      if (r.오류) { 오류 += 1; continue; }
      바이트 += r.바이트;
      r.건너뜀 ? (건너뛴것 += 1) : (쓴것 += 1);
    }
    상태.곳[곳.이름] = { 담음: 목록.length, 새로쓴것: 쓴것, 그대로: 건너뛴것, 크기: 사람크기(바이트), 오류 };
    console.log(`✅ ${곳.이름} — ${목록.length}벌 ${사람크기(바이트)} (새로 쓴 것 ${쓴것} · 그대로 ${건너뛴것}${오류 ? ' · 실패 ' + 오류 : ''})`);
  }

  if (이력도) {
    const 구글뿌리 = path.join(구글, 꾸러미이름);
    if (fs.existsSync(path.dirname(구글뿌리))) {
      const 이력방 = path.join(구글뿌리, '3_저장소사본');
      /* 깃허브 저장소 «넷» 전부다(2026-09-05 실측 = synk-appsscript · synk-memory ·
       * SYNK-talk · synk-policy). 앞의 셋만 담았더니 넷째가 조용히 빠졌다 —
       * 로컬 클론이 없다는 이유였는데, 그건 담지 않을 이유가 아니라 «다른 길로 담을» 이유다. */
      const 클론들 = [
        ['synk-appsscript', 저장소, null],
        ['synk-memory', path.join(process.env.USERPROFILE || 'C:\\Users\\q1212', '.claude', 'projects', 'C--Users-q1212-Documents-SYNK-appsscript', 'memory'), null],
        ['SYNK-talk', path.join(path.dirname(저장소), 'SYNK-talk'), null],
        ['synk-policy', null, 'https://github.com/unmet23-lab/synk-policy.git'],
      ];
      상태.이력 = {};
      for (const [이름, 경로, 주소] of 클론들) {
        process.stdout.write(`   📚 ${이름} 이력 굽는 중…`);
        let r = 경로 ? 이력굽기(경로, 이름, 이력방) : null;
        if (r === null && 주소) { process.stdout.write(' (원격에서 받는다)'); r = 원격이력굽기(주소, 이름, 이력방); }
        if (r === null) { console.log(' 건너뜀(클론 없고 주소도 없다)'); 상태.이력[이름] = '못담음'; continue; }
        if (r.오류) { console.log(` 실패 — ${r.오류.split('\n')[0]}`); 상태.이력[이름] = '실패'; continue; }
        console.log(` ${사람크기(r)}`);
        상태.이력[이름] = 사람크기(r);
      }
    }
  }

  for (const 곳 of 갈곳) {
    if (!fs.existsSync(곳.뿌리)) continue;
    fs.writeFileSync(path.join(곳.뿌리, '0_먼저읽기.md'), 먼저읽기(상태), 'utf8');
    fs.writeFileSync(path.join(곳.뿌리, '9_상태.json'), JSON.stringify(상태, null, 2), 'utf8');
  }
  console.log('📄 0_먼저읽기.md · 9_상태.json 갱신');
}

if (require.main === module) main();
module.exports = { 금지인가, 문서인가 };
