/** Local felt UI and shop icons. Image provenance lives in assets/shop/manifest.json. */
export const SHOP_UI = Object.freeze({
  cream: 'assets/shop/ui/slab-cream-long.webp',
  coral: 'assets/shop/ui/slab-coral-long.webp',
  blush: 'assets/shop/ui/slab-blush-long.webp',
  creamTile: 'assets/shop/ui/slab-cream.webp',
  blushTile: 'assets/shop/ui/slab-blush.webp',
  chip: 'assets/shop/ui/chip-blush-long.webp',
  check: 'assets/shop/ui/badge-check.webp',
  badge: 'assets/shop/ui/badge-cream.webp',
  coralBadge: 'assets/shop/ui/badge-coral.webp',
  tag: 'assets/shop/ui/tag-cream.webp',
  creamTexture: 'assets/shop/ui/tex-cream.webp',
  coralTexture: 'assets/shop/ui/tex-coral.webp',
  blushTexture: 'assets/shop/ui/tex-blush.webp',
  lapisTexture: 'assets/shop/ui/tex-lapis.webp',
  butterTexture: 'assets/shop/ui/tex-butter.webp',
});

export const SHOP_ICONS = Object.freeze({
  trail: Object.freeze({none: 'assets/shop/icons/trail-none.webp', petals: 'assets/shop/icons/trail-petals.webp', starlight: 'assets/shop/icons/trail-starlight.webp', footprints: 'assets/shop/icons/trail-footprints.webp'}),
  lantern: Object.freeze({paper: 'assets/shop/icons/lantern-paper.webp', flower: 'assets/shop/icons/lantern-flower.webp', firefly: 'assets/shop/icons/lantern-firefly.webp'}),
  companion: Object.freeze({none: 'assets/shop/icons/companion-none.webp', sparrow: 'assets/shop/icons/companion-sparrow.webp', cloud: 'assets/shop/icons/companion-cloud.webp'}),
  scenery: Object.freeze({village: 'assets/shop/icons/scenery-village.webp', blossom: 'assets/shop/icons/scenery-blossom.webp', snow: 'assets/shop/icons/scenery-snow.webp', moonlight: 'assets/shop/icons/scenery-moonlight.webp'}),
  finish: Object.freeze({simple: 'assets/shop/icons/finish-simple.webp', flowers: 'assets/shop/icons/finish-flowers.webp', stars: 'assets/shop/icons/finish-stars.webp', festival: 'assets/shop/icons/finish-festival.webp'}),
});

export function shopIcon(category, item) {
  const path = SHOP_ICONS[category]?.[item];
  if (!path) throw new Error(`Unknown shop icon: ${category}/${item}`);
  return path;
}
