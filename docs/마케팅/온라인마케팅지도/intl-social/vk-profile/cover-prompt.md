# VK 러시아어 커버 v1 제작 기록

- 방식: 내장 `image_gen` 1장 생성. 특정 모델 버전은 확인하지 않음.
- 요청 비율: 가로 3:1. VK 현행 공식 규격을 확인했다는 뜻이 아니며 업로드 미리보기에서 크롭 확인 필요.
- 참조 1: `docs/마케팅/프로필최신화_20260919/커버_펠트글래스_v4/assets/lab-glass-white.png`
- 참조 2: `docs/마케팅/온라인마케팅지도/jp-vn-profile/lab-vn-youtube.display.png`
- 기존 로고·프로필·다른 국가 커버 원본은 미변경. 커버 안 로고는 생성형 참조 파생물이며 원본과 픽셀 동일성을 보장하지 않음.
- 게시·저장·VK 실제 크롭은 사용자 등록 후 확인 대상.
- 실제 결과: `cover-ru-v1.png`, 2172×724 PNG(3:1). 요청한 3072×1024와 실제 픽셀 수는 다르다. 러시아어 제목·설명·브랜드 라벨과 위아래 여백을 시각 확인했다. 이미지의 정확한 Inter Tight 폰트 임베드는 확인하지 않았다.

## 입력 프롬프트

Use case: ads-marketing. Create ONE finished ultra-wide SYNK LAB Russian-language VK personal-profile cover image. Target canvas 3072 x 1024 pixels, exactly 3:1 landscape, not a 3:2 poster, not a device/UI mockup. This is artwork only, not a screenshot.

Image 1 is the approved photographic synk LAB glass logo plaque: preserve its lowercase synk anatomy, elevated k, descending y, dark-brown felt fibers WITHOUT stitches, coral-red LAB WITH its existing stitching, and clear optical glass thickness. Do not typeset a replacement logo. Image 2 is the approved learning illustration/material reference, not an edit target: reuse its tactile coral stitched speech bubble, wool connecting thread, and small open felt notebook on black felt, but do not copy Vietnamese text or the country name.

Backdrop: completely seamless PURE WHITE #FFFFFF. No cream, yellow, beige, aged paper or gray wash. Keep quiet uncluttered negative space. We are matching an established sophisticated felt-and-glass brand, welcoming to teenage beginners without looking childish.

Composition: a shallow, deliberately wide banner. Reserve the lower-left 20% of width as quiet white space because a separate circular VK avatar will overlap that area. Do not draw the avatar, placeholder, or any circle. Place the main text group from approximately 24% to 62% of canvas width, centered optically around the vertical middle, with the logo above it and a short descriptor below. Preserve generous top AND bottom margins, not top-heavy. At right, around 68–90% of width, one clear-glass rounded rectangular panel with richly tactile BLACK felt backing holds the coral speech bubble and open notebook. Keep panel comfortably away from edges; align its optical center with the whole text group. Consistent soft directional light, contact shadows, clear glass bevels and restrained reflections; avoid glare over letters.

Required verbatim typography, no other text:
- approved synk LAB plaque near top of text group
- small discreet label to its right: "RUSSIA"
- main Russian headline, black contemporary compact sans serif, Inter Tight-like, two lines exactly:
"Здесь интересно"
"учить корейский"
- one smaller descriptor below:
"Хангыль и фразы на каждый день"

Make Russian lettering sharply readable, with natural word spacing and no malformed Cyrillic. Headline is clean flat black ink, not fuzzy felt letters. Use true felt fibers and real stitching on the illustration; not dot approximations. Avoid tiny text on the notebook. Preserve the source notebook shape and coral accents. No flags, confetti, political symbols, extra captions, website, motivational promises, decorative circles, extra characters or extra logos. Finished flat artwork only.
