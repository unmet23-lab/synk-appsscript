import {homeDayKey,homeTutorDays} from './home-tutor-days.mjs';
import {createWardrobeAlbum,subscribeWardrobeAlbum} from '../synk-world-home/wardrobe-album.mjs';

const emptyExpression=()=>({text:'',label:'오늘의 표현',date:'',kind:'',expressionId:'',questionId:'',lessonId:'',status:'empty'});
const emptyPhoto=()=>({photoUrl:'',photoId:'',photoLabel:'나의 사진',photoDate:'',photoMode:'',photoStatus:'empty'});

/** Read only today's observed canonical expression, never a stored title or a suggested lesson. */
export function homeMemoryExpression({owner,summary,snapshot,lessons=[],now=Date.now()}={}){
  const empty=emptyExpression();
  if(!owner||summary?.owner!==owner||snapshot?.owner!==owner||summary.status?.phase==='loading')return {...empty,status:'loading'};
  if(['unreadable','conflict'].includes(summary.status?.phase)||summary.status?.rejected||summary.status?.code==='LIFE_PROGRESS_REJECTED')return {...empty,status:'unavailable'};
  const today=homeTutorDays(snapshot,lessons,now).today,item=today.items[0];
  if(!item)return {...empty,date:today.date};
  return {text:item.title,label:item.kind==='retry'?'오늘 다시 살필 표현':'오늘 만난 표현',date:today.date,kind:item.kind,expressionId:item.expressionId,questionId:item.id,lessonId:item.lessonId,status:'ready'};
}

/** An owner-scoped projection of existing progress and the existing local wardrobe album.
 * All labels/text are plain text for textContent or canvas.fillText, never HTML.
 * This adapter owns its Blob URL; consumers must replace old images on onChange.
 */
export function createHomeMemory({onChange=()=>{},now=Date.now,createAlbum=createWardrobeAlbum,subscribeAlbum=subscribeWardrobeAlbum,url=globalThis.URL,eventTarget=globalThis.window,documentTarget=globalThis.document}={}){
  let owner='',input={},album=null,disposed=false,generation=0,current={...emptyExpression(),...emptyPhoto()};
  const snapshot=()=>({...current});
  function publish(patch){
    const next={...current,...patch};
    if(Object.keys(next).every(key=>next[key]===current[key]))return;
    current=next;try{onChange(snapshot());}catch{/* A failed view must not change stored learning or photos. */}
  }
  function clearPhoto(photoStatus='empty'){
    const previous=current.photoUrl;publish({...emptyPhoto(),photoStatus});
    if(previous)url?.revokeObjectURL?.(previous);
  }
  function expression(){
    try{return homeMemoryExpression({...input,owner,now:now()});}catch{return {...emptyExpression(),status:'unavailable'};}
  }
  async function refresh(){
    if(disposed)return snapshot();
    publish(expression());
    const token=++generation,account=owner;
    if(!account||account==='guest'){clearPhoto();return snapshot();}
    let reader=album;
    const active=()=>!disposed&&generation===token&&owner===account;
    try{
      if(!reader){reader=createAlbum({accountId:account});album=reader;}
      const rows=await reader.list();
      if(!active())return snapshot();
      const candidates=(Array.isArray(rows)?rows:[]).filter(row=>row?.accountId===account&&typeof row.id==='string'&&Number.isFinite(row.createdAt)&&row.createdAt>0&&row.createdAt<=now()+60000).sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id));
      let photo=null;
      for(const row of candidates){
        const record=await reader.get(row.id);
        if(!active())return snapshot();
        if(record?.accountId===account&&record.id===row.id&&record.blob instanceof Blob&&record.blob.size>0&&record.blob.size<=10*1024*1024&&/^image\/(png|jpeg|webp)$/.test(record.blob.type)&&Number.isFinite(record.createdAt)&&record.createdAt>0&&record.createdAt<=now()+60000){photo=record;break;}
      }
      if(!photo){clearPhoto();return snapshot();}
      const photoUrl=current.photoId===photo.id&&current.photoUrl?current.photoUrl:url?.createObjectURL?.(photo.blob);
      if(!photoUrl){clearPhoto('unavailable');return snapshot();}
      const previous=current.photoUrl;
      publish({photoUrl,photoId:photo.id,photoLabel:photo.preview?'앨범의 시착 사진':'앨범의 사진',photoDate:homeDayKey(photo.createdAt),photoMode:photo.localStatus==='session'?'session':'device',photoStatus:'ready'});
      if(previous&&previous!==photoUrl)url?.revokeObjectURL?.(previous);
    }catch{
      if(active())clearPhoto('unavailable');
    }finally{
      // An IndexedDB open may finish after an owner change or dispose.
      if(reader&&reader!==album)reader.close?.();
    }
    return snapshot();
  }
  function update(value={}){
    if(disposed)return Promise.resolve(snapshot());
    const nextOwner=typeof value.owner==='string'&&value.owner.trim()?value.owner:'';
    if(owner!==nextOwner){
      generation++;owner=nextOwner;input={};
      const previous=current.photoUrl;
      publish({...emptyExpression(),...emptyPhoto(),status:'loading'});
      if(previous)url?.revokeObjectURL?.(previous);
      album?.close?.();album=null;
    }
    input={summary:value.summary,snapshot:value.snapshot,lessons:value.lessons||[]};
    return refresh();
  }
  const changed=account=>{if(!disposed&&owner&&account===owner)void refresh();};
  const unsubscribe=subscribeAlbum(changed);
  const focused=()=>{void refresh();};
  const visible=()=>{if(documentTarget?.visibilityState==='visible')void refresh();};
  eventTarget?.addEventListener?.('focus',focused);
  eventTarget?.addEventListener?.('pageshow',focused);
  documentTarget?.addEventListener?.('visibilitychange',visible);
  function dispose(){
    if(disposed)return;disposed=true;generation++;unsubscribe?.();
    eventTarget?.removeEventListener?.('focus',focused);
    eventTarget?.removeEventListener?.('pageshow',focused);
    documentTarget?.removeEventListener?.('visibilitychange',visible);
    const previous=current.photoUrl;current={...emptyExpression(),...emptyPhoto()};
    if(previous)url?.revokeObjectURL?.(previous);
    album?.close?.();album=null;input={};owner='';
  }
  return {update,refresh,snapshot,dispose};
}
