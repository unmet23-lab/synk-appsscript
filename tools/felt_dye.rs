use std::slice;

fn linear(value: u8) -> f64 {
    let c = f64::from(value) / 255.0;
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

fn encoded(value: f64) -> u8 {
    let c = value.clamp(0.0, 1.0);
    let s = if c <= 0.0031308 {
        c * 12.92
    } else {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    };
    (s * 255.0).round_ties_even() as u8
}

fn compress(value: f64, knee: f64) -> f64 {
    if value <= knee {
        return value;
    }
    let over = value - knee;
    let room = 1.0 - knee;
    knee + room * (over / (over + room))
}

fn mask([r, g, b]: [f64; 3]) -> f64 {
    fn f(t: f64) -> f64 {
        if t > 216.0 / 24389.0 {
            t.powf(1.0 / 3.0)
        } else {
            (841.0 / 108.0) * t + 4.0 / 29.0
        }
    }
    let fx = f((r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047);
    let fy = f(r * 0.2126729 + g * 0.7151522 + b * 0.0721750);
    let fz = f((r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883);
    let chroma = (500.0 * (fx - fy)).hypot(200.0 * (fy - fz));
    let t = ((chroma - 14.0) / (30.0 - 14.0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

#[derive(Clone, Copy)]
struct Dyed {
    rgb: [u8; 3],
    painted: bool,
    clipped: bool,
}

// The caller owns disjoint input and output buffers of the same byte length.
#[no_mangle]
pub unsafe extern "C" fn felt_apply_v1(
    input: *const u8,
    output: *mut u8,
    len: usize,
    r: f64,
    g: f64,
    b: f64,
    knee: f64,
    neutral: u8,
    counts: *mut usize,
) -> i32 {
    if input.is_null()
        || output.is_null()
        || counts.is_null()
        || len % 3 != 0
        || len > isize::MAX as usize
    {
        return -1;
    }
    let source = slice::from_raw_parts(input, len);
    let result = slice::from_raw_parts_mut(output, len);
    let gains = [r, g, b];
    let lin: [f64; 256] = std::array::from_fn(|i| linear(i as u8));
    let compressed = gains.map(|gain| lin.map(|v| compress(v * gain, knee)));
    let dyed = compressed.map(|values| values.map(encoded));
    let clips = gains.map(|gain| lin.map(|v| v * gain > 1.0));
    let mut painted = 0;
    let mut clipped = 0;
    // A direct-mapped colour cache stays bounded on large photographs. Collisions recompute the colour.
    let mut cache = vec![
        (
            u32::MAX,
            Dyed {
                rgb: [0; 3],
                painted: false,
                clipped: false
            }
        );
        8192
    ];
    for (pixel, out) in source.chunks_exact(3).zip(result.chunks_exact_mut(3)) {
        let orig = [pixel[0], pixel[1], pixel[2]];
        let idx = orig.map(usize::from);
        let full = || Dyed {
            rgb: std::array::from_fn(|i| dyed[i][idx[i]]),
            painted: true,
            clipped: (0..3).any(|i| clips[i][idx[i]]),
        };
        let value = if neutral != 0 {
            full()
        } else {
            let key = u32::from_be_bytes([0, orig[0], orig[1], orig[2]]);
            let slot = &mut cache[(key.wrapping_mul(2654435761) >> 19) as usize];
            if slot.0 != key {
                let source_lin = idx.map(|i| lin[i]);
                let weight = mask(source_lin);
                let mut v = full();
                if weight == 0.0 {
                    v = Dyed {
                        rgb: orig,
                        painted: false,
                        clipped: false,
                    };
                } else if weight < 1.0 {
                    v.rgb = std::array::from_fn(|i| {
                        encoded(source_lin[i] + (compressed[i][idx[i]] - source_lin[i]) * weight)
                    });
                }
                *slot = (key, v);
            }
            slot.1
        };
        out.copy_from_slice(&value.rgb);
        painted += usize::from(value.painted);
        clipped += usize::from(value.clipped);
    }
    counts.write(painted);
    counts.add(1).write(clipped);
    0
}
