"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import {
  CheckCircle2,
  Info,
  Lightbulb,
  Menu,
  NotebookPen,
  Paperclip,
  Save,
  Send,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { BottomNavigation } from "./bottom-navigation";
import { MobileDetails } from "./mobile-details";
import { ProjectSidebar } from "./project-sidebar";
import {
  initialIdeaAnswer,
  knownFacts,
  workflowStages,
} from "./sample-data";
import { WorkflowRail } from "./workflow-rail";

export function IntakeWorkspace() {
  const [projectName, setProjectName] = useState("AIdeas Pilot");
  const [ideaAnswer, setIdeaAnswer] = useState(initialIdeaAnswer);
  const [notes, setNotes] = useState("");
  const [fileCount, setFileCount] = useState(0);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [liveMessage, setLiveMessage] = useState(
    "Schița demonstrativă este pregătită.",
  );

  const stages = useMemo(() => workflowStages(submitted), [submitted]);

  function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const count = event.target.files?.length ?? 0;
    setFileCount(count);
    setLiveMessage(
      count
        ? `${count} ${count === 1 ? "fișier selectat" : "fișiere selectate"}. Nu au fost încărcate.`
        : "Nu este selectat niciun fișier.",
    );
  }

  function handleCreateProject() {
    setProjectName("Proiect fără titlu");
    setIdeaAnswer("");
    setNotes("");
    setFileCount(0);
    setSubmitted(false);
    setValidationError("");
    setLiveMessage(
      "A fost creată o schiță nouă numai în memoria acestei pagini.",
    );
  }

  function handleSelectSection(label: string) {
    if (label === "Idee") {
      setLiveMessage("Ești deja în etapa Idee.");
      return;
    }

    setLiveMessage(
      `${label} nu este încă disponibilă în acest vertical UI. Etapa rămâne blocată până la implementarea persistenței și a providerilor.`,
    );
  }

  function handleSave() {
    setLiveMessage(
      "Schița rămâne în sesiunea curentă. Persistența SQLite nu este implementată în acest vertical UI.",
    );
  }

  function handleSubmit() {
    if (ideaAnswer.trim().length < 80) {
      setValidationError(
        "Adaugă cel puțin câteva propoziții despre utilizator, problemă și rezultat.",
      );
      setSubmitted(false);
      setLiveMessage("Schița are nevoie de mai mult context înainte de analiză.");
      return;
    }

    setValidationError("");
    setSubmitted(true);
    setLiveMessage(
      "Formular validat local. Niciun agent nu a pornit: Codex și Claude nu sunt conectați.",
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Sari la conținutul principal
      </a>

      <ProjectSidebar
        projectName={projectName}
        onCreateProject={handleCreateProject}
        onSelectSection={handleSelectSection}
      />

      <header className="app-header">
        <div className="wordmark">AIdeas</div>
        <div className="header-project-name">{projectName}</div>
        <div className="provider-status-list" aria-label="Starea providerilor">
          <span className="provider-status">Codex neconectat</span>
          <span className="provider-status">Claude neconectat</span>
        </div>
        <details className="mobile-menu">
          <summary aria-label="Deschide informațiile proiectului">
            <Menu aria-hidden="true" size={22} />
          </summary>
          <div className="mobile-menu-panel">
            <p className="provider-status">Codex neconectat</p>
            <p className="provider-status">Claude neconectat</p>
          </div>
        </details>
      </header>

      <main className="workspace-main" id="main-content" tabIndex={-1}>
        <div className="workspace-content">
          <div className="workspace-heading">
            <h1>Conturează ideea</h1>
            <p>
              Răspunde pe rând. Echipa AI va organiza, cerceta și reveni cu
              întrebări înainte de plan.
            </p>
          </div>

          <div className="intake-progress">
            <span>4 din 8 clarificări</span>
            <Progress aria-label="4 din 8 clarificări completate" value={50} />
          </div>

          <section className="question-surface" aria-labelledby="question-title">
            <div className="question-label" id="question-title">
              <span className="question-index" aria-hidden="true">
                4
              </span>
              <span>Cine va folosi produsul și ce încearcă să rezolve?</span>
            </div>

            <Field
              className="idea-field"
              data-invalid={validationError ? true : undefined}
            >
              <label className="sr-only" htmlFor="idea-answer">
                Răspuns despre utilizator și problema rezolvată
              </label>
              <Textarea
                aria-describedby="idea-answer-hint"
                aria-invalid={validationError ? true : undefined}
                className="idea-textarea"
                id="idea-answer"
                value={ideaAnswer}
                onChange={(event) => {
                  setIdeaAnswer(event.target.value);
                  setSubmitted(false);
                  if (validationError) setValidationError("");
                }}
              />
              <FieldDescription className="field-hint" id="idea-answer-hint">
                <Lightbulb aria-hidden="true" size={17} />
                Fii specific: cine sunt utilizatorii, ce încearcă să obțină și
                ce problemă importantă rezolvi.
              </FieldDescription>
              <FieldError>{validationError}</FieldError>
            </Field>
          </section>

          <div className="utility-grid">
            <section className="utility-panel" aria-labelledby="notes-title">
              <h2 id="notes-title">
                <NotebookPen aria-hidden="true" size={18} /> Notițe
              </h2>
              <label className="sr-only" htmlFor="notes-desktop">
                Notițe rapide
              </label>
              <Textarea
                className="notes-textarea"
                id="notes-desktop"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Note rapide, gânduri, întrebări pentru mai târziu..."
              />
            </section>

            <section className="utility-panel" aria-labelledby="media-title">
              <h2 id="media-title">
                <Paperclip aria-hidden="true" size={18} /> Media și referințe
              </h2>
              <div className="upload-empty">
                <div>
                  <p>
                    {fileCount
                      ? `${fileCount} ${fileCount === 1 ? "fișier selectat" : "fișiere selectate"}; nimic încărcat.`
                      : "Nu există fișiere încă."}
                  </p>
                  <input
                    className="sr-only"
                    id="media-desktop"
                    multiple
                    type="file"
                    onChange={handleFilesSelected}
                  />
                  <Button asChild variant="outline">
                    <label htmlFor="media-desktop">
                      <Upload data-icon="inline-start" aria-hidden="true" />
                      Adaugă fișiere
                    </label>
                  </Button>
                </div>
              </div>
            </section>

            <section className="utility-panel" aria-labelledby="facts-title">
              <h2 id="facts-title">
                <CheckCircle2 aria-hidden="true" size={18} /> Fapte cunoscute
              </h2>
              <ul className="known-facts">
                {knownFacts.map((fact) => (
                  <li key={fact}>
                    <CheckCircle2 aria-hidden="true" size={16} />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <MobileDetails
            fileCount={fileCount}
            knownFacts={knownFacts}
            notes={notes}
            stages={stages}
            onFilesSelected={handleFilesSelected}
            onNotesChange={setNotes}
          />

          <div className="approval-row">
            <Switch
              aria-describedby="approval-description"
              checked={approvalRequired}
              id="git-approval"
              onCheckedChange={setApprovalRequired}
            />
            <div className="approval-copy">
              <label htmlFor="git-approval">
                Aprobare umană pentru acțiuni Git
              </label>
              <p id="approval-description">
                Push, PR și merge pot rula automat după verificări când toggle-ul
                este oprit. Plățile, publicarea și deploy-ul cer mereu aprobare.
              </p>
            </div>
          </div>

          {submitted ? (
            <div className="submission-notice" role="status">
              Formularul a trecut validarea locală, dar Research este blocat:
              niciun provider nu este conectat și nu a pornit niciun agent.
            </div>
          ) : null}

          <div className="desktop-actions">
            <Button variant="outline" onClick={handleSave}>
              <Save data-icon="inline-start" aria-hidden="true" />
              Salvează schița
            </Button>
            <Button onClick={handleSubmit}>
              <Send data-icon="inline-start" aria-hidden="true" />
              Trimite pentru analiză
            </Button>
          </div>

          <p className="demo-notice">
            <Info aria-hidden="true" size={15} /> Demo local: datele nu sunt
            persistate încă.
          </p>
        </div>
      </main>

      <WorkflowRail stages={stages} />

      <div className="mobile-action-dock">
        <Button className="w-full" onClick={handleSubmit}>
          <Send data-icon="inline-start" aria-hidden="true" />
          Trimite pentru analiză
        </Button>
        <Button className="w-full" variant="outline" onClick={handleSave}>
          <Save data-icon="inline-start" aria-hidden="true" />
          Salvează schița
        </Button>
        <p className="mobile-dock-notice">Demo local · fără persistență</p>
      </div>

      <BottomNavigation onSelectSection={handleSelectSection} />

      <p className="sr-only" aria-live="polite" role="status">
        {liveMessage}
      </p>
    </div>
  );
}
