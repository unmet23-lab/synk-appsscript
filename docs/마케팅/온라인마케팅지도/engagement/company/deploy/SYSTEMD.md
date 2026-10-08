# Linux 운영 구성 준비

이 디렉터리는 승인한 **단일 Linux VM**에 설치할 구성이다. 작성·합성 시험만 끝났으며 Docker 이미지 실행, HTTPS 인증서 발급, systemd 설치, 외부 백업 전송은 아직 하지 않았다. 프로젝트·과금·데이터 이전·공개 배포의 현재 상태와 환경변수 목록은 [CLOUD-OPERATIONS](../CLOUD-OPERATIONS.md)를 따른다.

## 경로와 사전 조건

- 승인 릴리스는 `/opt/synk/releases/<version>`에 두고 `/opt/synk/current`가 그 디렉터리를 가리키게 한다. 운영 스크립트가 빌드·pull·릴리스 교체를 자동으로 하지 않는다.
- 별도 영구 디스크를 `/srv/synk`에 마운트한다. 회사 데이터는 `/srv/synk/company`, 컨테이너가 만드는 스냅샷은 `/srv/synk/backups`, 호스트가 만드는 archive·해시·업로드 성공 표시는 `/srv/synk/backup-archives`, TLS 상태는 `/srv/synk/caddy-data`와 `/srv/synk/caddy-config`에 둔다. `COMPANY_ARCHIVE_DIR`는 **root:root 0700이며 어떤 컨테이너에도 마운트하지 않는다.** 영구 디스크부터 해당 경로까지의 상위 디렉터리도 root 소유이며 그룹·다른 사용자가 쓸 수 없어야 한다. 다른 볼륨과 중첩·심볼릭 링크는 거절한다. Compose는 빠진 디렉터리를 자동 생성하지 않는다.
- 복구한 회사 디렉터리에는 `company.sqlite`, `encryption.key`, `workspace-integration.json`, `messenger/messenger.sqlite`가 있어야 한다. 원래 암호화 키를 유지한다. `PREPARATION_INCOMPLETE`가 있으면 기동을 거절한다. 해당 표시는 별도 복구 검증·수동 인수 전에 제거하지 않는다.
- 회사 컨테이너는 `node` 사용자로 실행한다. 실제 Linux 이미지의 UID/GID와 복구 파일·백업 디렉터리의 쓰기 권한을 확인한다. 이미지 빌드 때 `/data`에 준 소유권은 bind mount의 소유권을 바꾸지 않는다.
- `/etc/synk/company.env`는 저장소 밖의 운영 설정이며 소유자만 읽도록 `0600`으로 둔다. systemd가 환경을 읽고 Compose가 같은 파일을 사용한다. `SYNK_COMPANY_IMAGE`에는 검수한 이미지 태그를 지정한다. 도메인에는 HTTPS 스킴·경로를 넣지 않는다.
- 호스트에 Docker Engine/Compose, Bash, util-linux의 `flock`·`mountpoint`, GNU 기본 도구가 필요하다. 외부 백업에는 승인된 VM 서비스 계정 권한, `gcloud auth print-access-token`, HTTPS `curl`이 추가로 필요하다. 이 구성은 패키지 설치·API 활성화·IAM 부여를 하지 않는다.

회사 프로세스는 컨테이너 내부 `0.0.0.0:4191`에만 있고 호스트에 이 포트를 공개하지 않는다. 전용 bridge `172.30.77.0/29`에서 회사는 `.2`, Caddy는 `.3`이다. 설치 전 기존 네트워크와 겹치지 않는지 확인한다. 앱은 `SYNK_COMPANY_TRUSTED_PROXY_IPS=172.30.77.3`인 정확한 상대만 신뢰하고, Caddy가 직접 관찰한 접속 IP로 덮어쓴 X-Forwarded-For를 사용한다. DNS는 직접 연결로 두며 다른 프록시를 추가하면 이 계약을 재검토한다. Caddy만 `80/443`을 받아 회사 도메인의 Host를 보존한다. HTTPS에는 해당 호스트의 HSTS 1년을 적용한다(includeSubDomains·preload는 설정하지 않는다). DNS·방화벽·인증서·서로 다른 클라이언트의 로그인 한도는 실제 배포 환경에서 별도로 확인한다.

## 승인 후 설치 순서

아래 명령은 **대상 Linux 서버에서 인수 조건을 충족한 뒤** 실행한다. 이 문서 작성 중 실행하지 않았다. 실제 환경값이 렌더링되는 `docker compose config` 출력은 공유하지 않고 `--quiet`를 사용한다.

```sh
cd /opt/synk/current
deploy=docs/마케팅/온라인마케팅지도/engagement/company/deploy
sudo docker compose --env-file /etc/synk/company.env -f "$deploy/compose.yaml" config --quiet
# 승인한 릴리스의 company 이미지와 Caddy 이미지는 별도 릴리스 단계에서 준비한다.
sudo systemd-analyze verify "$deploy"/systemd/*.service "$deploy"/systemd/*.timer
sudo install -m 0644 "$deploy"/systemd/*.service "$deploy"/systemd/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now synk-company.service
sudo systemctl status synk-company.service synk-company-health.timer synk-company-backup.timer synk-company-backup-watch.timer
```

`synk-company.service`가 상태 디렉터리 `/var/lib/synk-company-ops`를 `0700`으로 만든다. 기동은 `compose up --detach --no-build --pull never`만 사용하므로 이미지가 준비되지 않았으면 성공으로 처리하지 않는다. 중지는 `systemctl stop synk-company.service`로 하고, 타이머도 함께 멈춘다. 볼륨 삭제나 `compose down --volumes`는 운영 절차에 포함하지 않는다.

## 복구·백업·알림

- 상태 검사는 1분마다 컨테이너 안의 `healthcheck.mjs`를 실행한다. 이 검사는 loopback에 공개 Host를 보내고 `ok`, `ready`, 회사 앱 식별을 확인한다. 모델 호출·쓰기 작업은 없다.
- 연속 3회 실패했을 때 회사 컨테이너만 재시작하며, **1시간에 최대 2회 시도**한다. 재시작 명령이 실패해도 시도 횟수는 소비한다. 다음 검사에서 정상 응답을 확인하기 전까지 복구 성공으로 보고하지 않는다. 직접 중지한 스택은 타이머도 중지되므로 다시 켜지 않는다.
- 매일 한국 시각 03:30 이후 최대 15분 안에 자동 백업을 시도한다. 누락된 예약은 다음 부팅 뒤 실행된다. `SYNK_BACKUP_UPLOAD_ENABLED=1`과 검증된 비공개 `SYNK_BACKUP_GCS_DESTINATION`이 없으면 외부 전송하지 않고 실패를 기록한다.
- 백업은 실행 컨테이너의 기존 `workspace-backup.mjs /backups`를 사용한다. `COMPLETE` 확인 뒤 호스트 전용 `COMPANY_ARCHIVE_DIR`에 tar와 SHA256을 만들고, 기존 GCS 객체를 덮어쓰지 않는 업로드를 수행한다. archive·중간 파일·해시·성공 표시가 이미 있거나 끊어진 링크이면 쓰기를 거절한다. 성공 뒤 호스트 전용 위치에 `.uploaded` 표시를 남기며 성공·실패 모두 로컬 사본은 유지한다. 컨테이너 침해 시 원본 스냅샷을 변조할 수 있다는 한계는 남으므로, 호스트의 성공 표시만으로 백업 내용의 신뢰성까지 보장하지 않는다. **온라인 두 DB는 순차 스냅샷이므로 하나의 동일 시점이 아니다. 최종 이전 백업은 모든 writer를 멈춘 상태로 수행해야 한다.**
- 업로드는 GCS JSON API `objects.insert`의 `uploadType=media`·`ifGenerationMatch=0`으로 archive를 스트리밍한다. 읽기·목록 권한이 없는 `storage.objects.create` 전용 계정으로 실행할 수 있으며 재시도·덮어쓰기·리다이렉트 추적을 하지 않는다. 공식 gcloud 인증 경로에서 얻은 토큰은 메모리 형식 검사 뒤 curl 표준입력으로만 전달한다. 토큰·응답 본문·대상 경로를 사건 로그에 남기지 않는다.
- 백업 성공 감시는 서비스 시작 2분 뒤부터 30분마다 실행한다. 정상 마운트 안의 실제 archive와 해당 업로드 성공 표시가 모두 **27시간 이내**이고, 표시의 객체 주소가 현재 백업 대상과 일치해야 `BACKUP_FRESH`를 남긴다. 누락·오래된 사본·미마운트·심볼릭 링크·미래 시각·업로드 후 archive 수정은 `BACKUP_STALE`로 실패한다. 최신 archive 없이 표시만 갱신해도 통과하지 않는다. 첫 운영 기동 전 실제 백업을 한 번 완료해야 하며, 원격 객체 존재·무결성·복구 가능성은 별도 검증한다.
- 상태 검사와 백업은 같은 `flock`으로 겹치지 않게 한다. 백업 도중 상태 검사는 건너뛰고, 외부 uptime 감시는 별도로 계속해야 한다. 백업 작업의 최대 실행 시간은 45분이다.
- stdout/stderr는 journald에 고정 사건명만 남긴다. 배포 스크립트의 **모든 `fail` 사건과 `HEALTH_FAILED`·`RECOVERY_RESTART`·`RECOVERY_RESTART_FAILED`·`RESTART_LIMIT_REACHED`**를 수집·경보한다. 권한·마운트·설정·archive 생성 실패도 빠뜨리지 않는다. `HEALTH_READY`, `STACK_STARTED`, `STACK_STOPPED`, `OFFSITE_BACKUP_COMPLETE`, `BACKUP_FRESH`, `OPERATION_ALREADY_RUNNING`은 실패 경보에서 제외한다. 스크립트가 시작되지 않는 경우도 잡기 위해 PID 1의 systemd가 회사의 7개 service/timer에 남긴 공식 실패 MESSAGE_ID(`be02cf6855d2428ba40df7e9d022f03d`, `d9b373ed55a64feb8242e02dbe79a49c`)만 별도 수집·경보한다. 일반 stderr·임의 오류 본문은 수집하지 않는다. `synk-company-backup-watch.timer`는 회사 서비스의 `Wants`로 함께 기동되고 수동 중지 때 함께 멈춘다. 외부 HTTPS 가용성·TLS 만료·VM 디스크 부족과 호스트 감시 자체 중단은 클라우드 모니터링에서 별도로 확인해야 한다. 이 파일들은 알림 채널을 만들거나 메시지를 전송하지 않는다.

로컬 백업 자동 삭제·GCS 보관 기간·삭제 정책은 아직 이 구성에 없다. 디스크 용량 감시와 승인된 보관 정책을 마련한 뒤 상시 운영한다. GCS 비공개/IAM·암호화·저장 후 복구 가능성도 업로드 명령 자체로 증명되지 않는다.

## 실제 서버에서 남은 검증

`deploy-operations.test.mjs`는 실제 Bash 문법·분기와 가짜 Docker/gcloud 명령으로 실패 시나리오를 확인한다. `deploy-backup-watch.test.mjs`는 합성 archive·업로드 표시로 27시간 경계, 실패 차단과 경로·로그를 확인한다. Linux Docker, 실제 영구 디스크 권한, `flock`, systemd, Caddy TLS, GCS 전송, VM 재부팅·지속 장애·휴대폰 접속 검증을 대신하지 않는다. 해당 증거를 갖추기 전에는 운영 완료로 표시하지 않는다.

공식 참고: [Compose 서비스](https://docs.docker.com/reference/compose-file/services/), [Docker HEALTHCHECK](https://docs.docker.com/reference/dockerfile/#healthcheck), [Caddy HTTPS](https://caddyserver.com/docs/automatic-https), [GCS objects.insert](https://cloud.google.com/storage/docs/json_api/v1/objects/insert).
