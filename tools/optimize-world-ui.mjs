// Keep the approved art masters; ship appropriately sized UI derivatives.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
const require=createRequire(new URL('../desktop/package.json',import.meta.url));
const sharp=require('sharp');
const folder=new URL('../experiences/brand-opening/assets/home/',import.meta.url);
const report=[];
for(const [name,width] of [['button-white',1024],['button-coral',1024],['quality-cream',384],['quality-blush',384]]){
 const source=fileURLToPath(new URL(`${name}.webp`,folder));
 const target=fileURLToPath(new URL(`${name}-ui.webp`,folder));
 const before=await sharp(source).metadata();
 await sharp(source).resize({width,withoutEnlargement:true}).webp({quality:90,alphaQuality:100,effort:6}).toFile(target);
 const after=await sharp(target).metadata();
 report.push({name,sourceBytes:(await fs.stat(source)).size,bytes:(await fs.stat(target)).size,before:[before.width,before.height],after:[after.width,after.height]});
}
console.log(JSON.stringify(report,null,2));
