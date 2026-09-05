import { writeFileSync } from "fs";
import { FORM_SECTIONS, FORM_TITLE, FORM_SUBTITLE, BRANCHING_RULES } from "../src/data/forms-schema.ts";
import { EXPRESSIONS } from "../src/data/expressions.ts";
import { FLOW_SUMMARIES } from "../src/data/flow-definitions.ts";

const typeLabel = {
  text: "Text",
  email: "Text (email)",
  tel: "Text (phone)",
  date: "Date",
  number: "Number",
  currency: "Number (£)",
  choice: "Choice",
  multichoice: "Multi-choice",
  yesno: "Yes / No",
  dropdown: "Dropdown",
  longtext: "Long answer",
  file: "File upload",
  repeater: "Repeating section",
};

const sections = FORM_SECTIONS.map((section) => {
  const qs = section.questions
    .map((q) => {
      const choices = q.choices ? `<ul>${q.choices.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : "";
      const kids = q.repeaterItemSchema
        ? `<p class="help">Child records:</p><ul>${q.repeaterItemSchema.map((c) => `<li>${esc(c.wording)} → <code>${esc(c.crmField)}</code></li>`).join("")}</ul>`
        : "";
      return `<article class="q"><p class="w">${esc(q.wording)} ${q.required ? "<em>Required</em>" : "<span class='opt'>Optional</span>"}</p>
      <p class="meta">Type: ${typeLabel[q.type]} · Forms key: <code>${esc(q.key)}</code> · CRM: <code>${esc(q.crmField)}</code> · ${esc(q.importBehaviour)}</p>
      ${choices}${kids}<p class="help">Branching: ${esc(q.branching)}</p></article>`;
    })
    .join("");
  return `<section class="card"><h2>${esc(section.title)}</h2><p>${esc(section.intro)}</p>${qs}</section>`;
}).join("");

const exprs = EXPRESSIONS.map(
  (e) => `<article class="q"><p class="w">${esc(e.step)} <span class="opt">${esc(e.flow)}</span></p><p class="help">${esc(e.purpose)}</p><pre>${esc(e.expression)}</pre></article>`,
).join("");

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>UK Mortgage Broker CRM V2</title>
<style>
:root{--navy:#0e2744;--gold:#b0893e;--cream:#f4efe6;--ink:#142033;--muted:#5c6774}
body{margin:0;font-family:Georgia,serif;background:var(--cream);color:var(--ink);line-height:1.5}
header{background:linear-gradient(160deg,#0a1b30,var(--navy));color:#f7f1e6;padding:28px 24px;border-bottom:3px solid var(--gold)}
h1{margin:0 0 8px;font-size:28px}
nav{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}
nav a{color:#e8d7ad}
main{max-width:960px;margin:0 auto;padding:24px}
.card{background:#fffdf8;border:1px solid #d9d0c3;border-radius:10px;padding:18px;margin:16px 0}
.q{border-top:1px solid #d9d0c3;padding:12px 0}
.w{font-weight:700;margin:0 0 6px}
.meta,.help{color:var(--muted);font-size:14px;font-family:system-ui,sans-serif}
code,pre{font-family:ui-monospace,monospace;background:#122033;color:#e8d7ad;padding:2px 6px;border-radius:4px}
pre{white-space:pre-wrap;padding:10px;overflow:auto}
em{color:#8f2d2d;font-style:normal;font-size:13px}
.opt{color:var(--muted);font-size:13px}
.banner{background:#f8eedc;border:1px solid #e2c58a;padding:12px 16px;margin:16px 24px;font-family:system-ui,sans-serif}
</style>
</head>
<body>
<header>
<p style="letter-spacing:.16em;text-transform:uppercase;color:#e8d7ad;font-size:12px;font-family:system-ui">Harbour &amp; Hart Mortgages</p>
<h1>UK Mortgage Broker CRM V2</h1>
<p>Forms template first, then Power Automate. Interactive simulator is in the repo at <code>apps/uk-mortgage-broker-crm</code>.</p>
<nav>
<a href="#forms">Forms template</a>
<a href="#pa">Power Automate</a>
<a href="#expr">Expressions</a>
</nav>
</header>
<div class="banner"><strong>Microsoft 365:</strong> Outlook / Forms / Dataverse are not authenticated from the Cloud Agent environment, so live tenant flows were not published. Run <code>npm run dev</code> in the app folder for the working questionnaire, flow simulator and email intake.</div>
<main>
<section id="forms">
<h2 style="font-size:30px">${esc(FORM_TITLE)}</h2>
<p>${esc(FORM_SUBTITLE)}</p>
<div class="card"><h3>Branching rules</h3><ol>${BRANCHING_RULES.map((r) => `<li>${esc(r)}</li>`).join("")}</ol></div>
${sections}
</section>
<section id="pa">
<h2 style="font-size:30px">Power Automate</h2>
<div class="card"><h3>CRM - Process Client Fact-Find Submission</h3><ol>${FLOW_SUMMARIES.processSubmission.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>
<div class="card"><h3>CRM - Process Inbound Client Email</h3><ol>${FLOW_SUMMARIES.inbound.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>
</section>
<section id="expr">
<h2 style="font-size:30px">Expressions</h2>
<div class="card">${exprs}</div>
</section>
</main>
</body></html>`;

writeFileSync("/tmp/crm-preview.html", html);
console.log("bytes", html.length);
