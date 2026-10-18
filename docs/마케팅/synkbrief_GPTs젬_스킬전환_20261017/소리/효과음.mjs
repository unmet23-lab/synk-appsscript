// synkbrief 「GPTs·젬」 v2 효과음을 ffmpeg로 만든다(새 생성·유료 호출 없음). 카타나 v4의 tick·tok·swish와 같은 방식.
//   node docs/마케팅/synkbrief_GPTs젬_스킬전환_20261017/소리/효과음.mjs
// 결과: 소리/sfx/<이름>.wav(48kHz 모노) + 소리/효과음_모음.mp3(이름 순서대로 0.6초 간격, 귀 확인용) + 소리/sfx/목록.json
// Fable 검수(10-17) 장면별 목록: 테이프 톡·형광펜 쓱·딩·부저·스프링 팝·링 틱·선택 틱·스탬프·커서 클릭·철컥·헛클릭·펀치·체크 딩·끝 스팅.
// 키트 사운드킷(docs/브랜드_사운드킷)에 없는 「톡·쓱·철컥·헛클릭 부저」는 귀 확인 뒤 사운드킷에 더한다.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'sfx');
fs.mkdirSync(OUT, { recursive: true });
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
const SR = 48000;
const ev = (expr, d) => ['-f', 'lavfi', '-i', `aevalsrc='${expr}':s=${SR}:d=${d}`];

// [이름, 쓰는 자리, ffmpeg 입력과 필터]
const SFX = [
  ['tok', '테이프·스티커·칩이 톡 붙음', ev('0.6*sin(2*PI*(523-180*t/0.07)*t)*exp(-t*55)', 0.08), ''],
  ['tick', '링 틱·선택 표시', ['-f', 'lavfi', '-i', `sine=f=2093:d=0.03:sample_rate=${SR}`], 'afade=t=out:st=0.004:d=0.026,volume=0.55'],
  ['swish', '형광펜 쓱·물건이 쓱 들어옴', ['-f', 'lavfi', '-i', `anoisesrc=color=pink:d=0.22:sample_rate=${SR}:amplitude=0.5`], 'bandpass=f=1800:width_type=q:w=0.8,afade=t=in:st=0:d=0.09,afade=t=out:st=0.09:d=0.13,volume=0.55'],
  ['ding', 'O 정답·체크', ev('0.32*sin(2*PI*1318.5*t)*exp(-t*6)+0.22*sin(2*PI*1975.5*t)*exp(-t*8)+0.06*sin(2*PI*2637*t)*exp(-t*12)', 0.6), 'afade=t=in:st=0:d=0.004'],
  ['buzz', '✕ 오답·헛클릭', ev('0.28*(sin(2*PI*150*t)+0.5*sin(2*PI*300*t)+0.33*sin(2*PI*450*t)+0.25*sin(2*PI*600*t))*(1-exp(-t*200))*exp(-t*5)', 0.32), 'lowpass=f=1600,afade=t=out:st=0.24:d=0.08'],
  ['buzz2', '헛클릭 두 번(06 잠김)', ev('0.26*(sin(2*PI*150*t)+0.5*sin(2*PI*300*t)+0.33*sin(2*PI*450*t))*(lt(mod(t,0.22),0.13))*exp(-mod(t,0.22)*9)', 0.44), 'lowpass=f=1500'],
  ['stamp', '날짜 칩 도장·✕ 도장', ev('0.85*sin(2*PI*(95-45*t/0.14)*t)*exp(-t*22)+0.35*(random(0)*2-1)*exp(-t*400)', 0.16), 'highpass=f=40'],
  ['lock', '자물쇠 철컥', ev('0.5*(random(0)*2-1)*(exp(-t*600)+exp(-max(0,t-0.055)*500)*gte(t,0.055))+0.18*sin(2*PI*2600*t)*exp(-max(0,t-0.055)*30)*gte(t,0.055)', 0.22), 'highpass=f=900'],
  ['click', '커서 클릭', ev('0.5*sin(2*PI*4200*t)*exp(-t*900)+0.35*sin(2*PI*1200*t)*exp(-t*300)', 0.04), ''],
  ['ripple', '클릭 리플(아주 약하게)', ev('0.18*sin(2*PI*(700+500*t/0.25)*t)*exp(-t*14)', 0.25), 'afade=t=in:st=0:d=0.01'],
  ['pop', '카드 스프링 등장', ev('0.45*sin(2*PI*(600+700*t/0.06)*t)*exp(-t*45)', 0.09), ''],
  ['punch', '하드컷 펀치 쿵', ev('0.9*sin(2*PI*(70-25*t/0.18)*t)*exp(-t*16)', 0.2), 'highpass=f=30'],
  ['whoosh', '전환(덮개·종이)', ['-f', 'lavfi', '-i', `anoisesrc=color=pink:d=0.36:sample_rate=${SR}:amplitude=0.55`], "bandpass=f=1400:width_type=q:w=0.6,afade=t=in:st=0:d=0.16,afade=t=out:st=0.18:d=0.18,volume=0.6"],
  ['freeze', '결과 0.75초 정지 띵', ev('0.25*sin(2*PI*1760*t)*exp(-t*7)+0.12*sin(2*PI*2640*t)*exp(-t*10)', 0.5), 'afade=t=in:st=0:d=0.004'],
  ['sting', '끝 소리', ev('0.2*sin(2*PI*523.25*t)*exp(-t*3)+0.17*sin(2*PI*659.25*max(0,t-0.05))*exp(-max(0,t-0.05)*3)*gte(t,0.05)+0.17*sin(2*PI*783.99*max(0,t-0.1))*exp(-max(0,t-0.1)*3)*gte(t,0.1)+0.1*sin(2*PI*1046.5*max(0,t-0.15))*exp(-max(0,t-0.15)*4)*gte(t,0.15)', 1.1), 'afade=t=in:st=0:d=0.005,afade=t=out:st=0.85:d=0.25'],
];

const list = [];
for (const [name, use, input, af] of SFX) {
  const file = path.join(OUT, name + '.wav');
  ff([...input, ...(af ? ['-af', af] : []), '-ar', String(SR), '-ac', '1', file]);
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());
  list.push({ name, use, dur: +dur.toFixed(3) });
}
fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify(list, null, 1) + '\n');

// 귀 확인용 모음: 이름 순서대로, 사이 0.6초. 음량은 −16 LUFS 안팎.
const gap = path.join(OUT, '_gap.wav');
ff(['-f', 'lavfi', '-i', `anullsrc=r=${SR}:cl=mono`, '-t', '0.6', gap]);
// 귀 확인용이라 소리마다 봉우리를 −6 dBFS로 맞춘다(실제 믹스의 음량은 장면마다 따로 정한다).
const inputs = [], chains = [], labels = [];
list.forEach((x, i) => {
  const f = path.join(OUT, x.name + '.wav');
  inputs.push('-i', f, '-i', gap);
  chains.push(`[${i * 2}:a]volume=__G${i}__dB[s${i}]`);
  labels.push(`[s${i}][${i * 2 + 1}:a]`);
});
const peaks = list.map((x) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-i', path.join(OUT, x.name + '.wav'), '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }); const m = /max_volume: (-?[\d.]+)/.exec(r.stderr || ''); return m ? Number(m[1]) : -6; });
const graph = chains.map((c, i) => c.replace(`__G${i}__`, (-6 - peaks[i]).toFixed(1))).join(';') + ';' + `${labels.join('')}concat=n=${list.length * 2}:v=0:a=1[o]`;
ff([...inputs, '-filter_complex', graph, '-map', '[o]', '-ar', '44100', '-b:a', '160k', path.join(HERE, '효과음_모음.mp3')]);
fs.rmSync(gap);
let t = 0;
const timeline = list.map((x) => { const at = +t.toFixed(2); t += x.dur + 0.6; return { at, ...x }; });
fs.writeFileSync(path.join(OUT, '목록.json'), JSON.stringify(timeline, null, 1) + '\n');
console.log(timeline.map((x) => `${x.at.toFixed(2)}s ${x.name} — ${x.use}`).join('\n'));
