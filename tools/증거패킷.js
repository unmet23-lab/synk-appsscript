#!/usr/bin/env node
/**
 * 증거 패킷 — 유호님께 「적용할까요?」를 물을 때 딸려 가는 7항목을 자동 조립한다.
 *
 * 왜 있나 — 유호님이 기술 문서 여러 개를 조립해서 판단하실 필요가 없어야 한다
 *   (CLAUDE.md 「판단 재료의 단위도 유호님이 직접 셀 수 있는 것으로 환산한다」).
 *   7항목 중 6개는 git·gh·장부에서 그냥 나온다. 사람이 쓰는 건 ③ 한 줄뿐이다.
 *
 *   node tools/증거패킷.js <sha> [--env 개발|운영] [--영향 "한 줄"]
 *
 * ⚠ 이 도구는 **읽기만** 한다 — 배포도 승인도 하지 않는다.
 *
 * ── 「못 읽음」과 「0」을 가른다 (F543·F604 계보 · 2026-08-18 `local_163e0921`) ──────
 *
 * ■ 무엇이 샜나 — 이 파일의 세 자리가 **관측 실패를 측정된 0으로 접었다.**
 *   · ⑤ `gh` 출력이 JSON 이 아니면 `catch {}` 가 삼켜 `runs=[]` 이 되고, 그 빈 배열이
 *     「이 SHA 로 등록된 run 0건」으로 인쇄됐다. 실측(08-18): `JSON.parse('not-json')` →
 *     runs.length 0 → 그 문구. 유호님은 「CI 가 안 돌았구나」로 읽는데 실제는 「못 읽었다」다.
 *   · ④ 마찰 장부 줄 수는 `friction.js` 의 **사람용 출력**을 정규식으로 긁는다. 그 문구가
 *     바뀌면 `if (m)` 이 조용히 거짓이 되어 항목이 통째로 빠진다(그 파일 :48~50 이 스스로
 *     「이 넷이 조용히 갈라진다」고 경고해 둔 그 자리다 — 증거패킷이 그 넷 중 하나다).
 *   · ④ `승인.js` 가 없거나 죽으면 `if (s.out)` 이 거짓이라 역시 조용히 빠진다.
 *   그리고 셋 다 빠진 판의 마지막 줄이 「(기계가 세는 잔여 항목 0)」이다 —
 *   **아무것도 못 잰 판과 진짜로 0인 판이 같은 글자로 나온다.** 새는 방향이 「통과」다(맹점 ④).
 *
 * ■ 그래서 바꾼 것 — 판정을 «관측 목록 → 순수 함수» 로 떼고 **분모를 필수 칸으로** 만들었다
 *   (F543 처방 ㉠ 의 모양). `run판정`·`잔여판정` 은 git·gh 를 모르고 문자열만 받는다 —
 *   그래서 픽스처가 탐지력을 지고(맹점 ②), 실저장소가 멀쩡해도 회귀가 눈멀지 않는다.
 *   인쇄층은 `잰것/전체` 를 항상 찍고, 못 잰 항목은 **이름을 대서** 드러낸다(F207).
 *
 * ■ 대가 (틀릴 때의 모습) — 이제 ④⑤ 에 ⚠ 줄이 늘 수 있다. 그 ⚠ 가 잦아지면 사람이 눈을
 *   감게 되고(경보 피로), 그때 이 장치는 옛 침묵과 같아진다. 그래서 ⚠ 는 **못 잰 자리에만**
 *   달고 정상 관측에는 한 글자도 안 붙인다 — 잦아지면 그건 도구가 아니라 환경이 깨진 신호다.
 * ■ 닫은 것 1개 — `실행()` 이 종료코드를 버려서 「일치 0」(git grep exit 1)과 「못 봤다」(exit ≥2·
 *   ENOENT)가 한 값이었다. 이제 `코드` 를 들고 나온다.
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/** 얇은 실행층 — 판정이 없다. `코드` 는 종료 상태(못 띄웠으면 `null`).
 *  🔑 `코드` 를 버리면 「일치 0」과 「못 봤다」가 같은 `ok:false` 로 뭉친다 — 그게 옛 구멍이다. */
const 실행 = (cmd, args) => {
  try {
    const out = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return { ok: true, out: out.trim(), 코드: 0 };
  } catch (e) {
    const 없음 = e.code === 'ENOENT';
    return {
      ok: false,
      out: typeof e.stdout === 'string' ? e.stdout.trim() : '',
      코드: 없음 || typeof e.status !== 'number' ? null : e.status,
      오류: 없음 ? `${cmd} 없음` : (e.message || '').split('\n')[0],
    };
  }
};
// ⚠ `-c core.quotepath=false` 없이는 한글 경로가 `\354\235\270…` 로 나온다 —
//    유호님이 읽어야 하는 패킷에서 파일 이름이 사라지면 ②가 판단 재료가 못 된다.
//    repo 설정은 건드리지 않는다(다른 도구·CI가 그 설정에 얹혀 있다) — 호출마다 끈다.
const git = (...args) => 실행('git', ['-c', 'core.quotepath=false', ...args]);

/** JSON 을 「읽었나」와 「무엇을 읽었나」로 갈라 낸다 — 빈 배열과 파싱 실패는 **다른 값**이다. */
function json읽기(원문) {
  if (typeof 원문 !== 'string') return { 읽음: false, 값: [], 사유: '출력이 없다' };
  const s = 원문.trim();
  if (!s) return { 읽음: false, 값: [], 사유: '빈 출력' };
  let v;
  try { v = JSON.parse(s); } catch (e) { return { 읽음: false, 값: [], 사유: `JSON 아님 — ${s.slice(0, 60)}` }; }
  if (!Array.isArray(v)) return { 읽음: false, 값: [], 사유: `배열이 아니다 — ${typeof v}` };
  return { 읽음: true, 값: v, 사유: null };
}

/**
 * ⑤ 층의 **순수 판정** — gh 를 모른다. 문자열(또는 `null` = 못 띄웠다)만 받는다.
 * @param {{ok:boolean, out:string, 오류?:string}|null} 이커밋 `gh run list --commit <sha>` 의 결과
 * @param {{ok:boolean, out:string}|null} 최신 그 커밋에 run 이 0건일 때만 보는 대체 조회
 * @returns {{층:string, 줄:string[], 못잼:boolean}} `못잼` 이면 ⑤ 는 **판정이 아니다**
 */
function run판정(이커밋, 최신) {
  if (!이커밋 || !이커밋.ok) {
    return {
      층: '원격 미확인',
      줄: [`⚠ ${(이커밋 && 이커밋.오류) || 'gh 를 못 불렀다'} — 로컬 초록은 CI 초록이 아니다(직접 확인 필요)`],
      못잼: true,
    };
  }
  const r = json읽기(이커밋.out);
  /* 🔴 옛 판은 여기서 `[]` 로 접고 「run 0건」을 찍었다 — 못 읽은 판과 진짜 0건이 한 글자였다. */
  if (!r.읽음) {
    return {
      층: '원격 응답을 못 읽었다',
      줄: [`⚠ gh 출력을 해석 못 했다(${r.사유}) — **0건이 아니라 미측정이다.**`,
        '   직접 확인: gh run list --commit <sha>'],
      못잼: true,
    };
  }
  if (r.값.length) {
    return {
      층: `원격 run ${r.값.length}건`,
      줄: r.값.map((x) => `${x.conclusion === 'success' ? '✅' : '🔴'} ${x.conclusion || x.status} · ${x.workflowName} · ${x.url}`),
      못잼: false,
    };
  }
  // 내 커밋엔 run 이 없을 수 있다 — 바로 뒤 push 에 밀린다(CLAUDE.md)
  if (!최신 || !최신.ok) {
    return {
      층: '이 SHA 로 등록된 run 0건',
      줄: ['⚠ 뒤 push 에 밀렸을 수 있는데, **대체 조회도 못 돌렸다** — 이 0 은 재서 얻은 0이 아니다.'],
      못잼: true,
    };
  }
  const 뒤 = json읽기(최신.out);
  if (!뒤.읽음) {
    return {
      층: '이 SHA 로 등록된 run 0건',
      줄: [`⚠ 뒤 push 에 밀렸을 수 있는데, 대체 조회 출력을 해석 못 했다(${뒤.사유}) — 미측정이다.`],
      못잼: true,
    };
  }
  return {
    층: `이 SHA 로 등록된 run 0건 (재서 얻은 0 · 최신 ${뒤.값.length}건 대조)`,
    줄: ['⚠ 뒤 push 에 밀렸을 수 있다 — 이 커밋을 담은 최신 run 을 대신 본다:',
      ...뒤.값.map((x) => `   ${x.conclusion || '진행중'} · ${x.workflowName} · ${(x.headSha || '').slice(0, 8)} · ${x.url}`)],
    못잼: false,
  };
}

/**
 * ④ 층의 **순수 판정** — fs·git 을 모른다.
 * @param {{마찰:object|null, 동결:object|null, 승인:object|null}} 관측 각 탐침의 결과(`null` = 안 돌렸다)
 * @returns {{줄:string[], 잰것:number, 전체:number, 못잼:string[]}} 분모가 **필수 칸**이다(F543 ㉠)
 */
function 잔여판정(관측) {
  const o = 관측 || {};
  const 줄 = [];
  const 못잼 = [];
  const 전체 = 3;                                   // 마찰 장부 · failed_p0 동결 표식 · 승인 큐
  let 잰것 = 0;

  // ㉠ 마찰 장부 — `friction.js` 의 사람용 출력을 긁는다(그 문구가 바뀌면 여기가 먼저 눈이 먼다)
  const f = o.마찰;
  if (!f || !f.ok) {
    못잼.push(`마찰 장부(${(f && f.오류) || '안 돌렸다'})`);
  } else {
    const m = /살아있음\s+(\d+)/.exec(f.out || '');
    if (m) { 잰것 += 1; 줄.push(`마찰 장부 열린 항목 ${m[1]}건 (전체 목록: node tools/friction.js)`); }
    else 못잼.push('마찰 장부(출력에서 「살아있음 N」을 못 찾았다 — friction.js 문구가 바뀌었나)');
  }

  // ㉡ 문서에 박힌 동결 표식 — 「구현하지 마라」가 살아 있는데 배포하면 안 된다.
  //    장부·보드는 P0 를 **기록하는** 자리라 언제나 걸린다 → 빼야 신호가 산다(거짓 경보는 곧 꺼진다).
  //    🔑 git grep 은 «일치 없음»이 종료코드 1 이다 — 그건 재서 얻은 0이고, 2 이상·ENOENT 만 「못 봤다」다.
  const g = o.동결;
  const 기록처 = /마찰신호|세션보드|_ops/;
  if (!g || (!g.ok && g.코드 !== 1)) {
    못잼.push(`failed_p0 동결 표식(${(g && g.오류) || '안 돌렸다'})`);
  } else {
    잰것 += 1;
    const 걸림 = (g.ok ? String(g.out || '').split('\n') : []).filter((p) => p && !기록처.test(p));
    if (걸림.length) 줄.push(`⛔ failed_p0 동결 표식이 살아 있는 문서: ${걸림.join(' · ')}`);
  }

  // ㉢ 승인 큐
  const s = o.승인;
  if (!s || !s.ok) {
    못잼.push(`승인 큐(${(s && s.오류) || '안 돌렸다'})`);
  } else {
    잰것 += 1;
    if (s.out) 줄.push(...String(s.out).split('\n').filter(Boolean).map((l) => `  ${l}`));
  }

  /* 🔑 「0」이라고 **말할 자격**은 셋을 다 잰 판에만 있다. 하나라도 못 쟀으면 그 0 은 미측정이다. */
  if (!줄.length) {
    줄.push(잰것 === 전체
      ? '(기계가 세는 잔여 항목 0 — 셋 다 재서 얻은 0이다 · 사람이 아는 것은 ③에 적는다)'
      : '⚠ 잔여 항목을 **못 셌다** — 아래 「못 잰 것」을 먼저 푼다(이 빈칸은 0이 아니다)');
  }
  if (못잼.length) 줄.push(`⚠ 못 잰 것 ${못잼.length}/${전체}: ${못잼.join(' · ')}`);
  return { 줄, 잰것, 전체, 못잼 };
}

/** ⑤ 실행층 — 얇다(판정은 `run판정`). `주입` 은 회귀 주입구. */
function 테스트결과(sha, 주입) {
  const 돌리기 = (주입 && 주입.실행) || 실행;
  const 이커밋 = 돌리기('gh', ['run', 'list', '--commit', sha, '--limit', '5',
    '--json', 'conclusion,status,workflowName,url']);
  const r = json읽기(이커밋 && 이커밋.ok ? 이커밋.out : null);
  // 대체 조회는 **진짜 0건일 때만** 돈다 — 못 읽은 판에서 부르면 그 실패까지 0으로 접힌다.
  const 최신 = (이커밋 && 이커밋.ok && r.읽음 && !r.값.length)
    ? 돌리기('gh', ['run', 'list', '--limit', '3', '--json', 'conclusion,workflowName,headSha,url'])
    : null;
  return run판정(이커밋, 최신);
}

/** ④ 실행층 — 얇다(판정은 `잔여판정`). 반환은 **줄 배열**이라 옛 호출부와 모양이 같다. */
function 잔여(cwd, 주입) {
  const 돌리기 = (주입 && 주입.실행) || 실행;
  const 있나 = (주입 && 주입.있나) || fs.existsSync;
  const 장부 = path.join(cwd, 'tools', 'friction.js');
  const 관측 = {
    마찰: 있나(장부) ? 돌리기('node', [장부]) : { ok: false, out: '', 코드: null, 오류: 'tools/friction.js 없음' },
    동결: 돌리기('git', ['-c', 'core.quotepath=false', 'grep', '-l', '-e', 'failed_p0', '--', 'docs', '계약']),
    승인: 돌리기('node', [path.join(cwd, 'tools', '승인.js'), 'check']),
  };
  return 잔여판정(관측).줄;
}

function 패킷(sha, 환경, 영향) {
  const cwd = process.cwd();
  const 정보 = git('show', '-s', '--format=%H%n%s%n%an%n%ad', '--date=iso', sha);
  if (!정보.ok) { console.error(`[증거패킷] ${sha} 를 찾을 수 없다`); process.exit(1); }
  const [full, 제목, 작성자, 시각] = 정보.out.split('\n');
  const stat = git('show', '--stat', '--format=', full).out;
  const 테스트 = 테스트결과(full);

  console.log(`# 적용 승인 요청 — ${제목}\n`);
  console.log(`**① 적용할 커밋**  \`${full.slice(0, 10)}\` · ${작성자} · ${시각}\n`);
  console.log('**② 변경되는 것**\n```');
  console.log(stat || '(변경 없음)');
  console.log('```\n');
  console.log(`**③ 학생·운영자에게 미치는 영향**  ${영향 || '⚠ 아직 안 적음 — 이 한 줄은 사람이 쓴다(자동 조립 불가)'}\n`);
  const 남음 = 잔여판정({
    마찰: fs.existsSync(path.join(cwd, 'tools', 'friction.js')) ? 실행('node', [path.join(cwd, 'tools', 'friction.js')]) : { ok: false, 오류: 'tools/friction.js 없음' },
    동결: git('grep', '-l', '-e', 'failed_p0', '--', 'docs', '계약'),
    승인: 실행('node', [path.join(cwd, 'tools', '승인.js'), 'check']),
  });
  console.log(`**④ 남은 P0/P1/P2** (잰 것 ${남음.잰것}/${남음.전체})`);
  console.log(남음.줄.map((l) => `- ${l}`).join('\n') + '\n');
  console.log(`**⑤ 실행한 테스트와 결과** (${테스트.층})`);
  console.log(테스트.줄.map((l) => `- ${l}`).join('\n') + '\n');
  console.log(`**⑥ 적용 환경**  ${환경 || '⚠ 미지정 — `--env` 로 못박는다'}\n`);
  console.log('**⑦ 실패 시 롤백**');
  console.log(`- \`git revert ${full.slice(0, 10)}\` (되돌림 커밋이 남는다 — reset 은 남의 이력을 지운다)`);
  console.log(`- 직전 상태 = \`${git('rev-parse', '--short', `${full}^`).out || '(첫 커밋)'}\`\n`);
  console.log('---');
  /* 🔑 못 잰 칸이 있으면 «묻기 전에» 말한다 — 유호님이 미측정을 「이상 없음」으로 읽으면
   *   이 도구의 존재 이유(판단 재료)가 거꾸로 선다. */
  if (남음.못잼.length || 테스트.못잼) {
    console.log(`⚠ **이 패킷은 완전하지 않다** — 못 잰 칸: ${[...남음.못잼, ...(테스트.못잼 ? [`⑤ ${테스트.층}`] : [])].join(' · ')}\n`);
  }
  console.log(`**${환경 || '(환경 미지정)'} 에 \`${full.slice(0, 10)}\` 을 적용할까요?**`);
}

/** 인자에서 sha 를 고른다 — 플래그 값으로 먹힌 자리는 뺀다.
 *
 * 🔑 옛 판은 `argv.indexOf(a) - 1` 로 앞칸을 봤다. `indexOf` 는 **첫 자리**를 주므로 같은 문자열이
 *   두 번 나오면 앞칸을 엉뚱한 곳에서 읽는다 — `--env 운영 운영` 이면 sha 가 `운영` 으로 잡혔다.
 *   `find` 가 주는 실제 인덱스 `i` 를 쓰면 그 갈래가 없어진다(회귀 `tests/증거패킷.test.js`). */
function sha고르기(argv) {
  const 값플래그 = ['--env', '--영향'];
  return (argv || []).find((a, i) => !String(a).startsWith('--') && !값플래그.includes(argv[i - 1])) || null;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const 값 = (플래그) => { const i = argv.indexOf(플래그); return i >= 0 ? argv[i + 1] : null; };
  const sha = sha고르기(argv);
  if (!sha) { console.error('사용법: 증거패킷.js <sha> [--env 개발|운영] [--영향 "한 줄"]'); process.exit(1); }
  패킷(sha, 값('--env'), 값('--영향'));
}

module.exports = { 잔여, 테스트결과, 잔여판정, run판정, json읽기, sha고르기 };
