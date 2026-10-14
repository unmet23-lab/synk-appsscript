# Platform 0.4.13 가족 이야기 앨범 공개 링크 — 공통 공개 완료

2026-10-14 · 유호님 「0.4.13도 바로 진행해」. 공통 배포 기록 [README](../README.md)의 0.4.13 절 본문.

**0.4.12 동결 원문에서 `renderer/benefits.mjs`·`src/public-apps.cjs` 두 파일만 바꿔 0.4.13 / build20261014.10으로 게시했다.** 설치 앱의 가족 이야기 앨범 소개가 「공개 웹 · PC 개발판」으로 바뀌고, 「웹에서 시작」 단추가 공개 웹 [synk.im/album](https://synk.im/album/)을 연다(앱이 여는 공개 주소 허용 목록에 `family-album` 추가). 나머지 129개 원문 파일은 0.4.12와 바이트가 같다. 공통 원문 해시 `22d4414a082b3b5ff4db5e16f5024dd28067504367d774e2be08b505842f516f`, 빌드 입력 커밋 `bcc192c29a8801c76bdd5f846045eac896996f29`, 공개 커밋 `8062003eb4f50dc0cc2f0d582fd7a9b8109ac9e2`. WORLD·워크스페이스는 다시 빌드하지 않고 0.4.11 설치파일을 그대로 넣었다. 이번 작업은 현재 PC 앱을 설치·실행·변경하지 않았다.

| 근거 | 확인 결과 |
| --- | --- |
| [동결 입력](release-input.json), [범위](integration-scope.json), [원문 시험](source-tests.json) | 바뀐 파일 2개, 파일 수 131개 그대로. 릴리스 시험 92개, 동결 원문 사본으로 혜택 미리보기·런처·공개 앱 104개 통과. |
| [Windows 시작 검사](windows-startup-report.json), [설치 엔진 시험](windows-installer-tests.json) | CI 38565388745. 실제 packaged 0.4.13 25/25, 설치 엔진 22/22. |
| [Mac arm64](mac-arm64-native-qa.json)·[x64](mac-x64-native-qa.json) 기본 검사, [이동](mac-arm64-location.json)·[이동 x64](mac-x64-location.json), [아이콘](mac-arm64-icons.json)·[아이콘 x64](mac-x64-icons.json) | 같은 CI. 기본 검사 arm64 34/34·x64 37/37, Applications 이동·교체 확인 31/31·31/31, Finder·Dock·DMG 아이콘 검사 통과. |
| [공통 manifest](preview.json), [게시 영수증](publication.json), [공개 대조](public-verification.json), [공개 CI](public-ci.json) | Windows x64 405,961,728바이트 · Mac arm64 458,320,281바이트 · Mac x64 475,936,129바이트. GitHub 자산 digest와 실제 공개 전체 다운로드 SHA 일치. 한영 홈페이지·feed·선택 스크립트 일치, Pages 성공, 사이트 전체 점검 성공. |

- PC는 0.4.10 그대로다([0.4.11 절의 PC 후속 상태](../README.md#mac-install-0411)). 0.4.10 앱의 자동 업데이트는 이제 0.4.13을 받는다. 첫 자동 업데이트가 기존 앱 60초 종료 대기에서 멈춘 문제는 이번 판에서도 바꾸지 않았다.
- 앨범 공개 웹 자체의 기록은 [앨범 공개 기록](../../album-public-20261014/README.md).
