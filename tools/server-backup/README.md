# 노트북과 독립된 서버 백업

2026-10-18 설치·첫 전송·원격 대조 완료. 기존 서버·Windows 백업은 유지하고, 아래 클라우드 원본의 추가 복구 사본을 기존 20TB 계정 `77yuhbs@gmail.com`에 만든다. 새 VM·유료 자원·IAM·메일 수신자는 추가하지 않았다.

## 실제 범위와 예약

| 역할 / 실행 서버 | 보존 범위 | 실제 예약·첫 확인 |
|---|---|---|
| company / `synk-company-1` | Supabase PostgreSQL 전체 custom dump와 Storage 객체, unmet23 현재 조사 Docs 3개·팁 Sheet 1개·등록 첨부, 기존 GCS 업로드가 성공한 최신 회사 DR 묶음의 동일 사본, 이 백업 장치 자체 | 매일 07:10 KST + 0~120초. 10-18 15:44 완료 8개, 다음 10-19 07:11:57 |
| research / `synk-company-2` | synkbrief Doc, Argon 설정·인증·소스·예약·입력·조사 원문 백업과 교정 영수증 53개, 이 백업 장치 자체 | 같은 주기. 10-18 15:43 완료 3개, 다음 10-19 07:11:42 |
| radio / `synk-radio-1` | 방송 서버의 설정·소스·synk crontab 129개, 이 백업 장치 자체 | 같은 주기. 10-18 15:42 완료 2개, 다음 10-19 07:10:13 |

research의 Argon 수집(`argon-capture.py`)은 승인된 역할·문서 대응을 `tools/argon-schedules/configuration/docs.json`과 똑같이 품고 있다가 서버 대응이 다르면 `ARGON_DOC_MAPPING_CHANGED`로 멈춘다(백업 장치 로그에는 `COMMAND_FAILED`로만 보인다). Argon 역할을 더하거나 바꾸면 이 파일도 함께 고쳐 예비 노드 `/opt/synk-server-backup/`에 넣는다. 어긋남은 `backup.test.cjs`가 잡는다(10-20 월요일 스캔 셋 추가 뒤 실패 사례, [현장 노트](../../docs/현장노트/백업_업로드.md)).

예약은 systemd `synk-server-backup.timer`의 `Persistent=true`로 설치됐다. 노트북·브라우저·로그인 세션이 없어도 서버에서 실행한다. 실행 잠금, 3시간 제한, CPU·메모리 제한이 있다. A/B의 별도 감시 타이머는 15분마다 실행하며 A가 Radio의 실제 원격 영수증까지 검사한다. 기존 PC 작업과 서로 다른 원격 폴더·영수증을 사용한다.

회사 DR 사본은 GCS 전체 이력을 다시 내려받지 않는다. 기존 업로더의 성공 영수증에 기록된 generation·크기·MD5와 현재 로컬 묶음 SHA를 대조한 최신 완료 세트만 추가 보존한다. Supabase Storage는 10-18 실제 객체 0개이며, 앞으로 생성되는 객체는 DB 목록 전후 일치·HTTP ETag·크기·MD5를 검사한다. 필요한 옛 문서 9개의 별도 최초 보존은 [플랫폼 데이터 계약](../../docs/SYNK_플랫폼_계정과_연결_설계.md)과 기존 Workspace 백업 기록을 따른다. 서버 OAuth로 접근되지 않는 옛 문서를 정기 성공 범위로 표시하지 않는다.

## 설치 위치와 현재 상태 읽기

- 소스: `/opt/synk-server-backup`, root 소유 0755/0644.
- 설정·기존 자격·공개키: `/etc/synk-server-backup`, root 전용 0700/0600.
- 상태·실행 잠금·암호문 임시 파일: `/var/lib/synk-server-backup`, root 전용 0700/0600.
- 단위 파일: `/etc/systemd/system/synk-server-backup*`.
- A/B Node: `/opt/synk/ha-runtime/node`; Radio: `/usr/bin/node`.
- A PostgreSQL 17.11 클라이언트: `/opt/synk-server-backup/pg17`. 공식 PGDG bookworm 서명·인덱스·패키지 SHA를 검증해 별도 경로에 풀었다. 운영 PostgreSQL 서버·전역 apt 저장소는 설치하지 않았다. `pg-client.py`가 실행 파일 SHA를 검사한다. 정기 DB 수집은 Docker 컨테이너를 만들지 않아 HA의 물리 writer 검사와 겹치지 않는다.

저장소에서 읽기 전용으로 실행한다:

```powershell
node tools/server-backup/read-status.cjs --save
node tools/server-backup/check-monitoring.cjs
node tools/server-backup/install-absence-monitoring.cjs --check
```

첫 명령은 원래 SSH 호스트 키와 인스턴스 ID를 확인하고 별도 `C:\Users\q1212\Documents\SYNK_원본창고\server-independent-status.json`을 갱신한다. 서버 주소는 공개 저장소에 두지 않는다(10-20) — 세 서버 모두 그때의 바깥 주소를 GCE에서 읽는다. 회사 두 대는 굽기 계정 Vertex 자격, 라디오는 배포 계정(`~/.clasprc.json`) 자격으로 읽는다. 라디오 프로젝트는 Vertex 자격으로 읽으면 403이다. PC의 기존 성공·실패 원장은 덮어쓰지 않는다. 서버의 `latest.json`은 현재 회차, `latest-success.json`은 실제 마지막 원격 성공, `ledger.json`은 버전별 원격 위치다. `native-client-check.json`과 `key-dependency-check.json`은 별도 보완 증거다.

## 암호화·무결성과 키 의존성

평문은 스트림으로 기존 `SYNK-ENC-1` RSA-OAEP + AES-256-GCM에 넣는다. 서버에는 사용자 공개키만 둔다. 암호문과 영수증은 정확한 계정·단독 소유·비공개 폴더·휴지통 여부·크기·MD5·SHA256을 원격 API로 대조한다. 변경 없는 버전도 다시 원격 검사한다. 실패 원장은 보존하며, 강제 종료의 고아 암호문은 다음 실행과 충돌하지 않는 고유 이름으로 남긴다.

Supabase `vault.secrets` 복원에는 DB dump 외에 해당 프로젝트의 pgsodium 원키가 필요하다. 현재 원키는 사용자 공개키로 암호화해 20TB에 보존했고 실제 5개 Vault 값 복호화 시험이 성공했다. A에는 **원키가 없는 안전 manifest** `vault-key-dependency.json`만 둔다. 매일 DB dump 전에 캡슐·manifest를 다시 다운로드하여 소유·크기·SHA·키 ID를 확인하고 dump 영수증에 의존성을 기록한다.

- 원키 캡슐 ID: `1EJyyl2A23HN5T70mZNNF0gsPdLSbh7R6`, 1,133B.
- manifest ID: `1ycoYdbK9ut9qtJU4vvPPJNwtTuVLvIdk`.
- 현재 원키 SHA256(decoded 32 bytes): `e85c307a8243cfb8bf299550050c122d9c957bd33406e454a855c5219365c64a`.
- Management PAT·원키·복호화 개인키는 새 서버 백업 장치로 전송하지 않았다. 기존 20TB OAuth, A의 DB 읽기 전용 자격과 Storage 읽기용 기존 키만 root 전용으로 사용한다.
- 원키를 수동 회전하면 먼저 원본창고 `SupabaseVault키백업.cjs`로 새 캡슐을 보존·검증하고 A의 dependency를 갱신해야 한다. 서버는 Management PAT가 없으므로 라이브 원키의 변경 자체를 자동 조회하지 않는다.

가벼운 의존성 확인은 A에서 다음 명령이다. 실제 DB를 다시 dump하지 않는다:

```sh
/opt/synk/ha-runtime/node /opt/synk-server-backup/backup.cjs --check-key-dependency
```

10-18 15:55 실제 네이티브 dump 3,699,237B와 TOC 1,445개·TABLE DATA 125개를 확인하고, 캡슐 의존성을 포함한 암호문 3,700,120B를 20TB에 대조했다. 평문 파일·새 컨테이너는 없고 기존 성공 원장은 그대로다.

`verify-native-client.cjs`는 명시적으로 실행할 때만 네이티브 클라이언트의 실제 dump를 스트림 암호화하고 TOC와 원격 사본을 검사하는 별도 보완 시험이다. 정기 성공 시각을 바꾸지 않는다. `prepare-native-client.py`는 공식 패키지를 준비하는 복원용 설치기이며 DB 서버를 만들지 않는다.

## 실패·지연·서버 중단 알림

기존 사용자 이메일 채널 `14855206170551846292` 하나를 사용한다.

| 조건 | 감지 경로 |
|---|---|
| 프로세스 실패, 타이머 비활성, 실행 3시간 초과, 마지막 원격 성공 26시간 초과 | A/B `watch.py` → Cloud Logging → 실패 정책 `18443156031886673239` |
| Radio 실패·26시간 이상 미갱신·원격 영수증 변조/접근 실패 | A의 실제 원격 조회 → 같은 실패 정책 |
| A/B VM 전체 중단, 감시 타이머 중단, 정상 신호 유실 | Cloud Monitoring 부재 정책 `2631536959569911876` |

부재 정책은 `global` 리소스의 기존 `logging.googleapis.com/log_entry_count`를 역할별로 감시한다. 45분 부재 + 10분 집계와 Google 처리 지연이 적용된다. 정책 생성 이후 실제 정상 신호가 한 번 들어와야 감시가 시작되며, 10-18 15:44에 두 역할의 생성 이후 양수 지표를 확인했다. 신규 custom metric·IAM은 없다. [공식 부재 조건](https://docs.cloud.google.com/monitoring/alerts/metric-absence).

고의 실패 시험의 Cloud Logging 접수를 확인했다. 초기 설치 때 마지막 성공이 아직 없어서 발생한 `NO_REMOTE_VERIFIED_SUCCESS` incident 2건은 실제 API에서 확인했으며, 해당 시작 처리 오류는 수정했고 양쪽 서버의 현재 백업과 정상 신호를 다시 확인했다. 15:48 조회에서 기존 이메일 채널 활성, 알림 채널 오류 로그 0건이었다. 실패 정책은 30분 동안 같은 조건이 다시 발생하지 않으면 자동 종료되도록 설정됐다. [공식 사고 API](https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.alerts)는 읽기 전용이므로 CLI에서 사고를 강제로 닫지 않았다. 이는 실제 받은편지함 수신·읽음 확인과 다르며, 그 확인은 하지 않았다. VM을 일부러 끄고 45분 기다리는 장애 시험도 하지 않았다. [공식 사고 조회](https://docs.cloud.google.com/monitoring/alerts/incidents-events), [알림 전송 오류 조회](https://docs.cloud.google.com/monitoring/alerts/troubleshoot-missing-notifications).

## 원격 위치와 복원 순서

20TB `SYNK_원본창고/server-independent/` 아래 역할별 폴더:

| 역할 | Drive 폴더 ID |
|---|---|
| company | `10NHLi2hA0NwWsreOx1uURzJe6HEjiZBm` |
| research | `1q_jePqt4oX1S-SASUXMmsrz33-Xc2fIl` |
| radio | `1kqEcXYC42pPeikSXeltPI-kUMX8R4skz` |

1. OneDrive의 [컴퓨터를 잃어버렸을 때](../../docs/컴퓨터를%20잃어버렸을%20때.md)와 잠긴 개인키를 확보하고 해당 역할의 최신 **성공** 영수증에서 필요한 sourceKey·버전·remoteId를 고른다. 실패 회차를 최신 성공으로 바꾸지 않는다.
2. 암호문을 내려받아 영수증의 크기·MD5·SHA256을 확인한 뒤 사용자 암호로 개인키를 열어 복호화한다. 개인키와 평문 자격은 OneDrive 시스템 소스나 공개 저장소에 넣지 않는다.
3. DB는 custom dump와 연결된 Vault 키 캡슐을 함께 준비한다. 회사 DR·Argon·Radio tar는 manifest의 파일 SHA·권한과 원래 계정을 대조한다. 전체 복원 절차는 [플랫폼 데이터 계약](../../docs/SYNK_플랫폼_계정과_연결_설계.md)의 복원 링크를 따른다.
4. `server-backup-runtime/<role>` tar에는 새 백업 소스·설정·기존 자격·공개키·systemd가 암호화돼 있다. 처음 복원할 때 타이머를 비활성으로 두고 원격 계정과 원본 접근을 확인한 뒤 켠다. PG 클라이언트 바이너리는 설치 의존성이므로 tar에 넣지 않고 공식 설치기와 서명·패키지 manifest로 재구성한다.

로컬 미디어·Hermes·OneDrive의 새 로컬 편집 내용은 노트북이 꺼져 있는 동안 생성·전송할 수 없다. 5TB의 업무 원본·기존 PC 보존은 유지하지만, 이번 추가 암호문을 5TB에 다시 전량 복제하지 않았다. 원문·기존 백업·운영 방송 설정은 삭제하거나 바꾸지 않았다.

10-18 15:59:45 최종 재조회에서 세 역할의 본 백업·영수증·최종 runtime·네이티브 보완을 포함한 원격 사본 20개를 다시 대조했다. 최종 runtime은 company 93,044B·research 72,565B·radio 52,082B이며, 영구 상태의 `nodes[].runtimeRefresh.ciphertext`로 찾는다. 네이티브 DB 보완은 `nodes[].nativeClient.ciphertext`에 있다.

검증: `node --test tools/server-backup/backup.test.cjs`, `python -B tools/server-backup/watch.test.py`. 최초 실증 원문은 `.tmp/backup-remaining-20261018/server/`와 원본창고의 별도 상태 영수증에 있다.
