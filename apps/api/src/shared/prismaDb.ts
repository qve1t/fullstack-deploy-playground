import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "./env.js";

interface DbClient<TClient> {
	connect: () => Promise<unknown>;
	disconnect: () => Promise<void>;
	checkConnection: () => Promise<void>;
	getClient: () => TClient;
}

class PrismaDb implements DbClient<PrismaClient> {
	private client: PrismaClient;

	constructor() {
		const connectionString = env.databaseUrl;

		const adapter = new PrismaPg({
			connectionString,
		});

		this.client = new PrismaClient({
			adapter,
		});
	}

	async connect(): Promise<void> {
		await this.client.$connect();
	}

	async disconnect(): Promise<void> {
		await this.client.$disconnect();
	}

	async checkConnection(): Promise<void> {
		await this.client.$queryRaw`SELECT 1`;
	}

	getClient(): PrismaClient {
		return this.client;
	}
}

export { PrismaDb };
