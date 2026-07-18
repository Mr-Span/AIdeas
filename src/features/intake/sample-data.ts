import type { ClientProjectDto } from "@/server/domain/contracts";

export type WorkflowStatus =
  | "not_started"
  | "in_progress"
  | "waiting_client"
  | "blocked"
  | "verified";

export type WorkflowStageKind =
  | "intake"
  | "research"
  | "clarification"
  | "plan"
  | "execution";

export type WorkflowStage = {
  id: string;
  kind: WorkflowStageKind;
  label: string;
  detail: string;
  status: WorkflowStatus;
};

export const initialIdeaAnswer = `Produsul este pentru un client non-tehnic (de exemplu, o afacere mică sau un freelancer) care vrea să-și contureze o idee de aplicație sau site și să o transforme într-un plan tehnic clar, fără să scrie cod.

Utilizatorii principali sunt antreprenori, consultanți sau persoane care au o idee, dar nu știu ce tehnologie să aleagă ori cum să o structureze.

Problema rezolvată este lipsa de claritate și direcție tehnică la început, riscul de a construi ceva nepotrivit și dificultatea de a colabora eficient cu dezvoltatori.

Valoarea cheie: o idee vagă devine un plan validat și executabil, susținut de cercetare și întrebări relevante.`;

export const knownFacts = [
  "Produs personal, pentru lucru cu clienți non-tehnici",
  "Funcționează local, cu acces LAN opțional",
  "Starea canonică va fi păstrată în SQLite",
  "Clientul și inginerul colaborează într-un fir public two-way",
  "Numai pașii verificați devin verzi în progresul clientului",
  "Push, PR și merge pot deveni autonome după verificări",
  "Plățile, publicarea și deploy-ul cer mereu aprobare",
] as const;

export function workflowStages(submitted: boolean): WorkflowStage[] {
  return [
    {
      id: "intake",
      kind: "intake",
      label: "Idee și context",
      detail: submitted
        ? "Schița a fost salvată și trimisă ca revizie verificabilă."
        : "Răspunzi la clarificări și notezi informații.",
      status: submitted ? "verified" : "in_progress",
    },
    {
      id: "research",
      kind: "research",
      label: "Cercetare și validare",
      detail: submitted
        ? "Niciun agent nu a pornit: providerii nu sunt conectați."
        : "Echipa AI va cerceta piața, utilizatorii și soluțiile.",
      status: submitted ? "blocked" : "not_started",
    },
    {
      id: "clarification",
      kind: "clarification",
      label: "Clarificări client–inginer",
      detail: "Revenim cu întrebări țintite și opțiuni A/B.",
      status: "not_started",
    },
    {
      id: "plan",
      kind: "plan",
      label: "Plan tehnic",
      detail: "Arhitectura, taskurile și dovezile vor apărea aici.",
      status: "not_started",
    },
    {
      id: "execution",
      kind: "execution",
      label: "Implementare și verificare",
      detail: "Începe numai după revizia finală a operatorului.",
      status: "not_started",
    },
  ];
}

const workflowKinds: WorkflowStageKind[] = [
  "intake",
  "research",
  "clarification",
  "plan",
  "execution",
];

export function projectWorkflowStages(project: ClientProjectDto): WorkflowStage[] {
  return project.plan.steps.map((step, index) => ({
    id: step.id,
    kind: workflowKinds[index] ?? "plan",
    label: step.title,
    detail: step.nextAction ?? step.summary,
    status: step.status,
  }));
}
