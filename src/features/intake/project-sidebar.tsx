import {
  FileText,
  FlaskConical,
  Folder,
  Lightbulb,
  Plus,
  Settings,
  TerminalSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const navigation = [
  { id: "idea", label: "Idee", icon: Lightbulb },
  { id: "research", label: "Cercetare", icon: FlaskConical },
  { id: "plan", label: "Plan", icon: FileText },
  { id: "execution", label: "Execuție", icon: TerminalSquare },
] as const;

type ProjectSidebarProps = {
  projectName: string;
  onCreateProject: () => void;
  onSelectSection: (label: string) => void;
};

export function ProjectSidebar({
  projectName,
  onCreateProject,
  onSelectSection,
}: ProjectSidebarProps) {
  return (
    <aside className="project-sidebar" aria-label="Spațiu de proiect">
      <div className="sidebar-inner">
        <div className="wordmark sidebar-wordmark">AIdeas</div>

        <p className="sidebar-label">Proiecte</p>
        <div className="project-row" aria-current="page">
          <Folder aria-hidden="true" size={18} />
          <span>{projectName}</span>
        </div>
        <Button
          className="sidebar-action"
          variant="outline"
          onClick={onCreateProject}
        >
          <Plus data-icon="inline-start" aria-hidden="true" />
          Proiect nou
        </Button>

        <nav className="sidebar-nav" aria-label="Etapele proiectului">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = item.id === "idea";

            return (
              <button
                className="sidebar-nav-item"
                data-active={active}
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onSelectSection(item.label)}
              >
                <Icon aria-hidden="true" size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          className="sidebar-nav-item sidebar-settings"
          type="button"
          onClick={() => onSelectSection("Setări")}
        >
          <Settings aria-hidden="true" size={19} />
          <span>Setări</span>
        </button>
      </div>
    </aside>
  );
}
