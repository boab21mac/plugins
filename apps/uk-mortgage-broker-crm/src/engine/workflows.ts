import { FORM_SECTIONS } from "../data/forms-schema";
import { CASE_REF, CLIENT_EMAIL, INVITATION_ID, OFFICE_MAILBOX } from "../data/seed";
import { displayValue, fieldLabel, normaliseEmail, nowIso, uid } from "../lib/format";
import type {
  AppState,
  AuditEvent,
  CaseRecord,
  Communication,
  EmployerBenefit,
  FlowRun,
  FlowStep,
  InboundEmail,
  PolicyRecord,
  ProposedFact,
  StagedSubmission,
  TaskItem,
} from "../types";
import { isShown } from "./conditions";
import { extractEmailFacts } from "./email-ai";

const PROTECTED_PATHS = new Set([
  "applicants[0].firstName",
  "applicants[0].lastName",
  "applicants[0].dob",
  "applicants[0].email",
  "applicants[1].email",
  "income[0].basicAnnual",
  "income[0].employmentStatus",
  "income[0].employerName",
  "income[0].occupation",
  "mortgage.loanAmount",
  "mortgage.expectedCompletion",
  "mortgage.propertyValue",
  "mortgage.purchasePrice",
  "mortgage.deposit",
  "policies.private[]",
  "benefits.employer[]",
  "bankSortCode",
  "bankAccount",
  "case.stage",
  "case.caseRef",
]);

function step(id: string, title: string, connector: string, detail: string, expression?: string): FlowStep {
  return { id, title, connector, detail, expression, status: "pending" };
}

function mark(run: FlowRun, id: string, status: FlowStep["status"], detail?: string) {
  run.steps = run.steps.map((s) => (s.id === id ? { ...s, status, detail: detail ?? s.detail } : s));
}

function audit(action: string, detail: string, actor: string): AuditEvent {
  return { id: uid("aud"), at: nowIso(), actor, action, detail };
}

function getByPath(obj: unknown, path: string): unknown {
  if (path.endsWith("[]")) return getByPath(obj, path.slice(0, -2));
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== "object" || cur[p] == null) cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

export function flattenQuestions() {
  return FORM_SECTIONS.flatMap((s) => s.questions.filter((q) => q.type !== "repeater"));
}

export function sendFactFindInvitation(state: AppState): AppState {
  const run: FlowRun = {
    id: uid("run"),
    flowName: "CRM - Send Client Fact-Find",
    startedAt: nowIso(),
    status: "succeeded",
    finishedAt: nowIso(),
    steps: [
      step("s1", "When adviser selects Send fact-find", "Dataverse (manual / button)", "Triggered from case M-1047."),
      step("s2", "Get case and applicant emails", "Dataverse — Get a row by ID", `Loaded ${CASE_REF}; Applicant 1 ${CLIENT_EMAIL}.`),
      step(
        "s3",
        "Compose invitation ID",
        "Data Operation — Compose",
        INVITATION_ID,
        "concat('INV-', replace(crm_caseref,'-',''), '-', formatDateTime(utcNow(),'yyyy-MM'))",
      ),
      step("s4", "Patch invitation onto the case", "Dataverse — Update a row", "crm_factfindstatus = Invited; store invitation ID and sent-on."),
      step(
        "s5",
        "Send Forms link from shared mailbox",
        "Office 365 Outlook — Send an email (V2)",
        `From ${OFFICE_MAILBOX} to ${CLIENT_EMAIL}. Prefill caseReference and invitationId.`,
      ),
      step("s6", "Add communication history row", "Dataverse — Add a new row", "Channel = invitation; direction = outbound."),
    ],
  };
  run.steps = run.steps.map((s) => ({ ...s, status: "ok" }));
  const comm: Communication = {
    id: uid("comm"),
    caseRef: CASE_REF,
    direction: "outbound",
    channel: "invitation",
    from: OFFICE_MAILBOX,
    to: state.caseRecord.applicants[0].email || CLIENT_EMAIL,
    subject: `Your mortgage fact-find — case ${CASE_REF}`,
    body: `Please complete the client fact-find. Invitation ${INVITATION_ID}. This link is personal to your case.`,
    receivedAt: nowIso(),
    matchStatus: "outbound",
    forwarded: false,
  };
  return {
    ...state,
    caseRecord: {
      ...state.caseRecord,
      stage: "Fact-find invited",
      factFind: {
        ...state.caseRecord.factFind,
        status: "invited",
        invitationId: INVITATION_ID,
        sentAt: nowIso(),
        daysOpen: 0,
      },
    },
    communications: [comm, ...state.communications],
    audit: [audit("Invitation sent", `${INVITATION_ID} emailed to ${comm.to}`, run.flowName), ...state.audit],
    flowRuns: [run, ...state.flowRuns],
  };
}

export function processFactFindSubmission(
  state: AppState,
  answers: Record<string, unknown>,
): { state: AppState; error?: string } {
  const run: FlowRun = {
    id: uid("run"),
    flowName: "CRM - Process Client Fact-Find Submission",
    startedAt: nowIso(),
    status: "running",
    steps: [
      step("p1", "When a new response is submitted", "Microsoft Forms", "Trigger fired for Client Fact-Find — Mortgage & Protection."),
      step("p2", "Get response details", "Microsoft Forms — Get response details", "Loaded all answers including hidden case and invitation fields."),
      step(
        "p3",
        "Validate case reference and invitation ID",
        "Dataverse — List rows / Condition",
        "Match invitation against an open case invitation.",
        "and(equals(invitationId, crm_invitationid), not(equals(status,'Expired')))",
      ),
      step("p4", "Create staged / immutable submission record", "Dataverse — Add a new row", "crm_factfindsubmission is write-once."),
      step("p5", "Map responses into CRM fields (review-first)", "Apply to each + Condition", "Protected fields become proposed facts, not patches."),
      step("p6", "Create related policy and employer-benefit records", "Dataverse — Add a new row", "Child records; never flattened onto the case."),
      step("p7", "Hold proposed changes for review", "Dataverse — Add a new row", "crm_proposedfact queue. Existing → Proposed."),
      step("p8", "Create adviser-review and evidence tasks", "Dataverse — Add a new row", "Review task plus evidence collection."),
      step("p9", "Update fact-find status", "Dataverse — Update a row", "crm_factfindstatus = Submitted / In review."),
      step("p10", "Send client acknowledgement", "Office 365 Outlook — Send an email (V2)", `From ${OFFICE_MAILBOX}.`),
      step("p11", "Record audit event", "Dataverse — Add a new row", "Immutable audit of the run."),
    ],
  };

  mark(run, "p1", "ok");
  mark(run, "p2", "ok");

  const caseRef = String(answers["sys.caseReference"] ?? "").trim();
  const invitationId = String(answers["sys.invitationId"] ?? "").trim();
  const accuracy = String(answers["decl.accuracy"] ?? "");
  const privacy = String(answers["decl.privacy"] ?? "");

  if (!caseRef || caseRef !== state.caseRecord.caseRef) {
    mark(run, "p3", "error", `Case reference '${caseRef || "(blank)"}' does not match ${state.caseRecord.caseRef}. Submission rejected.`);
    run.status = "failed";
    run.finishedAt = nowIso();
    return {
      state: { ...state, flowRuns: [run, ...state.flowRuns] },
      error: "The case reference does not match an open file. The submission was not applied.",
    };
  }
  if (!invitationId || invitationId !== state.caseRecord.factFind.invitationId) {
    mark(run, "p3", "error", `Invitation '${invitationId || "(blank)"}' is not the open invitation on ${caseRef}.`);
    run.status = "failed";
    run.finishedAt = nowIso();
    return {
      state: { ...state, flowRuns: [run, ...state.flowRuns] },
      error: "The invitation ID is missing or does not match the open invitation. The submission was rejected.",
    };
  }
  if (state.caseRecord.factFind.status === "expired") {
    mark(run, "p3", "error", "Invitation has expired (day 14). Client must be re-invited.");
    run.status = "failed";
    run.finishedAt = nowIso();
    return {
      state: { ...state, flowRuns: [run, ...state.flowRuns] },
      error: "This invitation has expired. Ask the adviser to send a new fact-find link.",
    };
  }
  if (accuracy !== "Yes" || privacy !== "Yes") {
    mark(run, "p3", "error", "Accuracy or privacy declaration was not accepted.");
    run.status = "failed";
    run.finishedAt = nowIso();
    return {
      state: { ...state, flowRuns: [run, ...state.flowRuns] },
      error: "The declarations were not accepted. The flow will not write to the file.",
    };
  }
  mark(run, "p3", "ok", `Validated ${caseRef} / ${invitationId}.`);

  const submission: StagedSubmission = {
    id: uid("ffsub"),
    caseRef,
    invitationId,
    submittedAt: nowIso(),
    immutable: true,
    answers: { ...answers },
    childRecordsCreated: 0,
  };
  mark(run, "p4", "ok", `Created immutable submission ${submission.id}.`);

  const proposed: ProposedFact[] = [];
  const visibleQuestions = flattenQuestions().filter((q) => isShown(q.showIf, answers));
  for (const q of visibleQuestions) {
    if (q.importBehaviour === "system" || q.importBehaviour === "audit-only") continue;
    if (q.crmField.endsWith("[]")) continue;
    const incoming = answers[q.key];
    if (incoming === undefined || incoming === "") continue;
    const existing = getByPath(state.caseRecord, q.crmField);
    const same = displayValue(existing) === displayValue(incoming);
    if (same) continue;
    const mustReview =
      q.importBehaviour === "propose-review" ||
      q.protectedField ||
      PROTECTED_PATHS.has(q.crmField) ||
      (q.importBehaviour === "overwrite-if-empty" && displayValue(existing) !== "—");
    if (mustReview) {
      proposed.push({
        id: uid("pf"),
        caseRef,
        crmField: q.crmField,
        label: q.wording,
        existingValue: displayValue(existing),
        proposedValue: displayValue(incoming),
        source: "fact-find",
        sourceText: `Forms ${q.key}`,
        confidence: "high",
        status: "pending",
        protectedField: Boolean(q.protectedField) || PROTECTED_PATHS.has(q.crmField),
        createdAt: nowIso(),
      });
    }
  }
  mark(run, "p5", "ok", `Mapped ${visibleQuestions.length} visible answers. ${proposed.length} held for review.`);

  const privateItems = (answers["protection.private.items"] as Array<Record<string, string>> | undefined) ?? [];
  const benefitItems = (answers["benefits.employer.items"] as Array<Record<string, string>> | undefined) ?? [];
  const linkedItems = (answers["protection.linked.items"] as Array<Record<string, string>> | undefined) ?? [];
  const commitmentItems = (answers["commitments.items"] as Array<Record<string, string>> | undefined) ?? [];

  const newPolicies: PolicyRecord[] = privateItems
    .filter((row) => row.provider)
    .map((row) => ({
      id: uid("pol"),
      source: "private" as const,
      provider: row.provider,
      coverType: row.coverType,
      sumAssured: row.sumAssured,
      premium: row.premium,
      premiumFrequency: row.premiumFrequency,
      term: row.term,
      inTrust: row.inTrust,
      policyNumber: row.policyNumber,
      notes: "",
    }));
  const newBenefits: EmployerBenefit[] = benefitItems
    .filter((row) => row.type)
    .map((row) => ({
      id: uid("ben"),
      type: row.type,
      detail: row.detail,
      value: row.value,
    }));
  const newLinked: PolicyRecord[] = linkedItems
    .filter((row) => row.provider)
    .map((row) => ({
      id: uid("lnk"),
      source: "mortgage-linked" as const,
      provider: row.provider,
      coverType: row.coverType,
      sumAssured: row.sumAssured,
      premium: "",
      premiumFrequency: "",
      term: "",
      inTrust: "",
      policyNumber: "",
      notes: row.notes,
    }));

  submission.childRecordsCreated = newPolicies.length + newBenefits.length + newLinked.length + commitmentItems.length;
  mark(
    run,
    "p6",
    "ok",
    `Staged ${newPolicies.length} private policies, ${newBenefits.length} employer benefits, ${newLinked.length} mortgage-linked rows as related records.`,
  );
  mark(run, "p7", "ok", `${proposed.length} proposed fact(s) waiting Approve / Reject.`);

  const tasks: TaskItem[] = [
    {
      id: uid("task"),
      caseRef,
      title: "Adviser review — fact-find submission",
      detail: `${proposed.length} proposed field update(s) and ${submission.childRecordsCreated} related record(s) are waiting. Protected facts have not been overwritten.`,
      owner: "Adviser",
      priority: "High",
      type: "adviser-review",
      status: "open",
      createdAt: nowIso(),
    },
    {
      id: uid("task"),
      caseRef,
      title: answers["decl.evidence"] === "Yes" ? "Collect supporting evidence" : "Client cannot readily provide evidence",
      detail:
        answers["decl.evidence"] === "Yes"
          ? "Request latest 3 months’ payslips (or SA302 / tax year overview) and proof of deposit."
          : "Client indicated evidence may be difficult. Call to agree what can be provided before a lender application.",
      owner: "Adviser",
      priority: answers["decl.evidence"] === "Yes" ? "Medium" : "High",
      type: "evidence",
      status: "open",
      createdAt: nowIso(),
    },
  ];
  mark(run, "p8", "ok", `Created ${tasks.length} tasks.`);

  const nextCase: CaseRecord = {
    ...state.caseRecord,
    factFind: {
      ...state.caseRecord.factFind,
      status: "in-review",
      submittedAt: nowIso(),
    },
    stage: "Fact-find in review",
    privatePolicies: newPolicies.length ? [...state.caseRecord.privatePolicies, ...newPolicies] : state.caseRecord.privatePolicies,
    employerBenefits: newBenefits.length ? [...state.caseRecord.employerBenefits, ...newBenefits] : state.caseRecord.employerBenefits,
    mortgageLinkedCover: newLinked.length ? [...state.caseRecord.mortgageLinkedCover, ...newLinked] : state.caseRecord.mortgageLinkedCover,
  };
  mark(run, "p9", "ok", "Fact-find status set to In review. Case stage not moved to Offer — that remains an adviser action.");

  const ack = `Dear ${String(answers["applicants.a1.firstName"] || nextCase.applicants[0].firstName || "client")},\n\nThank you for completing the fact-find for case ${caseRef}. We have received it and an adviser will review the information against your file before any verified details are changed.\n\nWe may still ask for payslips, ID or bank statements.\n\nKind regards\n${nextCase.adviser}\nHarbour & Hart Mortgages`;
  run.acknowledgement = ack;
  const ackComm: Communication = {
    id: uid("comm"),
    caseRef,
    direction: "outbound",
    channel: "forms-ack",
    from: OFFICE_MAILBOX,
    to: String(answers["applicants.a1.email"] || nextCase.applicants[0].email),
    subject: `We have received your fact-find — ${caseRef}`,
    body: ack,
    receivedAt: nowIso(),
    matchStatus: "outbound",
    forwarded: false,
  };
  mark(run, "p10", "ok", `Acknowledgement queued from ${OFFICE_MAILBOX}.`);
  mark(run, "p11", "ok", "Audit row written.");
  run.status = "succeeded";
  run.finishedAt = nowIso();

  return {
    state: {
      ...state,
      caseRecord: nextCase,
      proposedFacts: [...proposed, ...state.proposedFacts],
      tasks: [...tasks, ...state.tasks],
      submissions: [submission, ...state.submissions],
      communications: [ackComm, ...state.communications],
      audit: [audit("Fact-find processed", `Submission ${submission.id}; ${proposed.length} proposed facts held`, run.flowName), ...state.audit],
      flowRuns: [run, ...state.flowRuns],
    },
  };
}

export function runInvitationReminders(state: AppState, asDay: number): AppState {
  const run: FlowRun = {
    id: uid("run"),
    flowName: "CRM - Fact-Find Invitation Reminders",
    startedAt: nowIso(),
    status: "succeeded",
    finishedAt: nowIso(),
    steps: [
      step("r0", "Recurrence (weekdays 08:30 Europe/London)", "Recurrence", "Scheduled weekday flow."),
      step("r1", "List open invitations", "Dataverse — List rows", "crm_factfindstatus eq Invited / Reminder."),
      step("r3", "Day 3 — first client reminder", "Outlook + Dataverse", asDay >= 3 ? "Reminder 1 sent." : "Not yet due."),
      step("r7", "Day 7 — second client reminder", "Outlook + Dataverse", asDay >= 7 ? "Reminder 2 sent." : "Not yet due."),
      step("r10", "Day 10 — adviser overdue task", "Dataverse — Add a new row", asDay >= 10 ? "Adviser task created." : "Not yet due."),
      step("r14", "Day 14 — expire invitation", "Dataverse — Update a row", asDay >= 14 ? "Invitation expired." : "Not yet due."),
    ],
  };
  run.steps = run.steps.map((s) => ({ ...s, status: "ok" }));

  const next = { ...state.caseRecord };
  const extraTasks: TaskItem[] = [];
  const extraComms: Communication[] = [];
  let status = next.factFind.status;
  if (asDay >= 3 && asDay < 7) status = "reminder-3";
  if (asDay >= 7 && asDay < 10) status = "reminder-7";
  if (asDay >= 10 && asDay < 14) status = "overdue-task";
  if (asDay >= 14) status = "expired";

  if (asDay >= 3) {
    extraComms.push({
      id: uid("comm"),
      caseRef: next.caseRef,
      direction: "outbound",
      channel: "invitation",
      from: OFFICE_MAILBOX,
      to: next.applicants[0].email,
      subject: `Reminder: your mortgage fact-find — ${next.caseRef}`,
      body: "A short reminder to complete the fact-find when you can. The link in our first email still works.",
      receivedAt: nowIso(),
      matchStatus: "outbound",
      forwarded: false,
    });
  }
  if (asDay >= 10) {
    extraTasks.push({
      id: uid("task"),
      caseRef: next.caseRef,
      title: "Fact-find still outstanding — day 10",
      detail: "Client has not submitted. Telephone chase recommended before the invitation expires on day 14.",
      owner: "Adviser",
      priority: "High",
      type: "invitation-overdue",
      status: "open",
      createdAt: nowIso(),
    });
  }
  next.factFind = {
    ...next.factFind,
    status,
    lastReminderAt: asDay >= 3 ? nowIso() : next.factFind.lastReminderAt,
    daysOpen: asDay,
  };
  if (asDay >= 14) next.stage = "Fact-find expired — re-invite";

  return {
    ...state,
    caseRecord: next,
    tasks: [...extraTasks, ...state.tasks],
    communications: [...extraComms, ...state.communications],
    audit: [audit("Reminder pass", `Ran as day ${asDay}; status ${status}`, run.flowName), ...state.audit],
    flowRuns: [run, ...state.flowRuns],
  };
}

function allCases(state: AppState): CaseRecord[] {
  return [state.caseRecord, ...state.extraCases];
}

export function processInboundEmail(state: AppState, email: InboundEmail): AppState {
  const run: FlowRun = {
    id: uid("run"),
    flowName: "CRM - Process Inbound Client Email",
    startedAt: nowIso(),
    status: "running",
    steps: [
      step("e1", "When a new email arrives in a shared mailbox (V2)", "Office 365 Outlook", `Mailbox ${OFFICE_MAILBOX}.`),
      step("e2", "Normalise sender address", "Data Operation — Compose", "", "toLower(trim(from))"),
      step("e3", "Detect forwarded message", "Condition", "fw:/fwd: or forwarded-message banner."),
      step("e4", "Match Applicant 1 and Applicant 2 emails", "Dataverse — List rows / Filter array", ""),
      step("e5", "Route: one / none / many / joint / email-change", "Switch", ""),
      step("e6", "Add to communication history", "Dataverse — Add a new row", ""),
      step("e7", "Retrieve latest five communications", "Dataverse — List rows", "Order by received on desc, top 5."),
      step("e8", "AI Builder extraction", "AI Builder — Extract structured output", "updateSummary, conversationSummary, proposedFacts, actions, replyDraft, requiresManualReview."),
      step("e9", "Queue proposed facts for adviser review", "Dataverse — Add a new row", "Existing → Proposed. Approve / Reject only."),
      step("e10", "Create draft reply task", "Dataverse — Add a new row", "Adviser sends; the flow does not send the reply."),
    ],
  };

  const sender = normaliseEmail(email.from);
  mark(run, "e1", "ok", `Arrived from ${email.from}: ${email.subject}`);
  mark(run, "e2", "ok", `Normalised sender: ${sender}`);

  if (email.forwarded) {
    mark(run, "e3", "held", "Forwarded. Original sender is not treated as an authenticated client.");
    mark(run, "e4", "held", "Match skipped for identity purposes.");
    mark(run, "e5", "held", "Manual review — forwarded email.");
    const task: TaskItem = {
      id: uid("task"),
      caseRef: CASE_REF,
      title: "Forwarded email — do not assume original sender is the client",
      detail: `Forwarded by ${email.from}. Apparent original sender ${email.originalSender ?? "unknown"}. File the message but do not auto-link identity or apply facts.`,
      owner: "Administrator",
      priority: "High",
      type: "email-verification",
      status: "open",
      createdAt: nowIso(),
    };
    const comm: Communication = {
      id: uid("comm"),
      caseRef: CASE_REF,
      direction: "inbound",
      channel: "email",
      from: email.from,
      to: email.to,
      subject: email.subject,
      body: email.body,
      receivedAt: email.receivedAt,
      matchStatus: "forwarded-hold",
      forwarded: true,
      originalSender: email.originalSender,
    };
    mark(run, "e6", "ok", "Filed under the working case as forwarded-hold.");
    mark(run, "e7", "ok", "Latest five communications retrieved for context only.");
    mark(run, "e8", "held", "AI may summarise, but proposed facts are suppressed on forwarded mail.");
    mark(run, "e9", "held", "No proposed facts written.");
    mark(run, "e10", "ok", "Verification task created.");
    run.status = "held";
    run.finishedAt = nowIso();
    return {
      ...state,
      tasks: [task, ...state.tasks],
      communications: [comm, ...state.communications],
      inbox: state.inbox.map((e) => (e.id === email.id ? { ...e, processed: true } : e)),
      audit: [audit("Inbound email held", "Forwarded message — original sender not trusted", run.flowName), ...state.audit],
      flowRuns: [run, ...state.flowRuns],
    };
  }
  mark(run, "e3", "ok", "Not a forwarded message.");

  type Hit = { caseRef: string; which: "applicant1" | "applicant2" | "both" };
  const hits: Hit[] = [];
  for (const c of allCases(state)) {
    const a1 = normaliseEmail(c.applicants[0].email);
    const a2 = normaliseEmail(c.applicants[1].email);
    const m1 = a1 && a1 === sender;
    const m2 = a2 && a2 === sender;
    if (m1 && m2) hits.push({ caseRef: c.caseRef, which: "both" });
    else if (m1) hits.push({ caseRef: c.caseRef, which: "applicant1" });
    else if (m2) hits.push({ caseRef: c.caseRef, which: "applicant2" });
  }
  mark(run, "e4", "ok", `Matched ${hits.length} case(s): ${hits.map((h) => `${h.caseRef} (${h.which})`).join(", ") || "none"}.`);

  const uniqueRefs = [...new Set(hits.map((h) => h.caseRef))];
  let matchStatus: Communication["matchStatus"] = "unmatched";
  let linkedRef: string | null = null;
  const extraTasks: TaskItem[] = [];

  if (
    email.scenario === "email-change" ||
    (uniqueRefs.length === 0 && /use this email|new .*email|instead of/i.test(email.body)) ||
    (uniqueRefs.length === 1 && sender !== normaliseEmail(state.caseRecord.applicants[0].email) && /use this email|new .*email/i.test(email.body))
  ) {
    matchStatus = "email-change-hold";
    linkedRef =
      uniqueRefs[0] ??
      (/M-\d+/i.exec(email.body)?.[0] ?? CASE_REF);
    extraTasks.push({
      id: uid("task"),
      caseRef: linkedRef,
      title: "Email address change — hold for verification",
      detail: `Sender ${sender} asked to change the file email. Do not patch Applicant 1 email until the client confirms on a trusted number.`,
      owner: "Adviser",
      priority: "High",
      type: "email-verification",
      status: "open",
      createdAt: nowIso(),
    });
    mark(run, "e5", "held", "Changed email address. Held for verification. File email not updated.");
  } else if (uniqueRefs.length === 1 && hits[0].which === "applicant2") {
    matchStatus = "joint-match";
    linkedRef = uniqueRefs[0];
    mark(run, "e5", "ok", `Joint applicant match on ${linkedRef}. Applicant 2 linked; Applicant 1 remains the primary contact.`);
  } else if (uniqueRefs.length === 1) {
    matchStatus = "auto-linked";
    linkedRef = uniqueRefs[0];
    mark(run, "e5", "ok", `One match — auto-linked to ${linkedRef}.`);
  } else if (uniqueRefs.length === 0) {
    matchStatus = "unmatched";
    extraTasks.push({
      id: uid("task"),
      caseRef: "UNMATCHED",
      title: "Unmatched correspondence",
      detail: `No Applicant 1 or Applicant 2 email equals ${sender}. Create a case or file as a new enquiry. Do not invent a link.`,
      owner: "Administrator",
      priority: "Medium",
      type: "unmatched-correspondence",
      status: "open",
      createdAt: nowIso(),
    });
    mark(run, "e5", "held", "No match. Unmatched-correspondence task created.");
  } else {
    matchStatus = "multiple-matches";
    extraTasks.push({
      id: uid("task"),
      caseRef: uniqueRefs.join(", "),
      title: "Manual case selection required",
      detail: `Sender ${sender} matches ${uniqueRefs.join(" and ")}. Adviser must choose the file. No facts applied.`,
      owner: "Adviser",
      priority: "High",
      type: "manual-case-selection",
      status: "open",
      createdAt: nowIso(),
    });
    mark(run, "e5", "held", `Multiple matches: ${uniqueRefs.join(", ")}.`);
  }

  const comm: Communication = {
    id: uid("comm"),
    caseRef: linkedRef,
    direction: "inbound",
    channel: "email",
    from: email.from,
    to: email.to,
    subject: email.subject,
    body: email.body,
    receivedAt: email.receivedAt,
    matchStatus,
    forwarded: false,
  };
  mark(run, "e6", "ok", linkedRef ? `Communication history row on ${linkedRef}.` : "Filed as unmatched correspondence.");

  const prior = state.communications.filter((c) => c.caseRef && c.caseRef === (linkedRef ?? CASE_REF)).slice(0, 5);
  mark(run, "e7", "ok", `Retrieved ${prior.length} prior communication(s).`);

  const canExtract = matchStatus === "auto-linked" || matchStatus === "joint-match" || matchStatus === "email-change-hold";
  const targetCase = allCases(state).find((c) => c.caseRef === (linkedRef ?? CASE_REF)) ?? state.caseRecord;
  const ai = canExtract
    ? extractEmailFacts(email, targetCase, prior)
    : {
        updateSummary: "No automatic fact extraction — case link is not unique or is unmatched.",
        conversationSummary: email.body.slice(0, 240),
        proposedFacts: [],
        actions: extraTasks.map((t) => ({ action: t.title, owner: t.owner, priority: t.priority })),
        replyDraft: "",
        requiresManualReview: true,
      };

  mark(run, "e8", canExtract ? "ok" : "held", ai.updateSummary);

  const newFacts: ProposedFact[] = canExtract
    ? ai.proposedFacts.map((f) => ({
        id: uid("pf"),
        caseRef: linkedRef ?? CASE_REF,
        crmField: f.crmField,
        label: fieldLabel(f.crmField),
        existingValue: displayValue(getByPath(targetCase, f.crmField)),
        proposedValue: f.proposedValue,
        source: "email" as const,
        sourceText: f.sourceText,
        confidence: f.confidence,
        status: "pending" as const,
        protectedField: PROTECTED_PATHS.has(f.crmField),
        createdAt: nowIso(),
      }))
    : [];

  if (newFacts.length) {
    mark(run, "e9", "held", `${newFacts.length} proposed fact(s) sent to the adviser-review queue. Verified CRM values unchanged.`);
  } else {
    mark(run, "e9", "ok", "No proposed facts.");
  }

  if (ai.replyDraft) {
    extraTasks.push({
      id: uid("task"),
      caseRef: linkedRef ?? CASE_REF,
      title: "Draft client reply ready to send",
      detail: ai.replyDraft,
      owner: "Adviser",
      priority: "Medium",
      type: "draft-reply",
      status: "open",
      createdAt: nowIso(),
    });
    extraTasks.push({
      id: uid("task"),
      caseRef: linkedRef ?? CASE_REF,
      title: "Adviser review — inbound email facts",
      detail: ai.updateSummary,
      owner: "Adviser",
      priority: "High",
      type: "adviser-review",
      status: "open",
      createdAt: nowIso(),
    });
  }
  for (const a of ai.actions) {
    if (!extraTasks.some((t) => t.title === a.action)) {
      extraTasks.push({
        id: uid("task"),
        caseRef: linkedRef ?? CASE_REF,
        title: a.action,
        detail: ai.updateSummary,
        owner: a.owner,
        priority: a.priority,
        type: "adviser-review",
        status: "open",
        createdAt: nowIso(),
      });
    }
  }
  mark(run, "e10", "ok", "Draft reply stored for the adviser. Flow does not send it.");
  run.status = matchStatus === "auto-linked" || matchStatus === "joint-match" ? "succeeded" : "held";
  run.finishedAt = nowIso();
  run.acknowledgement = ai.replyDraft;

  return {
    ...state,
    proposedFacts: [...newFacts, ...state.proposedFacts],
    tasks: [...extraTasks, ...state.tasks],
    communications: [comm, ...state.communications],
    inbox: state.inbox.map((e) => (e.id === email.id ? { ...e, processed: true } : e)),
    audit: [audit("Inbound email processed", `${sender} → ${matchStatus} (${linkedRef ?? "none"})`, run.flowName), ...state.audit],
    flowRuns: [run, ...state.flowRuns],
    lastEmailAi: ai,
    selectedEmailId: email.id,
  };
}

export function decideProposedFact(state: AppState, id: string, decision: "approved" | "rejected"): AppState {
  const fact = state.proposedFacts.find((f) => f.id === id);
  if (!fact) return state;
  const run: FlowRun = {
    id: uid("run"),
    flowName: "CRM - Approve Proposed Client Fact",
    startedAt: nowIso(),
    finishedAt: nowIso(),
    status: "succeeded",
    steps: [
      step("a1", "When proposed fact status changes", "Dataverse — When a row is added, modified or deleted", `${decision} ${fact.crmField}`),
      step("a2", "Condition: Approved?", "Condition", decision === "approved" ? "Yes — patch allowed field." : "No — leave CRM value untouched."),
      step("a3", "Update case / related row", "Dataverse — Update a row", decision === "approved" ? `Patched ${fact.crmField}.` : "Skipped."),
      step("a4", "Audit", "Dataverse — Add a new row", `${fact.label}: ${fact.existingValue} → ${fact.proposedValue} (${decision}).`),
    ],
  };
  run.steps = run.steps.map((s) => ({ ...s, status: "ok" }));

  let caseRecord = state.caseRecord;
  if (decision === "approved" && fact.caseRef === state.caseRecord.caseRef) {
    const clone = structuredClone(caseRecord) as unknown as Record<string, unknown>;
    setByPath(clone, fact.crmField, fact.proposedValue);
    caseRecord = clone as unknown as CaseRecord;
  }
  return {
    ...state,
    caseRecord,
    proposedFacts: state.proposedFacts.map((f) =>
      f.id === id ? { ...f, status: decision, decidedAt: nowIso(), decidedBy: ADVISER_NAME } : f,
    ),
    audit: [
      audit(
        decision === "approved" ? "Proposed fact approved" : "Proposed fact rejected",
        `${fact.label}: ${fact.existingValue} → ${fact.proposedValue}`,
        run.flowName,
      ),
      ...state.audit,
    ],
    flowRuns: [run, ...state.flowRuns],
  };
}

const ADVISER_NAME = "Priya Shah, CeMAP";

