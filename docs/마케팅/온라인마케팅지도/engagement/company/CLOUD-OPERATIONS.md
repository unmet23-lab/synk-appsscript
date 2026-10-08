# 회사 워크스페이스와 고객 상담의 상시 서버 운영

2026-10-09 04:57 KST 기준 **[workspace.synk.im](https://workspace.synk.im)의 직원·고객 로그인 유지까지 운영 반영·실제 인수를 마쳤다.** 정상 서버 재시작 후 두 계정 모두 재로그인 없이 기존 메모·첨부·상담 원문을 열었다. 첫 정기 백업·비공개 GCS 다운로드 대조·자동 감시의 완료 이력도 유지한다. 실물 휴대폰 시험과 전체 클라우드 Claude 재검수는 사용자 보류다.

사용자는 **“클로드 최종 재검수는 미루고 나머지 전부 진행해”**, **“실제 휴대폰 시험은 나중에”**라고 지시했다. 전체 클라우드 통합 Claude 재검수와 실제 iPhone·Android/PC 종료 시험은 보류한다. 업무 알림 v2 수정분은 별도로 공식 Claude Opus5.5 max 검토가 완료돼 기존 P2 해결과 새 P0·P1·P2 없음이 기록됐다. 이 부분 검토를 전체 통합 검수 완료로 확대하지 않는다.

Google Compute Engine 한 대·영구 디스크·Caddy HTTPS·비공개 GCS 백업으로 운영한다. Atlas 8개마다 서버를 만들지 않는다. 기본 결제는 `unmet27@gmail.com`의 `synk-bake-unmet27`와 [돈장부](../../../../_ops/돈장부.json)를 따른다. 기존 라디오의 결제·운영 설정은 변경하지 않았다.

## 최신 완료 — 고객 로그인 유지와 두 계정 재시작 인수

04:46 고객 세션 유지 릴리스 `20fda68c0fbf`를 배포했다. 직원 부모 `295a596d7498`에서 고객 인증·회귀 시험·설명·서버 연결의 5파일만 바꾼 고정 438파일이다. manifest `20fda68c0fbfec593f4d76baf9dd450e73cf959e8afe1eab6638a73c22a56217`, image `sha256:b1c757dee6e886f913fdb0569703e2da5049e063d2552f7b11a3b8479fa75d8c`. 기존 volume·30개 환경 항목 중 image 외 값·7개 systemd unit을 보존했다. 직원·고객 AI0/BACKGROUND0, WORK1/PUSH1이며 새로운 메시지·구독·푸시·유료 AI 호출은0이다.

정지 사본의 엄격 대조에서는 새 빈 고객 세션 표만 추가됐고 기존 업무·파일·원키/VAPID는 보존됐다. 직원 세션 암호문1건의 재암호화는 모든 복호화 값이 동일함을 별도로 검증했으며 token 삭제는0이다. 최초 업그레이드 직후에는 기존 메모리 전용 고객 세션 때문에 정상 고객 로그인1회가 필요했다. **그 뒤 04:51~04:52 인수용 정상 서비스 재시작1회(SIGTERM/exit0·SIGKILL0) 후 직원·고객 모두 로그인 단추를 누르지 않고 복귀했다.** 유호·기존 메모·Drive 첨부·23:33 상담 원문을 실제 화면에서 확인했다. 04:56 서버 대조도 두 계정의 동일 session/CSRF/만료, 원키/VAPID/문서/메신저 자료와 실제 컨테이너 재시작을 확인했다. 04:57 main·3timer active, container healthy, 공개 health ready·16자산 SHA/MIME 일치다. 전체 VM 재부팅은 과거 부모 이력과 구분한다.

고객은 전용 암호화 표에 저장하고 복원 후에도 매 보호 요청마다 중앙 계정·현재 세션을 확인한다. 원래 8시간 절대 만료를 연장하지 않는다. 중앙503은 접근을 보류하고 복구 후 재로그인 없이 이어가며, 철회401·로그아웃은 세션을 제거한다. 회전된 refresh는 후속 검증 전에 보존하고 종료 중 로그아웃도 즉시 삭제한다. 상세는 [고객 로그인 계약](CUSTOMER_IDENTITY.md)을 따른다.

Windows738통과/0실패/2symlink skip, 실제 Linux740/740/skip0, 전달108항목·기동/교체24+24, 합성 고객92·직원127 인증항목과 정상종료4회를 통과했다. 공식 Claude Opus5.5/max 검수 시도는 세션 한도(05:30 초기화 안내)로 **미완료**다. 이번 클라우드 후속에 대한 기존 사용자 검수 보류 지시와 실제 실패 기록을 보존했으며 공통 정책은 바꾸지 않았다. 이전 직원 릴리스의 완료된 부분 검수를 이번 고객 코드 검수로 확대하지 않는다.

인증 소스·시험·설명8파일 커밋 `9bd80a3adf164fdd1e1270e1684b94469c749366`을 `codex/company-cloud-push-20261009`에 push하고 원격 ref를 대조했다(해당 소스 시험141/141). 전체 운영 트리의 동일 snapshot·master 반영·CI 통과 주장은 아니다. 기존119파일 최적화 push 이력도 유지한다. 근거는 `.tmp/customer-session-restart-20261009/FINAL-ACCEPTANCE.json`, `HANDOFF.md`, 두 실제 화면과 `.tmp/company-cloud-20261008/current-handoff.json`이다. 04:44 수동 사전 백업은 업로드 완료까지 확인했고 해당 새 객체의 독립 GET/복구는 주장하지 않는다. 아래 첫 정기 백업 증거와 구분한다.

## 이전 완료 — 03:59 직원 로그인 유지와 첫 정기 백업

03:19 배포된 로그인 유지 v2(295a596d7498)는 03:54~03:55 정상 서비스 재시작 1회 후 실제 직원 브라우저 새로고침에서 재로그인0으로 유호·기존 메모·Drive 첨부가 열렸다. 실제 컨테이너 SIGTERM/exit0·SIGKILL0, 동일 세션/CSRF/만료·원키/VAPID/문서/설정, 원래 volume/env/timers 보존을 확인했다. 고객은 별도 SYNK 재로그인 뒤 23:33 기존 글만 초안을 불러왔으며 고객 세션의 재시작 지속까지 완료로 주장하지 않는다. 새 업무쓰기·유료AI·구독/푸시0. 공개 health ready·13파일 일치. 첫 정기백업03:32:05~06의 원래timer/invocation·업로드·169,579B GCS 독립GET200/SHA 일치, 자연 watch03:52:55 BACKUP_FRESH까지 확인했다. 03:50 원본은 watch 이전의 미확인 상태로 보존하고 읽기 전용 후속 증거로 보완했다. 03:55 heartbeat는 진행 중인 인수에 합쳐 재시작 중복0이다. 실물폰/PC종료/실푸시와 전체 클라우드 Claude 검수는 보류, 실제09시 마감묶음은 미관측이다.

현재 437파일 manifest `295a596d7498535aa5dd76e3b616eba814f59afbae57c8d88608b04e4d01e7b7`, image `sha256:b5a871571e0828da5a091e5c472fdf2bf1b79ba828e48109afff414e9879b40e`. Windows702/0/2skip, Linux704/704/skip0과 합성 인증127항목/정상종료4회 통과. 공식 Opus5.5/max는 v1→v2 코드 수정 검수 완료이고 시험 실행 증거는 배포 담당이 별도로 대조했다. 운영 정지 사본에서는 새 빈 identity 표만 추가됐으며 기존 행·키·파일은 보존되고 token삭제0이다. 전체 VM 재부팅은 과거 부모에서 확인한 결과이며 이번 인수는 현재 서비스의 정상 재시작이다.

근거는 `.tmp/messenger-session-restart-20261009/FINAL-ACCEPTANCE-V2.json` 및 `.tmp/company-cloud-20261008/current-handoff.json`. 아래 01:44까지의 후보·백업·미확인 상태는 이전 단계 이력이다.

## 이전 운영 검증 — 01:44 KST 기록

| 항목 | 실제 확인 | 구분할 한계 |
|---|---|---|
| 서버 | 서울 synk-company-1, 고정 IP34.64.170.2, main enabled/active, company healthy, Caddy HTTPS, 3timer active. 01:22 읽기 전용 운영 검사10/10 통과 | VM 전체 재부팅은 부모 be219, 현재 aeb162는 서비스 stop/start까지 |
| 데이터 | 최신 PC 정지 백업 두 벌·39파일 전송/복구. 이번 v3→업무 알림 v2의 두 정지 사본 비교는 문제0·token 삭제0, 모든 기존 업무행·계정 연결·키·VAPID·DB 밖 파일 동일 | 과거 v3 최초 전환의 세션1건 삭제 수락 이력은 별도 보존 |
| 실제 사용 | 기존 직원 로그인·메모·첨부 표시, 고객 원문과 용도0개 초안 복원 확인. 기존 자기 메모에 01:22 예약, 브라우저를 비운 동안 01:22:01에 서버 알림1개 생성·중복0, 복귀 후 UI 읽음 확인 | 시험 기록은 보존·삭제0. 실제 09시 마감 알림과 다른 휴대폰 수신은 미시험 |
| 푸시 | WEB_PUSH1 유지, 등록/큐0·실제 기기 전송0. 일시 인증 오류와 종료 도중의 구독 보존, 새 VAPID scalar32바이트 회귀를 Linux에서 확인 | 기기 권한 허용·구독·수신을 아직 시험하지 않음 |
| 백업 | 첫 systemd 백업의 정지 기준 복구11검사 통과. 01:10 수동 백업166,980B도 01:44 독립 GCS GET1회·HTTP200·SHA·현재 이미지 격리 복구 통과 | 과거 완료된 온라인 snapshot 기준이며 정기 실행이나 현재 실시간 데이터 일치 증거는 아님 |
| 감시 | 기존 BACKUP_STALE 메일에 더해 가용성/TLS 두 정책의 시험 메일2건 실제 열람·원복2건·incident 닫힘2건 확인. 3지역 readiness/TLS 정상, 시험 설정 잔존0 | 합성 조건으로 기존 정책→메일 경로를 시험했으며 실제 서버 장애·인증서 만료는 재현하지 않음 |
| PC 전환 | 바로가기2개를 공개 주소로 전환. 기존 원본은 보존하고 이전 guard 정상 해제·프로세스 종료 | PC를 실제로 끈 휴대폰 시험은 사용자 보류 |

현재 고정 후보는 업무 알림 `release-v2` 424파일, manifest `aeb1620ebc406c000a10b1aa14d3ffa745330ff6076e354e32f294aae9255a72`, 이미지 `sha256:79a7377a443ba5759ce76159a77fd8026531d14be38c5f3967c2686a84ccb45e`다. Linux62개 시험파일 **576/576, skip0**, 소비108, 실제 이미지 기동·교체24+24를 통과했다. 실제 이미지의 격리 lifecycle에서 기동 즉시 알림·타이머/교체 중복 방지·권한 철회도 확인했다. 기존 고객 글만 저장 수정과 업무·키를 보존했고 후보 밖 공유 작업본을 통째로 복사하지 않았다.

업무 알림 v2는 01:16에 반영했다. env는 이미지와 `SYNK_COMPANY_WORK_NOTIFICATIONS_ENABLED=1`만 바꾸고 WEB_PUSH1·BACKGROUND0·AI0, 같은 운영 volume과 7개 systemd unit을 유지했다. 두 정지 사본의 엄격 비교는 문제0·만료 token 삭제0으로 통과했다. 이후 실제 로그인으로 01:22 예약 알림을 시험했고 원래 메모와 첨부, 고객 원문은 보존했다. 시험 알림은 UI에서 읽고 기록을 남겼으며 삭제하지 않았다. 마감 알림의 실행 중 표시는 확인했지만 운영의 09시 발송은 아직 시험하지 않았다.

Web Push v3는 10월 8일 23:56에 공개 서버에 반영했다. 기존 env에서 이미지와 SYNK_COMPANY_WEB_PUSH_ENABLED=1만 바꾸고 AI0·background0, 운영 volume과 7개 systemd unit은 유지했다. 00:04 실제 직원 로그인으로 메신저의 기기 알림 창·서버 준비·활성화 단추를 확인했다. 등록 기기0이며 권한 요청·구독 등록·실제 발송은 실행하지 않았다. 실제 수신은 사용자 보류 상태다.

공개10파일 SHA가 후보와 일치했고 1440·390·320px 익명 화면에서 가로 넘침·페이지 오류가 없었다. 이 익명 화면 검사와 별도로 00:04 실제 직원·고객 로그인, 메모·첨부·고객 초안 보존, 직원 기기 알림 창을 확인했다. 익명401이나 정적 바이트 일치만으로 인증된 기능과 실제 기기 수신을 증명하지 않는다.

v3 정지 전후의 엄격한 대조에서 만료 시각이 아직 오지 않은 인증 세션 1건의 삭제가 검출되어 자동 통과하지 않았다. 기존 인증 모듈과 호출부가 부모와 바이트 동일하고, 재시작으로 메모리 세션이 없어지면 해당 DB 세션을 무효화하는 동작과 일치함을 검토했다. 나머지 기존 업무·계정·메신저 행과 DB 밖 파일은 보존됐고 새 푸시 표 2개는 비어 있으며 암호화 VAPID 자격 1건만 추가됐다. 이 한 건은 운영자 수동 검토로 수락했다. 정확히 어느 HTTP 요청이 삭제를 일으켰는지는 로그가 없어 확정하지 않는다. 이를 만료 정리로 부르거나 일반 비교기를 완화하지 않았고 strict 실패 원본도 보존했다.

VM 전체 재부팅 실증은 10월 8일 23:38~23:43의 부모 릴리스 `be219dcc61c9`에서 수행했다. boot ID가 바뀐 뒤 수동 시작 없이 자동 복귀했고 HTTPS와 실제 기록 보존을 확인했다. 현재 `aeb1620ebc40`은 실제 서비스 stop/start와 VAPID 키·업무 데이터 보존까지 확인했으며 이 이미지로 VM 전체 재부팅을 다시 시험한 것은 아니다.

재부팅 뒤 장치 별칭이 /dev/sdb에서 /dev/sda로 바뀌어 초기 raw 비교의 persistentMountUnchanged는 false였다. 별도 읽기 전용 확인으로 named PD `synk-company-data`, ext4 UUID, fstab과 같은 volume을 확인했다. 디스크 교체가 아니며 원시 결과는 수정하지 않았다.

10월 9일 00:03 백업의 독립 다운로드·격리 복구에 이어, 01:44에는 **01:10 수동 백업166,980바이트**의 GCS 독립 GET1회·HTTP200·SHA 일치와 현재 이미지 `79a737`의 격리 복구를 확인했다. 백업 생성 당시 릴리스는 `1965`이며 복구 검증에 사용한 릴리스는 `aeb162`다. 이는 완료된 과거 온라인 snapshot의 보존·복구 증거이며 두 DB의 동일 시점이나 현재 실시간 데이터 일치를 보장하지 않는다. 다음 정기 백업의 최신 예정값은 10월 9일 **03:38:59 KST**이고 실제 실행은 아직 관측하지 않았다. 근거: `.tmp/company-cloud-20261008/work-v5-offsite-independent-restore-result.json`.

직원은 사용자가 지정한 `unmet23@gmail.com`의 중앙 활성·이메일 확인 상태를 검증한 후 보호 백업을 만들고 기존 유호 관리자에 연결했다. 새 사용자 생성·비밀번호 변경·중앙 계정 변경·공개 인증 우회는 없었다. 직원 SYNK ID 연결1건과 통합 설정의 회사/메신저 identityLinks1건은 서로 다르다.

Cloudflare DNS-only A workspace는 고정 IP이며 AAAA는 없다. Caddy TCP80/443만 공개하고 Node4191/4197은 내부다. 포털 `synk-policy` 커밋 `e55ef7a00cfb0de531cf3aae644d150e67f9b0b8`은 Pages·사이트 CI 성공, 실제 공개 바이트·기존20개 포함 총21클라이언트 보존을 확인했다.

GCS는 공개 접근 금지·균일 권한·7일 soft delete를 유지한다. VM 계정은 로그·지표 쓰기와 company/ 객체 생성만 허용한다. archive는 컨테이너 mount 밖 root 전용 경로에 둔다. 당시 월730시간 기본 예상액 US$42.57는 VM·두 디스크·사용 중 IPv4 추정이며 GCS·전송·세금은 별도다. 현재 잔액이나 청구액을 뜻하지 않고 유료 전환·자동충전은 실행하지 않았다.

이전 v3 단계의 증거는 `.tmp/company-cloud-20261008/`의 `push-v3-linux-result.json`, `push-v3-deployment-result.json`, `push-v3-logical-verification-execution.json`, `push-v3-session-delta-resolution.json`, `push-v3-session-deletion-source-review.json`, `push-v3-live-key-preservation-result.json`, `push-v3-final-runtime-snapshot.json`, `push-v3-live-browser-result.json`, `pc-migration-guard-release-result.json` 및 기존 첫 백업·재부팅·포털/감시 결과다. 당시 공개 바이트/익명 UI는 `.tmp/messenger-push-20261008/public-probes/2026-10-08T15-01-15-879Z.json`, `public-browser/2026-10-08T14-57-13-327Z/report.json`이다. 과거 raw 실패·검수 한도·중지 기록은 당시 이력으로 보존한다.

10월 9일 00:55 HTTPS·01:05 TLS 시험 메일을 기존 수신함에서 실제 열어 정책/incident/시험 식별자를 대조했다. 원래 장애 조건과 정책·메일 채널을 보존한 합성 조건 시험이며 실제 서비스 장애나 인증서 손상은 만들지 않았다. 두 정책을 원래 설정으로 돌린 후 독립 GET으로 대조했고 두 incident의 닫힘, 복원 감시 프로세스 종료와 시험 설정 잔존0을 확인했다. 01:11 재확인에서 3지역 readiness/TLS 정상이다. 근거: `alert-delivery-test/final-result.json`, `public-monitoring-after-delivery-20261009.json`.

현재 배포·사용·보존 근거는 `.tmp/company-cloud-20261008/`의 `work-v5-linux-result.json`, `work-v5-logical-comparison-result.json`, `work-v5-final-runtime-snapshot.json`, `work-v5-live-browser-result.json`이다. v2 부분 공식 검수는 `.tmp/messenger-work-notifications-20261009/release-v2/claude-review-summary.json`이며 전체 클라우드 통합 재검수와 구분한다.

## 실행 계약

- 검증·승인한 고정 릴리스만 `/opt/synk/releases/<version>`에 두고 `/opt/synk/current`에서 실행한다. 공용 작업본에는 다른 작업이 동시에 반영되고 있어 그대로 배포하지 않는다.
- 영구 디스크를 `/srv/synk`에 마운트한다. 기본 회사 경로는 `/srv/synk/company`이나 현재 운영 환경의 `COMPANY_VOLUME_DIR`는 `/srv/synk/recovery-final-20261008T133704Z/prepared/company`다. 이 경로가 컨테이너 `/data`로, 메신저는 `/data/messenger`로 연결된다. 복구 볼륨과 스냅샷 `/srv/synk/backups`는 UID/GID 1000, 호스트 전용 묶음 `/srv/synk/backup-archives`는 root:root 0700이며 컨테이너에 마운트하지 않는다. TLS도 별도 경로에 둔다. 데이터 bind 디렉터리가 없으면 자동 생성하지 않는다.
- 원래 `encryption.key`가 없는 회사 DB를 시작하지 않는다. `PREPARATION_INCOMPLETE`가 있으면 Store 생성 전에 중단한다. 클라우드에서는 `SYNK_COMPANY_REQUIRE_EXISTING_DATA=1`로 빈 DB의 신규 관리자 설정 화면이 열리는 일을 막는다.
- `/etc/synk/company.env`는 저장소 밖 root:root 0600이다. 기존 공개 로그인 설정과 AI0·BACKGROUND0·백업 업로드1·WEB_PUSH1·WORK_NOTIFICATIONS1을 사용한다. 회사 수집·트렌드 수집·Drive 삭제 outbox는 계속 중지하고, 승인된 예약 리마인더·마감 알림만 독립 flag로 활성화했다. 서비스와 3개 타이머는 활성이다. 실제 설정값을 예제에 채워 커밋하지 않으며 운영자용 양식은 [cloud.env.example](cloud.env.example)이다.
- Node 컨테이너는 공식 이미지의 `node` 사용자로 실행한다. bind된 DB·키·첨부파일을 해당 UID/GID가 읽고 쓸 수 있어야 한다. 이미지 내부 chown만으로 bind 권한은 바뀌지 않는다.
- HTTPS 앞단만 80/443을 공개한다. 회사 Node 포트 4191은 컨테이너 내부에서만 연결한다. DNS only 직접 연결에서 고정 Caddy peer `172.30.77.3`만 신뢰하고 Caddy가 실제 접속 IP로 X-Forwarded-For를 덮어쓴다. SSH/IAM·방화벽은 필요한 운영 접근만 별도로 설정한다.
- DB 두 개의 온라인 snapshot은 서로 같은 시점임을 보장하지 않는다. 최종 이전은 원본 쓰기를 정지한 뒤 시행한다. [데이터 이전·복구](CLOUD-DATA-MIGRATION.md)를 따른다.

## 직원과 고객의 경계

직원은 기존 초대·연결된 활성 직원 계정으로 회사 경로를 사용한다. 고객은 `/consultation/`에서 컴퓨터 조건을 선택하고 `/api/customer/*`만 사용한다. 고객 로그인은 기존 중앙 계약 `platform`의 **별도 등록 클라이언트**와 `/api/customer/synk-id/callback`을 요구한다. 직원 클라이언트나 쿠키를 재사용하지 않고 고객을 회사 `users`에 추가하지 않는다. 실제 중앙 등록이 끝나지 않으면 로그인이 비활성화된다.

10월 8일 기존 직원 클라이언트에 새 callback을 추가하고 별도 고객 클라이언트를 실제 등록했다. 기존 20개 등록·연결은 보존됐고 총 21개를 다시 읽어 대조했다. 공개 포털의 `id/config.json`은 별도 작업본에서 게시하고 실제 공개 바이트를 검증했다. 중앙 `platform` 토큰은 상담 전용 scope가 아니며, 기존 제품의 본인 데이터 권한 계약을 공유한다. 제공자 토큰은 회사 브라우저에 반환하지 않는다. 실제 직원·고객 로그인과 고객 세션의 직원 화면 차단은 확인했다. 서로 다른 실사용자·실기기 인수는 이 결과와 구분한다.

모든 고객 API는 중앙 계정의 활성·현재 세션을 확인한다. 변경 요청은 같은 Origin·세션 CSRF가 필요하고, 본문 수신 후 다시 인증한다. 유료 응답을 돌려주기 전에도 중앙 상태를 재확인한다. 중앙 장애 중에도 로컬 로그아웃은 가능하며 원격 철회 성공 여부를 구분한다. 고객 로그인은 원래 키로 암호화한 전용 DB 표에서 복원하며 서버 재시작 후에도 8시간 절대 만료 안에서 중앙 재검증을 거쳐 이어진다. 저장한 상담·사용량도 영구 DB에 남는다. 직원 쿠키·연결과 합치지 않는다.

고객 상담은 원문 4,000자 이하와 본인이 확인한 선택값을 암호화해 저장한다. 용도를 선택하지 않고 글만 저장하는 경우도 허용하며 임의 용도를 추가하지 않는다. 계정은 서버 인증으로만 결정한다. 두 기기가 동시에 저장하면 `baseRevision` 충돌을 반환해 조용히 덮어쓰지 않는다. 삭제는 암호문을 제거하고 버전만 남겨 오래된 기기가 삭제 전 내용을 되살리지 못하게 한다.

AI는 현재 OpenAI 추출 어댑터를 유지한다. **Google 크레딧으로 OpenAI 비용을 지불할 수는 없다.** Vertex 모델로 전환하려면 별도 제품 어댑터와 동일한 인용·조건·사용량 검증이 필요하며 이번 준비에서 임의로 바꾸지 않았다. 직접 조건 선택·기기 내 추출은 유료 호출 없이 동작한다. 고객 AI 설정은 기본 꺼짐이며 세 개의 고객 전용 설정(활성 여부·하루 요청수·하루 비용 상한)과 기존 제공자·전체 예산 설정을 모두 갖춰야 호출할 수 있다.

하루 한도는 UTC 자정 기준이다. 요청을 보내기 전 SQLite 트랜잭션에서 개인 예산과 전체 예산을 함께 예약한다. 결과 불명 예약·재시작·응답 삭제가 한도를 되돌리지 않는다. 같은 UUID와 원문 재전송은 저장한 결과만 반환하고 추가 호출하지 않는다. 기존 관리자 시험과 고객이 전체 비용 상한 하나를 공유한다. 비용 상향·실제 유료 모델 시험은 예상 비용을 먼저 확인한다.

## 남은 인수

실제 iPhone·Android 권한 허용·구독·잠금 화면 알림 수신·클릭 후 올바른 계정·로그아웃 후 전송 차단, PC를 끈 사용은 사용자 지시로 뒤로 미룬다. 실제 기기 등록은0이다. 운영 09시 마감 알림의 실제 관측, 전체 클라우드 및 이번 고객 코드의 Claude Opus5.5 max 재검수는 미완료다. 첫 정기 백업과 직원·고객 재시작 로그인 유지는 위 완료 항목에서 확인했다. Vertex 어댑터와 실제 유료 AI 활성화는 별도 후속이며 현재 AI0을 유지한다. 별도 완료된 업무 알림·직원 세션 검토와 구분하며 공통 정책은 바꾸지 않았다.

유료 AI·SNS/트렌드 수집·Drive 삭제 outbox는 계속0이다. Web Push와 예약 리마인더/마감 작업은 각각 승인된 독립 flag로1이며 BACKGROUND0의 수집·삭제 작업을 재개하지 않는다.

01:44 독립 복구에서는 01:10 백업의 전체 파일 바이트, 회사6표·메신저27표의 schema·모든 논리 행, 원래 키·VAPID 암호문이 일치했다. 복호화·VAPID 키 쌍·계정 관계·두 DB 무결성·외래키 검사도 통과했고 푸시 등록/큐는0이다. 입력 snapshot·archive는 불변이며, `network none` 격리 복구본은 `PREPARATION_INCOMPLETE`를 유지해 시작을 차단했다. 운영 DB 접근0·서비스 조작0이며 과거 snapshot과의 대조이지 현재 writer 중지나 정기 백업 실행 증거가 아니다. 근거: `.tmp/company-cloud-20261008/work-v5-offsite-independent-restore-result.json`. 이전00:19 복구 증거도 그대로 보존한다.

## 첫 정시 백업 확인 예약 이력 — 2026-10-09 01:25 KST

10월 9일 **03:50 KST**에 한 번 정시 실행 증거를 읽는 host timer가 설치돼 있다. 원래 일일03:30+무작위 최대15분+정확도1분 계약과 7개 unit은 유지했고, 서비스 재시작 뒤 최신 예정값은 03:38:59다. 확인기는 03:30~03:46 창과 실제 trigger→invocation 90초 이내·같은 boot의 업로드 완료·checksum·후속 FRESH를 대조한다. AI·메일·외부 API를 호출하지 않고 운영 DB·환경 본문도 읽지 않는다. 재부팅 뒤에도 예약을 보존하고 결과가 있으면 재실행하지 않는다.

현재는 예약 설치 완료이며 미래의 정기 실행은 미확인이다. 결과는 `/srv/synk/scheduled-backup-proof-20261009/result.json`에 남는다. 계획 변경·진행 중·증거 부족은 확인 필요로 기록하며 자동 재시도나 서버 조작은 하지 않는다. v2 합성10/10·실제 loaded timer 계약·unit 검증을 통과했다. 근거: `.tmp/company-cloud-20261008/scheduled-backup-observer-v2-install-result.json`, `scheduled-backup-window-v2/preparation-result.json`.

공식 Codex heartbeat `synk-2`는 **03:55 KST 한 번만** 새 결과를 읽고 필요한 경우 기존 권한으로 GCS 객체를 읽어 대조하는 후속 작업이다. 로컬 PC와 Codex 앱이 켜져 있어야 이 후속이 실행되며, 클라우드 백업과 03:50 서버 확인기는 PC와 독립적으로 실행된다. 서비스 재시작·수동 백업·배포·정책 변경·유료 AI를 수행하는 예약이 아니며 주기 감시로 바꾸지 않는다.

2026-10-09 후속 완료: 위 예약은 03:55에 실제 실행되어 진행 중인 마지막 인수에 합쳤다. 백업 확인 뒤 서비스 재시작1회와 직원 무재로그인 인수까지 완료했고, 공식 도구에서 PAUSED 처리하여 더 실행하지 않는다. 원래 일일 서버 백업·30분 감시 타이머는 계속 운영한다.


## 10-09 05:45 통합 로그인 추가 반영 완료

회사 SSO v8 `e696b9efeed7`(440파일/image `021805a5c67e…`)를 기존20fda에서 반영했다. Linux766/766·Windows764통과/2symlinkskip·인증219/4정상교체 통과. 계정 전환 중 늦은 응답의 이전 계정 자료 노출을 수정했다. 05:32 수동백업1회: 같은 boot/unit/cgroup/root PID/실행시간으로 완료 로그를 귀속하고 archive SHA·업로드 marker를 대조했다. journald의 파생 invocation 필드가 빠진 원래 실패 기록도 보존하며 중복 백업은 하지 않았다.

정지 사본 대조에서 schema0변경, 기동 전 만료 token1삭제와 평문/연결이 같은 직원 암호문1재암호화만 확인했다. capture SSH 연결은 먼저 끝났지만 원격 사본·안전 재개 영수증을 회수했고, 05:45 main/3timers active·healthy, 공개17파일 SHA/MIME 일치다. 기존 직원/고객 탭 reload 후 재로그인0·원래 메모/111B Drive첨부/23:33 상담 초안 보존, 직원7/고객1의 동일session/CSRF/TTL·원키/VAPID/업무자료 대조 통과. 유료AI/BG0 유지. SSO 검수는 직접 사용자 보류 지시이며 PASS가 아니다. 메신저 복구 v5는 별도 검수·Linux 인수 중이고 아직 운영반영하지 않았다.

최신 근거: `.tmp/platform-unified-login-20261009/company-linux-v8/FINAL-ACCEPTANCE.json`, `../company-linux-v7/COORDINATION.json`. 실제 새 네이티브 Platform 입구 인수는 공개 웹→PC 담당이 이어 한다. 폰/PC종료/실푸시·전체클라우드Claude·실제09시마감은 별도다.
