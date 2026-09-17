# 상담AI 개통 — 현재 상태와 남은 일

<!-- 정본 파생: 상담AI.js · contents_상담AI.js · docs/상담AI_설치_v1.md -->

> 2026-09-11 실계정과 라이브를 다시 대조한 상태표입니다. 인증값과 액세스 토큰은 이 문서나 Git에 적지 않고 Apps Script의 **스크립트 속성**에만 둡니다.

## 현재 상태

| 항목 | 상태 | 확인·처리 내용 |
|---|---|---|
| 공개 홈페이지 | ✅ | `https://synk.im/` |
| 개인정보처리방침 | ✅ | `https://synk.im/privacy/` 공개·HTTPS |
| Facebook 페이지 | ✅ | SYNK 페이지가 비즈니스 포트폴리오에 연결됨 |
| Instagram | ✅ | `@synk.mn` 프로페셔널 계정이 페이지와 연결됨 |
| Apps Script 웹앱 | ✅ | 고정 배포 URL 사용 |
| 웹훅 URL 키·검증 토큰 | ✅ | 새 임의값으로 생성해 스크립트 속성에 저장. 값은 문서에 기록하지 않음 |
| 페이지·Instagram 계정 ID 잠금 | ✅ | 스크립트 속성에 저장 |
| Meta 앱 | ✅ | `SYNK Guide` 생성·기본 설정·앱 아이콘 저장 후 **게시됨** 상태 확인 |
| Facebook 페이지 토큰 | ⏳ | SYNK 페이지 연결 뒤 발급하여 `상담AI_페이지토큰`에 저장 |
| Instagram 전용 토큰 | ⚠ 교체 필요 | 저장값이 Meta 화면의 마스킹 표시값과 같은 형태임을 확인. 실제 토큰으로 교체하기 전에는 발송하지 않음 |
| Instagram 웹훅 | ✅ | 계정 구독 스위치 활성화, 고정 웹앱 콜백 검증·저장. 버전 49 `doGet` 완료 기록 확인 |
| Facebook 웹훅 | ⏳ | 페이지 토큰 발급 뒤 같은 웹앱에 `messages`를 연결 |
| Instagram 접근 수준 | ✅ Standard 범위 | 앱 소유자가 관리하고 App Dashboard에 추가한 `@synk.mn`은 Standard Access로 서비스 가능. 다른 사업자의 계정을 서비스할 때만 Advanced Access가 필요 |
| 사업자 인증 | ⛔ 보류 | 신규 사업자등록증 발급 전에는 신청하지 않음. 현재 `@synk.mn` 자체 계정 DM 시험의 선행조건은 아님 |

## 스크립트 속성

| 이름 | 상태·용도 |
|---|---|
| `CLAUDE_API_KEY` | 기존 값 사용 |
| `상담AI_URL키` | ✅ 생성·저장. 콜백 URL의 요청 잠금. 값 비공개 |
| `상담AI_검증토큰` | ✅ 생성·저장. Meta 웹훅 최초 확인용. 값 비공개 |
| `상담AI_페이지ID` | ✅ SYNK 페이지만 받도록 잠금 |
| `상담AI_IG계정ID` | ✅ `@synk.mn`만 받도록 잠금 |
| `상담AI_페이지토큰` | Meta 앱에서 발급 뒤 저장 |
| `상담AI_IG토큰` | ⚠ 실제 Instagram API 토큰으로 교체 필요. 마스킹 표시값·페이지 토큰을 사용하지 않음 |
| `상담AI_IG토큰만료시각` | 자동 갱신 성공 때 코드가 기록. 사람이 직접 입력하지 않음 |
| `상담AI_IG토큰발급시각` | ✅ 이번 발급 시각 기록. 이후 새 장기 토큰 저장 직후 다시 기록 |
| `상담AI_OFF` | 긴급 정지 시에만 `1` |

## Meta 앱 설정값

| 항목 | 값 |
|---|---|
| 앱 이름 | `SYNK Guide` |
| 사용 사례 | Messenger 고객 소통 + Instagram 메시지·콘텐츠 관리 |
| 앱 도메인 | `synk.im` |
| 개인정보처리방침 | `https://synk.im/privacy/` |
| 이용약관 | `https://synk.im/terms/` |
| 데이터 삭제 안내 | `https://synk.im/data-deletion/` |
| 카테고리 | 교육 |
| 게시 상태 | 게시됨 |
| Instagram 앱 | `SYNK Guide-IG` · `@synk.mn` 테스터 승인 |
| Facebook 권한 | `pages_messaging` |
| Instagram 권한 | `instagram_business_basic` + `instagram_business_manage_messages` |
| 웹훅 객체 | `page`, `instagram` |
| 기본 구독 필드 | `messages`, `messaging_postbacks` |

콜백 URL은 고정 Apps Script `/exec` 주소에 비공개 `상담AI_URL키`를 붙입니다. Meta의 확인 토큰에는 비공개 `상담AI_검증토큰`을 넣습니다. 두 값 모두 화면에서 직접 붙이고 문서·이슈·채팅·로그에는 복사하지 않습니다.

## 코드가 지키는 경계

- Facebook은 `graph.facebook.com`, Instagram은 `graph.instagram.com`으로 분리합니다.
- Instagram에는 실제 전용 토큰만 사용합니다. 값이 없거나 Meta 화면의 마스킹 표시값이면 Claude 호출 전부터 발송을 닫아 비용과 침묵을 함께 막습니다.
- Instagram 장기 토큰은 새 토큰의 발급시각부터 24시간이 지난 뒤 갱신 가능하며, 이후 매일 수명을 확인하고 만료 14일 전부터 자동 갱신합니다. 발급시각을 모르는 기존 토큰은 즉시 갱신을 시도합니다. 실패하면 기존 토큰을 보존하고 토큰값 없이 주 1회 경고합니다.
- 사용자가 먼저 보낸 메시지에만 답하고 24시간 창 밖의 홍보 발송은 하지 않습니다.
- Facebook 수신 ID는 `상담AI_페이지ID`, Instagram 수신 ID는 `상담AI_IG계정ID`와 각각 대조하며 해당 플랫폼의 설정값과 다르면 웹훅을 거부합니다.
- 첫 답장에서 자동 상담 봇임을 밝히고, 지식에 없는 가격·일정·정책은 만들어내지 않고 사람에게 넘깁니다.
- 미성년자로 보이는 사용자에게 연락처를 요구하거나 저장하지 않습니다.

## 개통 확인 순서와 현재 진행

1. ✅ 앱 생성·기본 정보·정책 URL·앱 아이콘 저장과 게시
2. ✅ SYNK Facebook 페이지와 `@synk.mn` 연결
3. ⚠ Instagram 전용 토큰은 실제 값으로 교체해야 함. Facebook 페이지 토큰도 남음
4. 🔄 Instagram 콜백 검증과 계정 구독은 완료. Facebook 웹훅은 남음
5. ✅ 별도 Instagram 계정에서 `@synk.mn`으로 실계정 DM을 보냄. 웹훅 수신·Claude 답변 생성·`상담로그` 적재까지 확인
6. ⚠ Instagram Send API 발송은 저장된 토큰 문제로 HTTP 400. 실제 토큰 교체 뒤 자동화 고지·몽골어 답장·인계를 다시 확인
7. Facebook 채널을 열 때 페이지 토큰과 Facebook 웹훅을 별도로 연결

## 사업자 인증 전 가능한 범위

Meta 공식 Instagram API 문서상, 앱 소유자가 직접 관리하고 App Dashboard에 추가한 `@synk.mn`을 서비스하는 데는 Standard Access가 적용됩니다. Advanced Access는 소유·관리하지 않는 다른 Instagram 프로페셔널 계정을 서비스할 때 필요합니다. 따라서 신규 사업자등록증과 비즈니스 인증은 현재 자체 계정 DM의 기술 선행조건이 아닙니다. 현재 실제 장애는 접근 심사가 아니라 Instagram 전용 토큰 저장값이며, 이를 교체한 뒤 실계정 왕복으로 개통을 판정합니다. 댓글·게시·인사이트 권한은 추가하지 않았습니다.

실계정 시험 전에 Meta Business Suite의 Instagram 인스턴트 답장과 부재 중 메시지를 해제했고, 날짜·정원·개인정보 수집 문구가 낡은 질문 및 응답 자동화는 전체 비활성화했습니다. Messenger 자동화는 유지합니다.

## 장애 확인

| 증상 | 우선 확인 |
|---|---|
| 웹훅 확인 실패 | 콜백의 URL 키, Meta 확인 토큰, 고정 배포 URL |
| Facebook 답장 없음 | `상담AI_페이지토큰`, 페이지 연결, `messages` 구독 |
| Instagram 답장 없음 | `상담AI_IG토큰`, `@synk.mn` 연결, `instagram_business_basic` + `instagram_business_manage_messages`, `messages` 구독 |
| 즉시 중단 필요 | 스크립트 속성 `상담AI_OFF=1` |
