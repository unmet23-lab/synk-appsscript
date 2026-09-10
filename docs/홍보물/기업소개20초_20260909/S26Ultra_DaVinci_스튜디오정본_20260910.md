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
| 셔터 | 1/50초. LED 밴딩이 생기면 촬영 전체를 4K30·1/60초로 변경 |
| 렌즈 | 1× 메인 기본. 강한 조명 아래 얼굴 클로즈업만 3×. 디지털 줌 금지 |
| ISO | False Color 기준 최저값. 목표 50–200, 실무 상한 400 |
| 화이트밸런스 | 회색 카드로 측정 후 잠금. 주광 LED 시작값 5600K |
| 초점 | 고정 인물은 MF 또는 AF 잠금과 포커스 피킹. 이동 인물만 Tracking AF |
| 노출 도구 | LUT Preview Standard, False Color 켬, 회색 카드를 적정 중간 회색에 맞춤, Zebra 95 |
| 끄기 | Auto FPS, APV HDR/HDR10+, 필터, 얼굴 보정, 삼각대·짐벌 촬영의 전자식 손떨림 보정 |
| 오디오 | 외장 마이크, 48kHz, 발화 피크 -12~-6dBFS |
| 저장 | 외장 SSD, Safe Save. 내부 저장은 10% 이상 여유 |

APV 422 HQ는 4K24에서 637Mbps, 약 4.78GB/분이다. 외장 저장장치는 지속 200MB/s 이상, USB 3.0 이상 10Gbps 권장, exFAT을 사용한다. 근거: [Samsung APV](https://developer.samsung.com/mobile/apv.html?lang=ko), [Samsung Log](https://developer.samsung.com/mobile/samsung-log-video.html?lang=ko).

## 폐기한 이전값

- `4K30·1/60·Samsung Log HEVC`를 기본으로 쓰지 않는다. LED 밴딩 회피가 필요한 촬영 전체의 예외값이다.
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

## Resolve 프로젝트 정본

프리셋 이름은 `SYNK_S26U_APV_HQ_4K24`다.

| 구역 | 값 |
|---|---|
| Timeline | 3840×2160 또는 세로 2160×3840, 원본과 같은 24fps, Progressive, Square Pixel, Audio 48kHz |
| Color Science | DaVinci YRGB Color Managed, Automatic 끔, Custom |
| Input | Samsung Log |
| Timeline working space | DaVinci Wide Gamut / Intermediate, SDR 100 nits |
| Output | Rec.709 Gamma 2.4, Output DRT DaVinci |
| Color options | White Point Adaptation 켬, Color Space Aware Grading Tools 켬, Resize Linear, LUT Tetrahedral |
| Proxy | Half Resolution · DNxHR LB, 편집용으로만 사용 |
| Cache | 외장 SSD의 `cache`, Smart. 최종 렌더는 원본 사용 |
| Master | QuickTime DNxHR HQX 10-bit, PCM 24-bit/48kHz, Same as Project 색 태그 |

클립 색공간은 Samsung Log로 확인한다. RCM을 켠 상태에서는 `Samsung Log to Rec709` LUT를 추가하지 않는다. 색 노드의 실제 값은 원본을 본 뒤 `노출·화이트밸런스 → 대비/하이라이트 → 피부 병렬 보정 → 질감 → 브랜드 룩 → 국부 조명 → 출력 점검` 순으로 샷 매칭한다. 고정 수치나 미용 LUT를 자동 적용하지 않는 것이 현재 품질 기준이다.

Resolve 20부터 Samsung Log가 색 관리에 네이티브 지원되고 APV는 Resolve 20.2 이상에서 지원된다. 근거: [Resolve 20 New Features](https://documents.blackmagicdesign.com/SupportNotes/DaVinci_Resolve_20_New_Features_Guide.pdf), [Samsung APV](https://developer.samsung.com/mobile/apv.html?lang=ko).

## 영상 하나를 가져온 뒤의 자동 준비

Resolve 내부 `Workspace > Scripts > Utility > SYNK_한영상_스튜디오준비`를 실행하고 영상 하나를 고른다.

도구는 다음을 수행한다.

1. ffprobe로 코덱·비트 심도·방향·프레임을 읽는다.
2. 무료 Resolve가 APV/10-bit HEVC를 직접 다루기 어려우면 색 변환 없이 DNxHR HQX 10-bit 편집본을 만든다.
3. 새 프로젝트와 가로/세로 4K 타임라인을 만들고 Samsung Log RCM을 적용한다.
4. 원본, 캐시, 프록시, 내보내기, 백업 경로를 원본과 같은 충분한 저장장치 아래에 분리한다.
5. 프로젝트 프리셋과 DNxHR HQX 마스터 프리셋을 저장한다.
6. 실제 적용값과 실패 항목을 `resolve-setup-report.json`에 남긴다.

자동 준비는 고급 광고의 최종 색·피부·음향 판단을 대신하지 않는다. 영상이 들어오면 실제 재생·스코프·피부·노이즈·초점을 보고 샷별 마감을 수행한다.

## 컷 편집과 리듬

2026-09-10 추가 요청을 반영한 [컷 편집 기준](컷편집_리듬정본_20260910.md)을 다음 편집부터 적용한다. 현재 `명품_기준_v1.md` §3-1의 기본 호흡을 따르며, 도입·의미 단위 트림·J/L컷·동작/시선 연결·증거 장면·리듬 대비·자막·소리·마무리를 원본에 맞춰 선택한다. 촬영·색관리 값은 이번 편집 조사로 변경하지 않는다.

자동 준비 도구는 `00_SOURCE_FULL` 보관 타임라인을 `01_EDIT_RHYTHM`으로 복제하고, 보조 장면·그래픽·현장음·효과음·음악 트랙을 추가한다. 원본 음성 트랙은 모두 유지한다. 프로젝트의 `editorial/`에 내용 지문이 붙은 기준 사본을 두고 `resolve-setup-report.json`의 `editorial`에 성공·실패를 기록한다. 원본을 임의 간격으로 자르거나 전환·음성 변형을 자동 적용하지 않는다.

컷 편집 기능은 로컬 코드와 설치본에 반영하며, 실제 Resolve 타임라인 생성·컷 선택·재생 결과는 원본을 가져와 내부 도구를 실행한 뒤 확인한다. UI 파형·단축키·Linked Selection 설정의 실제 반영과 시청 지속 시간 개선은 아직 검증되지 않았다.

로컬 확인: `python -m unittest discover -s tests -p test_davinci_s26u_editorial.py -v`의 5개 검사에서 원본·다중 음성 보존, 무음 원본, 복제·트랙 실패 표시, 수정된 기준 사본 보존을 확인했다. 설치 스크립트 자체 검사와 스크립트·편집 기준의 저장소/설치본 SHA-256 일치도 확인했다. 모의 API 검사는 실제 Resolve 실행 확인과 별도다.

## 2026-09-10 현재 설치 확인

- DaVinci Resolve 21.1.0.14 Free 설치·실행 확인.
- `Samsung Log` 네이티브 색관리 지원 및 공식 `Samsung Log to Linear`, `Samsung Log to Rec709` LUT 설치 확인.
- FFmpeg/ffprobe 8.1.2와 APV 디코더 설치 확인.
- 1초 APV 4:2:2 10-bit 시험 원본을 도구로 DNxHR HQX 4:2:2 10-bit·PCM 24-bit/48kHz로 변환하고 ffprobe로 재검증했다. 시험 파일은 제거했다.
- Resolve 내부 실행용 도구 설치 경로: `%APPDATA%\Blackmagic Design\DaVinci Resolve\Support\Fusion\Scripts\Utility\SYNK_한영상_스튜디오준비.py`.
- 외장 SSD 없음, 최종 재측정 기준 C: 여유 약 23.09GB. 짧은 시험에는 쓸 수 있지만 APV HQ 원본·DNxHR HQX 편집본·캐시를 함께 두는 제작 용량으로는 부족할 수 있으므로, 실제 APV 변환·캐시·프로젝트 프리셋 실행 검증은 영상과 충분한 외장 저장장치가 들어오기 전에는 완료로 보지 않는다.
- 이 세션의 네이티브 Windows 앱 제어 실행기 `orca`가 없어 Resolve 화면을 클릭해 내부 스크립트를 실행하지 못했다. 스크립트 자체 시험과 설치 확인은 별도다.
