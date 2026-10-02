const fs=require('node:fs'),path=require('node:path'),root=__dirname;
const T=JSON.parse(fs.readFileSync(path.join(root,'timing.json'),'utf8'));
const phrases={
 '01':['오늘은 AI로 출석 앱 만들다,','정작 출석을 까먹은 얘깁니다.'],
 '02':['이 한 줄부터 정했다면,','덜 헤맸을 거예요.'],
 '03':['몽골 학원에서 일하던 유월.','번역하려고 클로드를 결제했어요.'],
 '04':['학생 문의가 늘자,','출석 앱도 만들고 싶어졌죠.'],
 '05':['문제는, 개발을 하나도 몰랐다는 거.'],
 '06':['화면 찍고, 물어보고,','그대로 따라 했습니다.'],
 '07':['그런데 이 기능도 좋아 보이고,','저것도 넣고 싶고.'],
 '08':['기능은 늘었는데,','정작 출석은 뒷전.','나 뭐 만들고 있었지?'],
 '09':['지금 다시 한다면,','완성의 기준부터','한 줄로 정하겠어요.'],
 '10':['학생 한 명의 출석을 저장하고,','다시 확인할 수 있게.'],
 '11':['화면으로 볼게요.','이름을 고르고, 출석 저장.'],
 '12':['목록에 남았죠?','다시 열어도 기록이 보이면,','첫 단계 완료!'],
 '13':['AI에게는 이렇게 말해보세요.','나는 개발이 처음이야.'],
 '14':['학생 한 명의 출석을 저장하고,','다시 확인하고 싶어.'],
 '15':['추가 기능은 빼고,','가장 쉬운 방법과','확인 순서를 알려줘.'],
 '16':['작게 완성하고,','확인한 뒤, 다음 기능.','순서가 생겼죠?'],
 '17':['제가 헤맨 길,','여러분은 건너뛰세요.'],
 '18':['왕초보에서 일인 기업가까지.','여러분의 시간을 아껴드립니다!']
};
const normalize=s=>s.replace(/\s+/g,'');T.captions=[];
for(const s of T.segments){let word=0;for(const phrase of phrases[s.id]){const count=phrase.split(/\s+/).length,group=s.words.slice(word,word+count);if(normalize(group.map(w=>w.text).join(' '))!==normalize(phrase))throw Error('Caption alignment mismatch '+s.id);T.captions.push({start:s.start+group[0].start,end:Math.min(s.start+s.duration,s.start+group.at(-1).end+.08),text:phrase,segment:s.id});word+=count;}if(word!==s.words.length)throw Error('Omitted words '+s.id);}
T.captions.forEach((c,i)=>{if(T.captions[i+1])c.end=Math.min(c.end,T.captions[i+1].start-.01);});
const fmt=t=>{const ms=Math.round(t*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`};
fs.writeFileSync(path.join(root,'timing.json'),JSON.stringify(T,null,2)+'\n');
fs.writeFileSync(path.join(root,'yuhobuilds_EP01_자막.srt'),T.captions.map((c,i)=>`${i+1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`).join('\n'));
console.log(T.captions.length+' meaning-based captions aligned; no overlapping intervals.');
