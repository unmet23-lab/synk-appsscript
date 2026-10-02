# SYNK PULSE 비공개 접수함

이 폴더는 고객용 발주서와 자료를 소유자의 Google Drive에 접수하는 **별도 Apps Script 웹앱**의 소스입니다. 저장소 루트의 `Code.js`, `.clasp.json`, 기존 학생·상담용 웹앱과 합치지 않습니다.

**2026-10-01 현재: 질문 간소화 v4를 동일 접수 주소의 버전 6에 반영했습니다. 원격·로컬 5파일 해시 일치와 실제 온라인 6단계·전송 준비 상태, 106개 회귀시험을 확인했습니다.** 목적·성과·일반적 정확성 등 27개 필드와 메모를 제거했고 이름만 기본 필수로 받습니다. 자세한 범위는 [현재 검증 기록](../검증_기록.md)을 따릅니다. 실제 무첨부 접수와 서버 원본 1개 시험은 아래 **버전 5 당시의 연결 검증**이며, 버전 6 반영 후 sync는 downloaded 0/skipped 2/failed 0으로 기존 문서 12개·원본 1개를 재검증했습니다. Drive 접수함은 비공개입니다. 새 미사용 고객 초대를 준비했으며(매시간 확인은 10-02에 접수 메일 방식으로 바꿈) 실제 브라우저 파일 선택·대용량 전송·실제 고객 분석은 아직 미검증입니다. 접수 성공은 자료 보관과 제작 검토 전달서 생성까지를 뜻하며 AI 분석·사실 검증·콘티 확정·유료 생성 완료와 구분합니다.

| 항목 | 현재 확인 상태 |
| --- | --- |
| 전용 프로젝트 | `SYNK PULSE - Private Client Intake` |
| Script ID | `1NiAfHWH94gP1nLIo-q1Bx7W2X3KnhXxWenSuGLqMtxy9HSY9y6fEF4BC` |
| 소유자 계정 | `unmet23@gmail.com` |
| 소스·배포 | 같은 배포 ID의 버전 6 배포 완료. 독립 clone으로 원격·로컬 5파일 SHA-256 모두 일치. Code/OwnerSetup/manifest는 @5와 불변. 비공개 증거: `%LOCALAPPDATA%/SYNK/PULSE-Intake/test-fixtures/connection-20261001-ce964922/V6_SIMPLIFICATION_VERIFICATION.json` |
| 로컬 회귀시험 | 106개 통과. 옛 질문 제거·수정 경로·소유자 설정·온라인 빌드 포함. 실제 서비스 검증 범위와 구분 |
| Google 권한·소유자 초기화 | 03:02:52 KST 기존 권한 상태 초기화 뒤 정상 OAuth의 이메일·Drive 권한 부여 및 Authorization successful 확인. 03:07:08 `applyOwnerSetup` 실행 완료 |
| 온라인 화면 | 버전 6의 기존 미사용 고객 초대에서 간소화한 6단계 정상 표시·온라인 전송 가능 확인. 추가 접수 없이 02 전달할 내용 화면으로 유지 |
| 무첨부 시험 접수 | `p_cf03545a394b4e4fa0011d25c7b2fc4d`, `2026-09-30T18:17:22.944Z`. 실제 Google UI에서 원본 0개로 접수 성공 |
| 원본 시험 접수 | 03:24:17 KST 소유자 전용 서버 시험 `p_816f0105d85645e4b432c9a99ea08201`: 원본 1개(299바이트)와 문서 6개 저장. 원본 SHA-256 `4d021d2eba37434753859612256cfdaaa9eade526245f871a04dc7edfea6f8fa` 확인 |
| 실제 동기화 | 원본 시험 뒤 `downloaded:1, skipped:1, failed:0`. 두 시험의 문서 12개·원본 1개를 독립 `verifyCompleted`로 재검증. 최종 재실행 `downloaded:0, skipped:2, failed:0` |
| Drive 접수함 | `15Kl0w2JiP0q8sP5C1lJPS-zqAfS7pnVg`를 Drive UI에서 비공개·소유자 `unmet23`로 확인 |
| 고객 초대 | 03:22:17 KST 새 미사용 초대 등록. 만료 `2026-10-07T18:19:40.974Z`(10월 8일 03:19 KST). 원시 URL은 비공개 `customer-link.txt`에만 보관 |
| 남은 원본 검증 | Chrome·IAB 파일 선택 도구 모두 시간초과로 실제 브라우저 첨부 동작은 미확인. 서버 원본 전송 시험과 구분하며 대용량 한계도 미검증 |
| 새 접수 알림 | 10-02부터 접수 메일 방식(아래 「로컬 수신과 접수 알림」). 코드·시험은 반영했고, 메일 권한 재승인·새 버전 배포 전이라 라이브는 아직 알리지 않음. 옛 매시간 자동화 `pulse`는 10-01 19:58에 멈춤(당시 `ready:true`, 두 시험 ID 제외, 실제 고객 분석은 미검증) |

## 핵심 오류와 복구 기록

- 사용자는 원격 진행과 Drive·이메일 권한 사용을 이미 허락했습니다. 그러나 Google 권한 상태는 `REQUIRED`였고, 일반 Chrome·IAB에 이어 02:50 KST 실제 Chrome 시크릿 창에서도 `script.google.com/accounts?authuser=1&continueUrl=...` 404가 재현됐습니다. 소유자·기본 GCP 프로젝트 확인과 기존 @3 동일 설정 갱신으로는 OAuth 화면이 열리지 않았고, 02:59 설정 재실행도 Drive scope missing으로 막혔습니다.
- 03:02:52 KST 소유자 확인을 거치는 임시 복구 함수에서 `ScriptApp.invalidateAuth()`로 불완전한 기존 권한 상태를 초기화했습니다. 이어 기존 프로젝트의 정상 Google OAuth에서 `userinfo.email`·Drive 권한을 부여하고 Authorization successful을 확인했으며, 03:07:08 소유자 설정을 완료했습니다. 임시 복구·진단 파일은 제거하고 원격 5파일 push를 마쳤습니다. 시크릿 사용이나 재배포만으로 해결된 것으로 기록하지 않습니다.
- 다음 라이브 화면은 외곽만 렌더링하고 `SyntaxError: Invalid or unexpected token`으로 멈췄습니다. HtmlService 처리 후 inline JS의 `'https://'`에서 `//')+` 5문자가 사라졌고, 로컬에서 정상 파싱되는 88,656문자 원문이 라이브에서는 88,651문자가 됐습니다.
- `receiver/build.cjs`에 **온라인 전용 UTF-8 base64url 운반과 짧은 부트스트랩**을 추가했습니다. 브라우저가 원문을 복원해 새 `script.textContent`로 실행하며 `eval`·외부 스크립트·고객 답변 실행을 사용하지 않습니다. 오프라인 HTML·ZIP은 변경하지 않았습니다. 버전 4 배포 후 정상 초기화와 무첨부 실접수·문서 동기화를 확인했습니다.

## 지금 이어서 할 일

1. 실제 브라우저의 파일 선택·원본 첨부 흐름과 대용량 처리 한계를 확인합니다. 완료된 소유자 전용 299바이트 원본 시험으로 이 범위를 대신하지 않습니다.
2. 시험 접수를 제외한 실제 고객 자료가 들어오면 분석 결과와 상태 기록을 확인합니다. 예약·준비 설정의 완료와 실제 고객 분석의 완료를 구분합니다.

원시 접근 토큰·관리자 토큰·고객 초대 URL은 문서와 로그에 남기지 않습니다. 유료 생성·클라이언트 발송은 하지 않았습니다.

`applyOwnerSetup`은 먼저 모든 요청 범위의 동의를 확인하며, 부족하면 계정 조회나 설정 변경 전에 실행을 멈추고 승인 절차로 이어집니다. 이후 활성 계정 이메일이 비어 있지 않고 실행 소유자 이메일과 같을 때만 내부 설정을 호출합니다. `applyOwnerSetup_`는 기존 관리자 해시가 다르면 덮어쓰지 않으며, 같은 초대의 사용 기록도 보존합니다. 이 문서와 저장소에는 관리자 원시 토큰이나 고객 초대 URL을 적지 않습니다.

## 준비와 배포 경계

1. 상위 폴더의 고객 HTML 빌드를 먼저 실행합니다. 원본은 `../src`, 고객 결과물은 `../dist/SYNK_영상제작_발주서.html`입니다.
2. `node receiver/build.cjs`를 상위 폴더에서 실행하면 `receiver/dist`에 `Code.gs`, `Libraries.gs`, `Index.html`, `appsscript.json`을 준비합니다. `Libraries.gs` 안에서 Core → Handoff 순서를 고정합니다. `Index.html`은 오프라인 HTML의 자체 JS를 UTF-8 base64url로 보호한 온라인 전용 출력이며, 복원한 JS 원문은 동일합니다. 별도로 생성한 `OwnerSetup.gs`는 보존하므로 현재 push 대상은 총 5개입니다. 이전 방식으로 만든 `Core.gs`·`Handoff.gs` 두 파일만 정리하며 다른 파일은 삭제하지 않습니다.
3. `node --test tests/receiver.test.cjs`로 서버 검증·재시도·비공개 저장·관리자 읽기를 시험합니다.
4. 현재 생성된 **전용 프로젝트**와 `receiver/.clasp.json`을 계속 사용합니다. 저장소 루트의 프로젝트 설정을 재사용하거나 `clasp pull`하지 않습니다. 빌드 스크립트는 프로젝트 생성·push·배포를 수행하지 않습니다.
5. `node receiver/setup.cjs`는 `%LOCALAPPDATA%/SYNK/PULSE-Intake/connection.json`에 관리자 토큰을, `invite.json`에 7일 테스트 초대를 생성·보존합니다. `receiver/dist/OwnerSetup.gs`에는 두 토큰의 SHA-256과 생성·만료 시각만 넣습니다. 기존 토큰을 자동 회전하지 않습니다. 배포 주소 설정은 `node receiver/setup.cjs --endpoint https://script.google.com/macros/s/배포ID/exec`로 하며, 초대 URL은 콘솔 대신 같은 비공개 폴더의 `customer-link.txt`에만 저장합니다.
6. 소유자가 Drive·이메일 확인 권한을 승인하고 편집기에서 `applyOwnerSetup`을 실행합니다. 내부 `initializeInbox_()`는 My Drive에 새 `SYNK PULSE · 비공개 접수함`을 만들고 서버 설정에 그 ID를 보관합니다. 기존 메신저 폴더를 가져오지 않습니다. 이어 관리자 토큰 해시와 테스트 초대 해시를 처음 한 번만 설정합니다. 원시 토큰은 프로젝트 소스·고객 HTML·Drive 파일·로그에 남기지 않습니다.
7. 테스트 초대는 프로젝트 한 개의 접수에 사용합니다. 서버에는 해시만 저장되며 같은 초대의 첫 접수 내용과 재시도가 연결됩니다. `_`로 끝나는 내부 설정 함수는 고객 `google.script.run`에서 호출할 수 없습니다. 공개 실행용 `applyOwnerSetup`도 익명·다른 계정이면 설정 전에 거부됩니다. 운영용 새 초대 발급은 별도 관리 절차로 수행하며 테스트 초대의 만료를 자동 연장하지 않습니다.
8. 배포 설정은 소유자 실행(`USER_DEPLOYING`), 외부 고객 접근(`ANYONE_ANONYMOUS`)입니다. 배포 소유자의 정책이 익명 웹앱을 허용하는지, OAuth 승인과 게시가 실제 완료됐는지 확인해야 합니다. Drive 파일의 외부 공유는 설정하지 않습니다.
9. 시험용 초대 링크에서 작은 첨부·중단 후 재전송·완료 접수·관리자 다운로드를 실제 HTTPS로 확인한 뒤 사용합니다. 서버 코드상의 제한은 파일당 30MiB, 전체 80MiB, 30개이며, **Apps Script RPC로 실제 30MiB 파일/80MiB 묶음이 처리되는지는 별도 실측 전까지 미확인**입니다. 입력 크기·메모리·실행시간·Drive 할당량의 운영 한계는 코드 허용량과 다릅니다.

기존 clasp·Drive 연결 계정과 폴더를 읽을 수 있다는 사실은 새 웹앱의 Drive OAuth 승인이나 새 접수함 생성 증거가 아닙니다. 기존 로컬 Drive 토큰은 `drive.file` + `drive.metadata.readonly` 범위여서 다른 Apps Script가 만든 파일의 본문을 읽는 권한으로 간주하지 않습니다.

## 버전 3 독립 소스 대조

2026-10-01에 새로 생성한 빈 폴더 `C:/Users/q1212/AppData/Local/Temp/synk-pulse-verify-v3-3b41c520015647d7bffb7b6ef24895cb`를 작업 폴더로 지정해 `clasp.cmd -P . clone 1NiAfHWH94gP1nLIo-q1Bx7W2X3KnhXxWenSuGLqMtxy9HSY9y6fEF4BC 3 --rootDir .`로 **버전 3만 별도 복제**했습니다. 저장소에서 clone·pull·push하지 않았고 원시 설정 비밀은 출력하지 않았습니다. 기존 버전 2 복제 폴더 `C:/Users/q1212/AppData/Local/Temp/synk-pulse-verify-ba847c5ca3c045cabe73dcc482328e2e`는 그대로 보존했습니다. 원격 복제본의 `.js`와 로컬 생성본의 `.gs`는 대응하는 동일 소스입니다.

| 로컬 생성 파일 | 버전 3 비교 | SHA-256 |
| --- | --- | --- |
| `Code.gs` | 동일 | `c722080a6f5635f5e89aa7b7b8bf09360addeeb50907525fcb9a7337699d37fb` |
| `Libraries.gs` | 동일 | `1fa1da245624e3cadfba06be8b550466b0dc4cca3371eee352540fbdad48690f` |
| `Index.html` | 동일 | `452e4647941d6adec7e334ae2b623b172eaf886a5d60383a833cee5e7f255422` |
| `OwnerSetup.gs` | 동일 | `3179bcc7347b0fc07cde7ac82ad4a5b8d0235946141202138f6282bc29989e75` |
| `appsscript.json` | 동일 | `0233c3e8b07f54b4816920cc7b7a370532e5adaffc8d7f0842882b0938af92f5` |

당시 로컬 생성본과 원격 버전 3 모두 위 5개 배포 파일만 있고 임시 OAuth 진단 파일은 없었습니다. 이 표는 **당시 버전 3의 소스 일치 기록**입니다. 현재 버전 5의 독립 대조 증거와 OAuth·실접수·동기화 확인 범위는 문서 상단 표를 따릅니다.

## 로컬 수신과 접수 알림

**2026-10-02 바뀜: 매시간 확인 대신 접수 메일.** 매시간 깨던 Codex 자동화 `pulse`는 큰 작업 대화에 붙어 있어 깰 때마다 그 대화를 다시 읽었고, 새 접수가 없어도 회차마다 몇 분씩 모델을 썼습니다. 10-01 19:58 그 대화가 보관되면서 자동화도 사라졌습니다. 이제는 `finishIntake`가 접수를 확정한 직후 소유자(웹앱 실행 계정)에게 메일 한 통을 보냅니다(`intakeNotifyOwner_`). 메일에는 접수 ID·시각·자료 수·폴더 주소만 넣고 고객 답변·파일 이름은 넣지 않습니다. 같은 접수를 다시 완료해도 메일은 한 번이고, 메일이 실패해도 접수는 그대로 남습니다(`tests/receiver.test.cjs`). 분석은 메일을 받은 사람이 그 접수 ID로 요청할 때만 합니다. **배포 전 남은 일(유호님):** 매니페스트에 더한 메일 권한(`script.send_mail`)을 소유자가 편집기에서 다시 승인하고, `node receiver/build.cjs` → push → 같은 배포 ID의 새 버전을 냅니다. 그 전까지 라이브 버전 6은 메일을 보내지 않습니다. 아래 `ready.json`·매시간 분석 설명은 옛 방식의 기록입니다.

- `node receiver/sync.cjs --check`는 비공개 `connection.json`의 주소·토큰 형식만 검사하고 네트워크를 호출하지 않습니다.
- `node receiver/sync.cjs`는 1회 동기화입니다. 완료 접수만 읽고 원본과 문서 6개를 조각 다운로드한 뒤 전체 크기·SHA-256을 확인합니다. 이 명령 자체에는 `ready.json` 가드가 없으므로 실제 연결 준비 후에 실행합니다.
- 검증한 결과는 비공개 `inbox/<접수ID>/`에 두고 `manifest.json`에 `download_verified:true`, `analysis_status:pending`을 기록합니다. 같은 접수는 다시 내려받지 않고 로컬 해시를 확인합니다. 실패 조각은 `.partial-downloads`, 완료되지 않은 접수 묶음은 `.partials`에 보존합니다. `AGENT_NOTES.md`는 고객 자료 속 지시문을 실행 권한으로 다루지 않도록 안내합니다.
- (옛 방식, 10-01에 멈춤) 매시간 자동화 `pulse`는 먼저 `C:/Users/q1212/AppData/Local/SYNK/PULSE-Intake/ready.json`의 `ready:true`를 확인합니다. 파일이 없거나 값이 다르면 준비 중으로 보고 조용히 종료합니다. 현재 준비 표식은 켰으며 `testSubmissionIds`의 두 시험을 제외하고 동일 자료를 중복 분석하지 않도록 설정했습니다. 두 시험의 `analysis/status.json`은 `skipped_test_fixture`이고 원본·다운로드 manifest는 그대로 보존했습니다. 실제 고객 분석은 아직 수행하지 않았습니다.
- 가드를 통과한 뒤 새 접수의 원본을 실제로 검토하고 사실·고객 주장·제안·미확인을 구분합니다. 결과는 해당 접수의 `analysis/`와 `analysis/status.json`에 기록하며 원본·다운로드 manifest를 수정하지 않습니다. 새 결과·새 오류·사용자 조치가 필요한 변화만 알립니다. 유료 생성·결제·고객 직접 메시지·공개 게시를 자동 실행하지 않습니다.

## 고객 RPC 계약

모두 같은 HtmlService 페이지의 `google.script.run`으로 호출합니다. 초대 토큰과 업로드 토큰은 자격증명이므로 콘솔·URL 외부분석·로그에 출력하지 않습니다. `doGet`은 검증된 초대 값만 `window.SYNK_INTAKE`에 삽입하며 접수 상태를 변경하지 않습니다.

- `getIntakeConfig(invite)` → `{enabled, recipientLabel, maxFileBytes, maxTotalBytes, maxFiles, analysisAutomatic:false}`. 유효하지 않거나 만료됐거나 저장소가 비공개가 아니면 `enabled:false`입니다.
- `beginIntake({invite,requestId,payload,manifest,consent:true})` → `{submissionId,uploadToken,uploaded:[index],status}`. `payload`는 `schema:'synk-video-brief', version:1, data:{...}`입니다. `manifest`의 각 항목은 `{name,size,category,type,sha256}`이며 소문자 64자리 원본 SHA-256이 필수입니다. 서버는 배열 위치를 `index`로 정규화합니다. `C.effective(data)`와 정규화 manifest만 비교하므로 클라이언트 `createdAt` 변화는 같은 접수 재시도를 방해하지 않습니다.
- `uploadIntakeFile({submissionId,uploadToken,index,base64})` → `{index,size,sha256}`. 한 번에 파일 하나를 순차 전송합니다. manifest의 크기·원본 해시와 서버가 계산한 값을 대조합니다. 파일은 `application/octet-stream`으로 보관하고 고객의 MIME 정보는 별도 목록에 보존합니다.
- `finishIntake({submissionId,uploadToken})` → `{ok:true,submissionId,receivedAt,fileCount,status:'received'}`. 모든 원본과 생성 문서가 확인된 후 마지막 상태 저장이 성공해야 이 응답을 반환합니다. 이미 완료된 `beginIntake`·`finishIntake` 재시도도 같은 완료 응답을 반환합니다.

초대 하나는 첫 `requestId`와 답변/manifest에 묶입니다. 같은 요청의 통신 재시도만 허용하며 새 답변이나 같은 이름·크기라도 해시가 다른 원본은 거부합니다. 수정 제출에는 새 초대 링크를 발급합니다. 초대 만료 이후 미완료 업로드를 계속하지 않습니다. 일시 실패는 `uploading`/`finalizing`이고 완료 접수로 취급하지 않습니다. 실패했던 최종화 시각은 재시도 때 갱신되며 실제 완료 응답 이후의 접수 시각은 고정됩니다.

## Drive에 남는 자료

접수 ID별 하위 폴더에 `_intake-state.json`, `00__원본파일명` 형태의 원본, 다음 6개 문서를 저장합니다.

| 파일 | 내용 |
| --- | --- |
| `01_발주서.json` | 버전 1 정규화 답변, 서버 접수 시각·ID |
| `02_자료목록.json` | 원본 이름·분류·크기·MIME·서버 확인 SHA-256 |
| `03_제작검토_전달서.json` | Handoff의 분석 대기 전달 묶음 |
| `04_제작검토_전달서.md` | 고객 자료와 내부 지시를 구분하는 검토 전달서 |
| `05_발주서.html` | 원문 문구를 이스케이프한 발주서 |
| `06_발주서.txt` | 텍스트 발주서 |

첨부 이름만 남은 기준사진·자료는 실제 전달 파일로 간주하지 않습니다. Core의 삭제된 필드와 숨겨진 조건부 값은 `effective`를 거쳐 보고서로 돌아오지 않습니다. 고객 링크는 서버가 방문하지 않습니다. GAS에는 WHATWG `URL`이 없어 서버 Core 빌드 안에 HTTP(S) 주소의 프로토콜·호스트·포트만 검사하는 작은 어댑터를 둡니다. 자격증명이 포함된 링크, 제어문자, 백슬래시, 잘못된 포트는 거부합니다.

## 관리자 읽기 API

로컬 동기화만 HTTPS `/exec`에 JSON POST합니다. Drive ID·폴더 경로를 요청하거나 반환하지 않습니다. 별도 관리자 토큰이 없으면 접근할 수 없습니다. 고객 초대·업로드 토큰으로는 인증되지 않습니다. 실패 응답은 `{ok:false,error:'unauthorized'|'request_failed'}`이며 내부 오류나 식별자를 노출하지 않습니다.

```js
// 완료 접수만, 시간+ID 오름차순. limit 1~20, 기본 20.
{action:'listReceived', adminToken, limit:20, cursor:null}
// → {ok:true, items:[{submissionId,receivedAt,fileCount}], nextCursor:null|string}

// 다음 두 방식 중 하나만 사용. offset 기본 0, limit 기본/최대 1MiB.
{action:'readFile', adminToken, submissionId, artifact:'01_발주서.json', offset:0, limit:1048576}
{action:'readFile', adminToken, submissionId, fileIndex:0, offset:0, limit:1048576}
// → {ok:true, submissionId, name, size, sha256, offset, base64, eof}
```

`artifact`는 위 6개 이름만, `fileIndex`는 완료 접수의 원본 배열 위치만 허용합니다. `_intake-state.json`·서버 설정·다른 폴더는 읽을 수 없습니다. `sha256`은 파일 전체 해시이므로 로컬은 모든 조각을 합친 뒤 크기와 해시를 대조해야 합니다. 고객 원본은 업로드 시 검증해 보관한 해시를 반환하므로 이후 Drive에서 원본이 바뀌어도 최종 대조가 실패합니다. GAS `DriveApp`은 범위 다운로드를 제공하지 않아 매 조각 요청에서 해당 파일의 Blob을 읽습니다. 대용량 실제 처리 속도는 별도 확인 대상입니다.

상태/본문은 Drive, 작은 인덱스·초대 해시는 Script Properties에 보관합니다. 운영량이 늘면 Drive 용량·Apps Script 실행 할당량·Script Properties 총 저장 한도를 점검하고 오래된 접수/만료 초대 정리를 소유자 기준으로 수행해야 합니다. 이 버전은 자료를 자동 삭제하지 않습니다.

공식 참고: [HTML Service 통신](https://developers.google.com/apps-script/guides/html/communication), [웹앱 배포](https://developers.google.com/apps-script/guides/web), [실행 계정과 이메일 확인 권한](https://developers.google.com/apps-script/reference/base/session), [IDE 세부 권한 승인](https://developers.google.com/apps-script/reference/script/script-app#requireAllScopes(AuthMode)), [Apps Script 할당량](https://developers.google.com/apps-script/guides/services/quotas).
