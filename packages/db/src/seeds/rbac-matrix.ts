import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import type { Db } from "../client";
import { permissions } from "../schema/permissions";
import { rolePermissions } from "../schema/role-permissions";
import { roles } from "../schema/roles";

/** Organization-scoped permissions (doc 33 §1). */
export const ORG_PERMISSION_CODES = [
  "users:read",
  "users:write",
  "companies:read",
  "companies:write",
  "credentials:manage",
  "series:read",
  "series:write",
  "documents:read",
  "documents:write",
  "gre:read",
  "gre:write",
  "apikeys:manage",
  "webhooks:manage",
  "validations:cpe",
  "audit:read",
  "catalog:read",
] as const;

/** Platform (Factosys ops) permissions — never granted to org roles. */
export const PLATFORM_PERMISSION_CODES = [
  "platform:admin",
  "platform:ops",
] as const;

/** Atomic permissions (org + platform). */
export const PERMISSION_CODES = [
  ...ORG_PERMISSION_CODES,
  ...PLATFORM_PERMISSION_CODES,
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];
export type OrgPermissionCode = (typeof ORG_PERMISSION_CODES)[number];
export type PlatformPermissionCode = (typeof PLATFORM_PERMISSION_CODES)[number];

export const ROLE_DEFS = [
  { code: "owner", name: "Owner", description: "Dueño de la organización" },
  { code: "admin", name: "Admin", description: "Administración operativa" },
  { code: "operator", name: "Operator", description: "Emisión y consulta CPE/GRE" },
  { code: "developer", name: "Developer", description: "API keys, webhooks, validaciones" },
  { code: "viewer", name: "Viewer", description: "Solo lectura" },
  {
    code: "platform_superadmin",
    name: "Platform Superadmin",
    description: "Administración global de la plataforma Factosys",
  },
  {
    code: "platform_ops",
    name: "Platform Ops",
    description: "Operaciones de plataforma (soporte / ops)",
  },
] as const;

export type RoleCode = (typeof ROLE_DEFS)[number]["code"];

/** Role → permissions matrix (doc 33 §1 + S12 platform). */
export const ROLE_PERMISSION_MATRIX: Record<RoleCode, readonly PermissionCode[]> = {
  owner: [...ORG_PERMISSION_CODES],
  admin: [...ORG_PERMISSION_CODES],
  operator: [
    "companies:read",
    "series:read",
    "series:write",
    "documents:read",
    "documents:write",
    "gre:read",
    "gre:write",
    "validations:cpe",
    "catalog:read",
  ],
  developer: [
    "companies:read",
    "series:read",
    "documents:read",
    "gre:read",
    "apikeys:manage",
    "webhooks:manage",
    "validations:cpe",
    "audit:read",
    "catalog:read",
  ],
  viewer: [
    "companies:read",
    "series:read",
    "documents:read",
    "gre:read",
    "catalog:read",
  ],
  platform_superadmin: ["platform:admin", "platform:ops"],
  platform_ops: ["platform:ops"],
};

export function isPlatformRole(code: string): boolean {
  return code.startsWith("platform_");
}

/**
 * Idempotent seed of global roles, permissions and role_permissions.
 */
export async function seedRbacMatrix(db: Pick<Db, "select" | "insert" | "update">): Promise<{
  roleIds: Record<RoleCode, string>;
  permissionIds: Record<PermissionCode, string>;
}> {
  const permissionIds = {} as Record<PermissionCode, string>;
  for (const code of PERMISSION_CODES) {
    const existing = await db
      .select()
      .from(permissions)
      .where(eq(permissions.code, code))
      .limit(1);
    if (existing[0]) {
      permissionIds[code] = existing[0].id;
    } else {
      const id = uuidv7();
      await db.insert(permissions).values({
        id,
        code,
        description: code,
      });
      permissionIds[code] = id;
    }
  }

  const roleIds = {} as Record<RoleCode, string>;
  for (const def of ROLE_DEFS) {
    const existing = await db.select().from(roles).where(eq(roles.code, def.code)).limit(1);
    if (existing[0]) {
      roleIds[def.code] = existing[0].id;
    } else {
      const id = uuidv7();
      await db.insert(roles).values({
        id,
        code: def.code,
        name: def.name,
        description: def.description,
      });
      roleIds[def.code] = id;
    }
  }

  for (const role of ROLE_DEFS) {
    const wanted = ROLE_PERMISSION_MATRIX[role.code];
    const roleId = roleIds[role.code];
    for (const perm of wanted) {
      const permissionId = permissionIds[perm];
      const existing = await db
        .select()
        .from(rolePermissions)
        .where(
          and(
            eq(rolePermissions.roleId, roleId),
            eq(rolePermissions.permissionId, permissionId),
          ),
        )
        .limit(1);
      if (existing.length === 0) {
        await db.insert(rolePermissions).values({ roleId, permissionId });
      }
    }
  }

  return { roleIds, permissionIds };
}
