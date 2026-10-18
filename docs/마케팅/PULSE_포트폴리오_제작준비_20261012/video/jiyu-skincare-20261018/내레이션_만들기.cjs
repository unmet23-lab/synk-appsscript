// 지유 스킨케어 광고 내레이션(콘티 v2 2절)을 타입캐스트로 만든다. 설정은 voices.json F20fb-voice-1(유라 · normal · 1.0배 · seed 1018)과 같다.
//   node 내레이션_만들기.cjs        → Documents/synk-vendor/jiyu-skincare-20261018/내레이션/*.wav (이미 있는 파일은 건너뜀)
// 키: 환경 변수 TYPECAST_API_KEY, 없으면 ~/SYNK_보안/타입캐스트.txt(메모리에서만 쓰고 출력하지 않는다). 1글자 = 1크레딧.
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(os.homedir(), 'Documents', 'synk-vendor', 'jiyu-skincare-20261018', '내레이션');
const VOICES = path.join(__dirname, '..', '..', '..', 'PULSE_AI모델_캐스팅_20260930', 'voices.json');
const LINES = [
  ['1_세안하고', '세안하고, 삼 초.'],
  ['2_피부가먼저', '피부가 먼저, 숨 쉬게.'],
  ['2b_피부부터', '피부부터, 숨 쉬게.'],
  ['3_맑음', '맑음.'],
  // 10-18 받아쓰기에서 「맑음.」 한 낱말이 「발끔」으로 들렸다(현장 노트 「Typecast가 기호·낱말 하나를 엉뚱하게 읽는다」) → 소리대로 쓴 판과 문맥을 붙인 판을 견준다
  ['3a_말금', '말금.'],
  ['3b_맑음토너', '맑음 토너.'],
];

function key() {
  if (process.env.TYPECAST_API_KEY) return process.env.TYPECAST_API_KEY.trim();
  return fs.readFileSync(path.join(os.homedir(), 'SYNK_보안', '타입캐스트.txt'), 'utf8').trim();
}

async function main() {
  const v = JSON.parse(fs.readFileSync(VOICES, 'utf8')).find((x) => x.name === 'F20fb-voice-1');
  if (!v || v.engine !== 'typecast') throw new Error('voices.json에 F20fb-voice-1(타입캐스트)이 없다');
  fs.mkdirSync(ROOT, { recursive: true });
  const k = key();
  let chars = 0;
  for (const [name, text] of LINES) {
    const out = path.join(ROOT, `${name}.wav`);
    if (fs.existsSync(out)) { console.log('있음', name); continue; }
    const res = await fetch('https://api.typecast.ai/v1/text-to-speech', {
      method: 'POST',
      headers: { 'X-API-KEY': k, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seed: v.seed, model: v.model, voice_id: v.voiceId, text, language: 'kor',
        output: { audio_format: 'wav', audio_tempo: v.tempo, target_lufs: -17 },
        prompt: { emotion_type: 'preset', emotion_preset: v.emotion, emotion_intensity: 1.0 },
      }),
    });
    if (!res.ok) throw new Error(`typecast ${res.status} ${name}`);
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    chars += [...text].length;
    console.log('만듦', name, [...text].length + '자');
  }
  console.log('쓴 글자', chars, '→', ROOT);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
