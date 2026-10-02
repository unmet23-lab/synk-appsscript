const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const here=__dirname, plan=JSON.parse(fs.readFileSync(path.join(here,'samples.json'),'utf8'));
(async()=>{
  const records=[];
  for(const sample of plan.samples){
    const jobs=JSON.parse(fs.readFileSync(path.join(here,'jobs',sample.id+'.json'),'utf8'));
    const job=jobs.find(x=>x.status==='completed'&&x.result_url);
    if(!job) throw new Error(sample.id+': no completed image');
    const url=new URL(job.result_url);
    if(url.protocol!=='https:') throw new Error('Unexpected download protocol');
    const dest=path.join(here,'samples',sample.id+'.png');
    if(!fs.existsSync(dest)){
      const response=await fetch(url);
      if(!response.ok) throw new Error('Download '+response.status);
      const data=Buffer.from(await response.arrayBuffer());
      if(!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Not PNG');
      fs.writeFileSync(dest,data);
    }
    const data=fs.readFileSync(dest);
    records.push({sample:sample.id,label:sample.label,jobId:job.id,model:job.job_type,status:job.status,file:'samples/'+sample.id+'.png',bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});
    console.log(sample.id+': saved '+data.length+' bytes');
  }
  fs.writeFileSync(path.join(here,'samples','manifest.json'),JSON.stringify({preparedAt:plan.preparedAt||'2026-10-01',inputKind:plan.referenceKind,references:plan.references.map(f=>({file:path.join(plan.source,f),sha256:crypto.createHash('sha256').update(fs.readFileSync(path.resolve(here,plan.source,f))).digest('hex')})),results:records},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
