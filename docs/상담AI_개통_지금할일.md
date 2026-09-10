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
| Meta 앱 | ⏳ | `SYNK Guide` 생성 흐름 진행 중. Meta가 앱 생성 확인용 비밀번호 재입력을 요구함 |
| Facebook 페이지 토큰 | ⏳ | 앱 생성 뒤 발급하여 `상담AI_페이지토큰`에 저장 |
| Instagram 전용 토큰 | ⏳ | 앱 생성 뒤 발급하여 `상담AI_IG토큰`에 저장 |
| 웹훅 구독 | ⏳ | 앱 생성 뒤 Facebook·Instagram의 `messages`를 같은 웹앱에 연결 |
| 일반 사용자 고급 액세스 | ⏳ | `pages_messaging` + `instagram_business_manage_messages` |
| 사업자 인증 | ⛔ 보류 | 신규 사업자등록증 발급 전에는 신청하지 않음. 폐업한 예전 등록번호를 재사용하지 않음 |

## 스크립트 속성

| 이름 | 상태·용도 |
|---|---|
| `CLAUDE_API_KEY` | 기존 값 사용 |
| `상담AI_URL키` | ✅ 생성·저장. 콜백 URL의 요청 잠금. 값 비공개 |
| `상담AI_검증토큰` | ✅ 생성·저장. Meta 웹훅 최초 확인용. 값 비공개 |
| `상담AI_페이지ID` | ✅ SYNK 페이지만 받도록 잠금 |
| `상담AI_IG계정ID` | ✅ `@synk.mn`만 받도록 잠금 |
| `상담AI_페이지토큰` | Meta 앱에서 발급 뒤 저장 |
| `상담AI_IG토큰` | Instagram API에서 발급 뒤 저장. 페이지 토큰으로 대체하지 않음 |
| `상담AI_IG토큰만료시각` | 자동 갱신 성공 때 코드가 기록. 사람이 직접 입력하지 않음 |
| `상담AI_OFF` | 긴급 정지 시에만 `1` |

## Meta 앱 설정값

| 항목 | 값 |
|---|---|
| 앱 이름 | `SYNK Guide` |
| 사용 사례 | Messenger 고객 소통 + Instagram 메시지·콘텐츠 관리 |
| 앱 도메인 | `synk.im` |
| 개인정보처리방침 | `https://synk.im/privacy/` |
| 데이터 삭제 안내 | `https://synk.im/privacy/` |
| 카테고리 | 교육 |
| Facebook 권한 | `pages_messaging` |
| Instagram 권한 | `instagram_business_manage_messages` |
| 웹훅 객체 | `page`, `instagram` |
| 기본 구독 필드 | `messages`, `messaging_postbacks` |

콜백 URL은 고정 Apps Script `/exec` 주소에 비공개 `상담AI_URL키`를 붙입니다. Meta의 확인 토큰에는 비공개 `상담AI_검증토큰`을 넣습니다. 두 값 모두 화면에서 직접 붙이고 문서·이슈·채팅·로그에는 복사하지 않습니다.

## 코드가 지키는 경계

- Facebook은 `graph.facebook.com`, Instagram은 `graph.instagram.com`으로 분리합니다.
- Instagram에는 전용 토큰만 사용합니다. 전용 토큰이 없으면 발송을 닫아 잘못된 권한으로 조용히 실패하는 상황을 막습니다.
- Instagram 장기 토큰은 매일 수명을 확인하고 만료 14일 전부터 자동 갱신합니다. 실패하면 기존 토큰을 보존하고 토큰값 없이 주 1회 경고합니다.
- 사용자가 먼저 보낸 메시지에만 답하고 24시간 창 밖의 홍보 발송은 하지 않습니다.
- 페이지 ID와 Instagram 계정 ID가 다르면 웹훅을 거부합니다.
- 첫 답장에서 자동 상담 봇임을 밝히고, 지식에 없는 가격·일정·정책은 만들어내지 않고 사람에게 넘깁니다.
- 미성년자로 보이는 사용자에게 연락처를 요구하거나 저장하지 않습니다.

## 개통 확인 순서

1. 앱 생성과 기본 정보 저장
2. SYNK Facebook 페이지와 `@synk.mn` 연결
3. 페이지 토큰과 Instagram 전용 토큰을 각 스크립트 속성에 저장
4. Facebook·Instagram 웹훅 콜백 확인 후 메시지 필드 구독
5. 앱 관리자 계정으로 Facebook Messenger와 Instagram DM을 각각 1건 전송
6. 첫 응답의 자동화 고지, 몽골어 답변, `상담로그` 기록, 인계 메일을 확인
7. 신규 사업자등록증 발급 뒤 비즈니스 인증과 고급 액세스 제출

## 사업자 인증 전 가능한 범위

앱 관리자·개발자·테스터 계정으로는 연결과 실제 응답 시험까지 할 수 있습니다. 일반 학부모에게 여는 고급 액세스 제출은 신규 사업자등록증과 Meta 비즈니스 인증 뒤 마무리합니다. 사업자 서류가 없는 동안에는 인증 상태를 성공으로 기록하지 않습니다.

## 장애 확인

| 증상 | 우선 확인 |
|---|---|
| 웹훅 확인 실패 | 콜백의 URL 키, Meta 확인 토큰, 고정 배포 URL |
| Facebook 답장 없음 | `상담AI_페이지토큰`, 페이지 연결, `messages` 구독 |
| Instagram 답장 없음 | `상담AI_IG토큰`, `@synk.mn` 연결, `instagram_business_manage_messages`, `messages` 구독 |
| 즉시 중단 필요 | 스크립트 속성 `상담AI_OFF=1` |
