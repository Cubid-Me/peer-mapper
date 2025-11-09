export function isValidCubidId(value: string): boolean {
  return /^cubid_[a-zA-Z0-9]{4,32}$/.test(value);
}

export async function requestCubidId(seed: string): Promise<string> {
  const normalized = seed.trim().toLowerCase();
  const sanitized = normalized.replace(/[^a-z0-9]/g, "").slice(0, 8);
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const candidate = `cubid_${(sanitized || "peer")}${randomSuffix}`.slice(0, 38);

  if (!isValidCubidId(candidate)) {
    throw new Error("Failed to derive a valid Cubid ID");
  }

  return candidate;
}
