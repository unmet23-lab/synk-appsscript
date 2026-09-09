# 국내 채널·구독 채널·자사 웹 조사 근거

확인 기준: 2026-09-10 KST. 공개 원문과 회사 문서만 확인했으며 실계정 제재 상태·로그인·게시·연동 설치는 조사하지 않았다.

## 회사 채널 범위

현재 `docs/마케팅_정본.md` §7의 플랫폼은 YouTube, Instagram, TikTok, Facebook, Telegram, Substack, Threads, LinkedIn 및 자사 웹이다. §7은 저장소의 09-07~08 계정 기록을 인용하며 실시간 계정 확인이 아니라고 명시한다. 09-09 확장 실행 문서는 네이버 블로그, 카카오톡 채널, Pinterest를 추가하며 신규 개설 상태는 미확인이다. Google Business Profile은 오프라인 LAB 조건부 후보다. X와 Reddit은 이번 비교 확장 대상이며 현재 SYNK 운영 채널로 확인하지 않았다. 계정 수와 플랫폼 수를 혼동하지 않는다.

## 비교

| 대상 | 컴퓨터 유즈 게시 해석 | 불이익 근거 | 실무 대안 / 미확인 |
|---|---|---|---|
| 네이버 블로그 | 사전 허락 없는 자동 로그인·게시를 명시적으로 제한. 봇/매크로 등의 예시는 특정 제품에 한정되지 않으므로 GPT 화면 자동조작도 적용 가능성이 높다. | 게시물 운영정책에 무허가 자동화 게시물 게재 제한. 이용약관에 일시/영구 이용 제한 가능. | 사람이 공식 편집기에서 게시·예약하거나 네이버의 해당 자동화 허용 확인. 현행 공개 API 목록의 블로그 **검색/공유** 기능을 블로그 **글쓰기** API로 오인하지 않는다. |
| 카카오톡 채널 | 카카오비즈니스 약관 §19는 회사가 제공하지 않은 접속 방식, 에이전트·로봇·스크립트 등의 제작/배포/설치를 제한한다. 해당 규정이 모든 GPT 보조 클릭을 특정해 판정한 것은 아니나 무인 UI 자동 게시의 승인 근거는 없다. | §30 이용 제한/해지 및 타 서비스로의 영향 가능. GPT 업로드만의 추천 감점이나 정지 확률 자료는 미발견. | 채널 관리자센터 공식 소식 작성. 메시지/알림톡 API 지원을 채널 홈 소식 게시 API로 대신 설명하지 않는다. 소식 자동 게시 허용 범위는 별도 확인 필요. |
| Telegram | Bot API로 채널에 게시할 공식 통로가 있다. 이것이 개인 계정을 조작하는 임의 UI 봇의 포괄 승인은 아니다. | Bot Developer Terms의 원치 않는 메시지·스팸 금지. Spam FAQ는 신고 후 계정 기능 제한, 오제한과 복구 경로 설명. | 채널 관리 권한을 부여한 공식 Bot API로 자료 게시. 불특정인 DM/강제 초대와 구독자가 선택한 채널 게시를 구분. |
| Substack | TOS에 스팸/자동응답·비로그인 작동 프로세스·스크래핑·서비스 방해 제한. 로그인 상태의 자기 발행물 UI 게시 전부를 명시 금지한다고 확대할 수 없으며 GPT 허용도 확인하지 못했다. | 약관 위반 시 계정 종료. Publisher Agreement는 AI 콘텐츠 분석·표시와 이의 제기를 설명하지만 GPT 업로드만의 일괄 노출 감점을 설명하지 않는다. | 공식 편집기/예약 발행. 일반 공개 글쓰기 API 승인 통로 미확인. 웹 게시와 구독자 메일 발송은 다른 동작. |
| Google Business Profile | 정식 소식 게시 API 제공. 임의 UI 자동접속의 허용은 별도 미확인. | 부적격 사업·잘못된 정보·정책 위반과 API 사용을 분리. GPT 게시만의 독립 감점/정지 사례 미발견. | 실제 대면 사업의 자격과 관리 권한을 확인한 뒤 공식 API 검토. 온라인 전용 SHIFT는 주소만 넣어 등록하는 대상이 아님. |
| 자사 웹·검색 | 소유한 웹사이트의 승인된 배포 자동화는 타사 SNS UI 접속과 다르다. | Google의 scaled content abuse는 검색 조작을 위한 대량 저가치 콘텐츠를 다루며 생성 수단과 무관. 사이트 자동 배포만의 감점 증거 아님. | GPT로 제작하고 기존 호스팅 배포 통로로 발행. SNS와 별개로 검색 품질 조건 확인. |

## 사례와 인과성

IACIS 2025 논문은 2025-02-12~04-20 Make 자동 게시 실험에서 인스타그램 3일째 정지 후 복구와 2주 차단을 보고한다. **GPT 화면 조작 실험이 아니다.** 명언 이미지의 매시간/2시간 게시, 빈 이미지·중복 게시·잘못된 시트 데이터·도구 고장 등이 섞였다. 비교군은 이미지 생성 모델과 소재·사람 선별·상호작용까지 달랐다. 자동 업로드 경로만의 추천 감점이나 정지 원인으로 사용하지 않는다. 논문 내 친구 수 서술도 일관되지 않아 성과 수치 비교를 채택하지 않는다.

네이버·카카오·Telegram·Substack에서 기존 정상 브랜드 계정의 GPT computer-use 원본 게시만이 원인으로 통제·확인된 제재 사례는 이번 탐색에서 확보하지 못했다. 직접 사례 부재는 허용이나 안전의 증거가 아니다. 업체 광고·프로그램 판매글의 '안전 속도'·'저품질 회피' 주장은 근거에서 제외했다.

## 원문 목록

모든 URL 확인일은 2026-09-10 KST. 정확한 갱신일이 보이지 않는 문서는 날짜 미확인으로 남긴다.

| ID | 원문 | 표시 날짜·사용 범위 |
|---|---|---|
| N1 | [네이버 이용약관](https://policy.naver.com/policy/service.html) | 시행일 2025-07-10(공식 HTML 직접 재조회). 자동 로그인/게시/검색 등과 제재 조항 원문 확인. |
| N2 | [네이버 게시물 운영정책](https://policy.naver.com/rules/service_group.html) | 갱신일 미확인. 서비스 신뢰성/안전성 절의 무허가 자동화 게시 제한. |
| N3 | [네이버 오픈 API 목록](https://developers.naver.com/products/intro/plan/plan.md) | 갱신일 미확인. 검색/카페 글쓰기/공유하기와 블로그 글쓰기 구분. |
| K1 | [카카오비즈니스 이용약관](https://kakaobusiness-policy.kakao.com/SERVICE/) | 직접 웹 원문 부칙 2026-08-31 시행. Exa 추출판은 2026-06-01 표기로 불일치하여 직접 원문 우선. §19/§30 제한 조항은 양쪽에서 확인. |
| K2 | [카카오톡 채널 소식 작성](https://kakaobusiness.gitbook.io/main/channel/run/post) | 정확한 갱신일 미확인. 공식 관리자 기능이며 AI UI 조작 승인 문서 아님. |
| T1 | [Telegram Bot Developer Terms](https://telegram.org/tos/bot-developers) | 정확한 갱신일 미확인. 봇 서비스와 스팸 제한. |
| T2 | [Telegram Bot API](https://core.telegram.org/bots/api#sendmessage) | 버전별 변경은 원문 참조. 채널을 대상으로 하는 sendMessage 등 공식 통로. |
| T3 | [Telegram Spam FAQ](https://telegram.org/faq_spam) | 날짜 미확인. 원치 않는 연락/그룹 초대, 제한·이의 제기. |
| T4 | [Telegram Bots FAQ](https://core.telegram.org/bots/faq) | 날짜 미확인. 발송 제한과 429 오류, 유료 방송은 별도이며 이번 제안에 구매 포함 안 함. |
| S1 | [Substack Terms of Use](https://substack.com/tos) | 2025-04-21 시행. 제한행위/종료. |
| S2 | [Substack Publisher Agreement](https://substack.com/pa) | 2026-07-20 수정. AI 분석과 표시 결과 이의 제기. AI 업로드 경로 제재와 구별. |
| S3 | [Substack Content Guidelines](https://substack.com/content) | 날짜 미확인. 스팸 등 콘텐츠 정책. |
| S4 | [Substack 게시 도움말](https://support.substack.com/hc/en-us/articles/360037831771-How-do-I-publish-a-new-post-on-Substack) | 공식 게시 절차. 공개 웹·메일·예약 분리. |
| G1 | [Google Business Profile Create Posts](https://developers.google.com/my-business/content/posts-data) | 2026-08-28 갱신. 앱 등록/인증과 소식 API, 상품 게시물은 같은 기능 아님. |
| G2 | [Business eligibility and ownership guidelines](https://support.google.com/business/answer/13763036?hl=en) | 날짜 미확인. 대면 요건·온라인 전용 사업 제외·관리 권한. |
| G3 | [Google Search Spam Policies](https://developers.google.com/search/docs/essentials/spam-policies#scaled-content) | 현행 본문 조회. 검색 조작을 위한 대량 콘텐츠와 자동화 제작/배포 구별. |
| C2 | [Using artificial intelligence (AI) to spread misinformation and fake content within social media posts](https://iacis.org/iis/2025/4_iis_2025_322-331.pdf) | Chergarova 외, Issues in Information Systems 26(4), 322–331, 2025. DOI 10.48009/4_iis_2025_126. 방법/결과/한계 읽음. Make 워크플로 사례. |

## 공개 증거의 한계

제재 확률을 계산할 계정·기간별 분모, 적법한 기존 회사 계정 대조군, 플랫폼 내부 탐지 기록은 없다. 공식 약관상 제한이 명확한 곳도 GPT 사용을 실제로 탐지한 빈도는 알 수 없다. 웹 페이지 접근 도구의 429/로그인 요구는 SYNK 계정에 발생한 제재가 아니다.

## 독립 원문 대조

2026-09-10 KST 별도 조사자가 카카오·Substack·네이버·Telegram·Google의 핵심 조항을 재조회했다. 카카오 공식 HTML 부칙의 2026-08-31 시행을 재확인했다. 일부 웹 추출에는 부칙이 누락되므로 추출본의 날짜 미검출을 시행일 부재로 해석하지 않는다. Substack의 제한 문구는 비로그인 프로세스·스팸·자동응답·스크래핑 등을 말하며 로그인 상태의 모든 자동 게시 금지로 확대하지 않은 현재 판단을 유지한다. Telegram 채널을 대상으로 하는 Bot API와 Google의 대면 사업 자격/소식 API/검색 스팸 정의도 대조했으며, API 지원을 임의 UI 자동화 승인으로 바꾸어 설명한 오류는 발견하지 못했다. 네이버 이용약관 시행일만 추가 확인해 보완했다. 회사 채널 실계정 상태와 C2 논문은 이 독립 대조의 범위 밖이다.
