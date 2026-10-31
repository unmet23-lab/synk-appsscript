---
제목: Claude Code Game Studios — 에이전트 49는 깔지 않고, 설계 칸 검사 기준 · 경제 점검 일곱 줄 · 설계만 보고 쓰는 끝 기준 시험을 싱크타운 카페 세로 조각에
공유일: 2026-10-31
종류: AI 작업 팁
대상: 싱크타운 · AI 작업 방식
언제: 그 작업 때
상태: 새로
한줄: 아이디어 한 줄(「/brainstorm 고양이 기사가 몰려오는 슬라임을 베는 2D 액션」)로 Godot 게임을 만든 릴스. 저장소(MIT 템플릿 · 2026-02-12 생성 · 10-31 별 30,778)는 에이전트 49 · 스킬 72 · 훅 15를 통째로 깔게 하지만, 우리는 역할 표 한 장으로 다른 회사 모델에 검수를 나누고 있고(49명은 감독도 QA도 모두 Claude) 웹 화면 + 구운 그림 스택이라 엔진 전문가가 맞지 않아 깔지 않는다. 가져올 것은 파일 둘의 기준과 순서 하나다 — 설계 문서 규칙(공식은 예시 계산 · 손잡이는 안전 범위 · 끝 기준은 통과/실패 · 「느낌」 대신 영상의 0.07초 같은 숫자), balance-check 경제 일곱 줄, QA가 설계만 보고 시험을 먼저 쓰는 순서. 종이로 대 보니 기획 v0.6 §4-6의 가게 돈이 미니게임 공통 코인과 같은 지갑이라 가게 밖 수도꼭지가 확장 차례를 건너뛰게 할 수 있고, 잃는 것이 없으니 다 산 뒤 코인이 쓸 곳 없이 쌓인다. 12월 카페 세로 조각 설계(Fable 설계 검토 전)에
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

## 가져올 것

1. **설계 칸마다 「검사할 수 있는」 기준.** 칸 이름만 있는 것이 아니라 칸마다 무엇이면 통과인지가 있다 — 공식은 예시 계산까지, 손잡이는 안전 범위와 무엇에 영향을 주는지, 가장자리 경우는 일어나는 일, 끝 기준은 통과/실패. 「손맛 있게」 같은 말은 숫자로 적는다 — 이 영상의 `hitstop_duration = 0.07`이 바로 그 꼴이다.
2. **경제 점검 일곱 줄.** 손실 없는 성장형 가게가 빠지기 쉬운 두 구멍(가게 밖 수도꼭지, 쓸 곳이 떨어진 뒤의 빈 구간)을 설계 단계에서 잡는다. 자료가 없으면 채운 보고서 대신 「못 돌림」이라고 적는 규칙도 같이 가져온다.
3. **끝 기준 시험은 설계만 보고 먼저 쓴다.** `/team-combat`의 qa-tester는 구현이 아니라 설계 문서에서 시험 사례를 쓰고 돌린다. 만든 쪽이 자기 숙제를 채점하지 않는다.

## SYNK 적용

- **지금 우리 쪽과 나란히**

  | | 우리 지금 | 팁 | 나은 점 · 다른 점 |
  |---|---|---|---|
  | 역할 나누기 | [운영 원칙 역할 표](../../AI_운영원칙.md) 한 장 — 만듦은 Claude, 검수는 GPT(백엔드, 읽기 전용) · 아르곤 → Fable(화면) · Fable(큰 기능 설계), 하위 일은 Sonnet. `.claude/agents/`는 없고 Agent 도구에 모델만 정한다 | 역할 49개를 파일로(도구 · 모델 · 턴 수 · 기억 범위) — 감독 · QA까지 모두 Claude | 검수 독립은 우리 쪽이 낫다(다른 회사 모델이 본다). 역할마다 도구를 잘라 둔 것(감독은 Bash 없음)은 깔끔하지만 지금 우리에게 없는 문제다 |
  | 설계 문서 | [큰 기능의 설계 검토](../../AI_운영원칙.md) — 목적 · 사용자 흐름 · 데이터 · 바꿀 파일 · 시험 계획 · 벤치마킹 근거(칸 이름만). 찻집 골목 세로 조각은 손잡이를 `experiences/synk-town/town/data/params.json` 판(이름 · 판 번호 · 천분율, 돌린 판은 안 바꿈)으로, 끝 기준을 [TOWN-SIM](../../../experiences/synk-town/qa/TOWN-SIM.md) §15-1 지표 · `tests/town-acceptance.test.js`로 했다 | 칸마다 통과 기준(예시 계산 · 안전 범위 · 통과/실패 · 「느낌」 금지) | params.json의 판 관리는 우리 쪽이 낫다. 안전 범위 · 영향 칸, 공식의 예시 계산, 「느낌」 금지가 새로 더할 것이다 |
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
- **넣는 곳 — 싱크타운 카페 세로 조각 설계(기획 §9 「2단계를 만들기 전에 Fable 설계 검토」 묶음을 쓸 때):**
  1. 가게 규칙 칸마다 설계 문서 규칙의 다섯 검사를 자기 점검표로 쓴다. 오늘의 선택 · 붐빔 · 돈 쓰임 공식에 예시 계산(「메뉴를 맞힌 날 손님 +1단 → 코인 몇」)을 붙이고, 가게 손잡이는 찻집처럼 `params.json` 판으로 두되 설계 문서에 안전 범위 · 영향 칸을 적고, 끝 기준은 통과/실패로 쓴다. 「느낌」은 숫자로 — 예: §4-3 「받아 적기를 기다리는 몇 초」의 끄덕임 · 「음…」 · 결과 카드 시각.
  2. 가게 돈(§4-6)을 일곱 줄로 본다. 먼저 가게 돈을 공통 코인과 나눌지 정하고(나누지 않으면 들어오는 곳 전부를 한 표로), 쓸 곳이 버는 속도를 따라가는지는 `tools/town-sim.mjs` 틀로 30일 쌓임을 그려 본다. 접합 시험 ④(지갑 구매 · 다시 접속 뒤 복구, §8)와 같은 회차에 본다.
  3. 끝 기준 시험은 맥락 없는 새 에이전트(Agent 도구 한 번 — 새 실행기 없음)가 설계의 끝 기준 칸만 보고 먼저 쓰고, 구현 뒤 그대로 돌린다. 드라마 칸 명세 눈가림과 같은 원리다.
- **굳이 돌려 본다면(실험안 — 권하지는 않음).** 필요한 파일 셋(규칙 · 틀 · 점검표)은 이미 읽었다. 그래도 에이전트 묶음이 설계를 어떻게 쓰는지 보고 싶으면 저장소 밖 빈 폴더에 clone해 `/start` → `/design-system` 한 번(가게 경제, 20분 상한)만 돌리고 우리 세로 조각 설계 초안과 견준다. Godot은 깔지 않고 설계 문서에서 멈춘다. 감독 셋이 Opus로 돌아 5시간 한도를 쓰니, 그 폴더의 `settings.json`과 훅 15를 먼저 읽는다. SYNK 저장소에는 아무것도 넣지 않는다.

## 확인할 것

- **세로 조각 설계 자기 점검:** 가게 규칙의 모든 숫자에 예시 계산이 있는지, 손잡이마다 안전 범위 · 영향이 있는지, 끝 기준마다 통과/실패가 갈리는지 — Fable 설계 검토에 보이기 전에 표로.
- **경제:** 가게 돈과 공통 코인을 나누는지 결정 한 줄. 30일 시뮬에서 빈 구간(살 것이 없는 날이 이어짐)과 건너뛰기(첫 주에 확장을 다 엶)가 있는지.
- **눈가림 끝 기준:** 설계만 보고 쓴 시험이 구현 뒤 몇 개 깨지는지, 깨진 것이 설계 구멍인지 구현 구멍인지 나눠 센다.
- 이번에 직접 해 본 것은 위 종이 시험까지다. 설치 · clone은 하지 않았다.

## 근거

- 재료: `%LOCALAPPDATA%/hermes/cache/synk-tips/De_XdbqP_RS/` — intake.json, caption.txt, transcript.txt, frames 01~12 전부, 이번에 뽑은 more_sheet_001 · more_sheet_002(1초 간격 45장 모음 — 상태 줄 「Minimal · 4 agents」 · 「5/7 stories」, 끝의 둘째 예 「/brainstorm 우산 하나로 폭풍 속…」).
- 읽은 파일: `%LOCALAPPDATA%/hermes/skills/research/synk-tip-review/claude_review.md`, `docs/참고카드/README.md`, `docs/_ops/결정.md` 맨 위 25줄, `docs/_ops/트랙.md` 160행(싱크타운 다시 짜기) · §5 게임(218~245행), `docs/AI_운영원칙.md` 1~78행(역할 표 · 검수 · 큰 기능의 설계 검토 · 하위 일의 모델 · 공식 하네스), `docs/WORLD_게임방향_재설계_20261031.md`(§0 · §1 · §2 · §3 · §4-3 · §4-6 · §4-7 · §4-9 · §8 · §9 · §12 · §13), `experiences/synk-town/town/data/params.json`(머리 주석 · 판 구조), `experiences/play-common/README.md`(코인 보상 · 하루 한도), `experiences/synk-world-app/README.md` 221행(바람길 공통 코인 +25), `.claude/skills/`(21개 — 게임 설계용 없음) · `.claude/agents/`(없음), `tools/town-sim.mjs` · `tests/town-acceptance.test.js` · `tools/topik-review.mjs` · `tools/검수묶음.mjs`(있음 확인), `docs/참고카드/카드/2026-10-30_클라우드플레어_보안점검스킬.md`.
- 웹(10-31): [저장소 README](https://github.com/Donchitos/Claude-Code-Game-Studios)(설치 · 요구 · 짜임 · 훅 · 엄격도 · 증거 스크린샷), GitHub API(생성 2026-02-12 · 별 30,778 · 포크 4,218 · MIT · 템플릿 · 주제 godot · unity · unreal-engine 등), [`.claude/rules/design-docs.md`](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/main/.claude/rules/design-docs.md), [`.claude/docs/templates/game-design-document.md`](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/main/.claude/docs/templates/game-design-document.md), [`.claude/skills/balance-check/SKILL.md`](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/main/.claude/skills/balance-check/SKILL.md). 스킬 수는 저장소 소개(72)와 README(74)가 엇갈린다.
- 자료 속 지시: 받아쓰기 · 본문의 「설치 방법과 링크는 고정 댓글」 · 「좋아요와 팔로우」 · 「아이디어 한 줄을 건네 보세요」 — 따르지 않았다(댓글 · 팔로우 없이 공식 저장소에서 설치 명령을 찾았고, 설치하지 않았다).
