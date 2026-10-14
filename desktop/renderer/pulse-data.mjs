// Public PULSE material only. Keep this six-person selection aligned with the
// website; its 2026-10-01 selection replaced F04 with the founder, M03.
// Image provenance and exact copy hashes: assets/pulse/sources.json.
export const MODELS = Object.freeze([
  {
    id: 'M01', name: '이안', kind: '가상 AI 모델', gender: '남',
    summary: '20대 중반 · 182cm. 부드럽고 지적인 인상의 모델입니다.',
    tags: ['남성 뷰티·향수', '패션·안경', '부드러운', '지적인'],
    image: '/assets/pulse/models/m01.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-m01-20260930.webp',
  },
  {
    id: 'F02', name: '하린', kind: '가상 AI 모델', gender: '여',
    summary: '20대 초반 · 165cm. 상큼하고 발랄한 인상의 모델입니다.',
    tags: ['음료·디저트', '스킨케어', '상큼한', '발랄한'],
    image: '/assets/pulse/models/f02.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-f02-20260930.webp',
  },
  {
    id: 'M03', name: '유호', kind: 'SYNK 창업자 본인 기반 AI 이미지', gender: '남',
    summary: 'SYNK 창업자 양유호 · 180cm. 본인을 바탕으로 제작한 모델 이미지입니다.',
    tags: ['스트리트 패션', '음악·엔터', '힙한', '지적인'],
    image: '/assets/pulse/models/m03.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-m03-20260930.webp',
  },
  {
    id: 'F03', name: '서진', kind: '가상 AI 모델', gender: '여',
    summary: '20대 후반 · 170cm. 지적이고 단정한 인상의 모델입니다.',
    tags: ['금융·보험', 'IT·B2B', '지적인', '단정한'],
    image: '/assets/pulse/models/f03.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-f03-20260930.webp',
  },
  {
    id: 'M02', name: '태준', kind: '가상 AI 모델', gender: '남',
    summary: '30대 중반 · 184cm. 강렬하고 성숙한 인상의 모델입니다.',
    tags: ['향수·그루밍', '시계·정장', '강렬한', '성숙한'],
    image: '/assets/pulse/models/m02.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-m02-20260930.webp',
  },
  {
    id: 'F01', name: '유나', kind: '가상 AI 모델', gender: '여',
    summary: '20대 중반 · 168cm. 세련되고 도회적인 인상의 모델입니다.',
    tags: ['색조·향수', '패션·주얼리', '세련된', '도회적인'],
    image: '/assets/pulse/models/f01.webp',
    sourceUrl: 'https://synk.im/assets/pulse-models/pulse-model-f01-20260930.webp',
  },
]);

export const PORTFOLIO = Object.freeze([
  {
    id: 'model-casting', title: 'PULSE AI 모델 캐스팅', category: '모델 이미지',
    kind: '자체 제작 이미지',
    description: 'PULSE가 제작한 AI 모델의 대표 인물 이미지입니다. 서로 다른 인상과 분위기를 비교하며 광고·룩북에 쓸 방향을 살펴볼 수 있습니다. 고객사 납품 사례나 영상 연기 샘플은 아닙니다.',
    image: '/assets/pulse/models/m01.webp',
    gallery: MODELS.map(model => ({ image: model.image, caption: `${model.name} · ${model.kind}` })),
    tags: ['캐스팅', '인물 이미지', '6명'],
    sourceUrl: 'https://synk.im/pulse/#models',
  },
]);
