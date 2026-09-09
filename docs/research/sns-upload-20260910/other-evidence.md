# 확장 플랫폼 조사 근거: LinkedIn · X · Pinterest · Reddit

조사 기준: 2026-09-10 KST. 주담당 요청에 따른 확장 검토이며 회사 현행 채널 여부는 주담당이 별도 대조한다. 계정 로그인·게시·설정 변경 없이 공개 공식 정책과 1차 연구를 열어 조사했다.

## 결론 비교표

| 플랫폼 | GPT가 화면을 조작해 자동 게시 | 확인된 노출/계정 불이익 | GPT computer-use 게시 단독 정지 입증 | 권장 공식 경로 |
|---|---|---|---|---|
| LinkedIn | 무허가 봇·제3자 도구의 웹사이트 활동 자동화 및 게시 생성까지 금지. GPT UI 클릭도 자동화 범주에 들어갈 가능성이 높다는 해석이며 GPT만 지목한 예외는 찾지 못함. [L1] | 자동화·비진정성 활동 패턴에 콘텐츠 가시성 제한, 일시·영구 계정 제한 가능. 자동 댓글의 추천 댓글 제외는 공식 확인. [L2–L3] | 이 조사에서 확인 못함. 2024 Selenium+GPT-4 실험에서는 test 게시가 성공했지만 안전 입증은 아님. [R1] | 권한을 갖춘 Posts API 또는 승인 연동. 개인/조직 게시 권한과 회사 페이지 역할 필요. [L5] |
| X | 비 API 자동화를 명시 금지. 웹사이트 스크립팅을 예시로 들고 영구 정지 가능 명시. 양질 콘텐츠 예외 없음. [X1] | 위반 자동화는 검색 제외·계정 정지. 자동화 자체 전부가 금지는 아니며 규정을 지킨 정보성 API 게시 가능. [X1] | 이 조사에서 확인 못함. 2026 AI 자동화 정지 블로그는 좋아요와 게시가 섞이고 제재 원문/운영 로그가 없어 인과 입증 불가. [C1] | Create Posts API + 미디어 업로드, 사용자 인증/허용 필요. [X3] |
| Pinterest | 명시적 승인 없는 자동화 및 대신 행동하는 무허가 서비스 금지. [P1] | 지침 위반 시 콘텐츠·보드·계정 제거 또는 추천/검색 제외; 게시/저장 제한도 가능. [P2–P3] | 이 조사에서 확인 못함. 스팸 정지 후기는 자동화 미사용 주장도 있어 UI 업로드 원인으로 사용할 수 없음. | Pinterest 승인 파트너 또는 승인받은 API. Trial 생성 핀은 작성자만 보는 시험 개체이므로 공개 마케팅에 Standard 승인 필요. [P4] |
| Reddit | 2026 정책은 봇·AI 에이전트·비인간 운영 계정의 등록/앱 표시와 범위 제한을 요구. 무허가 상업 데이터 이용·스팸 금지. X처럼 UI 업로드를 한 문장으로 전면 금지한 조항이라고 확대하면 안 됨. SYNK식 상업용 GPT UI 운영의 허용은 미확인. [D1–D3] | 커뮤니티별 삭제/차단과 사이트 계정 정지가 별개. 자동·수동 모두 반복 대량 홍보 금지. API 접근 토큰 회수, 앱·계정·연관 도메인 제재 가능. [D1–D2] | 이 조사에서 확인 못함. 공식 스팸 제재 통계는 존재하지만 GPT 업로드 통계가 아님. [D5] | Devvit/승인 API와 커뮤니티 규칙 준수. 2026-08 향후 API 생태계 이행 발표로 접근 범위 재확인 필요. [D4] |

모든 플랫폼에서 ‘공식 API라서 추천 노출이 보장된다’, ‘좋은 콘텐츠라서 계정이 절대 정지되지 않는다’, ‘천천히 클릭하면 허용된다’는 결론은 근거가 없다. 업로드 경로 규정과 콘텐츠 품질/행동 규정을 각각 충족해야 한다. GPT가 작성한 문안을 사람이 직접 게시하는 것과 GPT가 계정을 조작해 게시하는 것은 다른 행위다.

## 알고리즘 관련 구분

- LinkedIn은 2026-06 공식 글에서 AI 작성 보조를 허용한다고 설명하면서, 고유 관점이 없는 일반적·반복적 AI 콘텐츠는 인맥 밖 배포가 덜 된다고 명시했다. 이것은 ‘GPT 업로드 도구 사용 감점’의 증거가 아니라 **내용과 대량 자동 상호작용**에 관한 증거다. [L4]
- X의 검색 제외는 위반 자동화에 대한 **명시된 제재**다. 허용 API로 원본 콘텐츠를 올렸다는 이유만의 보편적 감점을 입증한 공식 비교실험은 못 찾았다. [X1]
- Pinterest의 배포 제한은 추천·검색에서 제외하는 구체적 조치이며 계정 전체에 적용되면 포함된 핀에도 영향을 준다. GPT UI 게시에 일률적으로 적용되는 고정 페널티는 미확인. [P2]
- Reddit에서 저조한 노출은 추천 알고리즘뿐 아니라 커뮤니티 규칙·중재·스팸 필터·계정 연령/karma 문턱의 영향을 받을 수 있다. 어떤 커뮤니티의 양질 자료인지도 중요하다. [D1, D4]

## 사례의 증거 수준

| 자료 | 직접 관찰/발표한 것 | 이 자료로 말할 수 없는 것 |
|---|---|---|
| 2024-09-27 1차 연구, Selenium+GPT-4 [R1] | 연구진의 브라우저 봇 실험. Facebook·Instagram 각각 세 차례 계정 정지, 통지 사유는 계정 진정성/가짜 계정. Threads 연동 접근도 제거. 이후 다른 계정에서 성공. X·LinkedIn·Reddit test 게시도 성공. | 현행 GPT computer-use 제품/기존 정상 브랜드 계정/양질 콘텐츠를 사용한 무작위 실험 아님. 신규 계정 생성, 반복 로그인, 프로필 미비 등이 혼재. 초록의 최종 성공을 모든 시도 무제재로 읽으면 오류. 성공률·정지확률 계산 불가. |
| LinkedIn 2026-03-13 공식 발표 [L3] | 참여 품앗이 그룹 제거, 관련 계정에 경고, 자동 댓글 노출 제한과 사용 제한을 설명. | 원본 게시물 업로드만 하던 GPT 이용자의 영구 정지 사례는 아님. |
| Reddit H2 2025 공식 투명성 보고 [D5] | 일시·영구 계정 금지 총 3,181,420건을 보고. 사유에는 폭력·혐오·괴롭힘·스팸 공격 등이 혼재. | 봇 계정 수·GPT 계정 수·고유 사용자 수·선량한 자동 게시자의 위험률로 환산 불가. |
| Hack-Log 2026-04-14 개인 후기 [C1] | 저자는 새 Threads 계정에서 좋아요·댓글·팔로우 자동화 후 5일 만 영구 정지됐다고 주장. X의 OpenClaw/Claude Code 좋아요·게시 정지는 전언. | 플랫폼 통지 원문·실행 로그·게시만의 대조군이 없어 독립 인과 검증 불가. GPT 게시 전용 사고로 인용하면 안 됨. 글의 탐지 방법 추정은 채택하지 않음. |

## 공식 근거 목록

모든 항목은 2026-09-10 KST에 원문을 열었다. ‘표시 없음’은 정확한 수정일을 확인 못 했다는 뜻이다. 날짜 없는 문서를 오래됐다고 단정하지 않았다.

| ID | 제목 및 URL | 원문 표시 날짜 | 읽은 핵심/한계 |
|---|---|---|---|
| L1 | [Prohibited software and extensions](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions) | 상대 표시: 2 years ago | 웹사이트 활동 자동화 금지, create/comment/like/share 포함, 계정 제한/폐쇄 위험. |
| L2 | [High volume of content shared](https://www.linkedin.com/help/linkedin/answer/a1339697/high-volume-of-messages-sent?lang=en) | 상대 표시: 1 year ago | 짧은 기간 대량 게시 등 자동화 패턴에 가시성/계정 제한, 반복 일시 제한 뒤 영구 제한 가능. |
| L3 | [What We’re Doing to Support Authentic Content and Conversations on LinkedIn](https://news.linkedin.com/2026/authentic-content-and-conversations) | 2026-03-13 게시 | 실제 그룹 제거·경고, 자동 댓글 추천 제외·계정 제한. |
| L4 | [Keeping conversations real on LinkedIn](https://news.linkedin.com/2026/keeping-conversations-real-on-linkedin) | 2026-06-04 게시; 2026-05-20 원글 | AI 보조 집필 허용과 실질 없는 AI 콘텐츠의 인맥 밖 배포 제한 구분. |
| L5 | [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-03) | 버전 2026-03 문서; 본문 수정일 미확인 | 유기적/광고 게시, 이미지·영상·문서 지원, 사용자·조직 권한. 구버전 폐기 공지가 있어 구현 시 현행 버전 재확인. |
| X1 | [Automation rules](https://help.x.com/en/rules-and-policies/x-automation) | 2026-04 수정 | 비 API 자동화 금지와 영구 정지, 위반 자동화 검색 제외, 정보성 자동 게시 허용의 조건. AI 자동 답글은 사전 서면 승인 필요하므로 일반 게시와 분리. |
| X2 | [Help on your suspended X account](https://help.x.com/en/managing-your-account/suspended-x-accounts) | 표시 없음 | 대부분 정지가 스팸/가짜 계정이라고 공식 설명. 도용 의심 정지와 이의 제기 경로도 설명. 플랫폼의 총괄 설명이며 GPT 통계 아님. |
| X3 | [Create Posts](https://docs.x.com/x-api/posts/create-post) | 표시 없음 | 게시 및 미디어 연결, 사용자 인증 필요. 계정별 실제 사용 승인/비용은 조사하지 않음. |
| X4 | [Platform Manipulation](https://transparency.x.com/en/reports/platform-manipulation) | 정확한 시점 미확인, 과거 투명성 페이지 | 의심 활동에 본인 확인을 요구할 수 있고 미완료 시 정지 가능. 최신 금지 조항은 X1 기준. |
| P1 | [Community guidelines](https://policy.pinterest.com/en/community-guidelines) | 2026-05 수정 | 무승인 자동화 금지, 반복/기만/무관한 수익 콘텐츠·메트릭 조작 금지. 페이지는 **2026-11-12 시행 예정 개정안** 링크를 별도 제공하므로 현행 본문과 혼동하지 않음. |
| P2 | [Enforcement](https://policy.pinterest.com/en/enforcement) | 표시 없음 | 제거, 추천/검색 제외, 계정·보드 단위 파급, 게시/저장 제한. |
| P3 | [Account suspension](https://help.pinterest.com/en-gb/article/account-suspension) | 표시 없음 | 스팸·계정 보안·지재권 등 단발/반복 위반 정지와 이의 제기. |
| P4 | [Understanding our access tiers](https://developer.pinterest.com/docs/key-concepts/access-tiers/) | 표시 없음 | Trial 핀/보드는 작성자에게만 보임. 공개 운영 Standard 심사, 혼자 쓰는 앱도 인증 흐름 영상 필요. |
| P5 | [Create Pin](https://developer.pinterest.com/docs/api/v5/pins-create/) | 표시 없음 | 원문 열기는 성공했으나 추출 본문 15줄로 상세 기능 확인 불가. API 생성 가능 여부/공개 범위 판단은 P4 근거로 제한. |
| D1 | [Spam](https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam) | 2026-05-19 수정 | 자동·수동 모두 원치 않는 반복 대량 활동 금지. 제품 지속 홍보 봇 예시, 각 커뮤니티 중재자 판단. |
| D2 | [Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy) | 2026-06-05 수정 | API 명시 승인, 상업 데이터 사용 서면 승인, 봇/AI 에이전트 등록·라벨·별도 앱 계정, 스팸 금지, 계정/토큰/관련 대상 제재. |
| D3 | [User Agreement](https://redditinc.com/policies/user-agreement) | 2026-05-26 수정, 2026-07-01 시행 | §7 과부하/무허가 접근·수집 금지, §17 계정 중단 권한. 모든 UI 게시 자체 금지로 단순화하지 않음. |
| D4 | [Modernizing Reddit’s Infrastructure and Moderation Tools](https://redditinc.com/news/modernizing-reddits-infrastructure-and-moderation-tools) | 2026-08-05 게시 | API의 장기 Devvit 이행 방향, 당일 전면 교체 아님. 계정 연령/karma 문턱도 별도 존재. |
| D5 | [Transparency Report: July to December 2025](https://redditinc.com/policies/transparency-report-july-to-december-2025-reddit) | 대상 기간 2025-07~12; 정확한 게시일 미확인 | Account Sanctions 부분 직접 확인. 스팸·기타 규정 제재 통계이며 GPT UI 별도 집계 없음. |

## 연구/후기 출처와 검색 한계

- R1: [Social Media Bot Policies: Evaluating Passive and Active Enforcement](https://arxiv.org/html/2409.18931v1), Radivojevic 외, arXiv v1 2024-09-27. 초록·방법·V-B·V-C·한계 절 직접 확인. 현재 약관 근거로 사용하지 않고 과거 1차 관찰로만 사용.
- C1: [SNS Account Suspension Due to AI Automation? 3 Things You Must Not Do](https://note.com/hacklog_stealth/n/nf68bb6543309?hl=en-US), 2026-04-14. 개인 1차 경험 주장+X 전언 혼재. 표시 영어 본문은 자동 번역이라고 고지. 사실 확정용이 아닌 온라인 경고 주장의 내용/교란 확인용.
- 검색: 각 플랫폼의 공식 automation/bots/terms/API/visibility/suspension, GPT computer use/ChatGPT agent/banned/restricted, AI automation 정지 후기를 조합. 네 플랫폼에서 **정상 브랜드 계정이 GPT computer-use로 양질 원본 콘텐츠만 올렸고 다른 위반 요인이 배제된 정지 사례**는 이 조사 범위에서 찾지 못했다. 없다는 증명은 아니다.
- 실제 계정 제재 이력, 사용 중 연동 승인, 지역별 계약, 계정 유형, 게시 예정 콘텐츠 저작권/학생 동의는 확인하지 않았다. 발생 확률을 수치로 산정할 분모·대조군 없음.

## 작업 원본과 확인 기록

- 읽은 로컬 원본: AGENTS.md, docs/AI_운영원칙.md 전문.
- 기준 HEAD: b031ed4ef460a09591ee61335e6415585506057e. 운영 원문 SHA256: e062c7964da828ddc43f0e61a85864f668e2ec2539fb5283f4c451bcea6b5868.
- session-freshness.js 현재 조회: 2026-09-09T17:39:17.058Z, 앞섬/뒤처짐 0, 추적 변경 14, 미추적 4144, 전체 내용 지문은 incomplete. 다른 변경 보존. 이 파일만 새로 작성했으며 게시·배포·계정 조작 없음.
