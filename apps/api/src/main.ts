import { env } from "./shared/env.js";
import { WebServer } from "./shared/fastifyServer.js";
import { PrismaDb } from "./shared/prismaDb.js";

async function main() {
	const db = new PrismaDb();
	await db.connect();
	await db.checkConnection();

	const webServer = new WebServer();
	await webServer.startServer({ port: env.port, host: env.host });

	process.on("SIGTERM", async () => {
		await webServer.stopServer();
		await db.disconnect();
		process.exit(0);
	});

	process.on("SIGINT", async () => {
		await webServer.stopServer();
		await db.disconnect();
		process.exit(0);
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
