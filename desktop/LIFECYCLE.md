# SYNK 플랫폼의 앱 설치·실행 관리

2026-10-02. 플랫폼은 WORLD·사내 메신저를 별도 클라이언트로 관리한다. 현재 배포 원천은 **실제로 생성하고 SHA-256을 확인한 로컬 개발 설치 파일**이다. 공개 다운로드·자동 업데이트 서버는 연결하지 않았다.

## 실제 동작

1. 고정 OS 설치 경로에서 각 앱의 메타데이터, 실행 파일, ASAR를 찾는다. 앱 ID·제품·개발/정식 모드·운영체제·CPU·버전과 승인 해시가 모두 일치해야 실행할 수 있다.
2. 설치 파일 준비를 누르면 승인 목록의 로컬 설치 파일을 앱 전용 임시 디렉터리로 복사한다. 실제 읽고 쓴 바이트로 진행률을 표시하고 SHA-256을 확인한다. 이 단계는 네트워크 다운로드가 아니다.
3. 준비 중에는 취소할 수 있다. 취소·실패한 파일은 정리하고 설치 가능 상태로 표시하지 않는다.
4. 사용자가 별도의 **설치 프로그램 열기**를 눌렀을 때 다시 파일 크기·경로·해시를 확인한 다음 OS로 연다. 준비 직후 자동 실행하지 않는다. 설치 프로그램을 열었다는 사실을 설치 완료로 기록하지 않는다.
5. 설치 후 새로 확인하면 고정 설치 경로를 검사한다. 구버전도 승인 해시가 있으면 실행할 수 있고, 더 높은 승인 버전이 있을 때 업데이트 가능 상태를 표시한다. 업데이트 버튼도 같은 준비·명시적 실행 단계를 거친다.

WORLD·메신저는 플랫폼의 실행·설치 API를 사용할 수 없다. 실행과 설치에는 고정 앱 ID만 받으며, 렌더러가 경로·셸 명령·다운로드 URL을 지정할 수 없다.

## 브리지

```js
await window.synkDesktop.getClients();
await window.synkDesktop.launch('world');
await window.synkDesktop.prepareClient('world');
await window.synkDesktop.cancelPreparation('world');
await window.synkDesktop.openInstaller('world');
const unsubscribe = window.synkDesktop.onClientsChanged(clients => {});
```

`getClients()`의 항목은 기존 `id`, `name`, `status`, `canLaunch`, `reason`, `version`과 함께 `latestVersion`, `updateAvailable`, `installer`를 제공한다. `installer`는 다음 정보를 가진다.

| 필드 | 의미 |
| --- | --- |
| `status` | `unavailable`, `idle`, `preparing`, `ready`, `opening`, `installer-opened`, `cancelled`, `error` |
| `source` | 제공된 경우 `local-development`; 공개 서버 다운로드라는 뜻이 아니다 |
| `version` | 현재 제공하는 설치 파일 버전 |
| `progress` | 실제 복사 진행률 0–99, 해시 검사까지 성공하면 100 |
| `transferredBytes`, `totalBytes` | 실제 복사한 바이트와 승인한 파일 크기 |
| `canPrepare`, `canOpen` | 해당 시점에 허용하는 동작 |
| `error` | 파일 없음·변조·경로 이탈·OS 실행 오류 등 구체적인 상태 코드 |

`openInstaller` 성공 응답은 `{ ok: true, installationConfirmed: false }`다. 실제 설치 완료 여부는 운영체제 경로에서 별도로 확인한다.

## 승인 목록과 재현

`tools/build-client-catalog.cjs`는 `artifacts/package-verification.json`에 기록된 WORLD·메신저의 실제 설치 파일·실행 파일·ASAR 해시를 다시 대조해 `artifacts/client-releases.json`을 만든다. 이전에 검증한 버전의 실행 해시는 보존하므로 최신 빌드 때문에 구버전 실행이 막히지 않는다. 정식 다운로드 채널의 서명된 manifest를 구현한 것은 아니다.

```powershell
node tools/build-client-catalog.cjs
node --test tests/lifecycle.test.cjs
node tools/lifecycle-smoke.cjs
```

신규 11개 시험은 실제 임시 파일을 이용한 준비·진행률·취소·변조 거절·두 번 클릭 방지·OS 실패, 버전 비교, 승인된 구버전 실행, 카탈로그 이력 보존을 확인한다. 기존 셸 13개와 함께 24개를 확인했다. 전체 셸·인증·네이티브 화면 검증은 최종 README의 현재 결과를 따른다.

`artifacts/lifecycle-smoke.json`은 실제 개발 설치 파일을 복사·검증하고 다른 앱의 준비를 취소한 결과다. 설치·프로세스 실행 함수는 이 검사에서 호출되면 실패하도록 막았다. OS 설치 위치는 합성 미설치 디렉터리를 사용했다. 따라서 **설치 프로그램의 실제 실행, 설치·제거, 설치된 앱 간 실행, ARM64·Mac 실기기 검증은 이 결과로 주장하지 않는다.**

## 남은 운영 연결

현재 구현은 개발판 설치 파일 준비와 승인 해시 기반 앱 실행을 담당한다. 공개 다운로드 호스팅, 배포 manifest 서명과 교체 정책, 중단된 다운로드 이어받기, 백그라운드 업데이트·롤백, Windows 서명·Mac 공증과 실기기 설치 검증은 별도 단계다. 모바일 앱의 스토어 설치는 PC 런처가 대신하지 않으며 공통 SYNK ID와 각 제품의 모바일 입구를 사용한다.
