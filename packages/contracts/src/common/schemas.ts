import { z } from 'zod';

/** UUID v4 string */
export const UuidSchema = z.string().uuid();
export type Uuid = z.infer<typeof UuidSchema>;

/** ISO 8601 timestamp */
export const TimestampSchema = z.string().datetime({ offset: true });

/** Standard pagination input */
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof PaginationSchema>;

/** Standard API success response wrapper */
export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.object({
      timestamp: TimestampSchema,
      requestId: UuidSchema.optional(),
    }).optional(),
  });
export type ApiResponse<T> = {
  success: true;
  data: T;
  meta?: { timestamp: string; requestId?: string };
};

/** Standard API error response */
export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
