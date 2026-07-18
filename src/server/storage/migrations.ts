export type Migration = {
  version: number;
  sql: string;
};

export const migrations: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        lifecycle_state TEXT NOT NULL CHECK (
          lifecycle_state IN ('active', 'completed', 'grace', 'pinned')
        ),
        current_version INTEGER NOT NULL DEFAULT 0 CHECK (current_version >= 0),
        current_revision_id TEXT,
        completed_at TEXT,
        purge_after TEXT,
        pinned_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE artifacts (
        digest TEXT PRIMARY KEY CHECK (length(digest) = 64),
        media_type TEXT NOT NULL,
        byte_length INTEGER NOT NULL CHECK (byte_length >= 0),
        display_name TEXT NOT NULL,
        storage_key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE project_revisions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
        version INTEGER NOT NULL CHECK (version > 0),
        capture_artifact_digest TEXT NOT NULL REFERENCES artifacts(digest),
        actor_kind TEXT NOT NULL CHECK (actor_kind IN ('operator', 'client', 'unverified')),
        submitted INTEGER NOT NULL CHECK (submitted IN (0, 1)),
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(project_id, version)
      ) STRICT;

      CREATE TABLE capture_events (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
        revision_id TEXT REFERENCES project_revisions(id) ON DELETE RESTRICT,
        actor_kind TEXT NOT NULL CHECK (actor_kind IN ('operator', 'client', 'unverified')),
        event_kind TEXT NOT NULL CHECK (
          event_kind IN ('draft_saved', 'submitted', 'media_added')
        ),
        artifact_digest TEXT NOT NULL REFERENCES artifacts(digest),
        provenance_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE revision_artifacts (
        revision_id TEXT NOT NULL REFERENCES project_revisions(id) ON DELETE RESTRICT,
        artifact_digest TEXT NOT NULL REFERENCES artifacts(digest),
        purpose TEXT NOT NULL CHECK (purpose IN ('capture', 'media')),
        position INTEGER NOT NULL CHECK (position >= 0),
        display_name TEXT NOT NULL,
        PRIMARY KEY(revision_id, artifact_digest, purpose)
      ) STRICT;

      CREATE TABLE plan_steps (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
        position INTEGER NOT NULL CHECK (position >= 0),
        status TEXT NOT NULL CHECK (
          status IN ('not_started', 'in_progress', 'waiting_client', 'blocked', 'verified')
        ),
        client_visible INTEGER NOT NULL CHECK (client_visible IN (0, 1)),
        client_title TEXT NOT NULL,
        client_summary TEXT NOT NULL,
        next_action TEXT,
        evidence_ref TEXT,
        verified_at TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE(project_id, position)
      ) STRICT;

      CREATE TABLE collaboration_entries (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
        revision_id TEXT REFERENCES project_revisions(id) ON DELETE RESTRICT,
        plan_step_id TEXT REFERENCES plan_steps(id) ON DELETE RESTRICT,
        actor_kind TEXT NOT NULL CHECK (actor_kind IN ('operator', 'client', 'unverified')),
        entry_kind TEXT NOT NULL CHECK (
          entry_kind IN ('question', 'answer', 'message', 'correction', 'acknowledgement')
        ),
        body_artifact_digest TEXT NOT NULL REFERENCES artifacts(digest),
        visibility TEXT NOT NULL CHECK (visibility IN ('public', 'internal')),
        attribution TEXT NOT NULL CHECK (attribution IN ('unverified-local', 'authenticated')),
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE idempotency_receipts (
        scope_id TEXT NOT NULL,
        command_name TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        request_digest TEXT NOT NULL CHECK (length(request_digest) = 64),
        response_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(scope_id, command_name, idempotency_key)
      ) STRICT;

      CREATE TABLE audit_events (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE RESTRICT,
        actor_kind TEXT NOT NULL,
        event_kind TEXT NOT NULL,
        subject_id TEXT,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX project_revisions_project_version
        ON project_revisions(project_id, version DESC);
      CREATE INDEX collaboration_public_project_time
        ON collaboration_entries(project_id, visibility, created_at);
      CREATE INDEX plan_steps_project_position
        ON plan_steps(project_id, position);
    `,
  },
];
