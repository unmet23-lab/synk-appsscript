# 학습 알림 2단 몽골어 검문 (2026-10-22)

WORLD 학습 알림 2단 「앱을 닫아도 받기」의 화면 글(`experiences/brand-opening/world-strings.mjs`의 `reminder.ask.bodyPush`와 `reminder.push.*` 중 새 줄 27개 — 잠금 화면 글 `reminder.push.title·review·plan·exam`은 1단 검문 그대로)을 세 겹으로 쟀다 — ① 역번역 대조(원문 한국어와 뜻이 같은지, Claude가 줄마다) ② `node tools/몽골어대조.js --파일 <묶음> --구독`의 문법 판정 ③ 맞춤법 사전(spellcheck.mn). 줄마다의 결과는 [`../../world-strings-check.json`](../../world-strings-check.json)에 키·몽골어 해시·마지막 묶음으로 남는다.

묶음(`*.txt`)·결과(`*.result.txt`)·키 목록(`manifest*.json`)은 qa 결과 규칙(루트 `.gitignore`)대로 작업한 PC에만 두고, 판정은 아래에 적는다.

| 묶음 | 줄 | 문법 | 맞춤법 | 처리 |
|---|---|---|---|---|
| `push-01` | 14 | 어색 — `энэ төхөөрөмж рүү сануулна`(이 기기 쪽으로 알린다)가 직역 연어, `давтлага эргэж ирэх цаг`(복습이 돌아오는 때) 직역투 | 미측정(한 번에 보낸 글자가 사전 한도를 넘음) | 1단에서 정상을 받은 꼴 `энэ төхөөрөмж дээр сануулна`(네 줄)와 잠금 화면 글의 `давтах хэллэг дахин гарч ирэх`로 고침, `status.device`에 주어 `сануулга`를 넣음 |
| `final-01`~`final-04` | 7·7·7·6 | 정상 | 의심 0 | 고친 뒤 27줄 전체를 맞춤법 한도 안의 네 묶음으로 다시 |
| `fix-01` | 1 | 정상 | 의심 0 | 10-23 WORLD 글 시험(`brand-opening/qa/world-lang.test.mjs` 「몽골어는 키릴로」)이 `reminder.push.consent.never`의 라틴 낱말 `push`를 잡아 `мэдэгдлийн үйлчилгээгээр`(알림 서비스로)로 고치고 그 줄만 다시 쟀다. 역번역 「…브라우저 회사의 알림 서비스를 거쳐 오지만 내용은 암호화되어 있다」 — 원문과 뜻이 같다. 같은 시험이 잡은 `reminder.push.unsupported.ios`의 `iPhone, iPad`는 Apple 제품 이름이라 글은 그대로 두고 시험의 브랜드 목록에 더했다 |

- 역번역 대조: 27줄 모두 한국어 원문과 뜻이 같다. 직역 차이만 있다 — 「로그아웃하면」→「나갈 때」(`гарах`), 「누른 때」→「연 때」(`нээсэн`), 「개인정보처리방침」→「개인정보 보호정책」.
- 화면에 보이는 꼴은 세 언어 캡처(`experiences/synk-world-app/qa/world-push-browser.test.mjs`, 390·1280)로 확인했다 — 넘침·13px 밑 글자·섞인 언어 0.
