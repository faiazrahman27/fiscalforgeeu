import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyWebhookRequest } from "../../../proxy";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const endpointId = id.trim();

  if (!endpointId) {
    return NextResponse.json(
      {
        error: {
          code: "WEBHOOK_ENDPOINT_ID_REQUIRED",
          message: "Webhook endpoint ID is required.",
          details: null
        }
      },
      {
        status: 400
      }
    );
  }

  return proxyWebhookRequest({
    method: "POST",
    upstreamPath: `/endpoints/${encodeURIComponent(endpointId)}/rotate-secret`
  });
}
