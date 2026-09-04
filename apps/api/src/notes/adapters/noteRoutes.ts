import type { FastifyPluginAsync } from "fastify";
import type { NoteService } from "../application/noteService.js";
import type { CreateNoteInput, UpdateNoteInput } from "../domain/note.js";

interface IdParams {
	id: string;
}

interface ListNotesQuery {
	userId?: string;
}

const idParamsSchema = {
	type: "object",
	required: ["id"],
	properties: {
		id: { type: "string", format: "uuid" },
	},
} as const;

const listNotesQuerySchema = {
	type: "object",
	additionalProperties: false,
	properties: {
		userId: { type: "string", format: "uuid" },
	},
} as const;

const noteBodySchema = {
	type: "object",
	additionalProperties: false,
	required: ["title", "userId"],
	properties: {
		title: { type: "string", minLength: 1, maxLength: 200 },
		content: { anyOf: [{ type: "string" }, { type: "null" }] },
		userId: { type: "string", format: "uuid" },
	},
} as const;

function createNoteRoutes(noteService: NoteService): FastifyPluginAsync {
	return async (app) => {
		app.get<{ Querystring: ListNotesQuery }>(
			"/notes",
			{ schema: { querystring: listNotesQuerySchema } },
			(request) => noteService.list(request.query.userId),
		);

		app.get<{ Params: IdParams }>(
			"/notes/:id",
			{ schema: { params: idParamsSchema } },
			(request) => noteService.get(request.params.id),
		);

		app.post<{ Body: CreateNoteInput }>(
			"/notes",
			{ schema: { body: noteBodySchema } },
			async (request, reply) => {
				const note = await noteService.create(request.body);
				return reply.code(201).send(note);
			},
		);

		app.put<{ Params: IdParams; Body: UpdateNoteInput }>(
			"/notes/:id",
			{ schema: { params: idParamsSchema, body: noteBodySchema } },
			(request) => noteService.update(request.params.id, request.body),
		);

		app.delete<{ Params: IdParams }>(
			"/notes/:id",
			{ schema: { params: idParamsSchema } },
			async (request, reply) => {
				await noteService.delete(request.params.id);
				return reply.code(204).send();
			},
		);
	};
}

export { createNoteRoutes };
