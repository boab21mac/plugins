import puppeteer from "puppeteer-core";

const BASE = process.env.CRM_URL || "http://127.0.0.1:5173";

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});

const errors = [];
const page = await browser.newPage();
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  const t = msg.text();
  if (msg.type() === "error" && !t.includes("favicon") && !t.includes("404")) errors.push(t);
});
page.on("requestfailed", (req) => {
  const url = req.url();
  if (!url.includes("favicon") && !url.includes("fonts.g")) errors.push(`request failed ${url}`);
});

async function text(sel) {
  return page.$eval(sel, (el) => el.textContent ?? "");
}

async function clickText(selector, label) {
  const clicked = await page.evaluate(
    (sel, want) => {
      const nodes = [...document.querySelectorAll(sel)];
      const el = nodes.find((n) => (n.textContent || "").trim() === want);
      if (!el) return false;
      el.click();
      return true;
    },
    selector,
    label,
  );
  if (!clicked) throw new Error(`Could not click ${label}`);
}

const report = [];
try {
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto(BASE, { waitUntil: "networkidle0", timeout: 30000 });
  const title = await text("h1.brand-title");
  if (!title.includes("UK Mortgage Broker CRM")) throw new Error("brand missing");
  const h1 = await text(".page-head h1, .main h1");
  if (!h1.includes("Microsoft Forms template")) throw new Error(`first view was "${h1}"`);
  report.push("desktop: forms template first");

  await clickText("nav button", "Power Automate");
  await page.waitForFunction(() => document.body.innerText.includes("CRM - Process Client Fact-Find Submission"));
  report.push("nav: Power Automate");

  await clickText(".tabs button", "Expressions");
  await page.waitForFunction(() => document.body.innerText.includes("toLower(trim("));
  report.push("PA tab: Expressions");

  await clickText(".tabs button", "Inbound email");
  await page.waitForFunction(() => document.body.innerText.includes("shared mailbox"));
  report.push("PA tab: Inbound email");

  await clickText("nav button", "Field mapping");
  await page.waitForFunction(() => document.body.innerText.includes("Forms key"));
  report.push("nav: Field mapping");

  await clickText("nav button", "Client email intake");
  await page.waitForFunction(() => document.body.innerText.includes("daniel@example.co.uk"));
  report.push("nav: Client email intake");

  await clickText("button.btn", "Run inbound email flow");
  await page.waitForFunction(() => document.body.innerText.includes("£62,000") || document.body.innerText.includes("62000"));
  const body = await page.evaluate(() => document.body.innerText);
  if (!body.includes("Existing value")) throw new Error("proposed facts missing existing/proposed");
  if (!/54,?000/.test(body) && !body.includes("54,000") && !body.includes("54000") && !body.includes("£54,000")) {
    throw new Error("existing salary not shown");
  }
  report.push("email: processed Daniel → proposed salary");

  const before = await page.evaluate(() => document.body.innerText);
  await clickText("button.btn.ok", "Approve");
  await page.waitForFunction(() => !document.body.innerText.includes("Applicant 1 basic annual salary") || document.body.innerText.split("Applicant 1 basic annual salary").length < 3);
  report.push("email: approved a proposed fact");

  await clickText("nav button", "Live questionnaire");
  await page.waitForFunction(() => document.body.innerText.includes("Live client questionnaire"));
  await page.evaluate(() => {
    const input = document.getElementById("sys.invitationId");
    if (input) {
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      proto?.set?.call(input, "WRONG-INVITE");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await clickText(".stepper button", "9. Declarations");
  await clickText("button.btn", "Submit fact-find");
  await page.waitForFunction(() => document.body.innerText.includes("invitation ID") || document.body.innerText.includes("rejected"));
  report.push("questionnaire: invalid invitation rejected");
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Reset demo data"));
    btn?.click();
  });
  await clickText("nav button", "Live questionnaire");
  await page.waitForFunction(() => document.body.innerText.includes("Live client questionnaire"));
  await clickText(".stepper button", "9. Declarations");
  await clickText("button.btn", "Submit fact-find");
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("CRM - Process Client Fact-Find Submission") ||
      document.body.innerText.includes("Please complete the required") ||
      document.body.innerText.includes("invitation"),
    { timeout: 10000 },
  );
  report.push("questionnaire: submit attempted");

  await clickText("nav button", "Case M-1047");
  await page.waitForFunction(() => document.body.innerText.includes("Related protection"));
  report.push("nav: Case file");

  await page.setViewport({ width: 390, height: 844 });
  await clickText("nav button", "Forms template");
  await page.waitForFunction(() => document.body.innerText.includes("1. Applicants"));
  report.push("mobile: forms template");

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Reset demo data"));
    btn?.click();
  });

  if (errors.length) {
    console.log(JSON.stringify({ ok: false, report, errors }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, report, unusedBefore: before.slice(0, 80) }, null, 2));
} catch (err) {
  const shot = "/tmp/crm-e2e-failure.png";
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  console.error(JSON.stringify({ ok: false, error: String(err), report, errors, shot }, null, 2));
  process.exit(1);
} finally {
  await browser.close();
}
