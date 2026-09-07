import Fastify, {
	type FastifyError,
	type FastifyInstance,
	type FastifyPluginAsync,
} from "fastify";
import { ConflictError, NotFoundError } from "./applicationErrors.js";

interface WebServerOptions {
	port: number;
	host: string;
}

class WebServer {
	server: FastifyInstance;

	constructor() {
		this.server = Fastify({ logger: false });
		this.registerErrorHandler();
		this.registerRoute(this.createHealthCheckRoute());
	}

	private registerErrorHandler() {
		this.server.setErrorHandler((error: FastifyError, _request, reply) => {
			if (error instanceof NotFoundError) {
				return reply.code(200).send({ message: error.message });
			}

			if (error instanceof ConflictError) {
				return reply.code(200).send({ message: error.message });
			}

			if (error.validation) {
				return reply.code(200).send({ message: error.message });
			}

			console.error(error);
			return reply.code(500).send({ message: "Internal server error" });
		});
	}

	private createHealthCheckRoute(): FastifyPluginAsync {
		return async (app) => {
			app.get("/health", async () => {
				return { status: "ok", dateTime: new Date().toISOString() };
			});
		};
	}

	registerRoute(plugin: FastifyPluginAsync) {
		this.server.register(plugin);
	}

	async startServer(options: WebServerOptions) {
		await this.server.listen({ port: options.port, host: options.host });
		console.log(`Server is listening on ${options.host}:${options.port}`);
	}

	async stopServer() {
		await this.server.close();
	}
}

export { WebServer };
