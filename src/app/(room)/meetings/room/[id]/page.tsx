import { notFound } from "next/navigation";
import { getMeetingRoom } from "@/server/actions/meetings";
import { parseMeetingLink } from "@/lib/meetings/jitsi";
import { MeetingRoom } from "./meeting-room";

export const metadata = { title: "Meeting · High Dense Office" };

export default async function MeetingRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = await getMeetingRoom(id);
  if (!room) notFound();

  const { meeting, user, isHost } = room;
  const jitsi = parseMeetingLink(meeting.meetingLink);
  if (!jitsi) notFound();

  return (
    <MeetingRoom
      meeting={{
        id: meeting.id,
        title: meeting.title,
        code: meeting.code,
        status: meeting.status,
        meetingLink: meeting.meetingLink,
        hostName: meeting.createdBy.name,
        participantNames: meeting.participants.map((p) => p.user.name),
      }}
      jitsi={jitsi}
      user={user}
      isHost={isHost}
    />
  );
}
