import { z } from "zod";

export const createCampaignSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(500),
  body: z.string().min(1, "Body is required"),
  senderId: z.string().uuid("senderId must be a valid UUID"),
  delayBetweenMs: z.number().int().positive().default(2000),
  maxEmailsPerHour: z.number().int().positive().default(100),
  startTime: z.string().datetime().optional().or(z.number().optional()),
  createdBy: z.string().optional(),
  recipients: z
    .array(z.string().email("Each recipient must be a valid email"))
    .min(1, "At least one recipient is required")
    .max(10000, "Too many recipients in a single request"),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;