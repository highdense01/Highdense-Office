import { z } from "zod";

export const meetingStatusEnum = z.enum(["SCHEDULED", "LIVE", "COMPLETED", "CANCELLED"]);

export const createMeetingSchema = z
  .object({
    title: z.string().trim().min(2, "Title is required").max(200),
    description: z.string().max(2000).optional().or(z.literal("")),
    projectId: z.string().min(1).optional().nullable(),
    date: z.coerce.date(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    participantIds: z.array(z.string()).min(1, "Select at least one participant"),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;

export const updateMeetingSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().max(2000).optional().or(z.literal("")),
  date: z.coerce.date().optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  status: meetingStatusEnum.optional(),
  participantIds: z.array(z.string()).optional(),
});
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
