import { z } from "zod";

export const researchRoleSchema = z.enum([
  "intent_analyst",
  "market_researcher",
  "product_validator",
  "media_strategist",
]);

export const evidenceSchema = z
  .object({
    url: z
      .string()
      .url()
      .refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
    retrievedAt: z.string().datetime(),
    boundary: z.enum(["summary", "quote"]),
    text: z.string().trim().min(1).max(1_500),
    confidence: z.enum(["low", "medium", "high"]),
  })
  .strict();

export const proposalSchema = z
  .object({
    type: z.enum([
      "finding",
      "suggestion",
      "risk",
      "media",
      "assumption",
      "experiment",
    ]),
    title: z.string().trim().min(1).max(160),
    summary: z.string().trim().min(1).max(2_000),
    rationale: z.string().trim().min(1).max(2_000),
    confidence: z.enum(["low", "medium", "high"]),
    evidence: z.array(evidenceSchema).max(12).default([]),
    decisionKey: z
      .string()
      .trim()
      .max(120)
      .nullable()
      .optional(),
    stance: z
      .string()
      .trim()
      .max(120)
      .nullable()
      .optional(),
  })
  .strict();

export const clarificationCardSchema = z
  .object({
    type: z.enum(["question", "ab_choice"]),
    prompt: z.string().trim().min(1).max(1_000),
    why: z.string().trim().min(1).max(1_000),
    options: z
      .array(z.string().trim().min(1).max(500))
      .min(2)
      .max(4)
      .nullable()
      .optional(),
    blocking: z.boolean(),
  })
  .strict()
  .superRefine((card, context) => {
    if (card.type === "ab_choice" && !card.options) {
      context.addIssue({
        code: "custom",
        message: "Un card A/B trebuie să conțină opțiuni.",
        path: ["options"],
      });
    }
  });

export const roleOutputSchema = z
  .object({
    role: researchRoleSchema,
    summary: z.string().trim().min(1).max(4_000),
    proposals: z.array(proposalSchema).max(24),
    clarifications: z.array(clarificationCardSchema).max(12),
  })
  .strict();

export const researchApprovalResponseSchema = z
  .record(
    z.string().uuid(),
    z.object({
      selectedOption: z.string().trim().max(500).optional(),
      answer: z.string().trim().max(4_000).optional(),
    }),
  )
  .refine(
    (responses) =>
      Object.values(responses).every(
        (response) => response.selectedOption || response.answer,
      ),
    "Fiecare răspuns trebuie să conțină o alegere sau o explicație.",
  );

export type ResearchRole = z.infer<typeof researchRoleSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Proposal = z.infer<typeof proposalSchema>;
export type ClarificationCard = z.infer<typeof clarificationCardSchema>;
export type RoleOutput = z.infer<typeof roleOutputSchema>;
export type ResearchApprovalResponses = z.infer<
  typeof researchApprovalResponseSchema
>;

export type ReconciledProposal = Proposal & {
  id: string;
  roles: ResearchRole[];
  duplicateCount: number;
  contradictedBy: string[];
};

export type ResearchCardDto = ClarificationCard & {
  id: string;
  roles: ResearchRole[];
};

export type ResearchRoleRunDto = {
  id: string;
  role: ResearchRole;
  status: "queued" | "running" | "completed" | "blocked" | "failed";
  providerRunId: string | null;
  errorCode: string | null;
  errorDetail: string | null;
  updatedAt: string;
};

export type ResearchRoundDto = {
  id: string;
  revisionId: string;
  status: "running" | "waiting_operator" | "approved" | "blocked" | "failed";
  roles: ResearchRoleRunDto[];
  proposals: ReconciledProposal[];
  cards: ResearchCardDto[];
  roleSummaries: Partial<Record<ResearchRole, string>>;
  approvedRevisionId: string | null;
  errorDetail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResearchRoundStateDto = {
  latestRound: ResearchRoundDto | null;
};
