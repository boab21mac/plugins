import { BRANCHING_RULES, FORM_SECTIONS, FORM_SUBTITLE, FORM_TITLE } from "../data/forms-schema";
import { useStore } from "../engine/store";

const TYPE_LABEL: Record<string, string> = {
  text: "Text",
  email: "Text (email restriction)",
  tel: "Text (phone)",
  date: "Date",
  number: "Number",
  currency: "Number (treat as £)",
  choice: "Choice (one answer)",
  multichoice: "Choice (multiple answers)",
  yesno: "Choice — Yes / No",
  dropdown: "Dropdown",
  longtext: "Long answer",
  file: "File upload",
  repeater: "Repeating section (use Likert/text loops or a second form + flow)",
};

export function FormsTemplate() {
  const { setView } = useStore();
  const copyable = buildCopyable();

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Microsoft Forms template</h1>
          <p>
            Exact question list for <strong>{FORM_TITLE}</strong>. Recreate these in Microsoft Forms, then connect the
            Process Submission flow. Internal field keys and CRM destinations are included so mapping is not guessed later.
          </p>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={() => setView("questionnaire")}>
            Open live questionnaire
          </button>
          <button
            className="btn secondary"
            onClick={() => {
              void navigator.clipboard.writeText(copyable);
            }}
          >
            Copy full template
          </button>
        </div>
      </div>

      <div className="card">
        <h2>{FORM_TITLE}</h2>
        <p>{FORM_SUBTITLE}</p>
        <p>
          Recommended Forms settings: one question per page for the long sections is optional; keep Applicant 2, income
          branches and the three protection repeaters on the same form with branching. Prefill <code>caseReference</code>{" "}
          and <code>invitationId</code> from the invitation email.
        </p>
      </div>

      <div className="card">
        <h2>Conditional branching rules</h2>
        <ol>
          {BRANCHING_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
      </div>

      {FORM_SECTIONS.map((section) => (
        <div className="card" key={section.id} id={`section-${section.id}`}>
          <h2>{section.title}</h2>
          <p>{section.intro}</p>
          {section.questions.map((q) => (
            <div className="q-block" key={q.key}>
              <p className="q-wording">
                {q.wording} {q.required ? <span className="req">Required</span> : <span className="pill pill-muted">Optional</span>}
              </p>
              <div className="q-meta">
                <span>
                  Type: <strong>{TYPE_LABEL[q.type]}</strong>
                </span>
                <span>
                  Forms key: <code>{q.key}</code>
                </span>
                <span>
                  CRM: <code>{q.crmField}</code>
                </span>
                <span className={q.protectedField ? "pill pill-hold" : "pill pill-info"}>{q.importBehaviour}</span>
                {q.protectedField ? <span className="pill pill-hold">Protected</span> : null}
              </div>
              {q.choices ? (
                <ul className="choices">
                  {q.choices.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : null}
              {q.repeaterItemSchema ? (
                <div>
                  <p className="help">Child questions on each repeating record:</p>
                  <ul className="choices">
                    {q.repeaterItemSchema.map((child) => (
                      <li key={child.key}>
                        <strong>{child.wording}</strong> — {TYPE_LABEL[child.type]}
                        {child.choices ? ` [${child.choices.join("; ")}]` : ""} → <code>{child.crmField}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="help">Branching: {q.branching}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function buildCopyable(): string {
  const lines: string[] = [FORM_TITLE, FORM_SUBTITLE, "", "BRANCHING", ...BRANCHING_RULES.map((r) => `- ${r}`), ""];
  for (const section of FORM_SECTIONS) {
    lines.push(`## ${section.title}`, section.intro, "");
    for (const q of section.questions) {
      lines.push(
        `${q.wording}`,
        `Required: ${q.required ? "Yes" : "No"}`,
        `Type: ${TYPE_LABEL[q.type]}`,
        q.choices ? `Choices: ${q.choices.join(" | ")}` : "",
        `Branching: ${q.branching}`,
        `Forms key: ${q.key}`,
        `CRM field: ${q.crmField}`,
        `Import: ${q.importBehaviour}${q.protectedField ? " (protected)" : ""}`,
        "",
      );
    }
  }
  return lines.filter((l) => l !== undefined).join("\n");
}
