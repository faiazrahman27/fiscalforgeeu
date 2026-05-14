import type { NextRequest } from "next/server";
import { proxyWebhookRequest } from "../proxy";

export async function GET(request: NextRequest) {
  return proxyWebhookRequest({
    request,
    method: "GET",
    upstreamPath: "/deliveries"
  });
}
