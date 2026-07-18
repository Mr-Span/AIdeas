"use client";

import { useEffect, useState, type ChangeEvent } from "react";
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
import type { ClientProjectDto } from "@/server/domain/contracts";

import { BottomNavigation } from "./bottom-navigation";
import { CollaborationPanel } from "./collaboration-panel";
import { MobileDetails } from "./mobile-details";
import {
  appendOperatorMessage,
  createProject,
  loadProject,
  ProjectApiError,
  saveDraft,
  submitProject,
} from "./project-api";
import { ProjectSidebar } from "./project-sidebar";
import {
  initialIdeaAnswer,
  knownFacts,
  projectWorkflowStages,
  workflowStages,
} from "./sample-data";
import { WorkflowRail } from "./workflow-rail";

const PROJECT_POINTER_KEY = "aideas.project-pointer.v1";

function pendingStorageKey(command: string) {
  return `aideas.pending.${command}.v1`;
}

function idempotencyKey(command: string, fingerprint: string) {
  const storageKey = pendingStorageKey(command);
  const existingSource = window.localStorage.getItem(storageKey);
  if (existingSource) {
    try {
      const existing = JSON.parse(existingSource) as {
        fingerprint: string;
        key: string;
      };
      if (existing.fingerprint === fingerprint) return existing.key;
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }

  const key = `${command}:${window.crypto.randomUUID()}`;
  window.localStorage.setItem(storageKey, JSON.stringify({ fingerprint, key }));
  return key;
}

function clearPendingKey(command: string) {
  window.localStorage.removeItem(pendingStorageKey(command));
}

function draftFingerprint(input: {
  idea: string;
  notes: string;
  approvalRequired: boolean;
  files: File[];
}) {
  return JSON.stringify({
    idea: input.idea,
    notes: input.notes,
    approvalRequired: input.approvalRequired,
    files: input.files.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    })),
  });
}

function errorMessage(error: unknown) {
  if (error instanceof ProjectApiError) return error.message;
  return "Operația nu a putut fi finalizată. Încearcă din nou.";
}

export function IntakeWorkspace() {
  const [projectName, setProjectName] = useState("AIdeas Pilot");
  const [ideaAnswer, setIdeaAnswer] = useState(initialIdeaAnswer);
  const [notes, setNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileInputVersion, setFileInputVersion] = useState(0);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [project, setProject] = useState<ClientProjectDto | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [lastSavedFingerprint, setLastSavedFingerprint] = useState("");
  const [validationError, setValidationError] = useState("");
  const [operationError, setOperationError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [collaborationMessage, setCollaborationMessage] = useState("");
  const [liveMessage, setLiveMessage] = useState(
    "Spațiul local este pregătit.",
  );

  const submitted = project?.draft.submitted ?? false;
  const fileCount = selectedFiles.length;
  const busy = isLoading || isSaving || isSubmitting;
  const stages = project
    ? projectWorkflowStages(project)
    : workflowStages(false);

  useEffect(() => {
    let cancelled = false;
    const savedProjectId = window.localStorage.getItem(PROJECT_POINTER_KEY);
    if (!savedProjectId) {
      queueMicrotask(() => {
        if (!cancelled) setIsLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    loadProject(savedProjectId)
      .then(({ project: loadedProject }) => {
        if (cancelled) return;
        setProject(loadedProject);
        setProjectId(loadedProject.id);
        setProjectName(loadedProject.displayName);
        setIdeaAnswer(loadedProject.draft.idea);
        setNotes(loadedProject.draft.notes);
        setApprovalRequired(loadedProject.draft.approvalRequired);
        setLastSavedFingerprint(
          draftFingerprint({
            idea: loadedProject.draft.idea,
            notes: loadedProject.draft.notes,
            approvalRequired: loadedProject.draft.approvalRequired,
            files: [],
          }),
        );
        setLiveMessage(
          `Proiectul a fost încărcat din SQLite, versiunea ${loadedProject.version}.`,
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ProjectApiError && error.status === 404) {
          window.localStorage.removeItem(PROJECT_POINTER_KEY);
        }
        setOperationError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles(files);
    setOperationError("");
    setLiveMessage(
      files.length
        ? `${files.length} ${files.length === 1 ? "fișier pregătit" : "fișiere pregătite"} pentru următoarea salvare.`
        : "Nu este selectat niciun fișier.",
    );
  }

  function handleCreateProject() {
    if (projectId) {
      clearPendingKey(`save.${projectId}`);
      clearPendingKey(`submit.${projectId}`);
      clearPendingKey(`message.${projectId}`);
    }
    window.localStorage.removeItem(PROJECT_POINTER_KEY);
    clearPendingKey("create");
    setProject(null);
    setProjectId(null);
    setProjectName("Proiect fără titlu");
    setIdeaAnswer("");
    setNotes("");
    setSelectedFiles([]);
    setFileInputVersion((version) => version + 1);
    setApprovalRequired(false);
    setLastSavedFingerprint("");
    setValidationError("");
    setOperationError("");
    setLiveMessage(
      "Ai început o schiță nouă. Proiectul anterior rămâne salvat local.",
    );
  }

  function handleSelectSection(label: string) {
    if (label === "Idee") {
      setLiveMessage("Ești deja în etapa Idee.");
      return;
    }
    if (label === "Plan") {
      setLiveMessage(
        "Pașii publici și progresul verificat sunt vizibili în trackerul proiectului.",
      );
      return;
    }
    setLiveMessage(
      `${label} nu este încă activă. Providerii și execuția rămân blocate până la fazele următoare.`,
    );
  }

  async function ensureProject() {
    if (project && projectId) return project;

    const displayName = projectName.trim() || "Proiect fără titlu";
    const key = idempotencyKey("create", displayName);
    const result = await createProject({
      displayName,
      idempotencyKey: key,
    });
    clearPendingKey("create");
    window.localStorage.setItem(PROJECT_POINTER_KEY, result.project.id);
    setProject(result.project);
    setProjectId(result.project.id);
    setProjectName(result.project.displayName);
    return result.project;
  }

  async function persistDraft() {
    const currentProject = await ensureProject();
    const currentFingerprint = draftFingerprint({
      idea: ideaAnswer,
      notes,
      approvalRequired,
      files: selectedFiles,
    });
    if (
      currentProject.draft.revisionId &&
      currentFingerprint === lastSavedFingerprint
    ) {
      return currentProject;
    }

    const command = `save.${currentProject.id}`;
    const key = idempotencyKey(
      command,
      `${currentProject.version}:${currentFingerprint}`,
    );
    const result = await saveDraft({
      projectId: currentProject.id,
      expectedVersion: currentProject.version,
      idempotencyKey: key,
      idea: ideaAnswer,
      notes,
      approvalRequired,
      files: selectedFiles,
    });
    clearPendingKey(command);
    setProject(result.project);
    setProjectId(result.project.id);
    setSelectedFiles([]);
    setFileInputVersion((version) => version + 1);
    setLastSavedFingerprint(
      draftFingerprint({
        idea: ideaAnswer,
        notes,
        approvalRequired,
        files: [],
      }),
    );
    return result.project;
  }

  async function handleSave() {
    setIsSaving(true);
    setOperationError("");
    try {
      const savedProject = await persistDraft();
      setLiveMessage(
        `Schița a fost salvată în SQLite ca versiunea ${savedProject.version}.`,
      );
    } catch (error) {
      setOperationError(errorMessage(error));
      setLiveMessage("Salvarea proiectului a eșuat.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit() {
    if (ideaAnswer.trim().length < 80) {
      setValidationError(
        "Adaugă cel puțin câteva propoziții despre utilizator, problemă și rezultat.",
      );
      setLiveMessage("Schița are nevoie de mai mult context înainte de analiză.");
      return;
    }

    setValidationError("");
    setOperationError("");
    setIsSubmitting(true);
    try {
      const savedProject = await persistDraft();
      const command = `submit.${savedProject.id}`;
      const key = idempotencyKey(
        command,
        `${savedProject.version}:${savedProject.draft.revisionId}`,
      );
      const result = await submitProject({
        projectId: savedProject.id,
        expectedVersion: savedProject.version,
        idempotencyKey: key,
      });
      clearPendingKey(command);
      setProject(result.project);
      setLastSavedFingerprint(
        draftFingerprint({
          idea: result.project.draft.idea,
          notes: result.project.draft.notes,
          approvalRequired: result.project.draft.approvalRequired,
          files: [],
        }),
      );
      setLiveMessage(
        "Revizia a fost salvată și trimisă. Niciun agent nu a pornit deoarece providerul nu este conectat.",
      );
    } catch (error) {
      setOperationError(errorMessage(error));
      setLiveMessage("Trimiterea proiectului a eșuat.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendMessage() {
    if (!projectId || !project || !collaborationMessage.trim()) return;
    setIsSendingMessage(true);
    setOperationError("");
    const body = collaborationMessage.trim();
    const command = `message.${projectId}`;
    try {
      const result = await appendOperatorMessage({
        projectId,
        idempotencyKey: idempotencyKey(command, body),
        body,
      });
      clearPendingKey(command);
      setProject({
        ...project,
        collaboration: [...project.collaboration, result.entry],
      });
      setCollaborationMessage("");
      setLiveMessage("Mesajul public a fost salvat în firul client–inginer.");
    } catch (error) {
      setOperationError(errorMessage(error));
      setLiveMessage("Mesajul nu a putut fi salvat.");
    } finally {
      setIsSendingMessage(false);
    }
  }

  return (
    <div className="app-shell" aria-busy={busy}>
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
                      ? `${fileCount} ${fileCount === 1 ? "fișier pregătit" : "fișiere pregătite"} pentru salvare.`
                      : "Nu există fișiere noi."}
                  </p>
                  <input
                    key={`media-desktop-${fileInputVersion}`}
                    className="sr-only"
                    id="media-desktop"
                    multiple
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,application/json"
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
            fileInputVersion={fileInputVersion}
            knownFacts={knownFacts}
            notes={notes}
            stages={stages}
            onFilesSelected={handleFilesSelected}
            onNotesChange={setNotes}
          />

          <CollaborationPanel
            entries={project?.collaboration ?? []}
            isSending={isSendingMessage}
            message={collaborationMessage}
            projectSaved={Boolean(projectId)}
            onMessageChange={setCollaborationMessage}
            onSubmit={handleSendMessage}
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
              Revizia este salvată, dar Cercetarea este blocată: niciun provider
              nu este conectat și nu a pornit niciun agent.
            </div>
          ) : null}

          {operationError ? (
            <div className="operation-error" role="alert">
              {operationError}
            </div>
          ) : null}

          <div className="desktop-actions">
            <Button disabled={busy} variant="outline" onClick={handleSave}>
              <Save data-icon="inline-start" aria-hidden="true" />
              {isSaving ? "Se salvează..." : "Salvează schița"}
            </Button>
            <Button disabled={busy} onClick={handleSubmit}>
              <Send data-icon="inline-start" aria-hidden="true" />
              {isSubmitting ? "Se trimite..." : "Trimite pentru analiză"}
            </Button>
          </div>

          <p className="demo-notice">
            <Info aria-hidden="true" size={15} />
            {isLoading
              ? "Se încarcă proiectul local..."
              : project
                ? `Salvat local în SQLite · versiunea ${project.version}`
                : "Schiță nesalvată · SQLite local este disponibil"}
          </p>
        </div>
      </main>

      <WorkflowRail stages={stages} />

      <div className="mobile-action-dock">
        <Button className="w-full" disabled={busy} onClick={handleSubmit}>
          <Send data-icon="inline-start" aria-hidden="true" />
          {isSubmitting ? "Se trimite..." : "Trimite pentru analiză"}
        </Button>
        <Button
          className="w-full"
          disabled={busy}
          variant="outline"
          onClick={handleSave}
        >
          <Save data-icon="inline-start" aria-hidden="true" />
          {isSaving ? "Se salvează..." : "Salvează schița"}
        </Button>
        <p className="mobile-dock-notice">
          {project ? `SQLite local · v${project.version}` : "Schiță nesalvată"}
        </p>
      </div>

      <BottomNavigation onSelectSection={handleSelectSection} />

      <p className="sr-only" aria-live="polite" role="status">
        {liveMessage}
      </p>
    </div>
  );
}
