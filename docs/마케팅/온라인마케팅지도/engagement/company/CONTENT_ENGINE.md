# 회사 콘텐츠 기획 엔진

2026-09-27 · 로컬 회사 프로그램에 구현. 실제 게시나 성과 보장을 수행하지 않는다.

## 현재 운영 방식 · 관리자 조사 후 직원이 활용

2026-09-27 후속 요청으로 **관리자가 기존 Google AI Pro에서 직접 조사한 결과를 회사 프로그램에 업로드**하는 방식으로 정리했다. 직원은 회사 계정으로 보고서를 보고 기획한다. 직원이 참고 자료를 보거나 구성안을 작성할 때 Google·Exa API나 관리자 Pro 계정을 호출하지 않는다.

관리자는 **콘텐츠 기획 → 벤치마크 TOP 5 → 조사 자료 업데이트**에서 조사 지시문을 복사한다. Gemini에서 조사한 JSON 파일을 올리거나 본문을 붙여 넣고, 원문·날짜·반응을 대조한 뒤 미리보기에서 회사 공유를 실행한다. 이전 조사본과 그 자료를 참조한 기획안은 보존한다. 등록 자료가 없으면 빈 상태로 표시하며 예시 자료를 실제 TOP 5로 채우지 않는다.

Google AI Pro는 관리자가 Gemini에서 조사할 때만 이용한다. 회사 프로그램은 조사 결과의 저장·공유·양식 기반 구성안·검토 질문을 제공한다. Google 자동 로그인·주기적 자동 조사·생성 모델 연결은 구현하지 않았다. [조사 지시문과 사용법](BENCHMARK_RESEARCH_PROMPT.md), [작성용 JSON](benchmark-upload-template.json).

## 역할과 자료

- `content-catalog.json`: 제작 기준과 시리즈의 출처·구조.
- `content-engine.mjs`: 같은 입력에서 같은 세 가지 기획안을 만드는 가이드 기반 엔진. 외부 생성 모델을 호출하지 않는다. 입력되지 않은 경험·성과·수치를 만들지 않으며 근거를 입력한 것과 검증한 것을 구분한다.
- `content-service.mjs`: 기획안 저장, 권한, 참고 자료, 선택적 검색 API 연결.
- `benchmarks.mjs`: 관리자 조사 보고서의 형식·날짜·근거 검사, 회사 공개와 이전 조사본 보존. 외부 API를 호출하지 않는다.
- `public/content.js`, `public/content.css`: 기획 작업 화면.
- `public/benchmark.js`, `public/benchmark.css`: 공용 벤치마크·관리자 업로드·네 가지 검토 기준 화면.
- 저장 종류: `contentDrafts`, `contentReferences`, `contentBenchmarkIssues`. 검색 후보는 자동 저장되지 않는다.

벤치마크 선택 또는 내 소재로 시작 → 시리즈·시청자·경험과 근거·정보·재미 입력 → 개인화·진정성 점검 → 세 가지 구성안 비교 → 선택·상태 저장 → Markdown 내보내기 순서다. `draft`, `review`, `ready`, `archived`는 기획 검토 상태이며 실제 발행 상태가 아니다.

`authenticity` 입력은 `basis`, `ownPerspective`, `limits`, `disclosure` 네 문자열이다. 각 2,000자 이하이며 결과의 `plan.authenticity`에 점검 항목과 요약이 표시된다. 입력 여부를 자동 진정성 점수나 사실 검증으로 제시하지 않는다.

`personalization`은 시청자의 상황 `situation`, 자기 상황에 맞게 고를 도움 `choice`, 다음 행동 `nextStep`을 받는다. 각 내용은 도입·중간 선택 장면·엔딩에 반영한다. `plan.reviewAxes`는 재미·도움·진정성·개인화 네 축의 작성 근거·검토 질문·다음 행동을 반환한다. 상태는 `needs-input`(보완 필요) 또는 `review`(직접 검토)이며 자동 합격·점수는 없다.

## 권한

| 사용자 | 조회·수정 |
| --- | --- |
| 관리자 | 회사 전체 기획안과 참고 자료 |
| 직원 | 자신이 작성한 기획안·참고 자료 |
| 팀장 | 자신의 자료 + 명시적으로 채널을 지정했고 현재 그 채널이 같은 팀인 자료 |
| 열람자 | 자신의 자료 + 같은 팀 채널에 명시적으로 연결된 자료 조회. 생성·수정·검색 실행 불가 |

채널을 지정하지 않은 자료는 관리자와 작성자에게만 공개된다. 채널 지정은 경험·근거가 포함된 전체 기획안의 팀 공유를 뜻한다. 팀 이동 후 권한은 현재 채널 팀을 기준으로 즉시 재검사한다. 같은 채널의 다른 일반 직원에게 자동으로 개인 자료를 공개하지 않는다. 계정 비활성화·세션 취소와 비동기 검색 중 담당 변경도 검사한다.

관리자가 검토하여 게시한 **회사 벤치마크 보고서**는 활성 회사 계정 모두에게 공개된다. 열람자도 보고서와 이전 조사본을 읽을 수 있다. 보고서 미리보기·등록·조사 프롬프트·작성 템플릿은 관리자만 접근한다. 공유 벤치마크로 만든 직원의 기획안은 기존 개인·팀 공개 규칙을 따르며 자동으로 회사 전체에 공유되지 않는다.

## API 계약

모든 API는 로그인 필요. POST는 기존 Origin·CSRF 검사와 열람자 쓰기 제한을 적용한다.

| 경로 | 입력 / 응답 |
| --- | --- |
| GET `/api/content-workspace` | `{catalog,drafts,references,search:{provider,configured,notice},benchmark:{current,history}}` |
| GET `/api/content-drafts/:id` | 권한 검사 후 `{draft}` 전체 상세 |
| POST `/api/content-generate` | `{seriesId,topic,audience?,experience?,proof?,takeaway?,entertainment?,authenticity?,personalization?,referenceId?,channelId?,benchmarkId?,benchmarkItemId?}` → `{draft}` |
| POST `/api/content-drafts/:id` | `{title?,status?,selectedIdeaId?}` → `{draft}` |
| GET `/api/content-drafts/:id/export` | 권한 검사 후 `text/markdown`, 다운로드 첨부 |
| POST `/api/content-references` | `{url,title,creator?,publishedAt?,checkedAt?,metrics?,formatNotes?,channelId?}` → `{reference}` |
| POST `/api/content-search` | `{query,days?:1..30,localOnly?:boolean}` → `{results,links,notice,mode,checkedAt,days}`. `localOnly:true`이면 키가 있어도 외부 API 호출 없음 |
| POST `/api/content-search-settings` | 관리자만 `{apiKey}` → `{search}`. 빈 문자열은 연결 해제 |
| POST `/api/content-benchmarks/preview` | 관리자만 `{report:object 또는 JSON문자열}` → `{report:정규화된 보고서,warnings}`. 저장하지 않음 |
| POST `/api/content-benchmarks` | 관리자만 `{report,reviewConfirmed:true}` → `{issue,warnings}`. 회사 전체 공유·이전 호 보존 |
| GET `/api/content-benchmarks/:id` | 모든 활성 회사 계정 `{issue}` |
| GET `/api/content-benchmarks/research-prompt` | 관리자만 `{prompt}`. 문서의 프롬프트 START/END 사이 복사용 본문 |
| GET `/api/content-benchmarks/template` | 관리자만 `{template}`. 빈 작성용 JSON, 실제 보고서로 등록 불가 |

Draft는 `{id,title,ownerId,ownerName,channelId,referenceId,status,createdAt,updatedAt,selectedIdeaId,input,plan}`. 입력한 소유자나 계획 객체로 서버 생성 자료를 덮어쓸 수 없다. 선택한 아이디어는 해당 기획안에 실제 포함된 ID만 허용한다. 개인별 기획안·참고 자료는 각각 최대 500개.

작업 공간의 `drafts` 목록은 `{id,title,ownerId,ownerName,channelId,status,createdAt,updatedAt,selectedIdeaId,seriesId}` 요약만 반환한다. SQLite에서 요약 필드만 선택하므로 목록을 열 때 모든 기획 본문을 서버 메모리에 파싱하거나 클라이언트에 전송하지 않는다. `input`과 `plan`은 사용자가 해당 기획안을 열 때 상세 API로 받는다. 생성·수정 응답은 기존처럼 전체 기획안이다. 참고 자료와 요약 목록은 현재 전체 목록이며 향후 규모가 커지면 별도 페이지 나누기가 필요하다.

### 관리자가 조사하고 회사에 공유하는 벤치마크

관리자는 `BENCHMARK_RESEARCH_PROMPT.md`의 프롬프트를 자신의 Google AI Pro 환경 등에서 직접 실행하고 원문과 수치를 검토한 뒤 JSON을 업로드한다. 이 회사 프로그램은 Google 계정에 로그인하거나 구독을 공유하지 않으며, 보고서 검증·게시·조회·벤치마크 기반 기획에서 Google/Exa API를 호출하지 않는다. `benchmark-upload-template.json`은 빈 작성 양식이며 조사 결과가 아니다.

보고서 v1 입력:

```text
{version:1,title,scope,periodStart,periodEnd,researchedAt,candidateCount,
 selectionBasis,items:[{title,url,platform,creator,publishedAt,checkedAt,
 metrics:{views,likes,comments,shares,saves,followers},evidenceNote,
 hook,structure,payoff,brandFit,adaptation,seriesIds:[]}]}
```

- UTF-8 JSON 100KiB 이하. 실제 근거가 있는 1~5개만 허용하며 부족한 순위를 생성하지 않는다. `candidateCount`는 선정 수 이상의 정수, 순위는 입력 배열 순서대로 `1..N`이다. 각 ID는 `item-1..N`으로 정규화한다.
- `periodStart/End`는 한국 시간 기준 YYYY-MM-DD, 양 끝을 포함해 최대 30일. 오래된 기간도 보존할 수 있다. `researchedAt/checkedAt`은 시간대가 있는 ISO 날짜·시간, `publishedAt`은 YYYY-MM-DD 또는 시간대 ISO이다. 콘텐츠 게시일은 기간 안에, 원문 확인은 게시 후·조사 시각 이전이어야 한다. 미래 조사·확인 시각과 실제로 없는 날짜는 거절한다.
- `views/likes/comments/shares/saves` 중 최소 하나는 실제 확인한 양수 정수여야 한다. 팔로워만 양수인 사례는 거절한다. 미확인은 `null`, 확인한 0은 0으로 보존한다. 근거 설명 `evidenceNote`는 필수다.
- HTTPS Instagram 릴스, YouTube watch/Shorts/youtu.be, TikTok video, Facebook reel만 허용한다. 임의 호스트·자격증명·비표준 포트·추적 파라미터를 허용하지 않는다. YouTube URL 형태가 달라도 같은 동영상은 중복으로 판단한다. 서버는 제출 URL을 방문하지 않는다.
- 제목·설명은 정해진 길이의 일반 문자열로 정규화한다. `scope/selectionBasis/structure/adaptation`은 배열이 아닌 문자열이다. `seriesIds`는 회사 카탈로그의 ID 최대 10개 또는 빈 배열이다.
- 게시 요청에서 다시 전체 보고서를 검사하며 `reviewConfirmed:true`가 필요하다. `evidenceStatus:'admin-submitted'`는 관리자 제출·공유 상태이며 독립적인 원문 사실 검증을 의미하지 않는다.

Issue는 보고서에 서버 생성 `id,publishedAt,publishedByName,ageDays,stale`를 더한다. `ageDays`는 조사 시각부터 지난 일수, 7일 이상이면 `stale:true`이며 새로 올려도 조사일을 현재로 바꾸지 않는다. `workspace.benchmark.current`는 가장 최근 등록한 호 전체이며 `history`는 ID·제목·범위·기간·조사 시각·후보 수·선정 근거·등록 시각·등록자·항목 수·갱신 상태 요약이다. 새 호를 등록해도 이전 호와 그 호를 참조한 기획안은 덮어쓰지 않는다.

기획 입력의 `benchmarkId/benchmarkItemId`는 반드시 한 쌍이다. 개인 `referenceId`와 동시에 지정하지 않는다. 서버는 등록된 항목에서 도입·전개·보상·회사 적합성·변형 방법을 찾아 엔진에 전달하고, `input.benchmark`와 `plan.benchmark`에 선정 범위·시점·순위·출처 ID를 보존한다. `personalization:{situation,choice,nextStep}`는 각각 최대 2,000자이며 시청자의 상황·선택 기준·다음 행동으로 연결한다. 개인 참고 자료 복사 없이 공유 보고서를 이용할 수 있다.

## 참고 자료와 검색 근거

수동 참고 자료는 HTTPS `instagram.com` 또는 `www.instagram.com`의 `/reel/<id>/`만 받는다. URL 자격증명·별도 포트·다른 경로를 거절하고 추적 쿼리·fragment는 제거한다. URL을 서버에서 방문하거나 내려받지 않는다. 반응 수는 사용자가 입력한 0 이상의 정수이며 미입력은 `null`; `evidenceStatus:'user-submitted'`로 기록한다. 게시일·확인일은 사용자가 제출한 정보다.

키가 없는 기본 검색은 권한이 있는 저장 자료와 연결된 담당 채널에서 실제 API 수집한 최근 게시물을 찾고, Google·Instagram 검색 링크를 함께 제공한다. 수집된 반응 수는 관측 시각과 함께 누적값으로 제시한다. 연결 해제·수집 자료 만료·접근 권한 상실 시 검색에서 제외한다. 날짜 없는 저장 자료는 `dateStatus:'unknown'`이며 최근 게시물로 확인된 것이 아니다.

현재 **내 참고 자료** 화면은 항상 `localOnly:true`를 전송하므로 Exa 키가 있어도 외부 API를 호출하지 않는다. 예전 Exa 연결 API는 호환 목적으로 유지하며 화면에서 연결을 요구하지 않는다. 명시적인 외부 검색 API 요청에만 저장된 회사 전용 Exa 키를 사용할 수 있다. 다른 프로그램·에이전트의 키나 연결을 재사용하지 않는다. 키는 기존 Store의 AES-256-GCM 암호화 `content-search:exa` credential에 저장하며 API 응답·감사 기록에 포함하지 않는다. 키 저장만으로 검색이나 결제를 실행하지 않는다.

- 고정 endpoint: `https://api.exa.ai/search`, HTTPS POST, 리디렉션 금지.
- 요청: 검색어 `query`와 `type:'auto'`, Instagram 도메인 범위, 시작·종료 날짜, 최대 8개, `contents:{highlights:true}`만 전송. 기획안의 경험·근거·직원·회사 데이터는 외부로 전달하지 않는다.
- 사용자별 분당 5회, 회사 프로세스 전체 분당 30회. 한 요청 최대 12초, 응답 최대 512KiB. 자동 반복·백그라운드 검색 없음.
- 결과는 릴스 URL만 허용. 알려진 날짜가 요청 기간 밖이면 제외하고 제공자가 날짜를 모르면 `unknown` 표시. `evidenceStatus:'search-candidate'`, 모든 반응 수 `null`.
- 검색 제공자의 게시일은 색인 정보이며 실제 게시일 검증이 아니다. 검색에서 찾았다는 사실은 인기·급상승 증거가 아니다. 결과를 원문에서 확인한 뒤 수동 참고 자료로 저장한다.
- 인증·요금·네트워크·크기 오류는 원문 오류나 키를 노출하지 않고 저장 자료와 외부 검색 링크로 복귀한다. `mode`는 `local`, `exa`, `local-fallback` 중 하나다.

공식 계약 확인: [Exa Search API](https://exa.ai/docs/reference/search). 검색 API 사용은 해당 제공자의 이용 요금이 발생할 수 있다. 이 프로그램은 결제·구독·자동충전을 설정하지 않는다.

## 검증

### 2026-09-27 관리자 조사 업로드·개인화 보강

- 전체 자동 시험 **200/200**, 기존 콘텐츠 브라우저 **10/10**, 새 벤치마크 브라우저 **16/16** 통과. 미완성 템플릿 거절, 미리보기 무저장, 검토 후 공유, 이력, 직원·열람자 권한, 개인화 입력과 네 축, 원문 보존·내보내기를 임시 DB로 확인했다.
- 연결된 검색 키가 있는 임시 DB에서도 현재 직원 화면의 외부 요청 시도는 브라우저·서버 모두 **0건**이다. JSON 수정 중 이전 미리보기 응답, 로그아웃 후 이전 저장 응답, 새 창을 닫는 이전 응답을 차단하는 회귀 시험을 포함한다. 한국 시간 자정의 날짜 표시도 확인했다.
- 실제 `4191` 서버 반영 후 벤치마크·기획·내 참고·기획함 4화면을 1440·768·390·320px, 업로드 창을 1440·390·320px에서 확인했다. 가로 넘침·콘솔 오류·외부 요청은 0건이다.
- 실제 DB는 채널 **34**, 기획안 **0**, 개인 참고 **0**, 벤치마크 보고서 **0**으로 보존했다. 첫 실제 Gemini 조사와 관리자 원문 대조·공유는 아직 수행 전이다.
- 결과: `verification/benchmark-browser-results.json`, `benchmark-actual-results.json`, `benchmark-*-actual.png`. `*-fixture.png`는 임시 검증 자료이며 실제 인기 콘텐츠나 회사 성과가 아니다. 재검증 스크립트는 `verify-benchmark-browser.mjs`, 회귀 시험은 `public-content-state.test.mjs`다.

### 2026-09-27 브라우저 및 실제 로컬 확인

- 전체 자동 시험 174개 통과. 기존 브라우저 21개 흐름과 새 기획 흐름 10개 통과, 콘솔 오류 0건.
- 기획 시리즈 10개, 구성안 3개 생성·저장, 진정성 4개 입력 보존, 구성 선택·상태 변경·내보내기, 참고 자료→기획 적용, 재조회·로그아웃 시 자료 분리·열람자 쓰기 제한을 임시 DB에서 확인했다.
- 실제 4191 서버를 재시작해 기획하기·릴스 참고 찾기·기획함 3개 화면을 1440·768·390·320px에서 확인했다. 가로 넘침·콘솔 오류가 없고 기존 채널 34개, 기획안 0개, 참고 기록 0개를 유지했다. 검증용 콘텐츠를 실제 DB에 넣지 않았다.
- `verification/content-browser-results.json`, `content-actual-results.json`과 `content-*-actual.png`가 결과다. `fixture` 이미지는 임시 DB 예시다.
- **Exa 키 미연결**이다. 실제 외부 검색과 자동 인기 판정은 확인하지 않았다. 생성은 회사 제작 양식 기반이며 외부 생성형 AI를 호출하지 않는다.

### 조사한 참고 사례와 판단 범위

릴스 참고 찾기에 아래 세 개를 **2026-09-27 조사한 구성 참고 사례**로 표시한다. 개인 참고 자료와 실제 검색 결과에서 분리하며 DB에 자동 저장하지 않는다. 공개 캡션·미디어 대체텍스트를 살펴본 자료로, 영상 자체 재생·실시간 반응·인기 검증은 하지 않았다. 수치를 추정하거나 반올림 값을 정확한 관측값으로 넣지 않았다.

- [ChatGPT 제품 사용 예시](https://www.instagram.com/reel/DdCXClWtmD3/): 원문 영상 표기일 2026-09-08. 기능에서 사용 예시로 이어지는 구조 참고.
- [Blender 재현 결과 비교](https://www.instagram.com/reel/Dc-qbJzA05Q/): 원문 영상 표기일 2026-09-07. 기대와 실제 차이를 통한 유머·설명 참고. 게시 계정이 제작자인지는 미확인.
- [앱을 다시 만드는 제작 기록](https://www.instagram.com/reel/DdB2fg5E82Y/): 정확한 게시일 미확인. 실제 문제·선택·재시작·다음 기록의 약속 구조 참고.

Instagram의 [원본과 추천 안내](https://creators.instagram.com/blog/recommendations-and-originality)는 원본 콘텐츠·추천 적격성을 설명한다. [Meta Best Practices 안내](https://about.fb.com/news/2024/10/best-practices-education-hub-creators-instagram/)는 프로페셔널 대시보드의 제작·참여·도달 조언을 설명한다. 두 안내 모두 특정 경험 서사가 항상 성공한다는 근거로 쓰지 않는다. 직접 경험·정보와 재미·진정성은 SYNK 회사 편집 기준으로 적용한다.

`node --test docs/마케팅/온라인마케팅지도/engagement/company/content-service.test.mjs`

임시 DB와 모의 fetch로 인증·CSRF·역할·팀/개인 격리·다운로드·진정성 입력 보존·주소 제한·수치/기간 제한·암호화·키 비노출·외부 전송 범위·호출 한도·오류 복귀·검색 중 권한 회수를 검사한다. 실제 회사 DB 및 외부 Exa 요청은 테스트에서 사용하지 않는다. 프런트엔드 실물 확인과 실제 계정 검색 연결은 별도 상태다.
