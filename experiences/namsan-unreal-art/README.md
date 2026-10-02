# 남산 Unreal · 풍경 먼저 확인하기

Unreal Editor 설치만 끝나면 C++ 빌드 도구 설치와 독립적으로 풍경을 임포트·렌더할 수 있도록 준비한 **에디터 전용 비교 프로젝트**다. 프로젝트 C++ 모듈과 Source 폴더가 없으며, 엔진에 포함된 Python 플러그인을 사용한다. 기존 `../namsan-unreal/`의 C++ 게임 프로젝트와 원본은 보존한다.

현재 준비된 것은 실행 경로와 소스다. 이 프로젝트의 실제 임포트·렌더 성공은 아래 명령이 새 보고서와 PNG를 만든 뒤 확인해야 한다. 이동·점프·한국어 퀴즈·의상 UI를 여기서 실행했다고 주장하지 않는다.

## 엔진 설치 후 한 번에 비교 이미지 만들기

이 폴더에서 PowerShell로 실행한다.

```powershell
./Tools/Run-Art.ps1 Compare
```

기본 엔진 위치는 `C:/Program Files/Epic Games/UE_5.8`이다. 다르면 `-EngineRoot '실제 엔진 경로'`를 덧붙인다. 스크립트는 설치나 C++ 컴파일을 실행하지 않는다. 전체 에디터의 실제 렌더러를 사용하므로 그래픽 드라이버·엔진 셰이더 준비는 여전히 필요하다. 첫 실행은 셰이더 준비 때문에 오래 걸릴 수 있다.

공통 `../namsan-unreal/Content/Python/build_namsan.py`의 재질·조명·임포트 코드를 그대로 호출하고, 게임 모드만 내장 `Engine.GameModeBase`로 설정한다. 원본 모델·질감은 `../namsan-urp/Assets/Art`에서 읽는다. 비교 카메라와 PNG 검증도 기존 `render_comparison.py`를 사용한다. 두 프로젝트의 설정과 아트 코드가 다른 사본으로 갈라지지 않도록 래퍼만 두었다.

성공한 실행의 결과는 다음에 기록한다.

- `QA/unreal-import-report.json`: `art_only: true`, 실제 임포트·재질 슬롯·원본 해시
- `QA/Unreal/01-garden.png`: 정원 전체
- `QA/Unreal/02-mongle.png`: 펠트 몽글·망토·베레모
- `QA/Unreal/03-terrace.png`: 전망 구간
- `QA/Unreal/render-report.json`: 실제 엔진 버전, 새 PNG 3장·해상도·SHA-256

이미 임포트한 뒤 카메라만 다시 찍으려면 `./Tools/Run-Art.ps1 Render`, 에디터로 직접 살펴보려면 `./Tools/Run-Art.ps1 Open`을 사용한다. 아트 프로젝트의 맵과 .uasset은 이 폴더에 생성되어 기존 게임 프로젝트를 덮어쓰지 않는다. 이후 C++ 게임 쪽에서는 기존 BuildEditor → Import → Render 흐름으로 동일 소스를 적용한다.

[Epic의 Python 에디터 자동화 문서](https://dev.epicgames.com/documentation/unreal-engine/scripting-the-unreal-editor-using-python)는 내장 Python 플러그인으로 자산·레벨을 자동화하는 경로를 설명한다. Python은 에디터에서 사용하는 도구이고 패키지 게임의 런타임을 대신하지 않는다.
