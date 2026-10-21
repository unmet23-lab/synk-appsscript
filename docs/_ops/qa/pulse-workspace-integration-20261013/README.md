# PULSE·Workspace 통합 반영 검증 — 2026-10-13

**상태: 통합 배포·공개 105파일·고객 선택 왕복·실제 크기 영상·최종 납품·수령 확인·ZIP·새 백업과 격리 복원·HA 재활성화를 완료했다.** 배포 `28cbc51ccb43630f7aaa1f7f82813dc0`은 seq12·complete다. 06:46:23 KST 최종 인수에서 **`armed:true`·A epoch 7·B 대기·공개 HTTPS ready·복제 정상**을 확인했다. 과거의 일시 정지와 미확정 원인은 아래에 보존하며, 이번 릴리스의 실제 강제 장애 시험이나 연속 무중단을 주장하지 않는다.

## 종료 전 확인 — 2026-10-13 07:52 KST

사용자 「일단 배포하고 종료해줘」 요청으로 다시 확인했다. [최신 서버 읽기](../../../../.tmp/pulse-workspace-integration-20261013/close-20261013/current-runtime-2026-10-12T22-49-47-151Z.json)는 기존 7b2·A epoch7·B 대기·armed=true·공개 ready·복제 정상이며 진행 중인 배포가 없었다. [공개 파일 재대조](../../../../.tmp/pulse-workspace-integration-20261013/close-20261013/public-close-1791845514606.json)에서 PULSE 핵심 6파일과 운영 health를 확인했다. 현재 PULSE 전용 131파일을 동결본과 비교해 실질 실행 변경은 없었으므로 중복 배포·서비스 재시작은 실행하지 않았다. 비교영상 4편은 기존 전달본으로 보존하고 공개 슬롯에는 새로 추가하지 않았다. 다른 작업의 변경과 진행 중인 선택 커밋은 건드리지 않았다. 실물 휴대폰 확인·비교 HTML 화면 검증·간헐적 외부 요청 시간초과의 정확한 원인 확인은 기존 미확인 범위로 남긴다. 재개 시 이 문서와 영상 폴더의 `final-qa.json`에서 이어간다.

## 통합 범위

- 작업실의 승인된 로컬 기능 1–28·30–35: 고객 관리, 제작·게시·성과 기록, 오늘 할 일, 초안·검색, 완료 기록 PDF/CSV, 납품 ZIP, 자료 사용 기한·사용/참고 구분. 29번 실제 작업시간 기록과 36번은 제외했다.
- PULSE 전신 기준 사진 7명과 시그널 9판을 포함하고, 운영 부모에 있던 하린 동작 샘플 2개·승인 얼굴·자료를 보존했다. 별도 준비 중인 로그인 3판·고객 관리 10판 및 새 20초 비교영상은 이 동결본에 포함하지 않았다.
- `SYNK_COMPANY_WORKROOM_SCHEDULE_ENABLED=1` 한 키 추가만 승인했다. 게시 링크 확인·주간 요약·자동화 상태의 작업실 예약을 연결하며, 전역 백그라운드 작업과 외부 알림의 기존 비활성 설정은 유지한다. 유료 AI·SNS 발송·성과 자동 수집·Drive 자동 삭제를 켜는 변경이 아니다.
- 새 자료 종류는 기존 문서 저장소를 사용한다. SQL 스키마 변경은 없으며, 기존 키·계정·세션·미디어와 시작 직전 자료 보존 검사는 유지한다. 운영 시작 후 과거 자료로 자동 되돌리는 경로는 사용하지 않는다.

## 고정 후보

| 항목 | 값 |
|---|---|
| 운영 부모 | `762731fdd9c59e3ba23623baf6a9bfc9f4af562fd978e047837f38d740353e5d` · 678파일 |
| 통합 후보 | `7b2ccbf0c170d117cb0543ffa66df2886cd9f19ef3becb57b54d5df972052303` · 910파일 |
| 부모 대비 변경 | 288파일 · 이미지 파일 531개 |
| 실제 후보 이미지 | `sha256:8120a2016085a99ea4dd14e5e7dca40de1a52d9dd2ae2f0c53480d380b6049a1` |
| 공개 대조 범위 | PULSE 94 + Workspace 11 = 105파일 · 캐시 44개 |
| 원격 후보 경로 | `/opt/synk/releases/7b2ccbf0c170` |
| HA | runtime4 유지. 새 릴리스 자체의 실제 장애 시험으로 주장하지 않으며, 기존 676 실제 장애·복귀 이력과 후속 인수 근거를 구분한다. |

원본: [후보 manifest](../../../../.tmp/pulse-workspace-integration-20261013/release/release-manifest.json) · [검토 영수증](../../../../.tmp/pulse-workspace-integration-20261013/reviewed-candidate-receipt.json) · [비활성 배치 완료](../../../../.tmp/pulse-workspace-integration-20261013/rootqa/readiness.json). 영수증 SHA는 `e0ffaf9bb4132fe7b7d81f747f9b0c60c8304bfd0b58eefff14f34f37f02d7f4`, 준비 완료 SHA는 `8ecf7c92c80fb9374355adc18c28d97e836e1c9031686693ac79e29ff2c74bba`다.

## 확인한 결과

| 구간 | 결과와 원문 |
|---|---|
| 실제 후보 이미지 Linux | production **3,202/3,202**, backup **20/20**, compat **2/2**, 실패·취소·건너뛰기 0. [결과](../../../../.tmp/pulse-workspace-integration-20261013/rootqa/result.json), [production TAP](../../../../.tmp/pulse-workspace-integration-20261013/rootqa/production-tests.tap), [backup TAP](../../../../.tmp/pulse-workspace-integration-20261013/rootqa/backup-tests.tap), [compat TAP](../../../../.tmp/pulse-workspace-integration-20261013/rootqa/compat-tests.tap). 운영 자료를 마운트하지 않은 합성 시험이다. |
| 미디어 도구 | 공식 서명 FFmpeg 7.1.5를 같은 Debian 기반에서 빌드했다. 실제 바이너리·출처·fd 프로토콜·회전 옵션과 기존 미디어 시험을 확인했다. fd 전용 검사 경계를 유지했다. [출처 검증](../../../../.tmp/pulse-workspace-integration-20261013/rootqa/ffmpeg-source/source-verification.json). |
| 배포·HA 도구 격리 회귀 | **223/223**: Node 72 + HA Python 28 + 배포 worker 123, 건너뛰기 0·운영 보호 대상 불변. 이는 실제 장애 전환이나 재활성화 완료 증거가 아니다. [Linux 원문](../../../../.tmp/pulse-workspace-integration-20261013/ha-compat/linux-qa-result-v6.json), [배포 worker 검증](../../../../.tmp/pulse-workspace-integration-20261013/deployment-validation-workroom-v6.json). |
| 로컬 실제 화면 | PDF 5쪽·CSV 95행, 초안 자동 보관→새로고침→미리보기→이어쓰기, 검색, 전신 7명, 하린 동작 2개 끝까지 재생, 새 자동화 카드 17개, 자료 구분 저장·복원, ZIP 5항목·미디어 3개 원본 해시 일치. 1280/390px 넘침·콘솔 오류 0. 변경 없는 화면은 이전 실검증과 파일별 동일성을 결합했다. [최종 브라우저 근거](../../../../.tmp/pulse-workspace-integration-20261013/browser-validation.json)는 `productionVerified:false`다. |
| 양 노드 비활성 배치 | A/B 원문 910개와 이미지 해시를 각각 확인했다. [원문 readback](../../../../.tmp/pulse-workspace-integration-20261013/rootqa/source-inspect-1791837368833.json), [이미지 readback](../../../../.tmp/pulse-workspace-integration-20261013/rootqa/image-inspect-1791837861618.json). 이미지 전송 파일 171,032,575바이트의 SHA는 `da9a6a43edae56dcdfc2402d05bb17316ea3e450f9bb52f88bc1f8484163ad01`로 일치했다. |
| 전환 전 운영 기준 | 기존 프로젝트 4개를 보존하고 내부 검증용 1개에서 고객 선택 저장→새로고침→제작자 확인을 마쳤다. [사전 UI 기록](../../../../.tmp/pulse-workspace-integration-20261013/rootqa/integration-project-before.json), [키·9계정표 기준](../../../../.tmp/pulse-workspace-integration-20261013/ha-compat/accounts-before-v2.json). 이후 UI 쓰기는 전환 완료까지 중단했다. 초대 토큰·세션 값은 이 문서에 기록하지 않는다. |

## 실제 운영 인수

### 완료된 실제 운영 검증

| 구간 | 실제 결과 |
|---|---|
| 배포·runtime | [3호스트 runtime 검증](runtime-verification.json) 통과. 새 원문·이미지·runtime4·보호 명령·A epoch 7 단일 writer와 job 종료를 확인했다. 승인한 작업실 환경 키는 활성화됐고, 승인하지 않은 환경 바이트와 다른 환경 파일은 그대로다. [최종 job 상태](../../../../.tmp/pulse-workspace-integration-20261013/rootqa/release-status-1791838352166.json). |
| 자료 보존 | 쓰기 중지 상태에서 시작 전 논리 DB 자료·DB 외 파일이 정확히 보존됐고, 원키와 시작 후 스키마 검사가 통과했다. **시작 후 세션표 전체 동일성은 false**다. `synk_identity_sessions`는 2행을 유지했지만 내용 해시가 달라졌으므로, 각 기존 세션 행의 불변까지 주장하지 않는다. 실제 로그인 화면에서의 동작은 아래 UI 증거로 별도 확인했다. |
| 공개 파일 | [공개 검증](public-verification.json): PULSE 94 + Workspace 11 = **105파일**, 캐시 44개 일치. 비공개 계획 3경로 차단, 엄격 CSP, 음성·영상 사전 캐시 0도 확인했다. |
| 고객 선택 왕복 | 하린 F02·헤어·메이크업·의상·액세서리와 목소리 B를 제작 설계 **v2**로 저장했다. 고객 새로고침 복원 내용과 제작자 요약이 일치한다. 메시지·근거·행동 3항목도 함께 확인했다. [JSON](integration-project-after.json), [고객 복원](production-customer-restored.png), [제작자 확인](production-staff-confirmed.png). |
| 실제 크기 검토 영상 | **26,845,451바이트·1080×1920·93.5초** 파일을 운영 PULSE에 업로드했다. 고객 화면에서 93.5초 끝까지 재생했고 `ended:true`, `error:null`이다. 다운로드한 파일의 SHA-256은 원본과 같은 `fa027c0e3c4faa10265f4e3d303604d7969c3c6a2932fd63f66c58a00d65cd75`다. [재생 원문](production-large-video-playback.json), [다운로드 원문](production-preview-download.json), [끝까지 재생 화면](production-video-ended.png). 최종 납품 파일 검증과는 구분한다. |
| 승인 후 안내·작업실 예약 | [승인 후 안내](production-after-approval-guidance.png)를 실제 고객 화면에서 확인했다. [운영 자동화 화면](production-automation.png)에 17개 카드와 05:56 최근 점검 시각이 표시됐다. 이것만으로 외부 발송이나 유료 호출 결과를 주장하지 않는다. |
| 최종 납품·수령 확인 | 최종본을 업로드하고 고객 확인한 납품 규격 **v1**에 연결했다. 최종 파일 다운로드 26,845,451바이트·SHA가 위 원본과 일치했다. 고객의 수령 확인 저장→새로고침 후 복원→Workspace의 같은 수령 완료 표시를 확인했다. [최종 다운로드](production-final-download.json), [저장 화면](production-final-receipt.png), [새로고침 뒤 고객 DOM](production-final-receipt-restored.dom.txt), [Workspace DOM](production-final-workroom.dom.txt). 파일 연결 자체가 규격 검수나 사용 허락을 뜻하지 않는 안내도 유지됐다. |
| 운영 납품 ZIP | 실제 내려받은 **26,846,600바이트** ZIP은 `최종 파일/video.mp4`와 `납품 안내.txt`의 **2항목**이다. ZIP 전체 검사·두 CRC·상대 경로 검사가 통과했고, 영상 26,845,451바이트·SHA는 원본과 일치했다. 압축해제·서버 쓰기는 하지 않았다. [다운로드 위치](production-final-zip-download.json), [실제 ZIP 검증](production-final-zip-verification.json). ZIP SHA는 `ff018e675a33827bab7aaa5158a2e1c56112c13c5da886fe0122795e28aee317`이다. |
| 사용 자료 구분의 운영 확인 범위 | 새 검증 프로젝트는 원자료가 0개다. [운영 화면](production-material-usage.png)과 Workspace DOM에서 최종 납품 파일이 자동으로 **사용함**에 들어간 것만 확인했다. 원자료의 사용/참고 선택 저장·새로고침 복원은 앞선 로컬 합성 시험 근거이며, 이번 운영 시험에서 재검증했다고 주장하지 않는다. |
| 화면 크기 확인 범위 | [운영 레이아웃 원문](production-final-layout.json)의 실제 화면 폭은 **825px**이다. 390px 요청이 적용되지 않아 `mobileOverrideApplied:false`, 실물 휴대폰 시험도 false다. 이 운영 캡처를 모바일 증거로 쓰지 않는다. 390px의 넘침 없음은 앞선 로컬 브라우저 검증 범위다. |

위 runtime/public·UI와 아래 백업·복원·관측·최종 HA 원문 51개는 이 QA 폴더에 바이트 그대로 복사했다. 출처·크기·SHA는 [최종 복사 목록 v5](evidence-production-v5.json)에 기록했고, [v4](evidence-production-v4.json)·[v3](evidence-production-v3.json)·[최종 납품 포함 v2](evidence-production-v2.json)·[첫 복사 목록](evidence-production-v1.json)도 보존했다. 로컬 브라우저 증거의 `productionVerified:false`는 원문대로 보존하고, 실제 운영 증거를 따로 연결했다.

### 새 백업과 복원 공간 확보

- [새 백업 완료](backup-status-7b2-v5.json): request `76fe101801a73e6a44b70ccf3fc7258e`, **414,193,818바이트**, 업로드·정확 generation·MD5·영수증 확인 완료. 원키·보호 원문은 그대로이고 앱 재시작은 0이다. SQLite 온라인 순차 백업이므로 모든 DB가 단일 순간에 동결된 스냅샷이라는 뜻은 아니다.
- [첫 복원 시도](restore-7b2-v1.json)는 `STANDBY_REHEARSAL_SPACE_LOW`로 작업 디렉터리를 만들기 전에 HOLD됐다. 기준은 백업 크기 12배 + 2GiB인 **7,117,809,464바이트보다 큰 여유 공간**이며, 이 보호 조건은 낮추지 않았다. [용량 진단](space-diagnostic-7b2-v1.json)을 보존했다.
- 정리 전 과거 격리 복원 6건의 [GCS 원본·영수증](cleanup-six-gcs-7b2-v1.json)을 exact generation·크기·MD5·receipt SHA로 대조하고 [현재 사용 여부](cleanup-six-read-7b2-v1.json)·[각 하위 경로](cleanup-six-children-7b2-v1.json)를 확인했다. 작은 결과·실행 원문 **32개**를 [로컬 색인](prior-dr-evidence-index.json)대로 보존했고 32개 SHA가 모두 일치한다.
- 검토한 [계획의 smallerSufficientSet](cleanup-six-plan-7b2-v1.json)에 한해 승인 후 **임시 사본 26개**를 정리했다. [실행 결과](cleanup-six-execution-7b2-v1.json)는 passed다. 기존 root 디렉터리·남긴 증거·운영 보호 원문을 보존했으며, 서비스 액션·클라우드 쓰기는 각각 **0**이다. 여유 공간은 **7,277,105,152바이트**로 회복돼 원래 보호 조건을 통과했다. 운영 current·릴리스 부모·백업 원본·볼륨을 정리한 것이 아니다.
- 두 번째 복원은 새 백업을 다시 만들지 않고 **같은 request와 업로드 원본**으로 진행해 06:29:54 KST에 통과했다. [실제 격리 복원](restore-7b2-v2.json)과 [해시·배포 연결 검증](binding-7b2-v1.json)을 보존했다. 원문 910개·HA 필수 파일 37개·원키·9개 계정표·세션 값이 복원 전후 일치했고, `network:none`·UID 1000·공개 포트 0에서 확인했다. 운영 환경 파일은 컨테이너에 전달하지 않았으며(`productionEnvFilePassed:false`), 대기 노드의 설정·runtime·guard·환경·운영 컨테이너는 그대로다. 시험 컨테이너는 제거됐고 이미지 로드·재태그는 0이다. 이는 실제 클라우드 권한 복구·새 VM 생성·실사용자 로그인·HA arm 증거가 아니다.

### HA 재활성화 전 관측 이력

| 원문 | 확인한 결과 |
|---|---|
| [natural v1](natural-7b2-v1.json) | `NATURAL_WINDOW_NOT_ACCEPTED`로 HOLD. |
| [natural v2](natural-7b2-v2.json) | **190.109초·정상 표본 4개·외부 지역 3개**로 기존 180초 기준 통과. 특정 표본 구간의 통과이며 이후까지 연속 무중단이었다는 증거는 아니다. |
| [natural v4](natural-7b2-v4.json) | 새 local/external 불건강 표본을 포함해 다시 HOLD. 앞선 v2 성공을 최신 관측 대신 사용하지 않았다. |
| [natural v5](natural-7b2-v5.json)·[snapshot v5](arm-snapshot-7b2-v5.json) | `READONLY_COLLECTION_FAILED`, raw 결과 없음. 조건을 충족하지 못해 HA stage·dispatch를 진행하지 않았다. 이 오류만으로 Google API나 서비스 장애 원인을 확정하지 않는다. |
| [진단 natural](diagnostic-natural-7b2-v1.json)·[호출 결과](diagnostic-natural-calls-7b2-v1.json) | controller·A·B의 원격 읽기는 모두 정상 반환했다. 새 정상 구간이 180초를 채우지 못해 관측 판정은 HOLD다. |
| [진단 snapshot](diagnostic-snapshot-7b2-v1.json)·[호출 결과](diagnostic-snapshot-calls-7b2-v1.json) | 정상 반환·passed. 읽기 도구 원문·판정 흐름 변경, 서비스 액션, 클라우드 쓰기는 0이다. |

[A 진단](health-load-primary-7b2-v1.json)에서 06:27:03→06:27:50와 06:33:17→06:34:03 KST의 reason 23→READY 및 컨테이너 정지·재시작을 확인했다. 각각 약 47초다. 코드상 reason 23은 Google 권한·소유권 확인 요청의 `TimeoutError` 범주로 좁혀지지만, 어느 API 요청인지는 현재 로그로 확정할 수 없다. 앱 내부 health 실패는 `HOST_*`로 구분된다. 이 현상은 이전 678에서도 관측됐으며 새 앱 변경의 원인이라고 단정하지 않는다.

진단 당시 A의 공개 health는 384ms·HTTP 200·ready였고 부하는 낮았다. [B 진단](health-load-standby-7b2-v1.json)은 STANDBY이며 QA 실행은 없었다. 현재 응답 성공이 앞선 중단을 지우거나 앞으로의 무중단을 보장하지 않는다. 최신 정상 구간은 06:41:29 KST 이후부터 원래 조건으로 다시 확인하며, 기준을 낮추거나 실패 기록을 고쳐 재활성화하지 않는다.

### 최종 HA 인수 완료

[최신 natural v6](natural-7b2-v6.json)은 **240.097초·5표본·3지역·오류 0**으로 통과했고, [owner](owner-7b2-v6.json)·[snapshot](arm-snapshot-7b2-v6.json)도 통과했다. 후계 요청 `cae18cdc-ccd7-4a4a-b679-277f6d3b02fd`를 **1회 dispatch**해 [installed-armed·unit exit 0](arm-status-7b2-v6-1.json)을 확인했다. [최종 postcheck](arm-postcheck-7b2-v6.json)는 **06:46:23 KST passed**다. runtime4·control generation `1791838325144496`·A epoch 7은 유지됐고, 공개 HTTP 200·ready·TLS·복제가 정상이다. 새 제어기 invocation에서 **28.622초 관측**, `RECOVERED` 1회·재시작 0·오류 0으로 기존 1감시주기(10초 이상) 조건을 통과했다. 30초 관측으로 표현하지 않는다. `currentReleaseOutageTested:false`, `noNativeRearmClaim:true`를 유지하며 676의 실제 장애·복귀 이력을 새 릴리스의 시험으로 바꾸지 않았다.

## 보존한 관측과 실패 기록

전환 전 기존 678의 A 노드는 05:40:47 KST에 reason 23으로 안전 정지했고 05:41:34에 READY로 복구됐다. owner A·epoch 7·기존 릴리스는 유지됐으며, 특정 Google 요청이나 이미지 전송이 원인이라고 단정할 근거는 없다. [읽기 진단](../../../../.tmp/pulse-workspace-integration-20261013/rootqa/primary-diagnostic-before-inert-readiness.json), [05:44:42 공개 health 200·ready](../../../../.tmp/pulse-workspace-integration-20261013/rootqa/public-health-before-readiness-1791837882348.json)는 **교체 전 부모 상태**다.

이전 후보·실패 시험·통신 유실 원문은 보존했다. SSH 응답 유실은 원격 완료 결과를 읽어 인수했으며 같은 작업을 중복 실행하지 않았다. 현재 통과 결과와 이전 실패를 합쳐 성공으로 표현하지 않는다. 관련 원문은 `.tmp/pulse-workspace-integration-20261013/rootqa/` 및 `superseded-*`에 남아 있다.
