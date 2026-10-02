# 마린 업무 안내 API

마린은 회사의 현재 자료를 조회하고 해당 화면을 여는 업무 안내 기능이다. 자유 생성형 모델을 연결하지 않으며 외부 모델 호출·과금·채팅 로그 저장·메시지 전송을 하지 않는다. 기존 개인 Gemini 구독용 CLI 도구는 회사 서버에 연결하지 않았다.

## 요청과 응답

`POST /api/assistant`에 `{ "message": "이번 주 내 조회수 보여줘" }`를 보낸다. 회사 로그인, 같은 출처, `X-CSRF-Token`이 필요하다. 본문 수신 후 활성 사용자와 세션을 다시 검사한다. viewer도 자신에게 허용된 자료를 읽을 수 있다. message는 공백을 제외해 1~1000자이며, 임의의 사용자·범위·대화 이력 필드는 처리하지 않는다.

```json
{
  "mode": "workspace-guide",
  "intent": "performance",
  "text": "확인. 내 담당 채널 성과 …",
  "actions": [{ "type": "marketing", "label": "내 성과 자세히 보기", "view": "overview", "section": "mine" }],
  "suggestions": [],
  "generative": false,
  "externalCalls": false,
  "data": {}
}
```

`intent`는 performance, people, rooms, files, tasks, navigate, help, unsupported 중 하나다. actions는 보통 최대 3개, 동명이인 선택만 최대 5개다. data는 성과 기간·지표나 검색 개수의 보조 정보이며 원문 메시지·이메일·자격증명은 넣지 않는다.

- 마케팅 action: `{type:'marketing',label,view,section?}`. view는 overview, history, content, channels이며, 성과 section은 mine/team/all, content는 plan이다. channels는 section을 생략한다.
- 메신저 action: `{type:'messenger',label,channelId?,userId?,messageId?,fileId?,panel?}`. panel은 files/tasks/saved 중 하나다. userId와 channelId, fileId는 메신저 ID이며 messageId는 숫자 문자열이다.
- action에는 실행 코드나 임의 URL을 담지 않는다. 프런트가 허용한 기존 화면 이동으로 해석한다. DM 생성도 사용자가 버튼을 누른 다음 기존 메신저 API에서 처리한다.

## 조회 기준

성과는 마케팅의 동일한 `reportSource`와 `buildGrowthSummary`를 재사용한다. 내 현황은 **현재 내 담당 채널 기록**, 팀 현황은 내 활성 팀 중 열람 가능한 채널, 전체는 기존 역할 권한으로 열람 가능한 채널이다. 과거 특정 크루의 개인 기여도를 추정하는 응답이 아니다. 별도 분석 화면의 ownerId 기반 과거 담당자 집계는 변경하지 않는다.

오늘 날짜는 한국 시간 기준이다. 이번 주는 월요일부터 조회일까지이며 전주 같은 요일과 비교한다. 지난주는 직전 월요일~일요일을 조회한다. 오늘·어제·이번 달·지난달과 단일 YYYY-MM-DD도 지원한다. 여러 날짜·미래 날짜·범위가 없는 후속 질문은 범위를 다시 안내한다.

당일 누적은 정확한 날짜의 total만 사용한다. 미확인·비교 불가는 null로 유지하고 최근값을 당일값으로 대신하지 않는다. 일부 자료만 비교된 수치에는 설명을 붙인다. 두 비교 기간의 완전성·일수 기준도 기존 성장 집계를 따른다. 조회할 때 만료된 수집 자료는 제외하되 삭제하지 않는다.

크루 검색은 현재 활성 디렉터리만, 방·파일·할 일 검색은 현재 참여하고 접근 가능한 방만 사용한다. 삭제·탈퇴·팀 이동으로 잃은 방은 제외한다. 파일명은 SQL 와일드카드도 일반 문자로 검색한다. 할 일은 본인에게 지정된 항목만 반환한다. 파일과 할 일은 최대 3개를 보여 주며 원문 메시지 내용은 반환하지 않는다.

콘텐츠 기획·채널 수집·저장한 메시지는 화면으로 안내한다. 지원하지 않는 요청에 자유 생성이나 실행 성공을 가장하지 않는다. 프런트의 대화 이력은 서버 조회의 문맥으로 사용하지 않는다.

## 검증

`node --test docs/마케팅/온라인마케팅지도/engagement/company/server-assistant.test.mjs`

격리된 임시 데이터에서 성과 범위·신규 콘텐츠 기준선·누락값·마케팅 집계 일치, 파일 및 업무 접근, 이름 검색, 원문 비노출, CSRF, 비활성 및 요청 도중 세션 철회, 외부 호출 및 직접 데이터 변경 없음을 확인한다.
