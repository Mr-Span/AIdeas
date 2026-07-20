import type {
  ImplementationPlan,
  PlanValidationIssue,
} from "./contracts";

function issue(
  code: string,
  path: string,
  message: string,
  severity: "error" | "warning" = "error",
): PlanValidationIssue {
  return { code, path, message, severity };
}

function duplicates(values: readonly string[]) {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return duplicate;
}

function normalizedScope(scope: string) {
  return scope.trim().replaceAll("\\", "/").replace(/\/$/u, "").toLowerCase();
}

function scopesOverlap(left: string, right: string) {
  const a = normalizedScope(left);
  const b = normalizedScope(right);
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

export function validateImplementationPlan(plan: ImplementationPlan) {
  const issues: PlanValidationIssue[] = [];
  const groups = [
    ["requirements", plan.requirements.map((entry) => entry.id)],
    ["acceptanceCriteria", plan.acceptanceCriteria.map((entry) => entry.id)],
    ["components", plan.components.map((entry) => entry.id)],
    ["risks", plan.risks.map((entry) => entry.id)],
    ["blockers", plan.blockers.map((entry) => entry.id)],
    ["tasks", plan.tasks.map((entry) => entry.id)],
  ] as const;
  for (const [path, ids] of groups) {
    for (const id of duplicates(ids)) {
      issues.push(issue("duplicate_id", path, `Identificator duplicat: ${id}.`));
    }
  }

  const requirements = new Set(plan.requirements.map((entry) => entry.id));
  const acceptance = new Set(plan.acceptanceCriteria.map((entry) => entry.id));
  const components = new Set(plan.components.map((entry) => entry.id));
  const risks = new Set(plan.risks.map((entry) => entry.id));
  const tasks = new Set(plan.tasks.map((entry) => entry.id));

  plan.acceptanceCriteria.forEach((criterion, index) => {
    for (const id of criterion.requirementIds) {
      if (!requirements.has(id)) {
        issues.push(issue("missing_requirement", `acceptanceCriteria.${index}`, `${criterion.id} referă ${id}, care nu există.`));
      }
    }
  });
  plan.architectureEdges.forEach((edge, index) => {
    if (!components.has(edge.from) || !components.has(edge.to)) {
      issues.push(issue("missing_component", `architectureEdges.${index}`, `Muchia ${edge.from} → ${edge.to} referă o componentă inexistentă.`));
    }
  });
  plan.tasks.forEach((task, index) => {
    const refs: Array<[readonly string[], Set<string>, string]> = [
      [task.requirementIds, requirements, "requirement"],
      [task.acceptanceIds, acceptance, "acceptance"],
      [task.componentIds, components, "component"],
      [task.riskIds, risks, "risk"],
      [task.dependsOn, tasks, "dependency"],
    ];
    for (const [ids, target, kind] of refs) {
      for (const id of ids) {
        if (!target.has(id)) issues.push(issue(`missing_${kind}`, `tasks.${index}`, `${task.id} referă ${id}, care nu există.`));
      }
    }
    if (task.dependsOn.includes(task.id)) {
      issues.push(issue("self_dependency", `tasks.${index}.dependsOn`, `${task.id} depinde de sine.`));
    }
    if (!task.verificationCommands.includes("test")) {
      issues.push(issue("missing_test_gate", `tasks.${index}.verificationCommands`, `${task.id} nu cere rularea testelor.`));
    }
    for (const required of ["checks", "independent_review", "secret_scan"] as const) {
      if (!task.evidenceRequired.includes(required)) {
        issues.push(issue("missing_evidence_gate", `tasks.${index}.evidenceRequired`, `${task.id} nu cere evidence ${required}.`));
      }
    }
  });
  plan.blockers.forEach((blocker, index) => {
    for (const taskId of blocker.blockingTaskIds) {
      if (!tasks.has(taskId)) issues.push(issue("missing_blocked_task", `blockers.${index}`, `${blocker.id} blochează ${taskId}, care nu există.`));
    }
  });

  for (const requirement of plan.requirements) {
    const coveredByAcceptance = plan.acceptanceCriteria.some((entry) => entry.requirementIds.includes(requirement.id));
    const coveredByTask = plan.tasks.some((entry) => entry.requirementIds.includes(requirement.id));
    if (!coveredByAcceptance || !coveredByTask) {
      issues.push(issue("requirement_not_covered", `requirements.${requirement.id}`, `${requirement.id} nu este acoperită complet de acceptanță și task.`));
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const dependencies = new Map(plan.tasks.map((task) => [task.id, task.dependsOn]));
  const visit = (taskId: string, trail: string[]): void => {
    if (visiting.has(taskId)) {
      issues.push(issue("dependency_cycle", "tasks", `Ciclu DAG: ${[...trail, taskId].join(" → ")}.`));
      return;
    }
    if (visited.has(taskId)) return;
    visiting.add(taskId);
    for (const dependency of dependencies.get(taskId) ?? []) {
      if (tasks.has(dependency)) visit(dependency, [...trail, taskId]);
    }
    visiting.delete(taskId);
    visited.add(taskId);
  };
  for (const task of plan.tasks) visit(task.id, []);

  for (let left = 0; left < plan.tasks.length; left += 1) {
    for (let right = left + 1; right < plan.tasks.length; right += 1) {
      const a = plan.tasks[left];
      const b = plan.tasks[right];
      const overlap = a.fileScopes.some((aScope) => b.fileScopes.some((bScope) => scopesOverlap(aScope, bScope)));
      if (overlap && (!a.sharedOwnershipRationale || !b.sharedOwnershipRationale)) {
        issues.push(issue("ownership_overlap", `tasks.${a.id},tasks.${b.id}`, `${a.id} și ${b.id} au scope-uri suprapuse fără justificare bilaterală.`));
      }
    }
  }

  const assignedClientTasks = plan.clientSteps.flatMap((step) => step.taskIds);
  for (const taskId of assignedClientTasks) {
    if (!tasks.has(taskId)) issues.push(issue("missing_client_task", "clientSteps", `Proiecția client referă ${taskId}, care nu există.`));
  }
  for (const taskId of duplicates(assignedClientTasks)) {
    issues.push(issue("duplicate_client_task", "clientSteps", `${taskId} apare în mai mulți pași client.`, "warning"));
  }

  return issues;
}

export function hasPlanErrors(issues: readonly PlanValidationIssue[]) {
  return issues.some((entry) => entry.severity === "error");
}
