import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { env, isProductionEnvironment } from "../config/env.js";

export type ResolvedWebhookAddress = {
  address: string;
  family: 4 | 6;
};

export type WebhookDnsResolver = (
  hostname: string
) => Promise<ResolvedWebhookAddress[]>;

export type SafeWebhookUrl = {
  url: URL;
  normalizedUrl: string;
  resolvedAddresses: ResolvedWebhookAddress[];
};

export class WebhookUrlSafetyError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(input: { code: string; message: string; statusCode?: number }) {
    super(input.message);
    this.name = "WebhookUrlSafetyError";
    this.code = input.code;
    this.statusCode = input.statusCode ?? 400;
  }
}

export async function validateWebhookDeliveryUrl(
  rawUrl: string,
  input: {
    resolver?: WebhookDnsResolver;
    allowLocalhost?: boolean;
  } = {}
): Promise<SafeWebhookUrl> {
  const parsedUrl = parseWebhookUrl(rawUrl);
  const allowLocalhost =
    input.allowLocalhost ??
    (env.WEBHOOK_ALLOW_LOCALHOST_DELIVERY && !isProductionEnvironment());

  if (parsedUrl.username || parsedUrl.password) {
    throw new WebhookUrlSafetyError({
      code: "WEBHOOK_URL_CREDENTIALS_BLOCKED",
      message: "Webhook endpoint URLs must not include embedded credentials."
    });
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new WebhookUrlSafetyError({
      code: "WEBHOOK_URL_SCHEME_BLOCKED",
      message: "Webhook endpoint URLs must use HTTPS."
    });
  }

  const hostname = normalizeHostname(parsedUrl.hostname);
  const isLocalhost = isLocalhostHostname(hostname);

  if (parsedUrl.protocol === "http:" && !(allowLocalhost && isLocalhost)) {
    throw new WebhookUrlSafetyError({
      code: "WEBHOOK_URL_HTTPS_REQUIRED",
      message:
        "Webhook endpoint URLs must use HTTPS unless localhost delivery is explicitly enabled for local development."
    });
  }

  if (isLocalhost) {
    if (!allowLocalhost) {
      throw new WebhookUrlSafetyError({
        code: "WEBHOOK_URL_PRIVATE_ADDRESS_BLOCKED",
        message:
          "Webhook endpoint URLs must not resolve to localhost or private/internal addresses."
      });
    }

    return {
      url: parsedUrl,
      normalizedUrl: parsedUrl.toString(),
      resolvedAddresses: []
    };
  }

  const resolvedAddresses = await resolveWebhookHostname(
    hostname,
    input.resolver
  );

  for (const resolvedAddress of resolvedAddresses) {
    if (isBlockedAddress(resolvedAddress.address, allowLocalhost)) {
      throw new WebhookUrlSafetyError({
        code: "WEBHOOK_URL_PRIVATE_ADDRESS_BLOCKED",
        message:
          "Webhook endpoint URLs must not resolve to private, local, link-local, metadata, multicast, or reserved addresses."
      });
    }
  }

  return {
    url: parsedUrl,
    normalizedUrl: parsedUrl.toString(),
    resolvedAddresses
  };
}

export function isBlockedAddress(address: string, allowLocalhost = false) {
  const normalizedAddress = normalizeHostname(address);
  const version = isIP(normalizedAddress);

  if (version === 4) {
    return isBlockedIpv4(normalizedAddress, allowLocalhost);
  }

  if (version === 6) {
    return isBlockedIpv6(normalizedAddress, allowLocalhost);
  }

  return true;
}

async function resolveWebhookHostname(
  hostname: string,
  resolver?: WebhookDnsResolver
) {
  if (resolver) {
    return resolver(hostname);
  }

  const resolved = await lookup(hostname, {
    all: true,
    verbatim: false
  });

  return resolved.map((item) => ({
    address: item.address,
    family: item.family as 4 | 6
  }));
}

function parseWebhookUrl(rawUrl: string) {
  try {
    return new URL(rawUrl);
  } catch {
    throw new WebhookUrlSafetyError({
      code: "WEBHOOK_URL_INVALID",
      message: "Webhook endpoint URL must be a valid HTTP or HTTPS URL."
    });
  }
}

function normalizeHostname(hostname: string) {
  return hostname.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
}

function isLocalhostHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isBlockedIpv4(address: string, allowLocalhost: boolean) {
  const value = ipv4ToNumber(address);
  const first = value >>> 24;
  const second = (value >>> 16) & 255;
  const third = (value >>> 8) & 255;

  if (allowLocalhost && first === 127) {
    return false;
  }

  if (first === 0 || first === 10 || first === 127) {
    return true;
  }

  if (first === 100 && second >= 64 && second <= 127) {
    return true;
  }

  if (first === 169 && second === 254) {
    return true;
  }

  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }

  if (first === 192 && second === 168) {
    return true;
  }

  if (first === 192 && second === 0) {
    return true;
  }

  if (first === 192 && second === 88 && third === 99) {
    return true;
  }

  if (first === 198 && (second === 18 || second === 19)) {
    return true;
  }

  if (first === 198 && second === 51 && third === 100) {
    return true;
  }

  if (first === 203 && second === 0 && third === 113) {
    return true;
  }

  if (first >= 224) {
    return true;
  }

  return false;
}

function isBlockedIpv6(address: string, allowLocalhost: boolean) {
  if (address.startsWith("::ffff:")) {
    return isBlockedIpv4(address.replace("::ffff:", ""), allowLocalhost);
  }

  if (allowLocalhost && address === "::1") {
    return false;
  }

  return (
    address === "::" ||
    address === "::1" ||
    address.startsWith("fc") ||
    address.startsWith("fd") ||
    address.startsWith("2001:db8") ||
    address.startsWith("fe80:") ||
    address.startsWith("ff")
  );
}

function ipv4ToNumber(address: string) {
  return address
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .reduce((value, part) => (value << 8) + part, 0) >>> 0;
}
