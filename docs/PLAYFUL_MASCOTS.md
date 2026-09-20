# Playful mascot scene

## Approved artwork and scope

The final runtime files are in apps/frontend/features/onboarding/shared/scenes and apps/frontend/public/mascots/playground-v9. Only the Playful background and characters change; the question flow, chat controls, and centered card remain owned by their existing components.

The cast preserves the six accepted facial expressions plus the corrected smiling Bee. Keep the upright Bear, intact Horse/Lion silhouettes, full Thunderduck, phoenix-shaped Sun, silver-gray Eagle details, and school palettes. Do not redraw torsos, replace legs, add exposed joint outlines, or make a new whole-cast expression edit to correct one character. Runtime image hashes are recorded in playful-mascots-artwork.json.

## Motion and loading

- All seven actors stay active. They can be naturally occluded by the chat.
- Bear/Thunderduck and Horse/Lion use separate ground lanes. Opposite partners share a crossing clock and only pass each other behind the panel.
- Ground partners alternate walking and running passes, with distinct speeds for each lane. Fully concealed travel is skipped: characters reappear at the other edge without waiting behind the panel. Visible entrances and exits ease smoothly, and flights use the shortcut only when the panel covers the entire path.
- Ground cadence follows distance, with planted-foot phases and a slower swing. Local feet, wings, tails, and shoulders articulate within the approved drawing; the torso and head are not replaced.
- Bear follows a leaf, Lion follows a ball, Horse has a small leap, Thunderduck has a lightning flourish, and flying characters use curved paths with uniform depth scaling. Bee is 64% of the scene's standard height (70% in the inspection gallery).
- Each face has an independent short blink. Base expressions stay distinct and positive.
- The engine is dynamically imported only for Playful. Decoded assets are shared between mounts; failed loads may retry. Seven WebPs total 291,924 bytes; the campus background is one small SVG with no additional runtime dependency.
- One offscreen WebGL renderer handles local articulation, then composites once into the scene canvas. Missing/failed/lost WebGL falls back to intact artwork travel. No animation library or backend request is added.
- Rendering stops while the page or scene is hidden, observes reduced motion, caps pixel ratio at 1.5, and releases observers/listeners/GPU resources on unmount.

## Verification

From apps/frontend, run:

    node --import tsx --test scripts/check-mascot-motion.mts
    node node_modules/typescript/bin/tsc --noEmit

The five regression checks cover the accepted asset hashes and payload, 160 articulated poses per character without inverted triangles, visible collision avoidance across desktop/narrow layouts over four minutes, distinct walk/run speeds, and concealed-only jumps with prompt reappearance. These checks protect geometry and routes; visual review remains necessary when changing the artwork or rig weights.

## Campus background

The illustrated courtyard references the [Dallas Drive campus models](https://dallasai.club/drive/campuses.js) from the club's [Explore game](https://dallasai.club/club.html?mode=explore): El Centro's tan masonry, taller tower and curved blue-glass entrance; Richland Sabine Hall's stone wings, glass atrium and slatted canopy. The distant skyline includes Reunion Tower. Buildings sit at the sides so the central conversation stays readable. This is decorative campus-inspired scenery, not a geographic map or an official Dallas College logo. The app does not import the game's 3D engine or fetch the club website at runtime.

Visual checks include the full cast, individual poses/blinks, the playground, and the actual centered chat. Existing onboarding selections still advance directly without an added Continue button. Small screens naturally hide more of the decorative cast because chat geometry takes priority.

## Motion references

- Animation Mentor: https://www.animationmentor.com/blog/tutorial-how-to-animate-a-quadruped-walk-cycle/ — contacts, passing poses, weight transfer, and overlap.
- American Museum of Natural History: https://www.amnh.org/explore/ology/zoology/horse-gaits-flipbooks-walk-trot-and-gallop — horse gait sequence reference.
- Duck locomotion study: https://pubmed.ncbi.nlm.nih.gov/22511325/ — lateral transfer over the supporting foot.

The approved upright Bear uses a stylized bipedal stroll. These are restrained 2D mascot interpretations, not literal biological simulations.

## Drafts and handoff

The self-contained review playground, lossless masters, approved reference sheet, and provenance are kept outside the production tree in the user-requested club-project/mascots archive. Runtime source, the single final asset set, tests, and this document belong in the GitHub change. Rejected drafts, source-generation sheets, browser screenshots, and temporary patch scripts do not.

Removed from the application: the unused V8 generated payload, retired campus-scene component, and unused sway/zap/sparkle/twinkle keyframes. The drift animation used by Focus remains.

Backend review findings were sent to the coordinating task, which is handling the narrow backend fixes, schedule grouping, verified professor CV links, the combined build/audit, and the GitHub issue/commit/PR.
