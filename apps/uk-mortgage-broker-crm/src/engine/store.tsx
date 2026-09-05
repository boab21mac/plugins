import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createSeedState } from "../data/seed";
import type { AppState, InboundEmail, ViewId } from "../types";
import {
  decideProposedFact,
  processFactFindSubmission,
  processInboundEmail,
  runInvitationReminders,
  sendFactFindInvitation,
} from "./workflows";

const STORAGE_KEY = "uk-mortgage-broker-crm-v2";

interface StoreApi {
  state: AppState;
  view: ViewId;
  setView: (v: ViewId) => void;
  setDraft: (key: string, value: unknown) => void;
  replaceDraft: (draft: Record<string, unknown>) => void;
  sendInvitation: () => void;
  submitFactFind: () => { error?: string };
  runReminders: (day: number) => void;
  processEmail: (email: InboundEmail) => void;
  decideFact: (id: string, decision: "approved" | "rejected") => void;
  reset: () => void;
  selectEmail: (id: string) => void;
}

const StoreContext = createContext<StoreApi | null>(null);

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.caseRecord?.caseRef) return createSeedState();
    return { ...createSeedState(), ...parsed };
  } catch {
    return createSeedState();
  }
}

function viewFromHash(): ViewId {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const allowed: ViewId[] = [
    "forms-template",
    "power-automate",
    "field-mapping",
    "email-intake",
    "questionnaire",
    "case-file",
  ];
  return (allowed as string[]).includes(hash) ? (hash as ViewId) : "forms-template";
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => createSeedState());
  const [view, setViewState] = useState<ViewId>("forms-template");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(loadState());
    setViewState(viewFromHash());
    setReady(true);
    const onHash = () => setViewState(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, ready]);

  const api = useMemo<StoreApi>(
    () => ({
      state,
      view,
      setView: (v) => {
        window.location.hash = `/${v}`;
        setViewState(v);
      },
      setDraft: (key, value) =>
        setState((s) => ({ ...s, formDraft: { ...s.formDraft, [key]: value } })),
      replaceDraft: (draft) => setState((s) => ({ ...s, formDraft: draft })),
      sendInvitation: () => setState((s) => sendFactFindInvitation(s)),
      submitFactFind: () => {
        let error: string | undefined;
        setState((s) => {
          const result = processFactFindSubmission(s, s.formDraft);
          error = result.error;
          return result.state;
        });
        return { error };
      },
      runReminders: (day) => setState((s) => runInvitationReminders(s, day)),
      processEmail: (email) => setState((s) => processInboundEmail(s, email)),
      decideFact: (id, decision) => setState((s) => decideProposedFact(s, id, decision)),
      reset: () => {
        localStorage.removeItem(STORAGE_KEY);
        setState(createSeedState());
      },
      selectEmail: (id) => setState((s) => ({ ...s, selectedEmailId: id })),
    }),
    [state, view],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
