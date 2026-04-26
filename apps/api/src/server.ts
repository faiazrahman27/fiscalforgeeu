import { env } from "./config/env.js";
import { buildApp } from "./app.js";

const app = await buildApp();

try {
  await app.listen({
    host: env.API_HOST,
    port: env.API_PORT
  });

  app.log.info(
    `Invoice Lantern API running at http://${env.API_HOST}:${env.API_PORT}`
  );
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

async function shutdown(signal: string) {
  app.log.info(`Received ${signal}. Closing API server.`);

  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

