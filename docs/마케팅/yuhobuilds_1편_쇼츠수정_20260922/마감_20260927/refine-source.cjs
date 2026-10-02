const fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../../../../영상/src/yuhoShorts01/finish20260927');
let s=fs.readFileSync(path.join(__dirname,'source-before/Video.tsx'),'utf8').replaceAll("'../킷/","'../../킷/");
const edits=[
 ["import {Caption} from './Caption';","import {Caption} from './Caption';\nimport {SceneBridge,focusEnvelope,storyReframe} from './FinishMotion';"],
 ['damping:13,stiffness:230,mass:.65','damping:22,stiffness:240,mass:.65'],
 ['const typed=f>=typingStart;','const typed=f>=typingStart;\n const identityFocus=focusEnvelope(f,71,106);\n const roadmapFocus=focusEnvelope(f,160,225);'],
 ['<Big size={61} style={{marginTop:24}}>나는 개발이 처음이야.</Big>','<Big size={61} style={{marginTop:24,color:identityFocus>.1?blue:ink}}>나는 개발이 처음이야.</Big>'],
 ['<Big size={59} style={{marginTop:26,lineHeight:1.28}}>','<Big size={59} style={{marginTop:26,lineHeight:1.28,transformOrigin:"left top",transform:`translateX(${roadmapFocus*5}px)`,borderLeft:`5px solid ${roadmapFocus>.1?blue:"transparent"}`,paddingLeft:12}}>'],
 ['delay={n*Math.floor(s.duration/3.4)}','delay={[26,45,58][n]}'],
 ['delay={28} rotate={2}><Big size={70}>학생 출석 하나','delay={88} rotate={2}><Big size={70}>학생 출석 하나'],
 ['정체불명 APP 탄생…','기능은 늘고, 출석은 뒷전…'],
 ['strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"','strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="800" strokeDashoffset={interpolate(f,[38,54],[800,0],clamp)}'],
 ['const tick=Math.floor(f/45);','const camera=storyReframe(s,f);'],
 ['[3+i*7,10+i*7]','[i*4,5+i*4]'],
 ['(1-pop(f,3+i*7))*80','(1-pop(f,i*4))*48'],
 ["transform:`scale(${s.visual==='loop'&&tick%2?1.025:1})`",'transform:`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`'],
 ['{timing.scenes.map((s:any)=><Sequence key={s.id} from={s.start} durationInFrames={s.duration}><Scene s={s}/></Sequence>)}','{timing.scenes.map((s:any,i:number)=>{const next=timing.scenes[i+1];return <Sequence key={s.id} from={s.start} durationInFrames={s.duration+(next?.transition?.frames||0)}><SceneBridge scene={s} next={next}><Scene s={s}/></SceneBridge></Sequence>})}'],
 ];
for(const [a,b] of edits){if(!s.includes(a))throw Error('Source edit anchor missing: '+a);s=s.replace(a,b);}
fs.writeFileSync(path.join(dir,'Video.tsx'),s);
// Subtitle lines have stable placement while the picture transitions.
let c=fs.readFileSync(path.join(__dirname,'source-before/Caption.tsx'),'utf8').replaceAll("'../킷/","'../../킷/");
c=c.replace('left:74,right:108,top:1510','left:88,right:108,top:1524').replace('[0,75]','[0,50]').replace('[0,130],[13,0]','[0,100],[7,0]').replace('borderRadius:22','borderRadius:18').replace("padding:'22px 32px 25px'","padding:'20px 30px 23px'");
fs.writeFileSync(path.join(dir,'Caption.tsx'),c);
console.log('Isolated finishing sources updated.');
