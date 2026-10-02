# Source-footage edit specification

- Canvas: 1080×1920; nominal 24fps; duration comes from `edit-manifest.json`.
- Visual truth: actual Seedance 2.5 source footage plus the parent film's approved reference images. Source footage owns all actor action and camera movement.
- Treatment: no added grade, graphic, typography, grain, mask, zoom, pan, fade or shader. All scene boundaries are hard cuts.
- Framing: show the complete 9:16 source at native canvas ratio with `object-fit: contain`; mismatched source dimensions are reported before assembly.
- Focal element, edge detail, background and logo placement remain exactly as present in the footage. No independent HTML design layer is added.
- No authored text is present, so there is no font asset or type pairing to resolve.
- Missing source slots are empty preparation slots. They are not a deliberate creative black frame and must all be filled before final rendering.
