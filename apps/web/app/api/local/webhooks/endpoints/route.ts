import type { NextRequest } from "next/server";
import { proxyWebhookRequest } from "../proxy";

export async function GET(request: NextRequest) {
  return proxyWebhookRequest({
    request,
    method: "GET",
    upstreamPath: "/endpoints"
  });
}

export async function POST(request: NextRequest) {
  return proxyWebhookRequest({
    request,
    method: "POST",
    upstreamPath: "/endpoints",
    includeBody: true
  });
}
