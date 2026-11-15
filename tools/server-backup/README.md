# 노트북과 독립된 서버 백업

2026-10-18 설치·첫 전송·원격 대조 완료. 기존 서버·Windows 백업은 유지하고, 아래 클라우드 원본의 추가 복구 사본을 기존 20TB 계정 `77yuhbs@gmail.com`에 만든다. 새 VM·유료 자원·IAM·메일 수신자는 추가하지 않았다.

## 실제 범위와 예약

| 역할 / 실행 서버 | 보존 범위 | 실제 예약·첫 확인 |
|---|---|---|
| company / `synk-company-1` | Supabase PostgreSQL 전체 custom dump와 Storage 객체, unmet23 현재 조사 Docs 3개·팁 Sheet 1개·등록 첨부, 기존 GCS 업로드가 성공한 최신 회사 DR 묶음의 동일 사본과(2026-11 판부터) 그 묶음의 데이터 백업이 목록만 담았을 때 그 백업의 작업실 영상 곁 객체와 같은 바이트, 이 백업 장치 자체 | 매일 07:10 KST + 0~120초. 10-18 15:44 완료 8개, 다음 10-19 07:11:57 |
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

<a id="narrow-keys"></a>
## 좁은 열쇠 검사(2026-10-21 서버 열쇠 인계)

10-21 서버 열쇠 인계 때 세 서버의 Drive 열쇠를 서버 전용 앱의 좁은 열쇠로 바꿨다. 좁은 열쇠는 범위가 `drive.file` 하나라서 그 앱이 만든 파일에만 닿는다. 그날 세 서버에는 이 열쇠를 확인하는 검사가 깔렸지만, 저장소에는 올라오지 않았다. 2026-11-16에 세 서버의 파일을 읽기만으로 받아 저장소로 옮겼다.

- 설정(`/etc/synk-server-backup/config.json`)의 `restrictedClientId`는 그 서버의 좁은 열쇠 클라이언트다. 세 서버 모두 `requireRestrictedDrive`가 참이다. 참인데 `restrictedClientId`가 없으면 `backup.cjs`는 `SERVER_OAUTH_CLIENT_REQUIRED`로 멈춘다.
- `backup.cjs`는 Drive 열쇠를 열 때마다 열쇠의 클라이언트가 `restrictedClientId`와 같은지 본다. 여는 자리는 77yuhbs 열쇠, 회사 메신저의 활성 연결과 첨부 연결, 키 의존성 확인이다. 다르면 `SERVER_OAUTH_CLIENT_MISMATCH`로 멈춘다. 같으면 받은 토큰을 tokeninfo로 확인한다. 토큰의 대상이 다르거나 범위가 `drive.file` 하나가 아니면 `SERVER_OAUTH_SCOPE_MISMATCH`이고, tokeninfo가 실패하면 `SERVER_OAUTH_CHECK_FAILED`이다. 토큰을 받을 때는 열쇠의 세 값(client_id, client_secret, refresh_token)만 보낸다.
- 범위 판정은 같은 폴더의 `oauth-policy.cjs`(`assertRestrictedToken`)가 한다. clasp 클라이언트(`107294490549-`로 시작)는 설정에 적혀 있어도 받지 않는다. `backup.cjs`를 깔 때는 이 파일이 옆에 있어야 한다.
- 회사 서버의 `watch.py`는 라디오 영수증을 라디오 앱의 열쇠로 읽는다. 열쇠는 `credentials.json`의 `drive77Radio`이고, 없으면 `drive77`을 쓴다. 열쇠의 클라이언트가 설정의 `radioClientId`(없으면 `restrictedClientId`)와 다르거나 clasp 클라이언트면 `RADIO_OAUTH_CLIENT_MISMATCH`다. 토큰의 대상이나 범위가 다르면 `RADIO_OAUTH_SCOPE_MISMATCH`다. `requireRestrictedDrive`가 참인데 `radioClientId`가 없으면 `RADIO_OAUTH_CLIENT_REQUIRED`다.
- 이 세 코드는 경보 메일에 그대로 실린다(`RADIO_KEY_ERRORS`, 2026-11-16부터). 10-21 판은 라디오 검사의 예외를 모두 `RADIO_REMOTE_AUDIT_FAILED` 하나로 바꿔 보내서, 메일만으로는 열쇠 문제인지 영수증 문제인지 알 수 없었다. 그 밖의 예외(영수증을 못 읽음, 소유자나 크기가 다름, 네트워크 오류)는 지금도 `RADIO_REMOTE_AUDIT_FAILED` 하나다. 예외에 붙은 글은 경보에 싣지 않는다.

2026-11-16 06시대에 세 서버의 파일을 받아 저장소와 견준 결과는 아래와 같다. 해시는 서버 파일 그대로의 sha256이다.

| 파일 | 회사 `synk-company-1` | 조사 `synk-company-2` | 라디오 `synk-radio-1` |
|---|---|---|---|
| `watch.py` | `1306f1f2…`(10-21) | 같음 | 같음 |
| `oauth-policy.cjs` | `ddbc1370…`(10-21) | 같음 | 같음 |
| `backup.cjs` | `02656862…`(11-16 04:07에 깐 `3f692ec8d` 판) | `8fc44fcd…`(10-21) | 조사 서버와 같음 |

- 저장소의 `watch.py`와 `oauth-policy.cjs`는 이제 서버 파일과 바이트까지 같다. 서버의 `watch.py`는 줄끝이 CRLF이다. 저장소에는 LF로 들어가고, LF로 바꾼 내용의 sha256은 `0f79e127…`이다.
- 조사 · 라디오 서버의 `backup.cjs`는 저장소 10-19 판에 좁은 열쇠 검사 일곱 줄만 더한 판이다. 저장소의 `backup.cjs`는 이제 `3f692ec8d` 판에 그 일곱 줄을 더한 판이다. 옮긴 줄은 서버 판의 줄과 글자까지 같다. 그 뒤의 영상과 인물 분류 고침은 회사 역할에서만 돌아서, 조사 · 라디오 서버에는 없어도 된다.
- 회사 서버의 `backup.cjs`에는 지금 이 검사가 없다. 11-01 영상 판은 저장소 10-19 판에서 시작했고, 그 판을 회사 서버에 깔 때 검사가 빠진 것으로 보인다([현장 노트](../../docs/현장노트/백업_업로드.md#server-only-edits-lost-on-install)).
- 그래도 회사 서버의 열쇠는 좁은 열쇠다. 11-16에 값은 찍지 않고 같음 여부만 봤다. `drive77`과 메신저 활성 연결의 클라이언트는 `restrictedClientId`와 같고, `drive77Radio`의 클라이언트는 `radioClientId`와 같았다. 셋 다 clasp 클라이언트가 아니었다. 회사 열쇠 둘의 tokeninfo 범위는 확인하지 않았다. 라디오 열쇠의 범위는 `watch.py`가 15분마다 확인하고, 11-16 06:30 KST 회차의 `radio-audit.json`이 성공이었다.
- 다음에 어느 서버에든 저장소의 `backup.cjs`를 깔면 검사가 함께 간다. 회사 서버에 깔면 바로 손으로 한 번 돌려 영수증이 성공인지 본다. `SERVER_OAUTH_SCOPE_MISMATCH`로 멈추면 회사 열쇠의 범위가 `drive.file` 하나가 아닌 것이다. 그때는 옛 파일로 되돌리고 열쇠부터 본다.
- 역할에 맞지 않는 옛 파일도 둘 있다. 회사 서버의 `argon-capture.py`와 조사 서버의 `company-sources.py`는 10-18 판이다. 둘 다 다른 역할에서만 도는 파일이라 그 서버에서는 쓰이지 않는다.
- 깔린 판이 저장소 판과 같은지는 `read-status.cjs --save`가 남기는 `nodes[].sourceHashes`를 저장소 파일의 sha256과 견줘 본다. 서버 파일이 CRLF일 수 있으니, 다르면 줄끝을 LF로 바꿔 한 번 더 견준다.

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

10-21부터 노트북의 매일 백업 마지막 단계(원본창고 `보존규칙.py`)가 이 폴더를 실행(영수증 `receipt-<runId>.json`) 단위로 줄인다 — 성공한 실행은 최근 30일 하루 한 벌·90일까지 주 한 벌·1년까지 달 한 벌, 실패한 실행은 30일. 남는 실행의 영수증이 가리키는 파일(서버가 다시 쓰는 옛 판 포함)과 어느 영수증도 가리키지 않는 파일(runtime·네이티브 보완)은 지우지 않으므로, 서버의 `prior[identity]` 재사용 대조는 깨지지 않는다. 끝난 주·달의 마지막 실행은 unmet23 `SYNK_금고/서버백업/si-<역할>/`에도 사본이 있다. 지우기는 휴지통이다.

로컬 미디어·Hermes·OneDrive의 새 로컬 편집 내용은 노트북이 꺼져 있는 동안 생성·전송할 수 없다. 5TB의 업무 원본·기존 PC 보존은 유지하지만, 이번 추가 암호문을 5TB에 다시 전량 복제하지 않았다. 원문·기존 백업·운영 방송 설정은 삭제하거나 바꾸지 않았다.

10-18 15:59:45 최종 재조회에서 세 역할의 본 백업·영수증·최종 runtime·네이티브 보완을 포함한 원격 사본 20개를 다시 대조했다. 최종 runtime은 company 93,044B·research 72,565B·radio 52,082B이며, 영구 상태의 `nodes[].runtimeRefresh.ciphertext`로 찾는다. 네이티브 DB 보완은 `nodes[].nativeClient.ciphertext`에 있다.

## 작업실 영상(2026-11 회사 판부터)

회사 백업이 작업실 영상을 압축본 밖 GCS 곁 객체 `company/production/<스냅숏>.media-<sha256>`로 두고, DR 묶음에는 목록만 담는다([영상 곁 객체](../../docs/마케팅/온라인마케팅지도/engagement/company/CLOUD-OPERATIONS.md#media-once-20261101)). 이 장치는 GCS를 읽지 못하므로, 주 노드가 남긴 호스트 전용 영수증 `/srv/synk/backup-archives/<스냅숏>.tar.gz.media.json`(곁 객체마다 generation·md5)을 따른다.

- `company-sources.py`가 고른 DR 묶음 안 데이터 압축본의 `media-manifest.json`을 흘려 읽어 판정한다(GPT 검수 GA1 — 영수증 유무로 미루어 보지 않음). 목록이 없거나(옛 백업) `bytesIncluded`면 할 일이 없다. 목록만이면 같은 스냅숏·같은 `createdAt`·같은 목록 sha256의 영수증이 꼭 있어야 하고, 없으면 `MEDIA_RECEIPT_MISSING`으로 멈춘다 — 영상 없는 사본이 「성공」이 되는 길이 없다.
- `backup.cjs`는 회사 역할의 맨 끝(DB·Storage 다음)에 곁 객체마다 `media-read.py`로 라이브 볼륨의 그 파일을 읽는다. 링크를 따라가지 않고, FIFO에 막히지 않고, uid 1000·링크 하나·같은 장치·크기를 본다. 읽은 바이트의 sha256·md5가 영수증과 같아야 sourceKey `gcs/<버킷>/<곁 객체>`·generation으로 암호화해 올린다. 백업 뒤 라이브에서 지운 영상이면 그 회차가 실패한다(경보) — DB·Storage는 이미 올라간 뒤다.
- 이 사본은 `gcs/` 원본이라 원본창고 `보존규칙.py`가 실행 단위(30일 하루·90일 주·1년 달)로 줄인다.
- 복원: 그 회차 영수증 items에서 sourceKey가 `….media-<sha256>`인 것을 내려받아 복호화해 한 폴더에 두고, `backup-media.py hydrate --snapshot <데이터 스냅숏> --from-dir <그 폴더> --prepared <준비된 회사 볼륨>`(sha256으로 짝지음, 토큰 없음).
- 설치: `backup.cjs`·`company-sources.py`·새 `media-read.py`를 `synk-company-1`의 `/opt/synk-server-backup/`에 root 0644로 바꿔 넣는다(다른 파일·설정·타이머 그대로, 실행 중이 아닐 때). 11-16부터 `backup.cjs`는 같은 폴더의 `oauth-policy.cjs`를 부른다. 세 서버에는 그 파일이 10-21부터 있다([좁은 열쇠 검사](#narrow-keys)). 자기 백업(`self-capture.py`)이 폴더 전체를 담는다. 영수증이 없으면(회사 판 전) 동작은 지금과 같다.

<a id="persona-vault"></a>금고 제외 표시(2026-11-11, 회사 판 62부터): PULSE 고객 전용 인물 파일은 unmet23 금고에 넣지 않는다(결정 표 11-11 ① · [판 4 설계 11-2](../../docs/마케팅/PULSE_의뢰흐름_20261104/판4_설계_20261110.md#retention-rules-20261111)). 데이터 백업이 목록 방식이면 맨 위에 `media-retention.json`(`noVault` — 인물 문서가 가진 본문의 sha256, 같은 목록 바이트의 sha256 · 시각에 묶임)을 두고, `company-sources.py`가 그 파일을 같은 흐름에서 읽어 `retention:{classified, noVault, bytesIncluded}`를 낸다(이름이 적혔는데 없거나 목록과 어긋나면 `MEDIA_RETENTION_INVALID`). `backup.cjs`는 그 본문 줄과, 인물 바이트를 품은 압축본이면 DR 묶음 줄에 `vault:false`를 달고 `sourceChecks`에 `media-retention`을 남긴다. 받는 쪽은 PC `보존규칙.py`의 `si_no_vault` · `si_plan`(입구 규칙 판 — 이 두 파일보다 먼저, 늦어도 11-16 05:51 KST 매일 백업 전에 깐다) — 표시 줄과 같은 내용의 줄을 금고에 새로 넣지 않고(이미 든 사본은 그 판의 기한으로만 빠진다), 기준 시각 뒤 분류를 못 믿는 회사 실행은 영상 본문 줄을 모두 새로 넣지 않으며 그 사실을 금고 상태에 남긴다. 하루 · 주 · 달 보존과 복원은 그대로다. 설치는 위 「작업실 영상」과 같은 꼴(`backup.cjs` · `company-sources.py` 둘, 회사 판 62 무장 뒤 · 실행 중이 아닐 때). 되돌리기는 옛 두 파일로 바꿔 넣기 — 그러면 PC가 다시 닫힌 쪽 규칙으로 영상 본문을 금고에서 뺀다. 이 두 파일은 2026-11-16 04:07 KST에 `synk-company-1`에 깔았다. 깐 판은 `3f692ec8d`의 두 파일과 sha256이 같다. 옛 두 파일은 같은 서버의 `/var/backups/synk-server-backup/pre-persona-vault-20261116/`에 있다. 그 뒤 첫 영수증(04:08 실행)부터 `media-retention` 점검이 `classified: true`, `legacyDeleted: 0`으로 붙는다. 조사 · 라디오 노드에는 깔지 않았다(인물 분류는 회사 역할에서만 돈다). 그때 회사 노드의 `watch.py`에는 저장소에 없는 라디오 좁은 열쇠 검사가 있었다. 같은 날 그 판을 저장소에 넣었으니 이제 저장소 판으로 깔아도 검사가 빠지지 않는다([좁은 열쇠 검사](#narrow-keys)).

「제2의 나」 사진(2026-11-04): `me2-intake` · `me2-media` 버킷은 받지 않는다 — 동의 화면이 「원본은 늦어도 하루 안에 지운다 · 내가 지우면 함께 지운다」고 약속하는데 이 사본은 원본 삭제를 따라 지우지 않아서다(최대 1년). 잃으면 학생이 다시 찍는다. 목록 SQL과 코드 두 겹으로 막고 `backup.test.cjs`의 「제외 버킷 0건」이 지킨다. 원본창고의 `talk백업.js`도 같다.

검증: `node --test tools/server-backup/backup.test.cjs`, `python -B tools/server-backup/watch.test.py`, `python -B tools/server-backup/media-sources.test.py`. 최초 실증 원문은 `.tmp/backup-remaining-20261018/server/`와 원본창고의 별도 상태 영수증에 있다.
