# SYNK 데스크톱 클라이언트

## 2026-10-15 · 0.4.15 성향 보완·최적화 — 공개·PC 설치와 실계정 재실행 완료

기존 Atlas의 상황별 설명·자유서술 확인 반영과 입력/이력 표시 최적화를 **0.4.15 / build20261015.2**로 공개하고 현재 PC에 설치했다. 공개 세 설치파일 SHA·PC75파일·동결 소스142파일이 일치하며 기존 프로필319+Suite1파일은 설치 직후 모두 보존됐다. 실제 계정의 자동 연결·정상 종료 후 재실행·성향 화면과 기존 기록 유지를 확인했고 `closeToTray=true`로 원복했다. WORLD·Workspace 자식 설치파일은 0.4.11이다. [범위·검사·최종 공개 상태](../docs/SYNK_플랫폼_계정과_연결_설계.md#member-insight-optimization-20261015). 아래 PC 중단은 당시 이력이며 이번 사용자 재개 요청과 완료가 후속 상태다. 푸시는 보류한다.

<a id="mac-install-0411"></a>

## 2026-10-14 · 0.4.11 Mac 설치·아이콘과 Windows 설치 실패 처리 — 공통 공개 완료

홈페이지와 업데이트 feed를 **0.4.11 / build20261014.8**로 게시했다. 포함된 WORLD·워크스페이스도 0.4.11이다. Mac 아이콘 3개는 중앙 824×824 둥근 사각형·반경 185·투명 여백으로 바꾸고 기존 마크와 Windows ICO를 보존했다. Applications 밖 실행 시 이동과 기존 앱 교체를 각각 확인하며, 거절하면 현재 사본의 업데이트 제한을 안내한다. 관리자 권한이 필요한 교체는 Finder에서 진행한다.

Windows는 세 제품 설치기·Platform 자동 업데이트에 같은 10분 NSIS 제한과 이전 앱 복구를 적용한다. 프로세스 종료·복구를 확인한 뒤만 재시도를 허용하며 불확실하면 남은 상태와 복구 위치를 보여준다. 백업·복구 단계는 10분 제한과 구분한다. 최종 원문 56개·Windows packaged 25개·설치회귀 로컬/CI 각 22개·Mac 두 칩 실제 이동/재실행·Finder/Dock/DMG 화면을 확인했다. [공통 배포 기록](../docs/_ops/qa/platform-auto-update-20261014/README.md#mac-install-0411).

이번 배포 작업은 현재 PC의 앱·계정·설정을 조작하지 않았다. 아래 0.4.10 PC 설치와 UI 중단은 당시 이력이다. 별도 승인된 채팅에서 18:13 KST에 기존 0.4.10의 무클릭 계정 자동 연결·정상 재실행·기록 유지 및 트레이 설정 원복을 완료했다([실계정 담당 기록](../docs/_ops/qa/platform-real-account-20261010/README.md)). 이는 0.4.11 자동 설치 성공과 구분한다.

**PC 후속 상태 · 18:50 KST:** 별도 담당 채팅에서 0.4.11 설치 재시도 전에 사용자의 Esc 중지를 확인했다. 현재 설치는 **0.4.10**이며 0.4.11 적용·실계정 자동 연결·재실행은 미완료다. 두 설치 시도는 모두 파일 교체 전에 중단됐고 기존 기록은 보존됐다. 정상 종료를 위해 바꾼 `closeToTray=false`를 원래 `true`로 복원하는 일도 남았다. 담당 자동화는 일시 중지됐으며, 직접 재개 요청 전에는 앱을 조작하지 않는다. [담당 기록](../docs/_ops/qa/platform-real-account-20261010/README.md).

## 2026-10-14 · 0.4.10 계정 라이브러리 자동 연결·업데이트 종료 수정 — 공개·PC 설치 완료

앱의 기존 로그인이 확인되면 계정 라이브러리를 자동으로 연결한다. 정상 재실행과 업데이트 후 재실행에 같은 흐름을 쓰며, 조회 중 누른 즐겨찾기·정렬·앱 실행 기록은 읽기가 끝난 뒤 순서대로 저장한다. 저장 대기 중에는 종료·업데이트·로그아웃을 잠시 보류해 동작 유실을 막는다. 저장 동의와 선택하지 않은 복구본은 그대로 유지한다.

현재 PC와 홈페이지의 세 다운로드를 **0.4.10 / build20261014.7**로 맞췄다. 공통 공개 커밋 `130b323072befae0dad6a05a520e6670fee3f9db`의 한영 홈페이지·feed와 세 설치파일 전체 SHA를 확인했고, 같은 공개 Windows 설치기의 내장 엔진으로 적용한 75파일·ASAR·버전이 일치한다. 설치 직후 기존 프로필318+Suite1파일 변경·누락0, 설치 updater의 `current / 0.4.10`도 확인했다. Pages와 전체 사이트 CI도 성공했다. **사용자의 ‘앱 조작은 여기서 멈춰줘’ 지시에 따라 실제 앱의 무클릭 자동 연결·정상 재실행 검증은 중단했으며 미확인 상태다.** 검증 중 바꾼 ‘닫으면 트레이로’는 꺼짐(`false`) 상태이고 원래 켜짐으로 복원하지 않았다. [최종 증거와 범위](../docs/_ops/qa/platform-auto-update-20261014/README.md#startup-quit-0410).

0.4.7에서 시작한 실제 업데이트가 설치 중에 멈춰, 사용자가 직접 0.4.9로 교체했다. 이 경로를 자동 업데이트 성공으로 기록하지 않는다. 0.4.10은 원인이 된 시작 창의 닫힘 잠금을 정상 종료 때 해제하도록 수정했다. 원문79개·실제 종료 흐름53개, 최종 Windows25개·Mac ARM34/Intel37개 및 각 앱18개를 검증했고, 0.4.9에서 확인한 계정 자동 연결 코드는 그대로 보존했다.

## 2026-10-14 · 0.4.7 자동 업데이트·저장 복구·내 성향 통합 — 이전 완료 이력

**Preview 0.4.7 / build 20261014.4의 공개 배포와 현재 PC 설치를 완료했다.** 자동 업데이트·저장 복구에 승인된 내 성향 관련 9개 파일을 통합했고, 동결 원문은 `5d52702262a1f68f832b07d63d53cb20a7f3f05e1ebc9ac363038ba37e3971cc`다. 공개 커밋 `413056c0317ee7b6e6921e5ce176ed0208a0acd7`의 한·영 홈페이지 링크·feed와 세 공개 설치파일 전체 다운로드의 바이트·SHA를 대조했다. 같은 공개 Windows 설치기로 적용한 75개 파일·ASAR·버전을 확인했고, 설치된 updater도 공개 feed에 `current / 0.4.7 / 20261014.4`로 응답했다. 동작 기준은 [설치·업데이트 수명주기](LIFECYCLE.md#platform-update-047), 근거와 남은 확인은 [통합 QA 기록](../docs/_ops/qa/platform-auto-update-20261014/README.md#publication-result)에서 확인한다.

0.4.7은 메인·계정을 초기화하기 전에 최신 버전을 확인한다. 트레이로 숨긴 앱을 다시 열 때도 먼저 검사하며, Windows의 새 버전은 **다운로드 → 무결성 확인 → 정상 종료 → 자동 설치 → 다시 실행**한다. 앱을 사용 중일 때는 **5분마다** 확인해 같은 경로로 자동 업데이트한다. 이미 진행 중인 검사·다운로드는 시작 전 확인 창이 이어받아 중복 설치하지 않는다. 보이는 앱을 다시 선택하는 동작은 현재 화면으로 돌아간다.

작성 중인 작업 때문에 종료를 취소하면 같은 화면과 다운로드한 설치파일을 보존하고, 해당 실행 중에는 같은 릴리스의 자동 설치를 다시 재촉하지 않는다. 설치기 인계 실패·실패 후 복구한 릴리스도 반복 자동 설치를 막는다. 더 새 버전의 확인은 계속하며 명시적 재시도·앱 재열기에서는 다시 진행할 수 있다. 네트워크·다운로드 오류는 다음 주기에 재시도한다. 시작 전 확인 실패는 **다시 시도 / 현재 버전 열기**를 제공한다.

Mac은 최신 확인·다운로드까지 자동이고, 검증한 DMG를 열어 사용자가 앱을 종료한 뒤 Applications의 앱을 교체한다. **Mac 자동 교체·자동 재실행은 제공하지 않는다.** Windows 미서명 Preview·Mac ad-hoc 서명 Preview이며 정식 서명·Developer ID·공증의 사업자 등록 후 재개 결정은 유지한다.

승인된 `member-home.mjs`·`draft-recovery.mjs`는 읽지 못한 저장 원문과 아직 선택하지 않은 복구본을 덮어쓰거나 지우지 않도록 보호하고, 실패 후 명시적 재시도를 제공한다. 최종 관련 시험 **125개**, Windows 패키지 네이티브 확인 **25개**, Mac arm64/x64 설치 QA **34/37개**와 각 네이티브 흐름 **18개**가 통과했다. 설치 직후 기존 프로필296개·suite1개 변경0을 확인했고, 실제 앱의 기기 기록 저장·정상 종료·재실행 복원·앱 열기·할 일 완료도 통과했다. 기존 계정 메모7개·복구1개를 수동 연결로 재확인했다. [실제 UI 범위](../docs/_ops/qa/platform-real-account-20261010/installed-storage-fix-20261014/actual-ui.json)를 따르며 특정 문서·대화 위치 복귀까지 구현된 것으로 확대하지 않는다.

선행 0.4.5의 업데이트 시험과 0.4.6의 저장·복구 시험 101개는 당시 증거로 별도 보존한다. 현재 PC는 복구 가능한 백업을 검증한 뒤 설치했고, 기존 프로세스가 정상 종료되어 강제 종료는 실행하지 않았다. 설치 도구와 설치된 updater 확인 도구의 사용자 프로필 작업은 0이다. 설치·파일 보존 확인을 실제 계정 UI 왕복이나 물리 Mac 설치의 완료로 확대하지 않는다.

## 2026-10-14 · 0.4.4 공통 릴리스 공개·PC 반영 이력

**아래는 0.4.4의 과거 완료 이력이며 최신 상태는 문서 상단을 따른다.** 홈페이지의 Windows x64·Mac Apple Silicon·Mac Intel 다운로드와 설치된 Platform의 업데이트는 고정 주소 `https://synk.im/desktop/releases/preview.json`에서 같은 릴리스를 선택한다. 당시 검증 대상은 **Preview 0.4.4 / build 20261014.1**이며, 세 설치파일은 하나의 동결 원문 `sourceHash`를 공유한다. OS별 설치파일과 ASAR의 해시는 각각 다르며 manifest에 별도로 기록한다.

0.4.4는 시작할 때 한 번, 실행 중에는 6시간마다 최신 버전을 확인한다. 다운로드·설치 준비 중에는 주기 확인으로 진행 중인 상태를 바꾸지 않는다. 설정과 설치·업데이트 화면에서 사용자가 **최신 확인 → 다운로드 → 설치 파일 열기**를 진행한다. Windows는 작성 중 작업의 보존·정상 종료 확인을 거친 뒤 앱이 종료되면 시그널 설치기를 열며, 실제 **설치하기**는 사용자가 누른다. Mac은 DMG를 열고 사용자가 앱을 종료한 뒤 Applications의 앱을 교체한다. 이 버전에서는 자동 다운로드·무인 설치나 Mac 자동 교체를 하지 않는다. 연결 실패 시 현재 앱은 계속 사용할 수 있다.

**릴리스 절차는 원문 동결 → 세 대상 빌드와 QA → manifest 조립 → 공통 게시 도구 한 경로로 유지한다.** 현재 PC도 공개한 동일 설치파일로 갱신한다. 설치된 `app.asar`의 일부 파일을 PC에서 직접 패치하는 방식은 더 이상 사용하지 않는다. 공개된 버전의 파일 바이트를 교체하지 않으며, 변경이 있으면 버전을 올리고 새 릴리스를 만든다. 아래의 PC 직접 교체·0.4.3 기록은 당시 작업 이력이다. 빌드·검증·재현 명령과 중단 후 재개 조건은 [LIFECYCLE](LIFECYCLE.md#platform-release-reproduction)에 둔다.

0.4.4는 Windows 미서명 Preview, Mac ad-hoc 서명 Preview이며 **정식 코드 서명·Developer ID·Apple 공증은 사업자 등록 후 재개하는 기존 결정을 유지한다.** 무결성 해시 대조를 정식 서명·공증 완료로 해석하지 않는다.

**공개 배포와 현재 PC 설치 완료.** 공개 커밋 `2fb762a954b29a21758226ec0c8af89964f72d0b`의 홈페이지·feed와 GitHub의 Windows/Mac 설치파일 세 개를 확인했다. 공개 파일 전체 다운로드의 SHA-256이 원본과 일치하고 Pages 및 전체 사이트 CI가 성공했다. 기존 PC 설치본 77개 파일·설치 등록·바로가기를 압축 백업한 뒤 동일한 공개 Windows 설치기의 내장 설치 엔진으로 0.4.4를 적용했다. 설치된 75개 파일의 크기·해시를 독립 대조했고, 설치된 updater 코드가 공개 feed를 읽어 `current / 0.4.4 / 20261014.1`로 응답했다. 실제 설치 경로의 `SYNK Platform` 창 재실행·응답을 확인했다. 설치 도구의 사용자 프로필 읽기·쓰기는 0이다.

관련 원문 시험 140개, 홈페이지 격리 UI 61개·실제 공개 UI 15개, Windows 패키지 부팅과 Mac 두 아키텍처 CI 네이티브 QA를 통과했다. 새 실계정 가입·로그인 왕복, 사용자 PC 창의 시각 검사, 물리 Mac의 수동 교체는 이번 검증에 포함하지 않았다. [최종 반영과 증거](../docs/_ops/qa/platform-unified-20261014/README.md).

근거: [동결 원문](../.tmp/platform-unified-20261014/release-prepared/release-input.json), [조립한 manifest](../.tmp/platform-unified-20261014/preview.json), [원문 시험](../.tmp/platform-unified-20261014/source-tests.txt), [Windows 네이티브 확인](../.tmp/platform-unified-20261014/windows-0.4.4/native-smoke.json), [Mac arm64 QA](../.tmp/platform-unified-20261014/mac-arm64/qa/mac-native-qa.json), [Mac x64 QA](../.tmp/platform-unified-20261014/mac-x64/qa/mac-native-qa.json), [업데이트 UI·초안 보호](../.tmp/platform-signup-20261014/update-ui-qa/report.json), [홈페이지 UI 61개 확인](../.tmp/platform-signup-20261014/web-release-ui-qa/report.json).

## 2026-10-14 회원가입 입구 · 현재 PC 반영

로그인 전 상단에 **로그인 / 회원가입**을 나란히 표시하고, 계정 창에도 두 동작과 가입 후 PC 로그인 안내를 넣었다. 가입은 고정 주소 `https://synk.im/id/?view=signup`만 기본 브라우저로 열며 기존 로그인·토큰·메모를 변경하지 않는다. 로그인됨·복구 중·로그인 중에는 가입 동작을 막는다. 기존 플랫폼 시그널 메뉴/버튼 스타일을 재사용했고 1280·1024·900px 브라우저 화면에서 가시성과 상단 메뉴 겹침 해소를 확인했다.

중앙 계정의 가입 직접 진입은 공개 `d530261a`의 `id/index.html`·`id/dist/app.js` 두 파일만 반영했다. Pages 배포 성공·공개 SHA 일치·포털 관련148개 시험을 확인했다. PC는 사용자의 정상 종료 후 현재 0.4.3에 이번5파일만 교체했고 나머지112파일·실행 파일·자식 설치파일을 보존했다. 원문 관련95개·정확 설치 후보97개·교체/복구3개 시험과 설치 후 전체파일 대조 통과, 설치된 실행 파일 재시작을 확인했다. 업데이트 도구는 사용자 프로필을 읽거나 수정하지 않았다. 신규 계정 생성·가입 완료 후 실제 PC 로그인과 네이티브 창의 시각 확인은 이번 검증에 포함하지 않았으며 공개 다운로드 설치파일은 갱신하지 않았다.

근거는 [현재 PC 적용·검증](../.tmp/platform-signup-20261014/asar-update-retry/installed-verification.json), [공개 파일 대조](../.tmp/platform-signup-20261014/public-verification.json)에 둔다. 첫 후보 시험의 packed engine 로딩 방식 오류는 제품 변경 없이 브라우저 UMD fixture로 고쳐 재검증했고 이전 실패 기록을 보존했다.

## 2026-10-12 최종 배포·검수 상태

현재 홈페이지는 **Windows·Mac 두 버튼**을 함께 보여 주며 Mac은 Apple Silicon·Intel을 선택한다. 공개 Platform 설치판은 세 아키텍처 모두 **0.4.3**, 포함된 WORLD·Workspace 설치판은 **0.4.1**이다. WORLD는 인터넷 연결로 실행하며 별도 개발 서버를 요구하지 않는다. 아래 날짜별 0.4.0·0.4.1 설명은 당시 출시 이력이다.

**Windows 시그널 설치 화면(2026-10-12 공개):** 홈페이지의 Windows 파일은 `0.4.3-signal.1` 설치 UI를 사용한다. 앱 76파일은 공개 0.4.3과 동일하며, 현재 사용자 설치·실행 중 앱 보호·설치 후 파일 검증·명시적인 `SYNK 열기`를 제공한다. [설치 원천·재현](installer/README.md), [검증·공개 기록](../docs/_ops/qa/platform-performance-20261012/windows-signal-installer.json). Mac 파일과 서명 보류는 유지한다.

현재 PC의 별도 구성은 Platform0.4.3과 기존 WORLD0.4.2를 보존한다. 공개 설치파일과 PC 전용 구성을 혼동하지 않는다. 관련 최종 회귀시험162/162, 공개 다운로드 응답·파일 대조, 이 PC 실계정 저장→정상 종료→재실행 복원을 통과했다. [성능·마감 검수](../docs/_ops/qa/platform-performance-20261012/README.md), [실계정 인수](../docs/_ops/qa/platform-real-account-20261010/README.md). 다른 물리 기기의 인수와 정식 서명·공증은 완료로 표시하지 않는다.

## 2026-10-12 정식 서명·공증 — 사업자 등록 후로 보류

**사용자 최종 결정: 사업자 등록 후 재개한다.** 지금은 인증서 구매·유료 가입·서명·공증·관련 배포를 진행하지 않는다. 사업자 등록 후 사용자가 재개를 요청하면 Windows 서명 서비스의 사업체 가입 자격과 당시 요금, Apple 가입 유형부터 다시 확인한다. 현재 홈페이지의 Windows·Mac Preview 다운로드는 유지한다. 아래는 보류 전 사전 확인 기록이다.

사용자가 실물 PC 추가 검증은 보류하고 Windows 코드 서명·Mac Developer ID 서명과 Apple 공증을 먼저 요청했다. 현재 **사업자 등록 전이며 Apple Developer 유료 멤버십과 Windows 코드 서명 인증서가 모두 없다**고 확인했다. 현재 PC의 사용자/컴퓨터 인증서 저장소에는 코드 서명 인증서가 없고, 공개 배포 저장소에도 서명용 Actions secret이 없다. 비밀값은 출력하지 않았다. 이 항목은 준비 상태이며 실제 서명·공증 완료 기록이 아니다.

Mac은 개인 Apple Developer Program 가입이 가능하고 연 US$99이며, 현지 결제액은 가입 화면에서 확인한다. 홈페이지 DMG에는 Developer ID Application 인증서가 필요하다. Enterprise 가입은 필요하지 않다. 조직 가입은 별도의 법적 실체·D-U-N-S 등이 필요하므로 현재 SYNK를 법인으로 신청하지 않는다. [Apple 가입 기준·요금](https://developer.apple.com/kr/programs/enroll/), [Developer ID 인증서](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/).

Windows의 Microsoft Artifact Signing은 한국 조직을 지원하지만 개인은 미국·캐나다만 지원하므로 현재 한국 개인에게 권하지 않는다. SSL.com IV Code Signing은 사업체 없이 개인 실명으로 신청할 수 있고 공식 신원검증 안내가 한국을 명시한다. 2026-10-12 확인 정가는 인증서 연 US$129 + eSigner Tier1 연 US$180(연240회, 초과회당 US$1)로 합계 US$309다. 월납은 인증서와 별도로 월 US$20/20회이며 신규 eSigner 첫30일 무료는 인증서 요금 면제를 뜻하지 않는다. 한 빌드가 여러 파일을 서명하므로240회는240번의 앱 출시가 아니다. 세금·환율·최종 주문액과 사용량을 확인한 뒤 선택해야 한다. Certum 개인 Standard Cloud는 €209부터지만 한국 발급·1년 최종액을 확정하지 못해 즉시 구매 대상으로 추천하지 않았다. 신규 가입·결제·인증서 발급·클라우드 리소스 생성은 아직 하지 않았다. [Microsoft 가입 요건](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart), [SSL.com 개인 상품](https://www.ssl.com/products/software-integrity/code-signing/iv/), [서명 요금](https://www.ssl.com/guide/esigner-pricing-for-code-signing/), [한국 신원검증 안내](https://www.ssl.com/guide/identity-validation-for-ssl-com-certificates-a-complete-guide/).

현재 공개 Platform0.4.3 빌더는 WORLD·Workspace0.4.1의 미서명/ad-hoc 설치파일을 해시로 고정해 포함한다. 전체 정식 서명은 WORLD·Workspace부터 서명(맥은 공증·staple 포함)한 최종 파일의 해시를 새 카탈로그에 기록하고, 이를 포함한 Platform을 마지막에 서명해야 한다. 기존 공개 파일·프로필·승인 해시는 보존하고 새 배포 버전으로 추가한다. 정식 모드는 자격증명 누락 시 실패해야 하며 Preview로 조용히 전환하면 안 된다. 현재 빌더에 서명 완료 플래그나 가짜 인증서를 추가하지 않았다.

Mac의 고정 electron-builder26.15.3은 `mac.identity`·`hardenedRuntime`·`notarize` 설정을 쓴다. 기본 JIT entitlement부터 사용하고 Intel Vulkan loader도 서명 대상에 포함한다. 최종 앱과 DMG의 서명·공증 ticket·Gatekeeper 평가·읽기 전용 DMG 및 자식 해시 검사를 통과한 뒤 공개한다. Windows는 실행파일·설치파일의 게시자/체인·SHA256/RFC3161 타임스탬프 검증을 통과해야 한다. 서명만으로 신규 파일의 SmartScreen 경고가 즉시 없어짐을 보장하지 않는다. [v26 Mac](https://www.electron.build/v26/docs/mac/), [SignTool](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool), [SmartScreen](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).

## 2026-10-12 PATH 실사 면접실 · 공개와 현재 PC 반영

사용자 승인에 따라 PATH의 기본 실행을 로컬 캠퍼스에서 [실사 면접실 열기](https://synk.im/path/interview/film/rehearsal.html)로 연결했다. PATH만 공개 브라우저 실행을 우선하며, 다른 앱의 실행·계정 경계는 유지한다. 이 면접실에는 SYNK ID 조회·계정 ID 전달을 하지 않는다. PC는 글·음성, 지원 Quest 브라우저는 음성 준비·마이크 확인 뒤 VR로 진행하며 실제 Quest 착용·마이크·멀미 효과 검증은 남는다.

현재 PC의 설치된 Platform 0.4.3 ASAR에서 `renderer/state.mjs`, `renderer/launcher.mjs`, `src/public-apps.cjs`, `src/preload.cjs` 네 파일을 갱신하고 나머지113파일의 바이트 보존을 확인했다. `runtime.json`·EXE·WORLD/Workspace의 포함 설치파일은 그대로이며, 갱신기는 사용자 프로필을 읽거나 수정하지 않았다. 공유 원문의 별도 Mac 설치 안내 변경은 이 PC 후보에서 제외했다. 관련 회귀검사29개를 통과했고 적용 증거는 `.tmp/path-platform-entry-20261012/asar-update/installed-verification.json`에 있다. 설치된 Platform을 실제 사용자 프로필로 실행하거나 네이티브 버튼을 클릭해 확인한 것은 아니다. **새 공개 다운로드 설치파일은 출시하지 않았다.**

공개 커밋 `1e4190072bab19bffdba83c3aa20708adac8ae27`의 [Pages 배포](https://github.com/unmet23-lab/synk-policy/actions/runs/38169586579)가 성공했다. 공개59파일의 SHA와 영상·모델15개의 Range206 응답을 확인했으며, 실제 웹 플랫폼의 둘러보기→PATH 상세→실사 면접실 새 탭까지 확인했다. 로그인·로그아웃·노트 작업은 하지 않았다. [공개·설치 검증](../experiences/path-vr/qa/public-release-20261012/README.md), [브라우저 플랫폼 기록](../experiences/synk-account/README.md#path-interview-entry-20261012), [면접실 제공 범위](../experiences/path-vr/README.md).

## 2026-10-12 공개 Mac 설치판 · Apple Silicon·Intel Preview 0.4.1

[홈페이지](https://synk.im/#platform)에서 Windows x64와 **Apple Silicon·Intel Mac, macOS 13 이상** 설치판을 받는다. Mac Platform에는 WORLD·Workspace DMG가 함께 들어 있으며 각각 Applications에 원래 앱 이름으로 복사한 뒤 Platform에서 설치 상태를 새로고침한다. WORLD는 인터넷에 연결하면 별도 개발 서버·Node.js 없이 실행한다.

Intel판에 누락된 Vulkan loader를 공식 고정 원천에서 빌드해 서명 전에 동봉했다. 실제 Intel macOS CI에서 DMG·서명·CPU·pin41/41, WORLD15/15, 재연결10/10, Platform16/16을 통과했고 공개 세 DMG를 비로그인 전체 다운로드하여 SHA를 대조했다. GPU 없는 Intel CI에서만 소프트웨어 그래픽을 사용했으며 앱의 기본 그래픽·샌드박스는 유지했다. Apple Silicon의 기존 검증·파일은 유지한다.

Mac은 Developer ID 서명·Apple 공증 전 Preview다. **M 시리즈는 Apple Silicon판을 사용한다.** Intel판을 Rosetta로 실행한 추가 검사는 게임 정지·시간 초과가 남아 지원 조합에서 제외한다. 실물 Intel GPU 성능·사용자 MacBook의 Gatekeeper 승인·운영 계정 왕복은 미검증이다. [공개 결과와 정확한 검증 범위](../docs/_ops/qa/platform-macos-preview-20261012/README.md).

## 2026-10-12 이 PC의 튜터 홈 · WORLD 0.4.2

이 PC의 WORLD를 공개 튜터 홈에 연결한 0.4.2로 설치했다. 플랫폼 0.4.0의 WORLD 등록 목록과 포함 설치 파일도 갱신했으며 기존 플랫폼/PULSE 코드와 사용자 프로필을 보존했다. 홈페이지의 공개 설치 파일은 여전히 0.4.1이다. 실제 계정 저장·재로그인은 공개 웹에서 확인했고, PC 패키지는 격리 프로필의 실제 네이티브 화면을 확인했다. [설치·계정 검증](../experiences/synk-world-app/qa/account-desktop-20261012/README.md).

## 2026-10-12 WORLD 공개 연결 · Windows Preview 0.4.1

[홈페이지 다운로드](https://synk.im/#platform)를 새 Platform·WORLD **0.4.1**로 갱신했다. WORLD는 공개 HTTPS 서비스에 연결하므로 다른 PC에서 Node.js나 별도 개발 서버 없이 실행한다. 인터넷은 필요하다. 첫 화면의 **기본 학습**에서 비회원 학습을 열거나 SYNK ID로 연결한다.

새 Platform에는 WORLD 설치 파일이 포함된다. 기존 사용자는 새 Platform 설치 후 라이브러리에서 WORLD를 업데이트한다. [WORLD만 설치](https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.1-20261012/SYNK-WORLD-Preview-0.4.1-win-x64.exe)도 가능하다. 미서명 Windows x64 Preview이며 자동 업데이트는 제공하지 않는다. Mac 설치판은 위 Apple Silicon 항목을 따른다.

실제 패키지의 빈 격리 프로필에서 공개 학습→게임 조작→계정 복귀18/18, 연결 실패·재시도10/10을 확인했다. 공개19파일과 두 설치 파일 전체 다운로드 SHA가 일치한다. 다른 물리 PC·NSIS 설치 실행·실제 사용자 로그인은 별도 인수로 남긴다. [증거와 재현](../docs/_ops/qa/world-cloud-preview-20261012/README.md).

소스의 공개 WORLD 패키징은 `node tools/package.cjs --client=world --mode=development --platform=win32 --arch=x64 --world-cloud-preview=true --auth-config=<공개설정파일>`을 사용한다. 플래그 없는 개발 실행은 기존 localhost를 유지한다. 아래0.4.0 내용은 당시 이력이다.

## 2026-10-11 홈페이지 Windows 다운로드

사용자 요청으로 [SYNK 플랫폼 소개](https://synk.im/#platform)에서 **Windows x64 Preview 0.4.0** 설치 파일을 직접 받도록 연결했다. [공개 미리보기 릴리스](https://github.com/unmet23-lab/synk-policy/releases/tag/platform-preview-0.4.0-20261011)는 독립 PULSE 연결을 확인한 `platform-pulse-app-20261011` 기반이며, Workspace 진단 로그 358바이트만 제외하고 플랫폼의 자식 설치 파일 해시·크기를 갱신했다. 공개 파일 SHA-256은 `2eac837a7f0aecc63ed4796c8ee3bcc67b96ef26ecc57055b1b4577276ee0323`이다. 기존 PC 설치본·프로필·노트는 변경하지 않았다.

미서명 개발판이며 자동 업데이트·macOS 설치판은 제공하지 않는다. 포함된 WORLD는 별도 `127.0.0.1:4280` 개발 서버가 필요하다. 정식 출시와 독립 WORLD 설치 완료를 뜻하지 않는다. [홈페이지·파일 검증](../../SYNK-website/qa/platform-download-20261011/README.md).

## 2026-10-11 최신 개인 PC 설치 — PULSE 제작 진행·수정 의견·시안 승인

현재 PC에 PULSE **제작 진행·승인** 탭을 반영했다. Workspace 고객 관리의 초대 링크로 기존 운영 프로젝트를 연결하며 진행 단계·일정·다음 할 일·시안별 의견·명시적 시안 최종 승인·최종 파일을 확인한다. 의견과 승인 기록은 서버에 저장된다. SYNK ID와 분리된 고객 세션을 메모리에만 유지하고 계정 전환 시 비운다. 앱 완전 종료 후 초대 링크로 다시 연결하며, 승인 대상은 최신 시안을 기준으로 최종 제작을 진행하는 동의다. 납품 파일의 별도 인수 승인은 아니다.

NSIS 1회/exit 0, 설치 95/95·설치 ASAR 123/123, 실제 설치 묶음에서 제작 진행 UI 32/32·모델 UI 34/34를 통과했고 플랫폼을 다시 열었다. 실제 Electron·격리 company 서버의 의견 저장/승인/로그아웃 왕복도 확인했다. 운영 고객의 실제 쓰기는 하지 않았다. [최신 재설치 파일](<artifacts/platform-pulse-workflow-20261011/SYNK Platform Preview-0.4.0-win-x64.exe>) · [사용법·설치·검증](../docs/_ops/qa/platform-pulse-workflow-20261011/README.md).

## 2026-10-11 앞선 개인 PC 설치 — PULSE 모델·포트폴리오

Platform Preview 0.4.0에 왼쪽 회원 혜택 중복 네 항목 제거와 PULSE 클라이언트 공간을 재설치했다. 공개 모델 6명·모델 이미지 작업 1건(6장)을 살펴보고 후보 담기·제작 요청문 복사·기기와 계정별 임시 저장을 이용한다. 제작 중 영상은 완료 후 추가한다. 계정·메모 저장소와 WORLD·Workspace는 보존했으며 공개 배포는 하지 않았다. [이전 재설치 파일](<artifacts/platform-pulse-20261011/SYNK Platform Preview-0.4.0-win-x64.exe>) · [설치와 화면 검증](../docs/_ops/qa/platform-pulse-20261011/README.md).

## 2026-10-10 개인 PC 설치·재설치 이력

계정 재확인·로그아웃·메모 초안 보호의 최종 v4 코드와 최신 WORLD·Workspace 재설치 파일을 포함한 **Platform Preview 0.4.0**을 현재 PC에 재설치했다. 전체 설치 검사96/96, 별도 설치·원문·복구 파일 준비 검사109/109, 등록·시작 메뉴 바로가기28/28을 통과했다. 두 자식 앱의 설치 코드는 그대로이고, Platform에서 두 재설치 파일의 실제 해시 검증 후 `ready`까지 확인했다. 자식 설치 파일을 실행하거나 실제 계정·사용자 메모를 열지는 않았다.

[Platform 재설치 파일](<artifacts/platform-reinstall-20261010/SYNK Platform Preview-0.4.0-win-x64.exe>) · [WORLD 재설치 파일](<artifacts/platform-reinstall-20261010/SYNK WORLD Preview-0.4.0-win-x64.exe>) · [Workspace 재설치 파일](<artifacts/platform-reinstall-20261010/SYNK Workspace Preview-0.4.0-win-x64.exe>) · [설치·검증과 남은 확인](../docs/_ops/qa/platform-reinstall-20261010/README.md).

이 파일들은 **현재 PC용 미서명 개인 Preview**다. 같은 0.4.0 재설치는 새 버전 자동업데이트가 아니며 공개 배포·정식 서명·업데이트 채널을 활성화하지 않았다. 회사 코드서명 인증서는 현재 없다는 사용자 답변을 받았다. 실계정·메모 복원·교사와 학생·물리 휴대폰·OS 알림 인수는 기기와 참여자가 준비된 때 별도로 진행한다. 아래 날짜별 항목은 해당 시점의 이력이다.

## 2026-10-09 플랫폼 편의 기능

사용자 요청에 따라 창·작업 위치 복원, Ctrl+K 앱/설정/메모 검색, 뒤로·앞으로, 트레이 즐겨찾기·최근 앱, 시작·닫기·전역 단축키·확대 설정을 연결했다. 즐겨찾기 순서와 메모 검색/상태 필터, 실제 설치 결과 알림·조용한 시간, 계정별 동의와 암호화를 적용한 재시작 초안 복구, 개인정보 제외 진단 복사를 추가했다. 기존 싱ㅋ 시그널 화면과 앱 실행·계정 권한을 유지한다.

**10월 9일 편의 기능 설치 이력.** 자동 시작 상태와 창 복원을 추가 보강한 Windows x64 Preview 0.4.0(`d1366749…`)을 2026-10-09 21:40 KST에 설치했다. 당시 바탕화면 **SYNK 플랫폼** 바로가기와 소스·고정 후보·설치 파일의 일치를 확인했다. 자동 시작·전역 단축키·초안 복구는 기본 꺼짐이며, 트레이 유지는 켜져 있다. 공개 다운로드·업데이트 채널 배포는 포함하지 않았다. 최신 재설치 파일은 위 10월 10일 항목을 사용한다. [당시 설치 파일](<artifacts/platform-convenience-candidate-2026-10-09T12-35-49-759Z/dist/preview/win32/x64/platform/SYNK Platform Preview-0.4.0-win-x64.exe>) · [당시 설치·검증](../docs/_ops/qa/platform-convenience-20261009/delivery/resume/README.md) · [구현 범위·화면](../docs/_ops/qa/platform-convenience-20261009/README.md).

## 2026-10-09 Windows 플랫폼 닫기 → 트레이

Windows 플랫폼의 **X·Alt+F4는 창만 숨긴다**. 작업표시줄 알림 영역의 SYNK 아이콘 클릭·더블클릭 또는 **SYNK 플랫폼 열기**로 같은 창과 작성 중인 메모를 다시 연다. 바로가기를 다시 실행해도 기존 창을 복원한다. **완전히 종료**는 트레이 오른쪽 클릭 메뉴에서 선택하며, 저장하지 않은 메모가 있으면 기존 저장/버리기 확인을 유지한다. 트레이를 만들지 못하면 기존 창 닫기와 초안 보호를 사용한다.

위 최신 설치형 Preview에도 반영했다. 기존 프로필에서 **X → 창 숨김·프로세스 유지 → 바탕화면 바로가기 → 같은 창 복귀**를 확인했고 트레이 유지 설정을 보존했다. 초기 관련 자동 시험 71/71·실제 Electron 트레이/종료 검사 16/16 통과. [초기 검증](../docs/_ops/qa/platform-tray-20261009/README.md) · [최신 설치본의 실제 PC 확인](../docs/_ops/qa/platform-convenience-20261009/resume-actual-pc.json).

## 2026-10-09 현재 명칭 — SYNK Workspace

앱의 정식 표시 이름은 **SYNK Workspace(싱크 워크스페이스)**다. 내 수업·팀 대화·업무·제작을 한 공간에서 이용하며 **메신저**는 대화 기능 탭의 이름으로 남긴다. 기존 `messenger` 클라이언트 ID·OAuth·프로필·실행 파일·프로토콜은 유지한다. 표기와 소스 개발판 안내를 갱신했으며 설치본 재패키징·공개 배포는 별도다.

## 2026-10-09 후속 — 교사 업무를 Workspace의 내 수업으로 통합

사용자 「통합해줘」에 따라 플랫폼의 교사 기본 실행은 Workspace `/?tab=teaching`을 연다. 이미 열린 Workspace는 `onOpenView('teaching')`로 같은 창에서 전환하며 대화·과제 작성 초안을 유지한다. Workspace 프로세스 안에 기존 `clients.teacher`를 사용하는 별도 WORLD 인증 보관소와 교사 요청 브리지를 두었다. 회사 직원 권한과 실제 담당 반 권한은 각각 유지한다. 교사만 있는 계정은 회사 자료 없이 내 수업을 이용한다.

플랫폼에는 교사와 Workspace 권한이 모두 있으면 Workspace 카드 한 개에서 내 수업을 열고, 교사만 있으면 **워크스페이스 · 내 수업** 입구를 표시한다. `teacher` 메뉴 권한 키를 삭제하거나 직원 권한으로 바꾸지 않는다. 기존 독립 `npm run dev:teacher`와 저장소는 호환 경로로 보존한다. 아래 9개 목록은 통합 전 역할 입구의 이력이다.

현재 변경은 소스 개발판이다. [브라우저 검증](../docs/_ops/qa/messenger-teaching-20261009/browser/report.json)과 [데스크톱 자동 회귀](artifacts/messenger-teacher-20261009/desktop-regression.tap)는 합성 계정·격리 데이터로 확인했으며 공개 서버·운영 교사 등록·설치본 갱신·실계정 왕복은 별도다. 브라우저 교사 인증 설정과 라이브 연결 제안은 [회사 내 수업](../docs/마케팅/온라인마케팅지도/engagement/company/WORKSPACE.md#messenger-teaching-20261009)을 따른다.

## 2026-10-09 현재 앱 구성 — 9개 앱과 핵심 기능

**Partners의 외부 창작자·파트너 기능을 PULSE에 합쳤다.** 플랫폼의 독립 앱은 10개에서 9개로 줄고, 앱마다 한 가지 목적과 세 가지 핵심 기능을 안내한다. Messenger 안의 사내 제작·AI 실습, 교사 앱의 수업 관리, PATH의 가상 캠퍼스 연습은 각자의 입구를 유지한다.

| 앱 | 목적 | 핵심 기능 3가지 |
|---|---|---|
| WORLD | 한국어 학습·생활 경험 | 미니게임 · Town · 과제·학습 기록 |
| Workspace | 수업·팀 업무·제작 | 내 수업 · 팀 대화·내 업무 · 제작·AI 실습 |
| WORLD · 교사 | 다음 수업 준비 | 학급·학생 · 과제 배정 · 공유 학습근거·결과 |
| PATH | 유학·학교생활·진로 준비 | 가상 캠퍼스 · 상황 연습 · 다음 준비·기록 |
| PULSE | 외부 고객·창작자와 작품 제작 | 의뢰·검토·전달 · 창작자·파트너 협업 · 작품·IP·이용권리 |
| 플레저 | 연락할 사람 챙기기 | 사람·대화 기억 · 일정·안부 · 문구 준비·보관 |
| 무료 운세 | 오늘과 이번 주 돌아보기 | 별자리·한국 사주 · 오늘·주간 풀이 · 실천 메모·보관함 |

회원 혜택 입구와 기존 기능은 유지한다. PULSE는 플랫폼 상세의 준비 중 앱이며 입점·판매·결제·정산을 제공하지 않는다. PATH 여행 체험은 별도 입구로 현재 플랫폼의 캠퍼스 MVP와 구분한다. 제공 범위·역할·권한의 담당 원문은 [현재 플랫폼 구성](../docs/SYNK_플랫폼_계정과_연결_설계.md#app-compaction-20261009)이다.

기존 `partners` 저장 기록은 보존하며 자동으로 PULSE 자료나 권한으로 바꾸지 않는다. 이전 입구는 현재 PULSE 메뉴 권한을 별도 확인한 뒤 연결한다. 공통 계정과 앱별 자료·저장 동의의 경계는 유지한다. [로컬 압축 검증](artifacts/app-compaction-20261009.json): 관련 자동 시험 240/240, 1280·390·320px의 숨김 Electron 화면과 마지막 소스 재로딩 130/130, 웹·PC 빌드 일치 검사를 통과했다. 이번 압축은 새 설치본·공개 배포에 반영하지 않았다.

## 2026-10-09 개발판 전체 앱 표시 — 통합 전 이력

PULSE·Partners 통합 전 네이티브 개발판은 서버 메뉴가 비어 있어도 등록된 앱 10개를 표시했다. WORLD·Messenger는 기존 설치 실행, 플레저·운세·리허설은 공개 웹 실행을 제공하며, 아직 패키지에 없는 앱은 로컬 MVP 또는 준비 중 상태를 표시했다. 앱 목록과 실제 서비스·개인 기록 권한은 분리했고, 계정·게스트 메모 격리와 정식판·일반 웹의 카탈로그 필터를 유지했다. 당시 고정 후보 287/287·숨김 화면 59/59를 통과했다. [당시 PC 적용 상태와 증거](../docs/_ops/qa/brand-experience-20261008/DEVELOPMENT-CATALOG.md). 현재 소스 목록은 위 9개 앱이 우선한다.

## 2026-10-08 홈·검색·종료 경험 보강 · 개인 PC 업데이트

홈에서 미완료 할 일·최근 성공 실행과 현재 실행 가능 상태를 보고 앱을 바로 연다. 목적 선택은 이 창에 즉시 적용하며, 다음에도 기억하는 설정은 별도 동의로 저장한다. 작은 화면의 앱·혜택 검색과 로고의 내 홈 복귀를 연결했다. 작성 중인 메모는 취소·로그아웃·창 닫기에서 보호하고, 실제 저장 성공과 보관 위치를 안내한다. 일시 계정 오류는 같은 자리에서 재검증하며 같은 계정 복구 시 초안·임시 목적을 유지한다.

데스크톱 전체 265/265, 홈 native 29/29, 새 여정 native 32/32, 기존 반응형 87/87 통과. 후속 요청으로 고정 후보 `3079b9ed…`의 Platform·WORLD·Messenger Preview 0.4.0을 21:54~21:55 KST 현재 PC에 설치했다. 실행 원본 84파일·실제 ASAR 여정32개·설치 EXE 격리 부팅·세 원래 프로필 보존을 확인했고 21:59에 원래 Platform 창을 다시 열었다. [설치·사용 흐름·검증](../docs/_ops/qa/platform-experience-20261008/README.md). 별도 작업의 미완성 계정 라이브러리 연결은 고정 사본에서 제외했으며 공유 소스는 보존했다.

2026-10-08 21:30 Platform·WORLD·Messenger Preview 0.4.0에 회원 홈·7차 계정 보강·연결 복구 고정 후보 `f5ce616f…`를 반영한 이력은 [브랜드 경험 설치 기록](../docs/_ops/qa/brand-experience-20261008/RELEASE.md#연결-복구와-7차-계정-보강-업데이트)에 둔다. 원래 세 프로필·등록·바로가기를 보존했다. 22:03에는 Platform의 후속 설치 원본 `3079b9ed…`가 관찰됐으며 f5 시험 결과를 그 설치본 검증에 재사용하지 않는다. 실제 SYNK ID 로그인은 이번 검증에서 수행하지 않았다.

2026-10-08 플랫폼 7차 계정 검수: 이전 토큰의 늦은 서버 오류·통신 실패·세션 거절이 새 로그인·앱 권한·암호화 복구 토큰을 지우지 않도록 보강했다. 현재 토큰의 실제 인증 거절은 정상 종료한다. 신규 5개 포함 데스크톱 235/235 통과. [7차 결과](../docs/_ops/qa/platform-account-audit-20261008/ROUND7.md). 소스 검수 당시 설치본 반영은 미실행이었으며 이후 위 고정 후보에 포함해 개인 PC 세 앱을 업데이트했다.

2026-10-08 플랫폼 6차 계정 검수: 토큰 갱신 중 기존 계정 조회가 돌아와도 정상 로그인·복구 토큰을 삭제하지 않고 새 토큰으로 검증한 이름·앱 권한을 유지한다. 신규 실제 인증 서비스 회귀 2개 포함 데스크톱 230/230 통과. [6차 결과](../docs/_ops/qa/platform-account-audit-20261008/ROUND6.md). 소스 검수 당시 설치본 반영은 미실행이었으며, 이후 위 개인 PC 설치 기록의 고정 후보에 반영했다. 실제 운영 OAuth 로그인은 아직 검증하지 않았다.

2026-10-08 플랫폼 5차 계정 검수: 암호화 저장소 정리 중 취소·로그아웃·종료가 발생하면 늦은 OAuth 창이 열리지 않게 했다. 동시에 시작한 로그인 준비는 하나로 합치고, 나중에 직접 시작한 로그인은 유지한다. 실제 인증 서비스·순차 저장소 대역의 신규 5개 회귀 포함 검증은 [5차 결과](../docs/_ops/qa/platform-account-audit-20261008/ROUND5.md)에 둔다. 새 설치본 생성·설치·운영 OAuth 검증은 미실행이다.

## 2026-10-08 연결 실패와 다시 연결

초기 서비스 접속이 실패하면 승인 로고·폰트·펠트 단추를 쓰는 `synk-desktop://status/` 안내를 연다. **다시 연결**은 런타임에 고정한 앱 주소만 요청하고, 또 실패하면 안내를 유지한다. 안내 중 앱 재실행도 같은 동작을 하며 정상 화면은 새로고침하지 않는다. 취소·하위 프레임·늦은 이전 실패를 구분하고 중복 재시도를 합친다. 서버를 자동 시작하지 않는다.

`src/connection-content.cjs`는 안내와 정확한 네 자산만 제공하며 script/connect를 차단한다. 계정 IPC 권한은 기존처럼 거절한다. `src/connection-recovery.cjs`가 이동과 복구를 관리한다. 고정 후보 전체 254/254, 합성 숨김 Electron의 키보드·실패/성공·320/390/1280px 14/14, 실제 후보 WORLD·Messenger EXE 각 11/11을 통과했다. [연결 검사](artifacts/connection-recovery-20261008/native-connection.json)와 위 설치 기록에서 합성 응답 검사·실제 패키지 오프라인 검사·실제 서버 사용을 구분한다.

## 2026-10-08 개인 맞춤 시작 화면과 내 홈

플랫폼의 첫 화면과 상단 **내 홈** 메뉴를 추가했다. 기존 Atlas 맞춤 설정에서 목적·보기 방식을 고르고, 현재 계정에 허용된 앱 안내·실제 성공 실행 기록·즐겨찾기·직접 남긴 할 일과 결과 메모를 한곳에서 확인한다. 메모의 **앱 보기**는 기존 라이브러리 상세로 연결하며 실행은 원래의 서버 메뉴 권한·개발판 기능 검사와 설치 상태를 그대로 따른다. 관심사를 고른다고 앱 권한이 늘어나지 않는다.

로그인한 회원은 연결할 앱·제목·내용을 고르고 이 기기 저장에 동의하여 할 일/결과 메모를 남길 수 있다. 할 일 완료·다시 열기·삭제가 가능하다. 기록은 현재 SYNK ID별 `synk.platform.member-home.v1:account:<id>`에 최대 60개를 저장한다. 계정 전환·로그아웃·권한 철회 때 타 계정이나 이용할 수 없는 앱의 기록을 숨긴다. 계정·앱 확인 중에는 저장하지 않는다. 저장된 메모는 직접 작성한 내용이며 각 앱의 파일·학습 결과·업무 상태를 자동 수집하거나 클라우드/두 기기에 동기화하지 않는다. 새 계정·AI 호출은 추가하지 않았다.

화면은 최신 [플랫폼 시그널](../docs/디자인/플랫폼_시그널/README.md)을 유지한다. 기존 진행 중 변경을 보존하며 독립 [`renderer/member-home.mjs`](renderer/member-home.mjs)·CSS와 런처의 최소 연결로 구현했다.

검증: `node --test desktop/tests/*.test.cjs` **223/223** 통과. `node desktop/tools/member-home-native-smoke.cjs` **25/25**는 숨김 Electron·분리된 합성 계정에서 1280/390/320px, 목적 동의 저장, 할 일/메모 저장·완료·복구·삭제, 작성 중 새로고침, 계정 전환·권한 철회를 검증한다. 기존 라이브러리 반응형 검사도 명시적으로 라이브러리를 연 뒤 **87/87** 통과했다. 외부 요청·콘솔 오류 0개. [검증 결과](artifacts/member-home-native-20261008.json)·[PC 홈](artifacts/member-home-1280.png)·[390px 홈](artifacts/member-home-390.png)·[320px 기록](artifacts/member-home-records-320.png). 운영 회원 로그인·새 설치본·공개 배포 검증은 포함하지 않는다.

## 2026-10-08 플랫폼 계정·실행 복구 검수 · 로컬

교사·PATH·회원 혜택 개발판도 성공한 실행만 현재 계정의 마지막 실행으로 기록한다. 실패·권한 철회·계정 전환 뒤 늦은 응답은 기록하지 않는다. 초기 환경 조회 실패 뒤 새로고침도 환경·설치 상태를 다시 읽는다. 공개 플레저를 외부 브라우저로 여는 고정 주소를 연결하고 오래된 일괄 미연결 안내를 서비스별 상태로 정정했다. [계정·기록 검수 결과](../docs/_ops/qa/platform-account-audit-20261008/README.md). 최신 설치 파일을 다시 묶거나 배포하지 않았다.

## 2026-10-06 플랫폼 화면 리디자인 — 싱ㅋ 시그널

유호님 요청(「GPT가 만든 플랫폼 디자인이 촌스럽다. 기능적이면서 최신·젊은 디자인으로 전부 교체, 홈페이지의 싱ㅋ처럼 쿨하게」)으로 런처 화면 전체를 Claude가 다시 그렸다. 기능·권한·IPC·저장 키·요소 ID는 그대로이고 겉모습과 화면 구성만 바꿨다. 규칙과 새 앱을 더하는 법은 [플랫폼 화면 — 싱ㅋ 시그널](../docs/디자인/플랫폼_시그널/README.md), Recent(옛 Godly) 136개 항목 조사는 [조사 기록](../docs/디자인/플랫폼_시그널/조사_20261006.md)에 있다. 웹 플랫폼(`experiences/synk-account/platform.html`)도 같은 언어로 바꿨다.

- 밤(기본)·낮·기기 설정 테마를 설정에서 고른다(이 기기의 `synk-platform-theme`). 플랫폼 창 배경도 밤 바탕 `#08090C`로 바꿨다.
- 앱마다 사업 색 포스터에 큰 한글 이름(월드·메신저·패스·펄스·플레저·운세…). 승인 그림은 흑백 곱하기 이중톤으로만 쓰고 펠트 판 단추·칩은 쓰지 않는다. 상단 한 줄(싱ㅋ 표식·알약 메뉴·계정), 왼쪽 라이브러리(글자 타일·LED 상태), 아래 떠 있는 상태 알약.
- 같은 날 GPT의 「무료 운세」 추가와 3방향으로 합쳤다(운세 포스터는 팝 `#E05C97`, 혜택이 넷이면 2×2). 합친 상태에서 `node --test desktop/tests/*.test.cjs` 168/168, `experiences/synk-account` 95/95, 숨김 Electron 반응형 87/87·회원 혜택 19/19·플레저 런처·운세 38/38(합성 계정, 로그인·설치·외부 요청 없음). 0.4.0 설치 패키지는 다시 묶지 않았다(이전 화면).

## 2026-10-06 회원 혜택 — SYNK FOR YOU

현재 회원 혜택은 **내 성향 확인하기 · AI 구독 계정판 · 플레저 · 무료 운세**다. 2026-10-18 사용자 요청으로 가족 이야기 앨범과 중요한 대화 리허설의 소개·별도 앱·검색·실행·OAuth 구성·전용 자산을 삭제했다. 운세·플레저와 PATH의 기존 콜백·개별 권한은 유지한다. 기존 계정 문서의 과거 앱 참조는 읽기 호환만 제공한다. 이번 변경은 소스·로컬 빌드 범위이며 기존 설치본은 교체하지 않았다.

## 2026-10-05 SYNK 플레저 초기 개발

제품 목록에 **SYNK 플레저**를 추가했다. 2026-10-05 사용자 요청으로 이전 가칭 챙김에서 플레저로 이름을 확정했다. 생일·경조사와 관계별 말투를 준비하는 [관계 챙김 로컬 MVP](../experiences/relationship-care/README.md)이며, 플랫폼과 별도인 `im.synk.care.preview` 프로필·Chromium 세션을 사용한다. 소스 제품 목록은 기존 6개와 플레저를 합쳐 7개다.

소스 플랫폼은 서버가 확인한 `product:platform,key:library.care` 메뉴 권한이 있을 때만 플레저를 표시한다. 학생·회사 역할이나 관심사에서 이 권한을 추론하지 않으며 운영 이용권을 부여하지 않았다. 미패키징 개발 플랫폼에서 **플레저 MVP 열기**를 누르면 고정된 로컬 앱을 별도 프로세스로 연다. 운영 로그인이 없는 개발 검토는 다음 명령을 사용한다.

```powershell
# 저장소 루트: 먼저 앱 서버 실행
node experiences/relationship-care/server.mjs
# 다른 터미널: 별도 개발 클라이언트 실행
cd desktop
npm run dev:care
```

고정 입구는 `http://127.0.0.1:4296/`다. `synkProduct.openInBrowser()`도 이 주소만 열며 임의 URL·인증 토큰·회사 자료를 받지 않는다. 네이티브 저장은 자기 문서가 만든 동일 출처 Blob 중 `synk-care.ics`(`text/calendar`, 최대 1 MiB), `synk-care.json`(`application/json`, 최대 4 MiB)만 저장 대화상자로 연결한다. PATH의 다운로드 금지와 별도 세션은 유지한다.

초기판은 이 PC에서 준비된 받아쓰기와 전사된 대화에서 관찰한 특징을 사용한다. 화자와 원하는 표현은 직접 확인하고, 일정·메시지 초안을 고친다. 외부 AI·자동 발송·운영 SYNK ID 동기화·백그라운드 푸시·새 배포 패키지는 연결하지 않았다. 네이티브 미리보기의 OS 알림 권한도 열지 않았으며 앱 내 일정 안내와 캘린더 파일을 사용한다.

확인 명령은 `node --test desktop/tests/*.test.cjs`(156개 통과)와 서버 실행 뒤 `node desktop/tools/care-native-smoke.cjs`다. 후자는 실제 숨김 Electron에서 합성 메뉴 권한의 런처 1280/390/320px, 계정 전환과 제품 미리보기 호출, 앱의 네이티브 CSP, 합성 ICS/JSON 저장 완료를 검사한다. 운영 로그인·실제 연락·유료 AI는 호출하지 않는다. [네이티브 11/11 및 실제 product-main 부팅 검증](artifacts/care-native-20261005.json)을 통과했다. 별도 세션·실제 preload·Node 차단과 합성 ICS/JSON의 DownloadItem `completed` 및 저장 본문 일치를 확인했다. 앱 서버 없이 `--launcher-only`를 붙인 [런처 6/6 검증](artifacts/care-launcher-20261005.json)도 가능하다. 1280/390/320px의 가로 넘침·이미지·계정 전환과 미리보기 호출을 통과했고 [PC 화면](artifacts/platform-care-1280.png)과 [320px 화면](artifacts/platform-care-320.png)을 직접 확인했다. 콘솔 오류·외부 요청은 0개였다.

## 2026-10-02 현재 소스 — 내 작업실 통합

2026-10-02 당시 **소스 개발 플랫폼**의 제품 목록은 WORLD·메신저·교사·PATH·PULSE·외부 창작자/파트너(Partners) 6개였다. 실제 라이브러리는 계정 권한에 해당하는 항목만 표시한다. 교사·PATH는 별도 로컬 MVP, PULSE·Partners는 준비 중 상세다. 설치·실행·최근 이용 시간은 실제 확인된 상태만 표시한다.

**Studio의 제작·검토와 SHIFT의 AI 업무 연습은 SYNK Messenger → 내 작업실로 통합했다.** 플랫폼의 독립 Studio/SHIFT 항목, SHIFT 네이티브 미리보기와 `dev:shift` 명령을 종료했다. 제작 데스크·제작 도구·게시 전 점검은 기존 회사 작업 흐름을 사용하며 AI 업무 연습은 같은 작업실 안에서 이어간다. [회사 작업실 구현 범위](../docs/마케팅/온라인마케팅지도/engagement/company/WORKSPACE.md), [재사용하는 실습 모듈](../experiences/shift-workbench/README.md)을 따른다. 별도 외부 기업 교육 고객 공간은 만들지 않는다. SHIFT 사업 브랜드와 기존 실습 원본·개인 저장 데이터는 삭제하지 않았다.

메신저 네이티브 저장은 회사의 고정 문서에서 발생한 자기 출처 blob, `synk-shift-practice.txt`, `text/plain`, 최대 64 KiB만 허용한다. 같은 Electron 쿠키 세션의 `/api/me`로 회사 로그인을 재확인하고, 비로그인·세션 철회·문서 이탈이면 다운로드를 취소한다. 기존 WORLD·플랫폼 JSON 규칙은 그대로다. 실제 숨김 Electron에서 같은 운영 핸들러로 합성 TXT의 저장 완료와 본문 일치, 철회 후 취소, CSP 아래 모듈 import를 확인했다([다운로드 검증 4항목](artifacts/workroom-download-smoke-20261002.json)). 실제 운영 직원 자료나 기존 설치 패키지를 사용한 검증은 아니다.

통합은 접근 권한의 승격이 아니다. 서버가 확인한 `library.messenger` 메뉴 권한과 실제 회사 구성원 권한이 각각 필요하다. 이전 `library.studio`·`library.shift` 권한은 무시하며 Messenger로 바꾸지 않는다. 이전 즐겨찾기·선택·실행 기록의 퇴역 앱 키는 제거해 읽고, 현재 계정에서 허용된 첫 앱을 표시한다. 관심사에 ‘AI 업무 연습’이나 ‘콘텐츠 제작’을 골라도 권한이 없는 Messenger가 나타나지 않는다.

개발 플랫폼의 **교사 앱 미리보기**는 `teacher-main.cjs`를 별도 프로세스로 실행해 `/synk-account/teacher.html`을 연다. WORLD의 계정 화면에 들어가지 않고 교사 앱 자체에서 SYNK ID로 로그인하고 담당 수업을 선택한다. `im.synk.teacher.preview` 저장소·Chromium 세션·OAuth `clients.teacher` 등록은 WORLD와 분리하며 API 제품은 기존 `world`다. 교사 권한은 서버의 실제 담당 반으로 확인하고, 임의 역할 선택이나 학생의 개인 맞춤 기억 조회를 허용하지 않는다. 운영 로그인 설정이 없으면 준비 안내만 표시한다.

저장소 루트에서 `node experiences/learning-hub/server.mjs`를 시작한 뒤 `desktop`에서 `npm run dev:teacher -- --auth-config=C:/path/public-auth.json`으로 실행한다. 로그인 설정에는 [auth.example.json](auth.example.json)의 별도 `clients.teacher` 공개 클라이언트와 `/synk/oauth/teacher/callback`이 필요하다. 소스 플랫폼에서 열면 플랫폼 main이 받은 공개 설정 경로를 교사 프로세스에도 전달한다. 기존 로컬 수업 데모는 `npm run dev:classroom`으로 보존했다. 별도 세션의 WORLD·교사 창을 여는 4295 연결이며 운영 계정 연결과 섞지 않는다.

2026-10-04 로컬 재검증: [실제 Windows Electron 계정 연결 26/26](artifacts/teacher-account-current-20261004.json)은 DPAPI 저장·복구, PKCE loopback, 제한된 IPC, 교사 UI 과제 배정 → 학습자 API 제출 → 교사 UI 결과, 네트워크 중단·복구, 담당 반 철회·로그아웃, 1280/390px을 확인했다. 연결 복구 후에도 남던 오류 안내를 수정했다. 이 native 검사는 학습자 화면을 클릭하지 않으며 WORLD 화면 검사는 별도다. 합성 OAuth 제공자와 메모리 PostgreSQL을 사용했고 숨김 화면은 Electron offscreen compositor로 검사했다. [실제 teacher-main 부팅](artifacts/teacher-entry-current-20261004.json)도 로그인 미설정 상태에서 준비 화면·별도 세션·Node 차단을 통과했다. 데스크톱 전체 시험은 [151개 재통과 기록](artifacts/teacher-account-current-regression-20261004.txt)에 있다. 운영 OAuth 등록·배포, 정식 패키지·서명·설치, Mac/모바일 실기기 확인은 실행하지 않았다. [전체 수업 연결 범위](../experiences/teacher-world/README.md)를 따른다.

## PATH VR 로컬 MVP

[PATH 구현·검증](../experiences/path-vr/README.md)을 따른다. 저장소 루트에서 서버를 시작한다.

```powershell
node experiences/path-vr/server.mjs --port 4292
```

소스 플랫폼에서는 서버가 확인한 `library.path` 메뉴 권한이 있는 계정에만 **PATH MVP 열기**가 나타난다. 운영 SSO가 아직 연결되지 않은 개발 환경에서 직접 검토하려면 `desktop`에서 `npm run dev:path`를 실행한다. 테스트 역할을 운영 화면에 추가하거나 게스트에게 모든 앱을 노출하지 않는다.

PATH는 `im.synk.path.preview` 프로필과 세션을 사용한다. `synkProduct` 브리지는 환경·미연결 인증 상태와 PATH의 고정된 VR 브라우저 입구만 제공한다. 회사·WORLD 인증 토큰, 설치 API, 임의 URL 열기를 전달하지 않으며 다운로드도 허용하지 않는다. SHIFT의 이전 네이티브 실행 인자는 거부한다.

PATH의 네이티브 창은 PC 3D 모드다. 사용자가 **VR 지원 브라우저로 열기**를 선택하면 이 PC의 고정된 `http://127.0.0.1:4292/`를 연다. 실제 몰입형 VR은 WebXR 지원 브라우저·장비에서 확인해야 한다. 다른 기기의 헤드셋이나 휴대전화에서 이 PC의 loopback 주소에 접속할 수 있다고 안내하지 않는다. HTTPS 호스팅·기기 간 접근은 후속 범위다.

이 연결은 미패키징 개발 플랫폼에서만 활성화된다. 기존 설치 파일과 정식 업데이트 채널은 바꾸지 않았다. 운영 SYNK ID 동기화·서명된 설치본·실제 macOS/모바일·헤드셋 설치와 동작 검증은 MVP 이후다.

통합 후 검증: desktop 전체 **132개 시험**, 합성 계정의 1280/390/320px 실제 렌더러 **87항목** 통과. 계정별 메뉴·퇴역 권한 거절·선택/즐겨찾기 정리·메신저 작업실 설명·PATH 실행 경계를 확인했다. 넘침·콘솔 오류·외부 네트워크 요청은 없었다. 최신 화면 결과는 [라이브러리 화면 검증](artifacts/renderer-account-library-responsive-20261002.json)에 있다. 과거 [초기 확장 화면 검사](artifacts/renderer-expansion-responsive-20261002.json)와 [제품 클라이언트 검증](artifacts/product-native-smoke-20261002.json)의 독립 Studio/SHIFT 화면은 현재 메뉴가 아닌 이전 이력이다.

**2026-10-02 저녁 0.4.0 Windows 개발판 6개를 새로 묶었다.** 사용자 「남은 일 전부 최신화」(펠트 부품 흰 띠 정리 후속)에 따라 그때의 소스(작업실 통합·계정별 라이브러리·제품 확장·흰 띠를 걷은 런처 펠트, 소스 해시 `bd3430c784be…`)를 그대로 담았다. 정식 로그인·공개 업데이트·실제 설치 검증은 사용자 결정대로 MVP 이후다. 묶은 뒤에 바뀐 소스는 다시 묶기 전까지 소스 개발 플랫폼으로 확인한다.

> 이전 패키지 이력: 0.3.0 설치 파일 6개는 독립 PC 런처를 포함한 작업실 통합 이전 개발판이다. 플랫폼 화면은 앱에 번들되며 웹 개발 서버 없이 열린다. 운영자 공개 설정은 포함하지 않아 실제 로그인은 준비 중으로 표시된다. 기존 0.1.0·0.2.0·0.3.0 파일은 보존했다.

2026-10-02 기준. 플랫폼, WORLD, 사내 메신저는 **별도 설치·실행·저장 공간**을 갖는다. 0.4.0 플랫폼은 `synk-desktop://platform/index.html`에서 번들 화면·승인 자산을 열고, PC 창 제어와 앱 설치·실행 관리를 맡는다. 플랫폼 화면은 4280 서버에 의존하지 않는다. WORLD·메신저의 개발 서비스 연결은 그대로 분리해 둔다. 계정은 [로그인 구현·검증 기록](AUTH.md), 설치·실행은 [앱 수명주기 계약](LIFECYCLE.md)을 따른다. Mac 빌드 설정은 있지만 이 Windows 호스트에서 실제 Mac 설치 파일을 생성·실행한 것은 아니다.

## 2026-10-02 초기 Windows 설치 파일 이력

아래 `dist` 파일과 표는 초기 0.4.0 패키지의 보존 이력이다. 현재 PC의 플랫폼 설치본과 재설치 파일은 문서 상단의 **2026-10-09 최신 설치 파일**을 사용한다. 아래 초기 파일을 덮어쓰거나 다른 앱의 패키지를 함께 갱신하지 않았다.

아래 파일은 **서명되지 않은 개발판(0.4.0)**이다. 공개 배포판이 아니다. 플랫폼은 자체 번들 화면으로 부팅하며 WORLD·메신저의 개발 서비스는 각 로컬 서버가 필요하다. 설치 프로그램은 실행하지 않았고 설치·제거·설치 후 앱 간 실행은 아직 실제 기기에서 검증하지 않았다. 설치 완료 시 앱은 자동으로 열리지 않는다.

| 앱 | 일반 Windows PC — x64 | Windows ARM64 |
| --- | --- | --- |
| SYNK Platform Preview | [설치 파일](<dist/preview/win32/x64/platform/SYNK Platform Preview-0.4.0-win-x64.exe>) | [설치 파일](<dist/preview/win32/arm64/platform/SYNK Platform Preview-0.4.0-win-arm64.exe>) |
| SYNK WORLD Preview | [설치 파일](<dist/preview/win32/x64/world/SYNK WORLD Preview-0.4.0-win-x64.exe>) | [설치 파일](<dist/preview/win32/arm64/world/SYNK WORLD Preview-0.4.0-win-arm64.exe>) |
| SYNK Messenger Preview | [설치 파일](<dist/preview/win32/x64/messenger/SYNK Messenger Preview-0.4.0-win-x64.exe>) | [설치 파일](<dist/preview/win32/arm64/messenger/SYNK Messenger Preview-0.4.0-win-arm64.exe>) |

플랫폼 설치 파일에는 WORLD·메신저의 개발 설치 파일 두 개를 포함한다. 포함했다는 이유로 두 앱을 자동 설치하지 않으며, 라이브러리에서 각 앱의 설치 준비와 설치 시작을 따로 누른다.

설치 파일·실행 파일·ASAR의 절대 경로와 SHA-256, CPU 형식, 소스·번들 자산 일치는 [패키지 검사 결과](artifacts/package-verification.json)에 있다. [서명 검사 결과](artifacts/package-signatures.json)는 0.4.0 6개 모두 NotSigned다. dist, .stage, artifacts는 로컬 생성물로 Git에 포함하지 않는다.

| 0.4.0 설치 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| 플랫폼 x64 | 395811266 | `697e015392833792ab2dcfd8154786aef21057f9d6168c36d099b8ccd5a947b1` |
| WORLD x64 | 132194294 | `c576a12bfc8c995ab78c38183519ca5562dbbab148d846accaa5f015b4e9efe2` |
| 메신저 x64 | 132140267 | `1b470951bed9af48ec3594109d040ab12d86ea2b1ddc912e0f41a9994ca3e0b4` |
| 플랫폼 ARM64 | 377485857 | `ce542833ff2ececc3a0f67b53e773674cdb223eb8a47e311571f1147404e376f` |
| WORLD ARM64 | 126086171 | `1e6b7f7f62bb3b59c83f5871b7425c119cca8e3ec897d5f8d4cb14f5eac45b28` |
| 메신저 ARM64 | 126033730 | `c18939e2f5f033ab96d202e52e3fd3edd6216d46869dd2d894d0deba1480aef2` |

이전 0.3.0 설치 파일(보존):

| 0.3.0 설치 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| 플랫폼 x64 | 358702733 | `567e40ebedc29437d758b91c8433fba51eb85b988c7d8f7eb104357c95d2e781` |
| WORLD x64 | 119743754 | `655af3811ccb85be4582b2c45a3bc8fcf1fdc3618836eaa1009b56979b80a064` |
| 메신저 x64 | 119689645 | `261ddeca4c7768140f478325e2e864a04ac666a939db349c7c67dc2790c84474` |
| 플랫폼 ARM64 | 340378202 | `aad928129e59102365a832d5460401e3124a771bf34dd5807c24f3f8dbaad650` |
| WORLD ARM64 | 113635682 | `504017afb0a83ec97b9cde579ca5b922b1956e96003e21be11597b5825b18a94` |
| 메신저 ARM64 | 113583196 | `1ee0b614addd8c92427a9ddbb6e64b20e68fb0ebecd0b0b22d75d5efa27797f8` |

| 앱 | 현재 입구 |
| --- | --- |
| 플랫폼 | synk-desktop://platform/index.html — 앱 내부 번들 |
| WORLD | http://127.0.0.1:4280/synk-account/client.html?product=world |
| 메신저 | http://127.0.0.1:4191/?tab=messenger |

WORLD·메신저의 실행 파일에 서비스와 데이터베이스를 포함한 것은 아니다. 플랫폼 화면은 4280 없이 열리지만, 개발 WORLD의 학습 기능과 메신저 서비스에는 각각의 서버가 필요하다.

## 앱 구분과 실행 계약

| 앱 | 정식 appId | 정식 실행 이름 | 개발판 appId / 실행 이름 |
| --- | --- | --- | --- |
| 플랫폼 | `im.synk.platform` | `SYNKPlatform` | `im.synk.platform.preview` / `SYNKPlatformPreview` |
| WORLD | `im.synk.world` | `SYNKWorld` | `im.synk.world.preview` / `SYNKWorldPreview` |
| 메신저 | `im.synk.messenger` | `SYNKMessenger` | `im.synk.messenger.preview` / `SYNKMessengerPreview` |

Electron `userData`는 OS의 `appData/SYNK Desktop/<appId>`에, Chromium 세션은 그 안에 둔다. 세 앱과 개발판·정식판은 저장 공간을 공유하지 않는다. 패키징 안 된 소스 실행(`--synk-dev`)은 설치된 개발판과도 나눠 `<appId>.source` 폴더·단일 실행 잠금·작업 표시줄 ID를 쓰고, 앱끼리 로그인 선택을 맞추는 Suite 폴더도 `Suite/development.source/`를 쓴다(설치된 개발판은 `Suite/development/`, 2026-10-19). 설치 앱은 Care 알림 때문에 늘 켜져 있어 소스 실행 창이 그 프로필·잠금을 같이 쓰면 뜨지 못하고 설치 앱의 로그인·설정을 바꾸기 때문이다. 둘이 같이 켜지므로 소스 실행의 앱 이름(트레이 툴팁·창 제목)에는 「(소스 실행)」이 붙는다. 소스 실행이 띄우는 교사·제품 미리보기와 `npm run dev:care` 같은 단독 미리보기는 소스 실행 쪽 Suite의 마지막 선택을 따르고(기록이 없으면 자기 금고로만 로그인), 소스 실행에서 연 설치된 WORLD·Workspace는 설치된 Platform 쪽 Suite를 따른다. SYNK ID를 공통 계정으로 쓰는 것과 각 앱의 토큰·기록을 자동 복사하는 것은 별개다. 이번 셸은 인증 토큰을 앱 간 전달하지 않는다.

Windows 설치 위치는 `%LOCALAPPDATA%/Programs/<실행 이름>/`, Mac 빌드의 앱 이름은 `<실행 이름>.app`이다. 실제 Electron Builder의 `productFilename`과 NSIS 설치 경로를 회귀시험으로 대조했다. 런처는 Windows의 해당 고정 위치와 Mac의 `/Applications/`만 찾는다.

앱 관리용 브리지는 다음과 같다. 계정용 제한된 브리지는 [AUTH.md](AUTH.md)에 따로 정의했다.

```js
await window.synkDesktop.getEnvironment(); // clientId, mode, platform, arch, version, sessionScope
await window.synkDesktop.getClients();     // id, name, status, canLaunch, reason, version?
await window.synkDesktop.launch('world');   // { ok: true } 또는 { ok: false, code }
await window.synkDesktop.prepareClient('world'); // 로컬 설치 파일 복사·SHA 확인
await window.synkDesktop.cancelPreparation('world');
await window.synkDesktop.openInstaller('world'); // 명시적 클릭에서만 OS로 열기
const unsubscribe = window.synkDesktop.onClientsChanged(clients => {});
```

실행·설치는 플랫폼에서만 허용된다. `world`·`messenger` 등 고정 ID로 해당 앱의 설치 메타데이터와 실행 파일·ASAR 해시를 확인한 뒤 `shell:false`로 실행한다. 임의 경로·명령·다운로드 URL은 받지 않는다. 설치 정보나 승인한 해시가 없으면 실행하지 않는다. 개발판은 WORLD → 메신저 → 플랫폼 순서로 빌드하고, 플랫폼에 최신 두 앱의 검증된 설치 파일과 실행 해시를 넣는다. 승인된 구버전 실행 해시는 보존한다. 직접 실행하는 개발 런처는 `tools/build-client-catalog.cjs`로 생성한 고정 카탈로그를 읽는다. 공개 다운로드·자동 업데이트 서버는 연결하지 않았다.

설치 파일 준비 진행률은 실제 로컬 복사 바이트다. 준비를 취소할 수 있고, 준비 완료 후 별도의 설치 버튼으로 열기 직전에 다시 해시를 검사한다. 설치 프로그램 열기를 설치 완료로 표시하지 않는다. 실제 설치 확인과 버전 비교·업데이트 상태는 고정 OS 경로의 파일 검사 결과를 사용한다. 자세한 상태와 검증은 [LIFECYCLE.md](LIFECYCLE.md)에 있다.

## 확인한 범위

- 전체 데스크톱 시험 **58개 통과**. 기존 셸·인증 경계, 설치 파일 준비·취소·변조 거절, 구버전 실행과 업데이트 비교, 번들 프로토콜, 렌더러 상태와 실제 문서 연결을 검사했다.
- [실제 Electron 플랫폼 검사](artifacts/platform-native-smoke.json): Windows x64 Electron 44.5.1의 숨김 창에서 라이브러리·설치 관리·설정·검색·즐겨찾기와 설정 유지·상세/계정 대화상자·키보드·폰트·창 제어 허용 목록 **14항목**을 통과했다. HTTP/HTTPS/WS/WSS 요청을 차단해도 번들 화면이 열렸고 네트워크 요청·콘솔 오류는 0이었다. 설치 프로그램·WORLD·메신저 실행과 실제 로그인은 이 검사에서 시작하지 않았다.
- [실제 0.4.0 패키지 부팅 검사](artifacts/package-native-smoke.json): x64 패키지의 SYNKPlatformPreview.exe를 직접 실행해 내부 번들 입구, 네트워크 없는 부팅, IPC 경계, DPAPI 암호화 보관을 확인했다. **설치 프로그램 실행이나 설치 완료 증거는 아니다.** 초기 compositor 프레임인 platform-packaged-hidden-preview.png는 시각 검증 근거로 쓰지 않는다.
- [반응형 화면 검사](artifacts/renderer-responsive-20261002.json): 번들 렌더러의 960·390·320px에서 페이지와 본문 가로 넘침 0, 앱 선택·설치 관리·설정과 접근 가능한 계정 입구를 확인했다. 브라우저의 표시 검사이며 Android/iOS 네이티브 패키지·기기 검증이 아니다. 실제 PC 창의 접근성 입구도 확인했지만 GUI 도구의 좌표·캡처 불일치로 해당 방식의 클릭 검증은 주장하지 않는다. 후속 실제 패키지의 보이는 독립 창에서 0.3.0 메신저 라이브러리·설치 상태·114.1 MB 표시와 완성 렌더를 확인했다. 사용자가 Escape로 컴퓨터 제어를 중단한 뒤 추가 입력하지 않았다.
- [패키지 검사](artifacts/package-verification.json): 0.4.0 설치 파일 6개, x64/ARM64 실행 형식, 소스·렌더러·승인 자산의 ASAR 바이트, 앱 ID·버전·실행 해시, 플랫폼 안의 WORLD·메신저 설치 파일 두 개를 대조했다. 운영 인증 공개 설정은 미제공으로 authConfigured:false다.
- [설치 파일 수명주기 검사](artifacts/lifecycle-smoke.json): 실제 WORLD 0.4.0 파일 **132,194,294바이트** 복사·SHA 검증과 메신저 준비 취소를 통과했다. OS 설치 위치는 합성 미설치 경로를 썼으며 설치·앱 실행 함수 호출은 0이다. [상태·회귀 계약](LIFECYCLE.md).
- Windows 설치 파일 6개는 모두 서명되지 않았다. **미실시**: NSIS 설치·제거, 설치한 앱 간 실제 실행, Windows ARM64 실행, Mac 설치 파일·실기기 실행·서명·공증, 운영 SYNK ID 연결, 공개 배포·자동 업데이트.

아래는 실제 Electron 소스 실행에서 위 14항목을 검사한 뒤 캡처한 완성 화면이다. 웹 브라우저 화면이나 설치 완료 증거로 대체하지 않는다. [WORLD 라이브러리](artifacts/platform-hidden-preview.png) · [메신저](artifacts/platform-messenger-hidden-preview.png) · [설치 관리](artifacts/platform-downloads-hidden-preview.png) · [설정](artifacts/platform-settings-hidden-preview.png).

![SYNK 플랫폼 — 실제 Electron 라이브러리](artifacts/platform-hidden-preview.png)

## 보안 경계와 현재 기능 제한

`sandbox`, `contextIsolation`, `webSecurity`를 켜고 Node·webview·임의 팝업·임의 외부 실행은 끈다. IPC는 해당 창의 최상위 프레임과 정확한 입구 경로를 확인한다. 클라이언트끼리 같은 origin을 쓰더라도 상대 입구를 같은 창에서 열 수 없다. 허용한 웹 체험 링크만 기본 브라우저로 연다. 자식 게임 문서의 `frame-ancestors`는 `'self'`, 최상위는 `'none'`이다.

플랫폼 렌더러는 외부 네트워크 연결과 iframe을 허용하지 않으며 계정·설치 기능은 허용된 main-process 브리지를 사용한다. WORLD의 연결된 학습 기록은 같은 origin의 `application/json` Blob 및 정해진 파일 이름으로 **최대 32 MiB**까지 저장할 수 있다. 메신저 첨부파일 저장과 마이크·카메라 권한은 아직 별도 허용 흐름을 구현하지 않았다. OAuth는 기본 브라우저와 일회성 loopback 콜백을 사용하며 운영자 공개 설정·클라이언트 등록이 필요하다.

아이콘은 기존 승인 자산을 색·모양 변경 없이 흰 바탕에 배치해 PNG·ICO·ICNS로 변환했다. [원본 경로·해시 기록](assets/sources.json), [변환 도구](tools/icons.cjs)에 재현 방법이 있다. 플랫폼은 SYNK 로고, WORLD는 책, 메신저는 노트북 자산을 사용한다.

## 재현과 Mac 빌드

`desktop`에서 Node 24와 잠금 파일을 사용한다.

```powershell
npm ci
npm test
node tools/smoke.cjs
node tools/package.cjs --mode=development --platform=win32 --arch=x64
node tools/package.cjs --mode=development --platform=win32 --arch=arm64
node tools/verify-packages.cjs
node tools/build-client-catalog.cjs
node tools/lifecycle-smoke.cjs
```

전체 세 앱의 `smoke`에는 WORLD·메신저 로컬 서버가 필요하다. 플랫폼 자체는 서버 없이 열린다. 직접 화면을 열려면 `npm run dev:platform`, `npm run dev:world`, `npm run dev:messenger`를 사용한다.

Mac에서는 다음 명령이 DMG와 ZIP을 만드는 빌드 경로다. 이 호스트에서 실제 성공을 확인한 명령은 아니다.

```sh
npm ci
npm test
CSC_IDENTITY_AUTO_DISCOVERY=false node tools/package.cjs --mode=development --platform=darwin --arch=x64
CSC_IDENTITY_AUTO_DISCOVERY=false node tools/package.cjs --mode=development --platform=darwin --arch=arm64
```

[macOS 빌드 workflow](macos-build.workflow.yml)는 `macos-latest`의 x64/ARM64 작업과 artifact 업로드를 준비한 **비활성 템플릿**이다. `.github/workflows/`에 등록하거나 CI를 실행하지 않았다. 서명·공증과 실제 Mac 기기 확인은 남아 있다.

Windows의 Electron Builder는 Mac 빌드를 거절했다. 공식 `@electron/packager` 20.3.0으로 WORLD ARM64 `.app` 생성도 시도했지만 아래 메시지로 종료됐다. [실행 로그](artifacts/mac-cross.log)에 남겼으며, 권한을 높이거나 심볼릭 링크를 손실하는 압축으로 우회하지 않았다. x64 Mac 교차 패키징은 별도 실행하지 않았다.

```text
Cannot create symlinks (on Windows hosts, it requires admin privileges); skipping darwin platform
No Mac artifact created: this Windows host cannot create the required symbolic links. Build on macOS; no privilege escalation was attempted.
```

## 정식 배포 전 남은 일

공개 서버와 다운로드·업데이트 채널, 승인한 패키지 해시, 코드 서명, Mac 공증·기기 검증을 준비해야 한다. `--mode=release`는 별도 `--release-config`의 `version:1`, `approved:true`, WORLD·메신저의 HTTPS `entries` 및 `releases` 해시 목록을 요구하고 코드 서명을 강제한다. 로컬 주소는 개발 모드에만 허용하며 정식 서버 URL을 임의로 정하지 않았다. 이번 작업에서 운영 설정·배포·결제·인증 제공자 설정을 바꾸지 않았다.

기반 버전은 Electron **44.5.1**(공식 2026-09-29 안정판), Electron Builder 26.15.3, Electron Packager 20.3.0이다. [Electron 보안 지침](https://www.electronjs.org/docs/latest/tutorial/security), [44.5.1 공식 릴리스](https://releases.electronjs.org/release/v44.5.1), [Electron Packager 공식 문서](https://electron.github.io/packager/main/)를 확인했다.


## 전사용자 맞춤 입구·브랜드 색 — 2026-10-02

앱 상세·라이브러리는 승인 사업색과 실제 펠트 자산을 사용한다. 현재 독립 앱은 LAB 코럴·PATH 초록·PULSE 베리를 사용하며 메신저 작업실을 포함한 공통 도구는 SYNK Paper/Black을 바탕으로 한다. 자산 원본은 `assets/launcher/sources.json`의 실제 파일을 따른다.

처음 맞춤 설정에서 사용 맥락·목적·글자·설명량·움직임을 자발적으로 고르면 `renderer/personalization.mjs`가 Core의 `atlas/personalization.js`를 통해 추천과 라이브러리 순서를 바꾼다. 후속 계정별 표시 변경으로 추천 후보는 **현재 계정에 허용된 앱**으로 제한한다. 명시 동의 후 이 기기의 `SYNK ID / platform / launcher / SYNK` 범위에 저장하며 비로그인 설정만 `anonymous-local`을 쓴다. 변경·건너뛰기·삭제를 제공하고 계정 사이에 복사하지 않는다. 학습·회사 기록을 읽지 않고 서버 프로필·다른 기기 동기화로 표시하지 않는다. 준비된 앱의 설치·권한을 이 선택으로 부여하지 않는다.

- 아래 80개·32항목은 계정별 노출 변경 전의 검증 이력이다. 최신 검증은 다음 절을 따른다.
- 이전 확장판 이력 — 전체 `node --test desktop/tests/*.test.cjs`: 80개 통과. 이 중 renderer 개인화·표현 관련 28개.
- 이전 확장판 이력 — `node desktop/tools/renderer-responsive-smoke.cjs`: 숨김 Electron의 실제 렌더러에서 8개 앱×1280/390/320px와 설정 적용·복원·삭제, 32항목 통과. 넘침·JS 오류·외부 네트워크 요청 0.
- 결과: `artifacts/renderer-personalization-responsive-20261002.json`, `artifacts/platform-branded-{id}-{width}.png`, `artifacts/platform-personal-dialog-320.png`.

이 변경은 개발 소스와 그 검증에 반영되었다. 기존 배포용 설치 파일을 재생성하지 않았으며 운영 로그인·업데이트·실제 설치 검증의 MVP 이후 유예를 유지한다. [전사용자 개인화 방향과 역할별 적용](../docs/SYNK_전사용자_개인화_기반_20261002.md).

## 계정별 라이브러리 — 2026-10-02 후속

현재 6개 앱을 모든 계정에 펼치지 않는다. 인증된 계정 조회 결과를 `src/library-access.cjs`가 최소한의 `library:{status:'ready'|'unavailable',appIds:[]}`로 바꾸고, 렌더러는 그 목록만 사용한다.

- 활성 학생 소속 → WORLD. 교사·원장 소속 → 교사 앱. 학원 직원과 회사 직원을 같은 역할로 취급하지 않는다.
- 기존 WORLD `practice.plus` 이용권 → WORLD. 명시적 `platform / library.{앱ID}` 이용권 → 그 앱의 메뉴. 회사 데이터나 학생 데이터의 실제 접근은 각 서비스가 별도로 검사한다. 신규 이용권 발급·DB 변경은 하지 않았다.
- 여러 소속·이용권은 합집합, 확인 실패·복원 중에는 0개, 확인됐지만 연결된 앱이 없으면 빈 목록. 완전 비로그인 상태만 공개 WORLD 소개 1개를 표시한다.
- 사이드바·상세·검색·추천·즐겨찾기·설치 목록·다운로드 수를 함께 제한한다. 관심사 자기신고는 허용 앱의 순서만 바꾼다.
- 보기 설정 `synk-launcher-view-v1:account:{ID}`, 맞춤 설정 `synk.platform.launcher.personalization.v1:account:{ID}`는 이 기기의 계정별 저장이다. 기존 키는 비로그인 전용이다. 계정 전환·로그아웃 때 열린 앱/콘텐츠 상세를 닫으며 이전 명령의 늦은 결과를 새 계정에 기록하지 않는다.
- 창 포커스 복귀 시 `accountRequest('load')`로 소속·권한을 재확인한다. 만료·철회·계정 전환·응답 순서 역전은 실패 시 닫는 정책으로 처리한다.

정식 SSO 설정과 실제 사용자 계정 연결은 MVP 이후다. 검증은 합성 인증 서버와 합성 계정을 사용하며 새 패키지·공개 배포·실기기 설치를 뜻하지 않는다.

계정별 노출 초기 검증 이력: `node --test desktop/tests/*.test.cjs` 109개 통과. 현재 작업실 통합 검증은 문서 위의 132개 결과를 따른다. 같은 계정 갱신 중 선택·검색 보존, 이전 로그인·로그아웃 요청의 늦은 결과 무시, 실제 signed-out 이벤트 뒤에도 로컬 저장 삭제/서버 세션 종료 실패를 정확히 안내하는 회귀 시험을 포함한다. 병행 작업에서 갱신된 Atlas 원문은 `node desktop/tools/build-renderer-assets.cjs`로 소비 사본에 동기화했다.

당시 동기화된 사본으로 실제 숨김 Electron의 학생·교사·직원·고객·미연결·오류 상태와 1280/390/320px **69항목**, 실제 네이티브 브리지 **16항목**을 통과했다. 콘솔 오류·외부 네트워크 요청은 0개다. 테스트 전용 `tools/renderer-account-fixture.cjs`는 운영 화면의 역할 선택 기능이 아니며 인증·설치·클라이언트 실행을 하지 않는다. [최신 계정별 UI 결과(통합 후 87항목)](artifacts/renderer-account-library-responsive-20261002.json), [네이티브 결과](artifacts/platform-native-smoke.json), [학생 화면](artifacts/platform-account-student-1280.png), [교사 작은 화면](artifacts/platform-account-teacher-320.png).
