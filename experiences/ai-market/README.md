# AI 마켓 첫 개발 묶음

> **2026-11-11 기각 · 얼림** ([결정](../../docs/_ops/결정.md)). 운영 서버에 실린 적은 없다. 회사 서버는 `SYNK_AI_MARKET_ENABLED=1`일 때만 이 화면과 API를 열고 `ai_market_` 표를 만든다(기본 꺼짐). 코드와 시험은 지우지 않고 그대로 두며, 다시 여는 조건은 결정 행에 있다. 아래는 얼리기 전 기록이다.

커뮤니티 글에서 작성자의 소개와 서비스로 이어지는 고객용 웹앱이다. 원형 시범판 `../ai-market-prep/`와 별개이며, 이 앱은 회사 서버 API와 SQLite에 실제로 저장한다. 구현·로컬 검증과 UI 최종 검수까지 마쳤고, 백엔드 정식 최종 판정과 운영 배포는 얼리면서 하지 않았다.

## 제공 기능

- 기존 중앙 SYNK ID 가입·로그인, 공개 닉네임·소개 설정
- 공개 글의 검색·분류·작성·수정·삭제, 댓글 작성·수정·삭제
- 본인만 볼 수 있는 관심 글의 저장·해제·다른 세션에서 복원
- 판매자 소개·분야·포트폴리오와 서비스 등록·수정·게시 해제
- 작성자 본인의 글·판매자 소개·서비스 사이 이동, 판매자가 등록한 외부 문의 페이지 링크

문의 분석·전문가 추천·견적·프로젝트 관리·idk 전송·결제·외부 모집 발송은 구현하지 않는다. 예시 판매자나 준비 원고를 실제 이용자 데이터로 넣지 않는다.

## 실행과 저장

회사 서버의 `/ai-market/`가 이 폴더의 HTML·JS·CSS와 기존 SUIT 서체를 제공한다. API 접두사는 `/api/customer/ai-market`이다. 정적 HTML만 열면 회원·저장 기능을 사용할 수 없다.

서버 원천은 `docs/마케팅/온라인마케팅지도/engagement/company/`의 `server.mjs`, `ai-market-routes.mjs`, `ai-market-store.mjs`다. 기존 `Store`의 `ai_market_` 테이블에 저장하고 외부 회원 인증은 `customer-identity.mjs`를 사용한다. 직원 가입·메신저 계정과 연결하지 않는다. 운영 인증 설정·실행·릴리스는 회사 서버의 기존 문서를 따른다.

글과 서비스 생성은 요청 ID로 중복 저장을 막는다. 수정은 revision을 대조하며 충돌 시 입력을 보존한다. 브라우저의 sessionStorage는 해당 탭의 작성 초안에만 사용하며, 게시 데이터의 원장은 서버다. 로그아웃하면 해당 계정의 탭 초안을 지운다.

## 확인

```powershell
node --test docs/마케팅/온라인마케팅지도/engagement/company/ai-market-store.test.mjs docs/마케팅/온라인마케팅지도/engagement/company/ai-market-routes.test.mjs docs/마케팅/온라인마케팅지도/engagement/company/customer-identity.test.mjs docs/마케팅/온라인마케팅지도/engagement/company/server-customer.test.mjs
node --check experiences/ai-market/app.mjs
node --test tests/ai-market-ui.test.mjs
```

실제 HTTP·SQLite와 합성 인증을 쓰는 격리 시험이다. 로컬 통과를 실제 신규 가입·운영 배포 완료로 해석하지 않는다. 현재 증거와 남은 항목은 [검증 기록](../../docs/AI_커뮤니티마켓/검증.md), 범위·API·완료 조건은 [첫 개발 설계](../../docs/AI_커뮤니티마켓/첫개발_설계.md)에 둔다.
