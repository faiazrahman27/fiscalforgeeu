import { NextResponse, type NextRequest } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData
} from "../../../../../../../lib/api/local-proxy";

type LearningScenarioPreviewRouteContext = {
  params: Promise<{
    scenarioId: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: LearningScenarioPreviewRouteContext
) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { scenarioId } = await context.params;
  const { apiBaseUrl } = getLocalApiProxyConfig();

  try {
    const requestBody = await request.text();
    const headers = new Headers(await buildLocalApiHeaders());

    headers.set("content-type", "application/json");

    const apiResponse = await fetch(
      `${apiBaseUrl}/api/v1/learning/scenarios/${encodeURIComponent(scenarioId)}/preview`,
      {
        method: "POST",
        headers,
        body: requestBody.trim() ? requestBody : "{}",
        cache: "no-store"
      }
    );

    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_LEARNING_SCENARIO_PREVIEW_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}
