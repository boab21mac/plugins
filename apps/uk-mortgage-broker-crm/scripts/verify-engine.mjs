import { createSeedState, CASE_REF, CLIENT_EMAIL, INVITATION_ID } from "../src/data/seed.ts";
import {
  processFactFindSubmission,
  processInboundEmail,
  decideProposedFact,
  runInvitationReminders,
  sendFactFindInvitation,
} from "../src/engine/workflows.ts";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

let state = createSeedState();
state = sendFactFindInvitation(state);
assert(state.flowRuns[0].flowName.includes("Send Client Fact-Find"), "send flow");
assert(state.caseRecord.factFind.status === "invited", "invited");

const bad = processFactFindSubmission(state, { ...state.formDraft, "sys.invitationId": "WRONG" });
assert(bad.error && bad.state.flowRuns[0].status === "failed", "invalid invitation rejected");

const good = processFactFindSubmission(state, state.formDraft);
assert(!good.error, good.error ?? "submit ok");
assert(good.state.submissions[0].immutable === true, "immutable submission");
assert(good.state.proposedFacts.some((f) => f.status === "pending"), "proposed facts held");
assert(good.state.caseRecord.income[0].basicAnnual === "54000", "salary not silently overwritten");
assert(good.state.tasks.some((t) => t.type === "adviser-review"), "review task");
assert(good.state.tasks.some((t) => t.type === "evidence"), "evidence task");
state = good.state;

const email = state.inbox.find((e) => e.id === "em-daniel");
state = processInboundEmail(state, email);
assert(state.lastEmailAi?.proposedFacts.some((f) => f.proposedValue === "62000"), "AI salary");
assert(state.caseRecord.income[0].basicAnnual === "54000", "email did not patch salary");
const salaryFact = state.proposedFacts.find((f) => f.crmField.includes("basicAnnual") && f.source === "email");
assert(salaryFact, "salary proposed from email");
state = decideProposedFact(state, salaryFact.id, "approved");
assert(state.caseRecord.income[0].basicAnnual === "62000", "approve applied salary");

const unmatched = state.inbox.find((e) => e.id === "em-unknown");
state = processInboundEmail(state, unmatched);
assert(state.tasks.some((t) => t.type === "unmatched-correspondence"), "unmatched task");

const forwarded = state.inbox.find((e) => e.id === "em-forwarded");
state = processInboundEmail(state, forwarded);
assert(state.tasks.some((t) => t.title.includes("Forwarded")), "forwarded hold");

const multi = state.inbox.find((e) => e.id === "em-multiple");
state = processInboundEmail(state, multi);
assert(state.tasks.some((t) => t.type === "manual-case-selection"), "multiple matches");

const change = state.inbox.find((e) => e.id === "em-change");
state = processInboundEmail(state, change);
assert(state.caseRecord.applicants[0].email === CLIENT_EMAIL, "email address not auto-changed");
assert(state.tasks.some((t) => t.type === "email-verification"), "email change hold");

state = runInvitationReminders(createSeedState(), 14);
assert(state.caseRecord.factFind.status === "expired", "day 14 expires");

console.log(
  JSON.stringify(
    {
      ok: true,
      caseRef: CASE_REF,
      invitation: INVITATION_ID,
      client: CLIENT_EMAIL,
    },
    null,
    2,
  ),
);
