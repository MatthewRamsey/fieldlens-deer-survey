import type { PublishedBook } from "@/lib/digital-buck-book";
import { buckAgeLabel, normalizeBuckAge } from "@/lib/digital-buck-age";

type ReaderBuck = PublishedBook["bucks"][number];

export type AgeGroup = { label: string; bucks: ReaderBuck[] };

export function groupBucksByAge(bucks: ReaderBuck[]): AgeGroup[] {
  const groups = new Map<string, AgeGroup>();
  for (const buck of bucks) {
    const label = buckAgeLabel(buck.ageClass);
    const key = label.toLocaleLowerCase("en-US");
    const group = groups.get(key);
    if (group) group.bucks.push(buck);
    else groups.set(key, { label, bucks: [buck] });
  }
  return [...groups.values()].sort((left, right) => {
    if (left.label === "Unclassified") return 1;
    if (right.label === "Unclassified") return -1;
    const leftAge = normalizeBuckAge(left.label);
    const rightAge = normalizeBuckAge(right.label);
    if (leftAge !== null && rightAge !== null && leftAge !== rightAge) return Number(leftAge) - Number(rightAge);
    if (leftAge !== null && rightAge === null) return -1;
    if (leftAge === null && rightAge !== null) return 1;
    return left.label.localeCompare(right.label, "en-US", { numeric: true, sensitivity: "base" });
  });
}
