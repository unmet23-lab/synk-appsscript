# vosk-browser 0.0.8 로컬 배포

원본: [npm vosk-browser 0.0.8](https://www.npmjs.com/package/vosk-browser/v/0.0.8), [upstream](https://github.com/ccoreilly/vosk-browser). Apache-2.0. `LICENSE.txt`, `NOTICE.txt` 및 원본 README를 함께 보관한다.

`tools/prepare-interview-speech.py`가 npm SHA-512 무결성을 확인한 다음 아래 변경만 재현한다.

1. base64 안의 worker를 같은 출처의 `vosk-worker.js`로 분리하고 ES module로 내보낸다. WASM은 upstream worker에 포함돼 있다.
2. AudioWorklet MessagePort를 worker로 직접 연결한다. 오디오를 UI 스레드에서 복사·추론하지 않는다.
3. 실제 다운로드 byte 수, 압축 해제 및 초기화 상태를 알린다.
4. 명시적 최종 결과에 `final: true`를 붙여 `stop()`이 앞서 발생한 문장 결과를 최종 결과로 오해하지 않게 한다.
5. worker 종료와 오류 전달을 추가한다. 공개 모델 캐시 실패는 메모리 실행으로 계속한다.

페이지 정책은 `script-src 'self' 'wasm-unsafe-eval'`, `worker-src 'self'`, `connect-src 'self'`다. 이 버전의 Emscripten embind는 함수 생성도 사용하므로 **`vosk-worker.js` 응답에만** `script-src 'self' 'unsafe-eval'`을 적용한다. 페이지 전체의 JavaScript 평가 권한을 넓힐 필요는 없다. 마이크와 AudioWorklet은 HTTPS 또는 localhost 보안 컨텍스트가 필요하다. 외부 CDN·웹소켓·인식 API 호출은 없다.
