import { Controller, Get, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AppError } from "@factosys/shared";

import { Public } from "../decorators/auth.decorators";

@ApiTags("saas-signup")
@Controller("saas/signup-requests")
export class SignupRequestsController {
  @Public()
  @Get()
  @ApiOperation({ summary: "List signup requests (stub)" })
  list(): { items: unknown[] } {
    return { items: [] };
  }

  @Public()
  @Post()
  @ApiOperation({ summary: "Create signup request (stub — not implemented)" })
  create(): never {
    throw new AppError({
      code: "FACTOSYS_HTTP",
      message: "Signup requests are not implemented yet",
      httpStatus: 501,
      stage: "request",
    });
  }
}
