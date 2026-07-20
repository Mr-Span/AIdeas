export const CLARIFICATION_IDS = [
  "concept",
  "outcome",
  "journey",
  "audience_problem",
  "must_haves",
  "data_integrations",
  "constraints",
  "references_non_goals",
] as const;

export type ClarificationId = (typeof CLARIFICATION_IDS)[number];
export type ClarificationAnswers = Partial<Record<ClarificationId, string>>;

export type IntakeQuestion = {
  id: ClarificationId;
  title: string;
  label: string;
  hint: string;
  placeholder: string;
};

export const intakeQuestions: readonly IntakeQuestion[] = [
  {
    id: "concept",
    title: "Ce vrei să construiești?",
    label: "Răspuns despre ideea produsului",
    hint: "Descrie produsul în câteva propoziții. Poate fi o aplicație, un website, un instrument intern sau alt tip de experiență digitală.",
    placeholder: "Vreau să construiesc...",
  },
  {
    id: "outcome",
    title: "Ce rezultat trebuie să obțină produsul?",
    label: "Răspuns despre rezultat și succes",
    hint: "Spune ce trebuie să se schimbe pentru utilizator sau afacere și cum vei recunoaște că soluția este utilă.",
    placeholder: "Produsul are succes atunci când...",
  },
  {
    id: "journey",
    title: "Cum arată fluxul principal de la început la final?",
    label: "Răspuns despre fluxul principal",
    hint: "Descrie pașii esențiali: cum începe utilizatorul, ce face și ce primește la final.",
    placeholder: "Utilizatorul începe prin..., apoi..., iar la final...",
  },
  {
    id: "audience_problem",
    title: "Cine va folosi produsul și ce încearcă să rezolve?",
    label: "Răspuns despre utilizator și problema rezolvată",
    hint: "Fii specific: cine sunt utilizatorii, ce încearcă să obțină și ce problemă importantă rezolvi.",
    placeholder: "Produsul este pentru..., care are nevoie să...",
  },
  {
    id: "must_haves",
    title: "Ce trebuie să poată face în prima versiune?",
    label: "Răspuns despre funcțiile esențiale",
    hint: "Separă funcțiile obligatorii de ideile care pot aștepta. Concentrează-te pe cea mai mică versiune cu valoare reală.",
    placeholder: "Obligatoriu în prima versiune...",
  },
  {
    id: "data_integrations",
    title: "Ce date, fișiere sau servicii externe sunt implicate?",
    label: "Răspuns despre date și integrări",
    hint: "Menționează conturi, plăți, baze de date, API-uri, importuri, exporturi și tipurile de media necesare.",
    placeholder: "Produsul va folosi...",
  },
  {
    id: "constraints",
    title: "Ce constrângeri și decizii trebuie respectate?",
    label: "Răspuns despre constrângeri",
    hint: "Include platforme, termene, buget, confidențialitate, cerințe legale, aprobări sau tehnologii deja alese. Poți scrie «Nu știu încă».",
    placeholder: "Trebuie să respectăm...",
  },
  {
    id: "references_non_goals",
    title: "Ce exemple îți plac și ce nu trebuie să construim?",
    label: "Răspuns despre referințe și limite",
    hint: "Adaugă produse, stiluri sau materiale de referință și spune explicit ce rămâne în afara proiectului. Poți scrie «Nu știu încă».",
    placeholder: "Ca referință îmi place..., iar proiectul nu trebuie să...",
  },
] as const;

export function emptyClarificationAnswers(): ClarificationAnswers {
  return {};
}

export function countCompletedClarifications(answers: ClarificationAnswers) {
  return CLARIFICATION_IDS.reduce(
    (total, id) => total + (answers[id]?.trim() ? 1 : 0),
    0,
  );
}

export function normalizeClarificationAnswers(
  answers: ClarificationAnswers | undefined,
  legacyIdea = "",
): ClarificationAnswers {
  const normalized = { ...(answers ?? {}) };
  if (!normalized.audience_problem?.trim() && legacyIdea.trim()) {
    normalized.audience_problem = legacyIdea;
  }
  return normalized;
}
