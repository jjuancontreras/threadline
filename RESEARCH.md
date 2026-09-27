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

## 9. Revision 3 (2026-09-26): Spider-Man 2099 fan-art suit (private build)

At the owner's request, for a private, unpublished build, the hero now wears a recreation of Miguel O'Hara's Spider-Man 2099 suit. This supersedes the originality guard-rails in §4 **for the hero's suit only**. The code is still original, and GANTRY and the story are unchanged.

**Design notes gathered**
- Sources: [Marvel Database](https://marvel.fandom.com/wiki/Spider-Man's_2099_Suit), [CBR ranking](https://www.cbr.com/best-spider-man-2099-costumes-movies-comics-ranked/), [MovieWeb](https://movieweb.com/spider-verse-3-new-photos-tease-new-look-for-spider-man-2099/).
- Colours: a blue-black ("technically black") bodysuit with red.
- Emblem: a skull-inspired red spider on the chest and back.
- Mask: see-through lenses outlined by a red design; red that glows ominously in the film.
- Hands: exaggerated forearm claws/spikes and talons.
- Build: bulkier and broader in *Across the Spider-Verse*.
- Cape: the classic torn "web cape" of unstable-molecule fabric under the arms.

**Implementation** (`src/characters/suit2099.js`, `src/characters/cape.js`)
- Canvas-painted emblem (front and back) wrapped on the torso, and a face decal on the helmet front, each with a matching emissive map for the glow.
- Blue fresnel rim sheen via `onBeforeCompile`.
- Cone forearm spikes, talons and toe claws.
- Two under-arm membranes rebuilt in world space every frame from joint markers (shoulder/elbow/wrist to armpit/waist/hip), with a saw-tooth tattered edge that flutters at speed.
- The joint rig, pose library, tricks and gait are untouched, so every animation carries over.

## 10. Revision 4 (2026-09-27): busy street life

- **Traffic** (`scenes/streetSim.js`): cars follow each other with the Intelligent Driver Model (Treiber, Hennecke & Helbing 2000), which gives smooth gap-keeping and queues without collision code. One signal cycle serves the whole grid (north-south vs east-west phases with all-red gaps); a red stop line is treated as a stopped leading car, and cars too close to stop comfortably carry on through (amber rule). Tail lights flare while braking or queued.
- **Pedestrians** (`scenes/pedSim.js`, `scenes/crowd.js`): people walk the sidewalk centre-lines either side of every street, wait at the kerb until the parallel traffic has green, and turn back once they stray from a home range, which keeps the crowd dense in the blocks the story camera sees. About 14% stand still and 30% carry umbrellas. GANTRY's landing and the container impact scatter everyone within 80–90 m at a sprint.
- **Cost**: both sims are pure JS with unit tests. Instanced drawing is two draw calls for traffic and one for crowds, and the walk cycle runs in the vertex shader. Counts scale by tier (cars 2200/1100/380, people 2400/1200/360), and the adaptive-quality floor keeps about a third of each.

## 11. Revision 5 (2026-09-27): free-mode gameplay pass

- **Locomotion**: the old cycle advanced a fixed phase per metre, so a 7 m/s "walk" whirled the legs. Cadence now comes from stride length, which grows with speed (≈3 m per cycle walking, ≈10 m bounding at a sprint), so steps land where the body travels. Walk and run are separate cycles blended by speed; the run adds knee drive, a high heel recovery, pumping bent arms, torso counter-rotation and a flight-phase bounce. W walks at 4.2 m/s and Shift builds (time constant ≈0.55 s) to 26 m/s.
- **Charged jump**: holding Space sinks into a crouch, with camera trauma rising as it charges. The release speed eases out from 14 m/s (a ≈6 m hop) to 40 m/s (≈47 m at our gravity of 17 m/s²), enough height to start swinging from the street.
- **Two-handed slingshot (E)**: picks the best facade point on each side of the heading (ahead, out and up), fires both lines, draws the hero back like a bowstring for 0.42 s, then launches at 42 m/s pitched up (steeper when the anchors are high).
- **Hand choice**: whichever hand is on the anchor's side (relative to travel) throws and holds the line. Left-hand poses are generated by mirroring (swap L/R joints, negate y/z rotations).
- **Tricks**: reference points were Insomniac's Marvel's Spider-Man, Miles Morales and Spider-Man 2 air tricks. They read as stylish because they are *not* constant-speed spins: an anticipation beat, a hang on the key pose (tuck, lay-back, spread), off-axis twists and a follow-through into the next pose. Tricks are now keyframed Hermite curves over pitch, roll and yaw, plus pose blends. They are twistflip, lazyroll (hands behind the head), corkscrew, scissor (flat 360 with a scissor kick), a layout backflip with hang time, and a launch roll after the slingshot.
- **Body**: every part is a ring sweep whose radius is a function of height and angle, so the muscle forms are real geometry that catches the rim light:
  - torso: V-taper with lats, pecs, six-pack, obliques, traps, shoulder blades and a spine groove
  - arms: biceps, triceps and brachioradialis
  - legs: quads with the teardrop, hamstrings and calves
  - proportions: about 24% taller, with a smaller head relative to the frame
- **Props & interactions**:
  - lamp posts sit on the kerbs, lined up with the ground shader's sodium pools
  - roof tanks, AC units, barrels and crane masts are colliders: land, perch and web to them
  - three cranes each hang a ring-lit pipe. E near a mouth web-zips into the pipe, corkscrews down the bore with the camera inside and launches out of the far end
  - E near a lamp post or antenna whirls 1 to 1.5 turns and releases on the tangent that matches the heading
