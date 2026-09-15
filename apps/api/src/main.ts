import { createNoteRoutes } from "./notes/adapters/noteRoutes.js";
import { PrismaNoteRepository } from "./notes/adapters/prismaNoteRepository.js";
import { NoteService } from "./notes/application/noteService.js";
import { env, envCheck } from "./shared/env.js";
import { WebServer } from "./shared/fastifyServer.js";
import { createLogger } from "./shared/logger.js";
import { PrismaDb } from "./shared/prismaDb.js";
import { PrismaUserRepository } from "./users/adapters/prismaUserRepository.js";
import { createUserRoutes } from "./users/adapters/userRoutes.js";
import { UserService } from "./users/application/userService.js";

const logger = createLogger();

async function main() {
	envCheck();

	let shuttingDown = false;

	const db = new PrismaDb();
	await db.connect();
	await db.checkConnection();
	logger.info("Database connected successfully");

	const userRepository = new PrismaUserRepository(db.getClient());
	const noteRepository = new PrismaNoteRepository(db.getClient());
	const userService = new UserService(userRepository);
	const noteService = new NoteService(noteRepository, userRepository);

	const webServer = new WebServer(() => db.checkConnection(), logger);
	webServer.registerRoute(createUserRoutes(userService));
	webServer.registerRoute(createNoteRoutes(noteService));
	await webServer.startServer({ port: env.port, host: env.host });

	async function shutdown(signal: NodeJS.Signals): Promise<void> {
		if (shuttingDown) {
			return;
		}

		shuttingDown = true;

		logger.info({ signal }, "Shutting down application");

		const forceExitTimer = setTimeout(() => {
			logger.error("Timed out while shutting down");
			process.exit(1);
		}, 5000);

		try {
			await webServer.stopServer();
			await db.disconnect();
		} catch (error) {
			logger.error({ err: error }, "Failed to shut down application");
			process.exitCode = 1;
		} finally {
			clearTimeout(forceExitTimer);
		}
	}

	process.once("SIGTERM", shutdown);

	process.once("SIGINT", shutdown);
}

main().catch((err) => {
	logger.fatal({ err }, "Application failed to start");
	process.exit(1);
});
