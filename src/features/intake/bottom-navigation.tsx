import {
  FileText,
  FlaskConical,
  Lightbulb,
  LockKeyhole,
  TerminalSquare,
} from "lucide-react";

type BottomNavigationProps = {
  onSelectSection: (label: string) => void;
};

const items = [
  { id: "idea", label: "Idee", icon: Lightbulb, locked: false },
  { id: "research", label: "Cercetare", icon: FlaskConical, locked: false },
  { id: "plan", label: "Plan", icon: FileText, locked: true },
  { id: "execution", label: "Execuție", icon: TerminalSquare, locked: true },
] as const;

export function BottomNavigation({ onSelectSection }: BottomNavigationProps) {
  return (
    <nav className="bottom-nav" aria-label="Etapele proiectului pe mobil">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.id === "idea";

        return (
          <button
            className="bottom-nav-item"
            data-active={active}
            key={item.id}
            type="button"
            aria-current={active ? "page" : undefined}
            aria-label={`${item.label}${item.locked ? ", blocat" : ""}`}
            onClick={() => onSelectSection(item.label)}
          >
            <span>
              <Icon aria-hidden="true" size={22} />
              {item.locked ? (
                <LockKeyhole aria-hidden="true" size={11} />
              ) : null}
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
