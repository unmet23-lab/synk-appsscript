'use strict';
const fs=require('node:fs'),path=require('node:path');
const {releasesFor,installerPath}=require('./release-catalog.cjs');
function loadDevelopmentReleases({root,platform,arch}) {
  try {
    const manifest=JSON.parse(fs.readFileSync(path.join(root,'artifacts','client-releases.json'),'utf8'));
    if(manifest.version!==1||manifest.approved!==true||manifest.source!=='verified-local-builds')return [];
    return releasesFor(manifest.releases,{mode:'development',platform,arch}).filter(r=>['world','messenger'].includes(r.id)&&(!r.installer||installerPath(r,path.join(root,'dist'))));
  }catch{return [];}
}
module.exports={loadDevelopmentReleases};
