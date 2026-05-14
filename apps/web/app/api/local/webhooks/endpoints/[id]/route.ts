import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyWebhookRequest } from "../../proxy";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function encodeEndpointId(id: string) {
  const endpointId = id.trim();

  if (!endpointId) {
    return null;
  }

  return encodeURIComponent(endpointId);
}

function buildIdRequiredResponse() {
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

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const endpointId = encodeEndpointId(id);

  if (!endpointId) {
    return buildIdRequiredResponse();
  }

  return proxyWebhookRequest({
    method: "GET",
    upstreamPath: `/endpoints/${endpointId}`
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const endpointId = encodeEndpointId(id);

  if (!endpointId) {
    return buildIdRequiredResponse();
  }

  return proxyWebhookRequest({
    request,
    method: "PATCH",
    upstreamPath: `/endpoints/${endpointId}`,
    includeBody: true
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const endpointId = encodeEndpointId(id);

  if (!endpointId) {
    return buildIdRequiredResponse();
  }

  return proxyWebhookRequest({
    method: "DELETE",
    upstreamPath: `/endpoints/${endpointId}`
  });
}
