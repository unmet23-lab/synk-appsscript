# Meta 3개 플랫폼 자동 게시 위험 — 독립 증거 조사

조사 기준: 2026-09-10 KST / 2026-09-09 UTC. 대상: Facebook, Instagram, Threads. 공개 문서 조사만 수행했으며 회사 계정 접속·게시·설정 변경·API 연결 시험은 하지 않았다.

## 결론

**양질의 자기 회사 콘텐츠라도 GPT가 브라우저 화면을 자동 조작하는 게시 방식의 약관 위험은 별개다. 다만 GPT 시각 computer use로 기존 정상 회사 계정의 정상 콘텐츠를 올리는 행위만을 원인으로 확정한 정지 사례는 이번 조사에서 확인하지 못했다. 관련 브라우저 자동화 실험에서 정지는 실제 관찰되었지만 신규 가짜 계정이라는 다른 원인이 섞여 있다. 정지 확률을 계산할 자료는 없다.**

안전성을 높이는 실질적인 선택은 GPT가 콘텐츠 제작·검수를 맡고, 게시 실행은 Meta가 제공하는 공식 게시 API(허가된 프로그램 연결 통로)나 사람이 설정한 Meta 자체 예약 기능으로 하는 것이다. AI가 Business Suite 화면의 예약 버튼을 클릭하는 것까지 Meta가 허용했다는 문서는 확인하지 못했다. 공식 화면이라는 이유만으로 접근 방식도 승인된 것은 아니다.

## 핵심 10개 발견

1. **Instagram의 현행 공개 영문 약관 §4.2는 명시적 허가 없는 자동 정보 접근·수집을 금지하며 로그인 여부와 무관하다고 적는다.** §6은 약관 위반 시 서비스 제한·비활성화·종료 가능성을 명시한다. 회사 계정 주인의 허가는 플랫폼의 express permission과 구별해야 한다. 화면을 보는 GPT도 자동 접근에 해당할 수 있다는 것은 이 조항을 적용한 해석이며, Meta가 GPT UI 게시를 직접 판정한 문구는 아니다. [S1]
2. **Facebook 공개 영문 약관 §3.2.3에도 사전 허가 없는 자동 데이터 접근·수집 제한이 있다.** §3.2 말미에 계정 정지/비활성화가 제재 수단으로 나온다. 업로드만 한다는 이유로 화면 읽기까지 이 조항에서 면제되는지는 확인되지 않았다. 따라서 모든 UI 게시를 법적으로 확정 금지라고 단정하거나, 반대로 수집이 아니므로 무조건 허용이라고 말하지 않는다. [S2]
3. **Threads 약관은 Instagram 약관을 편입한다.** Threads에 별도 자동접근 예외가 있다는 원문은 발견하지 못했다. Instagram의 자동접근 제한을 함께 고려해야 한다. [S3]
4. **세 플랫폼 모두 게시를 위한 공식 API가 있다.** Instagram 전문 계정(비즈니스/크리에이터), Facebook Page, Threads에는 각각 게시 기능과 권한 체계가 문서화되어 있다. 로그인된 개인 브라우저의 쿠키로 화면을 자동 클릭하는 것과 API 권한을 받아 게시하는 것은 다른 통로다. [S4–S6]
5. **SYNK 자체 소유/관리 Instagram 계정만 다루는 앱에 항상 외부 앱 심사가 필요한 것은 아니다.** 공식 개요는 이런 용도에 Standard Access가 충분하다고 한다. 외부 고객 계정까지 서비스하는 Advanced Access에는 App Review와 Business Verification이 필요하다. 전문 계정·앱 설정·게시 권한·토큰·지원 형식은 실제 구성 때 확인해야 한다. 현재 회사 계정의 연결 상태는 확인 불가다. [S4]
6. **Meta Business Suite 자체 예약은 Meta가 제공하는 정상 기능이다.** 사람이 게시물과 시간을 설정하고 Meta가 나중에 배포하는 구조가 문서화되어 있다. AI가 그 UI를 대신 반복 조작하는 방식을 별도로 승인하는 근거는 아니다. [S7]
7. **공식 발표에서 확인되는 노출·수익화 불이익은 스팸, 조작된 참여, 무관한 캡션, 비독창적 재업로드 등에 걸린다.** 이것은 GPT 사용 그 자체 또는 API 게시 그 자체에 대한 감점이라고 발표된 것이 아니다. [S8–S9]
8. **좋은 원본 콘텐츠는 방향상 유리하다.** Meta는 2026년 Facebook에서 직접 만든 원본을 우선하고 낮은 가치의 복제물을 후순위로 둔다고 밝혔다. 그렇다고 좋은 콘텐츠가 접근 규정·저작권·광고 표시·계정 신뢰 문제에 대한 면책권은 아니다. [S1–S2, S9]
9. **실제 정지 사례는 있다. 그러나 종류를 섞으면 결론이 틀린다.** 가짜 좋아요·댓글 서비스와 데이터 수집 봇에는 공식 제재·소송 사례가 있다. 신규 가짜 계정의 Selenium 자동 게시 실험에서도 정지가 있었다. 이 사례들을 정상 회사 계정의 GPT 게시와 같은 조건으로 볼 수 없다. [S10–S11]
10. **GPT UI 업로드만으로 생기는 고정 알고리즘 감점, 정확한 정지 확률, 안전 클릭 속도·일일 게시 수는 공개 증거로 확인하지 못했다.** API 호출 한도는 기술 한도이며 그 숫자까지 게시하면 정책상/사업상 안전하다는 보증이 아니다. 공식 통로를 사용해도 오탐·콘텐츠 제재·계정 보안 위험을 0으로 보장할 수 없다. [S1–S6 및 조사 한계]

## 플랫폼별 판단표

| 플랫폼 | GPT UI 자동 게시 판단 | 실제 확인한 공식 대안 | 노출/제재 근거와 한계 |
|---|---|---|---|
| Instagram | 일반 자동 접근 제한이 적용될 소지가 큼. GPT 자기계정 게시 예외 확인 못함 | 전문 계정의 Instagram API. Instagram Login 또는 Facebook Login 구성 | 약관 위반 제재 가능. 브라우저 자동화 연구에서 가짜계정 사유 정지. GPT 자체 감점 입증 없음 |
| Facebook | 사전 허가 없는 자동 접근·수집 제한. UI 업로드만의 정확한 법적 적용은 해석 구간 | Pages API, 사람이 설정한 Business Suite 예약 | 스팸 도달 감소·수익화 제외, fake Page 삭제, 비독창 콘텐츠 후순위가 공식 발표됨 |
| Threads | IG 약관 편입. 일반 UI 자동화의 별도 허용 확인 못함 | Threads API | 연구에서 IG 정지에 따른 Threads 접근 상실 관찰. 정상 회사 CU 정지율은 불명 |

## 공식 통로의 차이

- **공식 API 게시:** Meta 개발자 앱이 해당 계정의 게시 권한을 받고 문서화된 endpoint(게시 요청 주소)를 사용한다. 전문 계정 여부·권한·앱 상태·지원 형식·한도를 준수한다. GPT가 상위에서 문안을 생성하거나 게시 요청을 준비해도 실제 통로는 API다. Meta Partner 로고가 반드시 있어야만 합법적인 자체 앱이 되는 것은 아니다. [S4–S6]
- **사람이 Meta 자체 예약 설정:** Business Suite에서 원고·시간을 설정한 뒤 Meta 서비스가 예약 실행한다. 자체 제공 기능이라는 직접 근거가 있다. [S7]
- **GPT가 Meta 자체 UI 자동 조작:** 화면을 읽고 클릭·입력·파일 업로드를 한다. 서비스 화면은 공식이지만 접근 주체와 실행 방식은 자동화다. API 앱 권한을 받았다는 뜻이 아니며, UI 접속에 대한 별도 허가는 확인 못했다. [S1–S3 해석]
- **외부 예약 서비스:** 이름만으로 판단하면 안 된다. 실제 게시가 공식 API인지, 비밀번호/세션 쿠키를 받아 UI를 조작하는지, 개인 계정 제한을 우회하는지 확인한다. 이는 서비스별 검증 항목이며 이번 조사에서 특정 업체에 대한 안전 인증을 한 것은 아니다.

## 실제 제재·연구 사례의 증거 수준

### C1. Meta의 자동화 악용 제재 — 공식 1차 발표

2020-06-18 최초 게시, 2020-08-12와 2021-05-18 후속. Meta는 MGP25의 자동 가짜 좋아요·댓글 판매 계정을 비활성화한 뒤 스페인 법원 중지 명령을 받았다고 설명한다. Massroot8은 타인의 로그인 정보를 받아 데이터를 수집하는 봇이었고, 계정 비활성화 뒤 2021년 합의에 따른 사용금지 명령이 있었다. **정지와 법적 집행이 실제 있었다는 Meta 당사자 발표이며, GPT 자기 콘텐츠 업로드 사례는 아니다.** 법원 문서 전문을 별도로 읽은 것은 아니므로 법원 결론은 Meta 발표 범위로 인용한다. [S10]

### C2. Selenium + GPT-4o 자동 게시 실험 — 직접 수행한 연구

2024-09-27 공개 arXiv v1, 「Social Media Bot Policies: Evaluating Passive and Active Enforcement」. §IV는 Selenium/ChromeDriver로 브라우저를 조작하고 GPT-4o·DALL-E 3로 글/이미지를 생성했다고 설명한다. §V-A는 허구 이름·생일·이메일의 신규 계정, §V-B는 Facebook 3회, Instagram 3회 정지와 네 번째 계정 게시 성공을 보고한다. Facebook 통지 사유는 Account Integrity and Authentic Identity 및 가짜 계정이며 Instagram도 같은 이유라고 한다. Threads도 앞선 IG 정지 때 접근이 제거되었다.

**해석:** 자동 브라우저 게시 실험과 정지가 함께 관찰된 관련 사례다. 그러나 시각적 GPT computer use 자체의 사례는 아니며, 신원과 신규 계정이라는 교란 요인이 있다. 실험 계정 수를 분모로 SYNK 정지 확률을 계산할 수 없고, 네 번째 성공도 무위험 증명이 아니다. 연구는 스팸·타인 상호작용·기만 콘텐츠 게시를 피했다고 밝히지만 fake account 사유는 남는다. [S11]

### C3. Make 자동 명언 이미지 실험 — CU 사례로 분류하면 오류

2025년 논문 「Using artificial intelligence (AI) to spread misinformation and fake content within social media posts」, DOI 10.48009/4_iis_2025_126. 관찰기간 2025-02-12~04-20. Model 1은 Make의 Google Sheets→OpenAI→DALL-E→Instagram/Meta 게시 흐름이며, 초기 매시간에서 이후 두 시간마다 게시하도록 바꾸었다. Results는 Day 3 Instagram 정지 및 복구, 2주 block, 중복 게시·빈 이미지·모듈 오류를 보고한다.

**해석:** 반복 자동 게시 운영 중 정지 관찰 사례지만 브라우저 computer use의 증거가 아니다. Make 내부 연결의 모든 인증 방식·정지 통지 원문은 논문에서 확정하지 못했다. 인물 표현·내용·게시 빈도·사람의 상호작용·생성 모델·오류가 모델 간 다르므로 성과 차이를 자동 업로드 알고리즘 감점으로 귀속할 수 없다. 본문의 '친구 0명'과 주차 경과의 친구 요청 서술도 지표 정의가 혼재한다. [S12]

### C4. 'GPT computer use라서 정지' 직접 사례 검색

검색어: `"ChatGPT agent" Instagram banned suspended upload`, `"Instagram" "computer use" "banned"`, `"ChatGPT agent" "Facebook" "suspended"`, `"Threads" "automated" "suspended" posting` 등. 검색 결과에는 자동화 업체 블로그의 일반 경고·판매 문구·회피 안내가 많았다. 계정·사용 방식·통지 원인·다른 위반 요인이 확인되는 GPT 시각 CU 단독 원인 사례는 발견하지 못했다. **검색에서 미발견이며 실제로 없다는 증명이 아니다.**

## 알고리즘 불이익을 읽는 기준

Facebook의 2025-04-24 스팸 발표는 무관한 캡션/지나친 해시태그 등으로 도달을 조작하는 계정의 비팔로워 배포와 수익화를 제한할 수 있다고 설명한다. 대규모 동일 스팸 계정망, 가짜 참여도 별도 대상이다. 2024년 자동 팔로우를 악용한 가짜 Page 1억 개 이상을 제거했다고 보고한다. **브랜드 여러 개를 정상 관리하는 것과 이 가짜 계정망을 같은 것으로 간주하지 않는다.** [S8]

2026-03 Facebook 원본 콘텐츠 발표는 창작자가 직접 생산한 콘텐츠와 의미 있는 새로운 기여를 인정하고, 다른 사람의 콘텐츠를 낮은 가치의 편집으로 재업로드하는 경우 노출·추천·수익화를 제한한다고 한다. 이는 양질의 원본을 생산하는 회사에 관련 있는 긍정적 방향이지만 개인 게시물의 도달을 보장하지 않는다. [S9]

Meta 2023년 추천 설명은 사용자별 관심·상호작용 예상·콘텐츠와 관계 등의 여러 예측을 사용한다고 설명한다. 공개 설명에서 GPT UI 업로드 전용 감점은 확인하지 못했다. 공개하지 않은 신호까지 없다고 결론낼 수 없으며, 조회수 하락만으로 'shadowban'을 진단하지 않는다. [S13]

## 출처 장부

모두 확인일 2026-09-10 KST. '원문 확보'는 공개 URL 문서 본문을 도구로 읽었다는 뜻이며 계정 로그인/실물 운영 검증은 아니다. 검색 요약만으로 판정을 확정한 자료는 아래 핵심 근거로 쓰지 않았다.

| ID | 공식/연구 원문 | 날짜 및 확보 | 적용 범위 |
|---|---|---|---|
| S1 | [Instagram Terms of Use](https://help.instagram.com/581066165581870/?locale=en_US) | Exa full fetch 원문 확보. 효력일 본문에 명시된 값을 확보 못함 | §4.2 자동 접근 제한, §6 서비스 중지, §7.1 API 별도 정책. 공개 영문 약관이며 회사 소재지별 계약 확정은 별도 |
| S2 | [Meta Terms of Service](https://www.facebook.com/terms.php) | 2025-01-01 효력 표시, Exa full fetch | Facebook §3.2 자동 접근과 제재. Instagram은 별도 약관이라고 문서 스스로 명시 |
| S3 | [Threads Terms of Use](https://help.instagram.com/769983657850450) | Exa full fetch. 검색 메타데이터 2025-05-28, 본문 효력일로 단정하지 않음 | Instagram 약관 편입 및 Threads 범위 |
| S4 | [Instagram Platform Overview](https://developers.facebook.com/docs/instagram-platform/overview) | Exa full fetch, 수정일 미확인 | 전문 계정·공식 게시·자체 계정 Standard Access·외부 계정 Advanced Access |
| S5 | [Pages API Posts](https://developers.facebook.com/docs/pages-api/posts/) | Exa full fetch, 2026-04-17 Updated | Facebook Page 게시·예약·권한, 일반 개인 프로필 전체로 확대 금지 |
| S6 | [Threads API Overview](https://developers.facebook.com/docs/threads/overview/) | Exa full fetch, 2025-12-22 Updated | 당사자 대리 게시가 명시된 API. 이동 24시간 API 게시 250개 한도는 기술 한도 |
| S7 | [Business Suite Save, Schedule and Reschedule](https://www.facebook.com/business/help/2223502627919449) | Exa full fetch, 게시/수정일 미표시 | 자체 예약 기능. CU 승인으로 확대 금지 |
| S8 | [Cracking Down on Spammy Content on Facebook](https://about.fb.com/news/2025/04/cracking-down-spammy-content-facebook/) | web.run 원문, 최초 2025-04-24, 표시 업데이트 2025-10-22 | 스팸 감소·가짜 Page 집행. GPT 일반 게시 제재 아님 |
| S9 | [Rewarding Original Creators on Facebook](https://about.fb.com/news/2026/03/rewarding-original-creators-on-facebook/) | Exa full fetch, 2026-03-13 게시와 03-12 표시 병존 | 원본 우선/복제 후순위와 추천·수익화 |
| S10 | [Taking Legal Action Against Those Who Abuse Our Services](https://about.fb.com/news/2020/06/automation-software-lawsuits/) | Exa full fetch, 2020-06-18, 2021-05-18 후속 | 자동화 가짜 참여/수집 당사자 집행 사례 |
| S11 | [Social Media Bot Policies: Evaluating Passive and Active Enforcement](https://arxiv.org/html/2409.18931v1) | Exa full fetch, arXiv v1 2024-09-27 | 신규 가짜 계정 Selenium+GPT 생성 실험. 기존 회사 CU와 조건 다름 |
| S12 | [Using AI to spread misinformation and fake content within social media posts](https://iacis.org/iis/2025/4_iis_2025_322-331.pdf) | Exa PDF 본문, 2025년, 실험 02-12~04-20 | Make 자동 게시. CU 인과 사례 아님 |
| S13 | [How AI Influences What You See on Facebook and Instagram](https://about.fb.com/news/2023/06/how-ai-ranks-content-on-facebook-and-instagram/) | web.run 원문 확보, 2023-06-29 | 일반 추천 메커니즘. 문서가 방어 회피를 막기 위해 일부 신호는 공개하지 않는다고 명시. 최신 모든 신호 전수 공개/검증 아님 |

## 확인하지 못한 것 및 조사 품질

- web.run은 Instagram·Threads 약관에서 429, Facebook legal/terms에서는 로그인/일시차단 화면을 반환했다. 이후 Exa의 공식 URL full fetch로 S1~S3 원문 확보에 성공했다. 앞선 대화의 '인스타 최신 약관 본문 확인 불가'는 이번 조사에서는 해소되었다. 단 검색/본문 제공기의 최신 캐시 한계와 지역별 계약 차이는 남는다.
- 조사 후반 Exa 무료 MCP 한도에 도달했다. 새 키 구매·결제 없이 남은 확인은 web.run으로 시도했다. API 구현·권한 실제 부여·계정별 추천 자격은 조사하지 않았다.
- Instagram 추천 자격 `https://help.instagram.com/653964212890722/`와 recommendations `https://help.instagram.com/313829416281232/` 상세 도움말은 web.run 재시도도 429였다. 이 파일에서는 그 내용을 확인된 근거로 사용하지 않았다.
- 정상 회사 계정의 computer use와 사람 게시/API 게시를 통제 비교한 제재율 연구, 플랫폼 내부 봇 탐지 신호, GPT UI 전용 순위 감점, '하루 N개면 안전' 기준은 미확인이다.
- 이 보고서는 무조건 금지 선언이나 정지 확률 예측이 아니라, 문서화된 허가 통로와 미확인 UI 자동화 사이의 근거 차이를 정리한다.

## 작업 원본 및 실행 범위

실제로 읽은 회사 원본: `AGENTS.md`, `docs/AI_운영원칙.md`. 작업 HEAD `b031ed4ef460a09591ee61335e6415585506057e`. 운영 원칙 작업본 SHA256 `e062c7964da828ddc43f0e61a85864f668e2ec2539fb5283f4c451bcea6b5868`. session-freshness 실행 2026-09-09T17:38:00Z: 추적 변경 14, 미추적 4144, 지문 incomplete. 다른 작업물을 수정하지 않고 이 증거 문서만 생성했다. 정본·트랙·코드·계정·예약은 변경하지 않았다. 회사 계정·학생 자료·비밀 값은 외부 조사에 전달하지 않았다.
