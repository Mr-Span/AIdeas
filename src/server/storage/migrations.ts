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
  {
    version: 2,
    sql: `
      CREATE TABLE execution_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
        revision_id TEXT NOT NULL REFERENCES project_revisions(id) ON DELETE RESTRICT,
        provider_kind TEXT NOT NULL CHECK (provider_kind IN ('codex_sdk', 'codex_cli')),
        purpose TEXT NOT NULL CHECK (purpose IN ('research')),
        workspace_path TEXT NOT NULL,
        prompt_artifact_digest TEXT NOT NULL REFERENCES artifacts(digest),
        status TEXT NOT NULL CHECK (
          status IN (
            'starting',
            'running',
            'cancelling',
            'resume_available',
            'blocked',
            'cancelled',
            'timed_out',
            'completed',
            'failed'
          )
        ),
        provider_run_id TEXT,
        output_artifact_digest TEXT REFERENCES artifacts(digest),
        error_code TEXT,
        error_detail TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        last_event_at TEXT NOT NULL,
        completed_at TEXT,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE execution_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE RESTRICT,
        sequence INTEGER NOT NULL CHECK (sequence > 0),
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(run_id, sequence)
      ) STRICT;

      CREATE TABLE execution_provider_threads (
        provider_run_id TEXT PRIMARY KEY,
        provider_kind TEXT NOT NULL CHECK (provider_kind IN ('codex_sdk', 'codex_cli')),
        run_id TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE RESTRICT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE execution_terminal_receipts (
        run_id TEXT PRIMARY KEY REFERENCES execution_runs(id) ON DELETE RESTRICT,
        terminal_type TEXT NOT NULL CHECK (terminal_type IN ('completed', 'failed', 'blocked', 'resume_available')),
        payload_json TEXT NOT NULL,
        result_digest TEXT,
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX execution_runs_project_updated
        ON execution_runs(project_id, updated_at DESC);
      CREATE INDEX execution_runs_status_updated
        ON execution_runs(status, updated_at DESC);
      CREATE INDEX execution_events_run_sequence
        ON execution_events(run_id, sequence);
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE execution_runs
        ADD COLUMN provider_pid INTEGER
        CHECK (provider_pid IS NULL OR provider_pid > 0);
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE research_rounds (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
        revision_id TEXT NOT NULL REFERENCES project_revisions(id) ON DELETE RESTRICT,
        status TEXT NOT NULL CHECK (
          status IN ('running', 'waiting_operator', 'approved', 'blocked', 'failed')
        ),
        result_json TEXT,
        responses_json TEXT,
        approved_revision_id TEXT REFERENCES project_revisions(id) ON DELETE RESTRICT,
        error_detail TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE research_role_runs (
        id TEXT PRIMARY KEY,
        round_id TEXT NOT NULL REFERENCES research_rounds(id) ON DELETE RESTRICT,
        role TEXT NOT NULL CHECK (
          role IN ('intent_analyst', 'market_researcher', 'product_validator', 'media_strategist')
        ),
        provider_kind TEXT NOT NULL CHECK (provider_kind IN ('codex_sdk', 'codex_cli')),
        provider_run_id TEXT,
        workspace_path TEXT,
        status TEXT NOT NULL CHECK (
          status IN ('queued', 'running', 'completed', 'blocked', 'failed')
        ),
        output_artifact_digest TEXT REFERENCES artifacts(digest),
        error_code TEXT,
        error_detail TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE(round_id, role)
      ) STRICT;

      CREATE INDEX research_rounds_project_updated
        ON research_rounds(project_id, updated_at DESC);
      CREATE INDEX research_role_runs_round_role
        ON research_role_runs(round_id, role);
    `,
  },
  {
    version: 5,
    sql: `
      ALTER TABLE research_rounds ADD COLUMN round_digest TEXT;
      ALTER TABLE research_rounds ADD COLUMN source_round_id TEXT REFERENCES research_rounds(id) ON DELETE RESTRICT;
      ALTER TABLE research_role_runs ADD COLUMN input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0);
      ALTER TABLE research_role_runs ADD COLUMN output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0);
      ALTER TABLE research_role_runs ADD COLUMN reasoning_tokens INTEGER NOT NULL DEFAULT 0 CHECK (reasoning_tokens >= 0);
      ALTER TABLE research_role_runs ADD COLUMN billable INTEGER NOT NULL DEFAULT 1 CHECK (billable IN (0, 1));

      CREATE TABLE implementation_plans (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
        revision_id TEXT NOT NULL REFERENCES project_revisions(id) ON DELETE RESTRICT,
        research_round_id TEXT NOT NULL REFERENCES research_rounds(id) ON DELETE RESTRICT,
        status TEXT NOT NULL CHECK (
          status IN ('generating', 'waiting_operator', 'blocked', 'failed', 'approved', 'superseded')
        ),
        provider_kind TEXT NOT NULL CHECK (provider_kind IN ('codex_sdk', 'codex_cli')),
        provider_run_id TEXT,
        workspace_path TEXT,
        plan_json TEXT,
        validation_json TEXT NOT NULL DEFAULT '[]',
        plan_digest TEXT CHECK (plan_digest IS NULL OR length(plan_digest) = 64),
        base_commit TEXT NOT NULL,
        policy_version TEXT NOT NULL,
        error_detail TEXT,
        approved_at TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE plan_approvals (
        plan_id TEXT PRIMARY KEY REFERENCES implementation_plans(id) ON DELETE RESTRICT,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
        revision_id TEXT NOT NULL REFERENCES project_revisions(id) ON DELETE RESTRICT,
        plan_digest TEXT NOT NULL CHECK (length(plan_digest) = 64),
        policy_version TEXT NOT NULL,
        actor_kind TEXT NOT NULL CHECK (actor_kind = 'operator'),
        approved_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE work_items (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES implementation_plans(id) ON DELETE RESTRICT,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
        canonical_key TEXT NOT NULL,
        title TEXT NOT NULL,
        packet_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (
          status IN ('blocked', 'queued', 'ready', 'running', 'verifying', 'verified', 'integrated', 'failed')
        ),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(plan_id, canonical_key)
      ) STRICT;

      CREATE TABLE work_item_dependencies (
        work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE RESTRICT,
        dependency_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE RESTRICT,
        PRIMARY KEY(work_item_id, dependency_id),
        CHECK (work_item_id <> dependency_id)
      ) STRICT;

      CREATE TABLE context_packets (
        id TEXT PRIMARY KEY,
        work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE RESTRICT,
        plan_id TEXT NOT NULL REFERENCES implementation_plans(id) ON DELETE RESTRICT,
        revision_id TEXT NOT NULL REFERENCES project_revisions(id) ON DELETE RESTRICT,
        base_commit TEXT NOT NULL,
        packet_digest TEXT NOT NULL CHECK (length(packet_digest) = 64),
        packet_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(work_item_id, packet_digest)
      ) STRICT;

      CREATE TABLE work_attempts (
        id TEXT PRIMARY KEY,
        work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE RESTRICT,
        attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
        status TEXT NOT NULL CHECK (
          status IN ('running', 'verifying', 'verified', 'failed', 'blocked', 'expired')
        ),
        lease_token TEXT NOT NULL,
        lease_expires_at TEXT NOT NULL,
        context_packet_id TEXT NOT NULL REFERENCES context_packets(id) ON DELETE RESTRICT,
        workspace_path TEXT,
        provider_run_id TEXT,
        verifier_run_id TEXT,
        evidence_id TEXT,
        error_detail TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE(work_item_id, attempt_number)
      ) STRICT;

      CREATE TABLE evidence_bundles (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
        work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE RESTRICT,
        plan_id TEXT NOT NULL REFERENCES implementation_plans(id) ON DELETE RESTRICT,
        revision_id TEXT NOT NULL REFERENCES project_revisions(id) ON DELETE RESTRICT,
        plan_digest TEXT NOT NULL CHECK (length(plan_digest) = 64),
        policy_version TEXT NOT NULL,
        base_commit TEXT NOT NULL,
        current_base_commit TEXT NOT NULL,
        diff_digest TEXT NOT NULL CHECK (length(diff_digest) = 64),
        commit_digest TEXT,
        bundle_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE action_approvals (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
        action_kind TEXT NOT NULL CHECK (
          action_kind IN ('commit', 'push', 'pull_request', 'merge', 'payment', 'publication', 'deploy')
        ),
        action_digest TEXT NOT NULL CHECK (length(action_digest) = 64),
        policy_version TEXT NOT NULL,
        target TEXT NOT NULL,
        actor_kind TEXT NOT NULL CHECK (actor_kind = 'operator'),
        approved_at TEXT NOT NULL,
        UNIQUE(project_id, action_kind, action_digest, policy_version)
      ) STRICT;

      CREATE TABLE integration_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
        work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE RESTRICT,
        evidence_id TEXT NOT NULL REFERENCES evidence_bundles(id) ON DELETE RESTRICT,
        status TEXT NOT NULL CHECK (
          status IN ('running', 'waiting_approval', 'integrated', 'failed')
        ),
        branch_name TEXT NOT NULL,
        repository_name TEXT,
        base_branch TEXT,
        pull_request_url TEXT,
        merge_commit TEXT,
        pending_action_kind TEXT,
        pending_action_target TEXT,
        error_detail TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX implementation_plans_project_updated
        ON implementation_plans(project_id, updated_at DESC);
      CREATE INDEX work_items_plan_status
        ON work_items(plan_id, status, canonical_key);
      CREATE INDEX evidence_work_item_created
        ON evidence_bundles(work_item_id, created_at DESC);
      CREATE INDEX work_attempts_item_number
        ON work_attempts(work_item_id, attempt_number DESC);
      CREATE INDEX integration_runs_item_updated
        ON integration_runs(work_item_id, updated_at DESC);
    `,
  },
];
