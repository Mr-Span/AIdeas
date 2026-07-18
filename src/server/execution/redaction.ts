const SECRET_ASSIGNMENT =
  /\b((?:OPENAI|CODEX|ANTHROPIC|GITHUB|GITLAB|GOOGLE)_[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD))\s*([=:])\s*([^\s,;]+)/giu;
const BEARER_TOKEN = /\b(Bearer\s+)[A-Za-z0-9._~+\/-]{8,}={0,2}/giu;
const OPENAI_STYLE_KEY = /\bsk-[A-Za-z0-9_-]{8,}\b/gu;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu;

export const REDACTION_MARKER = "[REDACTED]";

export function createRedactor(sensitiveValues: readonly string[] = []) {
  const exactValues = [...new Set(sensitiveValues.filter((value) => value.length >= 4))]
    .sort((left, right) => right.length - left.length);

  return (input: string) => {
    let output = input;
    for (const value of exactValues) {
      output = output.split(value).join(REDACTION_MARKER);
    }

    return output
      .replace(SECRET_ASSIGNMENT, `$1$2${REDACTION_MARKER}`)
      .replace(BEARER_TOKEN, `$1${REDACTION_MARKER}`)
      .replace(OPENAI_STYLE_KEY, REDACTION_MARKER)
      .replace(JWT, REDACTION_MARKER);
  };
}

export function redactAndLimit(
  input: string,
  redact: (value: string) => string,
  maxCharacters: number,
) {
  const redacted = redact(input);
  if (redacted.length <= maxCharacters) {
    return { text: redacted, truncated: false };
  }

  return {
    text: `${redacted.slice(0, maxCharacters)}\n[TRUNCATED]`,
    truncated: true,
  };
}
