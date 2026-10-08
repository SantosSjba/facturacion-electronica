import { Body, Controller, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { z } from "zod";
import { AppError } from "@factosys/shared";
import { UsersAdminService } from "../../../infrastructure/users/users-admin.service";
import { OrganizationsMeService } from "../../../infrastructure/saas/organizations-me.service";
import { AuditService } from "../../../infrastructure/audit/audit.service";
import type { UserAuthContext } from "../auth/auth-context";
import { RequirePermissions, RequirePlatform } from "../decorators/auth.decorators";
import { CurrentAuth } from "../decorators/current-auth.decorator";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { createUserSchema, patchUserSchema, userRolesSchema } from "../users/users.controller";

@RequirePlatform()
@RequirePermissions("platform:admin")
@Controller("saas/organizations/:organizationId")
export class OrganizationUsersController {
  constructor(
    private readonly users: UsersAdminService,
    private readonly organizations: OrganizationsMeService,
    private readonly audit: AuditService,
  ) {}

  @Get("plan-usage")
  plan(@Param("organizationId") id: string) {
    return this.organizations.getPlan(id);
  }

  @Get("roles")
  roles() {
    return this.users.listRoles();
  }

  @Get("users")
  async list(@Param("organizationId") id: string) {
    await this.organizations.getPlan(id);
    return this.users.listUsers(id);
  }

  @Post("users")
  async create(
    @CurrentAuth() auth: UserAuthContext,
    @Param("organizationId") id: string,
    @Body(new ZodValidationPipe(createUserSchema)) body: z.infer<typeof createUserSchema>,
  ) {
    const user = await this.users.createUser(this.actor(auth, id), {
      ...body,
      roleCodes: body.roles,
    });
    await this.record(auth, id, user.id, "organization.user.created");
    return user;
  }

  @Patch("users/:userId")
  async update(
    @CurrentAuth() auth: UserAuthContext,
    @Param("organizationId") id: string,
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(patchUserSchema)) body: z.infer<typeof patchUserSchema>,
  ) {
    const user = await this.users.updateUser(this.actor(auth, id), userId, {
      ...body,
      roleCodes: body.roles,
    });
    await this.record(auth, id, userId, "organization.user.updated");
    return user;
  }

  @Put("users/:userId/roles")
  async assign(
    @CurrentAuth() auth: UserAuthContext,
    @Param("organizationId") id: string,
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(userRolesSchema)) body: z.infer<typeof userRolesSchema>,
  ) {
    const user = await this.users.assignRoles(this.actor(auth, id), userId, body.roles);
    await this.record(auth, id, userId, "organization.user.roles_changed");
    return user;
  }

  private actor(auth: UserAuthContext, organizationId: string): UserAuthContext {
    if (
      auth.kind !== "user" ||
      auth.ctx !== "platform" ||
      !auth.permissions.includes("platform:admin")
    )
      throw AppError.forbidden();
    return { ...auth, organizationId };
  }
  private record(auth: UserAuthContext, organizationId: string, userId: string, action: string) {
    return this.audit.append({
      organizationId,
      actorType: "user",
      actorId: auth.userId,
      action,
      resourceType: "user",
      resourceId: userId,
    });
  }
}
