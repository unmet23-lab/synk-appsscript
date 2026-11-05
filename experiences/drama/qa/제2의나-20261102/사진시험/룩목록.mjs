/**
 * 「제2의 나」 시범 옷장 목록 (2026-11-04) — 서버 일감과 화면이 같이 읽는 정본. tools/build-me2-photo-talk.mjs가 talk 사본으로 옮긴다.
 * 지시문 꼴은 옷장조립.mjs 그대로(기준 사진을 통째로 다시 찍는 편집). 사람마다 달랐던 글을 누구에게나 맞게 고쳤다.
 *   문턱: gate = hair(얼굴 둘레를 건드리는 것 0.70) · clothes(옷 · 목걸이 · 귀걸이 0.90) — 설계 3절.
 *   뺌: notes 칸이 켜진 학생에게는 메뉴에서 뺀다(설계 2절 1단계 「알려 주고 싶은 것」).
 *   옷(11-05 옷 가게): 상점 사진을 Image 2로 넣고 그 옷 그대로 입힐 때의 옷 글(experiences/drama/shop/qa/옷굽기조립.mjs 앞 글과 같은 말).
 *     서버는 저장소 garments/<id>.jpg가 있으면 [기준, 옷 사진] 두 장 + 옷참고글로, 없으면 바꿈 글만으로 굽는다(11-05 대역 둘 0.967 · 0.94).
 */
export const 옷참고글 = 'they now wear the exact garment shown in Image 2 instead of their current top — @@GARMENT@@ Image 2 is the shop photo of that garment on its hanger: match its colour, fabric texture, buttons, zips, stripes and pattern exactly — no letters, no logos, no patches; only the fit follows their body';

export const 룩들 = [
  { id: 'hair-comma', 묶음: 'hair', 문턱: 'hair', 이름: '쉼표 머리', 뺌: ['head_cover'],
    바꿈: 'their hair restyled into a soft Korean "comma hair" cut — the same colour, side-parted, the fringe curving down toward one brow', 지킴: 'Their hairline and forehead shape stay theirs.' },
  { id: 'hair-layered', 묶음: 'hair', 문턱: 'hair', 이름: '레이어드 컷', 뺌: ['head_cover'],
    바꿈: 'their hair restyled into a shoulder-length layered cut with soft face-framing layers, the same colour', 지킴: 'Their hairline and forehead shape stay theirs.' },
  { id: 'hair-ash', 묶음: 'hair', 문턱: 'hair', 이름: '애쉬 브라운 염색', 뺌: ['head_cover'],
    바꿈: 'their hair dyed a clearly lighter ash-brown, obvious in the daylight, the same cut and length', 지킴: 'Only the hair colour changes; brows stay as they are.' },
  { id: 'outfit-trench', 묶음: 'outfit', 문턱: 'clothes', 이름: '짧은 트렌치코트', 뺌: [],
    바꿈: 'they now wear a short beige cotton trench coat with plain horn buttons, the belt tied loosely, over a plain white T-shirt',
    옷: 'a short beige cotton-gabardine trench coat, double-breasted with plain horn buttons, the belt tied loosely at the waist, open collar, falling to about mid-thigh, over a plain white T-shirt.', 지킴: 'The hair stays exactly as in Image 1.' },
  { id: 'outfit-cardigan', 묶음: 'outfit', 문턱: 'clothes', 이름: '버터색 카디건', 뺌: [],
    바꿈: 'they now wear a butter-yellow chunky cotton-knit V-neck cardigan, buttoned only at the middle, over a plain white T-shirt',
    옷: 'a butter-yellow chunky cotton-knit V-neck cardigan with small round cream buttons, buttoned only at the middle, over a plain white crew-neck T-shirt.', 지킴: 'The hair stays exactly as in Image 1.' },
  { id: 'outfit-varsity', 묶음: 'outfit', 문턱: 'clothes', 이름: '빨간 야구 점퍼', 뺌: [],
    바꿈: 'they now wear a cherry-red wool varsity jacket with cream leather sleeves and striped rib trims, worn open over a plain white T-shirt — no letters or patches',
    옷: 'a cherry-red wool varsity jacket with cream leather sleeves, cream-and-red striped rib collar, cuffs and hem and plain snap buttons, worn open over a plain white T-shirt.', 지킴: 'The hair stays exactly as in Image 1.' },
  { id: 'outfit-bomber', 묶음: 'outfit', 문턱: 'clothes', 이름: '카키 항공 점퍼', 뺌: [],
    바꿈: 'they now wear a khaki MA-1 bomber jacket over a grey T-shirt',
    옷: 'a khaki-green nylon MA-1 bomber jacket with ribbed collar, cuffs and hem and a zip pocket on the left sleeve, the silver front zip open over a plain grey T-shirt.', 지킴: 'The hair stays exactly as in Image 1.' },
  { id: 'outfit-rugby', 묶음: 'outfit', 문턱: 'clothes', 이름: '남색 줄무늬 럭비 셔츠', 뺌: [],
    바꿈: 'they now wear a long-sleeve rugby shirt with wide navy and cream horizontal stripes and a plain white collar',
    옷: 'a long-sleeve rugby polo shirt with wide navy and cream horizontal stripes, a plain white woven collar and a short white button placket.', 지킴: 'The hair stays exactly as in Image 1.' },
  { id: 'outfit-leather', 묶음: 'outfit', 문턱: 'clothes', 이름: '검정 가죽 재킷', 뺌: [],
    바꿈: 'they now wear a black soft-leather biker jacket with silver zips, open over a plain white T-shirt',
    옷: 'a black soft-leather biker jacket with silver zips, the asymmetric front zip open and the lapels folded back, over a plain white crew-neck T-shirt.', 지킴: 'The hair stays exactly as in Image 1.' },
  { id: 'outfit-denim', 묶음: 'outfit', 문턱: 'clothes', 이름: '연청 데님 재킷', 뺌: [],
    바꿈: 'they now wear an oversized light-blue denim jacket over a plain white T-shirt',
    옷: 'an oversized light-blue washed denim jacket with silver buttons and two chest flap pockets, worn open over a plain white crew-neck T-shirt.', 지킴: 'The hair stays exactly as in Image 1.' },
  { id: 'outfit-vest', 묶음: 'outfit', 문턱: 'clothes', 이름: '니트 조끼와 셔츠', 뺌: [],
    바꿈: 'they now wear a pale-blue cotton shirt under a cream knit vest',
    옷: 'a cream V-neck knit sweater vest over a pale-blue cotton button-down shirt, the shirt collar and cuffs showing.', 지킴: 'The hair stays exactly as in Image 1.' },
  { id: 'acc-glasses', 묶음: 'acc', 문턱: 'hair', 이름: '은테 안경', 뺌: ['glasses'],
    바꿈: 'they now wear thin round silver-rimmed glasses with clear lenses', 지킴: 'The eyes stay the same size and shape behind clear lenses, no reflections hiding them.' },
  { id: 'acc-cap', 묶음: 'acc', 문턱: 'hair', 이름: '볼캡', 뺌: ['head_cover'],
    바꿈: 'they now wear a plain black baseball cap with no logo, worn forward', 지킴: 'The face under the cap stays fully visible and the same.' },
];

/** 추억 사진(장면 판 편집) — 판은 사진시험/본판조립.mjs의 판목록과 같은 이름. 고르는 규칙은 lib/me2-photo-rules.js platePick. */
export const 장면들 = [
  { id: 's1e01-kimchi', 이름: '1화 식당 — 김치!', 몸짓: 'the V sign at chest height', 판: ['kimchi-f', 'kimchi-m'] },
  { id: 's1e01-fight', 이름: '1화 식당 — 파이팅!', 몸짓: "the free fist raised beside the cheek, clearly above the shoulder; Tae-o's arm around the student's shoulders and his hand stay exactly as in Image 1", 판: ['fight-f-s', 'fight-m-s', 'fight-f-l', 'fight-m-l', 'fight-f-long'] },
];
