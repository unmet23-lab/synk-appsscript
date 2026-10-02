const fs=require('node:fs'),path=require('node:path');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const dir=path.resolve(__dirname,'../assets/v2');
const crops=[
 ['01-blank.png','blank-input.png',10,666,445,132],
 ['02-template.png','template-input.png',16,140,433,269],
 ['02-template.png','placeholder.png',26,355,245,40],
 ['03-filled.png','filled-input.png',16,140,433,640],
 ['03-filled.png','memo.png',27,365,405,207],
 ['03-filled.png','columns.png',28,180,303,30],
 ['03-filled.png','rule.png',28,207,378,51],
 ['03-filled.png','send.png',21,726,424,53],
 ['05-result-desktop.png','result-table.png',198,330,655,213],
 ['05-result-desktop.png','result-three-columns.png',198,330,434,166],
 ['05-result-desktop.png','result-evidence.png',651,332,198,190],
 ['05-result-desktop.png','result-questions.png',199,553,620,114],
 ['05-result-desktop.png','result-next-meeting.png',198,675,638,29],
];
(async()=>{for(const [source,target,left,top,width,height]of crops)await sharp(path.join(dir,source)).extract({left,top,width,height}).png().toFile(path.join(dir,target));fs.writeFileSync(path.join(dir,'crop-provenance.json'),JSON.stringify({method:'Rectangular crops of genuine browser screenshots; no interface reconstruction.',crops},null,2));})();
