# 회사 노드 로컬 백업 사본 보존 상한 (2026-10-31)

회사 백업의 본체는 원격 사본이다 — GCS `company/production/`(30일, 모든 회차), 77yuhbs Drive `SYNK_원본창고/server-independent/company`(재해 복구 묶음, 30일 하루 · 90일 주 · 1년 달), unmet23 `SYNK_금고`(끝난 주·달의 마지막 판). 노드의 `/srv/synk/backup-archives`·`/srv/synk/backups`는 빠른 복원용 캐시일 뿐인데 줄이는 장치가 없어, 작업실 영상이 매 백업에 통째로 들기 시작하자(10-23 0.11GB → 10-30 0.98GB) 디스크가 차서 10-31 03:36 KST부터 재해 복구 캡처가 `DISASTER_DISK_SPACE_LOW`로 실패했다.

## 규칙

[`local-retention.py`](local-retention.py)가 다음만 지운다.

| 종류 | 남기는 것 | 지울 수 있는 조건 |
|---|---|---|
| 작업실 압축본 `synk-workspace-<T>.tar.gz` + `.sha256` + `.uploaded` | 업로드가 확인된 최근 **3벌** | 세 파일이 root 소유 일반 파일(하드링크 아님)이고, `.uploaded`가 이 노드의 GCS 대상 객체 이름과 글자 그대로 같고, 체크섬 줄이 그 압축본을 가리키고, 압축본이 업로드 표시 뒤에 바뀌지 않았을 때 |
| 펼친 사본 `synk-workspace-<T>/` | `COMPLETE`가 `ok`인 최근 **1벌** | 완성된 사본이고 같은 이름의 압축본 세트가 위 조건(업로드 확인)을 만족할 때 |

업로드 확인이 안 된 압축본, `.partial`, 재해 복구 묶음 `synk-server-recovery-*`(DR 도우미의 `prune_acknowledged`가 맡는다), 다른 이름, 링크, 두 폴더 밖은 손대지 않는다. 지우기 전 대상마다 계획 때의 dev·inode·mtime(ns)이 그대로인지 다시 보고, 펼친 사본은 링크를 따라가지 않는 `shutil.rmtree`로 지운다. 회사 백업·상태 검사와 같은 `operations.lock`을 쥔 채로만 지운다(백업처럼 최대 120초 기다림).

10-22의 수동 규칙([static/README §3](../static/README.md#3-보존-규칙최근-n개) — 압축본 14일·10벌, 펼친 사본 3개)보다 줄였다. 영상이 매 백업에 통째로 들어 한 벌이 1GB를 넘고, 캡처가 `3 × (이미지 + 원문 + 최신 압축본) + 2 × 펼친 자료 + 1GiB`를 비워 두라고 해서다.

## 도는 자리

- 자동: `synk-company-backup.service`의 drop-in [`40-local-retention.conf.in`](40-local-retention.conf.in)(설치 때 `@SHA256@`를 스크립트 해시로) — `ExecStartPost=-/usr/bin/python3 -I -B /opt/synk/backup-retention/<sha256>/local-retention.py --apply`. 업로드가 성공한 백업 뒤에만 돌고(`ExecStart` 실패면 안 돈다), 파일 이름 차례로 `disaster-recovery.conf`보다 앞이라 DR 캡처가 여유를 재기 전에 비운다. `-` 접두라 여기서 멈춰도 DR 캡처는 그대로 돈다. 저널에 `SYNK_LOCAL_RETENTION LOCAL_RETENTION_COMPLETE|LOCAL_RETENTION_HEADROOM_LOW|LOCAL_RETENTION_HELD {…}` 한 줄을 남긴다(`HEADROOM_LOW`는 정리 뒤 여유가 다음 캡처 예상 필요량의 1.25배보다 적을 때 — 예상치일 뿐이다).
- 두 노드 모두에 둔다. 데이터 디스크는 쓰기 노드를 따라가므로 전환 뒤에도 같은 규칙이 돈다. 가드 파일(`50-synk-ha.conf`·`disaster-recovery.conf`)과 릴리스 원문은 바꾸지 않는다 — HA 시작 가드는 `ExecStartPre`만, 재무장·배포 전 백업은 DR drop-in 바이트와 `DISASTER_RECOVERY_BACKUP_COMPLETE` 사건만 본다.
- 손으로(한 번 정리할 때): 고정 SSH 길로 `REQUEST = {...}` 한 줄 + 이 파일을 보낸다. `{"op":"plan","environ":{"SYNK_BACKUP_GCS_DESTINATION":…}}`(읽기만, 계획 해시) → `{"op":"apply","manual":true,"planSha256":…,"dry":true,"remoteMd5":{<이름>: <GCS md5Hash>}}`(지울 압축본마다 GCS 객체와 md5 대조, 지우지 않음) → `dry` 없이 같은 해시로. 손 실행은 백업 서비스가 돌거나 릴리스 잠금이 잡혀 있으면 멈춘다. md5 대조는 잠금 밖에서 해서 그사이 시작한 백업을 기다리게 하지 않는다.
- 되돌리기: drop-in을 지우고 `systemctl daemon-reload`.

## 시험

`python -B local-retention.test.py`(Windows는 링크 시험 하나를 건너뛴다. 리눅스는 설치 전 예비 노드 임시 폴더에서 돌린다).
