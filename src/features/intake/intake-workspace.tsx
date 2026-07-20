"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
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

import {
  countCompletedClarifications,
  emptyClarificationAnswers,
  intakeQuestions,
  normalizeClarificationAnswers,
  type ClarificationAnswers,
} from "@/domain/intake-questions";

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
import type { ResearchStateDto } from "@/server/execution/broker";

import { BottomNavigation } from "./bottom-navigation";
import { CollaborationPanel } from "./collaboration-panel";
import { MobileDetails } from "./mobile-details";
import {
  appendOperatorMessage,
  createProject,
  loadProject,
  loadResearchState,
  ProjectApiError,
  resumeResearch,
  saveDraft,
  startResearch,
  submitProject,
} from "./project-api";
import { ProjectSidebar } from "./project-sidebar";
import {
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
  clarifications: ClarificationAnswers;
  notes: string;
  approvalRequired: boolean;
  files: File[];
}) {
  return JSON.stringify({
    idea: input.idea,
    clarifications: input.clarifications,
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
  const [clarificationAnswers, setClarificationAnswers] =
    useState<ClarificationAnswers>(emptyClarificationAnswers);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [notes, setNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileInputVersion, setFileInputVersion] = useState(0);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [project, setProject] = useState<ClientProjectDto | null>(null);
  const [researchState, setResearchState] =
    useState<ResearchStateDto | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [lastSavedFingerprint, setLastSavedFingerprint] = useState("");
  const [validationError, setValidationError] = useState("");
  const [operationError, setOperationError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isManagingResearch, setIsManagingResearch] = useState(false);
  const [collaborationMessage, setCollaborationMessage] = useState("");
  const [liveMessage, setLiveMessage] = useState(
    "Spațiul local este pregătit.",
  );

  const submitted = project?.draft.submitted ?? false;
  const fileCount = selectedFiles.length;
  const busy = isLoading || isSaving || isSubmitting || isManagingResearch;
  const stages = project
    ? projectWorkflowStages(project)
    : workflowStages(false);
  const activeQuestion = intakeQuestions[activeQuestionIndex];
  const completedClarifications = countCompletedClarifications(
    clarificationAnswers,
  );
  const clarificationProgress = Math.round(
    (completedClarifications / intakeQuestions.length) * 100,
  );
  const ideaAnswer =
    clarificationAnswers.concept?.trim() ||
    clarificationAnswers.audience_problem?.trim() ||
    "";
  const codexHealth = researchState?.providerHealth;
  const codexStatus = codexHealth?.status === "ready" ? "ready" : "blocked";
  const codexLabel =
    codexHealth?.status === "ready"
      ? "Codex conectat local"
      : codexHealth
        ? "Codex indisponibil"
        : "Codex neverificat";
  const researchStep = stages.find((stage) => stage.kind === "research");
  const latestResearchRun = researchState?.latestRun;
  const activeResearchRunId = researchState?.activeRun?.runId ?? null;

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
        const loadedAnswers = normalizeClarificationAnswers(
          loadedProject.draft.clarifications,
          loadedProject.draft.idea,
        );
        setClarificationAnswers(loadedAnswers);
        const firstIncomplete = intakeQuestions.findIndex(
          (question) => !loadedAnswers[question.id]?.trim(),
        );
        setActiveQuestionIndex(firstIncomplete === -1 ? 0 : firstIncomplete);
        setNotes(loadedProject.draft.notes);
        setApprovalRequired(loadedProject.draft.approvalRequired);
        setLastSavedFingerprint(
          draftFingerprint({
            idea: loadedProject.draft.idea,
            clarifications: loadedAnswers,
            notes: loadedProject.draft.notes,
            approvalRequired: loadedProject.draft.approvalRequired,
            files: [],
          }),
        );
        setLiveMessage(
          `Proiectul a fost încărcat din SQLite, versiunea ${loadedProject.version}.`,
        );
        void loadResearchState(loadedProject.id)
          .then((state) => {
            if (cancelled) return;
            setResearchState(state);
            setProject(state.project);
          })
          .catch(() => undefined);
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

  useEffect(() => {
    if (!projectId || !activeResearchRunId) return;
    const timer = window.setInterval(() => {
      void loadResearchState(projectId)
        .then((state) => {
          setResearchState(state);
          setProject(state.project);
        })
        .catch(() => undefined);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [projectId, activeResearchRunId]);

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
    setResearchState(null);
    setProjectId(null);
    setProjectName("Proiect fără titlu");
    setClarificationAnswers(emptyClarificationAnswers());
    setActiveQuestionIndex(0);
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
      clarifications: clarificationAnswers,
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
      clarifications: clarificationAnswers,
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
        clarifications: clarificationAnswers,
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
    const firstIncomplete = intakeQuestions.findIndex(
      (question) => !clarificationAnswers[question.id]?.trim(),
    );
    if (firstIncomplete !== -1) {
      setActiveQuestionIndex(firstIncomplete);
      setValidationError(
        "Răspunde la această clarificare înainte de trimitere. Dacă decizia este deschisă, poți scrie «Nu știu încă».",
      );
      setLiveMessage(
        `Mai sunt ${intakeQuestions.length - completedClarifications} clarificări înainte de analiză.`,
      );
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
          clarifications: result.project.draft.clarifications,
          notes: result.project.draft.notes,
          approvalRequired: result.project.draft.approvalRequired,
          files: [],
        }),
      );
      const revisionId = result.project.draft.revisionId;
      if (!revisionId) {
        throw new ProjectApiError(
          "Revizia trimisă nu are un identificator pentru analiză.",
          "MISSING_REVISION",
          500,
        );
      }
      const researchCommand = `research.${result.project.id}`;
      const researchKey = idempotencyKey(
        researchCommand,
        `${result.project.version}:${revisionId}`,
      );
      try {
        const state = await startResearch({
          projectId: result.project.id,
          expectedVersion: result.project.version,
          revisionId,
          idempotencyKey: researchKey,
        });
        clearPendingKey(researchCommand);
        setResearchState(state);
        setProject(state.project);
        setLiveMessage(
          state.activeRun
            ? "Codex a pornit analiza locală. Progresul este urmărit în SQLite."
            : state.latestRun?.status === "completed"
              ? "Cercetarea s-a încheiat și rezultatul este salvat ca artefact."
              : "Revizia este salvată, dar cercetarea nu a putut porni.",
        );
      } catch (researchError) {
        setOperationError(
          `Revizia a fost salvată, dar cercetarea nu a pornit: ${errorMessage(researchError)}`,
        );
        setLiveMessage("Revizia este sigură în SQLite; cercetarea poate fi reluată.");
      }
    } catch (error) {
      setOperationError(errorMessage(error));
      setLiveMessage("Trimiterea proiectului a eșuat.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResearchAction() {
    if (!projectId || !project?.draft.revisionId) return;
    setIsManagingResearch(true);
    setOperationError("");
    try {
      const resumable =
        researchState?.latestRun?.status === "resume_available"
          ? researchState.latestRun
          : null;
      const resumeCommand = resumable
        ? `research.resume.${projectId}.${resumable.runId}`
        : null;
      const state = resumable
        ? await resumeResearch({
            projectId,
            runId: resumable.runId,
            idempotencyKey: idempotencyKey(
              resumeCommand!,
              resumable.updatedAt,
            ),
          })
        : await startResearch({
            projectId,
            expectedVersion: project.version,
            revisionId: project.draft.revisionId,
            idempotencyKey: idempotencyKey(
              `research.retry.${projectId}`,
              `${project.version}:${project.draft.revisionId}:${researchState?.latestRun?.runId ?? "first"}`,
            ),
          });
      if (resumeCommand) clearPendingKey(resumeCommand);
      else clearPendingKey(`research.retry.${projectId}`);
      setResearchState(state);
      setProject(state.project);
      setLiveMessage("Analiza locală a fost pornită și este urmărită în SQLite.");
    } catch (error) {
      setOperationError(errorMessage(error));
      setLiveMessage("Analiza locală nu a putut fi pornită.");
    } finally {
      setIsManagingResearch(false);
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
          <span className="provider-status" data-status={codexStatus}>
            {codexLabel}
          </span>
          <span className="provider-status">Claude neconectat</span>
        </div>
        <details className="mobile-menu">
          <summary aria-label="Deschide informațiile proiectului">
            <Menu aria-hidden="true" size={22} />
          </summary>
          <div className="mobile-menu-panel">
            <p className="provider-status" data-status={codexStatus}>
              {codexLabel}
            </p>
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
            <span>
              {completedClarifications} din {intakeQuestions.length} clarificări
            </span>
            <Progress
              aria-label={`${completedClarifications} din ${intakeQuestions.length} clarificări completate`}
              value={clarificationProgress}
            />
          </div>

          <section className="question-surface" aria-labelledby="question-title">
            <div className="question-label" id="question-title">
              <span className="question-index" aria-hidden="true">
                {activeQuestionIndex + 1}
              </span>
              <span>{activeQuestion.title}</span>
            </div>

            <Field
              className="idea-field"
              data-invalid={validationError ? true : undefined}
            >
              <label className="sr-only" htmlFor="idea-answer">
                {activeQuestion.label}
              </label>
              <Textarea
                aria-describedby="idea-answer-hint"
                aria-invalid={validationError ? true : undefined}
                className="idea-textarea"
                id="idea-answer"
                placeholder={activeQuestion.placeholder}
                value={clarificationAnswers[activeQuestion.id] ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setClarificationAnswers((answers) => ({
                    ...answers,
                    [activeQuestion.id]: value,
                  }));
                  if (validationError) setValidationError("");
                }}
              />
              <FieldDescription className="field-hint" id="idea-answer-hint">
                <Lightbulb aria-hidden="true" size={17} />
                {activeQuestion.hint}
              </FieldDescription>
              <FieldError>{validationError}</FieldError>
            </Field>

            <div className="question-navigation">
              <Button
                disabled={activeQuestionIndex === 0}
                variant="outline"
                onClick={() => {
                  setValidationError("");
                  setActiveQuestionIndex((index) => Math.max(0, index - 1));
                }}
              >
                <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                Înapoi
              </Button>
              <span aria-live="polite">
                Întrebarea {activeQuestionIndex + 1} din {intakeQuestions.length}
              </span>
              <Button
                disabled={activeQuestionIndex === intakeQuestions.length - 1}
                variant="outline"
                onClick={() => {
                  setValidationError("");
                  setActiveQuestionIndex((index) =>
                    Math.min(intakeQuestions.length - 1, index + 1),
                  );
                }}
              >
                Înainte
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Button>
            </div>
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
              <span>
                {researchStep?.status === "in_progress"
                  ? "Codex analizează proiectul. Evenimentele sigure sunt salvate în SQLite."
                  : researchStep?.status === "verified"
                    ? "Cercetarea s-a încheiat și rezultatul este salvat ca artefact verificabil."
                    : latestResearchRun?.status === "resume_available"
                      ? "Serverul a fost repornit. Cercetarea poate fi reluată explicit."
                      : latestResearchRun?.errorDetail ??
                        "Revizia este salvată. Cercetarea așteaptă pornirea providerului local."}
              </span>
              {!researchState?.activeRun && researchStep?.status !== "verified" ? (
                <Button
                  disabled={busy}
                  size="sm"
                  variant="outline"
                  onClick={handleResearchAction}
                >
                  {latestResearchRun?.status === "resume_available"
                    ? "Reia analiza"
                    : "Pornește analiza"}
                </Button>
              ) : null}
            </div>
          ) : null}

          {latestResearchRun?.resultText ? (
            <section className="research-result" aria-labelledby="research-result-title">
              <h2 id="research-result-title">Rezultatul cercetării</h2>
              <pre>{latestResearchRun.resultText}</pre>
            </section>
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
