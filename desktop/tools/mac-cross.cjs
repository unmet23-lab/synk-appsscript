'use strict';
const fs=require('node:fs'),path=require('node:path');
const {prepare}=require('./package.cjs'),{identity}=require('../src/catalog.cjs');
async function main(){const {packager}=await import('@electron/packager');const arch=process.argv.find(a=>a.startsWith('--arch='))?.slice(7)||'arm64',id=process.argv.find(a=>a.startsWith('--client='))?.slice(9)||'world';
  if(!['x64','arm64'].includes(arch))throw Error('Unsupported architecture');
  const root=path.resolve(__dirname,'..'),c=identity(id,'development'),config=prepare(id,{mode:'development',platform:'darwin',arch});
  const output=await packager({dir:config.directories.app,name:c.executableName,appBundleId:c.appId,executableName:c.executableName,appVersion:require('../package.json').version,platform:'darwin',arch,electronVersion:require('../package.json').devDependencies.electron,asar:true,prune:false,overwrite:true,out:path.join(root,'dist','mac-cross'),icon:path.join(root,'assets',id+'.icns'),extraResource:[path.join(config.directories.app,'synk-install.json')],osxSign:false,osxNotarize:false});
  if(!output.length)throw Error('No Mac artifact created: this Windows host cannot create the required symbolic links. Build on macOS; no privilege escalation was attempted.');
  process.stdout.write(JSON.stringify({id,arch,output,unsigned:true,executedOnMac:false})+'\n');
}
main().catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
