# 옷장 첫 진입 최적화 · 2026-10-12

공개 커밋 `6e5b82eeec933e4794de698b28a2511b40f6e275`, 비교 기준 `4210347c185e038eefe68e444bba720b821ab5e2`.

## 2026-10-12 마감 자체 검수

현재 원천의 관련 10개 시험 파일 **81/81 재통과**, 핵심 원천 9개는 공개 커밋과 개행·캐시 쿼리를 제외하면 동일하고 원단 PNG 83개의 크기·SHA도 일치했다. [마감 공개 대조](close-public.json)는 배포 Git blob 기준 **104/104** 일치다. 이전 `public-candidate.json`은 커밋 전 Windows 작업본이어서 세 텍스트 파일의 CRLF 차이가 있다. 공개 바이트 비교는 기존 `public-live.json`과 이번 결과처럼 Git blob을 기준으로 한다.

다른 작업의 미커밋 v8 미술을 함께 커밋하지 않도록, 공개 커밋의 핵심 9개 변경을 원천 경로로 옮긴 [최적화 패치](startup-only.patch)와 [격리 재적용 검증](patch-check.json)을 보존했다. 재적용 결과 9/9가 현재 원천·공개 코드와 동일하다. 패치는 zero-context 형식이며 재적용 시 `git apply --unidiff-zero`를 사용한다. 이 패치는 v8 재질·의상·14개 상품 계약이 선행해야 하며 현재 원천 HEAD만으로 독립 적용 가능한 패치가 아니다. 완결된 런타임·생성 자산은 이미 공개 `6e5b82e`에 커밋돼 있다. 기존 측정과 실제 화면 검증은 아래 기록을 유지하며 이번에 성능 수치를 다시 측정했다고 표시하지 않는다.

공개 사이트에 포함하지 않는 생성기와 신규 회귀시험 3개는 [QA 재현 패치](startup-qa.patch)로 함께 보존했다. 같은 v8 선행 원천과 최적화 패치가 필요하다. 이번 재시험 원시는 `close-tests.tap`이다.

## 변경과 검증

- 기존 seed·재질·해상도를 보존한 PNG 83개와 HalfFloat CubeUV 반사광을 미리 생성했다. 기본 원단 9장, **현재 차림에 필요한** 상세 원단만 비동기로 불러온다. 상세 원단 이미지 캐시는 최근 4종으로 제한한다.
- 보이는 재질의 GPU 업로드를 나누고, 셰이더 준비를 8ms 예산으로 분할한다. `KHR_parallel_shader_compile` 완료를 기다린 다음 첫 화면을 그린다. 취소 시 프로그램 조회·타이머를 중단한 뒤 자원을 해제한다.
- 환경 자산은 요청·압축 해제 공통 5초 제한, 원단 이미지는 5초 제한이다. 누락·해독 실패 시 기존 생성 경로로 복구한다. 외부 취소·컨텍스트 손실에는 GPU 복구 생성을 시작하지 않는다.
- shader/body/resize/abort/timeout/fallback/cache/기존 계정·옷장 관련 **81/81** 테스트 통과. 준비 중 닫기·재열기, KHR 기능 비활성화, context loss 뒤 재시도, 촬영·앨범 저장을 격리된 시험 계정으로 검증했다.
- 기본 차림 및 린넨 차림의 수정 전후 3D 캔버스 **모든 RGBA 픽셀 동일**. 최종 공개 후보도 기본 차림 픽셀 동일이다.

## Windows 측정

| 차림 | 첫 화면 전 → 후 | 가장 긴 main-thread 작업 전 → 후 | 50ms 초과 작업 합 전 → 후 |
|---|---:|---:|---:|
| 기본 | 1,669 → 869ms | 862 → 97ms | 1,497 → 188ms |
| 린넨 셔츠 복원 | 2,601 → 1,330ms | 851 → 156ms | 2,309 → 309ms |

Windows Chromium 155, Intel Arc B390, 1280×720, DPR2, KHR 지원. 같은 브라우저에서 새로운 페이지·WebGL 컨텍스트로 비교했다. 드라이버 셰이더 캐시는 지우지 않았으며 여러 기기·통계 표본 성능을 주장하지 않는다. 질감·조명을 줄여 얻은 개선이 아니다. 오프라인 생성 fallback이나 병렬 컴파일 미지원 GPU에서는 더 긴 작업이 남을 수 있다. 설치 앱은 같은 공개 WORLD를 읽으므로 설치파일 변경이 필요 없다.

## 결과 파일과 원천

- `verification.json`: 최종 수치·브라우저 검증·범위. `*-timing.json`, `*-profile.json`: 실제 측정 원자료. 중간 실험 결과는 `after-*`, `worn-intermediate-*`, `worn-after-*`; 최종 평가는 `default-final-*`, `worn-final-*`이다.
- `public-candidate.json`, `public-live.json`: 배포 파일 목록과 공개 바이트 대조. 옷장 Pages 배포 38169434345 성공. 같은 WORLD를 유지한 후속 배포 1e41900의 Pages 38169586579 성공; 이전 사이트 점검 38169434490은 후속 배포로 대체되어 취소되었으며 최종 사이트 점검 [38169586507](https://github.com/unmet23-lab/synk-policy/actions/runs/38169586507)도 성공했다. 최종 실행 기록은 `ci.json`에 있다.
- 원천 `experiences/synk-world-home/{wardrobe-stage,wardrobe-studio,avatar-v3,avatar-wardrobe,avatar-textiles,contact-light-v6,shader-preparation,wardrobe-environment}.mjs` 및 studio CSS. 생성기는 `experiences/synk-world-home/qa/startup-assets.mjs`.
- public 저장소 `.tmp/platform-download-20261011/policy`의 위 커밋은 설치된 앱과 홈페이지가 사용하는 완결된 공개 결과다. 원천 저장소에는 이전 v8 미술 작업의 미커밋 변경이 함께 있으므로, 원천 통합 시 이 공개 기준과 대조하여 다른 작업을 보존해야 한다.
- 원리 확인: [Three renderer](https://threejs.org/docs/pages/WebGLRenderer.html), [KHR parallel shader compile](https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/). 사용 중인 Three r180의 실제 렌더 대상·shader 키·취소 경로를 기준으로 구현했다.

실제 계정·설치 프로필은 수정하지 않았다. 시험 페이지는 `.tmp/wardrobe-startup-20261012/fixture.html`, 전후 경로 서버는 같은 폴더 `server.mjs`다. 공개 후보를 복사한 뒤에는 fixture의 `before` 경로도 새 공개 후보가 되므로 옛 비교는 위 baseline 커밋에서 복원해야 한다.
