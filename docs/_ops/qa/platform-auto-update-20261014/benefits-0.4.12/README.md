# Platform 0.4.12 회원 혜택 문구 — 공통 공개 완료

2026-10-14 · 공통 배포 기록 [README](../README.md)의 0.4.12 절 본문.

**0.4.11 동결 원문에서 `renderer/benefits.mjs` 한 파일만 바꿔 0.4.12 / build20261014.9로 게시했다.** 무료 운세·플레저·중요한 대화 리허설·가족 이야기 앨범 네 항목의 머리말·설명·세 단계·이용 안내 23줄을 리디자인한 웹 앱과 같은 내용으로 맞췄다. 「내 성향 확인하기」 항목과 나머지 130개 원문 파일은 0.4.11과 바이트가 같다. 공통 원문 해시 `c9ee58f4124ae84dc26256b95727ce3e40c69201cc6a1b50b3b07da470d9f102`, 빌드 입력 커밋 `5e18f0f63e65646221bc9af274a1395b4390abf2`, 공개 커밋 `f3e4e0ac2554a4e5717ff6c50dff3202737bd06f`. WORLD·워크스페이스는 다시 빌드하지 않고 0.4.11 기준 설치파일에 든 0.4.11 설치파일을 그대로 넣었다(`refreshBundledClients` 없음). 이번 작업은 현재 PC 앱을 설치·실행·변경하지 않았다.

| 근거 | 확인 결과 |
| --- | --- |
| [동결 입력](release-input.json), [범위](integration-scope.json), [원문 시험](source-tests.json) | 바뀐 23줄은 모두 headline·description·availability·단계 줄이고 파일 수 131개 그대로. 릴리스 시험 92개, 동결 원문 사본으로 혜택 미리보기 7개·런처 86개 통과. |
| [Windows 시작 검사](windows-startup-report.json), [설치 엔진 시험](windows-installer-tests.json), [시작 화면](windows-home-1280.png) | CI 38547503384. 실제 packaged 0.4.12 25/25·정상 종료·ASAR 보존, 설치 엔진 22/22. |
| [Mac arm64](mac-arm64-native-qa.json)·[x64](mac-x64-native-qa.json) 기본 검사, [이동](mac-arm64-location.json)·[이동 x64](mac-x64-location.json), [아이콘](mac-arm64-icons.json)·[아이콘 x64](mac-x64-icons.json) | 같은 CI. 기본 검사 arm64 34/34·x64 37/37, Applications 이동·교체 확인 칩마다 31/31, Finder·Dock·DMG 아이콘 검사 통과. |
| [공통 manifest](preview.json), [게시 영수증](publication.json), [공개 대조](public-verification.json), [공개 CI](public-ci.json) | Windows x64 405,961,728바이트 · Mac arm64 458,320,474바이트 · Mac x64 475,936,129바이트. GitHub 자산 digest와 실제 공개 전체 다운로드 SHA 일치. 한영 홈페이지·feed·선택 스크립트 일치, Pages 성공. 사이트 전체 점검은 바로 뒤 다른 세션의 push 두 번(`145e187a`·`9c3e0379`)에 밀려 취소됐고, 공개 커밋을 포함한 `9c3e0379`의 점검이 성공했다(두 push 모두 0.4.12 링크·혜택 글 유지 확인). |

- 공개 저장소를 `.github`만 꺼낸 작업 트리로 게시해서, 게시 도구가 `index.html`·`knowledge.json`·`llms.txt`를 HEAD에서 읽어 다시 쓰며 마지막 줄바꿈만 CRLF→LF로 바뀌었다. 내용 차이는 없다.
- 이 PC의 Node 24(OpenSSL 3.5)는 synk.im 새 인증서 체인(YR1 ← Root YR ← ISRG Root X1)을 `UNABLE_TO_GET_ISSUER_CERT`로 거절했다. curl·OpenSSL 검증은 정상이라 공개 대조는 curl로 받았다.
- PC는 0.4.10 그대로다([0.4.11 절의 PC 후속 상태](../README.md#mac-install-0411)). 0.4.10 앱의 자동 업데이트는 이제 0.4.12를 받는다. 첫 자동 업데이트가 기존 앱 60초 종료 대기에서 멈춘 문제는 이번 판에서 바꾸지 않았다.
