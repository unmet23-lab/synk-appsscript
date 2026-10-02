const fs=require('node:fs');
const d=JSON.parse(fs.readFileSync('voice-timing.json'));
const lines=['# synkbrief v18 · 실제 영상 자막 기반 대본','','23장면 · 53개 자막 · 159.70초. 기존 Typecast 은경 여성 내레이션을 사용한다. 아래 문장은 실제 음성에 맞춘 자막을 장면별로 이어 적은 검토용 대본이다. 합성 예정 초안이 아니다.',''];
for(const [i,s]of d.clips.entries()){const text=d.captions.filter(c=>c.start>=s.start&&c.end<=s.start+s.duration+.01).map(c=>c.text).join(' ');lines.push(`## ${String(i+1).padStart(2,'0')} · ${s.id}`,'',text,'');}
fs.writeFileSync('낭독대본.md',lines.join('\n'));
