# 역할별 문구가 있는 SNS 커버

2026-09-19 · `2026-09-19-final-review-v2` · 로컬 최종 검수 완료 / 공개 반영 전

사용자 요청에 따라 기존 펠트 이미지를 유지하면서 계정이 다루는 내용을 짧은 글로 보완했다. 회사·대표의 협업 소개, 제작 기록, AI 실무 설명, 포트폴리오, 한국어 학습 채널을 구분했다. 철학 문서의 문체나 별도 말투 규칙은 적용하지 않았다.

## 준비 파일

| 계정 | 핵심 문구 | 파일 |
| --- | --- | --- |
| SYNK 회사 LinkedIn | 교육과 콘텐츠를 만드는 SYNK | synk-linkedin-company.png |
| 유호 YouTube | AI로 회사를 만드는 과정 | yuhobuilds-youtube.png |
| SYNK 브리핑 YouTube | 회사에서 AI를 쓰는 방법 | synkbrief-youtube.png |
| LAB YouTube | Солонгос хэл · TOPIK / 한국어 회화 · TOPIK 준비 | lab-youtube.png |
| 유호 X | AI로 회사를 만드는 중입니다. | yuhobuilds-x.png |
| 유호 LinkedIn | 기업·기관 AI 교육·컨설팅 | yuho-linkedin-primary.png |
| Tistory | AI로 회사를 만드는 과정 | shift-tistory.png |
| Naver 블로그 | 직접 만들며 배우는 AI 활용 | shift-naverblog.png |
| Pinterest | AI와 함께 만든 브랜드·웹·콘텐츠 | shift-pinterest.png |
| Behance | BRAND, WEB & CONTENT | shift-behance.png |
| LAB Facebook | Солонгос хэл · Солонгост суралцах | lab-facebook.png |

Tistory 모바일용은 `shift-tistory-mobile.png`다. 위 계정은 전체 운영 23개 중 커버 제작 대상 11개이며, 23개 모두에 커버 기능이 있다고 가정하지 않는다.

## 원본과 재생성

- 문구: `문구.json`.
- 생성기: `node docs/마케팅/프로필최신화_20260919/커버_문구포함/만들기.cjs`.
- 레이아웃: 동명 SVG. 글자는 SUIT / Inter Tight의 정확한 글리프 윤곽을 사용한다. 실제 문구 수정은 JSON 및 생성기에서 한다.
- 글리프 추출: `글자윤곽.py`, Python fontTools. 대체 글꼴로 조용히 바꾸지 않고 누락 글리프가 있으면 실패한다.
- 실제 굵기: 한글 헤드 SUIT 800, 라틴·키릴 헤드 Inter Tight 700, 본문 500. 키릴 글리프 1.04배 광학 보정, 헤드 -0.04em·보조 -0.02em 자간.
- 작은 검정 바탕의 SHIFT 로고는 승인 Ink 조합을 밝은 펠트 패널 위에 배치해 원래 사업명 색을 바꾸지 않고 대비를 확보했다.
- 배경: 기존 승인 Paper/검정 펠트. 로고는 브랜드킷 원본의 SHA-256을 대조한다.
- 사진: `../커버/*-gpt-source.png`를 재사용한다. 이번 문구 개정에서 새 장면 생성이나 모델 변경은 하지 않았다.
- 명세: `명세.json`에 치수, 지문, 글자 좌표와 글꼴을 기록한다.
- 확인: `index.html`, `전체보기.png`, 각 `*.preview.png`.

## 확인 범위

12종 PNG와 SVG를 생성했고 38개 문구가 설정된 로컬 안전영역 안에 들어가는지 검사했다. YouTube 미리보기는 전체 2560×1440이 아니라 중앙 공통 영역 1544×422를 보여 준다. 390px 축소본 및 전체 배치를 직접 확인했다.

로컬 영역 검사는 실제 플랫폼의 자르기·프로필사진 겹침 검증을 대신하지 않는다. 브라우저 접근이 `User unavailable`로 막혀 이 개정본의 업로드와 공개 화면 검증은 하지 않았다. 몽골어 원어민 감수도 완료하지 않았다.

`../계정별_문구.json`의 커버 경로는 이 개정본으로 연결되어 있다. 기존 무문구 원본은 보존하며, 기존 게시 사실과 새 개정본 반영 여부는 `../실행상태.json`에서 분리한다.

전체 소개 원고와 결과는 [최종본](../최종본.html), 계정별 검토 내용과 외부 링크 검증은 [최종검수](../최종검수.json)에 있다. `node docs/마케팅/프로필최신화_20260919/최종검수.cjs`는 로컬 자료만 생성하고 공개 페이지를 읽으며 외부 계정에 쓰지 않는다.
