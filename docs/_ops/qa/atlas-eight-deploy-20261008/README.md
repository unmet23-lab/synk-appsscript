# Atlas 배포 후보와 최종 검수 대기 — 2026-10-08

사용자 「배포해」에 따라 앞서 푸시한 수정의 실제 소비처와 최신 운영판을 확인하고 배포 후보를 준비했다. **외부 배포·기본 브랜치 변경·DB 변경·회사 서버 재시작은 아직 하지 않았다.**

## 최종 검수 상태

[AI 운영 원칙](../../../AI_운영원칙.md)의 공개 결과 Claude 최종 검수 조건에 따라 공식 Claude Code 2.1.292, `--model claude-opus-5-5 --effort max`를 실행했다. 구독 OAuth(Max)·초기 모델은 확인했으나 주간 사용량 한도로 실제 모델 응답과 검수가 없었다. CLI는 `is_error: true`, synthetic 응답, 빈 modelUsage를 반환했다. 표시된 재개 시각은 **2026-10-12 19:00 Asia/Seoul**이다. 결과의 subtype만 success여도 검수 통과로 취급하지 않았다.

[검수 시도 결과](claude-review-result.json). 다른 모델·별도 과금 API로 전환하지 않았다. 사용자가 이번 배포의 최종 검수 예외를 명시하거나 지정 Claude 검수가 실제 완료되어야 배포를 이어간다. 재개 전 각 원격 기본 브랜치를 다시 가져와 후보와 비교한다.

## 후보와 검증

- 정본: 최신 `origin/master b9bd8d7b7`에 수정 커밋을 합친 `001d225cfd532bfedfc92ab542f0f60b16f1a3f2`, 로컬 `codex/atlas-eight-release-20261008`. 최신 Care·josa·공유판 기능을 보존했다. **72시험 파일 851/851**, 상담 브라우저8경로, 로컬 학습10번들·파일사본7개, 모델 동결6개 해시 확인. 초기1개 실패는 기존 checkout의 CRLF와 새 LF 속성 차이였고, Git blob과 같은 LF 바이트로 맞춘 뒤 통과했다. 코드나 Git diff는 바뀌지 않았다.
- Talk: 최신 원격 `b3ffe17` 위의 `1d6daa89cdba690b6da507cdfdcea89fbdfb3abf`. **기능81/81·배포 도구105/105**. 대상은 `synk-account`, `synk-learning` 2개 함수이며 리허설→운영 순서다. 원격의 최신 Strata 예문 생성기를 사용했고 DB migration은 없다. 운영·리허설 진입점4개 전체 원문 및 컴파일 AST 일치, 익명 GET4개401·OPTIONS4개204. 인증·CORS 유지 확인이며 실제 계정 동기화 왕복 검증을 대신하지 않는다.
- 공개 website: `synk-policy/main 3b3aacf` 위에서 **엔진14개와 캐시 참조20개**를 교체한 후보. 게임8·여행 Core1·컴퓨터/회의/manual Core3·계정2 번들이다. 기존 Care와 나머지 여행 모듈은 같아 유지했다. 학습 소비처10곳 저장·재열기 및 Core4곳 기록/재생 **24검사 통과**. [최종 검증](public-final-validation.json)에서 정본 소비처24개·변경34개·캐시 참조26개의 해시, 현재 공개 기준 HTTP50/50을 확인했다. 1280/390px에서 게임8개의 시작·기록, 계정2개 익명 화면, 맞춤도구3개의 완료·피드백·재열기, 여행 조건·추천 재열기와 기존 페이지를 포함한 [31개 화면 경로](public-browser-combined.json)를 확인했다. [최초 화면 검사](public-browser-first.json)에서 남은 하네스 가정을 수정한 뒤 [나머지10경로](public-browser.json)를 통과했으며 제품 코드는 추가로 수정하지 않았다. 실제 원격 계정에 로그인하거나 유료 호출은 하지 않았다.
- private website: 기존 `bff0f32` 보존 커밋을 기준으로 별도 checkout에서 확인한다. 공개 후보는 현재 공개판에서 만들었으므로 private staging 전체를 복사하거나 게임 화면을 재생성하지 않았다.

## 범위와 남은 일

회사 상담 서버는 127.0.0.1:4191/4197의 로컬 도구다. 정적 Atlas/Lab 파일은 현재 소스와 일치하나, 10-06부터 실행 중인 서버 프로세스의 모델 해석기는 재시작되지 않았다. 공용 dirty 소스를 그대로 재시작하면 다른 작업까지 활성화하므로 이번 공개 배포 완료로 묶지 않는다. 기존 계정·키·DB·메신저 데이터는 읽거나 바꾸지 않았다.

Hangul은 현재 공개 경로가 없으므로 새로 공개하지 않았다. PATH VR·Desktop은 로컬/개발 준비 범위를 유지한다. Apps Script 배포 파일 변화가 없어 clasp는 실행하지 않았다. Prism의 실제 운영 집계, 유료 모델 평가, 실제 학습 효과·실기기 장시간 시험·라디오 청취는 이 결과에 포함하지 않는다.

최종 검수 조건 해결 후: 원격 최신판 대조 → 정본/private 소스 통합 → Talk 리허설2함수 및 원격 소스 확인 → Talk 운영2함수 및 원격 소스 확인 → 공개 main 반영/Pages 완료 → 실제 공개 파일 해시·화면·기록 동작 확인 순서로 이어간다. 각 단계의 성공을 별도로 기록하며 후보 준비를 배포 완료로 보고하지 않는다.

## 재개 위치

- 정본: `C:/Users/q1212/.codex/worktrees/atlas-eight-release/SYNK-appsscript`
- Talk: `C:/Users/q1212/Documents/SYNK-appsscript/.tmp/atlas-eight-fix-20261008/talk-push-worktree`
- 공개: `C:/Users/q1212/Documents/SYNK-appsscript/.tmp/atlas-eight-deploy-20261008/public-candidate`
- private website: `C:/Users/q1212/Documents/SYNK-appsscript/.tmp/atlas-eight-deploy-20261008/website-candidate`
- 이번 원본 로그·검사 스크립트: `.tmp/atlas-eight-deploy-20261008/`
- Talk 배포 명령·대조: [배포 계획](talk-deploy-plan.json), [원격 사전 대조](talk-deploy-before.json), [진입점](talk-entrypoint-comparison.json), [익명 입구](talk-anonymous-ingress.json)
