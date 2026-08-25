import { headers } from "next/headers";

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export async function getRequestOrigin() {
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

  return trimTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
}
