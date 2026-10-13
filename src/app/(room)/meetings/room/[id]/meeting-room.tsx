"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, LogOut, Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/tasks/status-badge";
import { cn } from "@/lib/utils";
import { endMeeting, enterMeeting } from "@/server/actions/meetings";
import { KEEP_ALIVE_EVENT } from "@/lib/auth/session-policy";

// Minimal typing for the parts of Jitsi's IFrame API that we use.
interface JitsiApi {
  addListener(event: string, listener: () => void): void;
  executeCommand(command: string, ...args: unknown[]): void;
  dispose(): void;
}
declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => JitsiApi;
  }
}

/** Only load the player script from the Jitsi server this deployment is configured for. */
const CONFIGURED_JITSI_HOST = new URL(process.env.NEXT_PUBLIC_JITSI_BASE_URL ?? "https://meet.jit.si").host;

function loadJitsiScript(domain: string): Promise<void> {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the video service."));
    document.head.appendChild(script);
  });
}

type Stage = "lobby" | "live" | "left";

interface MeetingRoomProps {
  meeting: {
    id: string;
    title: string;
    code: string;
    status: string;
    meetingLink: string;
    hostName: string;
    participantNames: string[];
  };
  jitsi: { domain: string; roomName: string };
  user: { id: string; name: string; email?: string };
  isHost: boolean;
}

export function MeetingRoom({ meeting, jitsi, user, isHost }: MeetingRoomProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("lobby");
  const [displayName, setDisplayName] = useState(user.name);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [joining, setJoining] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const apiRef = useRef<JitsiApi | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const canEmbed = jitsi.domain === CONFIGURED_JITSI_HOST;
  const ended = meeting.status === "COMPLETED" || meeting.status === "CANCELLED";

  // ---- Lobby camera preview -------------------------------------------------
  const stopPreview = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startPreview = useCallback(async () => {
    setPreviewError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      setPreviewError(
        denied
          ? "Camera access is blocked. Allow it in your browser's address bar, or join with the camera off."
          : "No camera found. You can still join with audio only.",
      );
      setCamOn(false);
    }
  }, []);

  useEffect(() => {
    if (stage !== "lobby" || ended) return;
    if (camOn && !streamRef.current) void startPreview();
    if (!camOn) stopPreview(); // release the device (and the camera light) when switched off
  }, [stage, camOn, ended, startPreview, stopPreview]);

  useEffect(() => stopPreview, [stopPreview]);

  // Mouse/keyboard activity inside the call iframe never reaches this page, so without this an
  // active call would look idle and the idle timeout would sign the user out mid-meeting.
  useEffect(() => {
    if (stage !== "live") return;
    window.dispatchEvent(new Event(KEEP_ALIVE_EVENT));
    const id = window.setInterval(() => window.dispatchEvent(new Event(KEEP_ALIVE_EVENT)), 20_000);
    return () => window.clearInterval(id);
  }, [stage]);

  // ---- Live room ------------------------------------------------------------
  useEffect(() => {
    if (stage !== "live" || !canEmbed) return;
    let disposed = false;

    loadJitsiScript(jitsi.domain)
      .then(() => {
        if (disposed || !containerRef.current || !window.JitsiMeetExternalAPI) return;
        const api = new window.JitsiMeetExternalAPI(jitsi.domain, {
          roomName: jitsi.roomName,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: { displayName, email: user.email },
          configOverwrite: {
            subject: meeting.title,
            startWithAudioMuted: !micOn,
            startWithVideoMuted: !camOn,
            prejoinConfig: { enabled: false },
            disableDeepLinking: true,
          },
          interfaceConfigOverwrite: {
            MOBILE_APP_PROMO: false,
            SHOW_JITSI_WATERMARK: false,
          },
        });
        apiRef.current = api;
        api.addListener("videoConferenceLeft", () => setStage("left"));
        api.addListener("readyToClose", () => setStage("left"));
      })
      .catch(() => !disposed && setLoadError(true));

    return () => {
      disposed = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
    // The room is created once per join; lobby choices are captured at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  async function handleJoin() {
    setJoining(true);
    const result = await enterMeeting(meeting.id);
    setJoining(false);
    if (!result.success) return toast.error(result.error);
    stopPreview(); // free the camera so the meeting can take it
    setLoadError(false);
    setStage("live");
  }

  function handleLeave() {
    if (apiRef.current) apiRef.current.executeCommand("hangup");
    else setStage("left");
  }

  async function handleEnd() {
    if (!window.confirm("End this meeting for everyone? Nobody will be able to rejoin.")) return;
    const result = await endMeeting(meeting.id);
    if (!result.success) return toast.error(result.error);
    toast.success("Meeting ended");
    apiRef.current?.executeCommand("hangup");
    setStage("left");
  }

  async function copy(kind: "code" | "link") {
    const text = kind === "code" ? meeting.code : `${window.location.origin}/meetings/room/${meeting.id}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Couldn't copy — select and copy it manually.");
    }
  }

  // ---- Screens --------------------------------------------------------------
  const header = (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Video className="size-4 shrink-0 text-primary" />
        <h1 className="truncate text-sm font-medium">{meeting.title}</h1>
        <StatusBadge status={stage === "live" && !ended ? "LIVE" : meeting.status} />
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" variant="outline" onClick={() => copy("code")} title="Copy meeting code">
          {copied === "code" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          <span className="font-mono text-xs">{meeting.code}</span>
        </Button>
        <Button size="sm" variant="outline" onClick={() => copy("link")} className="hidden sm:inline-flex">
          {copied === "link" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          Invite link
        </Button>
        {stage === "live" && (
          <>
            {isHost && (
              <Button size="sm" variant="outline" onClick={handleEnd}>
                End for all
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={handleLeave}>
              <PhoneOff className="size-3.5" />
              Leave
            </Button>
          </>
        )}
      </div>
    </header>
  );

  if (ended) {
    return (
      <>
        {header}
        <CenterCard
          title={meeting.status === "CANCELLED" ? "This meeting was cancelled" : "This meeting has ended"}
          description="Ask the host to start a new one."
        >
          <Button asChild>
            <Link href="/meetings">Back to meetings</Link>
          </Button>
        </CenterCard>
      </>
    );
  }

  if (stage === "left") {
    return (
      <>
        {header}
        <CenterCard title="You left the meeting" description="You can rejoin as long as the meeting is still running.">
          <Button onClick={() => setStage("lobby")}>Rejoin</Button>
          <Button variant="outline" onClick={() => router.push("/meetings")}>
            <LogOut className="size-4" />
            Back to meetings
          </Button>
        </CenterCard>
      </>
    );
  }

  if (stage === "live") {
    return (
      <>
        {header}
        {!canEmbed || loadError ? (
          <CenterCard
            title="Can't open the call inside the app"
            description="The video service didn't load. You can still join in a new browser tab."
          >
            <Button asChild>
              <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                Open in new tab
              </a>
            </Button>
          </CenterCard>
        ) : (
          <div ref={containerRef} className="min-h-0 flex-1 bg-black" />
        )}
      </>
    );
  }

  // Lobby
  const others = meeting.participantNames.filter((n) => n !== user.name);
  return (
    <>
      {header}
      <div className="flex flex-1 items-center justify-center overflow-y-auto p-4">
        <div className="grid w-full max-w-4xl gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div className="space-y-3">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-900">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted // local preview only — never play your own mic back
                className={cn("size-full -scale-x-100 object-cover", !camOn && "hidden")}
              />
              {!camOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-zinc-300">
                  <div className="flex size-20 items-center justify-center rounded-full bg-zinc-700 text-2xl font-semibold">
                    {displayName.trim().charAt(0).toUpperCase() || "?"}
                  </div>
                  <p className="text-sm">{previewError ?? "Camera is off"}</p>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-3 flex justify-center gap-3">
                <Button
                  size="icon-lg"
                  variant={micOn ? "secondary" : "destructive"}
                  className="rounded-full"
                  onClick={() => setMicOn((v) => !v)}
                  aria-pressed={!micOn}
                  aria-label={micOn ? "Join with microphone muted" : "Join with microphone on"}
                >
                  {micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                </Button>
                <Button
                  size="icon-lg"
                  variant={camOn ? "secondary" : "destructive"}
                  className="rounded-full"
                  onClick={() => setCamOn((v) => !v)}
                  aria-pressed={!camOn}
                  aria-label={camOn ? "Join with camera off" : "Join with camera on"}
                >
                  {camOn ? <Video className="size-4" /> : <VideoOff className="size-4" />}
                </Button>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Choose how you appear when you join. You can change both once inside.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Ready to join?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hosted by {meeting.hostName}
                {others.length > 0 && ` · ${others.length} invited`}
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="display-name" className="text-sm font-medium">
                Your name
              </label>
              <Input
                id="display-name"
                value={displayName}
                maxLength={60}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <Button className="w-full" size="lg" disabled={joining || !displayName.trim()} onClick={handleJoin}>
              {joining ? "Joining..." : "Join now"}
            </Button>
            <Button className="w-full" variant="ghost" onClick={() => router.push("/meetings")}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function CenterCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="max-w-sm space-y-4 text-center">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex flex-wrap justify-center gap-2">{children}</div>
      </div>
    </div>
  );
}
