#!/usr/bin/env node
'use strict';
/* L0 대조표 점검 — **시트 헤더가 자란 뒤 형제 저장소의 대조표가 따라왔는가.**
 *
 * ■ 왜 있나 (2026-09-01 · 유호 지시 「⑦ 재료 정리」 → 갈래 ⓒ)
 *   형제 저장소 `SYNK-talk/docs/L0_데이터계약.md` §5 가 「라이브 필드 ↔ L0 대조」 표를 쥔다 —
 *   이관 어댑터가 «무엇을 무엇으로 옮기나»를 읽을 유일한 자리다. 그런데 그 표의 `voice_log` 행이
 *   **12칸 시절 것**이었다: 그 뒤 실물이 세 번 자랐는데(v9.277 여섯 칸 · v9.278 미션 시트 ·
 *   v9.289 사건 원장 둘) **표는 한 번도 안 따라왔다.**
 *   🔑 세 판을 놓친 방식이 「나중에 한 번에」였다. 그래서 자를 세운다 — 사람 기억에 안 걸리게.
 *
 * ■ 이 자가 «판정하지 않는» 것
 *   🚫 **「표가 낡았다」고 단정하지 않는다.** 어느 칸이 L0 로 가야 하는지는 판정이고, 운영 축 칸은
 *      표에 없어도 정상이다. 이 자가 말하는 것은 **「실물이 바뀌었는데 표는 그대로다 — 사람이
 *      한 번 봐야 한다」**까지다.
 *   🚫 형제 저장소를 **고치지 않는다.** 정본은 그쪽이고, 이쪽 세션이 고치면 두 곳이 갈린다.
 *
 * ■ 재는 법 — 「도장 뒤 바뀜」(몽골어 검문·심문 드리프트와 같은 꼴)
 *   ① 이 저장소: §5 표가 덮는 시트들의 **헤더 상수 지문**
 *   ② 형제 저장소: **§5 절의 지문**
 *   ③ 도장(`docs/_ops/L0대조도장.json`)에 그 둘을 함께 박는다.
 *   ⇒ ①이 바뀌었는데 ②가 그대로면 운다. 둘 다 바뀌었으면 사람이 이미 손댄 것이므로 조용하다.
 *
 * 사용:
 *   node tools/L0대조점검.js              # 지금 상태
 *   node tools/L0대조점검.js --도장 --사유 "왜 지금 맞다고 보나"   # 「지금 맞다」 선언
 *   node tools/L0대조점검.js --json
 * 종료: 0=정상/알림 · 1=자가 못 돌았다(«확인 불가»이지 「정상」이 아니다)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.env.SYNK_L0_ROOT || path.resolve(__dirname, '..');
/* 형제 자리는 «경로 모양»으로 짐작하지 않는다(워크트리 규약 §8-3) — 워크트리 안에서는 `ROOT/..` 가
 * `.claude/worktrees/` 라 형제가 없고, 그 실패가 「대조표를 못 읽었다」로 빨개졌다(09-02 실측 · 메인에선 초록).
 * `.claude/hooks/lib/형제저장소.js` 가 주저장소를 풀어 답한다(의존 방향 tools/ → hooks/lib · 그 파일 머리말). env 는 그대로 앞선다.
 * ⚠ 헬퍼는 **이 도구의 집**(`__dirname/..`)에서 가져온다 — ROOT 는 회귀가 임시 픽스처로 바꿔 끼우는 값이라 거기엔 훅 lib 가 없다.
 *   픽스처(git 아님)에서는 헬퍼가 root 를 그대로 돌려줘 옛 모양 `<root>/../SYNK-talk` 과 같다(회귀 5벌이 그 위에 선다). */
const 형제저장소 = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', '형제저장소.js'));
const 형제 = () => process.env.SYNK_TALK_ROOT || 형제저장소.형제경로(ROOT);
const L0경로 = () => path.join(형제(), 'docs', 'L0_데이터계약.md');
const 도장경로 = () => process.env.SYNK_L0_STAMP || path.join(ROOT, 'docs', '_ops', 'L0대조도장.json');

/* §5 표가 덮는 시트와 이 저장소의 헤더 상수. **손 목록이라 갈릴 수 있다** — 그래서 아래
 * `표에없는시트()` 가 표를 읽어 이 목록 밖의 시트 이름이 표에 있으면 알린다(한쪽만 자라는 것도 잡는다). */
const 대상 = [
  ['voice_log', '엔진_셋업확장.js', 'VOICE_LOG_HEADERS'],
  ['hw_feedback', '엔진_수집.js', 'HW_FEEDBACK_HEADERS'],
  ['quiz_log', '엔진_수집.js', 'QUIZ_LOG_HEADERS'],
  ['talk_log', '엔진_수집.js', 'TALK_LOG_HEADERS'],
  ['gold', '엔진_수집.js', 'GOLD_HEADERS'],
];

const 지문 = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex').slice(0, 12);
/** 줄끝을 고른다 — 작업본 CRLF 와 git LF 가 다르면 같은 글이 다른 지문을 낸다. */
const 고른글 = (s) => String(s).replace(/\r\n/g, '\n');

/** 헤더 상수 선언 «전문»(여러 줄 배열도 받는다). @returns {string|null} */
function 헤더소스(파일, 이름) {
  let src;
  try { src = 고른글(fs.readFileSync(path.join(ROOT, 파일), 'utf8')); }
  catch (_) { return null; }
  const i = src.indexOf(`const ${이름} =`);
  if (i < 0) return null;
  const end = src.indexOf('];', i);
  return end > i ? src.slice(i, end + 2) : null;
}

/** L0 §5 절 전문. @returns {{글:string}|{못읽음:string}} */
function 대조절() {
  let md;
  try { md = 고른글(fs.readFileSync(L0경로(), 'utf8')); }
  catch (e) { return { 못읽음: `형제 저장소 L0 를 못 읽었다 — ${L0경로()}` }; }
  const i = md.indexOf('## 5. 라이브 필드');
  if (i < 0) return { 못읽음: 'L0 에서 §5 「라이브 필드 ↔ L0 대조」 절을 못 찾았다 — 절 제목이 바뀌었으면 이 자부터 고친다' };
  const j = md.indexOf('\n## ', i + 4);
  return { 글: md.slice(i, j > i ? j : undefined) };
}

function 도장읽기() {
  try { return JSON.parse(fs.readFileSync(도장경로(), 'utf8')); } catch (_) { return null; }
}

function 재다() {
  const 절 = 대조절();
  if (절.못읽음) return { 못잼: 절.못읽음 };

  const 헤더들 = [];
  const 빠진상수 = [];
  for (const [시트, 파일, 이름] of 대상) {
    const s = 헤더소스(파일, 이름);
    if (s == null) { 빠진상수.push(`${이름}(${파일})`); continue; }
    헤더들.push(`${시트} :: ${s}`);
  }
  // 상수를 못 찾으면 지문이 «조용히» 달라진다 — 그건 못 잰 것이지 「안 바뀐 것」이 아니다.
  if (빠진상수.length) return { 못잼: `헤더 상수를 못 찾았다: ${빠진상수.join(' · ')} — 이름이 바뀌었으면 이 자의 «대상» 목록부터 고친다` };

  const 헤더지문 = 지문(헤더들.join('\n'));
  const 표지문 = 지문(절.글);
  const 도장 = 도장읽기();

  /* 표가 이름을 대는 시트 중 이 자의 대상 목록에 없는 것 — 한쪽만 자라는 것도 잡는다.
   * ⚠ **한글 시트 이름을 빠뜨리지 않는다** — 이 저장소의 수집 탭에는 `상담로그` 처럼 한글 이름이
   *   실재한다. 라틴 소문자만 보면 그런 줄이 조용히 안 잡히고, 새는 방향은 「없다」 쪽이다. */
  const 표밖 = [];
  for (const m of 절.글.matchAll(/`([\w가-힣]{3,})`\s*:/g)) {
    const n = m[1];
    if (!대상.some(([시트]) => 시트 === n) && !표밖.includes(n)) 표밖.push(n);
  }

  return { 헤더지문, 표지문, 도장, 표밖 };
}

function 줄들(r) {
  if (r.못잼) {
    return { 적색: [`🔴 L0 대조표를 못 쟀다 — ${r.못잼}`, '   이건 「표가 맞다」가 아니라 «확인 불가»다.'], 알림: [] };
  }
  const 적색 = [], 알림 = [];
  if (!r.도장) {
    알림.push('🟠 **L0 대조 도장이 없다** — 「표가 실물을 따라왔나」를 아직 한 번도 안 쟀다는 뜻이다(0건이 아니다).');
    알림.push('   지금 맞다고 보면: node tools/L0대조점검.js --도장 --사유 "왜"');
    return { 적색, 알림 };
  }
  const 헤더바뀜 = r.도장.헤더지문 !== r.헤더지문;
  const 표바뀜 = r.도장.표지문 !== r.표지문;

  if (헤더바뀜 && !표바뀜) {
    적색.push('🔴 **수집 시트 헤더가 바뀌었는데 형제 저장소 L0 §5 대조표는 그대로다.**');
    적색.push(`   헤더 ${r.도장.헤더지문} → ${r.헤더지문} · 표 ${r.표지문}(그대로 · 도장 ${r.도장.시각 || '?'})`);
    적색.push('   ⚠ 「표가 낡았다」로 단정하지 않는다 — 운영 축 칸은 표에 없어도 정상이다. **사람이 한 번 봐야 한다**는 뜻이다.');
    적색.push('   🚫 이 저장소 세션이 L0 를 직접 고치지 않는다(정본은 형제) — 발주는 docs/시트이관_재료정리_2026-09-01.md §6.');
    적색.push('   보고 맞으면: node tools/L0대조점검.js --도장 --사유 "왜"');
  } else if (헤더바뀜 && 표바뀜) {
    알림.push('🟠 헤더와 표가 **둘 다** 바뀌었다 — 사람이 이미 손댄 것으로 보고 조용히 넘어간다. 맞으면 도장을 새로 찍는다.');
  }
  if (r.표밖.length) {
    알림.push(`🟠 §5 표가 이름을 대는데 이 자의 대상 목록엔 없는 시트 ${r.표밖.length}종 — ${r.표밖.join(' · ')}`);
    알림.push('   한쪽만 자란 것이다. 이 자의 «대상» 목록에 넣을지 판정한다(넣으면 그 시트 헤더도 함께 잰다).');
  }
  return { 적색, 알림 };
}

function main() {
  const argv = process.argv.slice(2);
  const r = 재다();

  if (argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); return r.못잼 ? 1 : 0; }

  if (argv.includes('--도장')) {
    if (r.못잼) { console.error(`실행 오류: 못 잰 상태에서는 도장을 안 찍는다 — ${r.못잼}`); return 1; }
    const i = argv.indexOf('--사유');
    const 사유 = i >= 0 ? argv[i + 1] : null;
    // 사유 없는 도장은 다음 사람에게 「검토했다」로 보이는데 실제로는 「그냥 찍었다」와 같은 모양이다.
    if (!사유 || /^--/.test(사유)) { console.error('실행 오류: --사유 가 필요하다 — 사유 없는 도장은 「검토했다」와 「그냥 찍었다」가 같은 모양이 된다'); return 1; }
    const 새것 = { 헤더지문: r.헤더지문, 표지문: r.표지문, 시각: new Date().toISOString(), 사유 };
    fs.mkdirSync(path.dirname(도장경로()), { recursive: true });
    fs.writeFileSync(도장경로(), JSON.stringify(새것, null, 2) + '\n', 'utf8');
    console.log(`✅ 도장을 찍었다 — 헤더 ${r.헤더지문} · 표 ${r.표지문}`);
    console.log(`   사유: ${사유}`);
    return 0;
  }

  const { 적색, 알림 } = 줄들(r);
  console.log('🔗 L0 대조표 점검 — 시트 헤더가 자란 뒤 형제 저장소의 표가 따라왔는가\n');
  if (!적색.length && !알림.length) console.log('  ✅ 헤더도 표도 도장 그대로 — 걸린 것 없음');
  for (const l of [...적색, ...알림]) console.log(l.startsWith('   ') ? l : '  ' + l);
  return r.못잼 ? 1 : 0;
}

module.exports = { 재다, 줄들, 헤더소스, 대조절, 대상, 도장경로 };

if (require.main === module) {
  try { process.exit(main()); }
  catch (e) { console.error('🔴 L0 대조 점검이 못 돌았다:', e.message); process.exit(1); }
}
