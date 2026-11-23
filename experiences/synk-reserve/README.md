# SYNK 사전예약 · synk.im/reserve/

2026-11-23 유호님 「온라인 반 계획은 철수하자. 앱 오픈을 집중해서 사전예약 받자」로 지은 쪽이다. SYNK는 2027년 2월에 정식 출시한다. 이 쪽은 출시 안내를 받을 이메일만 모은다. 돈은 받지 않고, 확인 메일과 광고 메일도 보내지 않는다.

| 무엇 | 어디 |
|---|---|
| 화면 글(한국어 · 영어 · 몽골어), 폼 질문 번호, 관심 선택지 | `src/copy.js` |
| 화면 동작(언어 · 들어온 곳 · TOPIK 안내 띠 · 보내기 · 친구에게 보내기) | `src/app.js` |
| 구조와 모양 | `src/index.html`, `src/reserve.css` (synk.im 새 홈 v11의 값과 마을 그림 `/assets/v11/town-road.webp`) |
| 링크 미리보기 원고 | `src/og.html` → `reserve/og.jpg` |
| 철수한 `/lab/topik4/` 자리 | `src/lab-topik4.html` → `lab/topik4/index.html` |
| 빌드 → `dist/` | `node experiences/synk-reserve/build.mjs` |
| 시험 | `node --test experiences/synk-reserve/app.test.js` |

## 들어오는 길

| 길 | 들어온 곳(`from`) |
|---|---|
| 체험 화면 맨 위 출시 안내 띠의 「사전예약하기」([띠](../launch-notice/README.md)) | `bar-<쪽 경로>` (예: `bar-try-entry-check`, `bar-world`) |
| `/lab/` · `/en/lab/`의 사전예약 칸 | `synk-lab` · `synk-en-lab` |
| `/mn/`의 카드와 아래 링크 | `synk-mn` |
| 옛 TOPIK 4급 반 주소(대학 · 모임 안내문의 QR과 링크 포함) | `topik4-<옛 from>`, 없으면 `lab-topik4`. 화면 위에 「TOPIK 4급 온라인 반은 열지 않기로 했습니다」를 보인다(`?notice=topik4`) |
| 완료 판의 「친구에게 보내기」 | `friend` |

게시물마다 링크를 나누려면 `?from=<영소문자 · 숫자 · 하이픈 40자까지>`를 붙인다. 언어는 `&lang=ko|en|mn`으로 고정한다. 없으면 기기 언어(몽골어 · 한국어)를 따르고, 그 밖은 영어다.

## 등록이 가는 곳

- 화면이 홈페이지 문의 구글 폼의 `formResponse`로 바로 보낸다(`fetch` · `no-cors`). 문의 유형은 「출시 소식 문의」다. 같은 폼을 `/ub/`도 쓴다. 폼의 이메일 수집 방식, 질문 번호, 「출시 소식 문의」 선택지 글, 동의 선택지 글을 바꾸면 이 쪽의 등록이 조용히 거절된다.
- 문의 내용은 네 줄 꼴이다. 첫 줄 `[SYNK 사전예약]`, `관심: 한국어 · 유학`(안 골랐으면 `(안 고름)`), `들어온 곳: <from> · 화면 언어 한국어|영어|몽골어`, 이메일을 고쳐 다시 보낸 때만 `다시 등록: …`.
- 회사 서버가 폼 응답을 5분마다 모은다. `website-inquiry-registration.mjs`의 `app-reserve` 상품이 이 꼴을 「SYNK 사전예약」으로 세고, 답장 검토 할 일을 만들지 않는다. 수는 회사 Workspace 「문의 접수」의 「SYNK 사전예약」 요약에서 본다(등록 건수 · 고유 이메일 · 들어온 곳별). 서버에 이 상품이 올라가기 전에 들어온 등록은 「출시 소식」 문의로 쌓인다.
- 개인정보: 모으는 것(이메일 · 고른 관심 · 들어온 링크 표시 · 화면 언어, 이메일을 고쳐 다시 보내면 앞 이메일), 쓰는 곳(출시 안내 메일), 보관(안내를 보낸 뒤 지움, 그 전에 요청하면 바로 지움), Google Forms로 접수 · 보관, 동의하지 않아도 된다는 것을 동의 위에 보인다(/ub/와 같은 항목). 화면의 동의 문장은 이 쪽의 목적(「출시 안내를 위한 …」)을 밝히고, 폼에는 폼에 고정된 동의 선택지 「위 안내를 읽고, 문의 답변을 위한 개인정보 수집·이용에 동의합니다.」가 기록된다(폼 선택지를 바꾸면 같은 폼을 쓰는 /ub/의 등록이 거절된다). 쓰는 곳은 화면이 밝힌 출시 안내뿐이다. 근거는 [처리방침 · 홈페이지 문의](https://synk.im/privacy/#website-contact)다. 이 기기에는 아무것도 저장하지 않는다.
- 지우기 요청은 [TOPIK 4급 반 README의 「취소 · 삭제 요청」](../lab-topik4/README.md) 순서와 같다(Google Forms 응답을 먼저 지우고 Workspace에서 「문의 지우기」).

## 출시 때

출시 안내는 등록한 사람 모두에게 같은 날 한 통씩 보낸다(받는 사람끼리 주소가 보이지 않게). 등록의 「화면 언어」 줄대로 한국어 · 영어 · 몽골어로 쓴다. 보내기는 유호님 허락 뒤다. 보낸 뒤에는 그 등록들을 위 순서로 지운다. 쪽이 그렇게 약속했다.

## 공개

```bash
node experiences/synk-reserve/build.mjs
node tools/공개.js 올리기 --원본 experiences/synk-reserve/dist/reserve reserve --전부
```

`reserve/`는 이 빌드만 쓰는 폴더다. `lab/topik4/index.html`은 같은 빌드의 `dist/lab/topik4/index.html`을 한 파일로 올린다(`lab/topik4/`의 옛 그림 · 영상은 공개본에 남아 있고 아무 쪽도 부르지 않는다). 몽골어를 고치면 `tools/몽골어대조.js`를 다시 돌린다.
