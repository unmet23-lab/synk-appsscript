# SYNK 메신저 리디자인 · 2026-10-01

첨부 이미지의 얼굴 위에 적힌 7개 스타일을 조사하고 기존 사내 메신저에 적용했다. 원본 ‘싱ㅋ’ SVG, SUIT·Inter Tight·DM Mono, SYNK 청금석·메도우·버터·팝·코랄 색과 승인된 펠트 마린·스티커를 사용했다. 이전 중립색 화면보다 업무 구획과 조작 지점을 분명하게 만든다.

## 조사와 선택

| 첨부 스타일 | 확인한 특징과 자료 | 메신저 적용 |
|---|---|---|
| Webcore | 초기 웹과 운영체제 창을 인용하는 인터페이스 표현. [Webcore 사례·정의](https://aesthetics.fandom.com/wiki/Webcore) | 창 프레임·단축키·구획의 명료함을 참고. 가짜 창 버튼·픽셀 글자·움직이는 배경은 사용하지 않는다. |
| Masking shape | [Adobe의 도형 마스킹 예제](https://www.adobe.com/learn/illustrator/web/crop-using-masks) | 빈 대화의 마린을 하나의 아치 프레임 안에 배치. 내용과 조작 영역은 자르지 않는다. |
| Confetti | [Canva 컨페티 템플릿](https://www.canva.com/templates/s/confetti/) 검색 확인, 축하·완료 문맥의 그래픽 | ‘안 읽음’을 모두 확인한 상태에만 정적인 청금석 점 4개. 메시지 수신 때마다 애니메이션을 돌리지 않는다. 템플릿 상세 접근은 일반 템플릿 목록으로 이동했다. |
| Sketchbook collage | [Adobe 2026 트렌드](https://www.adobe.com/express/learn/blog/design-trends-2026), [Canva 2026 조사](https://www.canva.com/newsroom/news/design-trends-2026/)의 겹친 사진·스티커·스크랩북 표현 | 빈 대화에 승인 마린 + 펠트 스티커 하나 + 작은 테이프. 대화가 생기면 큰 장식을 없애고 내용을 우선한다. |
| Embossed | [Adobe의 Bevel & Emboss 예제](https://helpx.adobe.com/in_hi/photoshop/how-to/embossed-bevel-effect.html), Canva Texture Check | 보내기·주요 시작 버튼·선택 탭의 얇은 광택과 깊이. 대비를 잃는 밝은 글자나 모든 카드의 큰 그림자를 피한다. |
| Camera interface | [Kittl Surveillance Design](https://www.kittl.com/blogs/surveillance-design-stl/)의 프레임·라벨·시스템 표기 | 문맥·참여 범위·파일 정보가 보이는 구조를 참고. 사내 대화에 감시·녹화로 오해되는 REC나 얼굴 추적 상자는 넣지 않는다. |
| Naive design | [Adobe Naive Design](https://www.adobe.com/express/learn/blog/microtrend-naive-design), [Kittl 2026 트렌드](https://www.kittl.com/blogs/graphic-design-trends-2026/) | 빈 대화 제목의 버터색 밑줄 한 구절과 코랄 손그림 별 하나. 본문과 메뉴는 정상 서체·정렬을 유지한다. |

Canva는 자사 서비스에서 DIY·스크랩북 관련 검색이 전년 대비 90% 증가했다고 설명한다. 이 수치는 그래픽 수요의 신호이며 업무 메신저 사용성이나 이 앱의 만족도 향상을 증명하지 않는다. 첨부 7장은 같은 릴스의 장면이므로 표시된 좋아요·공유·저장 숫자로 스타일별 반응 순위를 계산할 수 없다. ‘가장 반응이 좋은 UI’라는 확정 표현 대신 실제 탐색·읽기·입력 흐름을 검증한다.

업무 UX는 [Slack 디자인팀의 집중·탭·문맥 유지 사례](https://slack.design/articles/a-more-focused-productive-slack/)를 참고했다. Slack이 사용자 피드백에 따라 검색의 접근성과 업무별 탭 구성을 조정한 이유를 반영해 검색을 숨기지 않고 기존 권한과 대화 상태를 보존했다.

## 화면과 동작

- 상단: 개인·팀·전체 채팅의 선택과 안 읽음 수, 알림·할 일·저장 바로가기.
- 왼쪽: 대화 목적이 보이는 목록, 현재 종류 안에서 이름·설명·DM 상대 팀으로 대화방 찾기, 기존 메시지 전체 검색과 안 읽음 필터.
- 가운데: 대화 제목·목적, 대화·파일·고정 메시지, 읽기 쉬운 이름·시간·메시지·답글·반응·첨부.
- 입력: 파일·이모지·멘션, 명확한 보내기 버튼, 기존 한글 조합·Enter·초안·읽기 전용 제어.
- 오른쪽: 실제 크루·팀 검색과 개인 대화. 좁은 화면에서는 대화 목록 메뉴 안으로 이동하며 세부 패널을 열면 대화 읽을 공간을 확보한다.
- 빈 대화에만 브랜드 콜라주. 모바일에서는 장식을 줄인다. 낮은 높이에서는 여백·입력창을 조절하며 실제 화면에서 잘림을 확인한다.

## 자산 출처

로고·서체는 기존 `public/assets` 자산을 유지했다. 새 WebP 3개는 `docs/디자인/SNS키트/assets`의 승인 파일을 그대로 복사했다. 재생성·재착색·외부 폰트·트래커·원격 이미지 요청을 추가하지 않았다. 디자인 기준은 루트 DESIGN.md, 브랜드 폰트 정본, 디자인 토큰, 펠트스크랩북 안내와 명품 기준이다.

스타일은 `public/messenger-design.css`, 동작은 기존 `public/app.js`, 연결은 `public/index.html`에서 관리한다. 검증은 QA.md의 2026-10-01 기록을 따른다.
