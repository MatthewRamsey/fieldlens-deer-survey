import type { PublishedBook } from "@/lib/digital-buck-book";

type ReaderBuck = PublishedBook["bucks"][number];

export type AgeGroup = { label: string; bucks: ReaderBuck[] };

function ageGroupLabel(value: string) {
  const label = value.trim().replace(/\s+/g, " ");
  if (!label) return "Unclassified";
  const age = /^(\d+(?:\.\d+)?)\s*(\+)?(?:\s*(?:years?|yrs?)(?:\s*old)?)?$/i.exec(label);
  return age ? `${Number(age[1])}${age[2] ? "+" : ""} years` : label;
}

const ageNumber = (label: string) => {
  const match = /^(\d+(?:\.\d+)?)/.exec(label);
  return match ? Number(match[1]) : null;
};

export function groupBucksByAge(bucks: ReaderBuck[]): AgeGroup[] {
  const groups = new Map<string, AgeGroup>();
  for (const buck of bucks) {
    const label = ageGroupLabel(buck.ageClass);
    const key = label.toLocaleLowerCase("en-US");
    const group = groups.get(key);
    if (group) group.bucks.push(buck);
    else groups.set(key, { label, bucks: [buck] });
  }
  return [...groups.values()].sort((left, right) => {
    if (left.label === "Unclassified") return 1;
    if (right.label === "Unclassified") return -1;
    const leftAge = ageNumber(left.label);
    const rightAge = ageNumber(right.label);
    if (leftAge !== null && rightAge !== null && leftAge !== rightAge) return leftAge - rightAge;
    if (leftAge !== null && rightAge === null) return -1;
    if (leftAge === null && rightAge !== null) return 1;
    return left.label.localeCompare(right.label, "en-US", { numeric: true, sensitivity: "base" });
  });
}
