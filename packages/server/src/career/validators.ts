import "server-only";
import { z } from "zod";

export const CareerEntryTypeSchema = z.enum([
  "work",
  "education",
  "project",
  "certificate",
  "award",
  "speaking",
  "publication",
]);

export const CareerDateRangeSchema = z.object({
  start: z.string().datetime(), // ISO date (YYYY-MM-DD)
  end: z.string().datetime().optional().nullable(),
  isCurrent: z.boolean().default(false),
});

export const CareerLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
});

export const CareerEntryVisibilitySchema = z.object({
  about: z.boolean().default(false),
  education: z.boolean().default(false),
  career: z.boolean().default(true),
});

export const CreateCareerEntrySchema = z.object({
  type: CareerEntryTypeSchema,
  slug: z.string().min(1),
  title: z.string().min(1),
  organization: z.string().optional().nullable(), // company / school / issuer
  location: z.string().optional().nullable(),
  date: CareerDateRangeSchema,
  summary: z.string().optional().nullable(),
  highlights: z.array(z.string().min(1)).optional().default([]),
  tags: z.array(z.string().min(1)).optional().default([]),
  links: z.array(CareerLinkSchema).optional().default([]),
  isFeatured: z.boolean().default(false),
  sortKey: z.number().int().optional().default(0),
  visibility: CareerEntryVisibilitySchema.optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  // Specific fields for types (could be further refined in unions)
  role: z.string().optional().nullable(), // For "work"
  degree: z.string().optional().nullable(), // For "education"
  field: z.string().optional().nullable(), // For "education"
  issuer: z.string().optional().nullable(), // For "certificate"
});

export const UpdateCareerEntrySchema = CreateCareerEntrySchema.partial();

export type CareerEntryType = z.infer<typeof CareerEntryTypeSchema>;
export type CareerEntryInput = z.infer<typeof CreateCareerEntrySchema>;
export type UpdateCareerEntryInput = z.infer<typeof UpdateCareerEntrySchema>;
export type CareerEntry = CareerEntryInput & {
  _id: string;
  createdAt: string;
  updatedAt: string;
};
