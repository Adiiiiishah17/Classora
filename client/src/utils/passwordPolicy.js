export const passwordRules = [
  { id: "len", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "cap", label: "One capital letter (A to Z)", test: (p) => /[A-Z]/.test(p) },
  { id: "spec", label: "One special character (! @ # $ …)", test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

export function passwordProblem(p) {
  const missing = passwordRules.filter((r) => !r.test(p));
  return missing.length ? `Password needs: ${missing.map((r) => r.label.toLowerCase()).join(", ")}.` : "";
}