export type Scene = {
  duration: number;
  eyebrow?: string;
  title: string;
  body?: string;
  lines?: string[];
  asset?: string;
  kr?: string;
  mn?: string;
};

export type ContentItem = {
  id: string;
  brand?: string;
  account?: string;
  handle?: string;
  title?: string;
  format: string;
  scenes: Scene[];
};

export const videoIds = [
  '01-lab-youtube', '03-lab-tiktok', '04-yuhobuilds-youtube',
  '05-yuhobuilds-instagram', '06-yuhobuilds-tiktok',
  '07-synkbrief-youtube', '09-synkbrief-tiktok',
] as const;

export const assetFiles: Record<string, string> = {
  night: 'night.webp', notebook: 'notebook.webp', compass: 'compass.avif',
  letter: 'letter.png', book: 'book.png', scissors: 'scissors.png',
  classroom: 'classroom.webp', cafe: 'cafe.webp', mong: 'mong.webp',
  smile: 'smile.webp', curious: 'curious.webp', korean: 'korean.webp',
  headphones: 'headphones.webp', stitch: 'stitch.webp', woolLogo: 'woolLogo.webp',
  labpage: 'labpage.png', shiftpage: 'shiftpage.png', pulsepage: 'pulsepage.png',
  'brand-synk': 'brand-synk.webp', 'brand-lab': 'brand-lab.webp',
  'brand-shift': 'brand-shift.webp', 'brand-pulse': 'brand-pulse.webp',
};
