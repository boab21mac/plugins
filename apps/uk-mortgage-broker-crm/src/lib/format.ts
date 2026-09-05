export function gbp(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function gbpExact(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

export function ukDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return iso;
  }
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function ukDateTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

export function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (typeof value[0] === "object") return `${value.length} record(s)`;
    return value.map(String).join(", ");
  }
  return String(value);
}

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase().replace(/^mailto:/, "");
}

export function fieldLabel(crmField: string): string {
  const labels: Record<string, string> = {
    "income[0].basicAnnual": "Applicant 1 basic annual salary",
    "income.basicAnnual": "Applicant 1 basic annual salary",
    "mortgage.expectedCompletion": "Expected completion date",
    "mortgage.loanAmount": "Mortgage loan amount",
    "applicants[0].email": "Applicant 1 email",
    "applicants[0].firstName": "Applicant 1 first name",
    "applicants[0].lastName": "Applicant 1 surname",
    "case.stage": "Case stage",
    "income[0].employmentStatus": "Applicant 1 employment status",
    "income[0].employerName": "Applicant 1 employer",
    "bankSortCode": "Bank sort code",
    "bankAccount": "Bank account",
    "policies.private[]": "Existing private protection",
    "benefits.employer[]": "Employer benefits",
  };
  return labels[crmField] ?? crmField;
}
