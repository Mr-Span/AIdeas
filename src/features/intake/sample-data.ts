export type WorkflowStatus = "active" | "waiting" | "locked" | "blocked";

export type WorkflowStage = {
  id: "intake" | "research" | "clarification" | "plan" | "execution";
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
  "Push, PR și merge pot deveni autonome după verificări",
  "Plățile, publicarea și deploy-ul cer mereu aprobare",
] as const;

export function workflowStages(submitted: boolean): WorkflowStage[] {
  return [
    {
      id: "intake",
      label: "Intake",
      detail: submitted
        ? "Schița a trecut validarea locală a formularului."
        : "Răspunzi la clarificări și notezi informații.",
      status: "active",
    },
    {
      id: "research",
      label: "Research",
      detail: submitted
        ? "Niciun agent nu a pornit: providerii nu sunt conectați."
        : "Echipa AI va cerceta piața, utilizatorii și soluțiile.",
      status: submitted ? "blocked" : "waiting",
    },
    {
      id: "clarification",
      label: "Clarificare",
      detail: "Revenim cu întrebări țintite și opțiuni A/B.",
      status: "waiting",
    },
    {
      id: "plan",
      label: "Plan final",
      detail: "Arhitectura, taskurile și dovezile vor apărea aici.",
      status: "locked",
    },
    {
      id: "execution",
      label: "Execuție",
      detail: "Începe numai după revizia finală a operatorului.",
      status: "locked",
    },
  ];
}
