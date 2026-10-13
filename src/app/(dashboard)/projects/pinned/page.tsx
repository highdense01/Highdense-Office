import { listPinnedProjects } from "@/server/actions/project-hub";
import { PinnedClient } from "./pinned-client";

export default async function PinnedProjectsPage() {
  const pins = await listPinnedProjects();
  return <PinnedClient pins={pins} />;
}
