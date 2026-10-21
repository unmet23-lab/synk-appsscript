# Google 로그인 운영 연결 · 2026-10-09

사용자 「휴대폰 제외하고 전부 진행해」에 따라 Google 로그인 키 설정·최종 검수·운영 반영·실제 로그인 확인까지 진행한다. 휴대폰 번호 수집·문자 서비스·인증 보강은 제외하며, 미인증 가입을 서버에서 명시적으로 연기하는 Google-only 계약을 사용한다.

Google 로그인 콘솔의 관리 계정은 사용자가 주로 쓰는 **unmet23**이다. 실제 프로필을 확인하고 전용 `synk-id-unmet23` 프로젝트의 Web OAuth client를 발급했다. 기존 Cloud 기본 결제 계정 unmet27은 별개이며 결제·권한·소유자를 변경하지 않았다.

## 진행 상태

- [운영 Auth 확인과 최소 설정 통로](ops/README.md): Google Web OAuth client를 실제 발급해 제공자와 manual linking을 활성화했다. Google 외 Auth·허용 주소·모든 Edge secret 지문 보존을 확인했다. 원문 Secret은 Git·QA에 복사하지 않는다.
- [FE 후보](frontend/candidate/manifest.json): 공개 main `2eb8cb98`의 번들을 원래61개 입력으로 정확히 재현한 뒤 Google 관련 소스3개만 바꾼다. 미공개의 다른 플랫폼·WORLD 작업은 배포 입력에 섞지 않는다. 공개 개인정보 안내는 Google 가입 항목을 해당 구획에만 추가한다. 구체적인 결과와 최종 파일은 FE 담당 기록을 따른다.
- BE 후보는 각 운영 함수의 실제 동봉 모듈·생성 runtime과 일치하는 기준을 확보하고 Google 공통 계약만 적용했다. 기존 운영 함수10개·source62개·동봉63파일이며, 운영에 없는 Classroom/WORLD 함수와 마이그레이션은 추가하지 않는다. 관련 회귀215/215·정확한 배포 모듈의 import/가입 우회 차단2/2가 통과했다. 동결 후보는 `C:/Users/q1212/.codex/tmp/google-backend-release-20261009-180a10da/release-manifest.json`이며 SHA256 `b2389e189275411ac165dbefda8468c982b9ffe48bbb1e6957aa4ec7ddbbda36`다.
- FE 동결 후보 관련 시험143/143·브라우저9시나리오·정확한 번들과 실제 SDK의 합성 PKCE 가입·개인정보 화면3크기 검증이 통과했다. 실제 Google 제공자 로그인이나 실물 휴대폰 결과는 아니다.
- 공식 Claude Code **Opus5.5·max**의 전체 최종 검수가 완료됐다. 실제 모델·success/is_error/terminal_reason과 명령의 max를 대조했다. P0/P1 없음, FE P2 두 건·P3 한 건을 보완한 [v2 후보](frontend/v2/README.md)의 추가 검수는 사용량 제한(`is_error:true`, `terminal_reason:api_error`)으로 미완료다. 사용자에게서 [이번 v2/helper만 검수 생략 예외](user-delta-review-exception.md)를 받아 공개했다. 검수 미완료를 통과로 바꾸지 않으며 이전 후보/검수 기록은 보존한다.
- 서버10함수는 기존 배포 CLI로 반영했다. [반영 명령](backend/deployment.json), [운영 대조](backend/postdeploy-followup.md), [유예 설정 후 대조](backend/post-policy-verification.json):63/63 SHA·ACTIVE/JWT·version·인증 거부20개 통과. 최초 검증 도구의 한글 URI 이름과 product header 누락은 도구만 보완했고 실패 기록을 보존했다.
- 휴대폰 유예 secret은 POST1회 후 응답 JSON 파싱 문제로 처음에 적용 여부가 불명확했다. 재시도하지 않고 GET2회로 [실제 유예 적용·다른 Auth/허용주소/secret 보존](ops/deferred-policy-readonly-recovery.json)을 확인했다. 미사용 write 응답을 파싱하지 않는 최소 helper 수정과22/22회귀를 보존했다. 문자 발송0, 전화번호 단독 제공자는 비활성이다.
- 공개 웹은 `bb9a00b923a03363bb8bd8fe6f4e344826dee305`의 4파일을 반영했고 exact 바이트와 Pages·사이트 CI 2건 성공을 확인했다. Google 활성화 PATCH1회 후 helper는 불투명한 관리 API Secret 반환값을 원문과 비교해 실패를 보고했지만, 다른 설정 보존과 공개 Google 활성 상태는 GET으로 확인했다. 재시도하지 않고 실제 Google 링크·재로그인으로 Secret의 실효성을 확인했다. [공개·Google 진행 근거](public-and-google-progress.json), [읽기 전용 진단](ops/google-enabled-readonly-diagnosis.json)
- 실제 Google 동의·기존 회원 연결·Google 재로그인에서 같은 SYNK ID와 학습 기록 선택 유지가 확인됐다. 공개 Care의 연결 단추에서 중앙 Google 세션을 재사용해 별도 자격증명이나 Google 동의 없이 자동 승인·복귀했다. [Google 연결](ops/google-real-link.json), [재로그인](ops/google-real-relogin.json), [Care SSO](ops/google-care-sso.json)

최종 공개판은 **`108b939ff1cbd7631875ad1d5b2bcc7613f930dc`**다. [v3](frontend/v3/README.md)의 중앙 서버 종료→SDK 저장 정리 순서와 홈페이지 Google 소유권 메타태그 한 줄을 [사용자 직접 예외 승인](user-logout-and-ownership-exception.md)으로 반영했다. 기존145/145·새 경계9/9·실제 SDK 합성2시나리오, Git23/23·공개HTTP26/26 SHA/MIME/200 일치, Pages 게시와 전체 사이트 CI 성공을 확인했다. [마지막 공개 대조](frontend/v3/public-readonly-1791543990596.json), [최종 상태](FINAL.json).

실제 공개 v3에서 [현재 제품 로그아웃](ops/google-real-logout-v3.json)이 서버 종료 미확인 경고 없이 끝났고, [Google 재로그인](ops/google-final-relogin-v3.json)도 같은 SYNK ID·학습 선택으로 복원됐다. canonical portal1개와 관련 시험2개만 좁게 반영했고69/69가 통과했다. backend·공용 dist 전체·다른 작업을 덮어쓰지 않았다.

Google Audience는 **프로덕션 단계**다. 브랜드 이름은 홈페이지와 같은 SYNK로 맞췄고, 홈페이지·개인정보·약관 URL과 `synk.im`을 저장했다. Google 브랜드 최초 검증은 도메인 소유권·이름 불일치를 보고했다. 이름을 수정하고 [unmet23의 홈페이지 소유권 확인](ops/site-ownership-verified.json)을 완료했다. Google은 소유권 확인 후 재검증 전24시간 반영 대기를 안내했으며 브랜드 표시 인증은 아직 완료하지 않았다. 그동안 Google 로그인·가입은 사용할 수 있다. [콘솔 반영 범위](ops/google-console-actions.md)

실제 신규 Google 회원의 추가정보 제출과 네이티브 런처 직접 사용은 미확인이다. 이전 [Google-only 로컬 구현](../google-only-20261009/README.md)의 합성 가입 시험을 실제 신규 가입 완료로 확대하지 않는다. 휴대폰·SMS는 이번 범위에서 제외했다.
