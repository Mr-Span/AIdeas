import {
  CheckCircle2,
  CircleHelp,
  Clock3,
  FileText,
  Lightbulb,
  LockKeyhole,
  TerminalSquare,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import type { WorkflowStage, WorkflowStatus } from "./sample-data";

const icons = {
  intake: Lightbulb,
  research: Clock3,
  clarification: CircleHelp,
  plan: FileText,
  execution: TerminalSquare,
} as const;

function statusLabel(status: WorkflowStatus) {
  if (status === "in_progress") return "În lucru";
  if (status === "waiting_client") return "Așteaptă clientul";
  if (status === "blocked") return "Blocat";
  if (status === "verified") return "Verificat";
  return "Neînceput";
}

function statusVariant(status: WorkflowStatus) {
  if (status === "in_progress") return "default" as const;
  if (status === "blocked") return "destructive" as const;
  if (status === "waiting_client") return "secondary" as const;
  return "outline" as const;
}

type WorkflowRailProps = {
  stages: WorkflowStage[];
};

export function WorkflowRail({ stages }: WorkflowRailProps) {
  const verified = stages.filter((stage) => stage.status === "verified").length;
  const progress = stages.length ? Math.round((verified / stages.length) * 100) : 0;

  return (
    <aside className="workflow-rail" aria-labelledby="workflow-title">
      <div className="workflow-heading">
        <h2 id="workflow-title">Planul proiectului</h2>
        <span>{verified} din {stages.length} verificați</span>
      </div>
      <Progress
        aria-label={`${verified} din ${stages.length} pași verificați`}
        className="workflow-progress"
        value={progress}
      />
      <ol className="workflow-list">
        {stages.map((stage) => {
          const Icon = icons[stage.kind];
          const StatusIcon =
            stage.status === "verified"
              ? CheckCircle2
              : stage.status === "not_started"
                ? LockKeyhole
                : null;

          return (
            <li className="workflow-stage" key={stage.id}>
              <div className="stage-icon" data-status={stage.status}>
                <Icon aria-hidden="true" size={17} />
              </div>
              <div className="stage-copy">
                <div className="stage-title-line">
                  <strong>{stage.label}</strong>
                  <Badge
                    data-stage-status={stage.status}
                    variant={statusVariant(stage.status)}
                  >
                    {StatusIcon ? (
                      <StatusIcon data-icon="inline-start" aria-hidden="true" />
                    ) : null}
                    {statusLabel(stage.status)}
                  </Badge>
                </div>
                <p>{stage.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="process-guide" aria-labelledby="process-guide-title">
        <h3 id="process-guide-title">
          <TriangleAlert aria-hidden="true" size={16} /> Cum curge procesul
        </h3>
        <p>
          Fiecare etapă se deblochează prin dovezi. Problemele nerezolvate se
          întorc la operator; acțiunile externe sensibile cer aprobare.
        </p>
      </section>
    </aside>
  );
}
