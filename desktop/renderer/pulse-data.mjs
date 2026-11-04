// Public PULSE material only. Keep these twenty-one models and three works aligned
// with the website's pulse.models and pulse.works (SYNK-website site-v10/content/ko.mjs).
// Image provenance and exact copy hashes: assets/pulse/sources.json.
export const TEAMS = Object.freeze([
  { id: 'OPALINE', ko: '오팔린', kind: '걸그룹 · 네 명', line: '네 파장, 네 사람 — 같은 빛에서 갈라진 네 색' },
  { id: 'OUTBLUE', ko: '아웃블루', kind: '보이그룹 · 네 명', line: '쪽에서 나왔지만 넷 다 다른 파랑' },
]);

export const MODELS = Object.freeze([
  {
    id: 'M01', name: '이안', kind: '가상 AI 모델', gender: '남',
    summary: '20대 중반 · 182cm. 부드럽고 지적인 인상의 모델이에요.',
    tags: ['남성 뷰티·향수', '패션·안경', '부드러운', '지적인'],
    image: '/assets/pulse/models/m01.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-m01-20260930.webp',
  },
  {
    id: 'F02', name: '하린', kind: '가상 AI 모델', gender: '여',
    summary: '20대 초반 · 165cm. 상큼하고 발랄한 인상의 모델이에요.',
    tags: ['음료·디저트', '스킨케어', '상큼한', '발랄한'],
    image: '/assets/pulse/models/f02.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-f02-20260930.webp',
  },
  {
    id: 'M03', name: '유호', kind: 'SYNK 창업자 본인 기반 AI 이미지', gender: '남',
    summary: 'SYNK 창업자 양유호 · 180cm. 본인을 바탕으로 만든 모델 이미지예요.',
    tags: ['스트리트 패션', '음악·엔터', '미스터리한', '4차원'],
    image: '/assets/pulse/models/m03.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-m03-20260930.webp',
  },
  {
    id: 'F03', name: '서진', kind: '가상 AI 모델', gender: '여',
    summary: '20대 후반 · 170cm. 지적이고 단정한 인상의 모델이에요.',
    tags: ['금융·보험', 'IT·B2B', '지적인', '단정한'],
    image: '/assets/pulse/models/f03.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-f03-20260930.webp',
  },
  {
    id: 'M02', name: '태준', kind: '가상 AI 모델', gender: '남',
    summary: '30대 중반 · 184cm. 강렬하고 성숙한 인상의 모델이에요.',
    tags: ['향수·그루밍', '시계·정장', '강렬한', '성숙한'],
    image: '/assets/pulse/models/m02.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-m02-20260930.webp',
  },
  {
    id: 'F01', name: '유나', kind: '가상 AI 모델', gender: '여',
    summary: '20대 중반 · 168cm. 세련되고 도회적인 인상의 모델이에요.',
    tags: ['색조·향수', '패션·주얼리', '세련된', '도회적인'],
    image: '/assets/pulse/models/f01.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-f01-20260930.webp',
  },
  {
    id: 'F04', name: '지유', kind: '가상 AI 모델', gender: '여',
    summary: '20대 초반 · 166cm. 청순하고 상큼한 인상의 모델이에요.',
    tags: ['스킨케어·클렌징', '여행·항공', '청순한', '상큼한'],
    image: '/assets/pulse/models/f04.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-f04-20261022.webp',
  },
  {
    id: 'F05', name: '소연', kind: '가상 AI 모델', gender: '여',
    summary: '30대 중반 · 162cm. 따뜻하고 단정한 인상의 모델이에요.',
    tags: ['생활·주방', '식품·간편식', '따뜻한', '단정한'],
    image: '/assets/pulse/models/f05.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-f05-20261022.webp',
  },
  {
    id: 'M04', name: '민재', kind: '가상 AI 모델', gender: '남',
    summary: '20대 후반 · 175cm. 친근하고 솔직한 인상의 모델이에요.',
    tags: ['후기형·UGC', '가전', '친근한', '솔직한'],
    image: '/assets/pulse/models/m04.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-m04-20261022.webp',
  },
  {
    id: 'F06', name: '은정', kind: '가상 AI 모델', gender: '여',
    summary: '40대 중반 · 160cm. 우아하고 세련된 인상의 모델이에요.',
    tags: ['안티에이징·스킨케어', '건강기능식품', '우아한', '세련된'],
    image: '/assets/pulse/models/f06.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-f06-20261022.webp',
  },
  {
    id: 'F07', name: '채원', kind: '가상 AI 모델', gender: '여',
    summary: '20대 중반 · 167cm. 건강하고 발랄한 인상의 모델이에요.',
    tags: ['운동복·레깅스', '다이어트·단백질', '건강한', '발랄한'],
    image: '/assets/pulse/models/f07.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-f07-20261022.webp',
  },
  {
    id: 'M05', name: '준호', kind: '가상 AI 모델', gender: '남',
    summary: '30대 후반 · 177cm. 믿음직하고 다정한 인상의 모델이에요.',
    tags: ['가전·주방', '캠핑·아웃도어', '믿음직한', '다정한'],
    image: '/assets/pulse/models/m05.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-m05-20261022.webp',
  },
  {
    id: 'M06', name: '한결', kind: '가상 AI 모델', gender: '남',
    summary: '20대 초반 · 178cm. 청량하고 상큼한 인상의 모델이에요.',
    tags: ['음료·간식', '앱·게임', '청량한', '상큼한'],
    image: '/assets/pulse/models/m06.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-m06-20261024.webp',
  },
  {
    id: 'F08', name: '윤슬', kind: '가상 AI 모델', gender: '여', team: 'OPALINE',
    summary: '20대 초반 · 164cm. 상큼하고 친근한 인상의 모델이에요.',
    tags: ['음료·카페', '앱·통신', '상큼한', '친근한'],
    image: '/assets/pulse/models/f08.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-f08-20261103.webp',
  },
  {
    id: 'F09', name: '로하', kind: '가상 AI 모델', gender: '여', team: 'OPALINE',
    summary: '20대 초반 · 169cm. 청순하고 세련된 인상의 모델이에요.',
    tags: ['뷰티·스킨케어', '패션', '청순한', '세련된'],
    image: '/assets/pulse/models/f09.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-f09-20261103.webp',
  },
  {
    id: 'F10', name: '새봄', kind: '가상 AI 모델', gender: '여', team: 'OPALINE',
    summary: '20대 초반 · 160cm. 발랄하고 상큼한 인상의 모델이에요.',
    tags: ['음료·디저트', '앱·게임', '발랄한', '상큼한'],
    image: '/assets/pulse/models/f10.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-f10-20261103.webp',
  },
  {
    id: 'F11', name: '해인', kind: '가상 AI 모델', gender: '여', team: 'OPALINE',
    summary: '20대 초반 · 167cm. 상큼하고 청순한 인상의 모델이에요.',
    tags: ['음료·생수', '뷰티·스킨케어', '상큼한', '청순한'],
    image: '/assets/pulse/models/f11.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-f11-20261103.webp',
  },
  {
    id: 'M07', name: '도현', kind: '가상 AI 모델', gender: '남', team: 'OUTBLUE',
    summary: '20대 초반 · 182cm. 친근하고 믿음직한 인상의 모델이에요.',
    tags: ['커피·음료', '여행·항공', '친근한', '믿음직한'],
    image: '/assets/pulse/models/m07.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-m07-20261103.webp',
  },
  {
    id: 'M08', name: '하람', kind: '가상 AI 모델', gender: '남', team: 'OUTBLUE',
    summary: '20대 초반 · 177cm. 상큼하고 발랄한 인상의 모델이에요.',
    tags: ['음료·디저트', '운동화·스포츠', '상큼한', '발랄한'],
    image: '/assets/pulse/models/m08.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-m08-20261103.webp',
  },
  {
    id: 'M09', name: '서율', kind: '가상 AI 모델', gender: '남', team: 'OUTBLUE',
    summary: '20대 초반 · 180cm. 세련되고 청순한 인상의 모델이에요.',
    tags: ['뷰티·스킨케어', '향수', '세련된', '청순한'],
    image: '/assets/pulse/models/m09.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-m09-20261103.webp',
  },
  {
    id: 'M10', name: '지온', kind: '가상 AI 모델', gender: '남', team: 'OUTBLUE',
    summary: '20대 초반 · 175cm. 힙하고 개성 있는 인상의 모델이에요.',
    tags: ['운동화·스트리트 패션', '앱·게임', '힙한', '개성 있는'],
    image: '/assets/pulse/models/m10.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-m10-20261103.webp',
  },
]);

export const PORTFOLIO = Object.freeze([
  {
    id: 'yurigyeol', title: '홀리데이 기프트 「유리결」', category: '15초 · 대표작',
    kind: '가상 브랜드로 만든 자체 작품',
    description: '가상 스킨케어 브랜드 「유리결」의 홀리데이 세트를 흩날리는 유리 조각 사이에서 보여 주는 15초 광고예요. 한 장면의 임팩트로 기억에 남게 만들었어요.',
    image: '/assets/pulse/portfolio/yurigyeol.webp',
    gallery: [{ image: '/assets/pulse/portfolio/yurigyeol.webp', caption: '흩날리는 유리 조각 사이에 선 「유리결」 세럼 병과 남색 육각 상자. 홀리데이 기프트 광고 「유리결」의 한 장면' }],
    tags: ['제품 광고', '홀리데이', '임팩트'],
    sourceUrl: 'https://synk.im/pulse/#works',
  },
  {
    id: 'maejin', title: '「매진 임박」', category: '1분 13초 · 코미디',
    kind: '가상 브랜드로 만든 자체 작품',
    description: '공포 영화 같은 밤에 홈쇼핑 방송이 끼어드는 1분 13초 코미디 광고예요. 이야기로 끝까지 보게 만들었어요.',
    image: '/assets/pulse/portfolio/maejin.webp',
    gallery: [{ image: '/assets/pulse/portfolio/maejin.webp', caption: '어두운 거실에서 복면을 쓴 남자가 리본 묶은 선물 상자를 들고 서 있는 장면. 광고 「매진 임박」의 끝 장면' }],
    tags: ['제품 광고', '홈쇼핑', '코미디', '이야기'],
    sourceUrl: 'https://synk.im/pulse/#works',
  },
  {
    id: 'hwaseong-cf', title: '화성 CF 「1억 년의 빛」', category: '55초 · CF',
    kind: '공모전 출품작',
    description: '1억 년 전 공룡알의 빛이 바다의 노을과 솔숲의 햇무리를 지나 오늘의 도시 불빛으로 이어지는 55초 CF예요. 2026 별별화성 Awards AI CF 부문에 출품했어요.',
    image: '/assets/pulse/portfolio/hwaseong-cf.webp',
    gallery: [{ image: '/assets/pulse/portfolio/hwaseong-cf.webp', caption: '금빛이 새어 나오는 공룡알 화석. 화성 CF 「1억 년의 빛」의 첫 장면' }],
    tags: ['CF', '공모전', '이야기'],
    sourceUrl: 'https://youtu.be/dIittvXfdIE',
  },
]);

// No longer listed. A brief saved on this PC can still name it, so it stays readable until removed.
export const RETIRED_WORKS = Object.freeze([
  {
    id: 'model-casting', title: 'PULSE AI 모델 캐스팅', category: '모델 이미지',
    kind: '자체 제작 이미지',
    description: 'PULSE가 만든 AI 모델의 대표 이미지예요. 인상과 분위기를 견주며 광고·룩북에 쓸 방향을 고를 수 있어요. 고객사에 납품한 사례나 영상 연기 샘플은 아니에요.',
    image: '/assets/pulse/models/m01.webp',
    gallery: MODELS.map(model => ({ image: model.image, caption: `${model.name} · ${model.kind}` })),
    tags: ['캐스팅', '인물 이미지', `${MODELS.length}명`],
    sourceUrl: 'https://synk.im/pulse/#models',
  },
]);
