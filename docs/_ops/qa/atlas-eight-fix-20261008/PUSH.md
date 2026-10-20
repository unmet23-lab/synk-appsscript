# Atlas 보완 보존 브랜치 — 2026-10-08

사용자 「오케이. 푸시해줘」에 따라 세 저장소에 `codex/atlas-eight-fix-20261008` 브랜치를 만든다. 기본 브랜치와 공개 배포를 변경하지 않는다. 공용 작업본에는 다른 작업의 미푸시 커밋·미커밋 코드가 많아, 원격 최신판을 기준으로 이번 수정만 분리했다. 다른 작업의 파일·index·브랜치는 유지했다.

| 저장소 | 원격 기준 | 보존 내용 |
|---|---|---|
| SYNK-appsscript | `5fd526def` | Core 기록, 상담, 평가 캡처, 사본 생성·검사, Prism/Reed 원문, 관련 회귀·검증 기록 |
| SYNK-talk | `b3ffe17` → `1d6daa89cdba690b6da507cdfdcea89fbdfb3abf` | Atlas4파일·manifest·서버2묶음·Reed3파일. 원격의 새 예문 기능과 생성기를 보존 |
| SYNK-website | `7b58d44` → `bff0f32f83bdbe73867f275671db01feaf2ac2c3` | 게임8·여행6 staging 사본과 이번 QA 항목. 공개 배포물 전체를 만든 상태는 아님 |

## 푸시 후보 자체 검증

- appsscript: 원격 기준에서 선택 변경만 적용한 **72시험 파일 851/851**, [결과](push-verification/unit.json)·[TAP](push-verification/unit.tap). 공용 작업본 전용 시험2개와 그 제품의 추가 동작은 섞지 않았다. 상담 화면 **8경로**, 오류·외부 요청·모델 호출0([브라우저](push-verification/browser.json)).
- 학습10번들·로컬 파일 사본7개 확인([검사](push-verification/copies-check.json)). 공용 작업본에만 있던 manual 빌드의 파일 사본1개는 이 원격 기준에 없으므로 분모가 다르다. LF 고정 대상은 실제 LF로 재생성했고, 추가 사본 회귀13개가 통과했다. 모델 동결6개 해시도 일치([호출 없는 계획](push-verification/frozen-plan.json)).
- Talk: 최신 원격 생성기로 서버 묶음을 생성, 관련 **81/81**·사본검사 통과. 기존 로컬의 재즈·자연음악 변경은 포함하지 않았다([결과](talk-push-result.json)).
- website: 정본14개 파일 바이트·Git LF정규화·구문 모두 일치, 여행 생성기5/5 통과. 기존 리듬 전체 생성기 검사는 `kit/josa.js` 누락으로 실패했다. Atlas 사본 외 게임 패키징의 기존 문제로 이번 브랜치에서 수정하지 않았다([결과](website-push-preflight.json)).

원래 [report.json](report.json)의 875개 시험·140개 해시는 당시 공용 작업본의 검증이다. 이 브랜치와 완전히 같은 트리라고 주장하지 않는다. 화면 캡처는 원래 로컬 QA 폴더에 남기고 텍스트 근거를 보존했다. 실제 Linux CI·공개 배포·모델 실호출·실사용 효과는 이번 검증에 포함하지 않는다.

## 당시 다른 진행 작업에 연결한 수정

원격에는 아래의 대상 구현이 아직 없어, 그 기능 전체를 이번 커밋에 끌어오지 않고 정확한 기존 작업본 기준 패치를 보존한다. 현재 공용 작업본에는 수정이 이미 적용돼 있으므로 다시 적용하지 않는다.

1. 회사 작업실 동기화의 Domain 선적재 순서와 동기화 시험의 실제 완료 대기: [pending-integration.patch](pending-integration.patch), [의존성 설명](integration-note.md), [적용 검증](pending-integration-result.json). 후속 `a43bf2b12`에 포함된 결과는 [인계 결과](../../아틀라스검토_인계_20261008.md)에 있다. 원격 기준 서버에 해당 선적재가 없어서 기본 실행판 검증이 통과한 당시 범위를 보존하며 패치를 재적용하지 않는다.
2. 소개팅 discovery 공유판의 meeting-regions 동봉: [share-pending-integration.patch](share-pending-integration.patch), [의존성·검증](share-pending-integration.json). discovery·meeting-regions를 포함하는 기존 작업을 합칠 때 적용한다. 이 브랜치에는 이미 남은 import를 거부하는 공통 guard를 넣었고, 원격 기준 상담 공유판도 실제 브라우저에서 통과했다.

공용 소스의 다른 변화는 버리거나 덮어쓰지 않았다. 원격 보존과 기본 브랜치 병합·공개 배포는 별도 상태다.
