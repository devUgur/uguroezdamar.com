import "server-only";
import { z } from "zod";

export const contactSchema = z.object({
	name: z.string().min(1).max(120),
	email: z.string().email().max(320),
	message: z.string().min(1).max(5000),
	// Honeypot
	nickname: z.string().max(0).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
