import { CampusCritters } from "./campus-critters";

/** Full viewport decorative field; it never owns chat controls or geometry. */
export function PlayfulField() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="coach-landscape absolute inset-0"
        style={{
          background:
            "#b5e78f url('/mascots/playground-v9/field.svg') center / cover no-repeat",
        }}
      />
      <div
        className="coach-landscape absolute inset-x-0 top-0"
        style={{
          height: "var(--campus-height, 96px)",
          background:
            "url('/mascots/playground-v9/campuses.svg') center / 100% 100% no-repeat, linear-gradient(#c7eeff 30%, transparent)",
        }}
      />
      <CampusCritters />
    </div>
  );
}
