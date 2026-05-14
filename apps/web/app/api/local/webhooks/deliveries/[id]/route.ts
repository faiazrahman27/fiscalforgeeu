import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyWebhookRequest } from "../../proxy";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const deliveryId = id.trim();

  if (!deliveryId) {
    return NextResponse.json(
      {
        error: {
          code: "WEBHOOK_DELIVERY_ID_REQUIRED",
          message: "Webhook delivery ID is required.",
          details: null
        }
      },
      {
        status: 400
      }
    );
  }

  return proxyWebhookRequest({
    method: "GET",
    upstreamPath: `/deliveries/${encodeURIComponent(deliveryId)}`
  });
}
