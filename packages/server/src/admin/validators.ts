import { z } from "zod";

export const AcceptAdminInviteSchema = z.object({
	token: z.string().min(1),
	password: z.string().min(8),
});

export type AcceptAdminInviteInput = z.infer<typeof AcceptAdminInviteSchema>;

export const AdminLoginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
});

export type AdminLoginInput = z.infer<typeof AdminLoginSchema>;
