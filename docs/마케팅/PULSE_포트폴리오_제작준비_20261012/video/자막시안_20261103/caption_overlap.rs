//! Count caption pixels against packed, row-major subject and contrast masks.
//! Build a cdylib with: rustc --edition=2024 -O --crate-type cdylib caption_overlap.rs
use std::slice;

#[derive(Clone, Copy)]
struct Crop {
    top: usize,
    bottom: usize,
    left: usize,  // index of the first 64-pixel block
    right: usize, // exclusive
    image_width: usize,
}

impl Crop {
    fn cols(self) -> usize {
        self.right - self.left
    }
    fn rows(self) -> usize {
        self.bottom - self.top
    }
    fn len(self) -> usize {
        self.rows() * self.cols()
    }
    fn last_mask(self) -> u64 {
        if self.right == self.image_width.div_ceil(64) && self.image_width % 64 != 0 {
            (1u64 << (self.image_width % 64)) - 1
        } else {
            u64::MAX
        }
    }
}

fn glyph_crop(glyphs: &[&[u8]], width: usize, height: usize) -> Option<Crop> {
    let (mut x0, mut y0, mut x1, mut y1) = (width, height, 0, 0);
    for glyph in glyphs {
        for (y, row) in glyph.chunks_exact(width).enumerate() {
            // Whole rows outside the glyph are common. Skip 32 blank pixels
            // at a time before looking for exact bounds in the occupied part.
            for (part, block) in row.chunks(32).enumerate() {
                if block.iter().all(|&v| v < 40) {
                    continue;
                }
                let x = part * 32;
                x0 = x0.min(x + block.iter().position(|&v| v >= 40).unwrap());
                x1 = x1.max(x + block.iter().rposition(|&v| v >= 40).unwrap() + 1);
                y0 = y0.min(y);
                y1 = y1.max(y + 1);
            }
        }
    }
    if y0 == height {
        return None;
    }
    Some(Crop {
        top: y0.saturating_sub(8),
        bottom: (y1 + 8).min(height),
        left: x0.saturating_sub(8) / 64,
        right: (x1 + 8).min(width).div_ceil(64),
        image_width: width,
    })
}

fn binary_glyph(glyph: &[u8], crop: Crop, loose_union: &mut [u64]) -> Vec<u64> {
    let mut core = vec![0; crop.len()];
    for y in crop.top..crop.bottom {
        let line = &glyph[y * crop.image_width..][..crop.image_width];
        for x in crop.left..crop.right {
            let i = (y - crop.top) * crop.cols() + x - crop.left;
            let bytes = &line[x * 64..((x + 1) * 64).min(line.len())];
            let (mut hard, mut loose) = (0u64, 0u64);
            for (j, &alpha) in bytes.iter().enumerate() {
                hard |= u64::from(alpha >= 128) << j;
                loose |= u64::from(alpha >= 40) << j;
            }
            core[i] = hard;
            loose_union[i] |= loose;
        }
    }
    core
}

// Boolean square dilation equals the original Pillow maximum filter.
fn dilate(input: &[u64], crop: Crop, radius: usize) -> Vec<u64> {
    let cols = crop.cols();
    let mut horizontal = input.to_vec();
    for (y, row) in input.chunks_exact(cols).enumerate() {
        for (x, &word) in row.iter().enumerate() {
            let mut expanded = word;
            for d in 1..=radius {
                expanded |= (word << d) | (word >> d);
                if x > 0 {
                    expanded |= row[x - 1] >> (64 - d);
                }
                if x + 1 < cols {
                    expanded |= row[x + 1] << (64 - d);
                }
            }
            if x + 1 == cols {
                expanded &= crop.last_mask();
            }
            horizontal[y * cols + x] = expanded;
        }
    }
    let mut result = vec![0; input.len()];
    for (y, target) in result.chunks_exact_mut(cols).enumerate() {
        let start = y.saturating_sub(radius) * cols;
        let end = (y + radius + 1).min(crop.rows()) * cols;
        for row in horizontal[start..end].chunks_exact(cols) {
            for (dst, &v) in target.iter_mut().zip(row) {
                *dst |= v;
            }
        }
    }
    result
}

struct Mask {
    words: Vec<(usize, u64)>,
    pixels: u64,
}

impl Mask {
    fn new(bits: &[u64], crop: Crop) -> Self {
        let mut words = Vec::new();
        let mut pixels = 0;
        let stride = crop.image_width.div_ceil(64);
        for (i, &v) in bits.iter().enumerate() {
            if v != 0 {
                let at = (crop.top + i / crop.cols()) * stride + crop.left + i % crop.cols();
                words.push((at, v));
                pixels += u64::from(v.count_ones());
            }
        }
        Self { words, pixels }
    }
}

struct Geometry {
    characters: Vec<(Mask, Mask)>,
    union: Mask,
}

fn geometry(glyphs: &[&[u8]], width: usize, height: usize) -> Option<Geometry> {
    let crop = glyph_crop(glyphs, width, height)?;
    let mut loose_union = vec![0; crop.len()];
    let cores: Vec<_> = glyphs
        .iter()
        .map(|g| binary_glyph(g, crop, &mut loose_union))
        .collect();
    let excluded = dilate(&loose_union, crop, 1);
    let mut union = vec![0; crop.len()];
    let mut characters = Vec::with_capacity(cores.len());
    for core in cores {
        let mut ring = dilate(&core, crop, 4);
        for (i, r) in ring.iter_mut().enumerate() {
            *r &= !excluded[i];
            union[i] |= core[i];
        }
        characters.push((Mask::new(&core, crop), Mask::new(&ring, crop)));
    }
    Some(Geometry {
        characters,
        union: Mask::new(&union, crop),
    })
}

fn ratio(n: u64, d: u64) -> f64 {
    if d == 0 { 0.0 } else { n as f64 / d as f64 }
}

fn measure(geometry: &Geometry, layers: &[u64], out: &mut [f64]) {
    let plane = layers.len() / 3;
    let (subject, colors) = layers.split_at(plane);
    let (ink, paper) = colors.split_at(plane);
    let mut values = [1.0_f64; 6];
    for (core, ring) in &geometry.characters {
        let mut hidden = 0;
        for &(at, v) in &core.words {
            hidden += u64::from((v & subject[at]).count_ones());
        }
        if core.pixels != 0 {
            values[0] = values[0].min(1.0 - ratio(hidden, core.pixels));
        }
        let (mut visible, mut ink_back, mut paper_back, mut ink_front, mut paper_front) =
            (0, 0, 0, 0, 0);
        for &(at, v) in &ring.words {
            let back = v & !subject[at];
            visible += u64::from(back.count_ones());
            ink_back += u64::from((back & ink[at]).count_ones());
            paper_back += u64::from((back & paper[at]).count_ones());
            ink_front += u64::from((v & ink[at]).count_ones());
            paper_front += u64::from((v & paper[at]).count_ones());
        }
        values[1] = values[1].min(ratio(ink_back, visible));
        values[2] = values[2].min(ratio(paper_back, visible));
        values[3] = values[3].min(ratio(ink_front, ring.pixels));
        values[4] = values[4].min(ratio(paper_front, ring.pixels));
    }
    let mut cover = 0;
    for &(at, v) in &geometry.union.words {
        cover += u64::from((v & subject[at]).count_ones());
    }
    values[5] = ratio(cover, geometry.union.pixels);
    out.copy_from_slice(&values);
}

/// The caller supplies contiguous planes: width*height u8 per glyph, then
/// subject/ink/paper packed as little-endian row-aligned u64s per frame.
/// Output is six f64 values per frame; 0 means the reference path is needed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn caption_overlap_v1(
    width: usize,
    height: usize,
    glyphs: *const *const u8,
    glyph_count: usize,
    frames: *const u64,
    frame_count: usize,
    output: *mut f64,
) -> i32 {
    if width == 0
        || height == 0
        || glyph_count == 0
        || glyph_count > 1024
        || glyphs.is_null()
        || frames.is_null()
        || output.is_null()
        || frame_count == 0
    {
        return 0;
    }
    let Some(pixels) = width
        .checked_mul(height)
        .filter(|&n| n <= isize::MAX as usize / 8)
    else {
        return 0;
    };
    let Some(stride) = width
        .div_ceil(64)
        .checked_mul(height)
        .and_then(|p| p.checked_mul(3))
    else {
        return 0;
    };
    let Some(frame_len) = stride
        .checked_mul(frame_count)
        .filter(|&n| n <= isize::MAX as usize / 8)
    else {
        return 0;
    };
    let Some(out_len) = frame_count
        .checked_mul(6)
        .filter(|&n| n <= isize::MAX as usize / 8)
    else {
        return 0;
    };
    let addresses = unsafe { slice::from_raw_parts(glyphs, glyph_count) };
    if addresses.iter().any(|p| p.is_null()) {
        return 0;
    }
    let glyphs: Vec<_> = addresses
        .iter()
        .map(|&p| unsafe { slice::from_raw_parts(p, pixels) })
        .collect();
    let Some(geo) = geometry(&glyphs, width, height) else {
        return 0;
    };
    let data = unsafe { slice::from_raw_parts(frames, frame_len) };
    let result = unsafe { slice::from_raw_parts_mut(output, out_len) };
    for (frame, out) in data.chunks_exact(stride).zip(result.chunks_exact_mut(6)) {
        measure(&geo, frame, out);
    }
    1
}
