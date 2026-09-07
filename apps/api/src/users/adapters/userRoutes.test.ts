import assert from "node:assert/strict";
import { type TestContext, test } from "node:test";
import { WebServer } from "../../shared/fastifyServer.js";
import type { UserRepository } from "../application/userRepository.js";
import { UserService } from "../application/userService.js";
import type { User } from "../domain/user.js";
import { createUserRoutes } from "./userRoutes.js";

const user: User = {
	id: "00000000-0000-4000-8000-000000000001",
	name: "Anna",
	createdAt: new Date("2026-01-01T12:00:00.000Z"),
	updatedAt: new Date("2026-01-01T12:00:00.000Z"),
};

function setup(t: TestContext) {
	const create = t.mock.fn<UserRepository["create"]>(async (input) => ({
		...user,
		...input,
	}));

	const users: UserRepository = {
		findAll: async () => [],
		findById: async () => null,
		findByName: async () => null,
		create,
		update: async (_id, input) => ({ ...user, ...input }),
		delete: async () => {},
	};
	const webServer = new WebServer();
	t.after(() => webServer.stopServer());
	webServer.registerRoute(createUserRoutes(new UserService(users)));
	return { server: webServer.server, create };
}

test("GET /health returns the application status", async (t) => {
	const { server } = setup(t);

	const response = await server.inject({ method: "GET", url: "/health" });

	assert.equal(response.statusCode, 200);
	assert.equal(response.json().status, "ok");
	assert.ok(Number.isFinite(Date.parse(response.json().dateTime)));
});

test("POST /users creates a user", async (t) => {
	const { server, create } = setup(t);

	const response = await server.inject({
		method: "POST",
		url: "/users",
		payload: { name: "Anna" },
	});

	assert.equal(response.statusCode, 201);
	assert.deepEqual(response.json(), {
		...user,
		createdAt: user.createdAt.toISOString(),
		updatedAt: user.updatedAt.toISOString(),
	});
	assert.equal(create.mock.callCount(), 1);
	assert.deepEqual(create.mock.calls[0].arguments, [{ name: "Anna" }]);
});

test("POST /users rejects an empty name without saving", async (t) => {
	const { server, create } = setup(t);

	const response = await server.inject({
		method: "POST",
		url: "/users",
		payload: { name: "" },
	});

	assert.equal(response.statusCode, 400);
	assert.match(response.json().message, /name/);
	assert.equal(create.mock.callCount(), 0);
});

test("GET /users/:id returns 404 for a missing user", async (t) => {
	const { server } = setup(t);

	const response = await server.inject({
		method: "GET",
		url: `/users/${user.id}`,
	});

	assert.equal(response.statusCode, 404);
	assert.deepEqual(response.json(), { message: "User not found" });
});
