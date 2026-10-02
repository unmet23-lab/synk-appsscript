'use strict';
const fs=require('node:fs'),path=require('node:path');
const out=path.join(__dirname,'조사');fs.mkdirSync(out,{recursive:true});
const specs=[
 ['hf-korean-language','https://huggingface.co/api/models?pipeline_tag=text-to-speech&filter=ko&sort=downloads&direction=-1&limit=500&full=true'],
 ['hf-korean-name','https://huggingface.co/api/models?search=korean&pipeline_tag=text-to-speech&sort=downloads&direction=-1&limit=500&full=true'],
 ['hf-tts-popular','https://huggingface.co/api/models?pipeline_tag=text-to-speech&sort=downloads&direction=-1&limit=100&full=true'],
 ['gh-korean-tts','https://api.github.com/search/repositories?q=korean+tts+fork:false&sort=stars&per_page=100'],
 ['gh-voice-design','https://api.github.com/search/repositories?q=voice+design+speech+fork:false&sort=updated&per_page=100'],
];
async function query([id,start]){const records=[],pages=[];let url=start;try{while(url&&pages.length<10){const r=await fetch(url,{headers:{'User-Agent':'SYNK-Voice-Research','Accept':'application/json'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json(),rows=Array.isArray(data)?data:data.items||[];records.push(...rows);const next=r.headers.get('link')?.match(/<([^>]+)>; rel="next"/)?.[1];pages.push({url,returned:rows.length,totalCount:data.total_count||null});url=id.startsWith('hf-')?next:null;}
 const seen=new Map();for(const r of records)seen.set(r.id||r.full_name,r);
 const exhausted=id.startsWith('gh-')?records.length>=(pages.at(-1)?.totalCount??Infinity):!url;
 const result={id,checkedAt:new Date().toISOString(),pages,paginationExhausted:exhausted,limitReached:!exhausted,records:[...seen.values()]};fs.writeFileSync(path.join(out,id+'.json'),JSON.stringify(result,null,2));return {id,count:result.records.length,pages:pages.length,paginationExhausted:exhausted};
}catch(e){const result={id,checkedAt:new Date().toISOString(),pages,error:e.message,records};fs.writeFileSync(path.join(out,id+'.json'),JSON.stringify(result,null,2));return {id,count:records.length,error:e.message}}}
Promise.all(specs.map(query)).then(results=>{fs.writeFileSync(path.join(out,'검색범위.json'),JSON.stringify({checkedAt:new Date().toISOString(),results,scope:'Public metadata inventory plus original-developer model-family review. Search ranking is discovery only, not a quality score. GitHub top100 per query is bounded; Korean-language HF pagination records show actual coverage.'},null,2));console.log(JSON.stringify(results));});
