import type { FormQuestion } from "../types";

interface Props {
  question: FormQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}

export function QuestionField({ question, value, onChange, error }: Props) {
  const label = (
    <label htmlFor={question.key}>
      {question.wording} {question.required ? <span className="req">*</span> : null}
    </label>
  );
  const help = question.helpText ? <span className="help">{question.helpText}</span> : null;

  if (question.type === "repeater") {
    const rows = Array.isArray(value) ? (value as Array<Record<string, string>>) : [];
    const schema = question.repeaterItemSchema ?? [];
    return (
      <div className="field">
        {label}
        {help}
        <div className="repeater">
          {rows.length === 0 ? <div className="empty">No rows yet. Add the first record.</div> : null}
          {rows.map((row, index) => (
            <div className="repeater-item" key={`${question.key}-${index}`}>
              {schema.map((child) => (
                <QuestionField
                  key={child.key}
                  question={{ ...child, key: `${question.key}.${index}.${child.key}` }}
                  value={row[child.key]}
                  onChange={(v) => {
                    const next = rows.map((r, i) => (i === index ? { ...r, [child.key]: String(v ?? "") } : r));
                    onChange(next);
                  }}
                />
              ))}
              <button
                type="button"
                className="btn ghost"
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
              >
                Remove this record
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn secondary"
            onClick={() => onChange([...rows, Object.fromEntries(schema.map((c) => [c.key, ""]))])}
          >
            {question.repeaterLabel ?? "Add another"}
          </button>
        </div>
        {error ? <div className="alert err">{error}</div> : null}
      </div>
    );
  }

  if (question.type === "yesno" || question.type === "choice") {
    const choices = question.type === "yesno" ? ["Yes", "No"] : question.choices ?? [];
    return (
      <div className="field">
        {label}
        {help}
        <div className="choice-list">
          {choices.map((c) => (
            <label key={c}>
              <input
                type="radio"
                name={question.key}
                checked={value === c}
                onChange={() => onChange(c)}
              />
              <span>{c}</span>
            </label>
          ))}
        </div>
        {error ? <div className="alert err">{error}</div> : null}
      </div>
    );
  }

  if (question.type === "multichoice") {
    const selected = Array.isArray(value) ? (value as string[]) : value ? String(value).split(", ").filter(Boolean) : [];
    return (
      <div className="field">
        {label}
        {help}
        <div className="choice-list">
          {(question.choices ?? []).map((c) => (
            <label key={c}>
              <input
                type="checkbox"
                checked={selected.includes(c)}
                onChange={() => {
                  const next = selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c];
                  onChange(next);
                }}
              />
              <span>{c}</span>
            </label>
          ))}
        </div>
        {error ? <div className="alert err">{error}</div> : null}
      </div>
    );
  }

  if (question.type === "longtext") {
    return (
      <div className="field">
        {label}
        {help}
        <textarea
          id={question.key}
          value={String(value ?? "")}
          placeholder={question.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {error ? <div className="alert err">{error}</div> : null}
      </div>
    );
  }

  if (question.type === "file") {
    return (
      <div className="field">
        {label}
        {help}
        <input
          id={question.key}
          type="file"
          onChange={(e) => onChange(e.target.files?.[0]?.name ?? "")}
        />
        {value ? <div className="help">Staged file name: {String(value)}</div> : null}
        {error ? <div className="alert err">{error}</div> : null}
      </div>
    );
  }

  const inputType =
    question.type === "email"
      ? "email"
      : question.type === "tel"
        ? "tel"
        : question.type === "date"
          ? "date"
          : question.type === "number" || question.type === "currency"
            ? "number"
            : question.type === "dropdown"
              ? "text"
              : "text";

  if (question.type === "dropdown") {
    return (
      <div className="field">
        {label}
        {help}
        <select id={question.key} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {(question.choices ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {error ? <div className="alert err">{error}</div> : null}
      </div>
    );
  }

  return (
    <div className="field">
      {label}
      {help}
      <input
        id={question.key}
        type={inputType}
        inputMode={question.type === "currency" || question.type === "number" ? "decimal" : undefined}
        value={String(value ?? "")}
        placeholder={question.placeholder ?? (question.type === "currency" ? "0" : undefined)}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? <div className="alert err">{error}</div> : null}
    </div>
  );
}
