# 소개팅 서버 실행 준비

2026-10-08. **로컬 준비본이며 설치·공개 배포 전이다.** 호스팅 계약, 도메인, 운영 OAuth 등록은 아직 정하지 않았다. 기존 홈페이지는 GitHub Pages의 정적 게시이고, 이 제품은 Node 서버와 영속 SQLite가 필요하다. 기존 SYNK ID는 재사용하되 공개 HTTPS 콜백을 별도로 등록한다.

## 준비한 구성

```text
브라우저 / 중앙 상태 전달
          │ HTTPS (확정할 공개 주소)
          ▼
같은 호스트의 Caddy ── HTTP 127.0.0.1:4302 ── Node 프로세스 1개
                                              │
                                  /var/lib/synk-dating/account.sqlite
```

이 예시는 Linux·systemd와 Caddy를 쓸 수 있는 단일 호스트용이다. 서비스 업체나 요금제를 선정한 것이 아니다. 앱과 프록시를 서로 다른 호스트/컨테이너 bridge에 놓는 구성은 현재 loopback 계약과 맞지 않는다. SQLite 경로는 재시작·코드 교체 후에도 유지되는 로컬 디스크로 정하며, 여러 앱 프로세스가 같은 DB를 쓰도록 확장하지 않는다.

| 파일 | 역할 |
|---|---|
| [Caddyfile](Caddyfile) | HTTPS 종료, 전달 헤더 정규화, 앱으로 전 요청 전달. 저장소 자체를 정적 제공하지 않음 |
| [synk-dating.service](synk-dating.service) | 전용 계정·비공개 저장 경로·시작 전 설정 검사·SIGTERM 종료 유예 |
| [runtime.env.example](runtime.env.example) | 공개 원점·내부 포트·계정 설정·DB 경로의 배치 예 |
| [account.public.example.json](account.public.example.json) | 공개 가능한 OAuth 설정 형식. 미정값이 비어 있어 그대로 실행하면 실패 |

## 호스트가 정해지면 채울 값

1. 정확한 HTTPS 원점과 DNS. 예시의 `dating.example.invalid`는 실제 주소가 아니다. Caddyfile의 두 곳, 환경파일의 원점, OAuth callback을 함께 바꾼다. 기본 HTTPS 포트443을 사용한다.
2. **소개팅용 운영 browser OAuth client**와 `/atlas-lab/dating.html` 콜백. 현재 저장소의 `account.config.json`은 loopback 리허설용이므로 복사해서 운영으로 쓰지 않는다. [기존 SYNK ID 도구](../../../tools/synk-id/README.md)로 계획·등록·포털 항목을 함께 준비한다. 공개 설정에는 publishable key만 넣고 service key·DB 연결·lifecycle token을 넣지 않는다.
3. 서버 접근 방식, `/usr/bin/node` 위치, 재시작해도 유지되는 저장 디스크, 비공개 백업 위치. 이 작업의 Node 시험 버전은24.18.0이다. 설치할 호스트에서도 `node:sqlite` import와 아래 검사를 확인한다.
4. 중앙 상태·최종 탈퇴 전달의 실행 주체, 최소 권한 DB 연결과 두 migration 적용 상태. [중앙 운영기준](../../../../SYNK-talk/docs/공통계정_운영기준.md)의 `--check-config`/유한 `--run-once`를 사용한다. 기존 계정 삭제 예약이 소개팅 전달 작업을 대신하지 않는다.
5. 성인 확인 제공자·운영자 계정·백업 보관 기준. 제공자 미정 상태를 검증 완료로 표시하지 않는다. 유료 기능·평가·튜터·참가자 모집은 기존 보류를 유지한다.

현재 설정 검사는3~5의 실제 운영 연결까지 검증하는 출시 판정이 아니다. 빈 설정이 통과하지 않는 것과 실제 서비스 준비 완료를 구분한다.

## 서버 파일 묶음 만들기

호스트·도메인이 미정이어도 [전용 묶음 도구](../../../tools/atlas-dating-package.mjs)로 검토한 실행 파일을 준비할 수 있다. 서버 전이32개와 공개22개에서 중복3개를 뺀51개, 이 폴더의 설정 예제4개, [백업 도구](../../../tools/atlas-dating-backup.mjs)와 [복원 상태 반영 모듈](../dating-reconcile.mjs)2개를 복사한다. 목적지 상위의 ESM 설정에 영향을 받지 않도록 최소 CommonJS `package.json`1개를 생성해 payload는58개다. 실제 계정 설정·DB·복구 원장·성인 모듈·QA·인증서·node_modules는 포함하지 않는다. 현재 서버 코드에는 외부 npm 의존성이 없어 `npm install` 없이 실행한다.

```powershell
# 부모 디렉터리가 존재하는 저장소 밖의 새 절대경로를 지정한다.
node tools/atlas-dating-package.mjs build C:/private-builds/dating-release-001
# 위 명령이 반환한 manifestSha256을 별도로 보관해 전달 후 대조한다.
node tools/atlas-dating-package.mjs verify C:/private-builds/dating-release-001 <보관한-manifestSha256>
```

기존 목적지·저장소 안 출력·파일/상위 경로 링크를 거절한다. 파일별 SHA256·크기를 기록한 `dating-package.json`을 마지막에 쓰며, 복사 도중 원본이 바뀌면 성공 처리하지 않는다. 실패한 출력은 진단용으로 남기고 재시도는 새 경로를 사용한다. `verify`는 별도로 보관한 manifest SHA, 정확한 파일 목록, 각 바이트를 검사한다. 같은 묶음 안의 manifest에서 방금 읽은 SHA만 전달하면 독립 검증이 아니다. 해시는 서명이나 운영 배포 증명이 아니며, 성공 출력도 `deployed:false`, `runtimeTested:false`, `providerTested:false`로 구분한다.

묶음 루트가 아래 `/opt/synk-dating/app`에 대응한다. 생성 파일은 소유자 전용 권한이므로 대상 Linux에 설치할 때 서비스 계정의 읽기 권한을 아래 표에 맞춘다. 이 원본 안내는 저장소 문서 링크를 사용하므로 실행 묶음에 복사하지 않는다.

## 파일과 권한

| 대상 | 배치·권한 |
|---|---|
| 검토한 앱 원본 트리 | `/opt/synk-dating/app` · 서비스 계정 읽기 전용. `atlas/`·`experiences/`의 상대 import 구조를 유지하고 시작 전 검사로 누락을 확인 |
| 서비스 계정 | 로그인용이 아닌 전용 `synk-dating` 사용자·그룹. root로 앱을 실행하지 않음 |
| 환경파일 | `/etc/synk-dating/runtime.env` · root 소유0600. systemd가 읽어 전달하며 Caddy에는 전달하지 않음 |
| 공개 OAuth 설정 | `/etc/synk-dating/account.public.json` · root:synk-dating0640, 부모 디렉터리0750 |
| 선택적 서버 성인 모듈 | `/etc/synk-dating/adult-adapter.mjs` · 신뢰한 서버 코드만, 서비스 계정 읽기 전용 |
| SQLite 디렉터리 | systemd `StateDirectory`가 `/var/lib/synk-dating`을 전용 사용자·0700으로 생성. DB·WAL·SHM 모두 이 안에 유지 |
| Caddy 설정·인증서 | Caddy 공식 서비스의 설정/저장 위치 사용. 앱 데이터 경로와 분리 |

공개22파일 목록은 브라우저 제공 목록이다. 서버 배포에 필요한 import 전체 목록이 아니다. 개발 PC의 비밀 환경파일·DB·QA·개인 자료를 서버 원본에 함께 복사하지 않는다. Caddy에 `file_server`나 별도 저장소 root를 추가하지 않는다. 앱의 명시적 공개 목록이 파일 제공을 맡는다.

앱 디렉터리와 공개 자산은 실제 경로를 사용한다. `current` 같은 심볼릭 링크를 경유하는 릴리스 전환은 공개 파일의 실제 경로 검사와 충돌할 수 있으므로 이 예시에 추가하지 않는다.

서비스 예시는 재시작을 실패 때만 수행하며60초 안에3회로 제한한다. 종료 때 앱은 기본10초 동안 진행 중 요청을 기다리고, systemd는30초까지 기다린다. 코드·시스템 경로는 읽기 전용이며 DB 디렉터리만 지속 쓰기에 사용한다. Linux에서의 실제 권한·서비스 부팅은 대상 호스트가 정해진 뒤 확인한다.

## HTTPS와 확인 명령

Caddy는 앱과 같은 호스트에서 `127.0.0.1:4302`로 연결한다. `Host`는 내부 주소, `X-Forwarded-Host`는 확정한 공개 호스트, `X-Forwarded-Proto`는 `https`로 덮어쓴다. `Forwarded`·사용하지 않는 `X-Forwarded-For`는 제거한다. `X-Forwarded-*` 전체 삭제는 새로 설정한 두 필수 헤더까지 지워403을 일으키므로 사용하지 않는다. `Origin`·`Sec-Fetch-Site`는 보존해 앱이 판단한다. 이 구성에서 내부4302포트를 외부 방화벽에 열 필요는 없다.

요청별 access log는 켜지 않는다. 프록시 오류 로그에도 로그인 복귀 query와 헤더가 포함될 수 있어 기본 로그의 `request` 필드 전체를 제거한다. 장애의 상태·오류 정보는 남긴다. 쓰기 요청의 프록시 재시도는 켜지 않고, 앱의 기존 영수증 조회/수동 복구 흐름을 사용한다.

아래는 **실제 값과 파일 배치를 완료한 대상 Linux에서** 실행할 명령이다. 이 준비 작업에서는 서비스 설치·기동·DNS·인증서 발급을 하지 않았다.

```sh
cd /opt/synk-dating/app
/usr/bin/node -e 'require("node:sqlite")'
sudo systemd-analyze verify /etc/systemd/system/synk-dating.service
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

환경값을 적용한 앱의 `--check-config`는 unit의 `ExecStartPre`가 수행한다. 공개 callback 불일치·누락 설정이면 앱 기동 전에 멈춘다. 이 검사는 성인 모듈 실행·인증 호출·DB 생성·포트 열기를 하지 않는다. 서비스 기동은 별도의 공개 반영 단계이며 현재 요청의 승인 범위와 [공통 운영 원칙](../../../docs/AI_운영원칙.md)에 따라 진행한다. 별도 모델의 최종 검수를 필수 관문으로 추가하지 않는다.

기동 후 기본 응답 확인 경로는 `GET /api/atlas-dating/config`다. 공개 HTTPS 경유200, `mode=account`, `demoEnabled=false`, `labAvailable=false`, 정확한 callback을 대조한다. 이 경로는 로그인·DB 쓰기를 입증하는 health 검사가 아니다. 실제 계정의 로그인→동의→저장→새로고침과 물리 두 기기 왕복은 별도 확인한다.

인증서 자동 발급에는 실제 DNS·외부80/443 연결과 Caddy의 지속 저장이 필요하다. [Caddy HTTPS 안내](https://caddyserver.com/docs/automatic-https)와 [공식 서비스 안내](https://caddyserver.com/docs/running#using-the-service)를 따른다. 기존 Caddy 사이트가 있는 호스트라면 전체 설정을 덮어쓰지 말고 사이트와 로그 설정의 영향을 먼저 검토한다.

## 종료·교체·복원

일반 코드 교체는 한 프로세스를 정상 종료하고 같은 DB 경로로 다시 시작한다. 실행 중인 DB를 원본 파일 하나만 복사해서 백업했다고 처리하지 않는다. 백업은 작성자와 전달 작업을 중지한 시점, checkpoint된 SQLite, paired 원장과 별도 보존 절차가 필요하다. 아래 도구는 이미 중지·checkpoint된 두 자료를 다루며 서버 중지나 checkpoint를 대신 실행하지 않는다.

### 비공개 백업 만들기와 파일 복원

실행 묶음의 `tools/atlas-dating-backup.mjs`를 사용한다. 설정·입출력은 앱과 SYNK-talk 저장소 밖의 비공개 절대경로에 둔다. 원본·부모 경로의 링크, 남은 WAL/SHM/journal, 기존 목적지를 거절한다. 출력은 소유자 전용0700/0600을 요청하지만 Windows에서는 실제 ACL을 별도로 확인한다. 이 도구는 파일 암호화·원격 보관·자동 예약을 제공하지 않는다.

먼저 작성자와 중앙 전달을 중지하고, 원본을 checkpoint한 뒤 기존 중앙 export의 `--snapshot`으로 paired 원장을 받는다. 다음은 **형식 예시**이며 실제 원장·DB 경로와 계정 환경을 대조해 비공개 `create.json`에 저장한다.

```json
{
  "version": 1,
  "operatorConfirmedAllWritersStopped": true,
  "environment": {
    "accountApiUrl": "https://account.example.invalid/functions/v1/synk-account",
    "clientId": "registered-dating-client-id",
    "issuer": "synk-account",
    "audience": "atlas-dating"
  },
  "databasePath": "/var/lib/synk-dating/account.sqlite",
  "evidencePath": "/srv/private-backups/paired.json",
  "destination": "/srv/private-backups/backup-001"
}
```

```sh
node tools/atlas-dating-backup.mjs --check-config create /srv/private-backups/create.json
node tools/atlas-dating-backup.mjs create /srv/private-backups/create.json
```

`--check-config`는 경로·설정만 검사하며 DB를 열거나 출력 폴더를 만들지 않는다. `create`는 기존 공용 검사로 DB와 paired 원장의 정합·삭제 잔존·영수증을 확인한 뒤 `account.sqlite`, `paired.json`, 마지막에 `manifest.json`을 새 폴더에 쓴다. 원본 SHA를 다시 확인하고 파일별 SHA·크기를 기록한다. 반환한 `manifestSha256`은 묶음과 **별도로** 신뢰 가능한 위치에 보관한다. 실패하면 원본은 보존하고 새 출력은 진단용으로 남는다. 실패한 폴더를 완성본으로 사용하지 않는다.

`verify.json`은 `version:1`, `bundlePath`, `expectedManifestSha256` 세 필드다. `node tools/atlas-dating-backup.mjs verify /srv/private-backups/verify.json`은 별도 지문·정확한3파일 목록·각 바이트와 paired 정합을 확인한다. 오래된 paired 자체는 만료되지 않으며, 검증 성공이 현재 중앙 상태를 확인했다는 의미는 아니다.

파일 복원용 `restore.json`은 `version:1`, `operatorConfirmedAllWritersStopped:true`, `environment`, `bundlePath`, `expectedManifestSha256`, `latestEvidencePath`, `destination`을 갖는다. `environment`는 실제 복구할 계정 환경, `destination`은 기존 DB를 덮지 않는 새 폴더다. `latestEvidencePath`는 **백업 폴더 밖에서 별도로 수집한 최신 원장**이어야 한다. 과거 paired를 복사하거나 시각만 바꿔 latest로 만들지 않는다.

```sh
node tools/atlas-dating-backup.mjs --check-config restore /srv/private-backups/restore.json
node tools/atlas-dating-backup.mjs restore /srv/private-backups/restore.json
```

`restore`는 기존 `inspectDatingRestore`를 복사 전후에 수행한다. 5분을 넘긴 최신 원장, 다른 환경, 백업 후 새 탈퇴·상태 변화가 있으면 멈춘다. 통과하면 새 폴더에 DB·paired와 비식별 `restore-receipt.json`을 남긴다. 당시 latest를 백업에 넣어 재사용하지 않으며 서버를 시작하지 않는다. 영수증도 `resumeRequired:true`, `restoreAdmitted:false`이고 재개 승인 객체를 저장하지 않는다. 아래 기존 재개 CLI에서 최신 근거와 파일을 다시 검사해야 한다. 모든 작성자 중지·중앙 원장 출처는 운영자 확인 범위다.

**과거 DB로 복원하는 일은 일반 재시작과 다르다.** 서비스와 중앙 작성자·전달 작업을 중지한 상태로 [§35 복구 검사](../../../docs/_ops/qa/atlas-capability-history-20261005/README.md#35-요청-혼잡-제어저장-중-종료복구-후-재개-검사-2026-10-08-후속)와 [중앙 export 절차](../../../../SYNK-talk/docs/공통계정_운영기준.md#소개팅-복구-근거-내보내기-2026-10-08-로컬-구현)를 따른다. 복구용 env와 `--check-restore`/`--resume-after-restore`가 필요하며, 위 기본 unit으로 복원 DB를 먼저 열지 않는다. 운영자가 모든 작성자 중지와 DB/API 환경 대응을 확인해야 한다. 기존 복구 검사는5분 이내의 독립 최신 근거를 요구한다. 운영 백업 자동화·실제 복구 성공은 아직 확인하지 않았다.


### 백업 이후 탈퇴·이용 제한 반영

기존 `restore`는 중앙 상태가 바뀐 오래된 백업을 계속 거절한다. 이 경우 최신 export로 받은 실제 `occurred_at`이 포함된 원장을 준비하고, `restore.json`과 같은 형식의 설정에 **새 목적지**를 지정해 다음을 실행한다.

```sh
node tools/atlas-dating-backup.mjs --check-config reconcile /srv/private-backups/reconcile.json
node tools/atlas-dating-backup.mjs reconcile /srv/private-backups/reconcile.json
```

`reconcile`은 원본 백업의 독립 manifest SHA와 paired 정합을 확인하고, 최신 원장이 과거의 계정·이벤트·삭제 이력을 빠짐없이 보존하는지 검사한다. 순번 누락·후퇴·과거 이벤트 변경·삭제 취소·새로 반영할 사건의 원래 시각 누락은 거절한다. 기존 snapshot에 시각이 없어도 보존은 가능하지만, 새로 반영할 사건의 시각을 임의로 만들지는 않는다. 현재 중앙 export는 실제 dispatcher와 같은 UTC 시각을 내보낸다.

새 복원 사본에만 기존 제품의 lifecycle 처리를 순서대로 실행한다. 중간의 이용 제한 후 active 복귀도 모두 반영하므로 과거 공개·초대 동의나 종료된 관계가 자동 복원되지 않는다. 최종 삭제는 기존 개인정보 정리 경로를 사용한다. 중앙에만 있는 이용자에게 새 소개팅 프로필을 만들지 않는다. 소켓·인증·성인 제공자·AI는 호출하지 않는다.

출력 `paired.json`은 최신 원장을 적용한 사본의 SHA와 원본 백업·paired·latest의 출처를 기록한 파생 자료다. `newCentralRead:false`이며 독립 latest를 대신하지 않는다. 기존 공용 복구 검사를 다시 통과해야 성공 영수증을 쓰고, 서버는 자동으로 시작하지 않는다. 재개 직전에는 원본과 별도로 확보한 5분 이내 latest로 기존 `--check-restore`/`--resume-after-restore`를 사용한다. 그 사이 중앙 상태가 달라지면 다시 중지하고 새 복원 사본을 준비한다.

`create`·`restore`·`reconcile`은 쓰기 시작 때 `.backup-incomplete`를 남기고, 파일 쓰기·동기화·검사가 모두 끝난 뒤에만 지운다. 실패한 출력은 진단용으로 보존하며 마지막 JSON이 읽혀도 완성본으로 쓰지 않는다. 표시가 남으면 백업 검증·복원 후 재개 검사·일반 서버 시작이 모두 거절한다. 표시를 수동 삭제하거나 기본 서버 명령으로 검사를 우회하지 말고 새 목적지로 다시 실행한다. 시험에서 주입한 쓰기·fsync 오류와 프로세스 중단을 확인하는 보호이며 물리 디스크 장애·정전 내구성의 증명은 아니다.

## 저장 장애와 전송 결과 확인

SQLite의 공간 부족·읽기 전용·잠금 등 저장 장애는 `503 storage-unavailable`로 응답한다. 응답에 DB 경로나 내부 오류를 넣지 않는다. 이 응답만으로 이전 요청의 저장 여부를 단정하지 않으며, 화면은 입력·선택·로그인과 기존 확인 표식을 유지한다. 프록시나 운영 스크립트에서 쓰기 요청을 자동 재전송하지 않는다.

운영자는 서비스의 쓰기를 중지하고 실제 저장 디스크 여유·DB 디렉터리 권한·다른 작성자의 잠금을 확인한다. SQLite가 거래를 이미 취소했다면 추가 취소로 원래 오류를 가리지 않으며, 취소 후 정리를 확인할 수 없는 연결은 닫아 재사용하지 않는다. 원인을 해결한 뒤 정상 종료·재시작 절차를 따르고, 사용자는 기존 저장 확인에서 결과를 조회한다. 미확인 상태라면 화면의 같은 요청 다시 보내기를 사용해 기존 요청 ID를 유지한다. 새 요청 ID 발급이나 확인 표식 삭제로 중복 방지를 우회하지 않는다. 과거 DB를 되돌리는 경우에는 위 복원 검사 절차가 따로 필요하다.

무료 합성 시험은 SQLite의 실제 `max_page_count`·`query_only`·다른 연결의 잠금으로 오류를 일으켜 HTTP 응답과 입력 보존·수동 재시도를 확인했다. 물리 디스크 고갈·OS 권한 장애·임의 I/O 오류·전원 차단을 시험한 결과는 아니다. [저장 장애 검사 기록](../../../docs/_ops/qa/atlas-dating-live-storage-20261008/report.json)을 따른다.

## 무료 로컬 검사

`tests/atlas-dating-deploy.test.mjs`는 명시한 `SYNK_QA_CADDY` 바이너리로 이 Caddyfile을 읽어 검사한다. 예시 도메인/포트를 합성 주소로 바꾸고, 시험 TLS·loopback listener·임시 저장·관리 API 끄기·자동 인증서 발급 끄기만 적용한다. 원본 프록시 헤더·오류 로그 규칙은 그대로 사용한다. 운영체제 인증서 저장소는 바꾸지 않는다. 바이너리가 없으면 해당 통합시험은 skip이고 통과로 세지 않는다.

```powershell
$env:SYNK_QA_CADDY = '<local Caddy executable>'
node --test tests/atlas-dating-deploy.test.mjs
```

실행 결과와 확인하지 않은 범위는 [준비 QA](../../../docs/_ops/qa/atlas-dating-deploy-20261008/report.json)에 둔다. 이 시험은 Windows의 실제 Caddy·Node 연결이며 Linux systemd·공인 인증서·운영 OAuth·실물폰 검증을 대신하지 않는다.

설정 근거: [Caddy reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Caddy 로그 필터](https://caddyserver.com/docs/caddyfile/directives/log#filter), [systemd.service](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html), [systemd.exec](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html).
