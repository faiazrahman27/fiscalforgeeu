import { NextResponse, type NextRequest } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData,
  readSupabaseAccessToken
} from "../../../../../../lib/api/local-proxy";

function buildAuthRequiredResponse() {
  return NextResponse.json(
    {
      error: {
        code: "WORKSPACE_AUTH_REQUIRED",
        message: "Sign in before reading a workspace ViDA simulation run.",
        details: null
      }
    },
    {
      status: 401
    }
  );
}

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const accessToken = await readSupabaseAccessToken();

  if (!accessToken) {
    return buildAuthRequiredResponse();
  }

  const { id } = await context.params;
  const simulationRunId = id.trim();

  if (!simulationRunId) {
    return NextResponse.json(
      {
        error: {
          code: "VIDA_SIMULATION_RUN_ID_REQUIRED",
          message: "ViDA simulation run ID is required.",
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
    const headers = new Headers(await buildLocalApiHeaders());

    const apiResponse = await fetch(
      `${apiBaseUrl}/api/v1/transactions/vida-simulations/${encodeURIComponent(
        simulationRunId
      )}`,
      {
        method: "GET",
        headers,
        cache: "no-store"
      }
    );

    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_VIDA_SIMULATION_DETAIL_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}