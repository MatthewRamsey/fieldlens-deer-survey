import { headers } from "next/headers";

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeOrigin(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://${value}`;

  try {
    return new URL(normalized).origin;
  } catch {
    return null;
  }
}

export async function getRequestOrigin() {
  const configuredOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);

  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (process.env.VERCEL) {
    const vercelOrigin = normalizeOrigin(
      process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL,
    );

    if (vercelOrigin) {
      return vercelOrigin;
    }
  }

  const headerStore = await headers();
  const forwardedHost = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const forwardedProto = headerStore.get("x-forwarded-proto");

  if (forwardedHost) {
    const protocol =
      forwardedProto ??
      (forwardedHost.includes("localhost") || forwardedHost.startsWith("127.0.0.1") ? "http" : "https");

    return `${protocol}://${forwardedHost}`;
  }

  const origin = headerStore.get("origin");

  if (origin) {
    return trimTrailingSlash(origin);
  }

  return "http://localhost:3000";
}
