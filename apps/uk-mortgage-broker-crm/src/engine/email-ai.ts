import type { CaseRecord, Communication, EmailAiResult, InboundEmail } from "../types";
import { gbp, ukDate } from "../lib/format";

const SALARY = /(?:salary|pay|basic|earning[s]?|income)\s+(?:is now|has (?:increased|gone up|changed)|now)\s+(?:to\s+)?£?\s*([\d,]+)/i;
const SALARY_ALT = /(?:my salary is now|salary is now)\s+£?\s*([\d,]+)/i;
const COMPLETION =
  /complet(?:e|ion)\s+(?:on|by|date)?\s*(?:the\s+)?(\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i;
const NEW_EMAIL = /(?:use this email|new (?:personal )?email|instead of)\s+[^\n]*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i;

function parseUkDate(text: string): string | null {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  if (slash) return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
  const months: Record<string, string> = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  };
  const named = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(text);
  if (named) {
    const mm = months[named[2].toLowerCase()];
    if (mm) return `${named[3]}-${mm}-${named[1].padStart(2, "0")}`;
  }
  return null;
}

export function extractEmailFacts(email: InboundEmail, caseRecord: CaseRecord, prior: Communication[]): EmailAiResult {
  const proposedFacts: EmailAiResult["proposedFacts"] = [];
  const actions: EmailAiResult["actions"] = [];
  const body = email.body;
  const salaryMatch = SALARY_ALT.exec(body) ?? SALARY.exec(body);
  if (salaryMatch) {
    const proposed = salaryMatch[1].replace(/,/g, "");
    proposedFacts.push({
      crmField: "income[0].basicAnnual",
      proposedValue: proposed,
      sourceText: salaryMatch[0],
      confidence: "high",
    });
    actions.push({
      action: "Confirm updated salary evidence (new contract or latest payslip)",
      owner: "Adviser",
      priority: "Medium",
    });
  }
  const completionMatch = COMPLETION.exec(body);
  if (completionMatch) {
    const iso = parseUkDate(completionMatch[1]) ?? completionMatch[1];
    proposedFacts.push({
      crmField: "mortgage.expectedCompletion",
      proposedValue: iso,
      sourceText: completionMatch[0],
      confidence: "high",
    });
    actions.push({
      action: "Re-check DIP / offer validity against the new completion date",
      owner: "Adviser",
      priority: "High",
    });
  }
  const emailChange = NEW_EMAIL.exec(body) || email.scenario === "email-change";
  if (emailChange) {
    const next =
      typeof emailChange === "object"
        ? emailChange[1]
        : /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i.exec(email.from)?.[1] ?? email.from;
    proposedFacts.push({
      crmField: "applicants[0].email",
      proposedValue: next,
      sourceText: "Client asked to change the file email address",
      confidence: "medium",
    });
    actions.push({
      action: "Verify the new email address with the client on a known number before changing the file",
      owner: "Adviser",
      priority: "High",
    });
  }

  if (email.forwarded) {
    actions.push({
      action: "Treat as forwarded correspondence — do not assume the original sender authenticated this message",
      owner: "Administrator",
      priority: "High",
    });
  }

  const last = prior.slice(0, 3).map((c) => c.subject).join("; ") || "No prior file notes";
  const updateSummary =
    proposedFacts.length === 0
      ? "No structured fact changes extracted. Message added to the file for the adviser to read."
      : proposedFacts
          .map((f) => {
            if (f.crmField.includes("basicAnnual")) {
              return `Salary proposed ${gbp(f.proposedValue)} (file currently ${gbp(caseRecord.income[0].basicAnnual)})`;
            }
            if (f.crmField.includes("expectedCompletion")) {
              return `Completion proposed ${ukDate(f.proposedValue)} (file currently ${ukDate(caseRecord.mortgage.expectedCompletion)})`;
            }
            if (f.crmField.includes("email")) {
              return `Email change proposed to ${f.proposedValue}`;
            }
            return `${f.crmField} → ${f.proposedValue}`;
          })
          .join(". ");

  const conversationSummary = `Latest inbound from ${email.from} (${email.subject}). Prior thread covers: ${last}. Client tone is operational rather than a complaint.`;

  const firstName = caseRecord.applicants[0].firstName || "there";
  const replyDraft = [
    `Dear ${firstName},`,
    "",
    "Thank you for the update — I have added it to your file.",
    proposedFacts.length
      ? "I will review the suggested changes against the information we already hold and come back to you once I have confirmed them. I will not alter protected details (income, completion date, or contact email) until I have checked them."
      : "I have read your message and will reply properly once I have checked the file.",
    salaryMatch ? "If you are able to send the new contract or a payslip showing the revised salary, that will help us keep the lender picture accurate." : "",
    "",
    "Kind regards",
    caseRecord.adviser,
    "Harbour & Hart Mortgages",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");

  return {
    updateSummary,
    conversationSummary,
    proposedFacts,
    actions:
      actions.length > 0
        ? actions
        : [{ action: "Read and reply to the client", owner: "Adviser", priority: "Medium" }],
    replyDraft,
    requiresManualReview: true,
  };
}
