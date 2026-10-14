# SYNK ID · 브라우저 계정과 제품 연결

중앙 이메일 로그인·일반 가입·비밀번호 복구·OAuth 동의 화면과 플랫폼/WORLD의 브라우저 소비처다. 운영 연결·메일·실제 계정 왕복의 최신 범위는 [통합 계정 현황](qa/unified-account-20261006.md)을 따른다. 아래 오래된 구현 기록의 미검증 문장을 현재 전체 상태로 해석하지 않는다. `config.json`이 없으면 준비 전 안내와 기본 학습 링크만 보인다.

<a id="path-interview-entry-20261012"></a>
## 2026-10-12 PATH 실사 면접실 진입 공개

홈·둘러보기·PATH 상세와 즐겨찾기·최근 열기를 [실사 면접실](https://synk.im/path/interview/film/rehearsal.html)에 연결했다. PATH는 설치·로그인 없이 열리며 계정 확인 중이나 연결 오류 때도 실행을 막지 않고, 계정 ID를 주소에 전달하지 않는다. WORLD·Workspace의 기존 실행·인증 경계와 두 앱만 표시하는 설치 목록은 유지한다. 공유 원문은 `src/applications.mjs`, `src/platform.mjs`, `src/platform-home.mjs`이며 관련39개 검사가 통과했다.

공유 소스 전체 빌드가 기존 공개 번들과 달라 통째로 배포하지 않았다. 공개 `account/dist/platform.js`의 PATH 관련10곳만 수정했고, 역변환으로 이전 전체 바이트가 복원되는지 확인했다. 같은 공개 기반 후보로 계정 오류·확인 중 실행, PATH 홈·상세·이용 안내, 기존 두 앱 경계 등17개 런타임 검사가 통과했다. `.tmp/path-web-platform-20261012/public-transform.json`에 공개 기준·후보 해시와 변경 토큰을 남겼으며, 웹 플랫폼에서 바꾼 공개 파일은 `account/dist/platform.js` 하나다. `config.json`, `client.js`, CSS와 인증 등록·계정·노트 로직은 그대로다.

공개 커밋 `1e4190072bab19bffdba83c3aa20708adac8ae27`, [Pages 배포 성공](https://github.com/unmet23-lab/synk-policy/actions/runs/38169586579). 면접실을 포함한 공개59파일의 SHA와 영상·모델15개의 Range206 응답을 대조했다. 실제 공개 웹 플랫폼에서 둘러보기→PATH 상세→실사 면접실 새 탭의 주소를 확인했으며 로그인·로그아웃·노트 작업은 하지 않았다. 현재 PC Platform0.4.3에도 진입 네 파일을 갱신했지만 새 공개 설치파일은 내지 않았다. 실제 Quest 착용·마이크·멀미 효과와 설치된 네이티브 버튼 확인은 남는다. [공개·설치 검증](../path-vr/qa/public-release-20261012/README.md).

## 2026-10-09 메모 관리와 복구 안내

미완료 우선·완료 목록 접기, 메모 제목/앱 수정, 현재 화면에서 삭제 되돌리기, 60개 보관 한도 안내를 추가했다. 기존 새 초안을 보존한 채 메모를 수정하고 저장·취소 뒤 원래 입력으로 복귀한다. 계정 재진입은 서버 기록을 먼저 열고 과거 미저장 복구본은 별도로 남긴다. 다른 계정·문서로 바뀔 때 임시 편집과 삭제 되돌리기는 초기화한다. 공개 후보에는 메모 view/data·notebook/sync 네 원문과 library CSS만 선택했다. 통합458·정확 native 메모47/입력38·1280/390 화면 통과. 웹 `917faae` Pages/공개 바이트 대조 및 PC `f9d48267` 세 앱 설치·프로필 보존 완료. 실제 계정 PC↔웹 동시 저장 충돌·복구본 보존·완료 상태 왕복도 확인했다. 전체 사이트 CI는 두 시도에서 각각 별도 게임 파일1개의 503으로 실패했다. 두 파일의 직접 후속 응답은200이지만 전체 CI 성공으로 보지 않는다. [현재 적용·검증 범위](../../docs/_ops/qa/platform-note-management-20261009/README.md).

사이트 검사 후속: 메모 기능 이후 남은 정적 파일503 검사 처리는 `a171b5b`에서 보강했다. 10-09 04:06 KST 새 전체 CI가 원격 회귀69개·페이지25×2화면·게임8×2화면·질문창을 문제0·재검사0으로 통과했다. 과거 두 실패는 그대로 보존한다. [최신 사이트 검사 기록](../../docs/_ops/qa/platform-site-check-recovery-20261009/README.md).

## 2026-10-09 저장 중 입력 유지

공개 `d05ab11`에서 상태 갱신 때 입력 폼을 유지하고, 충돌한 계정 기록을 불러오는 동안 입력을 잠그며, 웹 인증 오류 버튼은 재조회하도록 수정했다. 포털293·공통notebook52·동결 native Chromium38 통과, 이전 번들에서는 같은 포커스 검사가 실패했다. Pages·전체 사이트 CI 성공·공개 JS/CSS 바이트 일치. PC `9c276629`에서 실제 계정 PC 저장→웹 읽기·완료→PC 완료 복귀를 확인했다. 후속 `1bcd81c9` 세 앱 설치에서는 ASAR 읽기를 고쳐 설치된 앱의 미설치 표시를 해결했다. 전체300·native59/38/38 통과 후 실제 Platform 창에서 WORLD·Messenger 설치됨 표시, 기존 로그인·완료 메모3개 복원, Messenger 실행→회사 로그인 화면까지 확인했다. [검증과 적용 범위](../../docs/_ops/qa/platform-input-continuity-20261009/README.md). 실제 OS 한글 IME·실물 폰·회사 직원 로그인·Claude 최종 검수는 별도다.

## 2026-10-09 홈·이어쓰기 사용성 보강

공개 `baa4fa5`에서 계정 라이브러리를 다음 할 일·이어서 열기 중심으로 접고, 첫 클릭의 설정 준비 대기·웹 계정관리 버튼·저장 중과 미제출 초안 안내를 보강했다. 접힌 메모 입력과 종료 보호는 유지한다. account335·1280/390/320 화면·공개2파일 SHA·실회원 기존 메모/완료상태 보존을 확인했다. PC는 다른 승인 앱 목록 개선을 보존한 `4738b908` 통합본으로 세 앱 설치·기존프로필 보존·정상 Platform 창 실행까지 완료했다(후보287·목록59·종료38). 전체 사이트 CI의 기존12URL503 실패와 재조회 복구는 구분하며, [이번 사용성 보강 기록](../../docs/_ops/qa/platform-ux-refinement-20261008/README.md)에 근거와 남은 범위를 둔다. 아래는 이전 단계 이력이다.

## 2026-10-08 공개 내 홈 연결

후속 실제 회원 검증에서 사용자 승인 후 제품 OAuth 연결→내 홈→새로고침→제품 로그아웃→비회원 홈→재로그인을 확인했다. 개발 중인 계정 이어쓰기의 저장 전 메모도 창 닫기 보호에 연결했고, 원본 포털280/PC265/native36 검사를 통과했다. 새 동기화 공개·설치 및 실물 두 기기 확인은 별도다. [실회원 검증·초안 보호·출시 조율](../../docs/_ops/qa/platform-continuity-exit-20261008/README.md).

`https://synk.im/account/platform.html#home`과 플랫폼용 `client.html?product=platform`을 공개했다. 기존 platform browser ID·loopback 복귀 주소를 보존하면서 해당 HTTPS 복귀 주소 한 개를 추가했다. 홈페이지와 합친 공개 `05be3a5` 45파일 SHA·Pages/전체 배포 점검·실제 익명 OAuth 시작→중앙 로그인폼→홈 복귀8개를 확인했다. 사용자 승인에 따른 이번 범위의 Claude 검수 예외이며 실제 회원 로그인 완료와 구분한다. [공개·설치·검증 기록](../../docs/_ops/qa/platform-experience-20261008/README.md).

공개물은 `.tmp/platform-public-release-20261008-v2`의 동결 사본으로, 같은 시간 개발 중인 계정 라이브러리 동기화 연결은 분리했다. 공용 원문을 되돌리지 않았고 이번 공개를 모든 최신 소스의 반영으로 해석하지 않는다. 다음 공개는 실제 게시 커밋·등록 상태와 현재 원문을 다시 대조한다.

## 2026-10-08 로그인·계정·기록 연동 검수 · 로컬

9차 보완은 이전 계정의 늦은 재연결 오류가 새 계정의 정상 저장 안내를 덮지 않도록 공통 수첩의 오류 적용 범위를 제한했다. 로그인 중 끝난 기기 저장은 비회원 보관본만 갱신해 로그아웃 복원과 명시적인 계정 옮기기 모두 최신본을 사용한다. 실제 계정 연결기·수첩·동기화 모듈 회귀와 브라우저 A→B 전환·기기 앨범 복원으로 확인했다. 저장 응답 유실 뒤 다른 작성자와 충돌할 때 원문 보존도 별도 검증했다. [9차 결과](../../docs/_ops/qa/platform-account-audit-20261008/ROUND9.md). 이번 작업에서 공개·설치본 반영은 하지 않았다.

8차 보완은 여러 탭의 기기 바로가기·최근 기록 설정을 최신 저장값에 적용하고 저장소 읽기 실패 뒤 덮어쓰기를 막는다. 공통 수첩은 재인증 중 개인 기록을 숨기고 복구 파일 내보내기를 차단하며 앱별 가져오기 창도 현재 편집 가능 상태를 확인한다. [8차 검수 결과](../../docs/_ops/qa/platform-account-audit-20261008/ROUND8.md). 기기 바로가기는 계정 동기화와 별개이며 이번 작업의 공개·설치본 반영은 미실행이다.

6차 보완은 충돌 해결 조회 중 추가한 앨범 원본·문서 입력을 보존하고, 운세 조회·삭제 대기 중 새 입력과 이전 계정의 실패 알림을 분리했다. PC 토큰 갱신 중 늦은 조회가 로그인을 종료하거나 새 권한을 덮지 않도록 했으며 플레저는 미저장 입력과 저장된 값을 비교한다. 신규 회귀 27개 포함 1,104개 검사·6번들·실제 플레저 입력 보호 확인은 [6차 검수 결과](../../docs/_ops/qa/platform-account-audit-20261008/ROUND6.md)에 둔다. 공개·설치본 반영은 미실행이다.

5차 보완은 웹 플랫폼의 설정 실패·미완료 후 복귀·온라인 전환·버튼 재시도, 운세의 계정 연결 재시도와 오래된 인증 알림 차단, PC 로그인 준비 중 취소, 플레저의 즉시 로그아웃과 알림 정리 결과 안내를 추가했다. 이번 수정 관련 948개 검사·6번들 일치 및 실제 플랫폼 화면의 실패→재시도→복구 확인은 [5차 검수 결과](../../docs/_ops/qa/platform-account-audit-20261008/ROUND5.md)에 둔다. 공개·설치본 반영은 미실행이다.

4차 보완은 개인 앱 로그인 콜백의 일시 실패 재시도, 설치형 전체 로그아웃의 즉시 화면 종료와 늦은 인증 응답 차단, 학습 동의 결과 재확인, 다른 기기 종료 시 WORLD 유지, 운세 동일 계정 갱신의 작성 중 메모 보존을 추가했다. 앨범·리허설의 보존된 페이지는 자료를 숨긴 채 같은 계정을 다시 확인하고 초안을 유지해 복원한다. 1,043개 관련 검사와 실제 모듈·합성 계정의 화면 확인, BFCache 실제 적중 미확인 범위는 [4차 검수 결과](../../docs/_ops/qa/platform-account-audit-20261008/ROUND4.md)에 둔다. 공개 반영은 미실행이다.

3차 보완은 같은 계정 재인증 시 미전송 기록·문서 revision을 보존하고, 웹 복귀 시 이름·소속·이용권·기기 상태를 진행 중인 WORLD를 유지하며 갱신한다. 중앙 포털은 로그아웃 즉시 이전 화면·일반 요청을 차단하며 SDK 저장소 삭제와 서버 종료 결과는 따로 확인한다. 중단된 앨범 원본 복원은 빈 문서 편집으로 넘어가지 않고 재시도한다. 관련 952개 검사·6번들·합성 브라우저 확인 및 SDK 저장소 한계는 [3차 검수 결과](../../docs/_ops/qa/platform-account-audit-20261008/ROUND3.md)에 둔다. 공개 반영은 미실행이다.

2차 보완에서 웹/PC의 실제 연결 재시도, 토큰 응답 본문 중단 시 로그인 보존, 웹 로그아웃 즉시 일반 요청 차단, 앨범 삭제/충돌 중 최신 입력 보호를 추가했다. WORLD는 기존 게임을 유지한 채 저장 상태를 확인하고 재전송하며, 불완전한 과거 기록이나 철회된 동의를 저장 완료로 표시하지 않는다. 관련 931개 검사·6번들·합성 브라우저 확인 범위는 [2차 검수 결과](../../docs/_ops/qa/platform-account-audit-20261008/ROUND2.md)에 둔다. 공개 반영은 미실행이다.

웹 플랫폼의 기존 계정 세션을 서버 확인해 이름·계정 관리 입구를 표시한다. 개인 앱의 초기 통신 실패는 로그인 정보를 지우지 않고 다시 확인하며, 인증 철회와 로그아웃 뒤 늦은 응답을 구분한다. 공통 개인 기록 화면은 원본 전송 실패 뒤 다시 불러오기로 미전송 기록이 덮이지 않게 보호하고, 로그아웃의 서버 종료 실패도 안내한다. 혜택의 기기 바로가기와 계정 자료는 분리한다. [수정·검증·남은 범위](../../docs/_ops/qa/platform-account-audit-20261008/README.md). 이 변경은 공개 미반영이다.

## WORLD와 교사 앱의 로컬 연결 · 2026-10-02

`local-world.html`은 기존 WORLD 계정 화면과 일곱 실제 게임 호스트를 재사용하면서 교사 과제함, 서버 채점 읽기, 학생별 Town을 연결한다. [교사 앱의 로컬 연결 서버](../teacher-world/linked-server.mjs)를 실행하면 교사 창은 `http://127.0.0.1:4295/`, WORLD 창은 `http://127.0.0.1:4295/synk-account/local-world.html`에서 따로 연다. 시작 명령은 저장소 루트의 `node experiences/teacher-world/linked-server.mjs`다. 운영 SYNK ID·SYNK-talk 학생 자료와는 별도의 개발 연결이다.

- 교사에게 받은 일회용 코드와 명시적 동의로 들어온다. 현재 연결의 토큰은 탭의 sessionStorage에 보관하며 URL이나 게임 iframe으로 전달하지 않는다.
- 실제 읽기 응답과 게임의 언어 문항 기록이 교사 화면의 근거로 전달된다. 서버 채점 읽기와 게임이 보고한 결과를 구분하고, 게임 조작 점수는 언어 실력으로 바꾸지 않는다.
- 교사가 배정·수정·취소한 읽기·게임 과제는 수동 새로고침 또는 보이는 화면의 5초 주기로 반영한다. 레이싱 듣기/읽기, 리듬, 바람길 듣기 확인, 주문, 입장 검사, 스토리, 빈칸 베기, Town 읽기 확인의 9개 활동을 지원한다. 실제 콘텐츠의 영역·난도·응답 형식·문항군을 Core 후보로 사용한다.
- 게임 과제는 학생별 영역·난도·응답 형식과 실제 문항을 고정하고 해당 목표 문항 응답으로 완료한다. 실제 보유량 안에서 최대3문항이며, 다른 영역·난도나 임의 문항 이름으로 완료할 수 없다. 교사는 배정 전에 목표·새 문항/복습 수를 확인하고 WORLD와 게임도 같은 목표를 사용한다. 정답률 합격이 아니라 수행 완료이며, 혼자 풀기·도움·반복을 구분한다. 시작 때 수행 ID를 받고 사건 발생 즉시 계정/공유판에 귀속해 늦게 전송된 기록이 다른 과제에 붙지 않도록 한다. 중단한 과제는 같은 목표로 이어 쓴다.
- 바람길 확인은 기존MP3 16개, Town 읽기는18문항을 사용한다. 현재 동의 범위의 기록에서 미노출을 먼저 고르고 보유 문항을 소진하면 복습으로 표시한다. 기존 음성의 보기 변경이나 같은 문항 반복을 새 독립 문항으로 세지 않는다.
- 서버 채점 읽기도 공통 Atlas 사건으로 동기화하므로 다음 게임의 추천이 같은 기록을 사용한다. ‘오늘의 학습 안내’에는 현재 공유된 근거와 다음 연습을 표시하며 외부 AI 대화·음성/쓰기 평가로 표시하지 않는다. Town 생활 행동·취향은 언어 점수로 집계하지 않는다.
- 제출 응답을 잃으면 답과 제출 키를 그대로 보관하여 동일 요청으로 확인한다. 과제 revision이 바뀌면 이전 초안을 폐기한다. 연결·공유 revision이 바뀌거나 창을 종료하면 이전 화면과 응답을 차단한다.
- 처음 연결한 뒤 일시적인 계정/교실 읽기 실패가 생겨도 받은 토큰은 보관하고 명시적으로 다시 불러올 수 있다. 서버가 401로 연결 종료를 확인한 경우에는 기기 연결을 지운다.
- 이 개발 환경의 공유 스위치는 동기화와 교사에게 보여주기를 함께 제어한다. 기존 비회원 기록을 가져오지 않는다. 정식 서비스의 로그인·동의 분리·운영 배포는 별도 작업이다.

후속 목표 연결의 통합 자동 회귀619/619, 서로 다른 학습 이력4유형의 실제 화면62/62, 빈칸 베기의 실제 목표 수행25/25, 기존 연결/철회/모바일 화면31/31을 확인했다. 게임별 완주·문항 확대의 최신 명령·검증 범위·증거는 [교사 앱](../teacher-world/README.md)에 기록한다. 이 교사 연결판의 운영 계정·학습 서비스 연결과 실기기 검증은 별도다.

## 설치형 플랫폼과 웹 개발 화면 · 2026-10-02 후속

사용자가 확정한 개발 대상은 **Android·iOS·Windows·macOS·웹**이다. 플랫폼 런처, WORLD, 사내 메신저는 별도 설치·실행·업데이트·앱 데이터·세션을 가진다. 설치형 구현과 빌드 범위는 [desktop/README.md](../../desktop/README.md)를 따른다. 여기의 `platform.html`은 런처 화면의 웹 개발 미리보기이며 앱 두 개를 iframe으로 합치는 제품이 아니다. WORLD 안의 미니게임 호스트는 기존 계정 계약을 유지한다. 플랫폼·WORLD의 web manifest와 iOS 홈 화면 아이콘을 연결했으며, 모바일 웹 화면 검증과 실제 네이티브 패키지·스토어 배포는 구분한다. 서비스 워커나 인증·회사 데이터의 오프라인 캐시는 만들지 않는다.

- 시작: `http://127.0.0.1:4280/` → `platform.html`. 기존 미니게임 허브는 `/learning-hub/`에서 계속 사용한다.
- 둘러보기: 정확히 WORLD와 사내 메신저 두 앱, 제목·콘텐츠 검색, 학습/업무 분류, 이름·최근 순 정렬.
- 라이브러리: 담기/빼기, 즐겨찾기, 배움·업무 컬렉션, 간결한 카드 보기. 담기는 설치·구매·회사 직원 권한 부여가 아니다.
- 앱 상세: 소개·설치 안내·개발 소식, 각 앱의 제공 범위와 웹 체험 경로. Town 등 데스크톱 미제공 기능은 준비 상태를 표시한다.
- 다운로드: Windows / Mac Apple Silicon / Mac Intel 선택, 실행 환경이 확인한 설치 상태, 별도 클라이언트 실행. 공개 배포 파일·서명·업데이트 채널이 없어 가짜 다운로드 진행률/설치 완료를 만들지 않는다.
- 기기 설정: 최근 열기 보관 선택, 목록 초기화·JSON 내보내기. `synk.platform.device-library.v1` 키 하나에 저장하고 계정·학습·회사 자료는 건드리지 않는다. **공통 계정에 동기화되는 라이브러리가 아니다.** 최근 목록은 앱 실행 요청/웹 링크 열기 이력이며 게임 플레이 시간·성취로 해석하지 않는다.
- 데스크톱 연결: 고정된 `getEnvironment / getClients / launch`와 `authStatus / authSignIn / authSignOut / accountRequest` 등의 bridge만 사용한다. 외부 기본 브라우저의 PKCE 로그인과 토큰 갱신·OS 암호화 저장은 main 프로세스가 맡으며 렌더러에 자격을 주지 않는다. 공개 설정이 없는 설치 파일은 연결 준비 상태로 남는다.
- `messengerUrl`은 회사 웹 미리보기의 공개 주소다. HTTPS 또는 loopback 개발 HTTP만, query는 `tab=home|messenger`만 허용한다. 미설정 시 **loopback 개발 페이지에서만** 기존 `http://127.0.0.1:4191/?tab=messenger`를 사용하고 공개 호스트에서는 숨긴다. 기존 회사 초대·로그인이 진입 권한을 판단하며 SYNK ID SSO와 자동 연결되지 않는다.
- 브랜드: 승인 `SYNK-Ink-정밀.svg`, SUIT·Inter Tight·DM Mono 실파일, 기존 펠트 책·노트북·배지·칩·판·질감. 사진형 로고/마스코트는 임의 재생성하지 않는다.

참고한 기능 구조: [Steam 라이브러리](https://store.steampowered.com/libraryupdate), [PURPLE 설치/실행](https://purple.plaync.com/download?country=KR&installerCode=gpg), [Epic 런처](https://store.epicgames.com/download). 시각 탐색은 [Awwwards Zentry](https://www.awwwards.com/sites/zentry)의 제품별 큰 시각 요소와 정보 위계를 참고했으며 외부 이미지·로고·코드는 복사하지 않았다.

## 회원 혜택 · 2026-10-06

`platform.html#benefits`에 **SYNK FOR YOU / 소중한 순간을, 더 잘.** 공간을 추가했다. 둘러보기 첫 화면과 상단 메뉴에서 들어가며 검색에도 회원 혜택이 함께 표시된다. 기존 WORLD·사내 메신저 라이브러리의 담기·설치·권한과는 별도의 서비스 소개다.

- 플레저: 소개와 세 단계 이용 흐름. HTTP loopback 개발 화면에서만 `http://127.0.0.1:4296/` 개발 미리보기를 연결한다. 공개 호스트에는 로컬 실행 링크를 노출하지 않는다.
- 무료 운세: 플레저 바로 다음에 배치하며 `http://127.0.0.1:4299/`의 별도 로컬 개발판으로 연결한다. 별자리 12궁 / 양력 생년월일·시간(모름 가능)으로 계산하는 한국 사주, 이번 주 풀이와 작은 행동·안내를 제공한다. 비회원 입력은 메모리에만 두고, 로그인 뒤 저장 단추로 출생정보·선호 방식·결과·실천 메모를 계정 보관함에 보관한다. 운세 전용 OAuth·상태 API를 사용하며 플랫폼 토큰을 복사하지 않는다. 유료 AI 호출은 없다. 2026-10-06 운영·리허설 DB·함수 v1·전용 OAuth·공개 동의 포털·로컬 설정 연결을 마쳤고, 리허설 합성 계정의 실제 OAuth 저장 왕복 11항목과 브라우저의 운영 로그인 화면 도달을 확인했다. 실제 회원 로그인·운영 회원 데이터 왕복·두 실물 기기·일반 공개 운세 웹 호스팅은 미확인이다. [현재 결과와 앱 범위](../daily-fortune/README.md).
- 중요한 대화 리허설: `http://127.0.0.1:4297/`의 별도 로컬 개발판으로 연결한다. 준비된 면접·부탁·거절 시나리오에서 직접 답하고, 선택한 어려움에 맞게 다음 장면을 연습한다. 완료한 기록의 처음 쓴 말·다시 쓴 말·내가 고른 느낌·실제로 쓸 첫 문장을 **내 성장 작품집**으로 모아 오프라인 HTML과 인쇄/PDF로 가져간다. [앱 범위와 실행](../conversation-rehearsal/README.md).
- 가족 이야기 앨범: `http://127.0.0.1:4298/`의 별도 로컬 개발판으로 연결한다. 사진·본문·원래 음성과 출처가 있는 가족의 기억, **우리 집 손맛**의 재료·순서·직접 만들어 본 기록을 남긴다. 모든 페이지를 인쇄 가능한 책으로 펼치고, 오프라인 이야기책·사진/음성 원본·복원 JSON을 **소장용 ZIP**으로 가져간다. [앱 범위와 실행](../family-album/README.md).
- 소개 원문은 설치형과 같은 `desktop/renderer/benefits.mjs`를 사용한다. 웹 렌더링은 `src/member-benefits.mjs`, 화면 마감은 `benefits.css`다. 빌드 도구가 지정한 펠트 자산 6개만 `assets/member/`로 복사하며 개발 서버도 같은 파일을 명시적으로 허용한다.

회원 무료 제공 방향의 로컬 플랫폼 반영이다. 세 앱의 자료는 기본적으로 이번 사용 중에만 남고 기기 저장은 직접 선택한다. 운영 회원 계정 동기화·종료 후 알림·공개 출시는 후속이다. [첫 소개 화면 검증](qa/member-benefits-20261005.md), [두 앱 초기 개발 검증](qa/member-mvp-20261005/RESULTS.md).

소장 기능은 로그인이나 SYNK 서버 없이 다시 열 수 있는 사용자의 결과물을 제공한다. 인쇄/PDF는 기기의 인쇄 창을 사용하며 실물 제작·배송 주문은 포함하지 않는다. 종이·PDF에서는 원음이 재생되지 않으므로 가족 앨범의 음성 파일도 함께 보관한다. 2026-10-06 추가 구현의 자동 검사·브라우저·다운로드·인쇄 확인 범위는 [소장 경험 검증 결과](qa/takehome-20261006/RESULTS.md)를 참조한다.

## 화면

- `platform.html`: 설치형 런처를 위한 웹 개발 화면. 계정 설정과 별도로 사용할 수 있다.
- `index.html`: 중앙 계정. 이메일 인증은 공식 `@supabase/supabase-js` 2.117.2를 사용한다. `authorization_id`가 있으면 같은 SDK의 `auth.oauth.getAuthorizationDetails / approveAuthorization / denyAuthorization`로 동의를 처리한다.
- `client.html?product=platform`: 공개 클라이언트의 authorization code + PKCE S256. 계정·소속·이용 권한을 보여 준다.
- `client.html?product=world`: 같은 인증 방식과 SYNK ID. 학습 동의를 확인한 뒤 같은 출처의 여섯 콘텐츠를 iframe으로 연다. 부모 `SYNKLearningHost`만 계정 저장소·전송기를 가진다. URL로 토큰을 넘기지 않는다.
- `preview.html`: **별도 빌드한 합성 화면**. 이메일/비밀번호를 입력해도 네트워크 인증을 하지 않는다. `?account=world`는 WORLD 계정 예시, `?authorization_id=synthetic`은 동의 예시다. 실제 사용자 정보나 로그인 성공의 증거로 쓰면 안 된다.

계정 화면에는 학습 연결 동의, 소속/권한, 연결된 로그인 종료, 연결된 연습 기록 내보내기, 삭제 요청을 둔다. 내보내기는 서버의 고정 `until`과 커서를 따르며 기존 과제·AI 기록 전체를 포함한다고 표시하지 않는다. 삭제 요청 접수와 실제 삭제 완료를 구분한다. 비회원 학습을 계정에 자동 귀속하지 않는다.

## 공개 설정

`config.example.json`을 운영자가 `config.json`으로 복사한 뒤 공개 값만 넣는다. 이 빌드는 `.env`, 기기 로그인 정보, 서버 비밀 키를 읽지 않는다. `config.json`은 저장소에서 제외한다.

| 키 | 내용 |
|---|---|
| `supabaseUrl` | Supabase 공개 프로젝트 URL |
| `supabasePublishableKey` | 브라우저용 publishable 또는 legacy anon 키. secret/service_role 금지 |
| `accountApiUrl` | SYNK Edge 함수가 있는 URL. 생략하면 Supabase URL |
| `portalUrl` | 중앙 `index.html`의 정확한 HTTPS 주소 |
| `clients.platform / clients.world / clients.messenger` | 각 브라우저 public OAuth client의 `clientId`, 정확한 `redirectUri`. 메신저의 callback은 회사 서버의 `/api/synk-id/callback` |
| `authorizationClients` | 같은 제품의 추가 실행 환경. `{product,clientId,redirectUris}` 목록. Native 예시는 `synktalk://oauth/callback`이며 실제 앱 빌드에서 별도 확인 필요 |
| `messengerUrl` | 회사 웹 개발 미리보기 입구. 토큰·권한 전달 경로가 아니다 |
| `learningUrl` | 준비 전에도 열 수 있는 기본 학습 입구 |

세 클라이언트와 실행 환경마다 등록된 client ID와 redirect URI를 채운다. 브라우저 예시의 callback은 해당 출처의 `client.html?product=platform` 또는 `client.html?product=world`다. 제품·origin·path·등록 query·state·10분 만료를 확인하고, 일회용 PKCE verifier는 같은 탭의 sessionStorage에만 둔다. 브라우저 제품 토큰도 제품별 sessionStorage에 두며 중앙 SDK 세션과 합치지 않는다. HTTPS가 기본이며 loopback HTTP만 개발용으로 허용한다.

중앙 Edge 함수의 `SYNK_OAUTH_CLIENT_PRODUCTS`에도 각 OAuth client ID와 제품을 등록한다. 인증 제공자가 확인한 토큰의 client ID로 제품을 결정하므로 브라우저의 헤더 변경만으로 다른 제품이 될 수 없다. 메신저에는 활성 계정의 ID·표시 이름·현재 세션만 반환하고 학습·학원 소속·이용권은 반환하지 않는다. 직원 연결은 [회사 서버 계약](../../docs/마케팅/온라인마케팅지도/engagement/company/SYNK_ID.md)을 따르며 이메일 일치로 자동 연결하지 않는다.

Supabase에서 OAuth 2.1 서버(beta)를 활성화하고 Authorization Path를 중앙 동의 화면으로 지정해야 한다. 이 설정 변경은 이 구현에 포함하지 않았다. 이메일 확인/복구 허용 도착 주소도 중앙 `portalUrl`에 맞춰 등록한다. 제품 서버의 release-policy가 기능을 열어야 학습 동기화 등도 운영할 수 있다. 서버의 거절은 사용자에게 표시한다.

WORLD는 계정 API에서 검증한 `synk_user_id`와 학습 동의 revision마다 `synk.account.{id}.r{revision}.` 저장소를 분리한다. 계정 전환·로그아웃·동의 철회에서는 기존 host를 중단한다. 동기화가 꺼진 경우 `local:{synk_user_id}` 전용 저장소와 `connected:false` host로 기기 안에서 연습한다. 이때도 예전 비회원 기록을 읽지 않는다. `capabilities.learningSync`가 꺼져 있거나 계정이 `deletion-requested`이면 새 학습 연결을 켤 수 없고, 기존 동의를 끄는 것은 허용한다.

현재 제품 로그아웃은 서버 세션 종료를 요청하고 기기 자격을 지운다. 서버 장애가 기기 로그아웃을 막지 않으며, 저장 제거 실패와 서버의 종료 미확인은 각각 안내한다. 현재 session을 특정하지 못하거나 `refreshRevoked`를 확인하지 못하면 서버 종료 완료로 표시하지 않는다. 모든 제품 종료 결과에서는 `legacyAccessGuard`도 확인한다. 삭제 요청에는 화면 내 재시도에서도 같은 UUID를 쓰고, 요청이 접수되면 계정 상태를 다시 읽어 표시한다.

## 빌드와 확인

```powershell
cd experiences/synk-account
npm ci --ignore-scripts
npm test
cd ../..
node tools/build-synk-account.js
node tools/build-synk-account.js --check
```

기본 source root는 이 저장소, talk root는 형제 `../SYNK-talk`다. 별도 worktree에서 원본 최신 사본을 읽을 때:

```powershell
node tools/build-synk-account.js --source-root C:/Users/q1212/Documents/SYNK-appsscript --talk-root C:/Users/q1212/Documents/SYNK-talk
```

도구는 최신 `SYNK-talk/lib/synk-account-client.js`와 `account/world-learning-host.js`를 `src/generated`로 복사한다. `dist/app.js`, `dist/client.js`, `dist/preview.js`, `dist/platform.js`, `dist/local-world.js`, 승인 자산, `preview.html`, SHA-256 `build-manifest.json`을 만든다. `--check`는 원문과 생성물의 바이트 일치를 확인한다. 상위 학습 서버에서 `/synk-account/` 경로를 열어 확인한다. 단독 정적 배포 시 이 폴더의 HTML/CSS/dist/assets와 공개 config가 필요하며, WORLD 게임 경로·학습 허브도 같은 출처에서 제공해야 한다.

선택적 신규 브라우저 context 검증은 `node tests/browser-smoke.mjs <playwright-module-directory>`로 실행한다. 테스트는 로컬 파일을 가상 loopback 경로로 제공하며 원격 인증을 호출하지 않는다. 캡처는 `qa/`에 남긴다. 실제 로그인/메일/운영 데이터 검증을 대체하지 않는다.

## 공식 근거

- [Supabase OAuth 서버 시작](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
- [OAuth 인가 흐름과 공개 클라이언트 PKCE](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)
- [비밀번호 재설정](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)

## 로컬 확인 기록

2026-10-02: PKCE/state/만료/일회 소비, 공개 설정 제한, 브라우저·Native redirect allowlist, 계정/revision 격리, token POST 계약의 core 회귀 7개 통과. 실제 계정 설정은 만들지 않았고 비밀 키를 불러오지 않았다. 상세 화면 검증 결과는 `qa/RESULT.md`에 둔다.
