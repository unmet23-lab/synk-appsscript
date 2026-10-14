# Platform 0.4.14 내 성향 이해·확인·수정 — 공통 공개 완료

2026-10-15 · 유호님 「0.4.14도 바로 진행해」. 공통 배포 기록 [README](../README.md)의 0.4.14 절 본문.

**공개 0.4.13 동결 원문 위에 회원 인사이트 세션이 준비한 PC 후보(`.tmp/member-understanding-20261014/desktop-candidate`)를 그대로 실어 0.4.14 / build20261015.1로 게시했다.** 「내 성향 확인하기」에 관심 주제·반복 이용/학습 방식·종합 설명과 본인 확인·수정·되돌리기, 동의한 앱 활동 기록이 들어간다. 0.4.13 대비 변경 9·추가 11·삭제 0, 나머지 122개 파일은 바이트가 같다(앨범 링크 두 파일 포함). 공통 원문 해시 `b88499cc6dc50e2e28815654248fa8ff92111072faf7aa5ed7350f77fcca8be7`(후보 해시와 같음), 빌드 입력 커밋 `0944c88e183a5ebd2c79b19feead57df48cb647d`, 공개 커밋 `a2fb8ccd69ee1591c8bca159b3d20d0cff21fac9`. 서버 resource·웹 공개는 그 세션이 먼저 마쳤다(트랙의 「Platform 성향 종합·확인·수정 4개 확장」 줄). WORLD·워크스페이스는 0.4.11 설치파일 그대로. 이번 작업은 현재 PC 앱을 설치·실행·변경하지 않았다.

| 근거 | 확인 결과 |
| --- | --- |
| [동결 입력](release-input.json), [범위](integration-scope.json), [후보 검증](candidate-verification.json), [원문 시험](source-tests.json) | 후보를 복사해 검증을 다시 돌려 계약 검사 10개·합성 시험 231개 통과. 릴리스 시험 92개 통과. 기존 런처·혜택·공개 앱 시험은 101/104 — 실패 3개는 계정 요청 목록을 정확히 적어 둔 기존 기대값이 새 활동 기록의 「쓰기 전 다시 읽기」(insightLoad)를 몰라서다. 쓰기 0·계정 간 이동 없음(아래 남은 일). |
| [Windows 시작 검사](windows-startup-report.json), [설치 엔진 시험](windows-installer-tests.json), [시작 화면](windows-home-1280.png) | CI 38614065808. 실제 packaged 0.4.14 25/25, 설치 엔진 22/22. 새 런처 모듈을 실제 앱이 불러 시작 화면까지 연다. |
| [Mac arm64](mac-arm64-native-qa.json)·[x64](mac-x64-native-qa.json) 기본 검사, [이동](mac-arm64-location.json)·[이동 x64](mac-x64-location.json), [아이콘](mac-arm64-icons.json)·[아이콘 x64](mac-x64-icons.json) | 같은 CI. 기본 검사 arm64 34/34·x64 37/37, Applications 이동·교체 확인 31/31·31/31, Finder·Dock·DMG 아이콘 검사 통과. |
| [공통 manifest](preview.json), [게시 영수증](publication.json), [공개 대조](public-verification.json), [공개 CI](public-ci.json) | Windows x64 405,987,840바이트 · Mac arm64 458,376,305바이트 · Mac x64 475,978,844바이트. GitHub 자산 digest와 실제 공개 전체 다운로드 SHA 일치. 한영 홈페이지·feed·선택 스크립트 일치, Pages 성공, 사이트 전체 점검 성공. |

남은 일
- `desktop/tests/renderer-auth.test.cjs`: 런처 시험 틀의 모듈 목록에 새 런처 모듈 3개를 더하고, 위 세 시험의 계정 요청 기대 목록에 활동 기록의 읽기를 반영한다(회원 인사이트 담당).
- 실제 계정으로 새 확인·수정의 저장→재조회→설명 반영과 설치본 화면 확인은 하지 않았다(계정 입력은 유호님 몫이라 유호님과 함께 재개한다).
- PC는 0.4.10 그대로다([0.4.11 절의 PC 후속 상태](../README.md#mac-install-0411)). 0.4.10 앱의 자동 업데이트는 이제 0.4.14를 받는다.
