# 완주 후 시티팝 드라이브 음원

2026-10-04. 기존 SYNK 곡 **해안선**을 그대로 사용한다. 리듬 게임의 `one-hour-to-sea.mp3`와 레이싱의 `assets/music/coastline.mp3`는 SHA-256이 같다. 신규 음원 생성·결제·음질 재압축은 없다. 원래 제목 `바다까지 한 시간` → `해안선` 변경 근거는 `../korean-rhythm/qa/citypop-20261001/creation-brief.json`, 녹음 ID와 재생 정보는 `../korean-rhythm/suno-tracks.mjs`에 있다. 기계 판독 출처는 `assets/music/sources.json`이다.

## 앱 연결 계약

`createCoastRadio({getContext,onUnavailable})`는 앱 소유의 AudioContext를 재사용한다. `onUnavailable(message)`는 음악 오류 안내용이며 드라이브 중단을 요구하지 않는다.

- 최초 생성: media 요소조차 만들지 않는다. 곡 요청 0건.
- `unlock()`: 사용자 클릭의 동기 구간에서 기존 AudioContext가 생성된 직후 호출. 동일 media 요소의 0.01초 인라인 무음 WAV로 활성화를 시도하며 곡을 요청하지 않는다. 반환 Promise의 오류는 내부 처리한다.
- `prepare()`: 마지막 문제가 나올 무렵 1회 호출. MP3를 지연 로딩한다. 음악은 아직 재생하지 않는다.
- `setState({active,enabled,paused,duck})`: 모든 인수는 부분 갱신할 수 있다. 마지막 문제를 마친 완주 세션에서 active=true이며, 결과 화면을 열면 active를 유지하고 paused=true로 정지한다. 드라이브로 복귀하면 보존한 위치부터 이어 듣는다. 음소거·일시정지·탭 숨김 때에도 enabled=false 또는 paused=true로 위치를 보존한다. 나레이션이 말하는 동안 duck=true.
- `stop()`: 다음 챕터 선택·홈 진입처럼 완주 세션을 떠날 때 active=false, 즉시 무음 및 처음 위치로 되감는다. 결과 화면 왕복에는 stop()을 호출하지 않는다.
- `dispose()`: 실제 앱 해제 때 media와 Web Audio 노드를 정리하며 공유 Context는 닫지 않는다.
- `snapshot()`: prepared/playing/pending/blocked/error/time/targetGain 및 활성 상태를 제공한다. 자동재생이 거절되면 화면에 소리 켜기 입력을 제공하고 그 입력에서 unlock()으로 다시 시도한다.

루프 재생하는 HTMLAudioElement → 공유 Context의 MediaElementSource → Gain → destination 연결이다. 전곡 `fetch/arrayBuffer/decodeAudioData`를 하지 않는다. 기본 gain 0.38, 나레이션 중 0.09로 감쇠하고 음량 전환은 Web Audio target ramp를 사용한다. 정지·숨김·음소거는 즉시 멈춘다. 동시에 미해결 `play()` 요청은 최대 1개이며 이전 요청의 늦은 성공/실패는 현재 라운드를 덮지 못한다.

## 모듈 검증

`node --test tests/coast-radio.test.mjs`: **9/9 통과**. 초기 다운로드 없음, 지연 로딩 1회, 단일 노드 연결, 페이드·나레이션 감쇠, 음소거·일시정지의 위치 보존, stop() 호출의 되감기, 늦은 play 성공/AbortError, 자동재생 거절 재시도, media error 경합, dispose 뒤 재생 부활 방지를 mock으로 확인했다.

`tests/coast-drive-integration.test.mjs`: **7/7 통과**. 실제 app 함수를 VM에서 실행해 완주 기록·보상 1회, 수동 결과 열기와 드라이브 복귀, 자동 시연 저장 없음, 결과·일시정지·음소거·숨김의 재생 정지와 복귀, 접촉 후 완료 기록 불변, 전오답 드라이브와 맞춤 부스트 속도 유지를 확인했다. DOM·미디어 장치 경계는 mock이므로 실제 화면·청음·브라우저 재생 정책의 증거는 아니다.

FFprobe: MP3 스테레오, 44,100 Hz, 231.6초, 4,633,256 bytes, 약 160 kbps. 두 로컬 원본의 SHA-256: `4580f5e5bc70dd735988c095ba785ae3e7ce144b0f6df021af538b2cbf448873`.

이 문서는 모듈과 음원 파일 검증이다. 실제 게임에서 마지막 문제 → 드라이브 → 음악 재생 → 결과 전환, 모바일 자동재생 정책과 실제 청음은 앱 통합 검수에서 별도로 확인한다.
