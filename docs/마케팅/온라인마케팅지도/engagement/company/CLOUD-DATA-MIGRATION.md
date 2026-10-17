# 회사 데이터의 클라우드 이전과 복구

이 문서는 데이터 백업·수동 복원 계약과 10-09/10-11 이전 이력을 보존한다. 이후 A/B 대기 구성·자동 전환·릴리스별 복구 인수는 [현재 서버 운영 기록](CLOUD-OPERATIONS.md#ha-current-20261012)을 따른다. 날짜가 붙은 실행 상태·예정 시각·고정 릴리스·환경값은 당시 관찰이며 새 노트북이나 서버의 현재 상태를 대신하지 않는다.

<a id="server-disaster-recovery-20261011"></a>
## 서버 자체 유실 대비 — 2026-10-11

사용자 요청에 따라 **현재 실행 중인 회사 서버를 기존 비공개 GCS에서 복원하는 사본**을 추가했다. 아래는 복구 계약이며, 최초 운영 적용·원격 사본 다운로드·격리 기동의 확정 결과는 [운영 확인](CLOUD-OPERATIONS.md#server-disaster-recovery-20261011)을 따른다. 복원은 기존 관리자 계정으로 다른 기기나 Cloud Shell에서 진행할 수 있으며 이 노트북의 작업 파일이나 SSH 키만을 유일한 복구 수단으로 두지 않는다.

### 보관 범위와 실행 조건

- 기존 `synk-company-backup.timer`의 매일03:30KST 예약(최대15분 분산)을 유지한다. 데이터 백업이 성공한 뒤 `ExecStartPost`가 실행 중인 릴리스와 manifest, 회사·HTTPS·spaceship의 정확한 Docker 이미지3개, 보호된 환경파일, systemd 설정, Caddy 설정·TLS 상태, 복구 도구와 완료된 데이터 사본을 묶는다. 운영 앱을 재시작하거나 writer를 정지하지 않는다.
- `synk-server-recovery-*.tar.gz`와 `.receipt.json`을 기존 `company/` 원격 경로에 **새 객체로만** 저장한다. 두 업로드 모두 응답의 이름·크기·MD5·generation을 확인한 뒤 성공 처리한다. 원격 receipt에 전체 archive의 SHA256과 데이터 생성 시각을 남긴다. 이름이 충돌하거나 업로드 결과가 불명확하면 덮어쓰기·자동 재시도 대신 실패로 남긴다.
- 업로드 전 파일 해시·실행 릴리스·이미지·원래 키·두 DB 무결성·사용자 연결과 새 폴더 복원을 검사한다. 수집 중 릴리스나 설정이 바뀌거나 알 수 없는 컨테이너·mount가 생기면 완성된 것으로 보관하지 않는다. 공간이 부족하면 복사를 시작하지 않는다.
- 로컬에는 **원격 archive와 receipt가 모두 확인된 새 복구 사본 중 최근2개**를 유지한다. 기존 `synk-workspace` 백업, 업로드 미확정 사본, 원격 객체는 이 정리에서 삭제하지 않는다. 원격 저장량은 매일 증가하며 기존 Cloud Storage 사용량 과금 범위에 포함된다.
- 사본에는 인증 설정·원래 암호 키가 포함된다. 기존 private bucket의 접근 통제·공개 차단·서비스 저장 암호화를 유지하고 파일은 root 전용으로 다룬다. 별도의 archive 암호화를 추가한 것은 아니다. 내용을 공개 문서·로그·채팅에 붙이지 않는다.

### 서버가 없어졌을 때의 복원 순서

1. 기존 Google Cloud 관리자 계정으로 프로젝트 `synk-bake-unmet27`에 들어간다. 기존 비공개 백업 버킷의 `company/` 아래(현재 `company/production/`)에서 `synk-server-recovery-*.tar.gz.receipt.json` 중 최신 성공 사본을 찾는다. `createdAt`과 **`dataBackupCreatedAt`**을 구분하고, 장애 직전 정상 여부도 확인한다. 원격 receipt와 해당 `generation`의 archive를 보호된 새 작업 폴더로 내려받는다. 로컬 PC 기록 없이 원격 receipt만으로 SHA256·크기·복구 시점을 확인할 수 있다.
2. 내려받은 archive의 SHA256이 receipt와 일치한 뒤에만 최상위 복구 도구를 꺼낸다. 같은 이름의 파일이나 복원 폴더가 이미 있으면 재사용·덮어쓰기하지 않는다. `disaster-restore.py prepare`는 시스템 경로에 쓰거나 서비스를 시작하지 않으며 `PREPARATION_INCOMPLETE` 표식을 남긴다.

   ```sh
   # 기존 관리자 Cloud Shell 또는 보호된 Linux 복구 작업 디렉터리.
   # receipt.json과 recovery.tar.gz는 위의 같은 generation에서 받은 파일이다.
   umask 077
   expected_sha="$(python3 -c 'import json; print(json.load(open("receipt.json"))["sha256"])')"
   printf '%s  recovery.tar.gz\n' "$expected_sha" | sha256sum --check --status || exit 1
   (set -o noclobber; tar -xOf recovery.tar.gz disaster-restore.py > disaster-restore.py) || exit 1
   python3 disaster-restore.py prepare recovery.tar.gz --sha256 "$expected_sha" --destination "$PWD/restored-new"
   ```

3. 기존 VM·디스크가 살아 있으면 먼저 보존하고 실제 복구가 필요한지 판단한다. 다른 VM으로 전환할 경우 옛 writer를 정지·격리해 두 서버가 동시에 고객·직원 변경과 예약 작업을 처리하지 않게 한다. 새 서버·새 요금·권한이 필요한 조치는 해당 시점에 확인한다. 원래 서버가 사라졌다는 이유로 빈 DB나 새 암호 키를 만들지 않는다.
4. 보호된 복원본의 `recovery-manifest.json`에 기록된 host 경로·mode·uid/gid를 확인한다. `/etc/synk/*.env`는 root600, 데이터는 기존 회사 UID1000 계약을 유지한다. 복원 도구가 모든 추출 파일을600으로 제한하므로 host 복사 때 manifest의 원래 권한을 복구해야 한다. `images/images.tar`를 Docker에 load하고 이미지 ID를 manifest와 대조한 뒤 기존 compose reference를 같은 ID로 연결한다. pull/build로 다른 코드를 가져오지 않는다.
5. manifest의 `releaseRoot`를 `/opt/synk/current`로 연결하고 spaceship의 compose 경로·서비스, 보관된 DR helper와 backup drop-in을 복구한다. `companyVolume`에는 **인수한 데이터 사본**을 둔다. `/etc/fstab`은 새 디스크 UUID와 비교해 조정하며 옛 UUID를 그대로 적용하지 않는다. Caddy 데이터·설정 경로와 원래 서비스 enable 상태도 확인한다. 복구 사본은 OS 전체 디스크 이미지가 아니므로 지원되는 Linux·Docker Compose·Python·gcloud·기존 Cloud 권한을 준비한다.
6. 실제 저장 이미지로 `disaster-rehearsal.mjs`를 **network none·UID1000·읽기 전용 원본 사본·별도의 쓰기 가능한 시험용 데이터**에서 실행한다. 표식 제거는 이 버릴 시험 사본에서만 먼저 한다. DB 논리 자료·키 복호화·등록 첨부·사용자 연결·health·인증 차단을 확인한다. 배포 인수에서는 원래 계정 로그인·고객/직원 권한과 공개 HTTPS까지 별도로 확인한다. 통과 전 원본 복원본의 표식을 제거하지 않는다.
7. 인수 후에만 운영 표식을 제거하고 회사 서비스·HTTPS·spaceship을 시작한다. 기존 자동 작업 flag를 보존하고 데이터·계정·중복 writer 검사를 마친 뒤 예약을 재개한다. 외부 주소가 바뀌면 기존 DNS·감시 대상을 맞추고, 공개 health·고객/직원 접속·외부 백업을 확인한다. 이전 사본은 롤백용으로 보존한다.

### 복구 범위의 한계

이는 **매일 생성하는 수동 복원 사본**이다. 이 사본을 이용하는 복구 시간은 새 환경 준비·다운로드·인수에 따라 달라진다. 10-11 최초 작성 때는 대기 서버가 없었지만 이후 HA 구성이 추가되었으며, 자동 전환의 실제 조건·대기 노드·시험 범위는 현재 서버 운영 기록에서 확인한다. 자동 전환과 이 수동 복구 사본은 서로 다른 대비책이다. 마지막 성공 이후의 변경은 없을 수 있다. 정상적인 일일 성공 기준 데이터 시차는 약24시간이며 실패가 이어지면 더 커지므로 receipt의 실제 시각과 장애 알림을 확인한다. 두 SQLite DB는 온라인으로 차례로 백업해 각각 무결성을 검사하며 같은 순간의 전역 트랜잭션 사본이라고 주장하지 않는다.

이 사본은 현재 회사 VM의 Workspace·PULSE 및 함께 실행되는 HTTPS·spaceship을 대상으로 한다. Supabase 관리형 DB, Google Drive 원문·원격 첨부 본문, GitHub 호스팅, IAM·DNS 소유권·결제 접근 자체의 백업을 대신하지 않는다. 노트북 분실, 단일 VM 유실, 영역·프로젝트·계정 전체 장애를 같은 범위로 보고하지 않는다. 버킷은 기존 서울 리전을 유지하므로 별도 리전 재해 대책은 아니다. [Google DR 계획 기준](https://docs.cloud.google.com/architecture/dr-scenarios-planning-guide)의 복구 시점·복구 시간과 실제 복원 시험을 구분하고, [객체 생성 조건](https://docs.cloud.google.com/storage/docs/request-preconditions)과 [무결성 검증](https://docs.cloud.google.com/storage/docs/data-validation?hl=en)을 적용한다.

## 이전 운영 기록 — 2026-10-09 데이터 이전

2026-10-09 01:44 KST 기준 최신 PC 데이터를 클라우드 영구 볼륨 `/srv/synk/recovery-final-20261008T133704Z/prepared/company`에서 운영한다. 원본 PC·옛 백업·옛 릴리스·이전 복구본은 보존했다. 현재 릴리스는 업무 알림 v2 `aeb1620ebc40`(424파일), manifest `aeb1620ebc406c000a10b1aa14d3ffa745330ff6076e354e32f294aae9255a72`, 이미지 `sha256:79a7377a443ba5759ce76159a77fd8026531d14be38c5f3967c2686a84ccb45e`다. Linux576/576·skip0 및 직원/고객 실제 로그인·기록·첨부 보존을 확인했다.

사용자는 **“클로드 최종 재검수는 미루고 나머지 전부 진행해”**, **“실제 휴대폰 시험은 나중에”**라고 지시했다. 전체 클라우드 통합 Claude 재검수와 실제 iPhone·Android/PC 종료 시험은 보류한다. 업무 알림 v2 수정분만 별도 공식 Opus5.5 max 검토가 완료됐으며 이를 전체 인수 검수로 확대하지 않는다.

PC writer를 정상 종료하고 DB/WAL·키·설정의 읽기 공유 잠금 아래 독립 백업 두 벌을 대조했다. 전송39파일과 cloud-volume 복구를 검증했고 원래 키를 유지했다. marker는 운영 활성화 때 정확한 새 volume에서 별도 보관 이동했다. 10월8일23:46 이전 guard는 기존 release 신호로 정상 해제됐고 프로세스도 종료됐다. 해제 전 원본 hash·빈 WAL·writer0을 확인했으며 원본 DB 쓰기·강제 종료는 없었다. guard가 과거 violation을 기록한 원인은 확정하지 않았으므로 이를 없던 일로 지우지 않는다.

v3 정지 전후의 엄격한 대조에서 만료 시각이 아직 오지 않은 인증 세션 1건의 삭제가 검출되어 자동 통과하지 않았다. 기존 인증 모듈과 호출부가 부모와 바이트 동일하고, 재시작으로 메모리 세션이 없어지면 해당 DB 세션을 무효화하는 동작과 일치함을 검토했다. 나머지 기존 업무·계정·메신저 행과 DB 밖 파일은 보존됐고 새 푸시 표 2개는 비어 있으며 암호화 VAPID 자격 1건만 추가됐다. 이 한 건은 운영자 수동 검토로 수락했다. 정확히 어느 HTTP 요청이 삭제를 일으켰는지는 로그가 없어 확정하지 않는다. 이를 만료 정리로 부르거나 일반 비교기를 완화하지 않았고 strict 실패 원본도 보존했다.

v3 서비스 재시작 뒤 암호화 VAPID 자격과 원래 encryption.key가 그대로임을 확인했다. 구독0·발송큐0·실제발송0이다. 기존 관리자 연결과 직원 메모·Drive 첨부111B 다운로드 SHA, 고객 용도0개의 글 초안도 실제 브라우저에서 확인했다.

이번 v3→업무 알림 v2 전환은 정상 정지 뒤 전체 volume 사본을 별도 보관하고, 새 이미지 기동 전후 두 정지 사본을 엄격 비교했다. 문제0·만료 token 삭제0, 기존 두 DB의 schema·모든 업무행·계정 연결·암호화 자격증명·원래 키·DB 밖 파일이 동일했다. 실제 운영 volume·7개 systemd unit은 바꾸지 않았다. 이 비교를 마친 뒤 실시한 정상 사용자 알림 시험과 구분한다.

01:22 기존 자기 메모에 예약한 알림은 브라우저를 비운 동안 01:22:01에 서버에서1개 생성됐고 중복0, 화면 복귀 후 읽음 처리를 확인했다. 새 메시지·삭제는0이며 시험 예약/알림 기록을 남겼다. 원래 직원 메모·첨부와 고객 원문·용도0개 초안이 복원됐고 고객 저장 시각은 그대로다. 운영09시 마감 알림은 미시험이며, 격리 실제 이미지의 합성 시계 lifecycle에서 기동/중복/권한 철회 검증을 완료했다. 휴대폰 푸시 수신과 PC 실제 종료 시험은 보류 상태다.

VM 전체 재부팅 실증은 10월 8일 23:38~23:43의 부모 릴리스 `be219dcc61c9`에서 수행했다. boot ID가 바뀐 뒤 수동 시작 없이 자동 복귀했고 HTTPS와 실제 기록 보존을 확인했다. 현재 `aeb1620ebc40`은 실제 서비스 stop/start와 VAPID 키·업무 데이터 보존까지 확인했으며 이 이미지로 VM 전체 재부팅을 다시 시험한 것은 아니다.

재부팅 시 /dev/sdb→/dev/sda 별칭 변경은 별도 named PD·UUID·fstab·동일 volume으로 검증했다. 원래 raw의 persistentMountUnchanged=false는 보존한다.

10월 9일 00:03 백업의 독립 다운로드·격리 복구에 이어, 01:44에는 **01:10 수동 백업166,980바이트**의 GCS 독립 GET1회·HTTP200·SHA 일치와 현재 이미지 `79a737`의 격리 복구를 확인했다. 백업 생성 당시 릴리스는 `1965`이며 복구 검증에 사용한 릴리스는 `aeb162`다. 과거 완료 온라인 snapshot의 복구 증거이며 두 DB의 동일 시점이나 현재 실시간 데이터 일치·정기 실행을 증명하지 않는다. 다음 정기 백업은 최신 관측값 **03:38:59 KST**로 예정되어 있으며 아직 실행을 관측하지 않았다.

첫 백업 독립 복구는 운영자 exact GET1회 뒤 새 QA 경로에서 정지 기준과 두 DB 논리 행·무결성/FK·원래 키·계정 관계·등록 파일 등11검사 문제0을 확인한 것이다. 새 복구본 marker를 유지했고 서비스를 시작하지 않았다. 최신 v3 객체는 별도 독립 다운로드·격리 복구를 완료했지만 그 기준은 과거 완료된 온라인 snapshot이다. 첫 백업의 정지 기준 인수와 구분한다.

현재 증거는 `.tmp/company-cloud-20261008/`의 `work-v5-linux-result.json`, `work-v5-logical-comparison-result.json`, `work-v5-final-runtime-snapshot.json`(운영10/10), `work-v5-live-browser-result.json`이다. 이전 guard·v3 세션 한정 수락·첫백업·부모VM재부팅 raw 결과는 보존한다. 01:44 독립 복구 근거는 `work-v5-offsite-independent-restore-result.json`이며 이전 `push-v3-offsite-independent-restore-result.json`도 보존한다. `alert-delivery-test/final-result.json`은 HTTPS/TLS 시험 메일2건 실제 열람·정책 원복2건·incident 닫힘2건을 확인한다. 별도 v2 부분 검수는 `.tmp/messenger-work-notifications-20261009/release-v2/claude-review-summary.json`이다. [운영 현황](CLOUD-OPERATIONS.md)과 함께 읽는다.

## 함께 보존하는 데이터

`workspace-backup.mjs`는 SQLite backup API로 회사·메신저 DB를 각각 복사하고, 회사의 **원래** `encryption.key`, `identityLinks`, DB에 등록된 제작 파일·로컬 첨부, 메신저 `drive-storage.json`을 함께 보존한다. 임시 업로드와 로그·PID·로컬 실행기 설정은 옮기지 않는다. Drive 파일 본문은 이 백업에 없으므로 Drive 삭제·권한 상실은 로컬 백업만으로 복구할 수 없다.

회사는 현재 `synk-identity.mjs`에서 `SYNK_ID_*` 환경변수를 읽으며 별도 account-config JSON을 읽지 않는다. 백업에 account-config 파일을 추가하는 방식으로 해결하지 않는다. 운영 환경파일 `/etc/synk/company.env`는 저장소·이미지·백업 로그 밖에서 별도 이관하며, Secret Manager 또는 운영자만 읽는 파일로 공급한다. 공개 주소·OAuth 콜백·로그인 설정은 새 환경과 실제 등록값이 일치하는지 확인한다. 비밀값이나 DB 내용·사용자 식별자를 검증 보고서에 적지 않는다.

| 위치 | 회사 DB와 키 | 메신저 | 통합 설정 |
|---|---|---|---|
| 보존 백업 | `company/company.sqlite`, `company/encryption.key` | `messenger/` | 상대 위치와 `identityLinks`를 담은 `integration-manifest.json` |
| 일반 격리 복구 | `company/` | 형제 `messenger/` | 현재 복구 경로를 기록하며 기존 방식 유지 |
| 클라우드 볼륨 복구 | 새 대상 폴더의 루트 | 새 대상의 `messenger/` | `identityLinks`만 기록; PC의 `messengerDataDir` 절대경로 제거 |
| 운영 마운트 계약 | 확정 `COMPANY_VOLUME_DIR` → `/data` (기본 `/srv/synk/company`, 현재 운영 복구 경로는 위 참조) | `/data/messenger` | `SYNK_COMPANY_DATA=/data`, `MESSENGER_DATA_DIR=/data/messenger` |

백업 폴더 자체는 암호화된 묶음이 아니다. 내부 레코드가 암호화되어도 복호화 키를 함께 보관하므로 전체 백업을 민감 데이터로 취급한다. 새 암호화 포맷을 만들거나 원래 DB 키를 교체하지 않는다. 운영 측의 SSH/SCP 전송, 암호화된 비공개 외부 저장소와 최소 IAM, 별도 디스크·지역 보관 및 보존 정책으로 보호한다. 같은 VM 디스크의 `/backups`만으로는 서버 손실에 대비할 수 없다. 삭제 요청이 오래된 백업에서 복구되지 않도록 보존·폐기 정책을 함께 적용한다.

## 이전 순서

1. 운영자가 실제 회사·메신저 데이터 위치와 두 DB·키·등록 첨부의 용량을 확인한다. 파일 크기만 읽은 용량 목록은 데이터 정합성 검사나 최신 백업 증거가 아니다. 공용 작업본·기존 원본은 유지한다.
2. 운영 이전 승인이 끝난 시점에 회사와 독립 메신저 등 **모든 writer**를 멈추고 중지 시각을 기록한다. 실행 중인 두 DB를 차례로 backup하면 각각은 읽을 수 있어도 하나의 동일 시점을 보장하지 않는다. `COMPLETE`는 파일 복사 완료 표시이며 writer 중지·최신성 증명이 아니다.
3. 운영 데이터 폴더 밖의 관리자 전용 경로에서 `workspace-backup.mjs`를 실행한다. 도구가 반환한 새 폴더의 `COMPLETE`를 확인한다. 실패한 폴더에는 완료 표시가 없으므로 전송·복구 대상으로 쓰지 않는다. 기존 데이터·백업을 덮어쓰거나 자동 삭제하지 않는다.
4. 완료한 최신 기준을 원본 보존하고, 별도 복사본을 SSH 전송한다. 해시 등 원격 파일 대조 증거는 민감 본문·키·사용자 식별자 없이 보호된 운영 기록에 보관한다. 원격 업로드 성공만으로 복구 성공을 선언하지 않는다.
5. 다음 복구 대조 도구를 새 빈 대상 경로에 실행한다. 회사·메신저 DB 논리 내용, 키 복호화, 수정·삭제 revision, 계정 연결, 등록 첨부, 원본 불변성이 모두 맞아야 복구 후보가 만들어진다. 이미 있는 대상이나 원본 안의 대상은 거부한다. 독립된 최신 기준이 필요하며 도구가 최신성을 스스로 증명하지는 않는다.
6. 후보에는 `PREPARATION_INCOMPLETE`가 남는다. 서버를 시작하지 않은 상태로 디렉터리 배치·소유자·권한·환경파일·새 공개 주소·접근 제한을 확인한다. 새 복구 인수 전에는 `/etc/synk/company.env`에 `SYNK_COMPANY_BACKGROUND_JOBS_ENABLED=0`, `SYNK_COMPANY_WORK_NOTIFICATIONS_ENABLED=0`, `SYNK_COMPANY_WEB_PUSH_ENABLED=0`을 명시해 운영 설정의 활성 값을 그대로 재사용하지 않는다. 클라우드 시작 경로는 marker가 있으면 Store/메신저/예약 실행 전에 거부해야 한다. 표시 제거만으로 운영 인수가 끝난 것은 아니다.
7. 승인된 운영 인수 단계에서 로그인·권한·회사/메신저 계정 연결·대화/첨부/제작 파일 재생·수정/삭제 보존·두 기기 재접속을 확인하고 트래픽을 연다. 일일 수집·메신저 알림·Drive 삭제 재시도·기타 예약 작업은 확인 없이 자동 재개하지 않는다. 실패하면 원본을 보존한 채 새 후보로 재검증한다.

## 기존 CLI 계약

### 복구 후 자동 작업을 보류하는 설정

회사 서버는 `SYNK_COMPANY_BACKGROUND_JOBS_ENABLED`를 기동 때 한 번 읽는다. 값은 `0` 또는 `1`만 허용하며 빈 값·오타는 DB를 열기 전에 거부한다. 미설정은 기존 PC 동작을 보존하는 `1`이다. 업무 알림은 `SYNK_COMPANY_WORK_NOTIFICATIONS_ENABLED`로 독립 설정하며 미설정일 때만 BACKGROUND 값을 따른다. Web Push도 `SYNK_COMPANY_WEB_PUSH_ENABLED`로 독립한다. 복구 인수 전에는 셋 모두0을 명시한다. 현재 인수된 운영은 **BACKGROUND0·WORK1·PUSH1·AI0**이다.

- BACKGROUND0: 회사 채널 예약 수집·재시도, 일일 트렌드 자동 수집과 메신저 Drive 삭제 outbox를 기동/주기 실행하지 않는다. WORK0이면 예약 리마인더·마감 알림도 기동/주기/알림 화면 조회에서 처리하지 않는다. 기존 대기열·시도 횟수·미전달 상태를 보존한다.
- 사용자가 메시지나 첨부를 명시적으로 삭제하면 로컬 기록은 삭제되지만 BACKGROUND0에서는 Drive 원격 삭제가 outbox에 남으며 과거 대기열도 실행하지 않는다. BACKGROUND1로 재기동하면 원래 계정으로 대기 중인 Drive 삭제를 처리한다. WORK1은 별도로 기동 즉시·15초마다 예약 알림을 확인하고, KST09시 이후 선호/요일/권한 조건에 맞는 마감 알림을 생성한다.
- 이 설정은 전체 읽기 전용 모드나 외부 통신 차단이 아니다. 사용자의 명시적 수집·업로드·다운로드·삭제 요청, 새 메시지의 멘션/답글 알림은 기존 권한과 확인을 거쳐 동작한다. 업로드 실패 시 해당 원격 파일을 정리하는 예외 경로도 유지한다. 인증 세션 철회 확인, 요청별 권한 확인, SSE 연결의 권한 재확인과 만료/개인정보 정리는 계속 적용한다.
- 인수 전에는 해당 자동 작업을0으로 두고 로그인·권한·데이터를 검증한다. 담당자가 각 대기열과 연결 계정을 검토하고 해당 작업의 재개를 승인한 뒤에만 해당 flag를1로 바꾸고 정상 종료·재기동한다. 실행 중 환경파일만 바꾸어서는 전환되지 않는다. 이번에는 사용자가 Web Push와 예약 리마인더/마감 알림을 각각 승인하여 PUSH1·WORK1로 인수했다. 회사 수집·트렌드 수집·Drive 삭제 outbox는 BACKGROUND0을 유지한다. 실제 휴대폰·두 기기 시험 보류는 앞의 사용자 지시에 따른다.

독립 메신저 실행은 기존 기본 동작을 유지한다. 위 환경변수는 회사 서버가 통합 메신저에 전달하는 설정이다. 별도 실행 중인 메신저·수집기·Drive 동기화 등 다른 writer는 이전 중지 범위에 따로 포함한다. systemd 백업과 `SYNK_BACKUP_UPLOAD_ENABLED`는 별개 설정이며 이 옵션으로 멈추지 않는다.

백업은 실제 원본 경로를 명시한 운영 세션에서 실행한다. 최종 이전 백업은 같은 고정 모듈의 `backupWorkspace`를 원본 읽기 공유 잠금 아래 직접 호출했고 첫 운영 백업은 설치된 systemd unit을 사용했다. 아래는 일반 CLI 계약이며 실행 중인 원본에 무조건 다시 실행하는 절차가 아니다.

```sh
node docs/마케팅/온라인마케팅지도/engagement/company/workspace-backup.mjs /backups
```

클라우드 배치는 다음 옵션으로만 선택한다. 마지막 옵션이 없으면 기존 형제 폴더 복구다. 옵션 오타는 거부한다.

```sh
node docs/마케팅/온라인마케팅지도/engagement/company/workspace-restore-acceptance.mjs \
  /recovery/candidate /recovery/latest-baseline /recovery/freshness.json \
  /srv/synk/company-new --cloud-volume
```

`freshness.json`은 운영자가 실제 writer 중지와 최신 기준을 확인한 뒤 작성한다. `kind`는 `operator-attestation`, `declaredLatest`·`writersStopped`는 실제 확인한 경우에만 `true`, `writersStoppedAt`은 중지 시각, `baselineCreatedAt`은 기준 manifest의 `createdAt`, `recordedAt`은 기록 시각이다. 값을 자동으로 참으로 채우지 않는다. 합성 시험은 `synthetic-rehearsal`로 구분한다.

## 자동 백업의 한계와 확인

예약 도구는 기존 CLI를 직접 실행하고 종료 코드 0·새 `COMPLETE` 이후에만 외부 보관을 이어간다. 백업 실패를 무시하거나 불완전 폴더를 업로드하지 않는다. 외부 저장 성공·보존 정책·복구 대조 실패는 운영자에게 알리고 유료 AI를 깨우지 않는다. 운영 백업과 최종 이전용 writer 중지 백업을 구분한다. 자동 백업·외부 저장·복구 훈련의 실제 실행 증거가 생기기 전에는 자동 운영 완료로 기록하지 않는다.

합성 회귀와 실제 운영 증거는 구분한다. 아래는 10-09 첫 정기 실행을 기다리던 시점의 기록이다. 후속 정기 백업·독립 복원 결과는 [운영 기록](CLOUD-OPERATIONS.md)을 따른다. PC를 끈 실물 두 기기 인수와 자동 예약 실행 관측도 서로 다른 검증이다.

첫 정기 실행의 계약은 10월9일03:30~03:46 KST이며 최신 예정값은03:38:59다. 서버의 독립 확인기는03:50에 한 번 `/srv/synk/scheduled-backup-proof-20261009/result.json`을 남긴다. 공식 Codex heartbeat `synk-2`의03:55 1회 후속은 이 새 결과를 읽고 필요한 GCS 읽기 대조만 한다. 후속은 로컬 PC·앱이 켜져 있어야 하지만 클라우드 백업과03:50 확인기는 PC와 독립한다. 미래 완료를 추정하거나 수동 백업으로 정기 실행을 대신하지 않는다.

01:44 독립 복구에서는 01:10 백업의 전체 파일 바이트, 회사6표·메신저27표의 schema·모든 논리 행, 원래 키·VAPID 암호문이 일치했다. 복호화·VAPID 키 쌍·계정 관계·두 DB 무결성·외래키 검사도 통과했고 푸시 등록/큐는0이다. 입력 snapshot·archive는 불변이며, `network none` 격리 복구본은 `PREPARATION_INCOMPLETE`를 유지해 시작을 차단했다. 운영 DB 접근0·서비스 조작0이며 과거 snapshot과의 대조이지 현재 writer 중지나 정기 백업 실행 증거가 아니다. 근거: `.tmp/company-cloud-20261008/work-v5-offsite-independent-restore-result.json`. 이전00:19 복구 증거도 그대로 보존한다.
