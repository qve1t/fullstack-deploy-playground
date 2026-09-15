import { pino } from "pino";
import { env } from "./env.js";

export function createLogger() {
	return pino({
		level: env.logLevel,
		transport: env.logPretty
			? { target: "pino-pretty", options: { translateTime: "SYS:HH:MM:ss.l" } }
			: undefined,
		base: { gitSha: env.gitSha },
	});
}
