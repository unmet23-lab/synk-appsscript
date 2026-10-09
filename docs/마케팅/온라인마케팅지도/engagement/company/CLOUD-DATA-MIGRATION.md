# 회사 데이터의 클라우드 이전과 복구

2026-10-09 01:44 KST 기준 회사·메신저 데이터는 보호된 운영 설정의 `COMPANY_VOLUME_DIR`에 연결된 클라우드 영구 볼륨에서 운영한다. 원본 PC·옛 백업·릴리스·복구본은 보존했다. 현재 업무 알림 v2 `aeb1620ebc40`의 실행 상태, 알림·AI 설정과 남은 인수는 [클라우드 운영](CLOUD-OPERATIONS.md)을 따른다.

최종 PC 이전에서는 모든 writer를 정상 종료하고 DB/WAL·키·설정의 읽기 공유 잠금 아래 독립 백업 두 벌을 대조해 복구했다. 운영 활성화 시 정확한 새 볼륨의 `PREPARATION_INCOMPLETE`를 별도 보관 이동했고, 원본 불변·빈 WAL·writer 부재를 확인한 뒤 guard를 정상 해제했다. 이번 업무 알림 v2의 정지 사본 비교도 **문제0·token 삭제0**, 두 DB의 schema·모든 기존 업무행·계정 연결·암호화 자격·원래 키·DB 밖 파일 동일로 통과했다. 운영 볼륨과 원래7개 systemd unit은 유지했다.

**01:10 수동 백업166,980B를01:44 독립 GCS GET·HTTP200·SHA 대조 후 현재 이미지에서 격리 복구했다.** 회사6표·메신저27표의 schema·모든 논리 행·원래 키·VAPID 암호문과 전체 파일 바이트가 일치했고 복호화·키 쌍·계정 관계·무결성·외래키 검사를 통과했다. 입력 snapshot·archive는 불변, 운영 DB 접근·서비스 조작은0이며 `network none` 복구본의 marker를 유지했다. 백업 생성은 이전 `1965` 릴리스, 복구 검증은 현재 `aeb162` 이미지다. 과거 온라인 snapshot의 복구 증거이며 **두 DB 동일 시점·현재 실시간 데이터 일치·정기 실행을 증명하지 않는다.**

정확한 후보·해시와 각 복구 결과는 [릴리스 검증 요약](../../../../_ops/qa/company-cloud-release-20261009/README.md)에 연결한다. 과거 전환의 비만료 인증 세션1건 삭제는 별도 수동 수락 이력이며 strict 실패 원본을 보존하고 일반 비교기를 완화하지 않았다. 원본 guard의 과거 위반 기록과 부모 릴리스 재부팅의 장치 별칭 변경 판정도 당시 결과로 보존한다.

## 함께 보존하는 데이터

`workspace-backup.mjs`는 SQLite backup API로 회사·메신저 DB를 각각 복사하고, 회사의 **원래** `encryption.key`, `identityLinks`, DB에 등록된 제작 파일·로컬 첨부, 메신저 `drive-storage.json`을 함께 보존한다. 임시 업로드와 로그·PID·로컬 실행기 설정은 옮기지 않는다. Drive 파일 본문은 이 백업에 없으므로 Drive 삭제·권한 상실은 로컬 백업만으로 복구할 수 없다.

회사는 현재 `synk-identity.mjs`에서 `SYNK_ID_*` 환경변수를 읽으며 별도 account-config JSON을 읽지 않는다. 백업에 account-config 파일을 추가하는 방식으로 해결하지 않는다. 운영 환경파일 `/etc/synk/company.env`는 저장소·이미지·백업 로그 밖에서 별도 이관하며, Secret Manager 또는 운영자만 읽는 파일로 공급한다. 공개 주소·OAuth 콜백·로그인 설정은 새 환경과 실제 등록값이 일치하는지 확인한다. 비밀값이나 DB 내용·사용자 식별자를 검증 보고서에 적지 않는다.

| 위치 | 회사 DB와 키 | 메신저 | 통합 설정 |
|---|---|---|---|
| 보존 백업 | `company/company.sqlite`, `company/encryption.key` | `messenger/` | 상대 위치와 `identityLinks`를 담은 `integration-manifest.json` |
| 일반 격리 복구 | `company/` | 형제 `messenger/` | 현재 복구 경로를 기록하며 기존 방식 유지 |
| 클라우드 볼륨 복구 | 새 대상 폴더의 루트 | 새 대상의 `messenger/` | `identityLinks`만 기록; PC의 `messengerDataDir` 절대경로 제거 |
| 운영 마운트 계약 | 확정 `COMPANY_VOLUME_DIR` → `/data` (기본 `/srv/synk/company`) | `/data/messenger` | `SYNK_COMPANY_DATA=/data`, `MESSENGER_DATA_DIR=/data/messenger` |

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
- 인수 전에는 해당 자동 작업을0으로 두고 로그인·권한·데이터를 검증한다. 담당자가 각 대기열과 연결 계정을 검토하고 해당 작업의 재개를 승인한 뒤에만 해당 flag를1로 바꾸고 정상 종료·재기동한다. 실행 중 환경파일만 바꾸어서는 전환되지 않는다. 이번에는 사용자가 Web Push와 예약 리마인더/마감 알림을 각각 승인하여 PUSH1·WORK1로 인수했다. 회사 수집·트렌드 수집·Drive 삭제 outbox는 BACKGROUND0을 유지한다. 실제 휴대폰·두 기기 시험은 사용자 지시로 보류한다.

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

예약 도구는 기존 CLI를 직접 실행하고 종료 코드0·새 `COMPLETE` 이후에만 외부 보관을 이어간다. 실패한 폴더는 업로드하지 않는다. 업로드는 새 객체 생성만 허용하며 기존 객체를 덮어쓰거나 실패 후 자동 삭제하지 않는다. 외부 저장·보존 정책·복구 대조 문제는 운영자에게 알리고 유료 AI를 깨우지 않는다.

온라인 운영 백업과 최종 이전용 writer 중지 백업을 구분한다. snapshot·외부 저장·독립 다운로드·복구 대조는 각각 별도 증거가 필요하다. 첫 정기 백업은 아직 미확인이고, **03:30~03:46 실행 창·03:50 서버 확인·03:55 공식1회 후속**의 계약과 한계는 [운영 문서](CLOUD-OPERATIONS.md#첫-정기-백업과-남은-인수)를 따른다. 미래 완료를 추정하거나 수동 백업으로 정기 실행을 대신하지 않는다.
