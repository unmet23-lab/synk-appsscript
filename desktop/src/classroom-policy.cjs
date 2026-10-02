'use strict';
function classroomURL(value,origin,role,{resource=false,frame=false}={}){
  try{const u=new URL(value),base=new URL(origin);if(base.protocol!=='http:'||base.hostname!=='127.0.0.1'||u.origin!==base.origin||u.username||u.password)return false;
    if(resource||frame)return role==='world'||!u.pathname.startsWith('/synk-account/');
    return !u.search&&(role==='teacher'?['/','/index.html'].includes(u.pathname):u.pathname==='/synk-account/local-world.html');
  }catch{return false;}
}
module.exports={classroomURL};
