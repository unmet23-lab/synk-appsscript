# 튜터 선택의 계정 저장 · 2026-10-12

고른 튜터를 기존 생활 학습 계정 기록에 함께 저장하고, 같은 계정의 다른 브라우저에서 불러오도록 연결했다. 로그인한 사용자의 선택은 `synk.life-korean.progress.v1` 안의 선택 필드가 기준이다. 비회원 선택과 계정별 로컬 사본은 분리한다. 서버에 선택이 없을 때만 기존 계정별 기기 선택을 옮기며, 오래된 로컬 선택으로 서버 선택을 덮지 않는다.

## 저장 범위와 보존 기준

| 기록 | 현재 저장 범위 |
|---|---|
| 함께할 마린·까몽·몽글 선택 | 로그인한 계정의 기존 생활 기록, 비회원은 해당 기기 |
| 생활 한국어·카페 진도, 첫 응답, 도움 여부, 복습 일정 | 기존 계정 저장 계약 유지 |
| 홈·일일 기록의 어려운 표현과 함께 연습한 튜터 | 기존 생활 기록을 읽으며 실제 도움의 `tutorId` 보존 |
| 게임 조작 연습 완료·최근 어려움/힌트 | 기기 안 계정·튜터·게임별 저장 유지 |
| 반응 소리 설정 | 해당 기기 설정 유지 |

튜터 선택만 바꿔도 첫 오답, 도움 여부, 점수나 복습 일정, 과거 함께 연습한 튜터가 다시 기록되지 않는다. 선택 저장은 기존 계정 검증·전송 대기함·충돌 확인을 재사용한다. 연결 대기 중 보관된 선택과 계정 저장 완료는 서로 다른 문구로 표시한다. 저장 공간 부족으로 보관하지 못하면 선택 초안과 재시도 화면을 유지한다.

계정 로딩·변경 중 늦게 끝난 저장이 다른 계정이나 새 선택 화면을 덮지 않도록 확인한다. 원격 선택 적용은 계정으로 다시 쓰는 이벤트를 발생시키지 않는다. 서버 선택을 읽는 동안 열어 둔 소개의 초안·후속 행동도 보존한다. 독립 마루의 생활 번들은 같은 소스로 다시 빌드했다.

## 로컬 검증

서버 `http://127.0.0.1:4316`과 전용 PGlite 자료 `.tmp/tutor-selection-sync-20261012/db`의 합성 계정을 사용했다. 실제 계정과 설치형 앱을 조작하는 시험이 아니다.

| 검사 | 통과 | 근거 |
|---|---:|---|
| 두 독립 브라우저의 통합 흐름 | 44/44 | [실행 코드](browser.cjs), [결과](browser-result.json) |
| 계정 저장·기존 생활 기록 회귀 | 48/48 | [튜터 저장](../tutor-selection-store.test.mjs), [생활 저장](../life-progress-store.test.mjs), [일일 튜터 저장](../daily-tutor-store.test.mjs), [생활 진도](../life-progress.test.mjs), [일일 진도](../life-daily-progress.test.mjs) |
| 선택 동기화·창 복귀 경계 | 16/16 | [동기화 시험](../tutor-selection-sync.test.mjs) |
| 첫 만남 선택과 비동기 저장 | 12/12 | [기존 선택 시험](../../../brand-opening/qa/tutor-choice.test.mjs), [비동기 선택 시험](../../../brand-opening/qa/tutor-choice-sync.test.mjs) |
| 문서·기억 귀속 | 10/10 | [문서 시험](../document.test.mjs), [튜터 교체 기억 시험](../../../brand-opening/qa/tutor-switch-memory.test.mjs) |

창에 다시 돌아오는 경우의 회귀 3개를 더해 관련 회귀 검사는 86개, 통합 브라우저의 관찰 항목은 별도 44개다. 같은 검증을 중복 합산하지 않는다.

48개 저장·기존 생활 회귀의 실행 명령:

```powershell
node --test experiences/synk-world-app/qa/tutor-selection-store.test.mjs experiences/synk-world-app/qa/life-progress-store.test.mjs experiences/synk-world-app/qa/daily-tutor-store.test.mjs experiences/synk-world-app/qa/life-progress.test.mjs experiences/synk-world-app/qa/life-daily-progress.test.mjs
```

두 브라우저에서는 마린 저장 → 다른 브라우저의 오래된 몽글 선택을 무시하고 마린 복원 → 까몽으로 변경 → 첫 브라우저에서 까몽 복원 → 몽글로 변경 → 로컬 선택 사본 삭제 후 계정에서 몽글 복원 → 로그아웃·재로그인을 확인했다. 게스트의 별도 몽글 선택과 다른 합성 계정의 빈 기록도 확인했다.

세 튜터 각각 홈·생활 한국어·카페의 정본 대사와 표정 자산, 첫 문장 게임과 시범 화면을 확인했다. 최초 오답·도움·복습 일정·일일 기억은 선택 변경 전후에 동일했다. JavaScript 오류, 누락 자산, 외부 요청은 모두 0이다. 화면 14장을 저장했고 대표 홈·카페·게임 화면을 시각 검수했다.

- [까몽 홈](kkamong-home.png)
- [몽글 카페](mongle-cafe.png)
- [마린 게임 시범](marin-game.png)
- [재로그인 후 홈](relogin-home.png)

## 공개 반영과 실제 계정 확인

공개 저장소에 선택 연결 파일 8개를 `3929ca8e49e61ac8f40c4d6af66f89f34db88183`으로 반영했다. 창이 계속 보이는 상태로 웹과 PC 사이를 오갈 때도 새 선택을 불러오도록 focus 처리를 추가하고 `5c79e12c0cdcffdd4ed25c9faafc87c0ab1fc530`으로 후속 반영했다. [최초 배포](publication.json), [후속 배포](public-focus.json), [최종 HTTPS 8개 크기·SHA-256 일치](public-focus-http.json), [최종 Pages·공개 CI 성공](public-focus-checks.json)을 확인했다. 이전 버전의 배포 점검 CI는 후속 push 뒤 취소됐고 최종 버전 CI는 성공했다.

실제 계정의 웹·설치된 PC WORLD 0.4.2에서 로그인과 기존 까몽·학습 1/22·오늘 표현 3개·다음 「이름표를 찾아서」를 확인했다. 이후 브라우저 조작 연결이 사라지고 PC 조작 도구의 창 조회가 시간 초과되어, 실제 웹 ↔ PC 선택 변경의 양방향 확인은 아직 끝내지 못했다. [관찰 범위](real-account.json). 로컬 합성 계정의 44개 통과 결과를 실제 계정 검증으로 대신하지 않는다. 실제 확인은 웹에서 마린 선택 → PC 복원 → PC에서 까몽 선택 → 웹 복원 순서로 남아 있다. 앱 설치 파일 교체는 필요 없으며 설치된 0.4.2가 갱신된 공개 화면을 사용한다.
