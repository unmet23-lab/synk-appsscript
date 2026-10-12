/* Microphone PCM stays on this device: AudioWorklet -> MessagePort -> Vosk worker. */
class InterviewCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.offset = 0;
    this.running = false;
    this.levelFrames = 0;
    this.levelEnergy = 0;
    this.port.onmessage = ({ data }) => {
      if (data.type === 'connect') {
        this.audioPort = data.port;
        this.recognizerId = data.recognizerId;
        this.running = true;
      } else if (data.type === 'flush') {
        this.running = false;
        this.sendChunk();
        // The final request shares the PCM port so it cannot overtake the tail.
        this.audioPort?.postMessage({ action: 'retrieveFinalResult', recognizerId: this.recognizerId });
      } else if (data.type === 'dispose') {
        this.running = false;
        this.audioPort?.close();
        this.audioPort = null;
      }
    };
  }

  sendChunk() {
    if (!this.offset || !this.audioPort) return;
    const data = this.offset === this.buffer.length ? this.buffer : this.buffer.slice(0, this.offset);
    this.audioPort.postMessage({ action: 'audioChunk', data, sampleRate, recognizerId: this.recognizerId }, [data.buffer]);
    this.buffer = new Float32Array(2048);
    this.offset = 0;
  }

  process(inputs) {
    if (!this.running) return true;
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let frame = 0; frame < channels[0].length; frame += 1) {
      let sample = 0;
      for (const channel of channels) sample += channel[frame] || 0;
      sample = Math.max(-1, Math.min(1, sample / channels.length));
      this.buffer[this.offset++] = sample * 32768;
      this.levelEnergy += sample * sample;
      this.levelFrames += 1;
      if (this.offset === this.buffer.length) this.sendChunk();
    }
    if (this.levelFrames >= sampleRate / 10) {
      this.port.postMessage({ type: 'level', value: Math.min(1, Math.sqrt(this.levelEnergy / this.levelFrames) * 4) });
      this.levelFrames = 0;
      this.levelEnergy = 0;
    }
    // The output is silent; never play microphone audio back to the headset.
    return true;
  }
}

registerProcessor('synk-interview-capture', InterviewCaptureProcessor);
