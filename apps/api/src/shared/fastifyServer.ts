import Fastify, {
	type FastifyError,
	type FastifyInstance,
	type FastifyPluginAsync,
	type FastifyServerOptions,
} from "fastify";
import { ConflictError, NotFoundError } from "./applicationErrors.js";
import { env } from "./env.js";

interface WebServerOptions {
	port: number;
	host: string;
}

class WebServer {
	server: FastifyInstance;
	checkDbConnection: () => Promise<void>;

	constructor(
		checkDB: () => Promise<void>,
		logger?: FastifyServerOptions["loggerInstance"],
	) {
		this.checkDbConnection = checkDB;
		this.server = Fastify(
			logger ? { loggerInstance: logger } : { logger: false },
		);
		this.registerErrorHandler();
		this.registerRoute(this.createHealthCheckRoute());
		this.registerRoute(this.createReadyCheckRoute());
	}

	private registerErrorHandler() {
		this.server.setErrorHandler((error: FastifyError, request, reply) => {
			if (error instanceof NotFoundError) {
				return reply.code(404).send({ message: error.message });
			}

			if (error instanceof ConflictError) {
				return reply.code(409).send({ message: error.message });
			}

			if (error.validation) {
				return reply.code(400).send({ message: error.message });
			}

			request.log.error({ err: error }, "Unhandled error");
			return reply.code(500).send({ message: "Internal server error" });
		});
	}

	private createHealthCheckRoute(): FastifyPluginAsync {
		return async (app) => {
			app.get("/health/live", { logLevel: "warn" }, async () => {
				return {
					status: "ok",
					dateTime: new Date().toISOString(),
					gitSha: env.gitSha,
				};
			});
		};
	}

	private createReadyCheckRoute(): FastifyPluginAsync {
		return async (app) => {
			app.get("/health/ready", { logLevel: "warn" }, async (request, reply) => {
				try {
					await this.checkDbConnection();
					return {
						status: "ok",
						dateTime: new Date().toISOString(),
						dbConnection: "true",
					};
				} catch (error) {
					request.log.warn({ err: error }, "Readiness check failed");
					return reply.code(503).send({
						status: "error",
						dateTime: new Date().toISOString(),
						dbConnection: "false",
					});
				}
			});
		};
	}

	registerRoute(plugin: FastifyPluginAsync) {
		this.server.register(plugin);
	}

	async startServer(options: WebServerOptions) {
		await this.server.listen({ port: options.port, host: options.host });
		this.server.log.info(
			{ host: options.host, port: options.port },
			"Server is listening",
		);
	}

	async stopServer() {
		await this.server.close();
	}
}

export { WebServer };
