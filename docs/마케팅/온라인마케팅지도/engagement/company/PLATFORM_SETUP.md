# 회사 SNS 자동 수집 연결

기준일: 2026-09-27. 회사의 SNS 통계 수집 연결 설정을 설명한다. 아래 권한·API 버전·정책 근거는 해당 날짜의 확인 기록이며 실제 연결 작업에서 현재 제공자 설정과 다시 대조한다. 회사 서버의 이후 공개 상태는 [클라우드 운영 기록](CLOUD-OPERATIONS.md), 계정별 제작·발행 상태는 [채널 원문](../../../채널과_발행.md)을 따른다. 코드·mock 검증과 실제 앱 등록·심사·계정 승인은 구분한다.

## 관리자 최초 설정

1. 회사 프로그램을 항상 켜져 있는 서버에 설치하고 HTTPS 주소를 정한다. 아래 `https://sns.example.com`은 예시이며 실제 회사 주소로 바꾼다. `SYNK_COMPANY_ORIGIN`에는 그 주소를 지정한다.
2. 사용할 플랫폼의 개발자 앱을 회사 명의로 준비하고 아래 콜백 주소를 정확히 등록한다. 경로·대소문자·끝 슬래시가 달라지면 승인 코드 교환이 실패할 수 있다.
3. 프로그램의 관리자 설정에 각 앱의 Client ID와 Client Secret을 저장한다. TikTok의 Client Key는 Client ID 칸에 넣는다. Instagram은 Instagram 제품의 앱 ID·Secret을 사용한다.
4. 앱 역할이 있는 시험 계정으로 먼저 연결을 검증한다. 일반 직원이 사용하기 전에 플랫폼 대시보드에서 요구하는 제품 승인, 권한 접근 수준, 앱 심사와 사업체 확인을 완료한다.
5. 직원을 초대한다. 직원은 자신의 페이지 주소를 등록하고 **계정 연결**을 눌러 플랫폼의 공식 로그인 화면에서 조회 권한을 승인한다. 프로그램에 SNS 비밀번호를 입력하지 않는다.

| 플랫폼 | 등록할 콜백 주소 | 현재 요청하는 조회 권한 |
|---|---|---|
| YouTube | `https://sns.example.com/api/oauth/youtube/callback` | `youtube.readonly`, `yt-analytics.readonly` (전체 범위 URI는 아래 설명) |
| Instagram | `https://sns.example.com/api/oauth/instagram/callback` | `instagram_business_basic`, `instagram_business_manage_insights` |
| Facebook | `https://sns.example.com/api/oauth/facebook/callback` | `pages_show_list`, `pages_read_engagement` |
| TikTok | `https://sns.example.com/api/oauth/tiktok/callback` | `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list` |

Instagram·TikTok 연결에는 HTTPS 콜백이 필요하다. 로컬 개발 화면만 열려 있다면 등록·화면 검증을 할 수 있지만 회사 직원용 연결 주소는 별도로 준비해야 한다. 개발자 앱을 설정한 상태와 실제 직원의 계정 승인 완료 상태는 서로 다르다.

## 플랫폼별 준비와 수집 범위

### YouTube

Google Cloud 프로젝트에서 YouTube Data API v3와 YouTube Analytics API를 사용 설정하고 웹 애플리케이션용 OAuth 클라이언트를 만든다. 읽기 권한은 `https://www.googleapis.com/auth/youtube.readonly`와 `https://www.googleapis.com/auth/yt-analytics.readonly`이다. OAuth 대상 사용자 유형·시험 사용자·검증 필요 여부는 회사의 Google Workspace 구성과 앱 공개 범위에 맞춰 설정한다. [Google 공식 OAuth 안내](https://developers.google.com/identity/protocols/oauth2/web-server)

채널 소유자의 연결로 구독자·누적 조회, 영상별 조회·좋아요·댓글, Analytics 공유 수치를 수집한다. API 키만 설정하면 공개 지표를 조회할 수 있으나 공유와 장기 인증 통계에 필요한 소유자 권한을 대신하지 못한다. 소유자 연결 시 실제 승인 채널과 등록 URL이 일치하는지 확인한다. [채널 API](https://developers.google.com/youtube/v3/docs/channels/list), [Analytics 조회](https://developers.google.com/youtube/analytics/reference/reports/query)

Analytics의 날짜는 미국 태평양 시간 기준이며 최근 며칠의 데이터가 늦게 제공될 수 있다. 현재 프로그램의 날짜별 증감은 한국 시간에 수집한 누적값을 비교한다. Analytics의 실제 날짜별 실적과 동일한 의미로 표시하지 않는다. [날짜 정의](https://developers.google.com/youtube/analytics/dimensions#time-periods)

### Instagram

Meta 앱에서 Instagram API with Instagram Login을 설정한다. **비즈니스 또는 크리에이터 계정**이 대상이며 이 연결 방식은 Facebook 페이지 연결을 요구하지 않는다. Facebook Login용 `instagram_basic` 계열 권한과 섞지 않는다. 회사 외부 역할의 사용자가 연결해야 한다면 앱의 권한별 Advanced Access·심사 요구 사항을 확인한다. [Meta 공식 Instagram 컬렉션](https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00), [Instagram Login 안내](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/)

프로필의 팔로워와 콘텐츠의 좋아요·댓글을 읽고, 제공되는 콘텐츠의 조회·공유·저장·도달 인사이트를 추가한다. 콘텐츠 유형·계정·권한에 따라 없는 지표는 `—`로 표시한다. Meta Graph 기본 버전은 현재 공식 SDK에서 확인한 `v26.0`이며, 실제 앱에서 사용하는 버전과 권한을 함께 검증한다. [공식 SDK 인사이트 정의](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/instagraminsightsresult.py), [SDK 버전](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/apiconfig.py)

승인 코드로 받은 짧은 토큰을 장기 토큰으로 교환한다. 장기 토큰은 만료 전에 갱신하며 발급 후 24시간 미만이면 갱신을 건너뛴다. 만료된 토큰은 직원의 재연결이 필요하다. [장기 토큰 교환](https://developers.facebook.com/docs/instagram-platform/reference/access_token), [장기 토큰 갱신](https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token)

### Facebook

Meta 앱의 Facebook Login을 준비한다. 직원이 승인한 사용자 토큰으로 관리 페이지 목록을 읽고, 등록 주소와 일치하는 페이지의 토큰을 선택한다. 개인 프로필의 친구 수·게시물 통계를 회사 페이지 지표로 대체하지 않는다. 페이지 팔로워와 게시물 좋아요·댓글·공유를 수집하며, 현재 연결에서 제공하지 않는 조회·저장·도달은 `—`로 표시한다. [Meta 공식 관리 페이지 토큰 예제](https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00), [공식 Page 필드](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/page.py)

사용자 토큰은 장기 토큰으로 교환한다. Facebook에는 이 프로그램이 사용하는 일반 refresh-token 갱신 흐름이 없으므로 만료되면 다시 연결한다. [Meta 장기 토큰 안내](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/)

2026-11-14 수정본은 현재 수집기가 호출하지 않는 `read_insights`를 기본 요청에서 뺀다. 기존 게시·댓글 권한은 유지하고, 연결을 마친 뒤 실제 승인된 권한을 다시 읽는다. 이 변경은 현재 앱에서 재현된 권한 요청 오류를 줄이기 위한 것이며, Meta 전체에서 `read_insights`가 폐지됐다는 뜻이 아니다. 코드 반영과 운영 연결 성공은 따로 확인한다.

### TikTok

TikTok 개발자 앱에서 Login Kit와 Display API를 준비하고 제품·요청 권한 승인을 받는다. `user.info.stats`가 팔로워·총 좋아요, `user.info.profile`이 계정 주소 일치 확인, `video.list`가 공개 영상 목록·조회·좋아요·댓글·공유에 필요하다. 연결 계정이 승인한 영상만 수집한다. [공식 시작 안내](https://developers.tiktok.com/docs/en/display-api-get-started), [사용자 정보 권한](https://developers.tiktok.com/docs/en/tiktok-api-v2-get-user-info), [영상 목록](https://developers.tiktok.com/docs/en/tiktok-api-v2-video-list)

액세스 토큰을 자동 갱신하며 응답에 새로운 refresh token이 오면 함께 교체한다. refresh token까지 만료되거나 권한을 철회하면 재연결이 필요하다. 현재 Web 연결은 Client Secret을 사용하는 서버 인증 흐름이다. 계정 가입·통계 권한 연결·게시 권한은 별개이며, 옛 가입 보류 기록을 현재 계정 상태로 단정하지 않는다. [공식 토큰 관리](https://developers.tiktok.com/docs/en/oauth-user-access-token-management), [Web Login](https://developers.tiktok.com/docs/en/login-kit-web)

## API 밖의 공식 통계 가져오기

관리자는 `POST /api/channels/from-catalog`로 원장에 이미 확보된 계정을 등록할 수 있다. 등록은 수집 API 연결이나 로그인 완료를 뜻하지 않는다. 같은 계정을 다시 요청하면 기존 채널을 반환하고, 서로 다른 계정과 충돌하면 저장하지 않는다.

로그인된 관리자 통계 화면, 공식 내보내기 파일, 공개 페이지에서 확인한 값은 `POST /api/channels/:id/external-observations`에 별도로 기록한다. 관리자만 기록할 수 있다. 계정 식별자, 플랫폼 주소, 실제 확인 시각, 원본 파일의 SHA-256, 지표의 기준 기간을 함께 검사한다. 같은 증거를 재입력해도 관측 수가 늘지 않는다. 브라우저 로그인 상태와 기존 API 연결 상태는 이 입력으로 바꾸지 않는다.

같은 기간의 조회수와 방문수를 서로 다른 파일로 받으면 각각의 출처를 보존한다. 분석 응답은 출처 종류, 시간대, 단위, 지표 이름이 같은 값끼리 최신 관측을 선택한다. 최신 값이 미확인이면 이전 숫자를 되살리지 않는다. 분석에 남는 다른 지표가 있어도 교체된 값은 제외하며, 저장 원본과 상세 조회의 값은 보존한다.

외부 통계의 분석 응답은 최대 10,000행이다. 이를 넘으면 일부 자료임을 표시하고 화면에서 완전한 기간 합계나 비교율을 계산하지 않는다. 한 번에 입력하는 한도는 200행이고 상세 조회의 한도는 500행으로 유지한다.

운영자는 저장소 밖에 원본과 입력 목록을 둔다. 이 저장소는 공개이므로 원본 통계나 로그인 자료를 커밋하지 않는다. 목록 형식은 `tools/계정통계수집.cjs`의 파일 머리에 있다.

```powershell
node tools/계정통계수집.cjs --입력 <저장소_밖의_manifest.json>
node tools/계정통계수집.cjs --입력 <저장소_밖의_manifest.json> --실행
```

첫 명령은 자격을 읽거나 서버에 접속하지 않고 검증한다. 두 번째 명령은 Workspace에 기록하고, 직접 만든 세션을 끝에 닫는다. 원본은 그대로 보존하고 실행 결과만 별도 영수증에 남긴다. 이 도구는 SNS에 글을 올리거나 예약을 바꾸지 않는다.

| 통계 종류 | 표시와 비교 기준 |
|---|---|
| 게시물 누적 | 게시물별 조회·좋아요·공유를 확인한 시점의 누적값이다. 최근 30일에 발생한 조회수로 표시하지 않는다. |
| 계정의 기간 합계 | 플랫폼이 명시한 시작일과 종료일을 그대로 사용한다. 같은 길이의 직전 기간 자료가 있을 때 비교한다. |
| 계정의 일별 값 | 조회수처럼 더할 수 있는 지표는 모든 날짜가 확인된 기간만 합산한다. 빠진 날짜는 0으로 채우지 않는다. |
| 도달·방문자 | 날짜 사이에 같은 사람이 겹칠 수 있어 일별 고유 인원을 더하지 않는다. 플랫폼이 제공한 기간 합계만 사용한다. |
| 계정 누적 | 팔로워·전체 게시물 등 계정 전체 누적값이다. 기간 실적과 분리한다. |

앞 기간이 0이고 현재 값이 생겼으면 증가율 대신 새 활동으로 표시한다. 두 기간의 지표 정의가 다르거나 자료가 일부만 있으면 비교값을 만들지 않는다. 좋아요와 모든 반응, 공유와 재게시, 동영상 조회와 커뮤니티 페이지 조회도 같은 뜻으로 합치지 않는다.

공개 화면의 출처 주소도 등록된 계정의 프로필 또는 주소에서 소유 계정을 확인할 수 있는 게시물이어야 한다. 로그인해야 보이는 통계 화면을 공개 페이지로 기록할 수 없다. 요약의 수치와 관측 시각은 같은 기록에 묶이며, 다른 종류의 통계를 나중에 읽었다고 이전 수치의 확인 시각을 바꾸지 않는다.

네이버 클립은 현재 계정 누적·기간 관측을 지원한다. 개별 게시물은 공식 주소 형식을 실제로 확인한 뒤 지원한다. 공개 프로필에 콘텐츠가 0개로 표시돼도 조회수·좋아요·공유가 0이라고 추정하지 않는다. 샤오훙수 파서는 화면에서 읽은 실제 프로필 번호와 설정의 계정 번호가 일치해야 하며 표시 이름만으로 계정을 판정하지 않는다.

브라우저 보완 수집은 원장의 기존 프로필과 `~/.synk/account-metrics/browser-profiles.json`의 최근 소유자 확인을 먼저 읽는다. 이 파일은 로그인 성공 보장이 아니며 매번 실제 핸들과 계정 번호를 대조해야 한다. 11월 14일에는 샤오훙수와 PULSE Instagram 소유자를 기존 Ego Profile 5에서 확인했다. 다른 프로필의 로그인 화면을 이 계정의 로그아웃으로 확대하지 않는다. API 수집이 정상인 계정은 부족한 지표가 있을 때만 화면에서 보완한다.

## 기록과 보관

- URL 등록만으로 비공개 통계·관리자 인사이트 접근 권한이 생기지 않는다. 지원하지 않는 플랫폼 주소는 등록할 수 있어도 자동 수집 연결은 준비되지 않았다고 표시한다.
- 첫 관측 전의 일별 값을 현재 누적값으로 복원하지 않는다. 비교할 기준일 기록이 없는 증감은 미확인으로 남긴다. 누락된 지표는 0으로 채우지 않는다.
- YouTube에서 비인증 상태로 조회한 공개 통계는 30일을 넘겨 보관하지 않는다. 인증 통계를 장기 보관하려면 적어도 30일마다 소유자 권한과 콘텐츠 존재 여부를 재확인한다. 다른 메타데이터도 30일 이내 새로 확인하거나 삭제한다.
- 사용자의 연결 해제·삭제 요구에는 관련 API 데이터 삭제를 적용한다. YouTube 정책은 사용자 삭제 요구를 7일 이내 처리하도록 정한다. 원래 사용자가 직접 입력한 기록과 API로 받은 기록을 구분한다.
- YouTube는 서로 다른 콘텐츠 소유자의 API 데이터 합산과 API 값으로 새로운 파생 지표를 만드는 데 제한을 둔다. 전사 화면에 YouTube 지표를 합산하기 전 허용되는 소유 관계와 표시 범위를 확인하고, 출처를 플랫폼별로 명확히 표시한다. [YouTube 공식 데이터 사용·보관 정책](https://developers.google.com/youtube/terms/developer-policies)

클라이언트 Secret과 사용자 토큰은 서버의 암호화 저장소에 보관한다. 개발자 앱을 바꿀 때에는 콜백 주소, 앱 소유자, 현재 승인 권한과 실제 채널 일치 여부를 다시 검증한다. 토큰이나 Secret을 문서·로그·브라우저 응답에 넣지 않는다.
