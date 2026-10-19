# Argon 예약 운영 소스

2026-10-18 12:12 KST 운영 전환을 마쳤다. 기존 Gemini 예약 4개는 일시중지했고, 서버 타이머 4개는 enabled·active로 확인했다. 전환 뒤 첫 정규 회차인 10-18 14:00 YouTube·TikTok 조사가 실제 타이머로 시작해 Argon 실행과 기존 Google Docs의 새 저장까지 성공했다. 장애 알림 메일 실제 수신도 확인해 요청한 운영 검증 목표를 충족했다. [YouTube·TikTok 결과 문서](https://docs.google.com/document/d/1aYwO_1qBcUs5uzeeRoeePBRo_qkWSFBwjr4Xj-LUXmI/edit), 최신 운영 결과는 [트랙](../../docs/_ops/트랙.md)의 해당 예약 항목과 아래 실행 상태에서 확인한다.

## 계정 기준

2026-10-18 사용자 확정: 예약을 포함한 모든 아르곤 실행은 `77yuhbs@gmail.com` Ultra, 업무 문서 저장은 `unmet23@gmail.com`으로 통일한다. 상위 기준은 [AI 운영 원칙](../../docs/AI_운영원칙.md#역할)이다. PC의 웹·앱·CLI에서도 아르곤 작업을 시작할 때 실제 실행 계정을 확인한다. unmet23의 Argon 권한 해결·실행 계정 이전은 현재 후속 작업에서 종료했다.

## 실행 구조

- Linux systemd가 **공식 Antigravity CLI `agy`를 직접 실행**한다. 고정 모델은 `gemini-4-argon-high`, 실행 구독은 `77yuhbs@gmail.com`의 Ultra 계정이다. 다른 모델이나 유료 API로 자동 대체하지 않는다.
- `docs-io.py`는 Google Workspace CLI(`gws`)를 통한 지정 Google Docs의 읽기·백업·revision 충돌 방지·쓰기·본문 재읽기만 처리한다. `snapshot`은 본문을 비공개 작업 파일로 저장하고 짧은 메타데이터를 반환한다. 설치한 `gws` 0.22.5는 자체 버전 출력에 Google의 공식 지원 제품이 아니라고 명시한다. 공식 Antigravity CLI `agy`의 지원 상태와 혼동하지 않는다.
- `run-check.py`는 시작 시 Docs 기준 해시를 보존하고, 종료 시 실제 모델·대화 ID·도구 거절 여부·완료 표식·Docs 재읽기 해시를 대조한다. 두 Python 파일은 LLM을 실행하지 않는다.
- 종료 영수증은 `run-status/history/ROLE-INVOCATION_ID.json`에도 0600으로 보관한다. 다음 회차가 최신 상태를 바꿔도 실행 시각·실제 모델·문서 해시를 확인할 수 있고, 영수증에는 보고서 본문과 revision을 넣지 않는다.
- 원격 로그와 상태는 실행 사용자 전용이다. 공용 잠금으로 실행 중복을 거절하고, systemd는 자동 재시작하지 않는다. 실패한 쓰기를 결과 확인 없이 다시 실행하지 않는다.
- 인증 토큰·OAuth 비밀값·실제 계정 설정·백업 본문·실행 로그는 이 폴더에 포함하지 않는다. PC 앱 로그인과 예약 서버의 OS 사용자는 분리되어 있다.

## 보존 파일

| 파일 | 서버 배치 위치/용도 |
|---|---|
| `docs-io.py`, `run-check.py` | `/opt/synk-argon-77yuhbs/`, root 소유 0755 |
| `docs-io-test.py`, `run-check-test.py` | 가짜 Docs 응답과 임시 파일만 사용하는 오프라인 시험 |
| `production-units/` | `/etc/systemd/system/`의 4개 service·4개 timer·공용 slice, root 소유 0644 |
| `production-inputs/*.input.jsonl` | `/var/lib/synk-argon-77yuhbs/prompts/`, 실행 사용자 소유 0600; 공식 CLI의 user event 한 줄 |
| `production-inputs/*.prompt.txt` | 같은 지시문의 사람이 읽을 수 있는 원문 |
| `synk-argon-ultra.logrotate` | `/etc/logrotate.d/synk-argon-ultra`, root 소유 0644; 실행·후처리 중에는 회전하지 않음 |
| `alert-event.py`, `alert-event-test.py` | `/opt/synk-argon-77yuhbs/`, 오류 고정 코드 전송·비공개 outbox·전송 ack·오프라인 시험 |
| `alert-units/` | `/etc/systemd/system/`, OnFailure 처리·5분 재전송·수동 합성 시험 unit |
| `production-dropins/50-failure-alert.conf` | 4개 운영 `synk-argon-ultra-ROLE.service.d/`, 공통 OnFailure 연결 |
| `alert-policy.json` | 전용 Cloud Monitoring 정책 원문. 같은 이름·ID의 기존 정책을 먼저 조회하고 중복 생성하지 않음 |
| `configuration/docs.json` | `/etc/synk-argon-77yuhbs/docs.json`, root 소유 0644; 승인된 4개 역할의 기존 문서 ID |
| `configuration/agy-settings.example.json` | 아래 복원 설명에 따라 별도 HOME의 `settings.json`에 반영하는 비밀값 없는 설정 예시 |

예약 시각은 모두 `Asia/Seoul`이다. `Persistent=false`라 서버 중단 중 놓친 실행을 재부팅 때 몰아서 실행하지 않는다.

| 역할 | 예약 시각 |
|---|---|
| `full` | 매일 05:00 |
| `yt-tt` | 매일 08:00·14:00·20:00 |
| `meta-brand` | 매일 11:00·17:00·23:00 |
| `synkbrief` | 월·수·금 09:00 |

## 상태와 실패 확인

서버에서 다음 조회 명령을 사용한다. 상태 파일의 `complete`는 Docs까지 대조한 결과이고 `no-change`는 시작·종료 본문 해시가 같은 결과다. CLI 종료 코드 0이나 `SUCCESS`만으로 완료를 판정하지 않는다.

```sh
systemctl list-timers --all 'synk-argon-ultra-*.timer'
systemctl show synk-argon-ultra-synkbrief.service -p ActiveState -p Result -p ExecMainStatus
sudo cat /var/lib/synk-argon-77yuhbs/run-status/synkbrief.json
journalctl -u synk-argon-ultra-synkbrief.service --since today
```

다른 역할은 명령의 `synkbrief`를 해당 역할로 바꾼다. 상세 원인은 비공개 `logs/ROLE.stream.jsonl`·`logs/ROLE.stderr.log`에서 확인하되 원문 전체나 인증 정보를 외부로 복사하지 않는다. 모델 불일치, 도구 거절, Docs 충돌, 결과 불명확 시 자동 대체·재시도 없이 원인을 확인한다.

2026-10-18 장애 알림을 별도 Cloud Monitoring 정책 `8330051917313971027`에 연결했다. 기존 운영 이메일 채널을 재사용하며, 기존 회사 서버의 경보 정책은 그대로다. 4개 운영 service의 OnFailure가 `synk_argon_ops` 로그에 역할·고정 오류 코드·실행 식별자만 전송한다. root 전용 `/var/lib/synk-argon-alerts/`의 outbox는 전송 실패를 보관하고 5분마다 재전송한다. 전송 ack와 고정 insertId로 중복 전송을 줄이며, 이 과정에서 AI나 Docs를 실행하지 않는다.

12:31·12:38 KST 합성 실패가 OnFailure → Cloud Logging 기록 → ack까지 성공했고, 12:38 Google Cloud Alerting 메일의 실제 수신을 기존 운영 Gmail에서 확인했다. 제목의 `alert-test`, 본문의 `SYNTHETIC_ALERT_TEST`·`SYNK_ARGON_ALERT_TEST_20261018`, 정책·서버 식별자가 일치했다(incident `0.odyhzmwcnmzg`). 수신 증거는 `.tmp/argon-alerts-20261018/email-receipt.json`·`email-receipt-ax.txt`·`email-receipt.png`에 보존한다. 시험 메일을 추가로 보내지 않는다.

13:16 KST 사용자 앱 재시작 뒤 Chrome 연결이 복구돼 메일을 읽었다. 앞선 차단의 정확한 원인은 미확정이다.

첫 운영 `yt-tt` 회차는 14:00:00 KST systemd 타이머가 실제 발화했고, 상태 기록은 14:00:01, 공식 `agy` 실행은 14:00:04–14:12:49, Docs 대조 후 완료는 14:12:51이었다. 14:35:05 읽기 전용 검증에서 `gemini-4-argon-high`·77yuhbs 인증 계정 일치·`SUCCESS`·도구 거절 없음·대화 ID `bde3fd47-cfd0-4683-9435-4f5ba1999c7b` 일치를 확인했다. Docs 저장 계정은 unmet23이다. [결과 문서](https://docs.google.com/document/d/1aYwO_1qBcUs5uzeeRoeePBRo_qkWSFBwjr4Xj-LUXmI/edit)의 실제 재읽기 본문 65,939바이트와 revision이 저장 기록에 일치했고, SHA-256은 `f66bc846c4beed0bde201c983f5e5f228a6355cfdaa23edaf7e4c06f3d48f23d`로 시작 기준 `7f4155ea351cf8f4531bd916d1044c6d9199a13d6f13e2bc9917a3a7c8275de4`에서 바뀌었다. 수동 시험이나 `NO_CHANGE`를 첫 예약의 새 저장으로 세지 않았다.

장애 알림 수신과 첫 실제 예약·새 Docs 저장 목표를 모두 충족했다. 확인용 Codex heartbeat `argon`은 완료 후 삭제했고, 서버 예약 4개와 장애 알림은 그대로 유지한다. 서버 예약·장애 알림은 PC와 독립적으로 실행된다.

## 비활성 상태로 복원

1. 기존 서버의 상태·파일 해시·실행 중 작업부터 확인하고 필요한 원본을 보존한다. 복원 대상의 4개 timer를 `systemctl disable --now`로 비활성화하고, 실행 중 service는 종료 상태를 확인한다. readiness 파일 `/etc/synk-argon-77yuhbs/production-ready`는 복원 대상에서 보존용 위치로 옮겨 실행 조건을 해제한다. 이 파일을 새로 만들지 않는다.
2. 기존 `synk-argon-ultra` OS 사용자·그룹, `/var/lib/synk-argon-77yuhbs` 0700 HOME과 `work`·`prompts`·`logs`·`run-status`를 확인한다. 빈 로그 8개도 실행 사용자 소유 0600으로 먼저 준비한다. systemd가 먼저 만들면 root 소유가 되어 후처리 읽기가 실패할 수 있다.
3. 공식 Antigravity CLI·Google Workspace CLI 설치와 승인된 별도 계정 인증, Docs API 활성화를 확인한다. 문서 매핑은 `configuration/docs.json`, 비밀값 없는 실행 설정은 아래 예시를 사용한다. 자격증명을 이 저장소에 넣지 않는다. `useG1Credits=false`와 유료 API 공급자 설정 없음, 정확한 helper 명령·작업 경로 권한, 인증 파일 읽기 거절을 확인한다.
4. 위 표의 경로·소유권·권한으로 소스를 배치하고 SHA-256을 대조한다. 공식 실행 파일 경로는 unit과 일치해야 한다. 이 폴더에는 설치기나 별도 LLM 실행기가 없다.
5. `systemd-analyze verify /etc/systemd/system/synk-argon-ultra-*.service /etc/systemd/system/synk-argon-ultra-*.timer /etc/systemd/system/synk-argon-ultra.slice`와 `logrotate --debug /etc/logrotate.d/synk-argon-ultra`로 확인한 뒤 `systemctl daemon-reload`한다. 4개 timer가 계속 disabled이고 readiness 파일이 없는지 다시 확인한다.
6. 활성화는 별도 실제 실행 검증, Docs 재읽기·모델 확인, 기존 Gemini 예약 4개 일시중지 확인을 마친 후 운영 전환으로 수행한다. 비활성 복원 자체가 예약 활성화를 뜻하지 않는다.

장애 알림을 복구할 때는 기존 전용 정책과 이메일 채널의 현재 상태를 읽는다. 서버 서비스 계정의 `roles/logging.logWriter`, root 소유 알림 소스·unit, 4개 service drop-in, root 0700 outbox·ack를 대조한 뒤 drain timer를 켠다. 합성 시험은 수동으로 한 번만 시작하며 운영 조사나 문서를 바꾸지 않는다. Cloud Logging 기록과 실제 이메일 수신을 각각 확인한다. 계정 키 파일과 별도 Ops Agent는 필요하지 않다.

### 비밀값 없는 설정 복원

`configuration/agy-settings.example.json`은 10-18 설치·권한 보정 스크립트가 추가한 규칙과 비용 설정을 모은 복원 예시다. 서버의 현재 전체 `settings.json`을 내보낸 파일이 아니며, 현재 서버 파일과의 해시 일치를 주장하지 않는다. 실제 계정 설정·인증 토큰·실행 본문은 포함하지 않는다.

| 대상 | 경로·소유권·권한 |
|---|---|
| 별도 HOME과 작업 디렉터리 | `/var/lib/synk-argon-77yuhbs`와 `work`·`prompts`·`logs`·`run-status`·`.gemini`·`.gemini/antigravity-cli`·`.gemini/config`·`.config`·`.config/gws-docs`는 `synk-argon-ultra:synk-argon-ultra`, 0700 |
| agy 설정 | `/var/lib/synk-argon-77yuhbs/.gemini/antigravity-cli/settings.json`, `synk-argon-ultra:synk-argon-ultra`, 0600 |
| Docs 매핑 디렉터리·파일 | `/etc/synk-argon-77yuhbs`는 `root:root`, 0755; 그 안 `docs.json`은 `root:root`, 0644 |
| 생성되는 계정 인증 파일 | 위 별도 HOME의 승인된 인증 경로에만 보관하고 실행 사용자 소유 0600으로 확인한다. 저장소에 복사하지 않는다. |

- 예시는 `useG1Credits: false`와 실제 추가된 `permissions.allow`·`permissions.deny`만 담는다. `modelProvider`는 넣지 않았다. 기존 설정이 있다면 먼저 보호된 위치에 보존하고 해당 항목을 대조해 반영한다. 계정 인증이나 다른 설정을 통째로 덮어쓰는 파일로 사용하지 않는다.
- allow에는 UTC 시각, 지정 helper의 역할별 read/snapshot/write, 작업 폴더 쓰기, 공개 URL 읽기와 `gws --version`만 둔다. `read_url(*)`는 당시 공개 원문 읽기 오류를 고친 규칙이다. 셸 명령 전체 허용이나 대화형 브라우저 권한을 뜻하지 않는다. deny에는 Docs 인증 폴더·agy 토큰·agy 설정 파일 읽기 거절을 유지한다.
- 전역 `/var/lib/synk-argon-77yuhbs/.gemini/config/user_config.json`의 `use_ai_credits`가 없거나 false인지도 별도로 확인한다. 기존 `modelProvider`가 있거나 전역 크레딧이 true이면 활성화하지 않고 승인된 구독 경로를 먼저 확인한다. 모델은 예시 설정의 추정값 대신 각 service의 `--model gemini-4-argon-high`로 고정한다.
- 실행 계정은 77yuhbs, Docs 저장 계정은 unmet23이다. 인증은 별도 HOME에서 Antigravity 공식 CLI 로그인과 `gws auth login`의 기존 승인된 OAuth 흐름으로 각각 진행한다. PC 앱 로그인·브라우저 기본 계정은 바꾸지 않는다. 새 권한이 필요하면 기존 승인 범위를 확인하고, 예시 파일만 복사해 인증 완료로 보고하지 않는다.
- `configuration/docs.json`의 4개 ID는 최초 helper 설치의 승인 매핑과 각 역할 프롬프트에 맞춘 값이다. 복원 대상의 기존 매핑·문서 접근을 대조하고, 새 문서나 대체 writer를 만들지 않는다. 알림 helper의 `RUN_UID=994`도 기존 실행 사용자 UID와 일치해야 한다.

예시의 근거는 `.tmp/argon-isolated-20261017/`의 `allow-readiness-probe.cjs`, `install-production-prepared.cjs`, `allow-research-reading.cjs`, `finalize-delivery-contract.cjs`, `install-docs-io.cjs`다. 비용 설정의 마지막 로컬 증거 `no-paid-credits-final-20261018.json`은 `useG1Credits=false`, 전역 크레딧 비활성, API 공급자 없음으로 기록됐다. 이 설명과 예시 파일만으로 서버를 활성화하거나 새 실행을 시작하지 않는다.

오프라인 회귀 시험은 저장소 루트에서 실행한다. Windows에서는 `python -X utf8`, Linux에서는 `python3`를 쓴다. POSIX 파일 권한·소유자 검사는 Linux에서 확인한다.

```sh
python3 tools/argon-schedules/docs-io-test.py
python3 tools/argon-schedules/run-check-test.py
python3 tools/argon-schedules/alert-event-test.py
```

## 준비 원본·증거 위치

- 커밋에 보존한 [2026-10-18 검증 요약](verification/20261018.json)은 첫 운영 회차의 실제 모델·실행 시각·Docs SHA, 보관 영수증, 알림 메일 수신 메타데이터와 기존 Linux 시험 14개·9개의 소스 SHA를 담는다. 보고서 본문·인증 토큰·메일 화면 캡처는 포함하지 않는다.
- 복사 원본과 전환 중 증거: `.tmp/argon-isolated-20261017/`의 동일 파일, `production-inputs/`, `production-units/`, `systemd-ultra-prepared/synk-argon-ultra.logrotate`.
- 원본 예약의 CLI 적응 초안: 같은 폴더의 `production-prompts-prepared/`. 실행 지시문은 이 폴더의 `production-inputs/`에 보존한 최신 계약을 사용한다.
- 실제 시계 예약 시험·Docs 대조·검증 실행·최종 활성화 증거는 같은 `.tmp` 폴더의 해당 JSON 기록에 남긴다. 파일 존재와 성공 여부를 각각 확인한다.
- 기존 Docs 본문 백업은 서버의 비공개 `docs-backups/`에 있으며, 앞선 연결 확인 백업은 `docs-backup/`에 있다. 이 저장소에는 본문 백업을 복사하지 않는다.
- 장애 알림 구성·Linux 오프라인 시험(후처리 14개, 알림 9개)·합성 경보·첫 운영 회차 읽기 전용 감사: `.tmp/argon-alerts-20261018/`. 첫 운영 회차 성공 증거는 `first-production-verified.json`에 보존한다. `verify-first-production.cjs`는 예약을 시작하거나 Docs에 쓰지 않는다.

2026-10-18 최초 보존 시점의 복사 대상 22개 파일은 원본의 복사 전·후 SHA-256과 복사본 SHA-256 일치를 확인했다. 22개는 최초 복사 범위이며 이후 알림 소스·설정 예시·증거를 추가한 현재 전체 파일 수가 아니다. 이후 운영 소스를 바꾸면 이 보존본도 같은 변경에 맞춰 갱신한다.
