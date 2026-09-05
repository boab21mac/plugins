import { useState } from "react";
import { EXPRESSIONS } from "../data/expressions";
import { FLOW_DEFINITIONS, FLOW_SUMMARIES } from "../data/flow-definitions";
import { useStore } from "../engine/store";
import type { FlowRun, PaTab } from "../types";
import { ukDateTime } from "../lib/format";

export function PowerAutomate() {
  const { state, sendInvitation, runReminders, setView } = useStore();
  const [tab, setTab] = useState<PaTab>("fact-find");
  const latest = state.flowRuns[0];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Power Automate</h1>
          <p>
            Four production flows plus the approval flow. The simulator on this page actually executes them against the
            demo CRM. JSON definitions in <code>power-automate/</code> are ready to import when your tenant is connected.
          </p>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={() => setView("questionnaire")}>
            Submit a fact-find
          </button>
          <button className="btn secondary" onClick={() => setView("email-intake")}>
            Process inbound email
          </button>
        </div>
      </div>

      <div className="tabs">
        {(
          [
            ["fact-find", "Fact-find flow"],
            ["inbound-email", "Inbound email"],
            ["expressions", "Expressions"],
            ["reminders", "Reminders"],
            ["approve", "Approve proposed fact"],
          ] as Array<[PaTab, string]>
        ).map(([id, label]) => (
          <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "fact-find" ? (
        <div className="grid-2">
          <div>
            <div className="card">
              <h2>CRM - Send Client Fact-Find</h2>
              <p>Adviser-triggered. Issues invitation ID, emails the Forms link from the shared mailbox, writes history.</p>
              <button className="btn" onClick={sendInvitation}>
                Run send invitation
              </button>
            </div>
            <div className="card">
              <h2>CRM - Process Client Fact-Find Submission</h2>
              <ol>
                {FLOW_SUMMARIES.processSubmission.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="help">Submit the live questionnaire to execute this flow end-to-end.</p>
            </div>
          </div>
          <RunCard run={latest} empty="No flow has been executed yet. Send an invitation or submit the questionnaire." />
        </div>
      ) : null}

      {tab === "inbound-email" ? (
        <div className="grid-2">
          <div className="card">
            <h2>CRM - Process Inbound Client Email</h2>
            <p>Trigger: Office 365 Outlook — When a new email arrives in a shared mailbox (V2).</p>
            <ol>
              {FLOW_SUMMARIES.inbound.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <button className="btn" onClick={() => setView("email-intake")}>
              Open client email intake
            </button>
          </div>
          <RunCard
            run={state.flowRuns.find((r) => r.flowName.includes("Inbound")) ?? latest}
            empty="Process an inbox message to see this flow run."
          />
        </div>
      ) : null}

      {tab === "expressions" ? (
        <div className="card">
          <h2>Copy-ready expressions</h2>
          {EXPRESSIONS.map((ex) => (
            <div key={ex.id} className="q-block">
              <p className="q-wording">
                {ex.step} <span className="pill pill-info">{ex.flow}</span>
              </p>
              <p className="help">{ex.purpose}</p>
              <pre className="expr">{ex.expression}</pre>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "reminders" ? (
        <div className="grid-2">
          <div className="card">
            <h2>CRM - Fact-Find Invitation Reminders</h2>
            <p>Scheduled weekday flow. Current invitation age on the demo file: {state.caseRecord.factFind.daysOpen} day(s).</p>
            <ul>
              <li>Day 3 — first client reminder</li>
              <li>Day 7 — second client reminder</li>
              <li>Day 10 — adviser overdue task</li>
              <li>Day 14 — expire invitation (client must be re-invited)</li>
            </ul>
            <div className="btn-row">
              {[3, 7, 10, 14].map((d) => (
                <button key={d} className="btn secondary" onClick={() => runReminders(d)}>
                  Run as day {d}
                </button>
              ))}
            </div>
          </div>
          <RunCard
            run={state.flowRuns.find((r) => r.flowName.includes("Reminder")) ?? latest}
            empty="Run a reminder pass to see the weekday flow."
          />
        </div>
      ) : null}

      {tab === "approve" ? (
        <div className="card">
          <h2>CRM - Approve Proposed Client Fact</h2>
          <p>
            Triggered when an adviser sets a proposed fact to Approved or Rejected. Only then may a protected CRM value
            change. Use the review queue on Client email intake or the case file.
          </p>
          <button className="btn" onClick={() => setView("email-intake")}>
            Open review queue
          </button>
        </div>
      ) : null}

      <div className="card">
        <h2>Importable definitions</h2>
        <p>
          These JSON documents follow the Logic Apps / Power Automate definition shape. Import via Solutions or recreate
          the steps if your tenant blocks raw import. They are also listed below.
        </p>
        <ul>
          {FLOW_DEFINITIONS.map((f) => (
            <li key={f.name}>
              <code>{f.file}</code> — {f.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RunCard({ run, empty }: { run?: FlowRun; empty: string }) {
  if (!run) return <div className="card empty">{empty}</div>;
  return (
    <div className="card">
      <h2>{run.flowName}</h2>
      <p>
        <span className={`pill ${run.status === "succeeded" ? "pill-ok" : run.status === "failed" ? "pill-err" : "pill-hold"}`}>
          {run.status}
        </span>{" "}
        Started {ukDateTime(run.startedAt)}
      </p>
      {run.steps.map((s) => (
        <div className="flow-step" key={s.id}>
          <div className={`dot ${s.status}`} />
          <div>
            <strong>{s.title}</strong>
            <div className="help">
              {s.connector}
              {s.detail ? ` — ${s.detail}` : ""}
            </div>
            {s.expression ? <pre className="expr">{s.expression}</pre> : null}
          </div>
        </div>
      ))}
      {run.acknowledgement ? (
        <div>
          <h3>Prepared acknowledgement / draft</h3>
          <pre className="expr">{run.acknowledgement}</pre>
        </div>
      ) : null}
    </div>
  );
}
