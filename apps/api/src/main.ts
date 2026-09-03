import { createNoteRoutes } from "./notes/adapters/noteRoutes.js";
import { PrismaNoteRepository } from "./notes/adapters/prismaNoteRepository.js";
import { NoteService } from "./notes/application/noteService.js";
import { env, envCheck } from "./shared/env.js";
import { WebServer } from "./shared/fastifyServer.js";
import { PrismaDb } from "./shared/prismaDb.js";
import { PrismaUserRepository } from "./users/adapters/prismaUserRepository.js";
import { createUserRoutes } from "./users/adapters/userRoutes.js";
import { UserService } from "./users/application/userService.js";

async function main() {
	envCheck();

	const db = new PrismaDb();
	await db.connect();
	await db.checkConnection();
	console.log("Database connected successfully");

	const userRepository = new PrismaUserRepository(db.getClient());
	const noteRepository = new PrismaNoteRepository(db.getClient());
	const userService = new UserService(userRepository);
	const noteService = new NoteService(noteRepository, userRepository);

	const webServer = new WebServer();
	webServer.registerRoute(createUserRoutes(userService));
	webServer.registerRoute(createNoteRoutes(noteService));
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
