---
제목: Claude Code Game Studios — 템플릿은 깔지 않고, 설계 전 「재밌나」 판정 · 미리 적는 판정 숫자와 걸린 날 · 가게 돈 지갑 · 설계만 보고 쓰는 끝 기준 시험을 싱크타운 카페 세로 조각에
공유일: 2026-10-31
종류: AI 작업 팁
대상: 싱크타운 · AI 작업 방식
언제: 그 작업 때
상태: 새로
한줄: 아이디어 한 줄(「/brainstorm 고양이 기사가 몰려오는 슬라임을 베는 2D 액션」)로 Godot 게임을 만든 릴스. 저장소(MIT 템플릿 · 11-01 별 30,862)는 에이전트 49 · 스킬 74 · 훅 15를 통째로 깔게 한다. 11-01 유호님 「우리 앱에 적용하면 어떨지」로 다시 봐도 깔지 않는다 — 만든 사람이 직접 잰 결과에서 절차를 무겁게 한 판(코드 전 문서 30개)이 눈가림 평가 · 사람 플레이 모두 꼴찌였고, 단계마다 묻고 승인받는 짜임이라 「정한 것은 묻지 않고 집행」하는 우리 방식과 반대이며, 검수자도 모두 Claude다(우리는 다른 회사 모델에 나눈다). 써 본 사람들의 불만도 「문서 · 승인만 오가고 한도를 빨리 쓴다」가 가장 많고, 최신판 실측 한 건에서 같은 기획서를 일반 Claude Code는 38초 · 약 $0.15, 템플릿은 약 19분 · 약 $5에 만들었다(웹 엔진은 받지 않는다). 가져올 것은 우리가 비싸게 배운 자리와 겹치는 넷 — 설계 전에 버리는 판으로 「재밌나」부터 판정(찻집 골목은 10-22~30 커밋 105개 동안 플레이 시험 참가자 0명으로 가다 10-31에 방향을 바꿨고, 지금은 기획 v0.6 §13의 싼 시험이 그 관문이다), 12월 세로 조각의 계속 · 바꿈 · 접음을 가를 숫자를 미리 적고 걸린 날을 재기, 가게 돈을 미니게임 공통 코인과 나눌지(미니게임 완주 보상만 하루 최대 250코인 · 지금 상점 15~220코인), 끝 기준 시험은 설계만 보고 먼저. 설계 칸 검사는 「느낌」을 숫자로 · 손잡이 안전 범위 둘만. 12월 카페 세로 조각 설계(Fable 설계 검토 전)에
링크: https://www.instagram.com/reel/De_XdbqP_RS/
게시물ID: De_XdbqP_RS
장부: 39행
---

## 무엇인가

- 클로디컬(@claudical_official)의 릴스(45.2초, 한국어 나레이션). 「아이디어 한 줄로 실제로 돌아가는 게임」 — Claude Code(v2.1.311 · Opus 5.5 · Claude Max)에 이 템플릿을 깔고 「/brainstorm 고양이 기사가 몰려오는 슬라임을 베는 2D 액션」 한 줄에서 시작해, 게임 코드도 그림 파일도 없이 고양이 기사 2D 액션을 만들었다고 한다. 본문: 「Claude Code 화면은 그 실행의 저장된 세션을 다시 연 실제 화면입니다.」
- 장면(12장 + 이번에 뽑은 1초 간격 45장):
  - README 「Why This Exists」 — 「a single chat session has no structure … skipping design docs … There's no QA pass, no design review」 → 「49 specialized agents organized into a studio hierarchy — directors who guard the vision, department leads who own their domains, and specialists who do the hands-on work. Each agent has defined responsibilities, escalation paths, and quality gates.」
  - 에이전트 파일 표 둘: creative-director(「Highest creative authority — vision, tone, aesthetic direction」 · tools Read, Glob, Grep, Write, Edit, WebSearch · model opus · maxTurns 30 · memory project), qa-tester(「Writes test cases, bug reports, and checklists」 · tools Read, Glob, Grep, Write, Edit, Bash · model inherit · maxTurns 10).
  - 전투를 맡기면 차례로 넷: game-designer(Draft slash/hitstop design doc · 5 tool uses · 40.5k tokens) → gameplay-programmer(Architecture sketch · 8 · 45.1k) → godot-specialist(Validate architecture against Godot 4.7 · 18 · 57.1k) → qa-tester(Write and run slash/hitstop QA cases · 9 · 46.5k). 전투 하나에 네 에이전트 합 약 19만 토큰이다.
  - 손맛 값: `slash_range = 96.0` · `slash_recovery = 0.25` · `hitstop_duration = 0.07` — 「칼이 닿는 순간 게임이 0.07초 멈추는 손맛」.
  - 그래픽을 맡기면 네모 도형 판이 고양이 기사 픽셀 아트(성벽 · 철창 문 · 슬라임 · Combo 숫자)로 바뀌고, 끝나면 게임을 켜서 찍은 스크린샷 18장을 「증거」로 남긴다(회색 도형 판 · GAME OVER · 점수 · 픽셀 아트 판).
  - 상태 줄이 「Minimal · 4 agents」 → 「Minimal · 5/7 stories」 — 엄격도 기본값(minimal)으로 돌렸다. 끝에 둘째 예로 「/brainstorm 우산 하나로 폭풍 속…」.
- **공식으로 찾은 것(10-31 확인):** [github.com/Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) — 「Turn Claude Code into a full game dev studio — 49 AI agents, 72 workflow skills, and a complete coordination system mirroring real studio hierarchy」. 템플릿 저장소 · MIT · 2026-02-12 생성 · 별 30,778 · 포크 4,218(영상의 「8개월 만에 별 2만 7천」은 10-27 기준).
  - 설치(README 원문 — 영상이 「고정 댓글」에 둔 세 줄): `git clone https://github.com/Donchitos/Claude-Code-Game-Studios.git my-game` → `cd my-game` → `claude`, 그다음 `/start`. 요구: Git · Claude Code · Python 3 · Bash(jq 권장), Windows는 Git for Windows. README에 「주 개발 환경은 Windows 10 + Git Bash」.
  - 짜임: 감독 3(creative-director · technical-director · producer — Opus) · 리드 8 · 전문가 23 + 엔진 전문가(Godot · Unity · Unreal과 그 하위 전문가). 나머지는 Sonnet이거나 세션 모델을 따른다. 스킬은 소개 72 · README 74(설계 · 구조 · 스토리와 스프린트 · 검토 · QA · 출시 · 팀 묶음 `/team-combat` 등), 훅 15(커밋 때 하드코딩 값 · TODO 꼴 · JSON · 설계 문서 칸 검사, 40KB 넘는 설계 문서 통째 읽기 거절 등), 경로별 규칙, 문서 틀 62, 엄격도 minimal · standard · full. 「플레이어가 보는 것을 바꾼 스토리는 게임을 켜서 보고 스크린샷을 `production/qa/evidence/`에 남겨야 닫힌다.」
  - **설계 문서 규칙** `.claude/rules/design-docs.md`(`design/gdd/**`에 걸림): 여덟 칸 — Overview · Player Fantasy · Detailed Rules · Formulas · Edge Cases · Dependencies · Tuning Knobs · Acceptance Criteria(엄격도에 따라 여덟 / 다섯 + 숫자 규칙이 있으면 Formulas / 없음). 칸마다 검사: 공식은 변수 · 예상 범위 · 예시 계산, 가장자리 경우는 무엇이 일어나는지(「알아서 처리」는 안 됨), 의존은 양쪽 문서에 다 적기, 손잡이는 안전 범위와 영향 주는 놀이 측면, 끝 기준은 QA가 통과/실패를 가를 수 있게, 균형 값은 근거 공식에 연결, 「느낌」을 말하는 막연한 문장은 명세가 아님, 칸마다 승인받고 바로 저장. 틀 `game-design-document.md`에는 Game Feel · UI Requirements · Visual/Audio Requirements 칸도 있다.
  - **balance-check 스킬**(Sonnet): 입력이 없으면 「NOT ASSESSED — NO DATA」로 멈춘다(「the answer is "could not run" — not a filled-in report」, 「Absence of evidence is never evidence of absence」). 경제 · 성장 점검 — 들어오는 곳 · 나가는 곳과 흐름, 시간에 따른 쌓임 예측, 끝없는 고리, 쓸 곳이 버는 속도를 따라가는지(「Verify gold sinks scale with gold generation」), 살 가치가 없는 물건, 오래 의미 있는 성장이 없는 빈 구간(「dead zones」), 갑자기 뛰는 구간, 몰아 하기 · 건너뛰기가 의도한 속도를 깨는지(「skip/grind strategies break intended pacing」).
- **11-01 더 읽은 것(README 나머지 · 스킬 둘):**
  - 「Does it produce games, or documents?」 — 같은 기획서 한 장으로 엄격도만 바꿔 게임 넷을 만들고 첫 코드 전에 쓴 문서 수를 셌다: minimal 1개(0분) · standard 30개(58분). 모두 돌아가고 시험을 통과했지만 눈가림 평가자 둘과 사람 플레이 시험이 standard 판을 꼴찌로 놓았다 — 「the extra 29 documents bought traceability, not a better game」. 그래서 기본값이 minimal이다(표본은 게임 넷, 게임 · 평가 원자료는 공개하지 않았다 — 저장소 안에는 README의 이 단락뿐이라 만든 사람의 자기 보고로 읽는다).
  - 「Collaborative, Not Autonomous」 — 모든 에이전트가 묻고 → 2~4안을 보이고 → 사용자가 고르고 → 초안 → 승인 뒤에만 쓴다(「nothing gets written without your sign-off」). automation `guided` · `autonomous`와 Claude Code 자동 모드로 줄일 수는 있다.
  - 훅 · 권한 규칙이 커밋 · push 자리를 잡는다 — `validate-commit.sh` · `validate-push.sh`, 메시지에 `push +` 같은 글이 들어간 git 명령까지 막는 규칙.
  - `/prototype` — 「설계 문서 전에 버리는 HTML · 엔진 · 종이 판으로 '이 핵심이 재밌나' 하나만 묻고 PROCEED / PIVOT / KILL / NOT ASSESSED」. 중간에 기능 하나를 볼 때는 4시간짜리 `--spike`.
  - `/vertical-slice` — 미리 적는 검증 질문 「아무것도 모르는 사람이 안내 없이 N분 안에 핵심 재미를 겪나 — 그리고 그 고리를 X일에 대표 품질로 만들 수 있나」, 3~5분 분량, 「내용을 깎고 품질은 깎지 않는다」, 시간 상한을 넘으면 범위가 틀린 것, 걸린 날이 진짜 생산 속도(「That's your real production rate estimate」).
  - 엔진은 「Godot · Unity · Unreal 또는 none」 — 엔진 없이도 쓸 수는 있지만 경로 규칙 · 자산 검사 · 엔진 전문가는 엔진 폴더 꼴에 맞춰 있다.

## 가져올 것

11-01에 순서를 바꿨다 — 우리가 실제로 값을 치른 자리부터.

1. **설계 전에 「재밌나」부터 판정(`/prototype`).** 설계 문서를 키우기 전에 버리는 판(HTML · 종이 · 정지 화면)으로 한 가지만 묻고, 계속 · 바꿈 · 접음을 적는다. 자료가 없으면 채운 판정 대신 「못 판정」. 찻집 골목이 이 관문 없이 아흐레를 갔다(아래 회고).
2. **세로 조각의 판정 숫자를 미리 적고, 걸린 날을 잰다(`/vertical-slice`).** 「사람이 안내 없이 핵심 재미를 겪나」와 「그 고리를 정한 날 안에 대표 품질로 만드나」를 둘 다 묻고, 무엇이 나오면 계속 · 바꿈 · 접음인지 만들기 전에 적는다. 다 만든 뒤 걸린 날 · 그림 장수 · 검수 회차가 다음 범위를 정하는 진짜 속도다.
3. **경제 점검 일곱 줄(balance-check).** 손실 없는 성장형 가게가 빠지기 쉬운 두 구멍(가게 밖 수도꼭지, 쓸 곳이 떨어진 뒤의 빈 구간)을 설계 단계에서 잡는다. 자료가 없으면 채운 보고서 대신 「못 돌림」이라고 적는 규칙도 같이 가져온다.
4. **끝 기준 시험은 설계만 보고 먼저 쓴다.** `/team-combat`의 qa-tester는 구현이 아니라 설계 문서에서 시험 사례를 쓰고 돌린다. 만든 쪽이 자기 숙제를 채점하지 않는다.
5. **설계 칸 검사는 둘만.** 「손맛 있게」 같은 말은 숫자로(이 영상의 `hitstop_duration = 0.07`), 손잡이마다 안전 범위. 10-31에 1번으로 두었던 칸마다 검사(여덟 칸 · 공식마다 예시 계산 · 칸마다 승인)는 들이지 않는다 — 템플릿 자체 측정에서 문서를 늘린 판이 꼴찌였고, 우리 찻집 골목 설계(251KB, 〔초기값〕과 G1~G12까지 갖춤)도 방향이 틀린 것은 막지 못했다.

## SYNK 적용

- **11-01 다시 판단(유호님 「우리 앱에 적용시키면 어떨지 판단해줘」).**
  - **결론:** 깔지 않는다(10-31 판단 그대로). 템플릿을 들여 얻는 것은 「구조」인데, 우리가 값을 치른 자리는 구조가 아니라 「무엇을 만들지 늦게 안 것」이었다. 그래서 가져올 것을 그 자리 넷으로 다시 골랐다(위 「가져올 것」).
  - **찻집 골목 회고 — 템플릿의 첫 관문이 우리에게 없던 자리.** 세로 조각 설계(10-22 · 251KB) → W1~W11 → 인수(10-30, 30생활일 × 씨앗 100 · 결정성 · 저장 벤치)까지 `experiences/synk-town`에 10-22~30 커밋 105개. 엔진 쪽 확인은 탄탄했지만 플레이 관찰표([DAY-PLAYTEST](../../../experiences/synk-town/qa/DAY-PLAYTEST.md) · [SUPPORT-BAZAAR](../../../experiences/synk-town/qa/SUPPORT-BAZAAR.md))는 실제 참가자 0명이었다(트랙 「W11 인수 기계 몫 — 참가자는 보류」). 방향을 바꾼 것은 유호님 눈(10-31 「정체성이 너무 여러 개」)이었고, 그 눈을 숫자로 받친 맥락 없는 시험관 시험(펠트 판 「어린이용 같다」 4 대 1, 0단계 T1에서 지금 첫 화면 6/6 「7~10세용」)은 결정 표 · 마을 시험 기록에 남은 것으로는 그날이 처음이었다. 템플릿 순서(버리는 판으로 판정 → 설계 → 세로 조각)였다면 설계 전에 물었을 질문이다. 지금은 기획 v0.6 §13(T0~T6, 싼 순서)이 그 관문이라 따로 들일 도구는 없다 — 다음 새 게임 · 새 모드(시즌 2 바깥 일, LAB 새 게임)도 이 순서로 시작한다.
  - **깔지 않는 까닭에 더한 셋.**
    1. 만든 사람이 잰 결과 — 무거운 판(문서 30개)이 꼴찌였다. 49명 위계 · 감독 검토 · 단계 관문을 다 쓰면 standard · full 쪽이라, 깔아서 우리가 얻을 몫은 기본값 minimal(기획서 한 장 → 이야기 → 만들기 ↔ 끝냄 + 켜서 보기)뿐인데 그건 지금 우리 방식과 같다.
    2. 묻고 승인받는 짜임 — 운영 원칙 「사용자가 꼭 보고 정해야 하는 일이 아니면 Claude가 판단해 집행」과 반대다. 자동 모드로 줄여도 칸마다 승인 · 감독 검토가 남는다.
    3. 우리 저장소와 같은 자리를 잡는다 — 훅 · 권한 규칙이 커밋 · push를 잡아 바로올리기 · 공개 검사([관문·자동화 한 장](../../_ops/관문_자동화.md))와 부딪치고, 따로 폴더에 깔면 우리 게임 코드(`experiences/` · play-common 지갑 · 계정 묶음)가 그 안에 없다.
  - **실제로 써 본 사람들의 반응(11-01 조사 — Sonnet 하위 에이전트가 읽고, 인용한 것은 Claude가 원문과 다시 대조).** 표본은 GitHub 이슈 68 · PR 59 · 토론 22 전수 목록(이슈 본문 약 40 · 댓글 99), Reddit 스레드 7, 블로그 · 데브로그 같은 직접 사용 글 5다. 숫자가 붙은 직접 후기는 약 10건이라 작다. Hacker News는 0건이고, X · 유튜브 댓글은 읽지 못했다.
    - **불만 셋이 가장 많다.** ① 문서 · 승인만 오가고 게임이 안 나온다 — 토론 [#13](https://github.com/Donchitos/Claude-Code-Game-Studios/discussions/13) 「Any real game output?」(추천 24, 토론 가운데 1위), 이슈 [#53](https://github.com/Donchitos/Claude-Code-Game-Studios/issues/53) 「이걸로 완성된 게임을 만든 사람이 있나」(댓글 11), [#46](https://github.com/Donchitos/Claude-Code-Game-Studios/issues/46) 「Max 20x로 3주 가까이 돌렸는데 버튼 몇 개」. ② 사용량 한도 — [#136](https://github.com/Donchitos/Claude-Code-Game-Studios/issues/136) 설계 단계 3주 프로젝트(에이전트 39, v1.1.2)에서 주간 구독 한도를 사흘 만에 다 씀. ③ 확인이 끝없다 — [#29](https://github.com/Donchitos/Claude-Code-Game-Studios/issues/29) 「확인할 것이 너무 많다」(반응 9, 추천값으로 먼저 채우는 무인 모드를 요청). 불만 다수는 기본이 무거웠던 4~9월 판 시기 글이다(9-23 v1.1.0부터 기본 minimal).
    - **최신판 실측 한 건이 우리 판단과 같은 쪽이다.** [AI Parabellum](https://aiparabellum.com/claude-code-game-studios-install-and-use/)(10-29, v1.2.0 · minimal · Sonnet 5.5 · Godot 4.7.2) — 같은 기획서로 일반 Claude Code는 38초 · 7턴 · 약 $0.15 · 사용자 메시지 1, 템플릿은 약 19분 · 266턴 · 약 $5.01 · 메시지 14(코드 전 13). 둘 다 핵심 시험(움직임 · 맞힘 · 다시 시작)을 통과했고 보기에는 일반 쪽이 나았다. minimal에서는 「49 에이전트가 돌지 않았다」(에이전트 기록이 비어 있음) — 기본값으로 깔면 얻는 것은 팀이 아니라 절차 · 훅 · 문서 틀이다. 한 건이라 확정은 아니다.
    - **호평은** 혼자면 건너뛸 설계 · 증거 절차를 강제한다는 점(토론 #135, 한국어 Threads 첫날 글 — 게임을 대신 만들어 주는 도구라기보다 프리프로덕션을 스튜디오처럼 강제하는 도구라는 평, 의역)과, 상위 요금제로 몇 주씩 Godot · Unity를 끌고 가는 소수(#34 — Max로 5시간 한도를 거의 매번 채우며 스프린트 5에 시험 1,081개, 출시까지 1년 예상 · #46 — Max 5로 엿새째 주간 100%, 다시 시작해 19일째 반쯤 되는 출시 전 판 — 스튜디오가 게임을 만들어 주는 게 아니라 사람이 지휘해야 한다는 답)다. 「한 줄로 게임」을 직접 겪었다는 후기는 못 찾았고 홍보 쇼츠만 그렇게 말한다. 이 템플릿으로 만들었다고 밝힌 출시작도 못 찾았다.
    - **웹 게임은 범위 밖이다.** `.claude/hooks/yaml-helper.sh` 547행이 엔진 이름을 `Godot|Unity|Unreal`만 받고, 웹 엔진 PR 둘([#79](https://github.com/Donchitos/Claude-Code-Game-Studios/pull/79) HTML5 · PixiJS, [#117](https://github.com/Donchitos/Claude-Code-Game-Studios/pull/117) PixiJS · Three.js)은 병합되지 않고 작성자가 스스로 닫았다. 웹을 말한 사례는 링크 없는 자가 보고 둘뿐이다.
    - **유지 위험.** 기여자 1명, 병합된 PR 9건이 모두 유지자 본인 것이고 외부 PR은 병합 0(열림 25). 5-13 v1.0.0 뒤 9-23까지 커밋이 없다가 26일 동안 릴리스 다섯 — 1.1.0은 기본 권한 모드에서 스킬 74개 가운데 66개가 시작 전에 멈춰 다음 날 고쳤고(v1.1.1 노트), 1.2.0 전까지 스킬 34개가 셸 명령을 묻지 않고 돌릴 수 있었다(v1.2.0 노트). 유지자는 2.0에서 여러 AI 도구용으로 바꾸며 이름도 바꾼다고 했다(#139 답글).
- **지금 우리 쪽과 나란히**

  | | 우리 지금 | 팁 | 나은 점 · 다른 점 |
  |---|---|---|---|
  | 역할 나누기 | [운영 원칙 역할 표](../../AI_운영원칙.md) 한 장 — 만듦은 Claude, 검수는 GPT(백엔드, 읽기 전용) · 아르곤 → Fable(화면) · Fable(큰 기능 설계), 하위 일은 Sonnet. `.claude/agents/`는 없고 Agent 도구에 모델만 정한다 | 역할 49개를 파일로(도구 · 모델 · 턴 수 · 기억 범위) — 감독 · QA까지 모두 Claude | 검수 독립은 우리 쪽이 낫다(다른 회사 모델이 본다). 역할마다 도구를 잘라 둔 것(감독은 Bash 없음)은 깔끔하지만 지금 우리에게 없는 문제다 |
  | 설계 문서 | [큰 기능의 설계 검토](../../AI_운영원칙.md) — 목적 · 사용자 흐름 · 데이터 · 바꿀 파일 · 시험 계획 · 벤치마킹 근거(칸 이름만). 찻집 골목 세로 조각은 손잡이를 `experiences/synk-town/town/data/params.json` 판(이름 · 판 번호 · 천분율, 돌린 판은 안 바꿈)으로, 끝 기준을 [TOWN-SIM](../../../experiences/synk-town/qa/TOWN-SIM.md) §15-1 지표 · `tests/town-acceptance.test.js`로 했다 | 칸마다 통과 기준(예시 계산 · 안전 범위 · 통과/실패 · 「느낌」 금지) | params.json의 판 관리는 우리 쪽이 낫다. 더할 것은 손잡이 안전 범위와 「느낌」 금지 둘이다(11-01 — 공식마다 예시 계산 · 영향 칸은 뺌, 「가져올 것」 5) |
  | 경제 · 균형 | 시뮬(`tools/town-sim.mjs` 씨앗 100 × 30일)이 반복 · 습관 · 비 지표를 본다. 돈 흐름 점검은 없다 — 가게 경제(오늘의 선택 · 돈 쓰임 · 확장)는 새로 만든다(기획 §8) | balance-check 일곱 줄 | 가게 돈을 설계하기 전 점검표 |
  | 시험 쓰기 | 마을 시험은 구현한 쪽이 쓴다. 드라마 칸 명세만 검수자가 명세를 보지 않고 쓴 시험 말로 판정한다(`tools/topik-review.mjs --드라마`, [결정](../../_ops/결정.md) 10-31) | QA 에이전트가 설계에서 사례를 쓰고 돌림 | 드라마의 눈가림을 가게 규칙에도 |
  | 화면 증거 | 헤드리스 `qa-*-ui.cjs`(찻집 115 · 채집 159 확인 등) · 화면 검수 캡처 | 켜서 찍은 스크린샷이 있어야 닫힘 | 이미 같다 |
  | 훅 · 관문 | [관문·자동화 한 장](../../_ops/관문_자동화.md) · 바로올리기 크기 알림 | 훅 15 | 통째로 들이지 않는다(아래) |

- **깔지 않는 까닭.**
  - 운영 원칙 「공식 하네스」 — 스킬 · 보조 도구는 기존 기능으로 못 푸는 반복 문제와 실제 효과가 있을 때만 더하고, 옛 자체 절차 · 훅을 새 작업의 선행 조건으로 되살리지 않는다. 에이전트 49 · 스킬 72 · 훅 15를 한꺼번에 들이는 것은 그 반대 방향이다.
  - 엔진 전문가 셋(Godot · Unity · Unreal)은 카페 기획의 「웹 화면 + 구운 그림 — 10-09 Unity 전환이 필요 없다」(기획 §3)와 맞지 않는다.
  - 1인 + AI 운영에서 감독 · 리드 · 전문가 위계와 보고 경로는 조율 비용이 크다 — 영상에서도 전투 하나에 네 에이전트 약 19만 토큰이었다.
- **직접 해 본 것 — 종이 시험(설치 없이 10분).** 위 설계 문서 규칙 여덟 칸과 balance-check 경제 일곱 줄을 [기획 v0.6](../../WORLD_게임방향_재설계_20261031.md) §4-6 「가게가 자란다」에 대 봤다.
  - **있는 칸:** 개요, 플레이어 판타지(§0 · §3 「가게가 커지고 손님이 몰려드는 맛」), 규칙 일부(§4-6 — 하루 장사로 번 코인으로 꾸미기 칸 · 테라스 · 2층 · 동료 뽑기, 큰 확장은 지원금 신청서, 타이머 · 에너지 · 열쇠 없음, 한 번 연 것은 다시 잠그지 않음), 의존(§8 지갑 · 소유 고쳐 쓸 후보), 지킬 선(§4-9).
  - **없는 칸:** 공식(하루에 버는 코인 · 물건 값 · 확장 값과 예시 계산), 손잡이와 안전 범위, 가장자리 경우, 통과/실패로 가를 끝 기준(§1 「잴 것」은 제품 지표다). 방향 기획이라 당연하고, 세로 조각 설계(§8 「선택 하나 · 결과 둘 · 돈 쓰임 하나」)에서 채울 칸이다.
  - **일곱 줄로 찾은 구멍 둘:**
    1. **가게 밖 수도꼭지.** §4-6은 「지금 WORLD 지갑의 코인」을 쓰는데, 같은 공통 코인이 미니게임 완주 · 실험 보상으로도 들어온다([play-common](../../../experiences/play-common/README.md) — 완주 15코인 · 실험 5코인, 하루 10회 한도 / [WORLD 앱](../../../experiences/synk-world-app/README.md) 10-14 기록 — 바람길 완주 「공통 코인 +25」). 코인이 이미 쌓인 계정이나 미니게임을 몰아 한 계정은 가게 확장 차례를 건너뛸 수 있다(「skip/grind strategies break intended pacing」). 미니게임은 §8에서 「따로 둠 — 뒤에 정한다」라 더 눈에 안 띈다.
    2. **쓸 곳이 떨어진 뒤.** 잃는 것이 없으니 꾸미기 · 확장을 다 산 뒤 코인이 쓸 곳 없이 쌓인다(「sinks scale with generation」 · 「dead zones」). §12 ③(손실 없는 성장형은 반복 피로에 약하다)과 §2 벤치마크(25개 가운데 15개의 불만 1위가 중반 이후 반복)가 짚은 자리와 같다. 시즌마다 새 꾸미기 · 특별 메뉴가 들어오는 속도(§4-7)와 함께 정한다.
- **넣는 곳 — 싱크타운 카페 세로 조각 설계(기획 §9 「2단계를 만들기 전에 Fable 설계 검토」 묶음을 쓸 때, 11-01에 순서를 바꿈):**
  1. **판정 숫자를 미리.** 2a의 「끝의 근거」는 지금 「가게 하루 한 벌이 돈다」(만들기 기준)뿐이다. 사람 경험 질문을 하나 더 적는다 — 초안: 「기록으로 3~4급인 학습자가 안내 없이 짧은 교대 한 벌(핵심 손님 2명)을 하고 나서, 드라마에서 배운 말을 손님에게 다시 써서 가게가 달라졌다고 자기 말로 말하나」. 2b 코호트 전에 계속 · 바꿈 · 접음을 가를 숫자(몇 명 가운데 몇 명)를 적어 둔다 — [드라마 기획](../../드라마말하기_기획.md) §8 「초기 판단 기준 — 시작 전에 목표를 적는다」(노트를 받은 참가자의 과반이 … 를 2회차를 만들지 가르는 가안으로)와 yuhobuilds 연재 시험([결정](../../_ops/결정.md) 10-31)의 「미리 정한 판정」이 이미 이 꼴이고, 기획 §9의 합치기 보류(「둘 이상이 헷갈리면」)도 그렇다. 카페 쪽에만 아직 없다. §1의 「5~10명으로 학습 효과 · 유지율을 확정하지 않는다」는 그대로 — 이 숫자는 가게를 계속 만들지만 가른다.
  2. **걸린 날을 잰다.** 2a를 만드는 데 든 날 · 그림 장수 · 승인까지 생성 횟수 · 검수 회차를 한 줄로 남겨 §10 시즌 고정비 식과 시즌 1 가게 범위의 근거로 쓴다 — 드라마 기획 §8 「두 회 제작 — 제작 시간 · 크레딧 · 최종 용량」과 같은 꼴이다(카페 쪽 §9에는 아직 없다). 시간 상한은 이미 있다(12월 3주 전에 안 서면 물러섬).
  3. **가게 돈 — 숫자로 다시 봤다.** play-common 규칙상 미니게임 한 판은 최대 25코인(완주 15 + 정답 비율 × 10)이고 하루 10회까지라, 완주 보상만 하루 최대 250코인이다. 지금 상점 값은 15~220코인(레이싱 차고 최고가 220)이다. §4-6대로 꾸미기 · 테라스 · 2층 · 동료 뽑기를 같은 코인 값으로만 매기면 가게 밖에서 하루 만에 확장 차례를 건너뛸 수 있다. 추천(세로 조각 설계에서 시뮬로 확정): 넓히기(테라스 · 2층 · 동료 뽑기)는 §4-6의 큰 확장(지원금 신청서)처럼 가게 안에서 생기는 일(특별한 날 · 단골 · 손님 수 같은 하루 장사 기록 — 학습 성적은 쓰지 않음, 싱크타운 §9 「첨삭은 생활 보상을 막지 않는다」)로 열고, 공통 코인은 꾸미기 값으로만 쓴다 — 지갑 서버는 고쳐 쓰고 속도는 가게가 쥔다. 쓸 곳이 떨어지는 빈 구간은 §4-7 시즌 꾸미기 · 특별 메뉴가 들어오는 속도와 함께 `tools/town-sim.mjs` 틀로 30일 쌓임을 그려 본다(미니게임 하루 최대치를 넣은 판 포함). 시뮬 전에는 쌓임 표를 채우지 않는다(「NOT ASSESSED — NO DATA」). 접합 시험 ④(지갑 구매 · 다시 접속 뒤 복구, §8)와 같은 회차에 본다.
  4. **끝 기준 시험은 눈가림으로.** 맥락 없는 새 에이전트(Agent 도구 한 번 — 새 실행기 없음)가 설계의 끝 기준 칸만 보고 먼저 쓰고, 구현 뒤 그대로 돌린다. 드라마 칸 명세 눈가림([결정](../../_ops/결정.md) 10-31 — 허용 표현 땜질이 두 회차 이어진 뒤 들인 방식)과 같은 원리다.
  5. **설계 칸은 둘만 본다.** 「느낌」은 숫자로 — 예: §4-3 「받아 적기를 기다리는 몇 초」의 끄덕임 · 「음…」 · 결과 카드 시각. 가게 손잡이는 찻집처럼 `params.json` 판으로 두되 손잡이마다 안전 범위를 적는다. 공식마다 예시 계산 · 칸마다 승인은 하지 않는다.
- **굳이 돌려 본다면(실험안 — 권하지는 않음).** 필요한 파일 셋(규칙 · 틀 · 점검표)은 이미 읽었다. 그래도 에이전트 묶음이 설계를 어떻게 쓰는지 보고 싶으면 저장소 밖 빈 폴더에 clone해 `/start` → `/design-system` 한 번(가게 경제, 20분 상한)만 돌리고 우리 세로 조각 설계 초안과 견준다. Godot은 깔지 않고 설계 문서에서 멈춘다. 감독 셋이 Opus로 돌아 5시간 한도를 쓰니, 그 폴더의 `settings.json`과 훅 15를 먼저 읽는다. SYNK 저장소에는 아무것도 넣지 않는다. 11-01: 「무거운 판이 더 나은가」는 만든 사람이 이미 재서 아니라고 답했으니 돌려 볼 까닭이 더 줄었다.

## 확인할 것

- **판정 숫자:** 2b 코호트 전에 계속 · 바꿈 · 접음 숫자가 설계에 적혀 있는지, 결과가 그 숫자로 갈렸는지(뒤에 숫자를 바꾸지 않았는지).
- **걸린 날:** 2a 끝에 걸린 날 · 그림 장수 · 승인까지 생성 횟수 · 검수 회차 한 줄이 남았는지, 그 줄로 시즌 1 가게 범위를 정했는지.
- **세로 조각 설계 자기 점검:** 「느낌」 말이 숫자로 바뀌었는지, 손잡이마다 안전 범위가 있는지, 끝 기준마다 통과/실패가 갈리는지 — Fable 설계 검토에 보이기 전에 표로.
- **경제:** 가게 돈과 공통 코인을 어떻게 나눴는지 결정 한 줄. 30일 시뮬에서 빈 구간(살 것이 없는 날이 이어짐)과 건너뛰기(첫 주에 확장을 다 엶 — 미니게임 하루 최대치를 넣은 판에서도)가 있는지.
- **눈가림 끝 기준:** 설계만 보고 쓴 시험이 구현 뒤 몇 개 깨지는지, 깨진 것이 설계 구멍인지 구현 구멍인지 나눠 센다.
- 직접 해 본 것은 종이 시험(10-31)과 기록 대조 · 숫자 다시 보기(11-01)까지다. 설치 · clone은 하지 않았다.

## 적용 요청문

12월 세로 조각 설계를 시작할 때(「팁 장부 39행 적용해줘」면 이대로): 「싱크타운 카페 세로 조각 2a 설계를 쓸 때 참고 카드 39행을 적용해줘 — ① 2a 끝의 근거에 사람 경험 질문 한 줄을 더하고 2b의 계속 · 바꿈 · 접음 숫자를 미리 적고 ② 2a에 걸린 날 · 그림 장수 · 생성 횟수 · 검수 회차를 남길 줄을 만들고 ③ 가게 돈과 공통 코인을 어떻게 나눌지 정해 `tools/town-sim.mjs` 틀로 30일 쌓임을 그려 보고(미니게임 하루 최대 250코인을 넣은 판 포함) ④ 끝 기준 시험은 맥락 없는 에이전트가 설계의 끝 기준 칸만 보고 먼저 쓰게 하고 ⑤ 「느낌」 말을 숫자로, 손잡이마다 안전 범위를 적어. 다 된 기준: 설계에 다섯이 다 있고 Fable 설계 검토 묶음에 함께 들어감. 작업량: 설계 쓰는 날 안에 반나절.」

## 근거

- 재료: `%LOCALAPPDATA%/hermes/cache/synk-tips/De_XdbqP_RS/` — intake.json, caption.txt, transcript.txt, frames 01~12 전부, 이번에 뽑은 more_sheet_001 · more_sheet_002(1초 간격 45장 모음 — 상태 줄 「Minimal · 4 agents」 · 「5/7 stories」, 끝의 둘째 예 「/brainstorm 우산 하나로 폭풍 속…」).
- 읽은 파일: `%LOCALAPPDATA%/hermes/skills/research/synk-tip-review/claude_review.md`, `docs/참고카드/README.md`, `docs/_ops/결정.md` 맨 위 25줄, `docs/_ops/트랙.md` 160행(싱크타운 다시 짜기) · §5 게임(218~245행), `docs/AI_운영원칙.md` 1~78행(역할 표 · 검수 · 큰 기능의 설계 검토 · 하위 일의 모델 · 공식 하네스), `docs/WORLD_게임방향_재설계_20261031.md`(§0 · §1 · §2 · §3 · §4-3 · §4-6 · §4-7 · §4-9 · §8 · §9 · §12 · §13), `experiences/synk-town/town/data/params.json`(머리 주석 · 판 구조), `experiences/play-common/README.md`(코인 보상 · 하루 한도), `experiences/synk-world-app/README.md` 221행(바람길 공통 코인 +25), `.claude/skills/`(21개 — 게임 설계용 없음) · `.claude/agents/`(없음), `tools/town-sim.mjs` · `tests/town-acceptance.test.js` · `tools/topik-review.mjs` · `tools/검수묶음.mjs`(있음 확인), `docs/참고카드/카드/2026-10-30_클라우드플레어_보안점검스킬.md`.
- 웹(10-31): [저장소 README](https://github.com/Donchitos/Claude-Code-Game-Studios)(설치 · 요구 · 짜임 · 훅 · 엄격도 · 증거 스크린샷), GitHub API(생성 2026-02-12 · 별 30,778 · 포크 4,218 · MIT · 템플릿 · 주제 godot · unity · unreal-engine 등), [`.claude/rules/design-docs.md`](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/main/.claude/rules/design-docs.md), [`.claude/docs/templates/game-design-document.md`](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/main/.claude/docs/templates/game-design-document.md), [`.claude/skills/balance-check/SKILL.md`](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/main/.claude/skills/balance-check/SKILL.md). 스킬 수는 저장소 소개(72)와 README(74)가 엇갈린다.
- 자료 속 지시: 받아쓰기 · 본문의 「설치 방법과 링크는 고정 댓글」 · 「좋아요와 팔로우」 · 「아이디어 한 줄을 건네 보세요」 — 따르지 않았다(댓글 · 팔로우 없이 공식 저장소에서 설치 명령을 찾았고, 설치하지 않았다).
- 11-01 다시 판단: GitHub API(별 30,862 · 포크 4,225 · 열린 이슈 71 · 마지막 push 10-19 「Release 1.2.0 — the main path, rebuilt and tested」, 그 앞 09-29 「1.1.2 — the default path works end to end」), README 전체(「Does it produce games, or documents?」 · 「Collaborative, Not Autonomous」 · 「Automated Safety」 · 「Customization」), [`.claude/skills/prototype/SKILL.md`](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/main/.claude/skills/prototype/SKILL.md) · [`.claude/skills/vertical-slice/SKILL.md`](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/main/.claude/skills/vertical-slice/SKILL.md)(읽기만, 받은 사본은 세션 임시 폴더). 우리 쪽: 기획 v0.6 §0 · §1 · §4-6 · §8 · §9 · §10 · §12 · §13 · §13-1 · §14, [찻집 골목 세로 조각 설계](../../디자인/싱크타운_찻집골목의하루_세로조각설계_20261022.md)(목차 · 크기), `experiences/synk-town/qa/TOWN-SIM.md` · `DAY-PLAYTEST.md` · `SUPPORT-BAZAAR.md`(실제 참가자 0명), `git log --since=2026-10-21 -- experiences/synk-town`(날짜별 커밋 수, 10-22~30 합 105), 트랙 162 · 241행, `experiences/play-common/README.md` 20 · 24 · 30 · 36 · 44 · 46행(완주 15 + 정답 비율 × 10 · 하루 10회 · 상품 값), `experiences/korean-racing/garage-core.js`(최고가 220), 결정 10-31 yuhobuilds 연재 시험 · 드라마 칸 명세 2중 검수 줄, `docs/드라마말하기_기획.md` §8(초기 판단 기준 · 두 회 제작), 운영 원칙 「비용과 권한」 위임 줄.
- 11-01 사용자 반응: Sonnet 하위 에이전트 조사(읽기만 — gh api로 이슈 68 · PR 59 · 토론 22, Reddit 7 스레드, 직접 사용 글 5 · 분석 글 5). 카드에 적은 것은 Claude가 원문과 다시 맞춰 봤다 — AI Parabellum 글의 비교 표와 「49 에이전트가 돌지 않았다」, 이슈 #29 · #34 · #46 · #53 · #136 본문 · 댓글, #139 유지자 답글, 토론 #13 제목 · 추천 수, v1.1.1 · v1.2.0 릴리스 노트, `yaml-helper.sh` 547행, PR #79 · #117 상태와 닫은 사람, 기여자 · 병합 PR 수. 토론 #13 댓글 속 숫자와 Threads 글은 조사 보고만 보고 원문은 열지 않았다. 못 읽은 곳: X · 유튜브 댓글 · Reddit 일부 댓글(차단).
