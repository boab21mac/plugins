export type ViewId =
  | "forms-template"
  | "power-automate"
  | "field-mapping"
  | "email-intake"
  | "questionnaire"
  | "case-file";

export type PaTab = "fact-find" | "inbound-email" | "expressions" | "reminders" | "approve";

export type QuestionType =
  | "text"
  | "email"
  | "tel"
  | "date"
  | "number"
  | "currency"
  | "choice"
  | "multichoice"
  | "yesno"
  | "dropdown"
  | "longtext"
  | "file"
  | "repeater";

export type ImportBehaviour =
  | "system"
  | "overwrite-if-empty"
  | "propose-review"
  | "create-child"
  | "audit-only";

export interface Condition {
  field: string;
  op: "eq" | "neq" | "in" | "notEmpty";
  value?: string | string[];
}

export interface FormQuestion {
  key: string;
  wording: string;
  required: boolean;
  type: QuestionType;
  choices?: string[];
  helpText?: string;
  branching: string;
  showIf?: Condition[];
  crmField: string;
  importBehaviour: ImportBehaviour;
  dataType: string;
  placeholder?: string;
  protectedField?: boolean;
  repeaterLabel?: string;
  repeaterItemSchema?: FormQuestion[];
}

export interface FormSection {
  id: string;
  title: string;
  intro: string;
  questions: FormQuestion[];
}

export interface Applicant {
  title: string;
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  mobile: string;
  nationality: string;
  residency: string;
  maritalStatus: string;
  dependants: string;
  address: string;
  timeAtAddress: string;
  residentialStatus: string;
  niNumber: string;
}

export interface IncomeBlock {
  employmentStatus: string;
  occupation: string;
  employerName: string;
  timeInRole: string;
  basicAnnual: string;
  overtime: string;
  bonus: string;
  commission: string;
  tradingName: string;
  yearsTrading: string;
  netProfitY1: string;
  netProfitY2: string;
  netProfitY3: string;
  otherIncome: string;
  otherIncomeNotes: string;
}

export interface Commitment {
  id: string;
  type: string;
  lender: string;
  monthly: string;
  outstanding: string;
  toBeRepaid: string;
}

export interface PolicyRecord {
  id: string;
  source: "private" | "employer" | "mortgage-linked";
  provider: string;
  coverType: string;
  sumAssured: string;
  premium: string;
  premiumFrequency: string;
  term: string;
  inTrust: string;
  policyNumber: string;
  notes: string;
}

export interface EmployerBenefit {
  id: string;
  type: string;
  detail: string;
  value: string;
}

export interface MortgageFacts {
  purpose: string;
  propertyType: string;
  propertyValue: string;
  purchasePrice: string;
  loanAmount: string;
  deposit: string;
  termYears: string;
  repaymentType: string;
  ratePreference: string;
  dealPeriod: string;
  expectedCompletion: string;
  firstTimeBuyer: string;
  scheme: string;
  remortgageReason: string;
}

export interface ProtectionNeeds {
  whoToProtect: string;
  deathImpact: string;
  illnessImpact: string;
  incomeLossImpact: string;
  priorities: string;
  monthlyBudget: string;
  existingAdequate: string;
  adviserNotes: string;
}

export interface FactFindState {
  status:
    | "not-sent"
    | "invited"
    | "reminder-3"
    | "reminder-7"
    | "overdue-task"
    | "expired"
    | "submitted"
    | "in-review"
    | "accepted";
  invitationId: string;
  sentAt: string;
  lastReminderAt: string;
  submittedAt: string;
  daysOpen: number;
}

export interface CaseRecord {
  caseRef: string;
  stage: string;
  adviser: string;
  officeMailbox: string;
  applicants: [Applicant, Applicant];
  applicantCount: number;
  mortgage: MortgageFacts;
  income: [IncomeBlock, IncomeBlock];
  commitments: Commitment[];
  privatePolicies: PolicyRecord[];
  employerBenefits: EmployerBenefit[];
  mortgageLinkedCover: PolicyRecord[];
  protectionNeeds: ProtectionNeeds;
  bankSortCode: string;
  bankAccount: string;
  factFind: FactFindState;
}

export interface ProposedFact {
  id: string;
  caseRef: string;
  crmField: string;
  label: string;
  existingValue: string;
  proposedValue: string;
  source: "fact-find" | "email";
  sourceText: string;
  confidence: "high" | "medium" | "low";
  status: "pending" | "approved" | "rejected";
  protectedField: boolean;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface TaskItem {
  id: string;
  caseRef: string;
  title: string;
  detail: string;
  owner: "Adviser" | "Administrator" | "Compliance";
  priority: "High" | "Medium" | "Low";
  type:
    | "adviser-review"
    | "evidence"
    | "unmatched-correspondence"
    | "manual-case-selection"
    | "email-verification"
    | "invitation-overdue"
    | "draft-reply";
  status: "open" | "done";
  createdAt: string;
}

export interface Communication {
  id: string;
  caseRef: string | null;
  direction: "inbound" | "outbound";
  channel: "email" | "forms-ack" | "invitation";
  from: string;
  to: string;
  subject: string;
  body: string;
  receivedAt: string;
  matchStatus:
    | "auto-linked"
    | "unmatched"
    | "multiple-matches"
    | "joint-match"
    | "forwarded-hold"
    | "email-change-hold"
    | "outbound";
  forwarded: boolean;
  originalSender?: string;
}

export interface StagedSubmission {
  id: string;
  caseRef: string;
  invitationId: string;
  submittedAt: string;
  immutable: true;
  answers: Record<string, unknown>;
  childRecordsCreated: number;
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
}

export interface FlowStep {
  id: string;
  title: string;
  connector: string;
  expression?: string;
  detail: string;
  status: "pending" | "running" | "ok" | "held" | "error";
}

export interface FlowRun {
  id: string;
  flowName: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "succeeded" | "failed" | "held";
  steps: FlowStep[];
  acknowledgement?: string;
}

export interface EmailAiResult {
  updateSummary: string;
  conversationSummary: string;
  proposedFacts: Array<{
    crmField: string;
    proposedValue: string;
    sourceText: string;
    confidence: "high" | "medium" | "low";
  }>;
  actions: Array<{
    action: string;
    owner: "Adviser" | "Administrator" | "Compliance";
    priority: "High" | "Medium" | "Low";
  }>;
  replyDraft: string;
  requiresManualReview: boolean;
}

export interface InboundEmail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  receivedAt: string;
  forwarded: boolean;
  originalSender?: string;
  scenario:
    | "auto-link"
    | "unmatched"
    | "multiple"
    | "joint"
    | "forwarded"
    | "email-change";
  processed: boolean;
}

export interface AppState {
  caseRecord: CaseRecord;
  extraCases: CaseRecord[];
  proposedFacts: ProposedFact[];
  tasks: TaskItem[];
  communications: Communication[];
  submissions: StagedSubmission[];
  audit: AuditEvent[];
  flowRuns: FlowRun[];
  inbox: InboundEmail[];
  formDraft: Record<string, unknown>;
  lastEmailAi: EmailAiResult | null;
  selectedEmailId: string | null;
}
