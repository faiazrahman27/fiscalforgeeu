import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = dirname(fileURLToPath(import.meta.url));

function compact(values) {
  return values.filter(Boolean).join(" ");
}

function getOrigin(value) {
  if (!value) {
    return "";
  }

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

const isProduction = process.env.NODE_ENV === "production";
const supabaseOrigin = getOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const appOrigin = getOrigin(process.env.NEXT_PUBLIC_APP_URL);
const scriptSrc = compact([
  "'self'",
  "'unsafe-inline'",
  isProduction ? "" : "'unsafe-eval'"
]);
const connectSrc = compact(["'self'", supabaseOrigin, appOrigin]);
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "form-action 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "upgrade-insecure-requests"
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy
  },
  {
    key: "Referrer-Policy",
    value: "no-referrer"
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin"
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin"
  },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains"
        }
      ]
    : [])
];

const noStoreHeaders = [
  {
    key: "Cache-Control",
    value: "no-store, max-age=0"
  }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: webRoot
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      },
      {
        source: "/workspace/:path*",
        headers: noStoreHeaders
      },
      {
        source: "/api/local/:path*",
        headers: noStoreHeaders
      },
      {
        source: "/auth/callback/:path*",
        headers: noStoreHeaders
      },
      {
        source: "/auth/sign-out/:path*",
        headers: noStoreHeaders
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
