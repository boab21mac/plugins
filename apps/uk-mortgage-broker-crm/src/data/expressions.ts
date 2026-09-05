export interface FlowExpression {
  id: string;
  flow: string;
  step: string;
  purpose: string;
  expression: string;
}

export const EXPRESSIONS: FlowExpression[] = [
  {
    id: "ex-1",
    flow: "CRM - Send Client Fact-Find",
    step: "Compose invitation ID",
    purpose: "Stable invitation key stored on the case and pre-filled into Forms.",
    expression: `concat('INV-', replace(outputs('Get_case')?['body/crm_caseref'], '-', ''), '-', formatDateTime(utcNow(), 'yyyy-MM'))`,
  },
  {
    id: "ex-2",
    flow: "CRM - Send Client Fact-Find",
    step: "Build Forms deep link",
    purpose: "Prefill case reference and invitation ID so the client cannot easily send an orphan response.",
    expression: `concat(variables('formsLink'), '&caseReference=', uriComponent(outputs('Get_case')?['body/crm_caseref']), '&invitationId=', uriComponent(variables('invitationId')))`,
  },
  {
    id: "ex-3",
    flow: "CRM - Process Client Fact-Find Submission",
    step: "Get response details",
    purpose: "Read Microsoft Forms answers by question ID.",
    expression: `body('Get_response_details')?['r8f2c1a0e4d64b1']`,
  },
  {
    id: "ex-4",
    flow: "CRM - Process Client Fact-Find Submission",
    step: "Validate case reference",
    purpose: "Reject submissions that do not match an open invitation.",
    expression: `and(\n  not(empty(trim(body('Get_response_details')?['caseReference']))),\n  equals(\n    toLower(trim(body('Get_response_details')?['invitationId']))),\n    toLower(trim(outputs('Get_invitation')?['body/crm_invitationid']))\n  ),\n  not(equals(outputs('Get_invitation')?['body/crm_status'], 'Expired'))\n)`,
  },
  {
    id: "ex-5",
    flow: "CRM - Process Client Fact-Find Submission",
    step: "Stage immutable submission",
    purpose: "Write a write-once submission record. Later edits create a new row.",
    expression: `concat('FFSUB-', outputs('Get_case')?['body/crm_caseref'], '-', formatDateTime(utcNow(), 'yyyyMMddHHmmss'))`,
  },
  {
    id: "ex-6",
    flow: "CRM - Process Client Fact-Find Submission",
    step: "Parse currency",
    purpose: "Normalise £62,000 / 62000 / 62k into a decimal for Dataverse currency columns.",
    expression: `float(replace(replace(replace(replace(toLower(trim(items('Each_answer'))), '£', ''), ',', ''), 'k', '000'), ' ', ''))`,
  },
  {
    id: "ex-7",
    flow: "CRM - Process Client Fact-Find Submission",
    step: "Hold proposed change",
    purpose: "Never overwrite a verified or protected field. Create crm_proposedfact instead.",
    expression: `if(\n  or(\n    equals(items('Map_fields')?['importBehaviour'], 'propose-review'),\n    equals(items('Map_fields')?['protected'], true)\n  ),\n  'Create_proposed_fact',\n  'Patch_if_empty'\n)`,
  },
  {
    id: "ex-8",
    flow: "CRM - Fact-Find Invitation Reminders",
    step: "Days open",
    purpose: "Weekday recurrence; act on day 3, 7, 10 and 14.",
    expression: `div(sub(ticks(utcNow()), ticks(items('Each_invitation')?['crm_senton'])), 864000000000)`,
  },
  {
    id: "ex-9",
    flow: "CRM - Process Inbound Client Email",
    step: "Normalise sender",
    purpose: "Lowercase and trim the shared-mailbox From address before matching.",
    expression: `toLower(trim(first(split(replace(triggerOutputs()?['body/from'], '>', ''), '<')))))`,
  },
  {
    id: "ex-10",
    flow: "CRM - Process Inbound Client Email",
    step: "Detect forwarded message",
    purpose: "Do not treat a forwarded original sender as an authenticated client identity.",
    expression: `or(\n  startsWith(toLower(triggerOutputs()?['body/subject']), 'fw:'),\n  startsWith(toLower(triggerOutputs()?['body/subject']), 'fwd:'),\n  contains(toLower(triggerOutputs()?['body/body']), '---------- forwarded message ----------')\n)`,
  },
  {
    id: "ex-11",
    flow: "CRM - Process Inbound Client Email",
    step: "Filter Applicant 1 / 2 emails",
    purpose: "Match against both applicant emails on every open case.",
    expression: `or(\n  equals(toLower(items('List_cases')?['crm_applicant1email']), variables('sender')),\n  equals(toLower(items('List_cases')?['crm_applicant2email']), variables('sender'))\n)`,
  },
  {
    id: "ex-12",
    flow: "CRM - Process Inbound Client Email",
    step: "Route on match count",
    purpose: "One match auto-links; zero creates unmatched task; two-plus waits for adviser case selection.",
    expression: `if(equals(length(body('Filter_matches')), 1), 'Auto_link',\n  if(equals(length(body('Filter_matches')), 0), 'Unmatched_task', 'Manual_case_selection'))`,
  },
  {
    id: "ex-13",
    flow: "CRM - Process Inbound Client Email",
    step: "Changed email hold",
    purpose: "If the client states a new address, hold verification — never patch crm_applicant1email.",
    expression: `and(\n  or(\n    contains(toLower(triggerOutputs()?['body/body']), 'new email'),\n    contains(toLower(triggerOutputs()?['body/body']), 'use this email')\n  ),\n  not(equals(variables('sender'), toLower(outputs('Get_case')?['body/crm_applicant1email'])))\n)`,
  },
  {
    id: "ex-14",
    flow: "CRM - Process Inbound Client Email",
    step: "Latest five communications",
    purpose: "Give AI Builder conversation context without dumping the whole file.",
    expression: `take(reverse(sort(body('List_communications'), 'crm_receivedon')), 5)`,
  },
  {
    id: "ex-15",
    flow: "CRM - Process Inbound Client Email",
    step: "AI Builder JSON schema",
    purpose: "Force structured extraction. Proposed facts always go to the review queue.",
    expression: `{
  "updateSummary": "Short summary of what has changed",
  "conversationSummary": "Summary of the latest message in the context of prior communications",
  "proposedFacts": [
    {
      "crmField": "income.basicAnnual",
      "proposedValue": "62000",
      "sourceText": "my salary is now £62,000",
      "confidence": "high"
    }
  ],
  "actions": [
    {
      "action": "Confirm updated salary evidence",
      "owner": "Adviser",
      "priority": "Medium"
    }
  ],
  "replyDraft": "Draft client acknowledgement",
  "requiresManualReview": true
}`,
  },
  {
    id: "ex-16",
    flow: "CRM - Approve Proposed Client Fact",
    step: "Apply only after approval",
    purpose: "Patch Dataverse only when adviser status = Approved and the field is in the allow-list for that record type.",
    expression: `and(\n  equals(triggerOutputs()?['body/crm_status'], 'Approved'),\n  not(empty(triggerOutputs()?['body/crm_proposedvalue']))\n)`,
  },
];

export const PROTECTED_FIELDS = [
  { crmField: "applicants[0].firstName", label: "Client identity — first name" },
  { crmField: "applicants[0].lastName", label: "Client identity — surname" },
  { crmField: "applicants[0].dob", label: "Client identity — date of birth" },
  { crmField: "applicants[0].email", label: "Email address" },
  { crmField: "applicants[1].email", label: "Applicant 2 email address" },
  { crmField: "income[0].basicAnnual", label: "Income" },
  { crmField: "income[0].employmentStatus", label: "Employment" },
  { crmField: "income[0].employerName", label: "Employment — employer" },
  { crmField: "mortgage.loanAmount", label: "Mortgage amount" },
  { crmField: "mortgage.expectedCompletion", label: "Completion date" },
  { crmField: "policies.private[]", label: "Existing protection" },
  { crmField: "benefits.employer[]", label: "Employer benefits" },
  { crmField: "bankSortCode", label: "Bank details — sort code" },
  { crmField: "bankAccount", label: "Bank details — account" },
  { crmField: "case.stage", label: "Case stage" },
];
