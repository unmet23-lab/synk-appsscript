'use strict';
const path=require('node:path'),crypto=require('node:crypto');
const {inventory}=require('./freeze-platform-release.cjs');
const assert=(value,message)=>{if(!value)throw Error(message);};
// Both child and platform builders depend on this source/archive contract.
function verifyArchive(asar,source,archive){const expected=inventory(source).filter(row=>row.path!=='synk-install.json');asar.uncache(archive);const actual=asar.listPackage(archive).map(file=>file.replaceAll('\\','/').replace(/^\//,'')).filter(file=>!asar.statFile(archive,path.normalize(file)).files).sort();assert(actual.join('\n')===expected.map(row=>row.path).sort().join('\n'),'Archive membership differs');for(const row of expected)assert(crypto.createHash('sha256').update(asar.extractFile(archive,path.normalize(row.path))).digest('hex')===row.sha256,'Archive source differs: '+row.path);return expected.length;}
module.exports={verifyArchive};
