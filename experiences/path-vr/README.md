# SYNK PATH · 첫날의 연습

한국 유학·학교생활·진로 탐색의 첫 행동을 가상 캠퍼스에서 연습하는 **로컬 MVP**다. 실제 학교·기업 소개, 입학·채용 보장, 한국어 능력 평가 서비스가 아니다.

## 지금 할 수 있는 일

- Three.js 3D 캠퍼스의 안내 데스크·수업 준비실·진로 상담실로 이동하고 드래그·방향키로 둘러본다.
- 각 장소의 두 상황에서 질문·다음 행동을 선택한다. 선택 뒤에도 고른 답이 남고, 도움을 봤는지와 다음에 연습할 구체적인 행동을 확인한다.
- 목적(유학·학교생활 / 취업·진로 / 첫 방문), 시간(3·6·12분), 도움 방식을 직접 적용하면 **기존 Atlas Core의 `personalization.js`**가 먼저 갈 장소를 고른다. 예: 6분 학교생활 → 수업 준비실, 6분 취업·진로 → 진로 상담실, 3분 → 안내 데스크. 기본값은 본인의 응답으로 취급하지 않으며 최초 화면은 기본 체험 동선으로 표시한다.
- 저장에 동의한 경우에만 이 브라우저의 `synk.path.rehearsal.v1`에 설정·확인 여부·장소·선택 기록을 남긴다. 새로 열면 마지막 장소와 진행을 이어 가고, 저장 해제·초기화로 삭제한다. 저장 불가·오염된 기록은 화면에 알린다.
- 모바일/PC 화면에서 전 상황을 완료할 수 있다. WebGL 실패 시에도 장소 선택과 텍스트 연습은 유지된다.
- 지원되는 브라우저와 연결된 VR 기기에서는 실제 `isSessionSupported('immersive-vr')` → 사용자 클릭 → `requestSession` → Three `setSession`을 수행한다. VR 안에 질문·선택·도움·장소 이동·종료 판이 나타나고 두 컨트롤러의 광선 선택을 받는다. 종료·권한 거절·재입장·지연 응답 정리를 구현했다.
- SYNK 네이티브 클라이언트는 PC 3D 미리보기로 표시한다. 사용자가 누르면 `synkProduct.openInBrowser()`를 통해 이 PC의 VR 지원 브라우저로 연다.

Atlas를 새로 만든 것이 아니다. 여기서는 기존 Core 선택/표시 계약을 재사용한다. 직접 고르지 않은 오디오·움직임 설정이나 학습 능력·고정 성향을 선언하지 않는다. 선택 기록은 이 MVP의 관찰 사실이며 Trail 학습 평가, WORLD 기록, 교사 과제나 계정 간 연동은 구현하지 않았다.

## 실행

저장소 루트에서:

```powershell
node experiences/path-vr/server.mjs --port 4292
```

`http://127.0.0.1:4292/`에서 연다. 서버는 127.0.0.1에만 바인딩하며 명시적인 정적 파일 목록과 `/api/health`만 제공한다. POST, 외부 Host, 원문 문서·시험·QA·개인 기록 경로는 제공하지 않는다. 외부 CDN·API·오디오·분석 전송은 없다. `createServer({port:0})` 후 `await server.start()`를 사용하면 격리 시험이 가능하다.

## VR과 운영 범위

- **헤드셋 실기기 시험은 하지 않았다.** PC Chrome의 실제 렌더링/비지원 동작과 모의 XR 세션 수명만 검증했다. 기기별 화면 가독성·컨트롤러·편안함·프레임율은 후속 검증 대상이다.
- 이 서버는 로컬 PC 전용이다. 독립형 헤드셋에서 이 PC의 `127.0.0.1`에 접속할 수 있다는 뜻이 아니다. 독립형 기기에는 별도 HTTPS 제공 경로와 기기 시험이 필요하다.
- 컨트롤러로 선택하는 VR 구현이다. 손 추적·시선 자동 선택·음성 인식은 없다. 공간 이동은 장소 단위 즉시 이동이며 강제 자동 보행·소리는 없다.
- 저장은 **로그인 사용자별 클라우드 저장이 아니다.** 같은 브라우저를 공유하면 로컬 기록도 공유된다. 정식 SSO·학생 식별·클라우드 기록·Windows/macOS 설치 패키지·모바일 앱 배포는 후속 범위다.
- 같은 상황의 반복 성공을 실력 향상으로 계산하지 않는다. 최근 선택, 도움 여부, 반복 수와 미수행 항목만 표시한다. 실제 진로 적합성·한국어 등급·입학 및 취업 가능성은 판단하지 않는다.

## 자산과 재사용 원천

| 로컬 자산 | 원천 |
|---|---|
| `assets/logo-path.webp` | `docs/디자인/SNS키트/assets/logo-path.webp` 승인 PATH 로고 |
| SUIT / Inter Tight / DM Mono | `docs/브랜드_폰트/SUIT/SUIT-Variable.woff2`, `desktop/assets/launcher/InterTight.woff2`, `docs/마케팅/맞춤도구/dist/brief/meeting/assets/DMMono-400.woff2` |
| 실제 펠트 단추·넓은 판 | `docs/디자인/펠트부품/assets/ui/`의 slab 3종·badge-check, `assets/배경/`의 wide-cream·wide-lapis·wide-butter |
| Three.js 번들 및 라이선스 | `experiences/korean-runner/vendor/three.module.js`, `three.core.js`, `THREE-LICENSE.txt` |
| Core / Trail / 개인화 어댑터 | `atlas/engine.js`, `atlas/trail.js`, `atlas/personalization.js`를 변경 없이 `vendor/`에 복사 |

전체 파일 출처와 SHA-256은 `asset-sources.json`에 기록했다. 3D 공간은 이 MVP의 절차형 가상 장면이며 실제 대학 사진이나 영상이 아니다. 폰트·펠트는 파일 그대로 재사용하며 새 유료 생성 자산은 없다.

WebXR 계약 확인: [MDN requestSession](https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession), [Three.js WebXRManager](https://threejs.org/docs/#api/en/renderers/webxr/WebXRManager) (2026-10-02).

## 검증

```powershell
node --test experiences/path-vr/tests/path.test.mjs
node experiences/path-vr/qa-ui.mjs
```

2026-10-02 결과: 모델·저장·Core 추천·XR 수명·서버 **12개 통과**. 실제 Chrome 렌더러 **33항목 통과**, 페이지 오류 0, 외부 요청 0. 1440·1280·720·390·320px 화면, 세 장소 전체 수행, 힌트, 저장·재개·재연습 커서 복원·초기화·오염 복구·저장 차단, WebGL 실패 후 키보드 완료를 확인했다. `qa/verification.json`과 같은 폴더의 화면 캡처에 근거를 남겼다. `qa-ui.mjs`는 이 PC의 기존 Chrome/Playwright를 사용하며 설치·로그인·외부 전송 없이 임시 포트로 실행한다.

