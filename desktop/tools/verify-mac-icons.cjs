'use strict';
// Validate the delivered ICNS pixels, independently of Finder/Dock screenshot QA.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function chunks(bytes){assert(bytes.toString('ascii',0,4)==='icns'&&bytes.readUInt32BE(4)===bytes.length,'Invalid ICNS');const result=[];for(let at=8;at<bytes.length;){const length=bytes.readUInt32BE(at+4);assert(length>8&&at+length<=bytes.length,'Invalid ICNS chunk');result.push({type:bytes.toString('ascii',at,at+4),bytes:bytes.subarray(at+8,at+length)});at+=length;}return result;}
async function verify(assets){
  const results=[];
  for(const id of ['platform','world','messenger']){
    const bytes=fs.readFileSync(path.join(assets,id+'.icns')),frames=[];
    for(const frame of chunks(bytes)){
      const size={ic08:256,ic09:512,ic10:1024}[frame.type];assert(size,'Unexpected frame '+frame.type);
      const {data,info}=await sharp(frame.bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert(info.width===size&&info.height===size&&info.channels===4,'Wrong frame dimensions');
      let x1=size,y1=size,x2=-1,y2=-1,opaque=0,soft=0;
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){const a=data[(y*size+x)*4+3];if(a){x1=Math.min(x1,x);y1=Math.min(y1,y);x2=Math.max(x2,x);y2=Math.max(y2,y);if(a===255)opaque++;else soft++;}}
      const inset=100*size/1024,filterMargin=size===1024?0:3;assert(x1>=inset-filterMargin&&x1<=inset&&y1===x1&&x2===size-x1-1&&y2===x2,'Tile not centered at 824/1024');
      const alpha=(x,y)=>data[(y*size+x)*4+3];assert(alpha(inset,inset)===0&&alpha(size/2,inset)>0&&alpha(size/2,size/2)===255,'Missing rounded transparent corners');assert(soft>0&&opaque>0,'Missing antialiased mask');
      if(size===1024){
        // The tile is an exact proportional resampling of the existing approved
        // Windows composition. Only its alpha is clipped by the rounded mask.
        const original=await sharp(path.join(assets,id+'.png')).resize(824,824).ensureAlpha().raw().toBuffer();let compared=0,maxDelta=0;
        for(let y=0;y<824;y++)for(let x=0;x<824;x++){const a=((y+100)*1024+x+100)*4,b=(y*824+x)*4;if(data[a+3]!==255)continue;for(let c=0;c<3;c++)maxDelta=Math.max(maxDelta,Math.abs(data[a+c]-original[b+c]));compared++;}
        assert(compared>600000&&maxDelta===0,'Existing mark/color pixels changed');frames.push({type:frame.type,size,bounds:[x1,y1,x2,y2],comparedOpaquePixels:compared,maxRGBDelta:maxDelta,softEdgePixels:soft});
      }else frames.push({type:frame.type,size,bounds:[x1,y1,x2,y2],softEdgePixels:soft});
    }
    assert(frames.length===3,'Missing ICNS sizes');results.push({id,sha256:sha(bytes),bytes:bytes.length,windowsICO:sha(fs.readFileSync(path.join(assets,id+'.ico'))),frames});
  }
  return {ok:true,checkedAt:new Date().toISOString(),geometry:{canvas:1024,tile:824,inset:100,radius:185},results};
}
if(require.main===module){const arg=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);verify(path.resolve(arg('assets')||path.join(__dirname,'../assets'))).then(report=>{const out=arg('out');if(out){fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify(report));}).catch(error=>{console.error(error.stack);process.exitCode=1;});}
module.exports={chunks,verify};
