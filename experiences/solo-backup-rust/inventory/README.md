# Windows 작업 환경 자동 진단

프로그램·AI 작업 자료·설정의 위치를 찾고, 새 노트북에 무엇을 가져가야 할지 보고서로 정리하는 Rust 구성요소다. 기존 업무 백업 앱에 통합하기 전 **독립 진단판 0.1.0**이며 GUI와 자동 백업 설정은 바꾸지 않는다.

`WorkBackupInventory.exe`를 인수 없이 실행하면 현재 사용자의 알려진 폴더와 고정 디스크의 프로젝트 후보를 자동 탐색한다. 결과는 `%LOCALAPPDATA%/WorkBackupInventory-report-<시각>-<프로세스>/`의 짧은 `backup-plan.txt`, 세부 `inventory-details.txt`, `inventory.json`에 새로 저장된다. 원본 복사·수정·삭제·외부 업로드·설치·로그인은 하지 않는다. 관리자로 실행할 필요가 없다.

```powershell
.\WorkBackupInventory.exe
# 기본 위치 밖의 업무 폴더를 추가할 때
.\WorkBackupInventory.exe --root 'D:\MyProjects'
# 기존 부모 아래 새 출력 폴더와 최대 탐색량을 지정할 때
.\WorkBackupInventory.exe --output 'D:\PrivateReports\new-report' --seconds 180 --max-entries 600000
```

범위: 설치 레지스트리, 현재 사용자 MSIX, 실행하지 않는 PATH 프로그램 힌트, 문서·바탕화면·미디어, Codex/Claude/Gemini/Ollama·편집기·Blender 설정, SSH 등 민감 자료 위치, 프로젝트 표시 파일, LoRA/ComfyUI/학습 데이터 폴더명. 실제 앱 사용 여부나 문서 의미를 추측하지 않는다. 사용자 지정 위치는 반복 `--root`로 추가한다.

MSIX AI 앱은 PackageFamilyName으로 사용자 데이터 위치도 짚되 일관된 내보내기가 필요한 후보로 남긴다. 폴더명만으로 유일본과 다시 받을 수 있는 모델을 구별하지 못하므로 추천 위치는 확인 대상이다. 캐시 추정 폴더의 하위 `--root`가 상위 후보와 겹치면 제외될 수 있어 상세 보고서를 확인해야 한다([남은 품질 항목](QA.md#검수와-비용)).

기본 120초·40만 메타데이터 항목까지이며 큰 PC에서는 부분 결과다. 설치 목록은 구성요소·복수 버전이 포함돼 앱 개수와 다르다. 파일 내용·대화·키 값은 읽지 않으며, 기존 백업 앱의 고정 `settings.json`에서 `sources`·`automatic`만 제한적으로 추출한다. 설정 경로에 포함된 사실과 실제 백업·복구 성공을 구분한다.

보고서의 크기는 관찰한 경로 기준 논리 크기다. 부모·자식 폴더 값은 겹치므로 더하면 안 된다. 동기화 전용 파일·링크·권한 오류·탐색 상한은 미확인 사유로 남긴다. 가상환경·의존성 폴더를 문맥에 따라 생략하지만 고유 변경이 없다고 보장하거나 지우지 않는다. WSL/Docker·열린 DB·로그인·라이선스·Windows 복원은 별도 절차다.

`incomplete`는 제한·오류, `excluded`는 의도적 제외다. `scan_complete`는 정해진 탐색 범위의 완료 여부일 뿐 전체 PC의 모든 자료를 조사하거나 보호했다는 뜻이 아니다.

실제 PC 목록에는 개인 경로가 포함된다. 보고서는 공개 Git·검수 AI에 넣지 않는다. 진단기는 통신하지 않지만 다른 동기화 프로그램이 로컬 보고서를 동기화하는 것까지 막지 않는다.

## 개발과 검증

Windows MSVC Rust 1.90 이상에서 아래처럼 독립 빌드한다. Tauri·Node 런타임은 필요 없다. MSIX 목록에만 Windows 기본 PowerShell을 숨김 모드로 사용한다.

```powershell
cargo test --locked --manifest-path experiences/solo-backup-rust/inventory/Cargo.toml
cargo build --release --locked --manifest-path experiences/solo-backup-rust/inventory/Cargo.toml
```

[설계·읽기 전용 경계](DESIGN.md), [검증 결과](QA.md). 네이티브 시험은 원본·출력 보존, junction/조상 차단, 클라우드 속성, 제한·중복 경로, 설정의 비밀값 비노출을 확인한다. 시험 fixture는 새 LocalAppData 폴더에 남겨 원인 확인이 가능하며 자동 삭제하지 않는다.

다음 통합은 이 라이브러리 결과를 앱에서 추천 백업 범위로 보여 주고, 사용자가 보호를 시작한 뒤에만 암호화 백업과 새 PC 복구 검증으로 잇는다. 이 판의 실행만으로 보호 범위가 늘어나지는 않는다.
