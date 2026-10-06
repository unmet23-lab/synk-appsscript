import { mediaBytes, LIMITS } from './model.mjs';
const EXT = {jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',webm:'audio/webm',m4a:'audio/mp4',mp4:'audio/mp4'};
export function mediaBlob(media){const raw=atob(media.data.slice(media.data.indexOf(',')+1));return new Blob([Uint8Array.from(raw,c=>c.charCodeAt(0))],{type:media.type});}
export function fileMime(file){const ext=file.name?.split('.').at(-1)?.toLowerCase();return EXT[ext]||String(file.type||'').split(';')[0].replace('audio/x-wav','audio/wav').replace('audio/x-m4a','audio/mp4');}
export async function decodeMedia(media,kind){
  mediaBytes(media,kind);
  if(!media)return;
  await new Promise((resolve,reject)=>{
    const element=kind==='photo'?new Image():document.createElement('audio');
    const url=kind==='audio'?URL.createObjectURL(mediaBlob(media)):media.data;
    const done=error=>{clearTimeout(timer);element.onload=element.onerror=element.onloadedmetadata=null;if(kind==='audio'){element.removeAttribute('src');element.load();URL.revokeObjectURL(url);}error?reject(error):resolve();};
    const timer=setTimeout(()=>done(new Error('이 파일의 내용을 읽지 못했어요. 다른 파일을 골라 주세요.')),10000);
    element.onerror=()=>done(new Error('손상되었거나 이 환경에서 열 수 없는 파일이에요.'));
    if(kind==='photo')element.onload=()=>done(element.naturalWidth*element.naturalHeight>20000000?new Error('사진은 2,000만 화소 이하로 줄여 주세요.'):null);
    else {element.preload='metadata';element.onloadedmetadata=()=>done(element.duration>0?null:new Error('재생할 수 없는 음성이에요.'));}
    element.src=url;
  });
}
export async function readMedia(file,kind){
  if(!file?.size||file.size>LIMITS[kind])throw new Error(kind==='photo'?'사진은 0 MB보다 크고 6 MB 이하인 파일을 골라 주세요.':'음성은 0 MB보다 크고 8 MB 이하인 파일을 골라 주세요.');
  const type=fileMime(file);
  const raw=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('파일을 읽지 못했어요.'));reader.readAsDataURL(file);});
  const media={name:file.name.slice(0,180),type,data:`data:${type};base64,${raw.split(',')[1]}`};
  await decodeMedia(media,kind);return media;
}
