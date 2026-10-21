// Exact reviewed scratch-only renderer patch; all other module AST preserved.
const fs=require('node:fs'),path=require('node:path');
const REVIEWED_SOURCE_SHA256='a058aace0ca0eaf9d9b3b712b2b43ab0283793fb4dddc2896a2eb2e43b082458';
exports.reviewRendering=({town,beforeDirectory,ast,canonical,check,fileHash})=>{
 const file=path.join(town,'day-rendering.mjs'),beforeFile=path.join(beforeDirectory,'day-rendering.mjs');
 const before=fs.readFileSync(beforeFile,'utf8').replace(/\r\n/g,'\n'),current=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
 let inverse=current;const exceptions=[];
 check('rendering-final-reviewed-source-hash-exact',fileHash(file)===REVIEWED_SOURCE_SHA256,{reviewed:REVIEWED_SOURCE_SHA256,current:fileHash(file)});
 const restore=(a,b,label)=>{if(inverse.split(a).length!==2)throw Error('Expected one reviewed group: '+label);inverse=inverse.replace(a,b);exceptions.push({kind:'reviewed-replacement',label});};
 restore('  const savedClear = new THREE.Color(), savedViewport = new THREE.Vector4(), savedScissor = new THREE.Vector4();','', 'three-preallocated-scratch-objects');
 restore('renderer.getClearColor(savedClear)','renderer.getClearColor(new THREE.Color())','reuse-clear-color');
 restore('renderer.getViewport(savedViewport)','renderer.getViewport(new THREE.Vector4())','reuse-viewport');
 restore('renderer.getScissor(savedScissor)','renderer.getScissor(new THREE.Vector4())','reuse-scissor');
 restore('renderStatsIncludeShadows: true, revision: 6','renderStatsIncludeShadows: true, revision: 5','diagnostic-revision');
 const astEqual=canonical(ast(before))===canonical(ast(inverse));
 check('entire-rendering-module-AST-unchanged-except-five-reviewed-scratch-groups',astEqual,{exceptions});
 check('rendering-targets-quality-samples-beauty-shadow-and-restoration-covered-by-full-inverse-AST',astEqual);
 return{reviewedSourceSha256:REVIEWED_SOURCE_SHA256,beforeSha256:fileHash(beforeFile),currentSha256:fileHash(file),astEqual,exceptions,limits:['Only three reused scratch objects and diagnostic revision differ. Range-culling candidate was discarded because all8profile counts were0. Actual scene/resource GPU checks remain required.']};
};
