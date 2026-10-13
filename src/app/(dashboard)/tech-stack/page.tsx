import { getTechOverview } from "@/server/actions/project-hub";
import { TechStackClient } from "./tech-stack-client";

export default async function TechStackPage() {
  const tech = await getTechOverview();
  return <TechStackClient tech={tech} />;
}
