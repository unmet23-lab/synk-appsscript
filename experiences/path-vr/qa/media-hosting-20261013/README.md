# PATH 면접실 영상 GCS 호스팅 · 2026-10-13

유호님 「웅 영상 호스팅해줘」(10-13, Google Cloud Storage 추천안 승인). 공개 synk-policy `79814fc`(10-13 03:22 KST).

## 왜

synk.im(GitHub Pages)은 공개할 때마다(어느 세션의 공개든) 사이트 전체 캐시를 비운다. 직후 첫 방문자는 4K 영상(장면당 약 10MB)을 원본에서 초당 약 200KB로 받아 면접 준비가 60초 제한(클립당 15초 × 4)을 넘겨 「영상 응답 시간이 초과되었습니다」로 멈췄다(10-12 디자인 공개 직후, 10-13 최적화 공개 직후 두 번 재현 — [최적화 기록](../optimize-20261013/README.md)).

## 무엇을

- **버킷:** `synk-public-media` · ASIA-NORTHEAST3(서울) · STANDARD · 균일 접근 · `allUsers` 읽기 · 프로젝트 `synk-bake-unmet27`(결정 표 10-08 기본 결제 계정 unmet27). 돈장부 「걸린 것」에 적었다.
- **올린 것:** 영상 목록의 영상 14개(7장면 × 4K·720p, 67,588,230바이트). 경로는 `path/interview/film/<sha256 앞 16자>/<파일 이름>` — 내용이 바뀌면 경로도 바뀌므로 `Cache-Control: public, max-age=31536000, immutable`. 도구 `tools/upload-path-media.mjs`(여러 번 돌려도 같고, 올린 뒤 로그인 없는 200·크기·범위 요청 206·synk.im CORS·캐시 머리를 확인해 `receipt.json`에 남긴다).
- **CORS:** `https://synk.im`, `https://www.synk.im`의 GET·HEAD. 3D 방이 영상 프레임을 그래픽(WebGL)으로 쓰므로 교차 출처 허가가 있어야 한다.
- **공개 묶음:** `tools/package-path-interview.mjs --pages`가 영상 목록(`strict-manifest.json`)의 주소를 같은 규칙의 버킷 주소로 바꾼다. 바꾸기 전에 로컬 파일 해시가 목록과 같은지 다시 본다. 페이지 보안 정책은 `media-src`에만 `https://storage.googleapis.com`을 더했다(스크립트·워커·fetch는 그대로 같은 출처). 로컬 개발 서버는 여전히 로컬 영상을 쓴다. 같은 영상은 synk.im에도 그대로 남겨 두어, 이전 목록을 연 탭도 계속 재생된다.
- **재생기(`interview/film-player.mjs`):** 같은 출처만 받던 규칙에 `https://storage.googleapis.com/synk-public-media/path/` 접두어 하나만 더했다(다른 버킷·경로·http·질의·조각·계정 정보는 거부, 시험 9가지). 영상 요소는 `crossOrigin='anonymous'`로 받는다.
- 덧붙여 방 둘러보기를 닫을 때 포커스를 먼저 돌려준 뒤 방을 숨긴다(크롬 접근성 경고 「aria-hidden이 포커스를 가진 요소에 걸림」 해소, `strict-vr.mjs`).

## 확인

- **받는 속도:** 버킷의 4K 질문 영상 9.9MB가 처음 받을 때 3.1MB/s, 다시 받을 때 3.9~7.6MB/s(공개 직후 Pages 원본은 약 0.2MB/s).
- **공개 직후 공개 주소(덧씌움 없음):** 4K 시작→첫 질문 13.7초·완주, 면접 중 첫 둘러보기(재개 막힘→방 열림→Esc→계속→듣기 중 두 번째 열기)→완주, 휴대폰 720p 7.1초·완주. 영상 요청은 모두 버킷에서 206 + `Access-Control-Allow-Origin: https://synk.im`(`public/flow-*.json`). 콘솔 오류 0.
- **3D 방:** 버킷 영상 프레임을 그래픽으로 그려 면접관이 정상으로 보인다(`overlay/room-preview-bucket-frames.jpg`).
- **시험:** `node --test "tests/*.test.mjs"` 272/272(새 시험: 버킷 접두어만 허용, 영상 요소 CORS 모드). 공개 4개 파일 SHA 일치(`public/live-bytes.txt`).

## 돈

보관은 월 몇 원이고, 돈은 전송료로 나간다: 아시아 기준 GB당 약 USD0.12(첫 1TB, 공식 요금표 기준 어림·크레딧·세금 전). 4K 면접 한 번 약 40~50MB ≈ USD0.005~0.006, 720p 한 번 약 10MB ≈ USD0.0012 → 4K 1,000회 ≈ USD5~6. 실제 청구는 Cloud Billing 보고서로 본다.

이용이 늘면 Cloudflare R2(전송료 0, 보관 10GB·읽기 월 1,000만 회 무료)로 옮길 수 있다. 계정 가입(유호님)·결제 수단 등록·운영용 사용자 도메인(synk.im DNS를 Cloudflare로)이 필요하다. 코드는 `tools/upload-path-media.mjs`의 `PUBLIC_BASE`와 `film-player.mjs`의 `TRUSTED_FILM_PREFIXES`만 바꾼다.

## 영상을 바꿀 때

1. 영상과 `strict-manifest.json`의 `sha256`을 고친다.
2. `node tools/upload-path-media.mjs` — 새 해시 경로로 올리고 공개 확인까지 한다(이미 있는 것은 건너뛴다).
3. `node tools/package-path-interview.mjs --pages` — 목록의 주소가 새 경로로 바뀐다(해시가 안 맞으면 멈춘다).
4. 공개한 뒤 쓰지 않는 옛 경로 객체는 지워도 된다(보관료가 작아 급하지 않다).

## 남은 것

- 음성 모델(Whisper, 약 103MB)도 synk.im에서 받으므로 공개 직후에는 「한국어 음성 준비」가 느릴 수 있다. 같은 방식으로 옮길 수 있지만 모델 로더(같은 출처 전제·fetch)를 고쳐야 해서 이번에는 영상만 옮겼다.
- 실제 Quest 브라우저에서 버킷 영상의 VR 재생은 실기기로 확인하지 못했다.
