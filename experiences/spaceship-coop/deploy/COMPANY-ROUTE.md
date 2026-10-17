# 기존 회사 HTTPS에 협동 경로 추가하기

> 2026-10-09 07:27 KST 운영 반영 완료. 최신 기준·검수·실행 근거는 `../../beginner-games/qa/account-sync/coop-release/r4/`다. 1fa(444파일)→85b20c 회사 경로 전환과 협동 서비스 healthy·공개 HTTP/SSE 2연결 18수리/공동출발을 확인했다. 아래 e696 설명은 이전 계획 기록이다. canonical 스크립트는 적용한 r4와 동일하며 이미 적용된 현재 운영에 재실행하면 CURRENT_DRIFT로 멈추는 것이 정상이다.

`prepare-company-route.py`는 이번 협동 API 한 경로를 위한 후보다. **기본 실행은 읽기 전용 계획이며 운영에 적용하지 않았다.** 기존 회사의 계정·DB·환경 파일을 읽어 복사하거나 수정하지 않는다. Docker Compose는 원래 운영 계약에 따라 기존 환경을 사용한다.

## 고정 기준과 변경 경계

- 현재 확인한 원본은 `/opt/synk/releases/e696b9efeed7`, `release-manifest.json` 원문 SHA는 `e696b9efeed78191a6e4619665bdab885abb1483dcb05cc4b5c193c44cf0fcef`, 파일 440개다. 앞선 20fda…/438파일과 295a…/437파일 기준은 다른 작업의 실제 회사 배포로 바뀌었다. 스크립트는 새 변경을 임의로 받아들이지 않고 멈춘다.
- e696의 440파일을 실제 SHA로 전수 확인했다. 20fda 대비 회사 로그인 관련 원문·시험 5파일 변경과 시험 2파일 추가를 모두 보존하고, 나머지 433파일과 Caddy 원문이 동일함을 확인했다. 읽기 근거는 `../../beginner-games/qa/account-sync/coop-release/company-live-manifest-r3.json`이다. 협동 후보는 이 새 baseline에서 Caddy 내용만 추가한다.
- Caddy 원문 SHA는 `174fa3f1787dd51083ffc497e8507c5b9d9e8a5b28c2a9ecb46195ca9ef6d874`다. manifest의 모든 파일·추가 파일 부재·일반 파일 여부를 확인하고, `Caddyfile.route`를 회사 reverse_proxy 앞에 추가한다. 서버 원본과 Caddy 부모 설정을 통째로 교체하지 않는다.
- 신규 릴리스는 새 manifest SHA의 앞 12자를 경로로 삼는다. 원본 파일과 디렉터리의 권한을 보존해 복사하고 Caddy 한 파일의 내용과 새 manifest만 바꾼다. symlink·hardlink는 거부한다. 기존 릴리스는 삭제하거나 수정하지 않는다.
- 운영 회사 이미지·컨테이너 ID·시작 시각·mount·IP를 고정하고 이전 계획과 달라지면 멈춘다. HTTPS도 기존 이미지와 인증서/config volume을 유지한다. 회사 컨테이너는 재시작하지 않는다. **HTTPS 컨테이너만 재생성하므로 짧은 HTTPS 재연결이 발생한다.**
- 06:16 이후 읽기 기준 회사 컨테이너는 `75fedb412cee…`, 이미지 `021805a5c67e…`, 시작 `2026-10-08T20:42:41.723978153Z`이고, Caddy는 `3a4dd01cfb90…`, 기존 이미지 `d8542f48d34a…`, 시작 `2026-10-08T20:42:47.500686734Z`다. 실제 적용 때는 계획 생성 시점의 전체 지문을 다시 묶는다. Health 필드가 없는 Caddy도 Docker 템플릿의 `index` 조회로 안전하게 읽으며 건강값 `null`을 회사 장애로 혼동하지 않는다.

## 읽기 전용 계획

검수한 스크립트와 같은 디렉터리의 `Caddyfile.route`를 사용한다. 예시는 준비된 협동 릴리스가 `/opt/synk/spaceship/current`에 있을 때다.

```sh
sudo python3 -B /opt/synk/spaceship/current/deploy/prepare-company-route.py
```

이 단계는 Docker·systemd의 공개 운영 상태와 원본 파일을 읽으며 새 릴리스·lock·컨테이너를 만들지 않는다. 출력 `planSHA256`은 Caddy 후보와 그때의 컨테이너·시작 시각을 묶는다. 설정의 비밀값은 출력하지 않는다. `CURRENT_DRIFT`, `MANIFEST_DRIFT`, `RELEASE_FILE_DRIFT` 등이 나면 새 실제 기준부터 검수한다.

## 검수 완료 뒤 적용 계약

공개 배포 권한과 공식 최종 검수가 완료되어야 한다. 협동 컨테이너가 내부 network의 `.4`에서 healthy인 상태를 먼저 확인한다. 적용은 위 계획의 실제 SHA를 명시해야 한다. 환경 파일은 기존 systemd가 전달하며 스크립트는 내용을 열거나 복사하지 않는다.

```sh
sudo systemd-run --unit=synk-spaceship-route-20261009 --wait --collect --pipe \
  --property=EnvironmentFile=/etc/synk/company.env --property=UMask=0077 \
  /usr/bin/python3 -B /opt/synk/spaceship/current/deploy/prepare-company-route.py \
  --apply --expect-plan-sha PLAN_SHA_FROM_READ_ONLY_OUTPUT
```

1. 기존 `/var/lib/synk-company-ops/operations.lock`을 배타적으로 잡는다. 잠겨 있으면 쓰기 전에 멈춘다.
2. 원본·컨테이너를 재대조하고 새 릴리스를 만든다. `docker compose config --quiet`, 현재 캐시된 동일 Caddy 이미지의 실제 `caddy validate`를 수행한다. pull·build는 하지 않는다. 검증 컨테이너는 network none·read-only·host 포트 없음이며 후보 설정만 읽기 전용으로 마운트한다.
3. 두 릴리스와 컨테이너를 다시 대조하고 `/opt/synk/current`를 원자 교체한다. 같은 프로젝트·compose 경로로 `up --no-deps --no-build --pull never --force-recreate https`만 실행한다.
4. 회사 컨테이너가 그대로인지, Caddy 이미지·IP·인증서/config volume이 같은지, 새 설정 파일만 마운트했는지 검사한다. 회사 HTTPS health와 협동 health를 실제 조회한다.
5. 재생성·사후검사에 실패하면 current를 이전 릴리스로 돌리고 이전 HTTPS 설정으로 다시 생성한다. 다른 작업이 current를 이미 바꿨다면 그것을 덮어쓰지 않는다. `ROLLED_BACK`, `ROLLBACK_INCOMPLETE`, `ROLLBACK_CURRENT_DRIFT`를 구분해서 보고한다.

`SIGKILL`, 호스트 전원 중단 같은 비정상 종료에는 Python 예외 rollback이 실행되지 않는다. 재개 전에 current·두 컨테이너·manifest를 읽어 상태를 판별한다. 기존 원본을 보존하므로 그 원문으로 복구하며 자동으로 재적용하지 않는다.

현재 회사 systemd는 current 아래의 동일 `company-stack.sh`·compose를 사용하므로 정상 재시작·재부팅 뒤 경로가 유지된다. **이후 회사 릴리스도 새 Caddy 경로를 보존해야 한다.** 공유 작업본의 옛 Caddy에서 새 후보를 만들면 이번 경로가 빠진다. 새 manifest의 Caddy delta를 회사 배포 담당에게 전달하고, 다음 후보에서 경로를 유지한 것을 확인한다. 이 작업은 동시 편집 중인 회사 canonical Caddy를 임의로 수정하지 않았다.

## 검증의 범위

`python -B experiences/spaceship-coop/deploy/test_prepare_company_route.py`는 복사·내용/권한 보존·drift 거부·HTTPS만 재생성하는 명령·성공/실패/다른 작업 변경 시 rollback 분기를 격리 fixture로 검사한다. Health 필드 없는 Caddy 읽기 회귀를 추가해 Linux **18/18**, Windows는 18개 중 17개 통과·symlink 권한 때문에 1개 건너뜀이다. Caddy fixture는 e696 운영 원문의 정확한 바이트를 사용한다. 이 fixture는 실제 운영 전환·systemd·Caddy 재생성 결과가 아니다.

e696 VM의 임시 디렉터리에 검수 후보 세 파일만 둔 뒤 **기본 읽기 전용 계획 명령도 실제 exit0**으로 확인했다. 현재 440파일 중 Caddy 한 파일만 바꾸고 439개를 그대로 보존하며, 이전 회사 로그인 변경 7개도 모두 남는다. 생성 예정 회사 manifest SHA는 `dacf247711b4f29f538537b8951942df80acbd1eeb8fe34144b92695e2598323`, 이 읽기 시점의 plan SHA는 `6f3279a84e0174e5dfb9bb5f8ed86b7deec4cc0526565e1c72477ec981dae017`이다. 실제 적용 직전에 다시 계산해야 하며 이 값은 적용 승인이 아니다. 전후 current·manifest·회사/Caddy 컨테이너가 동일했고 임시 디렉터리는 정리했다. `--apply`, 운영 staging, unit/route/서비스 변경은 수행하지 않았다.

근거는 `../../beginner-games/qa/account-sync/coop-release/company-route-rebase-r3.json`과 `company-route-linux-fixture-results-r3.json`이다. 앞선 실제 Linux 서버 16검사와 Caddy binary validate는 `linux-isolated-validation.json`에 별도 남아 있다. 이미지의 서버 입력 5개는 변경하지 않아 이미지 재빌드는 하지 않았다.
