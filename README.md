# THREADLINE

A cinematic, scroll-driven, real-time WebGL story. **THREADRUNNER**, a tether-slinging hero wearing a fan-art recreation of Miguel O'Hara's **Spider-Man 2099** suit (Across the Spider-Verse look), stops a runaway maglev train after **GANTRY**, an original yellow-and-rust demolition mech with a single red sensor eye, is dropped onto the city from a city-sized carrier ship (along with a squad of differently-coloured units) and severs the track with a thrown cargo container.

Everything is procedural: the city (instanced towers with glass-curtain or concrete facades, wet streets, moving traffic, water tanks, antennas, a cloud deck, fog, rain), both characters (built from primitives, animated with a pose library and procedural layers), the carrier ship, the train, the track and all FX. No models, textures or audio files are loaded.

**Animation kit (THREADRUNNER):** corner perch, forward-diving swing, head-first dive, tether-firing (shoot), two-tether slingshot (pull), landing, brace, run cycle, and an acrobatics layer (front flip, back flip, corkscrew, twirl) applied in every free-flight gap. Pose changes cross-fade and body orientation is smoothed.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build → dist/ (also prints gzipped JS size, fails over 700 KB)
npm run preview    # serve dist/
npm test           # physics unit tests (node:test)
npm run verify     # Playwright end-to-end verification (needs `npm run build` first)
node scripts/perf.mjs      # frame-rate + motion-smoothness probe (swing scroll, free swing)
node scripts/gpubench.mjs  # synchronous GPU cost per chapter and quality tier
```

`npm run verify` serves `dist/`. At 1440×900 and at 390×844 (touch, mobile), and again with emulated `prefers-reduced-motion`, it:

- scrolls through the chapters
- saves one screenshot per chapter to `verify/screenshots/` (reduced-motion runs go to `verify/screenshots/reduced/`)
- lets the rescue auto-complete and asserts `data-rescue="saved"`
- plays free swing with simulated mouse or touch input
- fails on any console error or page error

The full report is written to `verify/report.json`.

URL options: `?q=high|medium|low` forces a quality tier (and locks the adaptive monitor).

## Controls

| Where | Input | Action |
|---|---|---|
| Story | Scroll / swipe | Drive the camera through the chapters |
| Story | `1`–`5` or the right-hand rail | Jump to a chapter |
| Story | `M` or the ♪ button | Toggle generative audio (muted by default) |
| Chapter 5 | Click / tap a glowing anchor ring, or `Tab` to it and press `Enter` | Fire a tether; each anchor brakes the train. Anchors auto-fire after a timeout, so the story always resolves; **SKIP ›** fires them all at once |
| After the rescue | `F`, the rail's **F** button, or "Enter free swing" | Free swing mode |
| Free swing | Hold mouse button (or touch) | Fire a tether at the nearest building along the aim; the rope reels in while held |
| Free swing | Release | Let go, keeping your momentum (an automatic flip or corkscrew at speed) |
| Free swing | `W`/`S` on the ground | Run forward / back (on streets and rooftops) |
| Free swing | `A`/`D` | Turn on the ground; steer in the air |
| Free swing | `Shift` | Sprint |
| Free swing | `Space` | Jump |
| Free swing | `Q` | Aerial trick (flip, corkscrew, twirl) |
| Free swing | `E` (hold) | Fire a tether straight ahead without the mouse; release to let go |
| Free swing (touch) | On-screen pad ◀ ▲ ▶ · JUMP · WEB | Turn / run, jump, fire a tether ahead |
| Free swing | `Esc` or `F` | Back to the story |

## Structure

```
src/
  core/        math, world layout, quality tiers, renderer + post chain, Lenis scroll, shared uniforms
  physics/     Verlet swinger, rope chain, anchor picking, pre-simulated swing path, rescue braking model
  characters/  rig helpers, THREADRUNNER, GANTRY (+ cargo container)
  scenes/      city, environment, track, train, camera rig, director, chapters/*, free swing
  shaders/     tower windows + dynamic lights, sky, streets, lens effect (radial blur, speed lines, CA, flash)
  fx/          tethers (ribbon + Verlet), particle bursts and debris, trauma camera shake
  ui/          HUD, comic impact words and halftone, nav rail, title reveal, rescue anchor buttons
  audio/       Web Audio engine (wind, pad, heartbeat, booms, zaps)
scripts/       verify.mjs (Playwright), size.mjs (bundle budget), sim-swing.mjs (path tuning), contact-sheet.mjs
tests/         physics.test.js
```

Every source file is under 500 lines. See [RESEARCH.md](RESEARCH.md) for the stack decision, physics choice, license notes and the shot-by-shot plan.

## Performance notes

- Benchmark on the **Direct3D 11** ANGLE backend (`--use-angle=d3d11`), which is what desktop Chrome on Windows uses. Playwright's default headless backend is OpenGL-on-ANGLE, and on Intel iGPUs it is about 10× slower, so it gives misleading numbers.
- On an Intel UHD laptop at 1440×900 the high tier measures about 14–18 ms of GPU time per frame, and the swing-scroll probe runs at about 59 fps (p95 16.8 ms).
- Key optimisations:
  - The towers' dynamic-light loop is unrolled with constant indices; the dynamically indexed version was about 60% of frame cost on iGPUs.
  - Instanced towers are sorted front-to-back.
  - All post effects are merged into one full-screen pass.
  - Shaders are precompiled, and GANTRY's lights stay in the scene at zero intensity, so the light count never changes and nothing recompiles mid-story.
  - Free-swing physics is interpolated between fixed 120 Hz steps.
  - The chapter 2 swing path is stored at 60 Hz and sampled with Catmull-Rom.

## Accessibility and resilience

- **prefers-reduced-motion:** no camera shake, no bullet-time ramp, no chromatic aberration, and no speed lines or blur. The chapter 2 swing flight becomes four still framings joined by crossfades, and comic words fade instead of popping.
- **Semantic text layer:** `<main>` holds one `<section>` per chapter, so the whole story reads without WebGL. If WebGL is unavailable, or the context is lost, the page switches to a styled text-only layout (`html.no-webgl`).
- **Rescue anchors** are real `<button>`s projected over the 3D anchor points, so they work with the keyboard and with touch.
- **Adaptive quality:** the `high`, `medium` and `low` tiers scale tower density, rooftop detail, particle counts, pixel-ratio cap and post-processing. At runtime an FPS monitor steps the pixel ratio down, then turns post-processing off.
- **Responsive:** tested at 375–2560 px wide (verified at 390 and 1440).

## CREDITS

### Libraries (bundled)

| Library | Version | License | Use |
|---|---|---|---|
| [three.js](https://github.com/mrdoob/three.js) | 0.186.1 | MIT | WebGL renderer, geometry, instancing |
| [postprocessing](https://github.com/pmndrs/postprocessing) (pmndrs) | 6.39.5 | Zlib | Effect composer, bloom, tone mapping, vignette, custom `Effect` base |
| [anime.js](https://github.com/juliangarnier/anime) | 4.5.0 | MIT | Title stagger, comic impact words, HUD alerts, banners |
| [Lenis](https://github.com/darkroomengineering/lenis) | 1.3.26 | MIT | Smooth scrolling |

### Fonts (self-hosted via Fontsource, bundled into `dist/assets`)

| Font | License |
|---|---|
| [Anton](https://fonts.google.com/specimen/Anton) (Vernon Adams) | SIL Open Font License 1.1 |
| [Bangers](https://fonts.google.com/specimen/Bangers) (Vernon Adams) | SIL Open Font License 1.1 |
| [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) (Florian Karsten) | SIL Open Font License 1.1 |

### Dev tooling

| Tool | License |
|---|---|
| [Vite](https://github.com/vitejs/vite) 8 | MIT |
| [Playwright](https://github.com/microsoft/playwright) 1.63 | Apache-2.0 |
| [@fontsource](https://github.com/fontsource/fontsource) packages | MIT (package code); fonts under OFL |

### References and inspiration (no code copied; techniques reimplemented)

| Reference | License | What it informed |
|---|---|---|
| [jeromeetienne/threex.proceduralcity](https://github.com/jeromeetienne/threex.proceduralcity), after mrdoob's city demo | MIT | Box-based procedural city, window patterns, fog for depth |
| [mrdoob/three.js examples](https://github.com/mrdoob/three.js/tree/dev/examples) (instancing, ammo rope) | MIT | Per-instance attributes; rope as an updated strip |
| [jongallant/Unity-Verlet-Rope](https://github.com/jongallant/Unity-Verlet-Rope) | MIT | Iterative Verlet constraint relaxation with pinned ends |
| [sciecode/sheen](https://github.com/sciecode/sheen) | MIT | Stable position-based-dynamics iteration and damping |
| [spite/THREE.MeshLine](https://github.com/spite/THREE.MeshLine) | MIT | Camera-facing ribbon lines (our tethers) |
| [stegu/webgl-noise](https://github.com/stegu/webgl-noise) / [ashima/webgl-noise](https://github.com/ashima/webgl-noise) | MIT | GLSL hashing approach |
| [profesorshader/shader-speed-lines](https://github.com/profesorshader/shader-speed-lines) | MIT | Polar speed-line streaks |
| [mrdoob/glsl-sandbox](https://github.com/mrdoob/glsl-sandbox) | MIT | Sky gradient and star-hash inspiration |
| [subprotocol/verlet-js](https://github.com/subprotocol/verlet-js) | License not machine-verifiable | Concept only; not consulted for code |
| T. Jakobsen, "Advanced Character Physics" (GDC 2001) | Paper | Verlet integration and constraint projection |
| S. Eiserloh, "Math for Game Programmers: Juicing Your Cameras" (GDC 2016) | Talk | Trauma-based camera shake |

### Original work and fan art

Story, GANTRY, city layout, all shaders, physics, FX, UI and audio synthesis are original to this project.

**Fan-art notice:** the hero's suit is a personal, non-commercial recreation of **Spider-Man 2099 (Miguel O'Hara)**, based on the *Spider-Man: Across the Spider-Verse* design. Spider-Man and Spider-Man 2099 are trademarks and copyrighted characters of Marvel. This build is for local, private use only and must not be published or deployed. Before any public release, swap back to an original suit (the rig and animations are independent of the suit; see `src/characters/suit2099.js`).

Suit references: [Marvel Database: Spider-Man's 2099 Suit](https://marvel.fandom.com/wiki/Spider-Man's_2099_Suit), [CBR: Spider-Man 2099's best costumes](https://www.cbr.com/best-spider-man-2099-costumes-movies-comics-ranked/), [MovieWeb: Spider-Verse 3 2099 look](https://movieweb.com/spider-verse-3-new-photos-tease-new-look-for-spider-man-2099/).
