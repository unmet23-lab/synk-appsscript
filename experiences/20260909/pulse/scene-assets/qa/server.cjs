const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const {server}=require(path.join(root,'server.cjs')).createExperienceServer({root});
server.listen(4439,'127.0.0.1',()=>console.log('PULSE scene QA listening on 127.0.0.1:4439'));
