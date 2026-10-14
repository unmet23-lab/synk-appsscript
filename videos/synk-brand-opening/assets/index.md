# Frozen local assets — 현재 v5

| 파일 | 원천 | 현재 처리 |
|---|---|---|
| synk-paper.png / synk-paper-title.png | 승인 `docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-Paper.png` | 동일 사본. SHA256 `78de96ceb567f245281df78d01b82e5c3aba9fc0cc959dc3763967367fc3b7fe`. 재색칠·재조립 없음. |
| world-menu-mobile-veo31-v5-web.mp4 | shared `raw/felt-trio-v5/veo/portrait-veo31-1080p-v5.mp4` | 모델 확인된 네이티브 1080×1920/24fps/8초. 동일 구도·속도에서 1초 간격 키프레임 H.264 인코딩만 적용. |
| world-menu-desktop-veo31-v5-web.mp4 | shared `raw/felt-trio-v5/veo/landscape-veo31-1080p-v5.mp4` | 같은 처리, 1920×1080. 얼굴·배를 따로 붙인 레이어 없음. |
| felt-world-scene-mobile-v5.webp / desktop-v5.webp | 현재 네이티브 Veo 첫 프레임 | WebP 인코딩만 적용한 포스터. |
| opening-candidate.wav | 공통 준비 코드 | 0.38초 후보 소리. 기존 사운드킷에 채택하지 않음. |
| fonts/SUIT.woff2 / fonts/InterTight.woff2 | 승인 브랜드 서체 | 로컬 폰트와 OFL 함께 보존. |
| gsap.min.js | npm/gsap@3.14.2 공식 배포 | 로컬 렌더 런타임. |

현재 영상의 첫 이미지는 기존 승인 방향의 세 친구 사진형 펠트 장면, 마지막 이미지는 같은 사진에서 배만 없앤 내장 image_gen 편집본이다. 내장 도구의 GPT Image 2.5·max 설정은 확인하지 못했다. 모델과 작업이 확인된 동영상은 Vertex `veo-3.1-generate-001`이다. 정확한 출처·해시·검수는 shared `asset-sources.json`, `raw/felt-trio-v5/`, `qa/felt-v5/`에 있다.

v1 3D 캡처와 v2·v3 동영상, v4 연장 결과는 이전 제작 기록이다. 최신 합본이나 웹 입구에 연결하지 않는다.
