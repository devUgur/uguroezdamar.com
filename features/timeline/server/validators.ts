import { z } from "zod";

export const TimelineVisibilitySchema = z.object({
  about: z.boolean().default(false),
  education: z.boolean().default(false),
});

export const CreateTimelineItemSchema = z.object({
  type: z.enum(["work", "education", "experience"]),
  title: z.string().min(1),
  organization: z.string().min(1),
  location: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  isCurrent: z.boolean().optional(),
  description: z.string().optional(),
  highlights: z.array(z.string().min(1)).optional(),
  sortIndex: z.number().int().optional(),
  visibility: TimelineVisibilitySchema.optional(),
  status: z.enum(["draft", "published"]).optional(),
});

export const UpdateTimelineItemSchema = CreateTimelineItemSchema.partial();

export type CreateTimelineItemInput = z.infer<typeof CreateTimelineItemSchema>;
export type UpdateTimelineItemInput = z.infer<typeof UpdateTimelineItemSchema>;
