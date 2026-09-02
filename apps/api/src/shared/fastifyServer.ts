import Fastify, {
	type FastifyInstance,
	type FastifyPluginAsync,
} from "fastify";

interface WebServerOptions {
	port: number;
	host: string;
}

class WebServer {
	server: FastifyInstance;

	constructor() {
		this.server = Fastify({ logger: false });
		this.registerRoute(this.createHealthCheckRoute());
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
