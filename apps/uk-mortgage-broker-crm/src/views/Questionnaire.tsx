import { useMemo, useState } from "react";
import { QuestionField } from "../components/QuestionField";
import { FORM_SECTIONS } from "../data/forms-schema";
import { isShown } from "../engine/conditions";
import { useStore } from "../engine/store";

export function Questionnaire() {
  const { state, setDraft, submitFactFind, setView } = useStore();
  const [sectionIndex, setSectionIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const section = FORM_SECTIONS[sectionIndex];
  const visible = useMemo(
    () => section.questions.filter((q) => isShown(q.showIf, state.formDraft)),
    [section, state.formDraft],
  );

  function validateSection(): boolean {
    const next: Record<string, string> = {};
    for (const q of visible) {
      const v = state.formDraft[q.key];
      const empty =
        v === undefined ||
        v === "" ||
        (Array.isArray(v) && v.length === 0);
      if (q.required && empty) next[q.key] = "This question is required.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Live client questionnaire</h1>
          <p>
            Same schema as the Microsoft Forms template. Prefill uses invitation {state.caseRecord.factFind.invitationId} on
            case {state.caseRecord.caseRef}. Submit runs <strong>CRM - Process Client Fact-Find Submission</strong>.
          </p>
        </div>
        <button className="btn secondary" onClick={() => setView("power-automate")}>
          View Power Automate run
        </button>
      </div>

      {state.caseRecord.factFind.status === "expired" ? (
        <div className="alert err">This invitation has expired. Re-send a fact-find from Power Automate before submitting.</div>
      ) : null}

      <div className="stepper">
        {FORM_SECTIONS.map((s, i) => (
          <button key={s.id} className={i === sectionIndex ? "on" : ""} onClick={() => setSectionIndex(i)} type="button">
            {s.title}
          </button>
        ))}
      </div>

      {banner ? <div className={`alert ${banner.kind}`}>{banner.text}</div> : null}

      <div className="card">
        <h2>{section.title}</h2>
        <p>{section.intro}</p>
        {visible.length === 0 ? (
          <div className="empty">No questions in this section for the current answers (branching hid them).</div>
        ) : (
          visible.map((q) => (
            <QuestionField
              key={q.key}
              question={q}
              value={state.formDraft[q.key]}
              error={errors[q.key]}
              onChange={(v) => {
                setDraft(q.key, v);
                setErrors((e) => ({ ...e, [q.key]: "" }));
              }}
            />
          ))
        )}
        <div className="btn-row">
          <button className="btn ghost" disabled={sectionIndex === 0} onClick={() => setSectionIndex((i) => i - 1)}>
            Back
          </button>
          {sectionIndex < FORM_SECTIONS.length - 1 ? (
            <button
              className="btn"
              onClick={() => {
                if (validateSection()) setSectionIndex((i) => i + 1);
              }}
            >
              Continue
            </button>
          ) : (
            <button
              className="btn"
              onClick={() => {
                const next: Record<string, string> = {};
                for (const sec of FORM_SECTIONS) {
                  for (const q of sec.questions) {
                    if (!isShown(q.showIf, state.formDraft)) continue;
                    const v = state.formDraft[q.key];
                    const empty = v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
                    if (q.required && empty) next[q.key] = "This question is required.";
                  }
                }
                setErrors(next);
                if (Object.keys(next).length > 0) {
                  setBanner({ kind: "err", text: "Please complete the required questions in every section before submitting." });
                  return;
                }
                const result = submitFactFind();
                if (result.error) setBanner({ kind: "err", text: result.error });
                else {
                  setBanner({
                    kind: "ok",
                    text: "Submission staged. Proposed changes are waiting for adviser review — verified facts were not overwritten.",
                  });
                  setView("power-automate");
                }
              }}
            >
              Submit fact-find
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
