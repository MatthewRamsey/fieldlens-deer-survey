export const buckAgeGroups = ["1", "2", "3", "4", "5"] as const;

export function normalizeBuckAge(value: string): string | null {
  const age = /^([1-5])(?:\.5)?(\+)?(?:\s*(?:years?|yrs?)(?:\s*old)?)?$/i.exec(value.trim());
  if (!age || (age[2] && age[1] !== "5")) return null;
  return age[1];
}

export function buckAgeLabel(value: string): string {
  const age = normalizeBuckAge(value);
  return age ? `${age} ${age === "1" ? "year" : "years"} old` : "Unclassified";
}
