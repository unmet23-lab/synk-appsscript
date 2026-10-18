# 휴대폰 SYNK 작업 연결

기존 Hermes 텔레그램 팁 봇을 유지하면서 **자료 → 적용, 요청 → 완료, 오늘 확인** 세 흐름으로 연결한다. 역할·비용·배포·게시 권한은 [AI 운영 원칙](../../docs/AI_운영원칙.md), 팁의 원래 절차는 [참고 카드](../../docs/참고카드/README.md)를 따른다. 상태 조회와 결과 전달에는 별도 AI 요약을 붙이지 않는다.

## 사용

등록된 사용자와 봇의 텔레그램 개인 대화에서 요청한다.

- `SYNK 오늘 확인할 것 알려줘`
- `백엔드 상태 알려줘`
- `클로드한테 WORLD 첫 화면의 다음 개선점을 검토해 달라고 해줘`
- `코덱스한테 백엔드 관련 시험 실패 원인을 확인해 달라고 해줘`
- `팁 장부 7행 적용해줘`
- `맡긴 작업 결과 알려줘`

자연어 요청은 기존 접수 GPT가 구분한다. 코드 작업은 문서 지도·파일 목록에서 대상 경로를 확인한 뒤 필요한 저장소 상대 경로를 `scope`로 전달한다. 사용자가 경로를 직접 외울 필요는 없다. 필요한 범위가 확인되지 않으면 파일이 없는 상태로 작업을 완료했다고 하지 않는다.

직접 명령은 접수 GPT를 호출하지 않는다.

| 명령 | 동작 |
|---|---|
| `/synk` | 사용법 |
| `/synk_today` | 팁·맡긴 일·판단 대기·명시한 기한·기존 조사 결과를 함께 조회 |
| `/synk_status 백엔드` | 트랙·카드 기록과 실행 메타데이터 조회 |
| `/synk_claude <요청>` | 새 공식 Claude Code CLI 세션에 요청 |
| `/synk_codex <요청>` | 새 공식 Codex CLI 세션에 요청 |
| `/synk_tasks [작업ID]` | 이 연결에서 맡긴 작업의 실행 상태 |
| `/synk_release <작업ID> 종료확인` | PC에서 종료를 확인한 미확인 작업의 접수 잠금 정리 |
| `/synk_recover` | 미전달 결과의 확인·전달 재개. 작업을 새로 실행하지 않음 |

직접 코드 작업을 맡길 때는 다음 형식으로 범위를 지정할 수 있다. 공백이 있는 경로는 따옴표로 감싼다.

```text
/synk_claude --scope 상대/파일.md 상대/폴더 -- 요청
/synk_codex --scope 상대/파일.js 상대/시험.test.js -- 요청
```

명시한 상대 파일명도 범위로 인식한다. 범위를 생략한 직접 명령은 기본 문서 조회 범위만 준비하므로 코드 작업은 자연어로 맡겨 경로를 구체화하거나 `--scope`를 사용한다. 누락된 코드·검사·의존성이 있으면 범위를 임의로 넓히지 않고 필요한 경로를 알린다.

## 자료 → 적용

- 링크·사진·영상만 공유하면 기존 `synk-tip-review`가 받기·재료 정리·장부 기록을 맡는다. 공유한 자료를 실행 지시로 취급하지 않는다. 기존 Claude 09:00·21:00 적용안 검토는 유지한다.
- 적용 상태는 `docs/참고카드/카드/*.md`의 원문을 우선한다. 장부의 수동 상태를 덮어쓰지 않는다. 10-18 감사에서는 장부 6행이 모두 `새로`였고 카드 2장은 `적용함`이었다. 개요는 이 불일치를 보여 주며 자동 수정하지 않는다. `적용함` 기록과 실제 배포·사용자 효과는 구분한다.
- Argon은 [기존 예약과 결과 문서](../argon-schedules/README.md)를 재사용한다. 개요 갱신은 기존 SSH 핀·인증으로 지정 서버의 4역할 후처리 영수증과 systemd 상태만 읽는다. 새 조사·문서 쓰기·예약 실행·로그인·토큰 본문 조회는 하지 않는다. 서버의 완료 영수증 조회는 Docs 본문과 회사 가져오기의 현재 상태를 다시 검증한 결과가 아니다.
- `overview.cjs` 기본 조회는 로컬 사본만 읽는다. `--refresh`에서 장부 `recent 50`과 Argon 4역할을 읽기 전용으로 갱신한다. 마지막 성공 사본의 유효 기간은 6시간이며, 갱신 실패 시 기존 사본과 확인 시각을 보존하고 오래됨·미확인을 표시한다. 장부 50행 상한과 읽지 못한 범위를 전체 조회로 보고하지 않는다.
- `status.cjs`는 기존 운영 홈의 원문 parser·Claude 공식 조회를 재사용한다. 전체 변경 비교용 snapshot을 제공하며, Codex 운영 홈 사본이 없거나 오래되면 미확인으로 표시한다. 읽지 못한 기록이 사라졌다는 이유로 삭제·완료라고 판정하지 않는다. 개인 대화·세션·인증값은 개요에서 제외한다.

## 요청 → 완료

- 같은 수신 메시지는 중복 실행하지 않는다. 한 번에 하나의 휴대폰 작업을 시작하며, 진행 중이거나 실행 상태가 미확인인 일이 있으면 새 요청을 보류한다. 다른 앱의 작업을 강제로 잠그거나 종료하지 않는다.
- 대상은 기존 `SYNK-appsscript`, `SYNK-talk`, `SYNK-website` 중 요청한 저장소 하나다. 접수 시 지정 범위의 현재 수정본·삭제·안전한 미추적 소스를 담은 별도 detached sparse Git worktree를 만든다. 공식 CLI는 이 작업본에서 실행한다. 10-18 추가 승인 이후 새 요청에는 `auto_verified_v1`을 기록하고, 작업 종료 뒤 최신 원본과 합친 후보를 검증해 통과한 변경만 원본 작업 파일에 자동 반영한다. 기존 종료 작업에는 소급 적용하지 않는다. 원본 Git HEAD·인덱스·가지·설정은 보존한다.
- 범위 밖 파일·비밀파일·의존성·생성 미디어를 임의로 복사하지 않는다. 준비 중 `SOURCE_CHANGED`는 작업본 생성 전일 때만 같은 잠금·총 150초 안에서 최초 포함 최대 3회 다시 캡처한다. 각 실패 근거는 보존한다. 이미 만든 작업본·잠금·다른 안전 검사·용량 문제는 자동 재시도하지 않으며 준비 실패를 원본 직접 작업으로 우회하지 않는다. 기준 원문·작업 결과·최신 원본을 3방향으로 합치며, 겹치는 변경이나 검증 후 원본 변경은 보류한다.
- 자동 반영은 공식 CLI의 정상 종료와 구조화된 완료 보고, 실제 검사 결과가 모두 있어야 한다. CLI는 종료 전에 `validation-preview.cjs`로 검사하고 같은 공식 세션 안에서 일반 오류를 수정한다. 종료 뒤 최신 원본과 합친 후보를 `multi_language_v2` 계약으로 다시 검증한다. 작업을 밖에서 재실행하거나 다른 모델에 검수를 반복시키지 않는다. 사전 검사는 최종 영수증·원본을 쓰지 않으며 `.tmp/synk-validation-preview`에만 근거를 남긴다.
- Markdown·텍스트 무결성, JavaScript 문법·관련 Node 시험·변경줄 실행, TypeScript/TSX 타입 검사·격리 emit·관련 시험·원문 줄 실행, Python 문법·실제 unittest/기존 pytest·변경 실행줄, JSON의 strict schema·변경값 소비 시험, HTML/CSS의 실제 Chrome PC·모바일 화면 검사를 지원한다. 시험 실패·누락·건너뛰기·실행 증거 부족은 보류한다. 운영 지침·의존성 설정 변경, 삭제, 미지원 실행 환경은 판단 대기로 남긴다. 화면 검사는 명시된 DOM·스타일·동작과 오류·가로 넘침을 확인하며 미감·사용자 효과·배포 성공을 대신하지 않는다.
- Windows의 같은 열린 파일 핸들로 원본을 잠그고 다시 읽어 대조한 뒤 쓴다. 다른 쓰기·교체와 충돌하면 보류한다. 원본 백업과 쓰기 영수증을 작업 폴더에 남기며, 재시작 때 이미 통합한 결과를 다시 쓰지 않는다. 중간 상태를 확정할 수 없으면 후속 변경을 덮는 자동 복원 대신 판단 대기로 남긴다.
- 보관 작업본 8개 또는 기존 보관량과 새 원본 소스 두 벌의 합산 추정량이 512MiB에 닿으면 `WORKSPACE_CAPACITY_REVIEW`로 새 준비를 보류한다. 이 입장 추정에는 새 메타데이터·줄끝 확장량이 포함되지 않으므로 디스크 전체의 절대 상한은 아니다. 이전 결과를 자동 삭제하지 않는다. 개별 소스·전체 파일 수·준비 용량 제한도 적용한다.
- Claude는 기존 구독 로그인·모델·추론 설정과 공식 auto 모드를, Codex는 기존 구독 로그인·모델·추론 설정과 workspace-write·공식 MXC Windows 샌드박스를 유지한다. API 인증 환경변수는 상속하지 않는다. 인증·구독 한도 실패를 다른 계정·모델·유료 API로 자동 우회하지 않는다.
- 사용자 요청은 파일의 표준입력으로 전달하고 셸 명령에 넣지 않는다. CLI stdout·stderr와 원자적인 종료 표식을 작업 폴더에 보관한다. 결과 감시는 마지막 공식 응답과 오류·한도를 읽고 검증·통합 도구를 고정 인자로 실행한다. `native-result.json`·`validation.json`·`integration.json`·`result.txt`·`delivery.json`은 실행·검증·원본 반영·저장·알림을 구분한다. 정상 통합과 변경 없음은 `suppressed_success`로 기록하고 Telegram을 보내지 않는다. 판단이 필요한 결과만 추가 GPT 호출 없이 한 번 전달한다.
- 게이트웨이 재시작 뒤에는 기존 결과 확인을 재개한다. 구형 작업은 보존된 출력·영수증이 없을 수 있으므로 미확인으로 남긴다. 종료한 구형 기록에 전송 영수증이 없으면 `전달 영수증 없음`으로 표시하며 현재 전달 대기로 해석하지 않는다.
- Telegram 전송 결과가 불명확하면 이미 도착했을 가능성을 고려해 자동 재전송하지 않는다. 저장된 결과는 `/synk_tasks <작업ID>`에서 확인한다. 접수 잠금 정리는 사용자가 실제 종료를 확인한 경우에만 하며, 프로세스를 종료하거나 작업을 재실행하는 기능이 아니다.
- 마감은 사용자가 명시한 `due_at`과 `due_source: user`만 사용한다. 시간대가 포함된 ISO 시각이어야 하며 문서 작성일·과거 메모로 마감을 추정하지 않는다. 승인 대기도 명시된 대기 근거만 표시한다. 이미 전사되어 들어온 음성은 같은 요청 흐름을 쓰며 음성 전용 수집 성공을 보장하지 않는다.
- 요청 접수는 배포·push·공개 게시·외부 발송·결제·삭제 권한을 추가하지 않는다. 사용자가 이번에 승인한 범위만 실행한다.

## 자동 검증 선언

검사 선언은 `.synk-completion.json`의 `checks`에 `node_test`, `typescript`, `json_schema`, `python_unittest`, `python_pytest`, `browser` 중 해당 항목을 적는다. TypeScript는 `path`에 tsconfig, `tests`에 emit된 `.js/.mjs/.cjs`를 상대 import하는 Node 시험을 적는다. JSON은 `path`·`schema`·`tests`가 필요하고 기존 데이터의 스키마를 함께 약화하면 보류한다. Python은 실제 unittest 또는 이미 설치된 pytest 환경이 있어야 한다. 새 패키지를 자동 설치하지 않는다.

`browser`는 `path`의 정적 HTML과 `steps`의 `assert_visible`, `assert_text`, `assert_style`, `assert_count`, `click`, `fill`만 실행한다. 1440×1000·390×844에서 각각 실제 Chrome을 사용하며 `viewport: desktop/mobile`로 반응형 기대값을 나눌 수 있다. CSS는 변경 선언마다 같은 selector/property의 단언과 해당 선언을 잠시 뺄 때의 계산 스타일 변화가 필요하다. 미사용 규칙·속성, 삭제·중복·shorthand·해석이 모호한 조건은 자동 통과하지 않는다. 외부 네트워크·다른 로컬 서버·로그인이 필요한 화면과 주관적 디자인 판단은 이 정적 검사 범위 밖이다.

TypeScript의 컴파일·실행 의존성은 링크 없이 필요한 패키지의 제한된 사본으로 만들며, 테스트 중 사본 변경도 실패로 처리한다. 복사 한도나 동적 의존성을 확정하지 못하면 `TYPESCRIPT_DEPENDENCY_ISOLATION_REQUIRED`로 보존한다. 타입 전용 변경·project references·미지원 schema·관찰할 수 없는 JSON 소비 방식 등도 검증 근거가 충분하지 않으면 보류한다. 기존 JSON 스키마 비교는 CRLF/LF만 같게 보고 내용·공백·제약 변경은 계속 보류한다. Chrome에는 경계·용량 검사를 통과한 후보 바이트를 Playwright 제어 통로로 공급하며 외부 통신 차단을 유지한다. 일반 수정·검사 오류는 공식 세션의 사전 검사에서 해결하고, 남은 판단·권한·검증 환경 문제가 있을 때만 텔레그램으로 알린다.

## 오늘 확인

`monitor.cjs`와 `automation.py`는 Hermes 공식 **no_agent 예약 하나**(`synk-three-flows`)에서 5분마다 실행하는 AI 없는 수집·전달 코드다. 자체 LLM 실행기·별도 스케줄러·중복 서버를 추가하지 않는다.

- 최초 실행은 현재 상태를 기준선으로 저장하며 과거 항목을 한꺼번에 알리지 않는다.
- 10-18 추가 요청에 따라 매일 요약과 정상 진행·완료 알림을 끄고 `attention_only_v1`을 적용한다. 기존 미발송 하루 요약도 원문을 남기고 발송을 억제한다. 자료·진행·정상 완료는 `/synk_today`와 작업 결과 질문으로 조회한다. 기존 팁 봇의 받기·검토·답장은 유지한다.
- 충돌·검증 미완료·인증·구독 한도·명시한 기한 등 사용자의 판단이나 조치가 필요한 새 사건만 알린다. 이미 직접 알린 사건을 수집기가 다시 보내지 않으며, 같은 문제의 시각만 바뀌어도 새 알림을 만들지 않는다. 해소된 뒤 재발하면 별도 사건으로 기록한다.
- 최초·한 시간 경과 때 장부와 Argon 영수증을 읽고 나머지는 로컬 사본을 사용한다. 원격 쓰기나 새 모델 호출은 없다.
- 알림은 로컬 outbox·전송 의도·API 수신 확인을 따로 보관한다. 전송 결과가 불명확하면 자동 재전송하지 않으며 같은 알림 ID를 반복 발송하지 않는다. Python 발송부도 `needs_attention: true`가 없는 알림을 보내지 않는다.
- 선택된 기능 코드·Hermes 연결 파일의 SHA manifest가 달라지면 자동 조회를 보류하고 호환 확인 필요를 알린다. 기존 팁 봇을 삭제하거나 예약을 새로 만들지 않는다. 변경 검증 후 설치기로 같은 예약의 계약을 갱신한다. 이 검사는 Claude·Codex 실행 바이너리의 업데이트나 미래 제품 호환성까지 검증하는 것은 아니다.
- 이 연결에서 맡긴 작업 영수증과 지정 자료만 다룬다. PC의 모든 앱·모든 실패·모든 사용자 작업을 감시하지 않는다.

## 설치·확인

Hermes 홈은 `%LOCALAPPDATA%/hermes`다. 비밀값을 저장소로 복사하지 않는다. 아래 명령은 설치·검증 방법이며 실행 결과 자체를 대신하지 않는다.

```powershell
node tools/hermes-synk/install.cjs
node tools/hermes-synk/install.cjs --apply
hermes plugins enable synk-work --no-allow-tool-override
hermes plugins doctor synk-work --ci
node tools/hermes-synk/status.cjs 백엔드
node tools/hermes-synk/overview.cjs
node tools/hermes-synk/overview.cjs --refresh --json

node tools/hermes-synk/install-automation.cjs
node tools/hermes-synk/install-automation.cjs --apply
# 처음 만드는 예약은 일시중지 상태다. 검증 뒤 같은 예약을 활성화한다.
node tools/hermes-synk/install-automation.cjs --apply --enable
```

기존 팁 파일 4개의 SHA-256을 대조하고 설정은 Hermes의 `backups/synk-work-*` 아래 보존한다. 자동 모델 대체는 비우며 기존 팁 수집·Claude 검토 예약·승인된 로그인은 유지한다. 같은 이름 예약을 중복 생성하지 않고, 소유·실행 계약이 다른 예약은 덮어쓰지 않는다.

```powershell
$synkTests = Get-ChildItem tests/hermes-synk-*.test.cjs | ForEach-Object { $_.FullName }
node --test $synkTests
python -X utf8 tests/hermes-synk-plugin.test.py
python -X utf8 tests/hermes-synk-delivery-hook.test.py
python -X utf8 tests/hermes-synk-automation.test.py
```

설정·플러그인 변경은 처리 중인 작업이 없을 때 공식 `hermes gateway restart`로 반영한다. 이때 `SYNK_Hermes_Gateway_Recovery`를 잠시 Disable한 뒤 반드시 다시 Enable한다. 공식 drain을 사용하며 프로세스를 강제로 죽이지 않는다. 실행 복구와 전원 설정은 [runtime/README.md](runtime/README.md)를 따른다.

현재 연결은 Hermes 0.22.2를 기준으로 하며 `gateway.session_context`의 두 accessor를 사용한다. 플러그인은 `<0.23.0`으로 제한한다. Hermes·Claude·Codex가 업데이트되면 소스 검사만 믿지 말고 공식 상태·관련 시험·실제 결과 전달을 다시 확인한다. core 재정의나 승인 우회 플래그를 사용하지 않는다.

## 확인한 범위와 남은 검증

10-18 다섯 형식 확장을 설치했고 관련 시험 **310개**(Node 221·플러그인 70·복구 훅 10·자동 알림 9)가 통과했다. 실제 게이트웨이의 공식 Codex 요청 `synk-5ebf1264df44`가 HTML·CSS·TypeScript·Python·JSON 샘플과 관련 시험 **8개 파일**을 수정했다. 공식 MXC 안의 사전 검사와 최신 원본에 대한 최종 검사가 모두 통과해 **19:21:54 KST 원본에 자동 반영**됐다. TypeScript·JSON·Python 실제 시험 각 1개, PC·모바일 화면 및 변경 CSS 효과를 확인했다. 같은 메시지는 중복 실행되지 않았고 원본 HEAD·인덱스·기존 팁 4파일 SHA가 보존됐다.

성공 결과는 `suppressed_success`이며 발송 claim·전송 시도 정보가 없다. 검증·적용 도구를 새 프로세스에서 다시 호출해도 저장된 결과를 재사용했고 원본·후보·영수증의 내용과 수정 시각이 바뀌지 않았다. 기존 공식 no_agent 예약 하나는 활성 상태이고 **19:22 공식 수동 실행이 성공**했다. 설치 소스와 manifest의 일치도 확인했다. 최신 근거는 `.tmp/hermes-multilang-20261018/verification.json`, `replay-verification.json`, `node-tests-complete.tap`, `cron-run-final.log`다.

실제 시험 중 최종 검증 뒤 공용 기록 변경, 작업본 준비 중 문서 변경은 각각 원본 쓰기·CLI 실행 전에 보류됐다. 이번에 만든 실패 샘플 7개는 파일 해시와 Git 작업본 등록을 보존해 `%LOCALAPPDATA%/hermes/runtime/synk-verification-archive/`에 옮겼으며 두 `archive-evidence-*.json`에 이동·복원 근거가 있다. 실패 영수증을 성공으로 바꾸거나 소급 통합하지 않았다. 약 59MB의 별도 보관량은 활성 작업본 입장 계산에서 제외된다.

이전 JavaScript 자동 반영은 `.tmp/hermes-auto-integrate-20261018/`, 세 흐름·Telegram 전송은 `.tmp/hermes-three-flows-20261018/`, 계정 전환은 `.tmp/hermes-gpt-account-20261018/`에 보존한다. 아침 09시 보고는 추가 요청에 따라 껐다. Claude에도 같은 사전 검사·최종 검증·반영 흐름을 적용하지만 이번 다섯 형식의 실제 완주 시험은 Codex로 확인했다. 미래 업데이트·모든 작업의 무오류 보증은 아니다.

Claude의 구독 사용량 제한이 해제되지 않았으면 실패 사유를 전달하며 멈춘다. 직접 상태 명령과 결과 전송은 접수 GPT를 호출하지 않지만 자연어 요청과 기존 팁 답장은 GPT 연결·한도 영향을 받는다.

10-18 19:40 KST에 공식 Claude 요청 `synk-b4cde9c4b442`로 다섯 형식 실제 완주를 다시 시도했다. 기존 구독 로그인과 `opus / xhigh` 설정을 유지했으나, 공식 CLI가 주간 한도 도달로 종료했다(`exit=1`, `is_error=true`, `NATIVE_QUOTA_LIMITED`). 응답은 `resets 12pm (Asia/Seoul)`이며 초기화 날짜는 표시하지 않았다. 모델 사용 기록은 비어 있어 이번 호출로 실제 모델 버전을 확인하지 못했다. 원본 반영은 보류됐고 19:41:27 KST에 판단 필요 알림의 Telegram API 수신이 확인됐다. 성공 완주 증거로 취급하지 않는다. 실행 근거는 `.tmp/hermes-claude-20261018/`에 보존하며 한도가 해제된 뒤 새 요청으로 재검증해야 한다.

휴대폰에서는 기존 헤르메스 개인 대화에 `/synk_today`로 전체 상태, `/synk_tasks synk-b4cde9c4b442`로 이번 한도 실패의 저장된 결과를 확인한다. 한도 해제 후 휴대폰에서의 새 요청 연결만 먼저 확인하려면 `/synk_claude 연결 확인이야. 파일은 바꾸지 말고 docs/AI_운영원칙.md에서 GPT 담당만 한 줄로 알려줘.`를 보낸다. 이 읽기 전용 요청은 다섯 형식 자동 반영 검증을 대신하지 않는다.

10-18 후속 승인으로 이 Codex 대화의 heartbeat `claude-synk`를 활성화했다. 공식 기본홈 `claude -p /usage`와 `claude auth status --json`을 순차 조회해 전체 주간 100%, **10-19 11:59 KST 초기화**를 확인했다. 첫 확인은 **10-19 12:10 KST**, 이후 매일 같은 시각이다. 한도 대기는 조용히 유지하고 해제가 확인되면 저장된 요청을 기존 Hermes 공식 경로에 한 번 접수한다. 상태와 고정 시도 ID는 `%LOCALAPPDATA%/hermes/runtime/synk-claude-followup/status.json`, 조회 근거는 `.tmp/hermes-claude-20261018/quota-latest.json`에 둔다. 진행 중인 작업은 이어 확인하며, 사전·최종 검증·원본 8파일 반영·재처리 보존까지 확인한 뒤 예약을 종료한다. 판단이 필요한 문제만 기존 Telegram 전송 영수증과 대조해 한 번 알린다. 정상 완료 알림은 생략한다. 현재는 예약 등록과 사용량 조회까지만 확인했으며 실제 재검증·원본 반영은 대기 중이다. 이 후속 예약에는 PC와 Codex 앱이 실행 중이어야 한다.

전원 연결 시 유휴 절전·최대절전은 해제했지만 배터리·덮개 동작은 유지한다. PC 종료·로그아웃·절전·인터넷 단절 중에는 즉시 수신·작업·알림을 보장하지 않는다. 사용자 휴대폰에서 직접 보낸 새 메시지의 수신부터 실제 결과 열람까지의 전 과정은 아직 검증하지 않았다. Telegram API 수신 확인은 휴대폰 읽음 확인과 다르다.
