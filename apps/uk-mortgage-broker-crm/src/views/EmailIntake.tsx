import { useMemo, useState } from "react";
import { CLIENT_EMAIL } from "../data/seed";
import { useStore } from "../engine/store";
import { gbp, ukDate, ukDateTime } from "../lib/format";

export function EmailIntake() {
  const { state, processEmail, decideFact, selectEmail } = useStore();
  const selected = state.inbox.find((e) => e.id === state.selectedEmailId) ?? state.inbox[0];
  const pending = state.proposedFacts.filter((f) => f.status === "pending");
  const [reply, setReply] = useState("");
  const latestInbound = state.flowRuns.find((r) => r.flowName.includes("Inbound"));
  const draft = latestInbound?.acknowledgement || state.lastEmailAi?.replyDraft || "";

  const previewSalary = useMemo(() => {
    const fact = pending.find((f) => f.crmField.includes("basicAnnual"));
    return fact;
  }, [pending]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Client email intake</h1>
          <p>
            Prototype: <strong>{CLIENT_EMAIL}</strong> → case <strong>M-1047</strong>. The flow links the message, summarises
            the last conversation, and holds proposed facts for Approve / Reject. It never patches protected fields on its
            own.
          </p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Shared mailbox · enquiries@harbourandhart.co.uk</h2>
          <div className="inbox">
            {state.inbox.map((mail) => (
              <button
                key={mail.id}
                className={`mail ${selected?.id === mail.id ? "sel" : ""} ${mail.processed ? "done" : ""}`}
                onClick={() => selectEmail(mail.id)}
                type="button"
              >
                <strong>{mail.subject}</strong>
                <div className="help">
                  {mail.from} · {ukDateTime(mail.receivedAt)} · {mail.scenario}
                  {mail.processed ? " · processed" : ""}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          {selected ? (
            <>
              <h2>{selected.subject}</h2>
              <p className="help">
                From {selected.from} · To {selected.to} · {ukDateTime(selected.receivedAt)}
              </p>
              <pre className="expr" style={{ background: "#1a2433" }}>
                {selected.body}
              </pre>
              <div className="btn-row">
                <button className="btn" disabled={selected.processed} onClick={() => processEmail(selected)}>
                  {selected.processed ? "Already processed" : "Run inbound email flow"}
                </button>
              </div>
            </>
          ) : (
            <div className="empty">No message selected.</div>
          )}
        </div>
      </div>

      {state.lastEmailAi ? (
        <div className="card">
          <h2>AI extraction (review-first)</h2>
          <div className="grid-2">
            <div>
              <h3>Client update summary</h3>
              <p>{state.lastEmailAi.updateSummary}</p>
              <h3>Last conversation</h3>
              <p>{state.lastEmailAi.conversationSummary}</p>
            </div>
            <div>
              <h3>Suggested actions</h3>
              <ul>
                {state.lastEmailAi.actions.map((a) => (
                  <li key={a.action}>
                    {a.action} — {a.owner} ({a.priority})
                  </li>
                ))}
              </ul>
              <span className="pill pill-hold">requiresManualReview: {String(state.lastEmailAi.requiresManualReview)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty">Process Daniel’s salary email to see the update summary, last conversation and proposed facts.</div>
      )}

      <div className="card">
        <h2>Proposed facts — Existing → Proposed</h2>
        {pending.length === 0 ? (
          <div className="empty">Nothing waiting. Process the inbound email or submit a fact-find first.</div>
        ) : (
          pending.map((f) => (
            <div key={f.id} style={{ marginBottom: 16 }}>
              <p className="q-wording">
                {f.label}{" "}
                {f.protectedField ? <span className="pill pill-hold">Protected — will not auto-apply</span> : null}
                <span className="pill pill-info">{f.source}</span>
              </p>
              <div className="compare">
                <div className="old">
                  <div className="help">Existing value</div>
                  <strong>{formatFact(f.crmField, f.existingValue)}</strong>
                </div>
                <div>→</div>
                <div className="neu">
                  <div className="help">Proposed value</div>
                  {formatFact(f.crmField, f.proposedValue)}
                </div>
              </div>
              <p className="help">
                Source: “{f.sourceText}” · confidence {f.confidence}
              </p>
              <div className="btn-row">
                <button className="btn ok" onClick={() => decideFact(f.id, "approved")}>
                  Approve
                </button>
                <button className="btn danger" onClick={() => decideFact(f.id, "rejected")}>
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h2>Editable reply (adviser sends)</h2>
        <p className="help">The flow drafts this. It does not send from the shared mailbox until you do.</p>
        <textarea value={reply || draft} onChange={(e) => setReply(e.target.value)} />
        {previewSalary ? (
          <p className="help">
            Example on file: salary {gbp(state.caseRecord.income[0].basicAnnual)} today, proposed {gbp(previewSalary.proposedValue)}{" "}
            if approved. Completion currently {ukDate(state.caseRecord.mortgage.expectedCompletion)}.
          </p>
        ) : null}
      </div>

      {latestInbound ? (
        <div className="card">
          <h2>Last inbound flow run</h2>
          <p>
            <span className={`pill ${latestInbound.status === "succeeded" ? "pill-ok" : "pill-hold"}`}>{latestInbound.status}</span>
          </p>
          {latestInbound.steps.map((s) => (
            <div className="flow-step" key={s.id}>
              <div className={`dot ${s.status}`} />
              <div>
                <strong>{s.title}</strong>
                <div className="help">{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatFact(field: string, value: string) {
  if (!value || value === "—") return "—";
  if (field.includes("basicAnnual") || field.includes("loanAmount")) return gbp(value);
  if (field.includes("expectedCompletion") || field.includes("dob")) return ukDate(value);
  return value;
}
