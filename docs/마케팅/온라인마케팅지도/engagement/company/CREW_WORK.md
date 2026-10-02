# 크루 업무카드와 직접 팀 구성 검토

크루가 직접 선택하고 확인한 업무 정보만 저장한다. 관리자·팀장은 공유에 동의한 업무카드를 보고 구성원을 직접 선택한 다음, 필요한 기술과 가능 시간을 비교할 수 있다. 저장된 프로필에서 자동으로 팀을 선발하거나 기존 소속·역할을 변경하지 않는다.

## 공통 업무 모듈

공통 원본은 `atlas/work.js`이며 `VERSION='atlas-work-1'`, 프로필 `schemaVersion=1`이다. CommonJS와 브라우저의 `SynkAtlasWork`로 사용할 수 있다. 회사의 `crew-profile-service.mjs`가 이 모듈을 직접 사용한다.

- `normalizeProfile(input, catalog)`: 본인 확인과 명시한 선택값 검증.
- `information(profile)`: 미입력 항목 목록. 사람의 역량·성격 점수가 아니다.
- `normalizeCriteria(input, catalog)`: 직접 선택한 구성원과 요구조건 검증·중복 제거.
- `evaluate(input, cards, catalog)`: 선택한 카드만 사용해 업무 기술 충족 여부, 미확인 기술, 시간 조건, 명시된 협업 선호를 설명.

모듈은 순수 계산만 수행한다. 계정·공유 동의·조직 권한·저장·확인 시각은 호출 측에서 검증한다. LAB 학습 로그, 대화 원문, 행동 기록, 기존 Atlas 학습 도메인을 사용하지 않는다. 외부 호출, 성격·MBTI·심리 추론, 개인 평가·순위·점수는 없다.

## 본인 프로필 API

모든 요청에 회사 로그인이 필요하다. POST에는 기존 Origin·CSRF 검사가 적용되며 본문 수신 후 세션을 다시 확인한다. viewer도 본인의 업무카드를 관리할 수 있다. 관리자도 다른 사람의 프로필을 직접 조회·수정·삭제할 수 없다. 공유된 카드는 아래 조직 범위의 목록·검토 API에서만 보여 준다.

`GET /api/crew-profile`:

```js
{
  engine: { id: 'crew-work', version: 'atlas-work-1' },
  profile: null, // 또는 아래 업무필드 + userId/schemaVersion/confirmedAt/updatedAt/revision
  revision: null, // 최초에는 null, 이후 저장·공유변경·삭제마다 새 UUID
  catalog: { skills: [{id, label}], preferredTasks: [{id, label}], communication: [{value, label}], workMode: [{value, label}] },
  permissions: { canEvaluate: false, workScope: null },
  completeness: null // 프로필이 있으면 {complete, missing:[필드명]}
}
```

`POST /api/crew-profile`은 전체 교체다.

```json
{
  "skills": ["planning", "design"],
  "preferredTasks": ["research"],
  "communication": "async",
  "workMode": "pair",
  "availableHours": 4,
  "participates": true,
  "confirmed": true,
  "expectedRevision": null
}
```

- skills/preferredTasks는 각각 최대 12개, 카탈로그 ID만 허용한다. 중복은 제거한다. 회사 카탈로그는 planning, research, copywriting, design, filming, video-editing, channel-operations, data-analysis, development, project-operations다.
- communication은 async/live/flexible/null, workMode는 solo/pair/flexible/null이다. 미입력을 flexible로 추정하지 않는다.
- availableHours는 **주당 가능 시간**, 0~80 사이 0.5시간 단위 또는 null이다. 명시한 0시간과 미입력 null을 구분한다. 실시간 일정·행동 추적 결과가 아니다.
- participates는 명시한 공유 동의다. true이면 관리자와 본인 팀장이 직접 팀 구성 검토에 사용할 수 있다. false면 본인 카드만 보존하고 조직 카드 목록에서는 즉시 가린다.
- confirmed:true가 필수다. 자유 문장, 원문 채팅, 성격 정보, 임의 사용자 ID·권한 필드는 받지 않는다.
- 업무항목이 같고 공유 여부만 달라졌다면 confirmedAt은 보존한다. updatedAt과 revision만 갱신해 공유 변경을 내용 재확인으로 표시하지 않는다.

삭제는 `POST /api/crew-profile/delete {expectedRevision}`다. 해당 크루의 프로필 행 전체를 삭제하며 `profile:null`을 반환한다. 프로필 내용 없는 revision만 별도 보존한다.

저장·철회·삭제는 최신 GET의 revision을 expectedRevision으로 보내야 한다. 다른 탭에서 변경된 뒤 오래된 폼을 저장하면 **409**로 거절한다. 자동 재시도하지 말고 최신 카드를 읽어 사용자에게 다시 확인받는다. 삭제 후에도 이전 빈 폼이나 저장 폼으로 공유를 되살릴 수 없다.

## 업무카드 목록과 직접 검토

`GET /api/crew-work/roster`는 관리자에게 회사의 활성 크루, 팀장에게 본인 활성 팀의 크루만 반환한다. member/viewer 또는 활성 소속 팀이 없는 팀장은 403이다. 임의 teamId로 범위를 확대할 수 없다.

```js
{
  engine, catalog,
  scope: {type:'company'|'team', teamId:null|string, teamName:null|string},
  members: [
    {id, name, teamId, teamName, shared:false},
    {id, name, teamId, teamName, shared:true, profile, completeness:{complete,missing}}
  ],
  summary: {activeCount, sharedCount, unsharedCount},
  permissions: {canEvaluate:true}
}
```

미공유·미등록·본인 확인이 없는 카드에는 조직에서 이미 허용된 이름·팀만 표시한다. 업무필드나 미입력 항목을 반환하지 않는다. 비활성 크루는 제외한다. 공유한 카드의 시간이 0 또는 미입력이더라도 목록과 직접 선택에서 제외하지 않는다.

`POST /api/crew-work/evaluate`:

```json
{"requiredSkills":["planning","design"],"memberIds":["company-user-id"],"minAvailableHours":2}
```

requiredSkills는 1~12개 카탈로그 ID, memberIds는 직접 선택한 1~20개 ID, minAvailableHours는 각 크루에게 요청하는 주당 시간 조건(0~80, 0.5 단위)이다. 기본 전체 선택은 없으며 빈 선택을 거절한다. 결과를 저장하지 않는다.

응답은 engine, criteria, scope, selected 카드, coverage `[{skill,label,covered,memberIds}]`, missingSkills, availability `[{userId,availableHours,status,meetsMinimum,shortfall}]`, collaboration의 선택값별 인원 수, complete, warnings, metadata다.

- status: available(요청 시간 이상), insufficient(요청 시간 미만), zero(명시한 0시간), unknown(미입력). 부족하거나 미확인인 사람을 자동 제외하지 않는다.
- complete는 요청 기술 및 시간 조건을 기록으로 확인했는지 나타낸다. 사람이나 팀의 능력·적합성 평가가 아니다. 미기재 기술을 역량 부족으로 판단하지 않는다.
- 협업 선호가 서로 다르면 소통·업무 분배를 합의하라는 설명만 제공한다. 성격 궁합을 추론하지 않는다.
- 같은 기술을 여러 사람이 선택했어도 요구 기술 하나를 여러 개로 집계하지 않는다. 구성원 순서는 직접 선택한 순서를 유지하고 중복 ID는 한 번만 센다.
- 각 요청 때 현재 역할·팀·활성 상태·공유 동의를 다시 검증한다. 범위 밖·탈퇴·미공유·확인되지 않은 카드 ID는 404이며 그 프로필은 반환하지 않는다.

metadata는 `automaticSelection:false`, `automaticAssignment:false`, `generative:false`, `externalCalls:false`, `basis:'self-confirmed-work-profile'`다. 검토 결과는 현재 카드를 바탕으로 한 시점별 안내이며 구성원 추가·삭제·직책 변경을 실행하지 않는다.

## 격리 검증

```text
node --test tests/atlas-work.test.js docs/마케팅/온라인마케팅지도/engagement/company/server-crew-work.test.mjs
```

카탈로그·확인 필수, 조직·공유 권한, viewer 본인 관리, 본인 외 수정 금지, 0/null, 중복·빈 선택, 삭제·철회·역할/팀 변경, 오래된 탭의 동의 복원 방지, 재시작 보존, 느린 POST의 세션·역할 철회를 임시 데이터에서 검증한다.
