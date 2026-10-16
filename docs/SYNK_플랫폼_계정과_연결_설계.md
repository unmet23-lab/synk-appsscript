# SYNK 플랫폼 — 계정과 콘텐츠 연결 설계

<a id="member-insight-20261014"></a>
## 2026-10-14 회원 혜택 — 내 성향 확인하기

사용자 요청은 기존 Atlas가 개인별로 수집한 정보로 자신을 이해할 수 있는 화면이다. 후속 선택은 **나의 관심사·선호 / 학습 성향·성장을 나눠 함께 보기**다. 회원 혜택의 `insight`에서 바로 열며, 새 설치 앱이나 이용 권한을 만들지 않는다.

아래 네 항목은 최초판의 범위다. 현재 추가한 이용 기록·기간 비교·다음 활동은 이어지는 ‘후속 3개 확장’에 정리한다.

- **나의 관심사·선호:** 직접 밝힌 배우는 이유와 직접 고른 도움·설명·글씨·움직임·소리 설정. 지금의 계정 요약에 없는 일반 취향이나 다른 서비스의 사적인 기록을 추측하거나 합치지 않는다.
- **학습 성향·성장:** 전체 응답·혼자 응답·도움받은 응답의 누적 횟수와 기존 Vellum의 항목별 안내·다시 볼 내용. 같은 문항 재응답도 누적되므로 고유 문항 개수로 표시하지 않는다. `independent`는 오답도 포함하므로 ‘혼자 맞힌 수’로 표시하지 않는다. 단일 시점 요약에서 성장률·성격 유형·급수를 만들어 내지 않는다.
- **근거와 날짜:** 직접 선택/연습 기록을 나누고 근거를 펼쳐 볼 수 있다. `asOf`는 요약 확인 시각, `practice.lastAt`은 마지막 연습 시각이다. 설정·이유의 입력 시점은 현재 API가 제공하지 않는다. 항목별 독립 수행 표본은 최근 30일의 선택 난이도·응답 형식 최대 12개이므로 전체 정답률로 확대하지 않는다.
- **계정·동의:** 기존 `atlasSummary()` → `synk-account?view=atlas`만 읽는다. 서버의 동의가 꺼졌거나 `declared-only`이면 배우는 이유만 표시한다. 로그아웃·계정 전환·백그라운드 이동·혜택 화면 이탈 시 화면용 요약을 비우고, 재진입 때 다시 읽는다. 별도 프로필·로컬 저장·LLM 호출은 없다. 정보 수정은 기존 SYNK ID로 연결하며 PC의 웹 계정 설정은 브라우저에서 별도 로그인할 수 있다.

<a id="member-insight-expanded-20261014"></a>
### 후속 3개 확장 — 2026-10-14

사용자가 일반 관심사 확장 → 기간 비교 → 다음 활동 연결을 모두 진행하도록 승인했다. 아래는 후속 구현 계약이며, 앞선 공개판·PC 설치본의 완료 증거와 구분한다.

- **관심사 확장:** `member-insight` 개인문서의 별도 동의는 기본 꺼짐이다. 켠 뒤 플랫폼에서 WORLD·워크스페이스·PATH·PULSE를 연 사실(`appId`, UUID, 시각)과 직접 고른 즐겨찾기만 연결한다. 앱 내부 내용·메모·고객 자료·체류 시간은 읽지 않는다. 열기 관찰과 직접 선택을 구분하며 성격 유형이나 관심의 강도로 해석하지 않는다. 기록을 저장할 때 90일이 지난 항목과 최근 2,000건을 넘는 항목을 정리한다. 사용하지 않는 계정의 만료 항목을 정기 삭제하는 작업은 이번 범위에 없으며, 끄면 문서의 관찰·즐겨찾기·시작 시각을 비운다. 계정 소유권·CAS는 기존 개인자료 API를 재사용하고, 로컬 저장이나 추가 LLM 호출은 없다.
- **기간 비교:** 최근 30일과 그 이전 30일의 열기/응답 횟수·활동일을 비교한다. 학습 응답은 전체 Trail 이력에서 도움·이전 노출을 판정한 뒤 실제 발생 시각으로 나눈다. 활동일은 한국 시간 기준이다. 이용 기록은 두 기간의 동의 범위·자료가 충분할 때만 차이를 표시하고, 저장 한도로 잘린 기간이나 빈 기간은 비교 불충분으로 안내한다. 응답량 차이는 실력 성장이나 학습 효과를 뜻하지 않는다.
- **다음 활동:** 근거가 있는 기존 앱을 여는 버튼을 제공한다. 학습 안내는 ‘WORLD에서 연습 고르기’이며 특정 문항이 자동 시작된다고 약속하지 않는다. 서버가 임의 링크를 지정할 수 없고, 기존 설치·로그인·회사 권한 및 실행 경로를 유지한다. 실행에 실패하면 관찰 기록을 추가하지 않는다.
- **계정·동의 경계:** 학습 동의와 앱 이용 동의를 독립적으로 표시한다. 계정·세션 전환 시 RAM의 관찰과 지연 응답을 폐기한다. 쓰기 전 최신 문서를 확인하고 충돌 시 같은 UUID로 제한 재시도하며, 다른 기기의 철회를 자동으로 되돌리지 않는다. 철회는 이미 꺼진 문서에도 CAS를 진행해 이전에 시간 초과한 저장이 뒤늦게 연결을 되살리지 못하게 한다.
- **구현 원천:** `atlas/member-activity.js`·`atlas/trail-periods.js`·기존 `account-summary.js`·Vellum을 사용한다. 브라우저와 PC는 `tools/build-member-activity.js`로 만든 동일 원천 번들과 SHA manifest를 쓰며, 개인자료 형식은 `experiences/synk-account/src/member-activity-data.mjs` 한 곳에서 관리한다.

기존 조사에서 채택한 기간·근거·빈 상태 원칙을 재사용했다. [Apple Music Replay의 월별·연간 실제 이용 집계](https://support.apple.com/en-ie/109356), 아래 Daylio의 기간 회고, Oura의 기준선·해석 한계를 참고하되 제품별 최소 표본 수·효과 주장을 SYNK 기준으로 가져오지 않는다. 안내를 읽고 실제 다음 활동으로 이동할 수 있는지는 합성 웹·Electron 화면에서 별도 확인한다.

후속 구현 검증은 소스 웹 67/67, 격리 Electron 100/100, 공개 후보 웹 67/67을 통과했다. 320·390·1440px의 밤/낮 화면, 동의 철회·계정 교체·늦은 응답·다음 활동 이동을 확인했으며 외부 실계정과 설치 프로필은 사용하지 않았다. [화면 검증](../experiences/synk-account/qa/member-insight-expanded-20261014/) · [공개 후보 검증](../.tmp/member-insight-expanded-20261014/web-qa/browser-result.json).

공개 웹은 기존 홈페이지 변경을 포함한 부모 `145e187a2bbc` 위에 `9c3e03798895`로 반영했다. 2026-10-14 19:45 KST에 Pages와 사이트 전체 자동 검사 모두 성공했고, 공개 JS·CSS가 HTTP200이며 검증 후보와 크기·전체 SHA256이 일치했다. HTML의 성향 CSS·플랫폼 스크립트 링크도 확인했다. [공개 화면](https://synk.im/account/platform.html#benefits/insight) · [공개 검증 증거](../.tmp/member-insight-expanded-20261014/web-publication.json). 실제 사용자 계정으로 새 이용 동의를 켜거나 기록을 만들지는 않았다.

계정 서버는 신규 migration `20261014200000_synk_member_insight_c18.sql` 적용 후 `synk-personal` v33, `synk-account` v58로 반영했다. 운영 원문 18개 중 2개만 변경했고 나머지 16개·의존 파일 37개와 npm 해석을 보존했다. 원격 모듈 SHA, ACTIVE/JWT, 익명 401, RLS·개인문서 권한·계정 삭제 연동을 모두 확인했다. 기존 c18 계약판은 유지하며 실제 사용자 자료·동의는 변경하지 않았다. [원격 배포 검증](../.tmp/member-insight-expanded-20261014/backend-deployment/2026-10-14T10-32-29-673Z/journal.json).

PC는 기존 실제 조작 중단 상태를 유지하고 **다음 릴리스용 소스 꾸러미까지만 준비**했다. 0.4.12 부모의 122파일을 그대로 보존하고 9파일 변경·5파일 추가로 총 136파일이다. 후보 자체의 회귀 197/197과 역변환·생성물 재현 등 8검증을 통과했다. 설치파일 빌드·버전 지정·실제 설치·재실행·푸시 확인은 이번 후속 완료에 포함하지 않는다. [PC 인계 문서](../.tmp/member-insight-expanded-20261014/desktop-candidate/README.txt) · [후보 검증](../.tmp/member-insight-expanded-20261014/desktop-candidate/verification.json).

<a id="member-understanding-20261014"></a>
### 자기이해와 확인·수정 — 네 가지 확장, 2026-10-14

사용자는 기존 Atlas로 구체적 관심, 반복 패턴, 종합 설명, 본인 확인·수정의 다음 분석 반영까지 구현하도록 요청했다. 기존 두 영역을 유지하고 상단의 종합 설명에서 확인·수정 → 저장 → 바뀐 설명 → 재진입 → 되돌리기를 연결한다.

- **구체적인 관심:** 여행·진로·영상·디자인·AI 도구·협업의 세부 주제를 직접 선택한다. 학습한 내용은 Trail의 실제 개념 ID를 Strata의 이름과 연결해 보여 주고, 관심인지 연습 때문인지는 본인이 확인한다. 앱을 열었다는 사실만으로 영상 취향·여행 목적 등을 추론하지 않는다.
- **반복 패턴:** 최근 30일 중 3회 이상이면서 서로 다른 3일 이상 관찰된 앱 열기·듣기/읽기·응답 방식을 표시한다. 횟수와 날짜를 함께 보여 주며 학습 실력이나 고정된 성격으로 확장하지 않는다.
- **종합 설명:** Core의 기존 interpretation·domain과 Vellum으로 직접 선택, 관찰, 본인이 확인한 해석을 구분한 설명을 만든다. 가장 최근의 활성 확인·수정을 우선 표시한다. 직접 쓴 설명은 본인 발언으로 인용하며 분류 지시나 관찰 사실로 사용하지 않는다. 현재 자료가 부족하면 빈 근거를 알린다. 추가 LLM 호출·별도 엔진·성격 진단은 없다.
- **확인·수정과 다음 분석:** ‘맞아요 / 달라요 / 상황마다 달라요’와 선택값 수정, 200자 메모를 미리 본 뒤 명시적으로 저장한다. 다음 조회에서 직접 수정한 값을 우선하고 거부한 해석은 채택하지 않는다. 실제 관찰 수치는 그대로 유지한다. 개별 되돌리기와 전체 삭제가 가능하며 원래 앱·학습 기록을 삭제하지 않는다.

명시적으로 확인한 관심에서 다음 활동도 연결한다. 진로는 PATH, 영상·디자인은 PULSE, 협업은 워크스페이스, 실제 학습 내용에 대한 관심은 WORLD의 연습 선택으로 이어진다. 여행·AI 도구에 임의 목적지를 만들지 않는다. 앱 권한과 설치 조건은 기존 실행 경로에서 확인한다. 도움·설명 선택 수정은 이 화면의 설명에 사용하며 실제 앱 설정을 몰래 바꾸지 않는다.

확인·수정은 기존 개인자료 저장소의 별도 member-understanding 문서에 보관한다. 관찰과 자기보고를 분리하고 구판 member-insight 저장이 확인·수정을 덮어쓰지 않게 했다. Platform 전용 고정 메서드, 계정 소유권, CAS, 삭제 revision, RLS·계정 삭제 연동을 재사용한다. 관찰 기록을 이 문서에 자동 적재하지 않으며 편집 초안은 RAM에만 둔다. 같은 항목을 다른 기기에서 바꾸면 자동으로 덮지 않고 충돌을 안내한다. 응답 시간 초과 뒤 재시도는 같은 제출 UUID를 사용한다.

확인한 해석은 원래 근거의 종류·동의 세대·의미가 같은 동안만 적용한다. 연결을 끄거나 근거가 바뀌면 과거 확인을 새 근거에 붙이지 않는다. 확인·상황별 응답의 신선도는 기존 Core의 30일 계약을 쓰고, 거부는 같은 의미의 해석이 유지되는 동안 보존한다. 직접 고른 값은 변경·삭제할 때까지 유지하며 자료 연결이 필요한 항목은 연결이 꺼지면 적용하지 않는다. 저장된 내역과 현재 적용 여부를 구분한다.

원문은 atlas/member-understanding.js·member-understanding-contract.js, trail-member-observations.js, 기존 account-summary.js·Vellum이다. 자료 형식은 experiences/synk-account/src/member-understanding-data.mjs 한 곳에서 관리한다. 웹·PC는 동일한 생성물 네 모듈과 검증 manifest, 공통 member-understanding-controller.mjs·member-understanding-host.mjs를 소비한다.

이번 수정은 기존 아래 비교를 바탕으로 설명의 수정·반영·되돌리기를 추가 조사했다(2026-10-14, 공식 문서 4개·공개 사용자 토론 4개에서 관련 댓글 12개 표본). [Spotify의 Taste Profile](https://support.spotify.com/nz/article/your-taste-profile/)·[공식 발표](https://newsroom.spotify.com/2026-09-23/taste-profile-shape-home-feed/)는 프로필 설명과 본인 수정을 연결한다. [사용자 토론](https://www.reddit.com/r/truespotify/comments/1wow6gm/new_taste_profile_feature_thoughts/)의 발견 기대와 반복 불만을 참고해 ‘저장됨’과 실제 설명 반영을 구분한다. [YouTube 피드백 관리](https://support.google.com/youtube/answer/6342839?hl=en)·[되돌리기 질문](https://www.reddit.com/r/youtube/comments/1rs08fd/how_do_i_undo_the_do_not_recommend_channel_on_yt/), [Pinterest 자료별 조절](https://help.pinterest.com/en/article/tune-your-home-feed)·[추천 불만](https://www.reddit.com/r/Pinterest/comments/1vz3v45/not_getting_homefeed_recommendations_anymore/), [Spotify 제외 내역 질문](https://www.reddit.com/r/truespotify/comments/1vrf70x/where_is_the_list_of_songs_i_excluded_from_my/)에서 항목별 근거와 지속적으로 찾을 수 있는 되돌리기를 채택했다. 일부 토론의 정확한 게시일·전체 반응은 미확인이며 작은 사용성 표본을 인기나 효과의 증거로 쓰지 않는다.

검증은 Core 관련 32개, 모델·화면 40개, 공통 저장 제어 11개(계정 전환의 36개 Promise 순서 포함), 동결 서버 후보 64개를 통과했다. 소스 웹 103개·격리 Electron 136개 기능 검사 이후 실제 화면에서 낮 테마의 메모 대비·체크 표시 겹침을 수정했다. 같은 계정 세대에서 동적 학습 항목이 사라져도 미저장 메모·취소에 접근할 수 있고, 계정을 다시 검증해 세대가 바뀌면 RAM 초안을 폐기한다. 기존 Strata 예문 문자열 불일치와 공용 dirty 서버 생성물 전체 바이트 검사는 별개이며, 후자는 실제 배포 후보의 API·검증·정리 export와 행동 시험으로 검증했다.

계정 서버는 migration 20261014210000 적용 후 synk-personal v34·synk-account v59로 반영했다. 운영 원문 18개 중 2개만 바꾸고 나머지 16개·의존 파일 37개와 npm 해석을 보존했다. 원격 전체 SHA, ACTIVE/JWT, 익명 401, RLS·개인문서 권한·계정 삭제 연동을 확인했다. 기존 실제 계정 자료·동의 변경은 없다. [운영 배포 증거](../.tmp/member-understanding-20261014/backend-deployment/2026-10-14T12-27-23-768Z/journal.json).

PC 실제 설치·재실행은 기존 조작 중단 상태를 유지했다. 공개 저장소의 0.4.13 부모 bcc192c29a 기준으로 이전 성향 확장과 이번 변경을 합친 다음 릴리스용 소스를 준비했다. 중간 부모 136파일 중 127개 바이트 보존·9개 변경·6개 추가로 142파일이며, 후보 자체 시험 231/231과 무결성 검사 10/10을 통과했다. 설치파일 빌드·실제 설치·실행·재실행·실계정 왕복·푸시는 수행하지 않았다. [PC 인계 설명](../.tmp/member-understanding-20261014/desktop-candidate/README.txt) · [후보 검증](../.tmp/member-understanding-20261014/desktop-candidate/verification.json).

공개 웹 최종 후보는 121/121 검사와 오류·예상 밖 요청·자산 누락 0을 확인했다. bcc192c29a 부모의 무관한 원문을 역패치로 보존하고 account 2파일만 9d50ddb100a4로 공개했다. 2026-10-14 21:49 KST에 공개 JS·CSS의 HTTP200·크기·전체 SHA256 일치와 HTML 파일 링크를 확인했다. [내 성향 화면](https://synk.im/account/platform.html#benefits/insight) · [후보 화면 검증](../.tmp/member-understanding-20261014/web-qa-final/browser-result.json) · [공개 HTTP 검증](../.tmp/member-understanding-20261014/public-http.json). 21:56 KST에 Pages·사이트 전체 자동 점검 모두 성공했고 공개 파일을 다시 대조했다. 전체 점검 중 기존 PULSE 이미지의 일시적 503은 새 화면의 읽기 전용 재검사 1회로 통과했으며 최초 실패 기록은 CI가 보존했다. [최종 공개 검증](../.tmp/member-understanding-20261014/web-publication.json). 실제 본인 계정에 확인·수정을 저장한 인수는 이번 합성 검증과 구분한다.

<a id="member-statement-20261015"></a>
### 상황별 종합 설명과 직접 쓴 수정 — 2026-10-15

사용자는 단순한 항목 나열을 보완하고, 자신의 말로 고친 뜻이 다음 분석에도 반영되는지 실제 계정에서 확인하도록 요청했다. ‘내 말로 고치기 → 해석 미리보기 → 맞는 뜻 선택 → 반영 → 다음 조회 → 개별 되돌리기’를 기존 두 영역 안에 연결한다.

- **원문과 확인:** 새 입력은 최대 500자이며 원문 구간을 인용해 최대 8개 뜻을 제안한다. 기본 선택은 0개다. 본인이 확인한 뜻만 저장하고, 입력을 바꾸면 이전 미리보기와 선택을 무효화한다. 기존 200자 메모는 자동으로 해석하지 않는다. 같은 상황의 상충하는 뜻은 함께 저장하지 않는다.
- **지원 범위:** 현재 제품의 도움 방식·설명 길이·듣기/읽기·관심 주제와 처음 시도/익숙한 내용/바쁜 상황의 제한된 한국어 표현을 해석한다. 모든 자유문장을 이해하는 모델은 아니다. 부정은 반대 선호로 만들지 않으며, 타인·과거·가정·불확실하거나 해석하지 못한 구간은 ‘아직 반영하지 않은 부분’으로 표시한다.
- **관계를 설명:** 확인한 기본 선호와 상황별 예외, 이전 선언과 현재 선언의 차이, 직접 고른 선호와 충분히 반복된 관찰의 일치·차이를 근거와 함께 설명한다. 원인·성격·실력은 추정하지 않는다. 기본 선호가 달라지면 이전 조건을 자동으로 새 선호에 붙이지 않는다. 종합 문장은 한 번만 표시하고 바로 아래에서 연결 근거를 펼친다.
- **기존 Atlas 재사용:** 제품 어댑터 `experiences/synk-account/src/member-statement.cjs`와 제한된 문법 계약 `member-statement-contract.cjs`가 기존 Core `interpretation.prepare/review/resolve`, `domain.understand`, `conditional-preference.assess`, `ask.choose`를 소비한다. 저장한 원문·정확한 구간·확인한 뜻을 재검증하며 독립 LLM 실행기나 유료 API는 추가하지 않는다. 별도 공통 엔진 파일을 늘리지 않는다.
- **자기보고와 관찰:** 이 화면에서 새로 확인한 자기보고는 기록 연결을 꺼도 보존한다. 연결을 끈 관찰과 비교하지는 않는다. 앱 설정·실제 관찰 횟수·학습 동의는 변경하지 않는다. 조건부 관심과 부정에서 일반적인 앱 추천을 만들지 않는다.
- **저장 호환:** 같은 `member-understanding` 문서에서 첫 서술 확정 때만 v2(`reviews/overrides/statements`)로 승격한다. 최대 20개 원문·전체 64KiB를 유지한다. 서버 계정 잠금 안에서 CAS와 v2→v1 덮어쓰기를 검사하고, v2 전체 삭제에는 `document_version:2`를 요구한다. 구형 앱이 최신 revision을 읽더라도 새 내용을 지울 수 없다. 입력 초안은 RAM에만 두며 계정·세션 변경 시 폐기한다. 공개한 parserVersion의 검증 의미는 이후 버전에서도 보존한다.

기존 조사를 2026-10-15에 좁게 재확인했다. [Spotify의 자유서술 수정과 삭제](https://support.spotify.com/nz/article/your-taste-profile/) 및 [YouTube의 피드백 관리](https://support.google.com/youtube/answer/6342839?hl=en)에서 편집·되돌리기를, [Oura의 저장한 기억 관리](https://support.ouraring.com/hc/en-us/articles/39512345699219-Oura-Advisor)에서 내역 접근을 참고했다. [Microsoft HAX의 불확실성 범위 조절](https://www.microsoft.com/en-us/haxtoolkit/guideline/scope-services-when-in-doubt/)과 [부분 수정 지원](https://www.microsoft.com/en-us/haxtoolkit/guideline/support-efficient-correction/)은 미리보기·미해석 표시·개별 확인에 적용했다. 기존 공식 문서 4개와 보조 공식 3개, 기존 토론 2개의 관련 댓글 6개·질문 본문 1개를 재확인한 표본이며 인기·만족도 전수조사는 아니다. 확인할 결과는 저장 알림 자체가 아니라 새 조회의 종합 문장과 되돌린 뒤의 설명이다.

2026-10-15 서버는 개인자료 함수만 v35로 반영했다. 계정 함수 v59·SQL 계약은 그대로이며 의존 37파일과 npm 해석을 보존했다. ACTIVE/JWT·익명 401·원격 모듈 해시·기존 c18 계약을 확인했다. [배포 증거](../.tmp/member-understanding-statements-20261015/backend-deployment/2026-10-14T18-43-23-965Z/journal.json).

공개 화면은 `7f8451ddf769`에 반영한 뒤, 실제 계정에서 발견한 자기보고가 있는데 빈 정보 안내가 함께 나오는 문제를 `da680c397e76`에서 고쳤다. 최종 후보 159/159 검사와 JS·CSS의 HTTP200·전체 SHA256 일치를 확인했다. [후보 검증](../.tmp/member-statement-20261015/candidate-web-qa-empty-state/browser-result.json) · [공개 파일 대조](../.tmp/member-understanding-statements-20261015/public-http.json).

04:21 KST 최종 대조에서는 후속 WORLD 공개 `26cc803b0105`가 이 변경 바로 다음에 올라왔으며 account JS·CSS·HTML이 모두 보존됐음을 확인했다. Pages 성공, 공개 파일 HTTP200·SHA 일치와 HTML의 CSS/JS 링크를 다시 확인했다. 사이트 전체 점검은 처음 무관한 두 URL의 일시적 503으로 실패했고, 재검사는 후속 공개의 공통 실행 제한 때문에 취소됐다. 후속 커밋의 전체 검사는 당시 진행 중으로, 전체 사이트 검사 성공까지 확인했다고 보고하지 않는다. [후속 공개 보존·HTTP·워크플로 증거](../.tmp/member-understanding-statements-20261015/web-publication-following-main.json).

실제 본인 계정에서 검증용 ‘혼자 시도 + 처음엔 예시’를 직접 확인해 저장한 뒤 전체 새로고침에서도 기본 선호·상황별 설명이 복원됐다. 이어 ‘지금은 함께 하기’를 확인하자 다음 서버 조회에서 선호 변화와 이전 조건의 재확인 필요가 표시됐다. 사용자 승인 뒤 두 검증 서술만 개별 되돌렸으며, 다시 새로고침해 수정 내역 0건·원래 설명·학습 횟수 6/0/6·앱 이용 연결 꺼짐을 확인했다. 검증 문장은 실제 성향으로 남기지 않았다. [실계정 왕복·복구 증거](../.tmp/member-understanding-statements-20261015/real-account/result.json).

PC는 기존 실제 조작 중단을 유지했다. 공개 0.4.14 릴리스 원문 기준 142파일 중 11개만 바꾼 다음 릴리스 후보와 보존 검증을 준비했으며, 설치 파일 제작·실제 PC 업데이트·재실행·푸시 확인은 이번 결과에 포함하지 않는다. [PC 후보와 범위](../.tmp/member-understanding-statements-20261015/desktop-candidate/README.md).

<a id="member-insight-optimization-20261015"></a>
### 입력 최적화와 PC 반영 재개 — 2026-10-15

사용자가 최적화와 이번 보완의 PC 설치·자동 연결·정상 재실행·전체 사이트 검사를 요청해 기존 PC 조작 중단을 해제했다. 푸시는 계속 보류한다. 기존 해석·확인·되돌리기 경험을 유지하며 `member-insight.mjs`는 RAM 편집 내용만 바뀐 경우 이미 표시한 분석을 재사용한다. 저장 문서의 전체 내용·revision·오류·대기 상태가 달라지거나 새 자료/재조회 알림을 받으면 다시 분석한다. 계정 전환·화면 이탈·새로고침·종료 때 비교 상태를 폐기한다. `member-insight-view.mjs`는 동일한 한국어/서울 시각 formatter를 공유한다. 지원하는 의미와 저장 계약·동의 범위는 늘리지 않았다.

합성 20개 서술에서 50글자를 입력하는 로컬 측정은 Core 분석 50회→0회, 578ms→28ms였다. 이력 120개 화면의 렌더 중앙값은 6.51ms→0.70ms였다. 횟수는 재현 검사이고 시간은 해당 PC의 표본 측정으로 기기 전체 성능 보장이 아니다. 관련 81검사, 최종 공개 후보 159검사 통과. 0.4.14에서 남았던 런처 시험틀의 새 모듈·활동 기록 읽기 기대값을 실제 코드에 맞춰 수정해 관련 104검사도 통과했다. [최적화 측정·검사](../.tmp/member-insight-optimization-20261015/ui/validation.json) · [공개 후보](../.tmp/member-insight-optimization-20261015/ui/candidate-web-qa/browser-result.json) · [런처 회귀](../.tmp/member-insight-optimization-20261015/qa/renderer-auth-regression.json).

웹 최적화 커밋은 `87237a222ecc`다. PC는 0.4.14 원문 142파일 중 11파일 변경·131파일 보존한 `0.4.15/build20261015.2`를 동결했다(sourceHash `408f61c72927d1565706bbee89b8f018940bd158248714f707dd37a7541b55b7`). 기존 WORLD·Workspace 0.4.11 자식 설치파일을 보존한다. Windows 패키지25·설치 회귀22, Mac ARM34/Intel37·각 위치 이동31·각 제품3개 아이콘 검사가 통과했다. 세 설치파일을 공개 주소에서 전부 다운로드해 SHA256을 확인하고 공통 다운로드·feed를 `2c1e31ec8c7e`로 게시했다. [동결 범위](../.tmp/member-insight-optimization-20261015/release/integration-scope.json) · [공통 게시](../.tmp/member-insight-optimization-20261015/release/installers/publication.json).

설치 전 0.4.10 프로그램 77파일과 프로필 319파일·Suite 1파일을 별도 로컬 백업하고 전부 해시 대조했다. 같은 공개 Windows 설치기의 내장 InstallerEngine으로 실제 PC를 0.4.15로 교체했으며 75파일·버전·ASAR과 동결 소스142파일이 일치하고 설치 직후 프로필319+Suite1의 변경·추가·누락은 0이다. 실계정 첫 실행에서 수동 연결 없이 계정 라이브러리와 기존 기기 할 일2·결과2를 확인했고, 성향 두 영역·종합 설명·자유서술 편집기·기존 학습6/0/6·수정이력0·앱 이용 연결 꺼짐을 확인했다. 새 성향 저장은 하지 않았다. [백업](../.tmp/member-insight-optimization-20261015/pc/backup.json) · [설치](../.tmp/member-insight-optimization-20261015/pc/receipts/apply.json) · [프로필 보존](../.tmp/member-insight-optimization-20261015/pc/preservation-after-install.json) · [설치 소스·updater 대조](../.tmp/member-insight-optimization-20261015/pc/installed-verification.json).

04:50 KST 정상 종료 후 프로세스0을 확인했다. 공개 feed 배포가 끝나기 전 첫 실행에는 구버전 feed 거부 안내가 있었으나, 공개 반영 후 재실행은 시작 우회 클릭0으로 통과하고 최신0.4.15로 표시됐다. 계정 라이브러리 자동 연결, 계정 메모7·완료7·별도 복구 제공, 기기 할 일2·결과2, 성향6/0/6·수정이력0을 다시 확인했다. `closeToTray=true`를 UI에서 원복한 뒤 저장값도 대조했고 내 성향 화면을 열어 뒀다. 새 로그인·수동 계정 연결·메모 편집/삭제·성향 저장·푸시 시험0이다. 이번 설치는 공식 InstallerEngine 적용이며 앱 안의 자동 업데이트 설치 왕복 시험으로 확대 해석하지 않는다. [실계정·재실행 결과](../.tmp/member-insight-optimization-20261015/pc/real-account-complete.json) · [실제 화면](../.tmp/member-insight-optimization-20261015/pc/insight-after-restart.png).

05:01 KST 최종 공개 커밋 `2c1e31ec8c7e3d0da3895c714802a6520f475fa5`의 Pages(`38627058351`)·전체 사이트 검사(`38627061579`)가 모두 통과했다. 33페이지×PC/모바일·LAB8게임×PC/모바일·질문창 정상, 공개 한영 홈페이지의0.4.15·세 다운로드 링크·feed 일치, 최적화 JS469,996B와 기존 CSS28,818B의 전체 SHA256 일치 및 HTML 연결을 확인했다. 회사 서버도 고객 관리 CSS HTTP200·71,372B·SHA256 `42204c949c709ef5bdaaccdf97ef252090e6a9f4001c5bb9903b0c94aab673a7`와 루트 HTML의 CSS 링크를 다시 확인했다. [공개 대조](../.tmp/member-insight-optimization-20261015/public/final-verification.json) · [전체 검사 로그](../.tmp/member-insight-optimization-20261015/public/ci-38627061579.log) · [회사 CSS](../.tmp/member-insight-optimization-20261015/public/company-final-verification.json) · [완료 증거 목록](../.tmp/member-insight-optimization-20261015/completion.json). 요청한 최적화·공개·PC 설치·자동 연결·재실행·사이트 검사는 완료했고, 푸시 수신·클릭 이동 시험만 사용자 요청대로 보류한다.

<a id="member-clarification-20261015"></a>
### 문장 이해와 필요한 추가 질문 — 2026-10-15

사용자는 기존 Atlas로 문장 이해와 추가 질문을 먼저 보완하고, 실제 계정 검증 후 공개 플랫폼과 PC 설치본에 반영하도록 요청했다. 푸시는 계속 보류한다. 기존 Core Interpretation·Domain·Ask·Conditional Preference를 재사용하며 별도 LLM 실행기나 유료 API를 추가하지 않는다. 위 조사에서 채택한 불확실성 표시·부분 수정·답변 내역 접근을 이어 적용한다.

- 한국어 표현·절·순서·조건의 지원 범위를 넓혔다. ‘처음 배우는 일은 예시를 보고 감을 잡은 다음 혼자 해보고 싶어요’는 처음 시도의 예시 도움과 예시 이후 혼자 시도를 구분한다. 타인·과거·가정·인용을 본인 선호로 바꾸지 않으며, 문장 끝 공백과 복합 구두점이 있는 질문도 확정 서술로 처리하지 않는다.
- 모호한 표현은 확인·현재 뜻 아님·잘 모르겠음·건너뛰기로 묻는다. 지원하지 않는 표현은 도움/설명/매체/관심 영역, 구체적인 뜻, 긍정/부정, 적용 상황 순으로 필요한 질문을 제공한다. 답변을 골라도 바로 저장하지 않으며 마지막에 본인이 선택한 해석만 반영한다. 질문이 남은 동안 버튼과 Enter 저장을 막는다.
- 질문은 원문 전체 SHA256과 연결하고 최대 12개 답변의 순서·선택지·근거 구간을 다시 검증한다. 입력 수정·답변 다시 고르기·계정/세션 변경은 오래된 미리보기와 선택을 폐기한다. 저장한 답변 내역은 같은 서술에서 다시 확인할 수 있다.
- 새 해석은 `member-statement-ko-2`이며 ko-1 검증기는 동결해 기존 기록의 뜻을 유지한다. 첫 ko-2 저장만 문서 v3로 승격하고 기존 ko-1 기록과 함께 보존한다. 서버는 revision 검사와 v2→v3 승격을 허용하되 구형 앱의 v3→v2 덮어쓰기·삭제를 차단한다. 새 기록을 모두 되돌려도 문서 버전은 낮추지 않는다.

관련 회귀 252개, 최종 웹 후보 187개, 정확한 동결 소스의 격리 PC 화면 220개를 통과했다. 웹 오류·예상 밖 요청·누락과 PC 콘솔 오류·외부 통신은 0이다. 서버는 synk-personal v36으로 배포했고 synk-account v59·기존 SQL 계약·의존 37파일과 npm 해석을 보존했다. ACTIVE/JWT·익명 401·원격 모듈 해시를 확인했다. [관련 검사](../.tmp/member-clarification-20261015/ui/final-tests.tap) · [웹 후보](../.tmp/member-clarification-20261015/ui/candidate-web-qa-final/browser-result.json) · [동결 PC 후보](../.tmp/member-clarification-20261015/release/qa/frozen-feature/native-result.json) · [서버 배포](../.tmp/member-clarification-20261015/backend-deployment/2026-10-14T20-36-54-747Z/journal.json).

PC는 0.4.15 원문 142파일 중 10파일 변경·132파일 보존한 `0.4.16/build20261015.3`을 동결했다(sourceHash `5d02b03e0aaeecb195f1288501889554d57eb5fd271a7ed28189baf2faf0bfd2`). 정확한 동결 소스에서 기능 220검사를 다시 통과했고, Windows 패키지25·설치 엔진22, Mac ARM34/Intel37·각 위치 이동31·아이콘3종 검사를 통과했다. WORLD/Workspace 0.4.11 묶음은 바이트 보존했다. [동결 범위](../.tmp/member-clarification-20261015/release/integration-scope.json) · [최종 빌드 검증](../.tmp/member-clarification-20261015/release/native-qa-verification.json).

실제 PC는 정상 종료 후 프로그램77·프로필318·Suite1 파일을 백업하고, 공식 InstallerEngine으로 0.4.16을 설치했다. 설치75파일·ASAR·동결 소스142파일이 일치했고 설치 직후 프로필318+Suite1의 변경·추가·누락은 0이다. 실제 계정에서 순차 문장 두 해석을 미리보기로 확인한 뒤, 별도 검증 문장 한 건에 네 질문을 답하고 최종 해석을 선택해 저장했다. 새 서버 조회와 정상 종료→재실행 뒤 종합 설명과 답변4개가 유지됐으며, 공개 웹의 같은 계정에서도 같은 해석을 확인했다. 기존 학습6/0/6과 앱 이용 연결 꺼짐을 유지했다. 이후 사용자의 ‘검증용 1건만 지워’ 승인에 따라 해당 서술과 답변4개만 단일 되돌리기로 제거했다. PC 새 분석과 공개 웹 새 조회에서 내역0건·검증 해석 제거·기존 학습6/0/6과 연결 꺼짐 유지까지 확인했다. [설치](../.tmp/member-clarification-20261015/pc/receipts/apply.json) · [프로필 보존](../.tmp/member-clarification-20261015/pc/preservation-after-install.json) · [실제 계정 검증·정리](../.tmp/member-clarification-20261015/real-account/result.json).

웹 두 파일은 `6c7401102d6b`, 공통 설치파일 다운로드와 업데이트 목록은 `dec6212096af`로 공개했다. 세 운영체제 파일을 공개 URL에서 전부 내려받아 전체 SHA256을 확인한 뒤 홈페이지·feed를 함께 갱신했다. 갱신된 공개 feed 기준 PC 정상 종료→재실행은 중간 버튼 조작·계정 재연결 없이 통과했고, 실제 설정 화면의 0.4.16 최신 안내와 저장한 성향을 확인했다. 검증 중 변경한 트레이에 남기기 설정도 원래의 켜짐으로 복원했다. 공개 전 후보 실행의 구버전 feed 거부 안내에서 ‘현재 버전 열기’를 두 번 사용한 이력은 이 최종 자동 통과 검증과 구분한다. [공통 게시 증거](../.tmp/member-clarification-20261015/release/installers/publication.json) · [최종 설치·업데이트 대조](../.tmp/member-clarification-20261015/pc/installed-verification.json) · [자동 시작 화면](../.tmp/member-clarification-20261015/real-account/pc-final-auto-start.png).

06:12 KST 최종 공개 `dec6212096af`의 Pages(`38636863229`)·전체 사이트 검사(`38636863378`)가 모두 통과했다. 33페이지×PC/모바일·LAB8게임×PC/모바일·질문창 정상, 한영 홈페이지0.4.16·세 다운로드 링크·feed 일치, 공개 JS520,907B와 CSS29,989B의 전체 SHA256 일치 및 HTML 연결을 확인했다. 회사 서버의 고객 관리 CSS도 HTTP200·71,372B·SHA256 `42204c949c709ef5bdaaccdf97ef252090e6a9f4001c5bb9903b0c94aab673a7`와 루트 HTML 링크가 유지된다. 기능 보완·실제 계정 검증·공개 배포·PC 설치와 자동 연결·재실행을 완료했다. 검증용 한 서술도 사용자 승인 후 정리하고 공개·PC에서 원래 상태로 돌아왔음을 확인했다. 푸시 시험만 보류한다. [최종 공개 검사](../.tmp/member-clarification-20261015/public/final-verification.json) · [전체 사이트 로그](../.tmp/member-clarification-20261015/public/ci-38636863378.log) · [회사 CSS](../.tmp/member-clarification-20261015/public/company-final-verification.json) · [완료 기록](../.tmp/member-clarification-20261015/completion.json).

<a id="member-language-expansion-20261015"></a>
### 성향 표현·주제 범위 확장 — 2026-10-15

사용자 요청으로 기존 Atlas Core의 Interpretation·Domain·Ask·Conditional과 Trail/Vellum 연결을 그대로 사용해 한국어 표현과 지원 주제를 넓혔다. 별도 LLM 하네스·모델 선택기·유료 호출은 추가하지 않았다. 소통 방식(듣고 정리·먼저 말하기·글·말), 일 처리(계획·시도하며 조정·한 가지·우선순위), 판단(근거·선택지 비교·경험·상의), 설명 구성(개요·핵심 근거·긴 설명)을 추가했다. 독서·음악·운동·요리·사진·게임·자연/산책도 관심사로 확인할 수 있다. 회의·협업·계획·결정의 상황 조건을 구분하고, 서로 함께 성립하는 선호를 억지로 하나만 고르게 하지 않는다.

조사·명사화·공손형·부정·정도 부사·보조 동사·일상 동의 표현을 공통 문법층에서 처리한다. 원문과 근거 위치는 보존하며, 타인·과거·인용·가정·민감한 유형은 현재 내 성향으로 단정하지 않는다. 활동 사실(예: “게임을 해요”)도 관심이나 능력으로 바꾸지 않는다. 직접 이해하지 못한 말은 기존 추가 질문으로 확인하며, 본인이 선택해 저장한 해석만 다음 분석에 반영한다.

새 `member-statement-ko-3` 행은 문서 v4에 저장한다. ko1/ko2 파서와 질문/답변 재생은 동결 원문을 유지한다(ko2는 공개 0.4.16과 LF 기준 동일). 기존 v1/v2/v3 저장·선택·설명을 보존하며, v4를 구클라이언트가 덮어쓰거나 삭제하지 못하도록 계정 잠금·CAS·정확한 문서 버전 확인을 유지한다. 새 일상 주제에 존재하지 않는 앱 추천이나 실제 학습 성과를 만들지 않는다.

평가는 처음 고정한 개발72+미공개40, 이후 별도 미공개24+24로 진행했다. 최초 미공개 결과는 각각 기대 동작26/40, 7/24, 12/24이며 마지막 별도 평가의 직접 의미 재현율은6/18이었다. 이 실패를 공개해 공통 문법을 보완한 뒤 **160/160 회귀 문장, 명시106문장·115개 의미, 추가로 잘못 제안한 뜻0개**를 확인했다. 보류54문장도 의도한 질문·보류 동작인지 검사했다. 이는 수정에 사용한 합성 문장의 회귀 결과이며 실제 사용자나 새로운 자유문장의 정확도100%가 아니다. 모든 최초 결과와 최종 source SHA를 [평가 설명](../.tmp/member-language-expansion-20261015/evaluation/README.md)에 보존한다.

관련 소스397시험, 공개 웹 후보197검사, 정확한 동결 PC 소스의 격리 Electron230검사, 서버 후보155시험을 통과했다. 서버는 synk-personal v37 운영 배포와 ACTIVE/JWT/익명401/원격 모듈 SHA 확인을 마쳤으며 계정v59·37개 의존 파일·SQL 계약은 보존했다. [서버 결과](../.tmp/member-language-expansion-20261015/backend-deployment/2026-10-15T03-27-49-881Z/journal.json) · [소스 검사](../.tmp/member-language-expansion-20261015/ui/final-tests.tap).

공개 웹은 `921d818a9e28`, 최종 설치파일·feed·한영 홈페이지는 `161db6a33647`로 게시했다. PC 공통0.4.17/build20261015.4는 sourceHash `413b9baf5957dfd13fab043ec2b3ac4f0bc47c8c7c72ebbb7e1651ef625f5354`이며 기존142파일 중7개 변경·135개 및 WORLD/Workspace 묶음을 보존했다. Windows·Mac arm64·Mac x64 CI와 공개 설치파일3개 전체 다운로드 SHA 검증, 최종 Pages·전체 사이트 검사(회귀69/69), 공개 JS/CSS 해시·HTML 링크·업데이트 목록 검사를 통과했다. [최종 공개 검사](../.tmp/member-language-expansion-20261015/public/final-verification.json).

2026-10-16 PC 검증을 마쳤다. 설치75파일·동결 소스142파일·ASAR 일치와 업데이트 상태 current0.4.17을 확인했다. 설치 직후 계정 프로필312파일·공통 계정1파일 보존을 대조했고, 실제 실행에서 수동 로그인/재연결 없이 기존 계정과 학습6/0/6을 불러왔다. 회의에서 듣고 정리하기·글로 소통하기·독서의 세 뜻을 미리보기로 확인한 뒤 저장 없이 취소했다. 정상 종료(잔류 프로세스0)→재실행에서도 자동 연결·학습6/0/6·확인/수정0건을 확인했으며 트레이 설정은 원복했다. 이번 판의 공개 웹 실계정 화면은 Chrome 탭 생성 도구 오류로 재검증하지 못했으며 공개 파일·합성 웹 검사와 실제 PC 계정 검증을 구분한다. 실계정 서술 저장/삭제0건이고 푸시 시험은 보류한다. [PC 설치 검사](../.tmp/member-language-expansion-20261015/pc/installed-verification.json) · [실제 PC 화면·결과](../.tmp/member-language-expansion-20261015/real-account/result.json) · [완료 기록](../.tmp/member-language-expansion-20261015/completion.json).

<a id="member-language-unseen-20261016"></a>
### 처음 보는 성향 문장 검증과 해석 보완 — 2026-10-16

기존 Atlas의 문장 해석·질문 계약에서 명사화, 자기지시, 공손형·보조동사, 비교 양쪽의 어순, 여러 절의 공유 술어와 조건 범위를 보완했다. 명확한 선호는 다시 항목을 고르게 하지 않고 바로 미리보기로 제안한다. 이미 알아낸 뜻의 범위만 불확실하면 한 번 확인하며, 선택·최종 저장 전에는 분석에 적용하지 않는다. “글로만 소통하는 건 싫다”는 글 자체를 거부하는 뜻으로 확대하지 않는다. “평소에는”처럼 일반 상황을 명시하면 앞 절의 회의 조건을 이어 붙이지 않는다. 별도 LLM 실행기·모델 선택기·유료 호출은 추가하지 않았다.

새 행은 `member-statement-ko-4`와 문서 v5를 사용한다. 공개 ko3 원문을 `member-statement-v3.cjs`에 바이트 그대로 동결했고 ko1·ko2·ko3 기록과 확인 답변 재생을 보존한다. 계정 잠금과 revision CAS 안에서 명시 저장할 때만 문서를 상향하며, 이전 클라이언트의 덮어쓰기·삭제와 미래 버전 변경을 막는다. 삭제·되돌리기 후에도 현재 문서 버전의 보호는 유지한다.

합성 새 문장120개(진단80·미공개40)를 먼저 고정하고, 이후 마지막24도 구현자에게 공개하기 전에 고정했다. 진단80 보완 직후 미공개40의 최초 성공은13/40이었고, 다음 후보의 새24 최초 성공은10/24·명시4/18이었다. 실패한 표현을 수정에 사용한 뒤에는 모두 **회귀 검사**로 분류했다. 최종 계약 SHA `973796df567dc4fc8dd7c38dd0034406c7c82cb40c86cd33f5a5a3dd185b9b0c`에서 기존160+새144의 원라벨 점수302/304이며, 정답 자체가 모호한 H04(‘글로만’ 부정의 범위)·H30(조건의 절 범위)을 별도 판정해 제외하면302/302다. 명시212문장·230의미와 원문 위치를 확인했고 잘못 제안·누락은0이었다. 최초 결과·정답·후보 바이트는 수정하지 않았다. **최종 소스의 또 다른 미공개 문장 일반화는 미검증**이며, 회귀 통과를 자유문장 정확도100%로 표현하지 않는다. [평가 설명](../.tmp/member-language-unseen-20261016/evaluation/README.md) · [최종 회귀·한계](../.tmp/member-language-unseen-20261016/evaluation/summary-final.json).

소스 시험은510개 중508통과·위 라벨 경계2개 명시 제외, 공개 웹 후보208검사·정확한 동결 소스의 격리 Electron241검사·서버 후보170시험을 통과했다. 서버는 synk-personal v38 운영 반영 후 ACTIVE/JWT/익명401과 원격 모듈 SHA를 확인했고, 계정 v59·의존 파일37개·SQL 계약은 보존했다. [서버 결과](../.tmp/member-language-unseen-20261016/backend-deployment/2026-10-15T22-00-38-644Z/journal.json) · [소스 시험](../.tmp/member-language-unseen-20261016/ui/final-tests.json).

0.4.18/build20261016.1은 sourceHash `e73110ed9f1c4edea6d0d77f90d50a9a659bc16420557ad14407d0f17b4e2b16`으로 동결했다. 기존142파일 중 성향 관련5개만 바꾸고 나머지137개와 WORLD/Workspace 묶음을 보존했다. 공개 웹 `0efe5d5a68ce`와 공통 릴리스 `928b8d9d03cd`를 게시했으며, Windows·Mac 2종 설치파일 전체 공개 다운로드 SHA, 실제 feed·한/영 홈페이지의3종 링크·성향 JS/CSS HTTP200·SHA·HTML 연결을 확인했다. 최종 Pages38818133626·전체 사이트38818133703도 성공했다. [최종 공개 증거](../.tmp/member-language-unseen-20261016/public/final-verification.json).

PC0.4.17 프로그램·계정 프로필·공통 계정을 백업한 뒤0.4.18을 설치했고, payload75파일·내부소스142파일과 ASAR 해시를 대조했다. 첫 실행 전 프로필312파일·공통계정1파일의 변경·누락·추가0을 확인했다. 최초 PC 실행 시 Esc로 조작이 중단됐으나 사용자의 재개 요청 뒤 실제 계정의 자동 연결·성향 두 영역 표시, 비교 표현의 즉시 제안·모호한 부정 범위의 단일 확인 질문을 미리보기로 확인했다. 저장하지 않고 취소했으며 기존 학습6/0/6·확인수정0건·이용기록 연결 꺼짐이 유지됐다. 정상 종료 후 창·프로세스0을 확인하고 재실행했을 때 추가 로그인·재연결 없이 계정과 성향 화면이 복원됐다. 원래 트레이 설정을 복구하고 성향 화면을 열어 두었다. 공개 웹 실계정 UI는 이번에 별도로 조작하지 않았으며 공개 바이트·합성웹 검증과 구분한다. 푸시 시험은 보류했다. [PC 실계정 증거](../.tmp/member-language-unseen-20261016/real-account/installed-verification.json) · [완료 증거](../.tmp/member-language-unseen-20261016/completion.json).

<a id="member-insight-quality-20261016"></a>
### 처음 보는 문장의 일반화와 종합 설명 — 2026-10-16

사용자 요청으로 기존 Atlas의 문장 계약과 Core·Vellum 요약을 보완한다. 단어가 나온 사실만으로 선호를 만들지 않고 대상·방법·동작·선호 표현을 따로 읽어 조합한다. 같은 역할의 표현이 반복되거나 명사 순서가 달라도 뜻을 보존하며, ‘듣고 정리하기’처럼 동작의 순서가 뜻을 결정하면 그 순서는 유지한다. 부정·과거·타인·불확실한 조건은 별도로 검토하고 원문 구간을 보존한다. 별도 LLM 실행기·모델 선택기·유료 API는 추가하지 않는다.

새 해석은 `member-statement-ko-5`, 새 행의 저장 문서는 v6다. 공개 ko4 원문은 `member-statement-v4.cjs`에 그대로 동결하고 ko1~4의 저장 기록·답변 재생을 보존한다. 기존 잠금·CAS 안에서 새 저장에만 문서 버전을 높이며 구클라이언트의 덮어쓰기·삭제와 미래 버전을 차단한다. 미리보기에서 같은 문장을 두 번 해석하던 호출은 한 번으로 줄였고, 다른 사용자나 요청 사이에 결과를 캐시하지 않는다.

종합 설명은 본인이 확인한 선호·조건·수정을 먼저 보여준다. 직접 확인한 선호가 없으면 그 사실을 밝히고, 학습 응답 수·도움 여부·관찰 날짜·연결 범위를 설명한다. 하나의 응답에 붙은 여러 문법 항목을 합쳐 응답 수로 만들거나 하루의 기록을 반복되는 성향으로 해석하지 않는다. 학습 항목별 근거는 상세 화면에 남긴다. 실제 계정과 같은 합성 조건(응답 6건, 도움 없이 0건·도움 받고 6건, 관찰 1일, 직접 확인 0건, 앱 이용 연결 꺼짐)에서 이 구분을 검사했다. 이는 자료와 설명의 일치 검사이며 본인의 실제 선호에 대한 주관적 정확도 확인은 아니다.

개발용 60문장을 통과한 첫 후보를 별도 미공개 80문장으로 검사했을 때 최초 성공은 26/80, 명시적 선호는 6/60이었다. 잘못 제안한 뜻과 원문 위치 오류는 0이었으나 불필요한 질문은 52/60이었다. 최초 후보·문장·라벨·성적을 보존했고, 공개된 80문장은 이후 회귀 검사로만 사용한다. 다음 후보의 별도 60문장은 구현자에게 공개하기 전에 고정했다. [최초 평가와 한계](../.tmp/member-insight-quality-20261016/evaluation/sealed-first-summary.json) · [합성 요약 근거](../.tmp/member-insight-quality-20261016/summary/evidence.json).

두 번째 후보(`37ddfa2d…`)는 개발60·공개80 회귀와 개발자가 만든 1,500개 문법 조합을 통과했으나, 별도 미공개60 최초 결과는23/60·명시3/40이었다. 평가자가 문장을 다듬는 과정에서 발생한 ID 지정 오류와 조건 라벨 불일치 2건(F021/F022)을 원문·원점수와 함께 공개했다. 두 건을 제외한 민감도는23/58·명시3/38(7.9%), 불필요한 질문32/38(84.2%), 의도적 보류20/20, 잘못 제안한 뜻과 원문 위치 오류0이다. 최초 원점수의 추가 의미1건은 ‘선택할 때’의 조건을 추출한 결과여서 잘못된 성향 단정으로 세지 않는다. 이 제외 결과도 사전정답을 사후 교체한 새 정확도 결과로 취급하지 않는다. **명시 직접 해석90%·불필요 질문10% 이하라는 내부 목표에 미달하며, 자유문장 이해가 충분해졌다는 근거는 없다.** 이후 발견된 순서 해석 문제를 수정한 최종 소스는 회귀로 검증하며 이 최초 미공개 성적을 대체하지 않는다. 실계정의 확인과 수정은 자료 충실성 검사로 구분한다.

최종 계약 `d4da785c…`는 순서가 반대인 문장을 ‘계획 먼저·예시 먼저·전체 먼저’로 뒤집던 문제를 막았다. 최종 소스 669건 중667통과·기존 승인제외2·실패0, 동결 PC253·공개 후보 웹220·서버185검사를 통과했다. 공개 웹 성향 번들은 `c6ca26a28e2b`, 설치 링크·feed는 `d9fc5f629b3a`로 배포했다. 개인자료 서버 v39만 반영했으며 계정 서버 v59·기존 의존 파일37개는 보존했다. Platform `0.4.19/build20261016.2`, sourceHash `877bf50a…`의 Windows·Mac 두 종류 CI와 공개 설치파일3종의 전체 크기·SHA256이 일치한다. Intel Mac 첫 아이콘 시험은 이미지 대조 뒤 DMG 분리의 일시적 실패로 끝나 동일 커밋의 해당 job만 재실행했으며 첫 실패 기록과 성공 artifact를 구분해 보존했다.

실제 공개 계정과 설치 PC0.4.19에서 새 종합 설명의 응답6·도움 없이0·도움 받고6·관찰1일·확인수정0건·앱 이용 연결 꺼짐을 확인했다. 공개 화면에서는 자료·근거 판단 문장을, PC에서는 시작 후 계획 문장을 저장 없는 미리보기로 검사했다. 후자는 반대 성향으로 제안하지 않고 지원 범위를 밝혀 추가 확인으로 남겼다. 실제 계정에 테스트 선호를 저장하거나 삭제하지 않았다. PC0.4.18 프로그램·프로필을 백업하고 설치 후 첫 실행 전에 프로필312파일·공통계정1파일이 바이트 그대로임을 확인했다. 설치75파일·내부142소스·ASAR 해시도 일치한다. 공개 feed 반영 전 최초 실행의 업데이트 확인 보류는 기록했으며, feed 반영 후 정상 종료(프로세스0)·재실행에서는 복구 버튼·추가 로그인·재연결 없이 성향 화면이 복원됐다. 설정의 최신0.4.19 표시를 확인하고 원래 트레이 설정을 복원했다. 푸시 알림 시험은 보류했다. [공개 실계정](../.tmp/member-insight-quality-20261016/ui/actual-public-account.json) · [PC 설치 대조](../.tmp/member-insight-quality-20261016/pc/installed-verification.json).

최종 공개 커밋 `d9fc5f629b3a`의 Pages와 전체 사이트 검사가 모두 성공했다. 변경18파일 대조, 33쪽×2기기, LAB8게임×2기기와 질문창 검사를 통과했고, 실제 공개 feed·한/영 홈페이지3종 설치 링크·성향 JS/CSS의 HTTP200/전체SHA·플랫폼 HTML 참조를 확인했다. 회사 고객 관리11판 CSS도 HTTP200·SHA256 `42204c949c709ef5bdaaccdf97ef252090e6a9f4001c5bb9903b0c94aab673a7` 및 첫 화면 링크를 읽기 전용으로 재확인했다. [최종 공개 검사](../.tmp/member-insight-quality-20261016/public/final-verification.json) · [실제 PC 자동 연결·재실행](../.tmp/member-insight-quality-20261016/pc/actual-account-verification.json) · [완료 기록](../.tmp/member-insight-quality-20261016/completion.json). 원본 커밋은 공유 작업본의 다른 변경을 제외한 격리 사본에서 만들며, 배포·실계정 자료 충실성 검증과 자유문장 이해의 남은 한계를 구분한다.

<a id="member-free-language-20261016"></a>
### 자유문장 해석의 문맥 처리와 독립 재평가 — 2026-10-16

사용자 요청에 따라 기존 Atlas의 한국어 문장 계약을 보완한다. 조건 뒤 쉼표, 여러 행동이 공유하는 술어, 희망·요청형, 주제와 연습의 연결, 이미 설명한 선호를 가리키는 부연을 다룬다. 단어가 등장했다는 이유로 선호를 만들지 않고 자기 선호의 술어와 대상·행동 관계를 확인하며, 타인·인용·강요·과거·부정 범위·불명확한 조건은 구분한다. 별도 LLM 하네스·모델 선택기·유료 API는 추가하지 않는다.

새 행은 `member-statement-ko-6`와 문서 v7을 사용한다. ko5 공개 원문은 `member-statement-v5.cjs`에 SHA256 `d4da785c129f7533422c4ec17cfa6c6a124eb911d4ac7fe9442af3c7a6a98111` 바이트 그대로 동결한다. ko1~5의 기존 기록과 질문·답변 재생을 유지하고, 기존 계정 잠금·CAS 안에서 명시적인 새 저장만 승격한다. v7 저장 뒤 구버전 덮어쓰기·삭제와 미래 문서 변경은 차단한다.

평가 원칙은 [CheckList의 기능별 행동·불변성 검사](https://aclanthology.org/2020.acl-main.442/)와 [CLINC의 지원 범위 안팎 분리](https://aclanthology.org/D19-1131/)를 참고했다(2026-10-16 원문 확인). 구현자가 보지 못한 문장·정답·평가기를 먼저 동결하고, 같은 묶음으로 공개 ko5와 후보 ko6를 각각 처음 실행한다. 의미·극성·조건이 맞고 추가 질문이 없어야 직접 해석 성공으로 센다. 불필요한 질문, 잘못된 제안, 근거 위치 오류와 지원 밖 보류는 따로 센다. 실패 문장을 수정에 사용한 뒤에는 회귀 검사이며, 최초 성적을 교체하지 않는다.

첫 80문장의 명시 선호60개에서 ko5와 후보1은 모두 직접14/60·불필요 질문44/60이었다. 다음 독립80에서는 ko5 직접5/60·질문53/60, 후보2 직접8/60·질문50/60이었다. 두 묶음 모두 잘못된 제안0·보류20/20이지만 직접 해석 목표에는 미달했다. 원본·정답·최초 후보·성적을 보존했다. [첫 최초 결과](../.tmp/member-free-language-20261016/private-evaluation/first-run/summary.json) · [두 번째 최초 결과](../.tmp/member-free-language-20261016/private-evaluation-2/first-results.json).

최종 계약 `e20eda01490c…`은 잔여 표현 전체의 의미역과 해당 행동의 관계·순서를 확인하도록 제한했다. 타인 주체·지시/권유/연기·지원하지 않는 장소/기간·순서 역전의 검토 실패를 수정한 뒤 독립 경계30와 보조11에서 오제안0을 확인했다. 새로 동결한 세 번째 독립80 최초 평가에서는 ko5 직접26/60(43.33%) → ko6 30/60(50.00%), 불필요 질문32/60 → 28/60, 잘못된 제안0/80, 보류20/20, 근거 위치 오류0이었다. 이는 이 합성 표본에서의 개선이며, 직접 해석90% 목표나 일반 자유문장 이해의 충분성을 입증하지 않는다. 복합·낯선 표현에 추가 질문이 남는다. 개발 회귀로 전환한 첫80은80/80, 둘째80은76/80이며 나머지4건의 추가 질문을 미해결 한계로 기록했다. [세 번째 최초 결과](../.tmp/member-free-language-20261016/private-evaluation-3/first-results-summary.json) · [최종 경계 검토](../.tmp/member-free-language-20261016/review/candidate3-review2-boundary30.json).

최종 소스843검사 중841통과·기존 사유가 있는 제외2·실패0, 서버196검사, 숨김 PC 화면253검사와 웹220검사를 통과했다. 서버 개인 함수v40에 반영했으며 계정v59·인증·기존 잠금과 의존 파일을 보존했다. 0.4.20/build20261016.3은 소스142파일 중5개 변경·137개 바이트 보존으로 Windows·Mac ARM·Mac Intel 설치본을 빌드·공개했다. 공개 main `1a459bbc2c3d62790ec19b92042f60e8d1d2a68f`에서 Pages와 전체 사이트 검사(33쪽×2기기·LAB8게임×2기기·질문창)를 통과했고, 공개 feed·홈 설치링크3종·설치 파일 전체 해시·성향 JS/CSS 해시를 대조했다. 회사 화면의 `client-desk.css`도 HTTP200·SHA256 `42204c949c709ef5bdaaccdf97ef252090e6a9f4001c5bb9903b0c94aab673a7`와 첫 화면 링크를 확인했다. [최종 공개 검사](../.tmp/member-free-language-20261016/public/final-verification.json).

사용자 요청대로 PC 설치는 백그라운드로 마쳤다. 기존 설치·프로필을 백업한 뒤 설치75파일·내장 소스142파일을 대조했고, 첫 실행 전 프로필313파일과 Suite1파일의 보존을 확인했다. 실제 계정 자동 연결→새 문장 미리보기→저장하지 않고 취소→정상 종료→재실행 후 로그인·최신0.4.20 표시를 확인했다. 미리보기의 “처음 해 보는 과제는 필요한 순간에 제가 도움을 고르고 싶어요.”는 “처음 시도할 때 · 원하는 내용: 필요할 때 도움 선택”으로 해석됐고 추가 질문은 없었다. 검사 후 창과 프로세스는 모두 닫았으며 기존 트레이 종료 설정도 복원했다. 계정 설정·성향 기록 저장/삭제와 추가 로그인은0이며 푸시 시험은 계속 보류한다. [실계정·재실행 검사](../.tmp/member-free-language-20261016/pc/actual-account-verification.json) · [완료 근거](../.tmp/member-free-language-20261016/completion.json).

<a id="member-complex-language-20261016"></a>
### 낯선 복합문장의 관계 해석 — 2026-10-16 후속

사용자 요청에 따라 기존 Atlas의 문장 계약 안에서 이유·목적절과 실제 선호절, 앞 행동을 받는 지시 표현, 병렬·대조의 주체와 조건, 예시 전후의 순서를 보완한다. 지원하지 않는 조건을 없애 일반 선호로 바꾸거나 타인·인용·과거·실행 지시를 본인 성향으로 확정하지 않는다. 기존 Core의 근거·본인 확인·질문 계약을 유지하며 별도 LLM 하네스·모델 선택기·유료 호출은 추가하지 않는다.

공개 ko6 원문은 `member-statement-v6.cjs`에 SHA256 `e20eda01490cb2627c88b9212baae47058f9831d1e8c3cab09f72f751167e2b5` 그대로 보존한다. 새 ko7 확인 행은 문서 v8로 저장하고, 기존 ko1~6 기록·답변 재생·계정 잠금/CAS·구버전 덮어쓰기와 삭제 방어를 유지한다. 위 CheckList·CLINC의 행동/지원 범위 분리 원칙을 이어 사용한다. 이미 공개한 문장은 개발 회귀로만 쓰고, 별도 담당이 새 문장·정답·평가기와 판정 기준을 먼저 동결한 뒤 최종 후보의 최초 결과를 보존한다.

첫 후보 `9dda3a6b…`는 개발에 사용한 기존 80문장에서 명시적 선호 55/60을 직접 해석했지만, 새로 동결한 96문장의 최초 평가에서는 17/70→18/70에 그쳤다. 오제안 2건과 안전 보류 25/26도 개선되지 않았고, 별도 검토에서는 타인을 수식하는 원인절을 내 선호로 잘못 제안해 저장까지 허용하는 오류가 확인됐다. 이 후보는 공개하지 않고 [최초 평가](../.tmp/member-complex-language-20261016/private-evaluation/comparison-summary.json)와 [후보·검사 원본](../.tmp/member-complex-language-20261016/candidate1-archive/archive-manifest.json)을 보존했다. 이 96문장은 이후 개발 자료로 전환하므로 다음 최초 평가 성적으로 재사용하지 않는다.

두 번째 후보 `1c6ca1eb…`도 공개하지 않았다. 별도로 동결한 두 번째 96문장에서는 직접 해석 9/70→25/70, 의미 회수 45/152→83/152로 늘었지만 오제안이 1→4개, 안전 보류가 26/26→24/26으로 나빠졌다. 타인 주체를 뒤 절에서 잃는 두 문장과 예시 이후 조건을 잃는 한 문장만 수정 자료로 공개하고, 나머지 93문장은 계속 비공개로 둔다. 전체 소스 검사에서도 기존 대조절의 모호한 조건을 먼저 확정해 버리는 회귀 1건을 발견했다. [두 번째 최초 평가](../.tmp/member-complex-language-20261016/private-evaluation-2/comparison-summary.json)와 [소스 검사 실패](../.tmp/member-complex-language-20261016/candidate2-archive/ui/final-tests.json)를 보존하고, 시험 기대값을 낮추지 않고 주체·조건 전파를 수정한다.

최종 후보 `9289ce18…`는 미해석 절에서도 주체·조건 상태를 보존하고, 명시적인 본인 전환과 인접한 “그 예시” 연결만 좁게 허용한다. 대조절의 모호한 조건은 되묻는다. 개발에 공개된 첫 96문장의 원본 정답 기준은 68/70·오제안 0이며 D16·D46은 보수적으로 조건을 확인한다. D46은 계획 단계와 일반 실행 중 선호를 모두 뜻할 수 있어 이전 전수 감사의 확정 판단을 수정했다. 원본 정답과 최초 점수는 바꾸지 않았고, 이 두 문장의 개발 회귀는 보류 동작 자체를 검사한다. 새 시험 제외는 없다.

세 번째 독립 96문장의 최초 비교에서 직접 해석은 기존 ko6 **7/70→25/70**, 오제안 **1→0**, 안전 보류 **25/26→26/26**이었다. 불필요 질문은 61→43, 의미 회수는 48/153→75/153이며, 부분 의미 기준으로 23문장 개선·6문장 퇴보가 있다. 직접 해석 80% 목표는 **미달**이고 기준을 낮추지 않았다. 이는 별도 담당이 정답을 먼저 동결한 합성 표본의 결과이며 일반 정확도나 실제 사용자 효과가 아니다. 모호한 문장을 질문하는 경계와 확인된 개선분을 반영하되 모든 자유문장을 이해한다고 설명하지 않는다. [세 번째 최초 평가](../.tmp/member-complex-language-20261016/private-evaluation-3/comparison-summary.json) · [출시 판단과 제한](../.tmp/member-complex-language-20261016/release-candidate-decision.json).

전체 소스 검사 860건 중 858건 통과·기존 제외 2건·실패 0건, 서버 후보 217건 통과를 확인했다. 독립 경계 재검사 43건에서 오제안·근거 위치·조건 보류 회귀는 0이고, ko6 재해석 43건과 저장행 재생 5건도 같았다. 최대 500자 성능 검사 8종×40회에서 최대 15.006ms였으며 재귀 깊이 4·작업량 128 상한을 유지한다.

0.4.21/build20261016.4는 sourceHash `1740043117d7dae0de9db1afc783f00f5c5d02ab00253897495544b1da904246`의 142파일 중 5파일만 변경하고 137파일 및 동봉 WORLD·Workspace를 보존했다. 웹·숨김 PC 합성 검사는 220/253건, Windows·Mac ARM·Intel의 실제 패키지 CI도 통과했다. `synk-personal` v41을 배포하고 인증 `synk-account` v59·37의존 파일을 보존했다. 공개 웹 `b4c45d3…`와 공통 다운로드·피드 `4ed5717…`를 반영했다. 공개 설치파일 3종은 읽기 전용 GitHub Actions `38857906043`에서 익명 GET으로 파일 전체를 읽어 bytes·SHA256을 대조했고, 성공 run/head/attempt와 immutable artifact ZIP 안의 보고서를 다시 연결해 확인했다. [네이티브 검사](../.tmp/member-complex-language-20261016/release/native-qa-verification.json) · [공개 전체 다운로드 근거](../.tmp/member-complex-language-20261016/release/public-verification/verified-receipt.json).

PC는 기존 설치·프로필을 백업한 뒤 백그라운드로 0.4.21을 설치했다. 설치75파일·내장142소스의 전체 SHA를 대조했고 첫 실행 전 프로필312파일·Suite1파일의 바이트 보존을 확인했다. 기본 업데이트 주소의 캐시 전파 후 설치본 자체 updater가 최신0.4.21/build20261016.4를 읽는 것을 확인한 뒤에만 앱을 열었다. 실제 계정 자동 연결과 기존 요약(1일·응답6·혼자0·도움6·본인 확인0·활동 연결 꺼짐)을 확인했다. “처음에는 예시를 먼저 보고 싶고, 그 예시를 본 뒤에는 혼자 시도하고 싶어요.”는 ‘처음 시도할 때 예시 보기’와 ‘처음 시도하며 예시를 본 다음 혼자 시도하기’로 구분됐고 추가 질문은 없었다. 검증 문장은 저장하지 않고 취소했다.

정상 종료 후 프로세스0을 확인하고 재실행했다. 계정 연결·같은 요약·최신0.4.21 표시를 확인한 뒤 15:02 KST에 다시 닫았다. 최종 창·프로세스는 모두0이고 기존 트레이 종료 설정도 복원했다. 추가 로그인·계정 성향 저장/삭제는0이며 푸시 알림 시험은 보류한다. [실계정·재실행 검사](../.tmp/member-complex-language-20261016/pc/actual-account-verification.json).

최종 공개 커밋 `4ed5717…`의 Pages와 전체 사이트 검사를 모두 통과했다. 원본 CI 로그에서 33쪽×2기기·LAB 8개×2기기·회귀69건 통과를 확인했다. 공개 피드의 0.4.21/build20261016.4, 한·영 홈페이지의 설치 링크 각3개, 웹 JS·CSS의 SHA256과 HTML 연결도 일치했다. 회사 서버는 고객 관리 CSS의 HTTP200·SHA256 `42204c949c709ef5bdaaccdf97ef252090e6a9f4001c5bb9903b0c94aab673a7`·첫 화면 링크를 다시 확인했다. [최종 공개 검사](../.tmp/member-complex-language-20261016/public/final-verification.json) · [검사 수·원본 로그 대조](../.tmp/member-complex-language-20261016/public/site-count-verification.json) · [전체 완료 근거](../.tmp/member-complex-language-20261016/completion.json).

### 조사 근거 → 채택한 경험

2026-10-14 공개 공식 원문·스토어·사용자 토론 표본을 확인했다. 인기와 평점은 해당 서비스 전체의 지표이며 개별 기능의 효과나 SYNK의 학습 효과로 해석하지 않는다.

| 후보·범위 | 확인 근거·반응 | 채택 / SYNK 확인 항목 |
|---|---|---|
| Spotify Wrapped | [2025 Wrapped 참여 3억·공유 6.3억, 회사 발표](https://newsroom.spotify.com/2026-02-10/spotify-q4-2025-earnings/), [클럽 기능](https://newsroom.spotify.com/2025-12-03/wrapped-clubs-overview/), [2025 토론 댓글 8개 표본](https://www.reddit.com/r/spotifywrapped/comments/1pd95u7/what_are_your_thoughts_on_this_years_spotify/). 재미있는 요약 호평, 엉뚱한 해석·수치 불일치 불만 | 짧은 요약 뒤 실제 근거. SYNK는 고정 유형 대신 확인 가능한 자기보고·연습 기록을 표시 |
| Daylio | [미국 App Store 4.8/5·6.2만 평가](https://apps.apple.com/us/app/daylio-journal-mood-tracker/id1194023242?see-all=reviews), [활동 통계 원문](https://daylio.net/faq/docs/daylio-faq/about/activity-and-mood-statistics/). 공개 리뷰 10개(2018~2025)에서 적은 입력과 기록 회고 호평, 상관관계 해석과 다음 행동의 어려움 | 기간·자료 종류·빈 상태를 분명히. 단순 설정을 실제 수행 효과로 해석하지 않음 |
| Oura | [미국 App Store 4.9/5·31.2만](https://apps.apple.com/us/app/oura/id1043837948), [Discovery Hub 2026-10-07 문서](https://support.ouraring.com/hc/en-us/articles/30697762898323-Discovery-Hub), [최근 약 두 달 표시 글·답변 2개](https://www.reddit.com/r/ouraring/comments/1uyxz0a/trends/). 그래프 해석과 다시 찾기 불편 | 그래프보다 평이한 설명, 혜택에 고정 진입점. 제품별 표본 기준은 복사하지 않고 Atlas 계약 사용 |
| Finch | [미국 App Store 4.9/5·76.3만](https://apps.apple.com/us/app/finch-self-care-pet/id1528595748?platform=iphone&see-all=reviews), [장기 사용자 토론 의견 8개](https://www.reddit.com/r/finch/comments/1vxl8r3/i_could_literally_write_an_essay_with_peer/). 완료 동기와 동반자 호평, 장식·메뉴 과잉 불만 | 확인할 정보와 계정 설정 행동에 집중. 성향 화면에 새 재화·게임을 추가하지 않음 |
| 인접 후보 | [16Personalities 공식 이론](https://www.16personalities.com/articles/our-theory)·[누적 검사 15.8억 이상 표기](https://www.16personalities.com/), [Apple Music Replay 월·연간 회고](https://support.apple.com/en-ie/109356), [Duolingo 회고 제작](https://blog.duolingo.com/year-in-review-behind-the-scenes/)·[2025-12-28 결과 재열람 불만, 글·답변 2개](https://www.reddit.com/r/duolingo/comments/1pxkykm/the_year_in_review_for_2025_is_already_gone/) | 읽기 쉬운 자기이해와 상시 재열람만 참고. 누적 검사 수·회사 정확도 표기는 만족도나 진단 정확도로 쓰지 않음 |

전체 리뷰를 조사한 것은 아니다. Daylio 최신 리뷰 전체, 로그인 뒤 리포트·유료 기능 조작, Reddit 접힌·삭제된 댓글은 미확인이다. Finch 토론은 검색색인 날짜와 본문의 상대시간이 달라 정확한 게시일을 확정하지 않았다.

### 최초판 구현·검증 위치

공통 원본은 `desktop/renderer/member-insight-model.mjs`(기존 엔진 요약 투영), `member-insight.mjs`(계정·조회 수명주기), `member-insight-view.mjs`·`member-insight.css`(표시)다. 웹 `src/platform.mjs`와 PC `renderer/launcher.mjs`가 같은 화면을 소비한다. 최초판에서는 서버 원본 `atlas/account-summary.js`를 변경하지 않았다. 웹 글꼴을 다시 부분화하고 포털 빌드에 공통 CSS·기존 펠트 책을 포함한다.

모델·화면·계정·권한·기존 플랫폼 관련 단위·회귀 시험 120/120을 통과했다(`unit-results.tap`). 합성 계정의 격리 웹/숨김 Electron에서 목록 → 요약 → 근거 → 설정/복귀, 동의 해제·정보 없음·오류·늦은 응답과 320·390·1440px 밤/낮 표시를 확인했다. 웹 43/43, PC 54/54 검사 통과, 런타임 오류·외부 통신 0건이다(`browser-result.json`, `native-result.json`). 결과 파일은 `experiences/synk-account/qa/member-insight-20261014/`에 둔다. 일반 관심사의 서비스 간 연결은 구현 범위 밖이다. 최초 공개 준비에서 발견한 `prepare-platform-public.cjs`의 `client.html` 링크 변환 불일치(WORLD 링크 1개, 다음 학습 링크 2개)는 현재 문서 구조를 엄격하게 검증하도록 수정했고 관련 패키징 시험 5/5를 통과했다.

2026-10-14 후속 반영: 기존 공개 번들·계정 흐름을 보존한 웹 후보는 7시험과 합성 화면 55/55 검사(320·390·1440px, 밤/낮, 계정 전환·화면 이탈·오류)를 통과했다. account4파일만 `47fb0b72dddbf82bbbc8928f57b412beadf7badc`로 공개했고 Pages 성공, 공개 HTTP200·파일 크기·전체 SHA256 일치를 확인했다. [공개 화면](https://synk.im/account/platform.html#benefits/insight) · [공개 증거](../.tmp/platform-insight-20261014/web-publication.json). PC 기능 9파일은 공통 0.4.7/build20261014.4에 포함됐고 설치75파일·ASAR 및 공개3설치파일을 통합 릴리스에서 대조했다([설치 결과](../.tmp/platform-complete-20261014/receipts/apply.json)). 14:29 KST 사용자의 이어서 진행 요청 뒤 기존 Chrome 본인 계정으로 새 성향 두 영역·실제 Atlas 요약·근거 펼침·확인/연습 날짜 구분·새로고침 후 정상 표시를 확인했다. 콘솔 오류 0, 계정 설정·프로필·노트 변경 0이며 개인 식별자나 기록 내용을 증거에 저장하지 않았다([실계정 공개 화면 확인](../.tmp/platform-insight-20261014/real-account-public.json)). 같은 앱의 저장·복원 검수 종료 뒤 14:34 KST 기존 설치0.4.7·기존 로그인 상태에서 회원 혜택 → 내 성향의 두 영역과 실제 Atlas 요약을 화면·접근성 트리로 확인했다. 공개 계정과 같은 요약이며 추가 로그인·계정 설정·프로필·노트 변경은 없다([설치 앱 실계정 화면 확인](../.tmp/platform-insight-20261014/real-account-installed.json)). 공개·설치본의 새 성향 실계정 인수를 모두 완료했다.

<a id="platform-always-on-20261011"></a>
## 2026-10-11 모든 플랫폼의 PC 독립 상시 운영

사용자 확정 요구는 **제작 노트북이 꺼지거나 없어져도 PULSE 고객 협업, WORLD·TOWN, Workspace 직원 업무·대화, 준비된 PATH 면접·직업 VR을 언제든 이용하는 것**이다. 노트북은 개발·관리용이며 운영 서버·예약 실행기·공용 자료의 유일한 보관 장소가 되지 않는다. 설치형 앱도 같은 클라우드 서비스를 이용한다. 24시간 접속 가능 요구와 장애 중 무중단 전환은 별도로 인수한다.

10월 11일 현재 공개 Workspace·PULSE 고객 라운지는 Google Cloud VM, 공개 WORLD·TOWN과 플랫폼 입구는 GitHub Pages 및 공통 Supabase를 이용해 제작 PC와 분리되어 있다. 새 PULSE 진행·승인 연결은 현재 PC 설치본에 반영됐으나 실제 고객 의견·승인 왕복 인수는 남아 있다. 최신 WORLD 개발 기능과 PATH의 새 면접·VR 시제품을 이미 공개된 기능으로 간주하지 않는다. 회사 VM의 [일일 원격 사본과 격리 복원](마케팅/온라인마케팅지도/engagement/company/CLOUD-OPERATIONS.md#server-disaster-recovery-20261011)은 후속 적용했다. 공통 Supabase의 Free 중단·복구 조건, 즉시 자동 전환, PULSE 신규 문의 수신 경로와 PATH 공개·실기기 검증은 남아 있으며 [현재 운영 확인과 남은 조건](마케팅/온라인마케팅지도/engagement/company/CLOUD-OPERATIONS.md#platform-always-on-audit-20261011)에 근거를 둔다.

새 기능의 공개 인수는 다음 기준을 따른다.

- 제작 PC·localhost·개발 터널 없이 공개 HTTPS 주소에서 실행한다. 앱·모델·음원·폰트 등 실행 자산과 정확한 배포 산출물을 원격에 보관한다.
- 공용 업무·대화·고객 승인·계정 학습 기록은 서버가 저장을 확정한다. 기기 초안·미전송 기록은 구분하며 계정 전환·동시 수정·권한 철회 계약을 보존한다.
- 예약 수집·자료 반영·백업·감시는 클라우드에서 실행한다. 개인 PC나 Codex 예약을 운영의 필수 실행기로 사용하지 않는다.
- 서버 밖 백업과 원래 암호 키의 보호된 복구 경로를 확보하고 격리 복원을 확인한다. 노트북 분실 후 계속 실행과 서버 자체 유실 후 복구를 구분한다.
- 공개 입구와 계정·저장 의존성, 장애 알림과 이전 정상본 복원을 검증한다. 무료 체험·휴면·비용 한도 때문에 중단될 조건을 확인한다.
- WORLD·TOWN은 목표 동시 사용자로 저장 충돌·응답 지연·재접속을, PATH VR은 실제 대상 헤드셋에서 최초 다운로드·음성·조작·완주·재입장을 확인한다. 기존 계정별 저장을 공동 실시간 플레이 검증으로 대신하지 않는다.

이 기준은 후속 공개 작업의 요구사항이며 신규 결제·구독이나 미완성 기능의 일괄 배포 승인이 아니다. 기존 자료·계정·메모와 다른 작업의 변경을 보존한다.

## 2026-10-11 PULSE 후속 — 제작 진행·수정 의견·시안 승인

PULSE의 **제작 진행·승인** 탭은 기존 `workspace.synk.im/pulse/` 고객 라운지와 같은 프로젝트를 연결한다. Workspace 고객 관리에서 담당자가 프로젝트를 만들고 발급한 초대 링크로 접속하며, 현재 단계·합의 일정·다음 행동·시안과 최종 파일·고객 공개 의견을 표시한다. 의견은 최신 시안 버전과 선택한 장면 시간에 연결하고, 문의는 별도로 남긴다. 보내기와 명시적 승인 시 기존 서버에 저장된다.

**시안 최종 승인**은 확인한 최신 시안으로 최종 제작을 진행하는 동의다. 납품 파일의 별도 인수 승인을 뜻하지 않는다. 현재 버전의 미해결 수정 의견과 작성 중 의견이 있으면 플랫폼 승인 버튼을 막고, 새 버전에서는 다시 확인한다. 서버의 revision·초대 만료·접근 종료 검사를 유지한다. 실패한 전송은 작성 내용을 보존하고, 오래된 화면은 새로고침 후 확인하도록 안내한다.

고객 세션은 main의 독립 메모리 세션에만 둔다. 초대·세션·CSRF를 SYNK ID 토큰이나 직원 쿠키와 합치지 않는다. 계정 전환 시 프로젝트와 검토 창을 비우며 앱을 완전히 종료하면 초대 링크로 다시 연결한다. 시안 감상·최종 파일 저장은 별도 격리 검토 창에서 제공한다. 담당자용 프로젝트 생성·내부 검토는 기존 Workspace를 이용한다. 운영 프로젝트 생성이나 실제 고객 의견·승인 전송 없이 합성 데이터로 검증한다. [이번 설치·검증 기록](_ops/qa/platform-pulse-workflow-20261011/README.md).

## 2026-10-11 PULSE 클라이언트 공간 — 모델과 포트폴리오

플랫폼의 PULSE에서 현재 공개 중인 모델 6명의 대표 사진·이름·분위기를 살펴보고 후보를 담는다. 포트폴리오는 같은 모델 이미지 작업 1건 안에 사진 6장을 모아 보여 준다. 뮤직비디오와 기업 영상은 제작 중이며 사용자가 완성 후 알려 주면 추가한다. 가상 모델 5명과 창업자 본인 기반 이미지를 구분하고 미승인 표정·새 모델 후보는 포함하지 않는다.

고른 모델·작업은 브랜드/제품·제작 목적·사용할 곳/규격·희망 일정·기타 메모와 함께 요청문으로 복사한다. 임시 저장은 명시적으로 누른 현재 기기·계정에만 적용한다. 자동 접수·외부 발송·실시간 협업·결제·클라우드 초안 동기화를 제공하는 것으로 표시하지 않는다. 기존 권한과 계정 전환·초안 종료 보호를 유지한다. 구현은 `desktop/renderer/pulse-client.mjs`·`pulse-data.mjs`, 자산은 `desktop/assets/pulse/`이며 [벤치마킹·후속 기능](마케팅/PULSE.md#5-5-플랫폼의-광고-클라이언트-공간--2026-10-11)과 [재설치·확인 기록](_ops/qa/platform-pulse-20261011/README.md)에서 범위를 확인한다.

## 2026-10-11 왼쪽 앱 목록의 회원 혜택 중복 제거

플레저·무료 운세·중요한 대화 리허설·가족 이야기 앨범은 왼쪽 앱 목록에서 제외한다. 목록의 앱 개수·즐겨찾기 필터에도 같은 기준을 적용한다. 회원 혜택의 네 서비스 소개·검색·실행 연결과 기존 앱 권한·저장 기록은 유지한다. `desktop/renderer/launcher.mjs`의 목록 표시를 바꿨으며, 후속 재설치 요청에 따라 위 PULSE 클라이언트 공간과 함께 현재 PC 설치본에 반영하고 설치된 파일의 화면까지 확인했다.

<a id="messenger-teaching-20261009"></a>
## 2026-10-09 후속 — SYNK Workspace와 담당 반 케어

사용자 「이름 자체를 싱크 워크스페이스로 수정하자」에 따라 통합 제품 이름은 **SYNK Workspace · 싱크 워크스페이스**다. 메신저는 그 안의 대화 기능이며, WORLD 교사 업무는 **내 수업**에서 이용한다. 회사 교사는 같은 창에서 대화·자료·작업실·수업을 이어 쓰고, 회사 구성원이 아닌 교사는 담당 수업만 이용한다. 학생 WORLD는 독립 학습·놀이 제품을 유지한다. 현재 변경은 소스 반영이며 기존 공개 서버·설치본의 반영은 별도다.

플랫폼에서 회사와 teacher 권한이 모두 있으면 Workspace 카드 안의 내 수업 동작으로 모으고, teacher만 있으면 **Workspace · 내 수업** 입구를 표시한다. 교사 업무가 통합 제품의 역할별 공간으로 옮겨 **제품은 8개**이며 기존 `messenger`·`teacher` 권한·OAuth·저장·호환 식별자 9개는 유지한다. 역할별 권한·회사 세션·교사 세션·학생 공유 동의를 자동 합치지 않는다. 이전 교사 개발판과 저장 기록도 보존한다.

기본 운영은 **교사 한 명이 두 반, 한 반 16명**을 맡는 형태다. 내 수업 첫 화면에서 실제 담당 반과 학생을 함께 보고, WORLD의 공유 학습 근거와 과제, TOWN의 공유 활동 요약, 학생별 케어 계획·진행·확인일을 연결한다. 실제 반이나 학생 수를 2·16으로 잘라 누락시키지 않는다. [마을 설계 §13](마을_설계.md#13-열여섯--같이-사는-온기)의 학원 반=한 마을 기준을 서버의 소속으로 연결하며 일반 공개 마을과 임의로 합치지 않는다. 생활 활동 공유는 별도 선택이고, 학습 기록이 없거나 공유하지 않은 학생을 학습 부족으로 판정하지 않는다.

현재 구성·설정·검증과 남은 공개 반영은 [회사 워크스페이스](마케팅/온라인마케팅지도/engagement/company/WORKSPACE.md#messenger-teaching-20261009), [교사 기능 원문](../experiences/teacher-world/README.md), [PC 연결](../desktop/README.md)에 둔다. 후속 [공통 데이터 검수](_ops/qa/workspace-data-audit-20261009/README.md)는 학원용 경로와 최신 3D 경로를 구분한다. 같은 SYNK ID라는 설계만으로 서로 다른 로컬 DB·Town JSON·공개 서버의 기록이 같아지지는 않으며, 최신 3D WORLD·TOWN→Workspace 전체 운영 연동은 미완료다. 아래 앱 압축의 9개 목록과 독립 교사 앱 설명은 이 후속 통합 전 이력이다. 라이브 수업·공개방송은 기존 OBS/YouTube 도구를 내 수업·내 작업실에서 연결하는 **제안**이며 실제 송출을 이번 통합 완료로 표시하지 않는다.

<a id="app-compaction-20261009"></a>
## 2026-10-09 현재 앱 구성 — PULSE·Partners 통합과 기능 압축

사용자 「synk pulse랑 synk partners랑 겹치는것같거든? 같은 기능같으니 압축해줄래? 각 앱의 기능들도 제대로 잘 압축해줘」 요청에 따라 **Partners를 PULSE 안의 창작자·파트너 협업 역할로 합치고, 독립 앱을 10개에서 9개로 줄인다.** 각 앱은 한 가지 목적과 세 가지 핵심 기능으로 안내한다. 기능을 없애는 대신 같은 일의 입구를 모으고, 현재 제공 범위와 준비 중 범위를 구분한다.

| 앱 | 한 가지 목적 | 핵심 기능 3가지 | 현재 제공 범위 |
|---|---|---|---|
| **SYNK WORLD** | 한국어를 배우고 생활 속에서 써 보기 | 한국어 미니게임 · Town 생활 경험 · 과제와 학습 기록 | 설치형 개발판·공개 웹. 활동별 실제 연결 범위는 WORLD에서 확인 |
| **SYNK Messenger** | 회사 안에서 대화하고 함께 만들기 | 팀 대화 · 내 업무(할 일·저장 메시지·알림) · 제작·AI 실습 | 기존 회사 구성원 권한으로 이용. Studio·SHIFT 실습은 내 작업실에 포함 |
| **SYNK WORLD · 교사** | 학생의 다음 수업 준비하기 | 담당 학급·학생 · 과제 배정 · 공유 학습근거·결과 | 별도 교사 앱·수업 연결 MVP. 실제 담당 반과 학생의 공유 동의 필요 |
| **SYNK PATH** | 유학·학교생활·진로의 첫 행동 연습하기 | 가상 캠퍼스 탐색 · 목표별 상황 연습 · 다음 준비·기록 | 로컬 MVP. VR 헤드셋 실기기 검증은 별도 |
| **SYNK PULSE** | 외부 고객·창작자와 작품 만들기 | 제작 의뢰·검토·전달 · 창작자·파트너 협업 · 작품·IP·이용권리 | 플랫폼 상세는 준비 중. 입점·판매·결제·정산 미구현 |
| **SYNK 플레저** | 소중한 사람에게 연락할 준비하기 | 사람·대화 기억 · 일정·안부 챙김 · 문구 준비·보관 | 공개 웹·계정 저장. 직접 확인·복사 후 연락하며 알림의 실제 수신 검증은 별도 |
| **SYNK 무료 운세** | 오늘과 이번 주를 가볍게 돌아보기 | 별자리·한국 사주 · 오늘·주간 풀이 · 실천 메모·보관함 | 공개 웹·계정 보관함. 재미와 자기 점검용이며 예측 정확도 검증과 구분 |
| **SYNK 대화 리허설** | 중요한 대화 전에 할 말 준비하기 | 상대·목표 선택 · 대사에 답하고 다시 연습 · 첫 문장·성장 작품집 | 공개 웹. 준비된 분기 대사 기반이며 생성형 AI 대화·능력 평가는 미구현 |
| **SYNK 가족 이야기 앨범** | 사진 밖의 이야기와 원래 목소리 남기기 | 사진·이야기·원음 · 가족 기억·우리 집 손맛 · 이야기책·원본 묶음 | 로컬 MVP·개인 계정 저장 연결. 가족 초대·온라인 공동 편집은 미구현 |

Messenger의 제작은 **사내 작업**, PULSE는 **외부 제작 의뢰와 협업**으로 나눈다. PULSE 안에서 고객은 의뢰·검토·결과를, 창작자·파트너는 콘텐츠·협업·권리 범위를 다룬다. 기존 발주서와 회사 상담·납품 흐름을 재사용할 수 있지만, 이번 목록 통합으로 거래나 정산 서비스를 운영한다고 표시하지 않는다. 교사 앱은 수업 운영, PATH는 본인의 준비 연습을 맡는다. PATH의 [여행 체험](../experiences/path-travel/README.md)은 별도 입구이며 현재 플랫폼의 가상 캠퍼스 MVP에 합산하지 않는다.

회원 혜택은 플레저·무료 운세·대화 리허설·가족 이야기 앨범을 모아 보여 주는 입구로 유지한다. 앱마다 쓰는 목적과 자료가 달라 혜택을 하나의 기록 저장소로 합치지 않는다. 공통 SYNK ID는 유지하되 앱 권한·저장 동의·개인 프로필을 자동 공유하지 않는다.

퇴역한 `partners` 식별자의 저장 기록은 보존한다. 이전 선택·즐겨찾기는 PULSE의 현재 메뉴 권한을 확인한 뒤 새 입구로 안내할 수 있지만, `library.partners`만으로 `library.pulse`를 부여하거나 옛 메모·프로필을 PULSE에 자동 귀속시키지 않는다. 계정 보관함의 옛 Partners 메모는 원래 앱 출처를 남기고, 현재 PULSE 권한으로 접근을 별도 확인한다.

이번 변경은 **소스와 문서의 로컬 반영**이다. 검증 결과는 [앱 압축 결과](../desktop/artifacts/app-compaction-20261009.json)에 기록하며, 기존 공개 웹·현재 PC 설치본의 업데이트 완료와 구분한다. 아래 날짜별 10개·8개·6개 목록과 Partners 별도 앱 설명은 당시의 이력이며 이 현재 구성이 우선한다.

## 2026-10-09 Google 가입과 휴대폰 인증

최신 사용자 요청으로 **Google 로그인·가입 로직을 먼저 만들고 문자 서비스는 출시 직전에 연결한다.** 현재 개발 가입은 별도 아이디·비밀번호 없이 **Google 인증 → 국가·만 나이·성별과 개인정보 안내 확인 → SYNK 가입 완료**로 이어진다. 기존 회원은 원래 SYNK 계정에 Google을 연결해 기존 ID와 기록을 유지한다. Kakao는 이번 범위에 넣지 않는다. 나이는 입력 당시 기준일과 함께 저장하고 생년월일은 받지 않는다. 성별은 ‘응답하지 않음’을 선택할 수 있다.

신규 Google 사용자는 서버가 실제 Google 인증과 필수 입력을 검증한 뒤 내부 SYNK 계정을 만든다. 그 전 Google 인증 서비스의 사용자 생성과 SYNK 가입 완료를 구분한다. 개발 단계의 문자 인증 연기는 서버 설정 `SYNK_GOOGLE_PHONE_VERIFICATION=deferred`로만 정한다. 인증된 가입 조회의 `registration.phoneVerificationRequired`가 정확히 false일 때만 화면이 문자 입력을 숨긴다. 누락·알 수 없는 설정은 기존 인증 필수 흐름을 유지한다. 완료 요청으로 정책이나 인증 증거를 받지 않는다.

실제 Auth 휴대폰 인증 증거가 없으면 `phoneVerified:false`, `phoneVerificationDeferred:true`로 보관하며 인증 시각을 만들지 않는다. 실제 증거가 있을 때만 인증 성공과 실제 시각을 보존한다. 국가·나이·성별은 계정의 비공개 가입 정보이며 일반 앱 프로필·Atlas 요약에 자동으로 섞지 않는다. 학습 기록 저장은 기존 별도 선택을 유지한다. 기존 개발 가입자의 출시 전 번호 인증 추가와 앱 전체 제한은 후속 출시 작업이며, 설정을 인증 필수로 바꾸는 것만으로 기존 계정이 제한되지는 않는다.

현재 상태는 **로컬 구현·합성 인증/DB·브라우저 검증**이다. 이번 작업에서 운영 설정·실제 계정·공개 파일·설치본은 변경하지 않았다. Google 키 설정과 실제 Google 로그인 확인은 별도이며, 문자 서비스 가입·결제·실문자 검증은 출시 직전으로 미룬다. [현재 검증과 남은 일](_ops/qa/google-only-20261009/README.md), [이전 인증 필수 단계의 기록](_ops/qa/google-signup-20261009/README.md).

## 2026-10-09 Platform 한 번 로그인

사용자는 앱마다 다시 로그인하지 않고 Platform 로그인으로 지원 앱을 함께 연결하도록 요청했다. 기존 SYNK ID와 각 앱의 OAuth/PKCE·서버 권한을 유지하며, 마지막으로 검증한 공통 계정을 앱에서 자동 확인한다. Platform 종료나 같은 계정의 토큰 갱신을 전체 로그아웃으로 처리하지 않는다. 10월9일 회사서버·공개웹 반영과 PC 세 앱22b4c7 설치를 완료했고, 실제 정상 프로필에서 Platform 메모5개·복구1개 복원 및 Platform 실행 버튼→Messenger의 추가 로그인 없는 기존 회원 연결을 확인했다. 계정·직원 권한을 새로 부여하거나 기존 기록을 수정하지 않았다. WORLD 서비스 실행과 휴대폰·다른 실제 계정의 확인은 별도로 남아 있으므로 모든 앱·모든 기기의 실사용 통합 완료와 구분한다. [운영·설치·실계정 근거와 남은 범위](_ops/qa/platform-single-sign-on-20261009/README.md).

## 2026-10-08 첫 방문·내 홈·마무리 경험 개선

사용자 「켜는 순간부터 끄는 순간까지」 편안함·간편함을 높이자는 요청과 「오케이. 전부 이어서 진행해.」에 따라 홈페이지의 바로 체험·재방문 시작 설정, 웹/PC 내 홈의 직접 열기·연결 재시도, 모바일 검색, 미저장 홈 메모의 종료 보호를 로컬 구현했다. 처음에는 목적을 쉽게 고르고, 재방문에는 하던 앱을 바로 열며, 저장이 확인된 결과와 보관 위치를 명확히 안내한다. 현재 처마·싱ㅋ 입구와 플랫폼 시그널 디자인을 유지한다.

후속 요청으로 홈페이지의 무료 체험 목록 입구와 실제 공개 `account/platform.html#home`을 연결했다. 사용자 한정 검수 예외 승인 뒤 `05be3a5` 45파일과 기존 platform browser의 HTTPS 복귀 주소 한 개를 공개 반영했다. 공개 파일 SHA·홈 왕복9조건·한영 재방문6조건·실제 OAuth 시작과 중앙 로그인폼 복귀8개를 확인했다. 개인 PC의 세 앱은 고정 후보 `3079b9ed…`로 업데이트해 기존 프로필 보존·실제 실행 파일을 확인했다. 홈 메모는 직접 작성한 기기 기록이며 모든 앱의 진행 위치 자동 복원·자동 수집을 뜻하지 않는다. [설치·공개·검증 범위](_ops/qa/platform-experience-20261008/README.md).

## 2026-10-08 개인 맞춤 시작 화면과 내 홈

브랜드 경험 여섯 프로그램 진행 요청에 따라 설치형 플랫폼의 첫 화면에 내 홈을 추가했다. 기존 Atlas 목적 선택·동의와 SYNK ID의 현재 앱 권한을 사용하며 최근 성공 실행·즐겨찾기·이어서 할 일·직접 남긴 결과 메모를 연결한다. 명시 동의로 이 기기에서 계정별 저장하고 계정 전환·로그아웃·권한 철회 시 표시와 수정을 제한한다. 다른 앱 원본의 자동 집계·두 기기 동기화와 구분한다. 플랫폼 시그널 디자인을 유지했다. [구현·검증](../desktop/README.md), [전사 기능 연결](_ops/qa/brand-experience-20261008/README.md). 설치본 재배포는 이번 로컬 검증에 포함하지 않는다.

## 2026-10-08 로그인·계정·기록 연동 보완

9차에서는 로그인 중 완료된 기기 앨범 저장본을 비회원 보관본으로 갱신해 로그아웃 복원과 명시적인 계정 옮기기 모두 최신 내용을 사용한다. 자동으로 계정에 쓰지는 않는다. 이전 계정의 재연결 오류와 이전 녹음의 늦은 처리 결과를 새 화면에서 분리하고, 보존된 페이지의 녹음 재생 주소를 유지한다. [9차 로컬 구현·863개 검사·브라우저 확인](_ops/qa/platform-account-audit-20261008/ROUND9.md). 응답 유실 뒤 다른 작성자와 충돌하는 경로의 원문 보존도 합성 저장소로 검증했으며 운영·실물 증거와 구분한다.

8차에서는 다른 탭에서 완료한 기기 즐겨찾기·최근 기록 설정을 다음 변경이 덮지 않게 했다. 재인증 중 개인 기록과 복구 파일을 보호하며, 앨범·리허설·플레저의 늦은 파일 가져오기와 기기 저장 설정이 다른 계정에 적용되지 않게 했다. 앨범은 같은 계정 재연결 후 미저장 이탈 보호를 유지하고 저장 위치를 안내한다. [8차 로컬 구현·검증](_ops/qa/platform-account-audit-20261008/ROUND8.md). 기기 바로가기의 계정 동기화나 완전히 동시인 저장의 원자적 처리는 추가하지 않았다.

7차에서는 플레저의 일시 재인증 오류 때 수첩·입력창을 숨겨 보관하고 같은 계정 확인 후 복구한다. PC는 이전 토큰의 늦은 실패가 새 로그인·권한을 지우지 않으며, 공통 웹 연결기는 저장 세션 확인을 미로그인으로 중간 통지하지 않는다. 앨범은 계정 전환 뒤 이전 저장·녹음의 적용을 막고 리허설은 시작 입력을 계정 이동 확인에 포함한다. [7차 로컬 구현·1,050개 검사·브라우저 확인](_ops/qa/platform-account-audit-20261008/ROUND7.md). 새로고침·종료 후 원시 입력 복구와 운영·실물 검증은 포함하지 않는다.

6차에서는 늦은 기록 조회가 새 앨범 원본을 덮지 않게 하고, 운세 조회·삭제 중 추가 입력과 이전 계정의 실패 알림을 보호했다. PC는 토큰 갱신 중 기존 조회가 정상 로그인을 종료하지 않으며 현재 토큰으로 검증한 이름·앱 권한을 유지한다. 플레저는 미저장 일정·대화·녹음·표현 설정을 기존 새로고침·로그아웃·이탈 보호에 포함한다. [6차 로컬 구현·1,104개 검사·브라우저 확인](_ops/qa/platform-account-audit-20261008/ROUND6.md). 운영·실물 검증은 별개다.

5차에서는 플랫폼의 설정 실패·미완료 후 화면 복귀와 온라인 전환에서도 계정을 다시 확인한다. 운세는 검증된 로그인 교환을 일시 실패 후 재시도하고 오래된 네이티브 인증 알림을 무시한다. PC 로그인 준비 중 취소가 늦은 OAuth 창을 막고, 플레저는 알림 정리를 기다리지 않고 계정을 종료하며 미확인 결과를 따로 안내한다. [5차 로컬 구현·948개 검사·화면 확인](_ops/qa/platform-account-audit-20261008/ROUND5.md). 공개·설치본·실회원·실물 기기 검증은 별개다.

4차에서는 개인 앱의 로그인 콜백 통신 실패를 같은 탭에서 재시도하고, 설치형 로그아웃·로그인 취소 뒤 늦은 응답을 차단했다. 학습 동의 변경 결과가 불명확하면 서버 상태를 읽어 확인한 뒤 연습을 복구하며, 다른 기기의 로그인만 종료할 때는 현재 WORLD를 유지한다. 운세의 같은 계정 인증 갱신은 작성 중인 메모를 보존한다. [4차 로컬 구현·검증](_ops/qa/platform-account-audit-20261008/ROUND4.md). 실제 회원·기기 왕복과 공개 반영의 완료로 해석하지 않는다.

3차 검수에서 같은 계정 재인증은 미전송 기록과 문서 revision을 유지하고, 다른 계정으로 바뀌면 자료를 분리하도록 보완했다. 웹 복귀 시 이름·소속·이용권·기기 세션의 최신 응답을 반영하면서 같은 계정·동의의 WORLD 진행을 유지한다. 중앙 계정 로그아웃은 기존 화면·일반 요청을 즉시 차단하고 SDK 저장소 종료와 서버 철회를 각각 확인한다. SDK 영구 저장소의 즉시 삭제로 판정하지 않는다. [3차 로컬 구현·952개 검사·브라우저 확인](_ops/qa/platform-account-audit-20261008/ROUND3.md). 이번 변경의 공개·설치본 반영과 실제 회원·실물 왕복은 미실행이다.

후속 검수에서 웹과 PC의 재연결이 보관된 자격을 실제로 확인하도록 보완했다. 기록 삭제·충돌 처리 중 최신 입력을 보호하며, 로그아웃은 서버 응답 전에 기기 자격과 일반 요청을 종료한다. WORLD는 진행 중인 게임을 유지하면서 저장 대기·실패·완료를 확인하고 재시도한다. 기존 계정별 동의와 앱별 자료 경계를 유지한다. [2차 로컬 구현·검증](_ops/qa/platform-account-audit-20261008/ROUND2.md).

플랫폼 검수의 사용자 우선순위는 로그인·계정·기록 연동이다. 기존 SYNK ID를 유지하면서 웹 홈에서도 서버가 확인한 현재 계정을 보여 주고, 계정·연결 기록 관리 입구로 이어 준다. 일시적인 연결 실패는 로그인 정보를 보존한 재시도, 실제 인증 철회는 재로그인으로 구분한다. 로그아웃 후 늦게 도착한 응답은 계정을 복원하지 않으며 미전송 원본·기록은 다시 불러오기로 덮지 않는다.

플랫폼의 기기 바로가기·최근 열기와 각 앱의 계정 저장 기록은 별개다. 기기 목록에 혜택을 담거나 공개 플레저 웹을 여는 것으로 이용권·다른 앱 토큰·개인 자료 접근을 부여하지 않는다. [로컬 구현·검증·남은 운영 범위](_ops/qa/platform-account-audit-20261008/README.md). 기존 시그널 화면과 앱별 세션 경계를 유지하며 이번 수정은 공개 미반영이다.

<a id="unified-personal-account"></a>
## 2026-10-06 공통 SYNK ID와 개인 기록 연결

사용자 「모든 앱이나 우리가 서비스하는 모든 기능들」을 하나로 통합하라는 요청에 따라 기존 중앙 SYNK ID를 공통 기준으로 유지한다. 현재 운영 로그인 서버와 WORLD·맞춤 도구 등록이 이미 있으며, 앱마다 빠져 있던 등록·설정·저장 연결을 보강한다. 같은 계정으로 앱을 이용하되 회사·교사·학습 자료의 권한을 자동으로 넓히지 않는다.

플레저·PATH·중요한 대화 리허설·가족 이야기 앨범에 같은 로그인/계정별 저장 흐름을 연결했다. 로그인 전 기기 기록은 직접 옮길 때만 계정에 저장하고, 기기마다 수정이 엇갈리면 사용할 기록을 선택한다. 가족 앨범의 사진과 원음은 문서와 분리하여 비공개 원본 보관함에 저장하고 복원할 때 바이트 일치를 검사한다. 플레저는 지난 연락·주고받은 경조사 내역·확인한 취향·현재 계획을 ‘우리 사이의 맥락’에서 함께 꺼내 본다.

로컬 기능·합성 계정 검증과 실제 운영 등록·배포·사용자 로그인은 구분한다. 공통 목록/등록 도구는 [연결 설정 원문](../tools/synk-id/UNIFIED-CONFIG.md), 현재 검증과 운영 단계는 [통합 계정 현황](../experiences/synk-account/qa/unified-account-20261006.md)에 둔다. 아래의 ‘계정 동기화 미구현’ 등은 이전 시점의 기록이며 현재 판정은 이 원문과 연결된 구현을 따른다.

<a id="member-free-fortune"></a>
## 2026-10-06 무료 운세 — 별자리·한국 사주와 내 계정 보관함

사용자 「무료 운세 기능도 경조사기능옆에 synk 플렛폼 기능에 추가하자」에 따라 **SYNK 무료 운세**를 회원 혜택에 추가한다. 표시 순서는 **플레저 → 무료 운세 → 중요한 대화 리허설 → 가족 이야기 앨범**, 총 네 가지다. 공통 소개 원문은 `desktop/renderer/benefits.mjs`이며 설치형·웹의 목록·검색·상세에서 같은 순서로 연결한다.

후속 요청 「별자리로 보고싶을지 한국버전사주를 보고싶을지 선택」과 **생년월일·시간 기반 사주로 확대** 선택에 따라 첫 화면을 **별자리 운세 / 한국 사주**로 나눈다. 별자리 12궁은 한글·영문 이름과 일반적인 생일 구간을 표시하며, 직접 고르면 서울 날짜별 운세·작은 행동·행운의 색과 숫자가 열린다. 한국은 기존 12띠 선택을 **양력 생년월일과 24시간제 출생시각 또는 시간 모름** 입력으로 바꾸고 만세력의 연월일시 네 기둥·일간·겉글자 오행 분포를 실제 계산한다.

사주 출생시각은 한국 표준시(UTC+9)로 해석한다. 시간을 모르면 시주를, 같은 날 절기 경계에 따라 달라지는 기둥은 그 기둥도 유보한다. 로컬의 MIT `lunar-javascript` 고정 버전으로 계산하며, 풀이는 전통 상징을 바탕으로 준비한 규칙형 문구다. 강약·용신·미래를 확정하거나 진태양시·과거 서머타임을 보정하지 않는다. 별자리는 정밀 천체 계산을 하지 않는다. 비회원도 유료 AI 호출 없이 이용하고 결과를 직접 복사할 수 있다.

후속 계정 연결 요청에 따라 **출생정보·선호 방식 / 결과·작은 행동·실천 여부·한 줄 메모**를 로그인한 SYNK 계정에 명시적으로 저장한다. 비회원 입력과 저장 전 메모는 메모리에만 두며 자동 저장하지 않는다. 출생정보·기록의 localStorage/sessionStorage 사본도 만들지 않는다. 웹 로그인 토큰만 운세 전용 sessionStorage에, 네이티브 토큰은 독립 암호화 저장소에 둔다. 보관함은 최대 90개로 다시 열기·분류·개별 삭제·JSON 내보내기·운세 정보 전체 삭제를 제공한다. 삭제는 SYNK 계정 자체와 분리한다.

생일로 일반적인 별자리 찾기, 별자리 원소·활동 양식 안내, 사주 네 기둥·일간·오행 읽는 법, 월요일부터 일요일까지 **이번 주** 풀이와 작은 행동도 함께 제공한다. 실천 표시는 사용자가 직접 남기는 기록이며 학습 성과나 미래 예측으로 해석하지 않는다.

별도 개발 앱은 `experiences/daily-fortune/`, 고정 주소는 `http://127.0.0.1:4299/`다. 설치형은 `npm --prefix desktop run dev:fortune`, 독립 프로필 `im.synk.fortune.preview`를 사용한다. 플랫폼 실행은 추가한 `library.fortune` 메뉴 권한과 개발 미리보기 환경을 확인하며 플레저 권한·회원 혜택 소개·관심사만으로 운세 실행 권한을 부여하지 않는다. 웹의 실행 링크는 HTTP loopback 개발 환경에만 표시한다.

계정 저장은 중앙 `synk-fortune` API의 계정 소유권 확인과 revision 충돌 검사로 연결한다. 네이티브는 고유 OAuth 클라이언트 키 `fortune`, 콜백 포트 43825, API 제품 `platform`을 쓰며 플랫폼 토큰을 공유하지 않는다. 운세 상태는 학습용 Atlas 개인 메모리와 분리한다. 2026-10-06 운영·리허설 마이그레이션과 함수 v1, 운세 전용 OAuth·허용목록, 공개 동의 포털·로컬 공개 설정 연결을 마쳤다. 리허설 합성 계정의 실제 OAuth 저장 왕복 11항목, 로컬 브라우저의 운영 로그인 화면 도달과 네이티브 설정 기동을 확인했다. 실제 회원 로그인·운영 회원 데이터 왕복·두 실물 기기 검증은 미실행이다. 설정이 없는 별도 환경에서는 저장 준비 중 안내와 비회원 운세를 제공한다.

이는 운영 계정 서비스를 연결한 로컬 앱과 플랫폼 연결 범위다. 운영 회원 이용권 부여·일반 공개 운세 웹 호스팅·새 설치본 배포와 구분하며, 현재 구현·실행·검증 증거는 [무료 운세 원문](../experiences/daily-fortune/README.md)에 둔다. 아래 세 서비스 소개와 선정 기록은 무료 운세 추가 전 이력이다.

<a id="member-benefits-takehome"></a>
## 2026-10-06 소장 경험 — 가족의 책·성장 작품집·우리 집 손맛

사용자 「고객이 뭔가를 가져갔으면 좋겠어. 직접 실물이든 데이터로 남는 것들」과 후속 「오케이 이어서 해봐」에 따라 기존 회원 혜택에서 직접 만든 결과를 가져가는 흐름을 로컬 개발판에 추가했다. 별도 앱을 늘리지 않고 가족 앨범과 대화 리허설을 확장한다.

- **가족의 책**: 앨범 전체를 표지·목차·이야기·사진·출처 있는 기억·레시피로 엮는다. ZIP에 오프라인 책 `index.html`, 사진·음성 원본 `originals/`, 다시 편집할 `synk-family-album.json`, 사용 안내와 서체 라이선스를 담는다. 앱에서 종이 인쇄/PDF 저장도 제공한다. 음성은 종이에 담기지 않으며 원본 파일을 함께 보관한다.
- **내 성장 작품집**: 완료한 최근 10회 대화 연습의 실제 분기·처음 쓴 답·가장 최근 다시 쓴 답·스스로 고른 느낌·첫 문장·기억할 점을 오래된 순서로 엮는다. 서체를 포함한 독립 HTML과 인쇄/PDF 저장을 제공한다. 실제 대화 성과·실력 점수·다른 SYNK 앱의 학습 이력을 만들어 넣지 않는다.
- **우리 집 손맛**: 가족에게 배운 사람·분량·재료·순서를 사용자가 직접 남긴다. 실제로 만들어 본 날짜와 메모를 별도로 기록하고, 마지막 기록 뒤 레시피가 수정되었는지 표시한다. 다음 질문은 아직 답하지 않은 양·불 세기·익힘 기준에서 고르며, 임의로 조리법을 보완하지 않는다. 가족의 책과 복원 파일에 함께 담는다.

플랫폼의 공통 혜택 소개에도 가져갈 결과물을 반영했다. 원본 미디어·UTF-8·기존 JSON 형식을 보존하고, 설치형 다운로드는 정확한 제품·출처·파일명·MIME·크기 한도를 확인한다. 가족 ZIP 64MiB, 작품집 HTML 2MiB다. 원래 JSON 내보내기 계약은 유지한다.

이는 기존 Core 재사용과 로컬 소장 기능 구현이다. 실물 제작·배송, 운영 회원 권한 부여, 계정 동기화, 온라인 가족 공유, 유료 AI 호출, 공개 배포와 새 설치본 배포는 포함하지 않는다. [검증 결과와 남은 범위](../experiences/synk-account/qa/takehome-20261006/RESULTS.md), [앨범 원문](../experiences/family-album/README.md), [리허설 원문](../experiences/conversation-rehearsal/README.md).

<a id="member-benefits-local-mvp"></a>
## 2026-10-05 후속 초기 개발 — 리허설·가족 이야기 앨범

사용자 「이어서 해」에 따라 두 서비스를 실제로 한 번 완성해 볼 수 있는 **별도 로컬 개발판**으로 구현했다. SYNK FOR YOU의 소개·검색·상세에서 연결하며, 웹은 HTTP loopback에서만 고정 개발 주소를 연다. 설치형 소스는 제품별 프로필과 `library.rehearsal` / `library.family-album` 권한을 분리한다. 소개를 보는 것만으로 운영 이용권을 부여하지 않는다.

- **중요한 대화 리허설**: 면접·부탁·거절 중 상황과 상대·목표를 정하고 세 번 직접 답한다. 사용자가 고른 어려움에 따라 두 번째 장면이 달라지며, 막힌 대화를 다시 적고 원문과 비교한다. 첫 문장·기억할 한 가지를 남기고 다음 방문에는 아직 막힌 구간을 이어 연습한다. 준비된 대사와 자기평가이며 생성형 AI 대화·자동 채점은 아니다. [구현과 실행](../experiences/conversation-rehearsal/README.md), `http://127.0.0.1:4297/`.
- **가족 이야기 앨범**: 사진·본문·원래 음성을 한 장에 담고, 출처를 적어 다른 기억을 보탠다. 명시한 답과 건너뜀에 따라 아직 남기지 않은 기억을 묻는다. 수정·삭제 되돌리기·기기 보관과 원본 미디어를 포함한 파일 내보내기/불러오기를 제공한다. 현재 가족 참여는 같은 기기에서 기록하는 방식이다. [구현과 실행](../experiences/family-album/README.md), `http://127.0.0.1:4298/`.

두 앱은 기존 Core Ask/Domain 원본을 재사용하며 별도 Atlas 엔진을 만들지 않는다. 자유 서술·사진·음성의 의미 분석이나 엔진 자체 발전을 완료한 것으로 표시하지 않는다. 기본은 탭 메모리이고 사용자가 선택한 경우에만 이 기기에 보관한다. 운영 회원 인증·계정 동기화·온라인 가족 초대/공동 편집·공개 출시·새 설치 파일 배포는 후속이다.

자동 검사, 실제 브라우저의 연습/앨범 완성·저장 복원·파일 왕복·모바일 화면, 원본 미디어 바이트 대조는 [초기 개발 검증](../experiences/synk-account/qa/member-mvp-20261005/RESULTS.md)에 남겼다. 아래 소개 반영과 후보 선정 절은 개발 전 결정 이력이다.

<a id="member-benefits-platform"></a>
## 2026-10-05 회원 혜택 공간 — 플랫폼 로컬 반영

사용자 「지금 플렛폼에 전부 반영해줘. 무료체험 섹션도 새로 추가하거나 … 브랜딩하기 좋도록」 요청에 따라 설치형 플랫폼과 웹 개발 화면에 **회원 혜택 / SYNK FOR YOU**를 추가했다. 중심 문구는 **‘소중한 순간을, 더 잘.’**이며 플레저·중요한 대화 리허설·가족 이야기 앨범을 같은 공간에서 소개한다. 홈·메뉴·검색·서비스 상세에서 연결하고, 승인된 펠트 자산과 기존 브랜드 서체를 사용한다.

무료 제공은 회원 혜택의 방향이다. 첫 소개 반영 당시 플레저는 로컬 개발 미리보기, 리허설·가족 앨범은 준비 중 소개였다. 이후 두 앱의 초기 기능을 위 후속 개발 절처럼 연결했다. 소개 열람과 실제 앱 이용 권한은 구분하며 설치형 실행은 기존 서버 확인 권한과 개발 미리보기 환경을 모두 확인한다. 웹에서는 loopback 개발 환경에만 로컬 링크를 표시한다.

공통 소개 원문은 `desktop/renderer/benefits.mjs`다. [설치형 구현](../desktop/README.md), [웹 구현](../experiences/synk-account/README.md), [이번 검증과 남은 범위](../experiences/synk-account/qa/member-benefits-20261005.md)를 따른다. 운영 계정 연결·회원 이용권 부여·공개 배포·새 설치 파일 배포는 실행하지 않았다.

<a id="member-free-rehearsal"></a>
## 2026-10-05 회원 무료 혜택 — 대화 리허설·가족 이야기 앨범 선정

플레저 외에 SYNK 회원에게 무료로 제공할 추가 후보는 **‘중요한 대화 리허설’과 ‘가족 이야기 앨범’**이다. 사용자는 첫 검토에서 대화 리허설만 남겼고, 후속 제안에서 「가족 이야기 앨범 추가해. 이거 좋다」라고 요청했다.

개인 실습실·선택 상담 등 첫 검토에서 제외한 제안은 선정 목록에 넣지 않는다. 사용자가 지적한 이유는 Claude·GPT가 잘 해결하는 범용 기능에 비해 별도 SYNK 서비스를 쓸 이유가 부족하다는 것이다. 이 결정의 범위는 이번 회원 무료 혜택 후보 선정이며, 기존 SHIFT 사업이나 맞춤 도구의 폐기를 뜻하지 않는다.

### 중요한 대화 리허설

면접·발표·부탁·거절처럼 실제 대화를 앞두고 준비하고 연습하는 경험이다. 후속 설계에서는 실제 대화 상황·상대의 되묻기·막힌 구간 재연습·다음 연습의 변화를 구체화한다. 범용 AI의 역할 연습과 비교해 SYNK를 쓸 이유를 검증해야 한다.

<a id="member-free-family-album"></a>
### 가족 이야기 앨범

사진 한 장을 고르고 짧게 이야기하면 **사진·이야기·실제 녹음된 목소리가 함께 담긴 한 페이지**가 완성되는 경험이다. 가족이 다른 사진과 기억을 보태 같은 사건에 연결하고, 모인 기록으로 생일·결혼기념일 등에 볼 작은 앨범을 만든다. 원래 목소리를 그대로 다시 들을 수 있는 것이 핵심이다.

Atlas를 체감할 부분은 이미 들은 이야기를 반복해서 묻지 않고, 지난 이야기와 가족이 보탠 기억을 바탕으로 의미 있는 다음 질문을 고르는 것이다. 첫 사용부터 보관하고 싶은 결과물이 남아야 한다. 후속 설계에서 사진·원음·본문의 연결, 가족 참여와 공유 범위, 정정 반영, 다음 질문과 앨범 완성 흐름을 구체화한다.

두 추가 서비스는 위 후속 요청으로 **플랫폼 소개·상세 화면에 반영**했고, 이어진 요청으로 로컬 초기 기능까지 개발했다. 운영 출시와 구분하며, 후속 제안의 생활 보관함·작업방은 선정 목록에 포함하지 않았다.

## 2026-10-05 관계·경조사 앱 초기 개발

사용자가 보유한 통화 녹음·대화로 사람의 말투와 선호를 파악하고 생일·경조사를 챙기는 앱을 SYNK 플랫폼에 먼저 넣어 개발하도록 요청했다. 같은 날 사용자 요청으로 개발용 가칭 챙김을 **SYNK 플레저**로 확정했으며 기존 PC 런처의 별도 앱으로 등록한다. 내부 식별자 `care`, 소스 경로와 기존 저장 키는 유지한다. 메뉴는 기존 계정별 범위를 유지하여 `library.care`로 확인하고, 다른 앱의 자료·권한을 자동으로 공유하지 않는다. 직접 개발 실행은 `npm --prefix desktop run dev:care`다.

첫 구현은 선택한 음성의 로컬 받아쓰기, 자기 발화의 표면적인 말투 관찰, 사용자가 확인한 상대 선호, 양력 일정·회차 완료, 문구 초안 수정·복사·달력 내보내기다. 텍스트 관찰/초안은 현재 규칙·템플릿이며 선호를 자동 확정하는 개인 AI 모델은 아니다. 운영 계정 저장·앱 종료 후 푸시·상대에게 자동 발송·유료 모델·설치본 갱신은 포함하지 않는다. 현재 소스/실행/검증과 후속 범위는 [플레저 README](../experiences/relationship-care/README.md)에 둔다. 아래 6개 목록과 두 앱에 관한 기록은 확장 전 이력이다.

<a id="workroom-practice-removal-20261009"></a>
## 2026-10-09 후속 확정 — 작업실 AI 업무 연습 제거

사용자 「AI 업무 연습을 어디에 쓰는 건지 감이 안 잡힌다」「빼줘」에 따라 **내 작업실의 AI 업무 연습 메뉴와 화면 진입·모듈 로딩을 제거**한다. 기존 `?tab=workroom&section=practice` 주소는 제작 데스크로 돌아간다. 가상 실습 원본과 기존 기기·회사 계정 저장 기록·저장 API는 보존하며, 다른 제작 기능·SHIFT 사업 범위를 바꾸거나 대체 기능을 추가하는 요청으로 확대하지 않는다. 아래 작업실 통합·계정 동기화 설명은 이전 구현 이력이다. 소스 수정과 현재 설치 앱이 연결하는 `workspace.synk.im`의 실제 반영·검증 상태는 [진행 기록](_ops/트랙.md)에 구분해 남긴다.

## 2026-10-02 후속 확정 — Studio·SHIFT를 사내 작업실로 통합

사용자 「통합해주고 외부 기업 교육 고객의 공간이 왜 필요한거야」에 따라 **Studio의 사내 제작 기능과 SHIFT 업무 실습을 SYNK 사내 메신저 → 내 작업실로 모은다.** 플랫폼의 독립 Studio·SHIFT 항목과 SHIFT 개발 클라이언트 입구를 제거하며 PATH는 별도 앱을 유지한다. SHIFT 사업 브랜드 자체를 폐기하는 결정은 아니다.

제작은 기존 **제작 데스크·제작 도구**에서 이어간다. 별도 제작 앱이나 이전에 숨긴 제작 보드를 새로 노출하지 않고, 기획·게시 전 점검·자막 검사·승인 제작 자료를 재사용한다. SHIFT의 회의·자료 조사·기획 3종은 같은 작업실의 **AI 업무 연습**으로 옮긴다. 직접 고른 목표·시간·도움 방식과 해당 연습의 확인 결과를 기존 Core에 연결하며, 다른 학습·회사 자료나 직원 평가로 확대하지 않는다.

같은 회사 로그인으로 사용하되 연습 초안·조건·결과는 계정별로 분리한다. 기기 저장은 직접 선택할 때만 사용하고, 이전 익명 SHIFT 기록은 회사 계정에 자동 귀속시키지 않는다. 기존 Studio·SHIFT 메뉴 이용권만으로 메신저 권한을 새로 부여하지 않는다. 실제 회사 접근은 기존 회사 인증과 권한 검사를 유지한다.

**외부 기업 교육 고객 공간은 향후 B2B 제공을 가정한 제안이었으며 현재 요구사항에서 제외한다.** 외부 조직 가입·교육 운영·고객별 자료 공간은 만들지 않는다. 실제 고객과 계약·운영 방식이 정해졌을 때 별도 필요성을 검토한다. 정식 로그인 운영 연결·배포 패키지·공개 업데이트 유예와 WORLD→교사 연결의 설계만 상태도 유지한다. 아래의 8개 목록·SHIFT 별도 클라이언트 기록은 통합 전 이력이다.

<a id="shift-company-account-sync"></a>
## 2026-10-07 후속 — SHIFT 실습의 회사 계정 저장·동기화

SHIFT 실습의 선택 계정 저장을 기존 **회사 메신저 → 내 작업실 → AI 업무 연습**에 로컬 구현했다. 같은 회사 계정으로 로그인한 다른 브라우저에서 동기화를 직접 켜 실습 조건·요청문·수정한 결과·검토 기록을 이어 쓴다. 기기 저장과 계정 동기화는 별도 선택이며 기본은 둘 다 꺼짐이다. 독립 익명 시험 화면의 기존 기록은 회사 계정에 가져오지 않는다.

인증된 회사 서버 세션이 소유자를 정하고 범위는 `company / workroom-practice / SHIFT`에 고정한다. 기존 중앙 SYNK ID에 연결돼 있어도 해당 회사 세션의 확인·권한 검사를 거쳐야 한다. 다른 SYNK 앱의 기록·권한과 합치거나 외부 조직 가입·고객 공간을 만드는 확장이 아니다. 비공개 실습 본문은 기존 회사 저장소의 암호화 기능으로 보관하며 회사 공유 자료로 자동 전환하지 않는다. Atlas는 기존 프로필·원기록 계약을 제공하고, SHIFT 제품은 상태·계보·판본 복원을, 회사 호스트는 계정·저장·동시 변경을 맡는다. 공통 엔진 원본은 이 작업에서 변경하지 않았다.

`GET/POST /api/workroom-practice/state`가 본인 기록을 조회·저장·삭제한다. 서버와 클라이언트가 같은 공유 모델로 소유 범위와 원결정·완료·노출·결과를 확인한다. 최신 revision을 비교하여 저장하며 두 브라우저에서 서로 바뀌면 양쪽 작성물을 보여 주고 이어갈 기록을 직접 선택한다. 계정 삭제 뒤에는 내용 없는 삭제 revision을 남겨 오래된 기기의 자동 재저장을 막는다. 동기화 끄기는 이미 저장한 계정 내용의 삭제를 뜻하지 않으며, 켜진 상태의 기록 비우기는 서버 삭제 성공 뒤 기기 내용을 비운다. 오프라인·충돌·삭제 실패에는 현재 작성물을 보존하고, 로그아웃·계정 전환·세션 변경 뒤 늦게 온 응답은 버린다.

[제품 저장 계약](../experiences/shift-workbench/README.md#account-sync), [서버·클라이언트 검증](_ops/qa/shift-account-sync-20261007/report.json), [두 격리 브라우저 왕복](_ops/qa/shift-account-sync-20261007/browser/report.json)에 확인 범위를 둔다. 이는 로컬 합성 계정과 격리 브라우저의 검증이다. 실제 회사 계정·물리적 두 기기·운영 서버 배포와 백업·공개 배포·유료 AI 호출·실사용자 효과 확인은 실행하지 않았다. 10-02 통합 결정의 외부 기업 교육 고객 공간 제외와 설치 패키지·공개 업데이트 유예는 유지한다.

## 2026-10-02 PATH VR · SHIFT MVP 개발

사용자가 5번 PATH는 VR 활용 중심 MVP, 6번 SHIFT는 업무 활용 MVP 개발을 요청했고 두 번호를 직접 확인했다. PATH·SHIFT를 준비 중 상세에서 별도 로컬 MVP로 전환한다. 라이브러리는 앞서 확정한 계정별 노출을 유지한다.

| 제품 | 이번 MVP | 다음 단계 |
|---|---|---|
| PATH | 가상 캠퍼스 3개 장소·6개 상황, 목적·시간·도움에 따른 Core 추천, 3D/키보드/터치 연습, WebXR 진입·컨트롤러 선택, 선택 기록과 다음 준비 | 실제 헤드셋 조작·가독성·멀미 확인, 더 풍부한 상황과 대화, 승인된 HTTPS 접근 |
| SHIFT | 가상 업무 3종의 요청문 작성·원문과 예시 AI 결과 대조·직접 수정·TXT 결과·다음 실습, Core의 조건별 분량·도움·피드백 적용 | 실제 팀 실습 확인, 필요한 AI 기능을 선정한 뒤 호출·비용·자료 권한 연결 |

두 앱은 이 기기에서 선택한 저장만 제공하며 운영 SYNK ID·학습 장부와 동기화하지 않는다. 플랫폼과 서로 다른 개발 클라이언트·프로필을 사용하고, 제품별 기능과 검증은 [PATH](../experiences/path-vr/README.md)·[SHIFT](../experiences/shift-workbench/README.md)·[desktop](../desktop/README.md)에 둔다. VR 장비 검증·정식 SSO·배포 패키지·실기기 설치는 여전히 후속 범위다.

**Studio와 사내 작업실에 대한 의견:** 사내 제작 기능은 기존 메신저/회사 작업실 안에서 프로젝트→제작→검토→전달로 이어가는 통합을 권한다. 현재 작업실에는 기획·제작·검토와 제작 도구가 있으므로 또 다른 독립 제작 앱에 중복하지 않는 것이 맞다. 이번 요청의 의견 부분에 대한 제안이며, 이 작업에서는 Studio 목록 삭제·기존 회사 자료 이관·권한 변경을 실행하지 않았다. 학습 문항의 게시 권한과 외부 제작자 협업은 회사 내부 권한으로 자동 확대하지 않는다.

## 2026-10-02 후속 확정 — 계정에 필요한 앱만 표시

사용자가 “로그인 한 사람에게 필요한걸 먼저 보여주는식으로 기능 추가”, “전부 다 보여주지말고”를 요청했다. 8개 항목은 제품 목록에 유지하되 로그인한 사람의 라이브러리는 **서버에서 확인한 소속·이용권에 해당하는 앱만** 표시한다. 학생은 WORLD, 교사·원장은 교사 앱, 사내·제작·고객용 항목은 해당 계정에 명시적으로 연결된 앱만 표시한다. 여러 역할은 해당 앱의 합집합으로 처리하며 학원 교직원이라는 이유로 회사 메신저를 열어 주지 않는다.

데스크톱의 `src/library-access.cjs`가 인증된 계정 조회 응답의 `memberships`·`entitlements`를 `auth.library={status,appIds}`로 투영한다. 기존 learner/student, staff/teacher·director, WORLD `practice.plus`와 명시적인 `product:platform,key:library.{appId}` 메뉴 이용권을 지원한다. 마지막 계약은 **메뉴 노출 계약**이며 실제 회사 자료·기관·학급 접근 검사를 대체하지 않는다. 이번 변경은 이용권 부여·운영 DB 변경을 하지 않는다.

사이드바·선택 상세·추천·검색·즐겨찾기·설치 목록·다운로드 수에 같은 범위를 적용한다. 계정 전환은 이전 상세·열린 콘텐츠 창을 닫고, 안정적인 SYNK ID별로 보기·맞춤 설정을 따로 불러온다. 관심사 자기신고로 앱을 늘릴 수 없다. 로그인 전에는 WORLD 소개 하나만, 로그인 복원·조회 실패에는 계정 확인 안내만 표시한다. 계정에 연결된 앱이 없으면 빈 라이브러리를 안내한다. 창으로 돌아올 때 계정을 다시 조회하며 권한 만료·철회나 늦게 도착한 이전 응답이 목록을 복원하지 못하게 한다.

이는 개발 소스의 로컬 구현이다. 합성 계정·실제 렌더러 검증은 [desktop README](../desktop/README.md)를 따른다. 정식 SSO·운영 이용권 부여·새 배포 패키지·실기기 설치 검증은 아래 MVP 이후 유예를 유지한다. 아래 8개를 모두 보여 주던 구성은 이번 변경 전의 이력이다.

## 2026-10-02 확장 후보 등록 · 별도 교사 앱 착수

사용자가 제안한 확장 후보를 전부 플랫폼에 넣고 교사 전용 앱을 먼저 개발하도록 요청했다. 기존 WORLD·사내 메신저와 다음 6개 후보, 총 8개를 라이브러리에 표시한다. 후보 등록은 출시·판매·운영 완료를 뜻하지 않으며 새 영문 제품명은 표시용 가칭이다.

| 항목 | 대상·역할 | 현재 반영 |
|---|---|---|
| WORLD · 교사 | 학생의 학습 근거로 수업·과제를 준비하는 교사·기관 | 별도 로컬 MVP, 과제 왕복 체험 |
| 콘텐츠 제작·검수 / Studio | 콘텐츠 작성자·검토자 | 준비 중 상세. 기존 제작실·검토실 재사용 방향 |
| PATH | 유학·진로 준비 학습자 | 준비 중 상세 |
| SHIFT | 기업·기관 AI 활용 교육·정착 | 준비 중 상세 |
| PULSE | 제작 고객과 작품·IP 이용자 | 준비 중 상세 |
| 외부 창작자·파트너 / Partners | 검수한 콘텐츠 공급자·협력기관 | 준비 중 상세. 입점·판매·정산 미구현 |

교사와 학생 WORLD는 별도 화면·클라이언트·세션이며 허용된 학습 자료와 기존 Atlas 담당 엔진을 연결한다. 같은 SYNK ID나 회사 직원·학원 교직원이라는 사실만으로 모든 학생 자료를 공유하지 않는다. 교사 MVP는 합성 학생 4명·2개 반에서 Core·Strata를 재사용해 추천→배정→읽기 제출→교사 결과와 다음 추천까지 확인한다. 실제 WORLD 계정·미니게임 운영 기록 연결은 아직 아니다. [교사 앱 구현·경계·검증](../experiences/teacher-world/README.md).

소스 개발 플랫폼에 8개 항목이 반영됐으며 기존 Windows 0.3.0 설치 파일은 갱신하지 않았다. 아래의 MVP 이후 출시·운영 연결 유예는 유지한다. 앞서 두 앱으로 구성한 기록은 이번 확장 전의 결정 이력이다.

## 2026-10-02 후속 일정 확정 — 출시·운영 연결은 MVP 이후

사용자는 독립 PC 런처 개편을 확인한 뒤, 남은 **정식 로그인 운영 연결·공개 업데이트·배포 패키지와 실제 설치 검증 등은 MVP가 만들어진 뒤 진행**하기로 했다. 기존 구현과 Windows 0.3.0 개발 패키지는 보존한다. 이 항목들을 다음 자동 착수 작업으로 취급하지 않으며, MVP 완성 후 현재 코드·설정·배포물과 기기별 확인 범위를 다시 점검해 진행한다. 날짜나 새 서비스 제작 범위는 이번 결정으로 추가 확정하지 않았다.

## 2026-10-02 공통 계정·통합 로그인 우선 — 사용자 확정

사용자가 미니게임 개인화 후속의 ③ 앱과 게임의 계정 기록 연결을 먼저 확정하고, “우리 앱이랑 SYNK 플랫폼 앱이랑 전부 연동되게 처음부터 설정”, “한 로그인으로 다 가능하도록”을 요청했다. **같은 날 후속 요청으로 SYNK 플랫폼을 공통 입구로 두고, 그 안에 ① SYNK 사내 메신저 ② SYNK WORLD 앱을 배치한다.** 플랫폼을 이 두 앱과 나란한 세 번째 앱으로 세지 않는다. 하나의 SYNK ID로 사람을 연결하고 각 앱은 필요한 권한과 세션을 따로 확인하는 방향이다. 미니게임·SYNK TOWN·숙제·AI 코칭 등은 **SYNK WORLD 내부 콘텐츠/기능**이며 별도 제품이나 로그인 대상으로 세지 않는다. WORLD 내부 기능은 WORLD의 계정·세션·학습 기록을 이어 쓴다. 개별 게임의 추가 개인화보다 이 공통 계정·인증·기록 연결을 우선 구현한다. 앞선 ‘① 플랫폼 ② WORLD’ 표현은 이번 후속 요청으로 계층을 명확히 한 이력이다.

사내 메신저의 현재 표기는 **SYNK 사내 메신저**다. **SYNK WORK는 제안한 이름이며 아직 확정하지 않았다.** 대화·파일·업무 공간을 플랫폼에서 열 수 있도록 하되, 회사 직원에게 부여한 이용 권한을 서버에서 확인한다. 일반 회원·학생·학원 교직원 역할만으로 회사 직원 권한을 부여하지 않는다. 메신저 대화·첨부 파일과 WORLD 학습 원본은 서로 자동 공유하지 않으며, 공통 계정은 비공개 자료의 공동 열람 권한이 아니다.

**같은 날 추가 명확화 — 설치형 플랫폼과 독립 클라이언트:** 사용자는 Steam·PURPLE·Epic처럼 앱을 관리하는 플랫폼을 요청하고, “SYNK 플랫폼을 깔면 WORLD랑 사내 메신저는 별개야, 각각 다른 클라이언트야”라고 명확히 했다. 따라서 SYNK 플랫폼은 설치형 런처이며 WORLD와 사내 메신저는 각각 설치·실행·업데이트·세션을 관리하는 별도 클라이언트다. 플랫폼에 앱을 추가한다는 것은 두 앱을 웹 화면의 일부로 넣는다는 뜻이 아니다. 후속으로 **Windows와 macOS 모두 제작**을 요청했다. 플랫폼·WORLD·메신저에 각각 독립된 앱 식별자와 OS별 빌드 구성을 두며, 각 OS의 패키지 생성·서명·설치·실행·업데이트 검증을 구분한다. `experiences/synk-account/platform.html`은 이 구성의 웹 개발 미리보기이며 설치형 런처·배포 패키지·실제 업데이트 기능 완료를 뜻하지 않는다. WORLD 안의 미니게임 실행 방식과는 구별한다.

### 모바일·PC·웹 공통 지원 — 2026-10-02 후속 확정

사용자는 통합 로그인과 함께 모든 앱을 모바일·PC에서 이어 쓰도록 요청했다. **SYNK 플랫폼·SYNK WORLD·SYNK 사내 메신저의 공통 개발 대상은 Android·iOS·Windows·macOS·웹**이다. 앞선 Windows/macOS 요청을 모바일과 웹으로 확장한 결정이며, 모든 OS의 네이티브 설치본·스토어 출시·실기기 검증이 완료됐다는 뜻은 아니다.

PC에서는 설치형 플랫폼과 두 독립 클라이언트 구성을 유지한다. 모바일 플랫폼은 계정·앱 탐색·연결 입구를 제공하며 각 앱을 해당 OS의 설치 경로나 웹 입구에서 연다. 모바일 웹의 홈 화면 추가와 네이티브 설치·푸시·백그라운드 동작의 완료를 구분한다. 기존 WORLD의 Android/iOS 코드를 유지·보완하며, 특정 OS용 실행 파일을 다른 OS에도 설치할 수 있는 것처럼 표시하지 않는다.

모든 환경이 같은 내부 SYNK ID와 서버 권한 계약을 쓰되, OAuth 클라이언트·정확한 callback·기기 세션·토큰 보관은 실행 환경에 맞게 분리한다. 모바일 네이티브는 시스템 브라우저의 Code/PKCE·state와 SecureStore, 공통 웹 `client.html`은 브라우저 SSO와 계정/동의 revision별 WORLD 저장소를 담당한다. 기존 SYNK-talk 웹 미리보기의 인증·전송 대기 메모리 저장은 이번에 재설계하지 않는다. 새로고침 뒤 지속 이용의 근거로 그 미리보기를 쓰지 않으며, 공통 웹 입구의 실제 로그인·재접속·계정 전환을 별도로 검증한다. [현재 구현과 검증 한계](SYNK_공통계정_구현검증_20261002.md#후속-요청--모바일pc웹-공통-로그인)

### 플랫폼 화면 구성과 참고 범위

**2026-10-02 후속 정정 — PC 런처 경험:** 사용자는 “SYNK 플랫폼을 스팀이나 PURPLE처럼 만들어 달랐는데 웹앱처럼 만들었다”고 지적했다. PC의 납품 기준은 설치해서 여는 독립 SYNK 플랫폼 앱이며, `localhost` 웹 개발 화면이나 모바일 계정 화면을 PC에 크게 표시한 결과로 대신하지 않는다. 공통 로그인·권한·기록 계약은 유지하고, PC의 화면 구조와 설치·실행 흐름을 별도로 만든다.

- 창 상단의 고정 탐색, 왼쪽의 간결한 WORLD·사내 메신저 라이브러리, 선택 앱의 큰 상세 화면, 설치·실행 영역, 하단의 다운로드 상태를 한 창에서 연결한다. 선택 앱을 바꾸어도 라이브러리와 현재 작업 상태를 계속 볼 수 있어야 한다.
- 첫 행동은 선택한 앱의 설치·실행이다. 설치 여부·버전·진행 상태는 실제 데스크톱 결과를 사용하고, 소개와 새 소식은 그 다음에 배치한다. 가짜 진행률·임의의 다운로드 속도·확인하지 않은 최신 버전 상태를 표시하지 않는다.
- 플랫폼에서 WORLD·사내 메신저를 실행하면 각각의 독립 클라이언트가 열린다. 브라우저 체험 주소를 연 경우에는 체험으로 구분한다. 플랫폼 자체가 세 번째 라이브러리 앱으로 들어가지 않는다.
- 모바일은 손가락 조작과 작은 화면에 맞는 입구를 제공한다. PC와 모바일이 같은 SYNK ID와 제품을 이용한다는 요구를 같은 화면 배치의 강제로 해석하지 않는다.
- 승인한 SYNK 로고·서체·펠트 부품을 유지한다. Steam·PURPLE에서는 앱 관리와 재실행의 구조를 참고하고, 타사 로고·이미지·색·화면을 그대로 복제하지 않는다. 구현·설치·실행·업데이트·계정 연결의 확인 범위는 각각 기록한다.

아래 웹 개발 미리보기의 구현 목록은 이전 단계의 기록이다. 새 PC 런처의 실제 파일·패키지·검증 결과는 [desktop README](../desktop/README.md)를 현황 원문으로 사용한다.

검색·필터·정렬, 라이브러리에 담기·즐겨찾기·컬렉션 두 개, 최근 열기, 새 소식, 다운로드 상태, 앱 상세, 설정 내보내기·초기화를 웹 개발 미리보기에 연결했다. 기능은 [README](../experiences/synk-account/README.md), 확인한 조작과 한계는 [QA 기록](../experiences/synk-account/qa/platform-20261002.json)에 둔다. 브라우저 내보내기는 파일 저장 완료가 미검증이며 데스크톱의 합성 내보내기와 구분한다. 이 화면의 라이브러리와 탐색 설정은 **현재 기기 전용 UI 설정**이다. 서버 계정·여러 기기·SSO 동기화나 유료 상품 보유 권한으로 취급하지 않는다. 설치 상태와 실행 요청은 실제 데스크톱 클라이언트가 확인한 결과로 표시하며, 웹 체험 주소 열기를 설치형 앱 실행으로 기록하지 않는다. 설정 초기화와 계정 삭제·앱 제거·학습 기록 삭제는 별개다. OS별 패키지와 실행 검증의 최신 상태는 [desktop README](../desktop/README.md)를 따른다.

| 참고 자료 | 반영할 범위 |
|---|---|
| [Steam 라이브러리 공식 소개](https://store.steampowered.com/libraryupdate) | 최근 이용·새 소식·컬렉션·앱 상세를 연결하는 탐색 구조 참고 |
| [PURPLE 다운로드 공식 입구](https://purple.plaync.com/download?locale=ko-KR) | PC의 게임 설치·실행 기능과 별도 모바일 앱 입구를 구분하는 참고 링크 |
| [Awwwards의 Zentry](https://www.awwwards.com/sites/zentry) | 제품별 큰 시각 요소의 크기와 배치, 큰 제목의 정보 위계 참고 |

승인한 SYNK 브랜드 키트·펠트·로고·마스코트·기존 제품 화면을 재사용한다. 참고 사이트의 이미지·로고·화면을 복제하지 않는다. Steam 소개의 탐색 구성은 2026-10-02 원문으로 확인했고, Awwwards Zentry 소개 페이지의 큰 시각 요소와 제목은 후속 CUA 브라우저에서 직접 확인했다. PURPLE의 동적 상세 화면이나 참고 서비스 전체의 기능을 실사용 검증한 것은 아니다.

같은 날 사용자의 “이렇게 전부 적용해서 바꿔줄래?”에 따라 아래 장기 운영 기준을 확정하고 **공통 계정·서버 수집·동기화·계정 화면·로그인 소비 경로를 로컬에 구현**했다. 기존 Supabase Auth를 재사용하는 구성이다. 운영 인증 설정 교체, 기존 계정 병합, 운영 DB 마이그레이션·배포와 실제 두 기기의 통합 로그인은 아직 완료하지 않았다. Google 전용 정책이나 신규 인증 업체 계약을 정한 것은 아니다. [구현·검증과 운영 전 확인 사항](SYNK_공통계정_구현검증_20261002.md)을 현황 원문으로 사용한다.

### 장기 운영 기준 — 사용자 적용 요청 반영

1. 이메일·로그인 수단이 바뀌어도 내부 SYNK ID와 학습자 기록을 보존한다. 이메일 일치만으로 별도 계정을 병합하지 않는다.
2. 일반 회원, 학원 소속·교직원 역할, 회사 직원의 메신저 이용 권한, 상품 이용권을 나눈다. 학원 소속 종료가 회원 탈퇴나 기록 삭제로 이어지지 않는다. 회사 권한의 종료는 회사 자료 접근을 차단하되 WORLD 회원 자격과 혼동하지 않는다.
3. 오프라인 전송 대기는 계정에 귀속하고 사건 ID로 중복을 제거한다. 여러 기기의 기록은 원본 사건을 추가하는 방식으로 합친다.
4. 약점이라는 꼬리표 대신 문항·첫 응답·도움·소리 전달·응답 형식과 판단 버전을 보관한다. 추천은 현재 근거에서 다시 계산한다.
5. 이용권은 서버에서 판단한다. 구매 중복, 역순 알림, 환불·만료를 같은 처리 규칙으로 다룬다.
6. 구버전 호환·점진 공개·중단 스위치를 두고, DB와 첨부 객체를 함께 백업해 복원까지 확인한다.
7. AI 요청에는 사용자별 사용 한도와 제한된 재시도, 실패해도 이용 가능한 기본 경로를 둔다.

공통 계정 화면은 플랫폼에서 계정·소속·이용권·연결한 기기·학습 기록 동의·내보내기·삭제 요청을 다룬다. 현재 구현한 내보내기 범위에 메신저 대화·파일이 포함되는 것은 아니다. 로그인 수단 추가/계정 병합, 실제 결제 복원, 영구 삭제의 처리 완료는 별도 운영 절차와 검증이 필요하다.

### 사용자에게 제공할 경험

- 한 번 만든 SYNK 계정으로 설치한 SYNK 플랫폼에 들어와 SYNK WORLD와 이용 권한이 있는 사내 메신저를 각각 설치하고 실행한다. 두 앱의 업데이트와 실행 상태는 따로 관리한다. WORLD 안에서 미니게임·Town·숙제·AI 코칭을 오갈 때 콘텐츠별 가입이나 로그인을 요구하지 않는다. 공통 인증 연결을 마친 앱 사이에서는 기존 인증 세션을 사용할 수 있으면 다시 자격증명을 입력하지 않고 이동한다. 최초 앱 연결·새 기기·세션 만료·보호가 필요한 작업에서는 계정 선택이나 재확인이 있을 수 있다. 한 번 로그인하면 모든 기기에서 영구 로그인되는 의미는 아니다. 현재 사내 메신저의 회사 계정은 유지하며 본인 확인 뒤 SYNK ID를 명시적으로 연결하는 코드를 추가했다. 운영 인증 설정·콜백 등록과 실제 통합 로그인 확인은 아직 완료하지 않았다.
- 학습 기록 연결 범위를 설정한 뒤에는 해당 범위의 앱·게임이 같은 계정의 최신 학습 근거를 복원한다. 매 게임마다 학습 목표와 도움 선호를 다시 입력하게 하지 않는다. 각 게임의 문항 형식과 실제 관측 조건은 그대로 보존한다.
- 계정 화면에서 프로필·로그인 수단·학습 기록 연결·기기 세션을 관리한다. 이 앱의 로그아웃과 모든 기기의 로그아웃을 구별한다. 같은 기기를 다른 사람이 사용할 때 이전 사람의 학습 기록을 표시하지 않는다.
- 구매·구독·학생 자격·혜택은 같은 계정에서 확인하되 상품별 이용권을 유지한다. 한 로그인은 모든 상품의 무료 이용이나 게임 간 재화 통합을 뜻하지 않는다. Town의 학습 해금·정액제·선택 상품 조건은 기존 정본을 유지한다.

### 공통 구조와 책임

```text
로그인 수단 → 공통 인증 서비스 → 내부 SYNK ID
                                  └─ SYNK 플랫폼 · 설치형 런처와 계정 관리
                                         ├─ 1. SYNK 사내 메신저 · 독립 클라이언트
                                         │      └─ 대화 · 파일 · 업무 공간
                                         └─ 2. SYNK WORLD · 독립 클라이언트
                                                ├─ 미니게임
                                                ├─ SYNK TOWN
                                                ├─ 숙제
                                                ├─ AI 코칭
                                                └─ 기타 WORLD 기능

SYNK ID에 연결: 공통 프로필 / 허용된 학습 기록 / 콘텐츠별 저장 / 이용권·혜택
각 클라이언트가 관리: 자신의 설치 / 실행 / 업데이트 / 세션 / 서비스별 권한
Atlas가 읽는 것: 서버가 범위와 출처를 확인한 학습 근거
```

| 대상 | 처음부터 정할 기준 |
|---|---|
| 사람의 기준 | 내부의 안정적인 `synk_user_id`를 사용한다. 이메일·별명·기기 키를 기본키로 삼지 않는다. 기존 학생번호·`learner_id`·회원 키는 확인된 연결 관계로 보존하며 일괄 교체하지 않는다 |
| 인증 연결 | 검증된 OIDC 인증 서비스를 공통 기반으로 사용하고 플랫폼·각 앱의 실행 환경에 필요한 클라이언트를 등록한다. 인증 클라이언트 수를 제품 수로 세지 않는다. WORLD 내부 콘텐츠마다 별도 로그인 클라이언트를 만드는 것을 기본값으로 삼지 않는다. 외부 제공자의 검증된 식별자를 내부 ID에 연결한다. 제공자가 앱마다 다른 식별자를 줄 수 있으므로 동일 이메일이나 서로 다른 앱의 `sub` 비교만으로 계정을 자동 병합하지 않는다 |
| 앱 세션 | 각 앱은 자신의 세션과 권한을 가진다. 다른 앱으로 이동할 때 공통 인증 세션을 활용해 목적 앱의 세션을 발급한다. 앱 간 장기 토큰 복사·URL 전달·동일 쿠키 도메인 강제로 통합하지 않는다 |
| 인증과 권한 | 서버가 계정과 학습자 연결, 서비스 범위, 콘텐츠 이용권을 확인한다. 사내 메신저는 별도로 확인된 회사 직원 권한을 요구한다. 학원 교직원 역할을 회사 직원 권한으로 자동 승격하지 않는다. 클라이언트가 보낸 학생번호만으로 소유권을 인정하지 않으며 로그인 성공으로 교사·관리자 권한을 만들지 않는다 |
| 학습 기록 | 계정 범위의 공통 사건 저장·검증·중복 제외·오프라인 재전송·요약 복원을 별도 구현한다. 기존 도움 선호 API에 수행 payload를 임의 삽입하지 않는다. Atlas는 인증이나 비밀번호를 관리하지 않는다 |
| 콘텐츠 상태 | 게임 진행·재화·NPC 관계는 콘텐츠별로 저장하되 같은 계정으로 복원한다. 로그인 통합을 이유로 서로 다른 게임의 진행 상태나 사업별 비공개 자료를 섞지 않는다. 사내 메신저 대화·파일을 WORLD 학습 자료로 자동 수집하거나 WORLD 학습 원본을 회사 직원에게 자동 공개하지 않는다 |
| 로컬 체험 | 로그인 전 기기 기록은 임시 체험이다. 공유 기기일 수 있으므로 로그인 즉시 해당 사람에게 자동 귀속하지 않는다. 본인 확인과 명시적 가져오기, 충돌·중복 처리 후 연결한다 |

네이티브 앱은 시스템 브라우저/플랫폼 인증 세션을 통한 Authorization Code + PKCE를 기본 구현안으로 둔다. ID 토큰의 발급자·서명·대상·만료·요청 연결을 서버에서 검증하며 ID 토큰을 임의의 서비스 API 이용권으로 취급하지 않는다. 인증 서비스의 계정 복구·세션 만료·취소 기능을 재사용하고 자체 비밀번호/SSO 프로토콜을 새로 만들지 않는다.

기술 근거(2026-10-02 재확인): [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html), [네이티브 앱 OAuth·SSO·PKCE 표준 RFC 8252](https://www.rfc-editor.org/rfc/rfc8252), [Google 계정 식별자 지침](https://developers.google.com/identity/openid-connect/openid-connect). 이는 업체 선정이나 현 서비스의 설정 완료가 아니다.

### 첫 구현 순서와 완료 판정

**2026-10-02 구현 전 출발점 확인:** 당시 `SYNK-talk/src/인증API.js`는 학생/직원 번호를 합성 이메일로 변환해 Supabase의 password/refresh 인증을 사용한다. 일반 온라인 회원 가입·Google/OAuth 소비 경로와 공통 SYNK ID 연결은 주작업본에서 확인하지 못했다. `SYNK-talk/supabase/L0_스키마.sql`의 학습 기록은 `learner_id`를 기준으로 하고 `auth_user_id`로 인증 계정과 연결되며 `student_code`가 필수다. 직원의 `staff_id`·역할·활성/폐기 상태는 별도다. 이는 소스·스키마 확인이며 현재 운영 DB나 실계정 접속 결과가 아니다.

따라서 일반 **SYNK 회원**과 선택적인 **학습자 프로필·학원 소속·직원 역할**을 구분한다. 온라인 회원을 받기 위해 가짜 학생번호를 만들지 않는다. 현재 Supabase 인증 기반을 재사용할 수 있는지 먼저 검토하며, ‘업체 미선정’은 기존 인증이 없다는 뜻이 아니라 공통 SSO의 최종 구성/설정을 아직 결정하지 않았다는 뜻이다. 기존 계정·학습자 키를 버리거나 의미가 겹치는 계정 시스템을 별도로 복제하지 않는다.

1. **기존 계정 보존과 공통 ID 연결:** 현재 오프라인/온라인 학생 인증·역할·기록 참조를 확인하고, 본인 확인을 거친 내부 ID 연결 및 중복/복구 규칙을 구현한다. 기존 학생에게 새 계정 생성을 강요하거나 기록을 초기화하지 않는다.
2. **설치형 플랫폼과 두 독립 클라이언트 연결:** 플랫폼에서 사내 메신저와 WORLD의 설치·실행·업데이트 상태를 구분하고, 공통 인증 서비스와 필요한 실행 클라이언트를 연결한다. 웹 미리보기와 실제 설치형 런처의 완료를 구별하며 로그인·전환·만료·로그아웃과 다른 계정 격리를 확인한다. 기존 메신저 계정은 본인 확인을 거쳐 SYNK ID에 연결하고 회사 직원 권한을 별도로 검증한다. 이메일 일치나 학원 교직원 역할만으로 자동 연결·입장시키지 않는다.
3. **WORLD 내부 학습 기록을 실제로 이어 쓰기:** WORLD 안의 미니게임 하나에서 수행 사건을 서버에 저장하고, WORLD의 숙제·AI 코칭·다음 학습 추천에서 필요한 근거를 소비하는지 확인한다. 다른 기기에서도 같은 WORLD 기록을 복원한다. 그 계약으로 나머지 게임과 Town 장면을 연결하고, 플랫폼에는 해당 제품이 필요로 하는 계정·권한·허용된 요약만 제공한다.

완료 조건은 같은 계정으로 제품 간 이동, 인증한 두 실기기에서 기록 복원·추천 반영, 오프라인 재전송의 중복 제외, 계정 전환 시 이전 기록 차단, 토큰 만료/취소·모든 기기 로그아웃, 기존 학생 기록·상품 권한 보존이다. 토큰 발급 성공이나 로컬 공통 저장만으로 통합 완료라고 하지 않는다.

구현 전 출발점은 미니게임의 같은 origin 기기 기록과 WORLD의 계정별 로컬 맞춤 읽기 기록이었다. 후속으로 인증된 계정 호스트·수행 사건 API·오프라인 전송을 연결한 코드를 만들었다. 단독 체험의 기기 기록은 그대로 분리하며 자동 이관하지 않는다. 현 개인화 범위는 [미니게임 공통 기준 §9](미니게임_TOPIK_I_학습기준.md#9-실제-개인화-연결--2026-10-02-후속-구현), 계정 통합 검증은 [구현 기록](SYNK_공통계정_구현검증_20261002.md)에 있다. 아래 09-21·09-28 기록의 이름과 필요한 정보만 공유하는 경계는 유지한다. 제품 계층과 개발 순서는 이번 후속 요청이 우선한다.

현재 미니게임의 개별 폴더·로컬 주소는 제작/검증을 위한 분리다. 이를 사용자용 독립 제품이나 별도 계정으로 해석하지 않는다.

## 2026-09-28 명칭과 제품 구분 — 사용자 확정

**이력:** 아래는 당시 명칭을 정한 기록이다. 현재 제품 계층은 위 2026-10-02 후속 요청의 ‘SYNK 플랫폼 안에 사내 메신저와 WORLD’가 우선한다.

앱 이름은 **SYNK WORLD**로 정했다. 브랜드 플랫폼은 같은 날 후속 요청에 따라 당분간 **SYNK 플랫폼**으로 칭한다. 사용자는 “엔진이랑 … 헷갈릴수도있을것같아서 일단은 SYNK플렛폼 이라고 칭하자”라고 정정했다. 브랜드 플랫폼의 최종 고유 이름은 보류한다.

| 이름 | 역할 |
|---|---|
| **SYNK WORLD** | 미니게임·SYNK TOWN·숙제·AI 코칭·이야기 등 학습과 경험을 포함하는 앱 |
| **SYNK TOWN · 싱크 타운** | SYNK WORLD 안의 생활·주민 소통 중심 콘텐츠. 메인 학습·미니게임에서 익힌 한국어로 생활하고 집·가게·관계·이야기를 발전시킨다. TOPIK 1급+ 통과 후 해금하며 아주 쉬운 말부터 시작한다. 2026-10-01 사용자 명칭 확정. [담당 설계](마을_설계.md) |
| **SYNK 플랫폼** | SYNK의 여러 제품·콘텐츠와 계정·기록·혜택을 연결하는 별도 브랜드 플랫폼의 현재 호칭. PURPLE은 참고 모델 |
| **SYNK ID** | 두 제품과 필요한 서비스에서 같은 사람을 연결하는 공통 계정 기준 |

당시에는 SYNK WORLD와 SYNK 플랫폼을 각각 만드는 제품으로 구분했다. 이후 2026-10-02 요청으로 플랫폼은 사내 메신저와 WORLD의 독립 클라이언트를 관리하는 설치형 런처로 명확해졌다. 이전 문서의 ‘기존 앱에 공통 홈부터’라는 단계는 초기 구현 접근의 이력이다. 공통 인증·계정 기반을 재사용하며 플랫폼과 두 클라이언트의 실행 환경·배포 단위·세션은 구분한다. 플랫폼의 앱 목록에 플랫폼 자신을 세 번째 앱으로 넣지 않는다.

**2026-09-15 사용자 계획 이력**(2026-10-03 [제품 방향](제품방향.md)에서 옮김): 홈페이지에서는 앱을 **SYNK WORLD**로 소개하며, **교수님께 편지 쓰기**는 그 앱의 일부 기능이다. 당시 체험 상세의 **2027년 1월 Google Play·App Store 출시 예정**은 과거 목표이고 현재 확정 출시일이 아니다. 앱 명칭과 학습 개발 방향은 유지하며, 출시·운영 연결은 위 2026-10-02의 MVP 이후 조건과 실제 스토어 제출/인수를 따른다. 공개 화면(synk.im/try/letter/ 아래쪽 안내)에 남아 있던 이 날짜는 2026-10-03에 지웠다(synk-policy `b4105b2`, 원본 SYNK-website `622a7be`, 공개 주소의 바이트로 반영 확인).

기존 기술 문서의 **Atlas(아틀라스)**는 여덟 엔진을 통합하는 시스템을 뜻한다. 브랜드 플랫폼에는 Atlas라는 이름을 사용하지 않고 **SYNK 플랫폼**으로 구분한다. 기존 엔진·API·저장소 이름은 유지한다.

오프라인 포토부스는 SYNK 플랫폼의 계정과 LAB 학생 자격에 연결한 혜택으로 설계한다. SYNK WORLD에서도 같은 이용권을 바로 열 수 있게 하는 것은 사용 편의를 위한 제안이며, 별도 이용권을 중복 발급하지 않는다. 상세는 [포토부스 설계](포토부스_설계.md)를 따른다. 이번 정리는 현재 호칭·제품 구분이며 플랫폼·로그인·장비 연동이 구현되었다는 뜻은 아니다.

---

2026-09-21 사용자가 앞선 개인화 제안을 승인하며 “꼭 기억해줘. 장기적으로 이렇게 하는걸 기획하자”라고 요청했다. 이 문서는 그 방향을 기록한다. **SYNK ID를 중심으로 여러 콘텐츠의 장기 기억과 개인화를 연결하는 전체 시스템은 아직 완성되지 않았다.** 처음에는 계획만 정리했으며, 같은 날 후속 개발 요청으로 [편지 연습 도움 방식의 첫 지속 연결](아틀라스_첫지속기억_20260921.md)을 로컬에 구현·검증했다. 후속으로 서류 관문까지 연결하고 리허설 DB 검증·사용자의 Android 브라우저 조작 확인을 마쳤다. 운영 배포와 로그인한 두 실기기의 계정 기억 왕복은 아직 전이다.

## 1. 승인한 장기 방향

개인화와 학습 설계를 게임마다 따로 쌓는 데 그치지 않고 **Atlas 자체의 공통 능력으로 발전시킨다.** 각 콘텐츠는 실제 활동과 결과를 전달하고 Atlas가 판단한 도움을 그 콘텐츠에 맞는 장면·대화·행동으로 표현한다. 회사가 재사용할 자산은 공통 엔진의 능력, 콘텐츠와 연결하는 계약, 실제로 도움이 됐다는 검증 근거다.

같은 날 후속 요청으로 이를 **지금부터의 개발 방식**으로 준비했다. 공통 운영 원칙과 [Atlas 구조 정본 §1-1](아틀라스_설계.md#1-1-콘텐츠를-만들며-공통-엔진을-발전시키는-개발-방식)에 요청 → 담당 엔진의 공통 능력 발전 → 콘텐츠 적용 → 재사용 확인 순서를 명시하고, [구현 명세 §9-1](아틀라스_구현명세.md#9-1-새-콘텐츠-요청을-엔진-발전으로-연결하기)에 기존 WP와 연결한 준비 과제·첫 NPC 사례를 넣었다. 개발 방식은 확정, 첫 사례의 세부 범위는 제안이며 실제 엔진 기능은 이번 문서 변경으로 추가되지 않았다.

- 사용자가 고른 목표와 취향, 근거 있는 학습 수행, 도움에 대한 반응을 이어서 활용한다. 추천뿐 아니라 설명 길이·힌트·난도·대화 방식이 바뀌어야 한다.
- 행동을 곧바로 고정된 성격으로 단정하지 않는다. 직접 밝힌 선호, 관측 사실, 추정은 구분하며 근거·시점·적용 범위를 둔다.
- ‘SYNK가 기억하는 나’에서 본인이 내용을 확인·수정·삭제하고 다른 콘텐츠에서 이어 쓸 범위를 선택할 수 있게 한다.
- 개인의 작품과 성취를 간직할 공간을 마련한다. 첫 정원, 직접 만든 가게, 혼자 해낸 한국어 대화 등을 본인이 원할 때 다시 보고 연결한다.
- 익숙한 추천과 새로운 활동을 함께 열어 둔다. 한국어 실력이 늘거나 목표가 바뀌면 한국어로 즐기는 이야기·문화·관계로 자연스럽게 이어지게 한다.
- 사용자 정보뿐 아니라 콘텐츠의 학습 목표·필요 시간·난도·혼자 가능한지·재미의 종류를 정리한다. 클릭률만으로 적합성과 학습 효과를 판단하지 않는다.

예를 들어 사용자가 꾸미기를 좋아한다고 직접 선택했고 짧은 한국어 주문은 혼자 이해하며 긴 문장은 다시 듣기를 선호한다면, 허용된 다음 콘텐츠에서도 짧은 안내·다시 듣기·관련 첫 활동을 제공할 수 있다. 공개 칭찬을 부담스러워한다고 밝힌 경우에는 성취를 개인 메시지로 전달한다. 이것은 목표 경험이며 현재 동작을 보고한 것이 아니다.

## 2. 기억의 범위

| 구분 | 예시 | 연결 방식 |
|---|---|---|
| 여러 콘텐츠에 이어 쓸 후보 | 확인된 도움 언어, 학습 목표, 근거 있는 한국어 수행, 직접 선택한 취향과 안내 선호 | 해당 콘텐츠에 필요한 정보만, 본인이 허용한 범위에서 사용 |
| 해당 게임 안의 상태 | 특정 NPC와의 관계, 작물 상태, 재화, 제작 대기열 | 게임의 규칙과 이야기 안에서 관리. 다른 게임에 자동 복제하지 않음 |
| 최근 상황 | 오늘 가능한 시간, 지금 소리를 들을 수 있는지, 최근 관심 활동 | 유효기간을 두거나 다시 확인. 영구 취향으로 굳히지 않음 |

공통 SYNK ID는 같은 계정임을 연결하는 기준이며 모든 데이터를 함께 읽을 권한이 아니다. [Atlas 정본](아틀라스_설계.md)의 사업별 적용 범위와 원본·프로필 자동 공유 금지를 유지한다. LAB에서 유용함을 확인했다고 SHIFT·PULSE 등 다른 사업에 추적이나 개인화가 자동 적용되는 것은 아니다.

NPC의 인지도 별도로 제한한다. 물건을 받은 NPC는 그 물건을, 집을 방문한 NPC는 그 공간을 알 수 있다. 만나지 않은 NPC가 비공개 활동을 모두 아는 식으로 표현하지 않는다. 세계를 넘는 연결은 공통 마스코트나 개인 기록 공간이 맡을 수 있다. [NPC 성과 인정 설계](디자인/마을_NPC_성과인정_설계_20260921.md)의 실제 성과·개인 기여·전달 선호·이미 전달한 반응을 함께 본다.

기록 수정·삭제·공유 해제는 원본 화면에만 반영하는 것으로 끝내지 않고, 이후 판단에 쓰는 파생 정보와 캐시까지 일관되게 반영하도록 설계해야 한다. 구체 보관 정책과 구현 계약은 후속 작업이다.

## 3. Google 로그인과 SYNK 계정 — 이번에 확인한 구현 가능성과 제안

**Google 로그인으로 이 방향을 구현할 수 있다.** Google이 본인 인증을 담당하고, SYNK가 내부 계정과 기억·콘텐츠 권한을 연결한다. 사용자에게 별도의 SYNK 비밀번호를 만들게 할 필요는 없다.

```text
Google 등 로그인 제공자 → SYNK 서버의 인증 확인 → 내부 SYNK ID
                                                   │
                                     계정 설정·콘텐츠별 허용 범위
                                                   │
                                      Atlas의 지속 기록과 판단
                                                   │
                                  마을·학습·다음 콘텐츠의 맞춤 경험
```

이는 장기 구조 제안이다. 현재 서비스의 인증 설정을 교체하거나 특정 인증·DB 업체를 선정한 것이 아니다.

- Google 공식 지침에 따라 서버가 토큰의 서명·발급자·대상 앱·만료를 검증한다. 검증된 제공자 식별자와 `sub`를 내부의 안정적인 `synk_user_id`에 연결하는 방식을 권한다. 이메일 주소를 영구 식별 기준으로 쓰지 않는다.
- 같은 Google 계정으로 여러 앱에 로그인하는 것만으로 기억이 자동으로 합쳐지지는 않는다. 각 앱이 공통 계정 기반을 사용하고 필요한 정보만 요청하도록 연결해야 한다.
- 나중에 다른 로그인 수단을 추가해도 본인이 확인한 계정 연결을 통해 같은 SYNK ID를 유지할 수 있게 한다. 이메일이 같다는 이유만으로 학습·구매 기록을 임의 병합하지 않는다.
- Google 로그인은 SYNK의 개인화 기록을 자동 저장하는 기능이 아니며 Gmail·검색 기록 등의 접근을 자동 허용하지도 않는다.

공식 근거: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Google ID 토큰 검증](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [Firebase의 여러 인증 제공자 연결 예시](https://firebase.google.com/docs/auth/web/account-linking). 2026-09-21 확인. Firebase 채택을 결정한 것은 아니다.

## 4. 브랜드 플랫폼을 만드는 순서 — 사용자 승인

2026-09-21 후속 대화에서 사용자가 다음 세 단계를 다시 제시하며 “이 방향도 꼭 기억해줘. 내가 만약에 할 일을 못찾으면 이거 진행해주면 돼”라고 요청했다. 아래는 당시 승인 순서의 이력이다. **2026-10-02 설치형 플랫폼·WORLD/사내 메신저 독립 클라이언트 요청이 런처의 착수 순서에 우선한다.** 특정 인증·DB 업체, 상점 상품이나 출시일이 정해진 것은 아니다.

1. **첫 단계:** 기존 앱 안에 SYNK 홈·공통 계정·내 기록·콘텐츠 입구를 만든다.
2. **다음 단계:** 실제 콘텐츠 두 개에서 기억과 도움이 이어지는지 확인한다.
3. **확장 단계:** PC 게임이 늘고 설치·업데이트 관리가 필요해지면 전용 런처를 붙인다. 자체 상점이나 큰 커뮤니티도 필요에 맞춰 확장한다.

**다음 작업을 고르는 기준:** 사용자가 할 일을 찾지 못하거나 다음 작업을 맡기고 별도 우선 과제가 없으면, 이 로드맵의 현재 실물과 진행 기록을 확인해 다음 미완료 작업부터 진행한다. 같은 방향을 처음부터 다시 제안하거나 이미 끝낸 단계를 반복하지 않는다. 현재 사용자가 지정한 다른 작업은 우선한다. 이번 요청은 기준을 저장하는 것이며 예약 실행·상시 감시를 뜻하지 않는다.

첫 단계의 기반에는 기존 계정·장부와 Atlas를 연결하는 최소 지속 기억을 둔다. 다음 날·다른 기기로 돌아와도 필요한 도움과 기억이 이어지고, 정정·삭제가 이후 판단에 반영되는지를 작은 경험 하나에서 먼저 확인한다. 상세 작업은 [구현 명세 §9-1](아틀라스_구현명세.md#9-1-새-콘텐츠-요청을-엔진-발전으로-연결하기)의 기존 WP를 활용한다. 전체 플랫폼이나 최종 그래픽이 완성될 때까지 기억 연결을 미루지 않는 것이 앞선 구현 순서의 제안이다.

두 번째 단계에서는 실제 두 콘텐츠로 재설정 부담과 도움의 적합성을 확인한다. 연결을 원치 않는 경우도 정상 이용할 수 있게 하고, 유용함이 확인된 공통 정보만 허용 범위 안에서 이어 쓴다. 관계없는 기록을 모두 섞지 않는다.

당시 세 번째 단계는 PC 게임 수와 설치·업데이트 관리의 실제 필요를 보고 시작하는 계획이었다. 2026-10-02에는 사용자가 설치형 플랫폼과 독립 클라이언트 구성을 직접 요청했으므로 런처 준비를 더 이상 그 조건까지 미루지 않는다. 상점 상품·결제·대규모 커뮤니티의 출시를 함께 확정한 것은 아니다. 앞선 순서를 승인받은 뒤 G1 편지 연습과 G4 서류 관문의 도움 방식 연결을 구현하고 리허설 DB·합성 화면을 확인했다. 실제 계정의 기기 간 연결과 설치형 런처·클라이언트 배포/업데이트 검증은 아직 남아 있다.

**2026-10-03 갱신:** G1~G4는 talk 정리에서 지웠다([정리 목록 §3](_ops/옛시스템_정리목록_20261002.md)). 두 번째 단계의 기억·도움 연결은 이제 특정 두 게임이 아니라 공통 SYNK 계정과 Atlas 학습 기록이 맡는다. 고른 도움 방식·화면 설정·게임마다의 순간 맞춤이 계정에 저장되고(`atlas/memory-sync.js`), 운영에서 학습 기록 저장이 켜져 있으며, 다른 SYNK 앱은 계정 요약(`atlas/account-summary.js`)을 읽는다. 이 단계의 다음 일은 앱 0.2.0+ 출시 뒤 실기기 두 대로 같은 계정의 기록이 오가는지 확인하는 것이다([트랙 §3](_ops/트랙.md)).

## 5. 현재 상태와 후속 구현 경계

2026-09-21 첫 개발 이후 `atlas/engine.js`는 여전히 네트워크·모델 호출 없는 공통 판단 코어다. 새 `atlas/preferences.js`가 저장 선언·복원 계약을 공유하고 talk의 기존 계정·사건 장부와 연결한다. `lib/atlas-session.js`의 세션 `Map`은 유지하되 명시적 도움 방식만 인증된 서버 응답으로 복원한다. G1 편지 연습과 G4 서류 관문의 저장·복원·정정·기본값 복귀·계정 분리를 구현하고, 사용자가 선택한 편지 도움 방식을 서류 관문에 한 번 가져오는 기능도 연결했다. **관련 로컬 시험·실제 리허설 DB 검증·PC 합성 화면 검증과 사용자의 Android 브라우저 조작 확인을 마쳤다. 합성 화면은 계정 저장을 사용하지 않으며, 운영 배포·실제 계정의 기기 간 기억 연결·전체 장기 학습 기억은 아직 남아 있다.** 범위·시험·배포 준비는 [첫 연결 구현 기록](아틀라스_첫지속기억_20260921.md)에 둔다.

2026-10-03: 위 G1·G4 연결은 게임과 함께 지웠다. 지금 계정의 기억 저장·복원은 talk `synk-account`·`synk-learning`과 `atlas/memory-sync.js`가 맡고, 계정을 지우면 이 기록도 지운다.

첫 연결은 기존 학습 장부와 계정 체계를 대조해 저장·접근 범위·중복 처리·정정과 기본값 복귀 계약을 구현했다. 콘텐츠별 도움 방식은 따로 보관하고, 두 콘텐츠 사이의 한 번 가져오기는 사용자가 직접 선택할 때만 처리한다. 원본 기록의 물리 삭제·다른 콘텐츠로의 추가 확장·공통 장기 기억의 공유 허용은 후속 범위다. 게임 사실은 게임이 확인하고, 기억 저장과 권한 확인은 서버가 맡으며, Atlas는 허용된 근거로 판단한다. 모든 사용자 식별자나 원본 대화를 판단 코어에 직접 넣는 구조로 바꾸지 않는다.

매 행동을 AI로 해석할 필요는 없다. 설정·수행 사실의 기록과 기본 반응은 일반 로직과 준비된 콘텐츠로 처리하고, 중요한 관계 대화와 필요한 추천 설명에 제한된 AI 호출을 사용한다. 학습 효과·사용자 편의·다시 이용하는 이유·비용은 구현 후 각각 확인한다.


## 2026-10-02 첫 이용 개인화 — 전사 공통, 맥락별 분리

정식 가입 후에는 필수 계정 절차와 별도로 선택 가능한 맞춤 설정을 제공한다. 공통으로 목적·가용 시간·원하는 도움·읽기 편한 표현을 받고, 학생은 학습 목적·소리 환경, 교사는 수업 형태·수업/준비 시간·원하는 수업 지원을 추가로 고를 수 있다. 답변을 저장하기 전에 사용 목적과 적용 범위를 알린다. 건너뛰기·수정·끄기·삭제를 제공하며 미선택 항목을 본인 답변으로 저장하지 않는다.

한 SYNK ID는 같은 사람을 연결하는 기준이다. 개인화는 `personId × productId × contextId × domain`으로 분리하고 기관·반·교사 권한은 서버에서 별도로 검증한다. 학생·교사·회사 직원·고객 역할을 통합 로그인만으로 자동 부여하거나 학습·회사 기록을 합치지 않는다. 사업별 기본 권한을 넘는 공유는 목적과 허용 자료를 명확히 확인해야 한다.

공통 선택 계약은 Core의 [personalization.js](../atlas/personalization.js), 제품별 설명과 적용은 [전사용자 개인화 기반](SYNK_전사용자_개인화_기반_20261002.md)에 둔다. Core의 `SYNK` 도메인은 플랫폼 공통 맥락을 위한 것으로 기존 인증 서버의 등록 앱·권한을 늘리지 않는다.

현재 구현은 **플랫폼 기기의 선택 설정과 교사 MVP 합성 계정의 첫 이용 설정**이다. 교사 수업안·과제 안내, 학생의 연습 방법·화면, 플랫폼 라이브러리 추천에 실제 반영한다. 운영 가입·중앙 프로필 저장·실제 계정의 다른 기기 동기화는 사용자 결정대로 MVP 이후 연결한다.
