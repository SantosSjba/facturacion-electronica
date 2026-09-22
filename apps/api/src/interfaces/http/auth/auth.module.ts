import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";

import type { Env } from "../../../infrastructure/config/env.schema";
import { ApiKeyService } from "../../../infrastructure/api-keys/api-key.service";
import { AuthService } from "../../../infrastructure/auth/auth.service";
import { Argon2Hasher } from "../../../infrastructure/crypto/argon2-hasher";
import { UsersAdminService } from "../../../infrastructure/users/users-admin.service";
import { ApiKeysController } from "../api-keys/api-keys.controller";
import { AuthController } from "../auth/auth.controller";
import { ApiKeyGuard } from "../guards/api-key.guard";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { UsersController } from "../users/users.controller";
import { WhoamiController } from "../v1/whoami.controller";

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get("JWT_ACCESS_SECRET", { infer: true }),
      }),
    }),
  ],
  controllers: [
    AuthController,
    ApiKeysController,
    UsersController,
    WhoamiController,
  ],
  providers: [
    Argon2Hasher,
    ApiKeyService,
    AuthService,
    UsersAdminService,
    ApiKeyGuard,
    JwtAuthGuard,
    PermissionsGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [Argon2Hasher, ApiKeyService, AuthService, UsersAdminService, JwtModule],
})
export class AuthModule {}
