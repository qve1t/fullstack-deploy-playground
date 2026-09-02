import { env } from "./shared/env.js";
import { WebServer } from "./shared/fastifyServer.js";

async function main() {
	const webServer = new WebServer();
	await webServer.startServer({ port: env.port, host: env.host });
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
