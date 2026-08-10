"use client";

import {
  saveSession,
  useHydrateSession,
  type SavedSession,
} from "@/features/onboarding/onboarding-store";
import type { DoneState, Mode } from "@/features/onboarding/skin";
import { AiClubLogo, SuccessCoachWordmark } from "@/features/onboarding/shared/brand";
import { ModeSwitcher } from "@/features/onboarding/shared/mode-switcher";
import { Welcome } from "@/features/onboarding/shared/welcome";
import { emit } from "@/features/onboarding/telemetry";
import type { OnboardingPayload } from "@/features/onboarding/types";
import { useOnboarding } from "@/features/onboarding/use-onboarding";
import { MODES, modeFromId } from "@/features/onboarding/variants";
import { useEffect, useState } from "react";

// Stays mounted through the whole flow — including the end recap — so the mode's
// scene never unmounts and the finish is a smooth overlay, not a new page.
// Restarting bumps the key at the flow level, which remounts this fresh.
function WizardHost({
  mode,
  onComplete,
  done,
  onRestart,
}: {
  mode: Mode;
  onComplete: (p: OnboardingPayload, summary: string[]) => void;
  done: DoneState;
  onRestart: () => void;
}) {
  const api = useOnboarding(onComplete);
  const Shell = mode.Wizard;
  return (
    <Shell
      api={api}
      skin={mode.skin}
      copy={mode.copy}
      done={done}
      onRestart={onRestart}
    />
  );
}

export function OnboardingFlow({ modes = MODES }: { modes?: Mode[] }) {
  // The flow opens on a welcome page where the student picks a look and starts.
  // The switcher then lets them change the look at any time; answers carry over.
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<Mode>(modes[0]);
  const [done, setDone] = useState<DoneState>(null);
  // Bumped to remount the wizard for a fresh run (Start over).
  const [runId, setRunId] = useState(0);

  // Above every consumer: the store must be read from localStorage before
  // anything writes to it.
  useHydrateSession();

  useEffect(() => {
    emit("page_load");
  }, []);

  const start = (m: Mode) => {
    setMode(m);
    setStarted(true);
    emit("cta_tap", { mode: m.id });
    emit("onboarding_started");
  };

  const complete = (payload: OnboardingPayload, summary: string[]) => {
    console.log("onboarding payload", payload);
    setDone({ summary });
    // Persist locally so a return visit can jump straight to this summary.
    saveSession({ payload, summary, modeId: mode.id });
  };

  // Returning student: skip the questions and open their saved summary directly,
  // in the look they used last.
  const resume = (session: SavedSession) => {
    setMode(modeFromId(session.modeId));
    // `resumed` tells the shell to recap from the saved summary — the fresh wizard
    // that mounts underneath has no transcript to rebuild the answers from.
    setDone({ summary: session.summary, resumed: true });
    setStarted(true);
    emit("onboarding_resumed");
  };

  const switchMode = (m: Mode) => {
    emit("cta_tap", { mode: m.id });
    setMode(m);
  };

  // Start over — fresh run, keeping the chosen look. The saved session is
  // intentionally kept until a new completion replaces it: losing everything
  // on an abandoned re-run would be worse.
  const restart = () => {
    setDone(null);
    setRunId((r) => r + 1);
  };

  // Back to the first page — a fresh start.
  const goHome = () => {
    setDone(null);
    setRunId((r) => r + 1);
    setStarted(false);
  };

  if (!started) {
    return <Welcome modes={modes} onStart={start} onResume={resume} />;
  }

  return (
    <main className={`overflow-x-hidden ${mode.fontClass} ${mode.skin.page}`}>
      <div className={mode.skin.shell}>
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AiClubLogo />
            <button
              type="button"
              onClick={goHome}
              aria-label="Success Coach — back to the welcome page"
              className="rounded focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] motion-safe:transition-transform motion-safe:hover:scale-[1.03]"
            >
              <SuccessCoachWordmark height={46} />
            </button>
          </div>
          <ModeSwitcher modes={modes} current={mode} onSwitch={switchMode} />
        </div>

        <WizardHost
          key={runId}
          mode={mode}
          onComplete={complete}
          done={done}
          onRestart={restart}
        />
      </div>
    </main>
  );
}
