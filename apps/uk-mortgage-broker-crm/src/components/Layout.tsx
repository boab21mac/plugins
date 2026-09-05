import type { ReactNode } from "react";
import { useStore } from "../engine/store";
import type { ViewId } from "../types";

const PRIMARY: Array<{ id: ViewId; label: string }> = [
  { id: "forms-template", label: "Forms template" },
  { id: "power-automate", label: "Power Automate" },
  { id: "field-mapping", label: "Field mapping" },
  { id: "email-intake", label: "Client email intake" },
];

const SECONDARY: Array<{ id: ViewId; label: string }> = [
  { id: "questionnaire", label: "Live questionnaire" },
  { id: "case-file", label: "Case M-1047" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { view, setView, state, reset } = useStore();
  const pending = state.proposedFacts.filter((f) => f.status === "pending").length;
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-row">
          <div>
            <p className="brand-kicker">Harbour &amp; Hart Mortgages · FCA-aware working file</p>
            <h1 className="brand-title">UK Mortgage Broker CRM V2</h1>
            <p className="brand-sub">
              Fact-find, Power Automate process, CRM mapping and inbound email — review-first. Incoming mail never silently
              changes identity, income, employment, loan size, completion, protection, benefits, bank details or case stage.
            </p>
          </div>
          <div className="topbar-meta">
            <strong>Case {state.caseRecord.caseRef}</strong>
            {state.caseRecord.applicants[0].firstName} {state.caseRecord.applicants[0].lastName}
            <br />
            {state.caseRecord.stage}
            <br />
            {pending} proposed fact{pending === 1 ? "" : "s"} waiting
          </div>
        </div>
        <nav className="nav" aria-label="Primary">
          {PRIMARY.map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
              {item.label}
            </button>
          ))}
          {SECONDARY.map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <div className="banner">
        <strong>Microsoft 365 tenant:</strong> Outlook, Microsoft Forms and Dataverse are not authenticated from this
        environment, so live Power Automate flows cannot be published into your tenant. This app is the working CRM plus an
        executable flow simulator, with importable definitions for when you connect Power Automate yourself.
        <button className="btn ghost" style={{ marginLeft: 12 }} onClick={reset} type="button">
          Reset demo data
        </button>
      </div>
      <main className="main">{children}</main>
      <footer className="footer">
        Isolated app under <code>apps/uk-mortgage-broker-crm/</code> — not a Cursor marketplace plugin. Sterling and UK dates.
        Advice is not given by this screen; it prepares the file for the authorised adviser.
      </footer>
    </div>
  );
}
