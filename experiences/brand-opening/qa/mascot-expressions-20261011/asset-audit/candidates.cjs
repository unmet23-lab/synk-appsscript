const fs=require('node:fs'),path=require('node:path');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../../../../..'),dir=path.join(root,'docs/캐릭터/마린몽글표정교정_20261011'),report=JSON.parse(fs.readFileSync(path.join(dir,'정본.json'),'utf8'));
async function make(entries,file,face){const cell=350,height=face?210:384,columns=4,layers=[];for(let i=0;i<entries.length;i++){
 const entry=entries[i],left=i%columns*cell,top=Math.floor(i/columns)*height;let img=sharp(path.join(dir,`${entry.character}_${entry.expression}_480.png`));
 if(face)img=img.extract(entry.character==='마린'?{left:85,top:140,width:310,height:166}:{left:110,top:105,width:260,height:130});
 const h=height-34;layers.push({input:await img.resize(cell,h,{fit:'contain',background:'#eff0f3'}).flatten({background:'#eff0f3'}).png().toBuffer(),left,top});
 layers.push({input:Buffer.from(`<svg width="${cell}" height="34" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><text x="12" y="24" font-family="Malgun Gothic" font-size="18">${entry.character} · ${entry.expression}</text></svg>`),left,top:top+h});
 }await sharp({create:{width:cell*columns,height:Math.ceil(entries.length/columns)*height,channels:3,background:'white'}}).composite(layers).png().toFile(path.join(__dirname,file));}
(async()=>{for(const name of ['마린','몽글']){const rows=report.files.filter(r=>r.character===name);await make(rows,`${name}-candidates-full.png`,false);await make(rows,`${name}-candidates-face.png`,true);}})().catch(e=>{console.error(e);process.exitCode=1;});
