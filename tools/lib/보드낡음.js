/* 보드낡음 — 마감한 주인의 줄이 말하는 일감이 **이미 끝났는지**를 기계가 대조한다 (마찰 F374).
 *
 * 왜 있나 (2026-08-12 실측 · `local_d6cf3c72` 신고):
 *   보드 🎫 7건 중 **2건이 죽은 일감**이었다(`--commit c0f148aa` 재검수 · `--commit de6b34d5`
 *   재검수→배포). 둘 다 이미 나간 뒤였는데 표에서는 산 일감과 **글자 하나 다르지 않다.**
 *   `tools/board.js` 는 그걸 알고 경고까지 적어 뒀다 — 그런데 처방이 「실물을 직접 연다」라
 *   **모든 세션이 같은 확인을 다시 한다.** 7건 중 2건이면 29% 고, 이 비율에서 진짜 문제는
 *   확인 비용이 아니라 **오판**이다: 건너뛴 세션은 나간 배포를 다시 밀거나(F070) 산 일감을
 *   죽은 것으로 보고 놓친다. 철학 ㉡ 이 말하는 「누가 매번 확인하면 된다」가 정확히 이 모양이다.
 *
 * 🔑 급소 = **그 낡음은 사람 판단이 아니라 기계가 읽을 수 있는 것이었다.** board.js 의 경고문이
 *   이미 두 가지를 지목한다 — 「파일을 신설하라는 일감이면 그 파일이 이미 있는지 · 배포·검수면
 *   그 커밋이 이미 나갔는지」. 그 두 문장이 그대로 아래 세 검사다.
 *
 * ⚠ 못박아 둔 방향 셋 (F374 처방 · 어기면 이 장치가 반대로 해롭다):
 *   ① **제거가 아니라 «알림»이다.** 🎫 를 자동으로 치우는 것은 답이 아니다 — F368 이 수거
 *      조건에 「🎫 없음」을 넣은 이유고(치우면 일감이 **조용히** 사라진다), 집을지 말지는
 *      철학 ㉡ 이 사람 몫으로 남기라는 그 한 칸이다. 새는 방향이 「과잉 경고」라야 안전하다.
 *   ② **판정하지 않는다 — 「낡았다」가 아니라 「대조하라」로 쓴다.** 문구는 저장소를 못 가르고
 *      (같은 `lib/…` 가 as 에도 talk 에도 있을 수 있다) 「그 커밋이 조상이다」가 「그 일이 끝났다」는
 *      아니다. 그래서 이 파일은 **증거만** 모으고 문장은 board.js 가 짓는다.
 *   ③ **못 잰 것과 0건을 가른다**(F207). 형제 저장소가 없거나 장부를 못 읽으면 `못잼` 이지
 *      「없다」가 아니다 — 못 잰 것을 「깨끗함」으로 접으면 이 경고는 가장 필요한 날 사라진다.
 *      (F364 가 같은 자리다 — 형제 부재가 한 파일 안에서 skip 과 fail 로 갈리면 안 된다.)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const 표 = require(path.join(__dirname, '표.js'));
/* 대기 표식(`⏳`·`⏸`)의 정본은 `보드.js` 하나다 — 여기 두 줄을 다시 적으면 board-guard 의
 * 활성 상한(그쪽이 같은 기호로 분모를 가른다)과 이 알림이 갈라지고, 갈라진 쪽은 조용히 틀린다. */
const 보드 = require(path.join(__dirname, '보드.js'));
/* 「형제는 어디 있나」의 정본은 저장소에 하나다 — 경로 모양으로 짐작하던 네 벌이 갈라져
 * `.claude/worktrees/` **밖**의 워크트리에서 전부 눈이 멀었다(그 파일 머리말의 실측 표). */
const 형제저장소 = require(path.join(__dirname, '..', '..', '.claude', 'hooks', 'lib', '형제저장소.js'));

/** 상태 칸에서 **남긴 일감**만 잘라낸다 — `🎫` 나 `▶` 뒤.
 *
 * 🔑 왜 자르나 (첫 실행 실측 2026-08-12): 안 자르면 13줄 중 11줄에 「HEAD 조상 · 그 뒤 N 커밋」이
 *   붙었다. 상태 칸의 해시는 대부분 **주인이 «해낸 것»의 영수증**(`✅v1.5 5aa7d6ac`)이라 언제나
 *   조상이고 언제나 거리가 크다 — 늘 참인 경고는 경고가 아니다. 일감이 «대상으로» 삼는 해시는
 *   그 표식 뒤에 산다(`🎫다음=--commit c0f148aa 재검수`).
 *
 * ⚠ 프로즈 매칭이 아니다(F374 함정 ①) — 자르는 기준은 낱말이 아니라 이 보드가 **이미 쓰는
 *   표식**이다. 표식이 없으면 자르지 않는다(안 자르는 쪽이 과잉 경고 = 안전한 방향). */
function 일감조각(줄) {
  return 일감자르기(표.칸나누기(줄)[3] || '');
}

/** 상태 칸 **문자열**에서 자르는 알맹이 — 줄이 없는 부르는 쪽(인계문)도 같은 판정을 쓴다.
 *  갈라 두는 이유는 하나: 두 곳에 적으면 두 곳이 갈라지고, 갈린 쪽 증상은 늘 「통과」다. */
function 일감자르기(상태칸) {
  const 상태 = String(상태칸 || '');
  const i = 상태.indexOf('🎫');
  if (i >= 0) return 상태.slice(i);
  /* ▶ 는 **마지막 것**을 쓴다 — 한 칸에 「▶작업중 … ▶다음=…」 둘이 흔하고, 남긴 일감은 뒤엣것이다.
   * 앞엣것을 잡으면 그 사이의 ✅ 영수증 해시가 통째로 딸려 온다(실측 528aebb5 = 2줄 거짓 신호). */
  const j = 상태.lastIndexOf('▶');
  if (j >= 0) return 상태.slice(j);
  return 상태;
}

/** 그 일감이 **애초에 내가 집을 것이 아닌가** — `⏳`(유호님 답 대기)·`⏸`(시점 대기).
 *
 * 🔑 왜 이걸 가르나 (실측 2026-08-12): 대조 재료가 없는 줄 7건을 분류해 보니 한 덩어리가
 *   아니었다 — 2건은 **과녁이 유호님 답·외부 기관에 있는** 것이었다(상표 출원 「⏳유호=견본
 *   문자냐 로고냐」). 그건 기계가 원리상 못 재는 게 맞지만, **「내가 집을 줄이 아니다」는 잴 수
 *   있다.** 「기계가 못 가른다 7건」으로 뭉치면 다음 세션이 7줄을 다 열지만, 갈라 주면 그중
 *   둘은 «정확한 이유로» 안 열어도 된다.
 *
 * ⚠ 낱말이 아니라 이 저장소가 **이미 쓰는 표식**으로 가른다(F374 함정 ① — 프로즈 매칭 금지).
 *   `⏳`·`⏸` 는 결정 큐·보드·메모리가 공유하는 기호다. */
function 대기표식(일감) {
  const t = String(일감 || '');
  for (const [기호, 뜻] of Object.entries(보드.대기기호())) if (t.includes(기호)) return 뜻;
  return null;
}

/** 트랙 이름 칸 — 「무엇을 짓는 트랙인가」가 여기 적힌다(`**G1 … `lib/멘탈게이지.js` 신설**`).
 *
 * 🔑 「만지는 파일」 칸(칸[2])은 **어느 축에도 안 쓴다.** 거기 적힌 경로는 주인이 「내가 이걸
 *   건드린다」고 선언한 자리라 실재하는 것이 정상이다 — 넣으면 모든 줄에 「이미 있다」가 붙고,
 *   전부 참인 경고는 안 읽힌다. 그래서 이 파일에 그 칸을 읽는 함수는 하나도 없다. */
function 트랙텍스트(줄) {
  return 표.칸나누기(줄)[1] || '';
}

/** 백틱 안의 토큰만 본다 — 산문에서 주운 낱말은 경로도 해시도 아니다. */
function 백틱토큰들(text) {
  const out = [];
  for (const m of String(text).matchAll(/`([^`]+)`/g)) out.push(m[1].trim());
  return out;
}

/** 🎫 가 말하는 **파일 경로**.
 *  ⚠ 홑이름(`board.js`)은 안 센다 — 어느 저장소인지 못 가르고, 못 가르면 남의 저장소 파일로
 *    「이미 있다」를 낼 수 있다. 묶음 표기(`tools/{a,b}.js`)·글롭도 뺀다(펴는 순간 추측이 된다). */
function 경로들(text) {
  const out = new Set();
  for (const t of 백틱토큰들(text)) {
    if (/[{}*\s]/.test(t)) continue;
    if (!t.includes('/')) continue;
    if (!/\.(js|json|md|sql|ts|tsx|html|ya?ml)$/.test(t)) continue;
    out.add(t.replace(/^\.\//, ''));
  }
  return [...out];
}

/** 🎫 가 말하는 **커밋 해시**.
 *  ⚠ `local_c52dcbed` 같은 **세션 지문**을 해시로 세면 안 된다 — 앞이 `_` 면 버린다.
 *    (지문이 우연히 커밋으로도 풀릴 일은 거의 없지만, 「거의」로 두면 언젠가 그날이 온다.) */
function 해시들(text) {
  const out = new Set();
  for (const t of 백틱토큰들(text)) {
    for (const m of t.matchAll(/(?:^|[^0-9a-z_])([0-9a-f]{7,40})(?![0-9a-z])/gi)) out.add(m[1].toLowerCase());
  }
  return [...out];
}

/** 대조할 저장소들. 형제가 없으면 **목록에서 빠진다** — 부재는 「없다」가 아니라 `못잼` 이다.
 *
 * 🔑 `as` 는 **워크트리 그대로** 둔다 — 그 세션이 지금 고치는 판이 거기다. 주저장소로 밀면
 *   아직 커밋 안 된 새 파일이 「어디에도 없다」로 적색이 된다(고치려던 것보다 나쁜 방향).
 *   갈라지는 건 형제 쪽뿐이라 그 한 축만 `형제저장소` 통로에 맡긴다.
 * ⚠ 존재 판정은 여기 남는다 — 이 축이 묻는 것은 「디렉터리로 열리나」다(저장소인지까지는 안 본다).
 *   통로가 답하는 것은 **자리**뿐이다(그 파일 머리말 ⚠). */
function 저장소들(root) {
  const as = path.resolve(String(root || '.'));
  const 형제 = 형제저장소.형제경로(as);
  const out = [{ 이름: 'as', 뿌리: as }];
  let 있나 = false;
  try { 있나 = fs.statSync(형제).isDirectory(); } catch (_) { 있나 = false; }
  if (있나) out.push({ 이름: 'talk', 뿌리: 형제 });
  return { 목록: out, 형제있음: 있나 };
}

/** 검수 장부에 이미 오른 커밋들. 못 읽으면 `null`(「한 건도 없다」와 다르다 · F207). */
function 검수된커밋들(root) {
  const p = path.join(String(root || '.'), 'docs', '_ops', '검수기록.jsonl');
  let txt;
  try { txt = fs.readFileSync(p, 'utf8'); } catch (_) { return null; }
  const out = new Set();
  for (const line of txt.split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    let rec;
    try { rec = JSON.parse(l); } catch (_) { continue; }
    const 대상 = rec && rec.대상;
    if (!대상 || 대상.종류 !== 'commit') continue;
    const v = String(대상.값 || '').trim().toLowerCase();
    if (/^[0-9a-f]{7,40}$/.test(v)) out.add(v);
  }
  return out;
}

/** 두 해시가 같은 커밋을 가리키나 — 짧은 쪽 길이로 앞을 맞춘다(장부는 8자리, 줄은 40자리일 수 있다). */
function 앞맞춤(a, b) {
  const n = Math.min(a.length, b.length);
  return n >= 7 && a.slice(0, n) === b.slice(0, n);
}

/** git 한 번. 실패는 **예외가 아니라 null** — 이 도구는 git 이 없거나 워크트리가 이상해도
 *  보드를 못 내면 안 된다(장치가 스스로 죽으면 그날은 아무도 대조하지 못한다). */
function git(뿌리, args) {
  try {
    return String(execFileSync('git', args, { cwd: 뿌리, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })).trim();
  } catch (_) {
    return null;
  }
}

/** 그 해시가 이 저장소에 있고 HEAD 조상인가 · HEAD 까지 몇 커밋인가. */
function 커밋조회(뿌리, 해시) {
  if (git(뿌리, ['rev-parse', '--verify', '--quiet', `${해시}^{commit}`]) === null) return null;
  /* HEAD 자체를 못 읽으면 「조상 아님」이 아니라 **못 쟀다**다 — 둘을 뭉치면 갓 만든
   * 저장소·분리 헤드에서 「아직 안 합류」라는 **거짓 초록**이 나온다(F207). */
  if (git(뿌리, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']) === null) return { 조상: null, 거리: null };
  const 조상 = git(뿌리, ['merge-base', '--is-ancestor', 해시, 'HEAD']) !== null;
  const 거리 = 조상 ? Number(git(뿌리, ['rev-list', '--count', `${해시}..HEAD`])) : null;
  return { 조상, 거리: Number.isFinite(거리) ? 거리 : null };
}

/**
 * 한 줄의 낡음 **증거**를 모은다 — 판정은 안 한다(머리말 ⚠②).
 *
 * @returns {{경로: {실재: Array, 없음: Array, 못잼: Array}, 커밋: Array, 잰것: boolean}}
 */
function 증거(줄, root, 캐시) {
  return 증거칸(트랙텍스트(줄), 표.칸나누기(줄)[3] || '', root, 캐시);
}

/** 칸을 **이미 갈라 든** 부르는 쪽(인계문 `boardTrack`)을 위한 같은 판정.
 *  줄을 되조립해 넘기게 하면 그 조립이 두 번째 파서가 된다 — 그 자리가 이 저장소의 단골 결함이다. */
function 증거칸(트랙칸, 상태칸, root, 캐시) {
  /* 두 축을 갈라 읽는다 — **경로**는 트랙 이름에도 적히고(짓는 트랙의 산출물이 거기 있다),
   * **해시**는 남긴 일감 조각에서만 센다(그 밖의 해시는 영수증이다 · `일감자르기` 머리말). */
  const 일감 = 일감자르기(상태칸);
  const text = `${트랙칸 || ''} ${일감}`;
  const 저 = (캐시 && 캐시.저장소) || 저장소들(root);
  const 검수 = 캐시 && Object.prototype.hasOwnProperty.call(캐시, '검수') ? 캐시.검수 : 검수된커밋들(root);

  const 경로 = { 실재: [], 없음: [], 못잼: [] };
  for (const p of 경로들(text)) {
    /* `SYNK-talk/lib/x.js` 처럼 저장소를 **적어 준** 경로는 그 저장소에서만 찾는다. */
    const 접두 = p.match(/^SYNK-(talk|appsscript)\//);
    const 상대 = 접두 ? p.slice(접두[0].length) : p;
    const 후보 = 접두
      ? 저.목록.filter((r) => r.이름 === (접두[1] === 'talk' ? 'talk' : 'as'))
      : 저.목록;
    let 찾음 = null;
    for (const r of 후보) {
      try { if (fs.existsSync(path.join(r.뿌리, 상대))) { 찾음 = r.이름; break; } } catch (_) { /* 계속 */ }
    }
    if (찾음) 경로.실재.push({ 경로: p, 저장소: 찾음 });
    else if (!저.형제있음 && !접두) 경로.못잼.push({ 경로: p, 사유: '형제 저장소(SYNK-talk)가 없다' });
    else if (접두 && 접두[1] === 'talk' && !저.형제있음) 경로.못잼.push({ 경로: p, 사유: '형제 저장소(SYNK-talk)가 없다' });
    else 경로.없음.push({ 경로: p });
  }

  const 커밋 = [];
  for (const h of 해시들(일감)) {
    let 찾음 = null;
    for (const r of 저.목록) {
      const got = 커밋조회(r.뿌리, h);
      if (got) { 찾음 = { ...got, 저장소: r.이름 }; break; }
    }
    /* 저장소 어디에도 없는 16진 토큰은 **커밋이 아니다**(세션 지문·해시 조각) — 조용히 뺀다.
     * 여기서 「못 찾음」을 증거로 내면 지문 하나마다 경고가 붙어 진짜 신호가 묻힌다. */
    if (!찾음) continue;
    const 검수됨 = 검수 === null ? null : [...검수].some((v) => 앞맞춤(v, h));
    커밋.push({ 해시: h, ...찾음, 검수됨 });
  }

  const 잰것 = !!(경로.실재.length || 경로.없음.length || 경로.못잼.length || 커밋.length);
  /* 대기 표식은 **재료가 없을 때만** 쓴다 — 경로·커밋을 이미 잰 줄에까지 붙이면 「대조하라」와
   * 「집지 마라」가 한 줄에서 싸운다. 갈라야 할 것은 «잴 수 있었던 줄»이 아니라 나머지다. */
  return { 경로, 커밋, 잰것, 대기: 잰것 ? null : 대기표식(일감) };
}

/** 증거를 **사람이 읽는 짧은 줄**로. 판정어(「낡았다」)는 쓰지 않는다 — 전부 「대조하라」다. */
function 말들(ev) {
  const out = [];
  if (ev.경로.실재.length) {
    const 목록 = ev.경로.실재.map((r) => `${r.경로}(${r.저장소})`).join(' · ');
    out.push(`경로 ${ev.경로.실재.length}개가 **이미 실재**한다 — 신설 일감이면 대조하라: ${목록}`);
  }
  if (ev.경로.없음.length) {
    out.push(`경로 ${ev.경로.없음.length}개는 아직 없다: ${ev.경로.없음.map((r) => r.경로).join(' · ')}`);
  }
  for (const r of ev.경로.못잼) out.push(`경로 «못 쟀다»(0건이 아니다) — ${r.경로}: ${r.사유}`);
  for (const c of ev.커밋) {
    const 조각 = [];
    if (c.조상 === null) 조각.push('HEAD 를 «못 읽어» 합류 여부를 못 쟀다');
    else if (c.조상) 조각.push(`HEAD 조상 · 그 뒤 ${c.거리 === null ? '?' : c.거리} 커밋`);
    else 조각.push('HEAD 조상 아님(아직 안 합류)');
    if (c.검수됨 === true) 조각.push('**검수 장부에 이미 있다**');
    else if (c.검수됨 === null) 조각.push('검수 장부 «못 읽음»');
    out.push(`\`${c.해시}\`(${c.저장소}) — ${조각.join(' · ')}`);
  }
  return out;
}

/** 여러 줄을 한 번에 — 저장소 목록·검수 장부는 **한 번만** 읽는다(줄마다 읽으면 느리고 갈라진다). */
function 줄별증거(줄들, root) {
  const 캐시 = { 저장소: 저장소들(root), 검수: 검수된커밋들(root) };
  return 줄들.map((줄) => ({ 줄, 증거: 증거(줄, root, 캐시) }));
}

module.exports = {
  일감조각, 일감자르기, 트랙텍스트, 대기표식, 경로들, 해시들, 저장소들, 검수된커밋들,
  증거, 증거칸, 말들, 줄별증거,
};
