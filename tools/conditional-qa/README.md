# 조건부 시험의 지속 검증

2026-11-01 유호님 요청: 따로 검증했던 113건을 코드 변경 뒤에도 빠짐없이 자동 검증한다. 이전 수동 검증은 [101건과 추가 12건의 근거](../../docs/_ops/qa/ci-conditional-101-20261101/README.md)에 있다.

| 실행 위치 | 등록 항목 | 실행 조건 |
|---|---:|---|
| GitHub Windows | 28 | Hermes Windows 경로·복구, OneDrive, ASAR, 대소문자, 가짜 자격 증명 |
| GitHub Linux | 7 | 현재 Rust 원천을 WASM으로 빌드, ffmpeg 실제 실행 |
| Windows 로컬 | 78 | 암호·Caddy·비공개/보관 자산·브라우저·Talk/WORLD·문서 SHA |
| 합계 | 113 | `cases.json`의 S001~S113을 삭제할 수 없다 |

`conditional-qa.yml`은 master의 각 push에 세 관문을 건다. 파일과 시험 이름이 일치하는 실제 Node 시험 이벤트가 정확히 한 번 통과해야 한다. skip/todo, 이름 변경, 누락, 중복, 프로세스 실패·시간 초과는 실패다. 기존 syntax/wide CI에 처음 생긴 조건부 제외도 등록되지 않았으면 실패한다. 새 제외를 추가할 때에는 재현 입력과 자동 실행 경로를 함께 등록한다. 등록된 이름을 바꿀 때에는 같은 ID의 이름과 시험을 함께 바꾼다.

모든 실행 경로는 영수증 폴더 아래에 전용 TEMP/TMP를 만들고 Windows의 실제 경로로 고정한다. hosted runner의 `RUNNER~1` 별칭이 Git·PowerShell의 긴 경로와 달라지는 환경 문제를 시험으로 오인하지 않게 한다. 검사할 커밋과 다른 추적 파일 수정이 있으면 후보 표시가 없는 실행은 거절한다.

`worker.cjs`는 운영 사본에서 실행되며 별도 관리 체크아웃으로 신뢰하는 origin/master 커밋을 검증한다. 공용 작업본·운영 코드·운영 DB를 시험용으로 수정하지 않는다. PR/fork는 로컬 실행 대상이 아니다. 활성화 시점 이후 master 커밋은 순서대로 대기열에 보존하고, 한 회차에 최대 세 커밋을 처리한다. 중단된 실행과 네트워크 장애는 다시 시도하며, 시험 자체의 실패는 실패로 남는다. 새 코드의 성공으로 과거 실패를 덮지 않는다.

로컬 원문과 보관 fixture는 저장소 밖 `~/security-audit-skill/SYNK-conditional-qa`에 해시로 등록한다. `inputs.json`에는 이전 감사에서 보존한 출처·해시가 있고, `blobs/`에는 해당 바이트만 둔다. 추적 중인 현재 앱 소스가 과거 fixture보다 우선한다. Talk 실행·과제 참조판은 이전 검증의 고정 입력이고, 범위 표 비교는 매 실행 현재 Talk origin/master를 확인한다. 현재 Rust를 검사할 때 과거 WASM을 대신 쓰지 않는다. 의존성은 격리된 폴더의 lock 파일로 `npm ci --ignore-scripts` 설치한다.

각 로컬 실행은 `runs/<commit>-<time>/`에 원래 이벤트, TAP, 화면 증거, 커밋·목록·입력 해시와 결과를 남긴다. 시험 전후 소스와 입력도 대조한다. GitHub에는 개인 자료 없이 해당 커밋의 `conditional-qa/local` 상태와 통과 수·목록 해시만 올린다. 같은 커밋의 검증이 끝나기 전에는 녹색이 되지 않는다. PC 꺼짐·로그아웃·입력 손상·도구 부재는 미완료/실패이며 과거 성공으로 대체하지 않는다. CI 대기가 끝난 뒤 검증이 완료되면 로컬 대기 단계만 실패한 run을 다시 돌린다. 다른 CI 실패를 가리지 않는다.

Windows 작업 `SYNK 조건부 시험`은 현재 사용자의 일반 권한·대화형 로그온으로 5분마다 시작한다. 중복 실행은 무시하며, 다시 켜지면 미실행 회차를 시작한다. 실행 명령은 운영 사본의 `tools/숨김실행.py` → `tools/conditional-qa/worker.cjs`다. 새 개인 토큰·관리자 권한·GitHub 자체 호스팅 러너는 만들지 않는다. 설치 영수증은 `installation.json`, 마지막 상태는 `last-run.json`, 전체 대기열은 `queue.json`이다. 보관된 원래 감사 자료는 건드리지 않는다.

설치는 `install.cjs --state <비공개 폴더> --ops <운영 사본> --pythonw <pythonw.exe> --first <첫 검증 커밋>`으로 미리 보고 같은 명령에 `--apply`를 붙인다. 최초 입력 등록은 `inputs.cjs`의 `provision`으로 이전 감사 manifest와 원문 해시를 검증한 뒤 수행한다. 상태 폴더는 공용 저장소 안에 두지 않는다. Codex 앱의 `%LOCALAPPDATA%` 가상화와 작업 스케줄러의 실제 경로가 달라질 수 있어 사용자 프로필 아래 명시적 경로를 쓴다.

운영 확인은 `node tools/conditional-qa/worker.cjs --state <비공개 폴더>`로 같은 회차를 실행할 수 있다. 이미 도는 회차가 있으면 잠금을 지우지 말고 완료를 기다린다. 입력이나 실행 도구 문제가 해결되면 인프라 실패는 다음 재시도에서 검증한다. 시험 자체가 실패하면 원인을 고친 새 코드로 다시 확인한다. 예약을 끄더라도 CI 로컬 단계는 미완료로 남으며 검증을 생략해 통과시키지 않는다.

회귀는 `node --test tests/conditional-qa.test.cjs tests/ci넓은시험.test.js`다. 이 자동화는 등록된 113건의 지속 검증이며, 새 보안 감사나 운영 접근 권한 전체의 재점검을 대신하지 않는다. 최초 실제 실행과 원격 CI 결과는 비공개 설치·실행 영수증과 해당 커밋의 GitHub Checks에서 확인한다.
