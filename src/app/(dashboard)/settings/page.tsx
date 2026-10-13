import Link from "next/link";
import { requirePermission } from "@/lib/permissions/check";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, IdCard, ShieldCheck, Users } from "lucide-react";

const SETTINGS_SECTIONS = [
  {
    href: "/roles",
    icon: ShieldCheck,
    title: "Roles & Permissions",
    description: "Create roles and control what each role can access.",
  },
  {
    href: "/departments",
    icon: Building2,
    title: "Departments",
    description: "Manage the department master used across employee records.",
  },
  {
    href: "/designations",
    icon: IdCard,
    title: "Designations",
    description: "Manage job titles used across employee records.",
  },
  {
    href: "/employees",
    icon: Users,
    title: "Employees",
    description: "Add employees and manage account status.",
  },
];

export default async function SettingsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">System Settings</h1>
        <p className="text-sm text-muted-foreground">Organization-wide configuration for administrators.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SETTINGS_SECTIONS.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <section.icon className="size-4" />
                </span>
                <div>
                  <CardTitle className="text-sm font-medium">{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
