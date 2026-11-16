# 업무 백업 개통 서버 — 회사 서버에 두는 법

설계의 정본은 [STAGE1_DESIGN.md 「개통 서버 구현 설계」](../STAGE1_DESIGN.md#server-build)다. 이 문서는 회사 서버에서 이 서버를 켜고 다루는 사람이 보는 절차만 적는다. 저장소가 공개이므로 버킷 이름, 계정 번호, 출입증 번호와 값, 메일 주소는 여기에도 커밋에도 적지 않는다.

## 지금 상태

- 회사 `deploy/compose.yaml`에 서비스 셋(`wb-api` · `wb-keys` · `wb-files`)이 `workbackup` 프로필로 **꺼진 채** 들어 있다. `company-stack.sh`의 `compose up`은 프로필 없이 돌므로 이 셋을 띄우지 않는다. 회사 서비스는 이 셋에 기대지 않는다.
- 회사 `deploy/Caddyfile`의 `/backup-api/*` 길은 `wb-api:4210`으로 간다. 서비스가 꺼져 있는 동안 이 길은 502로 답하고, 다른 길은 전과 같다. 본문은 1MB까지 받는다(이 PC의 Caddy 2.11.7로 확인).
- **프로필을 켜는 것은 스위치가 아니라 인프라 판이다.** 회사 HA의 `node-agent.mjs` · `node-host.py`와 재해 복구 캡처는 떠 있는 컨테이너가 정확히 company · https · spaceship 셋이길 요구한다(현장 노트 「배포·공개」의 컨테이너 집합 절). 이 셋을 띄우기 전에 그 검사들이 `wb-*`를 알도록 고치는 인프라 판이 먼저다.

## 이미지

한 이미지가 역할 셋을 맡는다(`node main.mjs api|keys|files`). npm 의존성이 없고, 맨 위의 `*.mjs`만 담는다. 빌드는 프로필을 켤 때 한 번 한다.

```bash
docker compose --project-name synk-company --file deploy/compose.yaml --profile workbackup build wb-api
```

`wb-keys` · `wb-files`는 같은 이미지 이름(`WB_IMAGE`, 기본 `synk-workbackup:local`)을 쓴다. 회사 릴리스 체크아웃에 `experiences/solo-backup-rust/server`가 있어야 빌드된다(확인 안 함).

## 디스크의 자리

서비스마다 영구 디스크(`SYNK_PERSISTENT_ROOT`, 기본 `/srv/synk`) 아래 자기 폴더 하나만 `/wb`로 붙인다. api는 B2 출입증을 보지 못하고, 두 일꾼은 서로의 출입증을 보지 못한다. 세 폴더 모두 컨테이너 사용자 `10771:10771`의 것이고 권한은 `700`이다. 비밀값 파일은 `600`이다. compose는 폴더를 만들지 않는다(`create_host_path: false`).

| 폴더 | 안에 둘 것 |
|---|---|
| `workbackup/api` | `settings.env`, `secrets/wb-keys-rpc`, `secrets/wb-files-rpc`, 메일을 켤 때 `secrets/wb-mail-key`(RSA 개인 열쇠 PEM), `data/`(SQLite), `backups/`(매일 사본) |
| `workbackup/keys` | `settings.env`, `secrets/wb-keys-b2`(출입증 일 출입증 JSON), `secrets/wb-keys-rpc`, `state/` |
| `workbackup/files` | `settings.env`, `secrets/wb-files-b2`(파일 일 출입증 JSON), `secrets/wb-files-rpc`, `state/` |

- `wb-keys-rpc`는 api와 keys가, `wb-files-rpc`는 api와 files가 같은 값을 갖는다. 서로 다른 32바이트 이상의 무작위 값이다.
- 출입증 JSON의 꼴은 `{"keyId": "…", "applicationKey": "…"}`다. 출입증 셋(개통 · 파일 일 · 서버 밖 감사)은 손님 B2 계정에 유호님 허락을 받고 `tools/b2-customer-setup.mjs`로 만든다. 감사 출입증은 이 서버에 두지 않고 GitHub Actions 비밀값(`WORKBACKUP_AUDIT_KEY_ID` · `WORKBACKUP_AUDIT_APP_KEY` · `WORKBACKUP_AUDIT_BUCKET_ID` · `WORKBACKUP_AUDIT_KNOWN_KEYS`)으로만 둔다. 비밀값을 넣은 뒤 저장소 변수 `WORKBACKUP_AUDIT_ENABLED`를 `1`로 두면 매일 감사가 돈다. 그 뒤로 비밀값이 빠지거나 꼴이 틀리면 감사가 실패한다.

## settings.env

한 줄에 `WB_이름=값` 하나다. `#`으로 시작하는 줄은 설명이다. 비밀값(`WB_SECRET…`)은 받지 않는다. 컨테이너 환경 변수가 이 파일보다 앞선다.

| 이름 | api | keys | files | 뜻 |
|---|---|---|---|---|
| `WB_BUCKET_ID` | ○ | ○ | ○ | 손님 버킷 번호 |
| `WB_PROTECTED_KEY_IDS` | ○ | ○ | | 서버 자신의 출입증 번호(쉼표로). 지우지 않고, 대조에서 「모르는 출입증」으로 세지 않는다 |
| `WB_ENDPOINT` | ○ | | | `https://s3.<지역>.backblazeb2.com` |
| `WB_BUCKET` | ○ | | | 손님 버킷 이름 |
| `WB_GOOGLE_AUDIENCES` | ○ | | | 백업 전용 Google 프로젝트의 클라이언트 번호(쉼표로) |
| `WB_OPERATOR_EMAIL` | ○ | | | 운영자 메일 |
| `WB_MAIL_ENABLED` · `WB_MAIL_RELAY_URL` | ○ | | | 메일 중계. 유호님이 문구를 고르시기 전에는 `WB_MAIL_ENABLED`를 두지 않는다 |
| `WB_AUDIT_RUNS_URL` | ○ | | | 서버 밖 감사가 36시간 안에 돌았는지 볼 주소(선택) |
| `WB_MIN_APP_VERSION` · `WB_RESTORE_GRACE_MS` | ○ | | | 기본 `0.7.0` · `60000` |

## 운영 명령

api 컨테이너 안에서 돈다. 초대 메일 주소는 셸 기록에 남지 않게 표준 입력으로 준다.

```bash
docker compose --project-name synk-company --file deploy/compose.yaml exec -T wb-api node admin.mjs invites
```

명령: `invite-add` · `invite-remove`(표준 입력) · `invites` · `customers [--email]` · `devices <손님>` · `cut-device <기기>` · `lost <기기>` · `scan <손님>` · `reconcile` · `backup <경로>` · `mail-held`.

## 아직 정하지 않은 것

- `data/wb.sqlite`의 매일 사본은 같은 디스크의 `backups/`에만 남는다. 회사 백업(`company-backup.sh`)은 회사 볼륨만 옮기므로, 이 사본을 회사 밖으로 보내는 길은 프로필을 켜는 인프라 판에서 함께 정한다.
- 메일 중계(`mail-relay/`)의 Apps Script 배포와 보내는 이름은 유호님이 문구를 고르신 뒤에 한다.
