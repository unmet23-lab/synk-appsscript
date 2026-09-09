'use strict';
// Optional, manual local installation. Nothing is downloaded by the game server.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const destination = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'), 'SYNK', 'pulse-ai');
const assets = [
  { name: 'llama-b10881-win-vulkan.zip', size: 35777324, sha: '1390bfabe8525b208a0d2ed8d77805d2e5c3a2a5d1f608a8bb768014d048eaac', url: 'https://github.com/ggml-org/llama.cpp/releases/download/b10881/llama-b10881-bin-win-vulkan-x64.zip' },
  { name: 'Qwen3-4B-Instruct-2507-Q4_K_M.gguf', size: 2497281120, sha: '3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597', url: 'https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/a06e946bb6b655725eafa393f4a9745d460374c9/Qwen3-4B-Instruct-2507-Q4_K_M.gguf' },
];
async function digest(file) { const h = crypto.createHash('sha256'); for await (const b of fs.createReadStream(file)) h.update(b); return h.digest('hex'); }
async function download(asset) {
  const final = path.join(destination, asset.name), part = final + '.part';
  if (fs.existsSync(final) && fs.statSync(final).size === asset.size && await digest(final) === asset.sha) return final;
  if (fs.existsSync(final) && !fs.existsSync(part)) fs.renameSync(final, part);
  // Fixed, independently verified byte ranges avoid long transfers stalling.
  // This small per-download resume file is not a service or background queue.
  const journal = part + '.ranges.json', chunkSize = 1024 * 1024;
  const count = Math.ceil(asset.size / chunkSize);
  let completed;
  if (fs.existsSync(journal)) {
    const saved = JSON.parse(fs.readFileSync(journal, 'utf8'));
    if (saved.sha !== asset.sha || saved.chunkSize % chunkSize !== 0) throw new Error('이어받기 기록이 다른 파일입니다.');
    const subdivisions = saved.chunkSize / chunkSize;
    completed = new Set(saved.completed.flatMap(index => Array.from({ length: subdivisions }, (_, j) => index * subdivisions + j)).filter(i => i < count));
  } else {
    const prefix = fs.existsSync(part) ? Math.min(fs.statSync(part).size, asset.size) : 0;
    completed = new Set(Array.from({ length: Math.floor(prefix / chunkSize) }, (_, i) => i));
  }
  const persist = () => { fs.writeFileSync(journal + '.tmp', JSON.stringify({ sha: asset.sha, chunkSize, completed: [...completed].sort((a,b)=>a-b) })); fs.renameSync(journal + '.tmp', journal); };
  persist(); const fd = fs.openSync(part, fs.existsSync(part) ? 'r+' : 'w+');
  const remaining = Math.max(0, asset.size - fs.fstatSync(fd).size), storage = fs.statfsSync(destination);
  if (storage.bavail * storage.bsize < remaining + 256 * 1024 * 1024) { fs.closeSync(fd); throw new Error('로컬 AI 파일을 마칠 디스크 공간이 부족합니다. 파일은 이어받을 수 있습니다.'); }
  fs.ftruncateSync(fd, asset.size);
  const todo = Array.from({ length: count }, (_, i) => i).filter(i => !completed.has(i));
  let cursor = 0, lastProgress = -1;
  async function worker() {
    while (cursor < todo.length) {
      const index = todo[cursor++], start = index * chunkSize, end = Math.min(asset.size, start + chunkSize) - 1;
      let succeeded = false;
      for (let attempt = 0; attempt < 5 && !succeeded; attempt++) {
        const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 60000);
        try {
          const response = await fetch(asset.url + '?download=true', { headers: { Range: `bytes=${start}-${end}` }, signal: controller.signal });
          if (response.status !== 206 || response.headers.get('content-range') !== `bytes ${start}-${end}/${asset.size}`) { await response.body?.cancel(); throw new Error(`HTTP range ${response.status}`); }
          let position = start;
          for await (const chunk of response.body) {
            if (position + chunk.length > end + 1) throw new Error('응답 범위 초과');
            fs.writeSync(fd, chunk, 0, chunk.length, position); position += chunk.length;
          }
          if (position !== end + 1) throw new Error('응답이 끊겼습니다.');
          completed.add(index); persist(); succeeded = true;
          const progress = Math.floor(completed.size / count * 10);
          if (progress !== lastProgress) { process.stdout.write(`${asset.name}: ${progress * 10}%\n`); lastProgress = progress; }
        } catch (error) { if (error.code === 'ENOSPC') throw new Error('디스크 공간이 부족해 다운로드를 중단했습니다.'); if (attempt === 4) throw new Error(`${asset.name}: 부분 다운로드 실패 (${error.code || error.name}). 같은 명령으로 이어받을 수 있습니다.`); }
        finally { clearTimeout(timer); }
      }
    }
  }
  const parallel = Math.min(16, Math.max(1, Number(process.env.PULSE_DOWNLOAD_WORKERS) || 8));
  try { const results = await Promise.allSettled(Array.from({ length: parallel }, worker)); const failed = results.find(r => r.status === 'rejected'); if (failed) throw failed.reason; }
  finally { fs.closeSync(fd); }
  if (await digest(part) !== asset.sha) {
    // Never promote unverified bytes. Clear the completed ranges so the same
    // manual command replaces every range instead of repeating a failed hash.
    completed.clear(); persist();
    throw new Error(`${asset.name}: SHA256이 공식 배포 기록과 다릅니다. 실행하지 않습니다. 완료 범위를 초기화했으니 같은 명령으로 다시 다운로드해 주세요.`);
  }
  fs.renameSync(part, final); fs.unlinkSync(journal); return final;
}
async function main() {
  if (process.platform !== 'win32') throw new Error('이 수동 설치기는 Windows용입니다. 다른 OS는 공식 llama.cpp와 GGUF를 설치하고 PULSE_LLAMA_BIN / PULSE_AI_MODEL을 지정하세요.');
  fs.mkdirSync(destination, { recursive: true });
  const files = await Promise.all(assets.map(download));
  const extraction = path.join(destination, 'llama-b10881');
  const command = 'Expand-Archive -LiteralPath $env:PULSE_INSTALL_ZIP -DestinationPath $env:PULSE_INSTALL_DEST -Force';
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, stdio: 'inherit', env: { ...process.env, PULSE_INSTALL_ZIP: files[0], PULSE_INSTALL_DEST: extraction } });
  if (result.status !== 0) throw new Error('실행 도구의 압축을 풀지 못했습니다.');
  process.stdout.write(`검증한 로컬 AI를 설치했습니다: ${destination}\n모델은 게임에서 대화를 요청할 때 실행합니다. 새 유료 API·시작 프로그램·서비스는 추가하지 않습니다.\n`);
}
if (require.main === module) main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
module.exports = { destination, assets };
