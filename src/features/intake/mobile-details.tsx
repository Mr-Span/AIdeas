"use client";

import type { ChangeEvent, ReactNode } from "react";
import {
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

import type { WorkflowStage } from "./sample-data";

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
  knownFacts: readonly string[];
  notes: string;
  onFilesSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  onNotesChange: (value: string) => void;
  stages: WorkflowStage[];
};

export function MobileDetails({
  fileCount,
  knownFacts,
  notes,
  onFilesSelected,
  onNotesChange,
  stages,
}: MobileDetailsProps) {
  const researchStage = stages.find((stage) => stage.id === "research");

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
            Rămân doar în memoria acestei pagini în versiunea curentă.
          </FieldDescription>
        </Field>
      </MobileSection>

      <MobileSection
        icon={<Paperclip aria-hidden="true" size={19} />}
        label="Media și referințe"
        summary={`${fileCount} ${fileCount === 1 ? "fișier" : "fișiere"}`}
      >
        <p className="mobile-section-summary">
          Selectarea este locală; fișierele nu sunt încă încărcate sau salvate.
        </p>
        <input
          className="sr-only"
          id="media-mobile"
          multiple
          type="file"
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
        label="Fluxul proiectului"
        summary={
          researchStage?.status === "blocked"
            ? "Research blocat"
            : "Intake în lucru"
        }
      >
        <ol className="known-facts">
          {stages.map((stage) => (
            <li key={stage.id}>
              <CheckCircle2 aria-hidden="true" size={16} />
              <span>
                <strong>{stage.label}:</strong> {stage.detail}
              </span>
            </li>
          ))}
        </ol>
      </MobileSection>
    </div>
  );
}
