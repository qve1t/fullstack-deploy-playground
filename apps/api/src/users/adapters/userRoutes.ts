import type { FastifyPluginAsync } from "fastify";
import type { UserService } from "../application/userService.js";
import type { CreateUserInput, UpdateUserInput } from "../domain/user.js";

interface IdParams {
	id: string;
}

const idParamsSchema = {
	type: "object",
	required: ["id"],
	properties: {
		id: { type: "string", format: "uuid" },
	},
} as const;

const userBodySchema = {
	type: "object",
	additionalProperties: false,
	required: ["name"],
	properties: {
		name: { type: "string", minLength: 1, maxLength: 100 },
	},
} as const;

function createUserRoutes(userService: UserService): FastifyPluginAsync {
	return async (app) => {
		app.get("/users", () => userService.list());

		app.get<{ Params: IdParams }>(
			"/users/:id",
			{ schema: { params: idParamsSchema } },
			(request) => userService.get(request.params.id),
		);

		app.post<{ Body: CreateUserInput }>(
			"/users",
			{ schema: { body: userBodySchema } },
			async (request, reply) => {
				const user = await userService.create(request.body);
				return reply.code(201).send(user);
			},
		);

		app.put<{ Params: IdParams; Body: UpdateUserInput }>(
			"/users/:id",
			{ schema: { params: idParamsSchema, body: userBodySchema } },
			(request) => userService.update(request.params.id, request.body),
		);

		app.delete<{ Params: IdParams }>(
			"/users/:id",
			{ schema: { params: idParamsSchema } },
			async (request, reply) => {
				await userService.delete(request.params.id);
				return reply.code(204).send();
			},
		);
	};
}

export { createUserRoutes };
