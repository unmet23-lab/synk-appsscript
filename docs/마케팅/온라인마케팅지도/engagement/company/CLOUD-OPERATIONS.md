# 회사 워크스페이스와 고객 상담의 상시 서버 운영

<a id="light-release-production-20261022"></a>
## 회사 릴리스 가볍게 — 전환 판 · 2026-10-22 (이력 21)

유호님 「진행해. 회사 HA 서버 세 대에서 운영 읽기, 전환 판 교체와 재무장(배포 뒤 백업·복원·계정 연결을 8일 안 복원 증명으로 바꿔서), 화면 묶음 켜기와 한 줄 시험, 예비 노드 주간 복원 연습 설치까지 해 줘.」(10-21 20:0x, 이 판 세션) · 자리(19 바로 뒤 → 유호님이 작업실 글을 먼저 고르셔서 사슬 21)와 주간 연습 자격 (ㄴ)은 [결정 표](../../../../_ops/결정.md) 10-21. 설계 [deploy/static/README.md](deploy/static/README.md).

- **바뀐 것(5파일, 지운 파일 0):** 원천 `41ea503b9`(= `226f9bb2f`·`78dd8fbda`·`41ea503b9`) — 새 `static-set.mjs`·`server-static-set.test.mjs`, 회사 `server.mjs`(화면 묶음·`/api/static-set`), 메신저 `server.mjs`(`publicFile` — 운영 문구 「파일을 찾을 수 없습니다.」는 그대로, 3방향 충돌 한 줄을 그렇게 풂), `deploy/compose.yaml`(`/srv/synk/static`→`/static` 읽기 전용, 이 마운트만 `create_host_path: true`, `SYNK_COMPANY_STATIC_ROOT=/static`). 가드 사이드카는 `restart`만 덮어써서 고치지 않았다.
- **후보·도구:** 후보 `.tmp/light-release-21-candidate-20261021/` manifest `8211756493cb…`(부모 작업실 글 `7f87621f…`, 원문 1,113·이미지 목록 715·선택 150파일 2,160/2,160, 회사+메신저 전체 4,726/4,735 실패 0). 도구 `.tmp/light-release-21-release-20261021/`(작업실 글 생성기를 한 세대 + 가벼운 재무장 겹).
- **검수:** Fable 「그대로 운영 후보로」(P0·P1 0, P2 2·P3 6 → P2 둘·P3 셋 반영), 아르곤 반영 전 검수(서버 코드·PC·노드 도구·가벼운 재무장 겹) P0·P1 0 「그대로 반영」, P2 2 반영(바꿔 끼운 직후 공개 대조 재확인 `e7cf56266`, 재무장 사슬이 사후 확인 JSON의 passed·armed를 직접 확인).
- **원격(KST):** 화면 묶음 뿌리 `ensure` 22:48 → inert 23:14~23:20(5분 37초, 리눅스 선택 2,160/2,160·호환 2/2) → stage 23:22~23:26(3분 35초, 248층, 이미지 `sha256:79ef074f…`) → 배포 전 백업 23:26~23:39(약 13분, 550MB) · 재무장 리눅스 QA 42초 → **교체 00:22:09~00:28:36(6분 27초), 공개 끊김 00:23:33~00:27:35 약 4분 4초** → 운영 사후 확인 passed(기동 전 자료 정확 보존·세션·토큰 표 그대로·스키마 같음) → 공개 대조 225/225·메신저 12/12·통화 전후 passed → **가벼운 재무장 00:30:04~00:37:31(7분 27초 = 준비 7분 3초 + 설치·사후 확인 24초)** → `rearm/arm-postcheck-final-v1.json` passed·armed·`8211756493cb…`(요청 `7f6ea807…`, 계약 스키마 `synk-ha-arm-after-light-release-21/v1`·사슬 21).
- **가벼운 재무장:** 배포 뒤 새 백업·격리 복원·계정 연결 없이, 부모 판이 자기 재무장에서 쓴 격리 복원 증명(작업실 글 판, 백업 10-21 11:03:11Z)을 sha 대조해 다시 묶는다 — 증명 release가 배포 사슬에 있고 그 뒤 줄이 모두 `company-release-only`(스키마 변경 없음)·백업 8일 안. 계정은 옛 기준선과 비엄격 비교 + 안정 표 넷 엄격. **이 증명은 10-29 20:03 KST까지** — 그 전에 주간 연습 결과를 받는 길이 필요하다.
- **화면 묶음:** 첫 묶음 `init`(운영 릴리스 폴더에서 화면 파일 369개, 4초) → 첫 flip 1.85초 → `/api/static-set` `mode:'host'`·`a8270c62b954d8a7`, 묶음에서 낸 공개 대조 225/225. 화면 한 줄 바꿔 끼우기 시험(`public/client-material-usage.css` 주석 한 줄, push하지 않는 시험 커밋): plan 4.85초 + apply 3.29초(켜고 공개 확인 0.1초), 공개 끊김 0(40초 동안 2초마다 20번 모두 200), 이미지·백업·격리 복원·재무장 없음 → 첫 묶음으로 되돌림 2.37초(뒤 판은 이 판 릴리스 바이트 그대로). 처음 고른 `style.css`는 운영과 master 판이 달라 plan이 `MERGE_CONFLICT`로 멈췄다 — 운영에 없는 master 변경을 끌어오지 않는 설계대로다.
- **보존 정리(유호님 「진행해」, 작업실 글 armed 뒤 plan 다시):** 쓰기 노드 311개 14.32GB(옛 릴리스 77·이미지 태그 95·펼친 스냅숏 139, 지금 판+최근 4판·스냅숏 최근 3·압축 백업 남김), 예비 노드 134개 13.74GB(옛 릴리스 43·이미지 태그 50·옛 격리 복원 폴더 41, 작업실 글 판 복원 폴더 남김) — 예비 노드 `/opt/synk` 여유 약 9GB → 24.8GB. 이미지 태그 크기는 셈에 없다. 감시 VM은 지울 것 없음.
- **주간 연습(ㄴ):** 예비 노드 서비스 계정에 백업 버킷의 조건부 읽기(목록 + 복구 묶음 접두만)를 유호님이 GPT로 넣었고(바인딩 확인, IAM 쓰기는 GPT), 예비 노드 토큰으로 목록 200·영수증 200·다른 접두 403을 확인했다. VM 접근 범위는 이미 `cloud-platform`이라 멈추지 않았다. **실행기·타이머는 아직 설치 전**이다.
- **GPT 검수 범위(백엔드):** `226f9bb2f`·`78dd8fbda`·`41ea503b9`·`372f182cc`·`e7cf56266`과 이 커밋(회사 `static-set.mjs`·`server.mjs`, 메신저 `server.mjs`, `deploy/compose.yaml`, `deploy/static/`, `deploy/retention.py`), 그리고 `.tmp/light-release-21-release-20261021/successor-tools/`의 가벼운 재무장 겹(`adapt-21.py` 「가벼운 재무장」 절·`prepare-rearm.cjs`의 `LIGHT`·`make-release-root.py`·`adapt-parallel-fresh.py`). 운영 반영 완료.

<a id="workroom-copy-production-20261021"></a>
## 작업실 글(트렌드·레퍼런스·제작 데스크) · 2026-10-21 (이력 20)

유호님 「진행해. 회사 Workspace 운영 서버(HA 세 대)에 작업실 글(트렌드·레퍼런스·제작 데스크 — master eb6a87fae의 회사 16파일 글과 운영 후보에만 있는 시험 1개)을 이력 19 뒤 이력 20으로 회사 릴리스 절차대로 반영하고(…) 운영 확인까지 해줘. 교체 중 약 4분 끊겨도 괜찮아.」(10-21 08:3x)와, 교체 직전 순서를 여쭌 데 대한 「지금 교체」(19:2x). 이력 19 `e8200055…` 위에 `7f87621f1182e90662760bacc5ade0c26a68cfbc817db850ddd3e5acfcc44009`(이력 20, 원문 1,111)를 반영했다. 이미지 `sha256:ff5f874b5a3d5b6b69131f5c4dffd81cf465dd7362f2eda084097277eb6d160f`(247층). 기록 `.tmp/workroom-copy-20-release-20261021/`(README·`successor-tools/BUILD-NOTES.md`·`reviews/`), 후보 `.tmp/workroom-copy-20-candidate-20261021/`.

- **바뀐 것(17파일, 새 파일·지운 파일 0):** master `eb6a87fae`의 작업실 글 16파일 — 화면 `public/creative-research.js`·`workroom.js`·`content.js`·`studio-board.js`·`studio-review.js`, 그 화면에 뜨는 서버 글 `creative-research-sync`·`creative-research`·`trend-collectors`·`daily-trends-service`·`studio-service`·`studio-media`·`content-service`(.mjs), 「제작 기준」 자료 `workroom-guide.json`, 시험 셋 — 와 운영 후보에만 있는 시험 `creative-research-import.test.mjs`의 정규식 한 줄(`/Studio/` → `/스튜디오/`). 3방향 병합이 아니라 19판 후보 바이트 위에 커밋한 글 짝 01~17을 같은 적용기로 다시 넣었다 — 운영(v7 이후)에 없는 master 게시일 정리를 끌어오지 않게. 안 맞는 짝은 그 정리 코드의 문장 2개뿐이었다. v7이 넣은 「이번 주 제작 묶음」 글(짝 18 시안)은 넣지 않았다. 글만 바뀐다 — 코드 흐름·API·스키마·환경 변수·`Dockerfile`·정적 목록 그대로, 줄 수·줄끝 그대로.
- **시험·검수:** Windows 선택 149파일 2,156/2,156, 회사 전체 3,963개 중 실패 0(윈도 전용 건너뜀 9), 대기 노드 리눅스 2,156/2,156·호환 2/2, 재무장 로컬 Node 120·Python 35(윈도 건너뜀 1)·리눅스 Node 120·Python 35/35, 생성기 시험 28/28·운영 13/13·호환 2/2·옮김 15·13/13. Fable 두 번 「그대로 운영 후보로」 — 후보(P0·P1 없음, 문자열 밖이 바뀐 줄 8곳 모두 master에 있던 표시 문장 조립, 옛 문장을 비교·키로 쓰는 코드 없음, P2 1 기록 고침·P3 5 기록)·도구(P0~P2 없음, P3 5 기록). 아르곤 백엔드 검수 「그대로 반영」 지적 0 — **반영 뒤에 받았다**(새 규칙대로면 교체 전이었는데, 순서 확인으로 멈췄다가 「지금 교체」 뒤 그대로 넘어가며 빠뜨렸다; 반영 전에는 Fable이 같은 서버 diff를 봤다).
- **순서:** 15:57에 생긴 순서표 절(유호님 「19 끝나면 바로 뒤에 넣고…」 — 19 → 「회사 릴리스 가볍게」 전환 판 → 작업실 글)을 원격 시작 전에 다시 읽지 못하고 inert·stage·배포 전 백업까지 진행했다. 운영을 바꾸는 교체 전에 멈춰 여쭈었고, 「지금 교체」에 따라 이 판이 먼저 올랐다. 전환 판은 이 판 위 사슬 21로 다시 묶는다([현장노트](../../../../현장노트/배포_공개.md#원격을-시작하기-직전에-순서표를-다시-읽는다--인계-뒤-유호님-결정으로-다른-판이-끼어들-수-있다-2026-10-21-claude)).
- **도구:** 19판 `successor-tools`를 한 세대 밀었다(`adapt-20.py`, 원문 수가 같아 1111은 치환하지 않고 단언, v7 거울·Codex 원본 경로 리터럴은 치환에서 뺌). 미리 보기 중 19판 재무장 원본의 v7 거울 경로가 이름 짝에 휩쓸린 것을 찾아 19판 세션이 15:01에 고쳤다. 재무장 사슬 `rearm-chain.cjs`는 전환 판 세션이 알려 준 18판 Fable 뒤 고친 판(토큰 캐시 파일 대신 `SYNK_VERTEX_TOKEN_MIN_LEFT_MS`, run-step이 알려 준 결과 폴더만 읽기)을 썼다.
- **배포 전:** 반영 전 공개 파일 다섯은 19판 바이트(`preflight/public-five-before-*.json`). 배포 전 백업 generation `1792575162285708`(549,867,526B, 18:33 KST).
- **운영 교체:** 19:44:21~19:51:13 KST(411초), 두 노드 점검이 비는 창. 공개 접속은 19:45:47~19:50:14 약 4분 28초 끊겼다. 운영 검증 passed — 기동 전 자료 정확 보존, 세션·토큰 표 그대로, 스키마 그대로(바뀐 표 0). 메신저 공개 12/12, 공개 파일 전체 225/225, health 200 ready, 익명 SNS 401, 통화 켜짐 앞뒤 그대로. 바뀐 공개 파일 다섯이 후보 바이트와 같다.
- **새 백업·격리 복원·최종 HA:** 재무장 백업 준비 1회차는 이 PC 시계가 2.08초 늦어(시간 서비스 동기화 멈춤) 원격 스냅숏이 2,016ms 앞서 `FRESH_SNAPSHOT_REQUIRED`로 보류됐다(백업 요청 전, 쓰기 0) — 유호님 「지금 동기화」 뒤 +0.01초. 새 백업 generation `1792581306301389`(550,126,518B, 20:16 KST). 격리 복원 1회차는 예비 노드 여유 8.67GB가 필요량(백업×12+2GiB ≈ 8.75GB)에 모자라 시작 전에 보류(`STANDBY_REHEARSAL_SPACE_LOW`) — 이 판 inert·stage가 여유를 9.31GB에서 줄였다. 유호님 「오래된 것 둘 지우기」로 10-19 격리 복원 사본 둘(`infra-dr-eb181e45…`·`infra-dr-958d59cb…`)의 파생 폴더·내려받은 백업 사본 3.49GB만 지우고(RESULT·QA·영수증은 남김, 백업 원본은 클라우드에 있음 확인) 12.7GB에서 2회차 passed(1,179초 — 같은 시각 GPT가 같은 예비 노드에서 같은 백업으로 별도 격리 복원 검증을 돌려 겹침). 계정 연결 verified-local(865초). 정규 재무장 준비는 세 수집이 passed였지만 신선도로 보류 → 병렬 v3. v3 1회차 계약은 이어 붙인 감싸기 명령의 셸 계산 오류로 재무장 전에 묵어 보존(`rearm/held-v3-stale-20261021-2139/`, 쓰기 0), 2회차 460초 → 계약 0.2초 만에 stage·dispatch·status → **22:39:16 KST 최종 사후 확인 passed·armed**(epoch 7, 요청 `5b46c6e6-d272-4695-85ec-bbaad1d14436`, 계약 `contract-final-v3.json` `57c5b94b…`·스키마 `synk-ha-arm-after-workroom-copy-20/v1`·사슬 20, 정본 `validate` 다시 돌려 같음). 교체 뒤 HA가 다시 무장되기까지 약 2시간 48분.
- **운영 확인:** 22:4x health 200·ready. 저장되는 문장(일일 트렌드 수집 상태 `message`, 출처 설명 `message`, 참고 자료 `formatNotes`)은 다음 수집·저장 전까지 옛 합니다체로 남는다(비교하는 코드 없음 — Fable P3-4).
- **남음:** v7 「이번 주 제작 묶음」 글(짝 18 시안)은 합니다체 그대로(유호님이 고르시면 다음 판). 예비 노드 여유는 20판 복원 뒤 다시 약 1.9GB 줄었다 — 다음 판도 inert·stage 전에 여유(필요량 + inert·stage 몫)를 본다. 다음 판은 「회사 릴리스 가볍게」 전환 판(사슬 21)이 이 판 바이트·도구 위로 다시 묶는다.

<a id="teacher-homework-review-production-20261021"></a>
## 교사 「주차 과제 첨삭」 화면 · 2026-10-21 (이력 19)

유호님 「지금 공개해. synk.im/world에 「이번 주 과제」 칸을 지금 master 판으로 3방향 공개하고, 회사 워크스페이스 릴리스(교사 화면, 교체 중 4분 끊김)와 Platform 다음 판도 진행해 줘.」(10-20). 순서는 유호님이 정한 대로 Codex v7(이력 17)과 SNS·PULSE(이력 18) 다음이다. 이력 18 `413c8dfb…` 위에 `e820005534c151c07e7f3415eb74b3725894a38cda2d0e11fecad593e4c5aed2`(이력 19, 원문 1,111)를 반영했다. 이미지 `sha256:b844347444b74a4add522e88926b02ca58903dd91de11dfbc095d48bef6d47fa`(델타 옮기기). [후보 기록](../../../../../.tmp/teacher-homework-19-candidate-20261021/README.md)

- **바뀐 것(13파일):** 교사 화면 `experiences/teacher-world/`에 넷째 메뉴 「주차 과제 첨삭」(새 `homework-review.mjs`·`.css`, 바뀐 `app.mjs`·`index.html`·`signal.css`)과 읽기·쓰기 첨삭 화면 `course-writing-ui.mjs`(새로), 정답 없는 문제 자료 `topik4-homework.json`(공개 경로 `/teacher-world/topik4-homework.json`), 회사 `teaching-service.mjs`의 교사 과제 경로 둘과 그 시험, 다시 만든 `public/teaching-host.js`, `Dockerfile`·`.dockerignore` 허용 목록과 `server.mjs` 정적 목록(해당 줄만 끼움). 원천은 origin/master `a9d5410c2`의 바이트다. 운영 판에만 한 줄이 다르다 — 운영 synk-classroom에 읽기·쓰기 첨삭 경로(`/api/course`)가 아직 없어 그 메뉴를 누르면 오류 안내가 뜨므로 `app.mjs`에서 메뉴를 숨겼다(master는 그대로). 환경·스키마 그대로.
- **시험·검수:** Windows 선택 146파일 2,038/2,038, 회사 전체 3,963개 중 실패 2·건너뜀 9 — 실패 둘은 이번 판이 바꾸지 않은 `deploy-backup-watch.test.mjs`의 시간 대기 시험(시작 때 CPU 100%)이라 그 파일만 다시 돌려 통과. 대기 노드 리눅스 2,038/2,038·호환 2/2, 재무장 로컬·리눅스 Node 120·Python 35. Fable 두 번 「그대로 운영 후보로」 — 묶음·후보(P2 하나는 근거 보강, P3 셋은 확인), 도구 차이(P2: 미리 보기 상수로도 운영 준비가 돌 수 있던 것 → 거부 장치를 넣어 반영).
- **도구:** 18판 `successor-tools`를 한 세대 밀었다(`adapt-19.py`). 판마다 부모 이름을 미는 일괄 치환이 18판이 넣은 v7 거울·Codex 원본 경로 리터럴까지 바꿔 배포 뒤 재무장 준비가 멈출 판이었다(다른 세션이 짚어 줌) — 두 리터럴은 치환에서 빼고 한 번씩인지 단언한 뒤 다시 렌더·검증했다. 교체 뒤 재무장 준비는 공용 작업본 `tools/모델정책.js`가 바뀌어 `INPUT_PIN_CHANGED`로 두 번 멈췄다(① 15:04 QA 4분 뒤 다른 세션의 내용 고침 ② 17:19 내용은 같고 줄끝만 LF→CRLF, 둘 다 쓰기 0) — 그때마다 재무장 리눅스 QA를 다시 돌려 그 판으로 고정했다(통과). [현장 노트](../../../../현장노트/배포_공개.md)
- **배포 전:** 배포 전 백업 generation `1792561603285732`(549,485,863B, 14:35 KST).
- **운영 교체:** 15:29:05~15:35:31 KST(386초), 두 노드 점검이 비는 창. 공개 접속은 15:30:32~15:34:50에 끊겼다(2초 간격 확인 39번 연속 실패, 앞뒤 정상 15:30:30·15:34:57 — 약 4분 20초). 운영 검증 passed — 기동 전 자료 정확 보존, 세션·토큰 표 그대로, 스키마 그대로(바뀐 표 0). 메신저 공개 12/12, health 200 ready, 익명 SNS 401, 통화 켜짐 그대로. 공개 파일 전체 대조는 두 번 모두 225 중 224였다 — 42MB 뮤직비디오 하나가 이 PC 핫스팟 회선에서 30초 읽기 제한에 걸렸고, 따로 받아 후보와 해시가 같았다(17:17 다시 받으니 5초·같음).
- **교사 화면 확인:** 공개 경로 8개(교사 화면 6·문제 자료·`teaching-host.js`)가 후보 바이트 그대로이고, 정답 파일·`course-writing.mjs`·`topik4-course.json`은 404. 실제 `workspace.synk.im` 출처 문서에 합성 교사 호스트(녹화한 합성 응답, 쓰기는 모두 거절)를 넣어 같은 출처 iframe `/teacher-world/?account=1`에서 「04 주차 과제 첨삭」이 열리고, 합성 반 3주 차 학생 행 7개와 답안 편집기가 나오며, 읽기·쓰기 첨삭 메뉴는 숨는 것을 두 번(15:46·17:22) 봤다. 요청은 읽기 셋뿐이었고 실제 계정·학생 정보는 쓰지 않았다([결과](../../../../../.tmp/teacher-homework-19-release-20261021/checks/teacher-synthetic-20261021/result.json)).
- **새 백업·격리 복원·최종 HA:** 새 백업 generation `1792566078700107`(549,796,062B, 15:50 KST). 격리 복원 1회차는 예비 노드 여유가 모자라 시작 전에 보류됐다(`STANDBY_REHEARSAL_SPACE_LOW`, 쓰기 0). 이력 18의 끝난 격리 복원 폴더에서 파생 폴더·내려받은 백업 사본(1.86GB)을 유호님 허락으로 지우고(RESULT·QA·영수증은 남김) 2회차를 돌렸다. 2회차는 예비 노드에서 16:21:32 KST에 passed였지만 이 PC의 SSH 호출이 결과 없이 16:29:56에 끝나 `REMOTE_RESULT_UNCONFIRMED`로 남았다 — 예비 노드를 읽기만 해 `RESULT.json`(passed, 남은 프로세스·시험 컨테이너 0)을 받아 어댑터 원본 검증으로 묶었다(원격 호출 0, 복원 다시 안 함). → 계정 연결(`binding-v1.json` verified-local) → 설치 준비(위 줄끝 보류 뒤 다시) → 정규 재무장(요청 `fe3738da-4a5b-4574-8006-c767e9ba4fbb`, 17:32:49 설치). 첫 사후 확인(17:33:06)은 `ONE_LIVE_CONTROLLER_CYCLE_REQUIRED`로 보류됐다 — 관측 시간(17.6초)은 충분했지만 서버가 잰 관측 시간이 이 PC 시계로 잰 경과 + 2초를 7ms 넘었다(이 PC 시계가 2.04초 늦음, Windows 시간 동기화가 멈춰 있음). 같은 계약으로 읽기 전용 점검을 새 파일로 다시 해 **17:34:09 KST 사후 확인 passed·armed:true**(epoch 7, 같은 컨트롤러 PID 80.9초 관측·재시작 0, 공개 HTTPS 200·TLS, 복제 정상, 클라우드 쓰기·서비스 조작 0 — [사후 확인](../../../../../.tmp/teacher-homework-19-release-20261021/rearm/arm-postcheck-final-v2.json) `8eb39394…`).
- **예비 노드 정리(17:47 KST):** 다음 판 격리 복원 조건(여유 > 백업 크기×12 + 2GiB, 약 8.75GB)에 여유 7.45GB가 모자라, 유호님 「예비 노드의 이력 19 복원 폴더 1.86GB 지워도 돼. 다음 판 격리 복원 전에 정리해 줘.」에 따라 파생 폴더 넷과 내려받은 백업 사본, 그 다섯 개(1.87GB)만 지웠다(RESULT·QA·영수증은 남김). 미리 보기에서 복원 passed·시험 컨테이너 정리·쓰는 프로세스 0·클라우드 원본 백업 크기·MD5 일치를 확인했고, 실행은 같은 대상일 때만 지웠다(서비스 조작·클라우드 쓰기 0, 노드 일지 `/opt/synk/ha-qa/claude-copy-cleanup-standby-1792572430.json`). 여유 9.31GB, `RESULT.json`(passed)·QA·영수증은 그대로.
- **남음:** 교사 화면도 정답 판이 자료와 다르면 예시답이 조용히 빠지는 것(다음 교사 판), 반 계획 넣기와 실제 교사 계정으로 한 번 쓰기([설계 6절](../../../../온라인반_TOPIK4급/과제_내기_설계.md#deploy) 6·9번), 운영에 `/api/course`가 오르면 읽기·쓰기 첨삭 메뉴 다시 켜기. 교체 전에 열어 둔 교사 화면은 새로고침해야 새 메뉴가 보인다. 다음 판은 유호님이 19 바로 뒤에 넣은 「회사 릴리스 가볍게」 전환 판이고, 작업실 글·PULSE 글·교사 「내 수업」 글이 그 뒤를 잇는다([순서 메모](../../../../../.tmp/company-ha-release-order-20261020.md)).

<a id="sns-pulse-followup-production-20261021"></a>
## SNS 보관 기한 정리 + PULSE PC 앱 창 안내 · 2026-10-21 (이력 18)

유호님 「진행해. … PULSE PC 앱 창 설치·기기 알림 안내 고침(10파일)과 SNS 합본의 보관 기한 정리(회사 server.mjs 두 군데·시험 1개)를 Codex v7 위 이력 18(모두 12파일)로 회사 릴리스 절차대로 반영하고 … 운영 확인(반영 전 기준값 읽기 포함)까지 해줘.」(10-21). 부모 GPT(Codex) 「사업 자동화」 v7 `734b42ae…`(이력 17) 위에 `413c8dfbf5c217e7e873cd53ecd1822551914f352b0ebd2ecce71a90f46037d1`(이력 18)을 반영했다. 이미지 `sha256:f48376ac7450d9a192a78c4cc75c0e4c01cc2ac3fa69adda9c7bb7bc7e1369c3`(245층). [릴리스 기록](../../../../../.tmp/sns-pulse-followup-release-20261020/README.md)

- **바뀐 것(12파일):** PULSE 웹 앱 PC 앱 창 안내 10파일(공용 master `ca37b82aa`·`76c872541`·`c09eeb25a` 바이트 — PC 앱 창에서는 머리 막대 「앱 설치 · 알림」·알림함 「기기 알림 켜기」 대신 PC 앱 문구, 「이 기기 기억하기」는 「이 PC 앱」)과 v7이 뺀 SNS 보관 기한 정리(회사 `server.mjs` 두 덩이 — 한 시간마다 만료 정리와 14일 지난 끝난 수집 기록 지우기를 운영(배경 작업 꺼짐·작업실 예약 켜짐)에서도 돌림, `sns-collection-recovery.test.mjs`). SNS 합본의 나머지 22파일은 v7에 같은 바이트로 이미 있었다. 환경·스키마 그대로.
- **시험·검수:** 회사 전체 3,963개 실패 0(윈도 전용 건너뜀 9), Windows 선택 144파일 2,022/2,022, 대기 노드 리눅스 2,022/2,022·호환 2/2, 재무장 로컬 Node 120·Python 35·리눅스 Node 120·Python 35/35. 아르곤 네 묶음(거울·배포 렌더·재무장 생성기·코드 변경) 「그대로 진행」, Fable은 주간 한도로 사후 검수로 남김.
- **도구:** 운영에 오르지 않은 우리 17판 생성기를 v7 위로 한 세대 밀었다 — 배포 도구는 16판 템플릿, 부모 증거는 Codex 워크트리의 v7 폴더를 공용 작업본으로 옮긴 거울(`.tmp/business-automation-release-20261020/`). v7 증거 JSON이 Codex 원본 절대 경로를 적어 두어 거울 승인 모듈과 재무장 준비 도구가 「저장소 밖」으로 거절했다 — 두 곳 모두 그 두 폴더 경로만 바이트가 같은 거울 사본으로 바꿔 읽게 했다(sha 확인 그대로, 유호님 허락, [현장노트](../../../../현장노트/배포_공개.md)).
- **배포 전:** 반영 전 운영 읽기에서 지울 대상 0(수집 기록 3,834건 중 14일 지난 것 0, 게시물·스냅숏·화제 관측 기한 지난 것 0). 주 노드 10-20 정기 백업이 원인 모를 회사 스택 재시작(18:52 UTC, HA·회복 점검 아님)에 끊겨 failed로 남아 배포 전 백업을 막았다 — 유호님 허락으로 그 실행일 때만 `reset-failed`. 배포 전 백업 generation `1792546431765303`(549,170,461B).
- **운영 교체:** 10:43:41~10:49:51 KST(370초), 두 노드 점검이 비는 창. 공개 접속은 약 3분 34초 끊겼다. 운영 검증 passed — 기동 전 자료 정확 보존, 세션·토큰 표 그대로, 스키마 그대로. 공개 파일 225/225(교체 직후 1차는 큰 PULSE 자산 4개 읽기 실패 — 30초 뒤 2차 모두 일치), 통화 켜짐 그대로, 공개 `pulse-app/install.mjs`에 `desktopApp`.
- **새 백업·격리 복원·최종 HA:** 1회차는 격리 복원 시험이 통과했지만 작업기의 마지막 확인에서 접근 토큰(캐시가 내준 만료 임박 토큰)이 만료돼 보류 → 같은 백업으로 다시 못 돌리고 예비 노드 공간이 모자라 1회차 복원 폴더(일회용 사본 1.86GB)를 유호님 허락으로 지우고 2회차. 2회차 새 백업 generation `1792551794836824`(549,420,156B) → 격리 복원 passed → 계정 연결 → 정규 재무장 → 14:01:29 KST 사후 확인 passed·armed:true(요청 `2c5155a3-d047-42e3-895d-dde4317ce595`, 사슬 18, epoch 7, 공개 HTTPS 200).
- **운영 확인(교체 1시간 뒤):** 채널 35 실패 0·수집 계속, 지울 대상이 아직 없어 지워진 것 0, 게시 완료 6·예약 1·밀림 0, health ready.
- **남음:** 보관 기한 정리가 처음 지우는 때(가장 오래된 수집 기록이 14일 되는 날)의 수 확인, Fable 사후 검수, 예비 노드의 옛 격리 복원 폴더(이력마다 1~2GB, 여유 8GB 안팎) 정리 여부(다음 판 재무장 전).

<a id="call-invite-push-wake-production-20261020"></a>
## 통화 초대 기기 알림 즉시 깨우기 · 2026-10-20

유호님 「15판 최종 HA 사후 확인이 통과하면 16판으로 운영에 올려줘.」(10-20). 부모 `a77938e0…`(운영 통화 켜기, 배포 이력 15) 위에 `1cde5b0c2f585c8622560fca7f952fbdb87e78a63a8bf9a65831ac9dcb74bf82`(이력 16)를 반영했다. 이미지 `sha256:cf6f33878a357d08a550b4a81916fc235db687d6aed61c98c4e603ee565d807f`(243층), 배포 `fa6568b6f7021e1d385366f2d4b6ed5e`. [릴리스 기록](../../../../../.tmp/company-push-wake-release-20261020/README.md)

- **바뀐 것:** master `4c7385a82`의 6파일. 통화 초대가 든 웹 푸시는 `Urgency: high`, 초대만 든 묶음은 `Topic: synk-company-calls`, 메신저 초대 경로가 새 pending 초대에만 회사 integration의 `wakeDeviceNotifications`를 불러 기기 알림이 30초 주기를 기다리지 않고 바로 한 번 나간다(도는 중이면 끝난 뒤 한 번 더). 다섯 파일은 master blob 그대로, 회사 `server.mjs`는 운영 바이트 + 같은 2줄(`2424aa20…`, `git merge-file` 충돌 없음 — master에는 PULSE 자동 안내 등 운영 줄이 아직 없다). 선택 시험에 회사 `device-notifications-server.test.mjs`가 부모 규칙대로 더해져 129파일이 됐다.
- **환경·스키마 그대로:** 15판 배포 도구의 통화 환경 고침(환경 추가 기술서·「이전 + 승인 통화 표 17개」·배포 전 환경 파일 확인)을 15판 `voice-edits.cjs`의 고침 목록을 거꾸로 쓰는 모듈로 정확히 되돌렸다(배포 JS 7·재무장 승인 2, 왕복 시험). 계획 환경 추가는 `{}`, 배포 뒤 확인은 「배포 직전 스냅숏 그대로」. HA worker 두 파일은 15판 바이트 그대로라 15판 worker QA 검증(162)을 그대로 실었다(worker QA·환경 파일 단계 없음). LiveKit 키는 읽지 않았다.
- **시험:** Windows 선택 129파일 1,832/1,832, 회사+메신저 전체 4,585개 실패 0(윈도 전용 건너뜀 9), 대기 노드 리눅스 1,832/1,832·호환 2/2(새 회사 기기 알림 시험 포함), 재무장 로컬 Node 120·Python 35(윈도 건너뜀 1)·리눅스 Node 120·Python 35·배포 126. 생성기 시험 운영 13/13·호환 2/2·옮김 15·재무장 27/27. 검수는 원문 6파일 Fable 「그대로 운영 후보로」, HA 도구 되돌리기·생성기 Fable 「그대로 운영 후보로」(P0~P3 없음).
- **stage:** 1차는 예비 노드 내보내기·새 층 묶음까지 하고 주 노드 재조립에서 멈췄다 — 주 노드 회사 백업 점검 타이머가 지금 :01:51·:31:51 UTC에 돌아 관문과 겹쳤다. stage 전체를 다시 돌리지 않고 남은 세 단계만 이어 부모 층 242개 재사용·새 층 329,296B·두 노드 원문 1,081개 일치로 끝냈다([현장노트](../../../../현장노트/배포_공개.md)).
- **운영 교체:** 21:12:46~21:19:34 KST(408초), 두 노드 점검이 비는 창. 공개 접속은 21:14:22~21:18:38 약 4분 16초 끊겼다(2초 간격 207회 중 실패 39회, 그 밖은 모두 200). 운영 검증 passed — 기동 전 자료 정확 보존, 배포 뒤 스키마 그대로(15판 통화 표가 든 스냅숏 기준), 로그인 세션 표 1→1행 해시 다름(정상 활동으로 바뀔 수 있는 표). 배포 전 백업 generation `1792497494200356`(547,768,128B).
- **공개·통화 켜짐:** 메신저 12/12·공개 파일 전체 223/223 바이트 일치, health 200/ready, 익명 SNS 401. 배포 앞뒤 모두 CSP connect-src에 LiveKit, 권한 정책에 `microphone=(self)`(키를 읽지 않는 공개 헤더 확인). 실제 통화·초대는 걸지 않았다.
- **새 백업·격리 복원·최종 HA:** 새 백업 generation `1792500072260416`(`synk-server-recovery-2026-10-20T12-29-35Z-212139.tar.gz`, 547,972,010B). 이 Claude 세션이 재시작으로 멈춘 사이 16판 위 회사 자동화 배포를 기다리던 Codex 세션이 같은 도구로 격리 복원(passed, network none)·계정 연결·정규 재무장을 이어받았다. 22:43:45 KST 사후 확인 passed — armed:true, epoch 7, 컨트롤러 17.5초 관찰, 공개 HTTPS 200·TLS, 동기 복제 정상, 클라우드 쓰기 0(요청 `06448cf8…`, 계약 `contract-final-v1.json`).
- **남음:** 잠든 안드로이드 폰·두 기기에서 실제 도착 시간 재기, 멀티 Topic·서비스 워커 renotify 후속(master에 있으나 16판에 넣지 않음, [QA](../../../../../tools/company-messenger/QA.md#call-invite-push-wake-20261020)), 멘션·DM 같은 메신저 알림은 여전히 30초 주기.

<a id="voice-enable-production-20261020"></a>
## 운영 통화 켜기 · 2026-10-20

유호님 「운영 서버에 LiveKit 키를 넣고 통화를 켜는 회사 릴리스를 진행해줘. 백업·격리 복원·HA까지.」(10-20). 부모 `526eb41d…`(PULSE 하린 메인 광고 칸, 배포 이력 14) 위에 `a77938e0754e7a6ae545b182291c7fe6781061f216bfb6215207af033dd4f670`(이력 15)를 반영하고 운영 메신저의 직원 통화·화면 공유를 켰다. 이미지 `sha256:6a8b9f71c22ce8b10f3b13a9d350141b07bc62103b710f282ed7ca56da451fd1`, 배포 `3d238ef5c3a2fd8ae2e558945b985fe3`, 원문 1,081개·이미지 목록 667개·변경 2개(실행 파일 1)·보존 1,079개·삭제 0. 최종 HA는 20:17:50 KST에 armed가 됐다. [릴리스 기록](../../../../../.tmp/company-voice-on-release-20261020/README.md)

- **바뀐 것:** 웹 푸시 만료 고침(`tools/company-messenger/web-push-service.mjs`와 시험 하나, master `24a1558bb`의 바이트 그대로). 통화 초대처럼 짧게 사는 알림은 그 만료 시각까지만 큐·전송에 두고, 한 번에 보내는 푸시의 TTL은 가장 오래 사는 알림을 따른다. 두 앱 노드의 `/etc/synk/company.env` 끝에 네 줄(`SYNK_WORKSPACE_VOICE_ENABLED=1`, LiveKit 주소·키 ID·비밀)을 더했다.
- **환경 값은 기술서로만:** 배포 계약·캡슐·저널·영수증·이 기록 어디에도 값이 없다. 계약에는 노드 쪽 파일 경로·SHA-256(앞 12자 `79d77c2ab591`)·217B·키 이름 넷만 싣고, `environment-stage.cjs stage`가 저장소 밖 키 파일에서 바이트를 만들어 SSH 표준입력으로만 두 노드의 root 전용 파일(0600)에 뒀다. 배포 거래가 그 파일의 권한·해시·길이·줄 꼴을 확인한 뒤 붙였다(키가 이미 있으면 멈추고 덮어쓰지 않는다). 최종 사후 확인 뒤, 두 노드 company.env에 네 키가 있는 것을 보고 임시 파일을 지웠다. [두기](../../../../../.tmp/company-voice-on-release-20261020/deployment/environment-stage-1792490074072.json) · [정리](../../../../../.tmp/company-voice-on-release-20261020/deployment/environment-cleanup-1792495115458.json)
- **승인 스키마:** 통화를 켜면 메신저가 첫 시작 때 통화 표·색인 17개를 만든다. 계약의 `schemaChangesAllowed:false`와 후보의 `schemaChanges:false`는 그대로 두고, 배포 뒤 확인과 재무장 승인이 「이전 스키마 + 승인 목록 17개 정확히」를 요구한다. 배포 전에 운영 이미지(Node 24.21·SQLite 3.53.4)로 대기 노드에서 네트워크 없이 다시 계산해, 로컬 목록과 바이트까지 같은 것을 확인했다. [이미지 대조](../../../../../.tmp/company-voice-on-release-20261020/voice-env/image-schema-check-1792489299392.json)
- **시험:** Windows 선택 128파일 1,820/1,820, 회사+메신저 전체 4,580개 실패 0(윈도 전용 건너뜀 9), 대기 노드 리눅스 1,820/1,820·호환 2/2·이미지 667개 해시 일치, 바뀐 HA worker QA 162/162(격리 단위 root, 파일 권한 시험 포함), 재무장 로컬 Node 120·Python 35(윈도 건너뜀 1)·리눅스 Node 120·Python 35(건너뜀 0). 검수는 웹 푸시 Fable 1차 「고친 뒤」 → 재확인 「그대로 운영 후보로」, HA 도구 Fable 「고친 뒤 진행」(P2 둘·P3 다섯 반영).
- **운영 교체:** 19:25:10~19:31:59 KST(409초), 두 노드 백업 점검이 비는 창. 공개 접속은 19:27:12~19:31:00 약 3분 48초 끊겼다(2초 간격 448회 가운데 실패 35회, 그 밖은 모두 200). 운영 검증 passed — 기동 전 자료 정확 보존, 메신저 DB는 이전 스키마 + 승인 17개 정확히, 다른 DB 스키마는 그대로였다. 로그인 세션 표는 1→1행에 해시가 달라졌다(로그인·만료 같은 정상 활동으로 바뀔 수 있어, 행마다 같다는 증명은 아니다). 배포 전 백업 세대 `1792491159095795`(547,648,067B). [운영 검증](../../../../../.tmp/company-voice-on-release-20261020/deployment/runtime-live-postcheck-1792492315574.json)
- **공개·통화 켜짐:** 메신저 12/12·공개 파일 전체 223/223 바이트 일치, health 200/ready, 익명 SNS 401. `https://workspace.synk.im/messenger/` 응답의 CSP connect-src에 `wss://*.livekit.cloud`·`https://*.livekit.cloud`, 권한 정책에 `microphone=(self)`·`display-capture=(self)`가 나온다(배포 전에는 `'self'`만, `microphone=()`). 운영 LiveKit 읽기 전용 방 목록 200(방 0). 실제 통화(방 만들기·초대)는 걸지 않았다. [공개 대조](../../../../../.tmp/company-voice-on-release-20261020/deployment/public-verification-1792492354946.json) · [통화 켜짐](../../../../../.tmp/company-voice-on-release-20261020/voice-env/voice-public-1792495148442.json)
- **새 백업·격리 복원·최종 HA:** 새 백업 generation `1792493507397218`(`synk-server-recovery-2026-10-20T10-40-37Z-98397.tar.gz`, MD5 확인). network none 격리 복원 passed — 원문 1,081개, 보호 계정 9표·세션/토큰 33행 보존, 원래 키 일치, 공개 포트 0, 대기 노드 운영 컨테이너 그대로. 계정 기준을 연결한 뒤 정규 재무장 준비가 193초에 보류 없이 끝났고, 20:17:50 KST 사후 확인 passed — armed:true, A 단일 writer·epoch 7, 복제 정상, 공개 HTTPS 200/ready, controller PID 359948 17.6초 관찰·재시작 0. 배포 이력 15건을 잇는 현재 릴리스 호환 승인이며 이 판의 실제 장애 전환 시험은 아니다. [계약](../../../../../.tmp/company-voice-on-release-20261020/rearm/contract-final-v1.json) · [사후 확인](../../../../../.tmp/company-voice-on-release-20261020/rearm/arm-postcheck-final-v1.json) · [격리 복원](../../../../../.tmp/company-voice-on-release-20261020/rearm/dr/restore-v1.json)
- **남음:** 물리 두 기기·다른 망 통화 시험, 공급자 청구 대조, 통화 초대 기기 알림 즉시 깨우기(다음 판 후보, [QA](../../../../../tools/company-messenger/QA.md#call-invite-push-wake-20261020)). 다음 판 계약의 환경 추가는 `{}`로 되돌려야 한다(이미 키가 있으면 거래가 멈춘다).

<a id="next-company-release-sns-combined-20261020"></a>
## 다음 회사 릴리스 후보 — SNS 합본: 집계·직접 게시·성과 고침 + 게시 성과 지표 넓히기 (2026-10-20 Claude 준비 · 운영 전)

> **운영 반영(10-20~21):** 22파일은 GPT(Codex) 「사업 자동화」 v7(이력 17)에 같은 바이트로, 나머지인 보관 기한 정리는 이력 18로 반영했다 — [운영 인수](#sns-pulse-followup-production-20261021).

유호님 「workspace의 집계하는거랑 workspace에서 직접 업로드 할수있는 프로그램 지금 정상적으로 작동해? … 더 좋은 설계안이 있으면 업그레이드」(10-20)의 고침과, 같은 날 「게시 성과 2단계」 세션의 지표 넓히기가 같은 파일을 고쳐 묶음 하나로 함께 반영한다. 반영은 유호님 「올려」 뒤 회사 HA 릴리스로 한다(교체 중 약 4분 접속 끊김).

- **묶음:** [`.tmp/sns-health-upgrade-20261020/release/`](../../../../../.tmp/sns-health-upgrade-20261020/release/README.md) — base는 운영 부모 `b60db5da…`의 후보 원문, 26파일(코드 13·시험 13, 새 시험 파일 5), 운영 base에 충돌 0. 공용 master `cba4496e1`·`620992ad4`(지표 넓히기와 그 Fable 고침)·`94da874ad`·`0b414f4b8`(집계·직접 게시·성과 고침과 창 대기 30일 상한). 넷 다 origin에는 아직 없다 — 로컬에만 있는 앞 커밋과 겹쳐 올리기가 멈췄고, master 맞추기 때 함께 올린다.
- **바뀌는 것:** 집계 멈춤·오분류·쌓임, 직접 게시 「전송 중」 갇힘, 새 공개 게시물 24·72시간 성과 자동 등록(`SYNK_COMPANY_PERFORMANCE_AUTO_TRACK`, 없으면 켬·`0`이면 끔·다른 값이면 서버가 열기 전에 멈춤), 유튜브 Analytics 창 지표·릴스 3초 유지·평균 시청·페북 조회. 저장 스키마·OAuth 권한은 그대로다.
- **반영 직후:** 수집 예약이 한 시간마다 보관 기한 정리를 돈다 — 14일 지난 수집 기록(runs)·기한 지난 YouTube 자료·8일 지난 화제 관측이 지워진다. 운영 설정에서 그동안 정리가 돌지 않아 쌓여 있었고, 반영 전 백업에 남는다.
- **검증:** 운영 부모 사본에 얹은 회사 전체 298파일 3,874개 중 실패 0·건너뜀 9(원래부터). Fable 검수는 사용 한도로 멈춰 18:50 뒤 이어 받는다.
- **운영 완료 조건:** 묶음 README의 「운영 완료 조건」 — 34채널 수집 상태·자동 등록 첫 기록·직접 게시 진행 작업, 지표 넓히기 쪽의 유튜브 창·인스타 평균 시청 단위·페북 조회.

<a id="pulse-harin-ad-production-20261020"></a>
## PULSE 하린 메인 광고 칸 운영 인수 · 2026-10-20 (Claude)

유호님 「마지막판이 조금 더 좋아보이네」(하린 아이스커피 광고 v5 최종본 선택) → 「웅 일단 게시해줘.」(10-20). 고객 화면 F02 하린 「메인 광고」 칸에 20초 광고를 「표정 참고용」으로 올렸다(유호님 10-18 「모델 표정 참고용이라는 느낌을 같이 게시해주면 좋을것같아」). 직전 Claude 릴리스(PULSE 고객 문의 자동 안내)의 `successor-tools`를 한 단계 밀었다(배포 이력 13→14). 부모 `b60db5da87489eac1e756a051ff6adafde81e0bb09050a0f1e788437f78ed0e8` 위 새 판 `526eb41d4a9eb086fe26b6ec7f416b06fbd553eec198ea90bae6273e8e4d6b2e`는 원문 1,081개·이미지 목록 666개다. 고친 5·새 2(광고 영상·포스터)만 바꾸고 부모의 나머지 1,074개를 보존했다. 삭제 0. 15:03 KST 운영 교체, 18:31:11 KST 최종 사후 확인까지 마쳤다. [릴리스 기록](../../../../../.tmp/pulse-harin-ad-release-20261020/README.md)

- **바뀐 것:** `casting-catalog.mjs`의 F02 광고 칸 — 「아이스커피 광고 · 20초」, 배지 「표정 참고용」, 설명 「하린의 표정과 분위기를 보여 드리는 참고용 시안입니다. 실제 제작 광고의 화질·연출과는 다릅니다.」, 포스터(16.4초 정면 미소 컷). `casting-view.mjs`는 배지·포스터 속성(작품 칸과 같은 경로 규칙), `server.mjs`는 공개 목록에 영상·포스터 두 줄. 영상 `F02-ad-iced-coffee-20s-v1.mp4` 1080×1920·24fps·20.54초·12,465,839B(`b6b47293…`), `preload="none"`이라 포스터(63KB)만 먼저 받는다. 런웨이 칸 5초 움직임 샘플과 옛 5초 광고 샘플 파일은 그대로 둔다(옛 광고 샘플은 칸에서만 빠짐).
- **Windows·Linux·이미지:** [passed] Windows 격리 사본 128파일 1,818/1,818, 회사 전체 293파일 3,816개 중 3,802 통과·실패 5·건너뜀 9 — 실패 5는 CPU 100%(다른 세션의 학습·렌더) 동안 Git Bash 10초 제한에 걸린 `deploy-backup-watch`·`deploy-operations`(부모와 같은 바이트, 선택 시험 밖)뿐이고 그 두 파일만 다시 돌려 실패 0. Linux 1,818/1,818·호환성 2/2(공개 응답 109·해시 확인 124), 이미지 목록 666개 해시 일치, 이미지 `sha256:4776c4b8c53ef659db494dbae2ce4c8a76d42e541c2f5f3a9d8687944071ec7d`(부모 240층 + 새 1층). Fable 검수 「그대로 운영 후보로」(고친 뒤 확인 포함). [근거1](../../../../../.tmp/pulse-harin-ad-release-20261020/deployment/reviewed-candidate-receipt.json) [근거2](../../../../../.tmp/pulse-harin-ad-candidate-20261020/qa/result.json) [근거3](../../../../../.tmp/pulse-harin-ad-candidate-20261020/reviewed-input.json)
- **stage — 전체 이미지 중계:** 새 층에 광고 영상이 들어 델타 옮기기 한도(새 층 2MB·묶음 3MB)를 넘어 첫 stage가 멈췄다(쓰기 0). 10-18 M03 뮤직비디오 판까지 쓰던 전체 이미지 중계(`stage-relay.cjs`)로 240MB를 예비 → 이 PC → 주 노드로 옮기고(121초) 적재(정확한 이미지 ID)·두 노드 원문 1,081개 해시 일치까지 마쳤다. [현장 노트](../../../../현장노트/배포_공개.md)
- **운영·공개 응답·자료 보존:** [passed] 14:57~15:03 KST 교체 검증, 기동 전 논리 자료 정확 보존·스키마 불변, 공개 메신저 12/12·health 200/ready·익명 SNS 401. identity 세션은 2→2행인 채 해시가 달라 각 행의 동일성은 주장하지 않는다. 공개 파일 전체 223/223 바이트 일치. 실제 고객 화면(체험판)에서 하린 첫 카드가 「표정 참고용」·「아이스커피 광고 · 20초」·설명·포스터로 나오고, 영상 20.54초·1080×1920 메타데이터·Range 206·음소거 재생 진행을 확인했다. **교체 중 공개 접속이 14:59:03~15:02:39 KST 약 3분 36초 끊겼다**(2초 간격 실측 18분 445회 중 실패는 그 한 구간 33회뿐, 느린 응답 0). [근거1](../../../../../.tmp/pulse-harin-ad-release-20261020/deployment/runtime-live-postcheck-1792476217299.json) [근거2](../../../../../.tmp/pulse-harin-ad-release-20261020/deployment/public-verification-1792476230297.json) [근거3](../../../../../.tmp/pulse-harin-ad-release-20261020/preflight/health-deploy.txt)
- **배포 전 백업:** 14:27:25 KST 요청 → 14:39 완료(세대 `1792474724068664`, 522,321,173B). 부모 b60db5da의 첫 요청이라 새로 요청됐다.
- **새 백업·격리 복원·최종 HA:** [passed] 1회차(백업 generation `1792477790768469`, 15:30 업로드)는 격리 복원이 원격에서 passed였지만 이 PC의 SSH 연결이 29초 먼저 끊겨 `REMOTE_RESULT_UNCONFIRMED`로 남았고(원격 `RESULT.json`을 읽어 어댑터 원본 검증으로 묶음), 재무장 준비가 공용 작업본 변경·CPU 부족으로 밀리는 사이 운영의 로그인 세션 1·토큰 1이 만료돼 「최종 백업 뒤 계정 키 삭제 없음」 검사에 걸렸다(쓰기 0, 기록은 `rearm/held-cycle1-20261020-1735/`에 보존). 2회차를 짧게 다시 돌렸다 — 새 백업 generation `1792486783384445`·547,604,246B 업로드·MD5 확인(18:02), 예비 노드 격리 복원 568초 passed(원문 1,081개·원래 키·연결 정보·Drive 등록 보존, 보호 계정 표 9개 보존, 고객 미인증 401), 새 계정 기준 연결 680초, 정규 재무장 준비 214초 → 설치(`synk-ha-arm-compat-c3b8612c-5615-4c18-9b28-2564bbda77e0.service`) → installed-armed → 사후 확인. **18:31:11 KST armed:true**, A(`6695198820229895670`) 단일 writer·epoch 7, 복제 정상, 공개 HTTPS 200/ready/TLS, controller PID 356345·Invocation 18.7초 관찰·재시작 0, 새 판 `526eb41d…`, 배포 이력 14건(`rearm/contract-final-v1.json` `2e4cf97a…`, `rearm/arm-postcheck-final-v1.json` `5c0d2b93…`). [근거1](../../../../../.tmp/pulse-harin-ad-release-20261020/rearm/dr/restore-v1.json) [근거2](../../../../../.tmp/pulse-harin-ad-release-20261020/rearm/arm-postcheck-final-v1.json) [보류 기록](../../../../../.tmp/pulse-harin-ad-release-20261020/rearm/held-cycle1-20261020-1735/held.json)
- **소스:** 공용 작업본 커밋 `b836f3c60`. 영상은 `.gitignore`(`*.mp4`)라 git 밖이고 운영 원문의 정본은 릴리스 폴더의 `candidate/`(manifest `526eb41d…`)다. 원본 최종본은 `Documents/synk-vendor/harin-iced-coffee-h3-20261017/가편집/`.
- **다음 릴리스:** `.tmp/pulse-harin-ad-release-20261020`이 부모다(배포 이력 14→15, 통화 켜기 릴리스가 이어받음). 큰 미디어가 든 판은 stage를 처음부터 전체 이미지 중계로, 재무장은 백업에서 설치까지 한 스크립트로 짧게 돌린다.

<a id="pulse-auto-reply-production-20261020"></a>
## PULSE 고객 문의 자동 안내 운영 인수 · 2026-10-20 (Claude)

유호님 「…클로드 맥스 무료 크레딧 많이있는데 그걸로 자동으로 답변처리를 노트북이 꺼져있어도 24시간 양질의 답변을 하도록 하면 안될까?」(10-19) → 10-20 「웅 올려」. 직전 Claude 릴리스(캐스팅북 연결·게시 성과 고침)의 `successor-tools`를 한 단계 밀었다(배포 이력 12→13). 부모 `0cf45a306b336b98a78b0e8d11953fab588f73ec14481751c003506b84756879` 위 새 판 `b60db5da87489eac1e756a051ff6adafde81e0bb09050a0f1e788437f78ed0e8`는 원문 1,079개·이미지 목록 664개다. 고친 10·새 4(서버 `pulse-auto-reply.mjs`, 시험 2, 설계 문서)만 바꾸고 부모의 나머지 1,065개를 보존했다. 삭제 0. 07:43 KST 운영 교체, 08:30:46 KST 최종 사후 확인까지 마쳤다. [릴리스 기록](../../../../../.tmp/pulse-auto-reply-release-20261019/README.md)

- **바뀐 것:** 아래 이전 후보 절. 자동 안내는 **꺼진 채로** 올라갔다 — 관리자가 키를 넣고 켜기 전에는 Claude를 부르지 않고 아무 글도 남기지 않는다. 고객 앱의 저장 충돌 안내 문구(원인 중립)만 바로 바뀐다.
- **Windows·Linux·이미지:** [passed] Windows 격리 사본 128파일 1,817/1,817, 회사 전체 293파일 3,815개 중 실패 0·건너뜀 9(원래부터), Linux 1,817/1,817·호환성 2/2, 이미지 목록 664개 해시 일치, 이미지 `sha256:d307671868fbfde72eadb5b9b08d8c662b0015633b1a427a4c43ed24b77311fd`(부모 239층 + 새 1층). [근거1](../../../../../.tmp/pulse-auto-reply-release-20261019/deployment/reviewed-candidate-receipt.json) [근거2](../../../../../.tmp/pulse-auto-reply-candidate-20261019/qa/result.json) [근거3](../../../../../.tmp/pulse-auto-reply-candidate-20261019/company-all-run1/result.json)
- **운영·공개 응답·자료 보존:** [passed] 07:36~07:43 KST 교체 검증, 기동 전 논리 자료 정확 보존·스키마 불변, 공개 메신저 12/12·health 200/ready·익명 SNS 401. identity 세션은 2→2행인 채 해시가 달라 각 행의 동일성은 주장하지 않는다. 공개 파일 전체 221/221 바이트 일치. 새 경로 `GET /api/settings/pulse-auto-reply`는 로그인 없이 401, 새 판 컨테이너 healthy·기동 뒤 로그 오류 0. **교체 중 공개 접속이 07:38:12~07:42:31 KST 약 4분 15초 끊겼다**(2초 간격 실측, 그 뒤 15분 정상 — 쓰기를 멈추고 기존 자료를 확인한 뒤 새 판을 켜는 구간). [근거1](../../../../../.tmp/pulse-auto-reply-release-20261019/deployment/runtime-live-postcheck-1792449794593.json) [근거2](../../../../../.tmp/pulse-auto-reply-release-20261019/deployment/public-verification-1792449824903.json) [근거3](../../../../../.tmp/pulse-auto-reply-release-20261019/preflight/health-deploy.txt)
- **배포 전 백업:** 07:01:14 KST 요청 → 07:15 완료(세대 `1792448089950499`, 521,825,620B). 부모 0cf45a30의 첫 요청이라 새로 요청됐다.
- **새 백업·격리 복원·최종 HA:** [passed] 새 백업 generation `1792451202266332`·522,124,695B 업로드·MD5 확인, 예비 노드 격리 복원에서 원문 1,079개·원래 키·연결 정보 보존, 보호 계정 표 9개·세션/토큰 35행 보존(토큰 3→3, 제거 0), 고객 미인증 401, 새 계정 기준 연결. 정규 재무장 준비 140초 → 계약 나이 0.2초에 설치 → 실행(`synk-ha-arm-compat-03739cb2-e27a-49ad-90f2-3b72dd3129fa.service`) → 첫 상태 확인에서 installed-armed → 사후 확인. 08:30:46 KST armed:true, A(`6695198820229895670`) 단일 writer·epoch 7, 복제 정상, 공개 HTTPS 200/ready/TLS, 같은 controller PID·Invocation 17.7초 관찰·재시작 0, 새 판 `b60db5da…`, 배포 이력 13건(`rearm/contract-final-v1.json` `421176da…`, `rearm/arm-postcheck-final-v1.json` `71d21ceb…`). [근거1](../../../../../.tmp/pulse-auto-reply-release-20261019/rearm/dr/restore-v1.json) [근거2](../../../../../.tmp/pulse-auto-reply-release-20261019/rearm/arm-postcheck-final-v1.json)
- **첫 시도 흔적 정리:** 유호님 「첫시도 흔적 정리해줘」(10-20) — 캐스팅북 합본 첫 시도 판 `7bc4a294…`의 stage 폴더·원문 고정본 `/opt/synk/releases/7bc4a2948ac6`·이미지 `sha256:425a32f5…`를 두 노드에서 지웠다. 지우기 직전 그 이미지를 쓰는 컨테이너 0, HA 설정·systemd에 그 이름 0, `current` → `0cf45a306b33`을 다시 확인했다. 여유 공간 주 +0.36GB·예비 +0.50GB. [근거](../../../../../.tmp/pulse-auto-reply-release-20261019/cleanup/removed-7bc4-1792446658345.json)
- **켜기:** 키는 유호님이 곧 알려 주신다(공자 키는 인스타 DM 자동 답, synk.yuh 키는 talk 강사 도우미에 쓰는 중). 한도는 기본값(하루 $3·한 달 $30·프로젝트당 하루 10건)으로 가고 모자라 보이면 늘린다(유호님 10-20). 키는 관리자가 설정 화면에 붙여 넣고, 시험 프로젝트 문의 1건으로 자동 안내·고객 알림·담당자 할 일·설정 칸 기록과 금액을 확인한 뒤 켜 둔다.
- **소스:** 공용 작업본 로컬 커밋 `702efa8a3`. 운영 원문의 정본은 릴리스 폴더의 `candidate/`(manifest `b60db5da…`)다.
- **다음 릴리스:** `.tmp/pulse-auto-reply-release-20261019`가 부모다(배포 이력 13→14).

<a id="casting-performance-production-20261019"></a>
## 캐스팅북 연결 · 게시 성과 고침 운영 인수 · 2026-10-19 (Claude)

유호님이 이 릴리스를 Claude 세션에 맡기셨다(「다음 회사 릴리스: 캐스팅북 연결·게시 성과 고침」, 캐스팅북 세션에는 「pulse-2가 합본으로 배포해」). 직전 Claude 릴리스(고객 검수 고침)의 `successor-tools`를 한 단계 밀었다(배포 이력 11→12). 부모 `9f11564de3a2aebc4f6d042e7ecf963e568a9fa5cea67cf006bcd12f173fe1cf` 위 새 판 `0cf45a306b336b98a78b0e8d11953fab588f73ec14481751c003506b84756879`는 원문 1,075개·이미지 목록 658개다. 고객 앱 화면 5·서버 2·작업실 화면 1·시험 4(새 1)만 바꾸고 부모의 나머지 1,063개를 보존했다. 삭제 0. 20:57 KST 운영 교체, 22:32:27 KST 최종 사후 확인까지 마쳤다. [릴리스 기록](../../../../../.tmp/casting-performance-release-20261019/README.md)

- **바뀐 것:** 캐스팅북 → PULSE 01 모델·스타일(아래 이전 후보 절, 로컬 커밋 `712fc8c87`·`e1c45e05a`·`17db1ebcd`)과 게시 성과 고침(아래 이전 후보 절). 게시 성과 Fable 검수 지적 P2-1·P3-2·P3-4는 합본에서 고쳤다 — 다음 할 일 제안(「세 편 더」·「도입 바꿔 다른 계정에서」)은 v2 §6 네 숫자 지표(3초 유지율·평균 시청·완주율·공유·저장·도구 유입)로만 정하고 조회·좋아요·댓글·도달은 판정 줄만 보인다. 설계 §8-4 「네 숫자를 따로 볼지 합칠지」는 유호님 결정 전이다. [고침과 검수](../../../../../.tmp/casting-performance-candidate-20261019/reviews/)
- **Windows·Linux·이미지:** [passed] Windows 격리 사본 125파일 1,794/1,794, 회사 전체 291파일 3,802개 중 실패 0·건너뜀 9(원래부터), Linux 1,794/1,794·호환성 2/2, 이미지 목록 658개 해시 일치, 이미지 `sha256:9ced5923bdac5a970413c728e935ea9377c1442feb5b1d63471aed555f401cc3`(부모 238층 + 새 1층). [근거1](../../../../../.tmp/casting-performance-release-20261019/deployment/reviewed-candidate-receipt.json) [근거2](../../../../../.tmp/casting-performance-candidate-20261019/qa/result.json) [근거3](../../../../../.tmp/casting-performance-candidate-20261019/company-all-run3/result.json)
- **운영·공개 응답·자료 보존:** [passed] 20:51~20:57 KST 세 서버 교체 검증, 기동 전 논리 자료 정확 보존·스키마 불변, 공개 메신저 12/12·health 200/ready·익명 SNS 401. identity 세션은 2→2행인 채 해시가 달라 각 행의 동일성은 주장하지 않는다. 공개 파일 전체 221/221 바이트 일치. [근거1](../../../../../.tmp/casting-performance-release-20261019/deployment/runtime-live-postcheck-1792410999397.json) [근거2](../../../../../.tmp/casting-performance-release-20261019/deployment/public-verification-1792411027287.json)
- **배포 전 백업:** 요청 기록이 운영 판(9f1)마다 하나라, 19:57:59 KST에 요청해 20:10에 끝난 백업(세대 `1792408193495354`, 521,251,853B)을 이번 교체의 배포 전 백업으로 묶었다.
- **새 백업·격리 복원·최종 HA:** [passed] 첫 새 백업 준비는 「신선한 스냅숏 필요」로 보류됐다(클라우드 쓰기·서비스 조작 0) — 이 PC 시계가 구글 시간보다 2.88초 늦고 Windows 시간 서비스가 꺼져 있었다(현장 노트). 유호님이 「지금 동기화」(+0.004초)한 뒤 다시 돌려 새 백업 generation `1792414667868113`·521,535,667B 업로드·MD5 확인, 예비 노드 격리 복원에서 원문 1,075개·원래 키·연결 정보 보존, 보호 계정 표 9개·세션/토큰 35행 보존(토큰 3→3, 제거 0), 고객 미인증 401, 새 계정 기준 연결. 정규 재무장 준비가 이번에는 신선도 안에 들어와(210초) 계약 나이 11초에 설치 → 실행(`synk-ha-arm-compat-3e6f8b26-99ab-48d3-9fa6-4a18c5d93c0b.service`) → 첫 상태 확인에서 installed-armed → 사후 확인. 22:32:27 KST armed:true, A(`6695198820229895670`) 단일 writer·epoch 7, 복제 정상, 공개 HTTPS 200/ready/TLS, 같은 controller PID·Invocation 17.8초 관찰·재시작 0, 새 판 `0cf45a30…`, 배포 이력 12건(`rearm/contract-final-v1.json` `68079f58…`, `rearm/arm-postcheck-final-v1.json` `a42d31f3…`). [근거1](../../../../../.tmp/casting-performance-release-20261019/rearm/dr/restore-v1.json) [근거2](../../../../../.tmp/casting-performance-release-20261019/rearm/arm-postcheck-final-v1.json)
- **도중에 겪은 것:** 첫 시도(캐스팅북 `17db1ebcd` 전 판 `7bc4a294…`)는 inert·stage·배포 전 백업 요청까지 갔다가 교체 전에 멈추고 새 묶음으로 다시 만들었다. 그 판의 이미지 `sha256:425a32f5…`와 원문 고정본 `/opt/synk/releases/7bc4a2948ac6`(두 노드), 예비 노드 stage 폴더는 쓰이지 않고 남아 있었다 — 10-20 유호님 「첫시도 흔적 정리해줘」로 두 노드에서 지웠다(위 자동 안내 절). stage가 주 노드 15분 주기 백업 점검과 겹쳐 한 번 멈췄고 남은 단계만 이었다. [현장 노트](../../../../현장노트/배포_공개.md)
- **소스:** 캐스팅북은 공용 작업본 로컬 커밋(위). 게시 성과 묶음과 Fable 고침은 10-19 밤 master에 들였다(`f1e9c8986`, 운영 바이트와 같음). 운영 원문의 정본은 릴리스 폴더의 `candidate/`(manifest `0cf45a30…`)다.
- **다음 릴리스:** 10-20 「PULSE 고객 문의 자동 안내」로 이어졌다(위 절, 배포 이력 13).

<a id="pulse-client-care-production-20261019"></a>
## PULSE 고객 검수 고침 운영 인수 · 2026-10-19 (Claude)

유호님 「gpt가 하지말고 니가 해줘. 앞으로 당분간 gpt 구독 취소하고 클로드만 써볼 예정이야」에 따라 GPT 릴리스 도구 계보(부모 릴리스의 `successor-tools`)를 Claude가 한 단계 밀어 반영했다. 부모 `30c93e84148c05d58c00ea77e0ce5c3660b54bc0c89f8c15c3ef76e36a9891d4` 위 후보 `9f11564de3a2aebc4f6d042e7ecf963e568a9fa5cea67cf006bcd12f173fe1cf`는 원문 1,074개·이미지 목록 655개다. 고객 화면·서버 실행 파일 45개와 시험 13개(고친 12·새 1)만 바꾸고 부모의 나머지 1,016개를 보존했다. 삭제 0. 18:28:49 KST 최종 사후 확인까지 마쳤다. [릴리스 기록](../../../../../.tmp/pulse-client-care-release-20261019/README.md) · [고침 기록](../../../../../.tmp/pulse-client-fix-20261019/README.md)

- **서버 공간:** 두 노드 부팅 디스크 pd-standard 20→40GB(결제 계정 크레딧, 재부팅·서비스 조작 없이 온라인으로 늘림, 파일 시스템 clean). 이미 도커에 있는 지난 판 이미지의 옮김 사본 31개(5.19GB)와 끝난 복원 시험 파생 폴더·내려받은 백업 사본(2.2GB, 클라우드 원본 크기·MD5 일치 확인)을 지웠다. [근거](../../../../../.tmp/pulse-client-care-release-20261019/preflight/)
- **Windows·Linux·이미지:** [passed] Windows 격리 사본 123파일 1,760/1,760, Linux 1,760/1,760·호환성 2/2, 이미지 목록 655개 해시 일치, 이미지 `sha256:4c1af7b9c0eb184c34674ef5d65c92ebab98300aa1606a276c0457fe146f1a1e`(부모 237층 + 새 1층). 시험 선택은 부모 117파일에 이번에 바뀌었거나 새로 생긴 시험 6파일을 더했다. [근거1](../../../../../.tmp/pulse-client-care-release-20261019/deployment/reviewed-candidate-receipt.json) [근거2](../../../../../.tmp/pulse-client-care-candidate-20261019/qa/result.json)
- **운영·공개 응답·자료 보존:** [passed] 17:16 KST 세 서버 교체 검증, 기동 전 논리 자료 정확 보존·스키마 불변, 공개 메신저 12/12·health 200/ready·익명 SNS 401. identity 세션은 2→2행인 채 해시가 달라 각 행의 동일성은 주장하지 않는다. 공개 파일 전체 221/221 바이트 일치(`/pulse-app/` 전체·워크스페이스 모듈·두 HTML과 digest 자산). 운영 주소 체험 화면에서 새 첫 화면 안내와 05 이동을 확인했다. [근거1](../../../../../.tmp/pulse-client-care-release-20261019/deployment/runtime-live-postcheck-1792397779158.json) [근거2](../../../../../.tmp/pulse-client-care-release-20261019/deployment/public-verification-1792397815245.json)
- **새 백업·격리 복원·최종 HA:** [passed] 새 백업 generation `1792399010872376`·521,183,674B 업로드·MD5 확인, Linux 재무장 155건(120+35, 건너뜀 0), 예비 노드 network none 격리 복원에서 원문 1,074개·보호 9테이블 35행·토큰 3→3·원래 키 보존과 시험 컨테이너 정리, 새 계정 기준 연결. 정규 재무장 준비는 자연 관찰 증거가 35초가 되어 30초 기준에서 멈췄고(계약 없음), GPT의 병렬 준비 v3를 이번 판 원문 해시로만 고정을 바꿔 다시 준비했다. 요청 `5ec394e8-49c9-4e26-9769-f83c12260305`, 배포 이력 11건, armed:true·A 단일 writer·epoch 7·복제 정상·공개 HTTPS 200/TLS, 같은 controller PID와 Invocation의 18.0초 관찰·재시작 0. 이번 릴리스의 강제 장애 전환과 복원 환경의 실제 사용자 로그인은 시험하지 않았다. [근거1](../../../../../.tmp/pulse-client-care-release-20261019/rearm/dr/restore-v1.json) [근거2](../../../../../.tmp/pulse-client-care-release-20261019/rearm/dr/binding-v1.json) [근거3](../../../../../.tmp/pulse-client-care-release-20261019/rearm/contract-final-v3.json) [근거4](../../../../../.tmp/pulse-client-care-release-20261019/rearm/arm-postcheck-final-v3.json)
- **소스:** 공용 작업본 로컬 커밋 `791d98127`(코드)·`e69ad5c67`(문서). origin push는 이 화면의 앞 작업(10-18 구조 판 등)이 origin에 없어 하지 못했다. 운영 원문의 정본은 릴리스 폴더의 `candidate/`(manifest `9f11564d…`)다.
- **다음 릴리스:** `.tmp/pulse-client-care-release-20261019`가 부모다. 그 폴더의 `successor-tools`를 한 단계 밀어(배포 이력 11→12) 쓴다. 캐스팅북 → 01 모델 선택 잇기(로컬 커밋 `712fc8c87`·`3f812f350`)가 다음 후보다.

<a id="post-performance-stage1-production-20261018"></a>
## 게시 성과 자동 수집 1단계 — 2026-10-18 운영 인수 완료

**2026-10-18 21:31:39 KST 최종 운영 인수 완료.** 20:09:57 실제 배포 검증과 제품 확인 뒤 새 백업·격리 복원·HA 재무장을 마쳤다. 부모 `c5c80352e532ef23b9b35e0167b1dd19b5a1e4bd4c6753bf58c8e761ff40c41b` 위 manifest `3000c7cf632e9398e090db93a4343d55038fce4841693ce7d963b5f867e10d8f`, 이미지 `sha256:f950947b6e621db471e790bd94db7de4b880bac87a7b50227fb166163ba5171e`, 배포 `202ed64b96abe98977dc23284552f042`를 확인했다. 원문 1,049개·이미지 목록 619개, 부모 대비 변경·추가 25개이며 Claude의 화면·딥링크 시험·QA·문서도 포함했다. 후보 소스 고정점 `c0e5251b4ef205588bdad759961abe111dda3c11`은 Git 커밋이고, 실제 운영 판은 위 manifest로 구분한다. 아래 SNS 집계 `c5c80352…`의 완료 기록과 증거는 그대로 보존한다.

- **실행·보존:** 양 노드와 controller의 완료·A epoch7 단일 writer·B 대기, 공개 메신저 8파일 일치·HTTPS200/ready·익명 SNS401을 확인했다. 기동 직전 데이터·원래 키·기동 뒤 스키마는 보존됐다. 기동 뒤 identity 세션은 2→2행이지만 값이 바뀌었고 토큰은 6→3행이므로 전체 행 불변이나 변경 원인은 이 증거로 확정하지 않는다. [실행 대조](../../../../../.tmp/post-performance-release-v4-20261018/deployment/runtime-live-postcheck-1792321797529.json) · [공개 확인](../../../../../.tmp/post-performance-release-v4-20261018/deployment/public-messenger-verification-1792321802412.json).
- **주소 확인·등록:** 운영 `performance.lookupAvailable=true`와 없는 채널 403을 확인했다. 기존 YouTube `R3zPsNM6a2c`와 Instagram `DeoJ2fZKY9n`을 공식 소유자·게시 시각 확인 뒤 외부 게시물로 등록했고, 중복 등록은 기존 항목을 반환했다. 기존 6개 항목의 API 반환 메타데이터·체크포인트·비교 결과는 모두 같고 최종 8개다. Claude의 「게시 주소로 추가 ↗」와 깊은 링크 흐름을 포함했다. [제품 검증](../../../../../.tmp/post-performance-release-v4-20261018/live-verification-summary.json).
- **공식 지표:** YouTube Analytics 활성화 뒤 실제 수집기로 영상 4개 조회를 확인했다. 공유 0은 공식 응답이 있는 2개에만 기록하고 응답이 없는 2개는 미제공으로 남겼다. Instagram 통계 권한을 확인한 뒤 채널 수집은 4개 모두 성공했고 조회·좋아요·댓글·공유·저장·도달을 받았다. 이는 새 항목의 24·72시간 관측과 별개다. 새 두 항목의 첫 관측은 10월 19일 YouTube 16:06:34·Instagram 16:32:43 KST, 72시간 관측은 10월 21일 같은 시각으로 아직 대기 중이다. [실제 수집·미제공 구분](../../../../../.tmp/post-performance-release-v4-20261018/live-verification-summary.json). 기존 관측 시간 경과 4건은 유지하며 과거 수치를 자동 복원하지 않는다. [자동화 현황](../../../../../.tmp/post-performance-release-v4-20261018/live-automation-health.json).
- **검증:** 동결 후보의 Linux 앱 1,261/1,261·호환성 2/2, rearm Node120·Python35·기존 배포126을 실패·건너뜀 없이 통과했다. rearm은 부모의 확장 복원 대기 수정만 한 경로로 계승했고, 실행 소스 409개의 계획·결과 해시와 전체 의존 소스 포함을 재검증했다. [Linux 후보](../../../../../.tmp/post-performance-release-v4-20261018/deployment/reviewed-candidate-receipt.json) · [rearm Linux QA](../../../../../.tmp/post-performance-release-v4-20261018/rearm/linux-qa-result-v1.json).
- **새 백업·격리 복원:** 백업 호출 `a2b01e23439f8e53e4912944d9531992`의 실제 완료·업로드 generation `1792322972076829`·518,229,271B·SHA256 `eec45e1922c334f7918ff3a7c785354631b7bc50ec65e4277d1374abdf752501`를 확인했다. 21:13:54 KST 격리 복원은 원문 1,049개·원키·보호 계정 9표/28행·세션과 토큰 값·토큰 3→3/만료 제거 0을 기동 전후 보존했다. 네트워크 none·공개 포트 0·시험 컨테이너 제거·운영 설정과 컨테이너 보존을 확인했다. [완료 백업](../../../../../.tmp/post-performance-release-v4-20261018/rearm/dr/backup-status-1792323068698.json) · [격리 복원](../../../../../.tmp/post-performance-release-v4-20261018/rearm/dr/restore-v1.json) · [계정 보존 연결](../../../../../.tmp/post-performance-release-v4-20261018/rearm/dr/binding-v1.json).
- **최종 HA:** 요청 `436e83b1-5f3e-4296-8d68-2891eb06d89d`의 실제 설치 뒤 `armed=true`·A owner `6695198820229895670`/epoch 7·B 대기·복제 healthy·HTTPS 200/ready/TLS를 확인했다. 같은 controller의 25,953ms 관측·재시작 0이며 이번 릴리스의 새 강제 장애 전환 시험은 하지 않았다. [approval](../../../../../.tmp/post-performance-release-v4-20261018/rearm/approval-input-v2.json) SHA256 `2f2a2d80c94f6eb359745cbbb14872dcf80084e7968f93630aa4f3b005cdd6eb` · [contract](../../../../../.tmp/post-performance-release-v4-20261018/rearm/contract-final-v1.json) SHA256 `b6f28d96c9873ede0e3637c6ebbe4c584ffcf1b6a9b4f97e8bbcccf19fb14a65` · [최종 후검사](../../../../../.tmp/post-performance-release-v4-20261018/rearm/arm-postcheck-final-v1.json) SHA256 `c6b4b4b29ae884b9a93ab4f3bdbda96efb90c87168083859f8dc51b126fee5d4`.
- **복원 공간·다음 배포 인수:** 부모 SNS DR의 파생 디렉터리 4개만 정리해 원본 archive·receipt·RESULT·소스 핀과 정식 릴리스·이미지를 보존했다([완료](../../../../../.tmp/post-performance-release-v4-20261018/cleanup-parent-derived-run-1792324756274.json), [후검사](../../../../../.tmp/post-performance-release-v4-20261018/cleanup-parent-derived-run-postcheck-1792324763460.json)). 폐기 이미지와 빌드 캐시 정리 뒤 `apt-get clean`으로 다운로드 deb 20개를 정리했고, 설치 DB·HA·이미지 불변과 복원 전 free 8,565,424,128B > 필요 8,366,234,900B를 확인했다([apt 결과](../../../../../.tmp/post-performance-release-v4-20261018/apt-cache-clean-result.json)). 현재 stage `/opt/synk/post-performance-stage-3000c7cf632e-compat3`는 `EXACT_FROZEN_STAGE_CLOSURE`에서 삭제 전에 중단돼 그대로 보존했다([중단 증거](../../../../../.tmp/post-performance-release-v4-20261018/cleanup-current-stage-proof-1792324885990.json)).

21:32:41 KST 최종 읽기 확인에서 대기 노드 free는 **6,959,464,448B**다. 새 DR 루트 `/opt/synk/ha-qa/infra-dr-202ed64b96abe98977dc23284552f042-1792322972076829`의 `restored`·`readonly-snapshot`·`disposable-company`·`archived-disposable-company` 4개는 합계 1,184,440,320B로 아직 보존 중이다. 원본 `recovery.tar.gz`·`receipt.json`·`RESULT.json`·`source-pins.json`의 정확한 경로·크기·SHA는 [복원 후 공간·보존 증거](../../../../../.tmp/post-performance-release-v4-20261018/dr-postrestore-space-1792326752497.json)에 있다. 다음 voice 배포에서 공간이 필요하면 현재 상태를 다시 읽고, 실제 성공한 [부모 파생물 정리 helper](../../../../../.tmp/post-performance-release-v4-20261018/cleanup-parent-derived.cjs)의 잠금·원본 핀·참조와 전후 보존 검사를 새 완료 DR에 맞춰 고정한 뒤 파생물만 다룬다. 기존 helper는 과거 부모 경로에 묶여 있으므로 그대로 실행하지 않는다.

다음 직원 음성 통화 배포 후보는 운영 부모 manifest `3000c7cf…`를 기준으로 만들고, 시작 직전 실제 부모와 HA 상태를 다시 읽는다. 이번 후보의 Git 커밋 `c0e5251b4…`를 운영 manifest 대신 쓰지 않는다. 음성 통화의 별도 미디어·두 기기 검증과 운영 반영 판단은 기존 담당 기록을 따른다.

<a id="sns-real-post-counting-production-20261018"></a>
## LAB·synkbrief 실제 게시물 자동 집계 — 2026-10-18 운영 인수 완료

**2026-10-18 19:46:13 KST 최종 운영 인수 완료.**18:44 반영·새 백업·19:24 격리 복원 뒤 HA 재무장과 실제 정상 상태를 확인했다. 부모 `c516b0e11d30…` 위 manifest `c5c80352e532ef23b9b35e0167b1dd19b5a1e4bd4c6753bf58c8e761ff40c41b`, 이미지 `sha256:4eace03ccdf2c21b63b89c2a2819199ffb5ab6f72ac0d49871fa07ea87c36a05`, 배포 `40ffa4944dee3bebf0dfb3b29934a6ae`다. 실제 배포 원문1,040개·이미지 목록601개는 동결 manifest로 고정했다. SNS 수정 원문15파일은 별도 로컬 브랜치 `codex/sns-real-post-counts-20261018`의 `8cdb318b9b5e15e12ad37a97c2fc6de555b53386`에 보존했고 이후 공용 작업본의 추가 수정은 이번 이미지에 포함하지 않았다.

- **실행·데이터:** 기동 직전 전체 데이터·원래 키·스키마 보존, controller 완료·양 노드 FINALIZE, 공개8파일 정확 일치·HTTPS200/ready·익명SNS401을 확인했다. 기동 뒤 세션 값/토큰 행은 변했으므로 전체 행 불변을 주장하지 않는다. 실제 기존 유호 브라우저 로그인은 유지됐다. [실행 대조](../../../../../.tmp/sns-pulse-counting-v3-20261018/deployment-attempt2/runtime-live-postcheck-1792316743164.json) · [공개 확인](../../../../../.tmp/sns-pulse-counting-v3-20261018/deployment-attempt2/public-messenger-verification-1792316745292.json).
- **집계:** 자동26채널 실행과 전체 재대조 뒤 공식59개 게시물 ID·최근7일40개·비공개3개 제외를 확인했다. 전체34개 중 TikTok5개·미지원3개는 자동 집계 밖이다. [검증](WORKSPACE_QA.md#sns-real-post-counting-20261018).
- **PULSE 필수 묶음:** 아래의 고객 화면 구조·M033파일·공개 목록·Range 구현을 같은 manifest/이미지에 포함했다. 공개14파일 전체 SHA와6개206/416범위 요청을 확인했다. [공개 미디어 증거](../../../../../.tmp/sns-pulse-counting-v3-20261018/pulse-public-1792316796046.json). 실제 아이폰 재생은 아직 확인하지 않았다.
- **첫 실패 보존:** 첫 작업 `699a9ac2…`는 A PREPARE의 잠금 충돌 후 복구 완료됐다. 앱 기동 지시0·기존 부모 유지·모든 worker 종료를 확인하고, 제품/이미지/worker를 바꾸지 않은 새 정상 작업으로 성공했다. [복구 진입 근거](../../../../../.tmp/sns-pulse-counting-v3-20261018/deployment-attempt2/resume-admission.cjs).
- **백업·격리 복원:** 새 백업 호출 `152f6d8ce9764dec85104fcda1d2fc96`의 완료 업로드·generation `1792317831026556`·517,648,734B·SHA256 `1197c59ad6c5ec3af55f19816ec9cf9d1145771aa38833bb430a9e1ec5890ff7`를 확인했다.19:24:41 격리 복원에서 원문1,040개·원래 키·계정9표/28행·세션/토큰 값·토큰3→3과 제거0을 확인했다. 네트워크none·공개 포트0·시험 컨테이너 제거·운영 설정/컨테이너 보존이다. 원래300초 제한 대신 검사 조건을 보존한 새 시험 worker의1200초 대기를 사용했다. 원래 worker/context와 실제 백업 영수증은 그대로 보존했다. [완료 백업](../../../../../.tmp/sns-pulse-counting-v3-20261018/rearm-attempt2/dr/backup-status-1792317784139.json) · [실제 복원](../../../../../.tmp/sns-pulse-counting-v3-20261018/rearm-attempt2/dr-extended/restore-v1.json) · [대기 범위 검증](../../../../../.tmp/sns-pulse-counting-v3-20261018/rearm-attempt2/dr-extended/wait-narrow-qa-v1.json).
- **공간·보조 파일 검증:** 정본 소스·실행 이미지와 정확히 같은 과거 QA/전송/복원 파생 사본만 확인해 정리했다. 마지막 cached source/image5경로의 회수는418,103,296B이며 원본·증거·정식 백업·운영 자료는 보존했다. [마지막 사본 정리](../../../../../.tmp/sns-pulse-counting-v3-20261018/cleanup-retained-stage-copies-run-1792318246065.json). 새 복원 보조 파일이 추가된 뒤 기존 QA 원문 범위 검사가 이를 거절해, 원래 검사를 모두 유지하고 새 파일까지 포함한 Linux Node173/Python48·배포126개 검증을 다시 통과했다. 실패/건너뜀0·운영 보호 파일 불변이다. [최종 Linux QA](../../../../../.tmp/sns-pulse-counting-v3-20261018/rearm-attempt2/linux-qa-result-v2.json).
- **최종 HA·인계:** 요청 `85326f69-1548-439c-8f65-ad2763a2b27b`의 실제 설치 완료와 `armed=true`·A owner6695198820229895670/epoch7·B 대기·복제healthy·HTTPS200/ready/TLS·controller 재시작0을 확인했다. 현재 판의 자연 관측은18표본·3리전·1,090,890ms·오류0, 활성화 후 같은 controller11,052ms 관측이다. 새 강제 장애 전환 시험은 하지 않았다. 다음 배포는 현재 부모와 HA 상태를 다시 읽어 시작한다. [approval](../../../../../.tmp/sns-pulse-counting-v3-20261018/rearm-attempt2/approval-input-v2.json) SHA256 `cf630d46cdb04cdd5653914ffa683d49d6ba84fe35e808197a63115076abd307` · [contract](../../../../../.tmp/sns-pulse-counting-v3-20261018/rearm-attempt2/contract-final-v1.json) SHA256 `7dde17be3f33e66ef8600cacd44f14bf3120c6abcd9b067187c053ecc2f5972f` · [최종 후검사](../../../../../.tmp/sns-pulse-counting-v3-20261018/rearm-attempt2/arm-postcheck-final-v1.json) SHA256 `d724b3b54c9b8ebea8e73f8c0b6ed8e2c07f632628f3e8a777d6112249c09aec`.

<a id="next-company-release-pulse-auto-reply-20261019"></a>
## 이전 릴리스 후보 — PULSE 고객 문의 자동 안내 (2026-10-19 Claude 준비 · 10-20 운영 인수)

유호님 「…클로드 맥스 무료 크레딧 많이있는데 그걸로 자동으로 답변처리를 노트북이 꺼져있어도 24시간 양질의 답변을 하도록 하면 안될까?」(10-19). 고객이 PULSE에서 문의를 남기면 회사 서버가 그 프로젝트에서 고객에게 이미 보이는 사실만으로 먼저 답하고 「자동 안내」로 표시한다. 사람이 정할 일(가격·범위·일정 변경·환불·계약·불만)은 담당자에게 넘기고, 문의는 담당자 할 일에 그대로 남는다. [설계](PULSE_자동안내_설계_20261019.md)

- **묶음:** [`.tmp/pulse-auto-reply-20261019/release/`](../../../../../.tmp/pulse-auto-reply-20261019/release/README.md) — base는 운영 `0cf45a30…`의 후보 원문, 14파일(고친 10·새 4), 운영 base에 충돌 0. 공용 작업본 로컬 커밋 `702efa8a3`.
- **서버:** 새 `pulse-auto-reply.mjs`(Claude Opus 5.5 구조화 출력, 한 문의에 한 번, 결과를 모르는 호출은 재전송 없이 고정 안내), 관리자 경로 `GET/POST /api/settings/pulse-auto-reply`, 15초 주기(업무실 예약 스위치), 문서 종류 `pulseAutoReplies`·`pulseAutoReplySettings`, 암호화 비밀 `pulse-auto-reply:anthropic`. 환경 변수·HA 설정 파일·스키마는 그대로다. 관리자가 키를 넣고 켜기 전에는 아무 일도 하지 않는다.
- **화면:** 고객 앱 소식·기록에 「자동 안내」, 알림 「문의에 자동 안내가 왔어요」, 저장 충돌 안내 중립화, 작업실 설정 「PULSE 고객 문의 자동 안내」 칸(켜기·키·한도·최근 처리 5건).
- **검증:** 회사 전체 293파일 3,815개 중 실패 0·건너뜀 9(원래부터), Fable 1차 「고쳐서」 → 2차 「그대로 운영 후보로」. 실제 Anthropic 호출은 키를 넣은 뒤 시험 프로젝트에서 1건으로 확인한다.
- **유호님이 정할 것:** 어느 Max 계정의 API 크레딧 키를 쓸지(공자 키는 인스타 DM 자동 답, synk.yuh 키는 talk 강사 도우미에 쓰는 중), 기본 한도(하루 $3·한 달 $30·프로젝트당 하루 10건)가 괜찮은지.

<a id="next-company-release-pulse-client-care-20261019"></a>
## 이전 릴리스 후보 — PULSE 고객 검수 고침 (2026-10-19 Claude 준비 · 같은 날 운영 인수)

유호님 「전부 꼼꼼하게 자율주행으로 마무리해줘」(10-19). [고객 관점 검수](../../../../../.tmp/pulse-client-review-20261019/README.md)의 지적을 고친 변경 묶음이다. 같은 날 18:28 Claude가 회사 HA 릴리스로 운영에 올렸다 — [운영 인수](#pulse-client-care-production-20261019). 아래는 준비 때 기록이다.

- **묶음:** [`.tmp/pulse-client-fix-20261019/release/`](../../../../../.tmp/pulse-client-fix-20261019/release/README.md). 기준은 운영 부모 `30c93e84…`의 후보 원문이고, `manifest.json`에 파일마다 base/mine SHA256이 있다(삭제 0). `node .tmp/pulse-client-fix-20261019/release/apply.cjs <대상> --check`로 3방향 적용을 미리 본다(하나라도 충돌하면 아무것도 쓰지 않는다).
- **서버:** 고객 `POST /pulse/api/remember-device`(본문 없음, `X-Pulse-CSRF`·Origin, 201 `{deviceConnection}`) 추가. 초대 링크 30일(새로 만든 링크부터). 바뀐 칸 없는 제작 설계 저장은 새 버전을 만들지 않고, 고객이 모델·스타일만 바꾸면 확인이 이어진다(`carriedFrom`). 고객 알림 본문과 앱 안 알림함 묶음(`ids`·`count`, 기기 알림 목록은 그대로). 스키마·환경변수·권한 변경 없음.
- **화면:** `public/pulse-app/` 고객 화면, 목소리 mp3 18개(캐스팅북과 같은 바이트, M03 그대로), 로고 webp 145KB→34KB, `sw.js` 캐시 이름 `synk-pulse-shell-v19-client-review-20261019`.
- **검증:** 고침 작업본 PULSE 62파일 657/657(공용 작업본은 655/655 — 운영판에만 있는 시험 파일 하나가 공용 작업본에 없음), 회사 전체 289파일 3,787개 실패 0(옛 기대를 담은 시험은 새 규칙으로 고침), 격리 서버 1440·390·태블릿 캡처, Fable 검수([기록](../../../../../.tmp/pulse-client-fix-20261019/README.md)).
- **운영 완료 조건:** 현재 부모 위 후보의 전체·Linux 시험, 공개 SHA 대조, 실제 고객 경로(초대 링크 → 「이 기기 기억하기」 201·쿠키 HttpOnly·Secure·SameSite=Strict → 다른 브라우저는 링크 필요, 알림 묶음 읽음), 새 백업·격리 복원·HA 재무장.
- 참고: 바로 아래 「다음 회사 릴리스 필수 포함 — PULSE 고객 화면 구조 판 + M03」 묶음은 10-18 18:44 SNS 실제 게시물 집계 릴리스(`c5c80352…`)에 함께 반영됐다. 그 절 제목의 「운영 전」은 당시 상태다.

<a id="next-company-release-post-performance-20261019"></a>
## 이전 릴리스 후보 — 게시 성과 고침 (2026-10-19 Claude 준비 · 같은 날 캐스팅북과 합본으로 운영 반영)

유호님 「GPT에 넘기지 말고 전부 네가」(10-19). 위 PULSE 묶음은 10-19 17시 현재 별도 릴리스(`.tmp/pulse-client-care-release-20261019/`, 후보 `9f11564d…`)로 진행 중이라 끼우지 않고, 그다음 Claude 회사 릴리스에 싣는다. PULSE 묶음을 얹은 트리 위에서도 충돌 0이므로 새 부모 위에 `apply.cjs`로 3방향 적용한다.

- **묶음:** [`.tmp/post-performance-fix-20261019/release/`](../../../../../.tmp/post-performance-fix-20261019/release/README.md). 기준은 같은 운영 부모 `30c93e84…`의 후보 원문, 파일 6개(코드 3·시험 3), 삭제·그림·스키마·환경변수·권한 변경 0. 운영 부모 사본에 PULSE 묶음 → 이 묶음 순서로 얹으면 충돌 0이다(`server.mjs` 3방향 병합).
- **서버:** 비공개·일부 공개(`options.privacy`가 `private`·`unlisted`) 작업실 게시는 성과 관측에 등록하지 않고 연결을 끝낸다. 10-19 SNS 7일 시험 영상 두 지점이 공개 수치를 못 읽어 `POST_NOT_IN_RESPONSE` 재시도만 하던 원인이다. 게시 학습 카드의 지표 비교에 같은 계정·형식 이전 4편 이상일 때 `standing`(nearest-rank 상위·하위 25%)을 붙이고, 판정이 모두 같은 방향이면 v2 §6 다음 할 일(같은 형식 세 편 더 / 도입을 바꾼 판을 다른 계정에서)을 실험 맨 앞에 더한다.
- **화면:** `public/publication-flow.js` 지표 줄에 「상위 25% · 이전 n편 기준」.
- **운영 완료 조건:** 합본 후보의 전체·Linux 시험, `publication-flow.js` 공개 SHA 대조, 다음 공개 게시의 관측 등록과 비공개 예약 게시의 `performanceEntryId=null` 확인(읽기만), 새 백업·격리 복원·HA 재무장.

<a id="next-company-release-pulse-casting-code-20261019"></a>
## 이전 릴리스 후보 — PULSE 캐스팅북 문의로 모델·스타일 채우기 (2026-10-19 Claude 준비 · 같은 날 게시 성과와 합본으로 운영 반영)
<a id="first-load-state-production-20261019"></a>
## 첫 로드 state 이벤트 방어 운영 인수 · 2026-10-19

유호님 「클라이언트가 이용할때 가장 만족도 높고 간편하고 조잡하지않은방법을 냉정히 판단해줘. 그리고 내가 작업할때도 확실히 간편하게 할수있도록」, 2차 「… 선택한다던지 이런식으로. 조잡하지않게」, 「1 오케이. 이건 배포해」(10-19). 손님은 캐스팅북 「누구로 진행할까요?」에서 진행할 모델을 골라 문의 글을 보내고, 담당자가 제작 설계 「캐스팅북 문의로 채우기」에 그 글을 붙여 넣어 저장하면 고객이 처음 열 때 그 조합이 들어 있다. 운영 부모는 바로 위 고객 검수 고침 `9f11564d…`(10-19 18:28 KST armed:true). 배포는 pulse-2가 게시 성과 고침과 합본으로 한다(유호님 「pulse-2가 합본으로 배포해」, `.tmp/casting-performance-candidate-20261019/`) — 아래 후보·도구는 이 세션이 `e1c45e05a` 기준으로 만든 참고판이고, 변경 묶음은 `17db1ebcd`까지 반영했다.
부모 `6ab425e5addeda880226839083839400eea32cccdb60ca7708fa70bc77d3896f` 위 후보 `30c93e84148c05d58c00ea77e0ce5c3660b54bc0c89f8c15c3ef76e36a9891d4`는 원문 1,073개·이미지 목록 647개다. 실행 파일 9개의 초기 이벤트 진입 10곳과 회귀 1파일만 바꾸고, 부모의 나머지 1,063개 원문·통화 및 성과 기능을 보존했다. 삭제는 0이다.

- **후보:** [`.tmp/pulse-casting-code-candidate-20261019/`](../../../../../.tmp/pulse-casting-code-candidate-20261019/candidate-validation.json) manifest `002df369bf4f08fa17fe3b3619e4df9facf67391ac1d472b3ab623b4f1f39b1f` — 원문 1,075·이미지 목록 656, 바뀐 6(화면 코드 5 · 새 시험 1), 부모 1,069개 그대로, 삭제 0. 변경 묶음 [`.tmp/pulse-casting-code-20261019/release/`](../../../../../.tmp/pulse-casting-code-20261019/release/README.md)(base = 9f1 후보 바이트, `apply.cjs` 3방향, 부모 사본에 얹어 mine과 바이트 일치).
- **서버:** 바뀌지 않는다(API·스키마·환경변수·권한 그대로). 저장은 기존 담당자 `save_strategy`이고 서버 `normalizeCastingSelection`이 거른다.
- **화면:** `public/pulse-app/` 담당자 「캐스팅북 문의로 채우기」(캐스팅북 사람 줄을 읽고 코드·공유 주소 `#p-`는 대비책, 「고객이 고른 모델」 표시), 저장 전 다른 모델을 고른 채 다시 그리면 헤어 등이 빠지던 문제 고침, `sw.js` 캐시 이름 `synk-pulse-shell-v20-casting-code-20261019`.
- **검증:** Windows 격리 후보 124파일 1,770/1,770([결과](../../../../../.tmp/pulse-casting-code-candidate-20261019/qa/result.json)), 회사 전체(부모 + 변경 사본) 291파일 3,797개 중 실패 0·건너뜀 9([결과](../../../../../.tmp/pulse-casting-code-candidate-20261019/company-all-run1/result.json)), 격리 서버 1440·390 담당자·고객 흐름, Fable 1차 「운영 후보로 넘겨도 된다」·2차 재확인 「운영에 넣어도 된다」(2차 탐침 3건과 「고객」 말 통일은 `e1c45e05a`·`17db1ebcd`에서 고침)([기록](../../../../../.tmp/pulse-casting-code-20261019/README.md)).
- **릴리스 도구:** [`.tmp/pulse-casting-code-release-20261019/`](../../../../../.tmp/pulse-casting-code-release-20261019/deployment/operator-preparation.json) — 고객 검수 고침 릴리스의 `successor-tools`를 한 단계 밀어 `deployment/`·`rearm/`·`rearm-ops/`까지 만들었다(운영 도구 12/12·호환 2/2·옮김 합성 15/15·재무장 생성기 27/27·재무장 로컬 Node 120·Python 35). 원격 단계는 시작하지 않았다. 게시 성과 고침과 합본으로 낼 때는 delta·시험 수가 바뀌므로 출발점으로만 쓴다.
- **운영 완료 조건:** 현재 부모 위 후보의 Linux 시험, 공개 SHA 대조(`/pulse-app/` 바뀐 다섯 파일), 실제 담당자 경로(체험·합성 프로젝트: 문의 글 붙여 넣기 → 저장 → 고객 01 「모델과 스타일 고르기」에 같은 조합), 새 백업·격리 복원·HA 재무장.
원문 `3d0f0cc44e22e96acd499fbc3dd6e4755cfde82a`를 master와 `codex/workspace-first-load-state-20261019`에 atomic push했다. [근거1](../../../../../.tmp/first-load-state-fix-20261019/source-push-receipt.json)

<a id="next-company-release-pulse-structure-20261018"></a>
## 다음 회사 릴리스 필수 포함 — PULSE 고객 화면 구조 판 + M03 뮤직비디오 (2026-10-18 통합 후보 준비 · 운영 전)
Windows 동결 후보 117파일 1,680/1,680, 실패·취소·건너뜀 0·후보 원문 불변을 확인했다. [근거1](../../../../../.tmp/first-load-state-fix-20261019/qa/result.json)

**2026-10-18 사용자 추가 지시: 「절대로 다음 회사 릴리스에 실어줘 … 서버 두 가지도 같은 후보에 넣어줘」. 다음 회사 릴리스에는 ① PULSE 고객 화면 구조 판 ② M03 뮤직비디오 화면·원본 세 파일 ③ 뮤비 공개 파일 목록 ④ 영상·소리 Range(206·416)·스트리밍을 반드시 같은 후보·manifest·이미지에 싣는다. 어느 하나라도 빠진 후보는 이 요청의 릴리스 후보로 확정하지 않는다.**
- **Linux·이미지:** [passed] 실제 Linux 앱 1,680/1,680·호환성 2/2, 원문 1,073개·이미지 목록 647개를 확인했다. 이미지 sha256:fc891030a3da1b16f684f57a1e874536cfeaea5e1197980ea819777bb4820c55. [근거1](../../../../../.tmp/first-load-state-release-20261019/deployment/reviewed-candidate-receipt.json)
- **운영·공개 응답·자료 보존:** [passed] 30c93e84… 운영 교체 뒤 primary·standby·controller 검증과 양 노드 canonical 원문 1,073개가 통과했고, 공개 응답 12/12와 HTML에 붙인 자산 digest 목록(107개)이 일치했다. 시작 전 논리 데이터 보존은 확인됐지만 시작 후 synk_identity_sessions는 2→2행인 채 전체 해시가 달라 기존 각 행의 동일성은 증명되지 않았다. 스키마와 토큰 테이블은 일치했다. 운영 교체 직후에는 HA가 꺼져 있었으며, 이후 새 백업·격리 복원·최종 활성화 결과는 아래 HA 항목에서 확인한다. [근거1](../../../../../.tmp/first-load-state-release-20261019/deployment/runtime-live-postcheck-1792343420879.json) [근거2](../../../../../.tmp/first-load-state-release-20261019/deployment/public-messenger-verification-1792343426479.json) [근거3](../../../../../.tmp/first-load-state-release-20261019/deployment/package-live-v1.json) [근거4](../../../../../.tmp/first-load-state-release-20261019/deployment/rootqa/source-stage-1792342262269.json)
- **실제 Chrome·성과 자료:** [passed] 실제 Chrome 새 탭 1회 초기 로드와 게시→주간 요약→자동화 상태→게시 복귀·새로고침에서 오류 0, 변경 자산 9개 SHA 일치를 확인했다. 성과 8개·체크포인트 16개 전체 객체가 배포 전과 같고 주소 확인이 켜져 있으며 사용 채널 3개 연결을 유지했다. 이 Chrome의 인증 로그인 연속성은 확인했으나 모든 기존 세션 행이 동일하다는 뜻은 아니다. 초기 이벤트 경합은 운영 브라우저에 강제 주입하지 않았고 별도 결정적 소스 회귀로 확인했다. [근거1](../../../../../.tmp/first-load-state-fix-20261019/live-ui-verification.json) [근거2](../../../../../.tmp/first-load-state-fix-20261019/performance-comparison.json)
- **새 백업·격리 복원·최종 HA:** [passed] 2026-10-19 03:26 KST 최종 확인에서 새 릴리스의 자동 복구 armed:true, A 단일 writer·epoch 7·복제 정상·공개 HTTPS 200, 같은 controller PID와 Invocation의 25.842초 관찰·재시작 0을 확인했다. 새 백업 generation 1792344379781723의 업로드·MD5 검증, Linux 재무장 155건(120+35), network none 격리 복원이 통과했다. 격리 복원에서 원문 1,073개·보호 9테이블 35행·토큰 3→3과 원래 키를 보존했고 새 계정 기준도 연결했다. 배포 이력 10건을 잇는 현재 릴리스 호환성 승인이다. 현재 릴리스 장애 전환과 복원 환경의 실제 사용자 로그인은 새로 시험하지 않았다. [근거1](../../../../../.tmp/first-load-state-release-20261019/rearm/dr/backup-status-1792344359981.json) [근거2](../../../../../.tmp/first-load-state-release-20261019/rearm/linux-qa-result-v1.json) [근거3](../../../../../.tmp/first-load-state-release-20261019/rearm/dr/restore-v1.json) [근거4](../../../../../.tmp/first-load-state-release-20261019/rearm/account-baseline-final-v1.json) [근거5](../../../../../.tmp/first-load-state-release-20261019/rearm/dr/binding-v1.json) [근거6](../../../../../.tmp/first-load-state-release-20261019/rearm/contract-final-v3.json) [근거7](../../../../../.tmp/first-load-state-release-20261019/rearm/arm-postcheck-final-v3.json)
- **기존 증거·확인 경계:** 이전 state 오류 10건과 부모 3000·c0e·6ab 비교·정의 후 0건·자연 복구 기록은 당시 증거로 보존한다. 이번 실제 화면 결과와 별개다. 기존 실제 장애 전환 이력은 이번 릴리스의 강제 장애 전환 시험으로 보고하지 않는다.

**통합 후보:** `.tmp/company-pulse-structure-release-20261018/candidate/` ([준비·이어 하기](../../../../../.tmp/company-pulse-structure-release-20261018/README.md)). 운영 완료 기록 `c516b0e11d30…`(10-18 16:49 KST)의 원문 1,030개를 바이트 대조해 만들었다. 후보 manifest는 `adb2f0f5d13b6a11a6b6f2c3ed8b15c9dd06bbbf4e2e585240c52f6879da29ec`, 원문 1,036개·이미지 목록 601개·변경/추가 21개·부모 1,015개 그대로·삭제 0이다. 메신저 조회·새로고침 캐시 등 부모 개선을 보존했다. 원래 화면 꾸러미는 [`.tmp/pulse-redesign-20261017/release/`](../../../../../.tmp/pulse-redesign-20261017/release/README.md)이며 `--check` 0을 확인했다. mp4 두 개를 포함한 뮤비 세 파일의 전체 SHA256은 원본과 같다.
<a id="voice-security-production-20261018"></a>
## 통화 보안 수정 운영 반영 · 2026-10-18

**서버 두 가지도 구현·결합했다:** `server.mjs`에 M03 대표 이미지·발췌·본편의 정확한 공개 경로 세 개를 추가했다. `static-response.mjs`는 `static-media.mjs`로 영상·소리를 파일 핸들에서 스트리밍하며, 바이트 범위 206·범위 밖 416·HEAD·중단된 요청을 처리한다. 영상 전체를 메모리 캐시에 올리지 않는다. 기존 텍스트 압축·digest 캐시는 유지한다. API·데이터·권한·스키마·환경변수 변경은 없다.
통화 보안과 성과 화면 v5를 합쳐 부모 `3000c7cf632e9398e090db93a4343d55038fce4841693ce7d963b5f867e10d8f` 위에 `6ab425e5addeda880226839083839400eea32cccdb60ca7708fa70bc77d3896f`를 반영했다. 실제 이미지 `sha256:0abeca32642a5d5cc4339ebfbe3d92595d0395a80f062e5d01bd515a25c9027c`, 배포 `7928822264cffa60ea1b90bfd80bb3fc`, 원문1,072개·이미지646개·변경42개다. 별도 후보30538은 Linux 검증 뒤 운영에 배포하지 않았다. 최종 복원·재무장 후검사는 2026-10-19 00:28:12 KST 완료했다.

**누락 검사:** 저장소 루트에서 `node .tmp/company-pulse-structure-release-20261018/verify-candidate.cjs`가 종료 0이어야 한다. 화면 꾸러미, 서버 패치, 미디어 원본 SHA, 모든 원문과 이미지 목록·overlay를 함께 검사한다. 새 부모나 추가 변경을 합치면 이 묶음을 보존한 새 manifest·이미지 목록·시험 증거를 만들어야 하며, 기존 6b6471 화면 시험용 사본(`check/` · `parent-check/`)은 릴리스 후보로 쓰지 않는다.

**확인 범위:** Windows 격리 후보의 PULSE·서버·메신저 관련 61파일 **701/701**, 실패·건너뜀 0, 시험 전후 원문 불변·외부 통신 0. 별도 서버/캐시 25/25도 통과했다. [동결 인수](../../../../../.tmp/company-pulse-structure-release-20261018/release-pin.json) · [후보 시험](../../../../../.tmp/company-pulse-structure-release-20261018/qa/result.json). 이미지 layer는 준비했으며 실제 이미지 빌드·Linux 인수·HA 배포는 아직 하지 않았다. 배포 직전 실제 부모·HA 상태를 다시 읽고 기존 HA 릴리스 절차를 따른다.

**운영 완료 조건:** [공개 대조 계약](../../../../../.tmp/company-pulse-structure-release-20261018/public-verification-contract.json)의 화면·미디어 전체 SHA256과 M03/F02 Range 206을 확인하고, 1440·390 화면의 현황판·05 승인 막대/문의·체험·제작자·M03 재생/이동 및 실제 아이폰 재생을 확인한다. 새 백업·격리 복원·HA 재무장까지 인수한 뒤 운영 완료로 바꾼다.
- **통화 보안:** 키 교체 중 공급자 방에서 잠시 빠진 참가자에게 정지를 중복 적용해 통화가 끝나는 P1과, 이전/갱신 JWT가 권한 정지·공유 중지를 우회하는 결함을 고쳤다. 실제 시험 Cloud에서 옛 JWT8개가 만료 전401 철회, 경계 뒤 새 JWT4개 연결, 이전 K0 암호문의 음성·영상 복호화0→현재 K1 정상 대조를 확인했다. 최신 합본에서도 worker8초 실패 뒤 같은 참가 유지·양방향 음성·화면 복호화·메뉴 재렌더 중 iframe/문서/PeerConnection 유지·공유 중지 후 음성 자동 복구를 통과했다. 물리 두 기기 시험은 아니다. [담당 검증](../../../../../tools/company-messenger/QA.md#성과-화면-v5와-통화-보안-통합-운영-반영--10-18).
- **앱·이미지 검사:** Windows와 실제 Linux에서 각1,667/1,667·Linux 호환2/2, 이미지646개 전체 해시가 같았다. Linux 재무장 Node120·Python35·기존 배포126도 실패·건너뜀0으로 통과했다. [후보 Linux](../../../../../.tmp/company-voice-security-release-v3-20261018/deployment/rootqa/stage-execution-1792330272615.json) · [재무장 QA](../../../../../.tmp/company-voice-security-release-v3-20261018/rearm/linux-qa-result-v1.json).
- **운영·자료 보존:** 두 서버와 controller의 정상 완료, 같은 이미지·원문 폐쇄 목록을 확인했다. 기동 전 정지 상태의 전체 논리 자료·원키와 기동 후 스키마는 보존됐다. 기동 후 identity 세션2행의 해시가 달라 개별 세션의 연속성이나 변화 원인은 이 검사만으로 단정하지 않는다. [실행 검증](../../../../../.tmp/company-voice-security-release-v3-20261018/deployment/runtime-live-postcheck-1792332033647.json).
- **공개 응답·실제 화면:** 메신저12개·전체 정적/변환 응답221개·PULSE Range6개를 원문/예상 바이트와 대조했다. 전체 읽기219개와 기존 전체 동영상 읽기1개, 제한을 늘린 이미지1개 후속 읽기를 연결했고 첫 네트워크 실패2건도 보존했다. health200/ready·익명 SNS401. 승인받은 화면 작업은 실제 로그인 Chrome에서 v5 정적8개·성과8건/순서·배경 렌더 상태를 확인했다. 팀 자료0건은 격리 시험으로만 확인했고 기존 초기 `state` 이벤트 P2와 브라우저 관측 로딩 시간의 서버 원인 미확정도 남겼다. [공개221](../../../../../.tmp/company-voice-security-release-v3-20261018/public-complete-proof-1792333531988.json) · [실제 화면](../../../../../.tmp/post-performance-release-v5-20261018/live-verification-final.json).
- **새 백업·격리 복원:** 완료 호출 `c807daf22b6c45fea000221f1413b868`, GCS generation `1792333016959757`,519,574,762B·SHA256 `9c3e18a7ef6ef838f558353172db2b5706aabae607cd900c909c1662544f4750`를 확인했다. 원문1,072개·원키·원본 묶음과 standby 런타임/환경/운영 컨테이너를 보존한 격리 복원과 시험 컨테이너 정리를 통과했다. [복원](../../../../../.tmp/company-voice-security-release-v3-20261018/rearm/dr/restore-v1.json). 현재 운영 장애·강제 전환을 실행한 증거는 아니다.
- **공간 정리:** 이전 완료 DR 파생4개와 로컬 원문/설정/로그 전체가 일치하는 사용 종료 stage4개만 정리했다. 원본 백업·GCS·현재/직전 canonical 소스·모든 Docker 이미지를 보존했다. 다운로드된 Debian 목록50MB는 해제 SHA까지 확인해 압축 보존했고, 복원 뒤 같은 바이트를 원위치에 복구했다. 설치 패키지 변경0. 정리 후8,418,988,032B가 원래 복원 최소8,382,380,792B를 넘었다. [정리·후검사](../../../../../.tmp/company-voice-security-release-v3-20261018/cleanup-known-stages-run-postcheck-1792335551157.json) · [목록 복구](../../../../../.tmp/company-voice-security-release-v3-20261018/apt-metadata-restored-result.json).
- **최종 HA:** 복원 계정 기준을 검증한 뒤 최신 자연 관측·소유자·snapshot으로 재무장했다. 2026-10-19 00:28:12 KST 같은6ab 릴리스의 armed:true·replicaHealthy:true·A epoch7 단일 writer·B 대기·HTTPS 정상과 보호 런타임 SHA를 확인했다. 기존 릴리스 실제 장애 전환을 새 릴리스의 장애 전환으로 보고하지 않는다. [계약](../../../../../.tmp/company-voice-security-release-v3-20261018/rearm/contract-final-v2.json) · [후검사](../../../../../.tmp/company-voice-security-release-v3-20261018/rearm/arm-postcheck-final-v2.json) · [간결한 결과](../../../../_ops/qa/company-voice-security-20261018/result.json).
- **소스 보존·미확인:** 보안 소스와 검사 보완은 전용 `codex/voice-security-publish-20261018`의 `90e3bdd…`까지 원격 SHA를 확인했다. 합본 전체를 이 브랜치의 단일 원문이라고 보지 않으며 v5 소스 고정점과 분리한다. 최종 문서5개는 같은 전용 ref에 별도 인덱스로 보존한다. 운영 LiveKit 전용 프로젝트/키·웹훅 연결과 기능 활성화는 미완료로 기본 꺼짐이며 시험 키를 운영에 쓰지 않았다. 물리 두 기기/다른 망·모바일 백그라운드·공급자 청구 대조는 남아 있다. [담당 기록](../../../../../tools/company-messenger/QA.md).

<a id="backend-read-production-20261018"></a>
## 백엔드 조회·정적 자산 캐시 개선 — 2026-10-18 운영 인수

**2026-10-18 17:27:23 KST 최종 인수 완료.** 부모 `6b6471d02385c32e20dda7bda578b4082fa427f17a04d94150740e6b79331e47` 위 후보 `c516b0e11d30001ccb02325c021ba8e782c86b1a4509f1877a83a95d08bc9e53`, 이미지 `sha256:06bde74cfa17f52533155a4643d9db4ec24d32a99805e2f89e0de78033e7929a`, 배포 `01e714956bb97015c40b0b467298966a`, 소스 커밋 `705ef25907aa44bc9a531489a8034b2e87c36119`를 정확 영수증으로 대조했다. 원천 1,030개·이미지 원천 594개이며 부모 1,022개 바이트를 보존했다. unread 집계와 analytics GET의 반복 읽기·쓰기 부작용을 줄이고, 공개 JS/CSS의 내용 해시 URL 캐시를 반영했다.

제품 시험은 Windows 225/225와 실제 Linux 이미지 225+compat 2건이다. 공개 8개 중 HTML 2응답만 107개 연결 자산의 digest로 독립 재계산했으며 정확 바이트·no-store·nosniff를 확인했다. 나머지 공개 6개는 원문과 같다. 재무장 QA는 원천 closure379개, Node120/Python35/과거배포126개이며 제품 시험과 합산하지 않는다.

교체 뒤 새 백업으로 격리 앱을 기동해 원래 키와 활성 세션/토큰 보존, 외부 네트워크 0·공개 포트 0·시험 컨테이너 제거를 검증했다. 최종 HA는 `armed=true`·A owner epoch7이며 request `888683b7-14c9-4069-9505-925d74d09aa1`다. 현재 판의 새 강제 장애 전환 시험은 하지 않았다(`currentReleaseOutageTested=false`, `noNativeRearmClaim=true`).

사용자가 운영 새로고침이 훨씬 빨라졌다고 체감 개선을 확인했으며, 초 단위 소요 시간은 계측하지 않았다. 합성 조건의 캐시 측정값을 운영 속도로 보고하지 않는다. 소스 저장소 자동시험 39107411565는 `completed/skipped`이며 통과 증거가 아니다. 실물 두 번째 기기 검증은 미완료다. 기존 교실·개인자료·학습·공개 클라이언트 검증과 제한사항은 [전체 결과](../../../../_ops/qa/backend-upgrade-20261018/result.json)에 보존했다.

[Linux 후보](../../../../../.tmp/company-backend-read-release-v4-20261018/deployment/reviewed-candidate-receipt.json) · [배포 package](../../../../../.tmp/company-backend-read-release-v4-20261018/deployment/package-live-v1.json) · [운영 보존](../../../../../.tmp/company-backend-read-release-v4-20261018/deployment/runtime-live-postcheck-1792309772321.json) · [공개 대조](../../../../../.tmp/company-backend-read-release-v4-20261018/deployment/public-messenger-verification-1792309773760.json) · [격리 복원](../../../../../.tmp/company-backend-read-release-v4-20261018/rearm/dr/restore-v1.json) · [재무장 계약](../../../../../.tmp/company-backend-read-release-v4-20261018/rearm/contract-final-v1.json) · [최종 HA](../../../../../.tmp/company-backend-read-release-v4-20261018/rearm/arm-postcheck-final-v1.json)

<a id="messenger-recovery-production-20261018"></a>
## 메신저 초기 연결 자동 복구 — 2026-10-18 운영 반영

사용자가 운영 반영과 실제 워크스페이스 새로고침 확인을 요청했다. 12:27 KST 실제 A/B 조회에서 현재 부모는 `8a480209599a01096ada72e546e875c3ca45e4cf5d4a423a84749b844b0f528a`, A owner epoch7·HA armed=true였으며 이는 아래 10-16 기록 뒤 10-17 성과 수집 릴리스다. 최신 부모 원본은 `.tmp/automation-performance-workroom-v2-20261017/release-source-clean`, 재무장 성공은 같은 폴더 `rearm/arm-postcheck-after-cycle-v1.json`이다.

후보 `524499e0ed98b151d4f9669e83ee46082af3c7de454eea99625c1df5932250e9`는 이 부모에 메신저 `public/app.js`와 회사 `public/workspace.js` 자동 복구 부분만 얹었다. 원본 1,025개·이미지 목록 594개, 실행 변경 2·관련 시험 변경/추가 4·기존 원본 1,019개 보존·삭제 0이다. 통화 UI·API·DB 변경은 포함하지 않는다. Windows/Linux 앱 검사 각각137/137, Linux 이미지 호환2/2·배포 worker144/144·재무장 Node120/Python35가 통과했다. 작업·증거 폴더는 `.tmp/company-messenger-recovery-release-20261018/`다.

첫 배포 `2b428988a660252e7f448803d27de176`는 `APPLY_PRIMARY`의 `COMPANY_RETIREMENT_UNCONFIRMED`로 중단됐고 자동 rollback을 완료했다. owner의 rollback 전후 논리 데이터 대조를 통과했으며 데이터 복원은 실행하지 않았다. 느린 안전 검사 시간이 컨테이너 부재 관찰 예산을 소진하는 경로를 재현해 관찰 시간 계산만 수정했다. 전체 배포 종료 시각·권한·상태 검사는 유지했고 새 worker Linux152/152(정리25/25)를 통과했다. 첫 실패의 내부 지연 원인 전체를 확정한 것은 아니다. 다음 배포는 `deployment-attempt2/ha/release-node.py`의 수정과 새 SHA/QA를 승계해야 한다. [첫 실패](../../../../../.tmp/company-messenger-recovery-release-20261018/deployment-failure-1792297019359.json) · [rollback 보존](../../../../../.tmp/company-messenger-recovery-release-20261018/rollback-proof-1792297148207.json) · [새 worker 검사](../../../../../.tmp/company-messenger-recovery-release-20261018/deployment-attempt2/deployment-validation.json).

**13:28 KST 운영 교체 완료:** 새 배포 `b9dac8a7dbf68e7146d0d3927e220f87`는 FINALIZE12·`recovered=false`로 끝났고 A/B의 후보 원문·이미지·실행 설정을 대조했다. 기동 전 전체 논리 데이터·원래 키를 보존했다. 기동 후 identity 세션 1행의 해시가 달라 전체 세션 값 동일성은 주장하지 않는다. 기존 Chrome 로그인과 대화 표시는 실제로 유지됐다. [완료 상태](../../../../../.tmp/company-messenger-recovery-release-20261018/deployment-attempt2/live-status-1792297713408.json) · [운영 보존 검사](../../../../../.tmp/company-messenger-recovery-release-20261018/deployment-attempt2/runtime-live-postcheck-1792297736311.json).

**화면 확인 범위:** 실제 유호 Chrome에서 워크스페이스 홈 → 메신저 메뉴는 기존 대화·입력창이 표시됐다(재연결 클릭0). 도구가 붙지 않은 새 탭에서 사용자가 새로고침한 뒤 “연결을 다시 시도” 안내를 거쳐 버튼 없이 진입했다고 확인했다. 이후 해당 탭을 읽어 기존 로그인·대화·입력창·실시간 연결 표시를 확인했다. 실제 소요 시간은 측정하지 않았다. CUA 제어 탭에서는 별도로 문서 응답 일시 정지 오류가 관측돼 그 재현을 일반 사용자 새로고침 결과로 대체하지 않는다. 직접 `/messenger/` 외부 탐색403은 기존 서버의 별도 경계 문제다. [사용자 새로고침 확인](../../../../../.tmp/company-messenger-recovery-release-20261018/ui/production-user-refresh-confirmation.json) · [자동 진입 화면](../../../../../.tmp/company-messenger-recovery-release-20261018/ui/production-user-refresh-recovered.png) · [CUA 관측](../../../../../.tmp/company-messenger-recovery-release-20261018/ui/production-browser-observation.json).

**14:36 KST 잔여 지연 수정 운영 반영:** `/messenger/` 문서가 정상적으로 스크립트를 내려받는 중에도 부모가13초마다 iframe을 다시 여는 결함을 별도로 재현했다. 진행 중인 같은 출처 문서에는 최초 시도 기준 최대60초의 유예를 주고, 끝내 응답이 없으면 자동으로 다시 연다. `f239f3c8…`는 부모에 workspace 실행1·관련 시험1파일만 변경했다. 격리 Chrome7/7·앱142/142 통과: 매번14초 걸리는 스크립트 조건에서 기존3번/40.496초 → 수정1번/14.536초, 무응답 조건은60.616초에 자동 복구했다. 이는 가상 계정·로컬 HTTP 시험이며 실제 운영 HTTPS 속도 측정은 아니다. 배포 `0f2d6025d5391b904af352068dfcd1c1`은 FINALIZE12·recovered=false로 완료됐고 이미지 `dcb830e52337…`·기동 전 논리 데이터/원래 키·공개 메신저 파일8/8·HTTPS200/ready를 확인했다. 기동 후 identity 세션1행 해시 변화가 있어 전체 세션 값 동일성은 주장하지 않는다. 교체 후 백업·격리 복원·HA 재무장은 아래15:05 KST 인수에서 완료했다. [후보](../../../../../.tmp/company-messenger-loading-release-20261018/candidate-validation.json) · [브라우저 시험](../../../../../.tmp/company-messenger-loading-release-20261018/qa/browser-result.json) · [운영 후검사](../../../../../.tmp/company-messenger-loading-release-20261018/deployment/runtime-live-postcheck-1792301760178.json) · [공개 대조](../../../../../.tmp/company-messenger-loading-release-20261018/deployment/public-messenger-verification-1792301745782.json).

**사용자 지연 후속 · 격리 검증 완료:** 사용자는 위 첫 자동 복구 때10초 넘게 걸렸다고 알려왔고 최적화를 요청했다. 운영에는 자동 복구와 진행 중 다운로드를 취소하던 결함 수정이 반영돼 있다. 추가 압축/ETag 후보 `6b6471d02385…`는 실행2·신규시험1·Windows146/146이며, 같은 격리 HTTPS/H2·합성2Mbps/100ms 조건 각각3회에서 첫 진입 중앙값9.867→7.174초·새로고침5.494→2.705초를 확인했다. JS오류0. 후속 승인으로 **15:43 KST 최적화 운영 교체 완료:** 배포 `6f29c9cd26c5f4b705f84cedc0604646`·이미지 `743877c9…`·FINALIZE12·recovered=false. 공개8파일과 br/gzip·304 4파일/8표현 검사를 통과했다. 15:46 사후검사에서 기동 전 데이터·원키·기동 후 스키마 보존을 확인했으며 identity 세션1행 해시 변화는 기록했다. 첫 사후검사는 별도 복원 시험 컨테이너가 남아 차단됐고 담당자의 정상 종료/정리 뒤 같은 검사로 통과했다. 사용자는 실제 Chrome 새로고침이 버튼 없이 **4~10초**라고 답했으며 직접 계측값은 아니다. **16:23 KST RUN3 백업·격리 복원·HA 인수 완료:** 새 백업 generation1792306627310693, 원문1,026개·원키·계정9개 표·활성 세션/토큰·파일24개 보존과 격리 기동을 확인했다. request53a15da6-76ea-4ff4-a39a-bc90f3ab0850은 armed=true·A epoch7·B standby·복제 정상·HTTPS/TLS 정상, 같은 controller41.736초·재시작0이다. 최종 증거는 `.tmp/company-messenger-performance-release-20261018/rearm/arm-postcheck-final-v1.json`(SHA692f4dd405e9a5fb159cbcb42ac089a48f3f73057b2ea6c1c3fcb7fca3416651). 현재 판의 강제 장애 시험은 하지 않았다. 잔여 지연에는 내용 해시 캐시 후보를 준비했고 운영용 코드의 격리 새로고침 중앙값1.143초·회귀18/18을 확인해 승인된 백엔드 개선 작업의 v4에 함께 반영하도록 전달했다. **후속 v4 `c516b0e11d30…`는16:49 KST 운영 반영됐다.** FINALIZE·runtime·공개8파일 통과 후16:50 공개 캐시123/123(자산107개 포함)을 확인했다. 최종 소스1,030개 전후 SHA 대조를 포함한 격리 Chrome12회, 느린 회선 새로고침 중앙1.136초·JS오류0·재연결클릭0을 통과했다. 16:57 KST 운영 링크/F5 안내 뒤 사용자가 “오우 훨씬 빨라. 고마워”라고 확인했다. 실제 체감 개선은 확인됐으며 초 단위 실측은 아니다. Chrome 도구는 설정 차단 상태다. **17:27 KST v4 백업·격리 복원·HA 인수 완료:** 새 백업 generation1792310491636086·421,416,068B의 원문1,030개/원키/활성 세션·토큰/참조 파일24개 보존과 격리 기동을 확인했다. 만료 OAuth1개만 정상 정리됐으며 전체 행 완전 동일성은 주장하지 않는다. 최종 HA는 armed=true·A epoch7·B standby·복제/HTTPS/TLS 정상, 동일 controller32.159초·재시작0이다. 현재 판의 강제 장애 시험은 하지 않았다. [최종 HA 증거](../../../../../.tmp/company-backend-read-release-v4-20261018/rearm/arm-postcheck-final-v1.json)(SHA `3db77bc24767dd7e6220f779c77237424721b9f84dfdfccfeb066d4e53e09a85`). 공개 증거는 `.tmp/company-messenger-startup-perf-20261018/digest-experiment/production-cache-1792309804127.json`, UI는 같은 폴더 `v4-run-1792309588584/summary.json`이다. [전후 측정](../../../../../.tmp/company-messenger-startup-perf-20261018/compression-comparison.json) · [검증 상세](../../../../../tools/company-messenger/QA.md#voice-live-https-setup).

**15:05:53 KST 기존 운영 수정 인수 완료:** 후속 배포의 새 백업 generation1792302387415555(421,120,669B, SHA256 `07ebcfefd6873dd1aa4f742f6af421fc7219176ac28e9843d0dacf5a6dcf9376`) 업로드를 확인했다. 이전 완료 복원의 파생5경로만 정리해1,503,649,792B를 확보했고, 정본 백업2개·증거·현재/부모 원문과 이미지는 보존했다. 새 백업의 격리 앱 기동은 통과했고 원문1,025개·계정9테이블·활성 세션/토큰·원래 키 보존을 확인했다. [격리 복원](../../../../../.tmp/company-messenger-loading-release-20261018/rearm/dr/restore-v1.json)의 SHA256은 `0954d80864d320c175c0b4d445eecfb6c75e0d70642e16015f6e7bcae6fe6fab`다. 최종 HA는 `armed=true`·A owner epoch7·B 대기·복제 healthy·HTTPS200/ready/TLS, 같은 컨트롤러32.596초 관측·재시작0을 통과했다. `currentReleaseOutageTested=false`이며 이번 판의 새 강제 장애 전환은 시험하지 않았다. [완료 백업](../../../../../.tmp/company-messenger-loading-release-20261018/rearm/dr/backup-status-1792302460547.json) · [정리 증거](../../../../../.tmp/company-messenger-loading-release-20261018/cleanup-prior-dr-run-1792302789457.json) · [최종 HA](../../../../../.tmp/company-messenger-loading-release-20261018/rearm/arm-postcheck-final-v1.json).

**14:10 KST 운영 인수 완료:** Linux Node120/Python35·보호 원문 불변을 통과했다. 교체 후 백업 generation1792298396209520(421,046,243B)의 업로드·SHA를 확인하고, 격리 복원에서 원문1,025개·계정9테이블·활성 세션/토큰·원래 암호화 키 보존을 확인했다. 최초 복원은 공간 부족으로 디렉터리 생성 전에 멈췄으며 실패 기록을 보존했다. 정본 GCS 백업3개의 무결성을 검증한 뒤 이전 완료 복원의 파생 사본10개만 정리했고 원문·이미지·증거는 유지했다. 새 출력의 복원 검사와 자연 관측을 거쳐 HA `armed=true`·A owner epoch7·B 대기·복제 정상·HTTPS200/ready/TLS·루프 재시작0을 확인했다. 현재 릴리스에 새 강제 장애 시험은 하지 않았다. [백업](../../../../../.tmp/company-messenger-recovery-release-20261018/rearm-attempt2/dr/backup-status-1792298380197.json) · [격리 복원](../../../../../.tmp/company-messenger-recovery-release-20261018/rearm-attempt2/dr/restore-after-space-v1.json) · [최종 HA](../../../../../.tmp/company-messenger-recovery-release-20261018/rearm-attempt2/arm-postcheck-final-v1.json) · [사본 정리](../../../../../.tmp/company-messenger-recovery-release-20261018/cleanup-old-dr-run-1792299027375.json).

<a id="server-log-retention-20261016"></a>
## 공통 서버 반복 로그·보관 정책 — 2026-10-16

반복 경고의 원인은 배포 worker의 `UMask=0077` 아래 원자적 파일 교체가 요청한 권한을 다시 적용하지 않아 systemd drop-in이 `0600`으로 생성된 것이었다. A/B의 정확한 5개 파일씩에서 비밀값이 없음을 확인하고 `0644`로 교정했으며 내용 SHA와 앱·HA·rsyslog PID/상태를 보존했다. `company.env`·키·인증 파일의 권한은 변경하지 않았다. B의 동일 30초 표본에서 경고 **1,024→0건**, syslog 증가 **286,245→886B**였다. 첫 교정 직후 표본에는 과거 경고가 뒤늦게 기록되어, event 시각과 교정 이후 journal을 구분한 뒤 새 표본으로 확인했다. 이 수치는 해당 표본의 로그 감소이며 장기 성능 측정이 아니다. [교정 전](../../../../../.tmp/company-server-logs-20261016/remote/before-window-standby-1792125973461.json) · [시각 대조](../../../../../.tmp/company-server-logs-20261016/remote/mode-window-reconcile-1792126325243.json) · [새 표본](../../../../../.tmp/company-server-logs-20261016/remote/after-window-standby-1792126371337.json).

공용 원문 `c7a49d5ab`에 fd 권한 적용과 실제 파일 회귀를 반영했다. Linux에서 수정 전 권한 오류를 재현한 뒤 공용 **16/16**, 최신 부모의 보호 코드를 모두 보존한 다음 배포 worker 준비본 **30/30**을 통과했다. 완료된 배포의 worker와 기존 QA는 덮어쓰지 않았다. 다음 배포는 준비본의 권한 수정·회귀를 승계하고 새 worker SHA/QA를 고정해야 한다. [원문 검증](../../../../../.tmp/company-server-logs-20261016/implementation/verification.json) · [최신 worker 승계](../../../../../.tmp/company-server-logs-20261016/implementation/successor-worker-preparation.json).

정책 원문은 [SYSTEMD](deploy/SYSTEMD.md#호스트-로그와-설정-파일-권한)를 따른다. syslog는 주간 또는 **128MiB 초과** 때 회전하고 최근 **8회분**을 압축 보관한다. 기존 logrotate를 매시간 실행하며 최대 5분 분산·1분 정확도를 적용한다. auth·kernel·mail·user·cron은 기존 주간 4회분 정책을 유지한다. journal은 영구 **512MiB**, 파일64MiB, 디스크 여유1GiB, 메모리64MiB, **최대30일**이다. 크기 회전은 실행 시 판정하며 8주·최소30일 보관이나 순간적인 절대 용량 상한을 보장하지 않는다. 기존 Docker 제한(company/Caddy10m×3, spaceship5m×2)은 유지한다. 실제 Linux logrotate의 비강제 크기 회전10회·8개 보관·압축 읽기·매회 새 파일 기록·기타5로그 보존·전체 설정 검사도 통과했다. [정책·실제 worker 시험](../../../../../.tmp/company-server-logs-20261016/remote/isolated-qa-continuation-1792126589056.json).

**14:17:29 KST 세 서버 운영 반영·후검증 완료.** 기존 journal·syslog 이력51개 **3,659,002,443B→526,694,603B**를 `/var/lib/synk-log-archive/20261016-retention-v1/<role>`의 root 전용0700/파일0600 보존본으로 압축하고, 해제한 바이트 수·SHA-256과 원문을 대조했다. 이 일회성 보존본과 기존 별도 압축 이력은 새512MiB/30일 삭제 범위에 넣지 않는다. 실제 journal은 A222,821,816B·B468,233,776B·관리75,261,208B이며 모두 상한 이내다. B의 디스크 여유는 **2,408,394,752B 증가**했다. 세 노드의 정책3파일 SHA/0644·매시간 타이머·1분 정확도·journald 실효 설정·설정 인식 오류0·새 반복 경고0을 확인했다. 회사 앱·HA·rsyslog를 재시작하지 않았고 journald와 logrotate 타이머만 재시작했다. [A 후검사](../../../../../.tmp/company-server-logs-20261016/remote/retention-postcheck-primary-1792127798556.json) · [B 후검사](../../../../../.tmp/company-server-logs-20261016/remote/retention-postcheck-standby-1792127721312.json) · [관리 서버 후검사](../../../../../.tmp/company-server-logs-20261016/remote/retention-postcheck-controller-1792127849756.json).

B의 긴 보관 작업 중 SSH 대기 제한이 끝났으나 동일 원격 PID가 계속 실행해 완료 영수증을 먼저 저장했다. 이후 닫힌 stdout에서 발생한 `phase=complete/BrokenPipeError` 기록도 보존했고, 재실행 없이 완료 영수증·실제 설정·사용량·서비스를 읽어 완료를 판정했다. [같은 실행의 완료 결과](../../../../../.tmp/company-server-logs-20261016/remote/retention-result-standby-recovered.json).

14:17:23 SNS 읽기에서 기존 manifest `f1978e99…`·앱 시작 시각/재시작 횟수·A owner epoch7·HA armed=true·실행 원문을 보존했고, 게시 연결3개·댓글 연결2개에 오류가 없으며 예약3건의 시각/옵션/시도0이 작업 전과 정확히 같았다. 공개 HTTPS200/ok/ready도 확인했다. 새 SNS 발송·DB/계정 쓰기·앱 릴리스 교체·서버 증설·구독·유료 API 추가0. 기존10월22일16시 확인 일정은 유지한다. [SNS 최종 읽기](../../../../../.tmp/company-sns-soak-20261015/release-prep/observations/sample-1792127843921.json) · [공개 상태](../../../../../.tmp/company-server-logs-20261016/public-health-final.json) · [통합 검증](../../../../../.tmp/company-server-logs-20261016/final-summary.json).

<a id="sns-auth-production-20261016"></a>
## SNS 장기 인증·자동 갱신 — 2026-10-16 운영 인수

최종 원본 `e20c71ff28a8c0e6c04316dfc63777fd7f9365c1`, manifest `f1978e99e62bf485dab91c7aa3dea8b3e4694757c02553582fe6b26753b2c148`, 이미지 `sha256:8a0fb710c793c4382e5e6064dbbfff15838b76f3b169023f80de995541246791`. 자동 갱신 보완 b9 위에 Facebook Page 데이터 접근 만료 예외를 반영했다. 부모 원문1,016개를 보존하고 실행4·시험4파일만 바꿔 source1,024·payload594로 고정했다. Windows/Linux 각각1,255/1,255·이미지 호환2/2, HA Node119·Linux Python35를 통과했다. [기능·실제 갱신·검증 범위](WORKSPACE_QA.md#sns-auth-refresh-20261016).

- **반영:** 12:51:23 KST 배포 `47d05f7a7d63e25dc2213acc445d18a2`의 실행·공개126/126·HTTPS200/ready·익명SNS401을 확인했다. 기동 전 전체 데이터와 암호화 키 보존, 기동 후 세션/토큰 표의 정확한 일치·변경 표0을 확인했다. [실행 대조](../../../../../.tmp/company-sns-page-auth-20261016/deployment/runtime-live-postcheck-1792122683478.json) · [공개 검증](../../../../../.tmp/company-sns-page-auth-20261016/deployment/public-verification-1792122692812.json).
- **실제 갱신·계정:** 12:45:47 KST 자동 갱신 보완 b9에서 YouTube 토큰이 자연 갱신됐으며 계정·소유자 바인딩·기존 동의 시각·scope 수가 유지됐다. 12:51:32 최종 f197 운영의 관련 실행6파일 SHA가 수정본과 같고 SNS3계정은 모두 연결 정상·재연결 요구0이다. 관측 도구의 강제 갱신·SNS API·DB 쓰기0. Instagram의 장기간 경과는 주입 시계 시험이며 실계정 수개월 경과를 확인한 것은 아니다. [수정본 실제 갱신](../../../../../.tmp/company-sns-auth-20261016/live/youtube-natural-renewal-after-fix.json) · [최종 인증 메타데이터](../../../../../.tmp/company-sns-auth-20261016/live/credential-status-1792122692753.json).
- **백업·격리 복원:** 최종 백업 generation1792123187846585(420,746,312B, SHA256 `ca05f92958c4f0ed3c0531c4e7f2db8587640bff0ff7cae78f69a3cead442e66`)의 업로드·원문 해시·완료 영수증을 확인했다. 13:27:31 KST 격리 복원에서 source1,024·계정9테이블·세션/토큰15행·원래 암호화 키를 보존했다. 만료 토큰 삭제0·외부 요청0·network none·공개 포트0·시험 컨테이너 제거를 확인했다. [완료 백업](../../../../../.tmp/company-sns-page-auth-20261016/rearm/dr/backup-status-1792123369286.json) · [격리 복원](../../../../../.tmp/company-sns-page-auth-20261016/rearm/dr/restore-v1.json).
- **최종 HA·SNS:** 13:33:16 KST armed=true·A owner epoch7·B 대기·복제 정상·HTTPS200/ready/TLS·루프 재시작0을 확인했다. 자연 관측은19표본·3리전·1,160,446ms·오류0이며 새 강제 장애 시험은 하지 않았다. 13:33:46 별도 읽기에서 양 노드 원문 각1,024개 SHA 일치, 현재 게시3계정·댓글2연결 정상, 예약3건의 시각/비공개/구독자 알림 꺼짐/시도0 보존, 경고0이었다. 장기 관측 계획은 기대 manifest 한 필드만 f197로 갱신했고 기존 작업·일정·옵션·자동화는 변경하지 않았다. [계정 기준선](../../../../../.tmp/company-sns-page-auth-20261016/rearm/account-baseline-final-v1.json) · [자연 관측](../../../../../.tmp/company-sns-page-auth-20261016/rearm/natural-final-v1.json) · [최종 HA](../../../../../.tmp/company-sns-page-auth-20261016/rearm/arm-postcheck-final-v1.json) · [최종 SNS 기준선](../../../../../.tmp/company-sns-soak-20261015/release-prep/observations/baseline-1792125226925.json) · [기존 계획 한 필드 승격](../../../../../.tmp/company-sns-page-auth-20261016/existing-plan-promotion.json).
- **보존·비용:** 기존 예약3개와10월22일16시 확인 일정을 유지한다. 새 SNS 게시·댓글 발송·권한 확대·구독·유료 AI API·서버 증설0. 공간 확보는 로컬 전체 원본1,792개가 정확히 보존된 과거 실패 QA의 중복 소스2곳, 이전 완료 전송 사본2곳, 이전 복원 파생5곳만 정리했다. 실패 QA를 성공으로 바꾸지 않았고 원본 백업·검증 기록·활성 로그·현재/부모 소스와 이미지·mobile·기타 QA10은 보존했다. [원본 보존 소스 정리](../../../../../.tmp/company-sns-page-auth-20261016/qa/retained-stage-sources-v3-result-1792124415631.json) · [전송 사본 정리](../../../../../.tmp/company-sns-page-auth-20261016/qa/stage-transfer-result-1792124490898.json) · [복원 파생 정리](../../../../../.tmp/company-sns-page-auth-20261016/cleanup/result-v1.json).

<a id="sns-health-production-20261016"></a>
## SNS 계정 점검 주기·공정성 — 2026-10-16 운영 인수

원본 `b3453b3e73f882ff276e7591f8812f746d80fe8d`, manifest `574180783026dd4c21cff594e42a19d7111e7dc51ac8a4911a20149b57fdfc2e`, 이미지 `sha256:7dfbc80bdd7b9e306a10815e6605ac79265d1e37f19d4518b6237bc73753e71f`. 부모 `97f0382c…`의 나머지 1,019파일을 보존하고 실행 2·시험 2파일만 변경했다. Windows/Linux 각각 1,200/1,200·호환성 2/2를 통과했다. [기능·검증](WORKSPACE_QA.md#sns-health-cadence-20261016).

- **반영:** 09:34 KST 배포 `5ec9b7d34e3a4247723b45ec931f05c2`의 runtime·공개 126/126·HTTPS ready 검증을 마쳤다. 10:01:26 새 백업·격리 복구·HA 운영 인수까지 완료했다. [실행 대조](../../../../../.tmp/company-sns-health-20261016/deployment/runtime-live-postcheck-1792110808894.json) · [공개 검증](../../../../../.tmp/company-sns-health-20261016/deployment/public-verification-1792110846880.json).
- **백업·격리 복구:** 새 백업 generation `1792111362742360`(420,521,944바이트)의 원본·SHA-256을 대조하고 09:53:50 KST 격리 앱 기동을 통과했다. 계정 9테이블·활성 세션/토큰·원래 암호화 키를 보존했고 만료 토큰 삭제 0, 외부 네트워크/공개 포트 0, 시험 컨테이너 제거를 확인했다. 현재 버전으로 강제 장애 전환을 시험한 것은 아니다. [완료 백업](../../../../../.tmp/company-sns-health-20261016/rearm/dr/backup-status-1792111357314.json) · [격리 복원](../../../../../.tmp/company-sns-health-20261016/rearm/dr/restore-v1.json).
- **최종 HA·SNS:** A owner epoch7·B 대기·복제 정상·armed=true·HTTPS 200/ready/TLS를 확인했다. 정상 상태의 기존 관측은 18표본·3리전·1,120,473ms에서 오류 0이며 최종 HA 루프 관측 중 재시작 0이다. 10:01:51 별도 읽기에서 양 노드 원문 각 1,023파일·현재 SNS 연결 3개·예약 3건의 옵션/시도 0·발행 4건을 확인했고 경고 0이었다. 실제 7일 경과·연속 가용성·이번 버전의 강제 장애 전환까지 입증한 것은 아니다. [계정 기준선](../../../../../.tmp/company-sns-health-20261016/rearm/account-baseline-final-v1.json) · [자연 관측](../../../../../.tmp/company-sns-health-20261016/rearm/natural-final-v1.json) · [최종 HA](../../../../../.tmp/company-sns-health-20261016/rearm/arm-postcheck-final-v1.json) · [SNS 기준선](../../../../../.tmp/company-sns-soak-20261015/release-prep/observations/baseline-1792112511095.json).
- **보존·비용:** 기존 예약 3건·실제 발행/답장 기록을 보존하며 새 SNS 쓰기는 실행하지 않았다. 공간 확보는 확인된 과거 전송·복원용 파생 사본만 정리했고 원본 백업·소스·실행 이미지를 유지했다. 새 구독·유료 AI API·서버 증설·SSH 범위 확대 없이 기존 운영 자원을 사용했다. [부모 복원 사본 정리](../../../../../.tmp/company-sns-health-20261016/cleanup/result-v1.json).

<a id="sns-soak-production-20261015"></a>
## SNS 장기 예약·실계정 발행·답장 — 2026-10-15~16 운영 인수

**10월 16일 07:29 KST 후속 화면 수정 `97f0382c…`까지 운영·백업 복원·HA 인수를 완료했다.** 실제 7일 예약 경과는 10월 22일 최종 확인 대상으로 남는다.

**예약 내구성·Facebook 댓글 관계 검증·YouTube 결과 대조 수정은 10월 15일 운영 반영을 완료했다.** 원본 `987596e65f52b592936628c6d9fb0310778195ba`, manifest `8684bfc0feaf719f1d94e34a2619909d78614439fc0496fdd64a608e5db8ee42`, 이미지 `sha256:218dc2642df2c371e1af097609bcf3b7af8a7c0996f6cac6b97a936d9d22bb43`이다. Windows/Linux 각각 1,190/1,190·이미지 호환성 2/2, 공개 126/126·HTTPS ready를 확인했다. [운영 대조](../../../../../.tmp/company-sns-soak-release-20261015/deployment/public-verification-1792025660982.json) · [세부 기능·실제 결과](WORKSPACE_QA.md#sns-soak-release-20261015).

- **복원·HA:** 10월 15일 11:33 KST 새 백업(420,250,172바이트, generation `1792026226278837`)의 격리 복원·계정 보존과 HA 인수를 완료했다. A owner epoch7·B 대기·복제 정상·armed=true·공개 HTTPS/TLS 정상, 새 강제 장애 전환 시험은 하지 않았다. 기존 파생 캐시 5개만 정리했고 원본 증거·이미지·백업은 유지했다. [최종 인수](../../../../../.tmp/company-sns-soak-release-20261015/rearm/arm-postcheck-final-v1.json).
- **실제 외부 결과:** 10월 15일 시험 Facebook 댓글 1개 수집과 답장 1개를 공개 화면·API·전송 원장에서 확인했다. YouTube 11:37 예약 영상은 11:37:27 공개 발행·처리 완료됐고 로그인 브라우저에서 5초 끝까지 재생했다. 재전송·고객 댓글 답장·삭제는 하지 않았다. [Facebook](../../../../../.tmp/company-sns-soak-20261015/facebook/observation-v2-1792031733491.json) · [YouTube](../../../../../.tmp/company-sns-soak-20261015/youtube/publication-observation-1792032059681.json).
- **후속 화면 수정:** 실제 답장 전송 중에 응답 유실 경고를 먼저 표시하던 문제를 고친 `c993248d78f2f16312d440af64c6b99bd9df96b9`를 push했다. 후보 `97f0382c8909bb6266fab00f556b18b465df8e0f353001957ae04fd428914654`는 원문 1,023개·이미지 목록 594개, 변경 2개(실행 1)·부모 보존 1,021개·삭제 0이다. Windows/Linux 각각 1,193/1,193·이미지 호환성 2/2를 통과했고, 이미지 `sha256:3241341a22a31ec56b63304250ed97a1ca38198cb8353d8964a1ed32cad3e0dc`의 운영 반영을 완료했다. [후보](../../../../../.tmp/company-sns-reply-ui-20261015/candidate-validation.json) · [Windows](../../../../../.tmp/company-sns-reply-ui-20261015/qa-v2/result.json) · [Linux](../../../../../.tmp/company-sns-reply-ui-20261015/deployment/reviewed-candidate-receipt.json).
- **후속 운영 검증:** 10월 16일 06:47 KST 동일 배포 `a9725b481b58631cdf16c9740e1c800d`가 완료됐고 새 버전의 공개 126/126·HTTPS ready·익명 SNS 접근 401을 확인했다. SSH 응답 실패는 노드별 실행 여부를 대조해 미시작 역할만 이어갔으며 먼저 시작된 역할을 중복 기동하지 않았다. 기동 전 논리 데이터는 정확히 보존됐다. 기동 후 기존 로그인 세션 1개는 유지되지만 행 해시가 달라져 모든 세션 값의 완전 동일성은 주장하지 않는다. 실제 기존 브라우저 새로고침은 재로그인 없이 성공했다. [실행 상태](../../../../../.tmp/company-sns-reply-ui-20261015/deployment/live-status-1792100835856.json) · [운영 보존](../../../../../.tmp/company-sns-reply-ui-20261015/deployment/runtime-live-postcheck-1792100863378.json) · [공개 대조](../../../../../.tmp/company-sns-reply-ui-20261015/deployment/public-verification-1792100885174.json) · [실제 화면](../../../../../.tmp/company-sns-reply-ui-20261015/ui/production-browser-verification.json).
- **후속 백업·격리 복구:** 새 백업 generation `1792101395315829`(420,409,609바이트)의 원본·SHA-256·영수증을 고정하고 07:22 KST 격리 앱 기동을 통과했다. 계정 9테이블·활성 세션/토큰·원래 암호화 키를 보존했고 만료 토큰 삭제 0, 외부 네트워크/공개 포트 0, 시험 컨테이너 제거를 확인했다. 최초 시험은 마지막 클라우드 조회에서 실패해 완료로 인정하지 않았다. 실패 원문을 남기고 같은 archive/prepared/읽기 전용 snapshot 전체를 재검증한 뒤 새 시험 사본에서 기동 검사만 재수행했다. 전체 다운로드·복원 재실행과 운영 쓰기는 0이다. [완료 백업](../../../../../.tmp/company-sns-reply-ui-20261015/rearm/dr/backup-status-1792101435930.json) · [최초 중단](../../../../../.tmp/company-sns-reply-ui-20261015/rearm/dr/restore-v1.json) · [최종 복구](../../../../../.tmp/company-sns-reply-ui-20261015/rearm/dr/restore-continuation-v1.json).
- **최종 HA:** 07:29:13 KST `armed=true`·A epoch7 단일 writer·B 대기·복제 healthy·HTTPS 200/ready/TLS를 확인했다. 정상 상태 관측은 6표본·3리전·320,176ms에서 오류 0이며, HA 루프 관측 중 재시작 0이다. `currentReleaseOutageTested=false`로 이번 버전의 강제 장애 전환 시험과 연속 가용성은 입증하지 않았다. [계정 기준선](../../../../../.tmp/company-sns-reply-ui-20261015/rearm/account-baseline-final-v1.json) · [자연 관측](../../../../../.tmp/company-sns-reply-ui-20261015/rearm/natural-final-v1.json) · [최종 HA](../../../../../.tmp/company-sns-reply-ui-20261015/rearm/arm-postcheck-final-v1.json).
- **기존 공간 재사용:** B 노드에서 과거 4개 버전의 배포 준비용 소스 사본·이미지 전송본 8개만 정리해 실제 1,020,239,872바이트를 확보했다. 현재·부모 버전과 설치 원본 소스·이미지, stage 증거 106개, 원본 백업·운영 데이터는 보존했다. 이어 부모 복원 시험의 파생 사본 5경로만 정리해 1,500,397,568바이트를 회수했고 원본 증거 7개·클라우드 백업 2세대·현재/부모 소스와 이미지의 보존을 대조했다. [배포 사본 정리](../../../../../.tmp/company-sns-reply-ui-20261015/qa/old-stage-cache-result-1792099800397.json) · [복원 사본 정리](../../../../../.tmp/company-sns-reply-ui-20261015/cleanup/result-v1.json).
- **실제 시간 경과:** YouTube 비공개 예약 3건은 10월 16·18·22일 각각 15:00 KST다. 10월 22일 16:00 최종 확인 1회(`synk-sns-7`)를 등록했고, 실제 7일 경과·장기 토큰 갱신·연속 가용성은 아직 검증 전이다. [예약 계획](../../../../../.tmp/company-sns-soak-20261015/seven-day-plan.json) · [후속 확인 등록](../../../../../.tmp/company-sns-soak-20261015/seven-day-followup.json).
- **최종 SNS 읽기:** 07:30 기준선에서 예약 3건의 날짜·비공개·알림 끔·시도 0과 발행 4건·5분 초과 지연 0을 확인했다. Instagram은 저장 상태 connected·오류 없음이나 확인 시각이 5,845초 전이어서 관측의 freshness `attention`을 그대로 남겼다. 사전 백업과 선택 11행 대조는 10행 완전 동일이며 원댓글 1행의 수집 확인 정보 2필드만 달라졌다. 엄격 비교기의 `held` 원문과 차이를 보존하고 전체 행 동일로 보고하지 않는다. [기준선](../../../../../.tmp/company-sns-soak-20261015/release-prep/observations/baseline-1792103407514.json) · [보존 대조와 해석](WORKSPACE_QA.md#sns-soak-release-20261015).
- **접속·비용:** 10월 16일 PC 주소는 기존 허용 범위로 돌아왔으며 새 주소나 권한을 추가하지 않았다. 이전 승인으로 넣은 임시 SSH 주소를 두 규칙에서 제거하고 기존 4개 허용 범위와 나머지 설정의 보존을 확인했다. [기본 노드 규칙](../../../../../.tmp/company-sns-soak-release-20261015/qa/temporary-ssh-primary-remove-v1.json) · [대기·관리 노드 규칙](../../../../../.tmp/company-sns-soak-release-20261015/qa/temporary-ssh-ha-remove-v1.json). 새 구독·유료 API·서버 증설·Postiz 설치·로컬 LLM 의존은 없다.

<a id="sns-followup-production-20261015"></a>
## SNS 예약 몰림·게시 대조·댓글 상태·유입 검증 — 2026-10-15 운영 인수

**07:45:50 KST 운영 후검사와 08:10:10 KST 복원·HA 인수를 완료했다.** manifest `31db29ba898ff2f3bbe799a3bf347e1057344ad131c64b2874e71a1cfcb86feb`, 이미지 `sha256:0f7f14195f859b9366214146b8711a7971890bda56ecbca9863e2c67ff387dfc`, 원본 커밋 `bcc3af7699bc1a54e0c17c8ed61fd617a469c027`이다. 첫 진입·대량 조회 릴리스 위에 10파일(실행 5)을 반영하고 부모 원문 1,012개를 보존했다. 최종 원문 1,022개·이미지 목록 594개이며 DB 스키마 변경은 없다. [원본 push](../../../../../.tmp/company-sns-followup-20261015/git-verification.json) · [최종 검증 묶음·원문 115개](../../../../../.tmp/company-sns-followup-20261015/final-release.json).

예약 몰림은 전체 집계를 유지하며 서버에서 50건씩 이어 읽는다. Meta 결과 대조는 같은 시간창에서 최대 10쪽·500건을 확인하며 불완전하거나 모호하면 완료로 확정하지 않는다. 댓글은 최근 조회 한도와 과거 조회 진행 상태를 구분한다. 기존 프록시 경계와 위조 전달 헤더 처리는 실제 두 접속에서 확인했다. 공개 126/126파일 일치, 07:48:25 KST 화면의 기존 로그인·자동 발행 3계정·공식 댓글 연결 2계정·예약 몰림 상세·콘솔 오류/경고 0을 확인했다. [사용 흐름](WORKSPACE.md#sns-followup-20261015) · [검증과 측정 범위](WORKSPACE_QA.md#sns-followup-release-20261015).

기동 전 논리 데이터·파일·원래 키는 보존됐다. 기동 후 identity 세션은 1→1행이나 내용이 달라 **`postStartAllSessionAndTokenRowsExact=false`를 유지한다.** 이번 사전 백업과 현재 읽기의 계정 9테이블 기본키 집합이 같고 설명되지 않은 활성 세션 누락은 0이다. 유지된 identity 세션에서 인증 토큰·만료 시각 갱신을 확인했지만, 중지 시점 identity 평문과의 직접 일치나 개별 갱신 주체는 주장하지 않는다. [이번 배포의 보존 검토](../../../../../.tmp/company-sns-followup-20261015/qa/preservation-review-v2.json).

완료 백업 generation `1792018560937943`(420,030,087바이트)의 영수증·context·DR binding을 고정했고, 08:03:45 KST 네트워크 없는 복원 사본의 정상 기동·계정 9테이블·활성 세션/토큰·원키 보존을 확인했다(만료 토큰 삭제 0). 이전 DR 파생 5경로만 정리해 1,499,480,064바이트를 회수하고 원본 백업·증거·현재/부모 릴리스를 보존했다. 정상 동작 18표본·3리전·1,120,808ms의 오류 0과 HA `armed=true`·A epoch7 단일 writer·B 대기·복제 healthy·HTTPS/TLS를 확인했다. **`currentReleaseOutageTested=false`로 이번 판의 강제 장애 전환 시험은 미실시다.** 이번 작업의 추가 게시·답장·삭제, Postiz 결제·설치, 새 구독·서버 증설·유료 API 추가는 0이며 기존 서버 운영비가 없어지는 뜻은 아니다. [완료 백업](../../../../../.tmp/company-sns-followup-20261015/rearm/dr/backup-status-1792018559986.json) · [복원](../../../../../.tmp/company-sns-followup-20261015/rearm/dr/restore-v1.json) · [최종 HA](../../../../../.tmp/company-sns-followup-20261015/rearm/arm-postcheck-final-v1.json).

<a id="sns-query-production-20261015"></a>
<a id="ha-current-20261012"></a>
## SNS 첫 진입·대량 조회 — 2026-10-15 운영 반영

**06:13:40 KST 운영 후검사를 통과했다.** manifest `4abedf7b9d112e44a76e75b23062f2750200ad73533de0af5e64cb96c254a436`, 이미지 `sha256:cb6550b796de5b32846106136947797c7c43554f61f9faa8e1140a215066f8f0`, 원본 커밋 `6f803f4c09607985f0c708db5eaf53e2b67b6368`이다. 공용 3차 합본 위에 요청 범위 12파일(실행 8)을 반영했고 부모 원문 1,010개를 보존했다. 최종 원문 1,022개·이미지 목록 594개이며 DB 스키마 변경은 없다. [원본 push·후보 대조](../../../../../.tmp/company-sns-query-20261015/source-commit.json) · [운영 후검사](../../../../../.tmp/company-sns-query-20261015/deployment/runtime-live-postcheck-1792012420155.json).

첫 진입은 조회 중·실제 실패·재시도를 구분한다. 원고·게시 작업은 서버에서 50건씩 읽고 필터별 전체 집계·날짜별 일정 수·개요 미리보기를 별도로 유지하며, 상세 원문과 전체 작업은 필요할 때 가져온다. 예약 몰림 목록도 50건씩 표시해 접힌 영역의 수천 개 항목 렌더를 줄였다. 화면 이탈·다른 원고 열기 뒤 늦게 도착한 응답의 덮어쓰기를 막았다. [구현 범위](WORKSPACE.md#sns-query-20261015) · [검증 범위](WORKSPACE_QA.md#sns-query-release-20261015).

공개 126/126파일 일치와 기존 로그인에서 첫 로딩→정상 화면, 달력의 기존 게시 3건·자동 발행 3계정·공식 댓글 연결 2계정, 관측한 콘솔 오류·경고 0을 확인했다. 이번 검증의 추가 게시·답장·삭제와 새 구독·서버 증설·유료 API 추가는 0이다. Postiz와 로컬 LLM PC를 요구하지 않는다. [공개 대조](../../../../../.tmp/company-sns-query-20261015/deployment/public-verification-1792012433950.json) · [운영 화면](../../../../../.tmp/company-sns-query-20261015/qa/production-browser-verification.json).

**06:36:54 KST 새 백업·격리 복원·HA 재활성화까지 완료했다.** 복원 사본의 계정 9테이블·활성 세션/토큰·원래 암호화 키를 보존하고 정상 기동을 확인했다(격리 사본의 만료 토큰 삭제 0). 기존 시험의 파생 캐시 5개만 정리해 약 1.50GB를 확보했으며 원본 백업·증거·현재/부모 릴리스를 보존했다. 정상 동작 18표본·3리전·1,090,421ms에서 오류 0, 최종 HA armed=true·A epoch7·B 대기·복제 healthy·HTTPS200/ready/TLS를 확인했다. 현재 버전의 새 강제 장애 전환 시험은 하지 않았다. [복원](../../../../../.tmp/company-sns-query-20261015/rearm/dr/restore-v1.json) · [정상 관측](../../../../../.tmp/company-sns-query-20261015/rearm/natural-final-v1.json) · [최종 HA](../../../../../.tmp/company-sns-query-20261015/rearm/arm-postcheck-final-v1.json) · [최종 검증 묶음](../../../../../.tmp/company-sns-query-20261015/final-release.json).

<a id="sns-p6-production-20261015"></a>
## 이전 SNS 공용 3차 합본 — 2026-10-15 운영·HA 인수 완료

**04:44 KST 공용 SNS 3차 최적화·화면·직접 게시의 합본 운영 후검사를 통과했고, 05:20:21 KST 새 백업의 격리 복원 뒤 HA 인수를 완료했다.** 운영 manifest는 `3e30afd0c33d6c256f8e42f8bc8d80fa23c1d5ff90b80d9534a9d7f9683731b9`, 이미지 `sha256:7de917b3605e9cf4b050bfdead21c4096c34f5ea0afe1cfee42804f2b2fc8546`다. A epoch7 단일 writer·B 정상 대기(ready=false)·복제 healthy·공개 HTTPS200/ready/TLS를 확인했다. [최종 인수 증거](../../../../../.tmp/company-sns-p6-release-20261015/rearm/arm-postcheck-final-v1.json) · [최종 릴리스 요약](../../../../../.tmp/company-sns-p6-release-20261015/final-release.json).

기존 운영 부모 461a…의 1,017개 원문 위에 요청받은 SNS 공용 변경을 합쳤다. 최종 원문 1,019개·이미지 목록 593개, 변경·추가 51개(실행 24)·부모 968개 보존·삭제 0이다. 별도 client/creative/PULSE/desktop 신규 기능은 합치지 않고 기존 운영 범위를 유지했다. Claude 3차 `f4e0bcd9b`와 공용 화면·직접 게시 파일을 포함하며, 남은 SNS28파일은 `2ea8c404255d86916da8e67ce0323ec716888933`로 커밋·push했다. Git의 줄끝 정규화를 제외한 내용은 배포 후보와 같다. Linux 앱 1,089/1,089·호환성 2/2, HA Node119·Python35·배포 절차 126을 통과했고 실패·건너뜀 0이다. [후보 검증](../../../../../.tmp/company-sns-p6-release-20261015/candidate-validation.json) · [Linux 검증](../../../../../.tmp/company-sns-p6-release-20261015/deployment/reviewed-candidate-receipt.json) · [원본 push 확인](../../../../../.tmp/company-sns-p6-release-20261015/ops/git-sns-push.json).

사전 백업 뒤 SNS 발행 작업용 색인 3개만 별도 적용해 잠금 구간의 양DB 행·기존 파일·키를 보존했다. 첫 배포v1은 APPLY_PRIMARY 시간 초과로 새 writer 기동 전 복구되어 기존 운영판의 정상 응답을 확인했다. 같은 실패 작업을 재실행하지 않고 새 기준선을 고정한 v2 배포로 완료했다. v2의 기동 전 전체 논리DB·DB 외 파일은 CAPTURE와 일치했고 기동 후 스키마·원래 키도 보존됐다. 기동 후 `synk_identity_sessions`는 1→1행이나 집계 해시가 달라 원행 전체 보존·변경 원인을 단정하지 않는다. 별도로 실제 브라우저에서 기존 유호 로그인과 게시물 3개·자동 게시 3계정·댓글 수집 2계정을 확인했다. [색인 적용](../../../../../.tmp/company-sns-p6-release-20261015/ops/sns-index3-apply-result-1792005470136.json) · [첫 배포·복구 기록](../../../../../.tmp/company-sns-p6-release-20261015/ops/deploy-failure-receipts-1792006427806.json) · [v2 운영 후검사](../../../../../.tmp/company-sns-p6-release-20261015/deployment/runtime-live-v2-postcheck-1792007057841.json) · [공개 126/126](../../../../../.tmp/company-sns-p6-release-20261015/deployment/public-live-v2-postcheck-1792007068638.json) · [계정 화면](../../../../../.tmp/company-sns-p6-release-20261015/evidence/final-connections.jpg) · [게시 원장](../../../../../.tmp/company-sns-p6-release-20261015/evidence/postdeploy-calendar.jpg) · [댓글 화면](../../../../../.tmp/company-sns-p6-release-20261015/evidence/postdeploy-comments.jpg).

복원v1은 디스크 여유 관문에서 멈춘 기록을 보존했다. 무손실 로그 압축과 이전 검증 캐시 정리로 기존 디스크를 확보한 뒤, 새 백업 generation `1792007533476503`의 격리 복원v2가 05:16:41 KST 통과했다. 원문 1,019개·HA 파일 37개·원래 키·계정 9테이블 중 비토큰 8개·활성 세션/토큰을 보존했다. 만료된 pulse-session 토큰 1개만 복사본 기동 전에 정리해 3→2행이므로 전체 계정 테이블의 무변경으로 표현하지 않는다. 시계 조작·외부 요청·운영 트래픽 0, 시험 컨테이너 제거를 확인했으며 이 격리 시험은 실제 고객 로그인 시험이 아니다. [격리 복원v2](../../../../../.tmp/company-sns-p6-release-20261015/rearm/dr/restore-v2.json).

정상 동작을 18개 표본·3개 리전에서 1,100,542ms 관측해 오류 0을 확인했다. 새 요청 `4d267daf-24d0-449c-88ca-7cc2299e735b`의 최종 후검사는 HA `armed=true`로 통과했다. `currentReleaseOutageTested=false`를 유지하며 이번 버전의 실제 장애 전환 시험은 추가하지 않았다. [정상 동작 관측](../../../../../.tmp/company-sns-p6-release-20261015/rearm/natural-final-v1.json). 당시 남은 P2인 조회 시작 전 오류 문구 표시는 [후속 첫 진입·대량 조회 릴리스](#sns-query-production-20261015)에서 수정하고 운영 첫 진입으로 확인했다. 기존 세 플랫폼 OAuth·댓글 연결·공개 2/비공개 1 시험 원장을 유지했고 이번 합본 배포의 추가 게시·고객 댓글 답장/삭제와 새 구독·서버 증설·유료 API 추가는 0이다.

<a id="sns-direct-production-20261014"></a>
## 이전 SNS 직접 게시 릴리스 — 2026-10-14 최종 인수 완료

**19:06 KST 직접 게시 릴리스의 양노드 전환과 운영 후검사를 통과했고, 19:27 KST 새 백업·격리 복원 뒤 HA `armed=true`의 최종 운영 인수를 완료했다.** 이전 운영 부모 `7aeace53b532…`에서 manifest `461a38789e56f185bc4f2f1eb47c23a45365a5d73b0bef4bad3d55d45c0a5fca`, 이미지 `sha256:5b9d8c642ec0ba916e08f90dd1336a818cb89bbb124875d0e43f9f117a5ae55d`로 전환했다. A epoch7 단일 writer·B 대기·양노드 FINALIZE·controller job complete를 확인했다. 이번 새 릴리스에서 강제 장애 전환 시험을 추가 실행한 것은 아니다. [운영 후검사](../../../../../.tmp/social-direct-release-20261014/deployment/runtime-live-postcheck-1791972375411.json).

후보는 원문1,017개·이미지 목록593개, 부모 대비 변경·추가29개(실행13·시험16)·부모 원문988개 보존·삭제0이다. 고객11판·알림·SNS 기능을 포함한 관련72파일은 Windows950/950, 실제 격리 Linux 이미지950/950·호환성2/2를 통과했다. 별도 HA Node119·Python35·기존 배포 절차126개도 실패·건너뜀0이며 운영 자료 마운트·운영 쓰기·외부 SNS 호출 없이 수행했다. 초기 시험과 환경별 수치를 합산하지 않는다. [후보 검증](../../../../../.tmp/social-direct-release-20261014/candidate-validation.json) · [Linux 인수](../../../../../.tmp/social-direct-release-20261014/deployment/reviewed-candidate-receipt.json) · [검증 범위](WORKSPACE_QA.md#sns-direct-publishing-20261014).

19:06 KST 공개126/126파일 SHA·health200/ready·익명 SNS401을 확인했다. 19:08 KST 변경된 `app.js`·`social-workspace.js` 공개 바이트, 전용 미디어의 유효하지 않은 주소404, 운영 Caddy 설정 SHA `382af9df720aa15917a36fcb65dac5fc7e0e0d0f641e5ccb5b582a785c9ada7c`와 실제 URI 필터 적용을 확인했다. 공개 시험 중 실제 SNS 게시0·새 유료 자원0이다. [공개126파일](../../../../../.tmp/social-direct-release-20261014/deployment/public-verification-1791972382515.json) · [직접 게시 공개·프록시 검사](../../../../../.tmp/social-direct-release-20261014/ops/direct-public-check-1791972500564.json).

writer 정지 중 수집한 전체 논리 DB·DB 외 파일의 정확한 보존과 기동 후 스키마·원래 키 보존을 확인했다. 기동 후 `synk_identity_sessions`는1→1행이나 집계 해시가 달랐다. **19:18 KST 추가 읽기 진단에서 18:53 KST 사전 온라인 백업과 현재 세션의 기본키 집합이 같고 생성0·삭제0임을 확인했다.** 공통1행의 복호화에 성공했으며 바뀐 평문 필드는 `accessToken`·`expiresAt`·`refreshToken`뿐이고 나머지 사용자·세션·identity 연결 값은 같았다. 이 비교 범위에서 세션 삭제는 발견되지 않았고 토큰·만료 필드 변경이 관측됐다. 다만 사전 온라인 백업의 암호문 집계는 정지 CAPTURE 집계와 같지 않고 CAPTURE에 원행 값도 없어, **정지 CAPTURE 행 자체의 보존·실제 브라우저 로그인 연속성·변경 원인은 이 진단으로 확정하지 않는다.** 원 운영 검증과 새 백업 기준선을 대체하지 않으며 DB 쓰기·외부 통신·비공개 값 출력0이다. [온라인 백업 대비 세션 진단](../../../../../.tmp/social-direct-release-20261014/ops/identity-session-backup-comparison-1791973082330.json).

새 버전의 19:09 KST 데이터 백업419,125,680바이트는 generation `1791972966347938`, SHA `52d9a9b5711ebb756bd3901861ff93d4402e27dc677e0730231835f8bc370e20`로 업로드 완료됐다. 같은 invocation의 완료 이벤트·exit0·원래 키/보호 소스 보존·앱 재시작0을 확인했다. 19:22 KST 같은 generation의 격리 복원·기동을 통과했다. DB 논리 사본 동일·원래 키·identity 연결·참조 파일22개 보존, 자격증명4개 복호화·health ready·외부 요청0·시험 컨테이너 제거를 확인했다. 새 백업에 들어 있던 계정/세션 행과 토큰3→3(삭제0)도 격리 기동 전후 보존됐다. 이는 새 백업의 복원 검증이며 위 배포 전 정지 CAPTURE 비교의 한계를 소급해 해소하거나 실제 고객 로그인을 시험한 것은 아니다. [새 버전 백업 완료](../../../../../.tmp/social-direct-release-20261014/rearm/dr/backup-status-1791972975535.json) · [격리 복원·기동](../../../../../.tmp/social-direct-release-20261014/rearm/dr/restore-v1.json).

19:27 KST 새 요청 `91af9801-a96f-439f-a01e-603caf313e00`의 최종 후검사는 HA armed=true·A epoch7 ready·B alive/ready=false의 정상 대기·복제 healthy·공개 HTTPS200/ready/TLS 검증을 통과했다. 같은 controller PID128775·동일 invocation에서25.872초 관측, RECOVERED 이벤트와 재시작0을 확인했다. 새 백업·복원·계정 기준선·단일 owner 증거에 연결한 운영 인수이며 `currentReleaseOutageTested=false`·`noNativeRearmClaim=true`를 유지한다. 새 강제 장애 전환 시험은 추가하지 않았다. [최종 HA 인수](../../../../../.tmp/social-direct-release-20261014/rearm/arm-postcheck-final-v1.json).

임시 SSH 점검37회의 원래 설정 복원을 모두 확인했다. 파생 캐시6경로는 제거됐으나 추가 여유 공간 후검사가 held로 끝난 원기록을 보존했고 정리를 재실행하지 않았다. 이후 실제 격리 복원의 공간 관문은 통과했다. [최종 운영 인수 요약](../../../../../.tmp/social-direct-release-20261014/final-live-summary-v1.json).

19:09 KST 읽기 전용 SQLite 조회에서 전체 등록 계정34개(Instagram3·Facebook4·YouTube19·TikTok5·Threads1·LinkedIn1·X1)를 확인했다. 이전 기준선이 있는 직접 지원26개에서는 추가·삭제·계정 식별 변경·신규 인증·기존 인증 유실0이다. 기존 Instagram 댓글 연결1개는 활성·현재 연결 세대 일치·`canSync=true`를 유지한다. 이 조회 당시 새 OAuth 성공0·직접 게시 활성0·정확한 `socialPublishJobs`0개였으며 Instagram·Facebook·YouTube의 OAuth 앱 설정도 모두 미등록이었다. 아래 후속 연결 이전의 기준선이다. 토큰·계정 비공개 내용은 출력하지 않았고, 전체 자격증명 바이트 보존은 이전 지문이 없어 입증하지 않는다. [계정 상태](../../../../../.tmp/social-direct-release-20261014/ops/postdeploy-connection-inventory-1791972568030.json) · [비공개 내용 없는 검증 증거](../../../../../.tmp/social-direct-release-20261014/ops/postdeploy-connection-proof-1791972568030.json).

사용자는 추가 비용 없이 운영 반영과 실제 SNS 연결을 요청했다. 한때 Chrome 인증을 보류해 운영 배포부터 마친 뒤, 사용자 승인으로 앱 설정과 실제 계정 연결을 재개했다. **세 플랫폼 앱 정보를 SYNK에 암호화 저장했고 2026-10-15 KST 기준 Instagram `@yuhobuilds`·YouTube 유호빌드(`@yuhobuilds`)·Facebook SYNK(`@synkworld`)의 실제 OAuth·게시 권한 확인·자동 게시 활성화를 완료했다.** 운영 개요의 자동 발행3계정과 연결별 대기 일정0을 확인했다. Instagram 댓글 연결 점검은 정상이며 Facebook도 댓글2권한·계정 동의 뒤 SYNK만 수집을 켜 연결 점검·정기 수집을 확인했다. 후속 실제 예약 시험3건(공개2·비공개1)도 성공했다. [앱 설정·계정 연결 진척](../../../../../.tmp/social-direct-release-20261014/oauth-setup/progress-v1.json) · [Instagram 연결·활성 화면](../../../../../.tmp/social-direct-release-20261014/oauth-setup/instagram-connected-enabled.jpg).

Google은 기존 `radio24-bot` 데스크톱 클라이언트를 보존하고 새 웹 클라이언트 `SYNK Workspace SNS`를 생성·저장했다. 앱의 게시 상태는 Production이며 YouTube 유호빌드(`@yuhobuilds`) 선택 뒤 실제 OAuth 서버 저장·게시 권한 검증·자동 게시 활성화를 완료했다. 계정 연결 당시 대기 일정0을 확인했고, 아래 후속 시험에서 실제 비공개 업로드·처리·재생까지 확인했다. [YouTube 연결·활성 화면](../../../../../.tmp/social-direct-release-20261014/oauth-setup/youtube-connected-enabled.jpg). Instagram은 기존 DM 콜백을 보존한 채 워크스페이스 콜백을 추가했고, Facebook 콜백도 추가 후 다시 읽어 확인했으며 사용자 재인증으로 얻은 앱 정보를 저장했다. 10-14 사용자 승인 후 Facebook `PAGES_API` 이용 사례와 `pages_manage_posts`·`pages_read_engagement`·`pages_show_list`를 준비해 첫 OAuth scope 오류를 보완했다. 이후 `META_PAGE_ACCESS_REQUIRED`가 발생해 SYNK 선택·공개 페이지 ID 일치·포트폴리오 소유·사용자 전체 액세스를 확인했다. 21:51 KST 기존 대상 채널의 `externalId`·`connectionVersion`만1회 보정하고 감사 기록1개를 추가했으며 이 보정의 자격증명·토큰 쓰기·외부 요청·서버 재시작0, 운영 후검사 통과를 확인했다. 당시 동일3scope의 공식 `GET /me/accounts`는 LAB3개만 반환했고 `paging.next`가 없었다. **10-15 KST 사용자 명시 승인에 따라 SYNK Guide의 `business_management`를 `synk.mn` 포트폴리오(`1057004986835568`)1개에 저장하고 기존 페이지4개 선택을 유지했다.** Meta 저장 성공 뒤 공식 Graph Explorer의 `GET /me/accounts?fields=id,name,tasks` 결과4개에 SYNK(`1140051542527584`)와 `MANAGE`·`CREATE_CONTENT`가 포함됨을 확인했다. 이어 운영 SYNK의 Facebook OAuth 콜백 성공·인증 저장을 확인하고 대기 일정0에서 「권한 확인 후 자동 게시 켜기」를 실행했다. 최종 카드에서 자동 발행 가능·발행 연결·연결 확인·대기0, 운영 개요에서 자동 발행3계정을 확인했다. Facebook도 댓글2권한 추가·계정 동의를 마치고 기존4페이지 선택을 유지한 채 SYNK만 댓글 수집을 켰다. 연결 점검과 게시 연결 재검증은 정상이다. 03:50 KST 수동 재수집 없이 정기 수집 갱신을 확인했으며 이번 조회6게시물·0댓글(최근5·과거1), 과거 조회 한 바퀴 완료·일부수집 상태다. 첫03:33 수집의10게시물·0댓글·과거 이어받기 대기는 최초 기록으로 보존한다. Postiz·신규 구독·새 서버 비용 추가0이며 이 계정 연결 과정에서는 재배포·서버 재시작·키 재설정은 하지 않았다. 앱 심사 완료를 주장하지 않는다. [비즈니스 권한 저장](../../../../../.tmp/social-direct-release-20261014/oauth-setup/facebook-business-grant-saved-20261015.jpg) · [Facebook 연결·활성 화면](../../../../../.tmp/social-direct-release-20261014/oauth-setup/facebook-connected-enabled-20261015.jpg) · [대상 페이지 ID 보정](../../../../../.tmp/social-direct-release-20261014/ops/facebook-page-id-apply-result-v1.json) · [이전 콜백 실패 화면](../../../../../.tmp/social-direct-release-20261014/oauth-setup/facebook-callback-page-access-required.jpg) · [이용 사례 저장](../../../../../.tmp/social-direct-release-20261014/oauth-setup/facebook-pages-usecase-saved.jpg).

**2026-10-15 실제 예약·업로드 시험:** Instagram `@yuhobuilds`03:43 예약→03:43 [공개 게시](https://www.instagram.com/p/DefDdOEgcHx/), Facebook `@synkworld`03:46 예약→03:46 [공개 게시](https://www.facebook.com/122136096939343429/posts/122136098109343429)를 완료했다. 각 플랫폼 실화면의 대상·이미지·문구와 Facebook 전체 공개를 확인하고 SYNK 공개 확인을 각각03:45·03:47 기록했다. YouTube `@yuhobuilds`03:40 예약→03:40 [비공개 업로드](https://www.youtube.com/watch?v=m-1mBAmjdeI),03:44 처리 완료·게시됨 확인 뒤 본인 채널 로그인에서 비공개 표시와5초 끝까지 재생을 확인했다. 비공개 영상의 공개 확인 기록은 만들지 않았다. 총3업로드 성공(공개2·비공개1)·중복0·고객 댓글 작성/답장·삭제0·추가 비용/유료 자원0이다. [시험 결과·실화면 증거](../../../../../.tmp/social-direct-release-20261014/upload-test-20261015/actual-publish-results.json) · [Facebook 댓글 정기 수집](../../../../../.tmp/social-direct-release-20261014/oauth-setup/facebook-comments-auto-synced-20261015.jpg). 기존 배포·HA 기준선은 보존했고 이 시험을 위한 재배포·서버 재시작·키 재설정은 없었다.

<a id="company-combined-release-20261014"></a>
## 고객 관리11판·알림·SNS 통합 릴리스 — 2026-10-14 완료

**17:16 KST 실제 고객 역할의 답변 알림 확인을 완료했다.** 기존 `[휴대폰 체험] 나의 광고 제작 방향` 초대를 재사용해 운영 PULSE의 `customer` 화면에 연결했다. 사용자에게 별도로 승인받은 테스트 안내1건을 직원 화면에서 보내자, 고객 화면이 새로고침 없이 알림0→1과 「제작팀이 답했어요」를 표시했다. 알림 클릭은 같은 프로젝트의 「영상 확인 → 후속 문의와 답변」에 있는 바로 그 메시지로 이동했고, 메시지 ID 일치·초점·화면 안 표시를 확인했다. 새로고침 뒤 고객 연결과 읽음0·「확인함」이 유지됐고 고객 콘솔 오류0이었다. 새 초대 발급·기존 접근 종료·프로젝트 상태 변경은 하지 않았다. 확인 범위는 고객 앱 안의 제작팀 답변 알림1건이며 다른 알림 종류와 휴대폰·PC 운영체제 푸시는 미검증이다. [고객 수신·이동 증거](../../../../../.tmp/company-combined-release-20261014/ui/production-customer-verification.json) · [고객 도착 화면](../../../../../.tmp/company-combined-release-20261014/ui/production-customer-notification-target.jpg).

사용자가 고객 관리11판·알림·SNS 최적화의 통합 검증과 운영 반영을 승인했다. `.tmp/company-combined-release-20261014/`에 새 후보와 증거를 만들며, 고객 후보 `178b408d…` 및 원11판 후보는 보존한다. SNS12·13판 뒤에 최적화 차이만 병합했다. 14:46 KST 실제 읽기에서 양노드 부모 `2c401084…`·주 서버 이미지 `56ca0149…`·A epoch7·공개 ready·HA armed=true를 확인했고 임시 SSH 허용은 원복했다. 전환 전 백업416,887,134바이트·원격 generation1791958984106922·동일 invocation의 완료/exit0을 확인한 뒤 배포 job `495090fffeb1423342a0c85bd1c83581`을1회 실행했다. **15:31 KST 양노드 FINALIZE·controller complete·운영 후검사 통과, 15:32 공개126/126와 변경51/51파일 대조를 완료했다. 16:25:49 KST 새 백업의 격리 복원 뒤 HA armed=true·A epoch7 단일 writer·B 정상 대기·복제 healthy·공개 HTTPS200/ready를 인수했다.** Postiz는 추가 비용 없이 준비만 유지한다. [실제 부모 확인](../../../../../.tmp/company-combined-release-20261014/ops/parent-preflight-1791956790492.json) · [전환 전 백업](../../../../../.tmp/company-combined-release-20261014/deployment/backup-status-1791959048628.json) · [운영 후검사](../../../../../.tmp/company-combined-release-20261014/deployment/runtime-live-postcheck-1791959484928.json) · [공개126파일](../../../../../.tmp/company-combined-release-20261014/deployment/public-verification-1791959493148.json) · [변경51파일](../../../../../.tmp/company-combined-release-20261014/public-added-1791959523557.json) · [고객 CSS·루트 링크](../../../../../.tmp/company-combined-release-20261014/public-client-v1.json).

최종 통합 후보는 manifest `7aeace53b532ffce07a37419f78765a14419826bf0b08fe31405904ac2553671`, source1007·image payload588·부모 대비 변경168·보존839·삭제0이다. 첫 후보 `d217b4e0…`의 시험 두 곳만 보정했고 실행·자산은 그대로다. root의 독립 전수 대조에서 고객 실행70파일·알림28파일·Google 로그인과 델타 레이어169개가 확인됐다. 시험 보정2개 중 고객 시험1개 외에는 원 고객 변경 바이트를 보존했다. 관련149개 파일의 단일 로컬 회귀 시험은 1760개 중1758통과·실패0·Windows symlink권한 건너뜀2이며, **15:11 KST 실제 Linux 이미지에서1760개 전부와 호환성2개가 실패·건너뜀0으로 통과했다.** 이미지 `sha256:86e883d5fefc5adc7265f8c36b8f75857c006d4391ab41faa2bebb3a8b0421fc`의588파일을 대조했고 운영자료 마운트·서비스 변경·외부통신0이었다. 별도 HA Linux 검증도 Node119·Python35·배포126개 모두 건너뜀0으로 통과했다. SNS125개·고객/알림77개 격리 화면 검증을 끝냈고 최종 후보의 실행 바이트가 같음을 대조했다. [최종 후보 독립 대조](../../../../../.tmp/company-combined-release-20261014/root-final-review-1791958052817.json) · [최종 로컬 시험](../../../../../.tmp/company-combined-release-20261014/qa/final-result.json) · [Linux 인수](../../../../../.tmp/company-combined-release-20261014/deployment/reviewed-candidate-receipt.json) · [HA Linux](../../../../../.tmp/company-combined-release-20261014/rearm/linux-qa-result-v1.json) · [화면202개 연결](../../../../../.tmp/company-combined-release-20261014/ui/final-runtime-binding.json). 처음 실패한 시험·화면 증거와 보정 전 원본도 보존한다.

writer 중지 중 전체 논리 DB·DB 외 파일·원래 키의 정확한 보존을 확인했다. 기동 후 스키마는 같으나 `synk_identity_sessions`는2→2행의 집계 해시가 달라 전체 과거 세션 보존이나 차이의 원인은 확정하지 않는다. 이전 IAB 세션 연결1회는 `Browser is not available: iab`로 실패했고 입력·이동·세션 변경·운영쓰기0이었다. [이전 접근 한계](../../../../../.tmp/company-combined-release-20261014/ui/production-readonly-attempt.json). **16:44 KST 기존 Chrome 로그인 계정의 운영 화면 직접 확인을 완료했다.** 배포 전에 열린 탭을 새로고침한 뒤 고객 관리11판의 기존 프로젝트5개·CSS 실제 로드·7개 탭 전환을 확인했다. 새 소식의 기획 원문→동일 프로젝트 제작 설계, PULSE 알림함의 수령→이력·납품, 시안 승인→해당 시안·승인 글, 장면 의견→해당 프로젝트 장면 구성, 수정 의견 묶음→원래 시안·제출 의견의 다섯 이동을 확인했고 콘솔 오류0이었다. 연 알림4건만 읽음 처리(24→20), 고객 글 전송·프로젝트 상태 변경·시험자료 생성은 하지 않았다. 사용자 직원 계정과 기존 운영 검증 자료에서 확인한 범위이며 별도 고객 계정·모든 알림 종류·기기 푸시·장면 의견의 정확한 카드 초점·배포 전후 로그인 연속성까지 검증한 것은 아니다. [실계정 확인](../../../../../.tmp/company-combined-release-20261014/ui/production-real-account-verification.json).

새 버전 백업418,788,535바이트·generation `1791959979842990`·SHA `f760f5e3afd7df7a75c170d611a85b6057012c5a424d4dc9f401ae839bcf0204`의 완료·원키/보호소스 보존·앱 재시작0을 확인했다. 첫 격리 복원은 대기 서버 여유가 기존 기준7,172,946,068바이트에 미달해 **복원 디렉토리 생성 전** `STANDBY_REHEARSAL_SPACE_LOW`로 보류됐다. 기준과 원 실패 증거를 보존한 채 16:12 KST 검증된 파생본·배포 캐시 14경로만 정리해 1,890,803,712바이트를 회수했다. 정리 직후 여유는 7,319,388,160바이트였으며 원본 압축본·메타데이터·canonical 소스·loaded 이미지·205개 검증 소스의 보존과 참조 없음이 확인됐다. v1 잠금 파일의 /run 장치 판정 오류와 v2 나노초 시각의 JS 정밀도 차이는 삭제 시작 전에 중단됐고, 원증거를 보존한 v3에서 전체 대상 재검증 후 완료했다. [새 백업](../../../../../.tmp/company-combined-release-20261014/rearm/dr/backup-status-1791960075722.json) · [원 복원 보류](../../../../../.tmp/company-combined-release-20261014/rearm/dr/restore-v1.json) · [읽기 전용 조사](../../../../../.tmp/company-combined-release-20261014/cleanup/cache-inventory-v2-1791960800276.json).

16:18:36 KST 지정 generation의 독립 다운로드·전체 SHA/MD5 대조와 격리 복원을 통과했다. 원래 키·계정/세션9표·토큰3→3(삭제0)·외부요청0·시험 컨테이너 정리를 확인했고, 해당 백업의 원 스냅샷으로 운영 계정 기준선을 연결했다. 자연 관측1,150.588초·19표본·3지역·오류0을 확인한 뒤 새 요청 `08c0915d-dbb1-4a4b-8c35-0106cab01696`으로 재활성화했다. controller 같은 PID·invocation의 49.029초 관측·RECOVERED1·재시작0을 인수했고, 이번 버전의 새 강제 장애 전환 시험은 아니다. 임시 SSH33회의 원래 API 값 복원을 모두 확인했다. 16:26:08 KST 별도 공개 GET도 고객 CSS HTTP200·71,372B·전체 SHA256 `42204c949c709ef5bdaaccdf97ef252090e6a9f4001c5bb9903b0c94aab673a7`, 루트 HTML CSS 링크, 접수 포스터와 프로젝트 스크립트의 전체 SHA를 통과했다. [정리 결과](../../../../../.tmp/company-combined-release-20261014/cleanup/exact-cache-result-v3.json) · [격리 복원](../../../../../.tmp/company-combined-release-20261014/rearm/dr/restore-v2.json) · [최종 HA](../../../../../.tmp/company-combined-release-20261014/rearm/arm-postcheck-final-v1.json) · [최종 공개 확인](../../../../../.tmp/company-next-client-20261014/public-final-verification.json) · [인수 요약·53개 증거](../../../../../.tmp/company-combined-release-20261014/final-live-summary-v1.json).

<a id="sns-meta-followup-production-20261014"></a>
## 댓글 수집 재개·외부 답장 확인·재연결 복구 운영 반영 — 2026-10-14

**11:29 KST 회사 앱 교체 후 실제 수집·공개 답장1회·현재 로그인 상태의 새 백업·격리 복원·복원 원장 대조와 최종 HA 인수를 완료했다. `armed=true`·A epoch7 단일 writer·B 정상 대기·복제 healthy이며, 최종 공개126/126파일 일치·HTTP200/ready를 확인했다.** 부모 `0aac9438f17d…`에서 릴리스 `2c401084ce7c15103a86971104edbc498c8eb08c995da645dec71db400539797`, 이미지 `sha256:56ca0149b70b69fb195ce263cb38c8c6d6311a3815fc4bab26cb900b08f2731f`로 반영했다. source983·image payload570이며 실행 변경10개, 부모967파일을 그대로 보존했다. 기존 Google 로그인 입구와 공용 작업본의 별도 SNS 화면 작업을 보존했다. [최종 인수 증거](../../../../../.tmp/social-meta-followup-20261014/final-live-summary-v1.json) · [후보·시험](WORKSPACE_QA.md#sns-meta-followup-20261014) · [사용법](WORKSPACE.md#sns-meta-followup-20261014).

실제 Linux 후보의 관련 시험197개·호환성2개를 통과했고 기존 worker6·runtime4는 바이트 그대로 사용했다. 배포 job `12ea257c26b6e8156a990c558f5c7f79`는 양노드 FINALIZE·controller complete·exit0으로 끝났다. A epoch7 단일 writer·B 대기·control idle을 확인했다. [운영 검증](../../../../../.tmp/social-meta-followup-20261014/deployment/runtime-live-postcheck-1791944947347.json) · [공개126파일](../../../../../.tmp/social-meta-followup-20261014/deployment/public-verification-1791944955168.json). root의 별도 공개 GET도 댓글 UI·app·Google 로그인 코드3파일 SHA/크기와 health200/ready·익명 SNS401을 확인했다. [독립 공개 확인](../../../../../.tmp/social-meta-followup-20261014/root-public-1791944944230.json).

중지 중 전체 논리 DB·DB 외 파일·원래 암호화 키의 정확한 보존을 확인했다. 기동 후 `synk_identity_sessions`는1→1행이지만 집계 해시가 달라 전체 과거 세션 보존이나 차이의 원인을 확정하지 않는다. 원키·스키마·토큰2→2·메신저 세션은 대조 결과가 같으며 운영 DB를 백업으로 덮어쓰지 않았다. 실제 계정 브라우저 로그인 연속성은 검증하지 않았다.

실제 수집·health·지정 원댓글 미리보기는 GET14회로 저장했다. 전체 보호행 비교는 불일치로 보류되어 원 기록을 보존했으며, 읽기 전용 회수에서 게시물1·댓글6·저장한 진행 위치·connected·미리보기1을 대조했다. 회수는 추가 Meta0·DB쓰기0이고 전체 보호행의 불일치 원인은 미확정이다. [실제 저장 단계 확인](../../../../../.tmp/social-meta-followup-20261014/ops/stored-recovery-completion-1791946041263.json).

11:52:58 KST 사용자가 지정한 공개 댓글에 승인 문구로1회 답장했다. 해당 단계 GET11·POST1이며, Meta 실제 결과와 SYNK `sent`·중복 방지·문의함 전송 원장이 일치했다. 실행 전후 권한/현재 컨테이너/control과 이 구간의 보호행은 같았고 재전송은0이다. [실제 답장 검증](../../../../../.tmp/social-meta-followup-20261014/ops/live-reply-completion-1791946378952.json). 최종 백업은 현재 로그인 상태를 담은 416,881,512바이트·generation `1791951310505965`이며, 격리 복원에서 원키·계정9표·토큰2→2와 실제 답장1건의 원장을 확인했다. 과거 세션 한 쌍의 삭제는 사용자가 기억한 로그아웃과 부합하지만 원인은 확정하지 않고 원 차이·실패 기록을 보존했다. HA 새 요청 `c63a2f91-3ed2-4420-a608-e8f036317337`의 완료·후검사와 임시 SSH 허용59회의 원복을 확인했다. 자연 관측1,160.492초·19표본·3지역·오류0이며 이번 릴리스의 새 강제 장애 시험은 아니다. [최종 HA](../../../../../.tmp/social-meta-followup-20261014/rearm-v2/arm-postcheck-after-logout-v1.json). 다른 계정의 추가 인증은 별도 남아 있다. Postiz는 기존 [자체 설치 준비](../../../../../.tmp/social-workspace-live-20261013/postiz/README.md)만 유지하며 새 서버·구독·설치는 진행하지 않는다.

<a id="workspace-google-login-production-20261014"></a>
## Google 로그인 입구 운영 반영 — 2026-10-14

**10:28 KST 로그인 문구 반영, 10:53:12 KST 새 백업·격리 복원 뒤 HA `armed=true`·A epoch7 단일 writer·B 정상 대기·복제 healthy·공개 HTTPS200/ready를 확인했다.** 부모 `25bb4bff70bd…`에서 릴리스 `0aac9438f17d49c2efca01907efe505f0bf14f392077b9c48b4fd1f4a842f4b9`, 이미지 `sha256:00ec28633e8ed2b2ef75cd0438465083735f6759c99ff47c8ed12efcfeed3f64`로 반영했다. source978·image payload567 중 `public/synk-id.js` 한 파일의 3줄만 바꾸고 부모977파일과 기존 인증 경로·권한을 보존했다. 공용 작업본의 다른 SNS·고객 화면 변경은 포함하지 않았다. [최종 HA 인수](../../../../../.tmp/workspace-google-login-20261014/rearm/arm-postcheck-final-v1.json).

실제 후보 Linux 인증 시험67개·호환성2개를 통과했고, 공개 **126/126파일 SHA 일치**·health200/ready·익명 SNS API401을 확인했다. `Google · SYNK ID로 로그인` 버튼 문구·Google 가입자 안내와 `enabled=true`·`browserEnabled=true`도 공개 응답에서 확인했다. 실제 Google 계정 로그인 왕복은 시험하지 않았다. [후보 시험](../../../../../.tmp/workspace-google-login-20261014/deployment/reviewed-candidate-receipt.json) · [공개 파일](../../../../../.tmp/workspace-google-login-20261014/deployment/public-verification-1791941300043.json) · [로그인 입구](../../../../../.tmp/workspace-google-login-20261014/public-login-read-v1.json).

writer 중지 중 전체 논리 DB·DB 외 파일과 원래 키의 정확한 보존을 확인했다. 기동 후 `synk_identity_sessions`는2→2행이지만 집계 해시가 달라 모든 과거 세션 보존이나 변경 원인을 확정하지 않는다. 스키마는 같으며 운영 DB를 백업으로 덮어쓰지 않았다. [운영 전환·보존 검증](../../../../../.tmp/workspace-google-login-20261014/deployment/runtime-live-postcheck-1791941293799.json).

새 백업 **416,623,038바이트**·generation `1791941739110394`의 격리 복원은 **10:51:14 KST** 통과했다. 원래 키·계정/세션9표·토큰3→3 보존, 외부 요청0·시험 컨테이너 정리를 확인했다. 복원 전 공간 부족으로 중단한 기록은 보존하고, 원격 원본의 정확한 generation·해시와 기존 증거를 확인한 뒤 이전 복원 파생본·중복 다운로드6경로만 정리해 **1,905,430,528바이트**를 회수했다. 운영 자료·이미지·원격 원본·원증거는 보존했다. [백업 완료](../../../../../.tmp/workspace-google-login-20261014/rearm/dr/backup-status-1791941763553.json) · [격리 복원](../../../../../.tmp/workspace-google-login-20261014/rearm/dr/restore-v2.json) · [공간 정리·보존](../../../../../.tmp/workspace-google-login-20261014/cleanup/cache-cleanup-result-v1.json).

HA 재활성화 전 자연 관측은 **1,091.040초·18표본·3지역·오류 표본0**이다. 최종 controller 확인은 같은 PID·invocation의 **13.948초** 구간이며 재시작0·`RECOVERED`1건이 기록됐다. 이를 연속 무중단이나 새 강제 장애 전환 시험으로 표현하지 않는다. [자연 관측](../../../../../.tmp/workspace-google-login-20261014/rearm/natural-final-v1.json) · [최종 controller·HA 확인](../../../../../.tmp/workspace-google-login-20261014/rearm/arm-postcheck-final-v1.json).

10:54:16 KST 마지막 공개 읽기에서도 변경 스크립트 SHA·Google 문구·로그인 활성 설정·health200/ready를 확인했다. [최종 인수 요약](../../../../../.tmp/workspace-google-login-20261014/final-live-summary-v1.json)은 이번 증거18개를 연결한다.

<a id="sns-meta-production-20261014"></a>
## Meta 댓글 연결 운영 반영 — 2026-10-14

**회사 버전 `25bb4bff70bd…`와 `@yuhobuilds` 댓글 연결을 운영에 반영했다. 새 백업·격리 복원 뒤 HA `armed=true`, A epoch7 단일 writer·B 정상 대기·복제 healthy·maintenance0을 확인했다.** 공개 125파일 SHA·HTTP200/ready·익명 SNS401을 대조했고 10:00 KST 공개 health도 정상이다. [최종 인수 확인](../../../../../.tmp/social-meta-connect-20261014/rearm-v2/arm-postcheck-final-v1.json).

`@yuhobuilds`의 원댓글6건을 가져왔고 실제 Meta 계정 건강 점검·답장 미리보기가 성공했다. 추가 수동 수집 없이 마지막 성공 시각이 09:07→09:26→09:57 KST로 갱신됐다. **실제 댓글/DM 발송은 0**이며 기존 DM 앱·콜백·공개 자동 답글은 보존했다. 다른 Instagram 두 계정과 Facebook 네 채널은 필요한 인증/댓글 접근 검증이 남아 있다. Postiz 설치·신규 구독·VM 생성은 하지 않았다. [사용법](WORKSPACE.md#sns-meta-comments-20261014) · [계정·기능 검증](WORKSPACE_QA.md#sns-meta-comments-20261014).

새 연결 이후 데이터의 백업은 416,564,892바이트·generation1791938638295886이며, 09:50 KST 격리 복원에서 원키·보호표9개·자격증명·토큰2→2 보존과 외부요청0을 확인했다. HA 인수는 기존 정상 관측 820.601초·14표본·3지역·오류0과 새 controller 42.875초 관측으로 검증했다. 새 강제 장애 전환이나 실제 브라우저 로그인 연속성을 입증한 결과는 아니다. [백업 완료](../../../../../.tmp/social-meta-connect-20261014/rearm-v2/dr/backup-status-1791938723929.json) · [격리 복원](../../../../../.tmp/social-meta-connect-20261014/rearm-v2/dr/restore-v1.json).

첫 배포는 새 writer 시작 전 시간 초과와 자동 되돌림 실패로 일시 접속 장애가 있었으나 같은 계약의 공식 복구로 08:33 KST 이전 버전의 공개 응답을 복구했다. 컨테이너 제거 재확인 보완·Linux 검증 후 두 번째 배포를 완료했다. 원 실패 기록·기한·데이터를 보존하고 운영 DB를 백업으로 덮어쓰지 않았다. 아래 04:36 완료 기록은 이전 배포 이력이며, 이번 실패·복구와 세션 암호문1행 차이의 검증 한계는 [최신 QA](WORKSPACE_QA.md#sns-meta-comments-20261014)에 기록했다.

09:59 KST 최종 조회에서도 A ready·B 정상 대기·HA 활성·control idle을 확인했다. 임시 SSH 허용 규칙은 원래 API 값으로 모두 원복했다. 이전 원복 미완료3건도 각각 후속 원복 증거를 연결했다. [최종 인수 요약](../../../../../.tmp/social-meta-connect-20261014/final-live-summary-v1.json)은 연결·자동 수집·백업·복원·HA·공개 확인의 증거31개를 고정하며, root가 31개 파일의 SHA와 크기를 모두 대조했다.

<a id="sns-workspace-production-20261014"></a>
## SNS·마케팅과 PULSE 시그널 판 운영 반영 — 2026-10-14

**03:10 KST 회사 앱 반영·공개 파일 확인, 04:20:56 KST 배포 후 백업의 격리 복원, 04:36:18 KST HA 재활성화 후 확인을 마쳤다. 당시 인수 상태는 `armed=true`·A epoch7 단일 writer·B 정상 대기·복제 healthy였다.** 릴리스 `ab82ff6c743967435d76f4d12d03153539bca2edbac329528adbda079769506f`, 이미지 `sha256:25ff03f0e975174e90cc98ef2fe8fc296c07f2f25dd7397b07c63fdea999f0a3`다. 실제 부모 로그인 3판 위에 승인한 SNS 기능·기존 업무 연결·PULSE 시그널 32파일을 합쳤다. source971·image payload566이며 부모878파일은 그대로다. 별도 미승인 SNS 리디자인·고객 화면 후속 작업을 통째로 합치지 않았다.

새 후보의 Linux 앱 시험 **867/867와 호환성2/2**, 별도 후계 HA 검증 **Node91/Python34/기존 배포126**이 모두 실패·건너뜀 없이 통과했다. A epoch7 단일 writer·B nonwriter·세 서버 설정/런타임 일치와 실제 서비스 교체 완료를 [운영 postcheck](../../../../../.tmp/social-workspace-live-20261013/deployment/runtime-live-postcheck-1791914988310.json)에서 확인했다. [공개 확인](../../../../../.tmp/social-workspace-live-20261013/deployment/public-verification-1791915000879.json)은 **125/125 파일 SHA 일치**, health200/ready와 비로그인 SNS API401이다. 새 로그인 세션·시험 게시물은 만들지 않았다.

중지 중 원래 키·전체 논리 DB·DB 외 파일의 정확한 보존은 확인했다. 앱 기동 뒤 `synk_identity_sessions` 1행의 내용과 `tokens` 6→3행은 달라져 **모든 과거 세션을 그대로 보존했다거나 차이의 원인이 확정됐다고 주장하지 않는다.** 스키마는 같고 메신저 세션은 같다. 운영 데이터를 옛 백업으로 덮어쓰지 않았다. 아래 완료 백업의 격리 기동 보존은 이 배포 직후 차이와 별도 근거다.

추적 설정·검증 키 초기화 뒤 만든 최종 백업 **416,282,406바이트**, generation `1791917613128215`, SHA256 `bc594c1ea5bf9b722e19f36fabc4e448fd62f199d973df91422516009216b66b`를 B의 network none·공개 포트0·UID1000 환경에서 실제 복원·기동했다. **04:20:56 KST 복원 통과**, 원래 키·971개 릴리스 파일·HA37파일과 계정/세션9표의 기동 전후 보존을 확인했다(토큰3→3, 삭제·추가·변경0). 외부 요청0·시험 컨테이너 정리·B 설정과 운영 컨테이너 불변이다. 실사용자 로그인 시험·새 VM에서 전체 인프라 복구·새 강제 장애 시험은 수행하지 않았다. [실제 복원 결과](../../../../../.tmp/social-workspace-live-20261013/rearm/dr/restore-v2.json).

복원 전 B 디스크 여유 검사에서 중단돼, 원격 원본과 필요한 결과 기록을 보존한 과거 복원 시험 파생본·이번 staging·중복 다운로드 캐시의 정확한20경로만 정리했다. 캐시1개는 원격 exact generation과 사용자 전용 ACL 로컬 보관본의 해시를 대조했다. 회수 **2,606,632,960바이트**, 운영 데이터·로그·실행 이미지 변경0이다. 정리 응답이 유실돼 재실행하지 않고 완료 journal·대상 부재·보존 해시로 결과를 회수했다. 공간 기준은 낮추지 않았다. [정리·보존 확인](../../../../../.tmp/social-workspace-live-20261013/rearm/dr/cache-cleanup-result-v1.json).

첫 arm request `d8147442-45c9-41a6-af4d-e4acdf44b29e`는 `start-intent` 뒤 `CONTROLLER_CMDLINE` 확인에서 중단됐다. 같은 PID·invocation의 후속 읽기에서는 정확한 argv·기동시각·실행 경로가 정상으로 확인됐지만 실패 순간 argv가 없어 초기 실행 경합으로 단정하지 않는다. 원 worker의 canonical reconcile로 원래 plan/acceptance 바이트와 `armed=false`를 복원했다. 실패를 성공으로 고치거나 같은 arm을 다시 보내지 않았으며, 새 invocation의 정상 관측 후 새 계약으로 한 번 재시도해 완료했다. [원 실패](../../../../../.tmp/social-workspace-live-20261013/rearm/arm-failure-observation-1791919626499.json) · [기존 설정 복구](../../../../../.tmp/social-workspace-live-20261013/rearm/reconciled-pair-observation-1791919845411.json).

최종 request `f4065ef5-de75-4304-ba1e-625c87776b57`는 **199.013초·4표본·3지역·오류0**의 새 정상 관측 뒤 같은 고정 worker로 `installed-armed`·exit0을 확인했다. 새 controller invocation `23be725cd7d64f169754ee31a58d010c`의 44.169초 관측에서 PID·invocation 연속성, `RECOVERED`·재시작0, 공개 HTTPS200/ready와 A 단일 writer·B 정상 대기·복제 healthy를 확인했다. 원 시간·표본·검증 기준을 유지했으며 표본 관측을 연속 무중단이나 새 강제 장애 시험 결과로 표현하지 않는다. [최종 자연 관측](../../../../../.tmp/social-workspace-live-20261013/rearm/natural-final-v2.json) · [최종 활성화 확인](../../../../../.tmp/social-workspace-live-20261013/rearm/arm-postcheck-final-v2.json).

04:36 KST 종료 확인에서 공개125파일의 SHA·HTTP200/ready·비로그인 SNS401을 다시 확인했다. SSH 두 규칙은 최초 원본의 전체 필드·허용 범위와 API 재조회 결과가 같았다. 실제 SNS 게시·답장·새 가입·추적 사건은 만들지 않았다. 운영 예약 실행기의 `lastSuccessAt`은 기존 인증 API 안에 있어 직접 관측하지 않았으며, 서버 기동과 로컬 예약 시험을 실제 외부 발행 성공으로 확대하지 않는다. [최종 운영 증거 요약](../../../../../.tmp/social-workspace-live-20261013/final-live-summary-v1.json).

사이트 연결은 승인한 20파일만 `af31faaacd2fd10f9a6a737cceb87c91dfb57ba3`으로 반영했다. 후속 WORLD 배포 `be77072…` 뒤에도 **20/20 공개 SHA 일치**를 확인했다. 홈·ID·리듬·바람길의 공개 Chrome 화면은 JavaScript 오류·필수 리소스 실패·계측/쓰기 요청0이다. [공개 파일](../../../../../.tmp/social-website-20261014/public-http.json) · [공개 화면](../../../../../.tmp/social-website-20261014/public-browser-deployed.json). 중앙 가입 서버는 **synk-account v57**로 반영해 15모듈 정확 일치·entrypoint 동치·preflight204·미인증401을 확인했고 임시 키 파일을 폐기했다. [서버 반영](../../../../../.tmp/social-conversion-talk-20261014/remote/deployment.json). 회사 측 추적은 `https://synk.im`만 허용하며 최초 검증 키를 한 번 설정했다. 실제 추적 링크·전환 사건·가입 계정은 시험용으로 만들지 않았다.

별도 전체 사이트 CI는 미변경 경주 게임 자산의 HTTP503 때문에 통과하지 못했다. 첫 실패 뒤 일반 URL의200·SHA일치를 확인했고, 재시도는 다른 작업의 push로 취소됐다. 후속 전체 검사도 다른 경주 게임 스크립트503으로 실패했으며 해당 파일은 이후 일반 URL에서200·SHA일치했다. 이번 변경 파일 일치·32쪽×2·질문창 검사는 통과했지만 CI 환경503의 원인은 미해결로 기록한다. [전체 점검 기록](../../../../../.tmp/social-website-20261014/auto-check.json). Pages 성공·이번 기능의 직접 확인을 전체 CI 성공으로 확대하지 않는다.

Postiz는 사용자의 **「추가 비용 없이 설치 준비까지만」** 선택대로 [자체 설치 구성·비용·인수 절차](../../../../../.tmp/social-workspace-live-20261013/postiz/README.md)까지만 준비했다. 새 VM·구독·실제 SNS 계정 연결·공개 게시·댓글 전송은 하지 않았다. 실제 전환 관측과 배포는 구분하며, 메일 앱 방식의 홈페이지 문의 완료 계측은 미연결이다. 앱 사용법·로컬 화면 검증은 [최신 기능](WORKSPACE.md#sns-workspace-launch-20261014)과 [QA](WORKSPACE_QA.md#sns-workspace-launch-20261014)를 따른다.

<a id="next-company-release-client-desk-signal"></a>
## 다음 회사 릴리스에 함께 포함 — 고객 관리 11판(워크스페이스 시그널)

2026-10-14 사용자 확인(「웅 준비해」 — 운영 고객 관리가 아직 GPT 10-13 아침 판이고 회사 릴리스는 master에서 빌드하지 않으므로 얹기 꾸러미로 넘김)으로 다음 회사 릴리스에 고객 관리 10·11판(플랫폼 시그널 디자인 · 구역 15→11 · 화면 860·서버 1,227 문구 다시 씀 · 기능 검수 반영 · 단계별 펠트 포스터)을 포함한다. 후보에 `node .tmp/client-desk-signal-20261013/release/apply.cjs --root=<후보 폴더>`를 적용하고 `--check`(0 = 얹힘)로 확인한 **뒤** 최종 manifest·이미지를 만든다. 파일마다 기준선(운영 부모의 고객 관리 파일 = GPT 10-13 07:56 판 `aab0bfd89`)이면 11판으로 바꾸고, 이미 11판이면 두고, 그 밖이면 `git merge-file` 3방향으로 합치며(그림은 병합하지 않음), 충돌이 하나라도 있으면 아무것도 쓰지 않는다(종료 2). 바뀌는 것은 `company/` 아래 `client-*.mjs`·`public/client-*` 95파일(시험 `client-*.test.mjs`·`server-client-*.test.mjs` 47 포함)과 새 파일 9개(`public/client-desk.css`, 포스터 `public/client-desk-pulse.webp`·`public/client-desk-stage-{received,planning,producing,review,delivered,archived}.webp`, 시험 1), 그리고 공용 파일 둘에 줄 하나씩 — `public/index.html`의 `<link rel="stylesheet" href="/client-desk.css">`와 `server.mjs` 정적 허용 목록(`client-desk.css`·포스터 7장. 이 줄이 빠지면 배포 뒤 404)이다. API·데이터·권한·스키마·`data-*` 계약은 그대로다. 공용 작업본에는 이미 11판이 들어 있으므로 작업본에는 얹지 않는다. 순서는 **이 꾸러미 → 고객 알림 꾸러미**(그쪽 기준선이 11판)다.

운영 부모 `2c401084ce7c…`(10-14 11:29 KST 릴리스, 이미지 `sha256:56ca0149…`) 복사본 위에 얹은 로컬 후보는 `.tmp/client-desk-signal-20261013/release/candidate/`(992 source, manifest **`eca948eb24997c5e24d134e23b1bc08c35ae0354ec9dcae4d0b32b2820d537a0`**, 바뀐 106파일 외 886파일 바이트 보존, 얹기 전 `--check` 1 → 얹은 뒤 0, 두 번 얹어도 그대로)다. 이미지 목록 `candidate-image-payload.json`(578 = 부모 570 + 스타일시트 1·포스터 7, 시험은 부모 목록대로)과 `image-layer/`(FROM `sha256:56ca0149…` + 바뀐 106파일·manifest)를 함께 두었다. 후보 복사본(Windows 로컬)에서 고객 관리 시험 89파일(`client-*.test.mjs`·`server-client-*.test.mjs`) 1,068개 중 1,064 통과·건너뜀 2·실패 2 — 하나는 `client-delivery-archive`의 희소 파일 2GB 시험이 그때 이 PC 디스크 여유(1.1GB) 탓에 ENOSPC로 실패한 것으로, 여유가 2.5GB로 돌아온 뒤 그 파일만 다시 돌려 19 통과·실패 0(`qa-client-delivery-archive-rerun.txt`), 다른 하나는 `server-client-startup-templates`의 401↔403 기존 경합성 실패다(운영 부모 복사본에서도 실패). 회사 전체 시험 249파일 3,094개 중 3,080 통과·실패 6·건너뜀 8(Windows 심볼릭 링크·Caddy·Linux flock 전용)이고, 실패 6은 위 희소 파일 1(재실행 통과) + 기존 5(`marin-home-client` 1 · `server-background-jobs` 2 · `server-client-startup-templates` 1 · `social-provider-integration` 1 — Meta 댓글 조회 502)로, 같은 5파일을 운영 부모 복사본에서 돌려도 같은 5개가 실패한다(54개 중 48 통과·5 실패·1 건너뜀, `qa-parent-compare.txt`). 이 꾸러미 탓의 실패는 0이다. 후보로 띄운 격리 서버(합성 자료)에서 1440 일곱 구역(시작 준비·일정·대화·납품·마감·자료·기록)과 390 목록·접수·납품 화면을 찍어 가로 넘침 0 · 콘솔 오류 0 · 400 이상 응답 0 · 포스터 로드 · `client-desk.css` 적용을 확인했다(`release/smoke/`·`release/smoke-390/`). 이미지 빌드·Linux 인수·운영 배포는 하지 않았다. 운영 부모가 또 바뀌면 `prepare-candidate.cjs --parent=<manifest> --parent-image=sha256:… --parent-run=<부모 run 폴더>`로 후보를 다시 만들거나 새 부모 복사본에 `apply.cjs`를 다시 얹고, 다른 승인 변경과 합치면 최종 manifest·이미지·guard를 다시 만든다. [설계·확인](../../../../디자인/워크스페이스_시그널/README.md#signal-v11-20261013) · [기능 검수](../../../../디자인/워크스페이스_시그널/검수_20261013_고객관리_기능.md) · [꾸러미 설명](../../../../../.tmp/client-desk-signal-20261013/release/README.md)

기존 HA 릴리스 절차로 배포한 뒤 `https://workspace.synk.im/client-desk.css` HTTP200·전체 SHA256 **`42204c949c709ef5bdaaccdf97ef252090e6a9f4001c5bb9903b0c94aab673a7`**(71,372B), `/client-project-screen.js` `f29c5716cd7c5a4abeb77925a4f54d1a436d9de0e60b011fa83423fe4a454e27`(26,302B), `/client-desk-stage-received.webp` HTTP200·`502bb13653101e50ee585264d81b5c5312b470c8e1eca903a0f76b86e23d014f`, `/`의 HTML에 `href="/client-desk.css"`를 확인하고, 1440·390에서 고객 관리의 접수·제작·고객 확인·납품 프로젝트를 열어 시작 준비·대화·납품·수령 확인·마감 구역을 본다(기준 화면 `docs/디자인/워크스페이스_시그널/화면/11판-*.jpg`). 공개 일치 전에는 운영 완료로 적지 않는다.

<a id="next-company-release-sns-signal"></a>
## 다음 회사 릴리스에 함께 포함 — SNS·마케팅 화면 12판(워크스페이스 시그널)

2026-10-14 사용자 확인(「웅 부탁해」 — GPT의 SNS 기능 묶음이 끝난 판에 다시 얹어 시험한 뒤 넣기, 「좋아 나머지 진행해」 — 글을 해요체 하나로)으로 다음 회사 릴리스에 SNS·마케팅 9개 화면 12판과 13차 말투(화면 · 서버 모듈 · 고객 검토 페이지 글 609곳 해요체, 기능 고침 다섯)를 포함한다. 기준선은 10-14 11:29 운영에 반영된 SNS 판(`company/public/social-workspace.js` `613b4764…`, CSS `94bd976c…`)이고, 공용 작업본에는 13:58에 얹었다. 후보에 `node .tmp/sns-signal-20261013/release/apply.cjs --root=<후보 폴더>`를 적용하고 `--check`(0 = 얹힘)로 확인한 **뒤** 최종 manifest·이미지를 만든다. 바뀌는 것은 `company/public/social-workspace.js`(GPT 판 위에 화면 함수 22개를 함수 단위로 다시 얹고 말투 짝을 넣음 — 기준선과 다르면 도구가 다시 얹고, 12판이 이미 든 파일이면 말투 짝만, GPT가 그 22개 중 하나를 고쳤으면 멈춘다), `company/public/social-workspace.css`(통째 교체), 새 파일 9개 `tools/company-messenger/public/assets/sns-felt-<화면>.webp`(메신저 공개 폴더라 허용 목록 변경 없음), 말투 짝 `copy` 29개 파일(`social-*.mjs` 20개 · `meta-connection.mjs` · `public/social-review.{html,js}` · 시험 5 · QA 2 — 지금 파일에 [옛 글, 새 글]을 넣고 옛 글이 바뀐 짝은 알리기만)이며, 작업본에서는 `company/qa/verify-social-workspace.mjs`의 시험 맞춤(넓은 화면 메뉴 · 접힌 칸 열기)도 얹는다(후보에는 `qa/`가 없어 건너뛴다). API·데이터·권한·스키마·`data-*` 계약은 그대로다. 운영 11:29 판 모양의 부모 복사본(`tone/live-parent-1129`)과 공용 작업본 복사본에 적용해 보니 모두 충돌 0 · `--check` 0이었다.

공용 작업본에서 SNS 시험 35파일 525개 중 522 통과(실패 3은 손대기 전부터 — `server-background-jobs` 타이머 2 · 시험 가짜 탓 1), 브라우저 인수 시험 launch 43/43, six · four는 각 32개 통과 뒤 87줄 댓글 가져오기에서 멈춤 — 시험 가짜 Meta가 GPT 10:45 수집 모듈이 새로 묻는 `GET <댓글>/replies`를 몰라서이고(손대기 전 기준 거울도 같은 자리), 가짜만 맞춘 격리 사본은 129/129 · 125/125(320 · 390 · 1440, 시험 중 소스 고정). 브라우저 시험 출력은 `.tmp/sns-signal-20261013/qa-shared2-*`에 있고, 운영 증거 폴더 `docs/_ops/qa/social-workspace-{six,four,launch}-*`는 운영 후보의 증거라 덮지 않았다(GPT의 `verify-social-workspace-<묶음>.mjs`는 출력 위치를 그 폴더로 박아 두므로, 다음 후보의 새 증거는 릴리스 담당이 만든다). 이미지 빌드·Linux 인수·운영 배포는 하지 않았다. 운영에 실으면 저장돼 있던 메시지(예약 작업 · 연결 점검 · 답장 시도 · 댓글 수집 오류)는 다음 갱신 전까지 옛 합니다체로 보이고, 고객 검토를 기다리는 예약은 `social-publishing.mjs`가 대기 사유를 글자로 비교하므로 배포 직후 한 번 새 문구로 다시 저장된다(그 순간 그 작업을 누르던 화면은 409를 한 번 받을 수 있다). [설계·확인](../../../../디자인/워크스페이스_시그널/README.md#signal-v12-sns-20261013) · [말투 인계](../../../../../.tmp/sns-signal-20261013/tone/README.md) · [꾸러미 설명](../../../../../.tmp/sns-signal-20261013/release/README.md)

기존 HA 릴리스 절차로 배포한 뒤 `https://workspace.synk.im/social-workspace.css` 전체 SHA256 **`2fdaaf4a9c9f5b98d6950a9c02e18abc7f385e12e24c14f6aafda77d8ac35912`**, `/social-workspace.js`는 부모에 따라 다르다(운영 11:29 판 `613b4764…` 부모면 `d06d6897bcd9b2b579638aa85ce5dcc531558f4773315b063be643d8050d4d92`, 공용 작업본 판 그대로면 `eb9b7f9268202549a6f2be85eb51e98c41b1d1f17ba575eb73d7ef295003a3f0`, 그 밖이면 후보에 얹은 뒤의 파일 SHA256), `/messenger/assets/sns-felt-overview.webp` HTTP200·SHA256 `bc4ff1f40154049e2f38a3ab83bd08a4755cd2a8dc304f1b1ac3254aa3ea2b28`(작업본 파일과 같은 바이트일 때)를 확인하고, 1440 · 390에서 SNS·마케팅의 운영 현황 · 게시물 작성 · 발행 대기열 · 댓글·문의를 열어 글이 해요체 하나인지 본다. 공개 일치 전에는 운영 완료로 적지 않는다.

<a id="next-company-release-sns-optimization"></a>
## SNS 조회·달력 최적화 통합 준비 이력 — 2026-10-14

2026-10-14 전체 검수 요청의 성능 개선은 공용 작업본 `social-replies.mjs`·`social-marketing.mjs`·`public/social-workspace.js`에 반영했고 [회귀·성능 검증](WORKSPACE_QA.md#sns-optimization-20261014) 뒤 **같은 날 통합 릴리스 7aeace53…로 운영 반영과 HA 인수를 완료했다.** [완료 기록](#company-combined-release-20261014). 아래는 당시 통합에 사용한 보존 기준이며 현재 배포 대기 작업이 아니다. 후보에서는 SNS12·13판 꾸러미를 먼저 통합한 뒤 증거 폴더에 보존한 변경 전 원문과 소스의 차이만 병합했다. 공용 작업본 전체 복사나 기존 동결 후보 덮어쓰기를 피하고, SNS 꾸러미 재적용이 최적화한 달력 함수를 되돌리지 않도록 최종 함수·시험·새 manifest·이미지를 대조했다. 고객11판·알림의 통합 순서를 보존했고, 최적화 전 UI SHA 대신 최종 후보의 SHA로 공개 결과를 검증했다. 이후 현재 운영 상태는 [10월16일 인증 갱신 릴리스](#sns-auth-production-20261016)와 그 후속 확인을 따른다.

<a id="next-company-release-pulse-signal"></a>
## PULSE 고객 화면 시그널 판 포함 결과(글자 2판·05 영상 확인)

**2026-10-14 03:10 KST 위 SNS 릴리스에 승인 패키지 32파일을 포함해 반영했다.** 공개 CSS·서비스 워커·라틴 글꼴·단계 그림의 정확한 바이트는 125파일 공개 검증에서 일치했다. 아래는 병합에 사용한 승인과 단독 후보의 준비 이력이다. 고객 초대 화면의 실제 05 영상 확인 왕복을 이번 배포 뒤 실계정으로 다시 수행한 것은 아니며, 앞선 격리 화면 검증과 공개 파일 일치를 구분한다.

2026-10-13 사용자 요청(「합치고 배포에 실어줘」)으로 다음 회사 릴리스에 PULSE 고객 화면 시그널 판을 포함한다. 후보에 `node .tmp/pulse-app-signal-20261013/release/apply.cjs --root=<후보 폴더>`를 적용하고 `--check`(0 = 얹힘)로 확인한 **뒤** 최종 manifest·이미지를 만든다. 바뀌는 것은 `company/public/pulse-app/` 21파일과 `company/server.mjs` 정적 허용 목록, 새 파일 10개(`public/pulse-app/assets/SYNKLatin-{Regular,SemiBold,Bold}.woff2`, `public/pulse-app/assets/stage/` webp 7개)이며 API·데이터·권한·스키마는 그대로다.

현 운영 로그인 3판 `1d5f93e0d19d…`(911) 위에 PULSE만 얹은 로컬 후보는 `.tmp/pulse-app-signal-20261013/release/candidate/`(921 source, manifest `8d8fa716a919…`, 나머지 889파일 바이트 보존)다. 이미지 목록 `candidate-image-payload.json`(542, 새 10파일 포함)과 `image-layer/`(FROM `synk-company-pulse:1d5f93e0d19d` + 바뀐 32파일·manifest)를 함께 두었다. 후보 복사본에서 PULSE 시험 425개와 회사 전체 시험(2,613개 중 2,605 통과·실패 0·건너뜀 8(Windows 심볼릭 링크·Linux 전용))을 통과했고, 후보로 띄운 격리 서버에서 1440·390 화면 점검(콘솔 오류·실패 응답 0, 라틴 글꼴·단계 그림 200)까지 했다. 이미지 빌드·Linux 인수·운영 배포는 하지 않았다. 운영 부모가 바뀌면 최신 부모 후보에 apply.cjs를 다시 적용하고, 다른 승인 변경과 합치면 최종 해시·guard를 다시 만든다. [적용 설명·후보 검증](../../../../../.tmp/pulse-app-signal-20261013/release/README.md).

기존 HA 릴리스 절차로 배포한 뒤 `https://workspace.synk.im/pulse-app/app.css` 전체 SHA256 **`6a362a02c829cbaaa5eaf46eedefef633c1fa15f4d332d5c73de655117f7ffd3`**, `/pulse-app/sw.js` `d3a456291277a74b634a77c11f6eede1c06c23cbce7642323afe2ac4fce9cf45`(캐시 `synk-pulse-shell-v16-type-20261013`), `/pulse-app/assets/SYNKLatin-Regular.woff2` HTTP200·SHA256 `6b303b0fd95d0eaedab9cf451725271d9046c59c32f4b444babf54db089ca865`, `/pulse-app/assets/stage/stage-review.webp` HTTP200을 확인하고, 고객 초대 화면 1440·390에서 05 영상 확인(무대·의견 타임라인)을 본다. 공개 일치 전에는 운영 완료로 적지 않는다.

<a id="next-company-release-login-v3"></a>
<a id="workspace-login-v3-production-20261013"></a>
## 워크스페이스 로그인 3판 운영 반영 — 2026-10-13

**15:20 KST 운영 반영·공개 화면·백업 복원·HA 재활성화 확인을 마쳤다.** 릴리스 `1d5f93e0d19d…`, 이미지 `04e1a0961ba8…`다. 기존 e6 판에서 로그인 소개 마크업·로그인 CSS·노트북 포스터·출처4파일만 바꾸고 원문907파일·비로그인 JS·서버 동작은 보존했다. source911·image payload532, 실제 후보 Linux 이미지 시험112개(로그인28 포함)를 통과했다.

공개 `signal.css`는 HTTP200·SHA256 **`7377122844901f7c8e609943af7e1a229a6a98963f580bf0d0afebbaee2e655e`**, `/messenger/assets/signal-laptop.webp`는 HTTP200·SHA256 `e7fec4f0b240f1d440041bb39cae6adec4784f0624f911605e119abc2d0e1689`로 일치한다. 실제 공개 로그인1440×900·864×900·390×844에서 포스터·SYNK ID·폼·로그인 버튼을 확인했고 가로 넘침·페이지 오류·요청 실패0이다. 390px 로그인 버튼도 첫 화면 안에 있다. 새 익명 컨텍스트로 확인했으며 실계정 로그인·로그아웃은 하지 않았다. [공개 해시·화면·시험](../../../../_ops/qa/workspace-login-v3-20261013/README.md).

새 원격 백업414,606,925바이트(generation `1791871671254890`)를 네트워크·공개포트 없는 UID1000 환경에서 실제 복원·기동했고 원키·9개 계정/세션 표가 기동 전후 동일했다(토큰6→6, 삭제0). 1,050.772초(17.51분)·17표본·3지역의 자연 관측 오류0 뒤 **15:19:53 KST `armed=true`·A epoch7·B대기·복제 healthy**를 확인했다. controller48.276초 관측에서 정상 회복·재시작0을 확인하고 임시 SSH 허용을 두 규칙에서 제거해 원래대로 복원했다. 이후15:20:20 KST에도 공개 해시일치·health200/ready였다. [최종 인수 요약](../../../../_ops/qa/workspace-login-v3-20261013/final-operation-summary.json).

정지 자료 보존과 완료 백업의 격리 기동 보존을 구분한다. 운영 재개 직후 토큰7→6 및 identity session 내용 변경만으로 모든 과거 세션 보존이나 변경 원인을 확정하지 않는다. 이번 릴리스의 새 강제 장애 전환·실제 사용자 자격증명 로그인 시험은 하지 않았다. 이 로그인3판과 아래 서버 지연 수정은 당시 이력이며 최신 운영 인수는 [SNS·마케팅 판](#sns-workspace-production-20261014)을 따른다.

<a id="server-latency-20261013"></a>
## 이전 서버 지연 수정 — 2026-10-13 14:23

13:55:37 KST 새 공개 릴리스의 실제 반영을 확인했다. 운영 릴리스는 `e6ecc48f0992…`, 이미지 `84512a28d8f2…`다. TCP만 제공하는 기존 로드밸런서에 맞춰 Caddy를 HTTP/1.1·HTTP/2로 제한하고, 돌아온 브라우저의 이전 HTTP/3 안내를 `Alt-Svc: clear`로 지우도록 했다. 회사와 Spaceship의 기존 경로·전달 헤더·스트리밍 설정은 보존했다.

**14:23:02 KST 새 릴리스의 백업·격리 복원·HA 재활성화 후 확인까지 완료해 `armed=true`다.** A epoch7 단일 writer·B 대기·복제 healthy와 control generation `1791867223426270`을 확인했다. 1,101초(18.35분)·18표본·3지역의 정상 관측 후 새 controller의18.280초 관측에서 `RECOVERED`·재시작0을 확인했다. 원격 백업414,305,963바이트(generation `1791867792428622`)를 네트워크·공개포트 없는 격리 환경에 복원했고 원키·9개 계정/세션 표가 기동 전후 모두 같았다(토큰7→7, 삭제0). 임시 관리 접속 IP도 기존 두 방화벽 규칙에서 제거하고 원래 규칙 복원과 공개200/ready·Alt-Svc clear를 확인했다. [최종 운영 확인](../../../../../verification/server-latency-20261013/final-operation.json).

공개 `/`, `/pulse-app/`, `/api/health`를 HTTP/1.1·HTTP/2로 확인한6검사는 모두200과 Alt-Svc clear였다. 전후 각각120개(fetch90·새 H1연결30)의 공개 health 표본은 오류0이었고, 중앙값은26.22→28.59ms, 최대는222.96→615.06ms였다. 이 수치를 접속 속도 개선이나 연속 가용성 증거로 해석하지 않는다. 과거09:25 KST의8,033ms 기록은 Node fetch가 응답 헤더 없이 제한시간에 종료한 사건이며 원인은 여전히 미확정이다. HTTP/3 안내 오류를 그 사건의 확정 원인으로 기록하지 않는다.

앞서 배포한 작업실 반복 조회 최적화와 HA 상태 GET의 제한된 재시도도 보존했다. 현재 권한·원문을 다시 확인하고, GET만 기존 총시간 한도 안에서 재시도하며 쓰기·권한 거부를 반복하지 않는다. 별도 격리 브랜치의 관련129시험은 실패·건너뜀 없이 통과했다. 합성 부하의 개선 수치·실제 공개 관측·원시 시험 결과는 [검증 묶음](../../../../../verification/server-latency-20261013/README.md)과 [작업실 QA](WORKSPACE_QA.md#server-latency-20261013)를 따른다. 새 강제 장애 전환 시험이나 과거 세션 차이의 원인 규명은 이번 확인 범위가 아니다.

이14:23 인수와 아래13:25 지연 수정·이전 통합 인수는 당시 이력으로 보존한다. 최신 운영 상태는 위 로그인3판 운영 인수를 따른다.

<a id="server-latency-prior-20261013"></a>
## 이전 서버 지연 수정 — 2026-10-13 13:25

상태 조회의 일시적 GET 실패 재시도와 작업실 반복 조회 최적화를 운영에 반영했다. 앱은 `12aea0db4553…`·910파일, 이미지 `73cd55624497…`, node-agent는 세 호스트 모두 `aaf76e2cdad3…`다. 실제 로그에서 `STATE_BODY` 첫 요청이 4,002ms에 시간초과된 뒤 두 번째 요청으로 총 4,324ms에 회복했고, 이 사건으로 보호 정지가 발생하지 않았다. 기존 전체 10초 제한과 권한 최신성·보호 정지 조건을 유지하며 POST나 권한 거부는 재시도하지 않는다. 실행 대조는 `.tmp/server-latency-20261013/`의 `app-release/runtime-live-postcheck-v2.json`, `runtime-deployment/runtime-live-postcheck-v1.json`, 회복 로그는 `post-runtime-stable-1791850184764.json`에 있다. 합성 부하 성능과 시험 범위는 [검증 기록](WORKSPACE_QA.md#server-latency-20261013)을 따른다.

**13:25:05 KST 최종 백업·격리 복원·재활성화 후 확인까지 통과해 `armed=true`다.** A epoch7 단일 writer·B 대기와 control generation `1791852141053862`를 유지한다. 1,110.591초(18.51분)·18표본·3지역의 정상 관측 후 새 controller의 31.027초 관측에서 `RECOVERED`·재시작0·공개 HTTPS 200/ready·TLS·복제 healthy를 확인했다. 실제 원격 백업 414,253,235바이트를 네트워크 없음·UID1000으로 격리 복원했다. 원키와 다른 계정 표 8개는 그대로였으며, 복원본 시작 전에 만료된 `pulse-session` 2개만 정상 정리돼 토큰은 9→7이었다. 전체 행 보존으로 기록하지 않는다. 운영 계정 확인은 명시적으로 고정한 이번 완료 백업의 9개 토큰과 기존의 안정적 계정 식별자를 보존하는지 대조했다. 과거 14개 토큰 대비 누락 5개의 원인은 입증하지 못했으며 모두 보존됐거나 만료됐다고 주장하지 않는다. 근거는 같은 폴더의 `runtime-rearm/dr/backup-status-final-v4.json`, `runtime-rearm/dr/restore-final-v2.json`, `runtime-rearm/owner-final-v2.json`, `runtime-rearm/natural-final-v2.json`, `runtime-rearm/arm-postcheck-final-v2.json`이다.

임시로 추가했던 현재 관리 접속 IP `/32`는 기존 두 방화벽 규칙에서 제거했고, 원래 규칙 필드가 모두 복원된 뒤에도 공개 HTTPS 200/ready를 확인했다(`management-egress-restored-1791865548099.json`). 남은 한계도 보존한다. 09:25 KST PC에서 관측한 8,033ms 접속 시간초과의 원인은 미확정이다. 이후 PC 60표본은 약 3시간에 걸친 절전·복귀와 유사한 공백 및 `TypeError` 10건을 포함하므로 연속 3분 가용성 증거로 쓰지 않는다. 위 서버의 정상 관측과 별개 기록이며 모든 지연이 사라졌다는 뜻은 아니다. 이번 릴리스로 새 강제 장애·복귀 시험을 수행하지 않았고, 아래 이전 통합 인수와 과거 실제 장애 시험 이력은 그대로 보존한다.

## 이전 통합 반영 — 2026-10-13 06:46

PULSE·Workspace 통합 릴리스 `7b2ccbf0c170…`·910파일을 실제 배포했고 공개 105파일과 3호스트 runtime 검증을 통과했다. A epoch7 단일 writer·B 대기 상태다. 고객 선택 저장·복원·제작자 일치, 93.5초 실제 크기 영상의 업로드·재생·다운로드, 최종 납품·수령 확인과 ZIP까지 운영 화면에서 확인했다. **06:46:23 KST 새 백업·격리 복원·후계 재활성화 후 검증까지 통과해 자동 장애 전환은 `armed=true`다.** 최신 240.097초·5개 관측·3개 지역의 정상 구간을 확인한 뒤 재활성화를 1회 실행했다. 새 controller invocation의 28.622초 관측에서 `RECOVERED`·재시작0·공개 TLS/ready·복제 healthy를 확인했다. runtime4와 control generation `1791838325144496`을 보존했다. [실제 재활성화 후 확인](../../../../../.tmp/pulse-workspace-integration-20261013/ha-compat/arm-postcheck-7b2-v6.json), [새 백업 격리 복원](../../../../../.tmp/pulse-workspace-integration-20261013/ha-compat/dr/restore-7b2-v2.json). 인수 도중 권한 확인 시간초과에 따른 일시 정지·복구와 외부 비정상 관측은 보존했다. 정확한 API 원인은 미확정이며, 재활성화가 해당 시간초과 원인을 수정했다거나 연속 무중단을 입증한다는 뜻은 아니다. 현재 원문은 [통합 운영 QA](../../../../_ops/qa/pulse-workspace-integration-20261013/README.md)를 따른다. 676의 실제 장애·복귀 이력과 새 릴리스의 호환 인수는 구분한다.

## 전환 전 점검 — 2026-10-13 04:57:18 KST

**현재 공개 서비스는 정상이고 자동 장애 전환은 `armed=false`다.** 운영은 여전히 `762731fdd9c5…`·678파일, A epoch7·B 대기·복제 healthy·진행 중인 cloud deployment 없음이다. 별도 PULSE 통합 후보의 배포 준비로 감시가 해제된 상태다. 세 서버 HA runtime4와 양 서버 백업 helper의 기존 최적화는 일치하며 새 HA 수정은 필요하지 않았다. 통합 후보의 영상 도구 빌드는 03:17 완료됐지만 03:27 검사에서 production 3,111개 중 두 Docker COPY 검사만 실패했다. backup20·compat2는 통과했고, 검사 한 파일을 고친 895파일 `c730e54c…` 후속 후보가 준비돼 있다. 04:55 담당 실행이 완료 결과를 회수해 이어가기 시작했으며, 새 후보 배포·새 백업/격리 복원·호환 재활성화 완료를 확인할 때까지 전체 종료로 표시하지 않는다. [최신 서버 읽기](../../../../../.tmp/platform-ha-20261011/optimization-20261012/deployment/resume-20261012/current-observation-20261013.json) · [실제 빌드/검사 결과](../../../../../.tmp/platform-ha-20261011/optimization-20261012/deployment/resume-20261012/stalled-peer-build-read-20261013.json) · [현재 JSON](../../../../../.tmp/platform-ha-20261011/result.json)의 `currentObservation`을 우선한다. 아래 인수 기록과 원본 자료는 보존한다.

## 이전 완료 인수 — 2026-10-12 23:20:42 KST

PULSE 하린 움직임 샘플을 포함한 `762731fdd9c5…`·678파일의 배포·자료 보존·새 백업·격리 복원 후 자동 전환 감시를 다시 활성화했다. 실제 `armed=true`·A epoch7 단일 writer·B 대기·복제 healthy·공개 TLS/ready, 새 controller invocation의 30.970초 관측과 `RECOVERED`·재시작0을 확인했다. control generation `1791812055746970`과 기존 native 장애·복귀·rearm 이력, HA runtime4를 보존했다. **678의 새 강제 장애 시험은 수행하지 않았으며**, 아래 676 실제 시험과 현재 버전의 호환 인수를 구분한다. [실제 활성화 후 검증](../../../../../.tmp/pulse-harin-motion-20261012/ha-compat/postcheck-v4.json) · [새 백업의 격리 복원](../../../../../.tmp/pulse-harin-motion-20261012/ha-compat/dr/restore-v1.json) · [PULSE 검증·초대 준비](../../../../_ops/qa/pulse-followthrough-20261012/README.md). 아래 기록과 기존 `result.json`은 676 당시 근거로 보존한다.

## 이전 HA 인수 — 2026-10-12 21:51:25 KST

**22:10 종료 재확인:** systemd 조회 일괄 처리·동일 작업의 Docker 조회 재사용·최신 백업만 체크섬 계산하는 최적화본이 canonical과 세 서버 runtime4 및 양 서버의 백업 helper에 일치한다. A epoch7·B 대기·공개 ready·복제 Synced·`armed=true`와 원 활성화 프로세스의 연속성을 확인했다. 22:10~22:11 두 차례 읽기에서는 같은 프로세스의 CPU·I/O 진행도 관측했다. 다른 PULSE 후속 배포 준비와 겹치는 재배포는 하지 않았다. 오전 최적화 결과의 원문을 별도 보존하고 최신 완료 기록을 연결했다. [최적화 종료 기록](../../../../../.tmp/platform-ha-20261011/optimization-20261012/deployment/resume-20261012/optimization-close-20261012.json). 활성화 직후용 60초 STATUS 조건으로 종료 상태를 판단한 실패 기록도 보존한다. 현재 코드는 정상 armed 상태가 계속되면 새 STATUS/OBSERVATION을 출력하지 않으므로, 이번 종료 읽기를 새로운 감시 cycle 성공이나 재활성화로 표시하지 않는다. 운영 CPU 절감률은 미측정이다.

**당시 실제 검사에서 자동 장애 전환은 `armed=true`다.** PULSE `6a4998647137…`·676파일과 새 HA runtime4를 인수했고, A가 epoch7 단독 writer, B는 비소유자 대기 상태다. 양 노드 역할·정확한 loaded 설정·동일 runtime4·복제 Synced·공개 HTTPS/ready와 controller `RECOVERED`·오류0을 확인했다. control generation은 `1791808477431982`다. 현재 상태의 정본은 [최종 인수](../../../../../.tmp/platform-ha-20261011/optimization-20261012/deployment/resume-20261012/final-acceptance-20261012.json)와 [기계 판독 상태](../../../../../.tmp/platform-ha-20261011/result.json)의 `currentState`이며, 아래 30a·fdd·e19 및 오전 인수는 당시 기록으로 보존한다.

19:35의 원 기반시설 배포 `6b6c42…`는 `PUBLIC seq11 / OWNER_NOT_READY HOLD`와 만료 계약을 그대로 남겼다. 이후 별도 실제 forward-finalize 완료와 두 번의 사업 배포를 연결해 현재 6a를 인수했다. 원 실패 작업을 성공으로 바꾸거나 옛 자료를 복원하지 않았다. 다른 PULSE의 후속 사업 후보는 로컬 대기이며 이번 라이브 인수 범위에 포함하지 않는다.

새 런타임의 실제 A→B 장애 전환은 **정지 의도 기록부터 COMPLETE까지 616,094ms(10분16.094초)**였다. 최초 unhealthy 관측부터는 527,228ms이며 연속 실패 확인은 190,048ms다. 이후 명시적 B→A 복귀는 준비부터 COMPLETE까지 269,955ms, 최종 A epoch7로 끝났다. 180초는 장애 지속 판정 기준이며 3분 안 복구 완료 보장이 아니다. 이전 30a의 566,774ms 시험과 구분한다. 원 A bootstrap의 10분 만료는 수정하지 않았으며, 별도 5분·갱신 불가 continuity authority로 정확한 start를 요청한 뒤 실제 앱0·지역 mount0·writer 시작 거부의 비소유자 인수를 확인했다. [장애·복귀·연속성 독립 대조](../../../../../.tmp/platform-ha-20261011/optimization-20261012/deployment/resume-20261012/final-independent-prearm-read.json).

복귀·native rearm 뒤 **21:36:50 KST 자료의 새 백업**을 올리고, 동일 archive의 676파일·HA37파일·원키·9개 계정/세션 표를 기동 전후 대조했다. B에서 기존 정확한 이미지로 UID1000·network none·공개 포트0 격리 기동을 통과했고 시험 컨테이너 정리·원본/운영 환경 불변을 확인했다. 백업 status4의 읽기 TimeoutError와 restore-v1의 복원 시작 전 중단은 보존했다. 후자는 B 재부팅 뒤 `/run/lock/synk-ha-deploy.lock`이 없었던 경우이며, 기존 QA된 `lock_open`으로 root0600 빈 잠금파일을 만들고 exclusive flock·node/plan/source/control 불변을 확인한 후 같은 백업의 restore-v2가 통과했다. 앱·원본 데이터 변경은 없었다. [DR 독립 검수36항목](../../../../../.tmp/platform-ha-20261011/optimization-20261012/deployment/resume-20261012/final-independent-dr-read.json), [임시 잠금 초기화 원문](../../../../../.tmp/platform-ha-20261011/optimization-20261012/deployment/resume-20261012/standby-reboot-lock-initialized.json), [최종 arm 실제 검사](../../../../../.tmp/platform-ha-20261011/optimization-20261012/deployment/final-arm-postcheck-6a499-v1.json).

이번 DR은 기존 VM·이미지를 사용한 격리 복원이며 새 VM에서의 전체 인프라 유실 복구나 실제 외부 사용자 로그인 시험은 아니다. 온라인 순차 SQLite 백업도 두 DB의 동시 스냅샷을 뜻하지 않는다. Source1 `REPORT_ID_CONTENT_CONFLICT`는 기존 자료를 덮어쓰지 않고 거절된 별도 생산자 조정 과제로 남으며, 세 조사 문서 모두 오류0이라고 표시하지 않는다. 다른 채팅에 메시지는 보내지 않았다. 원키·세션 내용은 문서에 넣지 않으며 비용·WORLD/TOWN·PATH·외부 제공자 범위는 아래 기존 조건을 따른다.

<a id="server-disaster-recovery-20261011"></a>
## 이전 인수 — 2026-10-11 서버 자체 장애용 원격 복구 사본

**기존 서버 밖의 비공개 GCS에서 실제 프로그램과 업무 데이터를 복원해 기동하는 시험을 통과했다.** 기존 매일03:30KST 백업(최대15분 분산)의 성공 뒤 전체 복구 사본을 저장하도록 systemd `ExecStartPost`를 적용했다. 노트북이나 Codex 예약은 실행에 필요하지 않다. 기존 데이터 백업·서비스·계정·Cloud 권한을 유지하고 신규 VM·결제·키는 만들지 않았다. [서버 유실 시 복원 순서와 범위](CLOUD-DATA-MIGRATION.md#server-disaster-recovery-20261011).

- **실제 최종 사본:** 10월11일22:24:45KST 데이터, 현재 `17f90b97363f` 릴리스584파일·실행 이미지3개·원래 환경/암호 키·회사와 메신저 DB·서버 설정을 포함한621파일, archive **173,232,777바이트**. 전체 SHA256 `088a3c7a0eda5c8f780589141da6405f26cdc42ec3a2f2111e69ec4a4f545acd`. 원격 archive와 SHA/generation receipt를 기존 비공개 `company/production/`에 새 객체로 저장하고 양쪽 MD5·크기·이름·generation을 확인했다.
- **실제 원격 복원:** 원격 receipt와 지정 generation의 archive를 다시 내려받아 SHA256·MD5 대조,621파일·두 DB의 무결성/논리 사본·원키·계정 연결·Drive 등록 정보 보존, 암호화 기록3건 복호화를 확인했다. 저장 이미지3개를 load한 뒤 회사 이미지의 UID1000·network none·운영과 분리된 데이터 사본으로 기동해 health ready, 공개 화면3개, 비인증 고객 API401을 확인했다. 외부 요청0·운영 자료 쓰기0·원본 사본 SHA 불변이다. 등록 로컬 첨부가0개여서 실제 첨부 바이트 복구의 양성 사례로 확대하지 않는다. 실제 사용자 로그인과 새 VM에서의 전체 DNS 전환은 이번 시험에 포함하지 않는다.
- **코드 검증:** 최종 Linux 복구25·캡처19 시험44개 통과. 손상·누락·경로 탈출·링크·기존 대상 덮어쓰기 거절, 두 번 풀리는 데이터까지 고려한 용량 선검사, OCI 이미지 index/manifest/config/layer와 attestation 검증, 업로드 전 오프라인 복원·양쪽 객체 응답 확인을 적용했다. 초기 실제 Docker 형식 차이는 업로드 전 검사에서 차단했고 수정 후 두 실제 사본의 원격 복원에 성공했다.
- **예약·실패 감시:** helper `3fa6302294ce…`를 `/opt/synk/disaster-recovery/`에 별도 설치해 운영 릴리스를 통째로 배포하지 않았다. 백업 service 결과success·후속 명령exit0·기존 타이머3개active를 확인했다. 마지막 조회의 다음 백업은10월12일03:43:08KST이며 예약 분산에 따라 달라질 수 있다. 일일 자연 실행의 다음 회차는 아직 오지 않았다. DR 실패는 기존 `BACKUP_FAILED` 사건으로 전달하며 실제 초기 실패의 Cloud Logging 수집200과 활성 외부 알림 필터·알림 채널1개를 확인했다. 수신자의 실제 알림 열람은 별도다.
- **보존 확인:** 최종 백업·복원 전후 현재17f90의584파일 SHA·실행 컨테이너 ID/이미지/시작 시각·환경파일·기존 unit·Caddy·Ops Agent 설정이 같고 공개health ready다. 이번 DR 도구는 서비스 재시작을 요청하지 않았다. 중간에 다른 PULSE 작업이26033에서17f90으로 배포하며 서비스가 재시작된 이력이 있어, 그 이후 새 기준에서 마지막 백업과 복원을 다시 인수했다.

이 대비는 **일일 백업에서 수동 복원하는 방식**이다. 즉시 자동 전환·동일 리전 전체 재해·Supabase 관리형 데이터의 복구를 보장하지 않는다. 정상 일일 성공 시 마지막 자료와 약24시간 차이가 있을 수 있고, 실패가 이어지면 더 오래될 수 있다. 두 DB는 온라인 순차 백업이며 같은 순간의 전역 스냅샷은 아니다. 로컬에는 검증된 자체 복구 사본2개를 유지하고 미확정 사본·기존 백업·GCS 객체는 삭제하지 않는다. 원격 저장량은 계속 증가한다.

실제 증거는 저장소 `.tmp/platform-dr-20261011/result.json`, `infra/remote-restore-result-latest.json`, `infra/final-operating-acceptance.json`, `infra/stage-result-v3.json`, `infra/external-alert-path.json`에 둔다. PC 렉은 별도 `.tmp/pc-lag-20261011/diagnosis.json`의 짧은 실측을 따르며, 원격 서버의 CPU 작업과 PC의 AI 앱·개발 도구 메모리 사용을 구분한다.

<a id="platform-always-on-audit-20261011"></a>
## 이전 감사 — 2026-10-11 플랫폼의 PC 독립 상시 운영

**제작 노트북이 꺼져도 현재 공개된 서비스와 트렌드 수집·반영은 클라우드에서 계속 실행되는 구조다. 모든 개발 기능의 공개 완료나 장애 중 무중단 운영까지 완료한 상태는 아니다.** 제품 공통 요구와 공개 기준은 [플랫폼 연결 설계](../../../../SYNK_플랫폼_계정과_연결_설계.md#platform-always-on-20261011)를 따른다. 이 절은 10월11일 당시 감사 기록이다. 서버의 최신 릴리스·백업·장애 자동전환 상태는 [10월12일 운영 인수](#ha-three-minute-20261012)를 우선한다.

| 범위 | 실제 확인 | 남은 범위 |
|---|---|---|
| Workspace·트렌드 | Google Cloud VM의 현재 `4ecf36055aba` 릴리스 564파일 전체 SHA 일치, 컨테이너 healthy, 공개 health ready. Gemini 예약·Google 문서3개·서버 자동 읽기로 PC와 분리 | 물리적 PC 종료 시험, 미래 모든 조사 성공은 확인하지 않음 |
| PULSE | 같은 VM의 고객 라운지 `/pulse/` HTTP200, 인증 없는 프로젝트 API401. 직원이 만든 프로젝트·의견·승인은 서버 저장. 최신 PC 설치본도 같은 서버를 사용 | 실제 고객 왕복 인수, 신규 문의 자동 수신의 실제 동작, 열린 고객 화면의 자동 갱신 |
| WORLD·TOWN | 공개 웹·게임 자산은 GitHub Pages, 계정·학습·Town 함수는 공통 Supabase ACTIVE. 공개 GET 확인 | 최신 로컬 WORLD 기능은 공개판과 다름. TOWN 목표16명 동시 사용·저장 부하 인수 미완료 |
| PATH | 소개는 공개. 면접 공개 경로 `/path/interview/`는404 | 면접·VR은 개발 중. 공개 자산 배포·계정 왕복·Quest 실기기 인수 필요 |

### 확인된 서버 보호 설정

- VM `synk-company-1`은 일반 STANDARD 인스턴스이며 Spot/선점형이 아니다. 호스트 유지보수 MIGRATE, 자동 재시작, 삭제 보호가 활성이다. 부팅·데이터 디스크 모두 영구 디스크이며 VM 삭제 시 자동 삭제하지 않는다.
- Docker와 회사 서비스는 부팅 시 시작하도록 설정됐고, 회사·HTTPS 컨테이너의 재시작 정책은 `unless-stopped`다. 서버 health·백업·백업 확인 타이머가 active다. 이번 감사에서 서비스 재시작이나 장애 주입은 하지 않았다.
- Google Cloud 외부 감시가 아시아·유럽·미국에서 `/api/health`를60초마다 확인한다. 5분 장애, TLS 만료 임박, 디스크80%, 복구·백업 실패의 알림 정책4개가 활성이다. 이 감시는 노트북 및 해당 VM 내부 점검기와 독립이다. 이번에 실제 알림을 새로 발송하지 않았다.
- 최신 수동 백업 완료와 원격 GCS 객체의 metadata GET200, 228,948바이트·MD5의 로컬 archive 일치를 확인했다. 회사·메신저 DB, 원래 암호 키, Drive 연결 정보, 로컬 첨부·미디어가 백업 대상이다. 이번에 객체 전체 다운로드·격리 복원을 다시 수행하지 않았다. 일일 백업의 다음 실행은10월12일03:39KST로 조회됐다. 현재 서비스는 원격 디스크·원격 설정·원격 이미지로 실행하므로 노트북 상실이 즉시 서비스 중단을 일으키지 않는다.

### 상시 운영을 완성하려면 남은 조건

1. **공통 계정·데이터의 중단 정책:** 운영 Supabase는 현재 `ACTIVE_HEALTHY`지만 조직 요금제는 Free다. 같은 조직에 운영·리허설2개 프로젝트가 있다. Free는 저활동7일 후 휴면 대상이므로 장기 무중단 조건을 충족했다고 표시하지 않는다. 조회 가능한 DB 백업 목록은 비어 있고 PITR은 꺼져 있다. 공급자의 내부 사본이 전혀 없다는 뜻으로 확대하지 않는다. [공식 휴면 기준](https://supabase.com/docs/guides/platform/free-project-pausing), [백업 기준](https://supabase.com/docs/guides/platform/backups).
2. **결제 지속 조건:** Google Cloud API는 billing enabled/open이지만 무료 체험인지 유료 계정인지 구분하지 않는다. 기존 운영 계정의 Console 조회는 Chrome 응답 지연으로 끝내 확인하지 못했다. 무료 체험 상태라면 크레딧·기간 종료 후 중단될 수 있으므로 유료 유지 여부·비용 승인을 확인해야 한다. [Google 공식 체험 종료 기준](https://cloud.google.com/signup-faqs). 결제·구독·권한은 이번에 변경하지 않았다.
3. **장애 복원:** 현재 회사 서버는 단일 VM·단일 영역이다. 후속 사용자 요청으로 전체 코드·실행 이미지·보호된 환경 설정·데이터의 원격 사본과 격리 복원을 [위 절](#server-disaster-recovery-20261011)에서 적용·인수했다. 다른 영역으로 즉시 자동 전환하는 구성은 아니다. SQLite 공유 디렉터리를 복제 서버들이 동시에 쓰도록 단순 확장하지 않는다.
4. **제품별 남은 공개 범위:** PULSE 기존 고객 라운지와 신규 문의 자동 수신을 구분한다. 운영 host·container에 `SYNK_PULSE_INBOX` 설정은 존재한다. 소스의 PC 기본 경로나 receiver 이름의 systemd unit이 없다는 사실만으로 운영 미연결을 단정하지 않으며, 실제 접수→직원 확인의 자동 실행은 미인수다. WORLD/TOWN의 새 기능·동시 사용자 시험, PATH의 공개·VR 인수를 각각 마친 뒤 상시 제공 목록에 올린다. 고객 의견·학생 기록을 운영 시험용으로 만들지 않는다.

Supabase Pro는 공식 기준 월$25부터이며 첫 Micro 프로젝트 계산 크레딧을 포함한다. 현재처럼 같은 조직의2개 프로젝트를 계속 실행하면 최소 구성은 **약$35/월부터**로 예상한다(세금·추가 사용량 별도, 최종 결제 견적 미확인). 조직 단위 요금제이므로 운영 프로젝트 하나만의$25로 단정하지 않는다. 유료 전환과 별도 서버 증설은 비용 승인 후 진행하며 이번 감사에서 실행하지 않았다. [공식 가격](https://supabase.com/pricing), [조직 단위 과금](https://supabase.com/docs/guides/platform/billing-on-supabase).

### 노트북이 없어졌을 때

다른 기기에서 기존 공개 주소를 이용한다. 운영 복구가 필요하면 기존 관리자 계정으로 Google Cloud의 `synk-bake-unmet27` 프로젝트, 기존 Supabase 조직, GitHub 호스팅에 접근한다. SSH 개인 키를 분실했다고 운영 DB를 새로 만들거나 빈 관리자 설정을 열지 않는다. 먼저 기존 VM·영구 디스크·백업과 정확한 릴리스를 확인하고 [데이터 이전·복구](CLOUD-DATA-MIGRATION.md)의 기존 키·논리 데이터 보호 조건을 따른다. 새 인증정보 발급·접근 권한 변경은 별도 절차다.

이번 감사의 비밀값 없는 실제 조회와 증거 목록은 저장소 `.tmp/platform-always-on-20261011/result.json`에 둔다. `account-result.json`, `infra/`의 실제 조회, `experiences/evidence.json`, 협업 감사의 `collaboration-receipt.json`을 구분한다. 21:04 트렌드 보완의 구현·배포·자료 보존 증거는 [Workspace 최신 자동화](WORKSPACE.md#pc-독립-상시-수집과-열린-화면-반영--2026-10-10-최신)를 따른다.

## 이전 완료 — 2026-10-11 01:23 워크스페이스 화면 「싱ㅋ 시그널」 7판

유호님 「남은 P3도 고쳐서 7판 반영하는거 새 세션에서 할게」. 6판 공식 검수 P3(높은 대비 그래프 점 윤곽선, VM 단계 태그 검사, 얇은 층에 들어가던 시험 파일, 증거 빈 곳)를 고친 `52a23f001cfe`(부모 6판 `292b35a4c601`, 561파일, 바뀐 파일은 회사 `public/signal.css` 하나), 이미지 `sha256:1207d4fae13b91789036a2f0f52ff67b08b3fa2c13fdb63a657a732f34439d77`이다. 윈도1,350개 6판과 같음·VM 격리406개 새 실패0(얇은 층은 signal.css 하나)·합성 화면·교사 앱61/61, 공식 Claude Code **Opus5.5/max PASS**(P0·P1·P2 없음). 유호님이 한 줄 스크립트(격리 시험→사전 백업→교체→확인→공개 대조→6판 냉복사본 정리)를 실행했고 01:23 교체: 냉복사10파일 일치, 환경은 이미지 값만, healthy·타이머3 active, 공개7파일·health ready, 6판 냉복사본(10파일)은 기록 대조 뒤 삭제. 이 PC가 원래 허용 IP여서 방화벽은 건드리지 않았다. [반영 기록](../../../_ops/qa/workspace-signal-20261010/README.md)

## 이전 완료 — 2026-10-10 22:44 워크스페이스 화면 「싱ㅋ 시그널」 6판

유호님 「남은 P3도 고쳐서 6판 반영해줘」. 5판 공식 검수 P3(휴대폰 이력·트렌드 날짜 칸, 높은 대비 초점, 교사 앱 연결 코드 칸)와 container-delivery 시험 목록을 고친 네 파일만 바꾼 `292b35a4c601`(부모 5판 `5322c9f00619`, 561파일), 이미지 `sha256:be4059d3d884f8ada65f976e9d082cff7acf931dcc2a0448abff143ae4561b7b`이다. 윈도1,350개 5판과 같음·VM 격리406개 새 실패0·합성 화면·내 수업57/57, 공식 Claude Code **Opus5.5/max PASS**(P0·P1·P2 없음). 유호님이 한 줄 스크립트(SSH 임시 허용→격리 시험→사전 백업→교체→확인→공개 대조→SSH 닫기)를 실행했고 22:44 교체: 냉복사10파일 일치, 환경은 이미지 값만, healthy·타이머3 active, 공개7파일·health ready, SSH 닫힘. [반영 기록](../../../_ops/qa/workspace-signal-20261010/README.md)

## 이전 완료 — 2026-10-10 20:40 워크스페이스 화면 「싱ㅋ 시그널」 5판

유호님 「웅 끝나면 알려줘」. 4판 공식 검수의 P2(「내 수업」 반 선택 칸 14px로 iOS 확대)와 P3(휴대폰 마케팅 날짜 칸 잘림 등)를 고친 CSS 두 파일만 바꾼 `5322c9f00619`(부모 4판 `3dab2091631c`, 561파일), 이미지 `sha256:8ad95dc9a86fe9450e2153599a0aaa68d552cd953dd944e2de3e9a76b4854578`이다. 윈도1,350개 4판과 같음·VM 격리406개 새 실패0·합성 화면(날짜 칸 320~390px 잘림 없음)·내 수업54/54(반 선택 칸 휴대폰16px), 공식 Claude Code **Opus5.5/max PASS**(P0·P1·P2 없음). 20:39 사전 백업1회·업로드 완료, 20:40 교체: 냉복사10파일 일치, 환경은 이미지 값만, Caddy·7unit·볼륨 그대로, healthy·타이머3 active, 공개7파일·health ready. [반영 기록](../../../_ops/qa/workspace-signal-20261010/README.md)

## 이전 완료 — 2026-10-10 19:52 워크스페이스 화면 「싱ㅋ 시그널」 4판

유호님 「웅 그대로 진행해」. 3판 공식 검수의 P2(iOS 16px 미만 입력 확대)와 P3를 고친 CSS 세 파일만 바꾼 `3dab2091631c`(부모 3판 `839674add99c`, 561파일), 이미지 `sha256:dde2af2569440cf697722791b4eee99420b12c87aaa784a94e8d638eaa9f89bb`이다. 윈도1,350개 3판과 같음·VM 격리406개 새 실패0·합성 화면(휴대폰 입력 전부16px)·내 수업50/50, 공식 Claude Code **Opus5.5/max PASS**. 19:51 사전 백업1회·업로드 완료, 19:52 교체: 냉복사10파일 일치, 환경은 이미지 값만, Caddy·7unit·볼륨 그대로, healthy·타이머3 active, 공개7파일·health ready, 공개 로그인 375px 입력16px 확인. 남은 P2(내 수업 반 선택 칸14px)는 다음 판. [반영 기록](../../../_ops/qa/workspace-signal-20261010/README.md)

## 이전 완료 — 2026-10-10 19:12 워크스페이스 화면 「싱ㅋ 시그널」 3판

유호님 「웅 반영해줘」·「웅 검수 통과하면 그대로 진행해」(로그인은 「너무 투박하다」 뒤 2판)에 따라 Claude 리디자인을 반영했다. 운영 부모 `d6579a536bdc`(558파일) 위에 바뀐 파일 10개만 얹은 `839674add99c`(561파일), 이미지 `sha256:99f1cc070e4ac7504d86eed7b6f408e4fdef32f019bf701ba5c35d1f926bd167`이다. 새 CSS 세 파일(회사·메신저·교사 앱)이 맨 마지막에 읽혀 펠트 층을 덮고, JS·HTML·서버는 링크·아이콘·정적 허용 목록·COPY·dockerignore 한 줄씩만 바꿨다. 인증·권한·DB·업무 로직·환경 변경 없음.

윈도 105파일 1,350개(부모와 같음·새 실패0), 후보 트리 합성 화면(로그인 4상태×4폭·주요 9화면·휴대폰 메신저·넘침0), 내 수업 합성 학급50/50, VM 격리 이미지 406개(새 실패0), 공식 Claude Code **Opus5.5/max** 1판·3판 모두 PASS(1판 P2 7건은 3판에서 고침). 19:11 사전 백업1회·업로드 완료, 19:12 교체: 냉복사10파일 해시 일치, 환경31중 이미지 값만, Caddy·7unit·볼륨 그대로, healthy·타이머3 active, 공개7파일 SHA/MIME·health ready, 공개 로그인 1024/375px 확인. SSH는 방화벽이 보안 설정이라 유호님이 직접 임시 허용했다(닫기 확인은 반영 기록에 적는다). 3판 검수 P2(iOS 16px 미만 입력 확대)는 위 4판으로 반영했다. [반영 기록](../../../_ops/qa/workspace-signal-20261010/README.md)

## 이전 완료 — 2026-10-10 04:22 오늘 분류 근거·관리 버튼

내 할 일 상세에 서버 한국 날짜와 오늘 포함/제외 근거를 표시하고, 상태·담당·기한·결과물 관리 버튼을 연결했다. 담당/검토자 불가를 정상 대기로 안내하지 않고, 재지정 권한자의 관리 버튼은 새 검토자 선택칸부터 연다. 실제 적용은 기존 변경 저장이며 분류·권한·스키마·저장 규칙을 유지한다. 다른 작업이 먼저 반영한 e01/508의 수업 연결·host 변경을 보존해 f1d808a761db/510(runtime3·새시험2·삭제0), image `sha256:1769caf965a25ddd85b32a0484b582310c33f3bcb2fe19fb81cd8ee25546c49d`를04:15 반영했다.

정확 Windows339/339·Linux339/339·합성 CUA11·390/320px 넘침0/44px, 공식 Opus5.5/max 재검수 실제 완료·PASS/기존P2두건해소와 운영 보호검사85를 확인했다. Linux의 packaging 자료2개 누락 실패와 같은 이미지 RO자료 재시험을 보존했다. 환경31중 이미지 선택만 변경했고 기존 volume·7unit·Caddy·원키·업무자료와 직원5세션/CSRF/만료를 보존했다. 04:08 사전 수동백업1/업로드완료, 정지사본 대조문제0·schema0·만료삭제0·평문동일 직원암호문1재암호화, 공개5파일 SHA/MIME·healthready·main3timeractive/healthy를 확인했다. 실제 유호 계정의 재로그인0·기존메모/111B첨부·오늘없음/등록버튼·운영픽셀 확인을 완료했다. 운영업무쓰기/유료기능호출0; 고객활성0은 연속성 대상없음. [최종 인수와 증거](../../../../../tools/company-messenger/qa-output/task-action-20261010/README.md).


## 이전 완료 — 2026-10-10 03:15 내 수업·학생 케어 연결

WORLD·TOWN·Workspace를 같은 계정·반·학습 데이터로 연결하라는 요청에 따라 전용 교사 OAuth와 **내 수업 → 담당 반 → 학생 상세·케어**를 운영 반영했다. 바로 앞 직접 할 일 등록의 `92e7854bc156` 부모를 보존한 508파일 `e01fe60531bc`, image `sha256:69c5f8b39fbd40316f235c0a159b182bd4281bad650aa73a280012e9291203dc`다. 별도 교사 세션과 담당 반 권한을 사용하며 회사 권한을 교사 권한으로 바꾸지 않는다.

정확 후보 Windows·Linux·실제 이미지 각126/126, 합성 Chromium50/50(기본2반32명·320/390/1280/1440px)을 통과했다. 공식 Claude Code Opus5.5/max의 제품·운영 교체 절차 최종 검수가 정상 완료됐다. 사전 수동 백업과 업로드 완료 뒤 적용→정지 사본→같은 후보로 재개→논리 대조를 수행했고, 기존 업무·첨부·키·직원5세션/CSRF/만료를 보존했다. 허용한 자료 차이는 빈 교사 세션 표1개와 같은 평문의 직원 암호문 재암호화1건이다. 활성 고객0은 연속성 검증 해당 없음이다.

기존 volume·Caddy·7unit·원래3타이머·AI0/BACKGROUND0을 보존했다. 환경 변경은 이미지와 전용 교사 client 설정뿐이다. 공개11파일의 SHA, health ready, teacher configured를 확인했다. 실제 교사 로그인과 실학생 계정 연결·공유·학습 왕복은 아직 별도 인수다. [실제 배포·보존 증거](../../../../_ops/qa/workspace-connect-20261009/company-live-cutover.json)·[전체 연결 현황](../../../../_ops/qa/workspace-connect-20261009/README.md).

## 이전 완료 — 2026-10-10 01:49 직접 할 일 등록

사용자 「오케이 이어서 해」에 따라 **내 작업실 → 내 할 일 → 오늘 할 일 → 할 일 등록**을 운영에 추가했다. 제목·요청 내용/완료 기준·대화방·담당·선택 검토자·한국 시간 기한을 직접 입력하며 기본은 나에게 메모와 본인 담당이다. 원문 메시지·업무·알림·재시도 기록을 원자적으로 저장하고 기존 수락/작업/검토/완료 흐름을 사용한다. 기존 오늘 판정·상세 개선과 최신 c1의476파일을 보존한 `92e7854bc156`의479파일(runtime8·검증2·삭제0), image `sha256:dda14e86344509453d59e76397c71485c218a033b68d5fc72e6a40befb0139f9`가 현재 운영본이다.

정확 Windows282/282·Linux282/282·합성 CUA7/390·320px 가로 넘침0, 스키마35객체 동일·운영 보호검사67 통과. 공식 Claude Code **Opus5.5/max**는 새 동결본을 실제 모델5.5로 검수 완료했고 P0/P1/P2 지적이 없었다. 이전 검수 생략 예외는 사용하지 않았다. 공개5파일의 바이트/SHA/MIME와 health200/ready, 운영 image/manifest·healthy/main과3타이머 active를 확인했다.

01:34 사전 백업1회/업로드 완료, 01:36 적용 및 01:37 정지 사본 비교/원래 타이머 복원 완료. 업무·첨부·키·직원5세션/CSRF/만료·volume/env30중 이미지 외 값·7unit/Caddy 보존, 스키마 변경0·만료 삭제0·평문 동일 세션 재암호화1을 확인했다. 유호 기존 계정은 재로그인 없이 원래 메모/첨부와 새 등록 양식을 열었으며 오늘 업무 없음·서버 날짜2026-10-10·나에게 메모/본인 담당 기본값을 DOM으로 확인했다. 운영 업무/메시지 등록과 유료 기능 호출0. 운영 픽셀 캡처는 브라우저 도구 오류로 얻지 못했고 합성 화면8개와 구분한다. 실물폰·네이티브·실제 업무 등록/효과는 미시험이다. [최종 인수·증거 경계](../../../../../tools/company-messenger/qa-output/task-create-20261010/README.md).

## 이전 완료 — 2026-10-09 23:57 내 할 일 오늘 판정·상세

사용자 **「이번 작업만 재검수를 생략하고 지금 반영」** 승인으로 내 할 일의 첫 화면을 오늘 처리할 업무·이름·다음 행동으로 바꾸고 없음/미래·기한미정/대기/조회실패를 구분했다. 상세에 최신 원문·첨부·역할/기한·완료조건·사람의 등록/배정근거, 서버 상대 KST자정 갱신·처리불가 안내·검토 전 검토자 복구·마린 같은 기준을 반영했다. 최신 제작데스크 fc544/469파일을 보존한 c1c28ac49729/476파일(runtime4·검증9/새검증7/삭제0), image `sha256:f6f555fc6816c9c9da11ccf26ce0ae85930d11996f28af2acc690a79ca5c7fb9`가현재운영본이다.

정확 Windows230/230·Linux230/230·CUA11/오류0·390/320px넘침0·기본node의300image파일/176host-only분리·공개5파일SHA/MIME·healthready를 확인했다. 유호 기존세션 첫 클릭이 오늘 할 일을 열고 실제 현재등록업무없음과 선정기준을 보여 준다. 실업무0이라 양성/상세/미래/대기는 합성 증거로구분한다. 사전백업1회와업로드완료,업무/키/첨부·직원5세션/CSRF/만료·volume·env30중이미지외값·7unit/협동Caddy보존, schema변경0·main3timeractive/healthy. 활성고객0은연속성해당없음. 새메시지/운영업무/구독/실푸시/유료AI0·임시SSH원복,새접근신청은PATCH전guard차단뒤기존승인SSH사용. 공식보완재검수429/미완료를본건예외로남기고PASS로칭하지않는다. [최종 인수·실제 화면](../../../../../tools/company-messenger/qa-output/workday-truth-20261009/README.md). 아래이전운영이력은보존한다.

## 이전 완료 — 23:23 제작 데스크 첫 화면

제작 데스크를 새 기획/작성 중 이어하기/본인 최근 기획/게시 전 점검 우선·팁기본접힘으로 공개 반영했다. 최신펠트6fb9를보존한469파일·UI2차분 `fc544bd6b024`, image `sha256:e03921dee39ecb270e3d9dd3cfe0e0b9881ec67295d15dcbb89daed1faef4cb9`(`synk-company-candidate:fc544bd6b024`)가 현재운영본이다. 다른서버·권한·API·기록은보존했다.

회귀60/60·최종Chromium151/151·기본사용자2자산0644읽기, 공개2파일SHA/MIME·healthready, 실제유호 기존세션의선택기획작성/점검publish진입·팁접힘·1280/320첫CTA54px을확인했다. 반영전백업·업로드완료, schema변경0·기획/업무/첨부/원키/VAPID·직원5세션/CSRF/만료·volume/env30중이미지외값/7unit/협동Caddy보존·main3timeractive/healthy다. 고객활성0은유지검증대상없음, 실기획0의이어하기/교체/권한/오류는합성검증으로구분한다. 생성/저장/게시·새메시지/구독/실푸시/유료AI·운영DB직접쓰기·방화벽변경0·설치바이너리교체0이다.

최초공식P2는고쳤으나최종재검수는사용량제한미완료, 사용자「이번 개편만 검수 생략하고 반영」으로이번UI2만승인했다. 공식PASS·전체Linux·실물폰·VM재부팅·실제제작효과로확대하지않는다. [최종인수·실제화면·계보](../../../../_ops/qa/workroom-desk-20261009/README.md). 아래는이전운영이력이다.

## 이전 완료 — 22:42 펠트와 전체 화면 마감 업그레이드

2026-10-09 사용자 **「오케이 지금 배포 해.」** 승인으로 새 펠트 재질과 화면 마감을 [운영 워크스페이스](https://workspace.synk.im/)에 반영했다. 최신 회사 안내·설정 부모 `8d02d43640be`를 보존한 최종 v4 `6fb9a3d42bc2`(469파일, CSS12·이미지44의 56변경), 이미지 `sha256:d01013528430b91e639b2bc1c3e0f8359d6b460a5229951ce3ae0321020a9f31`를22:36 배포했다. 과한 스티치·부풀린 테두리를 걷어내고 선택 상태, 본문 여백, 작은 화면의 카드·모달·메신저 탭을 정리했다. JavaScript·서버·인증·DB 변경은 없다.

정확 후보의 15개 시험파일185/185, CSS 구문 오류0, root 직접 검수2회36화면과 v4 추가11검사를 마쳤다. 배포 뒤 실제 유호 계정에서 로그인 클릭 없이 트렌드 화면390·1440px와 메신저를 확인했다. 기존 메모·111B Drive첨부 표시와 실시간 연결을 확인했고 가로 넘침·깨진 이미지·콘솔 오류는 없었다. 공개56경로는55개HTTP200/새SHA·MIME와 현재 서버가 제공하지 않는 teaching.css의 의도된404로 모두 예상 결과였다. 기존 ETag를 보낸11경로도 새 바이트를 반환했다. 오래 열린 IAB 탭의 캡처 시간 초과는 보존하고 같은 기존 계정의 새 탭에서 실제 운영 화면4장을 저장했다.

22:36 수동 사전 백업1회의 같은 실행 귀속과 업로드 완료를 확인했다. 새 객체의 독립 다운로드·복구는 반복하지 않았다. 교체 전후 정지 사본에서 schema변경0·업무자료/첨부/원키 보존, 같은 평문의 직원 암호문1 재암호화·만료token/고객행삭제0을 확인했다. 직원5개의 동일 세션·CSRF·만료를 유지했으며 활성 고객0은 연속성 검사 해당 없음이다. 22:41 최종 main/3timer active·healthy, 기존volume·7unit·환경30개 중 이미지 외 값과 협동 Caddy 경로를 보존했다. AI0/BACKGROUND0·WORK1/PUSH1 유지, 새 메시지·파일 업로드·푸시 구독·실푸시·유료AI 호출0이다.

공식 v3 Opus5.5/max 검수의 P2 두 건은 수정 후 root가 확인했다. **공식 v4 후속 검수는429 사용량 한도로 미완료**이며, 이번 정확 릴리스만 검수 예외로 지금 배포할지 묻는 질문에 사용자가 위와 같이 승인했다. 공식 PASS나 일반 검수 원칙 변경으로 기록하지 않는다. 월정액 내장 이미지 도구의 정확 모델·품질 선택 확인 한계도 사용자가 승인한 대로 남긴다. 실물폰·네이티브 앱 강제 재시작·이번 이미지의 전체 VM 재부팅은 재시험하지 않았다. [최종 인수](../../../../_ops/qa/messenger-felt-upgrade-20261009/final-acceptance.json)·[검증 기록과 실제 화면](../../../../_ops/qa/messenger-felt-upgrade-20261009/README.md).

## 이전 완료 — 21:36 회사 안내·설정과 작업 화면 정리

2026-10-09 사용자 「이어서 해」 및 **「이번 UI 업데이트 한 번만 검수 생략하고 반영」** 승인으로 회사 안내를 주요 메뉴에서 빼고 **설정 → 회사 안내**로 옮겼다. 안내 분류·읽기 폭·항목/적용 상태, 작업실의 중복 설명, 마케팅 공유 단추와 작은 글자, 모바일 메신저 업무 패널의 여백·누르는 영역을 정리했다. 기존 17원문과 역할 권한은 유지한다.

먼저 반영된 AI 업무 연습 제거 부모 `2204c3bf2133` 위에 동일 승인 UI만 재이식한 `8d02d43640be`(445파일·UI6/검증3변경), 이미지 `sha256:1f2f95433dae808628a58ad0375ac6b55df25358356e86d1a894fa070dba70c3`를21:34 반영하고21:36 보존 확인을 마쳤다. 원래 승인 후보 `e130f2013599`는 공개하지 않았으며, 같은 UI를 역변환하면 각각의 운영 부모가 복구되는 재이식 증거를 보존한다. 최신 부모의 index·실습 제거·서버·인증·Caddy/협동 경로 등 비대상 바이트를 유지했다.

Windows·실제 Linux129/129, 격리 실행108항목·컨테이너 교체24+24, 1440·390·320px의 합성 Chromium48캡처·안내99/메신저36검사, 공개10파일HTTP/SHA/MIME 및 health ready를 확인했다. 실제 Chrome의 유호 계정에서 새 로그인 없이 제작 데스크·설정 목록·회사 안내·직원 분류를 확인했다. 실제 Chrome 픽셀 캡처는 도구의 surface 시간 초과로 저장하지 못했으며, 시각 정렬 근거는 정확 후보의 합성 Chromium 캡처와 구분한다.

사전 백업1회와 업로드 완료를 확인했고 새 객체의 독립 다운로드/복구를 반복했다고 주장하지 않는다. 정지 사본의 schema변경0·업무/첨부/키 보존, 같은 평문의 직원 암호문1 재암호화·token삭제0, 직원5세션/CSRF/만료 보존을 확인했다. 현재 활성 고객0은 연속성 검사 해당 없음으로 기록한다. 기존30환경값은 이미지 외 동일하며 원래volume·7unit·3timer·협동 경로를 유지한다. 실행 중인 PC Preview는 이 공용 주소를 읽으므로 바이너리/프로필 교체 없이 새로고침하면 새 UI를 쓴다. 네이티브 창의 강제 재시작과 실물폰/PC 종료 시험은 수행하지 않았다.

이번 공식 Opus5.5/max 시도는429로 미완료였고 실제 모델 사용/PASS를 주장하지 않는다. 이번 UI1회 직접 승인만 적용하며 일반 검수 원칙은 유지한다. 유료AI시험·새 메시지·구독·실푸시0. 초기 부모 변경/읽기 증명 실패 기록과 만료 고객 처리 도구 보완을 보존한다. [최종 인수](../../../../_ops/qa/workspace-ui-polish-20261009/final-acceptance.json)·[공개 대조](../../../../_ops/qa/workspace-ui-polish-20261009/live/public-verification.json).

## 이전 완료 — 20:51 AI 업무 연습 메뉴 제거

사용자 「빼줘」와 이번 메뉴 제거의 검수 생략·공개 반영 「웅 반영해」 승인에 따라 운영 `workspace.synk.im`의 실습 메뉴·진입·모듈 로딩을 제거했다. 기존 `section=practice`는 제작 데스크로 돌아가고 실습 원본·저장 기록·API는 보존한다. 부모 `3a2f537a37d9`의 444파일 중 UI3파일만 바꾼 `2204c3bf2133`, 최종 이미지 `sha256:5c79dacb01685bfe560c7d19caff0aacee7f68455e2d653c7236f6a5402e82f6`(`synk-company-candidate:2204c3bf2133-r2`)를 반영했다. 첫 이미지의 파일 권한500은 바이트 변경 없이0644로 수정해 기본 사용자 읽기·지속 이미지 재시작·공개 대조를 다시 확인했고 실패 기록은 보존했다.

반영 전 백업·업로드 완료, schema변경0·원래키/VAPID·업무·첨부 보존, 환경30개 중 이미지 외 값·원래volume·7unit·협동Caddy 불변을 확인했다. 최종 직원5개 세션·CSRF·만료 보존, main/3timeractive·healthy·공개3파일HTTP/SHA/MIME·실계정 IAB 새로그인0/메뉴0/기존주소desk를 확인했다. 활성 고객은0이라 이번 고객 로그인 유지 검증 대상은 없으며, 기동 전에 이미 만료된 고객1행은 기존 생성자의 정상 청소로 구분했다. 운영자 SSH IP는 일시 추가 후 원래 제한으로 복원했다. 유료AI/새메시지/구독/실푸시0이며 설치 바이너리 교체는 없었다. 현재 앱은 새로고침하면 반영된 화면을 쓴다.

이번 공식 Opus5.5/max 검수는429 사용량 제한으로 미완료이며, 사용자 승인으로 이번 UI3파일에만 생략했다. 과거 완료된 검수나 전체Linux843시험을 이번 검수로 재사용하지 않는다. [최종 검증·실제 화면·실패와 수정](../../../../_ops/qa/workroom-practice-removal-20261009/README.md). 아래는 과거 운영 인수 이력이다.

2026-10-09 07:55 KST 기준 **[workspace.synk.im](https://workspace.synk.im)에 백업 잠금 충돌과 로그인 복구 보완을 반영하고 기존 세션·자료 인수를 마쳤다.** 직원·고객 모두 재로그인 없이 기존 메모·첨부·상담 원문을 열었다. 첫 정기 백업·비공개 GCS 독립 다운로드와 자동 감시 이력은 보존한다. 실물 휴대폰·PC 종료 시험은 사용자 보류다.

전체 클라우드 공식 Opus5.5/max 검수는06:42 완료됐고 발견한 백업P2를 수정했다. 별도 SSO 검수의 갱신·초기 복원P2 및 첨부 재시도 초점도 보완했다. **이번 정확 통합본의 공식 보완 검수는 세션 한도로 미완료**이며, 이 대화의 직접 사용자 지시 “클로드 최종 재검수는 미루고 나머지 전부 진행해”를 적용했다. 검수 PASS나 일반 검수 정책 변경으로 기록하지 않는다.

Google Compute Engine 한 대·영구 디스크·Caddy HTTPS·비공개 GCS 백업으로 운영한다. Atlas 8개마다 서버를 만들지 않는다. 기본 결제는 unmet27@gmail.com의 synk-bake-unmet27와 [돈장부](../../../../_ops/돈장부.json)를 따른다. AI0/BACKGROUND0·WORK1/PUSH1을 유지하며 유료 AI·새 메시지·구독·실푸시0이다.

## 이전 완료 — 07:55 백업·로그인 복구 보완과 기존 자료 인수

협동 경로가 추가된 부모85b20c886ba0을 그대로 보존한 통합v3 `3a2f537a37d9`(444파일·9변경, image `sha256:f48543ac0547cd069227cc19202486c9aa526673c36591544c448315ea800070`)를07:48 반영하고07:49 자료 사본 확보 뒤 같은 버전으로 재개했다. main/3timers active·healthy, 원래 volume·7unit·30환경항목에서 이미지만 변경했다. 협동 Caddy 바이트가 부모와 같고 별도 협동 health도200이다.

백업은 공유 잠금을 최대120초 기다리고 시간 초과면 BACKUP_FAILED/exit1로 실패한다. health의 기존 비차단 계약은 유지했다. 같은 계정 갱신 후 화면을 즉시 복원하고 초기 네이티브 복원의 일시 실패를 다시 이어가며, 전면 복귀 시 회사 재인증·iframe/API/XHR 경계를 확인한다. 첨부 재시도 전 복구 실패의 버튼 초점을 복원하고 사용자가 옮긴 입력 초점·초안을 보존한다. 자동 재전송이나 권한 확대는 없다.

Windows843중839통과/실패0/플랫폼skip4, 실제 Linux843/843·skip0·전달108·실제CMD교체24+24를 통과했다. 격리 실제 Linux 잠금21/21(120초 초과 포함), 함수회귀44/44와 정확v3 실제Chromium초점2흐름, 소스분리본86/86도 통과했다. 최초 반영 사전검사 실패는 운영 변경0·원인 미확정으로 보존했다. 읽기16검사·부모 불변 확인 뒤 같은 보호 조건으로 재시도했다.

07:45 수동 사전백업1회의 같은 boot/unit/실행 귀속·178,361B archive SHA·업로드 marker를 확인했다. 새 객체의 독립 GET/복구를 반복하지 않았고 첫 정기백업의 독립 검증과 구분한다. 정지 사본의 schema변경0·기존업무행/파일/키 보존, 동일평문 직원암호문1 재암호화·기동전만료token1삭제를 확인했다. 직원5/고객1의 동일 session/CSRF/만료·원키/VAPID·업무자료와 실제 컨테이너 교체를 대조했다. 기존 IAB 탭 reload·로그인 클릭0으로 유호/원래메모/111B첨부/23:33 고객초안을 다시 열었다. 공개17파일 SHA/MIME 일치·health ready다.

소스10파일 `0a53f32d0365`를 codex/company-cloud-push-20261009에 push/ref 대조했고, Git의 CRLF 정규화 외 내용은 후보와 같다. 다른 작업8파일을 보존했다. 전체 운영 snapshot·master 반영·CI 통과를 주장하지 않는다. **남음:** 사용자가 미룬 이번 공식 보완검수와 실물폰/PC종료 시험, 실푸시·실제09시마감 관측, 별도 비용 승인 뒤 유료AI 시험. 근거: [최종 인수](../../../../../.tmp/company-final-review-fixes-20261009/FINAL-ACCEPTANCE.json), [운영 결과](../../../../_ops/qa/company-final-fixes-20261009/result.json).

## 07:27 협동 게임 경로 추가

WORLD 협동 서버의 공식 추가 검수를 마친 뒤 기존 VM에 별도 `synk-spaceship.service`를 설치·활성화했다. 회사 current는 `1fa6475e97eb`에서 `85b20c886ba0`으로 전환했고, 444파일 중 Caddy 한 파일만 바뀌었다. 회사 컨테이너·이미지·시작 시각·DB·환경과 기존 자료는 그대로이며 HTTPS 컨테이너만 기존 이미지·인증서 volume으로 재생성했다. 회사 health와 협동 health를 통과했다. 공유 Caddy에도 적용된 동일 경로를 반영했으므로 다음 회사 릴리스에서 `/api/spaceship` 경로를 보존해야 한다.

`https://workspace.synk.im/api/spaceship`의 실제 CORS·SSE와 두 독립 HTTP 연결의 18개 수리·공동 출발을 확인했다. 합성 임시방 시험이며 공개 게임 화면의 브라우저 음성·실제 두 사람·물리 기기 검증은 별도다. 우주선 방은 메모리에서 유지되며 서비스 재시작 시 사라진다. 계정 학습 기록은 별도 SYNK Play 서버 배포 대상이다. 근거: `experiences/beginner-games/qa/account-sync/coop-release/r4/`의 `service-apply-result.json`, `route-apply-result.json`, `public-api-result.json`.

## 이전 완료 — 06:38 메신저 전송 복구와 기존 자료 보존

메신저 v6 `1fa6475e97eb`(444파일, image `sha256:cb9e1c5bba1b65793a6b0f0be872dfdfbf68c9f134d31362240428a8513f863e`)를 SSO v8 부모 위에 반영했다. 메시지 전송 결과 확인·같은 요청 재시도·취소와 원래 파일 재시도를 제공하고, 작성 중인 초안과 키보드 초점을 보존한다. 큰 파일은 전송이 진행되는 동안 2분 총시간 제한으로 끊지 않는다. 취소된 불확실 업로드의 늦은 저장과 중복 전송을 차단한다. 회사199파일은 부모와 동일하다.

Windows814통과/2심볼릭링크skip·실제 Linux816/816·브라우저35/35와 실시간 136,813ms의 8MiB 제한속도 업로드를 통과했다. 합성 업그레이드398항목·11단계·정상종료6회에서 자료·키·중복방지·취소 기록 지속을 확인했다. 공식 Claude Opus5.5/max 보완 검수는 06:23:55 완료됐고 v5의 P2 세 건을 해결했다. 검수자가 결과 작성 전 읽었던 시험의 시간차는 원시 검수를 수정하지 않고 별도 대조 기록으로 보완했다.

06:29 사전 백업1회의 같은 실행 귀속·177,370B archive SHA와 업로드 marker를 확인했다. 이 새 객체는 독립 다운로드를 반복하지 않았으며, 첫 정기 백업의 독립 GET/복구 이력과 구분한다. 첫 apply는 운영 변경 전에 거절돼 부모가 그대로였고, 읽기 재진단 통과 뒤 같은 보호 조건으로 재시도해 06:32 반영했다. 최초 거절 원인은 확정하지 않고 실패를 보존했다. 06:34 정지 사본 확보 뒤 같은 버전으로 정상 재개했으며 자동 rollback은 없었다.

엄격 대조에서 기존 schema·업무행·첨부·원키/VAPID가 보존됐고 새 빈 전송기록3표만 추가됐다. 직원 암호문2건은 평문 전체가 같고, token1건은 기동 전에 이미 만료됐음을 따로 확인했다. 직원7·고객1의 동일 session/CSRF/만료와 실제 컨테이너 교체를 대조했다. 기존 IAB 탭 reload에서 로그인 단추를 누르지 않고 유호·원래 메모·111B Drive첨부·23:33 고객 원문을 다시 열었다. main/3timer active·healthy, 공개14파일 SHA/MIME 일치, 원래 volume·7unit·30환경값(이미지만 변경)을 유지한다. AI/BACKGROUND0·WORK/PUSH1 유지, 새 메시지·구독·실제 푸시·유료AI 호출0이다.

PC 담당의 별도 정상 프로필 인수에서도 기존 Platform 계정·완료 메모5개·미저장 복구1개와 Platform→설치 Messenger의 기존 회원 연결을 확인했다. 실물 폰과 PC 종료 시험은 수행하지 않았다. 근거: `.tmp/messenger-send-recovery-20261009/linux-v6/FINAL-ACCEPTANCE.json`, `docs/_ops/qa/platform-unified-followup-20261009/actual-account-pc-restoration.json`. 운영 재개 시 이 인수와 current-handoff를 우선하며 아래는 단계별 과거 기록이다.

## 이전 완료 — 04:57 고객 로그인 유지와 두 계정 재시작 인수

04:46 고객 세션 유지 릴리스 `20fda68c0fbf`를 배포했다. 직원 부모 `295a596d7498`에서 고객 인증·회귀 시험·설명·서버 연결의 5파일만 바꾼 고정 438파일이다. manifest `20fda68c0fbfec593f4d76baf9dd450e73cf959e8afe1eab6638a73c22a56217`, image `sha256:b1c757dee6e886f913fdb0569703e2da5049e063d2552f7b11a3b8479fa75d8c`. 기존 volume·30개 환경 항목 중 image 외 값·7개 systemd unit을 보존했다. 직원·고객 AI0/BACKGROUND0, WORK1/PUSH1이며 새로운 메시지·구독·푸시·유료 AI 호출은0이다.

정지 사본의 엄격 대조에서는 새 빈 고객 세션 표만 추가됐고 기존 업무·파일·원키/VAPID는 보존됐다. 직원 세션 암호문1건의 재암호화는 모든 복호화 값이 동일함을 별도로 검증했으며 token 삭제는0이다. 최초 업그레이드 직후에는 기존 메모리 전용 고객 세션 때문에 정상 고객 로그인1회가 필요했다. **그 뒤 04:51~04:52 인수용 정상 서비스 재시작1회(SIGTERM/exit0·SIGKILL0) 후 직원·고객 모두 로그인 단추를 누르지 않고 복귀했다.** 유호·기존 메모·Drive 첨부·23:33 상담 원문을 실제 화면에서 확인했다. 04:56 서버 대조도 두 계정의 동일 session/CSRF/만료, 원키/VAPID/문서/메신저 자료와 실제 컨테이너 재시작을 확인했다. 04:57 main·3timer active, container healthy, 공개 health ready·16자산 SHA/MIME 일치다. 전체 VM 재부팅은 과거 부모 이력과 구분한다.

고객은 전용 암호화 표에 저장하고 복원 후에도 매 보호 요청마다 중앙 계정·현재 세션을 확인한다. 원래 8시간 절대 만료를 연장하지 않는다. 중앙503은 접근을 보류하고 복구 후 재로그인 없이 이어가며, 철회401·로그아웃은 세션을 제거한다. 회전된 refresh는 후속 검증 전에 보존하고 종료 중 로그아웃도 즉시 삭제한다. 상세는 [고객 로그인 계약](CUSTOMER_IDENTITY.md)을 따른다.

Windows738통과/0실패/2symlink skip, 실제 Linux740/740/skip0, 전달108항목·기동/교체24+24, 합성 고객92·직원127 인증항목과 정상종료4회를 통과했다. 공식 Claude Opus5.5/max 검수 시도는 세션 한도(05:30 초기화 안내)로 **미완료**다. 이번 클라우드 후속에 대한 기존 사용자 검수 보류 지시와 실제 실패 기록을 보존했으며 공통 정책은 바꾸지 않았다. 이전 직원 릴리스의 완료된 부분 검수를 이번 고객 코드 검수로 확대하지 않는다.

인증 소스·시험·설명8파일 커밋 `9bd80a3adf164fdd1e1270e1684b94469c749366`을 `codex/company-cloud-push-20261009`에 push하고 원격 ref를 대조했다(해당 소스 시험141/141). 전체 운영 트리의 동일 snapshot·master 반영·CI 통과 주장은 아니다. 기존119파일 최적화 push 이력도 유지한다. 근거는 `.tmp/customer-session-restart-20261009/FINAL-ACCEPTANCE.json`, `HANDOFF.md`, 두 실제 화면과 `.tmp/company-cloud-20261008/current-handoff.json`이다. 04:44 수동 사전 백업은 업로드 완료까지 확인했고 해당 새 객체의 독립 GET/복구는 주장하지 않는다. 아래 첫 정기 백업 증거와 구분한다.

## 이전 완료 — 03:59 직원 로그인 유지와 첫 정기 백업

03:19 배포된 로그인 유지 v2(295a596d7498)는 03:54~03:55 정상 서비스 재시작 1회 후 실제 직원 브라우저 새로고침에서 재로그인0으로 유호·기존 메모·Drive 첨부가 열렸다. 실제 컨테이너 SIGTERM/exit0·SIGKILL0, 동일 세션/CSRF/만료·원키/VAPID/문서/설정, 원래 volume/env/timers 보존을 확인했다. 고객은 별도 SYNK 재로그인 뒤 23:33 기존 글만 초안을 불러왔으며 고객 세션의 재시작 지속까지 완료로 주장하지 않는다. 새 업무쓰기·유료AI·구독/푸시0. 공개 health ready·13파일 일치. 첫 정기백업03:32:05~06의 원래timer/invocation·업로드·169,579B GCS 독립GET200/SHA 일치, 자연 watch03:52:55 BACKUP_FRESH까지 확인했다. 03:50 원본은 watch 이전의 미확인 상태로 보존하고 읽기 전용 후속 증거로 보완했다. 03:55 heartbeat는 진행 중인 인수에 합쳐 재시작 중복0이다. 실물폰/PC종료/실푸시와 전체 클라우드 Claude 검수는 보류, 실제09시 마감묶음은 미관측이다.

현재 437파일 manifest `295a596d7498535aa5dd76e3b616eba814f59afbae57c8d88608b04e4d01e7b7`, image `sha256:b5a871571e0828da5a091e5c472fdf2bf1b79ba828e48109afff414e9879b40e`. Windows702/0/2skip, Linux704/704/skip0과 합성 인증127항목/정상종료4회 통과. 공식 Opus5.5/max는 v1→v2 코드 수정 검수 완료이고 시험 실행 증거는 배포 담당이 별도로 대조했다. 운영 정지 사본에서는 새 빈 identity 표만 추가됐으며 기존 행·키·파일은 보존되고 token삭제0이다. 전체 VM 재부팅은 과거 부모에서 확인한 결과이며 이번 인수는 현재 서비스의 정상 재시작이다.

근거는 `.tmp/messenger-session-restart-20261009/FINAL-ACCEPTANCE-V2.json` 및 `.tmp/company-cloud-20261008/current-handoff.json`. 아래 01:44까지의 후보·백업·미확인 상태는 이전 단계 이력이다.

## 이전 운영 검증 — 01:44 KST 기록

| 항목 | 실제 확인 | 구분할 한계 |
|---|---|---|
| 서버 | 서울 synk-company-1, 고정 IP34.64.170.2, main enabled/active, company healthy, Caddy HTTPS, 3timer active. 01:22 읽기 전용 운영 검사10/10 통과 | VM 전체 재부팅은 부모 be219, 현재 aeb162는 서비스 stop/start까지 |
| 데이터 | 최신 PC 정지 백업 두 벌·39파일 전송/복구. 이번 v3→업무 알림 v2의 두 정지 사본 비교는 문제0·token 삭제0, 모든 기존 업무행·계정 연결·키·VAPID·DB 밖 파일 동일 | 과거 v3 최초 전환의 세션1건 삭제 수락 이력은 별도 보존 |
| 실제 사용 | 기존 직원 로그인·메모·첨부 표시, 고객 원문과 용도0개 초안 복원 확인. 기존 자기 메모에 01:22 예약, 브라우저를 비운 동안 01:22:01에 서버 알림1개 생성·중복0, 복귀 후 UI 읽음 확인 | 시험 기록은 보존·삭제0. 실제 09시 마감 알림과 다른 휴대폰 수신은 미시험 |
| 푸시 | WEB_PUSH1 유지, 등록/큐0·실제 기기 전송0. 일시 인증 오류와 종료 도중의 구독 보존, 새 VAPID scalar32바이트 회귀를 Linux에서 확인 | 기기 권한 허용·구독·수신을 아직 시험하지 않음 |
| 백업 | 첫 systemd 백업의 정지 기준 복구11검사 통과. 01:10 수동 백업166,980B도 01:44 독립 GCS GET1회·HTTP200·SHA·현재 이미지 격리 복구 통과 | 과거 완료된 온라인 snapshot 기준이며 정기 실행이나 현재 실시간 데이터 일치 증거는 아님 |
| 감시 | 기존 BACKUP_STALE 메일에 더해 가용성/TLS 두 정책의 시험 메일2건 실제 열람·원복2건·incident 닫힘2건 확인. 3지역 readiness/TLS 정상, 시험 설정 잔존0 | 합성 조건으로 기존 정책→메일 경로를 시험했으며 실제 서버 장애·인증서 만료는 재현하지 않음 |
| PC 전환 | 바로가기2개를 공개 주소로 전환. 기존 원본은 보존하고 이전 guard 정상 해제·프로세스 종료 | PC를 실제로 끈 휴대폰 시험은 사용자 보류 |

현재 고정 후보는 업무 알림 `release-v2` 424파일, manifest `aeb1620ebc406c000a10b1aa14d3ffa745330ff6076e354e32f294aae9255a72`, 이미지 `sha256:79a7377a443ba5759ce76159a77fd8026531d14be38c5f3967c2686a84ccb45e`다. Linux62개 시험파일 **576/576, skip0**, 소비108, 실제 이미지 기동·교체24+24를 통과했다. 실제 이미지의 격리 lifecycle에서 기동 즉시 알림·타이머/교체 중복 방지·권한 철회도 확인했다. 기존 고객 글만 저장 수정과 업무·키를 보존했고 후보 밖 공유 작업본을 통째로 복사하지 않았다.

업무 알림 v2는 01:16에 반영했다. env는 이미지와 `SYNK_COMPANY_WORK_NOTIFICATIONS_ENABLED=1`만 바꾸고 WEB_PUSH1·BACKGROUND0·AI0, 같은 운영 volume과 7개 systemd unit을 유지했다. 두 정지 사본의 엄격 비교는 문제0·만료 token 삭제0으로 통과했다. 이후 실제 로그인으로 01:22 예약 알림을 시험했고 원래 메모와 첨부, 고객 원문은 보존했다. 시험 알림은 UI에서 읽고 기록을 남겼으며 삭제하지 않았다. 마감 알림의 실행 중 표시는 확인했지만 운영의 09시 발송은 아직 시험하지 않았다.

Web Push v3는 10월 8일 23:56에 공개 서버에 반영했다. 기존 env에서 이미지와 SYNK_COMPANY_WEB_PUSH_ENABLED=1만 바꾸고 AI0·background0, 운영 volume과 7개 systemd unit은 유지했다. 00:04 실제 직원 로그인으로 메신저의 기기 알림 창·서버 준비·활성화 단추를 확인했다. 등록 기기0이며 권한 요청·구독 등록·실제 발송은 실행하지 않았다. 실제 수신은 사용자 보류 상태다.

공개10파일 SHA가 후보와 일치했고 1440·390·320px 익명 화면에서 가로 넘침·페이지 오류가 없었다. 이 익명 화면 검사와 별도로 00:04 실제 직원·고객 로그인, 메모·첨부·고객 초안 보존, 직원 기기 알림 창을 확인했다. 익명401이나 정적 바이트 일치만으로 인증된 기능과 실제 기기 수신을 증명하지 않는다.

v3 정지 전후의 엄격한 대조에서 만료 시각이 아직 오지 않은 인증 세션 1건의 삭제가 검출되어 자동 통과하지 않았다. 기존 인증 모듈과 호출부가 부모와 바이트 동일하고, 재시작으로 메모리 세션이 없어지면 해당 DB 세션을 무효화하는 동작과 일치함을 검토했다. 나머지 기존 업무·계정·메신저 행과 DB 밖 파일은 보존됐고 새 푸시 표 2개는 비어 있으며 암호화 VAPID 자격 1건만 추가됐다. 이 한 건은 운영자 수동 검토로 수락했다. 정확히 어느 HTTP 요청이 삭제를 일으켰는지는 로그가 없어 확정하지 않는다. 이를 만료 정리로 부르거나 일반 비교기를 완화하지 않았고 strict 실패 원본도 보존했다.

VM 전체 재부팅 실증은 10월 8일 23:38~23:43의 부모 릴리스 `be219dcc61c9`에서 수행했다. boot ID가 바뀐 뒤 수동 시작 없이 자동 복귀했고 HTTPS와 실제 기록 보존을 확인했다. 현재 `aeb1620ebc40`은 실제 서비스 stop/start와 VAPID 키·업무 데이터 보존까지 확인했으며 이 이미지로 VM 전체 재부팅을 다시 시험한 것은 아니다.

재부팅 뒤 장치 별칭이 /dev/sdb에서 /dev/sda로 바뀌어 초기 raw 비교의 persistentMountUnchanged는 false였다. 별도 읽기 전용 확인으로 named PD `synk-company-data`, ext4 UUID, fstab과 같은 volume을 확인했다. 디스크 교체가 아니며 원시 결과는 수정하지 않았다.

10월 9일 00:03 백업의 독립 다운로드·격리 복구에 이어, 01:44에는 **01:10 수동 백업166,980바이트**의 GCS 독립 GET1회·HTTP200·SHA 일치와 현재 이미지 `79a737`의 격리 복구를 확인했다. 백업 생성 당시 릴리스는 `1965`이며 복구 검증에 사용한 릴리스는 `aeb162`다. 이는 완료된 과거 온라인 snapshot의 보존·복구 증거이며 두 DB의 동일 시점이나 현재 실시간 데이터 일치를 보장하지 않는다. 다음 정기 백업의 최신 예정값은 10월 9일 **03:38:59 KST**이고 실제 실행은 아직 관측하지 않았다. 근거: `.tmp/company-cloud-20261008/work-v5-offsite-independent-restore-result.json`.

직원은 사용자가 지정한 `unmet23@gmail.com`의 중앙 활성·이메일 확인 상태를 검증한 후 보호 백업을 만들고 기존 유호 관리자에 연결했다. 새 사용자 생성·비밀번호 변경·중앙 계정 변경·공개 인증 우회는 없었다. 직원 SYNK ID 연결1건과 통합 설정의 회사/메신저 identityLinks1건은 서로 다르다.

Cloudflare DNS-only A workspace는 고정 IP이며 AAAA는 없다. Caddy TCP80/443만 공개하고 Node4191/4197은 내부다. 포털 `synk-policy` 커밋 `e55ef7a00cfb0de531cf3aae644d150e67f9b0b8`은 Pages·사이트 CI 성공, 실제 공개 바이트·기존20개 포함 총21클라이언트 보존을 확인했다.

GCS는 공개 접근 금지·균일 권한·7일 soft delete를 유지한다. VM 계정은 로그·지표 쓰기와 company/ 객체 생성만 허용한다. archive는 컨테이너 mount 밖 root 전용 경로에 둔다. 당시 월730시간 기본 예상액 US$42.57는 VM·두 디스크·사용 중 IPv4 추정이며 GCS·전송·세금은 별도다. 현재 잔액이나 청구액을 뜻하지 않고 유료 전환·자동충전은 실행하지 않았다.

이전 v3 단계의 증거는 `.tmp/company-cloud-20261008/`의 `push-v3-linux-result.json`, `push-v3-deployment-result.json`, `push-v3-logical-verification-execution.json`, `push-v3-session-delta-resolution.json`, `push-v3-session-deletion-source-review.json`, `push-v3-live-key-preservation-result.json`, `push-v3-final-runtime-snapshot.json`, `push-v3-live-browser-result.json`, `pc-migration-guard-release-result.json` 및 기존 첫 백업·재부팅·포털/감시 결과다. 당시 공개 바이트/익명 UI는 `.tmp/messenger-push-20261008/public-probes/2026-10-08T15-01-15-879Z.json`, `public-browser/2026-10-08T14-57-13-327Z/report.json`이다. 과거 raw 실패·검수 한도·중지 기록은 당시 이력으로 보존한다.

10월 9일 00:55 HTTPS·01:05 TLS 시험 메일을 기존 수신함에서 실제 열어 정책/incident/시험 식별자를 대조했다. 원래 장애 조건과 정책·메일 채널을 보존한 합성 조건 시험이며 실제 서비스 장애나 인증서 손상은 만들지 않았다. 두 정책을 원래 설정으로 돌린 후 독립 GET으로 대조했고 두 incident의 닫힘, 복원 감시 프로세스 종료와 시험 설정 잔존0을 확인했다. 01:11 재확인에서 3지역 readiness/TLS 정상이다. 근거: `alert-delivery-test/final-result.json`, `public-monitoring-after-delivery-20261009.json`.

현재 배포·사용·보존 근거는 `.tmp/company-cloud-20261008/`의 `work-v5-linux-result.json`, `work-v5-logical-comparison-result.json`, `work-v5-final-runtime-snapshot.json`, `work-v5-live-browser-result.json`이다. v2 부분 공식 검수는 `.tmp/messenger-work-notifications-20261009/release-v2/claude-review-summary.json`이며 전체 클라우드 통합 재검수와 구분한다.

## 실행 계약

- 검증·승인한 고정 릴리스만 `/opt/synk/releases/<version>`에 두고 `/opt/synk/current`에서 실행한다. 공용 작업본에는 다른 작업이 동시에 반영되고 있어 그대로 배포하지 않는다.
- 영구 디스크를 `/srv/synk`에 마운트한다. 기본 회사 경로는 `/srv/synk/company`이나 현재 운영 환경의 `COMPANY_VOLUME_DIR`는 `/srv/synk/recovery-final-20261008T133704Z/prepared/company`다. 이 경로가 컨테이너 `/data`로, 메신저는 `/data/messenger`로 연결된다. 복구 볼륨과 스냅샷 `/srv/synk/backups`는 UID/GID 1000, 호스트 전용 묶음 `/srv/synk/backup-archives`는 root:root 0700이며 컨테이너에 마운트하지 않는다. TLS도 별도 경로에 둔다. 데이터 bind 디렉터리가 없으면 자동 생성하지 않는다.
- 원래 `encryption.key`가 없는 회사 DB를 시작하지 않는다. `PREPARATION_INCOMPLETE`가 있으면 Store 생성 전에 중단한다. 클라우드에서는 `SYNK_COMPANY_REQUIRE_EXISTING_DATA=1`로 빈 DB의 신규 관리자 설정 화면이 열리는 일을 막는다.
- `/etc/synk/company.env`는 저장소 밖 root:root 0600이다. 기존 공개 로그인 설정과 AI0·BACKGROUND0·백업 업로드1·WEB_PUSH1·WORK_NOTIFICATIONS1을 사용한다. 회사 수집·트렌드 수집·Drive 삭제 outbox는 계속 중지하고, 승인된 예약 리마인더·마감 알림만 독립 flag로 활성화했다. 서비스와 3개 타이머는 활성이다. 실제 설정값을 예제에 채워 커밋하지 않으며 운영자용 양식은 [cloud.env.example](cloud.env.example)이다.
- Node 컨테이너는 공식 이미지의 `node` 사용자로 실행한다. bind된 DB·키·첨부파일을 해당 UID/GID가 읽고 쓸 수 있어야 한다. 이미지 내부 chown만으로 bind 권한은 바뀌지 않는다.
- HTTPS 앞단만 80/443을 공개한다. 회사 Node 포트 4191은 컨테이너 내부에서만 연결한다. DNS only 직접 연결에서 고정 Caddy peer `172.30.77.3`만 신뢰하고 Caddy가 실제 접속 IP로 X-Forwarded-For를 덮어쓴다. SSH/IAM·방화벽은 필요한 운영 접근만 별도로 설정한다.
- DB 두 개의 온라인 snapshot은 서로 같은 시점임을 보장하지 않는다. 최종 이전은 원본 쓰기를 정지한 뒤 시행한다. [데이터 이전·복구](CLOUD-DATA-MIGRATION.md)를 따른다.

## 직원과 고객의 경계

직원은 기존 초대·연결된 활성 직원 계정으로 회사 경로를 사용한다. 고객은 `/consultation/`에서 컴퓨터 조건을 선택하고 `/api/customer/*`만 사용한다. 고객 로그인은 기존 중앙 계약 `platform`의 **별도 등록 클라이언트**와 `/api/customer/synk-id/callback`을 요구한다. 직원 클라이언트나 쿠키를 재사용하지 않고 고객을 회사 `users`에 추가하지 않는다. 실제 중앙 등록이 끝나지 않으면 로그인이 비활성화된다.

10월 8일 기존 직원 클라이언트에 새 callback을 추가하고 별도 고객 클라이언트를 실제 등록했다. 기존 20개 등록·연결은 보존됐고 총 21개를 다시 읽어 대조했다. 공개 포털의 `id/config.json`은 별도 작업본에서 게시하고 실제 공개 바이트를 검증했다. 중앙 `platform` 토큰은 상담 전용 scope가 아니며, 기존 제품의 본인 데이터 권한 계약을 공유한다. 제공자 토큰은 회사 브라우저에 반환하지 않는다. 실제 직원·고객 로그인과 고객 세션의 직원 화면 차단은 확인했다. 서로 다른 실사용자·실기기 인수는 이 결과와 구분한다.

모든 고객 API는 중앙 계정의 활성·현재 세션을 확인한다. 변경 요청은 같은 Origin·세션 CSRF가 필요하고, 본문 수신 후 다시 인증한다. 유료 응답을 돌려주기 전에도 중앙 상태를 재확인한다. 중앙 장애 중에도 로컬 로그아웃은 가능하며 원격 철회 성공 여부를 구분한다. 고객 로그인은 원래 키로 암호화한 전용 DB 표에서 복원하며 서버 재시작 후에도 8시간 절대 만료 안에서 중앙 재검증을 거쳐 이어진다. 저장한 상담·사용량도 영구 DB에 남는다. 직원 쿠키·연결과 합치지 않는다.

고객 상담은 원문 4,000자 이하와 본인이 확인한 선택값을 암호화해 저장한다. 용도를 선택하지 않고 글만 저장하는 경우도 허용하며 임의 용도를 추가하지 않는다. 계정은 서버 인증으로만 결정한다. 두 기기가 동시에 저장하면 `baseRevision` 충돌을 반환해 조용히 덮어쓰지 않는다. 삭제는 암호문을 제거하고 버전만 남겨 오래된 기기가 삭제 전 내용을 되살리지 못하게 한다.

AI는 현재 OpenAI 추출 어댑터를 유지한다. **Google 크레딧으로 OpenAI 비용을 지불할 수는 없다.** Vertex 모델로 전환하려면 별도 제품 어댑터와 동일한 인용·조건·사용량 검증이 필요하며 이번 준비에서 임의로 바꾸지 않았다. 직접 조건 선택·기기 내 추출은 유료 호출 없이 동작한다. 고객 AI 설정은 기본 꺼짐이며 세 개의 고객 전용 설정(활성 여부·하루 요청수·하루 비용 상한)과 기존 제공자·전체 예산 설정을 모두 갖춰야 호출할 수 있다.

하루 한도는 UTC 자정 기준이다. 요청을 보내기 전 SQLite 트랜잭션에서 개인 예산과 전체 예산을 함께 예약한다. 결과 불명 예약·재시작·응답 삭제가 한도를 되돌리지 않는다. 같은 UUID와 원문 재전송은 저장한 결과만 반환하고 추가 호출하지 않는다. 기존 관리자 시험과 고객이 전체 비용 상한 하나를 공유한다. 비용 상향·실제 유료 모델 시험은 예상 비용을 먼저 확인한다.

## 남은 인수

실제 iPhone·Android 권한 허용·구독·잠금 화면 알림 수신·클릭 후 올바른 계정·로그아웃 후 전송 차단, PC를 끈 사용은 사용자 지시로 뒤로 미룬다. 실제 기기 등록은0이다. 운영 09시 마감 알림의 실제 관측은 미완료이며, 전체 클라우드 공식 Claude Opus5.5/max 검수는 완료됐으며 백업 잠금 충돌 수정과 통합 로그인 복구 보완의 공식 재확인·배포가 남았다. 고객·SSO의 동일199파일은 앞선 합동 코드 검수에서 P2 이상 지적이 없었다. 첫 정기 백업과 직원·고객 재시작 로그인 유지는 위 완료 항목에서 확인했다. Vertex 어댑터와 실제 유료 AI 활성화는 별도 후속이며 현재 AI0을 유지한다. 별도 완료된 업무 알림·직원 세션 검토와 구분하며 공통 정책은 바꾸지 않았다.

유료 AI·SNS/트렌드 수집·Drive 삭제 outbox는 계속0이다. Web Push와 예약 리마인더/마감 작업은 각각 승인된 독립 flag로1이며 BACKGROUND0의 수집·삭제 작업을 재개하지 않는다.

01:44 독립 복구에서는 01:10 백업의 전체 파일 바이트, 회사6표·메신저27표의 schema·모든 논리 행, 원래 키·VAPID 암호문이 일치했다. 복호화·VAPID 키 쌍·계정 관계·두 DB 무결성·외래키 검사도 통과했고 푸시 등록/큐는0이다. 입력 snapshot·archive는 불변이며, `network none` 격리 복구본은 `PREPARATION_INCOMPLETE`를 유지해 시작을 차단했다. 운영 DB 접근0·서비스 조작0이며 과거 snapshot과의 대조이지 현재 writer 중지나 정기 백업 실행 증거가 아니다. 근거: `.tmp/company-cloud-20261008/work-v5-offsite-independent-restore-result.json`. 이전00:19 복구 증거도 그대로 보존한다.

## 첫 정시 백업 확인 예약 이력 — 2026-10-09 01:25 KST

10월 9일 **03:50 KST**에 한 번 정시 실행 증거를 읽는 host timer가 설치돼 있다. 원래 일일03:30+무작위 최대15분+정확도1분 계약과 7개 unit은 유지했고, 서비스 재시작 뒤 최신 예정값은 03:38:59다. 확인기는 03:30~03:46 창과 실제 trigger→invocation 90초 이내·같은 boot의 업로드 완료·checksum·후속 FRESH를 대조한다. AI·메일·외부 API를 호출하지 않고 운영 DB·환경 본문도 읽지 않는다. 재부팅 뒤에도 예약을 보존하고 결과가 있으면 재실행하지 않는다.

현재는 예약 설치 완료이며 미래의 정기 실행은 미확인이다. 결과는 `/srv/synk/scheduled-backup-proof-20261009/result.json`에 남는다. 계획 변경·진행 중·증거 부족은 확인 필요로 기록하며 자동 재시도나 서버 조작은 하지 않는다. v2 합성10/10·실제 loaded timer 계약·unit 검증을 통과했다. 근거: `.tmp/company-cloud-20261008/scheduled-backup-observer-v2-install-result.json`, `scheduled-backup-window-v2/preparation-result.json`.

공식 Codex heartbeat `synk-2`는 **03:55 KST 한 번만** 새 결과를 읽고 필요한 경우 기존 권한으로 GCS 객체를 읽어 대조하는 후속 작업이다. 로컬 PC와 Codex 앱이 켜져 있어야 이 후속이 실행되며, 클라우드 백업과 03:50 서버 확인기는 PC와 독립적으로 실행된다. 서비스 재시작·수동 백업·배포·정책 변경·유료 AI를 수행하는 예약이 아니며 주기 감시로 바꾸지 않는다.

2026-10-09 후속 완료: 위 예약은 03:55에 실제 실행되어 진행 중인 마지막 인수에 합쳤다. 백업 확인 뒤 서비스 재시작1회와 직원 무재로그인 인수까지 완료했고, 공식 도구에서 PAUSED 처리하여 더 실행하지 않는다. 원래 일일 서버 백업·30분 감시 타이머는 계속 운영한다.


## 10-09 05:45 통합 로그인 추가 반영 완료

회사 SSO v8 `e696b9efeed7`(440파일/image `021805a5c67e…`)를 기존20fda에서 반영했다. Linux766/766·Windows764통과/2symlinkskip·인증219/4정상교체 통과. 계정 전환 중 늦은 응답의 이전 계정 자료 노출을 수정했다. 05:32 수동백업1회: 같은 boot/unit/cgroup/root PID/실행시간으로 완료 로그를 귀속하고 archive SHA·업로드 marker를 대조했다. journald의 파생 invocation 필드가 빠진 원래 실패 기록도 보존하며 중복 백업은 하지 않았다.

정지 사본 대조에서 schema0변경, 기동 전 만료 token1삭제와 평문/연결이 같은 직원 암호문1재암호화만 확인했다. capture SSH 연결은 먼저 끝났지만 원격 사본·안전 재개 영수증을 회수했고, 05:45 main/3timers active·healthy, 공개17파일 SHA/MIME 일치다. 기존 직원/고객 탭 reload 후 재로그인0·원래 메모/111B Drive첨부/23:33 상담 초안 보존, 직원7/고객1의 동일session/CSRF/TTL·원키/VAPID/업무자료 대조 통과. 유료AI/BG0 유지. SSO 검수는 직접 사용자 보류 지시이며 PASS가 아니다. 메신저 복구 v5는 별도 검수·Linux 인수 중이고 아직 운영반영하지 않았다.

최신 근거: `.tmp/platform-unified-login-20261009/company-linux-v8/FINAL-ACCEPTANCE.json`, `../company-linux-v7/COORDINATION.json`. 실제 새 네이티브 Platform 입구 인수는 공개 웹→PC 담당이 이어 한다. 폰/PC종료/실푸시·전체클라우드Claude·실제09시마감은 별도다.


## 10-09 05:57 메신저 복구 v5 인수와 보류

통합 로그인 e696 운영·직원/고객 자료 보존은 완료 상태다. SSO 소스7파일 `6e1855a644737616a88c1c06cc38db8fe97e06ab`, 운영기록 `c4b5452a4613c18c72dd6087bb9aede77ea29628`를 기존 codex/company-cloud-push-20261009에 push/ref 확인했다(통합원문102시험·기존변경보존, master/CI완료 주장은 없음). 추가 메신저 v5 68eb109b는 Linux805/805·실제CMD합성업그레이드354/5종료·3빈표 추가/기존행·키·첨부 보존을 통과했다. 하지만05:54 공식 Opus5.5/max 검수의 P2 세 건(큰 파일 제한시간·불확실 첨부취소·키보드초점) 때문에 배포보류다. 원격 운영변경0, 수정후보를 기다린다. 회사SSO/고객세션은 동일199파일로 합동검수에 포함되어 P2이상없었으며 전체클라우드운영검수는 아니다. 근거 `.tmp/messenger-send-recovery-20261009/linux-v5/HANDOFF.json`. 유료AI0 유지.


06:42 후행 검수: `.tmp/company-cloud-20261009-final-review/claude-review-summary.json`에서 실제 Opus5.5/max·정상완료·후보444파일 불변을 확인했다. 백업이 상태 검사 잠금과 겹칠 때 성공으로 건너뛰는 P2 한 건을 재현해 보완 중이다. 이 검수의 완료와 지적 해결을 구분하며, 기존 메신저 v6 인수·소스 push `48152ea317e8e8ad9e502cff9d13299d9deb5a38`는 완료 상태다. 백업/SSO 후속 운영 변경은 아직 하지 않았다.

<a id="ha-three-minute-20261012"></a>

## 이전 인수 — 3분 지속 장애 자동 전환

이 절은 오전 인수와 당시 최적화 검토를 보존한다. 최신 상태는 [현재 HA 인수](#ha-current-20261012)를 따른다.

**2026. 10. 12. 08:22 KST 실제 확인: 자동 전환은 `armed=true`로 운영 중이다.** 서울 a의 A가 epoch5 단독 소유자이고 서울 b의 B는 대기 상태다. 승인된 PULSE 릴리스 `fdd25252bbb5`·639파일, 기존 키·자료·9개 계정/세션 표 식별자와 공개 HTTPS/ready를 확인했다. 세 조사 문서의 자동 읽기 시각도 실제로 전진했으며 가이드26개·참고3개·보고서12개를 보존했다. 노트북은 운영·감시·백업·문서 읽기 실행에 필요하지 않다.

**10-12 09:47:38 KST 모바일 운영판·재무장 인수:** 당시 PULSE는 `7aa6c79f811c…`·642파일이다. 공개50파일 일치, 기존 초대 고객의 새로고침 유지·휴대폰 화면과 설치/알림 안내를 확인했다. 새 릴리스의 백업과 대기 서버 독립 다운로드·격리 복원, 현재 자료·자연 관찰을 거쳐 `armed=true`·A epoch5 단일 writer·B 대기·두 복제본 healthy·HTTPS200/ready를 인수했다. HA 런타임4는 기존 그대로이며 실제 `RECOVERED` 감시 루프 약15.7초·재시작0을 확인했다. 기존 토큰 식별자9개는 모두 보존했고1개가 추가돼 현재10개다. 행수·집계 동일성을 주장하지 않는다. 이번 버전의 새 강제 중단 시험은 없으며 아래 이전 `30a195…` 장애 시험과 미배포 최적화 기록은 그대로 유지한다. 갤럭시 실물 설치·알림 수신은 사용자가 지금 확인하기 어렵다고 답해 후속 연기했다. 근거: `.tmp/pulse-mobile-release-20261012/rearm-tools/`의 `final-mobile-v2-postcheck.json`, `final-mobile-v2-owner.json`, `final-mobile-v2-natural.json`, `backup-status-v3-4.json`, `dr-passed.json`. [모바일 검증](../../../../_ops/qa/pulse-mobile-20261012/README.md).

**10-12 10:41:19 KST PULSE 제작 흐름 수정판·재활성화 완료:** 현재 릴리스는 `e19bbadae74c…`·642파일이다. 양 노드 배포와 공개50파일 대조 후 새 릴리스 전용 백업·대기 서버 격리 복원을 통과하고, 자연 관찰660.326초·11표본·3지역·오류0 및17개 승인 근거를 확인해 `armed=true`로 재활성화했다. A epoch5 단독 writer·B 대기·복제 healthy·HTTPS200/ready·TLS 검증, 실제 `RECOVERED` 감시 루프50.162초·자동재시작0을 인수했다. 상태 generation `1791768407560838`·기존 HA runtime4·원 terminal 기록은 보존했다. 기존 토큰 PK9개 전부·누락0·추가1과 나머지8개 보호 표의 행수/PK를 확인했으며, 모든 과거 행 값이 같거나 추가 토큰의 생성 주체가 입증됐다고 주장하지 않는다. 새 배포의 writer 정지 상태 원본 보존과 최신 백업의9개 계정/세션 표·원키 격리 기동 전후 보존은 별도로 통과했다. 백업은10:34:13KST 자료이며 그 이후 최종납품 UI 쓰기까지 포함됐다는 보장은 하지 않는다. 이 릴리스의 새 강제 장애 시험은 없고 아래30a 장애 시험·미배포 최적화 기록은 그대로다. 근거: [재활성화 QA](../../../../_ops/qa/pulse-production-20261012/customer-flow-r4-rearm.json), 원문은 `.tmp/pulse-customer-flow-20261012/rearm/bundle-e19bbadae74c/`의 `postcheck.json`·`owner-fresh.json`·`natural-fresh.json`·`backup-status-3.json`·`dr-gate.json`이다.

<a id="ha-review-optimization-20261012"></a>

**10-12 09:08 KST 재검수:** 운영은 위의 기존 런타임으로 `armed=true`·A epoch5·HTTPS200/ready를 유지했다. 약12분 간격의 두 관측에서 세 감시 프로세스의 PID가 같고 재시작0이었다. 08:56 조회에서 전체 조사10개와 오늘 YouTube·TikTok 조사6개의 실제 반영, 세 문서 읽기 오류0, 가이드26개·보고서13개를 확인했다. Meta 최신 보고서는 10-11이며 세 문서 모두 오늘 생성됐다는 뜻은 아니다.

저장소 담당 원문에는 최종 작업 허가의 만료/교체 재검사, 실제 정지를 확인한 뒤의 복구, systemd 일괄 조회와 같은 검사 안에서의 Docker 조회 재사용, 최신 백업만 전체 SHA를 검사하는 보완을 반영했다. 정확한 운영 릴리스의 트렌드267시험, 수정 런타임의 격리 Linux198시험, 백업47시험과 원문 회귀12시험을 통과했다. 반복 `ExecStartPre` 응답도 포함하여 A/B 실제 guard 읽기를 확인했다. 합성 시험의 명령 호출은 정상 노드16→8, 정지 컨테이너가 있는 대기 노드19→9, 빈 대기 노드15→5이며, 백업8개의 SHA 전체 읽기는8→1이다. 운영 CPU 절감률은 미측정이다.

**다음은 10-12 09:08 당시 미배포 상태의 기록이다. 이후 새 런타임의 적용·장애·복귀·DR·재활성화는 [현재 HA 인수](#ha-current-20261012)를 따른다.**

**당시 이 보완 코드는 운영에 배포하지 않았다.** 다른 대화의 PULSE 실사용 검증이 진행 중이고, 노드 감시기를 재시작하면 앱도 정지하므로 기존 가동 상태를 보존했다. 다음 반영은 PULSE의 실제 최종 부모 확인, 기존 잠금·서버 작업 기록·원키/자료 보존을 따르는 좁은 기반시설 교체 작업, 새 런타임 인수와 새 백업/복원·재무장 증거가 필요하다. 기존 장애 시험을 새 코드의 시험으로 재사용하지 않는다. 승격 복구 표시는 프로세스 내 이력이며 새 영속 복구 기록은 추가하지 않았다. 경로 설계는 끝났지만 새 교체 실행기는 미구현이다. 근거: `.tmp/platform-ha-20261011/optimization-20261012/result.json`과 같은 폴더의 `infrastructure-update-path-review.md`. 원격 시험 프로세스와 임시 파일은 정리했고 운영 서비스 재시작·제어 상태 쓰기·기존 데이터 수정은0이다.

새 백업 generation `1791757429082818`을 대기 서버에서 독립 다운로드하고 SHA/MD5, HA 필수37파일과 수정 fstab, 원키, 9개 계정/세션 표의 기동 전후 보존을 확인했다. UID1000·network none·노출 포트0 격리 기동을 통과했고 시험 컨테이너를 정리했다. 운영 데이터·환경·컨테이너는 변하지 않았다. 실제 증거는 `latest-release-dr-root-gate-v2-resumed.json`이다. 부팅 준비 표식은 실제 VM에서 보존하지만, 클라우드 시작 권한을 복원하지 않는 이 자료 복원의 필수 대상은 아니다.

최종 controller 설정과 검수17항목을 적용하고 새 프로세스가 정확한 파일을 읽었는지 확인했다. 실제 `RECOVERED` 정상 감시 루프·양 노드 역할·복제 상태·공개 TLS200을 `final-arm-live-v2-postcheck.json`에서 인수했다. 상태 GCS·소유자 epoch·runtime4·기존 terminal archive는 변경하지 않았고, 이전 rearm 기록을 만들어 넣지 않았다. 별도 적용 작업은 PC와 독립인 systemd 작업으로 정상 종료했다.

| 자원 | 10-12 10:41까지의 이전 인수 기록 |
|---|---|
| A `synk-company-1`, 서울 a | epoch5 단독 소유자. 현재 PULSE `e19bbadae74c…` 642파일·승인 이미지의 업무 컨테이너 3개와 공개 HTTPS/ready 확인. 원래 부팅 디스크의 fstab 한 행에 `noauto,nofail`을 적용했고 비소유자 부팅도 별도 인수했다. |
| B `synk-company-2`, 서울 b, e2-medium | 같은 승인 릴리스·이미지·노드 가드 배포 완료. 대기 상태에서는 업무 컨테이너 0개이며 regional 데이터 writer가 아니다. 기존 HA 런타임의 실제 승격과 비소유자 부팅을 인수했다. 새 앱 릴리스 자체의 재부팅·장애 시험을 추가 수행했다고 주장하지 않는다. |
| `synk-company-ha-control`, 서울 c, e2-micro | AI 없는 systemd 감시기가 외부 3지역·두 노드·복제 상태를 관측한다. `armed=true`로 실행하며 실제 정상 감시 루프를 확인했다. |
| regional pd-balanced 50GiB | A만 연결한 단일 writer 데이터 디스크. UUID `a84fb145-8e49-452c-8bf8-c254e2b6a74c`. 이전 zonal 디스크는 보존하며 최신 운영 자료를 옛 사본으로 되돌리지 않는다. |
| 비공개 제어 GCS | `synk-company-ha-control-931078180935`. 상태 CAS와 노드별 기록 권한을 사용하며 직접 서비스 계정 키는 생성하지 않았다. |
| LB·공개 주소 | 기존 VIP `34.64.170.2`의 TCP80/443·TLS 경로 유지. 실제 장애 시험 중 B에서, 명시적 복귀와 새 배포 후 A에서 공개 응답을 확인했다. |

실제 장애 시험은 이전 앱 릴리스 `30a195652cd4`·607파일에서 수행했다. 연속 실패 **189,973ms**를 확인한 뒤 이전 writer 정지부터 공개 전환까지 6단계 승격을 수동 수리 없이 완료했다. 정지 API 요청부터 COMPLETE까지는 **566,774ms(9분 26.774초)**였다. 따라서 180초는 전환을 시작하는 장애 지속 기준이며 3분 안 복구 완료 보장이 아니다. 이후 명시적 복귀로 A epoch5를 인수했다. 새 `fdd25252bbb5` 릴리스는 동일한 HA 런타임 4개 파일을 사용하지만, 그 호환성·배포·복원 검증과 이전 릴리스의 장애 시험은 별도 증거다.

자료 보존은 `pulse-latest-runtime-acceptance-v2.json`의 writer 정지 상태 전체 대조와 `pulse-latest-owner-proof-v2.json`의 현재 원키·639파일·승인 노드 설정·9개 계정/세션 표 행수/식별자 대조를 따른다. 운영 중 정상 토큰 갱신으로 세션 암호문이 바뀔 수 있으므로 모든 과거 행 값이 영구히 같다고 주장하지 않는다. 실제 브라우저 재로그인은 이 보존 검사와 별도다. 새 백업은 `latest-release-backup-status-v2-3.json`의 완료된 정확한 invocation과 GCS generation `1791757429082818`, archive SHA `a904fa170454a2ca03b201ed91d7cb3eb0b4d57fd4f1dc1778cd9825c93010ed`에 연결된다.

월 730시간·서울·약정 없는 USD 공개 단가로 작성한 기존 추정치다. 기존 LB $18.25는 미국/글로벌 기본표를 사용한 오류였고 서울 SKU의 $0.038/시간, **$27.74/월**로 정정했다. 이전 추가 $79.33·전체 $121.90(약 $123) 추정은 폐기한다.

| 구분 | 자원 | 월 USD |
|---|---|---:|
| 기존 운영 | e2-medium 4GiB VM | 31.38 |
| 기존 운영 | 부팅 20GiB pd-standard | 1.04 |
| 기존 운영 | 데이터 50GiB pd-balanced | 6.50 |
| 기존 운영 | VM IPv4 1개 | 3.65 |
| **기존 소계** | | **42.57** |
| 장애 대비 추가 | 대기 e2-medium 4GiB VM | 31.38 |
| 장애 대비 추가 | 감시 e2-micro 1GiB VM | 7.84 |
| 장애 대비 추가 | 두 VM 부팅 디스크 20+10GiB | 1.56 |
| 장애 대비 추가 | 두 영역에 복제되는 regional 50GiB 데이터 디스크 | 13.00 |
| 장애 대비 추가 | VM IPv4 2개 증분 | 7.30 |
| 장애 대비 추가 | 서울 LB forwarding rule 기본료 | 27.74 |
| **추가 소계** | | **88.82** |
| **완성 구성 합계** | 반올림 전 합산 | **131.39** |

실제 청구는 자원 사용 시간과 사용량에 따른다. 원래 50GiB 디스크를 보존하므로 기존 $6.50를 차감하지 않으며 regional $13은 두 영역 복제를 포함한다. 트래픽·GCS 작업·백업·로그·세금·환율·크레딧은 별도다. 두 노드가 각각 10초마다 상태를 기록하면 **쓰기만 30일 약 $5.18(730시간 약 $5.26)**가 위 기본료에 추가될 것으로 예상한다. 읽기·저장·전송은 이 계산에 포함하지 않는다. 서울 LB 처리량은 수신+송신 GiB 합계×$0.012, 인터넷 송신은 별도다. AI 구독·API·Supabase·도메인·향후 게임/VR 증설 비용도 별도다. 근거: `cost-current.json`, `cost-storage.json`, [VM 요금](https://cloud.google.com/products/compute/pricing/general-purpose?hl=en), [디스크 요금](https://cloud.google.com/compute/disks-image-pricing), [LB 요금](https://cloud.google.com/load-balancing/pricing), [IP 요금](https://cloud.google.com/vpc/network-pricing), [GCS 요금](https://cloud.google.com/storage/pricing).

사용자가 GCP Upgrade를 직접 눌렀다고 확인했고 기존 결제 계정 open·프로젝트 billingEnabled를 API로 확인했다. **₩277,564.06·2026-12-07은 업그레이드 전 화면의 잔액·만료 표시**이며 현재 잔액이나 실제 청구액을 뜻하지 않는다. Ultra 가입·혜택 등록·라디오 결제 이전·Supabase 유료 전환은 실행하지 않았다.

노트북이 꺼져도 기존 서버의 앱·감시·백업·문서 자동 읽기는 클라우드에서 동작하는 구성이다. 이번 HA 범위는 이 서버에 배포된 Workspace·PULSE와 함께 관리되는 기존 서비스다. WORLD/TOWN의 Pages·Supabase 가용성·동시 이용, PATH의 실제 VR 기기·마이크·연습 서비스, 외부 인증·Gemini·Google Drive의 장애와 할당량은 별도 인수 대상이다. 이 서버의 장애 전환 시험으로 모든 외부 서비스와 미래 VR 기능의 24시간 가동을 증명하지 않는다.

이전 작업 이력은 아래 증거로 보존한다. 모든 파일은 `.tmp/platform-ha-20261011/` 기준이다.

- 데이터 이전·기동 수리: `primary-migration-result.json`, `primary-start-trace.json`, `restore-current-owner-apps.json`, `runtime-repair-v3-result.json`, `runtime-repair-health-proof.json`.
- VIP 이전·백업 보완: `vip-routing-proof-2026-10-11T19-46-18-978Z.json`, `deployment-dr-v3-acceptance.json`, `deployment-dr-v3-data-proof.json`, `regional-dr-acceptance.json`.
- 첫 장애 시험의 수동 수리 이력: `operator-outage-complete-repaired-20261012.json`, `standby-image-tags-applied.json`, `post-failover-first-public-after-firewall.json`. 이를 무개입 시험 성공으로 바꾸지 않는다.
- A 부팅 수리·보존 검사: `primary-restart-serial-diagnosis.json`, `primary-boot-rescue-c6f6ae5b-5d18-4880-bb3d-0b49efc41e93/acceptance-read.json`. 임시 복구 VM·그 부팅 디스크는 정리했고 원래 부팅 디스크의 복구용 스냅샷은 유지했다.
- 수동 수리 없는 실제 시험·자동 수집 연속성·복귀: `operator-clean-outage-complete.json`, `clean-outage-owner-proof-2.json`, `clean-outage-trend-continuity.json`, `operator-final-return-complete.json`, `final-return-owner-proof-success.json`.
- 최신 승인 릴리스·현재 자료·백업·준비 검증: `pulse-latest-runtime-acceptance-v2.json`, `pulse-latest-owner-proof-v2.json`, `latest-release-backup-status-v2-3.json`, `prearm-natural-window-v2-accepted.json`, `arm-archived-linux-qa-v2-final2.json`, `latest-release-dr-root-gate-v2-resumed.json`, `final-arm-live-v2-postcheck.json`, `final-arm-live-v2-trend-continuity.json`. 실제 활성화 판정은 postcheck, 자동 문서 읽기는 continuity 증거를 따른다.

진행 중 서비스 중단과 앱 재시작이 있었고, 위 새 백업의 재시작 0회를 전체 작업의 무중단으로 확대하지 않는다. 상태·원문 SHA·최종 남은 일은 `result.json`과 해당 증거를 따른다. 코드 입구는 [HA 계획](deploy/ha/plan.json), [감시기](deploy/ha/controller.mjs), [노드 에이전트](deploy/ha/node-agent.mjs)다.


재현된 검증 도구 오류와 중단 기록은 `latest-release-dr-attempt1-held.json`, `latest-release-dr-root-gate-v2.json`에 보존했다. Linux 미마운트 정상 종료값32를 바로잡고, 실제 백업 필수 목록에 없는 부팅 준비 표식을 자료 복원 요구에서 분리한 뒤 동일 보관 원문의 무결성을 다시 확인했다. 관리 PC의 IP 변경은 기존 두 SSH 규칙에 정확한 현재 /32만 추가해 복구했으며 새 키나 전체 공개 접속을 만들지 않았다. 실제 서비스 운영에는 이 관리 접속이 필요하지 않다.
