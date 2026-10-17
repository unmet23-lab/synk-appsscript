# SYNK 포트폴리오 · 회사 소개 — 2026.09.26

로컬 검토본입니다. 외부 게시·프로필 수정·친구 메시지 발송은 하지 않았습니다.

2026-09-27 사용자 피드백: 시청자가 볼 이유가 약하고 정보와 재미 모두 낮다는 지적을 받았습니다. 이 묶음은 반려된 제작 이력으로 보존합니다. 이후 별도로 만든 [09-27 재제작 검토본](../포트폴리오_회사소개_20260927/README.md)에서 후속 구성과 확인 범위를 봅니다. 새 작업에는 [공통 제작 기준](../콘텐츠_제작양식.md#모든-콘텐츠의-출발점-시청자가-볼-이유)을 적용합니다.

## 결과물

- preview.html: 채널별 이미지와 문안 미리보기
- images/: 완성 이미지 13장
- publish/: 게시용 텍스트 5종. 내부 제작 메모를 제외했습니다.
- copy/: 편집 원고와 게시 메모. 공개 본문과 구분합니다.
- images.json: 파일별 크기·용도·대체텍스트
- sources.json: 기존 자산 원천·지문과 규격 근거
- source/: 이미지별 편집 가능한 HTML. build.cjs에서 원고와 배치를 수정합니다.

## 채널별 배치

| 채널 | 이미지 순서 | 게시용 문안 |
|---|---|---|
| Behance | behance-00-cover는 프로젝트 표지, 본문은 behance-01부터 05 순서 | publish/Behance.txt |
| Pinterest | pinterest-01, 02, 03 각각 독립 핀 | publish/Pinterest.txt |
| LinkedIn 개인 | linkedin-personal-01 → behance-04-before-after | publish/LinkedIn_개인.txt |
| LinkedIn 회사 | linkedin-company-01 → behance-01-overview → behance-04-before-after | publish/LinkedIn_회사.txt |
| 카카오톡 SHIFT | kakao-shift-01 → kakao-shift-02 | publish/카카오톡_SHIFT.txt |

## 규격

Behance 표지는 1616×1264, 본문은 폭 1400px입니다. Pinterest는 1000×1500, LinkedIn의 새 대표 이미지는 1200×1500, 카카오톡 안내는 1080×1080입니다. LinkedIn과 카카오톡은 이번 작업에서 선택한 캔버스이며 플랫폼의 유일한 필수 규격이라는 뜻이 아닙니다.

[Behance 표지 안내](https://help.behance.net/hc/en-us/articles/360033998134-Guide-Cover-Images), [본문 이미지 안내](https://help.behance.net/hc/en-us/articles/204484614-Guide-Formatting-Images-For-Display-On-Behance), [Pinterest 규격](https://help.pinterest.com/en/business/article/pinterest-product-specs)을 2026-09-26에 확인했습니다. 실제 업로드 편집 화면은 이번 작업에서 열지 않았습니다.

## 근거와 상태

2026-09-19 SNS 커버 제작·반영 기록과 실제 수정 전후 원본을 사용했습니다. Behance 비교는 업로드용 원본이며 당시 플랫폼 화면 캡처가 아닙니다. 회사 소개 카드의 캐릭터 장면과 SHIFT 설명 이미지는 기존 자체 디자인 자산입니다. 서비스 준비를 고객 납품·성과·정식 출시로 소개하지 않았습니다.

회사와 사업 구분은 docs/비전_정본.md, docs/마케팅_정본.md에 따릅니다. SHIFT는 기업·기관 AI 교육·컨설팅·브랜딩 준비, PATH는 외국인 유학·취업 준비입니다.

Pinterest의 현재 링크는 SYNK SHIFT 소개 페이지입니다. 이번 Behance 프로젝트의 공개 주소는 아직 없습니다. 실제 게시 후에만 프로젝트 주소로 바꿉니다.

## 확인

13장 전체 렌더와 눈으로 보는 검토, 한글·영문 글꼴 로드, 글자 경계, 미리보기 PC·모바일 배치, 파일 링크를 확인합니다. 확인 결과는 qa/에 보관합니다. 사용자 내용·디자인 검토와 외부 게시가 남아 있습니다.
