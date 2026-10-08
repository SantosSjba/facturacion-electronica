import { Body, Controller, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import { UsersAdminService } from "../../../infrastructure/users/users-admin.service";
import type { UserAuthContext } from "../auth/auth-context";
import { RequirePermissions } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(8),
  invite: z.literal(false).optional(),
  roles: z.array(z.string().min(1)).min(1),
  status: z.enum(["active", "disabled"]).optional(),
});

export const patchUserSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  password: z.string().min(8).optional(),
  roles: z.array(z.string().min(1)).min(1).optional(),
});

export const userRolesSchema = z.object({
  roles: z.array(z.string().min(1)).min(1),
});

type CreateBody = z.infer<typeof createUserSchema>;
type PatchBody = z.infer<typeof patchUserSchema>;
type RolesBody = z.infer<typeof userRolesSchema>;

@ApiTags("users")
@ApiBearerAuth()
@Controller("organizations/me")
export class UsersController {
  constructor(private readonly users: UsersAdminService) {}

  @Get("roles")
  @RequirePermissions("users:read")
  @ApiOperation({
    summary: "List RBAC roles catalog (includes permissions[] for read-only matrix)",
  })
  listRoles(@CurrentAuth() auth: UserAuthContext) {
    this.assertUser(auth);
    return this.users.listRoles();
  }

  @Get("users")
  @RequirePermissions("users:read")
  @ApiOperation({ summary: "List organization users" })
  listUsers(@CurrentAuth() auth: UserAuthContext) {
    this.assertUser(auth);
    return this.users.listUsers(auth.organizationId);
  }

  @Post("users")
  @RequirePermissions("users:write")
  @ApiOperation({
    summary: "Create organization user with password",
  })
  create(
    @CurrentAuth() auth: UserAuthContext,
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateBody,
  ) {
    this.assertUser(auth);
    return this.users.createUser(auth, {
      email: body.email,
      name: body.name,
      password: body.password,
      roleCodes: body.roles,
      status: body.status,
    });
  }

  @Patch("users/:id")
  @RequirePermissions("users:write")
  @ApiOperation({ summary: "Update organization user" })
  update(
    @CurrentAuth() auth: UserAuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(patchUserSchema)) body: PatchBody,
  ) {
    this.assertUser(auth);
    return this.users.updateUser(auth, id, { ...body, roleCodes: body.roles });
  }

  @Put("users/:id/roles")
  @RequirePermissions("users:write")
  @ApiOperation({ summary: "Replace user roles (owner/admin)" })
  assignRoles(
    @CurrentAuth() auth: UserAuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(userRolesSchema)) body: RolesBody,
  ) {
    this.assertUser(auth);
    return this.users.assignRoles(auth, id, body.roles);
  }

  private assertUser(auth: UserAuthContext | { kind: string }): asserts auth is UserAuthContext {
    if (auth.kind !== "user") {
      throw AppError.forbidden("Console JWT required");
    }
  }
}
