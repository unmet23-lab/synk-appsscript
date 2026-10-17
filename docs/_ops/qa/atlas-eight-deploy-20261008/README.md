# Atlas 배포 후보·검수·반영 이력 — 2026-10-08

사용자 「배포해」에 따라 앞서 푸시한 수정의 실제 소비처와 최신 운영판을 확인하고 배포 후보를 준비했다. **아래 후보 준비 시점에는 외부 배포·기본 브랜치 변경·DB 변경·회사 서버 재시작을 하지 않았다.** 같은 날 Talk 리허설·운영과 공개 웹 반영을 마쳤으며, 최종 결과는 이 문서 마지막 절과 [검수·실행 기록](claude-review-20261008.md)에 있다.

## 당시 최종 검수 대기

[AI 운영 원칙](../../../AI_운영원칙.md)의 공개 결과 Claude 최종 검수 조건에 따라 공식 Claude Code 2.1.292, `--model claude-opus-5-5 --effort max`를 실행했다. 구독 OAuth(Max)·초기 모델은 확인했으나 주간 사용량 한도로 실제 모델 응답과 검수가 없었다. CLI는 `is_error: true`, synthetic 응답, 빈 modelUsage를 반환했다. 표시된 재개 시각은 **2026-10-12 19:00 Asia/Seoul**이다. 결과의 subtype만 success여도 검수 통과로 취급하지 않았다.

[검수 시도 결과](claude-review-result.json). 다른 모델·별도 과금 API로 전환하지 않았다. 당시에는 사용자 예외나 지정 검수 완료를 재개 조건으로 두었다. 이 대기 상태는 같은 날 뒤의 검수·반영으로 끝났으므로 현재의 승인 요청이나 재배포 지시로 사용하지 않는다. 새 작업의 검증 기준은 [현행 AI 운영 원칙](../../../AI_운영원칙.md)을 따른다.

## 후보와 검증

- 정본: 최신 `origin/master b9bd8d7b7`에 수정 커밋을 합친 `001d225cfd532bfedfc92ab542f0f60b16f1a3f2`, 로컬 `codex/atlas-eight-release-20261008`. 최신 Care·josa·공유판 기능을 보존했다. **72시험 파일 851/851**, 상담 브라우저8경로, 로컬 학습10번들·파일사본7개, 모델 동결6개 해시 확인. 초기1개 실패는 기존 checkout의 CRLF와 새 LF 속성 차이였고, Git blob과 같은 LF 바이트로 맞춘 뒤 통과했다. 코드나 Git diff는 바뀌지 않았다.
- Talk: 최신 원격 `b3ffe17` 위의 `1d6daa89cdba690b6da507cdfdcea89fbdfb3abf`. **기능81/81·배포 도구105/105**. 대상은 `synk-account`, `synk-learning` 2개 함수이며 리허설→운영 순서다. 원격의 최신 Strata 예문 생성기를 사용했고 DB migration은 없다. 운영·리허설 진입점4개 전체 원문 및 컴파일 AST 일치, 익명 GET4개401·OPTIONS4개204. 인증·CORS 유지 확인이며 실제 계정 동기화 왕복 검증을 대신하지 않는다.
- 공개 website: `synk-policy/main 3b3aacf` 위에서 **엔진14개와 캐시 참조20개**를 교체한 후보. 게임8·여행 Core1·컴퓨터/회의/manual Core3·계정2 번들이다. 기존 Care와 나머지 여행 모듈은 같아 유지했다. 학습 소비처10곳 저장·재열기 및 Core4곳 기록/재생 **24검사 통과**. [최종 검증](public-final-validation.json)에서 정본 소비처24개·변경34개·캐시 참조26개의 해시, 현재 공개 기준 HTTP50/50을 확인했다. 1280/390px에서 게임8개의 시작·기록, 계정2개 익명 화면, 맞춤도구3개의 완료·피드백·재열기, 여행 조건·추천 재열기와 기존 페이지를 포함한 [31개 화면 경로](public-browser-combined.json)를 확인했다. [최초 화면 검사](public-browser-first.json)에서 남은 하네스 가정을 수정한 뒤 [나머지10경로](public-browser.json)를 통과했으며 제품 코드는 추가로 수정하지 않았다. 실제 원격 계정에 로그인하거나 유료 호출은 하지 않았다.
- private website: 기존 `bff0f32` 보존 커밋을 기준으로 별도 checkout에서 확인한다. 공개 후보는 현재 공개판에서 만들었으므로 private staging 전체를 복사하거나 게임 화면을 재생성하지 않았다.

## 후보 준비 당시의 범위와 후속 계획

회사 상담 서버는 127.0.0.1:4191/4197의 로컬 도구다. 정적 Atlas/Lab 파일은 현재 소스와 일치하나, 10-06부터 실행 중인 서버 프로세스의 모델 해석기는 재시작되지 않았다. 공용 dirty 소스를 그대로 재시작하면 다른 작업까지 활성화하므로 이번 공개 배포 완료로 묶지 않는다. 기존 계정·키·DB·메신저 데이터는 읽거나 바꾸지 않았다.

Hangul은 현재 공개 경로가 없으므로 새로 공개하지 않았다. PATH VR·Desktop은 로컬/개발 준비 범위를 유지한다. Apps Script 배포 파일 변화가 없어 clasp는 실행하지 않았다. Prism의 실제 운영 집계, 유료 모델 평가, 실제 학습 효과·실기기 장시간 시험·라디오 청취는 이 결과에 포함하지 않는다.

당시 작성한 배포 계획: 원격 최신판 대조 → 정본/private 소스 통합 → Talk 리허설2함수 및 원격 소스 확인 → Talk 운영2함수 및 원격 소스 확인 → 공개 main 반영/Pages 완료 → 실제 공개 파일 해시·화면·기록 동작 확인 순서로 이어간다. 각 단계의 성공은 뒤의 실제 배포 기록에서 확인한다. 후보 준비 증거만으로 배포 완료를 주장하지 않는다.

## 당시 작업본·재현 자료 위치

- 정본: `C:/Users/q1212/.codex/worktrees/atlas-eight-release/SYNK-appsscript`
- Talk: `C:/Users/q1212/Documents/SYNK-appsscript/.tmp/atlas-eight-fix-20261008/talk-push-worktree`
- 공개: `C:/Users/q1212/Documents/SYNK-appsscript/.tmp/atlas-eight-deploy-20261008/public-candidate`
- private website: `C:/Users/q1212/Documents/SYNK-appsscript/.tmp/atlas-eight-deploy-20261008/website-candidate`
- 이번 원본 로그·검사 스크립트: `.tmp/atlas-eight-deploy-20261008/`
- Talk 배포 명령·대조: [배포 계획](talk-deploy-plan.json), [원격 사전 대조](talk-deploy-before.json), [진입점](talk-entrypoint-comparison.json), [익명 입구](talk-anonymous-ingress.json)

## 2026-10-08 Claude 최종 검수 결과

위 「최종 검수 대기」는 같은 날 10:2x~11:0x에 Claude(Fable 5.1)가 별도 작업본에서 끝냈다. **배포를 막는 문제 없음.** 검수 범위·수치·라이브 반영 순서는 [claude-review-20261008.md](claude-review-20261008.md)에 있다. 라이브 반영은 17:36~17:49에 유호님 지시로 Claude가 Talk 리허설(synk-account v31·synk-learning v27)→운영(v42·v38)→synk.im main `17122d771`(34파일) 순서로 실행했고, 공개 파일 34/34 바이트 일치와 「synk.im 배포 점검」 통과(18:03)까지 확인했다. 실행 결과는 [claude-review-20261008.md §5](claude-review-20261008.md)에 있다.
