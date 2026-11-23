# 업무 백업 개통 서버 — 회사 서버에 두는 법

설계의 정본은 [STAGE1_DESIGN.md 「개통 서버 구현 설계」](../STAGE1_DESIGN.md#server-build)다. 이 문서는 회사 서버에서 이 서버를 켜고 다루는 사람이 보는 절차만 적는다. 저장소가 공개이므로 버킷 이름, 계정 번호, 출입증 번호와 값, 메일 주소는 여기에도 커밋에도 적지 않는다.

## 지금 상태

- 회사 주 노드(`synk-company-1`)에 systemd 서비스 셋으로 띄운다. 컨테이너가 아니다. 판마다의 교체 뒤 확인(`verify-runtime.cjs`의 `PHYSICAL_WRITER_SET`)과 재해 복구 캡처가 주 노드의 컨테이너가 정확히 회사 · Caddy · 우주선 셋이길 요구해서다. 노드 검사, 판 도구, 재해 복구 캡처는 하나도 바꾸지 않았다.
- `https://workspace.synk.im/backup-api/*`는 Caddy가 `172.30.77.9:4210`(api)으로 보낸다. 그 Caddyfile이 회사 판에 실리기 전에는 이 길이 502다.
- 메일은 꺼져 있다(`WB_MAIL_ENABLED`를 두지 않는다). 초대는 아직 없다.
- 켠 결과와 확인 기록은 [CLOUD-OPERATIONS](../../../docs/마케팅/온라인마케팅지도/engagement/company/CLOUD-OPERATIONS.md#workbackup-host-20261123)에 있다.

## 회사 서버에서

| 유닛 | 사용자 | 듣는 곳 | 하는 일 |
|---|---|---|---|
| `synk-wb-api.service` | 10771 | `172.30.77.9:4210`(`wb-front` 다리의 호스트 주소, 같은 망에는 Caddy .11만) | 손님 앱 요청 · SQLite · 매일 일 |
| `synk-wb-keys.service` | 10772 | `127.0.0.1:4211` | 출입증 만들기 · 지우기 |
| `synk-wb-files.service` | 10773 | `127.0.0.1:4212` | 판 목록 요약 · 되살리기 |
| `synk-wb-offsite.timer` → `.service` | root | — | 매일 05:40 KST, DB 사본을 회사 밖으로(아래 「매일 사본」) |

- **회사를 따라간다.** 세 유닛은 `Requisite` · `PartOf` · `After` · `WantedBy=synk-company.service`다. 회사 쓰기 노드가 회사 스택을 시작하면 따라 뜨고, 멈추면(HA 펜싱, 판 교체, 손 정지) 따라 멈춘다. 재부팅 뒤에는 HA가 데이터 디스크를 붙이고 회사를 시작할 때 뜬다. 판 교체 동안 몇 분 멈춘다. 멈춤은 10초 안에 끝난다(`node-host.py`의 150초 멈춤 예산 안).
- **실행 파일.** HA 런타임의 Node(v24)를 `/opt/synk/workbackup/runtime/node-<해시>`로 복사해 고정한다. 코드는 이 폴더 맨 위의 `*.mjs`를 `/opt/synk/workbackup/app/<해시>/`에 둔다. 이미지 빌드는 없다. `Dockerfile`은 PC에서 시험할 때만 쓴다.
- **상자.** 상자 설정은 [`host/box.conf.in`](host/box.conf.in) 한 벌이다. 유닛, 켜기 전 시험, `wb-admin`이 같은 줄을 쓴다. 시스템 파일은 읽기 전용이고 권한(capability)은 없다. `/srv/synk`에서는 자기 폴더만 보이고, `/etc/synk` 따위는 막혀 있다. 메타데이터 서버 · VPC · 사설망 주소로는 나가지 못한다. 이름 풀이는 systemd-resolved 스텁(127.0.0.53)으로 한다. 메모리는 256MB, CPU는 50%다.
- **설치 도구.** 이 PC에서 [`tools/host-install.mjs`](tools/host-install.mjs)를 쓴다. 고정 SSH 길로 [`host/wb-host.py`](host/wb-host.py)를 root로 보낸다.

```powershell
node experiences/solo-backup-rust/server/tools/host-install.mjs plan
node experiences/solo-backup-rust/server/tools/host-install.mjs files --실행
node experiences/solo-backup-rust/server/tools/host-install.mjs probe
node experiences/solo-backup-rust/server/tools/host-install.mjs secrets --실행
node experiences/solo-backup-rust/server/tools/host-install.mjs start --실행 --버킷 <회사 백업 버킷>
node experiences/solo-backup-rust/server/tools/host-install.mjs status
```

- `files`: 런타임 · 앱 · 매일 사본 스크립트를 내용 해시 폴더에 넣고, 데이터 폴더를 만든다. 비밀값은 넣지 않는다.
- `probe`: 세 역할마다 유닛과 같은 상자 속성으로 `systemd-run`을 돌린다. 이름 풀이와 인터넷은 되고, 메타데이터 · 회사 컨테이너 · 이 노드의 VPC 주소는 막히고, 남의 폴더와 회사 데이터가 안 보여야 통과다. 막힘은 호스트에서 먼저 닿는 것을 확인한 대상만 센다.
- `secrets`: 출입증 둘을 이 PC의 DPAPI 저장소에서 읽어 넣고, RPC 비밀값 둘을 새로 만들고, settings.env를 쓴다. 출입증을 회사 서버에 넣는 일이라 유호님께 먼저 여쭙는다. 이미 다른 값이 있으면 `--바꿈` 없이는 덮지 않는다. RPC 짝이 어긋났으면 `--바꿈`이 새 짝을 쓴다.
- `start`: 먼저 버킷의 14일 규칙을 읽고(`--버킷`), 그 버킷이 company.env의 사본 목적지인지, 비밀값 짝이 맞는지, 상자 시험이 통과하는지 본다. 그다음 유닛을 쓰고 켠 뒤 상태 응답, 세 서비스가 같은 프로세스로 도는지, api의 비밀값으로 두 일꾼에 서명한 호출이 통하는지, Caddy에서는 api가 닿고 회사 컨테이너에서는 막히는지, 회사 · Caddy · 우주선 컨테이너가 그대로인지 본다. 하나라도 어긋나면 유닛 · `wb-admin` · 버킷 기록을 켜기 전 상태로 되돌린다. 바뀐 것만 바꾼다. 서비스는 유닛이 바뀌었거나, 돌지 않거나, 프로세스가 지금의 비밀값 · settings.env보다 먼저 떴을 때만 다시 띄운다. 같은 판이 이미 그대로 돌고 있으면 확인만 한다. `--다시`는 셋 모두를 다시 띄운다. 자동 시작 등록은 확인을 통과한 뒤에 한다.
- 설치 도구는 한 번에 하나만 돈다(호스트 잠금).
- 되돌리기: `stop --실행`(세 유닛과 타이머를 끄고 멈춘다). 회사에는 영향이 없다.

## 디스크의 자리

서비스마다 영구 디스크의 자기 폴더 하나만 보인다. api는 B2 출입증을 보지 못하고, 두 일꾼은 서로의 출입증을 보지 못한다. 폴더는 그 사용자의 것이고 권한은 `700`이다. 위 폴더 `/srv/synk/workbackup`은 root `711`이다. 비밀값 파일은 `600`이다.

| 폴더 | 안에 둘 것 |
|---|---|
| `/srv/synk/workbackup/api` | `settings.env`, `secrets/wb-keys-rpc`, `secrets/wb-files-rpc`, 메일을 켤 때 `secrets/wb-mail-key`(RSA 개인 열쇠 PEM), `data/`(SQLite), `backups/`(매일 사본) |
| `/srv/synk/workbackup/keys` | `settings.env`, `secrets/wb-keys-b2`(출입증 일 출입증 JSON), `secrets/wb-keys-rpc`, `state/` |
| `/srv/synk/workbackup/files` | `settings.env`, `secrets/wb-files-b2`(파일 일 출입증 JSON), `secrets/wb-files-rpc`, `state/` |

- `wb-keys-rpc`는 api와 keys가, `wb-files-rpc`는 api와 files가 같은 값을 갖는다. 서로 다른 32바이트 무작위 값이다.
- 출입증 JSON의 꼴은 `{"keyId": "…", "applicationKey": "…"}`다. 출입증 셋(개통 · 파일 일 · 서버 밖 감사)은 손님 B2 계정에 유호님 허락을 받고 `tools/b2-customer-setup.mjs`로 만든다. 감사 출입증은 이 서버에 두지 않고 GitHub Actions 비밀값(`WORKBACKUP_AUDIT_KEY_ID` · `WORKBACKUP_AUDIT_APP_KEY` · `WORKBACKUP_AUDIT_BUCKET_ID` · `WORKBACKUP_AUDIT_KNOWN_KEYS`)으로만 둔다. 비밀값을 넣은 뒤 저장소 변수 `WORKBACKUP_AUDIT_ENABLED`를 `1`로 두면 매일 감사가 돈다. 그 뒤로 비밀값이 빠지거나 꼴이 틀리면 감사가 실패한다.
- 데이터 폴더는 재해 복구 묶음과 회사 백업에 들지 않는다. 서버를 새로 세우면 설치 도구를 다시 돌리고, DB는 「매일 사본」에서 되살리고, 출입증은 B2 계정에서 다시 만든다.

## settings.env

한 줄에 `WB_이름=값` 하나다. `#`으로 시작하는 줄은 설명이다. 비밀값(`WB_SECRET…`)은 받지 않는다. 유닛의 환경 변수가 이 파일보다 앞선다. `secrets` 단계가 이 PC의 저장소 값으로 쓴다.

| 이름 | api | keys | files | 뜻 |
|---|---|---|---|---|
| `WB_BUCKET_ID` | ○ | ○ | ○ | 손님 버킷 번호 |
| `WB_PROTECTED_KEY_IDS` | ○ | ○ | | 서버 자신의 출입증 번호와 감사 출입증 번호(쉼표로). 지우지 않고, 대조에서 「모르는 출입증」으로 세지 않는다 |
| `WB_ENDPOINT` | ○ | | | `https://s3.<지역>.backblazeb2.com` |
| `WB_BUCKET` | ○ | | | 손님 버킷 이름 |
| `WB_GOOGLE_AUDIENCES` | ○ | | | 백업 전용 Google 프로젝트의 데스크톱 클라이언트 번호(쉼표로) |
| `WB_OPERATOR_EMAIL` | ○ | | | 운영자 메일 |
| `WB_MAIL_ENABLED` · `WB_MAIL_RELAY_URL` | ○ | | | 메일 중계. 유호님이 문구를 고르시기 전에는 `WB_MAIL_ENABLED`를 두지 않는다 |
| `WB_AUDIT_RUNS_URL` | ○ | | | 서버 밖 감사가 36시간 안에 돌았는지 볼 주소(GitHub 공개 API) |
| `WB_MIN_APP_VERSION` · `WB_RESTORE_GRACE_MS` | ○ | | | 기본 `0.7.0` · `60000` |

듣는 주소와 경로(`WB_HOST` · `WB_PORT` · `WB_DB` · `WB_SECRETS_DIR` · `WB_KEYS_URL` 따위)는 유닛 틀([`host/`](host/))에 있다.

## 운영 명령

api의 사용자와 상자 안에서 돈다. 회사 주 노드에서 root로 부른다. 회사 스택이 이 노드에서 돌 때만 뜨고, 회사가 멈추거나 다시 시작하면 멈춘다(다시 실행하지는 않는다). `start`가 확인을 다 통과한 판으로만 이 명령을 새로 쓴다. 초대 메일 주소는 셸 기록에 남지 않게 표준 입력으로 준다.

```bash
sudo /opt/synk/workbackup/bin/wb-admin invites
```

명령: `invite-add` · `invite-remove`(표준 입력) · `invites` · `customers [--email]` · `devices <손님>` · `cut-device <기기>` · `lost <기기>` · `scan <손님>` · `reconcile` · `backup <경로>` · `mail-held [--to]` · `key-delete <출입증 번호>`(대조가 「표에 없음」으로 알린 우리 출입증을 확인한 뒤 지운다).

- root로 `node admin.mjs`를 바로 부르지 않는다. DB 곁 파일이 root 소유로 생겨 api의 다음 쓰기가 실패한다.

## 매일 사본

- api가 매일 03시 KST 뒤 `backups/workbackup-<UTC 날짜>.sqlite`를 만든다(30일 뒤 지움, `jobs.mjs`).
- `synk-wb-offsite.timer`가 매일 05:40 KST(± 10분)에 가장 새 사본을 회사 백업 버킷의 `company/workbackup/<이름>.gz`로 보낸다([`host/wb-offsite.py`](host/wb-offsite.py)). 링크를 따라가지 않고 열고, 연 파일이 일반 파일 · 링크 수 1 · 소유자 10771인지 본 뒤, root 전용 자리로 복사해 그 복사본만 검사하고 압축한다. 노드 서비스 계정의 만들기 권한으로 덮어쓰지 않고 올린다.
- 버킷 규칙이 그 자리의 객체를 14일 뒤 지운다(`tools/backup-bucket-rule.mjs`). 소프트 삭제 7일과 처리 지연 하루를 더해도 22일이라, 처리방침의 「서버의 매일 사본은 30일이 지나면 지운다」 안이다. 이 자리에 닿는 다른 규칙, 버전 관리, 7일이 넘는 소프트 삭제, 보존 정책, 보류가 있으면 도구가 거절한다.
- 사본은 `start`가 규칙을 확인한 버킷으로만 간다. `start`가 그 버킷 이름의 해시를 `/var/lib/synk-wb-offsite/checked-bucket`에 두고, 매일 사본은 company.env의 목적지가 그 해시와 같을 때만 올린다. 목적지가 바뀌면 `FAILED BUCKET_NOT_CHECKED`로 멈추고, 새 버킷에 규칙을 넣은 뒤 `start`를 다시 돌린다.
- 결과는 저널에 `SYNK_WB_OFFSITE OK|SKIPPED|FAILED` 한 줄과 `/var/lib/synk-wb-offsite/last.json`으로 남는다. 실패 경보는 아직 없다(남은 것).
- 재해 복구 묶음과 서버 독립 백업(Drive 금고)에는 싣지 않는다. 그 둘은 30일보다 오래 보관한다.

## 계정 삭제 요청

synk.im 처리방침 「SYNK 업무 백업」 절은 계정 삭제 요청을 받으면 지체 없이 아래를 지운다고 약속한다. 손님 자리 해지 관리 명령이 생기기 전에는 운영자가 손으로 하며, 그 명령은 이 목록을 그대로 따른다. 무엇이 어디에 있는지는 `privacy-map.json`이 정본이다.

- api의 `data/wb.sqlite`: 그 계정 번호와 그 계정 PC 번호가 들어간 모든 표의 줄, 초대 목록의 그 이메일 줄, 그 계정의 메일 줄(`outbox`).
- 출입증 일꾼: 그 계정의 출입증을 B2에서 지운다.
- 파일 일꾼의 `state/`: `journal-<자리>.jsonl`(자리는 `c/` 뒤 16자)과 `restore-days.json`의 그 자리 줄.
- 클라우드 백업: 그 계정 자리의 파일을 모두 숨긴다(지움 처리). 숨긴 파일은 버킷 규칙으로 약 30일 뒤 사라진다.
- 메일: 운영 메일함에서 그 계정의 메일을 지운다.
- 매일 사본(`backups/`)과 회사 백업 버킷의 사본(`company/workbackup/`)은 손대지 않는다. 앞의 것은 30일, 뒤의 것은 22일 안에 지워진다.

## 남은 것

- 메일 중계(`mail-relay/`)의 Apps Script 배포와 보내는 이름은 유호님이 문구를 고르신 뒤에 한다.
- 손님 자리 해지 관리 명령(위 「계정 삭제 요청」의 목록을 따른다)은 2단계 전에 만든다.
- 매일 사본 실패와 유닛 고장을 알리는 경보, `mail-held` 건수 읽기는 바깥 손님을 초대하기 전에 붙인다.
- HA를 다시 켜는 판: 예비 노드에도 런타임 · 앱 · 유닛을 깔아야 장애 전환 뒤 따라 뜬다.
- `/opt/synk/workbackup/app`의 옛 내용 폴더는 지우지 않고 쌓인다. 판이 여럿 쌓이면 정리한다.
