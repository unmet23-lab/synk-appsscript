# 작업 환경 자동 진단 0.1

Claude(Opus) 기획과 Fable 사전 설계 검토(2026-11-09)를 반영한다. 기존 Rust 앱의 다음 구성요소이며, 첫 배포는 독립 실행 파일이다. 기존 GUI·백업 엔진·설정·예약·로그인에는 연결하거나 변경하지 않는다.

## 목적과 범위

새 노트북에서 일을 이어가기 위해 현재 사용자에게 필요한 작업 자료·AI 설정·프로그램 정보를 자동 발견하고, 현재 백업 앱의 **지정된 경로**와 대조한다. 발견·백업 지정·실제 원격 복구 검증은 별개다. 프로그램 재설치, 인증 이전, 원본 복사, 완전 복구를 실행하거나 보장하지 않는다.

설치 레지스트리, 현재 사용자 MSIX, 알려진 실행 파일의 위치를 수집한다. KnownFolder API로 사용자 폴더를 찾고 AI 도구 기본 경로와 허용된 환경변수를 확인한다. 고정 디스크의 깊이 4 탐색에서 프로젝트 표시 파일·AI 디렉터리 이름을 찾는다. 확정된 루트 안의 파일명·확장자·크기·속성만 집계한다. 프로젝트 내부 내용과 Git 원격 주소, 비밀번호, 대화·환경파일 값은 읽지 않는다. 유일한 내용 읽기는 고정된 기존 앱 설정 파일의 안전 필드 추출이다.

## 읽기 전용 경계 — Fable F1~F8 반영

1. 보고서는 기본 LocalAppData 아래 **새 폴더**에 만든다. 기존 부모가 필요하고 `create_dir` 한 번과 파일별 `create_new`만 쓴다. 덮기·이동·정리·삭제하지 않는다. 지정 출력 경로는 알려진 클라우드 동기화 경로·재분석점·상위 재분석점을 거절한다. 앱 자체는 업로드하지 않지만 제삼자 동기화까지 통제한다고 주장하지 않는다.
2. Windows FindFirstFile/FindNextFile의 캐시된 메타데이터를 사용한다. 재분석점, offline, recall-on-open/data-access는 열거나 따라가지 않는다. 조상도 GetFileAttributes로 검사하며 canonicalize하지 않는다. 온라인 전용 자료는 누락 사유로 보고한다.
3. 루트는 고정 로컬 드라이브의 절대 경로만 허용한다. UNC·장치·상대 경로·상위 이동·다른 사용자·시스템 디렉터리를 거절한다. 환경변수의 거절된 값은 보고하지 않는다.
4. 설정 읽기는 RoamingAppData/SoloWorkBackup/cloud-vault/settings.json 고정, 256KiB 상한, sources/automatic만 역직렬화한다. unknown·not_found·oversize·invalid를 구별한다. 키·버킷 등 다른 필드를 출력하지 않는다.
5. node_modules는 형제 package.json, target은 형제 Cargo.toml, venv는 자식 pyvenv.cfg가 있을 때만 탐색을 줄인다. 모두 재생성 **후보**로 기록하고 삭제 판단을 하지 않는다. 일반 data/output/build/dist와 Git 이력은 제외하지 않는다.
6. MSIX는 검증된 시스템 PowerShell의 고정 명령만 실행한다. 사용자 프로필·모듈을 로드하지 않고, 시스템 모듈 경로·작업 폴더를 고정한다. 30초/2MiB 상한, 정확한 자식만 종료한다. 실패를 0개 발견으로 처리하지 않는다.
7. 외부 표시 문자열은 제어·방향·보이지 않는 문자를 제거하고 길이를 제한한다. JSON 경로는 원문과 표시용을 나누고 손실성 인코딩을 표시한다. 알려진 경로의 부재·거절·접근 불가도 남긴다.
8. 기본 120초/40만 항목, 디렉터리 2만 항목, 깊이 64 상한이다. 상한·권한 오류는 부분 탐색으로 남긴다. 겹친 루트는 한 번 걷고 합계는 경로 기준 논리 크기다. 하드링크·압축·중복제거·과금 용량을 뜻하지 않는다.

## 결과와 검증

inventory.json과 한국어 backup-plan.txt를 만든다. 원본 변화가 가능한 실시간 탐색이며 일관된 스냅샷이 아니다. 브라우저 로그인, DPAPI, 열린 SQLite, WSL/Docker, 온라인 서비스, 다른 사용자와 운영체제 이미지가 미해결 범위임을 밝힌다. 런타임 외부 AI·네트워크 통신은 없다.

고정 데이터 시험으로 원문 보존, 비밀값 비노출, junction/조상 차단, 클라우드 속성, 제한 시 부분 상태, 경로 겹침, 출력 충돌, 설정 투영과 컨텍스트별 제외를 검증한다. 실제 PC 보고서는 공개 저장소·AI 검수 묶음에 넣지 않는다. 실제 EXE로 진단한 뒤 같은 소스의 GPT·Claude 백엔드 검수와 공개 검사를 통과시킨다.

근거: 기존 앱 [비교 조사](../../solo-backup/RESEARCH.md), [WinGet export](https://learn.microsoft.com/en-us/windows/package-manager/winget/export), [import](https://learn.microsoft.com/en-us/windows/package-manager/winget/import), [DPAPI](https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata), [VSS](https://learn.microsoft.com/en-us/windows/win32/vss/the-vss-model). 설치 목록은 데이터·라이선스·로그인 복원을 대신하지 않는다.

