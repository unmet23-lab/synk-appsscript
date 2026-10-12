# PATH 면접실 영상·음성 모델 GCS 호스팅과 월 한도 · 2026-10-13

유호님 「웅 영상 호스팅해줘」(10-13, Google Cloud Storage 추천안 승인) → 첫 공개 synk-policy `79814fc`(10-13 03:22 KST, 옛 버킷).
유호님 「웅 이어서 해. 그리고 그 구글 돈 나가는거 한도 설정해줘」(10-13) → 전용 프로젝트·월 한도·자동 차단·음성 모델 이전, 공개 synk-policy `2484a0a`.

## 왜

synk.im(GitHub Pages)은 공개할 때마다(어느 세션의 공개든) 사이트 전체 캐시를 비운다. 직후 첫 방문자는 4K 영상(장면당 약 10MB)을 원본에서 초당 약 200KB로 받아 면접 준비가 60초 제한(클립당 15초 × 4)을 넘겨 「영상 응답 시간이 초과되었습니다」로 멈췄다(10-12 디자인 공개 직후, 10-13 최적화 공개 직후 두 번 재현 — [최적화 기록](../optimize-20261013/README.md)). 음성 모델(약 80MB)도 같은 이유로 공개 직후 「한국어 음성 준비」가 매우 느릴 수 있었다.

Google Cloud에는 「여기까지만 쓰기」 같은 결제 상한이 없다. 예산은 알림만 보낸다. 그래서 알림을 받아 버킷 공개를 직접 닫는 함수를 함께 두었다.

## 무엇을

- **전용 프로젝트·버킷:** 프로젝트 `synk-path-media`(unmet27 결제 01864D-0E650C-40F3CB) · 버킷 `synk-path-media` · ASIA-NORTHEAST3(서울) · STANDARD · 균일 접근 · `allUsers` 읽기 · CORS `https://synk.im`, `https://www.synk.im`의 GET·HEAD(3D 방이 영상 프레임을 그래픽으로 쓰므로 필요). 처음 쓴 `synk-bake-unmet27`은 회사 운영 서버도 있는 프로젝트라, 예산·차단이 그쪽 비용을 보지 않도록 떼어 냈다.
- **올린 것(`path/v2/`):** 영상 14개(7장면 × 4K·720p, 67,588,230바이트) + 음성 모델 whisper-base 12파일(79,672,549바이트) = 147,260,779바이트. 경로는 영상 `path/v2/interview/film/<sha256 앞 16자>/<파일>`, 모델 `path/v2/models/<모델 묶음 해시 16자>/whisper-base/<파일>`. 내용이 바뀌면 경로도 바뀌므로 `Cache-Control: private, max-age=31536000, immutable` — 브라우저는 1년 저장하고, 구글 공유 캐시는 쓰지 않는다(아래 「가장자리 캐시」). 도구 `tools/upload-path-media.mjs`(여러 번 돌려도 같고, 올린 뒤 로그인 없는 200·크기·범위 요청 206·synk.im CORS·캐시 머리를 확인해 `receipt.json`에 남긴다. 한도로 닫힌 버킷은 열지 않는다).
- **월 한도:** Cloud Billing 예산 「PATH 공개 미디어 월 한도」 ₩10,000/월(이 프로젝트 전체 비용, 크레딧 빼기 전). 50%·90%·100%(실제)와 100%(예상)에 결제 관리자 메일 + Pub/Sub 토픽 `path-media-budget`.
- **자동 차단:** Cloud Functions 2세대 `path-media-cap`(서울, `tools/path-media-cap/index.js`). 예산 알림(하루 여러 번)마다 이번 달 비용이 한도 이상이면 라벨 `budget-capped=yes`를 먼저 달고 버킷의 `allUsers` 읽기를 뺀다. 한도 아래인데 그 라벨이 있으면(새 달·한도 올림) `allUsers`를 돌려놓고 라벨을 뗀다. 이 순서라 중간에 실패해 같은 알림이 다시 와도 끝까지 간다. 지난 결제 기간의 알림과 마지막 변경보다 먼저 보낸 알림은 무시하고, 라벨 없이 닫힌 버킷(손으로 닫은 것)은 열지 않는다. 실행 계정 `path-media-cap@`은 이 버킷의 설정·라벨·권한만 바꾸는 사용자 역할 `pathMediaCap`(4개 권한, 객체·버킷 삭제 권한 없음), 빌드 계정 `path-media-build@`은 이 프로젝트 안에서만 빌드 권한. 세우는 도구 `tools/path-media-cap/deploy.mjs`(여러 번 돌려도 같다, `--amount`로 한도 변경).
- **닫혀도 멈추지 않게:** 공개 영상 목록의 각 파일에 `fallbackSrc`(synk.im에 함께 올린 같은 바이트 사본)를 둔다. 면접실은 시작 때 버킷에 HEAD 한 번(`chooseFilmSources`, 5초 제한)을 보내 답이 없거나 막혀 있으면 그 세션 내내 synk.im 사본을 쓴다. 음성 모델은 `interview/media-hosting.json`이 버킷 주소를 알려 주고, 브라우저에 버킷 사본이 이미 있으면 그대로 쓰고 아니면 HEAD 한 번(5초)으로 정한다. 버킷 사본을 불러오다 실패하면 새 작업자가 synk.im의 `models/`만 불러온다(음성 엔진이 첫 실패를 같은 작업자 안에서 계속 되풀이하기 때문).
- **공개 묶음:** `tools/package-path-interview.mjs --pages`가 영상 목록(transform v3)과 `media-hosting.json`(public-media-hosting-v1)을 만든다. 로컬 파일 해시와 업로드 영수증을 둘 다 확인해, 올리지 않은 객체를 가리키는 목록은 만들지 않는다. 페이지 보안 정책은 `media-src`·`connect-src`에 버킷의 `https://storage.googleapis.com/synk-path-media/path/` 경로만 더한다(스크립트·워커는 같은 출처). 로컬 개발 서버와 독립 묶음은 여전히 로컬 영상·모델을 쓴다.
- **받는 쪽 규칙:** 재생기(`interview/film-player.mjs`)는 같은 출처와 `https://storage.googleapis.com/synk-path-media/path/` 접두어만 받는다(다른 버킷·옛 버킷·경로·http·질의·조각·계정 정보는 거부, 영상 요소는 `crossOrigin='anonymous'`). 음성 작업자는 `…/synk-path-media/path/v2/models/<16자 해시>/` 모양만 받는다.

## 가장자리 캐시 (10-13 확인)

처음에는 `public, max-age=31536000`으로 `path/interview/…`·`path/models/…`에 올렸다. 버킷을 닫은 뒤에도 구글 가장자리 캐시에 담긴 사본이 계속 나갔다(`Age` 헤더, [기록](cap/edge-cache.txt)). 자주 받는 파일일수록 한도에 닿아도 계속 전송·청구된다는 뜻이라, `private`로 `path/v2/`에 다시 올렸다. v2는 닫은 지 몇 초 뒤부터 403, 옛 경로는 캐시에서 200이었다. 공유 캐시를 꺼도 받는 속도는 차이가 없었다. 옛 경로 객체(26개, [영수증](receipt-v1-public-cache.json))는 아무 페이지도 가리키지 않는다.

## 확인

- **차단 실제 시험(새 버킷, 사이트 전환 전):** 토픽에 가짜 초과 알림(₩10,001/₩10,000) → 6초 뒤 닫힘·12초 뒤 로그인 없는 요청 403. 가짜 새 달 알림(₩0) → 6초 뒤 열림. 지난달 알림 → 무시. 처음 배포 때는 호출 권한이 퍼지기 전 4번 거절된 뒤 재시도로 처리됐고, 고친 함수의 첫 시도에서 「라벨을 바꾸면 IAM etag가 바뀌어 공개 해제가 412」인 결함을 찾아 고쳤다. [기록](cap/live-cap-test.txt).
- **버킷이 닫혔을 때 면접실(새 공개 묶음을 synk.im 주소에 덮어 띄움):** 시작 확인 HEAD 403 → 영상은 synk.im 사본(206)으로 재생, 720p 첫 질문까지 15.1초. 음성 모델은 HEAD 403 뒤 바로 사본 7파일로 11.6초에 준비, 버킷 GET 0. [결과](cap/flow-bucket-closed.json).
- **버킷이 열렸을 때:** HEAD 200 → 영상은 버킷(206 + CORS), 720p 첫 질문까지 16.6초. 음성 모델은 버킷 8파일 200, 44.1초. 이때 이 PC 회선이 초당 1~2.6MB로 느려져 있었다(같은 4K 영상이 앞서는 3~4MB/s). [결과](cap/flow-bucket-open.json).
- **확인은 통과했는데 모델 파일 하나가 막혔을 때(디코더만 403으로 바꿈):** 첫 작업자가 실패 → 닫고 새 작업자가 synk.im 사본으로 9.1초에 준비(작업자 2개). [결과](cap/flow-model-file-blocked.json) · [요청 순서](cap/model-fresh-worker.txt).
- **공개 뒤 실제 synk.im(덧씌움 없음, `2484a0a`):** 공개 7개 파일 SHA 일치([기록](cap/live-bytes.txt)). 4K 시작→첫 질문 11.1초·면접 완주·완료 뒤 둘러보기, 영상 요청은 모두 v2 버킷 200/206 + `Access-Control-Allow-Origin: https://synk.im`([결과](cap/live-flow-4k-complete.json)). 음성 모델은 버킷에서 준비(68.7초, 느린 회선), 콘솔 오류 0([결과](cap/live-model-and-films.json)).
- **첫 공개(옛 버킷, `79814fc`) 때:** 공개 직후 4K 시작→첫 질문 13.7초·완주, 면접 중 첫 둘러보기→완주, 휴대폰 720p 7.1초·완주, 콘솔 오류 0(`public/flow-*.json`, `overlay/`).
- **시험:** PATH `node --test "tests/*.test.mjs"` 281/281(새: 버킷 열림/403/네트워크 실패/시간 초과/fetch 없음에서 사본 전환, 신뢰하지 않는 호스트는 확인하지 않음, 모델 버킷 확인·캐시 우선·잘못된 주소 거부, 작업자 하나에 폴더 하나·교체 작업자 한 번, 공개 목록의 fallbackSrc·영수증 확인). 차단 함수 `node --test tests/path-media-cap.test.mjs` 8/8(순서·재시도 수렴·etag·지난 기간·늦게 온 알림·조건부 바인딩).

## 돈

보관은 월 몇 원이고, 돈은 전송료로 나간다: 아시아 기준 GB당 약 USD0.12(첫 1TB, 공식 요금표 기준 어림·세금 전). 4K 면접 한 번 약 40~50MB ≈ USD0.005~0.006, 720p 한 번 약 10MB ≈ USD0.0012, 음성 모델은 브라우저마다 처음 한 번 약 80MB ≈ USD0.01. 월 ₩10,000 안에서 4K 면접 약 500~1,300회(처음 오는 사람이 많을수록 적다). 차단 함수·토픽·함수 이미지 보관은 무료 사용량 안이다.

**한계:** 비용 집계가 몇 시간 늦게 오므로 그 사이 쓴 만큼 한도를 조금 넘을 수 있다. 한도에 닿으면 그달 남은 기간은 synk.im 사본으로 받으므로, 공개 직후 첫 방문자는 다시 느릴 수 있다(멈추지는 않게 했다). 면접 도중에 버킷이 닫히면 그 세션의 남은 영상은 오류가 나고, 다시 시작하면 사본으로 받는다.

## 옛 버킷

`synk-public-media`(프로젝트 `synk-bake-unmet27`, 영상 14개)는 사이트가 더 이상 쓰지 않는다. 한도 밖에 있으므로 공개 읽기를 닫았다(10-13 05:39 KST). public 캐시로 올렸던 객체라 가장자리 캐시에 남은 사본은 한동안 더 나갈 수 있지만, 이제 어느 페이지도 그 주소를 쓰지 않는다. 지우지는 않았다 — 지울지는 유호님이 정한다(보관료 월 몇 원).

## 영상·모델을 바꿀 때

1. 영상과 `strict-manifest.json`의 `sha256`을 고친다(모델은 `models/whisper-base/` 파일을 바꾸면 묶음 해시가 바뀐다).
2. `node tools/upload-path-media.mjs` — 새 해시 경로로 올리고 공개 확인까지 한다(이미 있는 것은 건너뛴다). 한도로 닫혀 있으면 열지 않는다.
3. `node tools/package-path-interview.mjs --pages` — 목록과 `media-hosting.json`이 새 경로로 바뀐다(해시나 영수증이 안 맞으면 멈춘다).
4. 공개한 뒤 쓰지 않는 옛 경로 객체는 지워도 된다(보관료가 작아 급하지 않다).

## 남은 것

- 실제 예산 알림(가짜가 아닌 것)이 함수에 처음 도착하는지 — 예산을 만든 뒤 첫 알림까지 시간이 걸린다.
- 실제 Quest 브라우저에서 버킷 영상의 VR 재생은 실기기로 확인하지 못했다.
- 이용이 늘면 Cloudflare R2(전송료 0)로 옮길 수 있다. 계정 가입(유호님)·결제 수단·synk.im DNS 이전이 필요하다. 코드는 `tools/upload-path-media.mjs`의 `PUBLIC_BASE`, `film-player.mjs`의 `TRUSTED_FILM_PREFIXES`, `whisper-worker.mjs`의 `HOSTED_MODELS`를 바꾼다.
