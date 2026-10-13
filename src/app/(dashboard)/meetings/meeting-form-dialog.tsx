"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { createMeeting } from "@/server/actions/meetings";
import type { User } from "@prisma/client";

interface MeetingFormValues {
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  participantIds: string[];
}

export function MeetingFormDialog({
  open,
  onOpenChange,
  employees,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: User[];
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<MeetingFormValues>({
    defaultValues: { participantIds: [] },
  });

  useEffect(() => {
    if (open) reset({ participantIds: [] });
  }, [open, reset]);

  const participantIds = watch("participantIds") ?? [];

  async function onSubmit(values: MeetingFormValues) {
    if (!values.date || !values.startTime || !values.endTime) {
      toast.error("Date, start time, and end time are required.");
      return;
    }
    if (values.participantIds.length === 0) {
      toast.error("Select at least one participant.");
      return;
    }

    setSubmitting(true);
    const result = await createMeeting({
      title: values.title,
      description: values.description,
      date: new Date(values.date),
      startTime: new Date(`${values.date}T${values.startTime}`),
      endTime: new Date(`${values.date}T${values.endTime}`),
      participantIds: values.participantIds,
    });
    setSubmitting(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Meeting scheduled");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Meeting</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="meeting-title">Title</FieldLabel>
              <Input id="meeting-title" placeholder="Team Meeting" {...register("title", { required: "Title is required" })} />
              <FieldError errors={[errors.title]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="meeting-description">Description</FieldLabel>
              <Textarea id="meeting-description" rows={2} {...register("description")} />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field data-invalid={!!errors.date}>
                <FieldLabel htmlFor="meeting-date">Date</FieldLabel>
                <Input id="meeting-date" type="date" {...register("date", { required: "Required" })} />
                <FieldError errors={[errors.date]} />
              </Field>
              <Field data-invalid={!!errors.startTime}>
                <FieldLabel htmlFor="meeting-start">Start Time</FieldLabel>
                <Input id="meeting-start" type="time" {...register("startTime", { required: "Required" })} />
                <FieldError errors={[errors.startTime]} />
              </Field>
              <Field data-invalid={!!errors.endTime}>
                <FieldLabel htmlFor="meeting-end">End Time</FieldLabel>
                <Input id="meeting-end" type="time" {...register("endTime", { required: "Required" })} />
                <FieldError errors={[errors.endTime]} />
              </Field>
            </div>
            <Field>
              <FieldLabel>Participants</FieldLabel>
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border p-2">
                {employees.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={participantIds.includes(e.id)}
                      onCheckedChange={(checked) =>
                        setValue(
                          "participantIds",
                          checked ? [...participantIds, e.id] : participantIds.filter((id) => id !== e.id),
                        )
                      }
                    />
                    {e.name}
                  </label>
                ))}
              </div>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Scheduling..." : "Schedule Meeting"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
