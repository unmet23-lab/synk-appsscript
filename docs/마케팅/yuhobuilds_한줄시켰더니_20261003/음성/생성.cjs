// 연결된 voice-connection.cjs(127.0.0.1:5213)에 학습 → 대사 생성을 차례로 시킨다. 키는 이 스크립트가 모른다.
// 실행(음성 폴더 밖 어디서든): node 음성/생성.cjs [--clone] [--force id,id]
//   --clone   학습 목소리가 하나도 없을 때 학습/yuho_typecast_train.wav로 퀵 클로닝을 한 번 만든다
//   --force   이미 만든 대사도 다시 만든다(쉼표로 id)
const base = 'http://127.0.0.1:5213';
const post = async (route, body) => {
  const r = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const data = await r.json();
  if (!r.ok) throw Error(route + ' ' + r.status + ' ' + (data.error || JSON.stringify(data)));
  return data;
};
(async () => {
  const status = await (await fetch(base + '/status')).json();
  if (!status.connected) throw Error('아직 연결 전');
  const force = (process.argv[process.argv.indexOf('--force') + 1] || '').split(',').filter((x) => process.argv.includes('--force') && x);
  if (process.argv.includes('--clone') && status.voices === 0) {
    const made = await post('/clone', { file: '학습/yuho_typecast_train.wav', name: '유호' });
    console.log('학습', JSON.stringify(made.made), '목소리 수', made.voices.length);
  }
  const plan = require('./voice-plan.json');
  for (const s of plan.segments) {
    const res = await post('/generate', { id: s.id, force: force.includes(s.id) });
    console.log(s.id, res.cached ? '있음' : `${res.duration}초 · 낱말 ${res.words}${res.fallback ? ' · 감정 preset으로 대신' : ''}`);
  }
})().catch((e) => { console.error('멈춤:', e.message); process.exit(1); });
