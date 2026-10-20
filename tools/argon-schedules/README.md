# Argon 예약 운영 소스

2026-10-18 12:12 KST 운영 전환을 마쳤다. 기존 Gemini 예약 4개는 일시중지했고, 서버 타이머 4개는 enabled·active로 확인했다. 전환 뒤 첫 정규 회차인 10-18 14:00 YouTube·TikTok 조사가 실제 타이머로 시작해 Argon 실행과 기존 Google Docs의 새 저장까지 성공했다. 장애 알림 메일 실제 수신도 확인해 요청한 운영 검증 목표를 충족했다. [YouTube·TikTok 결과 문서](https://docs.google.com/document/d/1aYwO_1qBcUs5uzeeRoeePBRo_qkWSFBwjr4Xj-LUXmI/edit), 최신 운영 결과는 [트랙](../../docs/_ops/트랙.md)의 해당 예약 항목과 아래 실행 상태에서 확인한다.

## 2026-10-20 · 저장을 끝낸 뒤 연결이 끊긴 회차를 실패로 치던 것 고침

- **증상.** 10-19 고침 뒤에도 yt-tt 20:00·meta-brand 23:00·yt-tt 10-20 08:00(KST)이 `CLI_FAILED_OR_DENIED`로 실패 메일을 냈다. 거절된 도구는 0개였다.
- **원인.** 세 회차 모두 Argon이 조사·검증·Docs 저장을 끝내고 완료 표식까지 냈는데, 마지막에 모델 API 연결이 끊겨(「The stream was interrupted」·「stream idle timeout (5m0s)」) 공식 CLI가 결과 상태를 `ERROR`로 남겼다. 한 회차는 끊겼다 이어진 흐름의 조각(` Cui`)이 표식 앞줄에 붙었다. `run-check.py`는 상태가 `SUCCESS`가 아니면 문서를 보지 않고 실패로 쳤다. 표식의 문서 SHA가 다음 회차 시작 때(마지막 회차는 지금) 읽은 문서 SHA와 셋 다 같아, 문서는 실제로 갱신돼 있었다.
- **고침(10-20 13:32 KST 서버 반영).** 거절이 하나라도 있으면 여전히 실패다. 상태가 `ERROR`여도 완료 표식(이때만 처음 세 줄 안)이 있고 Docs를 다시 읽은 SHA가 표식과 같으면 `complete`로 치고, `cliStatus`·`cliError`를 상태 파일에, `cliStatus`만 회차 영수증에 남긴다. 「변경 없음」 표식이나 표식 없는 `ERROR`는 그대로 실패다. `SUCCESS` 회차의 「표식은 첫 줄」 규칙은 바꾸지 않았다. 서버 사본은 `/var/backups/synk-argon-config/run-check.py.20261020T043208Z`.
- **확인.** 오프라인 시험 17개(새 3개는 고치기 전 판에서 실패)가 이 PC와 서버 python 양쪽에서 통과했다. 서버 해시 run-check.py `226ef5ee72442f2b`(앞 16자리).

## 2026-10-19 · 권한 빈틈 고침과 월요일 스캔 수집

- **증상과 원인.** 10-18 전환 뒤 6회 가운데 4회(yt-tt 20:00·08:00, meta-brand 23:00, full 05:00 KST)가 `CLI_FAILED_OR_DENIED`였다. Argon이 회차마다 스스로 고른 도구 — 도우미 원문 보기(`view_file /opt/synk-argon-77yuhbs/docs-io.py`)나 임시 `python3 -c` 명령 — 가 허용 목록 밖이라 headless에서 자동 거절됐고, 그 뒤 빈 응답으로 끝났다. `run-check.py`는 거절이 하나라도 있으면 실패로 친다. 타이머·PC·사용량 한도 문제는 아니었다. 상세는 [현장 노트 AI_CLI](../../docs/현장노트/AI_CLI.md).
- **고침(10-19 10:48 KST 적용).** `settings.json` allow에 `read_file(/opt/synk-argon-77yuhbs)` 한 줄(도우미·검증기 원문, 비밀값 없음)만 더했다. 인증 폴더·토큰·설정 읽기 거절은 그대로다(거절이 허용보다 앞선다). 네 지시문 끝에 「도구 규칙」(적힌 docs-io·date 명령만, 페이지는 read_url·view_file로, 거절돼도 결과를 끝까지 저장)을 붙였다. 임시 명령 허용은 넓히지 않았다. 서버 백업 `config-backups/20261019T014821Z`.
- **월요일 스캔 수집 역할 셋.** `scan-lab`(LAB 한국어 학습 쇼츠·학습자 질문·달력 연계·우리 채널 공개 숫자), `scan-ai`(공식 AI 발표·국내 보도·한국어 AI 쇼츠·커뮤니티 질문·제작기 트렌드), `scan-platform`(플랫폼 변화·형식/소리 트렌드·2~6주 달력). 지시문은 `weekly-scan-prompts.py`가 `production-inputs/scan-*.{prompt.txt,input.jsonl}`로 만든다. 결과는 unmet23의 새 문서 셋(`configuration/docs.json`)에 JSON 한 개 + 마지막 줄 `SYNK_WEEKLY_SCAN_COMPLETE`로 저장한다. `docs-io.py validate_weekly`는 모양(역할·주간 날짜·항목의 제목/주소/출처 종류)만 검사하고 회사 앱 검증기는 쓰지 않는다. 내용 사실은 월요일 Claude 검수가 다시 확인한다.
- **읽는 통로.** PC의 `node tools/argon-schedules/scan-read.cjs`가 GCE API로 standby의 지금 주소를 읽고, `~/.ssh/known_hosts_synk_argon`(별칭 `synk-argon-standby`)에 고정한 호스트 키로 SSH에 붙어 `docs-io.py read`와 회차 상태만 가져온다. 결과는 `.tmp/weekly-scan/<날짜>/`. 크롬 확장이나 Google Drive 연결 없이 읽는다. SSH가 막히면(이 PC 공인 IP가 허용 목록 밖) 출력에 문서의 `/mobilebasic` 읽기 주소가 나온다.
- **Claude 쪽.** 월요일 09:30 데스크톱 예약 `synk-monday-trend-scan-2`(부하 분산 지연으로 실제 09:44, 우회 권한 모드로 저장)가 위 도구로 원자료를 읽고 검수해 `docs/마케팅/트렌드스캔/<월요일>.md`를 쓴다. 데스크톱 예약은 PC가 깨어 있고 앱이 켜져 있어야 돌며, 놓치면 켜질 때 한 번 따라 돈다(공식 문서).
- **확인(10-19).** 고친 뒤 첫 회차 meta-brand 11:00 KST가 complete·거절 0이었다. yt-tt 14:00 정규 회차도 complete·거절 0(14:00~14:14, 문서 35,582자·완료 표식)이다. 배포 뒤 서버 시험 24/24·systemd verify·logrotate가 통과했고, 서버 해시는 docs-io.py `f8dc64a2469ab62c`·run-check.py `6760fa8e01b1c520`·alert-event.py `50f8400c270a5d3f`·docs.json `0d07ca0e5793c4a8`(앞 16자리)다. scan-lab을 손으로 한 번 돌렸다(`systemctl start --no-block`, 11:21~11:46 KST). 결과는 complete·`gemini-4-argon-high`·거절 0, 항목 43개(5구역), 문서 46,048자, 끝줄 완료 표식이었다. PC `scan-read.cjs`로도 이번 주(weekOf 2026-10-19) 자료로 읽혔다. 영상 항목 3개는 공개 oEmbed 제목과 맞았다. 같은 날 scan-ai(14:14~14:35, 항목 35, 문서 26,559자)와 scan-platform(14:36~14:54, 항목 21, 문서 16,632자)도 손으로 돌렸다. 정규 회차와 겹치지 않게 yt-tt가 끝난 뒤 하나씩 돌렸고, 둘 다 complete·거절 0·완료 표식이었다. 이어 `scan-read.cjs`로 세 역할 모두 이번 주 자료로 읽혔다(종료 코드 0).
- **실패 메일(10-19 14:07).** 전용 Cloud Monitoring 정책 `8330051917313971027`의 조건이 `full|yt-tt|meta-brand|synkbrief`만 걸러, 새 셋이 실패해도 기록만 남고 메일이 오지 않았다. 조건의 역할 목록에만 `scan-lab|scan-ai|scan-platform`을 더했다. 채널(unmet27 메일), 문서, 묶음 간격, 조건 이름은 그대로다. 바꾸기 전후 정책과 대조 결과는 `.tmp/argon-alerts-20261019/`에 있다. 10-18 03:00Z 뒤의 실패 기록은 넓히기 전과 같은 6건(합성 시험 2·실제 실패 4)이 잡혔다. 다시 읽을 때 `labelExtractors` 칸 순서가 바뀌어 돌아오니, 비교는 키를 정렬해서 한다.

## 계정 기준

2026-10-18 사용자 확정: 예약을 포함한 모든 아르곤 실행은 `77yuhbs@gmail.com` Ultra, 업무 문서 저장은 `unmet23@gmail.com`으로 통일한다. 상위 기준은 [AI 운영 원칙](../../docs/AI_운영원칙.md#역할)이다. PC의 웹·앱·CLI에서도 아르곤 작업을 시작할 때 실제 실행 계정을 확인한다. unmet23의 Argon 권한 해결·실행 계정 이전은 현재 후속 작업에서 종료했다.

## 실행 구조

- Linux systemd가 **공식 Antigravity CLI `agy`를 직접 실행**한다. 고정 모델은 `gemini-4-argon-high`, 실행 구독은 `77yuhbs@gmail.com`의 Ultra 계정이다. 다른 모델이나 유료 API로 자동 대체하지 않는다.
- `docs-io.py`는 Google Workspace CLI(`gws`)를 통한 지정 Google Docs의 읽기·백업·revision 충돌 방지·쓰기·본문 재읽기만 처리한다. `snapshot`은 본문을 비공개 작업 파일로 저장하고 짧은 메타데이터를 반환한다. 설치한 `gws` 0.22.5는 자체 버전 출력에 Google의 공식 지원 제품이 아니라고 명시한다. 공식 Antigravity CLI `agy`의 지원 상태와 혼동하지 않는다.
- 10-18 15:29 보완: 창작 조사 3종의 `validate`와 `write`는 실제 회사 앱에서 가져온 엄격한 `validateResearchReport`를 먼저 실행한다. `/opt/synk-argon-77yuhbs/report-contract/`의 두 회사 모듈·`validate-report.mjs`·SHA manifest가 한 세트다. 77yuhbs 모델 계정과 unmet23 Docs 계정은 그대로이며 새 모델·LLM 호출은 없다. 검사 실패는 기존 Doc에 쓰기 전에 멈추고, producer는 같은 조사 시각·근거를 유지한 로컬 형식 교정만 할 수 있다.
- `run-check.py`는 시작 시 Docs 기준 해시를 보존하고, 종료 시 실제 모델·대화 ID·도구 거절 여부·완료 표식·Docs 재읽기 해시를 대조한다. 두 Python 파일은 LLM을 실행하지 않는다.
- 종료 영수증은 `run-status/history/ROLE-INVOCATION_ID.json`에도 0600으로 보관한다. 다음 회차가 최신 상태를 바꿔도 실행 시각·실제 모델·문서 해시를 확인할 수 있고, 영수증에는 보고서 본문과 revision을 넣지 않는다.
- 원격 로그와 상태는 실행 사용자 전용이다. 공용 잠금으로 실행 중복을 거절하고, systemd는 자동 재시작하지 않는다. 실패한 쓰기를 결과 확인 없이 다시 실행하지 않는다.
- 인증 토큰·OAuth 비밀값·실제 계정 설정·백업 본문·실행 로그는 이 폴더에 포함하지 않는다. PC 앱 로그인과 예약 서버의 OS 사용자는 분리되어 있다.

## 보존 파일

| 파일 | 서버 배치 위치/용도 |
|---|---|
| `docs-io.py`, `run-check.py` | `/opt/synk-argon-77yuhbs/`, root 소유 0755 |
| `docs-io-test.py`, `run-check-test.py` | 가짜 Docs 응답과 임시 파일만 사용하는 오프라인 시험 |
| `validate-report.mjs`, `validate-report.test.mjs` | 저장 전 회사 v1 스키마와 담당 source 범위를 검사한다. 서버 entrypoint는 `report-contract/validate-report.mjs`; 실제 앱에서 추출한 `creative-research.mjs`·`organization.mjs`와 세 파일 SHA를 담은 `manifest.json`을 함께 배치한다. |
| `production-units/` | `/etc/systemd/system/`의 7개 service·7개 timer(10-19 월요일 스캔 셋 추가)·공용 slice, root 소유 0644 |
| `production-inputs/*.input.jsonl` | `/var/lib/synk-argon-77yuhbs/prompts/`, 실행 사용자 소유 0600; 공식 CLI의 user event 한 줄 |
| `production-inputs/*.prompt.txt` | 같은 지시문의 사람이 읽을 수 있는 원문 |
| `synk-argon-ultra.logrotate` | `/etc/logrotate.d/synk-argon-ultra`, root 소유 0644; 실행·후처리 중에는 회전하지 않음 |
| `alert-event.py`, `alert-event-test.py` | `/opt/synk-argon-77yuhbs/`, 오류 고정 코드 전송·비공개 outbox·전송 ack·오프라인 시험 |
| `alert-units/` | `/etc/systemd/system/`, OnFailure 처리·5분 재전송·수동 합성 시험 unit |
| `production-dropins/50-failure-alert.conf` | 7개 운영 `synk-argon-ultra-ROLE.service.d/`, 공통 OnFailure 연결 |
| `alert-policy.json` | 전용 Cloud Monitoring 정책 원문. 같은 이름·ID의 기존 정책을 먼저 조회하고 중복 생성하지 않음 |
| `configuration/docs.json` | `/etc/synk-argon-77yuhbs/docs.json`, root 소유 0644; 승인된 7개 역할의 문서 ID(10-19 월요일 스캔 셋 추가). `docs-io.py`의 역할 목록, 예비 노드 서버 백업의 `tools/server-backup/argon-capture.py`(`EXPECTED_DOCS`)와 정확히 같아야 하므로 셋은 함께 바꾸고 서버에도 함께 넣는다. 서버 백업 쪽 어긋남은 `node --test tools/server-backup/backup.test.cjs`가 잡는다(10-20 이 셋째를 빠뜨려 07:11 서버 백업이 실패했다). PC 매일 백업의 `Argon백업.js`는 이 파일을 직접 읽는다 |
| `weekly-scan-prompts.py` | 월요일 스캔 세 역할의 지시문 생성기(저장소에서만 실행, LLM 호출 없음) |
| `scan-read.cjs` | PC에서 월요일 스캔 결과를 읽는 도구(읽기 전용, SSH) |
| `configuration/agy-settings.example.json` | 아래 복원 설명에 따라 별도 HOME의 `settings.json`에 반영하는 비밀값 없는 설정 예시 |

예약 시각은 모두 `Asia/Seoul`이다. `Persistent=false`라 서버 중단 중 놓친 실행을 재부팅 때 몰아서 실행하지 않는다.

| 역할 | 예약 시각 |
|---|---|
| `full` | 매일 05:00 |
| `yt-tt` | 매일 08:00·14:00·20:00 |
| `meta-brand` | 매일 11:00·17:00·23:00 |
| `synkbrief` | 월·수·금 09:00 |
| `scan-lab` | 월 01:00 (월요일 스캔 수집, 10-19 추가) |
| `scan-ai` | 월 02:00 (월요일 스캔 수집, 10-19 추가) |
| `scan-platform` | 월 03:00 (월요일 스캔 수집, 10-19 추가) |

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

1. 기존 서버의 상태·파일 해시·실행 중 작업부터 확인하고 필요한 원본을 보존한다. 복원 대상의 7개 timer를 `systemctl disable --now`로 비활성화하고, 실행 중 service는 종료 상태를 확인한다. readiness 파일 `/etc/synk-argon-77yuhbs/production-ready`는 복원 대상에서 보존용 위치로 옮겨 실행 조건을 해제한다. 이 파일을 새로 만들지 않는다.
2. 기존 `synk-argon-ultra` OS 사용자·그룹, `/var/lib/synk-argon-77yuhbs` 0700 HOME과 `work`·`prompts`·`logs`·`run-status`를 확인한다. 빈 로그 14개(7역할의 stream·stderr)도 실행 사용자 소유 0600으로 먼저 준비한다. systemd가 먼저 만들면 root 소유가 되어 후처리 읽기가 실패할 수 있다.
3. 공식 Antigravity CLI·Google Workspace CLI 설치와 승인된 별도 계정 인증, Docs API 활성화를 확인한다. 문서 매핑은 `configuration/docs.json`, 비밀값 없는 실행 설정은 아래 예시를 사용한다. 자격증명을 이 저장소에 넣지 않는다. `useG1Credits=false`와 유료 API 공급자 설정 없음, 정확한 helper 명령·작업 경로 권한, 인증 파일 읽기 거절을 확인한다.
4. 위 표의 경로·소유권·권한으로 소스를 배치하고 SHA-256을 대조한다. 공식 실행 파일 경로는 unit과 일치해야 한다. 이 폴더에는 설치기나 별도 LLM 실행기가 없다.
   창작 조사용 `report-contract/`는 서버 암호화 복원 사본의 네 파일을 함께 복원한다. 디렉터리 root:root 0755, 파일 root:root 0644이며 manifest의 크기·SHA가 하나라도 다르면 검증기가 중단한다. 앱 스키마를 배포로 바꿨다면 활성 앱의 두 모듈과 source SHA를 다시 대조한 계약 묶음으로 갱신하고 단독 사본을 임의 편집하지 않는다. 검증용 Node는 `/opt/synk-argon-77yuhbs/bin/node`이다. 10-18에는 기존 HA 실행용 v24.21.0 바이너리(sha256 `7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c`)를 그대로 복사해 root:root 0755로 설치했다. HA 보안 폴더의 권한을 완화하지 않는다. `runuser -u synk-argon-ultra -- …/bin/node --version`과 `docs-io.py validate ROLE CONTENT_FILE`을 비활성 복원 상태에서 확인한다.
5. `systemd-analyze verify /etc/systemd/system/synk-argon-ultra-*.service /etc/systemd/system/synk-argon-ultra-*.timer /etc/systemd/system/synk-argon-ultra.slice`와 `logrotate --debug /etc/logrotate.d/synk-argon-ultra`로 확인한 뒤 `systemctl daemon-reload`한다. 7개 timer가 계속 disabled이고 readiness 파일이 없는지 다시 확인한다.
6. 활성화는 별도 실제 실행 검증, Docs 재읽기·모델 확인, 기존 Gemini 예약 4개 일시중지 확인을 마친 후 운영 전환으로 수행한다. 비활성 복원 자체가 예약 활성화를 뜻하지 않는다.

장애 알림을 복구할 때는 기존 전용 정책과 이메일 채널의 현재 상태를 읽는다. 서버 서비스 계정의 `roles/logging.logWriter`, root 소유 알림 소스·unit, 7개 service drop-in, root 0700 outbox·ack를 대조한 뒤 drain timer를 켠다. 정책 조건의 역할 목록(`alert-policy.json`)도 7역할 + `alert-test`인지 본다(10-19에 월요일 스캔 셋을 더함). 합성 시험은 수동으로 한 번만 시작하며 운영 조사나 문서를 바꾸지 않는다. Cloud Logging 기록과 실제 이메일 수신을 각각 확인한다. 계정 키 파일과 별도 Ops Agent는 필요하지 않다.

### 비밀값 없는 설정 복원

`configuration/agy-settings.example.json`은 10-18 설치·권한 보정 스크립트가 추가한 규칙과 비용 설정을 모은 복원 예시다. 서버의 현재 전체 `settings.json`을 내보낸 파일이 아니며, 현재 서버 파일과의 해시 일치를 주장하지 않는다. 실제 계정 설정·인증 토큰·실행 본문은 포함하지 않는다.

| 대상 | 경로·소유권·권한 |
|---|---|
| 별도 HOME과 작업 디렉터리 | `/var/lib/synk-argon-77yuhbs`와 `work`·`prompts`·`logs`·`run-status`·`.gemini`·`.gemini/antigravity-cli`·`.gemini/config`·`.config`·`.config/gws-docs`는 `synk-argon-ultra:synk-argon-ultra`, 0700 |
| agy 설정 | `/var/lib/synk-argon-77yuhbs/.gemini/antigravity-cli/settings.json`, `synk-argon-ultra:synk-argon-ultra`, 0600 |
| Docs 매핑 디렉터리·파일 | `/etc/synk-argon-77yuhbs`는 `root:root`, 0755; 그 안 `docs.json`은 `root:root`, 0644 |
| 생성되는 계정 인증 파일 | 위 별도 HOME의 승인된 인증 경로에만 보관하고 실행 사용자 소유 0600으로 확인한다. 저장소에 복사하지 않는다. |

- 예시는 `useG1Credits: false`와 실제 추가된 `permissions.allow`·`permissions.deny`만 담는다. `modelProvider`는 넣지 않았다. 기존 설정이 있다면 먼저 보호된 위치에 보존하고 해당 항목을 대조해 반영한다. 계정 인증이나 다른 설정을 통째로 덮어쓰는 파일로 사용하지 않는다.
- allow에는 UTC 시각, 지정 helper의 역할별 read/snapshot/write, 창작 3역할과 월요일 스캔 3역할의 고정 result 파일에 대한 validate, 작업 폴더 쓰기, 공개 URL 읽기, 도우미 폴더 원문 보기 `read_file(/opt/synk-argon-77yuhbs)`(10-19)와 `gws --version`만 둔다. `validate`는 네트워크와 Docs 쓰기 없이 입력 형식만 확인한다. `read_url(*)`는 당시 공개 원문 읽기 오류를 고친 규칙이다. 셸 명령 전체 허용이나 대화형 브라우저 권한을 뜻하지 않는다. deny에는 Docs 인증 폴더·agy 토큰·agy 설정 파일 읽기 거절을 유지한다.
- 전역 `/var/lib/synk-argon-77yuhbs/.gemini/config/user_config.json`의 `use_ai_credits`가 없거나 false인지도 별도로 확인한다. 기존 `modelProvider`가 있거나 전역 크레딧이 true이면 활성화하지 않고 승인된 구독 경로를 먼저 확인한다. 모델은 예시 설정의 추정값 대신 각 service의 `--model gemini-4-argon-high`로 고정한다.
- 실행 계정은 77yuhbs, Docs 저장 계정은 unmet23이다. 인증은 별도 HOME에서 Antigravity 공식 CLI 로그인과 `gws auth login`의 기존 승인된 OAuth 흐름으로 각각 진행한다. PC 앱 로그인·브라우저 기본 계정은 바꾸지 않는다. 새 권한이 필요하면 기존 승인 범위를 확인하고, 예시 파일만 복사해 인증 완료로 보고하지 않는다.
- `configuration/docs.json`의 7개 ID는 최초 helper 설치의 승인 매핑(4개)과 10-19에 unmet23로 새로 만든 월요일 스캔 문서 3개이며, 각 역할 프롬프트에 맞춘 값이다. 복원 대상의 기존 매핑·문서 접근을 대조하고, 새 문서나 대체 writer를 만들지 않는다. 알림 helper의 `RUN_UID=994`도 기존 실행 사용자 UID와 일치해야 한다.

예시의 근거는 `.tmp/argon-isolated-20261017/`의 `allow-readiness-probe.cjs`, `install-production-prepared.cjs`, `allow-research-reading.cjs`, `finalize-delivery-contract.cjs`, `install-docs-io.cjs`다. 비용 설정의 마지막 로컬 증거 `no-paid-credits-final-20261018.json`은 `useG1Credits=false`, 전역 크레딧 비활성, API 공급자 없음으로 기록됐다. 이 설명과 예시 파일만으로 서버를 활성화하거나 새 실행을 시작하지 않는다.

오프라인 회귀 시험은 저장소 루트에서 실행한다. Windows에서는 `python -X utf8`, Linux에서는 `python3`를 쓴다. POSIX 파일 권한·소유자 검사는 Linux에서 확인한다.

```sh
python3 tools/argon-schedules/docs-io-test.py
python3 tools/argon-schedules/run-check-test.py
python3 tools/argon-schedules/alert-event-test.py
node --test tools/argon-schedules/validate-report.test.mjs
```

### 10-18 보고서 가져오기 형식 교정

14시 `yt-tt`는 공식 CLI와 Docs 저장에는 성공했지만, `platform/sourceKind`·최상위 `brandPlaybooks` 등 새 키를 만든 결과가 엄격한 회사 v1 형식에 맞지 않아 `SYNC_REPORT_INVALID`로 거절됐다. 기존 helper는 최소 헤더만 확인하던 탓에 이를 쓰기 전에 막지 못했다. 회사 validator는 완화하지 않았다.

15:31:31 같은 Doc에 교정본을 한 번 저장하고 revision과 재읽기 SHA를 확인했다. 원본 65,939바이트와 새 제작 가이드 초안은 서버의 비공개 `docs-backups/`에 보존했다. 실제 조사·확인 시각, 보고서 ID, 원문 주소와 관측 수치를 유지한 7개 페이지 관찰만 v1 형식으로 옮겼다. 개별 광고 정보 없이 공통 헤더만 읽힌 1개는 제외했고, 재생하지 않은 화면·타이밍 해석과 미확인 서비스 제안은 신규 가이드로 반영하지 않았다. **15:33:22.944 회사 자동 가져오기 성공: 관찰 7개 접수(신규2·갱신5), 보류0, 신규 가이드0. 기존 5개 가이드·직원 메모·ID·공유 범위의 보호 필드 SHA가 모두 같고 다음 읽기에서도 보고서는 1개만 존재했다. 세 source 모두 imported/error 없음이다.** 제외 목록·필드 대응·원문/교정본 해시는 `.tmp/backup-remaining-20261018/research/projection-prepared.json`, 실제 저장은 `projection-written.json`, 회사 자동 가져오기와 기존 가이드·메모 보존은 `import-final-proof.json`에서 구분해 확인한다. 새 예약 회차의 전체 조사 품질을 이번 형식 교정만으로 확인했다고 하지 않는다.

## 준비 원본·증거 위치

- 커밋에 보존한 [2026-10-18 검증 요약](verification/20261018.json)은 첫 운영 회차의 실제 모델·실행 시각·Docs SHA, 보관 영수증, 알림 메일 수신 메타데이터와 기존 Linux 시험 14개·9개의 소스 SHA를 담는다. 보고서 본문·인증 토큰·메일 화면 캡처는 포함하지 않는다.
- 복사 원본과 전환 중 증거: `.tmp/argon-isolated-20261017/`의 동일 파일, `production-inputs/`, `production-units/`, `systemd-ultra-prepared/synk-argon-ultra.logrotate`.
- 원본 예약의 CLI 적응 초안: 같은 폴더의 `production-prompts-prepared/`. 실행 지시문은 이 폴더의 `production-inputs/`에 보존한 최신 계약을 사용한다.
- 실제 시계 예약 시험·Docs 대조·검증 실행·최종 활성화 증거는 같은 `.tmp` 폴더의 해당 JSON 기록에 남긴다. 파일 존재와 성공 여부를 각각 확인한다.
- 기존 Docs 본문 백업은 서버의 비공개 `docs-backups/`에 있으며, 앞선 연결 확인 백업은 `docs-backup/`에 있다. 이 저장소에는 본문 백업을 복사하지 않는다.
- 장애 알림 구성·Linux 오프라인 시험(후처리 14개, 알림 9개)·합성 경보·첫 운영 회차 읽기 전용 감사: `.tmp/argon-alerts-20261018/`. 첫 운영 회차 성공 증거는 `first-production-verified.json`에 보존한다. `verify-first-production.cjs`는 예약을 시작하거나 Docs에 쓰지 않는다.

2026-10-18 최초 보존 시점의 복사 대상 22개 파일은 원본의 복사 전·후 SHA-256과 복사본 SHA-256 일치를 확인했다. 22개는 최초 복사 범위이며 이후 알림 소스·설정 예시·증거를 추가한 현재 전체 파일 수가 아니다. 이후 운영 소스를 바꾸면 이 보존본도 같은 변경에 맞춰 갱신한다.
