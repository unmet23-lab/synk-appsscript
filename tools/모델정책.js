#!/usr/bin/env node
/* 모델정책 — 어느 일에 **어느 벤더의 어느 모델을, 어느 추론 수준으로** 쓰는가.
 *
 * ■ 왜 파일 하나인가
 *   같은 판정을 두 곳에 적으면 갈라지고, 갈라지는 방향은 언제나 **얕은 쪽·싼 쪽**이다 —
 *   그리고 그 갈라짐은 겉보기에 아무 차이가 없다. 2026-08-05 에 정확히 그 형태로 데였다:
 *   모델만 박고 효력을 안 박아 **최상급 모델이 `low` 로** 돌고 있었는데, 로그는 「최신 모델」이라고
 *   말하고 있었다(73313b7). 그래서 벤더가 둘이 된 지금은 결정 자리를 하나로 모은다.
 *
 * ■ 이 파일이 지키는 규칙 셋
 *   ① **모델과 효력은 언제나 한 벌이다.** 모델만 고르게 하는 통로를 만들지 않는다.
 *   ② **지원하지 않는 조합은 여기서 거절한다.** 벤더에 넘기면 「확인 불가」로 돌아오는데,
 *      그건 안 틀린 대신 **안 돈다** — 배포 직전에 알게 되는 값이다.
 *   ③ **조용히 내려가지 않는다.** 못 쓰는 픽이면 말하고 멈춘다. 폴백이 조용하면
 *      「최고로 세팅했다」고 믿으면서 한 단계 아래로 도는 상태가 되는데, 그게 ①과 같은 병이다.
 *
 * 사용:
 *   node tools/모델정책.js                 # 지금 정책을 그대로 출력
 *   node tools/모델정책.js --제미나이확인    # 픽한 모델 ID 가 아직 살아있는지 실제 API 로 조회
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

function 확인불가(msg) {
  const e = new Error(msg);
  e.확인불가 = true;
  return e;
}

// ══════════════════════════════════════════════ 코덱스(GPT) — 이종 적대 검수

/* 추론 수준을 **깊이 순서로** 둔다. 순서 자체가 회귀의 재료다
 * (「변환 단계가 분석 단계보다 깊으면 축이 뒤집힌 것」을 이 인덱스로 잰다). */
const 효력들 = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];

/* 모델마다 **지원하는 효력이 다르다.** 실측 원본 = `~/.codex/models_cache.json`(2026-08-05 조회):
 *   sol 은 ultra 까지 · **luna 는 max 까지(ultra 없음)** · 5.4 계열은 xhigh 까지.
 * 이 표가 없으면 `luna + ultra` 같은 조합이 codex 쪽에서 거절되고 그건 종료코드 2 로 나온다 —
 * 검수가 「안 돈 것」이지 통과가 아닌데, 배포 직전에야 알게 된다. 그래서 여기서 먼저 거른다.
 * ⚠ 표를 손으로 적었으므로 **실물과 갈라질 수 있다** → `tests/모델정책.test.js` 가 캐시 파일이
 *   있는 기계에서 대조하고, 없으면 skip 으로 드러낸다(통과와 미실행이 같은 모양이면 안 된다). */
const 코덱스효력 = {
  'gpt-5.6-sol': ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'],
  'gpt-5.6-luna': ['low', 'medium', 'high', 'xhigh', 'max'],
  'gpt-5.4-mini': ['low', 'medium', 'high', 'xhigh'],
};

/* ■ 검수 선택지는 **둘뿐이다** — 유호님 확정(2026-08-05): "5.6 sol max 또는 5.6 luna max 둘 중
 *   고를 수 있게. terra 는 버리고."
 *
 * 왜 둘 다 `max` 로 못 박는가: **효력이 모델보다 레버가 크다**(같은 모델의 low↔max 차이가
 *   모델 간 차이보다 크다는 게 이 저장소 실측이다). 모델만 고르게 하고 효력을 기본값에 맡기면
 *   고른 의미가 사라진다 — `gpt-5.6-sol` 의 기본은 `low`, `luna` 의 기본은 `medium` 이라
 *   **아무것도 안 하면 sol 쪽이 오히려 얕게 돈다.** 조건을 맞춰야 선택지가 비교가 된다.
 *
 * 왜 `ultra` 가 아니라 `max` 인가: `ultra` 는 sol 만 지원한다(luna 는 max 가 천장).
 *   둘 중 하나만 더 깊게 두면 「sol 이 낫더라」가 모델 차이인지 효력 차이인지 안 갈린다.
 *
 * 🚫 terra 는 선택지에서 뺐다. 되살리려면 이 표에 다시 적어야 한다 — 그게 의도한 마찰이다. */
const 검수선택지 = {
  sol: {
    model: 'gpt-5.6-sol',
    effort: 'max',
    설명: '프런티어 — 비싸다. 되돌림 비용이 특히 큰 변경에만 `--검수 sol` 로 명시',
  },
  luna: {
    model: 'gpt-5.6-luna',
    effort: 'max',
    설명: '기본값 — 유호님 확정. ultra 는 지원 안 함(max 가 천장)',
  },
};
/* [2026-08-05] 기본을 sol → luna 로 고정. 유호님 지시 원문:
 *   "gpt검수할때 gpt 5.6 luna max로 고정해줘 sol 쓰니까 너무 비싸다".
 * sol 은 선택지에서 빼지 않는다 — `--검수 sol` 로 여전히 부를 수 있다(비용을 감수할 자리가 있다).
 * 효력은 둘 다 max 그대로 — 모델만 바꾸고 효력을 낮추면 「비교」가 아니라 「둘 다 얕아짐」이 된다. */
const 검수기본 = 'luna';

/* [2026-08-06] ②**설계 심문**은 기본이 다르다 — 유호님 확정(선택지 중 sol/max).
 * 🔑 이건 위의 「sol 은 비싸다」 판정을 뒤집는 게 아니다. 그 판정의 대상은 **매 배포마다 도는**
 *   ①배포 검수였고, 설계 심문은 그때 존재하지도 않았다. 같은 모델 기준 3축을 이 역할에 대면
 *   답이 반대로 나온다:
 *     ① 되돌림 비용 = **최대**. 배포 코드는 다음 배포에서 고치지만 **계약은 데이터가 쌓이면 못 고친다.**
 *     ② 판단인가 변환인가 = 순수 판단 → 최상급.
 *     ③ 빈도 = **최소**. 계약 동결은 c4→c5→c6→c7 로 지금까지 4회다(배포는 하루에도 여러 번).
 *   비용은 빈도만큼만 는다 — 그래서 「비싸다」가 여기선 차단 사유가 아니다.
 * 🚫 이걸 다시 luna 로 내리자는 재제안 금지 — 비용 판정은 유호님 몫이고 이미 내려졌다.
 *   `--검수 luna` 로 1회성 호출은 여전히 열려 있다.
 *
 * ✅ **[2026-08-09] 유호님이 바꿨다: 심문 기본 = luna/max, 단 2회.** 원문:
 *   *"gpt 업그레이드 됬던데. luna가 공짜더라고. (…) 검수나 심문할떄 각 luna max로 2회씩"*.
 *   위 08-06 판정을 뒤집는 게 아니라 **전제가 바뀐 것**이다: 그 판정의 논리는 「빈도가 낮으니
 *   비싸도 된다」였고, 비용이 0 이 되면 같은 시간에 **두 번** 돌릴 수 있다(아래 회차 주석).
 * ⚠ 대신 잃는 것을 적어둔다 — **같은 모델 2회는 같은 맹점을 두 번 본다.** 08-07 sol↔luna 대조에서
 *   두 모델이 집는 지적이 서로 달랐다(그 대조 자체는 조건 통제 실패로 판정이 못 됐지만, 「다르더라」는
 *   남았다). 관점 다양성이 필요한 자리면 `--검수 sol` 로 한 번 더 돌린다 — sol 은 선택지에 그대로다.
 * 🚫 「luna 가 공짜가 아니게 됐다」는 실측 없이 sol 로 되돌리는 재제안 금지.
 *
 * ✅ **[2026-08-09 2차] 유호님 확정 — 심문 편성 = `luna/max ×2` + `sol/max ×1`.** 원문:
 *   *"그럼 심문만 luna max 2번에 추가로 sol max 1번 더 추가하자."*
 *   위 ⚠(같은 모델 2회 = 같은 맹점 2회)를 이 편성이 닫는다. **두 축은 서로 다른 것을 산다**:
 *     · 회차 축 = 런 간 편차. 08-07 실측 같은 모델·같은 효력 2회가 **38 vs 20**.
 *     · 모델 축 = 맹점 편차. 같은 실측에서 고유 지적이 C0 에서 sol만 ~14 · luna만 ~5.
 *   ①검수는 **매 배포**라 luna 2회로 닫고(시간이 값), ②심문은 **빈도 최소·되돌림 비용 최대**라
 *   sol 을 한 벌 더 얹는다(동결은 지금까지 4회 — 비용이 빈도만큼만 는다).
 * 🔑 순서가 luna 먼저인 이유: `--회차 N` 은 이 목록의 **앞 N개**를 쓴다. 싼 것부터 채워야
 *   급할 때 자르는 쪽이 비싼 쪽이 된다.
 * ~~🚫 편성에서 sol 빼기 · luna 를 sol 로 통째 교체 · 「3회는 과하다」 재제안 금지(유호 판정).~~
 *
 * ✅ **[2026-08-14] 유호님이 직접 뒤집었다 — 심문·검수 «둘 다 1회 · luna/max».** 원문:
 *   *"그리고 심문 검수 둘다 1회로 줄이자 luna max로"*.
 *   위 🚫 셋 중 앞의 둘(sol 빼기·luna 로 통째 교체)을 **유호님 판정이 대체**한다 —
 *   AI 가 되살릴 수 있는 자리가 아니다(🚫 재제안은 그대로 산다).
 * ⚠ **이 편성이 잃는 것을 적어둔다**(위 08-09 2차가 산 것을 그대로 되판다):
 *   · **회차 축을 잃는다** — 08-07 실측에서 같은 모델·같은 효력 2회가 **38 vs 20** 이었다.
 *     한 벌만 돌면 그날 런이 얕게 나와도 그게 얕은 건지 문서가 깨끗한 건지 안 갈린다.
 *   · **모델 축을 잃는다** — 같은 실측에서 고유 지적이 sol 만 ~14 · luna 만 ~5.
 *   · 🔴 **회차 «간» 대조의 분모가 바뀐다** — 1~10회차는 3벌(또는 2벌)이었다.
 *     11회차부터의 원건 수를 앞 회차와 **직접 빼지 마라**(F281 축: 조건이 갈리면 대조가 무효다).
 *     편성 변경 자체가 조건 변경이라 그 사실을 처분표 §1 에 적는다.
 *   되돌리려면 유호님 한 마디면 된다 — 값은 이 한 줄이다. */
const 심문편성 = ['luna'];
/* 하나에서 파생시킨다 — 「심문의 기본 모델」을 따로 적으면 편성과 갈라지고, 갈라진 쪽 증상은
 * 언제나 조용하다(가드 맹점 ④: 같은 판정을 두 곳에 적으면 목록이 갈린다). */
const 심문기본 = 심문편성[0];

/* ■ **몇 번 돌리는가** — 유호님 확정 2026-08-09: 검수·심문 **둘 다 2회**.
 *   모델·효력과 한 벌로 여기 둔다(이 파일의 규칙 ①). 회차를 호출부마다 정하게 하면 갈라지고,
 *   갈라지는 방향은 언제나 **싼 쪽 = 1회**다.
 *
 * 왜 2회가 1회보다 넓은가: 같은 프롬프트·같은 모델·같은 효력이어도 런마다 집는 게 다르다
 *   (이 저장소 실측 — 08-07 두 런의 지적 집합이 달랐다). 합집합이 곧 이득이고, 비용이 0 이면
 *   남는 대가는 **벽시계 시간뿐**이다.
 *
 * 🔑 합치는 것은 **코드가 한다**. 모델에게 「두 결과를 합쳐라」고 시키면 그건 변환이 아니라 판단이
 *   되고, 떨어뜨린 지적이 조용해진다 — 2단계 구조화를 「원문에 없는 걸 만들지 마라」로 묶어둔 것과
 *   같은 이유다.
 * 🔑 회차는 **판단 패스에만** 붙는다(①1단계 분석 · ①기능체크 · ②심문). 2단계 구조화는 산문 하나당
 *   한 번이라 회차만큼 자동으로 늘고, 따로 곱하지 않는다.
 *
 * 1회성 하향 = `--회차 1`(급할 때 · `--효력 high` 와 같은 결의 손잡이).
 * 상한을 두는 이유: `--회차 30` 오타 하나가 최대 15 시간짜리 런을 조용히 시작시킨다(F135 계열).
 *
 * ✅ **[2026-08-14] 유호님 확정 — 기본 «1회».** 위 「왜 2회가 1회보다 넓은가」의 논거는
 *   틀린 것이 아니라 **값을 치를 만하지 않다는 판정을 받은 것**이다(유호 원문 「너무 낭비하는것같아」
 *   는 fable 통로 얘기지만 같은 지시 안에서 회차도 함께 1로 내렸다).
 *   ⚠ 잃는 것 = 런 간 편차의 합집합(위 문단 그대로 · 실측 38 vs 20).
 *   🔑 상한 3 은 **안 내린다** — 상한은 기본값이 아니라 오타 방호벽이고, 되돌림 비용이 특히 큰
 *   자리에서 `--회차 2` 로 한 번 더 도는 손잡이가 살아 있어야 한다(값이 아니라 문이다). */
const 회차기본 = 1;
const 회차상한 = 3;

/* 기본을 인자로 받는 이유 = 역할마다 다르기 때문이다(①검수 2 · ②심문 3 = 편성 길이).
 * 사본을 만들지 않고 인자 하나로 가른다 — 두 벌이 되면 갈라지고 갈라지는 방향은 언제나 싼 쪽이다. */
function 회차설정(argv, 기본 = 회차기본) {
  const a = Array.isArray(argv) ? argv : [];
  if (!a.includes('--회차')) return 기본;
  const v = a[a.indexOf('--회차') + 1];
  const n = Number(v);
  // 값이 없거나 이상하면 기본으로 접지 않는다 — 「2회 돌렸다」는 착각이 이 파일이 막으려는 병이다.
  if (!Number.isInteger(n) || n < 1 || n > 회차상한) {
    throw 확인불가(`--회차 는 1~${회차상한} 의 정수다 — 받은 값 "${v === undefined ? '(없음)' : v}"`);
  }
  return n;
}

/* 사람이 명시한 픽 — CLI 가 env 를 이긴다. 두 소비자(분석설정·심문런들)가 **같은 자리**를 읽어야
 * `--검수 sol` 이 한쪽에서만 먹는 일이 안 생긴다(그러면 「sol 로 돌렸다」고 믿으며 luna 가 돈다). */
function 명시픽(argv) {
  const a = Array.isArray(argv) ? argv : [];
  if (a.includes('--검수')) {
    const v = a[a.indexOf('--검수') + 1];
    // 값이 없거나 다음 플래그를 집으면 기본값으로 접지 않는다 — 「골랐다」는 착각을 만든다.
    if (!v || /^--/.test(v)) throw 확인불가('`--검수` 뒤에 픽이 없다 — `--검수 sol` 또는 `--검수 luna`');
    return v;
  }
  return process.env.SYNK_REVIEW_PICK || null;
}

/* ②심문이 실제로 돌릴 런 목록. 규칙 셋:
 *   ① 아무것도 안 주면 **편성 그대로**(luna · luna · sol).
 *   ② `--검수 X` 를 주면 1회성 지정으로 읽어 **그 픽 하나로 회차만큼** 돈다(옛 동작 보존).
 *   ③ `--검수` 없이 `--회차 N` 이면 편성의 **앞 N개** — 자르는 쪽이 비싼 sol 이 되게 순서를 짰다.
 * 어느 경우든 부르는 쪽이 목록을 **출력**한다. 편성은 조용히 바뀌면 안 되는 종류의 값이다. */
function 심문런들(argv) {
  const a = Array.isArray(argv) ? argv : [];
  const 명시 = 명시픽(argv);
  const n = 회차설정(argv, 명시 ? 회차기본 : 심문편성.length);
  const 이름들 = 명시 ? Array.from({ length: n }, () => 명시) : 심문편성.slice(0, n);
  const 효력 = a.includes('--효력') ? String(a[a.indexOf('--효력') + 1] || '') : null;
  return 이름들.map((이름) => {
    const 픽 = 검수선택(이름);
    if (효력) 픽.effort = 효력;   // 1회성 조정 — 조합 검사는 코덱스플래그가 진다
    return 픽;
  });
}

/* 사람이 쓰는 표기를 받아준다 — `sol` · `luna` · `5.6 sol max` · `gpt-5.6-sol` 전부 같은 것을 뜻한다.
 * 다만 **모르는 이름은 기본값으로 접지 않고 거절한다**: 오타를 조용히 sol 로 읽으면
 * 「luna 로 돌렸다」고 믿는 상태가 만들어지고, 그건 이 파일이 막으려는 바로 그 병이다.
 * 버전 숫자도 같은 무게로 본다 — `5.5 luna` 를 luna 로 접으면 「5.5를 돌렸다」고 믿게 된다
 * (2026-08-05 이종 검수 P2 지적: 비문자를 다 지우는 정규화가 오타 거절을 무력화하고 있었다). */
function 검수선택(이름) {
  const 원 = String(이름 == null || 이름 === '' ? 검수기본 : 이름);
  const n = 원.toLowerCase().replace(/[^a-z]/g, '').replace(/^gpt/, '').replace(/max$/, '');
  const 키 = Object.prototype.hasOwnProperty.call(검수선택지, n) ? n : null;
  if (!키) {
    throw 확인불가(
      `모르는 검수 선택지 "${원}" — 가능: ${Object.keys(검수선택지).join(' · ')} ` +
      `(terra 는 2026-08-05 유호님 판정으로 뺐다)`
    );
  }
  const 픽 = { ...검수선택지[키], 이름: 키 };
  // 표기에 버전 숫자가 있으면 고른 모델의 실제 버전과 맞아야 한다 — 다르면 접지 않고 거절.
  for (const v of String(원).match(/\d+(?:\.\d+)*/g) || []) {
    if (!픽.model.includes(v)) {
      throw 확인불가(`"${원}" 의 버전 ${v} 는 ${픽.model} 과 다르다 — 그 버전은 선택지에 없다`);
    }
  }
  return 픽;
}

/* 1단계 = 분석(적대 검수). 되돌림 비용이 큰 자리라 최상급 + 최고 효력.
 *   통로 둘: 환경변수 `SYNK_REVIEW_PICK` · CLI `--검수 sol|luna`. `--효력` 은 1회성 조정 —
 *   급하면 `--효력 high`, 그날만 더 깊게는 `--효력 ultra`(sol 만 받는다 · luna 는 max 가 천장). */
/* 기본픽 인자 = 역할마다 기본이 다르기 때문이다(①=luna · ②심문=sol · 위 주석).
 * 사본을 만들지 않고 인자 하나로 가른 이유: 두 벌이 되면 갈라지고, 갈라지는 방향은 언제나 얕은 쪽이다. */
function 분석설정(argv, 기본픽) {
  const a = Array.isArray(argv) ? argv : [];
  // 옛 `--모델` 은 조용히 무시하지 않는다 — 무시하면 그 호출자는 딴 모델로 돌면서 제 모델이라 믿는다.
  if (a.includes('--모델')) {
    throw 확인불가('`--모델` 은 폐지됐다 — `--검수 sol|luna` 를 쓴다 (선택지는 tools/모델정책.js)');
  }
  const 설정 = 검수선택(명시픽(argv) || 기본픽);
  if (a.includes('--효력')) 설정.effort = String(a[a.indexOf('--효력') + 1] || '');
  return 설정;
}

/* 2단계 = 산문 → JSON.
 * ✅ **2026-08-06 유호님 확정: `max`** — 원문 *"아니다 그냥 둘다 max로 할래"*.
 *   🚫 `low` 로 되돌리는 재제안 금지 — 반대 근거를 듣고 내린 판정이다.
 *
 * ⚠ 그때 유호님께 전달한 반대 근거는 기록으로 남긴다(지우면 징후가 나와도 원인을 못 찾는다):
 *   이 단계의 성공 조건은 「좋은 판단」이 아니라 **「1단계 산문과 같은가」**다. 똑똑할수록
 *   「고쳐서」 옮길 여지가 는다(STT 가 학생 발음 오류를 고쳐 전사해 데이터를 없애는 것과 같은 계열).
 *   형식은 `--output-schema` 가 잡지만 **내용 변조는 아무것도 안 잡는다** — low 의 실패는 형식이
 *   깨져 시끄럽고, max 의 실패는 형식이 멀쩡해 조용하다.
 *   👉 징후(2단계 JSON 의 등급·문구가 1단계 산문과 어긋남)가 실제로 나오면 이 주석을 근거로 다시 올린다.
 *
 * ⚠ 2026-08-05 실측: `gpt-5.4-mini` 는 벤더가 **폐기 예고**했고 후속으로 `gpt-5.6-luna` 를 지목한다
 *   (models_cache.json 의 migration 항목). 폐기되면 이 단계가 종료코드 2 로 죽으므로 미리 옮겼다. */
const 구조화설정 = {
  model: process.env.SYNK_REVIEW_FMT_MODEL || 'gpt-5.6-luna',
  effort: process.env.SYNK_REVIEW_FMT_EFFORT || 'max',
};

/* 모델·효력을 codex 플래그 한 벌로. 검증이 여기 있는 이유는 **여기만 지나가게** 하기 위해서다.
 * 거절이 두 결인 것은 처방이 다르기 때문이다 — 오타는 고쳐 쓰면 되고, 미지원 조합은 표를 봐야 한다. */
function 코덱스플래그(설정) {
  if (!효력들.includes(설정.effort)) {
    throw 확인불가(`알 수 없는 추론 수준 "${설정.effort}" — 가능: ${효력들.join(' · ')}`);
  }
  const 지원 = 코덱스효력[설정.model];
  if (!지원) {
    throw 확인불가(
      `모르는 코덱스 모델 "${설정.model}" — tools/모델정책.js 의 코덱스효력 표에 먼저 적어야 한다 ` +
      `(지원 효력을 모르는 채 넘기면 조용히 기본 추론으로 돈다)`
    );
  }
  if (!지원.includes(설정.effort)) {
    throw 확인불가(`"${설정.model}" 은 추론 "${설정.effort}" 을 지원하지 않는다 — 가능: ${지원.join(' · ')}`);
  }
  return ['-m', 설정.model, '-c', `model_reasoning_effort="${설정.effort}"`];
}

// ══════════════════════════════════════════════ 제미나이 — 라이브 시트 구조 점검

/* 축이 능력 경쟁이 아니라 **결손 보전**이다: 클로드는 라이브 시트를 원천적으로 못 본다.
 * 🚫 제미나이를 코드 검수자로 쓰지 않는다(그 자리는 Codex 가 이미 진다 · 2026-08-05 판정).
 *   🔓 예외 하나 = **보안 취약점 리뷰**(유호님 2026-08-06 지시 · 정본 docs/AI_스택_가이드.md §1-5).
 *   모델 `Gemini 3.5 Flash Cyber` 는 아직 일반 공개가 아니라(정부·신뢰 파트너 파일럿) **여기 코드는 0줄**이다.
 *
 * ■ 무엇이 「최고」인가 (근거 = Google 공식 문서 2026-08-05 조회)
 *   최상위 = `gemini-3.1-pro-preview`. 사고 수준은 `thinking_level` 로 주고 low·medium·high 를
 *   지원한다(minimal 없음 · 기본 high · **사고를 끌 수 없다**). 즉 최고 = `high`.
 *   `thinking_level` 은 Gemini 3 부터 `thinking_budget` 을 대체한다 — 둘을 같은 요청에 함께 주지 않는다.
 *
 * 🔴 **결제 등급이 픽을 가른다.** 공식 FAQ: `gemini-3.1-pro-preview` 에는 **Gemini API 무료 등급이
 *   없다.** 무료 등급이 있는 건 `gemini-3-flash-preview` 다. 그리고 유호님의 **Google AI Pro 구독은
 *   API 결제가 아니다**(그건 gemini.google.com·AI Studio 쪽 소비자 구독) — 섞이기 쉬운 자리라 적어둔다.
 *
 * 그래서 픽을 **둘 다 이름 붙여** 두고 `폴백허용 = false` 로 둔다 — 못 부르면 **말하고 멈춘다.**
 *   조용히 다른 모델로 갈아타면 「이걸로 세팅했다」가 거짓이 된다.
 *
 * ✅ **기본 = 무료최상(flash/high) — 유호님 확정(2026-08-05 "제미나이는 flash high로 세팅해줘").**
 *   플래시의 최신은 문서가 아니라 **라이브 목록 실측**으로 정했다(2026-08-05 · 실키 조회 58종 중
 *   플래시 최신 = `gemini-3.6-flash` · 몽골어대조.js 의 「2.5는 404」 실측과 합치).
 *   3.1-pro 픽은 이름만 남겨둔다 — 결제를 켜는 날 기본을 「최상」으로 바꾸면 끝이게. */
const 제미나이사고 = {
  'gemini-3.1-pro-preview': ['low', 'medium', 'high'],   // 공식 문서(미실측 — 무료 키로는 못 부른다)
  // high 만 실측했다(2026-08-05 프로브 · thoughtsTokenCount 126 로 사고 실사용 확인).
  // 다른 수준은 안 재서 안 적는다 — 쓰려면 프로브부터(--제미나이확인).
  'gemini-3.6-flash': ['high'],
};

const 제미나이 = {
  최상: { model: 'gemini-3.1-pro-preview', thinking_level: 'high', 무료등급: false },
  무료최상: { model: 'gemini-3.6-flash', thinking_level: 'high', 무료등급: true },
  기본: '무료최상',
  폴백허용: false,
};

/* 키는 파일에서만 읽는다 — `$env:GEMINI_API_KEY="<키>"` 식 안내는 리터럴 키를 PSReadLine
 * 기록·트랜스크립트에 남긴다(2026-08-05 이종 검수 P2 지적로 고침). 경로·추출 규칙은
 * 몽골어대조.js 가 먼저 실측으로 깔았다(AQ. 형식 실재) — 여기가 정본이 되고 그쪽이 소비한다. */
const 제미나이키경로 = () => process.env.GEMINI_KEY_PATH || 'C:/Users/q1212/SYNK_보안/제미나이.txt';
function 제미나이키() {
  const p = 제미나이키경로();
  if (!fs.existsSync(p)) return null;
  const tokens = String(fs.readFileSync(p, 'utf8')).replace(/^\uFEFF/, '').trim().split(/\s+/).filter(Boolean);
  const known = tokens.find((t) => /^(AIza|AQ\.|sk-)/.test(t));
  if (known) return known;
  return tokens.length === 1 ? tokens[0] : null; // 모르는 토큰 여럿 = 아무거나 집어 조용히 401 내느니 null
}

/* 전송 모양: 부르는 쪽(몽골어대조.js · 향후 라이브시트 층)은 `generateContent` 에
 * `generationConfig.thinkingConfig.thinkingLevel` 로 싣는다(2026-08-05 실측 통과 형태). */
function 제미나이설정(이름) {
  const 키 = 이름 == null || 이름 === '' ? 제미나이.기본 : String(이름);
  const p = 제미나이[키];
  if (!p || !p.model) {
    throw 확인불가(`모르는 제미나이 픽 "${키}" — 가능: 최상 · 무료최상`);
  }
  const 지원 = 제미나이사고[p.model];
  if (!지원) throw 확인불가(`모르는 제미나이 모델 "${p.model}" — 제미나이사고 표에 먼저 적어야 한다`);
  if (!지원.includes(p.thinking_level)) {
    throw 확인불가(`"${p.model}" 은 사고 수준 "${p.thinking_level}" 을 지원하지 않는다 — 가능: ${지원.join(' · ')}`);
  }
  return { ...p, 이름: 키 };
}

// ══════════════════════════════════════════════ 조회 (부작용 0)

/* 코덱스 캐시가 있는 기계에서만 참인 대조. **없으면 없다고 말한다** — 「대조했다」와
 * 「대조 못 했다」가 같은 모양이면 표가 낡아도 초록으로 보인다. */
function 코덱스캐시() {
  const p = path.join(os.homedir(), '.codex', 'models_cache.json');
  if (!fs.existsSync(p)) return null;
  let j;
  try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
  const 표 = {};
  (function 훑기(o) {
    if (Array.isArray(o)) return o.forEach(훑기);
    if (o && typeof o === 'object') {
      if (o.slug && Array.isArray(o.supported_reasoning_levels) && !표[o.slug]) {
        표[o.slug] = {
          지원: o.supported_reasoning_levels.map((x) => x.effort).filter(Boolean),
          기본: o.default_reasoning_level || null,
        };
      }
      Object.values(o).forEach(훑기);
    }
  })(j);
  return Object.keys(표).length ? 표 : null;
}

async function 제미나이확인() {
  const key = 제미나이키();
  if (!key) {
    console.error(`🔴 키를 못 읽었다(${제미나이키경로()}) — 조회를 **안 돌린 것**이지 「모델이 없다」가 아니다.`);
    console.error('   키는 파일로만 다룬다(셸에 리터럴로 치면 기록에 남는다) — 경로 변경은 env GEMINI_KEY_PATH.');
    return 2;
  }
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    headers: { 'x-goog-api-key': key },
  });
  if (!res.ok) {
    console.error(`🔴 조회 실패 ${res.status} — ${(await res.text()).slice(0, 300)}`);
    return 2;
  }
  const 살아있음 = new Set(((await res.json()).models || []).map((m) => String(m.name || '').replace(/^models\//, '')));
  let 최악 = 0;
  for (const 키 of ['최상', '무료최상']) {
    const p = 제미나이[키];
    const ok = 살아있음.has(p.model);
    if (!ok) 최악 = 1;
    console.log(`${ok ? '✅' : '🔴'} ${키}: ${p.model} / thinking_level=${p.thinking_level}` +
      (ok ? '' : ' — 이 키로는 안 보인다(모델 ID 가 낡았거나 등급 밖)'));
  }
  // 기본 픽은 존재만이 아니라 **사고 수준까지** 산다 — 목록에 있어도 파라미터가 거절되면 못 쓴다.
  const 기본 = 제미나이설정();
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${기본.model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: '1+1=? 숫자만.' }] }],
        generationConfig: { thinkingConfig: { thinkingLevel: 기본.thinking_level } },
      }),
      signal: AbortSignal.timeout(60000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      최악 = 1;
      console.log(`🔴 프로브 실패: ${기본.model}/${기본.thinking_level} → ${r.status} ${String((j.error && j.error.message) || '').slice(0, 160)}`);
    } else {
      const 사고 = j.usageMetadata && j.usageMetadata.thoughtsTokenCount;
      console.log(`✅ 프로브: ${기본.model}/${기본.thinking_level} 응답 OK · 사고 토큰 ${사고 == null ? '(미보고)' : 사고}`);
    }
  } catch (e) {
    console.error('🔴 프로브 자체가 못 돌았다(네트워크/타임아웃): ' + e.message);
    return 2;
  }
  if (최악) console.log('\n표가 낡았으면 tools/모델정책.js 의 제미나이 픽을 고친다 — 조용히 다른 모델로 돌지 않는다.');
  return 최악;
}

/* ■ 클로드 절은 없다 — 유호 확정 2026-08-13 「내가 쓰고싶은 모델을 골라서 내가 알아서 할게」.
 *   위임·에이전트는 유호님이 고른 세션 모델을 상속한다(.claude/agents 의 model 핀도 같은 날 걷었다 —
 *   예외는 유호님이 모델을 이름으로 부르는 /fable심문 하나 — 심문자.md 의 fable 핀은 그 통로라 유지).
 *   🚫 클로드 라우팅 표 재신설 금지.
 *   옛 표(기본=opus/xhigh · 짓기=fable/high)와 근거·반박 이력은 git 이 파일 직전 판에 있다. */

function 출력() {
  const 분석 = 검수선택(검수기본);
  console.log('■ 클로드 — 라우팅 없음: 유호님이 고른 세션 모델을 그대로 상속한다(유호 확정 2026-08-13)');
  console.log('\n■ 코덱스(GPT) — 이종 적대 검수');
  for (const [k, v] of Object.entries(검수선택지)) {
    console.log(`  ${k === 검수기본 ? '▶' : ' '} ${k.padEnd(5)} ${v.model} / ${v.effort}   ${v.설명}`);
  }
  console.log(`  구조화(2단계)  ${구조화설정.model} / ${구조화설정.effort}   🚫 low 로 되돌리는 재제안 금지(:222 — 반대 근거 듣고 내린 판정)`);
  console.log(`  회차           ①검수 판단 패스 ${회차기본}회(합집합) — 1회성 하향 \`--회차 1\` · 상한 ${회차상한}`);
  console.log(`  ②심문 편성     ${심문런들([]).map((p, i) => `${i + 1}회 ${p.model}/${p.effort}`).join(' · ')}`);
  console.log(`  고르는 법: node tools/codex-review.js --검수 luna   (또는 SYNK_REVIEW_PICK=luna)`);
  const 캐시 = 코덱스캐시();
  if (!캐시) console.log('  ⚠ ~/.codex/models_cache.json 이 없어 벤더 실물과 **대조하지 못했다.**');
  else {
    for (const [m, 지원] of Object.entries(코덱스효력)) {
      const 실물 = 캐시[m];
      if (!실물) { console.log(`  ⚠ ${m}: 벤더 목록에 없다(폐기됐을 수 있다)`); continue; }
      const 같음 = 실물.지원.join(',') === 지원.join(',');
      if (!같음) console.log(`  🔴 ${m}: 표=${지원.join(',')} 실물=${실물.지원.join(',')}`);
    }
  }
  console.log(`  (분석 기본 = ${분석.model}/${분석.effort})`);
  console.log('\n■ 제미나이 — 라이브 시트 구조 점검(코드 검수 아님)');
  for (const 키 of ['최상', '무료최상']) {
    const p = 제미나이[키];
    console.log(`  ${키 === 제미나이.기본 ? '▶' : ' '} ${키.padEnd(5)} ${p.model} / thinking_level=${p.thinking_level}` +
      `   API 무료등급 ${p.무료등급 ? '있음' : '**없음**(결제 필요)'}`);
  }
  console.log(`  폴백허용=${제미나이.폴백허용} — 못 쓰면 조용히 내려가지 않고 멈춘다`);
  console.log('  살아있는지 조회: node tools/모델정책.js --제미나이확인');
  return 0;
}

module.exports = {
  효력들, 코덱스효력, 검수선택지, 검수기본, 심문기본, 검수선택, 분석설정, 구조화설정, 코덱스플래그, 코덱스캐시,
  회차기본, 회차상한, 회차설정, 명시픽, 심문편성, 심문런들,
  제미나이, 제미나이사고, 제미나이설정, 제미나이키, 제미나이키경로,
};

if (require.main === module) {
  const argv = process.argv.slice(2);
  (async () => {
    try {
      process.exit(argv.includes('--제미나이확인') ? await 제미나이확인() : 출력());
    } catch (e) {
      console.error('🔴 ' + String((e && e.message) || e));
      process.exit(2);
    }
  })();
}
