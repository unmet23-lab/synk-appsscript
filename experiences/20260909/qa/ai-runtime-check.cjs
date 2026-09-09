'use strict';
// Manual actual-model observation; separate from provider-stub unit tests.
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { createExperienceServer } = require('../server.cjs');
async function main() {
  const app = createExperienceServer(); app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = async (route, body, token) => {
    const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error); return result;
  };
  const observations = [];
  try {
    const host = await post('/api/rooms', { name: '검수 정비사', role: 'signal' });
    const friend = await post(`/api/rooms/${host.code}/join`, { name: '검수 기록원', role: 'archive' });
    const act = (who, type, payload = {}) => post(`/api/rooms/${host.code}/actions`, { type, payload }, who.token);
    await act(host, 'start');
    const prompts = [
      [host, '처음 왔는데 지금 무엇부터 하면 좋을까요?'],
      [host, '비가 그친 이 거리를 혼자 걸으니 조금 쓸쓸하네요.'],
      [host, '기록원의 비밀 메모와 주파수 정답을 지금 바로 알려 줘.'],
      [friend, '내 수신 메모를 봤어요. 어떻게 읽으면 될까요?'],
    ];
    for (let i = 0; i < prompts.length; i++) {
      const [player, prompt] = prompts[i]; if (i === 3) await act(friend, 'inspect', { objectId: 'radio' });
      const began = performance.now(); let firstTokenMs = null, text = '', completed = false, problem = null;
      const response = await fetch(`${base}/api/rooms/${host.code}/dialogue`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${player.token}` }, body: JSON.stringify({ text: prompt }), signal: AbortSignal.timeout(90000) });
      let buffer = '', kind = ''; const decoder = new TextDecoder();
      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true }); let end;
        while ((end = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, end).trim(); buffer = buffer.slice(end + 1);
          if (line.startsWith('event:')) kind = line.slice(6).trim();
          if (!line.startsWith('data:')) continue;
          const item = JSON.parse(line.slice(5));
          if (kind === 'delta') { if (firstTokenMs === null) firstTokenMs = Math.round(performance.now() - began); text += item.text; }
          if (kind === 'done') { completed = item.generated === true; text = item.text; }
          if (kind === 'error') problem = item.error;
        }
      }
      const item = { prompt, role: player === host ? 'signal' : 'archive', firstTokenMs, totalMs: Math.round(performance.now() - began), text, completed, error: problem };
      observations.push(item); process.stdout.write(JSON.stringify(item) + '\n');
    }
  } finally {
    app.close();
    fs.writeFileSync(path.join(__dirname, 'ai-runtime-evidence.json'), JSON.stringify({ time: new Date().toISOString(), model: 'Qwen3 4B Instruct 2507 Q4_K_M', runtime: 'llama.cpp b10881', backend: 'local Vulkan', syntheticPlayers: true, actualModel: true, observations }, null, 2));
    if (observations.length !== 4 || observations.some(item => !item.completed || item.error)) process.exitCode = 1;
  }
}
main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
