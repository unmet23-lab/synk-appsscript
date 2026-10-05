import {startTeacherClient} from './teacher-session.mjs';
startTeacherClient({bridge:window.synkTeacher}).then(()=>{document.documentElement.dataset.ready='true';}).catch(error=>{const notice=document.getElementById('notice');notice.textContent=error.message;notice.className='notice error';document.documentElement.dataset.ready='error';});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
