"use client";

import type { ChangeEvent, ReactNode } from "react";
import {
  Circle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ListChecks,
  NotebookPen,
  Paperclip,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

import type { WorkflowStage } from "./sample-data";

function mobileStatusLabel(stage: WorkflowStage) {
  if (stage.status === "verified") return "verificat";
  if (stage.status === "in_progress") return "în lucru";
  if (stage.status === "waiting_client") return "așteaptă clientul";
  if (stage.status === "blocked") return "blocat";
  return "neînceput";
}

type MobileSectionProps = {
  children: ReactNode;
  defaultOpen?: boolean;
  icon: ReactNode;
  label: string;
  summary: string;
};

function MobileSection({
  children,
  defaultOpen = false,
  icon,
  label,
  summary,
}: MobileSectionProps) {
  return (
    <Collapsible className="mobile-section" defaultOpen={defaultOpen}>
      <CollapsibleTrigger asChild>
        <button className="mobile-section-trigger" type="button">
          {icon}
          <strong>{label}</strong>
          <span className="mobile-section-summary">{summary}</span>
          <ChevronDown className="chevron" aria-hidden="true" size={18} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mobile-section-content">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

type MobileDetailsProps = {
  fileCount: number;
  fileInputVersion: number;
  knownFacts: readonly string[];
  notes: string;
  onFilesSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  onNotesChange: (value: string) => void;
  stages: WorkflowStage[];
};

export function MobileDetails({
  fileCount,
  fileInputVersion,
  knownFacts,
  notes,
  onFilesSelected,
  onNotesChange,
  stages,
}: MobileDetailsProps) {
  const researchStage = stages.find((stage) => stage.kind === "research");
  const verifiedSteps = stages.filter(
    (stage) => stage.status === "verified",
  ).length;

  return (
    <div className="mobile-sections">
      <MobileSection
        defaultOpen
        icon={<NotebookPen aria-hidden="true" size={19} />}
        label="Notițe"
        summary={notes.trim() ? "Editate" : "Goale"}
      >
        <Field>
          <FieldLabel htmlFor="notes-mobile">Notițe rapide</FieldLabel>
          <Textarea
            id="notes-mobile"
            className="notes-textarea"
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Gânduri, întrebări sau context pentru mai târziu..."
          />
          <FieldDescription>
            Se salvează drept o revizie nouă când alegi Salvează sau Trimite.
          </FieldDescription>
        </Field>
      </MobileSection>

      <MobileSection
        icon={<Paperclip aria-hidden="true" size={19} />}
        label="Media și referințe"
        summary={`${fileCount} ${fileCount === 1 ? "fișier" : "fișiere"}`}
      >
        <p className="mobile-section-summary">
          Fișierele selectate vor fi salvate împreună cu următoarea revizie.
        </p>
        <input
          key={`media-mobile-${fileInputVersion}`}
          className="sr-only"
          id="media-mobile"
          multiple
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,application/json"
          onChange={onFilesSelected}
        />
        <Button asChild variant="outline">
          <label htmlFor="media-mobile">
            <Upload data-icon="inline-start" aria-hidden="true" />
            Alege fișiere
          </label>
        </Button>
      </MobileSection>

      <MobileSection
        icon={<ListChecks aria-hidden="true" size={19} />}
        label="Fapte cunoscute"
        summary={`${knownFacts.length} elemente`}
      >
        <ul className="known-facts">
          {knownFacts.map((fact) => (
            <li key={fact}>
              <CheckCircle2 aria-hidden="true" size={16} />
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      </MobileSection>

      <MobileSection
        icon={<Clock3 aria-hidden="true" size={19} />}
        label="Planul proiectului"
        summary={`${verifiedSteps}/${stages.length} verificați`}
      >
        <Progress
          aria-label={`${verifiedSteps} din ${stages.length} pași verificați`}
          className="client-plan-progress"
          value={stages.length ? (verifiedSteps / stages.length) * 100 : 0}
        />
        {researchStage?.status === "blocked" ? (
          <p className="mobile-stage-alert">
            Cercetarea este blocată până la conectarea providerului.
          </p>
        ) : null}
        <ol className="mobile-stage-list">
          {stages.map((stage) => (
            <li data-status={stage.status} key={stage.id}>
              {stage.status === "verified" ? (
                <CheckCircle2 aria-hidden="true" size={17} />
              ) : (
                <Circle aria-hidden="true" size={17} />
              )}
              <span>
                <strong>{stage.label}</strong>
                <small>{mobileStatusLabel(stage)}</small>
                <span>{stage.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </MobileSection>
    </div>
  );
}
