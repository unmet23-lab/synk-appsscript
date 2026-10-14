# Live2D 확인 기록

2026-10-09. **공식 마켓의 제3자 Kumakumasu 공개 모델 조작 시험은 완료**, 까몽 Live2D 모델은 제작 전이다. 같은 까몽을 사용한 3D/Live2D 동등 비교가 아니다. CSS 변형이나 Three.js 평면을 Live2D로 대체하지 않는다.

## 직접 확인한 범위

- `https://nizima.com/Item/DetailItem/79380`에서 공개 미리보기 로딩 뒤 커스텀 픽시가 표시됨을 Chrome에서 확인했다. 제작자는 Kumakumasu. Live2D가 운영하는 마켓의 제3자 모델이며 Live2D사의 자체 샘플이나 SYNK 자산이 아니다. 상위 에이전트가 실제 미리보기 UI에서 아래 파라미터 조작과 재생 유지를 확인했다.
- 페이지에서 모델 그림의 `プレビューを表示`로 미리보기를 연다. 모델 구매·다운로드·계정 생성·약관 승낙은 수행하지 않았다. 별도 모델 복제/캐싱도 하지 않았다.
- 현재 로컬 검사의 관련 폴더에서 Cubism 설치, 실행 프로세스, 기본 WebSocket 포트 22033 리스너를 찾지 못했다.
- appsscript, SYNK-talk, SYNK-website에서 `.moc3`, `.cmo3`, `.model3.json` 파일을 찾지 못했다. 캐릭터 문서, talk/assets, Downloads에서 관련 원화 `.psd/.psb` 및 Live2D 실행 자산을 찾지 못했다. PC 전체 검사나 클라우드 원본 부재를 의미하지 않는다.
- 승인 외형 참조는 `docs/캐릭터/정본_4K/까몽_본체.png`다. 원화 한 장은 실행 가능한 Cubism 모델이 아니다.
- 사용자는 **별도 원본이 없음**을 확인했다. 까몽 분리 원화와 Cubism 모델은 새로 제작해야 한다.

## 공개 모델 조작 결과

| 실제 UI 조작 | 확인 결과 |
|---|---|
| 귀 0 → 2 | 수직으로 선 귀가 처진 귀로 전환 |
| 모자 1 → 0 | 모자 숨김 |
| 목 장식 0 → 1 | 프릴 목 장식으로 전환 |
| 옷 색상 0 → 6, 채도 0 → 1, 명도 1 → 0.4 | 파란 아가일 옷 표시 |
| 외형 변경 후 재생 | 모델 재생 유지, 눈 깜빡임 체크 활성 상태 |

증거: [`../qa/live2d-public-customization.jpg`](../qa/live2d-public-customization.jpg). 공개 미리보기 UI의 실행 모델 정보는 moc3 SDK 4.2 / Cubism 4.2, texture 1024, mask 74였다. 브라우저 표시 FPS는 약 51~60 사이로 변했다. 이 값은 해당 PC·제3자 모델·미리보기의 관찰값이며, 까몽 성능·실물 휴대폰 성능·3D와의 공정한 성능 비교 결과가 아니다. 설치·구매·모델 다운로드 없이 수행했다.

## 최소 까몽 제작 범위

| 단계 | 필요한 작업 | 통과 조건 |
|---|---|---|
| 분리 원화 | 몸, 귀, 양 앞발, 꼬리·단추, 눈꺼풀·홍채·하이라이트 및 가려진 몸 복원 | 합쳤을 때 승인 외형 유지, 투명 경계와 빛 방향 일치 |
| 의상 원화 | 목도리 앞/뒤/매듭/끝, 앞치마 몸판/끈 | 머리·앞발·꼬리와의 앞뒤 순서 일치 |
| 리깅 | 고개 X/Y, 눈 개폐, 호흡, 앞발 인사, 의상 표시, 목도리 끝 물리 | 세 차림에서 동일 얼굴 유지, 움직임 중 경계 벌어짐/관통 없음 |
| 내보내기 | moc3, model3.json, textures, 필요한 physics3/exp3/motion3 | Cubism Web runtime 로드 성공 |
| 실제 비교 | 정면+작은 회전, 세 차림, 같은 배경/표정, 앱 탑재 | 실물 휴대폰의 로딩/프레임/메모리 측정과 육안 검수 |

PNG 자동 오리기로 가려진 면을 추정하거나 완성된 의상 이미지를 또 움직이는 것으로 대체하지 않는다. 이 계획은 제작 완료 자산이나 자동화 완료 선언이 아니다.

## 외부 API와 실행 경계

기존 공식 문서의 API는 실행 중인 Editor에 WebSocket으로 연결하며 사용자 연결 허용이 필요하다. **5.4 alpha1(2026-07-14)**에서는 모델링 모드의 편집 API가 추가됐다. `AddPart`, `AddParameter`, `AddParameterKey`, `AddRotationDeformer`, `AddWarpDeformer`, `EditArtMesh` 등이다. 별도 편집 허용과 `EditBegin/End` 범위가 필요하다.

공식 `04_EditSample`은 Editor에 미리 연 Niziiro Mao의 파라미터 그룹 이름을 Python으로 바꾸는 예제다. 따라서 '외부 API로 편집 불가능'은 부정확하다. 반복 리깅 자동화 가능성은 있으나, 확인한 API 목록에서는 신규 모델 생성·PSD import·moc3 export까지 무인 처리하는 공식 CLI 경로를 확인하지 못했다. ArtMesh 편집 API를 곧바로 원화 분리/신규 메쉬 생성 기능이라고 해석하지 않는다.

Cubism SDK for Web 다운로드 페이지에는 다운로드/실행이 라이선스 동의라고 명시돼 있다. 상위 작업 지시에 따라 SDK Core와 Editor를 새로 다운로드/설치/실행하지 않았다. 공식 GitHub WebSamples는 Core를 포함하지 않아 그 저장소만으로 로컬 실행이 완결되지 않는다.

## 1차 출처

- [nizima 공개 미리보기](https://nizima.com/Item/DetailItem/79380)
- [Live2D 공식 콘테스트의 커스텀 모델 설명](https://docs.nizima.com/nizicon/nizicon-25/)
- [Cubism 5.4 alpha 편집 API](https://cubism.live2d.com/editor-alpha/doc/manual/alpha1/ko/external-api-intergration/index.html)
- [공식 Python 편집 샘플](https://github.com/Live2D-Garage/CubismExternalAppPluginSamples/tree/54alpha/04_EditSample/)
- [기존 외부 연동 API](https://docs.live2d.com/en/cubism-editor-manual/external-application-integration-api/)
- [공식 Web SDK 다운로드 조건](https://www.live2d.com/en/sdk/download/web/)
- [공식 WebSamples 실행/의존성 설명](https://github.com/Live2D/CubismWebSamples/blob/develop/README.md)
- [공식 분리 원화 가이드](https://docs.live2d.com/en/cubism-editor-manual/divide-the-material/)
- [공식 Pose 파츠 전환](https://docs.live2d.com/en/cubism-sdk-manual/pose/)

## 로컬 열기

상위 `server.mjs`가 켜져 있을 때 `http://127.0.0.1:4292/experiences/mascot-render-lab/live2d/`. 펠트 버튼/서체는 기존 비교 화면 `../lab.css`와 승인 자산을 재사용한다. 외부 사이트를 임의로 iframe에 넣지 않고 출처와 제3자 제작자를 표시한 링크로 연다.
