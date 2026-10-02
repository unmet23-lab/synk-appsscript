const colors=['#ff9386','#a8c7ff'];
export class Stage{
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});this.width=0;this.height=0;this.particles=[];this.flashes=[0,0];this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.resize();}
  resize(){const rect=this.canvas.getBoundingClientRect();this.width=rect.width;this.height=rect.height;const dpr=Math.min(devicePixelRatio||1,this.reduced?1.25:1.75);this.canvas.width=Math.max(1,Math.round(this.width*dpr));this.canvas.height=Math.max(1,Math.round(this.height*dpr));this.ctx.setTransform(dpr,0,0,dpr,0,0);}
  geometry(){const w=this.width,h=this.height;const bottomWidth=Math.min(w>=1600?670:590,w-24),judge=h-(w<700?172:164),top=Math.min(h*.31,judge-200);return {cx:w/2,top,judge,bottomWidth,topWidth:bottomWidth*.20};}
  projection(progress,g){const p=Math.max(0,progress),depth=p**1.55;return {y:g.top+(g.judge-g.top)*depth,width:g.topWidth+(g.bottomWidth-g.topWidth)*p**1.12};}
  xy(lane,progress,g){const p=this.projection(progress,g);return{x:g.cx+(lane-.5)*p.width/2,y:p.y,w:p.width/2*.82};}
  quad(x1,y1,w1,x2,y2,w2,fill,stroke){const c=this.ctx;c.beginPath();c.moveTo(x1-w1/2,y1);c.lineTo(x1+w1/2,y1);c.lineTo(x2+w2/2,y2);c.lineTo(x2-w2/2,y2);c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
  hit(lane,quality){this.flashes[lane]=quality>0?1:.18;if(this.reduced||quality===0)return;const g=this.geometry(),x=g.cx+(lane-.5)*g.bottomWidth/2;for(let i=0;i<13;i++){this.particles.push({x,y:g.judge,vx:(Math.random()-.5)*180,vy:-Math.random()*200-60,age:0,life:.3+Math.random()*.3,r:1.1+Math.random()*2.1,color:colors[lane]});}if(this.particles.length>100)this.particles.splice(0,this.particles.length-100);}
  draw(round,time,pressed,dt){
    const c=this.ctx,w=this.width,h=this.height;if(!w||!h)return;c.clearRect(0,0,w,h);const g=this.geometry();
    const pBeat=((Math.max(0,time)/round.beat)%1),pulse=Math.exp(-pBeat*7),drop=time>round.beat*64&&time<round.beat*96;
    if(!this.reduced){const halo=c.createRadialGradient(g.cx,g.top,2,g.cx,g.top,g.bottomWidth*.65);halo.addColorStop(0,`rgba(135,170,248,${.055+pulse*(drop?.06:.02)})`);halo.addColorStop(.55,'rgba(135,170,248,.01)');halo.addColorStop(1,'rgba(135,170,248,0)');c.fillStyle=halo;c.fillRect(0,g.top-g.bottomWidth*.7,w,g.bottomWidth*1.4);}
    const surface=c.createLinearGradient(0,g.top,0,g.judge+35);surface.addColorStop(0,'rgba(3,8,17,.10)');surface.addColorStop(.48,'rgba(4,10,21,.72)');surface.addColorStop(1,'rgba(4,9,17,.95)');this.quad(g.cx,g.top,g.topWidth,g.cx,g.judge+40,g.bottomWidth+42,surface,'rgba(135,170,248,.23)');
    for(let lane=0;lane<2;lane++){
      const t=this.xy(lane,0,g),b=this.xy(lane,1.06,g);const active=pressed.has(lane)||this.flashes[lane]>.01;
      if(active){const glow=c.createLinearGradient(0,g.top,0,g.judge);glow.addColorStop(0,'rgba(180,200,255,0)');glow.addColorStop(1,`rgba(${lane===0?'255,150,130':'150,185,255'},${Math.max(this.flashes[lane]*.23,pressed.has(lane)?.17:0)})`);this.quad(t.x,g.top,g.topWidth/2,b.x,b.y,(g.bottomWidth+42)/2,glow);}
      this.flashes[lane]=Math.max(0,this.flashes[lane]-dt*4.3);
    }
    for(let i=0;i<=2;i++){c.beginPath();c.moveTo(g.cx+(i-1)*g.topWidth/2,g.top);c.lineTo(g.cx+(i-1)*(g.bottomWidth+42)/2,g.judge+40);c.strokeStyle=i===0||i===2?'rgba(170,195,246,.4)':'rgba(150,170,210,.15)';c.lineWidth=i===0||i===2?1.3:1;c.stroke();}
    const approach=round.level.approach;
    const first=Math.floor(time/round.beat)-1,last=Math.ceil((time+approach)/round.beat);
    for(let b=Math.max(0,first);b<=last;b++){const p=1-(b*round.beat-time)/approach;if(p<0||p>1.03)continue;const a=this.projection(p,g);c.beginPath();c.moveTo(g.cx-a.width/2,a.y);c.lineTo(g.cx+a.width/2,a.y);c.strokeStyle=b%4===0?`rgba(165,188,235,${.17*p})`:`rgba(140,160,205,${.065*p})`;c.lineWidth=b%4===0?1.2:.6;c.stroke();}
    for(const note of [...round.notes].reverse()){
      if(note.state==='hit'||note.state==='missed'||note.state==='broken')continue;
      let p=1-(note.time-time)/approach;const tail=1-(note.endTime-time)/approach;if(tail>1.05||p<0)continue;
      p=Math.min(p,note.state==='holding'?1:1.05);const head=this.xy(note.lane,p,g);const color=colors[note.lane];
      if(note.duration){const a=this.xy(note.lane,Math.max(0,tail),g);const ribbon=c.createLinearGradient(0,a.y,0,head.y+1);ribbon.addColorStop(0,'rgba(157,186,239,.08)');ribbon.addColorStop(1,note.state==='holding'?'rgba(175,206,255,.55)':'rgba(135,170,237,.28)');this.quad(a.x,a.y,a.w*.66,head.x,head.y,head.w*.66,ribbon,color+'60');c.beginPath();c.moveTo(a.x,a.y);c.lineTo(head.x,head.y);c.strokeStyle=color+'8a';c.lineWidth=2;c.stroke();}
      this.drawNote(note.lane,p,g,color,false,note.state==='holding');
    }
    for(const q of round.questions){if(q.state!=='pending'||time<q.answerOpen)continue;const p=1-(q.time-time)/approach;if(p<0||p>1.04)continue;for(let lane=0;lane<2;lane++)this.drawNote(lane,p,g,colors[lane],true,q.intent===lane);}
    // The judgment line is aligned to the same point used by the timing model.
    const beam=c.createLinearGradient(g.cx-g.bottomWidth*.56,0,g.cx+g.bottomWidth*.56,0);beam.addColorStop(0,'rgba(170,198,255,0)');beam.addColorStop(.12,'rgba(165,190,245,.8)');beam.addColorStop(.5,'rgba(244,247,255,1)');beam.addColorStop(.88,'rgba(255,169,152,.8)');beam.addColorStop(1,'rgba(255,169,152,0)');
    c.save();c.shadowBlur=this.reduced?0:13;c.shadowColor='#b4cdff';c.strokeStyle=beam;c.lineWidth=2;c.beginPath();c.moveTo(g.cx-g.bottomWidth*.56,g.judge);c.lineTo(g.cx+g.bottomWidth*.56,g.judge);c.stroke();c.restore();
    for(let lane=0;lane<2;lane++){const a=this.xy(lane,1,g);c.fillStyle=pressed.has(lane)?'#fff':'#9daec98a';c.beginPath();c.arc(a.x,g.judge,pressed.has(lane)?3:1.8,0,Math.PI*2);c.fill();}
    if(!this.reduced){for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.age+=dt;if(p.age>p.life){this.particles.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=300*dt;c.globalAlpha=1-p.age/p.life;c.fillStyle=p.color;c.beginPath();c.arc(p.x,p.y,p.r,0,Math.PI*2);c.fill();}c.globalAlpha=1;}
  }
  drawNote(lane,p,g,color,question,held){const c=this.ctx,a=this.xy(lane,p,g),h=Math.max(3,9*p),depth=Math.max(2,4*p);if(!this.reduced){c.shadowBlur=(held?15:9)*p;c.shadowColor=color+'90';}const fill=c.createLinearGradient(0,a.y-h,0,a.y+depth);fill.addColorStop(0,question?'#fff':color);fill.addColorStop(.45,question?'#d9e2f5':'#dbe7ff');fill.addColorStop(.5,color);fill.addColorStop(1,question?'#697991':'#465a80');this.quad(a.x,a.y-h,a.w,a.x,a.y+depth,a.w,fill,color+'b0');c.shadowBlur=0;c.fillStyle='#fff9';c.fillRect(a.x-a.w*.46,a.y-h,Math.max(1,a.w*.92),Math.max(1,p));if(question&&p>.35){c.fillStyle='#19243e';c.beginPath();c.arc(a.x,a.y-h*.3,Math.max(1,2.1*p),0,Math.PI*2);c.fill();c.font=`700 ${Math.max(10,24*p)}px sans-serif`;c.textAlign='center';c.fillText(lane===0?'O':'X',a.x,a.y+depth+30*p);}}
}
