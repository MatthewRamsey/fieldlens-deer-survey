export function buckDisplayName(name: string, nickname?: string | null) {
  const label = nickname?.trim();
  return label ? `${name} (${label})` : name;
}
