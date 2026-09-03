export function envCheck() {
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not defined");
	}
}

export const env = {
	port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
	host: process.env.HOST ?? "127.0.0.1",
	databaseUrl: process.env.DATABASE_URL,
};
