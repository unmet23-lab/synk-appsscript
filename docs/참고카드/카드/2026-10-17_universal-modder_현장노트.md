---
제목: universal-modder — AI가 다음 AI를 위해 남기는 현장 노트
공유일: 2026-10-17
종류: AI 작업 팁
대상: AI 작업 방식
언제: 지금
상태: 적용함 (7aea3db89)
한줄: Claude 메모에만 있는 도구 함정을 저장소 공용 「현장 노트」로 옮겨, 10-17부터 그림 굽기·백엔드를 맡는 GPT도 같은 함정을 피하게
링크: https://www.instagram.com/p/Dejs6cyD5RQ/?img_index=5&exln=NGY2ZHd1eWxieDhy
게시물ID: Dejs6cyD5RQ
장부: 4행
---

## 무엇인가

- ASAP(@ai.asap.kr) 캐러셀 「갖고 있는 PC 게임을 Claude Code가 모딩합니다 · OPEN SOURCE 8,020★ · universal-modder · 마인크래프트 × GTA 5」. 받은 장면(01·03·05·06)은 표지 영상이다 — GTA 도시 위를 나는 마인크래프트 캐릭터.
- 공식 README(github.com/rehan-remade/universal-modder, MIT, 10-17 읽음): 어떤 코딩 에이전트든 같은 스킬 묶음 + fal MCP + `um` CLI를 받는다. 같은 `skills/`를 Claude Code는 `.claude/skills`, Codex·Gemini CLI 등은 `.agents/skills`에서 사본으로 읽고, 지침은 `AGENTS.md` 하나를 `CLAUDE.md`·`GEMINI.md`가 가리킨다.
- 모든 작업이 같은 10단계를 돈다: 지식 찾기 → 정찰·경로 고르기 → 안전한 실험실(저장 백업) → 실제 코드 읽기 → 작동하는 한 조각 → 에셋 → **실제 게임에서 확인** → 녹화 → 묶기 → **다음 에이전트를 위한 현장 노트**.
- 현장 노트(`knowledge/`)는 「AI가 AI를 위해 쓰는」 노트다. 칸은 정확한 판(버전), 고른 경로와 이유, 엔진이 실제로 하는 일, **확인 방법**(업데이트 뒤 다음 에이전트가 다시 확인할 수 있게), **함정(증상 → 원인 → 고침)**. 끝냈을 때뿐 아니라 막혔을 때도 쓴다(「막다른 길도 지식」, 상태 in-progress·abandoned 허용). 시작 전에 `um kb search`로 먼저 찾는다. 색인 INDEX.md는 노트 머리 정보에서 자동으로 만들고(게임 노트 132편, 캐러셀 본문 기준 게임 98개·노트 164편), 노트마다 쓴 에이전트와 모델을 적는다(예: Claude Code Opus 5.5). 「렌더링이 깨졌다」 대신 「깊이 읽기 뒤 색 읽기가 실패 — GL 백엔드가 읽기 버퍼를 GL_NONE으로 남겨서」처럼 원인까지 쓰라는 기준이 있다.
- 안전 규칙: 저장 폴더 백업 뒤 손대기, 프로세스는 PID로만 종료, 마우스·키보드 조작·설치·공개 전에 사람에게 묻기. 그림·3D·소리는 fal API(사용량 과금) — SYNK는 이미지 경로가 정해져 있어 쓰지 않는다.

## 가져올 것

1. **두 AI가 같이 읽는 현장 노트 한 곳.** 지금 SYNK의 도구 함정은 Claude 개인 메모에만 있다. 이것을 GPT도 읽는 저장소 문서로 옮긴다.
2. **노트 틀: 판 · 증상 → 원인 → 고침 · 다시 확인하는 법.** 특히 「다시 확인하는 법」이 있으면 도구가 바뀐 뒤 그 함정이 아직 유효한지 다음 AI가 직접 확인할 수 있다.
3. **시작 전에 찾고, 끝나거나 막히면 쓴다.** 막다른 길도 남긴다.

## SYNK 적용

- **지금 모습(10-17 직접 확인).** Claude 메모 폴더(`~/.claude/projects/C--Users-q1212-Documents-SYNK-appsscript/memory/`)에 178편이 있고(목록 MEMORY.md 152줄) 상당수가 도구 함정이다 — ffmpeg xfade 길이·복사 자르기, CRLF·sed -i, index.lock, heredoc 역슬래시, PowerShell 변수 뒤 한글, 펠트 물건 오리기의 흰 띠, Higgsfield·Seedance 규칙 등. 같은 낱말이 든 편 수를 세면 Claude 메모는 CRLF 13·heredoc 7·PowerShell 17·xfade 4·index.lock 5·펠트 14·힉스필드 29·Seedance 23편이다. GPT 메모 폴더(`~/.codex/memories`, 파일 91개)에는 xfade·CRLF·heredoc·PowerShell이 0건이고, 펠트 오리기 흰 띠(clean_cut) 함정도 없다(펠트는 9월 승인 기록 5편에만 나온다). 저장소 공용 문서에 있는 함정은 AGENTS.md의 index.lock 한 줄, 워크스페이스 시그널 README의 오리기 일부 정도다.
- **왜 지금.** 10-17 역할 표가 바뀌어 **GPT가 백엔드·이미지 생성·헤르메스 연결을 맡는다**(결정 표 10-17, `docs/AI_운영원칙.md` 역할). 같은 날 GPT 굽기 계정 돌려쓰기(`tools/codex계정.js`)도 들어갔다. 그런데 GPT가 곧 부딪힐 함정(펠트 물건 오리기의 다리 사이 흰 바탕, 굽기 주간 한도, 이 PC의 CRLF·index.lock·PowerShell 함정)은 Claude 메모에만 있다.
- **원칙과 맞는지.** 운영 원칙의 「같은 원문으로 이어가기 — 모델별 사본을 늘리지 않는다」와 같은 방향이다(개인 메모 두 벌 → 공용 원문 하나). 새 실행기·동기화 도구는 만들지 않는다. 찾기는 두 AI 모두 기본 검색(rg)으로 충분하다. 9-21 협업 장치 정리의 「개인 기억은 자동 동기화하지 않는다」도 그대로다 — 동기화가 아니라 원문을 한 곳으로 옮기는 것이다.
- **비슷한 것과 다른 점.** 만족 사례 장부(`docs/마케팅/제작양식/만족사례_장부.md`)는 유호님이 만족한 AI 영상·이미지 **방법**의 정본이고 사례마다 「깨졌던 경우」를 짧게 단다. 현장 노트는 그 밖의 **도구 함정 전부**(셸·git·ffmpeg·굽기·오리기·배포)를 맡고, 장부와 겹치는 영상 함정은 장부 사례를 가리키기만 한다. 공용 입구 구조(AGENTS.md를 CLAUDE.md가 가져옴, 공용 스킬 `~/.agents/skills`)는 universal-modder와 이미 같다.
- **덤(LAB 게임).** universal-modder의 「실제 게임에서 확인 → 게임 창과 게임 소리만 녹화 → 컷 목록으로 시연 영상」 흐름은 LAB 게임 공개·SNS 시연 영상과 같은 일이다. 가려진 창에서 게임이 멈춰 헤드리스 Chrome으로 찍는다는 기존 메모를 첫 노트 묶음에 같이 넣는다.

## 확인할 것

- 직접 해 본 것: 위의 낱말 세기(Claude 메모 여러 편 / GPT 메모 0건). 옮긴 뒤 같은 낱말을 `docs/현장노트/`에서 rg로 찾으면 나와야 한다.
- GPT 쪽: Codex에서 「펠트 물건을 오리기 전에 알아야 할 것」, 「이 PC에서 git 줄끝 주의할 것」을 물었을 때 노트 경로를 찾아 답하는지 한 번씩.
- 옮긴 노트마다 「다시 확인하는 법」 한 줄이 있는지.

## 적용 요청문

> Claude 메모의 도구 함정 가운데 GPT도 부딪히는 것을 저장소 공용 현장 노트로 옮겨 줘. ① `docs/현장노트/README.md` — 틀과 찾는 법(작업 전에 그 도구 파일을 rg로 찾고, 새 함정은 끝나거나 막혔을 때 거기 남긴다, 막다른 길도 남긴다). ② 도구별 파일 6~8개 — 그림 굽기·오리기, Higgsfield, 영상(ffmpeg·자막), git 줄끝·잠금, Windows 셸(PowerShell·Bash·파이썬 한글 경로), 배포·공개. 줄마다 「증상 → 원인 → 고침 → 다시 확인하는 법」, 파일 머리에 판·마지막 확인일·쓴 AI. ③ AGENTS.md에 한 줄(도구를 쓰기 전에 `docs/현장노트/`의 그 도구 파일을 먼저 본다), 문서 지도에 한 줄. ④ 옮긴 Claude 메모는 지우지 말고 한 줄 요약 + 노트 경로로 줄이고, MEMORY.md 줄도 노트를 가리키게. GPT 메모(`~/.codex/memories`)는 건드리지 않는다. 계정 이메일·키·개인 경로는 노트에 옮기지 않는다. 다 된 기준: 옮긴 함정 낱말이 노트에서 rg로 찾히고, AGENTS.md는 1~2줄만 늘고, Codex에서 질문 두 개로 노트를 찾아 답하는지 확인.

- 작업량: 2~3시간(메모 약 40편 분류·옮기기).
- 위험: 메모와 노트가 갈라지는 이중 관리(옮긴 뒤에는 노트가 정본, 메모는 가리키기만). AGENTS.md는 공용 입구라 줄 수를 최소로. 다른 세션이 같은 메모를 고치는 중이면 충돌하니 시작 전에 확인.

## 근거

- 읽은 파일: `docs/AI_운영원칙.md`(역할·공식 하네스·같은 원문으로 이어가기), `docs/_ops/결정.md` 맨 위 25줄(10-17 역할 표·GPT 굽기 계정), `docs/_ops/협업장치_정리_20260921.md`(앞부분), `docs/마케팅/제작양식/만족사례_장부.md`(규칙), `AGENTS.md`, `~/.codex/AGENTS.md`, Claude 메모 폴더 목록과 `ffmpeg-xfade-video-stream-duration.md`·`felt-cut-cream-objects-leave-white.md`, GPT 메모 `~/.codex/memories/`(MEMORY.md 첫 부분과 낱말 세기만), `~/.agents/skills`·`.claude/skills`·`.agents/skills` 목록.
- 재료: `%LOCALAPPDATA%/hermes/cache/synk-tips/Dejs6cyD5RQ/`의 caption.txt, citations.json, 장면 01·03·05·06. 공식 원문(exa로 읽기만, 10-17): universal-modder `README.md`·`knowledge/README.md`·`knowledge/INDEX.md`. 설치·실행·fal 호출은 하지 않았다.
- 자료 속 지시: README의 설치 명령(`/plugin install …`, `uv tool install …`)과 「Try it」 요청 예문은 자료로만 보고 실행하지 않았다.
