// 내보낸 사본에 공개 빌드가 부르는 git 밖 파일을 공용 작업본에서 가져온다 — 그 파일이 공용 작업본에서 「git이 무시하는 파일」일 때만.
//   node prep-ignored.cjs <내보낸 사본>
const {execFileSync}=require('node:child_process');const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const R='C:/Users/q1212/Documents/SYNK-appsscript',E=process.argv[2];if(!E||!fs.existsSync(path.join(E,'EXPORT_COMMIT')))throw Error('내보낸 사본이 아니다: '+E);
const ignored=rel=>{try{execFileSync('git',['-C',R,'check-ignore','-q','--',rel]);return true;}catch{return false;}};
let n=0;
// 마을 3D 묶음(townwide-merged.json이 부르는 glb)
const town='experiences/synk-town/assets/district';
// 목록 파일 자체도 git 밖이다(.gitignore: district/*.json) — 없으면 공용 작업본에서 가져온다.
const list=`${town}/townwide-merged.json`;
if(!fs.existsSync(path.join(E,list))){if(!ignored(list))throw Error('git 밖이 아닌데 없다: '+list);fs.mkdirSync(path.join(E,town),{recursive:true});fs.copyFileSync(path.join(R,list),path.join(E,list));n++;}
const set=JSON.parse(fs.readFileSync(path.join(E,list),'utf8'));
if(fs.readFileSync(path.join(R,list),'utf8')!==fs.readFileSync(path.join(E,list),'utf8'))throw Error('마을 목록이 공용 작업본과 다르다');
for(const part of set.parts)for(const file of [part.url,part.phone].filter(Boolean)){const rel=`${town}/${file}`;if(fs.existsSync(path.join(E,rel)))continue;if(!ignored(rel))throw Error('git 밖이 아닌데 없다: '+rel);fs.copyFileSync(path.join(R,rel),path.join(E,rel));n++;}
// 드라마 시범 미디어(manifest의 sha256로 다시 본다 — 빌드도 본다)
const media='experiences/drama/pilot/media';fs.mkdirSync(path.join(E,media),{recursive:true});
for(const f of fs.readdirSync(path.join(R,media))){const rel=`${media}/${f}`;if(!ignored(rel))throw Error('git 밖이 아니다: '+rel);fs.copyFileSync(path.join(R,rel),path.join(E,rel));n++;}
const m=JSON.parse(fs.readFileSync(path.join(E,media,'manifest.json'),'utf8'));
const bad=m.files.filter(it=>crypto.createHash('sha256').update(fs.readFileSync(path.join(E,media,it.file))).digest('hex')!==it.sha256).length;
if(bad)throw Error('드라마 미디어 sha가 manifest와 다르다: '+bad);
console.log('가져옴',n,'· 드라마 manifest',m.files.length,'일치');
