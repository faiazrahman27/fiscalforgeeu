import type { FastifyReply } from "fastify";

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor({
    statusCode,
    code,
    message,
    details
  }: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  }) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function sendHttpError(reply: FastifyReply, error: HttpError) {
  return reply.status(error.statusCode).send({
    error: {
      code: error.code,
      message: error.message,
      details: error.details ?? null
    }
  });
}

