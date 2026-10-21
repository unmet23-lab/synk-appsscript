# synk-personal 신규 동기화 runtime 배포

2026-10-08 **23:24 KST**, 리허설 확인 뒤 운영에 `synk-personal` 한 함수만 반영했다. 사용자 최신 지시 「최종검수는 지금 안해도 되 나머지 이어서 해」를 통합 담당이 직접 확인하여 이번 동기화 공개의 공식 Claude 최종 검수를 후행으로 두었다. 최종 검수 자체는 완료되지 않았다.

| 환경 | 적용 전 → 후 | 사후 확인 |
| --- | --- | --- |
| 리허설 | v3 → **v4** | ACTIVE, `verify_jwt=true`, 전체 runtime·index source 일치, 익명 GET 401·OPTIONS 204 |
| 운영 | v18 → **v19** | ACTIVE, `verify_jwt=true`, 전체 runtime·index source 일치, 익명 GET 401·OPTIONS 204 |

배포 원문은 `SYNK-platform-completion-backend-20261008`의 **`7889c5ea042d3bd93965df8fb48e55d5493196a5`**이다. runtime 파일 1개만 경로 한정 커밋했고, 재빌드하거나 최신 main의 별도 auth/store 변경을 흡수하지 않았다. 실행은 저장소의 기존 `tools/원격배포.js supabase/functions/synk-personal --적용` 경로를 사용했으며 운영에만 `--운영`을 추가했다. 이 도구가 후보의 배포장부에 결과를 기록했다.

각 적용 직전에 원격 기존 body SHA256·ACTIVE·JWT 설정·함수 index sourcemap 원문을 재확인하고, 신규 `20261008130000_synk_platform_library_c16.sql`의 실제 DB receipt checksum `ce1cef2cf41107a182d78a232f66b605a5651347aa9d8655a8749fef4f8879b3`을 조회했다. 원격 함수 목록→본문→목록을 대조해 조회 도중 버전이 바뀌지 않았음을 확인했다.

| 고정 원문 / 산출물 | SHA256 |
| --- | --- |
| 생성 runtime 원문 | `2015ca0cdd69921da63286abacef02f6a81278376c8b54d321ef32208aac4399` |
| 배포 `index.ts` | `d82f20657277e3f49c4223b347fd927621684c768c18693fcdd0ec5907f8223b` |
| 배포 `synk-personal-runtime.mjs` | `fac927fd8d6a891841f45d4a57258d1e4ccb098f306305b952ab6c959f9980a4` |
| 사후 원격 body — 두 환경 공통 | `7eef4bdf4d9484a010c7a036a5a83fea7d6bbbf33a6e9f1dad56dae9c68a02eb` |

원격 body는 각각 407,323바이트다. 배포용 runtime 전체가 공백 정규화 후 일치하고, sourcemap에 담긴 함수 index 원문은 SHA256까지 정확히 같다. [배포·사후 확인 JSON](completion-personal-runtime-release.json)에 시각·버전·원문 해시·DB receipt·익명 요청 결과를 기록했다. [이전 원격과 후보의 인증·저장 범위 감사](completion-personal-runtime-review.md)는 배포 전 증거로 보존한다.

다른 함수 배포, 환경 비밀 변경, 실제 계정 자료 작성, 유료 AI 호출은 수행하지 않았다. 실제 회원 기록 왕복과 PC↔휴대폰 검증은 별도이며 이번 배포 확인으로 완료 처리하지 않는다.
