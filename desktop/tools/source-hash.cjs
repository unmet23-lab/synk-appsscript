'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function sourceFiles(root){const files=[];function walk(relative){const absolute=path.join(root,relative);if(!fs.existsSync(absolute))return;for(const entry of fs.readdirSync(absolute,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){const file=path.posix.join(relative,entry.name);if(entry.isDirectory())walk(file);else if(entry.isFile())files.push(file);else throw Error('Source symlinks are not permitted: '+file);}}for(const directory of ['src','renderer','assets'])walk(directory);return files;}
function sourceHash(root){const hash=crypto.createHash('sha256');for(const file of sourceFiles(root)){const bytes=fs.readFileSync(path.join(root,file));hash.update(file+'\0'+bytes.length+'\0');hash.update(bytes);}return hash.digest('hex');}
module.exports={sourceFiles,sourceHash};
