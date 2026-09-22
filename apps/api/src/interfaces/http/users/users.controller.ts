import { Body, Controller, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AppError } from "@factosys/shared";

import { UsersAdminService } from "../../../infrastructure/users/users-admin.service";
import type { UserAuthContext } from "../auth/auth-context";
import { RequirePermissions } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  roles: z.array(z.string().min(1)).min(1),
  status: z.enum(["active", "disabled"]).optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  password: z.string().min(8).optional(),
});

const rolesSchema = z.object({
  roles: z.array(z.string().min(1)).min(1),
});

type CreateBody = z.infer<typeof createSchema>;
type PatchBody = z.infer<typeof patchSchema>;
type RolesBody = z.infer<typeof rolesSchema>;

@ApiTags("users")
@ApiBearerAuth()
@Controller("organizations/me")
export class UsersController {
  constructor(private readonly users: UsersAdminService) {}

  @Get("roles")
  @RequirePermissions("users:read")
  @ApiOperation({ summary: "List RBAC roles catalog" })
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
  @ApiOperation({ summary: "Create organization user" })
  create(
    @CurrentAuth() auth: UserAuthContext,
    @Body(new ZodValidationPipe(createSchema)) body: CreateBody,
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
    @Body(new ZodValidationPipe(patchSchema)) body: PatchBody,
  ) {
    this.assertUser(auth);
    return this.users.updateUser(auth, id, body);
  }

  @Put("users/:id/roles")
  @RequirePermissions("users:write")
  @ApiOperation({ summary: "Replace user roles (owner/admin)" })
  assignRoles(
    @CurrentAuth() auth: UserAuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(rolesSchema)) body: RolesBody,
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
