# 펠트 엔진 근거 작업실 — 로컬 실행 계약

2026-09-11 · 코어 0.4.0. 이 API는 현재 기계의 시연·개발 자료를 저장한다. 제품의 학생 DB와 자동 연결하지 않는다. 판단 코어와 기록 형식은 제품 연결을 위해 별도 모듈로 둔다.

## 실행

Node.js 24 이상. `node tools/patent-studio/server.cjs` → `http://127.0.0.1:4318`.
`SYNK_STUDIO_DATA`로 자료 폴더를 지정할 수 있다. 기본은 사용자 로컬 앱 데이터의 SYNK/patent-studio. 녹음은 저장소 안에 넣지 않는다.

## HTTP

- GET `/api/bootstrap` → `{token,examples,samples,capabilities,sessions}`. token은 같은 출처 POST의 `X-Studio-Token`에 넣는다. 변경 요청은 같은 Origin도 필요하다. 전사 `available`은 설정 준비 상태이며 실제 연결 성공을 뜻하지 않는다.
- POST `/api/sessions` JSON `{mode:'example'|'recording',exampleId?,sourceKind?,sampleName?}` → 세션. 자체 합성 샘플은 `sourceKind:'synthetic-speech'`와 manifest의 `sampleName`을 남긴다. 이 출처 표기가 실제 학생 수행을 만들지 않는다.
- GET `/api/sessions/:id` → 세션.
- POST `/api/sessions/:id/events` JSON `{expectedRevision,event:{id,type,...}}` → 세션. 중첩 `payload`는 허용하지 않는다. 같은 id·같은 사건의 재시도는 중복 반영하지 않는다. 다른 내용이면 409. 원음 첨부·기계 전사 사건은 이 경로로 만들 수 없다.
- POST `/api/sessions/:id/audio?role=original|response` 원음 바이트. `Content-Type` 실제 MIME, `X-Expected-Revision`, `X-Event-Id` 필수. 첫 원음은 교체하지 않으며 새 응답은 새 사건으로 저장한다. 완료된 동일 업로드 재전송은 다시 외부 전사를 호출하지 않는다. 자동 전사에 실패해도 원음은 보존한다. 파일 상한 20 MiB, 전사 어댑터 상한 14 MiB이며 실제 컨테이너 서명을 검사한다.
- POST `/api/sessions/:id/transcribe` JSON `{expectedRevision,audioRef,audioEventId?}` → 지정 녹음 사건 전사 재시도. 같은 바이트를 서로 다른 응답에 사용했다면 `audioEventId`가 필수다. 모호한 해시만으로 최신 응답을 선택하지 않고 409를 낸다. 명시 재시도의 실제 결과는 텍스트가 같아도 별도 시도로 보존한다.
- GET `/api/audio/:sha256` → 원음 재생. byte Range 지원.
- GET `/api/samples/original.wav` 등 bootstrap이 제공한 샘플 경로 → manifest 지문과 일치하는 자체 합성 WAV.
- GET `/api/sessions/:id/comparison` → 동일 입력에서 코어 연결 제거 비교.
- GET `/api/sessions/:id/export` → 원음(base64)·지문·사건·판정·비교를 포함한 내려받기 JSON.
- GET `/api/sessions/:id/verification` → 저장 사건·효과 원장·최종 판정의 재현 결과 `{valid,failures,checkedRevisions,...}`. 실제 코드 지문까지 맞아야 통과한다.
- POST `/api/preflight` JSON `{}` → `{ok,checkedAt,checks,transcription}`. DB·파일 쓰기/읽기, 승인 자산 지문, 샘플 지문, 실제 로컬 전사, 코어 예제를 검사한다. 동시에 요청해도 진행 중인 검사를 공유한다. 실제 오디오 장치 검사는 별도다.
- GET `/api/health` → `{ok,service,engineVersion,storage,pendingTranscriptions}` 실행 상태. capabilities도 설정 준비 여부이며 실제 전사 성공은 해당 오디오의 결과와 preflight에서 확인한다.

업로드에서 `X-Transcription-Provider: local|gemini|auto|manual`로 다음 처리 경로를 명시할 수 있다. 재전사는 JSON의 `provider` 필드로 지정한다. 생략하면 서버 기본값이며 발표 기본은 local이다. auto는 명시한 외부 경로가 실패하면 같은 바이트를 로컬에서 처리하고 두 결과를 `raw.routeAttempts`에 남긴다. local 실패는 외부 전송을 유발하지 않는다. 기존 Vertex는 명시 허용 설정에서만 가능하며 Gemini 선택을 Vertex로 치환하지 않는다.

transcription의 `status:'ready'`는 실제 모델의 비어 있지 않은 전사 응답이 있는 경우다. `provider`, `model`, `text`, 실제 요청·응답 근거를 포함한다. local에는 오디오·모델 지문, 추론 설정, 구간 결과, `networkAttempts`를 남긴다. 외부 실패에는 `code`와 `routeAttempts`를 남기고 자격증명이나 벤더의 민감한 오류 원문을 내보내지 않는다. HTTP 업로드 200과 자동 전사 성공은 다르다.

세션 응답은 코어 세션을 그대로 포함하고 `{revision,analysis,events,audios,updatedAt}`를 더한다. `audios`는 원음 해시와 `audioEventId`, `responseId`, MIME·크기·role·url·전사 상태를 포함한다. 전사 상태는 ready/failed/unavailable/pending이며 실패 설명은 비밀 없는 문장이다. 최초 자동 전사는 사람 확인으로 승격되지 않는다. 늦게 도착한 기계 전사도 이미 확인한 사람의 청취 전사를 덮지 않는다.

## 발화 시점

업로드 헤더 `X-Capture-Method`는 `file`(기본) 또는 `microphone`이다. 마이크는 `X-Capture-Started-At`·`X-Capture-Ended-At`에 실제 브라우저 녹음 구간의 ISO 시각을 보낸다. 뒤집힌 구간·미래 구간·잘못된 값은 시점 근거로 인정하지 않는다. 외부 기기의 시간 진실성 인증은 아니다.

파일은 `attachedAt`만 수신 시각으로 두고 `recordedAt`은 null이다. 사람의 `performanceTimeConfirmed:true` 확인은 원음의 최초 시도·도움 이전 또는 응답의 도움 이후라는 상대 순서 확인이다. 날짜를 지어내지 않는다. 구간·출처는 `performanceInterval`, `performanceTimeSource`에 남으며 시점 미확인 때 수행 칸을 보류하고 음성 자료의 자격은 별도로 판단한다. 녹음 구간과 도움이 겹치거나 확인 범위 밖의 늦은 도움 기록이 들어오면 관련 수행을 다시 보류할 수 있다.

## 기본 사건

- `transcripts-set`: `{role:'original'|'response',responseId?,alternatives:[{text}],source:'human',scopeConfirmed?,confirmed?}`. HTTP에서는 사람이 입력한 후보만 받는다. `source:'machine'`과 `audio-attached`는 서버의 실제 파일 처리 전용이다.
- `review-original`: `{text,confirmed:true,scopeConfirmed?:true,performanceTimeConfirmed?}`. 사람이 들은 원음 전사 확인.
- `review-response`: 위 확인 필드와 `{responseId,exposureScopeConfirmed?}`. 지정한 응답만 확인한다.
- `help-presented`: `{text,exposesAnswer:true,skills?:['object','past'],at?}`. UI가 문장을 실제 표시한 뒤 그 제시 시각으로 저장한다. 저장 확인 전까지 새 응답을 잠근다. 도움 표시 선택이나 예상 응답을 실제 관측으로 쓰지 않는다.
- `response-added`: `{responseId?,text,alternatives?,audioRef?,confirmed?,scopeConfirmed?}`. 새 응답이며 원래 발화를 바꾸지 않는다. `audioRef`가 있다면 해당 세션의 동일 responseId에 실제 업로드된 응답 원음과 일치해야 한다. 텍스트만 입력해 음성 자료 쌍을 만들 수 없다.
- `task-confirmed`: `{roleConfirmed?,pastIndependent?,exposureScopeConfirmed?,prompt?}`. 당시 문항의 조건과 원음의 앱 내 도움 범위를 확인한다. 지원 밖 문항으로 변경하면 통제 문항의 의미 자격을 계승하지 않는다.
- `unknown-set`: `{enabled,reason,kind?,scope?}`. kind는 all/transcription/semantic/exposure, scope는 all/object/past/asr의 배열. 누락·잘못된 범위는 보수적으로 all을 적용한다. 의미·도움의 불명과 전사 불명은 구분한다.
- `purpose-set`: `{purpose:'original-performance'|'asr-data'}`

추가 코어 사건·세부 필드는 core.cjs의 검증 규칙을 따른다. 예상 응답은 계획·비교에만 쓰고 주 판정의 실제 응답으로 기록하지 않는다.

## 오류와 저장

400 잘못된 입력, 403 출처/요청 토큰 불일치, 404 없음, 409 판본 충돌/사건 충돌, 413 파일 초과, 415 지원하지 않는 오디오. JSON 오류 `{error,code}`. 409 뒤 최신 세션을 다시 읽고 사용자가 변경을 확인한다.

SQLite 트랜잭션 안에서 사건 추가·세션 판본 갱신·새 판정·효과 원장을 함께 저장한다. 실제 원음은 SHA-256으로 참조하고 그대로 보존한다. 기존 원음 교체는 금지하며 새 시도를 새 세션/응답으로 기록한다. 전사와 청취 확인은 다른 사건이다. 프로그램 재실행 뒤 동일 자료와 판정을 다시 읽을 수 있다.

`session.effectLedger`는 `{schemaVersion,entries,headSha256,startsAtRevision,throughRevision,legacyBaseline}`이다. 각 entry는 `{fromRevision,toRevision,cause,summary,transitions,previousSha256,sha256,engineKey,...}`이며 원인 사건·전후 판본·셀별 유지/철회/정정과 전후 효과를 보존한다. 이전 판의 DB는 저장된 현재 상태에서 출발 기준을 만들며 과거 전이를 발명하지 않는다.

`analysis.computation`은 실제 효과의 다시 계산·이전 결과 재사용 수와 무효화 이유를 제공한다. 코드 지문·의존 입력·결과 지문이 일치할 때만 재사용한다. 모든 입력 지문과 계획·저장 처리를 생략하는 것은 아니다. 네 비교는 같은 입력의 규칙 차이이며 외부 정답표에 대한 성능 측정이 아니다.

export에는 실제 원음·사건·전사 시도·효과 원장·판정·지문과 `replay` 입력이 포함된다. `node tools/patent-studio/projection-replay.cjs <export.json>`으로 서버 없이 재현한다. 내용 지문 사슬은 외부 서명이나 기록되지 않은 사건의 부재를 증명하지 않는다. 전사 성공 응답이 없으면 성공 결과를 만들어 넣지 않는다. 실행 범위와 시험 증거는 VERIFICATION.md를 따른다.
