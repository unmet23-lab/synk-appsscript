#!/usr/bin/env node
'use strict';
/* 시험지가 제미나이를 부르는 자리 — **Vertex 문**으로 간다 (2026-09-07 · 유호 「vertex로 가게 해줘」).
 *
 * ■ 왜 이 파일이 생겼나 — 시험이 «막혀 있었다»
 *   09-06 회차는 14칸 전부 못 잼이었다(`RateLimitExhaustedError ... after 4`). 까닭은 시험지가
 *   공짜 몫 문(AI Studio)으로만 갈 수 있었기 때문이다. 그 문의 하루 몫은 20발인데, 09-05 밤에
 *   제미나이의 기본 문이 유료 크레딧 쪽(Vertex)으로 옮겨지면서 공짜 몫은 «예비»로 내려갔다.
 *   그래서 시험만 옛 문에 남아 혼자 벽을 맞고 있었다.
 *
 *   🔴 정책은 이미 「이 자리는 돈 문이다」라고 말하고 있었다 — `tools/모델정책.js` 의 역할표에서
 *   `몽골어검문` 이 `돈열쇠필요 = true` 다(`tests/모델정책.test.js` 가 그걸 못 박아 둔다).
 *   말과 실행이 갈려 있었고, 갈린 쪽은 조용했다. 이 파일이 그 둘을 다시 붙인다.
 *
 * ■ 왜 promptfoo 의 `google:` 갈래를 «못» 쓰나
 *   그 갈래는 API 열쇠 한 줄로 부르는 문이다. 그런데 **Vertex 는 API 열쇠를 안 받는다** —
 *   이 프로젝트에서는 원리상 그렇다(09-04 판정 · 조직 정책이 열쇠 발급 자체를 막는다).
 *   Vertex 가 받는 것은 OAuth 토큰(1시간짜리 출입증)이고, 그것을 만드는 자는 `tools/모델정책.js`
 *   하나다. 그래서 남의 갈래를 쓰는 대신 **우리 통로를 그대로 부르는 자리**를 하나 만든다.
 *
 * ■ 이 파일이 «안 아는» 것 — 하나라도 여기 적으면 두 곳이 알게 된다
 *   · 모델 이름·생각 깊이 → `tools/모델정책.js` (제미나이설정)
 *   · 답의 JSON 모양     → `tools/몽골어대조.js` (검문자.js 가 읽어 온다)
 *   · 주소·인증·재시도   → `tools/lib/제미나이호출.js` (검문·검수가 같이 쓰는 한 통로)
 *   ⇒ 그래서 정본이 3.9 로 바뀌면 이 파일은 **한 줄도 안 고치고** 3.9 를 잰다.
 *
 * ■ 함정 둘
 *   ① **답을 쟁여두지 않는다.** promptfoo 의 저장 통은 그 도구가 «직접» 부른 답만 담는데,
 *      여기서는 우리 통로가 부르므로 그 통을 안 지난다. 다시 돌리면 **다시 부른다**(= 다시 닳는다).
 *      `--no-cache` 를 붙이든 말든 같다.
 *   ② 여기서 죽으면 그 칸은 «통과»가 아니라 오류로 남는다. 그 칸을 못 잰 칸으로 세는 자가
 *      `의심줄.js` 다 — 안 잰 것이 초록으로 접히지 않는다.
 */

const path = require('path');

const 루트 = path.join(__dirname, '..');
const 정책 = require(path.join(루트, 'tools', '모델정책.js'));
const { 제미나이 } = require(path.join(루트, 'tools', 'lib', '제미나이호출.js'));
const { 문법스키마정본 } = require(path.join(__dirname, '검문자.js'));

/* 🚪 어느 문으로 갈지는 정책이 정한다(09-05 부터 기본 = 「돈」 · Vertex · 크레딧).
 * 손으로 옛 문(공짜 몫)에 세우고 싶으면 시험지에서 `config: { 용도: 글 }` 로 준다. */
const 기본용도 = () => 정책.기본용도();

class 제미나이문 {
  constructor(options = {}) {
    const c = (options && options.config) || {};
    /* 🔑 `SYNK_EVAL_ROUTE` 는 `돌리기.js` 가 «자식에게» 문을 넘기는 자리다 — 손으로 세우는 값이
     *   아니다(변수 이름을 로마자로 둔 까닭은 Git Bash 가 한글 변수 이름을 못 받기 때문). */
    this.용도 = c.용도 || process.env.SYNK_EVAL_ROUTE || 기본용도();
    if (this.용도 !== '글' && this.용도 !== '돈') {
      throw new Error(`확인 불가 — 용도는 글|돈 중 하나다(받은 값 "${this.용도}")`);
    }
    /* 모델·생각 깊이의 정본은 `tools/모델정책.js` 다. 시험지가 «대조군»을 세울 때만
     * config.model 로 딴 모델을 준다 — 그때는 정본 픽이 아니므로 생각 깊이를 안 싣는다
     * (그 모델이 그 값을 받는지 모르는 채 실으면 조용한 400 이 된다 · 몽골어대조.js 와 같은 규율). */
    this.픽 = 정책.제미나이설정();
    this.model = c.model || this.픽.model;
    this.thinking = this.model === this.픽.model ? this.픽.thinking_level : undefined;
    this.문이름 = 정책.제미나이문(this.용도).이름;
    this.label = options.label || null;
  }

  /** 결과 파일에 「무엇이 답했나」로 남는 이름. 사람이 읽는 줄에도 이대로 뜬다. */
  id() {
    return `${this.model}${this.thinking ? '/' + this.thinking : ''} · ${this.문이름}`;
  }

  /** 정본 픽과 같은지 «네트워크 0»으로 되읽는 자리 — `검문자.js --자체점검` 이 부른다. */
  모델정보() {
    return { model: this.model, thinking: this.thinking, 용도: this.용도, 문: this.문이름 };
  }

  async callApi(prompt) {
    try {
      const r = await 제미나이(null, this.model, prompt, {
        schema: 문법스키마정본(),          // 정본에서 그 자리에서 뽑는다(복사본을 안 쥔다)
        thinking: this.thinking,
        용도: this.용도,
        상세: true,
      });
      const u = r.usage || {};
      const 답한것 = r.modelVersion || null;
      return {
        output: r.text,
        tokenUsage: {
          prompt: u.promptTokenCount,
          completion: u.candidatesTokenCount,
          total: u.totalTokenCount,
        },
        /* 「무엇이 답했나」를 결과에 남긴다 — 픽과 다른 것이 답하는 일이 실제로 있었다
         * (09-02 · Gemini CLI 가 시킨 모델과 다른 것을 서빙했다). */
        metadata: { 답한모델: 답한것, 문: this.문이름, 끝난까닭: r.finishReason || null },
      };
    } catch (e) {
      /* 던지지 않고 error 로 돌려준다 — 던지면 promptfoo 가 실행 전체를 세우고,
       * 그러면 이미 받은 칸까지 결과 파일에 안 남는다. */
      return { error: String((e && e.message) || e) };
    }
  }
}

module.exports = 제미나이문;
