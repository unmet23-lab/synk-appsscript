# 공식 backend 검수의 운영 메모

[공식 검수](backend-opus-review.json)는 claude-opus-5-5·max·exit0·success·is_error=false이며 이번 후보의 P0/P1/P2는 없다. 다음 두 P3는 배포를 막는 결함이 아니라 전환·복구 시 보존할 조건이다.

1. 기존 계정의 무료 컬렉션이 bootstrap에서 한 번 추가되면 revision이 한 번 증가한다. 이미 열려 있던 화면에서 오래된 revision으로 저장하면 첫 요청은 409가 될 수 있다. 초안과 기존 기록은 유지하고 최신 기록 확인 뒤 같은 초안을 명시적으로 저장한다. 임의로 요청 ID를 새로 만들거나 다른 화면의 최신 변경을 덮지 않는다.
2. 새6 ID가 저장 상태에 사용된 뒤에는 8종 카탈로그로 되돌리지 않는다. 롤백할 UI나 함수에서도 14종 ID의 인식·소유권·slots/dyes/looks 보관을 유지해야 한다. 원래 8종으로 축소하면 이미 저장한 새 ID의 조회·착용·편집 호환이 깨질 수 있다.

이번 후보는 `115b1d5cedcc961d942787d4ab562489ebae585d`로 승인된 브랜치에 push됐다. [확인](backend-push-confirmation.json)은 37 source 지문·HEAD 두 payload·공용 master/index/staging·운영 v2 baseline의 보존을 기록한다. 함수 배포·DB·secret·ledger 변경은 아직 0이며 실제 공개 결과와 구분한다.
