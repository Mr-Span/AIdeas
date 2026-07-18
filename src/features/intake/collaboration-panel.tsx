"use client";

import { MessageCircleMore, Send } from "lucide-react";
import type { FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ClientCollaborationEntryDto } from "@/server/domain/contracts";

type CollaborationPanelProps = {
  entries: ClientCollaborationEntryDto[];
  isSending: boolean;
  message: string;
  projectSaved: boolean;
  onMessageChange: (value: string) => void;
  onSubmit: () => void;
};

const roleLabel = {
  operator: "Inginer",
  client: "Client",
  unverified: "Participant local",
} as const;

export function CollaborationPanel({
  entries,
  isSending,
  message,
  projectSaved,
  onMessageChange,
  onSubmit,
}: CollaborationPanelProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="collaboration-panel" aria-labelledby="collaboration-title">
      <div className="collaboration-heading">
        <div>
          <h2 id="collaboration-title">
            <MessageCircleMore aria-hidden="true" size={19} /> Client ↔ inginer
          </h2>
          <p>
            Întrebările și corecțiile publice rămân legate de proiect. Detaliile
            interne de execuție nu apar aici.
          </p>
        </div>
        <Badge variant="outline">Two-way</Badge>
      </div>

      {entries.length ? (
        <ol className="collaboration-thread" aria-label="Conversația proiectului">
          {entries.map((entry) => (
            <li key={entry.id} data-actor={entry.actorKind}>
              <div className="collaboration-meta">
                <strong>{roleLabel[entry.actorKind]}</strong>
                <time dateTime={entry.createdAt}>
                  {new Intl.DateTimeFormat("ro-RO", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(entry.createdAt))}
                </time>
              </div>
              <p>{entry.body}</p>
              {entry.attribution === "unverified-local" ? (
                <small>Identitate locală încă neautentificată</small>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="collaboration-empty">
          Nu există mesaje publice. Salvează proiectul pentru a începe firul.
        </p>
      )}

      <form className="collaboration-composer" onSubmit={handleSubmit}>
        <label htmlFor="operator-message">Mesaj public pentru client</label>
        <div>
          <Textarea
            id="operator-message"
            value={message}
            disabled={!projectSaved || isSending}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder="Întrebare, clarificare sau actualizare vizibilă clientului..."
          />
          <Button
            disabled={!projectSaved || isSending || !message.trim()}
            type="submit"
          >
            <Send data-icon="inline-start" aria-hidden="true" />
            {isSending ? "Se trimite..." : "Trimite"}
          </Button>
        </div>
        <p>
          Mesajele trimise prin interfața locală sunt marcate ca participant
          neautentificat. Rolurile client/inginer vor fi atribuite numai după
          alegerea autentificării pentru accesul LAN.
        </p>
      </form>
    </section>
  );
}
