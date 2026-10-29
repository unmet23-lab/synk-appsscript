// 받아쓰기 일꾼(AudioWorklet, 2026-10-30 Gemini 길) — 마이크 · 견본 트랙을 16kHz PCM16 묶음으로 바꿔 연결 층에 넘긴다.
// 구글 live-api-web-console의 녹음 워클릿과 같은 꼴. 문맥이 16k로 열리면 그대로 옮기고, 아니면(다른 표본율) 선형 보간으로 줄인다.
class 받아쓰기 extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.묶음 = options?.processorOptions?.묶음 || 800; // 800표본 = 50ms
    this.비율 = sampleRate / 16000;
    this.자리 = 0; // 이번 블록 기준 다음 출력 표본의 입력 위치(-1이면 앞 블록의 마지막 표본)
    this.앞값 = 0;
    this.칸 = new Int16Array(this.묶음);
    this.n = 0;
  }

  넣기(v) {
    const s = v > 1 ? 1 : v < -1 ? -1 : v;
    this.칸[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    if (this.n === this.묶음) {
      this.port.postMessage(this.칸.buffer, [this.칸.buffer]);
      this.칸 = new Int16Array(this.묶음);
      this.n = 0;
    }
  }

  process(inputs) {
    const 칸 = inputs[0]?.[0];
    if (!칸 || !칸.length) return true;
    if (this.비율 === 1) {
      for (let i = 0; i < 칸.length; i++) this.넣기(칸[i]);
      return true;
    }
    let 위치 = this.자리;
    while (위치 < 칸.length - 1) {
      const i = Math.floor(위치);
      const a = i < 0 ? this.앞값 : 칸[i];
      this.넣기(a + (칸[i + 1] - a) * (위치 - i));
      위치 += this.비율;
    }
    this.자리 = 위치 - 칸.length;
    this.앞값 = 칸[칸.length - 1];
    return true;
  }
}

registerProcessor('받아쓰기', 받아쓰기);
