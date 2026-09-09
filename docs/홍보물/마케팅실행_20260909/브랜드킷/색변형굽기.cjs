'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const variant=process.argv[2];
if(!['Ink','Paper'].includes(variant))throw new Error('Expected Ink or Paper');
const out=path.join(__dirname,`SYNK-${variant}.png`),record=path.join(__dirname,`SYNK-${variant}-job.json`);
const source=path.resolve(__dirname,'../../../Loom_자산/구움/양모워드마크_누끼.png');
const downloadOnly=process.argv.includes('--download-existing');
if(fs.existsSync(out)&&!downloadOnly)throw new Error('Existing output preserved; inspect before retrying');
const prompt=fs.readFileSync(path.join(__dirname,`SYNK-${variant}-prompt.txt`),'utf8');
const result=downloadOnly?{status:0,stdout:fs.readFileSync(record,'utf8')}:cp.spawnSync('C:/Users/q1212/AppData/Roaming/npm/higgsfield.exe',['generate','create','gpt_image_2_5','--image',source,'--variant','sunburst','--quality','xhigh','--resolution','4k','--aspect_ratio','21:9','--background','transparent','--wait','--wait-timeout','20m','--json'],{input:prompt,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});
if(result.status!==0)throw new Error((result.stderr||result.stdout).slice(-3000));
let data;try{data=JSON.parse(result.stdout)}catch{throw new Error('Invalid JSON response: '+result.stdout.slice(-1000))}
fs.writeFileSync(record,JSON.stringify(data,null,2));
const urls=(Array.isArray(data)?data:[data]).filter(x=>x.status==='completed'&&x.result_url).map(x=>x.result_url);
if(!urls.length)throw new Error('Job saved; no image URL found. Inspect job schema without regenerating');
(async()=>{const r=await fetch(urls[0]);if(!r.ok)throw new Error('Download '+r.status);const buf=Buffer.from(await r.arrayBuffer());fs.writeFileSync(out,buf);console.log(JSON.stringify({variant,output:out,bytes:buf.length,sha256:crypto.createHash('sha256').update(buf).digest('hex'),record,url:urls[0]}));})().catch(e=>{console.error(e.message);process.exitCode=1});
