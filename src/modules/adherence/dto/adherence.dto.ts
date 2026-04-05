import { z } from 'zod';

export const AdherenceHistoryDto = z.object({
  page:  z.string().optional().transform(v => parseInt(v ?? '1') || 1),
  limit: z.string().optional().transform(v => Math.min(parseInt(v ?? '10') || 10, 50)),
});
export type AdherenceHistoryDto = z.infer<typeof AdherenceHistoryDto>;