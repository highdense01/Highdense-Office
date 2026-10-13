"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { createChatRoomSchema, type CreateChatRoomInput } from "@/lib/validations/chat";
import { createChatRoom } from "@/server/actions/chat";

export function CreateRoomDialog({
  open,
  onOpenChange,
  employees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: { id: string; name: string }[];
}) {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(createChatRoomSchema), defaultValues: { memberIds: [] } });

  const memberIds = watch("memberIds") ?? [];

  async function onSubmit(values: CreateChatRoomInput) {
    setSubmitting(true);
    let result;
    try {
      result = await createChatRoom(values);
    } catch {
      // e.g. the session ended or the server restarted mid-request; without this the button would stay on "Creating..." forever.
      toast.error("Couldn't create the room. Please try again.");
      return;
    } finally {
      setSubmitting(false);
    }
    if (!result.success) return toast.error(result.error);
    toast.success("Room created");
    onOpenChange(false);
    reset();
    router.refresh();
    router.push(`/chat/rooms/${result.data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Chat Room</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="room-name">Room Name</FieldLabel>
              <Input id="room-name" placeholder="Development Team" {...register("name")} />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="room-description">Description</FieldLabel>
              <Textarea id="room-description" rows={2} {...register("description")} />
            </Field>
            <Field>
              <FieldLabel>Members</FieldLabel>
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border p-2">
                {employees.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={memberIds.includes(e.id)}
                      onCheckedChange={(checked) =>
                        setValue("memberIds", checked ? [...memberIds, e.id] : memberIds.filter((id) => id !== e.id))
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
              {submitting ? "Creating..." : "Create Room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
