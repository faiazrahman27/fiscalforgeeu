import { NextResponse, type NextRequest } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData
} from "../../../../../lib/api/local-proxy";

type CountryPackRouteContext = {
  params: Promise<{
    countryCode: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: CountryPackRouteContext
) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { countryCode } = await context.params;
  const { apiBaseUrl } = getLocalApiProxyConfig();

  try {
    const apiResponse = await fetch(
      `${apiBaseUrl}/api/v1/country-packs/${encodeURIComponent(countryCode)}`,
      {
        method: "GET",
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
      "LOCAL_COUNTRY_PACK_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}
