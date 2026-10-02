# SYNK 내 작업실 · AI 업무 연습 공유 모듈

가상 업무를 근거로 AI 요청문을 쓰고, 미리 준비된 AI 결과의 오류·누락을 확인한 뒤 사람이 직접 수정하는 실습 모듈이다. 2026-10-02 사용자 승인으로 **회사 메신저 → 내 작업실 → AI 업무 연습**에 통합했다. `model.mjs`를 회사 화면과 기존 시험 화면에서 함께 사용한다. 실제 AI 생성, 기업 자료 업로드, API 키, 결제, 외부 전송은 없다.

## 회사 작업실에서 사용

회사의 기존 로그인으로 `http://127.0.0.1:4191/?tab=workroom&section=practice`를 연다. 회사 클라이언트는 `docs/마케팅/온라인마케팅지도/engagement/company/public/workroom-practice.js`와 `.css`를 사용한다. iframe이나 별도 SHIFT 클라이언트를 열지 않는다. 제작 데스크·게시 전 점검으로 바로 이어갈 수 있으며, 실습이 회사 공유 자료를 자동으로 작성하거나 권한을 바꾸지 않는다.

- 기존 `/api/me`에서 확인한 `state.user.id`를 scope의 personId로 사용한다. productId는 `company`, contextId는 `workroom-practice`, domain은 `SHIFT`다. 기존 Core를 재사용하며 새로운 엔진은 없다.
- localStorage 키는 `synk-workroom:ai-practice:v1:{companyUserId}`다. 저장은 기본 꺼짐이며 첫 실습 시작 뒤 명시적으로 선택한 경우에만 저장한다. 기존 익명 `synk.shift.workbench.v1` 기록은 가져오지 않는다.
- 로그아웃·계정 전환은 메모리를 비우고, 명시적으로 저장한 계정별 자료는 유지한다. 복원 시 현재 계정의 전체 scope를 확인한다. 계정 간 기록을 합치거나 서버·다른 기기로 동기화하지 않는다.
- 비동기 화면 갱신 시 초안·선택·커서 위치를 보존하고 한글 조합 중 화면 교체를 보류한다. 저장 접근 거부·용량 부족·손상 기록은 화면에 표시하고 메모리 실습을 계속할 수 있다.
- 공유 모델의 `startRun`·`completeRun`·`giveFeedback`은 마지막 `scope` 인자를, `restore`는 세 번째 `scope` 인자를 받는다. 생략 시 기존 시험 화면 scope를 유지한다. `persist`의 세 번째 인자는 호스트가 결정한 저장 키다.

관련 검증: `node --test experiences/shift-workbench/model.test.mjs docs/마케팅/온라인마케팅지도/engagement/company/workroom-practice-client.test.mjs docs/마케팅/온라인마케팅지도/engagement/company/workroom-client.test.mjs` **51/51 통과**. 실제로 놓친 유형이 있는 다음 업무 제안과, 직접 고른 업무에 없는 유형을 연습한다고 표시하지 않는 회귀를 포함한다. 회사 통합 화면의 브라우저 검사는 회사 QA 기록을 따른다.

## 기존 독립 시험 화면 실행

```powershell
node experiences/shift-workbench/server.mjs --port 4293
node --test experiences/shift-workbench/model.test.mjs experiences/shift-workbench/server.test.mjs
& 'desktop/node_modules/electron/dist/electron.exe' 'experiences/shift-workbench/qa-ui.cjs'
```

주소: `http://127.0.0.1:4293/`. 서버는 127.0.0.1만 바인딩하고 Host·Origin을 검사한다. HTML/CSS/모듈·승인 자산·기존 Core 두 파일만 허용한다. `createServer()`는 테스트에서 포트 0에 바인딩할 수 있는 Node HTTP 서버를 반환한다. 실제 로그인을 모사하지 않는다.

## 구현 범위

- 회의 정리·자료 검토·기획 3종 가상 업무. 실제 고른 목적·5/10/15분·도움 선택만 `atlas/personalization.js`에 전달하여 기존 Core가 2개 확인/3개 확인/후속 적용 포함 중 분량을 추천한다. 도움 선택으로 경험을 추정하거나 미선택 음성 조건을 선언하지 않는다. 시간 여유만으로 심화를 강제하지 않으며, ‘더 해보기’ 피드백과 15분 조건이 함께 있으면 심화가 가능하다.
- 초보 도움에서는 요청문 구조·가져오기 예시를 제공하며 독립 수행에서는 숨긴다. 요청문 단어 점검은 의미를 채점하는 AI가 아님을 명시한다.
- 검토 판단과 근거 자료 번호가 모두 맞아야 확인 항목을 맞힌 것으로 기록한다. 첫 판단 뒤 정답·근거를 알려 주고 원래 판단은 유지한다.
- 학습자가 결과를 직접 바꾸고 검토 확인을 해야 완료한다. 자유 문장 정확성은 자동 채점하지 않으며 정해진 확인 항목 결과와 구분한다.
- 이전 실습에서 놓친 유형을 다음 실습의 앞쪽에 제시한다. 완료·명시적 피드백은 기존 Core 이벤트로 기록한다. 원시 답을 능력·성향으로 추론하거나 다른 도메인과 합치지 않는다.
- 선택 조건의 실습 내 사용은 ‘이 조건으로 실습 시작’으로 동의받는다. 별도 체크를 고른 경우에만 선택 조건·요청문·답·직접 수정한 결과·최근 20회 기록을 이 기기 localStorage에 저장한다. 계정 동기화가 없으므로 공용 기기에서는 저장하지 않도록 안내한다. 저장 실패·복원 실패·초기화 실패를 표시한다.
- 수정 결과와 검토 근거를 `synk-shift-practice.txt`로 내려받는다. MIME `text/plain;charset=utf-8`, 최대 64 KiB. 파일 생성은 사용자 클릭 시 브라우저에서만 실행한다.

## 디자인과 자산

`DESIGN.md`, 디자인 토큰 청금석 `#24448C`/`#3D6BC9`, 펠트 스크랩북·실제 펠트 부품을 재사용했다. 자산 원본 위치와 SHA-256은 `assets/sources.json`에 있다. 폰트는 실제 SUIT 가변·Inter Tight Medium/Bold·DM Mono 파일을 제공한다. 본문은 흰 종이, 실제 펠트 판은 선택 타일·버튼·강조 면에 사용한다. 모바일·키보드·감소 모션 CSS를 포함한다.

## 완료와 미검증 경계

2026-10-02 모델·서버 자동시험 **16/16**, 실제 Chromium UI 검사 **16/16**을 통과했다. 자동시험은 실제 추천 분량, 출처 대조, 완료 전제, 후속 검토 순서, Core 완료/피드백, opt-in 저장, 손상 자료 복원, 입력 escaping, 서버 허용 경계를 검사한다.

UI 검사 `qa-ui.cjs`는 별도 임시 Electron 프로필로 실행한다. 320·390·1280 크기 설정의 가로 넘침, 실제 브랜드 폰트 로드, 첫 추천 근거 문구, 폼 입력→검토→수정→완료, 저장·새로고침 복원, 저장 HTML의 비실행, 초기화, 미동의 비저장, localStorage getter 자체가 SecurityError를 던지는 환경에서 저장 없이 완료 가능함과 저장 실패 안내를 확인했다. Windows 배율 반올림으로 실제 `innerWidth`는 요청값보다 1px 컸으며 가로 넘침은 실제 clientWidth와 비교했다. [검사 기록](qa/20261002/report.json), [결과 화면](qa/20261002/result-clean.png), [모바일 시작 화면](qa/20261002/setup-320.png). XSS용 문자열이 포함된 `result-xss-test.png`와 `result-320.png`는 검사 증거다. 대표 결과 화면은 정상 가상 자료로 새 실습을 완료해 캡처했다.

위 독립 시험 화면은 실제 AI 공급자 연결, 회사/직원 신원, SSO를 제공하지 않는다. 회사 작업실의 통합판은 기존 회사 세션과 화면 권한을 사용한다. 서버 실습 보관·기기 간 동기화·관리자 리포트·생산성 및 학습 효과 측정은 미구현이다. 정식 로그인·공개 업데이트·클라이언트 패키지 서명·설치 검증은 사용자가 MVP 이후로 유예한 범위를 유지한다.
