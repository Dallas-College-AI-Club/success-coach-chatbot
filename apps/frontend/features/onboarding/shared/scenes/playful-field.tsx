import { CampusCritters } from "./campus-critters";

/** Full viewport decorative field; it never owns chat controls or geometry. */
export function PlayfulField() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "#dcebdd url('/mascots/playground-v9/field.svg') center / 100% 100% no-repeat",
        }}
      />
      <CampusCritters />
    </div>
  );
}
