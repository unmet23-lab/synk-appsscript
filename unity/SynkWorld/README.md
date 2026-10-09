# SYNK WORLD 네이티브 앱 기본판

2026-10-09. 승인된 [캐릭터 중심 홈](../../experiences/synk-world-home/README.md)을 Unity 모바일·PC 앱으로 옮기기 위한 **개발 리허설 소스**다. Unity 6000.6.2f1 + URP 17.6.0, UI Toolkit과 공통 C# 상태·서버 계약을 사용한다. 운영 로그인·실제 사용자 데이터·결제·라이브 배포를 연결한 앱이 아니다.

## 이번에 작성한 범위

- 첫 실행 → 둘러보기 / 리허설 계정 연결 → 3D 홈 → 서버가 발급한 초급 읽기 3문항 → 서버 완료·참여 선물 → 앞치마와 목도리 동시 착용 → 서버 차림 복원.
- UI Toolkit: 휴대폰 세로 화면과 하단 메뉴, PC의 왼쪽 메뉴, Safe Area, 최소 44px 버튼, 승인 펠트 부품·SUIT 서체. 실제 네이티브 화면 마감은 Editor·기기에서 이어 확인해야 한다.
- URP 홈: 팔 없는 몽글·목도리·앞치마·목재 테라스·소품·멀리 보이는 산을 실제 메시로 작성. 이번 절차형 모델은 화면용 연구 모델이며 승인된 최종 게임 모델이 아니다.
- 계정 상태를 바꾼 뒤 도착한 응답 무시, 중복 완료의 같은 requestId/답안 재전송, revision 충돌 시 최신 상태 복원 후 재선택, 통신 실패와 빈 상태 구분.
- 앱 중단 뒤 문항 답안을 유지한 일시정지 안내. 재실행 시 비밀이 아닌 `player-a`/`player-b` 선택값으로 **개발 세션을 새로 발급**하고 서버 상태를 다시 읽는다. 운영 세션 복원 구현으로 해석하지 않는다.
- **종료를 넘는 미전송 완료:** 첫 제출 전에 질문·답안·runId·requestId를 `Application.persistentDataPath/rehearsal-pending`에 원자적으로 저장한다. 같은 계정으로 재접속하면 정확히 같은 요청으로 다시 저장할 수 있고, 서버 확인 후 파일을 지운다. 다른 계정은 읽거나 보내지 않는다. 토큰·비밀번호는 포함하지 않는다. 디스크 저장 실패 시 서버 제출도 멈추며, 손상 파일은 임의 삭제하지 않는다.
- 공통 [avatar-contract.json](../../experiences/synk-world-home/avatar-contract.json)의 몽글 ID·단위·높이·정면 방향·코스튬 ID를 네이티브 사본과 대조한다. 현재 정적 [몽글 v4 GLB](../../experiences/synk-world-home/scene-assets/graphics-v4/mongle-v4.glb)(3,684,424B)와 [Blender 편집 파일](../../experiences/synk-world-home/scene-assets/graphics-v4/mongle-v4.blend)에 독립 미세 normal·AO/roughness·정점 색을 포함했다. 계약은 renderVersion 3을 유지하고 materialRevision 4·현재 후보 경로·`rigged:false`·`nativeImportVerified:false`를 명시한다. 동시착용 접촉 음영은 정적이므로 차림 변경에 맞춘 네이티브 처리가 필요하다. **파일 존재와 Blender 가져오기 확인은 Unity 가져오기·실제 렌더 검증을 뜻하지 않는다.** Unity의 절차형 메시와 재질은 이전 시제품이며 공유 모델의 임포트·재질 변환·리깅·렌더 검증은 남아 있다.
- 홈 이미지가 없는 놀이·설정 화면 및 앱 중단에서는 홈 카메라 렌더를 멈춘다. 모바일 30fps, PC 60fps를 목표 프레임 제한으로 설정했다. 화면 높이·Safe Area 변경도 다시 계산한다. 이 수치는 기기에서 확인한 성능값이 아니다.

## 확인된 것과 남은 것

`CoreTests`는 .NET 8.0.425에서 실제 컴파일·실행했다. 순수 C# 흐름·파일 저장·공통 자산 계약 26개와 전체 C# 문법 검사 8개, 합계 **34개 통과**. 결과는 [qa/core-tests.json](qa/core-tests.json)에 있다.

GLB 경로가 추가된 최종 계약으로 C# 34개와 [사전검사 5개](qa/preflight-checks.json)를 다시 통과했다. 웹 정본과 네이티브 계약 사본의 SHA256도 일치한다. 검사 결과의 `nativeAssetAvailable:true`는 자산 경로 선언을 뜻하며 `nativeRendered:false`·`nativeBuildRun:false`는 유지된다.

위 34/5개는 v3 작업 때 실행한 이력이다. v4 후보 경로로 갱신한 뒤에는 [공통 계약 사본의 현재 SHA 일치](qa/shared-avatar-v4.json)를 확인했다. C# 기능과 네이티브 렌더는 이번 그래픽 수정에서 바꾸지 않았다.

**Unity Editor·활성 라이선스·플랫폼 빌드 모듈은 현재 환경에 없어 Unity 의미 컴파일, 씬 생성, 네이티브 렌더, APK/EXE/iOS 빌드, S25/iPhone 15 실기기 검증은 아직 하지 못했다.** 설치 경로에는 메타데이터만 있고 Editor 실행 파일은 없다. adb는 설치돼 있으나 연결 기기가 없고, Blender 5.2.1 LTS는 실행 확인했다. [환경 기록](qa/native-environment.json)은 읽기 전용 점검 결과다. `CoreTests` 통과는 Unity API·USS·URP 실행 확인을 대신하지 않는다.

2026-10-09 사용자 답변에 따라 **이번 범위는 코드·브라우저 검증까지**다. 설치·계정 로그인·라이선스 활성화·실기기 검증을 기다리지 않고 코드 작업을 완료했다. 디스크 여유가 Editor 다운로드 3.86GB보다 적은 상태도 확인했으며 임의 삭제·다운로드·약관 동의를 하지 않았다.

운영 SYNK ID의 시스템 브라우저 OAuth/PKCE·딥링크·OS 보안 저장, 제출 전 문항 진행의 종료 복원, 모바일 실제 성능, 스토어 배포는 다음 범위다. 완료 요청의 로컬 보존과 운영 인증·백그라운드 자동 전송은 별개다. 한국어 IME·OS 화면 읽기·영상 재생과 다운로드·기존 웹게임 이식·타운도 여기서는 완성하지 않았다. 타운·노래 메뉴에는 준비 상태를 사실대로 표시한다.

## 실행 순서

1. `Tools/check-environment.ps1 -WriteReport`로 설치 상태를 읽고, `Tools/sync-avatar-contract.ps1`로 공통 몽글 계약을 동기화한다. 준비된 Unity 6000.6.2f1 Editor와 필요한 플랫폼 모듈로 이 폴더를 연다. 라이선스는 공식 Unity 로그인으로 활성화한다. 이번 요청에서는 설치와 계정 조작을 실행하지 않았다.
2. 패키지 가져오기가 끝나면 메뉴 `SYNK WORLD → Prepare rehearsal project`, 이어 `Open home scene`을 실행한다. URP 설정·Lit 템플릿·씬이 생성된다. 기존 씬 파일이 있으면 덮어쓰지 않는다.
3. 저장소의 WORLD 리허설 API를 `127.0.0.1:4296`에서 실행한다. 기본 주소는 `http://127.0.0.1:4296/api/world`다. 운영 서버로 임의 변경하지 않는다.
4. Play에서 `player-a`로 연결 → 3문항 완료 → 목도리 입기. 별도 클라이언트에서도 같은 가상 계정을 선택하면 동일 서버 저장을 읽는다. `player-b`는 소유권 격리 확인용이다.
5. 설치형 빌드는 `Tools/build.ps1 -EditorPath <실제 Unity Editor exe> -Target Windows` 또는 Android/iOS/macOS를 사용한다. 빌드는 모두 Development이며 출시본이 아니다. iOS 서명·실행에는 macOS/Xcode가 필요하다.

Android 에뮬레이터에서는 씬의 WorldApp `apiBaseUrl`을 `http://10.0.2.2:4296/api/world`로 설정할 수 있다. Android 실제 기기의 로컬 개발은 `adb reverse tcp:4296 tcp:4296` 같은 명시적 디버깅 연결 뒤 확인한다. localhost 링크 자체로 실제 휴대폰에 연결되지는 않는다. iPhone의 실제 기기 연결은 HTTPS 개발 API 및 네이티브 인증을 준비한 뒤 별도로 검증한다.

## API 경계

`WorldApiClient`는 localhost·127.0.0.1·Android 에뮬레이터 호스트의 HTTP 리허설만 허용한다. 세션 토큰은 메모리에서만 유지하며 PlayerPrefs·파일·URL·로그에 쓰지 않는다. 운영 토큰을 여기에 넣는 우회는 제공하지 않는다.

| API | 주요 입력 |
|---|---|
| POST `/api/world/rehearsal/session` | `accountKey`: player-a 또는 player-b |
| GET `/api/world/bootstrap` | Bearer 개발 세션 |
| POST `/api/world/play/start` | UUID `requestId` |
| POST `/api/world/play/complete` | `runId`, `answers[{questionId,optionId}]`, UUID `requestId` |
| PUT `/api/world/avatar/outfit` | `slots{body,neck}`, `expectedRevision`, UUID `requestId` |

서비스 요청에는 `x-synk-product: world`, `x-synk-contract: 1`을 보낸다. API 오류·점수·지급·소유권·착용 조합은 서버에서 확정한다. 목도리 `mongle-scarf-first-steps`, 앞치마 `mongle-apron-starter` ID는 웹 리허설과 공유한다.

## C# 검사

```powershell
& 'C:/Users/q1212/AppData/Local/SYNK/Tools/dotnet/dotnet.exe' run --project unity/SynkWorld/CoreTests/CoreTests.csproj
```

테스트는 게스트 보상 차단, 리허설 연결, 서버 문항, 네트워크 실패 후 동일 요청 재시도, 목도리·앞치마 동시 착용, 충돌 재조회, 미소유품 차단, 로그아웃, 취소를 무시한 늦은 응답까지 확인한다. NUnit·외부 NuGet 패키지를 추가하지 않는다.

프로세스 재생성 뒤 같은 요청 복원, 계정 격리, 임시 파일 쓰기 중단, 원자적 교체, 손상·계정 불일치 파일 거부, 디스크 저장 실패 시 전송 차단도 실제 파일 시스템으로 검사한다. Unity의 JsonUtility와 Android/iOS 파일 시스템 동작은 Editor·실기기 검증 때 별도로 확인한다.

## 자산·기술 출처

- `Resources/Brand/*.png`: `experiences/synk-world-home/assets`의 승인 로고·몽글·펠트 부품을 PNG로 무손실 포맷 변환한 사본. 새 이미지 생성·그림 수정·리컬러 없음. [원본 목록](../../experiences/synk-world-home/asset-sources.json).
- `Resources/Brand/SUIT-Regular.otf`: `docs/브랜드_폰트/SUIT/SUIT-Regular.otf`, OFL 라이선스 동봉.
- 몽글 메시의 기본 프로필: 승인 홈의 `scene.mjs`에 작성된 화면용 메시의 C# 재구현. 3D 캐릭터 외형 재승인·마스터 제작과는 별도다.
- [URP 17.6 공식 API](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@17.6/api/UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset.html)에서 Unity 6000.6 연결과 파이프라인 생성 API를 확인했다.
- [Unity persistentDataPath](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Application-persistentDataPath.html), [Android 기기 디버깅](https://docs.unity3d.com/6000.0/Documentation/Manual/android-debugging-on-an-android-device.html), [iOS 빌드 과정](https://docs.unity3d.com/6000.0/Documentation/Manual/ios-building-and-delivering.html)을 2026-10-09 확인했다. iOS 최종 빌드·서명에는 macOS/Xcode가 필요하다.

생성될 `.meta`·씬·URP 자산은 실제 Editor 가져오기와 검증 뒤 같이 버전 관리한다. `Library`, 빌드 산출물, 인증 자료는 포함하지 않는다.
