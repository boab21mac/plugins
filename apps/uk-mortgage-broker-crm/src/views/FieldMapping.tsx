import { mappingRegister } from "../data/forms-schema";
import { PROTECTED_FIELDS } from "../data/expressions";

export function FieldMapping() {
  const rows = mappingRegister();
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>CRM field mapping</h1>
          <p>
            Forms key → Dataverse / CRM destination. Existing private policies, employer benefits and mortgage-linked cover
            are <strong>related child records</strong>, not flattened columns on the case. Protected fields always land in
            the proposed-fact queue.
          </p>
        </div>
      </div>

      <div className="card">
        <h2>Safety control — never auto-alter from inbound email</h2>
        <div className="grid-3">
          {PROTECTED_FIELDS.map((f) => (
            <div key={f.crmField}>
              <strong>{f.label}</strong>
              <div>
                <code>{f.crmField}</code>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Import behaviour</h2>
        <ul>
          <li>
            <strong>system</strong> — validates the invitation; does not overwrite identity.
          </li>
          <li>
            <strong>overwrite-if-empty</strong> — may fill a blank non-protected field from a fact-find. If a value already
            exists, it becomes a proposed change.
          </li>
          <li>
            <strong>propose-review</strong> — always Existing → Proposed with Approve / Reject.
          </li>
          <li>
            <strong>create-child</strong> — insert related policy, benefit or commitment rows.
          </li>
          <li>
            <strong>audit-only</strong> — stored on the immutable submission, not the live case facts.
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>Register</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Forms key</th>
                <th>Question</th>
                <th>CRM destination</th>
                <th>Data type</th>
                <th>Import</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.formsKey + r.crmField}>
                  <td>
                    <code>{r.formsKey}</code>
                  </td>
                  <td>{r.wording}</td>
                  <td>
                    <code>{r.crmField}</code>
                    {r.protectedField ? (
                      <>
                        <br />
                        <span className="pill pill-hold">Protected</span>
                      </>
                    ) : null}
                  </td>
                  <td>{r.dataType}</td>
                  <td>{r.importBehaviour}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
