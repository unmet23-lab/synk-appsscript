// 튜터·친구 사진: 화면(상황)마다 그 장면과 함께 새로 구운 사진을 쓴다(10-14 결정 「마스코트는 정본 그림을 그대로 쓰지 않는다」).
// 표정 사진은 한 판에서 얼굴만 바꿔 구웠고 몸·배경은 첫 칸과 같은 화소라, 표정이 바뀌어도 사진 전체가 흔들리지 않는다.
// 자리: onb 튜터 고르기 · home 우리 방 말풍선 · life 배우기 · runner/rhythm/hangul/first 각 놀이 · profile 계정 사진.
import {TUTOR_PHOTOS,PROFILE_PHOTOS,LIFE_PHOTOS} from './tutor-photos-data.mjs';

const base=new URL('./assets/tutor-photos/',import.meta.url);
const url=file=>file?new URL(file,base).href:'';
// 그 자리에 없는 표정은 가장 가까운 표정으로(판마다 여섯 표정만 구웠다).
const NEAR={기쁨:['눈웃음','으쓱'],눈웃음:['기쁨','으쓱'],으쓱:['기쁨','눈웃음'],집중:['기본'],민망:['놀람','기본'],놀람:['기본'],잔잔감음:['기본'],윙크:['눈웃음','기쁨'],졸림:['잔잔감음','기본']};
export const TUTOR_PHOTO_PLACES=Object.freeze(Object.keys(TUTOR_PHOTOS));

export function tutorPhoto(id,place,emotion='기본'){
 const set=TUTOR_PHOTOS[place]?.[id]||TUTOR_PHOTOS.life?.[id];if(!set)return '';
 for(const name of [emotion,...(NEAR[emotion]||[]),'기본'])if(set[name])return url(set[name]);
 return '';
}
export const profilePhoto=id=>url(PROFILE_PHOTOS[id]||PROFILE_PHOTOS.default);
// 이야기 장면: 말하는 친구(narrator·mongle·kkamong·marine)에 따라 같은 장면의 다른 순간
export const storyPhoto=(pack,speaker)=>{const set=LIFE_PHOTOS.story?.[pack];return url(set?.[speaker]||set?.narrator);};
export const hasStoryPhoto=pack=>Boolean(LIFE_PHOTOS.story?.[pack]);
export const cafePhoto=kind=>url(LIFE_PHOTOS.cafe?.[kind]);
export const hasCafePhoto=kind=>Boolean(LIFE_PHOTOS.cafe?.[kind]);
export const welcomePhoto=()=>url(LIFE_PHOTOS.welcome);
// 그 자리의 표정 사진을 미리 받아 둔다(표정이 바뀌는 순간 빈 틀이 보이지 않게).
export function preloadTutorPhotos(id,place){const set=TUTOR_PHOTOS[place]?.[id];if(!set||typeof Image==='undefined')return;for(const file of Object.values(set)){const img=new Image();img.decoding='async';img.src=url(file);}}
