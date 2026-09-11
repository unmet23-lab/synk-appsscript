# 특허 시연 전사 어댑터와 제품 연결 위치

2026-09-11. 이 문서는 로컬 시연과 기존 제품의 연결 지점을 구분한다. 이번 어댑터는 기존 제품 DB·학생 상태·학습자료 내보내기에 연결하지 않았다.

## 전사 어댑터 계약

`require('./transcriber.cjs')`에서 다음 두 함수를 사용한다.

```js
const { status, transcribe } = require('./transcriber.cjs');
const configured = await status();
const result = await transcribe({ bytes: Buffer.from(audioBytes), mimeType: recordedMimeType });
```

- `status() → {available, provider, model, reason}`: 생성 API나 토큰 갱신을 호출하지 않는다. `available`은 자격·모델·통로가 구성되어 호출을 시도할 수 있다는 뜻이다. 실제 통신 성공의 증거가 아니다. `configured_not_probed`, `last_request_succeeded`, `last_request_failed_*`로 구분한다. 일시 실패 뒤 다음 명시 재시도를 막지 않는다.
- `transcribe({bytes,mimeType}) → {text, alternatives, provider, model, raw}`: 실제 바이트를 복사해 고정하고 전송한다. 문항의 정답·최종 교정·예상 응답·파일명은 전사 요청에 넣지 않는다.
- `alternatives`는 주전사를 첫 원소로 하고 중복을 제거한다. 무발화 결과는 `text:''`, `alternatives:[]`이다. 실패나 미전사는 빈 전사로 반환하지 않는다.
- 후보는 오디오 입력에서 모델이 생성한 전사 대안이다. 디코더의 보정된 N-best나 모든 가능한 해석을 뜻하지 않는다. `confidence`를 임의로 넣지 않는다. `raw.coverage='not_complete'`, `needsHumanVerification=true`를 유지한다.
- `raw.response`는 실제 응답의 최종 텍스트·완료 상태·서빙 모델·숫자 사용량이다. 사고 요약·인증 헤더·키·전송 오디오 원문은 결과에 넣지 않는다.
- `raw.request`는 실제 오디오의 SHA-256·참조·바이트 수·MIME, 요청 모델, 프롬프트판과 **실제 프롬프트 전문·generationConfig·실제 직렬화 본문의 SHA-256**을 남긴다. `requestBodyTemplate`은 실제 본문의 오디오 `data`만 `dataRef`로 바꾼 것이다. 저장된 동일 원음을 base64 `data`로 복원한 후 UTF-8 `JSON.stringify`의 해시를 대조하면 당시 요청 본문을 검증할 수 있다. 헤더·URL·키와 오디오 base64 중복은 저장하지 않는다.
- 완료 후보가 없거나 `STOP`이 아니거나 실제 서빙 모델이 요청과 맞지 않거나 JSON 구조가 틀리면 실패한다. 벤더 오류 원문·예외 메시지를 화면과 로그에 전달하지 않고 고정 오류 코드와 HTTP 상태만 낸다.
- 명시 요청 한 번당 외부 요청 한 번이다. 실패 시 자동 재시도·다른 벤더·다른 계정·다른 과금 통로로 전환하지 않는다.

## 기존 실행 통로 재사용

기준은 [모델정책](../모델정책.js)과 [기존 Gemini 호출](../lib/제미나이호출.js)이다.

| 설정 | 동작 |
|---|---|
| 기본 또는 `SYNK_PATENT_STT_PROVIDER=gemini` | 기존 AI Studio 경로·무료 용도 자격·현재 정책 모델 사용 |
| `SYNK_PATENT_STT_PROVIDER=vertex` | 기존 Vertex 경로. 기존 정책의 명시 허용과 해당 자격·프로젝트 검사를 모두 통과해야 함 |
| `SYNK_PATENT_STT_PROVIDER=manual` | 자동 전사 unavailable. 저장한 원음을 들은 사람이 청취 전사를 입력 |
| 알 수 없는 설정·자격 누락 | unavailable. 다른 계정이나 모델로 자동 이동하지 않음 |

기존 `tools/음성실측.js:295`에는 실제 WAV를 Gemini `inlineData`로 보내는 역듣기 경로가 있다. 새 어댑터는 인증·URL·모델 선택을 복사하지 않고 정본 함수를 사용한다. 인증 없는 통로 상태 조회와 실제 전사 실행을 분리한다.

지원 입력은 WAV, MP3/MPEG, AIFF, AAC, OGG, FLAC, M4A/MP4 오디오, WebM이다. `audio/webm;codecs=opus`는 동일 컨테이너의 `audio/webm`으로 보낸다. 바이트를 재인코딩하거나 WebM을 WAV로 가장하지 않는다. 14 MiB 상한은 base64와 프롬프트를 포함한 전체 요청을 20 MB 아래로 유지하기 위한 로컬 제한이다. 서버의 원음 저장 상한과 자동 전사 상한은 별개다.

[Google 오디오 입력 문서](https://ai.google.dev/gemini-api/docs/audio)의 오디오 형식과 전체 inline 요청 크기 제한을 확인했다. 현재 구현은 기존 저장소에서 쓰는 `generateContent`·`inlineData` 형식이다.

## 기존 제품과 연결할 위치

아래 경로 중 TALK는 `C:/Users/q1212/Documents/SYNK-talk`, GAS는 현재 저장소다. 현재 시연에서는 제품 원본을 조회·수정하지 않는다.

| 단계 | 기존 제품 입력·출력 | 확인한 코드 위치 | 실제 제품에 잇기 위해 남은 일 |
|---|---|---|---|
| 녹음·저장 | 원음 저장 후 `audio_ref`를 제출 사건에 연결 | TALK `supabase/functions/uploads/index.ts`, `lib/업로드경로.js`; C0 §4-2 | 원음 파일과 동의·제출 사건을 유지하며 시연 묶음의 참조를 연결. 현재 로컬 시연의 파일 경로를 제품 참조로 가장하지 않음 |
| 전사 | `transcript`·`stt_model`·구간, 별도 `stt_raw` | TALK `supabase/functions/transcribe/index.ts:191` 및 `:230`, `:245`; `lib/전사.js` | 현재 제품은 Whisper-1 배치. 신규 전사 후보·근거 지문·불명 범위를 제품 계약에 맞게 연결. Gemini 로컬 실험이 제품 전사 교체는 아님 |
| 당시 문항 | `task_snapshot`·과제 참조·능력 정의판 | TALK C0 §4-1, L0 §3, `supabase/functions/events/index.ts:444` | 문항의 명시 요구와 시스템 추론을 구분. 나중에 원하는 정답을 당시 문항에 추가하지 않음 |
| 기계와 사람 전사 분리 | `transcript` 보존, `transcript_verified` 갱신 | TALK `supabase/functions/review/index.ts:699–724` | 사람의 청취 기록·재검수 사슬을 신규 효과의 근거판과 연결 |
| AI 교정 평가 | AI 교정문·모델·프롬프트판·사람 최종문 | TALK `supabase/functions/correct/index.ts:584`, `:702`; `lib/교정엔진.js` | 실제 전송 본문과 참조 입력판의 고정 기능이 필요. `transcript_at_review`는 승인 시 사람 전사이며 AI 당시 입력 스냅샷이 아님 |
| 도움과 재응답 | `correction.viewed`, `retry_of_event_id`, `parent_event_id` 등 | TALK `lib/오늘과제.js`, `supabase/functions/events/index.ts:444` | 실제 표시·재생한 내용과 순서·대상 능력·누락 범위를 연결. 행동 선택만으로 노출이나 응답을 기록하지 않음 |
| 시점별 상태 | `as_of`·적재 시점 경계로 근거 절단 | TALK `lib/학습자상태.js:249` | 도움 전·후·새 과제의 평가 시점 및 목적별 적격 효과를 입력으로 연결 |
| 도달·새 과제 | 문법 ID·서로 다른 날의 근거·출처 정책, 최근 오류 재료 | GAS `교재연동.js:1256`, `:1528`, `:1687`; `엔진_콘텐츠AI.js`의 `aiWeakMap_` | 신규 효과를 현행 승격·과제 소비 계약에 맞게 연결. 현재 `masteryApply_`의 단방향 상향 규칙을 임의로 강등 정책으로 바꾸지 않음 |
| 늦은 정정 | 기존 재검수의 `supersedes` 사슬 | TALK `supabase/functions/review/index.ts:628` | 사용처×능력×시점별 파생·기여 취소와 판본 조건 저장을 실제 DB에 구현·검증해야 함 |

업로드 행은 계약과 연결 코드를 확인하는 위치표다. 이번 어댑터가 해당 운영 함수를 호출하거나 운영 원음을 읽었다는 뜻은 아니다. 전사·검수·교정·상태·도달 행의 지목한 함수는 실제 본문을 대조했다.

## 반드시 유지할 의미

- P0 §6-4: 전사 실패가 제출 실패가 되지 않는다. 원음을 저장하고, 미전사는 대기·실패 상태로 구분한다.
- L0 §9-2: 기계 전사와 사람이 들은 전사를 합치지 않는다. ASR 오류를 학생 문법 오류로 자동 라벨링하지 않는다.
- C0 §4-2: 실제 제품의 원음 규격은 PCM WAV 16kHz·16bit·mono 및 기기 음성처리 off다. 브라우저 시연의 WebM 수집 성공을 이 제품 규격이나 발음 연구 원음 품질 검증으로 바꾸지 않는다.
- 엔진 7종 §2 전이 판정: 재제출 성공·새 기회의 첫 시도·지연된 독립 수행을 분리한다. 앱 안 도움 관측을 앱 밖 도움 부재로 확대하지 않는다.
- 새 전사가 반환돼도 자동으로 ‘해석 범위 완결’로 선언하지 않는다. 사람 검수 및 규칙이 지원하는 구간·의미·능력의 범위를 별도로 판정한다.
- 전사 결과는 들린 말의 기계 해석이다. 의미 제약·교정 적합성·독립 수행·능력 효과를 이 어댑터가 판정하지 않는다.

## 검증 상태

`node --test tests/patent-studio-transcriber.test.cjs` 10개 통과. 실제 바이트 전달, 입력 버퍼 고정, 예상정답 미전송, 후보 중복·무확신도, 무발화, 형식·크기, 모델·완료 검증, 자격·주소, 오류 원문 비노출, 명시 재시도를 검사했다. 외부 API 호출은 모의 응답으로 대체한 단위 시험이다.

실제 연결 확인에는 `make-samples.ps1`이 Windows SAPI / Microsoft Heami Desktop으로 만든 자체 합성 `original.wav`를 사용했다. 생성 스크립트와 manifest, 실제 WAV의 크기·지문을 대조했다.

- 131,196 bytes
- SHA-256 `d9e45d3fb33a6060c3d9cde162a2ac1c395ee84c6cca0c14bc2d8e235328955b`
- 마이크 녹음·학생 자료가 아니라 리터럴 시연 문장에서 생성한 음성이다.
- 원고는 출처 확인에만 읽었으며 전사 요청에는 실제 WAV 바이트만 넣었다.
- 현재 일반 실행의 외부 연결은 Node 네트워크 EACCES로 막혔다. 실제 Gemini 응답과 전사 성공은 확인하지 못했다.
- 별도의 자동 승인 검토도 외부 전송의 승인·합성 출처가 확인되지 않았다는 이유로 거절했다. 이후 생성 기록·지문을 확보해 일반 실행을 재확인했지만 네트워크 차단은 같았다. 다른 도구나 계정으로 우회하지 않았다.
- **19:22 KST 사용자 승인 후 재시험:** 사용자가 ‘합성 음성의 전송·연결 시험 허용’이라고 명시 승인했다. 그 범위의 `original.wav` 한 파일만 manifest·실제 바이트 지문을 다시 대조해 기존 Gemini 경로로 1회 호출했다. 이전의 사용자 승인 조건은 해결됐지만, 실행 환경은 여전히 `EACCES`로 외부 연결을 차단했다. Google HTTP 응답·전사·원응답 지문은 얻지 못했다. 증거는 `C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본/_작업/patent_focus/stt-approved-attempt.json`에 보존했다. 증거에는 자격정보·인증 헤더를 넣지 않았고, 모델 입력에는 예상 원고를 넣지 않았다.

따라서 현재 확인 완료는 **어댑터와 실패 처리의 단위 규칙, 합성 음성의 출처·바이트 연결**이다. 실제 외부 전사 성공, 제품 DB 연결, 학생 녹음의 정확도는 완료 범위에 넣지 않는다. 수동 경로에서는 `text`를 지어내지 않고 저장한 원음을 실제로 들은 사람이 별도 청취 전사로 입력한다.

로컬 인식도 확인했다. Windows SAPI 인식 토큰 조회는 실패했고 인식기 등록 토큰이 확인되지 않았다. 기존 `Systran/faster-whisper-small` 스냅샷 `536b0662742c02347bc0e980a01041f333bce120`과 faster-whisper 1.2.1·CTranslate2 4.8.2·PyAV 18.1.0 설치는 존재한다. 그러나 기존 Python 3.14 기본 실행 파일은 이 실행 환경에서 접근 거부, 가상환경 런처는 실행 실패였다. 실행 가능한 번들 Python 3.12와 설치된 cp314 바이너리는 호환되지 않는다.

이후 음성을 보내지 않는 로컬 대안을 위해, 저장소 밖 `C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/_runtime/patent-stt`에 번들 Python 3.12의 별도 venv를 만들었다. [공식 faster-whisper 설치 안내](https://github.com/SYSTRAN/faster-whisper)에 따라 공식 PyPI에서 호환 wheel만 받는 설치를 시도했으나, 인덱스 통신이 WinError 10013(소켓 접근 권한 거부)으로 차단됐다. 기존 pip HTTP 캐시 조회도 WinError 5(접근 거부)였다. 설치 패키지·새 모델은 내려받지 않았으며 기존 런타임은 바꾸지 않았다. 따라서 로컬 인식 성공도 확인하지 못했고 `provider=local`을 구현 완료나 사용 가능으로 표시하지 않는다. 다른 통로로 다운로드하거나 보호 조치를 우회하지 않았다.
