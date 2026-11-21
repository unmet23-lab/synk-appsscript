'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {enabled,employeeEnv,claudeSubscriber,taskDirectory,ownsWorkers,supportsPromptGuard}=require('../src/office-task-runtime.cjs');

test('only the Windows development source platform can run a task',()=>{
  const ok={packaged:false,mode:'development',clientId:'platform',platform:'win32',smoke:false};
  assert.equal(enabled(ok),true);
  for(const change of [{packaged:true},{mode:'release'},{clientId:'world'},{platform:'darwin'},{smoke:true}])assert.equal(enabled({...ok,...change}),false);
});
test('an API key or third-party Claude provider cannot be charged as the default subscriber',()=>{
  assert.equal(claudeSubscriber({loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty',subscriptionType:'ultra'}),true);
  assert.equal(claudeSubscriber({loggedIn:true,subscriptionType:'max'}),true);
  for(const data of [{loggedIn:false},{loggedIn:true,authMethod:'api_key'}, {loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty'}, {loggedIn:true,authMethod:'oauth_token',subscriptionType:'max'},{loggedIn:true,authMethod:'oauth',apiProvider:'bedrock'},{loggedIn:true}])assert.equal(claudeSubscriber(data),false);
});
test('only the sole approved viewer can bind the native conversation picker, including after the viewer list changes',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'office-native-owner-'));
  t.after(()=>fs.rm(root,{force:true,recursive:true}));
  const access=path.join(root,'synk','solio-office-dev','office-access'),userData=path.join(root,'first-app');
  await fs.mkdir(access,{recursive:true});
  const viewersFile=path.join(access,'viewers.json'),service={viewersFile};
  const set=ids=>fs.writeFile(viewersFile,JSON.stringify({synk_user_ids:ids}));
  await set(['first-member','other-member']);
  assert.equal(await ownsWorkers(userData,service,'other-member',root),false);
  await set(['first-member']);
  assert.equal(await ownsWorkers(userData,service,'other-member',root),false);
  const fresh=path.join(root,'fresh-app'),alternate=path.join(root,'other-viewers.json');
  await fs.writeFile(alternate,JSON.stringify({synk_user_ids:['other-member']}));
  assert.equal(await ownsWorkers(fresh,{viewersFile:alternate},'other-member',root),false);
  assert.equal(await ownsWorkers(userData,service,'first-member',root),true);
  await set(['other-member']);
  assert.equal(await ownsWorkers(fresh,service,'other-member',root),false);
  assert.equal(await ownsWorkers(fresh,{viewersFile:alternate},'other-member',root),false);
});
test('the native login is independent of any developer, API key or subscription account environment',()=>{
  const env=employeeEnv({PATH:'ordinary-path',USERPROFILE:'ordinary-home',APPDATA:'roaming',claude_config_dir:'review-account',ELECTRON_RUN_AS_NODE:'1',ANTHROPIC_API_KEY:'fixture',CODEX_HOME:'board-account',OPENAI_API_KEY:'fixture',CLAUDE_CODE_OAUTH_TOKEN:'fixture'});
  assert.deepEqual(env,{PATH:'ordinary-path',USERPROFILE:'ordinary-home',APPDATA:'roaming'});
  assert.equal(employeeEnv({CLAUDE_CODE_DISABLE_BACKGROUND_TASKS:'1'}).CLAUDE_CODE_DISABLE_BACKGROUND_TASKS,'1');
  assert.deepEqual(employeeEnv({CLAUDE_CODE_CHILD_SESSION:'1'}),{});
  for(const version of ['2.1.295 (Claude Code)','2.1.323','3.0.0'])assert.equal(supportsPromptGuard(version),true);
  for(const version of ['2.1.294','1.9.99','unknown'])assert.equal(supportsPromptGuard(version),false);
  assert.deepEqual(employeeEnv({ANTHROPIC_PROFILE:'synthetic',ANTHROPIC_CONFIG_DIR:'synthetic',ANTHROPIC_FEDERATION_RULE_ID:'test',ANTHROPIC_IDENTITY_TOKEN_FILE:'test'}),{});
});

test('an existing member task ledger prevents a different sole viewer from taking the native conversation picker on upgrade',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'office-previous-owner-'));
  t.after(()=>fs.rm(root,{force:true,recursive:true}));
  const access=path.join(root,'synk','solio-office-dev','office-access');
  await fs.mkdir(access,{recursive:true});
  const viewersFile=path.join(access,'viewers.json'), previous=path.join(root,'Office','prior-member');
  await fs.mkdir(previous,{recursive:true});
  await fs.writeFile(path.join(previous,'tasks.json'),'{"version":1,"tasks":[]}');
  await fs.writeFile(viewersFile,JSON.stringify({synk_user_ids:['later-member']}));
  assert.equal(await ownsWorkers(root,{viewersFile},'later-member',root),false);
  await fs.writeFile(viewersFile,JSON.stringify({synk_user_ids:['prior-member']}));
  assert.equal(await ownsWorkers(root,{viewersFile},'prior-member',root),true);
});
test('the default task folder is per member and an explicitly selected private application folder is refused',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'solio-work-folders-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const userData=path.join(dir,'data'), department=path.join(dir,'department');
  await Promise.all([fs.mkdir(userData),fs.mkdir(department)]);
  const one=await taskDirectory(userData,'member-one',null);
  const two=await taskDirectory(userData,'member-two',null);
  assert.notEqual(one,two);
  assert.equal(await taskDirectory(userData,'member-one',{folder:department}),await fs.realpath(department));
  for(const folder of [userData,one,two,dir,path.join(department,'moved')])await assert.rejects(taskDirectory(userData,'member-one',{folder}));
  await assert.rejects(taskDirectory(userData,'../someone',null));
});
