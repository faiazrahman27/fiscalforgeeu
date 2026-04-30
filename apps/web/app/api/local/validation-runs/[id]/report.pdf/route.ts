import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig
} from "../../../../../../lib/api/local-proxy";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function copyHeader(source: Headers, target: Headers, name: string) {
  const value = source.get(name);

  if (value) {
    target.set(name, value);
  }
}

export async function GET(_request: Request, context: RouteContext) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();
  const { id } = await context.params;

  try {
    const apiResponse = await fetch(
      `${apiBaseUrl}/api/v1/validation-runs/${encodeURIComponent(id)}/report.pdf`,
      {
        method: "GET",
        headers: await buildLocalApiHeaders(),
        cache: "no-store"
      }
    );
    const responseBody = await apiResponse.arrayBuffer();
    const headers = new Headers();

    copyHeader(apiResponse.headers, headers, "content-type");
    copyHeader(apiResponse.headers, headers, "content-disposition");
    copyHeader(apiResponse.headers, headers, "content-length");

    return new Response(responseBody, {
      status: apiResponse.status,
      headers
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_VALIDATION_REPORT_PDF_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}
