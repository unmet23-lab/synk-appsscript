import { VOICE_LINES, validateVoiceManifest } from './beginner-core.mjs';

// A manifest is an approval/delivery contract, never permission to generate a voice or use OS TTS.
export class BeginnerVoice {
  constructor() { this.urls = new Map(); this.audio = new Audio(); this.audio.preload = 'auto'; this.token = 0; this.playing = false; this.finish = null; this.ready = false; }
  async prepare({ refresh = false } = {}) {
    if (this.ready && !refresh) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const staged = new Map();
    try {
      const root = new URL('./assets/beginner/', import.meta.url);
      const response = await fetch(new URL('voices.json', root), { signal: controller.signal, cache: 'no-cache' });
      if (!response.ok) throw new Error('소리 목록을 불러오지 못했어요. 연결을 확인하고 다시 눌러 주세요.');
      const manifest = await response.json(); validateVoiceManifest(manifest);
      for (const line of VOICE_LINES) {
        const response = await fetch(new URL(manifest.clips[line.id].file, root), { signal: controller.signal });
        if (!response.ok) throw new Error('한국어 소리를 모두 불러오지 못했어요. 다시 눌러 주세요.');
        const blob = await response.blob();
        if (blob.size < 100) throw new Error('한국어 소리 파일이 비어 있어요.');
        staged.set(line.id, URL.createObjectURL(blob));
      }
      for (const url of this.urls.values()) URL.revokeObjectURL(url);
      this.urls = staged; this.ready = true;
    } catch (error) {
      for (const url of staged.values()) URL.revokeObjectURL(url);
      if (error.name === 'AbortError') throw new Error('소리를 준비하는 데 시간이 걸려요. 연결을 확인하고 다시 눌러 주세요.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  play(id) {
    this.stop();
    if (!this.ready || !this.urls.has(id)) return Promise.resolve(false);
    const token = ++this.token; this.playing = true;
    return new Promise(resolve => {
      let timer;
      const finish = success => {
        if (token !== this.token) return;
        clearTimeout(timer); this.playing = false; this.audio.pause(); this.audio.onended = null; this.audio.onerror = null; this.audio.onloadedmetadata = null; this.finish = null; resolve(success);
      };
      this.finish = () => finish(false);
      this.audio.src = this.urls.get(id);
      this.audio.onended = () => finish(true);
      this.audio.onerror = () => finish(false);
      const guard = () => { clearTimeout(timer); timer = setTimeout(() => finish(Number.isFinite(this.audio.duration) && this.audio.currentTime >= this.audio.duration - .05), (Number.isFinite(this.audio.duration) ? this.audio.duration + 3 : 12) * 1000); };
      this.audio.onloadedmetadata = guard; guard();
      this.audio.play().catch(() => finish(false));
    });
  }
  stop() { this.finish?.(); this.token++; this.audio.pause(); this.playing = false; }
}
