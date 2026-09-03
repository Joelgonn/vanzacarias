import { z } from 'zod';

export const PatientRequestSchema = z.object({
  userId: z.string().min(1),
  message: z.string().max(500).optional(),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(20000),
    })
  ).max(12).optional().default([]),
  image: z.string().optional().nullable(),
}).strict();
