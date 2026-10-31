const MAX: usize = 12_000;

// Private, single-threaded WASM instance. JS writes only through the validated
// wrapper. No raw pointers/lengths are accepted from an external caller.
static mut INPUT: [u32; MAX * 2] = [0; MAX * 2];

#[no_mangle]
pub extern "C" fn input_ptr() -> *mut u32 {
    std::ptr::addr_of_mut!(INPUT).cast::<u32>()
}

#[no_mangle]
pub extern "C" fn compare(length_a: u32, length_b: u32) -> u32 {
    let (n, m) = (length_a as usize, length_b as usize);
    if n > MAX || m > MAX { return u32::MAX; }
    // SAFETY: both ranges are bounded above, INPUT has static storage, and the
    // wrapper calls synchronously without shared memory or callbacks to JS.
    let input = unsafe { std::slice::from_raw_parts(input_ptr().cast_const(), MAX * 2) };
    distance(&input[..n], &input[MAX..MAX + m]) as u32
}

fn distance(a: &[u32], b: &[u32]) -> usize {
    let (mut start, mut end_a, mut end_b) = (0, a.len(), b.len());
    while start < end_a && start < end_b && a[start] == b[start] { start += 1; }
    while end_a > start && end_b > start && a[end_a - 1] == b[end_b - 1] {
        end_a -= 1; end_b -= 1;
    }
    let (a, b) = (&a[start..end_a], &b[start..end_b]);
    let (a, b) = if a.len() < b.len() { (b, a) } else { (a, b) };
    let (n, m) = (a.len(), b.len());
    if m == 0 { return n; }
    let upper = n - m + (0..m).filter(|&j| a[j] != b[j]).count();
    let mut band = upper.min(4.max(n - m));
    let mut row = vec![0u16; m + 1];
    loop {
        let infinity = (band + 1) as u16;
        row.fill(infinity);
        for (j, value) in row.iter_mut().enumerate().take(m.min(band) + 1) { *value = j as u16; }
        let mut answer = infinity;
        for i in 1..=n {
            let low = 1.max(i.saturating_sub(band));
            let high = m.min(i + band);
            let mut diagonal = row[low - 1];
            row[low - 1] = if low == 1 && i <= band { i as u16 } else { infinity };
            let mut minimum = row[low - 1];
            let letter = a[i - 1];
            for j in low..=high {
                let above = row[j];
                let value = (row[j - 1] + 1).min(above + 1)
                    .min(diagonal + u16::from(letter != b[j - 1]));
                row[j] = value;
                diagonal = above;
                minimum = minimum.min(value);
            }
            if high < m { row[high + 1] = infinity; }
            if minimum as usize > band { break; }
            if i == n { answer = row[m]; }
        }
        if answer as usize <= band { return answer as usize; }
        band = upper.min(band * 2);
    }
}
