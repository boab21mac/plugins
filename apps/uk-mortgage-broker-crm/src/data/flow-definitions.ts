export const FLOW_SUMMARIES = {
  processSubmission: [
    "When a new response is submitted (Microsoft Forms)",
    "Get response details",
    "Validate case reference and invitation ID",
    "Create staged / immutable submission record",
    "Map responses into CRM fields (review-first)",
    "Create related policy and employer-benefit records",
    "Hold proposed changes for review",
    "Create adviser-review and evidence tasks",
    "Update fact-find status",
    "Send client acknowledgement",
    "Record audit event",
  ],
  inbound: [
    "Office 365 Outlook: When a new email arrives in a shared mailbox (V2)",
    "Normalise sender address",
    "Match against Applicant 1 and Applicant 2 emails",
    "One match: auto-link · none: unmatched task · many: manual case selection",
    "Joint applicant: match both · forwarded: do not assume original sender is the client",
    "Changed email address: hold for verification",
    "Add to communication history",
    "Retrieve latest five communications",
    "AI extracts updateSummary, conversationSummary, proposedFacts, actions, replyDraft, requiresManualReview",
    "Proposed facts go to the adviser-review queue",
    "Draft reply for the adviser to send",
  ],
};

export const FLOW_DEFINITIONS = [
  { name: "CRM - Send Client Fact-Find", file: "power-automate/CRM-Send-Client-Fact-Find.json" },
  { name: "CRM - Process Client Fact-Find Submission", file: "power-automate/CRM-Process-Client-Fact-Find-Submission.json" },
  { name: "CRM - Fact-Find Invitation Reminders", file: "power-automate/CRM-Fact-Find-Invitation-Reminders.json" },
  { name: "CRM - Process Inbound Client Email", file: "power-automate/CRM-Process-Inbound-Client-Email.json" },
  { name: "CRM - Approve Proposed Client Fact", file: "power-automate/CRM-Approve-Proposed-Client-Fact.json" },
];
