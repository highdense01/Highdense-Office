import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";
import {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLES,
  DEFAULT_ROLE_LEVELS,
  PERMISSION_MODULES,
} from "../src/lib/permissions/constants";

loadEnv({ path: path.join(__dirname, "..", ".env.local") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and configure it.");
}
const parsedUrl = new URL(databaseUrl);
const adapter = new PrismaMariaDb({
  host: parsedUrl.hostname,
  port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
  user: decodeURIComponent(parsedUrl.username),
  password: parsedUrl.password ? decodeURIComponent(parsedUrl.password) : undefined,
  database: parsedUrl.pathname.replace(/^\//, ""),
});
const prisma = new PrismaClient({ adapter });

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? "953623243117@ritrjpm.ac.in";
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME ?? "Super Admin";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
const DEMO_USER_PASSWORD = "Demo@12345"; // demo accounts only — never used for real employees

async function hashOrUndefined(password: string | undefined) {
  return password ? bcrypt.hash(password, 12) : undefined;
}

const DEPARTMENTS = ["Development", "Design", "Marketing", "HR", "Finance", "Operations", "Sales"];

const DESIGNATIONS = [
  "Intern",
  "Junior Developer",
  "Developer",
  "Senior Developer",
  "Team Lead",
  "Project Manager",
  "HR Manager",
  "Designer",
  "QA Engineer",
];

async function seedPermissions() {
  console.log(`Seeding ${ALL_PERMISSION_KEYS.length} permissions...`);
  for (const key of ALL_PERMISSION_KEYS) {
    await prisma.permission.upsert({
      where: { key },
      update: { module: PERMISSION_MODULES[key] },
      create: { key, module: PERMISSION_MODULES[key] },
    });
  }
}

async function seedRoles() {
  console.log(`Seeding ${DEFAULT_ROLES.length} roles...`);
  const roleIdByName: Record<string, string> = {};

  for (const roleName of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: `${roleName} role`,
        isSystem: roleName === "Super Admin",
        level: DEFAULT_ROLE_LEVELS[roleName] ?? 0,
        isActive: true,
      },
    });
    roleIdByName[roleName] = role.id;
    // Existing roles keep any level an admin already chose; only untouched (0) ones get the default.
    await prisma.role.updateMany({ where: { id: role.id, level: 0 }, data: { level: DEFAULT_ROLE_LEVELS[roleName] ?? 0 } });

    const permissionKeys = DEFAULT_ROLE_PERMISSIONS[roleName] ?? [];
    const permissions = await prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  }

  return roleIdByName;
}

async function seedDepartments() {
  console.log(`Seeding ${DEPARTMENTS.length} departments...`);
  const idByName: Record<string, string> = {};
  for (const name of DEPARTMENTS) {
    const dept = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    idByName[name] = dept.id;
  }
  return idByName;
}

async function seedDesignations() {
  console.log(`Seeding ${DESIGNATIONS.length} designations...`);
  const idByName: Record<string, string> = {};
  for (const name of DESIGNATIONS) {
    const designation = await prisma.designation.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    idByName[name] = designation.id;
  }
  return idByName;
}

async function seedSuperAdmin(roleIdByName: Record<string, string>) {
  console.log(`Seeding Super Admin account for ${SUPER_ADMIN_EMAIL}...`);
  const passwordHash = await hashOrUndefined(SUPER_ADMIN_PASSWORD);

  await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {
      roleId: roleIdByName["Super Admin"],
      isAdmin: true,
      accountStatus: "ACTIVE",
      ...(passwordHash && { passwordHash }),
    },
    create: {
      employeeId: "EMP001",
      name: SUPER_ADMIN_NAME,
      email: SUPER_ADMIN_EMAIL,
      roleId: roleIdByName["Super Admin"],
      isAdmin: true,
      accountStatus: "ACTIVE",
      employmentStatus: "ACTIVE",
      joiningDate: new Date(),
      passwordHash,
    },
  });

  if (passwordHash) {
    console.log(`Super Admin password set from SUPER_ADMIN_PASSWORD.`);
  } else {
    console.log(`No SUPER_ADMIN_PASSWORD set — Super Admin can only sign in via Google for now.`);
  }
}

async function seedDemoData(
  roleIdByName: Record<string, string>,
  deptIdByName: Record<string, string>,
  designationIdByName: Record<string, string>,
) {
  console.log("Seeding demo employees, project, tasks...");

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: SUPER_ADMIN_EMAIL } });
  const demoPasswordHash = await hashOrUndefined(DEMO_USER_PASSWORD);

  const manager = await prisma.user.upsert({
    where: { email: "manager.demo@company.test" },
    update: { passwordHash: demoPasswordHash },
    create: {
      employeeId: "EMP002",
      name: "Priya Sharma",
      email: "manager.demo@company.test",
      roleId: roleIdByName["Manager"],
      departmentId: deptIdByName["Development"],
      designationId: designationIdByName["Project Manager"],
      managerId: admin.id,
      accountStatus: "ACTIVE",
      joiningDate: new Date("2023-01-15"),
      passwordHash: demoPasswordHash,
    },
  });

  const developer = await prisma.user.upsert({
    where: { email: "developer.demo@company.test" },
    update: { passwordHash: demoPasswordHash },
    create: {
      employeeId: "EMP003",
      name: "John Doe",
      email: "developer.demo@company.test",
      roleId: roleIdByName["Employee"],
      departmentId: deptIdByName["Development"],
      designationId: designationIdByName["Developer"],
      managerId: manager.id,
      accountStatus: "ACTIVE",
      joiningDate: new Date("2023-06-01"),
      passwordHash: demoPasswordHash,
    },
  });

  const project = await prisma.project.upsert({
    where: { id: "demo-project-website" },
    update: {},
    create: {
      id: "demo-project-website",
      name: "Company Website Revamp",
      description: "Redesign and rebuild the public company website.",
      managerId: manager.id,
      createdById: admin.id,
      status: "IN_PROGRESS",
      priority: "HIGH",
      progress: 40,
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-11-30"),
    },
  });

  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: manager.id },
      { projectId: project.id, userId: developer.id },
    ],
    skipDuplicates: true,
  });

  await prisma.task.upsert({
    where: { id: "demo-task-auth" },
    update: {},
    create: {
      id: "demo-task-auth",
      projectId: project.id,
      title: "Implement authentication",
      description: "Add Google OAuth sign-in for company employees.",
      assignedToId: developer.id,
      assignedById: manager.id,
      priority: "HIGH",
      status: "IN_PROGRESS",
      progress: 65,
      dueDate: new Date("2026-09-25"),
      startDate: new Date("2026-09-10"),
    },
  });

  await prisma.todo.createMany({
    data: [
      {
        userId: developer.id,
        title: "Write unit tests for auth flow",
        priority: "MEDIUM",
        status: "PENDING",
      },
      {
        userId: developer.id,
        title: "Update API documentation",
        priority: "LOW",
        status: "PENDING",
      },
    ],
  });

  const generalRoom = await prisma.chatRoom.upsert({
    where: { id: "demo-room-general" },
    update: {},
    create: {
      id: "demo-room-general",
      name: "General",
      description: "Company-wide announcements and discussion.",
      createdById: admin.id,
    },
  });

  await prisma.chatRoomMember.createMany({
    data: [admin.id, manager.id, developer.id].map((userId) => ({
      roomId: generalRoom.id,
      userId,
      isAdmin: userId === admin.id,
    })),
    skipDuplicates: true,
  });
}

async function main() {
  await seedPermissions();
  const roleIdByName = await seedRoles();
  const deptIdByName = await seedDepartments();
  const designationIdByName = await seedDesignations();
  await seedSuperAdmin(roleIdByName);

  if (process.env.SEED_DEMO_DATA !== "false") {
    await seedDemoData(roleIdByName, deptIdByName, designationIdByName);
  }

  console.log("Seed complete.");
  console.log(
    `Super Admin login — Employee ID: EMP001${SUPER_ADMIN_PASSWORD ? ` / password: set from SUPER_ADMIN_PASSWORD` : " (no password set — cannot sign in yet)"}`,
  );
  if (process.env.SEED_DEMO_DATA !== "false") {
    console.log(`Demo accounts (password: "${DEMO_USER_PASSWORD}"): EMP002 (manager), EMP003 (developer)`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
