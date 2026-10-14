# SHIFT 사업모델 반영본 2026년 10월 7일

읽기용 `SYNK_BM_20261007.pdf`와 수정용 `SYNK_BM_수정용.docx`를 별도로 만들었다. 이전 `../output/` 결과와 바탕화면의 10월 6일 전달본은 유지했다.

SHIFT의 한 고객·한 업무 개인화 서비스 도입·운영, 초기 도입비·정기 이용/운영료·추가 사용/개발비의 구조, 반복 공급·고객 효과·수익성 확인 뒤 API·엔진 라이선스 확장을 반영했다. 네 분야는 적용 후보이며 교육·컨설팅·자동화·브랜딩·조사·테스트는 도입 지원 범위다. 이전 가격과 공수는 변경 전 참고로 표시하고, 새 도입비·실제 고객 성과로 전용하지 않았다. 다른 브랜드의 상품·가격·출시 결정은 유지했다.

변경 원고는 `../brand_pages.json`, `../brands.json`, `../app.json`, `../curate.py`와 생성된 `../book.json`이다. 첫 장의 SHIFT 문구·버전 날짜는 `../build_v2.py`, `../build_docx_v2.py`에서도 반영했다. 두 빌더의 기본 출력은 이 폴더이며 `--output-dir`로 다른 출력 위치를 지정할 수 있다. 변경 전 원고·빌더·검증 기록은 `previous-sources/`와 그 SHA 기록에 보존했다. `revise-source.py`는 이번 한 번의 원고 전환 기록이며 반복 빌드는 기존 `curate.py`와 두 빌더로 한다.

PDF와 실제 Word 출력은 각각 14쪽이다. 전체 28쪽 이미지를 확인했고 원고 누락·잘림·겹침·글리프 누락이 없다. Word는 실제 `ReadOnly=False`이며 본문·표가 편집 가능한 형태다. Inter Tight는 임베딩했고, SUIT는 편집 가능성을 유지하는 기존 방식대로 이 PC의 `SUIT BM` 글꼴을 사용한다. 다른 PC에서 같은 모양으로 편집하려면 승인된 `SUIT BM` 글꼴이 필요하다. PDF에는 글꼴이 포함된다.

최종 검증은 `verification.json`, 전페이지 시각 확인은 `visual-review.json`에 있다. `../verify_v2.py`는 현재 출력의 `verify-20261007.py`를 실행한다. 변경 전 검증기는 `previous-sources/verify_v2.py`에 보존했다. `pdf_qa/`, `docx_qa/`는 검사 기록이며 전달용 문서는 위 두 파일이다. 문서 스킬의 기본 렌더러도 실행했으나 Windows에 LibreOffice가 없어 실패했으며, 기존 실제 Word 출력 경로로 14쪽·폰트·편집 가능 여부를 확인했다. 실패 로그는 `docx_qa/packaged-renderer.log`에 남겼다.

생성·검증은 Codex 번들 Python을 사용했다. 번들에 없는 `fontTools 4.66.1`만 작업 임시 폴더에 설치해 사용했다. 신규 유료 AI 호출, 공개 게시, 배포, 첫 고객·가격·출시·수익성 확정은 하지 않았다.
