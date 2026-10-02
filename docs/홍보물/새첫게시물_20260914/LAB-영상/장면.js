/* Browser canvas renderer. Deterministic local phrase motion, no realtime student input. */
window.makeLabStage=async function(D,S){
  const fonts=[];
  for(const f of D.fonts){const face=new FontFace(f.family,`url(${f.uri})`,{weight:f.weight});await face.load();document.fonts.add(face);fonts.push({family:f.family,weight:f.weight,status:face.status});}
  const load=async src=>{const i=new Image();i.src=src;await i.decode();return i;};
  const [logo,paper,book]=await Promise.all([load(D.logo),load(D.paper),load(D.book)]);
  const c=document.querySelector('canvas');c.width=S.width;c.height=S.height;
  const g=c.getContext('2d',{alpha:false}),C=D.colors,M=S.mn;
  let checks=[];const ease=x=>{const p=Math.max(0,Math.min(1,x));return 1-Math.pow(1-p,3);};
  function parts(s,size,w,mono=false){return [...s].reduce((a,ch)=>{const ko=/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(ch);const mn=/[\u0400-\u04FF]/.test(ch);const family=ko?'SUIT Variable':mono?'DM Mono':'Inter Tight';const weight=ko?w:mono?500:Math.min(w,700);const fs=mn?size*1.04:size;const last=a.at(-1);if(last&&last.family===family&&last.weight===weight&&last.size===fs)last.text+=ch;else a.push({text:ch,family,weight,size:fs});return a;},[]);}
  function measure(s,size,w,mono=false){return parts(s,size,w,mono).map(p=>{g.font=`${p.weight} ${p.size}px "${p.family}"`;g.letterSpacing=(mono?.02:-.02)*p.size+'px';const m=g.measureText(p.text);return {...p,width:m.width,ascent:m.actualBoundingBoxAscent,descent:m.actualBoundingBoxDescent};});}
  function text(s,x,y,size=54,w=500,color=C.ink,maxWidth=816,mono=false){const pp=measure(s,size,w,mono),width=pp.reduce((a,p)=>a+p.width,0);if(width>maxWidth+.1)throw Error('Text overflow: '+s+' '+width);let dx=x;for(const p of pp){g.font=`${p.weight} ${p.size}px "${p.family}"`;g.letterSpacing=(mono?.02:-.02)*p.size+'px';g.fillStyle=color;g.fillText(p.text,dx,y);dx+=p.width;}checks.push({text:s,x,y,width,top:y-Math.max(...pp.map(p=>p.ascent)),bottom:y+Math.max(...pp.map(p=>p.descent)),runs:pp});return width;}
  function wrap(s,x,y,size=54,w=500,color=C.ink,maxWidth=816,line=1.38){let row='',yy=y;for(const word of s.split(' ')){const next=row?row+' '+word:word;if(measure(next,size,w).reduce((a,p)=>a+p.width,0)>maxWidth&&row){text(row,x,yy,size,w,color,maxWidth);yy+=size*line;row=word;}else row=next;}if(row)text(row,x,yy,size,w,color,maxWidth);return yy;}
  function panel(x,y,w,h){g.fillStyle=C.oat;g.fillRect(x,y,w,h);}
  function rule(y,x=88,w=816){g.fillStyle=C.stone;g.fillRect(x,y,w,2);}
  function enter(age,delay,fn){const p=ease((age-delay)/.38);if(p<=0)return;g.save();g.globalAlpha=p;g.translate(0,(1-p)*12);fn();g.restore();}
  function header(mn,age){enter(age,0,()=>wrap(mn,88,465,61,700));}
  function sentence(phrase,y=830,highlight=false,offset=0,alpha=1){
    text('아직 정하지 않았어요.',116,y,69,800,C.ink,760);
    text('먼저',116,y+119,69,800,C.ink,760);
    if(highlight){g.fillStyle=C.paper;g.fillRect(270,y+50,560,91);}
    g.save();g.globalAlpha*=alpha;g.translate(offset,0);text(phrase,283,y+119,69,800,highlight?C.coral:C.ink,552);g.restore();
    text('보고 싶어요.',116,y+229,69,800,C.ink,760);
  }
  function mark(p,y,w=490,x=283){g.fillStyle=C.coral;g.fillRect(x,y,w*ease(p),5);}
  function sketch(kind,x,y){g.save();g.translate(x,y);g.strokeStyle=C.ink;g.lineWidth=4;g.lineJoin='round';g.beginPath();if(kind==='game'){g.moveTo(0,40);g.lineTo(88,7);g.lineTo(170,38);g.lineTo(90,77);g.closePath();g.moveTo(0,40);g.lineTo(0,121);g.lineTo(90,164);g.lineTo(170,120);g.lineTo(170,38);g.moveTo(90,77);g.lineTo(90,164);}else if(kind==='video'){g.rect(0,25,170,115);g.moveTo(0,52);g.lineTo(170,52);g.moveTo(30,25);g.lineTo(45,52);g.moveTo(75,25);g.lineTo(90,52);g.moveTo(120,25);g.lineTo(135,52);g.moveTo(25,112);g.lineTo(75,70);g.lineTo(115,112);}else{g.rect(5,25,156,130);g.moveTo(0,168);g.lineTo(174,168);g.moveTo(38,129);g.lineTo(143,0);g.lineTo(158,10);g.lineTo(53,141);g.closePath();}g.stroke();g.restore();}
  function draw(frame){
    const t=Math.min(frame/S.fps,S.duration-1/S.fps),sc=S.scenes.find(s=>t>=s.start&&t<s.end),age=t-sc.start;
    checks=[];g.globalAlpha=1;g.fillStyle=C.paper;g.fillRect(0,0,1080,1920);g.globalAlpha=.28;g.drawImage(paper,0,0,1080,1920);g.globalAlpha=1;
    g.drawImage(logo,88,258,285,285*logo.height/logo.width);
    text(String(S.scenes.indexOf(sc)+1).padStart(2,'0')+' / 07',758,318,28,500,C.muted,180,true);
    if(sc.id==='purpose'){
      enter(age,0,()=>wrap(M.purpose,88,520,69,700));
      enter(age,.14,()=>wrap(D.vision,88,880,55,800));
      g.drawImage(book,430,1110,470,470);text(M.example,88,1460,40,500,C.muted);
      mark(age/.6,1050,300,88);
    }else if(sc.id==='question'){
      text(M.conversation,88,442,40,500,C.muted);
      panel(88,520,816,432);text('어떤 전공을',116,659,82,800,C.ink,760);text('배우고 싶어요?',116,777,82,800,C.ink,760);
      enter(age,1.4,()=>wrap(M.question,88,1092,62,700));
    }else if(sc.id==='model'){
      header(M.then,age);panel(88,657,816,510);sentence(S.phrases[0],785);
      enter(age,1.2,()=>wrap(M.undecided,88,1300,52,500));
      enter(age,1.35,()=>wrap(M.game,88,1435,52,500));
    }else if(sc.id==='change'){
      header(M.change,age);panel(88,660,816,500);
      const n=age<3?0:age<6.5?1:2,local=age-(n===0?0:n===1?3:6.5);const p=ease(local/.4);
      sentence(S.phrases[n],785,true,n===0?0:(1-p)*24,n===0?1:p);mark(age/.7,925);
      wrap([M.game,M.video,M.drawing][n],88,1310,57,700);
      text(M.example,88,1480,40,500,C.muted);
    }else if(sc.id==='practice'){
      header(M.yours,age);panel(88,604,816,394);
      text('아직 정하지 않았어요.',116,718,66,800,C.ink,760);text('먼저 ______ 보고 싶어요.',116,836,65,800,C.ink,760);
      S.phrases.forEach((p,i)=>text(p,88,1110+i*83,61,800,C.coral));
      wrap(M.insert,88,1400,45,700,C.ink);wrap(M.solo,88,1580,40,500,C.muted);
    }else if(sc.id==='examples'){
      text(M.example,88,442,40,500,C.muted);
      const n=age<4.5?1:2;panel(88,575,816,518);sentence(S.phrases[n],719,true);
      wrap(M.undecided,88,1240,52,500);wrap(n===1?M.video:M.drawing,88,1390,56,700);
      mark((age%(4.5))/.55,859);
    }else{
      header(M.next,age);
      const rows=[['game','게임 장면 하나 그리기',M.gameAction],['video','짧은 영상 한 장면 찍기',M.videoAction],['draw','좋아하는 물건 그리기',M.drawAction]];
      rows.forEach((r,i)=>{const y=745+i*235;sketch(r[0],88,y-45);text(r[1],309,y,48,800,C.ink,605);wrap(r[2],309,y+80,44,700,C.ink,595);});
      wrap(M.private,88,1535,38,500,C.muted);
    }
    rule(1660);
    const critical=checks.filter(x=>x.y<1660&&x.y>350);const unsafe=critical.filter(x=>x.top<240||x.bottom>1640||x.x<72||x.x+x.width>930);
    if(unsafe.length)throw Error('Unsafe text '+JSON.stringify(unsafe));
    return {scene:sc.id,t,checks,unsafe,data:c.toDataURL('image/png').split(',')[1]};
  }
  function cacheKey(f){const t=f/S.fps,sc=S.scenes.find(s=>t>=s.start&&t<s.end)||S.scenes.at(-1),a=t-sc.start;let dynamic=a<1.8;
    if(sc.id==='change')dynamic=dynamic||(a>=3&&a<3.45)||(a>=6.5&&a<6.95);
    if(sc.id==='examples')dynamic=dynamic||(a>=4.5&&a<5.1);
    return dynamic?'f'+f:sc.id+':'+(sc.id==='change'?(a<3?0:a<6.5?1:2):sc.id==='examples'?(a<4.5?1:2):0);
  }
  // These invisible DOM probes allow the actual selected glyph fonts to be audited.
  for(const [id,txt,fam,w] of [['mn','Өөрийн өгүүлбэрээ','Inter Tight','700'],['ko','아직 정하지 않았어요.','SUIT Variable','800']]){const e=document.createElement('span');e.id='probe-'+id;e.textContent=txt;e.style.cssText=`position:absolute;left:0;top:2000px;font: ${w} 64px "${fam}"`;document.body.append(e);}
  return {draw,cacheKey,fonts};
};
