'use strict';
// 설치기 셰이더 원본(orb.hlsl)의 기록 해시는 줄끝과 상관없이 맞아야 한다(0.4.96 Fable F5).
// 이 PC 작업본(autocrlf, CRLF)과 저장소 바이트 · 공개 저장소 사본 · 러너 체크아웃(LF)이 같은 원본이면 checkShader가 모두 통과해야 한다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const installer=path.join(__dirname,'..','installer');
const record=JSON.parse(fs.readFileSync(path.join(installer,'orb','orb.ps.json'),'utf8'));
const lf=fs.readFileSync(path.join(installer,'orb','orb.hlsl'),'latin1').replace(/\r\n/g,'\n');
test('orb shader record hashes orb.hlsl with LF line endings',()=>{
  assert.equal(crypto.createHash('sha256').update(Buffer.from(lf,'latin1')).digest('hex'),record.hlslSHA256);
});
test('checkShader passes the same source checked out with LF or CRLF',()=>{
  const source=fs.readFileSync(path.join(installer,'build-signal.cjs'),'utf8');
  for(const [name,text] of [['lf',lf],['crlf',lf.replace(/\n/g,'\r\n')]]){
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-shader-'+name+'-'));
    try{
      fs.mkdirSync(path.join(root,'orb'));
      fs.writeFileSync(path.join(root,'build-signal.cjs'),source);
      for(const file of ['orb.ps','orb.ps.json'])fs.copyFileSync(path.join(installer,'orb',file),path.join(root,'orb',file));
      fs.writeFileSync(path.join(root,'orb','orb.hlsl'),Buffer.from(text,'latin1'));
      const signal=require(path.join(root,'build-signal.cjs'));
      assert.doesNotThrow(()=>signal.checkShader(),name);
      delete require.cache[require.resolve(path.join(root,'build-signal.cjs'))];
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  }
});
