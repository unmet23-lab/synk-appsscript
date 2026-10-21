# 싱크타운 v20 최적화와 공개 배포

## 현재 상태 · 2026-10-10

사용자가 승인한 v20과 최적화를 공개 커밋 8c82bdaf2a0074098ab873a188de63dd72994c98, 이어 초기 자산 준비와 캐시 호환성을 002cf9d2a47536b20000242b408374e8db6a99d3으로 반영했다. [공개 WORLD](https://synk.im/world/)에서 연다. Pages37988737322가 성공했고, public-assets-http.json의 공개 정적 파일79개는 실제 Git blob SHA256·MIME와 모두 일치한다. 첫 커밋 Pages37983666519/사이트 CI37983667260도 성공했으며 최종 커밋의 사이트 CI37988737605도 성공했다. 최종 완료 기록은 release-complete.json이다.

최종 공식 Claude Code2.1.295 검수는 claude-opus-5-5 --effort max로 완료했으며 실제 단일 모델과 completed/is_error=false를 확인했다. 최종 두 파일에 P0/P1/P2/P3=0, 공개 차단 없음이다. frozen 검수 원문과 실행 정보는 .tmp/town-optimize-release-20261010/final-assets-ready/official-review.json와 official-review-command.txt, 첫 preload 검수는 before-cache-guard/official-review.json에 있다. final-diff.patch가 최종 변경이고 followup-diff.patch는 guard 전의 검수 당시 diff다.

불필요한 정적 scene/world local matrix 계산과 이름표 전체 순회를 줄인다. 계정 모드만 첫 이미지/아바타 promise를 연결 요청 전 준비하고5초 타이머에서 기존 procedural fallback으로 진행한다. 새 app은 이전 캐시 scene에 prepareInitialAssets가 없어도 optional chaining으로 기존 절차를 이어간다. 승인된 그래픽20·재질19·화질/DPR/AO/그림자·카메라·보행·권한·동의·생활 상태와 저장은 유지한다. 첫 공개 합성 계정의 deadline 실패 원문 public-account-browser.txt를 보존하고 성공으로 덮어쓰지 않았다.

public-assets-account/report.json은 새 Edge에서 실제 공개 페이지·자산을 읽고 합성 계정/API만 로컬 fixture로 격리한25검사다. 첫 진입·walk 활성화·재입장·로그아웃·BFcache fallback·새 로그인, JS/asset/external 오류0으로 통과했다. 운영 provider 호출과 실제 사용자 계정/학생 상태 쓰기는0이다. 실제 휴대폰이나 운영 계정의 실사용 성능을 뜻하지 않는다. account-assets-ready의 guard 전 normal path25검사, account-assets-cache-mix의 최종 app+이전 공개scene25검사도 통과했다.

pixel-assets-final/report.json은 PC1280/390폭, 집·이동 뒤·온실 세 시점의 PNG6쌍과 actor/light/sprite/world 행렬이 정확히 같다. 초기화 전부터 manual RAF/clock을 쓰고180/360/540프레임을 확인한20검사이며 FPS 근거가 아니다. JS/console/shader 오류0·자체GPU 정상 종료다. static-matrix-cpu.json의 실제 Three 변환 비교44검사도 통과했다. 이전 실패 pixel-assets/pixel-assets-ready/pixel-assets-public 원문을 보존했다. 앞의 두 시도는 현재 root graph 의존 route/자산 준비 timeout, 세 번째는 native warmup 뒤 시계를 되돌린 시험 도구 오류이며 제품 회귀 근거로 쓰지 않는다.

final-freeze-assets.json은 실제 Git index의 복사본에 app/scene 두 경로만 staging하여 부모536파일과 최종 공개 바이트를 고정한95검사다. 정적 의존79개·서버9모듈 동일, source/public snapshot 이동0, primary public 저장소 dirty worktree/index 보존을 확인했다. 운영 DB/Edge/OAuth 변경·새 음성·오프닝/옷장·미니게임의 다른 변경을 포함하지 않는다. 측정 변동 때문에 일정60fps나 향상률을 주장하지 않는다. 아래는 원인 측정과 앞선 준비 단계의 기록이다.

사용자가 v20 화면을 승인하고 최적화·배포를 요청했다. 제품 변경은 `day-scene.mjs`의 움직이지 않는 scene/world 컨테이너의 local matrix 자동 계산 중지와, 매 프레임 전체 scene을 순회하던 이름표 처리의 기존 11개 sprite 목록 재사용이다. descendant world matrix 자동 갱신과 움직이는 주민·빛·이름표 갱신은 유지한다. 그래픽20·재질19·화질/DPR/AO/그림자·보행·카메라·생활/계정 계약을 바꾸지 않았다. `before-product`에 승인 당시 소스를 보존한다.

`static-matrix-cpu.json`의 실제 Three 변환 전파 비교44개가 통과했다. 고정 구조의 world matrix는 8프레임 중 최초 한 번만 계산되며, 이동 actor/body/sprite/light 결과는 기존과 같다. 아래 원인 진단의 normal 재질 캐시 후보는 별도 QA 초안이며 제품에 적용하지 않았다. 화면 버킷 정렬을 바꿀 수 있어 검증되지 않은 변경은 배포 범위에 포함하지 않는다.

최초 A/B는 QA의 아직 정의되지 않은 `qaRenderer` 참조 때문에 모바일 시작 전에 중단됐다. `ab-containers-labels/report-before-cleanup.json`의 원래 실패와 close20초 timeout을 보존했다. 이후 별도 CIM 확인에서 자체 Node48868/Edge48788과 해당 임시 프로필 명령의 프로세스가 없어 자연 종료를 확인했다. 실패 기록을 성공으로 덮어쓰지 않았다. `ab-retry.cjs`는 기다림에 `window.qaRenderer`를 사용하며 새 `ab-verified` 폴더에 다시 기록한다.

배포 후보는 최신 공개 부모 `4c6a365eb5e4df8acb4379adc380bfb1a2093e4d`의 격리 작업본이다. 기존 빌더의 /world/ 모듈 경로 재작성을 사용해 `day-environment.mjs`, `day-materials.mjs`, `day-scene.mjs` 3개만 반영한다. 다른 미니게임의 최신 변경·계정·오프닝·옷장은 유지한다. 기존 Town/공용 의존79개와 운영 기록의 Town 서버 모듈9개가 일치하고, 구문3개·참조40개/누락0을 확인했다. 최종 화면 비교·합성 계정 브라우저 검증·공식 Opus5.5 max 검수·공개 Pages/HTTP 확인은 이어서 진행한다. `release-path.json`은 후보 준비 기록이며 공개 완료 증거가 아니다.

## 변경 전 원인 측정

2026-10-10 · 운영 소스 편집 0, 사용자 4288 접근 0. 기존 `qa-brand-v10.cjs`의 메모리 fixture·실제 WASD·카메라·완료 프레임 7.2초 sampler를 얇게 재사용했다. Edge headless Intel Arc B390/D3D11, 1280×900·390×844, DPR1, 원래 balanced/AO/그림자/캐릭터/이동 값을 유지했다. 디스크 캐시10MiB·미디어1MiB·shader disk cache off. 성능 부팅·실물 단말·전 시점60fps·최적화 효과는 이 측정으로 주장하지 않는다.

`performance-findings.json`에 원본·CPU profile·패스/GPU 진단을 분리했다. `before/browser.json`은 browser-served source monkeypatch 없이 원본 PNG6개와 완료 프레임을 기록하며, 39소스·9보호 자산 전후 일치/JS·console·shader·asset·메모리API 오류0이다. CPU profile은 원본 캡처 후에 별도로 수집했다.

원본 완료 FPS는 PC home57.35/cafe43.08/greenhouse59.04, 390폭 home55.63/cafe58.27/greenhouse56.98이다. 원본 CPU는 제품360프레임 rolling window이므로 앞선 이동 비용도 일부 포함한다. 이전 PC home31.6/greenhouse35.8fps는 재현되지 않았고 cafe 결과가 낮아 호스트·타이밍 변동을 무시한 성능 향상 주장은 하지 않는다. greenhouse는 기존 native helper0.1m 허용 범위로 멈추므로 이전 final과 끝 좌표·fadedMesh가 조금 다르다.

`diagnostic/*-stages.json`은 QA용 browser route에서만 소스를 변환했다. 패스 CPU·프로그램 변경 카운터·8프레임당 하나의 EXT_disjoint_timer_query_webgl2 GPU 전체 프레임 query를 기록하며, 원본 제품 FPS/PNG/GPU 값으로 쓰지 않는다. query 결과는 비동기로 읽고 disjoint 값을 제외했다. 일부 마지막 pending query는 기다리지 않았다. 최초 diagnostic의 provenance/browser 공통 scope 문구는 원본 프로브에서 상속된 표기이므로 이 파일과 각 stage의 DIAGNOSTIC ONLY scope를 따른다. raw를 덮어쓰지 않았다.

실제 반복 원인은 AO의 단일 MeshNormalMaterial이 일반 메시·InstancedMesh 특성을 번갈아 담는 것이다. home74/cafe·greenhouse76회 매 프레임 instancing 프로그램 선택, 추가 instanceColor8회가 기록됐다. beauty의 공용 StandardMaterial도 instancing42회, shadow의 공용 DepthMaterial은40회가 반복됐다. 최소 수정 후보는 AO normal 재질을 object shader feature별 안정 variant로 나누는 것. 화질·DPR·AO·그림자·기하를 낮출 근거는 없다. 이 후보는 여기서 구현하거나 개선 효과를 확인하지 않았다. normal material swap을 구현한다면 기존 재질·배열·visibility·dispose를 정확히 복원해야 한다.

진단 home CPU p50 beauty+shadow9.0ms/normal3.5ms/AO전체3.8ms이고 GPU wholeframe query40개의 p50 17.22/p95 21.16ms였다. 이 GPU 명령 구간은 CPU 제출 틈도 포함할 수 있으며 순수 shader 계산 시간으로 해석하지 않는다. `performance-findings.json`에는 다른 장소의 원본 숫자와 모든 stage 요약도 있다.

원본·진단 둘 다 browser.close20초 제한 원문을 보존했다. 각 `shutdown-final-observed.json`은 정확한 자체 Node/Edge PID·command·임시 profile 근거와 native/CIM 자식0으로 GPU 종료를 확인한다. 원본 자체 Edge를 exact 확인 후 Stop-Process로 종료하려는 시도는 이미 native PID가 없어 성공하지 않았고, 이후 Node도 자연 종료했다. 외부 브라우저 중단0·강제 종료 성공0·profile 삭제0이다.

재실행: `node experiences/synk-town/qa/town-optimize-release-20261010/probe.cjs 새폴더이름`, 진단은 끝에 `--instrument`. 이미 있는 browser.json은 덮어쓰지 않는다. 임시 source runtime을 컴파일하는 부분은 기존 QA helper 확장이며 LLM 실행기가 아니다.

### 이번 최적화의 최종 로컬 확인

`pixel-final/report.json`: PC1280·390폭의 집/이동 후/온실 세 시점6쌍은 PNG SHA256과 실제 actor/light/sprite/world 행렬이 모두 정확히 같다. manual clock은 계속 증가하며 각180/360/540프레임을 렌더했다. 이 결정적 진단20검사·JS/console/shader오류0·자체GPU정상종료를 확인했다. FPS 측정이나 실제 보행 권한 검증으로 해석하지 않는다. 최초 `pixel-verified`는 장소마다 시계를 되돌려 두 번째 이후 프레임이 갱신되지 않는 QA 문제를 발견했으며, home 이외 화면 동일성 근거로 쓰지 않는다. 원본 기록을 보존하고 v2에서 clock-progress 검사를 추가했다.

`ab-verified`의 실제 elapsed clock 렌더12회는 최적화 후 PC47~60/39050~54fps 수준의 호스트 변동을 보여 주며, 개선률이나 일정60fps 근거로 쓰지 않는다. pixel 전환 시 manual RAF와 default RAF polling이 서로 기다리는 QA timeout은 원래 report-before-cleanup에 보존했다. 이후 poll100ms와 단조 증가 시계로 별도 검증을 완료했다. 화질을 낮추거나 normal 재질 캐시 초안을 추가 적용하지 않았다.

### 계정 첫 진입의 추가 최적화

계정 후보의 변경 전 독립 브라우저는 첫 Town state 검증에서 NETWORK/12초 deadline으로 실패했다(초기2회 및 `account-native-final` 재현). 진단의 동일 transport 호출·응답을 그대로 넘기는 wrapper에서는 한 번 통과했지만 이 결과만으로 해결로 보지 않았다. 최초 GPU 프레임의 CPU가 약7초로 기록됐고, 계정 데이터 전에 기본 임시 화면부터 그리는 경로를 발견했다. timeout 값을 늘리거나 계정 검사를 건너뛰지 않았다.

`day-scene.mjs`의 선택 옵션 `deferInitialRender`로 실제 첫 render(data) 전까지 RAF 예약·기본 화면 렌더를 하지 않고, `day-app.mjs`의 계정 iframe에만 이 옵션을 켰다. 로컬 독립 모드와 기본 API 동작은 그대로다. 렌더의 첫 데이터 요청 후 스케줄, 자산 로드, 재입장/해제, API 인증·권한·fence·지급·저장 코드는 유지한다. 자산 실패를 기다리느라 영구히 멈추는 로직을 추가하지 않았다.

최종 후보는 `.tmp/town-optimize-release-20261010/final-boot/policy`이며 public 변경4개(day-environment/materials/scene/app)다. 구문4/4·참조43/누락0·Town 공용79 바이트·서버9모듈·primary Git 상태가 보존됐다. `pixel-boot/report.json`은 공개와 같은 deferInitialRender=true 입력에서 최적화 전 v20과 PC/390 세 시점6쌍 PNG/행렬 동일·clock-progress 포함20검사, shader오류0·정상GPU종료를 확인한다. `account-boot-final/report.json`의 source-native 합성 계정23검사와 실제 재입장/로그아웃이 통과했다. 운영 사용자 계정이나 실제 휴대폰 결과가 아니다. 새 browser에서 walk 활성화까지 반복 검증하며, 이전3파일 후보의 Claude 검수와 최종4파일 후보 검수를 구분한다. 아직 공개 완료로 보고하지 않는다.
