#!/usr/bin/env node
'use strict';
/**
 * context-nudge — 「맥락이 얼마나 찼나 · 앞부분 재활용이 새고 있나」를 유호님 눈에 넣는다.
 *
 * ■ 왜 이 자리인가 (09-03 · 유호님 화면 사진으로 확정)
 *   상태줄(statusLine)을 두 줄로 지었는데 **유호님 화면에는 상태줄 자리가 아예 없다.**
 *   데스크탑 앱 Code 탭은 상태줄을 안 그리고, 대신 제 바를 그린다:
 *     입력칸 위 = `synk-appsscript master` + `+78,316 -278`
 *     입력칸 아래 = `권한 무시` · `Opus 5` · `최대`
 *   ⇒ 모델·생각깊이·저장소·가지·변경량은 **이미 앱이 보여준다**. 거기에 없는 것만 여기서 낸다.
 *   ⇒ 유호님이 실제로 보시는 자리는 «훅 알림»이다(이 파일이 그 자리에 선다).
 *
 * ■ 무엇을 재나 — 대화 기록 파일(transcript)의 마지막 응답 usage
 *   맥락  = input + cache_read + cache_creation  (그 요청이 실제로 실어 보낸 양)
 *   재활용 = cache_read ÷ 맥락                    (앞부분을 얼마나 아껴 썼나)
 *
 * ■ 하지 «않는» 것
 *   🚫 **퍼센트를 안 낸다.** 맥락 창의 크기(분모)가 기록에 없다 — 추정 분모로 % 를 내면
 *      「수는 자와 함께 적는다」를 어긴다(memory measurement-needs-its-instrument).
 *      대신 «절대 수»를 낸다. 자동 압축이 일어나면 그 수가 뚝 떨어지는 것으로 보인다.
 *   🚫 **돈을 안 낸다.** 모델별 단가표가 이 저장소에 없다. 자가 없으면 숫자를 안 만든다.
 *   🚫 **한도(5시간·7일)를 못 낸다.** 그 값은 상태줄에만 오고 기록 파일에는 없다.
 *      이건 「0」이 아니라 «이 통로로는 못 잰다»다.
 *   🚫 **평소엔 침묵.** 아래 두 자리에 걸릴 때만 한 줄 낸다 — 매 턴 뜨면 그냥 배경이 된다.
 *
 * 사용법: UserPromptSubmit 훅. 입력 JSON 의 transcript_path 를 쓴다.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

/* ■ 눈금은 «세었다» (09-03 · 지난 세션 116개 · 응답 턴 70,483개를 되돌려 재기)
 *   첫 판은 맥락 30만 · 재활용 70% 였는데, 그 눈금이면 **턴의 63%에서 떴다**. 잔소리다.
 *   그리고 더 큰 잘못: 조건이 «상태»라 한 번 걸리면 그 뒤 모든 턴에서 계속 걸렸다.
 *   알림은 «사건»이어야 한다 ⇒ 아래 둘은 **한 세션에 각각 한 번만** 뜬다.
 *
 *   재본 표 (「그 눈금에서 뜨는 턴의 비율」):
 *     맥락  30만 63% · 50만 33% · 70만 12% · **90만 2%**
 *     재활용 70% 2% · 50% 1% · **30% 1%**
 *   90만을 고른 이유 = 세션 116개 중 9개(8%)만 거기까지 간다. 뜨면 «진짜 큰» 세션이다.
 *   30%를 고른 이유 = 앞머리를 통째로 다시 만든 자리라 돈이 실제로 샌 순간이다. */
const 재활용바닥 = 0.30;      // 이 아래면 앞머리를 사실상 새로 만든 것이다
const 맥락천장 = 900_000;     // 세션 116개 중 9개만 여기까지 갔다

function 입력읽기() {
  return new Promise((resolve) => {
    let s = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => (s += d));
    process.stdin.on('end', () => resolve(s));
    setTimeout(() => resolve(s), 3000);
  });
}

const 짧게 = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

(async () => {
  let 입력 = {};
  try { 입력 = JSON.parse((await 입력읽기()) || '{}'); } catch { process.exit(0); }

  const 길 = 입력.transcript_path;
  if (!길 || !fs.existsSync(길)) process.exit(0); // 못 쟀다 — 조용히 넘어간다(막지 않는다)

  let 마지막 = null;
  try {
    const 줄들 = fs.readFileSync(길, 'utf8').trim().split('\n');
    // 뒤에서부터 «본 대화»의 마지막 응답 하나만 찾는다. 서브에이전트 줄은 sidechain 으로 표시된다.
    for (let i = 줄들.length - 1; i >= 0 && i > 줄들.length - 400; i--) {
      let o;
      try { o = JSON.parse(줄들[i]); } catch { continue; }
      if (o.isSidechain) continue;
      const u = o.message && o.message.usage;
      if (u && typeof u.cache_read_input_tokens === 'number') { 마지막 = u; break; }
    }
  } catch { process.exit(0); }
  if (!마지막) process.exit(0);

  const 읽음 = 마지막.cache_read_input_tokens || 0;
  const 만듦 = 마지막.cache_creation_input_tokens || 0;
  const 생짜 = 마지막.input_tokens || 0;
  const 맥락 = 읽음 + 만듦 + 생짜;
  if (!맥락) process.exit(0);

  const 적중 = 읽음 / 맥락;

  /* 「이 세션에서 이미 알린 것」을 저장소 «밖»에 적어 둔다. 저장소에 적으면 세션마다
   * 미커밋이 하나 떠서 다음 세션이 「남의 변경인가」를 헛센다(스킬판점검·세션끝장부와 같은 자리). */
  const 표시길 = path.join(os.tmpdir(), `synk-nudge-${(입력.session_id || 'x').slice(0, 8)}.json`);
  let 이미 = {};
  try { 이미 = JSON.parse(fs.readFileSync(표시길, 'utf8')); } catch { /* 첫 알림이면 정상 */ }

  const 말 = [];
  if (맥락 > 맥락천장 && !이미.맥락) {
    이미.맥락 = true;
    말.push(`맥락이 **${짧게(맥락)}** 토큰까지 자랐다. 지난 세션 116개 중 여기까지 간 것은 9개뿐이다. 08-08 실측으로는 생각 깊이를 낮추는 것보다 **세션을 끊는 쪽이 언제나 크다**`);
  }
  if (적중 < 재활용바닥 && !이미.재활용) {
    이미.재활용 = true;
    말.push(`앞부분 재활용이 **${Math.round(적중 * 100)}%** 로 떨어졌다. 앞머리 ${짧게(만듦)} 를 새로 만들었으니 이 한 번은 값이 더 나갔다. 모델이나 생각 깊이를 바꾼 자리이거나, 도구 목록이 움직인 자리다`);
  }
  if (!말.length) process.exit(0); // 걸릴 게 없거나 이미 알렸으면 완전 침묵

  // 「이 알림이 값이 있었나」를 2주 뒤에 기계가 세도록 그 자리에서 적어 둔다(tools/알림값점검.js)
  try {
    const { 적기 } = require('./lib/알림장부.js');
    if (이미.맥락 && 맥락 > 맥락천장) 적기('맥락', { 맥락, 적중: Math.round(적중 * 100) });
    if (이미.재활용 && 적중 < 재활용바닥) 적기('재활용', { 맥락, 적중: Math.round(적중 * 100), 만듦 });
  } catch { /* 못 적어도 알림 자체는 나간다 */ }

  try { fs.writeFileSync(표시길, JSON.stringify(이미), 'utf8'); } catch { /* 못 적으면 다음에 또 뜬다 — 무해하다 */ }
  console.log('⚡ ' + 말.join('\n⚡ '));
  process.exit(0);
})().catch(() => process.exit(0));
