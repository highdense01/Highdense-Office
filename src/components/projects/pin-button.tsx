"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { togglePinProject } from "@/server/actions/project-hub";

export function PinButton({
  projectId,
  pinned,
  className,
}: {
  projectId: string;
  pinned: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [isPinned, setIsPinned] = useState(pinned);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !isPinned;
    setIsPinned(next); // optimistic
    startTransition(async () => {
      const result = await togglePinProject(projectId);
      if (!result.success) {
        setIsPinned(!next);
        toast.error(result.error);
        return;
      }
      setIsPinned(result.data.pinned);
      toast.success(result.data.pinned ? "Project pinned" : "Project unpinned");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      onClick={toggle}
      aria-pressed={isPinned}
      aria-label={isPinned ? "Unpin project" : "Pin project"}
      title={isPinned ? "Unpin project" : "Pin project"}
      className={className}
    >
      <Pin className={cn("size-4", isPinned && "fill-current text-primary")} />
    </Button>
  );
}
