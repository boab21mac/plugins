# Power Automate import pack

These JSON files are Logic Apps / Power Automate workflow definitions for Harbour & Hart style UK mortgage CRM.

They **cannot be published into your Microsoft 365 tenant from the Cursor Cloud Agent environment**. Outlook, Microsoft Forms and Dataverse are not authenticated here.

## How to use them

1. In Power Automate (make.powerautomate.com) create a **Solution** named `UK Mortgage Broker CRM V2`.
2. Add connection references:
   - `shared_microsoftforms`
   - `shared_commondataserviceforapps` (Dataverse)
   - `shared_office365` (Office 365 Outlook)
3. Recreate each flow. Paste the expressions from the CRM app **Power Automate → Expressions** tab, or import the `properties.definition` object if your tenant allows package import.
4. Point the Outlook trigger at the office shared mailbox (for example `enquiries@yourfirm.co.uk`).
5. Point the Forms trigger at the form built from the in-app Forms template.
6. Test with case `M-1047` / `daniel@example.co.uk` before using live clients.

## Flows

| File | Trigger |
| --- | --- |
| `CRM-Send-Client-Fact-Find.json` | Manual / Dataverse button on the case |
| `CRM-Process-Client-Fact-Find-Submission.json` | Microsoft Forms — When a new response is submitted |
| `CRM-Fact-Find-Invitation-Reminders.json` | Recurrence, weekdays 08:30 Europe/London |
| `CRM-Process-Inbound-Client-Email.json` | Outlook — When a new email arrives in a shared mailbox (V2) |
| `CRM-Approve-Proposed-Client-Fact.json` | Dataverse — When a proposed-fact row is modified |

## Safety

Inbound email must **never** automatically change: client identity, email address, income, employment, mortgage amount, completion date, existing protection, employer benefits, bank details, or case stage. Always Existing → Proposed with Approve / Reject.
