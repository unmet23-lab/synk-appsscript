# 업무 백업 · 경쟁 제품과 사용자 경험 조사

확인일: 2026-11-09. [제품 범위](README.md) · [검증 기록](QA.md). 이 문서는 기능 도입의 근거이며 타사 제품의 자체 실기 시험 결과가 아니다. 공식 도움말로 지원 기능을, 원문 후기로 사용자가 좋거나 불편하다고 느낀 이유를 구분했다.

## 조사 범위와 해석

20개 제품·도구군을 조사했다. 클라우드 포함형, 저장소를 별도로 연결하는 백업, 디스크 이미지, 동기화·OS 기본 기능을 나눴다. 앞 판에서 비교했던 restic·Kopia·Resty도 포함했다. 시장의 모든 앱이나 모든 후기를 수집한 전수조사는 아니다.

최근 30일 수집은 last30days의 Reddit·Hacker News·YouTube 검색으로 2026-10-09~11-08 UTC를 대상으로 했다. 원자료는 Reddit 10개 글과 HN 22개 글, YouTube 0개였다. HN에는 일반 Windows 뉴스가 많이 섞여 있어 32개를 유효한 백업 후기 표본으로 세지 않았다. Reddit에는 신제품 홍보·계정 질문도 섞였다. 직접 경험의 원문을 다시 열어 선별하고 2025~2026년 장기 사용 후기로 보완했다. YouTube 0건은 긴 복합 검색어로 얻은 결과이며 관련 영상이 없다는 뜻이 아니다. X는 수집하지 않았다. 유료 수집 API는 사용하지 않았다.

검색으로 발견한 불만 글은 문제를 겪은 사람이 과대표집된다. 회사가 인용한 추천사, Trustpilot의 AI 요약, 판매 제휴 비교 글은 독립적인 사용 경험으로 세지 않았다. 글쓴이의 데이터 손실 주장도 원인·재현이 확인되지 않으면 사용자 보고로만 적었다. 2024년 이전 후기는 현재 결함의 증거로 쓰지 않았다. macOS 경험을 Windows 검증으로 바꾸지 않았다.

## 20개 제품의 기능과 적용 가치

| 제품·도구 | 확인한 주요 기능 | 편의 측면에서 가져올 점 | 운영·범위 차이와 주의 |
|---|---|---|---|
| **Backblaze Computer Backup** | 자동 연속 백업, 내장·외장 드라이브의 지원 파일, 복구 앱·웹·배송 복구, 버전 이력 | 적은 초기 설정, 평소 백그라운드 실행, 복구 입구가 분명함 | 우리 저장소인 **B2와 별도 제품**. OS 전체 이미지가 아님. 기본 30일 이력, 무료 1년 이력은 활성화 필요. [제품](https://www.backblaze.com/cloud-backup/personal) · [이력](https://www.backblaze.com/cloud-backup/features/extended-version-history) |
| **Arq 7 / Arq Premium** | 로컬·NAS·여러 클라우드, 클라이언트 암호화, 중복 제거, 버전·파일 검색·선택 복구, 예약·일시정지 | 실패 원인을 행동으로 연결, 저장소 선택을 고급 설정으로 분리, 검증 비용 설명 | 일반 Arq는 저장소 별도, Premium은 저장소 포함. 운영체제별 기능·출시 시점 차이. [제품](https://www.arqbackup.com/) · [복구](https://www.arqbackup.com/documentation/arq7/English.lproj/restore.html) · [검증](https://www.arqbackup.com/documentation/arq7/English.lproj/validate.html) |
| **IDrive** | 여러 기기, 로컬·클라우드, 파일·전체 기기, 이전 버전, Express 디스크 배송, true archiving | 기기 교체 후 익숙한 폴더 구조로 찾아 복구, 파일 검색, 로컬 사본 병행 | 원본 삭제가 보관본 삭제와 같지 않음. 사용자는 오래된 파일이 복구에 섞이는지 혼동할 수 있음. 용량·초과 사용·갱신 가격을 별도 확인해야 함. [기능](https://www.idrive.com/en-gb/online-backup-features) |
| **CrashPlan Endpoint** | 자동 변경 백업, 중앙 관리, 버전·삭제 파일 보관, 기기 이전·자가 복구 | 미실행 감지와 기기 교체 안내, 관리 화면의 한곳 모으기 | 과거 Small Business·Essential을 현행 신규 요금제로 안내하면 안 됨. 현행 Endpoint와 Enterprise 구분. [현행 상품](https://support.crashplan.com/hc/en-us/articles/9802774807821-CrashPlan-Products-and-Subscription-Plans) · [Endpoint](https://smb.crashplan.com/endpoint/) |
| **Carbonite Safe** | 자동 백업, 파일 상태 표시, 복구 모드, 암호화, 파일 복구 | 파일마다 포함 여부를 알기 쉬움, 복구하는 동안 백업 정책 혼동 방지 | Safe·Pro 및 요금제별 지원과 삭제 보관 기간이 다름. 동영상·외장 드라이브가 자동 포함된다고 가정하지 말 것. [백업 설명](https://support.carbonite.com/articles/Safe-Pro-Storage-vs-Backup) · [보안](https://support.carbonite.com/articles/Data-Security-for-Carbonite-Safe-and-Safe-Backup-Pro) |
| **Acronis True Image** | 파일·디스크 이미지, 복제, 부팅 복구, 클라우드 옵션, 보안·랜섬웨어 방어, 2026 패치 관리 | 백업과 PC 건강을 한 앱에서 보여 주는 확장 사례 | 모듈을 한꺼번에 켜면 자원·설정 부담. 제품·요금제별 클라우드 용량 차이. OS 복원은 우리 파일 복구와 다름. [제품](https://www.acronis.com/en/products/true-image/) · [2026 발표](https://www.acronis.com/en/pr/2025/introducing-acronis-true-image-2026-the-first-consumer-cybersecurity-and-backup-tool-with-built-in-patch-management/) |
| **Macrium Reflect X** | 디스크 이미지·복제, 예약, 복구 매체, Image Guardian, 변경 부분 중심 복구 | 백업 완료보다 실제 Windows 복구 성공을 중시, 명확한 복구 경로 | 클라우드 포함형 소비자 서비스와 비용 구조가 다름. 부팅 매체와 대상 디스크 확인 필요. [Home](https://www.macrium.com/products/home) |
| **Veeam Agent for Windows** | 전체 PC·볼륨·파일 백업, 외장·네트워크 대상, 파일 단위 복구, Recovery Media | 복구 매체 준비 상태, 원래 PC가 없어도 복구하는 절차 | 무료·유료·중앙 관리판 기능 차이. 별도 저장소·복구 USB가 필요하며 우리 앱의 범위를 넘어섬. [무료판](https://www.veeam.com/products/free/microsoft-windows.html?ad=downl) · [복구 매체](https://helpcenter.veeam.com/docs/agentforwindows/userguide/recovery_media.html) |
| **Synology Active Backup for Business** | PC·서버 중앙 백업, 중복 제거, 변경 블록, 포털 검색·복구, 예약·이벤트 실행 | 여러 기기의 보호 상태, 누락·오류 보고, 직원이 스스로 복구 | Synology NAS 및 지원 파일 시스템 필요. VM 검증을 모든 PC의 자동 부팅 검증으로 확대 해석하지 않음. [사양](https://www.synology.com/en-eu/dsm/7.2/software_spec/abb) |
| **EaseUS Todo Backup** | 시스템·디스크·파일 백업, 예약·증분·복제, 일부 클라우드 기능, Smart Backup | 놓친 예약을 다음 시작 때 실행, 보통 설정과 전문가 설정 분리 | Smart Backup 대상·주기 제한, Free의 개인용 라이선스와 업무 사용 구분. [도움말](https://www.easeus.com/support/todo-backup/) · [Smart Backup](https://kb.easeus.com/todo-backup/10071.html) |
| **AOMEI Backupper** | 파일·시스템·디스크, 예약·이벤트·USB 연결 트리거, 자동 정리·복제 옵션 | 외장 드라이브 연결 시 시작, 간단한 기본 일정 | 유료 기능·업무용 판 구분. 이벤트·자동 정리 기능을 무료판 기능이라고 안내하지 않음. [비교](https://www.aomeitech.com/ab/comparison.html) · [예약](https://www.aomeitech.com/ab/help/how-to-schedule-backup.html) |
| **Kopia / KopiaUI** | 암호화 스냅샷, 중복 제거·압축, 보존 정책, 로컬·NAS·클라우드, 선택 복구·검증 | 엔진은 강하게, 사용자가 보는 개념은 스냅샷·복구로 단순하게 | 저장소·키·정책을 직접 구성. 같은 저장소 비밀번호 공유를 고객 간 격리로 착각하면 안 됨. [기능](https://kopia.io/docs/features/) |
| **Duplicati** | 암호화·블록 증분, 여러 저장소, 예약·이력, 웹 UI, 중앙 관리·알림 제품 | 작업·오류·점검을 한곳에서 확인 | 오픈소스 엔진과 상용 관리 서비스를 구분. 오래된 베타판 실패 후기를 현행 모든 버전의 결함으로 쓰지 않음. [공식](https://duplicati.com/) |
| **Duplicacy** | 여러 저장소, 중복 제거, 백업·복제·점검·정리 일정, 대시보드 | 백업 뒤 확인과 정리의 연결, 별도 사본으로 복제 | 저장소 별도. 개인 비상업 CLI 무료 조건을 상용 앱 라이선스로 확대하지 않음. [공식](https://duplicacy.com/) |
| **restic / Resty 계열 GUI** | restic은 암호화·중복 제거·검증·버전·복구 엔진, GUI가 사용 편의 보완 | 검증된 엔진을 앱에 포함하고 명령어·설치 경로 입력을 없앰 | restic 자체는 일반 고객용 가입·과금·키 복구 서비스가 아님. Resty 사례는 성숙한 상용 제품의 점유율 증거가 아님. [restic](https://restic.net/) · [GUI 사용자 글](https://www.reddit.com/r/restic/comments/1u8v419/desktop_gui_for_restic/) |
| **Windows Backup / OneDrive** | Microsoft 계정 기반 설정·지원 폴더 보호, 새 PC 이전 안내, 파일 이력·휴지통 | 계정으로 새 PC에서 돌아오는 경험, 익숙한 폴더 | 동기화 폴더의 이동·삭제·클라우드 전용 파일에 혼동 가능. 모든 앱·모든 파일·OS 이미지가 복원되는 것은 아님. [폴더](https://support.microsoft.com/en-us/onedrive/back-up-your-folders-with-onedrive) · [새 PC](https://www.microsoft.com/en-us/windows/transfer-your-data-with-windows-backup) |
| **Dropbox Backup** | 선택한 PC 폴더·외장 드라이브 백업, 일정, 진행률, PC·웹 복구 | 새 방식은 원래 위치 유지, 백업과 일반 공유 폴더 혼동 줄임 | 제품 판·계정·드라이브별 지원 제한 및 할당량 확인. 일반 Dropbox 동기화와 별도 기능. [개요](https://help.dropbox.com/organize/dropbox-backup-overview) · [새 방식](https://help.dropbox.com/organize/dropbox-backup?fallback=true) · [FAQ](https://help.dropbox.com/organize/dropbox-backup-faq) |
| **Google Drive for desktop** | 스트리밍·미러링, 컴퓨터 폴더 동기화·사진 백업 선택 | 이미 쓰는 계정과 폴더 접근, 적은 수동 전송 | 클라우드 전용 자리표시자는 로컬 파일과 다름. 동기화 삭제·계정 접근 문제까지 별도 백업이 해결하는지 확인해야 함. [공식 안내](https://support.google.com/drive/answer/10838124?hl=en) |
| **Syncthing** | 기기 간 직접 동기화, 변경 블록 전송, 선택적 버전 관리 | 여러 PC 사이 작업 이어 하기의 후보 | 기기들이 온라인이어야 함. 삭제·변경도 전파되므로 기본 동기화를 독립 백업으로 부르면 안 됨. [공식 FAQ](https://docs.syncthing.net/users/faq.html) |
| **Time Machine** | 한 번 디스크 지정 후 자동 백업, 시간별·일별·주별 이력, 용량에 따른 정리, 파일·기기 복구 | 평상시 조작 최소화, 날짜를 골라 돌아가는 간단한 복구 | **Mac 전용 UX 참고**. 별도 디스크와 암호 관리가 필요. Windows 기능으로 제시하지 않음. [Apple 안내](https://support.apple.com/en-us/104984) |

## 실제 사용자 반응에서 확인한 것

다음은 선정한 원문 사례다. 같은 글의 댓글은 독립 설문 표본으로 합산하지 않았다. 날짜는 검색 결과의 작성 날짜와 원문 문맥을 함께 봤으며, 사이트의 상대 날짜·크롤링 날짜와 다를 수 있다.

| 출처·기간·맥락 | 호평 또는 불편 | 우리 앱에 주는 의미 |
|---|---|---|
| [Arq 선택 이유](https://www.reddit.com/r/Arqbackup/comments/1u1xs1f/why_did_you_choose_arq_over_kopia_restic/), 2026-06~07, Mac 장기 사용자 댓글 | 약 20TB·여러 저장소 사용자가 단계가 적고 v7을 오래 쓸 수 있는 점을 호평. 다른 댓글은 구체적 버그 제보에 개발자가 빠르게 답하고 고친 점을 호평. 초기 v7 특정 저장소 복구 실패 경험도 함께 있음 | 새 기능 수보다 적은 조작, 실행 결과, 고장 설명·지원 경로. 이 댓글을 Windows 안정성 시험으로 세지 않음 |
| [Backblaze 복구 경험](https://www.reddit.com/r/backblaze/comments/1vi1vwd/restore_app_is_essentially_useless/), 2026-08 이후 | 원글은 로그인·멈춤 불만. Peeeeeps는 6년 된 PC로 약 1.5TB를 밤사이 추가 조작 없이 복구한 경험을 보고. 배송 복구를 선호하는 댓글도 있음 | “복구 버튼이 있다”와 실제 대량 복구 성공은 별개. 성공·실패 모두 기록하고 우리 데이터 규모로 직접 시험 |
| [Backblaze 새 복구 도구](https://www.reddit.com/r/backblaze/comments/1vzox56/the_new_restore_tool_is_dire/), 2026-08, Windows 11 | 여러 작은 복구로 쪼개고 상태를 지켜봐야 하는 부담 | 후속 우선순위: 파일 검색·선택 복구 → 복구 재개·자동 재시도 → 진행 설명. [공식 수정 기록](https://www.backblaze.com/computer-backup/docs/restore-app-release-notes-windows)에 이후 수정이 있으므로 과거 오류를 현재 전부 미해결로 쓰지 않음 |
| [Backblaze 진행률 반복](https://www.reddit.com/r/backblaze/comments/1x18hv7/backblaze_keeps_resetting_my_backup_progress/), 2026-10, Windows·5.5TB·외장 두 개 | 업로드 잔여량이 다시 늘고 장기간 완료를 확신하기 어려웠다는 상세 보고. Mac 댓글도 있지만 OS를 분리 | 진행 중 수치와 **마지막 확인된 완료 시각**을 함께 표시. 실행 예약·시작을 백업 완료로 표시하지 않음 |
| [Backblaze 검색 결과 일괄 선택](https://www.reddit.com/r/backblaze/comments/1x40447/shift_select_or_select_all_from_backblaze_restore/), 2026-10 | 수천 폴더에 흩어진 작은 메타데이터 파일 6,500개만 복구하려는데 하나씩 선택해야 하는지 묻는 사례 | AI 작업의 모델 파일과 설정·캡션을 분리해 찾는 요구와 가깝다. 후속 선택 복구에는 검색 결과 전체 선택·예상 복구량 표시를 함께 넣기 |
| [Backblaze 외장 드라이브가 안 보임](https://www.reddit.com/r/backblaze/comments/1xr4qjf/computer_backup_forgot_about_my_2_external_drives/), 2026-11-08, macOS·구버전 클라이언트 | 원글은 보관본 소실로 이해했으나 댓글은 마지막 연결 날짜를 선택하면 보인다고 안내하고 글쓴이도 이해를 정정 | 실제 소실과 현재 날짜 화면에서 제외된 상태를 구분. “최신본 하나” UI도 사라진 드라이브·이전 시점을 찾는 입구가 필요함 |
| [Carbonite 전환 논의](https://www.reddit.com/r/Backup/comments/1qty6ve/carbonite_time_to_switch_and_to/), 2026-02 이후, Windows 11·3TB | 기본 제외된 동영상을 몰랐다는 경험. mpking828는 Backblaze의 기본 선택과 체감 자원 부담이 적은 점을 호평. JohnnieLouHansen는 장기 IDrive 사용과 검색·버전·로컬 병행을 호평 | 백업 범위를 숨기지 않기. “전부 보호” 대신 사용자가 확인한 폴더·파일 수 표시. 사전 선택에는 동의 필요 |
| [IDrive 데이터 접근 문제](https://www.reddit.com/r/DataHoarder/comments/1t1s643/idrive_lost_all_of_my_backup_data/), 2026-05 | 원글 제목은 데이터 손실이지만 후속 내용은 장기 접근 장애 뒤 복구. 댓글에는 테스트 복구 성공·응답 호평도 있음 | 원제목만으로 영구 손실을 확정하지 않음. 원격 접속과 실제 읽기 확인, 다른 날 재시험 필요 |
| [IDrive에서 다른 앱으로](https://www.reddit.com/r/Backup/comments/1nwzuwx/switching_from_idrive_but_to_what/), 2025-10 | 삭제한 파일까지 최신 복구에 돌아오는 모델을 원치 않는 사용자의 혼동 | 최신 폴더 상태와 이전 시점은 분리. 내부 보존 이력을 최신본에 섞지 않기 |
| [IDrive NAS 후기](https://www.reddit.com/r/Backup/comments/1sz8t7i/is_idrive_this_good_backing_up_large_single_nas/), 2026-04~05 | 구형 NAS·대형 변경 파일·권한·속도 문제 | 구형 NAS 경험으로 Windows판 속도를 단정하지 않음. 파일 수·평균 크기·회선·보안 프로그램을 성능 시험에 같이 기록 |
| [CrashPlan 복구 신뢰성](https://www.reddit.com/r/Crashplan/comments/1i9p5bm), 2025-01, 드라이브 고장 | 남은 파일·용량 표시 불일치, 재시작 때 중복 다운로드 부담 | 중단 재개와 완료 목록의 영속 저장이 중요한 후속 기능. 당시 요금제의 경험을 현행 Endpoint 전체 평가로 일반화하지 않음 |
| [Acronis Web Restore 지연](https://www.reddit.com/r/acronis/comments/1vowh1d/when_is_web_restore_become_available_again/), 2026-08, 지원 담당 답 포함 | 2FA 개선으로 웹 복구 이용이 늦어지고 앱·다운로드 도구·부팅 매체 등 대안 안내 | 인증 보안 강화와 복구 가용성을 함께 설계. 현재도 장애 중인지 이 글만으로 확정하지 않음 |
| [Macrium 사용자 평가](https://www.trustpilot.com/review/macrium.com), 2026-02~06 표시 사례 | Windows 업데이트로 망가진 PC를 복구했다는 호평, 상황에 맞는 설정과 지원 응답 호평, 구독 전환 불만 | 장기 유지비·갱신 조건을 투명하게, 복구 시험을 제품 핵심으로. 회사 페이지에 노출된 일부 원문이며 전체 리뷰를 읽은 것은 아님 |

원문 표현도 기능 도입 이유와 함께 남긴다.

> “The reality is, nothing is as simple or requires extra steps to do the same thing.”
>
> — redditor_rotidder, [Arq 장기 사용 댓글](https://www.reddit.com/r/Arqbackup/comments/1u1xs1f/why_did_you_choose_arq_over_kopia_restic/). 익숙함에 따른 편향 가능성을 본인도 언급한다. 적용 가설은 단계 수 감소다.

> “There was nothing to fiddle with and it just worked.”
>
> — Peeeeeps, [Backblaze 약 1.5TB 복구 경험](https://www.reddit.com/r/backblaze/comments/1vi1vwd/restore_app_is_essentially_useless/). 특정 PC의 개인 경험이며 재현 실험이나 일반 성공률이 아니다. 적용 가설은 복구 중 사용자 개입 감소다.

평가 규모 참고: 조회 시 Trustpilot은 [Backblaze](https://www.trustpilot.com/review/www.backblaze.com) 1.8/5·241개, [IDrive](https://www.trustpilot.com/review/www.idrive.com) 2.1/5·1,785개, [Macrium](https://www.trustpilot.com/review/macrium.com) 4.2/5·4,390개였다. 리뷰 모집 방식·고객군·기능 범위가 달라 이 숫자로 백업 성공률이나 제품 순위를 계산하지 않았다. 판매량·실사용자 수를 같은 기준으로 비교할 공개 자료는 이번 조사에서 확보하지 못했다. 나머지 후보의 기능은 확인했지만 독립적인 최신 호평 표본은 부족하다.

## 도입 판단: 기능 → 줄어드는 일 → 확인 방법

| 우선순위 | 적용 내용 | 근거와 사용자 이득 | 수용 기준 |
|---|---|---|---|
| 이번 판 A | 준비된 프로필의 `보호 시작` | Backblaze·Time Machine의 적은 평상시 조작. 사전 점검·Windows 시작 등록·정기 백업·즉시 백업을 연결 | 실패 단계가 보이고, 완료 전에 성공 표시 금지. 원본·복구 전용 연결에는 쓰기 금지 |
| 이번 판 B | 상태 요약과 다음 행동 하나, 고급 설정 접기 | Arq·관리 대시보드와 진행 불만. 전문 용어 해석·버튼 탐색 감소 | 마지막 완료·다음 예정·오류·일시정지를 구분. 오래된 검증으로 최신본 전체 정상 주장 금지 |
| 이번 판 C | 1시간·4시간·12시간 일시정지와 자동 재개 | Arq의 시간 제한 일시정지, 작업 중 부담 완화 | 재시작해도 기한 유지. 꺼진 동안의 시간은 흐르되 앱 실행 후 재개. 진행 중 작업 강제 종료 없음. 내부24시간 이력의 시간은 계속 흐름 |
| 이번 판 D | 작은 파일의 실제 해독 확인 | Macrium 복구 호평·Arq의 테스트 복구 권고·검증 비용 설명 | 최신 완료본에서 일반 파일1개·내용8MiB 이하를 메모리로 내려받아 인증·해독·크기 확인. 평문을 디스크에 남기지 않음. 대상 없음·목록 한도·실패를 통과로 표시하지 않음. 전체 점검·전체 복구와 구분 |
| 0.5.0 적용 | 최신 완료본의 파일 검색·선택 복구 | Arq·IDrive·Synology의 빠른 찾기와 Backblaze 검색 결과 일괄 선택 요구 | 문자 그대로 검색·페이지 전체 선택·총 개수/내용량 표시. 최대1,000개를 새 폴더로 복구하고 원본 보존·파일별 검증. 목록의 기준 시점을 고정하고 실제 완료와 시작을 구분 |
| 후속 | 보관 시점 선택 | 이전 삭제·변경을 찾는 요구 | 최신 완료본 흐름과 분리하고, 내부 보관 정책·별도 이력 요금제 및 저장 상한에 맞춰 설계 |
| 다음 2 | 큰 복구의 중단 후 이어받기 | Backblaze·CrashPlan의 복구 중 개입 부담 | 파일별 해시·완료 장부·재시도·잔여 공간·중단 지점 보존. 실패한 파일을 완료로 세지 않음 |
| 다음 3 | 과도한 삭제·변경 감지와 보호 보류 | 잘못된 최신본이 정상본을 밀어내는 위험 | 이동·개명·일반 정리 오탐, 저장 상한·사용자 해제·보관 기간 설계. 랜섬웨어 탐지라고 부르지 않음 |
| 다음 4 | 일반 고객의 계정 기반 저장소 자동 개통 | 상용 클라우드 포함형의 가입 편의 | 고객별 권한·용량·결제·키 복구·해지·데이터 반출·감사·계정 탈취 대응. 운영자 B2 키 공유 금지 |
| 다음 5 | 배터리·회선·작업 부하 배려와 미실행 알림 | 자동화가 작업을 방해하면 장기 사용이 어려움 | 측정 연결·업로드 제한·CPU 우선순위, 누락 알림 중복 억제. PC가 꺼진 경우 서버가 볼 수 있는 신호부터 설계 |
| 별도 제품 단계 | VSS·전체 Windows 이미지·부팅 복구 | Macrium·Veeam·Acronis | 관리자 권한·드라이버·DB 일관성·복구 매체·다른 하드웨어 시험. 파일 백업에 버튼만 붙여 해결할 수 없음 |

이번 판 항목은 0.4.0에 구현했으며 설치·실기 검증 결과는 [QA](QA.md)의 최종 기록을 따른다. 기존의 암호화·최근 완료본 승격·24시간 내부 이력·원본을 덮지 않는 복구·Google 복구 정보 보관은 이전 판의 기능이다. 표본 확인은7일마다, 과도한 목록으로 건너뛰면30일 뒤 재시도한다. 목록·색인·pack·재시도 전송량은 표본 내용8MiB 한도에 포함되지 않으며 전체 다운로드 상한을 뜻하지 않는다. 첫 회·클라우드30일·로컬1일 전체 점검은 별도로 유지한다.

0.5.0은 위 선택 복구를 이어서 구현했다. 원문의6,500개 일괄 복구 요구를 전부 충족했다고 주장하지 않는다. 현재는 메모리 목록20만 항목·128MiB, 한 번에1,000개 제한이 있고 파일별 실행이므로 대량 성능·API 비용과 이어받기는 다음 단계다. 작은 캡션·설정만 찾고 필요한 파일을 새 폴더에 복구하는 편의를 먼저 검증하며, 시간·비용 절감률이나 사용자 만족도 향상은 실사용 측정 전의 가설이다. [범위와 사용법](README.md#필요한-파일만-골라-복구), [검증](QA.md).

## “클릭 한 번”의 현실적인 경계

**설정을 마친 다음부터 보호를 시작하는 일은 한 번으로 묶을 수 있다.** 신규 사용자는 백업할 폴더와 계정 동의를 처음 한 번 확인해야 한다. 앱이 임의로 개인 폴더를 골라 올리거나 Google 동의·2단계 인증을 대신 끝내는 방식은 채택하지 않는다. 처음부터 B2 키 입력 없이 쓰려면 고객용 계정·저장소 개통 서버가 먼저 필요하다.

현재 앱은 로그인한 Windows에서 실행되는 앱이다. 종료·전원 꺼짐·절전 중에는 백업하지 못한다. 로그인 자동 실행과 주기 확인은 이 제약을 없애지 않는다. PC 분실 뒤에는 다른 PC 설치와 본인 계정 인증이 필요하고, 보안 설정 때문에 재동의를 요구받을 수 있다.

최신 정상본만 주 화면에 보여 주되 내부 24시간 이력은 유지한다. 이것은 장기 버전 보관·불변 보관·랜섬웨어 차단과 다르다. 24시간 뒤 발견한 오삭제까지 보장하려면 이력 요금제와 저장 상한을 설계해야 한다. 작은 파일 복구 성공은 다른 모든 파일, 새 PC의 로그인, OS 부팅 복원 성공을 증명하지 않는다.

대용량 파일은 물리적 회선 제한이 있다. 예를 들어 1TB(십진)를 100Mbps 회선으로 옮기는 이론적 최소 시간은 약 22.2시간이며 실제로는 더 걸린다. 중복 제거·압축의 효과는 데이터에 따라 다르고 미디어·이미 압축한 모델 파일에는 작을 수 있다. 전체 데이터 점검·대규모 복구의 전송량과 저장 이력 비용을 별도로 설계해야 한다.

자동 복구 키 보관은 편리하지만 계정 접근 권한과 복구 가능성이 연결된다. Google 계정에 접근하는 사람이 백업을 읽을 수 있는 현재 모델을 숨기지 않는다. 상용화 전에는 패스키/MFA 안내, 분실 기기 키 폐기·재발급, 고객 격리, 서명 설치·안전한 업데이트, 복구 지원·사고 대응을 검증해야 한다. 이번 시험판 개선을 이 요건이 모두 끝난 유료 서비스 출시로 표현하지 않는다.
