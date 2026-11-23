import "server-only";
import { z } from "zod";

export const contactSchema = z.object({
	name: z.string().trim().min(1).max(120),
	email: z.string().trim().email().max(320).toLowerCase(),
	message: z.string().trim().min(1).max(5000),
	// Honeypot
	nickname: z.string().max(0).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
