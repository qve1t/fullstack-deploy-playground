import { afterEach, beforeEach, expect, test, vi } from "vitest";

const fetchMock = vi.fn<typeof fetch>();
let api: typeof import("./api").api;

beforeEach(async () => {
	vi.resetModules();
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);

	api = (await import("./api")).api;
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

test("lists notes with an encoded user ID", async () => {
	fetchMock.mockResolvedValue(Response.json([]));

	await expect(api.notes.list("user & name")).resolves.toEqual([]);

	expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
		"/api/notes?userId=user%20%26%20name",
		undefined,
	);
});

test("creates a note with a trimmed title and null for blank content", async () => {
	const note = {
		id: "note-1",
		userId: "user-1",
		title: "Learn CI",
		content: null,
		createdAt: "2026-01-01T12:00:00.000Z",
		updatedAt: "2026-01-01T12:00:00.000Z",
	};
	fetchMock.mockResolvedValue(Response.json(note, { status: 201 }));

	await expect(
		api.notes.create("user-1", "  Learn CI  ", "   "),
	).resolves.toEqual(note);

	expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/notes", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			userId: "user-1",
			title: "Learn CI",
			content: null,
		}),
	});
});

test("uses the API error message when a request fails", async () => {
	fetchMock.mockResolvedValue(
		Response.json({ message: "Name is already in use" }, { status: 409 }),
	);

	await expect(api.users.create("Anna")).rejects.toThrow(
		"Name is already in use",
	);
});

test("deletes a note when the response has no content", async () => {
	fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

	await expect(api.notes.delete("note-1")).resolves.toBeUndefined();

	expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/notes/note-1", {
		method: "DELETE",
	});
});
