import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {Store} from './store.mjs';
import {createCompanyApp} from './server.mjs';
import {createStudioService} from './studio-service.mjs';
import {createPublicationPackageService} from './publication-package.mjs';
import {createPublicationReviewService} from './publication-review.mjs';
import {backupWorkspace} from './workspace-backup.mjs';

const run=promisify(execFile),NOW='2026-10-11T12:00:00.000Z';

test('ordinary and integrated workspace backups restore exact-package manual review history and media without inheriting it into another package',async()=>{
  const root=await mkdtemp(join(tmpdir(),'synk-publication-review-backup-')),source=join(root,'source');let app,packages;
  try{
    app=createCompanyApp({dataDir:source,port:0,allowTestHost:true,schedule:false,clock:()=>NOW,collector:async()=>{throw Error('No external calls in this backup test.');}});await app.start();
    const store=app.store,studio=createStudioService({store,clock:()=>NOW}),owner=store.createUser({name:'검토 담당',email:'review-backup@example.test'});
    const production=studio.saveProduction(owner,{title:'백업할 게시 점검',stage:'ready'}).production,id=randomUUID(),diskName=id+'.mp4';await mkdir(join(source,'studio-media'),{recursive:true});
    const path=join(source,'studio-media',diskName);
    await run(process.env.SYNK_FFMPEG_EXE||'ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=1080x1920:r=5','-t','0.6','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-threads','1','-movflags','+faststart','-y',path],{windowsHide:true,timeout:30000});
    const bytes=await readFile(path),uploaded=studio.addMedia(owner,production.id,{id,diskName,mimeType:'video/mp4',fileName:'backup.mp4',byteSize:bytes.length},'백업할 최종본'),version=uploaded.production.versions[0];
    packages=createPublicationPackageService({store,studio,clock:()=>NOW});const reviews=createPublicationReviewService({store,studio,publicationPackages:packages,clock:()=>NOW});
    const input={productionId:production.id,versionId:version.id,title:'복원할 게시 묶음',body:'합성 게시 원고',channels:['youtube-shorts'],language:'ko',mode:'original'},pack=(await packages.create(owner,input)).package;
    let saved=reviews.update(owner,pack.id,{revision:0,checkId:'video',status:'confirmed',note:'합성 시험: 최종본 전체 화면 확인'}).review;
    saved=reviews.update(owner,pack.id,{revision:saved.revision,checkId:'audio',status:'not-applicable',note:'합성 시험: 의도한 무음 영상'}).review;
    saved=reviews.update(owner,pack.id,{revision:saved.revision,checkId:'copy',status:'needs-work',note:'합성 시험: 원고의 날짜를 다시 확인해야 함'}).review;
    const raw=store.get('publicationPackageReviews',pack.id),other=(await packages.create(owner,{...input,body:input.body+' 다른 원고'})).package;
    assert.equal(reviews.get(owner,other.id).review.revision,0);
    await packages.stop();packages=null;await app.stop();app=null;
    const ordinary=await run(process.execPath,[fileURLToPath(new URL('./backup.mjs',import.meta.url)),join(root,'ordinary')],{env:{...process.env,SYNK_COMPANY_DATA:source},windowsHide:true,timeout:30000});
    const ordinaryFolder=ordinary.stdout.trim(),integratedFolder=await backupWorkspace({destination:join(root,'integrated'),companyDataDir:source,messengerDataDir:join(source,'messenger')});
    assert.ok(ordinaryFolder.startsWith(resolve(root,'ordinary')));assert.ok(integratedFolder.startsWith(resolve(root,'integrated')));
    for(const restoredPath of [ordinaryFolder,join(integratedFolder,'company')]){
      const restored=new Store(restoredPath),restoredStudio=createStudioService({store:restored,clock:()=>NOW}),restoredPackages=createPublicationPackageService({store:restored,studio:restoredStudio,clock:()=>NOW});
      try{
        const service=createPublicationReviewService({store:restored,studio:restoredStudio,publicationPackages:restoredPackages,clock:()=>NOW});
        assert.deepEqual(restored.get('publicationPackageReviews',pack.id),raw,'manual actor, timestamps, revision and history survive the actual SQLite backup');
        assert.deepEqual(service.get(owner,pack.id).review,saved);assert.deepEqual(await readFile(join(restoredPath,'studio-media',diskName)),bytes);
        const fresh=service.get(owner,other.id).review;assert.equal(fresh.revision,0);assert.equal(fresh.manual.filter(row=>row.status==='confirmed').length,0);
        assert.throws(()=>service.update(owner,pack.id,{revision:0,checkId:'rights',status:'confirmed',note:'stale after restore'}),error=>error.status===409);
        const resumed=service.update(owner,pack.id,{revision:saved.revision,checkId:'copy',status:'confirmed',note:'합성 시험: 복원 후 날짜 확인'}).review;assert.equal(resumed.revision,saved.revision+1);
        assert.equal(restored.get('studioPublicationPackages',pack.id).published,false);
      }finally{await restoredPackages.stop();restored.close();}
    }
  }finally{await packages?.stop();await app?.stop();assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(root.includes('synk-publication-review-backup-'));await rm(root,{recursive:true,force:true});}
});
