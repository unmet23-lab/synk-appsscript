# 소셜 API·배포 health 지연 검증

2026-11-03. 사슬 46 복원·재무장·봉인과 사슬 47 운영 반영·복원·재무장·봉인·동일 창 재측정을 완료했다. 결과와 한계의 정본은 [회사 운영 문서](../../../마케팅/온라인마케팅지도/engagement/company/CLOUD-OPERATIONS.md#social-health-performance-20261102)다.

- `operating47.json`: 실제 Linux 검증·운영 사후 확인·공개 294/294·백업/DR/재무장/봉인 해시, health 감시와 API 전후 420회 집계. 원본 본문·계정·DB·키·토큰은 포함하지 않는다.
- `diagnostic.json`: 당시 실제 데이터의 격리 ABBA 비교, 같은 Caddy 바이너리의 종료 순서 재현, 후보 전체 QA와 검수 원천 해시. 원래 진단 기록은 그대로 보존한다.
- `native-deployment.patch`: 고정 배포 어댑터 세 파일의 검수된 변경. 저장소의 다른 HA 사본을 덮지 않고 실제 배포 경로의 차이를 보존한다.
- `media-dr.patch`·`media-dr.json`: manifest-media 격리 복원 일곱 파일의 차이·검수·Linux 시험과 실제 46/47 복원 결과 연결. 자신의 백업의 정확한 객체만 시험용 사본에 복원한다.
- 제품 변경은 회사 원문의 `social-simple.mjs`, `post-performance.mjs`, `deploy/company-stack.sh`와 두 회귀 시험이다. 봉인된 부모 위에 다섯 파일을 합성했고 native 도구는 별도 검수했다.

소셜 중앙값 118.55→105.80ms. health 실패 관측 구간 395.408→331.501초, Caddy 종료 691.49ms/exit0. 남은 중단은 보존·교체·기동 관문이며 무중단 배포라고 주장하지 않는다. API별 30회 순차 관측은 p95·RAM·화면 렌더링 증거가 아니다.

Linux 제품 3372+호환2, native182, 재무장333개 실패/건너뜀0. 제품/어댑터 검수 GPT0·Claude3(2반영·P3 1후속), 미디어 최종 v4 및 생성 도구 최종 검수는 GPT·Claude 각각0건. 최종 커밋 CI는 해당 GitHub Checks에 연결되며, 이전 소스 커밋의 로컬 대기 시간 초과 기록은 그대로 남긴다.
