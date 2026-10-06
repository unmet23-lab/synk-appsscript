# SYNK 데스크톱 클라이언트

## 2026-10-06 플랫폼 화면 리디자인 — 싱ㅋ 시그널

유호님 요청(「GPT가 만든 플랫폼 디자인이 촌스럽다. 기능적이면서 최신·젊은 디자인으로 전부 교체, 홈페이지의 싱ㅋ처럼 쿨하게」)으로 런처 화면 전체를 Claude가 다시 그렸다. 기능·권한·IPC·저장 키·요소 ID는 그대로이고 겉모습과 화면 구성만 바꿨다. 규칙과 새 앱을 더하는 법은 [플랫폼 화면 — 싱ㅋ 시그널](../docs/디자인/플랫폼_시그널/README.md), Recent(옛 Godly) 136개 항목 조사는 [조사 기록](../docs/디자인/플랫폼_시그널/조사_20261006.md)에 있다. 웹 플랫폼(`experiences/synk-account/platform.html`)도 같은 언어로 바꿨다.

- 밤(기본)·낮·기기 설정 테마를 설정에서 고른다(이 기기의 `synk-platform-theme`). 플랫폼 창 배경도 밤 바탕 `#08090C`로 바꿨다.
- 앱마다 사업 색 포스터에 큰 한글 이름(월드·메신저·패스·펄스·플레저·운세…). 승인 그림은 흑백 곱하기 이중톤으로만 쓰고 펠트 판 단추·칩은 쓰지 않는다. 상단 한 줄(싱ㅋ 표식·알약 메뉴·계정), 왼쪽 라이브러리(글자 타일·LED 상태), 아래 떠 있는 상태 알약.
- 같은 날 GPT의 「무료 운세」 추가와 3방향으로 합쳤다(운세 포스터는 팝 `#E05C97`, 혜택이 넷이면 2×2). 합친 상태에서 `node --test desktop/tests/*.test.cjs` 168/168, `experiences/synk-account` 95/95, 숨김 Electron 반응형 87/87·회원 혜택 19/19·플레저 런처·운세 38/38(합성 계정, 로그인·설치·외부 요청 없음). 0.4.0 설치 패키지는 다시 묶지 않았다(이전 화면).

## 2026-10-06 회원 혜택 — SYNK FOR YOU

상단 **회원 혜택** 메뉴와 라이브러리 소개 배너를 추가했다. 브랜드 문구는 **소중한 순간을, 더 잘.**이며, **플레저 → 무료 운세 → 중요한 대화 리허설 → 가족 이야기 앨범** 순서로 네 서비스를 소개한다. 기간제 무료체험으로 표시하지 않고 **SYNK 회원 무료 제공 예정**으로 안내한다.

공개 소개는 로그인·앱 메뉴 권한과 분리된다. 네 서비스의 소개·상세·이동·검색 결과는 모두 볼 수 있지만, 실행은 각각 서버 `library.care`·`library.fortune`·`library.rehearsal`·`library.family-album` 권한과 미패키징 PC 개발판의 `productPreviewsAvailable` 검사를 모두 만족해야 한다. 공개 카탈로그·학생 역할·관심사나 다른 서비스 권한만으로 실행 권한이 생기지 않는다. 공유 카탈로그는 [`renderer/benefits.mjs`](renderer/benefits.mjs)이며 웹 플랫폼도 이 파일을 읽는다.

리허설과 가족 앨범도 별도 로컬 개발 클라이언트로 연결했다. 회원 무료 제공은 운영 방향이며, 정식 계정 동기화·온라인 공동 편집·운영 이용권 배포는 아직 없다.

| 개발 클라이언트 | 로컬 서버 | 실행 | 별도 저장소·세션 |
|---|---|---|---|
| 무료 운세 | `http://127.0.0.1:4299/` · `node experiences/daily-fortune/server.mjs` | `npm --prefix desktop run dev:fortune` | `im.synk.fortune.preview` |
| 중요한 대화 리허설 | `http://127.0.0.1:4297/` · `node experiences/conversation-rehearsal/server.mjs` | `npm --prefix desktop run dev:rehearsal` | `im.synk.rehearsal.preview` |
| 가족 이야기 앨범 | `http://127.0.0.1:4298/` · `node experiences/family-album/server.mjs` | `npm --prefix desktop run dev:family-album` | `im.synk.family-album.preview` |

리허설은 준비된 시나리오·직접 작성한 답변·자기 회고·재시도 비교를 사용한다. 생성형 AI 대화로 표시하지 않는다. 가족 앨범은 사진·이야기·원래 녹음한 음성과 누가 보탠 기억인지를 이 기기에 저장한다. 온라인 가족 초대·공유로 표시하지 않는다. 네이티브 마이크 권한은 계속 거절하며 음성 파일 첨부와 고정 브라우저 열기를 사용한다.

네이티브 내보내기는 자기 앱의 루트 문서가 만든 동일 출처 Blob만 받는다. 리허설은 `synk-rehearsal.json`(`application/json`, 최대 500,000 bytes)과 `synk-rehearsal-book.html`(`text/html`, 최대 2 MiB), 가족 앨범은 `synk-family-album.json`(`application/json`, 최대 32 MiB)과 `synk-family-album.zip`(`application/zip`, 최대 64 MiB)을 허용한다. 소장용 파일은 독립 열람·인쇄와 원본 보관용이며 복원은 기존 JSON 파일로 한다. 저장 중 커진 파일도 취소한다. 기존 플레저 ICS·JSON 상한과 PATH 다운로드 금지는 유지한다.

무료 운세는 **별자리 운세 / 한국 사주**를 선택한다. 별자리는 12궁의 오늘 운세, 사주는 양력 생년월일·출생시각(시간 모름 가능)으로 KST 기준 만세력 네 기둥·일간·겉글자 오행 분포와 전통 상징에 따른 풀이를 제공한다. 이번 주 읽을거리·풀이 안내와 함께 로그인한 계정에 출생정보·선호 방식·결과·실천 메모를 직접 저장하는 보관함을 추가했다. 비회원 입력은 메모리만 사용하며 유료 AI 호출은 없다. 계정 저장은 고유 `fortune` OAuth 키와 별도 암호화 저장소, 고정 `synk-fortune` API로 연결한다. 2026-10-06 운영·리허설 DB와 함수 v1, 전용 OAuth·동의 포털·로컬 공개 설정을 연결했고 리허설 합성 계정으로 실제 OAuth 저장 왕복을 확인했다. 운영 설정의 네이티브 기동은 configured/ready/secureStorage true·signedIn false이며 실제 회원 로그인·두 실물 기기 검증은 미실행이다. 구현·실행·검증 범위는 [무료 운세 README](../experiences/daily-fortune/README.md)를 따른다. 웹은 loopback 개발 환경에만 고정 앱 링크를 표시하며, 운영 이용권 부여·일반 공개 운세 웹 호스팅·새 설치본 배포는 이번 반영 범위에 포함하지 않는다.

계정·보관함 확장판의 초기 검증 이력(2026-10-06): 앱 58/58·관련 데스크톱/웹 55/55·중앙 백엔드 80/80 시험과 [합성 계정 브라우저 24상태](../experiences/daily-fortune/qa/account-browser-smoke.json)를 통과했다. [당시 운세 네이티브 창](artifacts/fortune-account-native-20261006.json)은 독립 프로필·6개 인증/요청 메서드·암호화 저장소 가용성을 확인한 로그인 미설정 이력이다. 후속 앱 60개 시험과 운영 설정 기동·원격 연결 결과는 [현재 운세 원문](../experiences/daily-fortune/README.md)에 있으며, 두 기록 모두 실제 회원 인증 완료를 뜻하지 않는다.

계정·보관함 추가 전 별자리·사주판 검증 이력(2026-10-06): 앱 자동 시험 20/20, 관련 플랫폼 자동 시험 56/56, 웹 빌드 일치 검사를 통과했다. [당시 Chrome 상호작용 검사](../experiences/daily-fortune/qa/saju-browser-smoke.json)에서 네 화면 폭의 선택·사주 계산·복사·초기화와 저장/외부 전송 없음을 확인했고, [당시 네이티브 창](artifacts/fortune-saju-native-20261006.json)도 새 앱을 오류 없이 로드했다. 계정 확장판의 최신 검증과 구분한다.

별자리·사주 추가 전 무료 운세 연결 검증 이력(2026-10-06): 데스크톱·웹 관련 자동 시험 175/175, [플랫폼 실제 화면 38/38](artifacts/fortune-platform-20261006.json)을 통과했다. 1280·390·320px에서 플레저 다음 배치·검색·상세·이미지와 합성 이용권/철회를 확인했다. [독립 운세 클라이언트](artifacts/fortune-client-native-20261006.json)도 숨김 Electron에서 4299 로드·독립 세션·콘솔 오류 없음으로 확인했다. 운영 로그인·회원 권한 부여·배포 검증은 아니다.

운세 추가 전 검증 이력: 후속 두 앱 연결을 포함한 전체 데스크톱 시험 **166/166** 통과. 고정 포트·별도 세션·제품 간 권한 거절·서버 메뉴 권한 철회·정확한 파일명/MIME/용량·사후 스트림 상한·개인화 목록을 확인했다. 이번 두 앱의 실제 화면 검증은 각 앱의 QA 범위를 따른다. 아래 숨김 Electron 캡처는 두 서비스가 소개 상태였던 초기 회원 혜택 화면의 이력이며 현재 두 앱 실행 검증을 뜻하지 않는다.

초기 소개 화면 검증 이력: 1280·390·320px에서 목록·세 상세·돌아가기·권한 철회·기존 플레저 미리보기 브리지 연결 **19/19**. 가로 넘침·이미지 로딩 오류·콘솔 오류·외부 요청 0개. [당시 결과](artifacts/benefits-native-20261005.json), [PC 화면](artifacts/platform-benefits-1280.png), [320px 화면](artifacts/platform-benefits-320.png). 운영 로그인·실제 앱 실행·유료 AI·설치 패키지 재배포를 뜻하지 않는다.

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

## 생성한 Windows 설치 파일

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

Electron `userData`는 OS의 `appData/SYNK Desktop/<appId>`에, Chromium 세션은 그 안에 둔다. 세 앱과 개발판·정식판은 저장 공간을 공유하지 않는다. SYNK ID를 공통 계정으로 쓰는 것과 각 앱의 토큰·기록을 자동 복사하는 것은 별개다. 이번 셸은 인증 토큰을 앱 간 전달하지 않는다.

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
