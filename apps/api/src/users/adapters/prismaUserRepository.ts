import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { ConflictError } from "../../shared/applicationErrors.js";
import type { UserRepository } from "../application/userRepository.js";
import type { CreateUserInput, UpdateUserInput } from "../domain/user.js";

class PrismaUserRepository implements UserRepository {
	constructor(private readonly prisma: PrismaClient) {}

	findAll() {
		return this.prisma.user.findMany({ orderBy: { createdAt: "desc" } });
	}

	findById(id: string) {
		return this.prisma.user.findUnique({ where: { id } });
	}

	findByName(name: string) {
		return this.prisma.user.findUnique({ where: { name } });
	}

	async create(input: CreateUserInput) {
		try {
			return await this.prisma.user.create({ data: input });
		} catch (error) {
			this.rethrowUniqueConstraint(error);
			throw error;
		}
	}

	async update(id: string, input: UpdateUserInput) {
		try {
			return await this.prisma.user.update({ where: { id }, data: input });
		} catch (error) {
			this.rethrowUniqueConstraint(error);
			throw error;
		}
	}

	async delete(id: string) {
		await this.prisma.user.delete({ where: { id } });
	}

	private rethrowUniqueConstraint(error: unknown) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			throw new ConflictError("Email is already in use");
		}
	}
}

export { PrismaUserRepository };
