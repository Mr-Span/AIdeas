import {
  CircleHelp,
  Clock3,
  FileText,
  Lightbulb,
  LockKeyhole,
  TerminalSquare,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

import type { WorkflowStage, WorkflowStatus } from "./sample-data";

const icons = {
  intake: Lightbulb,
  research: Clock3,
  clarification: CircleHelp,
  plan: FileText,
  execution: TerminalSquare,
} as const;

function statusLabel(status: WorkflowStatus) {
  if (status === "active") return "În lucru";
  if (status === "waiting") return "În așteptare";
  if (status === "blocked") return "Blocat";
  return "Blocat";
}

function statusVariant(status: WorkflowStatus) {
  if (status === "active") return "default" as const;
  if (status === "blocked") return "destructive" as const;
  if (status === "waiting") return "secondary" as const;
  return "outline" as const;
}

type WorkflowRailProps = {
  stages: WorkflowStage[];
};

export function WorkflowRail({ stages }: WorkflowRailProps) {
  return (
    <aside className="workflow-rail" aria-labelledby="workflow-title">
      <h2 id="workflow-title">Fluxul proiectului</h2>
      <ol className="workflow-list">
        {stages.map((stage) => {
          const Icon = icons[stage.id];
          const StatusIcon = stage.status === "locked" ? LockKeyhole : null;

          return (
            <li className="workflow-stage" key={stage.id}>
              <div className="stage-icon" data-status={stage.status}>
                <Icon aria-hidden="true" size={17} />
              </div>
              <div className="stage-copy">
                <div className="stage-title-line">
                  <strong>{stage.label}</strong>
                  <Badge variant={statusVariant(stage.status)}>
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
