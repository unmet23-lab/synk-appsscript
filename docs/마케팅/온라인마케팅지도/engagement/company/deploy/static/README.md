# 회사 릴리스 가볍게 — 화면 묶음 · 주 1회 복원 연습 · 보존 규칙

> 2026-10-21 Claude 설계·구현(로컬 시험 통과, 운영 반영 전). 유호님 결정은 [결정 표](../../../../../../_ops/결정.md) 10-21 「효율 점검 후속 · 유호님 결정 넷」 ①. 운영 반영 순서와 남은 일은 [트랙](../../../../../../_ops/트랙.md)에 둔다. 백엔드라 GPT가 검수한다(맨 아래 「검수 범위」).

지금은 화면 파일 하나만 바뀌어도 이미지를 새로 굽는다. 그러면 배포 거래(공개 접속 약 3분 34초 끊김), 배포 전 백업, 배포 뒤 새 백업, 예비 노드 격리 복원, 계정 연결, 재무장이 차례로 돈다. 이력 18은 12파일을 바꾸는 데 원격 단계만 09:4x~14:01이 걸렸다. 그 무게는 세 군데서 온다.

1. **화면 파일이 릴리스 목록에 있다.** 릴리스 목록(이력 18 기준 1,107파일 가운데 화면 323개, 141MB 중 106MB)은 노드 에이전트가 1분마다 다시 해시한다. 한 바이트라도 다르면 쓰기 노드가 멈춘다. 그래서 화면 파일도 새 릴리스로만 바꿀 수 있고, 배포 거래가 컨트롤러의 무장 조건 7개를 내리므로 재무장이 따라온다.
2. **「배포 뒤 새 백업 + 그 백업으로 그 릴리스를 격리 복원」이 릴리스마다 붙는다.** 이 규칙은 PC가 만드는 재무장 도구(`rearm/core.mjs`)에만 있다. 감시 VM의 설치기(`config.py`)는 복원 증명 해시가 64자인지만 본다.
3. **아무것도 지우지 않는다.** 릴리스 폴더·도커 이미지(배포 도구가 지우기를 막는다)·로컬 백업·stage·예비 노드 복원 폴더에 보관 기한이 없다.

## 1. 화면 묶음(정적 자산을 이미지 밖으로)

**자리.** `/srv/synk/static/`. 이 폴더는 회사 데이터가 든 regional 디스크에 있다. 그 디스크는 쓰기 노드에만 붙고, 장애 전환 때 디스크째 예비 노드로 넘어간다. 그래서 두 노드에 따로 복사하거나 맞출 일이 없다. HA의 릴리스 확인(`check_release`)은 릴리스 목록만 보므로 이 폴더는 보지 않는다.

```
/srv/synk/static/sets/<id>/manifest.json   묶음 목록(경로·sha256·크기·origin, id = 목록의 해시 앞 16자)
/srv/synk/static/sets/<id>/<저장소 경로>     화면 파일(이미지 /workspace와 같은 상대 경로)
/srv/synk/static/current -> sets/<id>      지금 내보내는 묶음(상대 링크, rename으로 한 번에 바꿈)
/srv/synk/static/history.json              바꿔 끼운 기록(마지막 200개)
```

**origin 규칙(v2, 10-21 운영 반영 전 고침).** 묶음의 행마다 그 파일을 만들 때 기준이 된 운영 릴리스 바이트의 해시(`origin`, 릴리스에 없던 새 파일은 null)를 적는다. 서버는 **이미지 안 그 파일이 지금도 origin 바이트일 때만** 묶음에서 낸다. 그래서 그 파일을 바꾼 이미지 릴리스가 오르면 그 파일은 저절로 이미지 판이 나간다. 뒤이은 이미지 릴리스는 배포 도구를 고치지 않아도 공개 대조가 맞는다. 처음 설계(v1)는 묶음에 든 파일을 늘 묶음에서 냈다. 그러면 묶음이 켜진 뒤 오르는 이미지 릴리스의 화면 변경이 묻히고, 그 판의 공개 대조(`verify-public-full`·PUBLIC 단계 `/pulse-app/` 8개)가 깨진다. 그래서 운영에 올리기 전에 바꿨다. 남는 규칙은 하나다. 바꿔 끼운 파일(묶음 바이트 ≠ 릴리스 바이트)이 있는 동안 오르는 이미지 릴리스는 그 바이트를 후보에 함께 싣는다. 싣지 않으면 그 판의 공개 대조가 그 파일에서 어긋난다. 이미지 쪽 시각은 컨테이너마다 파일당 한 번만 해시한다(이미지는 컨테이너 안에서 바뀌지 않는다).

**무엇이 들어가나.** [`policy.json`](policy.json)이 정한다. 브라우저만 받는 파일만 넣는다. 회사 `public/` 전체, 메신저 `public/`(파일마다 같은 origin 규칙), 교사 화면, atlas-lab 화면 파일, learning-hub, korean-rhythm, order-rush 화면 모듈, `atlas/ask.js`, 맞춤도구 `computer/rules.js`·그림 11장, 화면용 글꼴 셋이 여기에 든다. 서버 모듈이 import·require·`new URL`·`join(here,…)`로 읽는 파일은 이미지에만 둔다. `public/publish-rules.js`·`subtitle-lab.js`·`pulse-app/casting-catalog.mjs`·`pulse-app/demo-assets/`, atlas 엔진 다섯, `atlas-lab/interpretation.mjs`·`model-extraction.mjs`, `computer/content.js`, shift-workbench 둘, SUIT 글꼴·잉크 로고가 그렇다. 이 파일들은 바꾸면 서버도 같이 바뀌어야 하므로 이미지 릴리스로 간다. [`deploy-static-swap.test.mjs`](../../deploy-static-swap.test.mjs)가 Docker COPY 목록을 펼쳐, 서버 모듈이 묶음 파일을 읽는 곳이 「서버가 내보내는 첫 화면의 목록을 읽는 한 곳」 말고는 없는지 본다.

**서버 동작.** [`static-set.mjs`](../../static-set.mjs)를 쓴다.

- `SYNK_COMPANY_STATIC_ROOT=/static`이고 `current`가 올바른 묶음이면, 목록에 있고 origin이 지금 이미지 바이트와 같은 파일만 묶음에서 읽는다. 나머지와 모든 실패(링크 없음·목록 깨짐·묶음 밖 링크·옛 v1 목록)는 지금처럼 이미지 안 파일을 읽는다. 그래서 이 코드가 먼저 올라가도 묶음이 생기기 전까지는 동작이 같다.
- `current`는 최대 1초마다 다시 읽는다. 바꿔 끼우면 재시작 없이 다음 요청부터 새 판을 낸다.
- 캐시·무결성 규칙은 그대로다. HTML은 no-store다. 첫 화면이 부르는 JS·CSS는 `?v=<sha256>`일 때만 1년 immutable이다. 그 밖은 ETag 재검증이다. 경로가 묶음 id를 품으므로, 바꿔 끼우는 순간 캐시 열쇠도 바뀐다.
- immutable 대상(첫 화면이 부르는 JS·CSS 목록)은 지금 내보내는 첫 화면에서 다시 뽑는다. 그래서 새 묶음이 새 스크립트를 불러도 버전이 붙는다.
- 메신저도 파일마다 같은 규칙으로 고른다(`publicFile`). 이미지에 없는 새 파일(origin null)도 묶음에서 나가므로 메신저 화면은 새 파일도 바로 나간다.
- 상태는 `GET /api/static-set`(로그인 없음, no-store)이 `{mode, set, commit[, error]}`로 알린다.

**한계.** 회사 서버의 정적 목록(`server.mjs` 1702~1798행)은 코드다. 회사 쪽 **새 URL**(새 그림·새 스크립트 파일)은 그 목록에 줄을 더하는 이미지 릴리스가 한 번 필요하다. 그 뒤로는 바이트만 바꾼다. 메신저는 폴더째라 이 한계가 없다. PULSE `sw.js`의 오프라인 캐시 이름은 손으로 올리는 규칙 그대로다.

**바꿔 끼우기.** [`swap.mjs`](swap.mjs)(PC) → 기존 고정 SSH 경로(`.tmp/platform-ha-20261011/remote-app-current-v1.cjs`, 역할 primary) → [`static-set-node.py`](static-set-node.py)(쓰기 노드, `sudo python3 -`) 순서로 돈다.

1. `node swap.mjs plan --commits <sha,…> --out <plan.json>` — 지금 묶음의 목록을 받는다. 커밋마다 바뀐 화면 파일을 「지금 실제로 나가는 바이트(노드의 `served` — origin이 맞는 묶음 판, 아니면 릴리스 판) + 그 커밋의 바뀜」으로 3방향 병합한다(`git merge-file`). 운영 바이트와 master가 다른 파일이 많아서, master 통째로 덮지 않으려는 것이다. 그림처럼 이진 파일은 운영 바이트가 커밋의 부모와 같을 때만 바꾼다. 커밋에 섞인 이미지 쪽 파일은 `imageOnly`로 따로 알리고, 지운 파일은 `skipped`로 남긴다(이 단계는 지우지 않는다). 바뀐 행의 origin은 지금 운영 릴리스 바이트이고, 다음 묶음 id는 여기서 미리 정한다. 노드 응답 한도(SSH 4MiB) 때문에 한 파일은 2.5MB까지다.
2. `node swap.mjs apply --plan <plan.json> --sha256 <plan 해시>`
   - `stage` — 지금 묶음의 파일을 하드링크하고(origin 그대로), 바뀐 파일만 쓴다. 보내는 양은 바뀐 파일뿐이다. 그사이 운영 릴리스가 바뀌었으면 origin이 달라져 id가 어긋나므로 멈춘다.
   - `flip` — 새 묶음의 모든 파일을 해시로 다시 확인한다. 그다음 `current`가 계획 때 그대로인지 비교해 맞을 때만 rename으로 바꾼다.
   - 공개 확인 — `https://workspace.synk.im/api/static-set`이 새 id인지, 바뀐 파일의 공개 바이트가 같은지 본다. 다르면 되돌릴 명령을 함께 낸다.
3. 되돌리기: `node swap.mjs rollback --to <앞 id> --from <지금 id>`. 앞 묶음은 남아 있으므로 바로 돌아간다.

이미지 빌드·배포 거래·백업·격리 복원·재무장이 없다. 데이터·서비스·HA 상태도 건드리지 않는다. 그래서 공개 접속이 끊기지 않는다.

**처음 한 번(전환 판).** 이 코드와 마운트를 싣는 이미지 릴리스가 한 번 필요하다. 그 판은 대기열 순서를 따른다(유호님 말).

1. 그 판이 실을 것: `static-set.mjs`, 회사 `server.mjs` 다섯 곳(가져오기·묶음 생성·immutable 목록·정적 응답 줄·`/api/static-set`), 메신저 `server.mjs`(`publicFile` 옵션·검사·정적 경로), 그리고 릴리스의 [`compose.yaml`](../compose.yaml)에 `/srv/synk/static`→`/static` 읽기 전용 바인드 마운트와 `SYNK_COMPANY_STATIC_ROOT=/static`. 노드는 `docker compose --file <릴리스>/deploy/compose.yaml --file <가드>/company-compose.yaml`로 띄우고, 가드 사이드카는 `restart: "no"`만 덮어쓴다(19판 기준선의 가드 `cloud-common.sh`·`company-compose.yaml`). 그래서 마운트·환경은 릴리스 `compose.yaml`에 넣으면 되고 사이드카 변환(`build-capsules.cjs`)은 고치지 않는다(인계 때 「사이드카에 넣는다」고 적었던 것을 바로잡음). inert·격리 복원은 compose가 아니라 `docker build --network=none`·`docker run`을 따로 쓰므로 이 마운트와 상관없다. 이 마운트만 `create_host_path: true`다 — 빈 뿌리는 「이미지 판을 낸다」는 뜻뿐이라, 재해 복구·새 디스크에서 폴더가 없어도 Docker가 만들고 서비스가 선다(다른 데이터 마운트는 그대로 `false`, Fable 검수 P2-2). 교체 전에는 쓰기 노드에서 `node swap.mjs ensure`로 `/srv/synk/static/sets`(root 0755)를 미리 만들어 권한을 맞춰 둔다. 예비 노드는 장애 전환 때 데이터 디스크째 받으므로 따로 만들 것이 없다.
2. 배포 PUBLIC 단계(`/pulse-app/` 파일 최대 8개를 릴리스 바이트와 견줌, `deployment-host.py:157-165`)와 `verify-public-full`은 origin 규칙 덕분에 고치지 않는다. 그 판이 바꾼 파일은 이미지 판이 나가고, 바꾸지 않은 파일은 묶음 판 = 릴리스 판이다. 바꿔 끼운 파일이 남아 있을 때만 위 「남는 규칙」대로 후보에 그 바이트를 싣는다.
3. 전환 판 armed 뒤: `node swap.mjs init --release-manifest <그 판 release-manifest.json> --commit <sha>`. 쓰기 노드가 **운영 릴리스 폴더**에서 정책에 맞는 파일을 복사해 첫 묶음을 만든다(origin = 자기 바이트). git에 없는 운영 전용 영상(예: `F02-ad-iced-coffee-20s-v1.mp4`·M03 두 편)도 그대로 들어간다. 이어서 `flip`(앞 id 없음)으로 켜면 바이트가 같아 화면은 그대로이고, `/api/static-set`이 `mode:host`가 된다.

**DR.** 묶음은 데이터 디스크에 있다. 서버 독립 백업과 회사 DR 묶음이 이 폴더를 담는지는 아직 확인하지 않았다(DR helper 원문이 git에 없다). 새 노드에 복원하면 묶음이 없어 이미지 안 화면으로 돈다(마운트 원천은 `create_host_path: true`라 Docker가 빈 폴더를 만든다). 화면은 낡을 수 있어도 서비스는 선다. 그 뒤 마지막 묶음의 `commit`과 운영 전용 미디어로 묶음을 다시 만든다. 격리 복원 시험은 묶음 없이 이미지로 돈다.

**노드 쓰기 내구성(Fable 검수 P2-1 반영).** 묶음 파일·폴더는 fsync한 뒤 rename으로 이름을 얻고, `current` 교체 뒤 뿌리 폴더도 fsync한다. 그래서 비정상 종료 뒤에 짧은 파일이 매니페스트와 함께 남지 않는다. 링크를 바꾼 뒤 기록(history.json)이 실패해도 결과는 `flipped`(`historyRecorded:false`)로 돌려준다. **한도:** 노드 `served`는 파일당 2.5MB까지다 — 그보다 큰 화면 파일(영상 등)을 바꾸는 커밋은 바꿔 끼우기가 아니라 이미지 릴리스로 간다. 커밋의 바뀐 경로는 `git diff-tree -z`로 읽어 한글 경로가 따옴표로 바뀌지 않는다.

## 2. 격리 복원 연습은 주 1회 예약으로

**바꾸는 규칙(재무장 도구, PC).** 다음 이미지 릴리스의 재무장 생성기에서 고친다.

- `rearm/core.mjs:88`(같은 release·deploymentId로 한 격리 복원)과 `:90`(배포 뒤 새 백업)을 「최근 8일 안에 통과한 주간 복원 연습 증명 + 그 뒤 스키마 변경 없음」으로 바꾼다. 감시 VM 설치기는 지금처럼 그 증명의 sha만 받는다.
- 계정 연결(bind-accounts, 이력 18에서 6,108초)은 새 백업을 기준선으로 삼아서 생긴 단계다. 배포 거래의 운영 사후 확인이 이미 「기동 전 자료 정확 보존, 세션·토큰 표 그대로」를 증명하므로, 기준선은 배포 직전 캡처로 옮긴다.
- 남기는 것(이미지·서버 코드가 바뀐 판에 꼭 필요한 검사): 대기 노드 inert 시험(리눅스 선택 시험·호환), 두 노드 stage 해시, 배포 전 백업, 배포 거래의 보존·스키마 확인, 공개 대조, 정규 재무장의 실시간 재확인(두 노드 RUNNING·디스크 소유·releaseSha·복제)과 사후 확인 `armed:true`.
- 빠지는 것: 배포 뒤 새 백업, 그 백업의 격리 복원, 계정 연결. 이력 18 기준 약 30~110분이고, 토큰 만료·덮개 닫힘·예비 노드 공간 부족으로 보류된 사례가 여기서 났다.

**주간 연습(설계, 운영 반영 전).**

- 매주 월요일 10:00 KST에 돈다. 그때의 최신 정기 DR 묶음(매일 03:30 백업의 `ExecStartPost`가 만든 `company/production/synk-server-recovery-*.tar.gz`)을 지금 운영 릴리스 이미지로 예비 노드에 network none 격리 복원한다. 지금의 격리 복원과 같은 검사를 한다: 원문·보호 계정 표·세션/토큰·원래 키·공개 포트 0·운영 컨테이너 그대로.
- 통과하면 결과(`RESULT.json`·sha)를 남기고 앞 회차 복원 폴더를 지운다. 그래서 복원 폴더는 늘 하나다.
- 자격이 문제다. 예비 노드 계정에는 백업 버킷 읽기 권한이 없다(지금은 PC가 토큰을 넘긴다). 둘 중 하나를 골라야 한다.
  - (ㄱ) PC 예약 작업이 지금처럼 토큰을 넘긴다. 권한 변경은 없다. 노트북이 꺼져 있으면 깨어난 뒤 돈다.
  - (ㄴ) 예비 노드 계정에 그 버킷의 읽기 권한을 준다. 사람 없이 돌지만, 접근을 바꾸는 보안 설정이라 유호님 승인이 필요하다.
- 실패 알림은 서버 독립 백업의 기존 통로를 그대로 쓴다. Cloud Logging `synk_server_backup`에 `event=SYNK_SERVER_BACKUP_FAILED`, `role=company`, `error=RESTORE_DRILL_FAILED|RESTORE_DRILL_STALE`를 쓰면 정책 `18443156031886673239` → 메일 채널 `14855206170551846292` 하나로 온다. 예비 노드의 `watch.py`가 마지막 통과가 8일을 넘으면 `STALE`을 낸다. 회사 스택 경보(`company_ops`)는 필터가 A 인스턴스로 고정이라 B 사건을 못 받으므로 쓰지 않는다.

## 3. 보존 규칙(최근 N개)

[`../retention.py`](../retention.py)를 쓴다. 노드마다 `plan`(읽기만, 지울 목록·종류별 개수·크기·가장 옛것·가장 새것·계획 해시)을 먼저 돌린다. `apply`는 같은 해시일 때만 그 목록을 지운다. **운영에서 처음 지우는 것은 유호님 「진행해」 뒤다.** GCS·20TB Drive 사본, 감시 VM의 배포 잡 기록(`/opt/synk/ha-maintenance/jobs/` — 재무장이 18줄을 다 읽는다), 회사 데이터, 지금 릴리스, 컨테이너·환경·node.json이 가리키는 이미지는 후보가 되지 않는다.

| 종류 | 남기는 것 | 까닭 |
|---|---|---|
| `/opt/synk/releases` (A·B 부팅 디스크) | 지금 판 + 최근 5판 | 되돌리기는 바로 앞 판으로 간다. 5판이면 바쁜 날 하루치다(10-08~20 하루 최대 12판, 보통 2~6). 판마다 약 55MB이고, 원문은 GCS DR 묶음과 PC 후보 폴더에 남는다 |
| 회사 도커 이미지(A·B) | 남긴 릴리스의 이미지 + 쓰이는 이미지 | 이미지가 없으면 그 판으로 못 돌아간다. 층을 나눠 쓰므로 옛 태그를 지워도 줄어드는 양은 작다. `--force`는 쓰지 않는다 |
| `/srv/synk/backups` 펼친 스냅숏(A) | 최근 3개 | 압축본과 같은 내용이다. 사흘치만 빠른 로컬 복원용으로 둔다 |
| `/srv/synk/backup-archives`(A) | 14일 안 + 적어도 최근 10개, 업로드 성공 표시(`.uploaded`)가 없는 것은 늘 남김 | GCS와 Drive가 전부를 갖는다. 로컬은 2주치 빠른 복원용이다. 회사 데이터와 같은 50GB 디스크다 |
| `/srv/synk/stage`(A·B) | 최근 2개 | 델타 전송은 지금·앞 판만 쓴다 |
| `/opt/synk/ha-qa/infra-dr-*`(B) | 최근 1개 | 일회용 복원 사본(회차당 1~2GB)이다. 새 복원에 백업×12+2GB(약 8.7GB)가 필요한데 여유는 약 8GB였다 |
| `/srv/synk/static/sets` | 최근 5개 + 지금 묶음 | 되돌리기용이다. 하드링크라 거의 공간을 쓰지 않는다(정리는 같은 승인 뒤 따로) |

## 4. 전후 숫자

| | 지금(이력 18, 12파일) | 화면만 바뀐 경우(이후) | 서버 코드가 바뀐 경우(이후) |
|---|---|---|---|
| 이미지 빌드·inert·stage | 328초 + 301초 | 없음 | 그대로 |
| 배포 전 백업 | 약 15분 | 없음 | 그대로 |
| 배포 거래·공개 끊김 | 370초 · 3분 34초 | 없음 · 0초 | 그대로 |
| 배포 뒤 새 백업·격리 복원·계정 연결 | 236초 + 580초 + 6,108초(평소 5~19분) | 없음 | 없음(주간 연습 증명) |
| 정규 재무장 | 242초 + 24초 | 없음 | 그대로 |
| 실측 | 위는 기록 | 전환 판 뒤 첫 바꿔 끼우기에서 잰다 | 다음 이미지 릴리스에서 잰다 |

## 검수 범위(GPT, 백엔드)

- 회사: `static-set.mjs`(새 파일, v2 origin 규칙), `server.mjs`(가져오기 1줄, 묶음 생성 2줄, immutable 목록 함수, 정적 응답 1줄, `/api/static-set` 1줄, 메신저에 `publicFile` 넘김), `server-static-set.test.mjs`·`deploy-static-swap.test.mjs`(새 시험)
- 메신저: `tools/company-messenger/server.mjs`(`publicFile` 옵션·검사, 정적 경로를 파일마다 고름, 버전 붙일 자산도 같은 함수)
- 배포: `deploy/compose.yaml`(마운트·환경 1줄), `deploy/static/`(정책·PC 도구·노드 스크립트(`ensure`·`served`)·Python 시험), `deploy/retention.py`(docker 없는 감시 VM은 이미지 칸을 건너뜀, plan에 노드 이름)·`retention.test.py`
- 특히 봐 줄 것: origin 규칙이 뒤이은 이미지 릴리스의 공개 대조와 맞물리는지(위 「남는 규칙」), 노드 `served`·`stage`의 origin 계산이 서버 판정과 같은지, 큰 화면 파일 첫 요청 때 동기 해시 비용(컨테이너당 파일마다 한 번).
- Fable 검수(10-21, `78dd8fbda`·덧붙임 `41ea503b9`): 「그대로 운영 후보로」, P0·P1 0. 반영한 것은 위 「노드 쓰기 내구성」과 compose `create_host_path: true`, 깨진 history.json·노드 예외도 한 줄 JSON으로. 남긴 P3: `deploy/SYSTEMD.md` 8행 「Compose는 빠진 디렉터리를 자동 생성하지 않는다」가 이 마운트에는 안 맞는다(SYSTEMD.md는 릴리스 원문이라 다음 이미지 릴리스에서 고친다), `ensure_root`가 o+rx(0755)는 보지 않는다.
- 운영 반영 0. 위 「처음 한 번」과 2절의 재무장 생성기 고침, 주간 연습 설치, 보존 `apply`는 아직 하지 않았다.
