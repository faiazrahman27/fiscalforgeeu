import type { NextRequest } from "next/server";
import { proxyAdminRequest } from "../proxy";

type AdminProxyRouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

async function buildUpstreamPath(context: AdminProxyRouteContext) {
  const { path = [] } = await context.params;

  return `/${path.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

export async function GET(
  request: NextRequest,
  context: AdminProxyRouteContext
) {
  return proxyAdminRequest({
    request,
    method: "GET",
    upstreamPath: await buildUpstreamPath(context)
  });
}

export async function POST(
  request: NextRequest,
  context: AdminProxyRouteContext
) {
  return proxyAdminRequest({
    request,
    method: "POST",
    upstreamPath: await buildUpstreamPath(context),
    includeBody: true
  });
}

export async function PATCH(
  request: NextRequest,
  context: AdminProxyRouteContext
) {
  return proxyAdminRequest({
    request,
    method: "PATCH",
    upstreamPath: await buildUpstreamPath(context),
    includeBody: true
  });
}

export async function DELETE(
  request: NextRequest,
  context: AdminProxyRouteContext
) {
  return proxyAdminRequest({
    request,
    method: "DELETE",
    upstreamPath: await buildUpstreamPath(context)
  });
}

