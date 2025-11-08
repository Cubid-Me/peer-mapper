export function isValidCubidId(value: string): boolean {
  return /^cubid_[a-zA-Z0-9]{4,32}$/.test(value);
}
