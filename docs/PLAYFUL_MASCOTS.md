# Playful mascot scene

## Approved artwork and scope

The final runtime files are in apps/frontend/features/onboarding/shared/scenes and apps/frontend/public/mascots/playground-v9. Only the Playful background and characters change; the question flow, chat controls, and centered card remain owned by their existing components.

Five characters retain their accepted artwork, including the corrected smiling Bee. At the owner's request on September 20, Blazer now has a longer muzzle, athletic build, smaller almond-shaped eye and swept-back blue mane, using the existing Blazers reference and the other characters' cute illustration style. Its hoof, tail and blink anchors follow the new drawing. The Suns character is a round sun with a phoenix face and flame rays. Keep the upright Bear, intact Lion silhouette, full Thunderduck, silver-gray Eagle details and school palettes. Do not make a whole-cast edit to correct one character. Runtime image hashes are recorded in playful-mascots-artwork.json.

Blazer was generated with the built-in image tool, then trimmed, resized with transparency preserved and converted to WebP for the existing runtime slot. Generation brief: a cute full-body Mustang/Blazer facing right, green coat, swept-back blue mane and tail, cream muzzle, athletic horse proportions and four visible hooves; match the Lion and Bear's outlined mascot style, with a transparent background and no text. Avoid round baby-pony proportions, oversized sparkling eyes or decorative pony markings. The final asset is `apps/frontend/public/mascots/playground-v9/blazer-stallion.webp`; discarded drafts remain outside the repository.

The [official athletics page](https://www.dallascollege.edu/slife/athletics/) identifies Cedar Valley as the Suns. Its existing mascot reference informed the phoenix face, beak and swept flame crest. The Suns revision used the built-in image tool with that reference and the existing cast. Generation brief: a near-circular golden sun with orange flame rays, a friendly phoenix face and swept crest, matching the Lion's outlined illustration style; no full bird body, outstretched wings, legs, long tail or text; transparent background. The trimmed 420 × 420 WebP is `apps/frontend/public/mascots/playground-v9/sun-phoenix.webp`.

## Motion and loading

- All seven actors stay active. They can be naturally occluded by the chat.
- The Suns character slowly patrols across the sky with a gentle rise and fall and an independent blink. Its round silhouette does not flap, bank or turn over like a flying bird.
- Layout measures the live header and card bounds. Character height scales with the shorter viewport dimension, up to 128 pixels; narrow side gutters no longer shrink the cast to tiny icons. Only bands with room for full-size curved travel are used. In tall windows, Horse/Lion explore the lower meadow while Bear/Thunderduck cross the side fields at different depths. Shorter windows use separate side routes. The Suns character is capped at 56 pixels. Opposite partners share a crossing clock and only pass each other behind the panel.
- Ground partners alternate walking and running passes, with distinct speeds for each lane. Fully concealed travel is skipped: characters reappear at the other edge without waiting behind the panel. Visible entrances and exits ease smoothly, and flights use the shortcut only when the panel covers the entire path.
- Ground cadence follows distance, with planted-foot phases and a slower swing. Local feet, wings, tails, and shoulders articulate within the approved drawing; the torso and head are not replaced.
- Bear follows a leaf, Lion follows a ball, Horse has a small leap, Thunderduck has a lightning flourish, and flying characters use curved paths with uniform depth scaling. Bee is 72% of the scene's standard height (70% in the inspection gallery). Ground paths curve vertically with distinct phases; depth movement follows travel and stops during rests. Open-meadow pacing varies by species, with a faster return. The Eagle retains at least 88% of its base size during flights.
- Each face has an independent short blink. Base expressions stay distinct and positive.
- The engine is dynamically imported only for Playful. Decoded assets are shared between mounts; failed loads may retry. Seven WebPs total 276,116 bytes. Two small SVG layers let the horizon retain its proportions while the meadow fills the viewport; there is no additional runtime dependency.
- One offscreen WebGL renderer handles local articulation, then composites once into the scene canvas. Missing/failed/lost WebGL falls back to intact artwork travel. No animation library or backend request is added.
- Rendering stops while the page or scene is hidden, observes reduced motion, caps pixel ratio at 1.5, and releases observers/listeners/GPU resources on unmount.

## Verification

From apps/frontend, run:

    node --import tsx --test scripts/check-mascot-motion.mts
    node node_modules/typescript/bin/tsc --noEmit

The ten regression checks cover the selected asset hashes and payload, 160 articulated poses per character without inverted triangles, visible collision avoidance across desktop/narrow layouts over four minutes, distinct walk/run speeds, concealed-only jumps with prompt reappearance, free-space allocation after resizing, responsive sizing and sun proportions, distinct continuous vertical curves, continuous open-field routes, and a ten-minute Suns patrol without visible jumps, clipping or silhouette deformation. These checks protect geometry and routes; visual review remains necessary when changing the artwork or rig weights.

## Campus background

The bright meadow and lake use `field.svg`; the complete campus horizon uses `campuses.svg`. Flexible terrain fills the viewport while buildings, flowers and trees retain their proportions. Each campus has its own proportional viewport, distributed across the full width instead of shrinking the entire panorama into the center. The horizon uses up to 180 pixels (24% of the screen height), with a preferred 96-pixel minimum where space permits; it adapts to the measured header without moving the chat. Buildings vary in size and depth among tree groups; darker green hills and contact shadows ground them. All seven remain in the composition on narrow screens. The facades reference the [Dallas Drive campus models](https://dallasai.club/drive/campuses.js) from the club's [Explore game](https://dallasai.club/club.html?mode=explore): Brookhaven's Early College Center, Cedar Valley's Student Engagement Center, Eastfield's Student Success Center, El Centro's entrance, Mountain View's Student Center, North Lake's Library and Richland's Sabine Hall. Reunion Tower, Bank of America Plaza, City Hall and the Margaret Hunt Hill Bridge follow the game's [landmark models](https://dallasai.club/drive/landmark-models.js). The foreground stays open for characters, with colorful flowers and a lake. All three themes retain the same chat position and dimensions; the scenery adapts around them. In system dark mode, the shared color palette changes the UI while a CSS filter dims only the landscapes; mascot artwork remains visible and unchanged. This is decorative campus-inspired scenery, not a geographic map or an official Dallas College logo. The app does not import the game's 3D engine or fetch the club website at runtime.

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
