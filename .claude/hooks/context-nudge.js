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

const 재활용바닥 = 0.70;      // 이 아래면 뭔가 앞머리를 깨고 있다(모델·생각깊이 전환, 도구 목록 변화 …)
const 맥락천장 = 300_000;     // 이 위면 길어진 것이다 — 끊을 자리를 재실 때다

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

  const 말 = [];
  if (맥락 > 맥락천장) {
    말.push(`맥락 **${짧게(맥락)}** 토큰까지 자랐다 — 08-08 실측: 생각 깊이를 낮추는 것보다 **세션을 끊는 것이 언제나 크다**`);
  }
  if (적중 < 재활용바닥) {
    말.push(`앞부분 재활용 **${Math.round(적중 * 100)}%** — 새고 있다(새로 만든 몫 ${짧게(만듦)}). 모델·생각깊이를 바꿨거나 도구 목록이 움직인 자리다`);
  }
  if (!말.length) process.exit(0); // 둘 다 성하면 완전 침묵

  console.log('⚡ ' + 말.join('\n⚡ '));
  process.exit(0);
})().catch(() => process.exit(0));
