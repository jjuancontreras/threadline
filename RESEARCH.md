# THREADLINE — Research & Scene Plan (Phase 0)

Research date: 2026-09-26. Versions below were checked with `npm view <pkg> version license`
and repository licenses with `gh api repos/<owner>/<repo>`.

## 1. Libraries surveyed

| Area | Candidate | Version | License | Verdict |
|---|---|---|---|---|
| Renderer | **three.js** | 0.186.1 | MIT | **Chosen.** `WebGLRenderer` + `InstancedMesh` + custom `ShaderMaterial`. WebGPU renderer skipped: Playwright headless relies on SwiftShader/ANGLE, where WebGL2 is the reliable path. |
| Post FX | **pmndrs/postprocessing** | 6.39.5 | Zlib | **Chosen** over three's `EffectComposer` addon: merges effects into one fullscreen pass (cheaper on mobile). Peer range `three >=0.168 <0.187` matches r186. `BloomEffect` (mipmap blur) + `VignetteEffect` + one custom `Effect` (`EffectAttribute.CONVOLUTION`, samples `inputBuffer`) that does radial motion blur, speed lines and chromatic aberration in one pass. |
| Post FX | three `EffectComposer` / `UnrealBloomPass` | r186 | MIT | Rejected: one render target per pass, heavier on mobile. |
| DOM motion | **anime.js v4** | 4.5.0 | MIT | **Chosen.** ESM named exports: `animate(targets, params)`, `stagger(val, params)`, `createTimeline()`, `ease` param (`'outExpo'`, `'out(3)'`, `'inOutQuad'`). Used for title stagger, comic impact words, HUD alert, halftone flashes, banners. |
| Scroll | **Lenis** | 1.3.26 | MIT | **Chosen.** Smooth scroll with `lenis.on('scroll')`, `lenis.scrollTo(target, {duration, immediate})`, `autoRaf`. |
| Scroll | GSAP + ScrollTrigger | 3.15.0 | GSAP "Standard no-charge" license (not OSI) | Rejected: would work, but the brief prefers MIT/Apache code and chapter progress is simple arithmetic over section offsets. Lenis + a ~60-line progress mapper covers it. |
| Physics | cannon-es | 0.20.0 | MIT | Rejected: rigid-body engine; ropes need many bodies + constraints, and we need scrubbable/deterministic playback. |
| Physics | Rapier (`@dimforge/rapier3d-compat`) | 0.21.0 | Apache-2.0 | Rejected: ~600 KB+ WASM (blows the 700 KB gz budget alone) for a problem that is a handful of particles. |
| Physics | **Custom Verlet solver** | — | own code (MIT) | **Chosen.** Position-based Verlet (Jakobsen 2001 "Advanced Character Physics"). The hero is a Verlet particle with a one-sided (slack-allowed) distance constraint to the anchor, which is momentum-preserving by construction (velocity is implicit in `pos - prev`). Tether *visuals* are separate 18-point Verlet chains pinned at both ends. Deterministic, so chapter 2's swing is **simulated once at load and scrubbed by scroll**. |
| Audio | Tone.js | 15.1.22 | MIT | Rejected for size (~90 KB gz). |
| Audio | **Raw Web Audio API** | — | platform | **Chosen.** Noise-buffer wind (band-pass, gain = speed), detuned-saw pad, heartbeat (two pitched sine thumps), impact booms and tether zaps. Opt-in, muted by default. |
| Build | **Vite** | 8.3.1 | MIT | Chosen. Static `dist/`. |
| Test | **Playwright** | 1.63.0 | Apache-2.0 | Chosen for `scripts/verify.mjs`. |
| Fonts | **Anton**, **Space Grotesk**, **Bangers** via `@fontsource/*` | 5.3.0 | SIL OFL 1.1 | Chosen; woff2 files are bundled into `dist/assets` (self-hosted, no CDN). |

## 2. Creative-coding references (licenses checked)

| # | Repo | Topic | License | How it is used |
|---|---|---|---|---|
| 1 | [jeromeetienne/threex.proceduralcity](https://github.com/jeromeetienne/threex.proceduralcity) | Procedural city (port of mrdoob's city demo) | MIT | Idea: one box geometry, per-building random height, window pattern that fades with height, fog for depth. Reimplemented with `InstancedMesh` and a shader-computed window grid (no canvas texture). |
| 2 | [mrdoob/three.js](https://github.com/mrdoob/three.js) `examples/` (instancing, `physics_ammo_rope`) | Instancing, rope demo | MIT | `InstancedMesh` per-instance attributes pattern; rope rendered as a line strip updated each frame. No code copied beyond public API usage. |
| 3 | [subprotocol/verlet-js](https://github.com/subprotocol/verlet-js) | Verlet particles + distance constraints | NOASSERTION (README says MIT, no LICENSE file detected by GitHub) | **Concept only** because the license is not machine-verifiable; our solver is written from the Jakobsen paper. |
| 4 | [jongallant/Unity-Verlet-Rope](https://github.com/jongallant/Unity-Verlet-Rope) | Verlet rope, iterative constraint relaxation | MIT | Pattern: N relaxation iterations per step, pinned endpoints, gravity per particle. Re-expressed in JS. |
| 5 | [sciecode/sheen](https://github.com/sciecode/sheen) | GPU cloth / position-based dynamics in three.js | MIT | Reference for stable PBD iteration counts and damping values. |
| 6 | [spite/THREE.MeshLine](https://github.com/spite/THREE.MeshLine) | Screen-space thick lines | MIT | Idea: glow lines as camera-facing ribbons. We build our own ribbon (tube-like quad strip) for tethers so bloom catches them. |
| 7 | [stegu/webgl-noise](https://github.com/stegu/webgl-noise) / [ashima/webgl-noise](https://github.com/ashima/webgl-noise) | GLSL noise | MIT | Only a tiny hash (`fract(sin(dot()))` style) is used for window randomness; no file copied. |
| 8 | [profesorshader/shader-speed-lines](https://github.com/profesorshader/shader-speed-lines) | Anime speed-line shader | MIT | Idea: polar-coordinate streaks masked by a radial falloff. Reimplemented inside our lens effect. |
| 9 | [mrdoob/glsl-sandbox](https://github.com/mrdoob/glsl-sandbox) | Shader gallery | MIT | Inspiration for the night sky gradient + star hash. |

Rejected (no license / unclear): dissimulate/Tearable-Cloth (no license file), totocrhiss/threejs-explosion-masterclass (no license) — not consulted for code.

**Net result: no third-party source files are copied.** All code in `src/` is original; references above are credited in README → CREDITS.

## 3. Chosen stack (final)

- Vite 8 + vanilla ES modules (JS with JSDoc), static build.
- three.js r186 `WebGLRenderer`, pmndrs/postprocessing 6.39 (bloom + custom lens effect + vignette).
- Custom Verlet physics in `/src/physics` (pure JS, unit-tested with `node:test`).
- anime.js v4 for all DOM motion; Lenis for smooth scroll.
- Raw Web Audio generative score in `/src/audio`.
- Fonts: Anton (display), Bangers (comic SFX words), Space Grotesk (body) — OFL, self-hosted.

## 4. Originality guard-rails

- THREADRUNNER: matte-black suit, **electric-teal filament lines** running along limbs and one diagonal chest line; plain rounded helmet with a thin horizontal teal visor bar (no large eye lenses, no emblem, no web pattern, no red/blue).
- Tethers: luminous teal energy filaments with a hot white core. Sound word for firing is **"TZING"** (not any existing franchise's SFX).
- GANTRY: industrial yellow-and-rust demolition mech, hazard stripes, chrome hydraulic pistons on arms and legs, single **red sensor eye** in a boxy cab.
- Shots are composed for this layout (side-on rescue with tethers anchored to towers *behind* the train) — not modeled on any film shot.

## 5. World layout (meters)

- Avenue ("the canyon") runs along −Z from z=+40 to z=−440, towers flanking at |x| ≈ 26–60.
- **Spire** (perch): x=−34, z=30, roof 150 m, needle to 185 m.
- **Maglev line** along +X at z=−500, deck height 52 m, carried between tower pairs; the **bridge span** is x∈[−40, 40]; the **severed segment** is x∈[−12, 12].
- **GANTRY's rooftop**: tower at x=58, z=−540, roof 46 m.
- Rescue anchor towers flank the track behind the train at x≈−55, −95, −140 (z=−500±24).

## 6. Shot-by-shot plan (one continuous camera)

Each chapter is a `<section>` of the semantic story layer; scroll progress `p∈[0,1]` inside the section drives the shot.

| Ch | p | Shot | Events / FX |
|---|---|---|---|
| 1 PERCH | 0.00 | Wide establishing, low over the avenue, sky at dusk (orange→violet). | Title "THREADLINE" letters stagger in (anime.js). |
| | 0.0→0.7 | Crane up the spire; sky lerps to night, windows switch on progressively. | Stars fade in, antenna beacons blink. |
| | 0.7→1.0 | Close three-quarter on THREADRUNNER crouched on the spire edge; teal filaments pulse. | Hero rises, leans forward (jump anticipation). |
| 2 SWING | 0→1 | Chase camera behind/above the hero; path = pre-simulated Verlet swing down the canyon (≈7 tether swings). | Tethers attach to real tower facade points; speed lines + radial blur scale with speed; FOV kick; wind audio gain = speed. Reduced motion: 4 still framings with crossfades. |
| 3 THREAT | 0→0.2 | Hero lands on a rooftop near the maglev line; camera settles over the shoulder. | HUD alert "SEISMIC SPIKE — SECTOR 7". |
| | 0.15→0.9 | Maglev train glides across the bridge between towers, windows throwing warm light on facades. | |
| | 0.45 | GANTRY drops from the sky onto its rooftop. | Dust shockwave ring, camera shake, "THOOM", halftone flash. |
| 4 IMPACT | 0→0.35 | GANTRY rips a cargo container, winds up. | Red eye flare. |
| | 0.35→0.7 | **Bullet time**: story time ramps to 0.12× while the container arcs; chromatic aberration rises. | Time-scale ramp (reduced motion: linear time, no CA). |
| | 0.7 | Container hits the track. | Sparks + debris, "KRAAK", segment x∈[−12,12] tilts and falls. |
| | 0.7→1 | Train races toward the gap; camera looks down the track from beyond the gap. | |
| 5 RESCUE | start | Side-on shot from beyond the gap; 4 anchor rings pulse on towers behind the train. | Interactive: click/tap/Enter an anchor → tether from hero (on lead car) to anchor, strain, sparks, shake, heartbeat. Each anchor adds deceleration. |
| | ≤9 s | If time runs out, or the stopping distance becomes critical, remaining anchors auto-fire. | Final phase uses exact braking `a = v²/2d`, nose stops 0.25 m from the edge — always. |
| | saved | "TRAIN SAVED" banner, outro text, credits, **FREE SWING unlocked** (F). | `data-rescue="saved"` on `<html>`. |

## 7. Performance plan

- Tiers `high / medium / low` from `pointer:coarse`, screen size, `hardwareConcurrency`, `deviceMemory`; override `?q=`.
- Tier controls tower count (≈1500 / 900 / 450), particle counts, DPR cap (2 / 1.5 / 1), bloom on/off, post pass on/off.
- Runtime monitor: rolling FPS < 40 (desktop) / < 28 (mobile) for 2.5 s → step DPR down, then tier down.
- Bundle budget: < 700 KB gzipped JS (three ≈ 170 KB gz dominates).

## 8. Revision 2 (2026-09-26): look, animation and performance pass

- **Hero colour:** the filaments are now neon red (tethers too). The originality guard-rails in §4 still hold: no emblem, no web pattern, no large eye lenses, energy tethers rather than webs. Acrobatics are generic gymnastics (front and back flips, corkscrews, twirls), not recreated film shots.
- **Look:**
  - Darker, film-graded night: ACES, then a custom grade effect (teal shadows, sodium highlights, S-curve, 0.86 saturation, grain).
  - Glass-curtain and concrete facades with fresnel sky reflection; far-field window detail fades out to stop aliasing.
  - Cloud deck lit from below; height haze; wet asphalt with puddles and lamp pools.
  - The old animated street streaks were replaced by instanced cars with headlight pools.
- **Chapter 3:** a two-tether slingshot (stretch, launch with a backflip, land, run to the edge). Then a twinkle turns into the carrier, bay doors open, GANTRY drops, and six coloured GANTRY-class units drop onto other rooftops. The carrier withdraws in the epilogue.
- **Free mode:** running on streets and roofs, sprint, jump, a shoot pose, auto and manual tricks, landing recovery, sliding off walls.
- **Performance findings:**
  - A dynamically indexed uniform-array loop in the tower shader dominated GPU time on Intel UHD; it is now unrolled via three.js `#pragma unroll_loop`.
  - Hiding a group that holds lights changes the light count and forces every lit material to recompile, which showed up as a 100–150 ms hitch on entering chapter 3. Lights now live at scene level and are zeroed instead.
  - Benchmarks must run on the D3D11 backend; see README → Performance notes.
- **Bug fixed:** the rescue scroll lock could engage 1 px before chapter 5 and deadlock the page. The climax now latches its own state.
