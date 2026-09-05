import { useStore } from "../engine/store";
import { gbp, gbpExact, ukDate, ukDateTime } from "../lib/format";

export function CaseFile() {
  const { state, decideFact } = useStore();
  const c = state.caseRecord;
  const a1 = c.applicants[0];
  const pending = state.proposedFacts.filter((f) => f.status === "pending" && f.caseRef === c.caseRef);
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            Case {c.caseRef} · {a1.firstName} {a1.lastName}
          </h1>
          <p>
            {c.stage} · {c.adviser} · invitation {c.factFind.invitationId} ({c.factFind.status})
          </p>
        </div>
      </div>

      <div className="grid-3">
        <div className="card">
          <h3>Mortgage</h3>
          <p>{c.mortgage.purpose}</p>
          <p>Loan {gbp(c.mortgage.loanAmount)} on {gbp(c.mortgage.propertyValue)}</p>
          <p>Complete {ukDate(c.mortgage.expectedCompletion)}</p>
          <p>
            {c.mortgage.ratePreference} · {c.mortgage.dealPeriod} · {c.mortgage.termYears} years
          </p>
        </div>
        <div className="card">
          <h3>Income (verified on file)</h3>
          <p>
            {c.income[0].occupation}, {c.income[0].employerName}
          </p>
          <p>Basic {gbp(c.income[0].basicAnnual)}</p>
          <p>Bonus {gbp(c.income[0].bonus)}</p>
          <p className="help">Email/AI cannot change this without Approve.</p>
        </div>
        <div className="card">
          <h3>Protected bank / stage</h3>
          <p>Sort code {c.bankSortCode}</p>
          <p>Account {c.bankAccount}</p>
          <p>Stage {c.stage}</p>
        </div>
      </div>

      <div className="card">
        <h2>Applicant 1</h2>
        <p>
          {a1.title} {a1.firstName} {a1.lastName} · {ukDate(a1.dob)} · {a1.email} · {a1.mobile}
        </p>
        <p>{a1.address}</p>
      </div>

      <div className="card">
        <h2>Related protection &amp; benefits (child records)</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Provider / type</th>
                <th>Detail</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {c.privatePolicies.map((p) => (
                <tr key={p.id}>
                  <td>Private</td>
                  <td>
                    {p.provider} · {p.coverType}
                  </td>
                  <td>
                    {p.term} · trust {p.inTrust}
                  </td>
                  <td>{gbp(p.sumAssured)}</td>
                </tr>
              ))}
              {c.employerBenefits.map((b) => (
                <tr key={b.id}>
                  <td>Employer</td>
                  <td>{b.type}</td>
                  <td>{b.detail}</td>
                  <td>{gbp(b.value)}</td>
                </tr>
              ))}
              {c.mortgageLinkedCover.map((p) => (
                <tr key={p.id}>
                  <td>Mortgage-linked</td>
                  <td>
                    {p.provider} · {p.coverType}
                  </td>
                  <td>{p.notes}</td>
                  <td>{p.sumAssured ? gbp(p.sumAssured) : "—"}</td>
                </tr>
              ))}
              {c.privatePolicies.length + c.employerBenefits.length + c.mortgageLinkedCover.length === 0 ? (
                <tr>
                  <td colSpan={4}>No related cover on the file yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Commitments</h2>
        {c.commitments.length === 0 ? (
          <div className="empty">No commitments recorded.</div>
        ) : (
          <ul>
            {c.commitments.map((x) => (
              <li key={x.id}>
                {x.type} · {x.lender} · {gbpExact(x.monthly)} / month
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Adviser review queue</h2>
        {pending.length === 0 ? (
          <div className="empty">No proposed facts on this case.</div>
        ) : (
          pending.map((f) => (
            <div key={f.id} className="q-block">
              <strong>{f.label}</strong>
              <div className="compare">
                <span>{f.existingValue}</span>
                <span>→</span>
                <span>{f.proposedValue}</span>
              </div>
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
        <h2>Tasks</h2>
        {state.tasks.filter((t) => t.status === "open").length === 0 ? (
          <div className="empty">No open tasks.</div>
        ) : (
          <ul>
            {state.tasks
              .filter((t) => t.status === "open")
              .map((t) => (
                <li key={t.id}>
                  <strong>{t.title}</strong> · {t.owner} · {t.priority}
                  <div className="help">{t.detail}</div>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Communication history</h2>
        {state.communications.slice(0, 8).map((m) => (
          <div className="q-block" key={m.id}>
            <strong>{m.subject}</strong>
            <div className="help">
              {m.direction} · {m.from} · {ukDateTime(m.receivedAt)} · {m.matchStatus}
            </div>
            <p>{m.body}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Immutable submissions &amp; audit</h2>
        {state.submissions.length === 0 ? <p className="help">No fact-find submissions yet.</p> : null}
        {state.submissions.map((s) => (
          <p key={s.id}>
            {s.id} · {ukDateTime(s.submittedAt)} · {s.childRecordsCreated} child records · write-once
          </p>
        ))}
        <ul>
          {state.audit.slice(0, 8).map((a) => (
            <li key={a.id}>
              {ukDateTime(a.at)} — {a.action}: {a.detail}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
