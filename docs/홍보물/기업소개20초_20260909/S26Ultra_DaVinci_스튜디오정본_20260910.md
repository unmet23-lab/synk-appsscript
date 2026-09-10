# S26 Ultra → DaVinci 스튜디오 광고 정본

> 현행 2026-09-10. 유호님의 실제 얼굴·목소리를 중심으로, 갤럭시를 고품질 원본 카메라로 쓰고 DaVinci에서 색·합성·음향을 마감하는 단일 기준이다. 이 문서와 `tools/davinci-s26u-one-video.py`가 이전 채팅·메모의 촬영/Resolve 기본값을 대체한다.

## 목표와 경계

목표는 “휴대폰치고 좋다”가 아니라 통제된 빛·깊이 있는 미술·의도된 움직임·자연스러운 피부·고급 음향으로 큰 제작비가 느껴지는 짧은 광고다. 실제 대형 세트·시네마 렌즈·전문 인력의 결과와 같다고 보장하지 않는다. 대신 프레임을 좁히고 한 세트를 완성해 모바일·SNS 감상에서 고급 광고의 체감을 만든다.

기존 [영상 품질 조사](영상품질_심층조사_20260909.md)의 실제 유호님 중심 혼합 제작은 유지한다. 얼굴 전체를 AI로 다시 만들지 않고, 생성 기술은 승인된 펠트·공간 확장·통제된 합성에 쓴다.

## 유일한 현행 촬영 기본값

| 항목 | 현행값 |
|---|---|
| 모드 | 후면 프로 동영상 |
| 코덱 | APV Log · APV 422 HQ |
| 해상도·프레임 | UHD 4K · 24fps |
| 셔터 | 1/50초 시작. 60Hz 조명 밴딩은 우선 24fps·1/60초 시험. LED 조건을 조정하고 실제 녹화로 확인 |
| 렌즈 | 1× 메인 기본. 강한 조명 아래 얼굴 클로즈업만 3×. 디지털 줌 금지 |
| ISO | 충분한 빛에서 낮게 시작. 50–200은 초기 목표일 뿐이며 400은 절대 상한 아님. Log 저노출을 피하고 피부·하이라이트·노이즈로 결정 |
| 화이트밸런스 | 회색 카드로 측정 후 잠금. 주광 LED 시작값 5600K |
| 초점 | 고정 인물은 MF 또는 AF 잠금과 포커스 피킹. 이동 인물만 Tracking AF |
| 노출 도구 | LUT Preview Standard, False Color 켬, 회색 카드를 적정 중간 회색에 맞춤, Zebra 95 |
| 끄기 | Auto FPS, APV HDR/HDR10+, 필터, 얼굴 보정, 삼각대·짐벌 촬영의 전자식 손떨림 보정 |
| 오디오 | 외장 마이크, 48kHz, 발화 피크 -12~-6dBFS |
| 저장 | 외장 SSD, Safe Save. 내부 저장은 10% 이상 여유 |

APV 422 HQ는 4K24에서 637Mbps, 약 4.78GB/분이다. APV의 기본 HDR에서 **Log를 별도로 선택**한다. 외장 UHD≤60fps 저장은 지속 200MB/s 이상, USB 10Gbps 권장, exFAT·전력 4.5W 이하 조건을 확인한다. LUT Preview는 미리보기이며 원본에 굽지 않는다. 근거: [Samsung APV](https://developer.samsung.com/mobile/apv.html), [Samsung Log](https://developer.samsung.com/mobile/samsung-log-video.html).

24fps·1/60으로 해결되지 않는 LED도 있다. 셔터·광량·조명 구동 조건을 시험하고 샷 안에서는 통일한다. 30fps는 원하는 움직임·조명 조건에 따라 촬영과 타임라인을 함께 바꿀 때의 선택이지 필수 플리커 대책이 아니다. 위 값은 S26 실기 검증 전의 제작 시작점이다. [Sony 플리커 안내](https://www.sony.com/electronics/support/articles/00268256)

## 폐기한 이전값

- `4K30·1/60·Samsung Log HEVC`를 기본으로 쓰지 않는다. 필요 시 프레임률과 코덱을 각각 판단하며, 30fps를 택해도 APV Log를 유지할 수 있다.
- APV를 선택 옵션으로 두지 않는다. 외장 SSD를 갖춘 스튜디오 광고의 기본 원본은 APV 422 HQ Log다.
- Samsung Log→Rec.709 LUT를 첫 노드에 넣는 방식을 기본으로 쓰지 않는다. Resolve Color Management가 Samsung Log를 네이티브 변환하며, 공식 LUT는 이 경로를 쓰지 못할 때만 대체한다. 두 변환을 동시에 적용하지 않는다.
- 가로 원본 하나를 중앙 구도로 찍어 세로까지 자르는 방식을 기본으로 쓰지 않는다. 가로·세로 핵심 광고는 각각 촬영한다.
- 얼굴 보정은 “피부를 매끈하게”가 아니라 실제 피부·얼굴형·눈빛을 보존하면서 번들거림·색 편차·일시적 잡티만 제한적으로 다룬다.

과거 완성 영상의 30fps·해상도 기록은 해당 실물의 사실이므로 삭제하거나 소급 변경하지 않는다. 위 폐기는 앞으로 찍는 실제 인물 광고의 기본값에만 적용한다.

## 세트와 촬영

- 천장등과 방의 일반등을 끄고 한 방향의 큰 확산광을 얼굴 45도 옆·눈보다 약간 위에 가깝게 둔다.
- 반대편 얼굴 가까이에 검은 천/보드를 두어 빛을 빼고, 뒤 120~140도에 약한 윤곽광을 둔다.
- 인물과 배경을 가능하면 2~3m 분리하고 배경은 얼굴보다 1.5~2.5스톱 어둡게 둔다.
- 배경은 장식 수보다 무광 펠트·나무·유리 등 실제 재질을 앞/중간/뒤 세 층으로 배치한다.
- 방 전체가 드러나는 와이드보다 완성한 작은 세트, 고정 숏, 통제된 느린 이동을 쓴다.
- 렌즈 청소, 방해금지, 케이스 제거와 발열 확인 후 회색 카드·피부·검정 천·밝은 광원이 함께 든 5초 시험부터 찍는다.
- 테이크 앞뒤 약 2초 여유를 두고 말실수 뒤 문장을 다시 말한다. 가능하면 손·실제 작업·결과·반응을 5~8초씩 확보한다. 한 파일에 이어 찍어도 되며 파일 수를 강제하지 않는다.

거리·각도·명암비는 초기 배치이며 방 크기와 재질에 맞춰 바꾼다. 선명도·발열·노이즈 비교 없이 8K로 일괄 상향하지 않는다. 스마트폰 설정을 원격으로 적용한 것은 아니다.

## Resolve 프로젝트 정본

프리셋 이름은 `SYNK_S26U_APV_HQ_4K24`다. 아래는 제작 기준이며 **실제 적용 확인 범위는 마지막 절**을 따른다. 파일이 설치됐다는 사실을 전체 설정 완료로 해석하지 않는다.

| 구역 | 값 |
|---|---|
| Timeline | 3840×2160 또는 세로 2160×3840, 원본과 같은 24fps, Progressive, Square Pixel, Audio 48kHz |
| Color Science | DaVinci YRGB Color Managed, Automatic 끔, Custom |
| Input | Samsung Log |
| Timeline working space | DaVinci Wide Gamut / Intermediate, SDR 100 nits |
| Output | Rec.709 Gamma 2.4, Output DRT DaVinci |
| Color options | White Point Adaptation 켬, Color Space Aware Grading Tools 켬, Resize Linear, LUT Tetrahedral |
| Proxy | Half Resolution · DNxHR LB, 편집용으로만 사용. API 모드 1 = 있을 때 사용 |
| Cache | 외장 SSD의 `cache`, Smart. 최종 렌더는 원본 사용 |
| Master | QuickTime DNxHR HQX 10-bit, PCM 24-bit/48kHz, Same as Project 색 태그 |

클립 색공간은 Samsung Log로 확인한다. RCM을 켠 상태에서는 `Samsung Log to Rec709` LUT를 추가하지 않는다. 색 노드의 실제 값은 원본을 본 뒤 `노출·화이트밸런스 → 대비/하이라이트 → 피부 병렬 보정 → 질감 → 브랜드 룩 → 국부 조명 → 출력 점검` 순으로 샷 매칭한다. 고정 수치나 미용 LUT를 자동 적용하지 않는 것이 현재 품질 기준이다.

Resolve 20부터 Samsung Log가 색 관리에 네이티브 지원되고 APV는 Resolve 20.2 이상에서 지원된다. 근거: [Resolve 20 New Features](https://documents.blackmagicdesign.com/SupportNotes/DaVinci_Resolve_20_New_Features_Guide.pdf), [Samsung APV](https://developer.samsung.com/mobile/apv.html?lang=ko).

## 영상 하나를 가져온 뒤의 자동 준비 — Studio 실행 검증 대기

**Resolve 21.1부터 Python·고급 스크립팅은 Studio 전용이다. 현재 PC는 21.1.0.14 Free라 이 Python 도구를 실행할 수 없다.** 9월 8일 공식 변경이며, 기존 “무료판 내부 메뉴에서 실행” 안내와 “재시작하면 해결될 가능성”을 현행 실행법에서 폐기한다. 재시작 후에도 메뉴에 없음을 확인했다. 구매·다운그레이드·라이선스 제한 우회는 하지 않았다. [Blackmagic 21.1 공식 릴리스 노트](https://www.blackmagicdesign.com/support/content/readme/59dd4eef1f4941c29fb8dc48b33f5c87)

라이선스가 있는 Studio 환경에서는 설치 후 `Workspace > Scripts`에서 도구를 실행하는 경로를 검증해야 한다. 내부/외부 연결 가능 여부를 먼저 확인하고 영상 하나를 고른 뒤 실제 Samsung Log 촬영인지 확인한다. APV 코덱만으로 Log라고 추정하지 않는다. SDR·HLG·PQ는 각각 명시해야 하며, Log 지정과 HDR 태그가 충돌하면 중단한다.

구현한 준비 순서(로컬 검사 통과, Resolve 전체 실행 미검증):

1. 버전·에디션을 먼저 확인한다. ffprobe로 코덱·비트 심도·회전·표시 방향·프레임을 읽는다. 23.976/24/25/29.97/30/50/59.94/60을 보존하고 나머지는 조용히 바꾸지 않는다.
2. 길이·해상도·프레임·백업·중간본·프록시·캐시·마스터·여유분으로 공간을 산정한다. 검증된 원본 복사본을 만들며 기존 파일을 덮지 않는다. 같은 드라이브 복사본은 독립 백업이 아니다.
3. 독립 미디어 모듈은 필요 시 색 변환 없는 DNxHR HQX 10-bit를 만든다. 실패한 부분 파일·다른 원본·변조된 출력은 재사용하지 않는다. 이 변환 기능 자체는 Resolve 라이선스 우회가 아니며 Free 21.1의 Python 실행을 가능하게 하지 않는다.
4. DNxHR LB 반해상도 프록시를 실제 생성하고, 프로젝트에서 연결 경로를 읽어 확인한다. 새 가로/세로 4K 프로젝트와 명시적 색관리, 보관·편집 타임라인을 만든다.
5. 설정 API의 응답뿐 아니라 실제 읽기값을 대조한다. 프로젝트·마스터 프리셋 저장, 프로젝트 저장, 실제 `.drp` 내보내기, 닫고 다시 열기까지 성공해야 기술 준비 `ready=true`다.
6. `resolve-setup-report-날짜_시간.json`에 성공·실패·실제 값·원본 지문을 남긴다. 중단을 완료로 보고하지 않는다.

`tools/davinci-s26u-native-acceptance.py`는 합성 가로 APV·회전 세로 입력의 실제 가져오기→저장 재열기→4K HQX 렌더 시험용이다. **현재 무료판에서는 실행하지 못했고 통과 기록도 없다.** 마스터의 PCM·색 태그·원본 렌더와 실제 프록시 연결은 Studio에서 확인할 남은 조건이다. 최종 Deliver에서 프록시·Optimized Media·캐시 사용을 해제하고 원본/검증 중간본으로 출력하는지 재검수한다. LUT Tetrahedral은 이번 기본 프로젝트 UI에서 적용했으며 Python 도구 전체 적용값으로 주장하지 않는다.

자동 준비는 고급 광고의 최종 색·피부·음향 판단을 대신하지 않는다. 영상이 들어오면 실제 재생·스코프·피부·노이즈·초점을 보고 샷별 마감을 수행한다.

## 컷 편집과 리듬

2026-09-10 추가 요청을 반영한 [컷 편집 기준](컷편집_리듬정본_20260910.md)을 다음 편집부터 적용한다. 현재 `명품_기준_v1.md` §3-1의 기본 호흡을 따르며, 도입·의미 단위 트림·J/L컷·동작/시선 연결·증거 장면·리듬 대비·자막·소리·마무리를 원본에 맞춰 선택한다. 촬영·색관리 값은 이번 편집 조사로 변경하지 않는다.

자동 준비 도구는 `00_SOURCE_FULL` 보관 타임라인을 `01_EDIT_RHYTHM`으로 복제하고, 보조 장면·그래픽·현장음·효과음·음악 트랙을 추가하도록 구현했다. 원본 음성 트랙은 모두 유지한다. 프로젝트의 `editorial/`에 내용 지문이 붙은 기준 사본을 두고 `resolve-setup-report-날짜_시간.json`의 `editorial`에 성공·실패를 기록한다. 원본을 임의 간격으로 자르거나 전환·음성 변형을 자동 적용하지 않는다.

컷 편집 기능은 로컬 코드와 설치본에 반영했지만 현재 Free 21.1의 Python 실행 제한으로 실제 Resolve 타임라인 자동 생성은 미검증이다. 실제 원본의 컷 선택·재생, UI 파형·단축키·Linked Selection, 시청 지속 시간 개선도 아직 검증되지 않았다.

로컬 확인: `python -m unittest discover -s tests -p 'test_davinci_s26u_*.py' -v` 35개 통과, 자체 검사 `SELF_TEST_OK`. 이 중 실제 FFmpeg 합성 미디어 통합 검사는 7개이며 나머지는 메타데이터·모의 API·파일 보존 검사다. Resolve 실제 실행 검사는 아니다.

## 2026-09-10 현재 설치 확인

- DaVinci Resolve 21.1.0.14 Free 설치·실행 확인.
- `Samsung Log` 네이티브 색관리 지원 및 공식 `Samsung Log to Linear`, `Samsung Log to Rec709` LUT 설치 확인.
- FFmpeg/ffprobe 8.1.2와 APV 디코더 설치 확인.
- 1초 APV 4:2:2 10-bit 시험 원본을 도구로 DNxHR HQX 4:2:2 10-bit·PCM 24-bit/48kHz로 변환하고 ffprobe로 재검증했다. 시험 파일은 제거했다.
- 설치 폴더: `%APPDATA%\Blackmagic Design\DaVinci Resolve\Support\Fusion\Scripts\Utility\`. 구성은 `SYNK_한영상_스튜디오준비.py`, `davinci_s26u_media.py`, `컷편집_리듬정본_20260910.md` 세 파일이다. 설치는 Free 21.1 메뉴 노출·실행 성공을 뜻하지 않는다.
- 네이티브 Windows 제어로 `SYNK_STUDIO_BASE_4K24` 빈 프로젝트를 만들고 3840×2160·24fps·Square·Progressive·48kHz, Custom RCM·Samsung Log→DWG/Intermediate→Rec.709 Gamma 2.4·SDR100·DaVinci DRT·White Point Adaptation·색공간 인식 도구·Linear Resize·Tetrahedral·입출력 LUT 없음 값을 저장 후 설정 창에서 재확인했다. 프로젝트 이름의 STUDIO는 제작 목표이며 유료판 보유를 뜻하지 않는다.
- 기본 프로젝트는 실사 미디어·편집 타임라인·마스터 렌더를 포함하지 않는다. 프록시/캐시/전역 자동 백업/원본 렌더까지 완성된 템플릿이라고 보고하지 않는다. 무료판 UI 편집은 가능하지만 이 Python 자동화의 인수 검증은 Studio 환경이 필요하다.
- `SYNK_S26U_APV_HQ_4K24` 프리셋의 실제 메뉴 목록과 프로젝트 저장을 확인했다. 프로젝트를 닫고 다시 열어 UHD4K24와 색관리 유지도 확인했다. 빈 기본 프로젝트의 DRP 백업은 `C:/Users/q1212/Videos/SYNK_DAVINCI_BASE/project_backups/SYNK_STUDIO_BASE_4K24_20260910.drp`이며 크기·지문을 검수 문서에 남겼다. DRP 복원 시험은 별도다.
- 외장 SSD는 연결되지 않았다. C: 여유는 다른 작업에 따라 바뀌며 실제 제작 전에 도구의 보수적 공간 산정으로 다시 확인한다. 별도 드라이브/Drive의 독립 백업도 미완료다.
- 전체 진행 상태와 초기 결함 대비 수정 증거는 [최종 검수](촬영편집_최종검수_20260910.md)의 후속 적용 절을 따른다. 실제 폰 설정·조명·피부·초점·소리·영상 완성도는 실사 시험 원본을 받은 뒤 확인한다.
