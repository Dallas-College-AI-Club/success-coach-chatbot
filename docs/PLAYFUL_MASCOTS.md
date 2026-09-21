# Playful mascot scene

## Approved artwork and scope

The final runtime files are in apps/frontend/features/onboarding/shared/scenes and apps/frontend/public/mascots/playground-v9. Only the Playful background and characters change; the question flow, chat controls, and centered card remain owned by their existing components.

The owner requested the full cast to match Blazer's cute, athletic Mustang style on September 20. Blazer remains the style reference and keeps its existing artwork. Six revised WebPs preserve school colors while giving each face a distinct expression: Bear's reassuring smile, Lion's cheeky smirk, Thunderduck's laugh, Phoenix Sun's proud grin, Eagle's focused gaze and Bee's delighted smile. Bear and Lion have shorter legs; Bear and Bee have stronger brows and cleaner eye shapes. Eagle is airborne with raised wings and tucked talons. The phoenix's head, breast and curled wings form a near-circular sun silhouette. Runtime image hashes are recorded in playful-mascots-artwork.json.

The built-in image_gen tool generated and edited each character separately using Blazer and the corresponding existing character as references. Shared brief: cute and cool outlined mascot illustration, recognizable school palette, distinct friendly expression, crisp cel shading, complete silhouette and genuine transparency; no text, clothing, background or ground shadow. Follow-up edits shortened Bear/Lion legs, put Eagle in flight, and strengthened Bear/Bee facial features. The phoenix brief emphasized a recognizable bird face, beak, swept crest and curled flame wings within a solar silhouette. Final assets are the seven named WebPs in apps/frontend/public/mascots/playground-v9; the selected lossless masters and complete prompt set are archived outside the repo in club-project/mascots/restyle-2026-09-20/prompts.json. Files were trimmed, sized to a maximum 420-pixel edge and converted to WebP with transparency preserved.

Blazer's earlier brief specified a green Mustang with swept-back blue mane/tail, cream muzzle, athletic horse proportions and four visible hooves; avoid baby-pony proportions or oversized sparkling eyes. The [official athletics page](https://www.dallascollege.edu/slife/athletics/) identifies Cedar Valley as the Suns; its existing mascot reference informs the phoenix beak and crest. These are custom illustrated interpretations.

## Motion and loading

- All seven actors stay active. They can be naturally occluded by the chat.
- The Phoenix Sun completes a 45-second east-to-west arc: rise on the right, crest above the campuses, set on the left. Fading at dawn/dusk conceals the reset. Its solar silhouette remains upright, with an independent blink; reduced motion keeps it fully visible and still.
- Layout measures the live header and card bounds. Character height scales with the shorter viewport dimension, up to 128 pixels; narrow side gutters no longer shrink the cast to tiny icons. Only bands with room for full-size curved travel are used. In tall windows, Horse/Lion explore the lower meadow while Bear/Thunderduck cross the side fields at different depths. Shorter windows use separate side routes. The Suns character is capped at 56 pixels. Opposite partners share a crossing clock and only pass each other behind the panel.
- Ground partners alternate walking and running passes, with distinct speeds for each lane. Fully concealed travel is skipped: characters reappear at the other edge without waiting behind the panel. Visible entrances and exits ease smoothly, and flights use the shortcut only when the panel covers the entire path.
- Ground cadence follows distance, with planted-foot phases and a slower swing. Local feet, wings, tails, and shoulders articulate within the approved drawing; the torso and head are not replaced.
- Bear follows a leaf, Lion follows a ball, Horse has a small leap, Thunderduck has a lightning flourish, and flying characters use curved paths with uniform depth scaling. Bee is 72% of the scene's standard height (70% in the inspection gallery). Ground paths curve vertically with distinct phases; depth movement follows travel and stops during rests. Open-meadow pacing varies by species, with a faster return. The Eagle retains at least 88% of its base size during flights.
- Each face has an independent short blink, with eye anchors and lid colors fitted to its drawing. Eagle wing pivots follow the new airborne pose. Base expressions stay distinct and positive.
- The engine is dynamically imported only for Playful. Decoded assets are shared between mounts; failed loads may retry. Seven WebPs total 273,074 bytes. Two small SVG layers let the horizon retain its proportions while the meadow fills the viewport; there is no additional runtime dependency.
- One offscreen WebGL renderer handles local articulation, then composites once into the scene canvas. Missing/failed/lost WebGL falls back to intact artwork travel. No animation library or backend request is added.
- Rendering stops while the page or scene is hidden, including zero-size canvases during layout changes. The inspection gallery clamps small positive sizes. Reduced motion, a 1.5 pixel-ratio cap and cleanup of observers/listeners/GPU resources remain in place.

## Verification

From apps/frontend, run:

    node --import tsx --test scripts/check-mascot-motion.mts
    node node_modules/typescript/bin/tsc --noEmit

The ten regression checks cover the selected asset hashes and payload, 160 articulated poses per character without inverted triangles, visible collision avoidance across desktop/narrow layouts over four minutes, distinct walk/run speeds, concealed-only jumps with prompt reappearance, free-space allocation after resizing, responsive sizing and sun proportions, distinct continuous vertical curves, continuous open-field routes, and ten minutes of 45-second sunrise/sunset cycles per viewport, with hidden resets, directional travel, header clearance and an intact silhouette. These checks protect geometry and routes; visual review remains necessary when changing the artwork or rig weights.

## Campus background

The bright meadow and lake use `field.svg`; the complete campus horizon uses `campuses.svg`. Flexible terrain fills the viewport while buildings, flowers and trees retain their proportions. Each campus has its own proportional viewport, distributed across the full width instead of shrinking the entire panorama into the center. The horizon uses up to 180 pixels (24% of the screen height), with a preferred 96-pixel minimum where space permits; it adapts to the measured header without moving the chat. Buildings vary in size and depth among tree groups; darker green hills and contact shadows ground them. All seven remain in the composition on narrow screens. The facades reference the [Dallas Drive campus models](https://dallasai.club/drive/campuses.js) from the club's [Explore game](https://dallasai.club/club.html?mode=explore): Brookhaven's Early College Center, Cedar Valley's Student Engagement Center, Eastfield's Student Success Center, El Centro's entrance, Mountain View's Student Center, North Lake's Library and Richland's Sabine Hall. Reunion Tower, Bank of America Plaza, City Hall and the Margaret Hunt Hill Bridge follow the game's [landmark models](https://dallasai.club/drive/landmark-models.js). The foreground stays open for characters, with colorful flowers and a lake. All three themes retain the same chat position and dimensions; the scenery adapts around them. In system dark mode, the shared color palette changes the UI while a CSS filter dims only the landscapes; mascot artwork remains visible and unchanged. The left-to-right order is west to east, verified from the place coordinates in Dallas College’s published Google Maps links: [North Lake](https://www.dallascollege.edu/maps/north-lake/) (−96.9673), [Mountain View](https://www.dallascollege.edu/maps/mountain-view/) (−96.9045), [Brookhaven](https://www.dallascollege.edu/maps/brookhaven/) (−96.8501), [El Centro](https://www.dallascollege.edu/maps/el-centro/) (−96.8053), [Cedar Valley](https://www.dallascollege.edu/maps/cedar-valley/) (−96.7637), [Richland](https://www.dallascollege.edu/maps/richland/) (−96.7292), [Eastfield](https://www.dallascollege.edu/maps/eastfield/) (−96.6597). Sizes, depth and spacing remain decorative; the scene is not a distance map or an official Dallas College logo. The app does not import the game's 3D engine or fetch the club website at runtime.

Visual checks include the full cast, individual poses/blinks, the playground, and the actual centered chat. The revised cast was checked in dark mode at five viewport sizes (1572×1272, 1034×1253, 1280×800, 390×844 and 844×390); all seven actors remained active with no clipping or horizontal page overflow in the sampled frames. Twenty hide/show actions followed by resizing no longer produce canvas errors. Existing onboarding selections still advance directly without an added Continue button. Small screens naturally hide more of the decorative cast because chat geometry takes priority.

## Motion references

- Animation Mentor: https://www.animationmentor.com/blog/tutorial-how-to-animate-a-quadruped-walk-cycle/ — contacts, passing poses, weight transfer, and overlap.
- American Museum of Natural History: https://www.amnh.org/explore/ology/zoology/horse-gaits-flipbooks-walk-trot-and-gallop — horse gait sequence reference.
- Duck locomotion study: https://pubmed.ncbi.nlm.nih.gov/22511325/ — lateral transfer over the supporting foot.

The approved upright Bear uses a stylized bipedal stroll. These are restrained 2D mascot interpretations, not literal biological simulations.

## Drafts and handoff

The self-contained review playground, lossless masters, approved reference sheet, and provenance are kept outside the production tree in the user-requested club-project/mascots archive. Runtime source, the single final asset set, tests, and this document belong in the GitHub change. Rejected drafts, source-generation sheets, browser screenshots, and temporary patch scripts do not.

Removed from the application: the unused V8 generated payload, retired campus-scene component, and unused sway/zap/sparkle/twinkle keyframes. The drift animation used by Focus remains.

Backend review findings were sent to the coordinating task, which is handling the narrow backend fixes, schedule grouping, verified professor CV links, the combined build/audit, and the GitHub issue/commit/PR.
