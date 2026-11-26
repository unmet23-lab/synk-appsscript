// 솔리오 구독 방 소개용 예시 자료(모두 지어낸 값, example.com). ORB_QA_REAL로 넘긴다.
const fs=require('fs');const now=Date.now(),H=3600e3,D=864e5;
const row=(id,service,used,resetsAt,extra={})=>({id,service,source:'auto',label:service,kind:'weekly',state:'ok',plan:'pro',email:'member@example.com',currency:'KRW',live:{readAt:now-3*60e3,weekly:{usedPercent:used,resetsAt}},...extra});
const subs={ok:true,seq:1,check:{at:now-3*60e3},checking:false,rows:[
  row('s-c1','claude',28,now+4*D+3*H,{email:'work@example.com',plan:'max_5x',price:140000,billDay:2}),
  row('s-c2','claude',61,now+2*D+9*H,{email:'team@example.com',price:29000,billDay:18}),
  row('s-g1','gpt',100,now+19*H,{email:'work@example.com',price:29000,billDay:9}),
  row('s-m1','gemini',22,now+5*D+6*H,{email:'studio@example.com',price:29000,billDay:21}),
],usage:{accounts:{'s-c1':{rate3:4},'s-c2':{rate3:6},'s-g1':{rate3:9},'s-m1':{rate3:2}}},prices:null,settings:{usdKrw:1400}};
fs.writeFileSync(process.argv[2],JSON.stringify({subs,tokens:null},null,1));
