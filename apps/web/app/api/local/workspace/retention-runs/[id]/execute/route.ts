import { NextResponse } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData
} from "../../../../../../../lib/api/local-proxy";

type ExecuteRetentionRunRouteContext = {
  params: Promise<{
    id?: string;
  }>;
};

export async function POST(
  _request: Request,
  context: ExecuteRetentionRunRouteContext
) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { id } = await context.params;
  const retentionRunId = id?.trim() ?? "";

  if (!retentionRunId) {
    return NextResponse.json(
      {
        error: {
          code: "RETENTION_RUN_ID_REQUIRED",
          message: "Retention run ID is required.",
          details: null
        }
      },
      {
        status: 400
      }
    );
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();

  try {
    const apiResponse = await fetch(
      `${apiBaseUrl}/api/v1/workspace/retention-runs/${encodeURIComponent(
        retentionRunId
      )}/execute`,
      {
        method: "POST",
        headers: await buildLocalApiHeaders(),
        cache: "no-store"
      }
    );

    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_WORKSPACE_RETENTION_RUN_EXECUTE_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}
