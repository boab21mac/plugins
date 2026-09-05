# UK Mortgage Broker CRM V2

Working CRM for a UK mortgage broker: Microsoft Forms fact-find template, live questionnaire, Power Automate process simulator, CRM field mapping, and inbound-email review.

This folder is **not** a Cursor marketplace plugin. It lives under `apps/` so it is isolated from `.cursor-plugin/marketplace.json`.

## Open the app

```bash
cd apps/uk-mortgage-broker-crm
npm install
npm run dev
```

Then open http://localhost:5173

Navigation order matches the brief: **Forms template** → **Power Automate** → **Field mapping** → **Client email intake**.

Demo file: case **M-1047**, client **daniel@example.co.uk**.

## Honest Microsoft 365 status

Live flows cannot be published into your tenant from this environment. Outlook MCP needs authentication; Microsoft Forms and Dataverse are not connected. Use the in-app simulator now, then import `power-automate/*.json` when you connect Power Automate yourself.

## Safety

Inbound email never automatically changes client identity, email, income, employment, mortgage amount, completion date, existing protection, employer benefits, bank details, or case stage.
