import { Layout } from "./components/Layout";
import { useStore } from "./engine/store";
import { CaseFile } from "./views/CaseFile";
import { EmailIntake } from "./views/EmailIntake";
import { FieldMapping } from "./views/FieldMapping";
import { FormsTemplate } from "./views/FormsTemplate";
import { PowerAutomate } from "./views/PowerAutomate";
import { Questionnaire } from "./views/Questionnaire";

export function App() {
  const { view } = useStore();
  return (
    <Layout>
      {view === "forms-template" ? <FormsTemplate /> : null}
      {view === "power-automate" ? <PowerAutomate /> : null}
      {view === "field-mapping" ? <FieldMapping /> : null}
      {view === "email-intake" ? <EmailIntake /> : null}
      {view === "questionnaire" ? <Questionnaire /> : null}
      {view === "case-file" ? <CaseFile /> : null}
    </Layout>
  );
}
