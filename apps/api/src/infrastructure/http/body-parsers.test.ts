import { Body, Controller, Post, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { AppError } from "@factosys/shared";
import { AuthController } from "../../interfaces/http/auth/auth.controller";
import { AppExceptionFilter } from "../../interfaces/http/filters/app-exception.filter";
import { AuthService } from "../auth/auth.service";
import { RateLimitService } from "../redis/rate-limit.service";
import { configureBodyParsers } from "./body-parsers";

@Controller("v1/previews")
class PreviewController {
  @Post()
  preview(@Body() body: { content: string }) {
    return { length: body.content.length };
  }
}

let app: INestApplication;
const login = vi.fn().mockResolvedValue({ kind: "org_selection", organizations: [] });
beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [AuthController, PreviewController],
    providers: [
      { provide: AuthService, useValue: { login } },
      { provide: RateLimitService, useValue: {} },
    ],
  }).compile();
  app = module.createNestApplication();
  configureBodyParsers(app);
  app.useGlobalFilters(new AppExceptionFilter());
  await app.init();
});
afterAll(async () => app.close());

it("parses login JSON when a preview parser is registered before Nest init", async () => {
  await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email: "user@example.com", password: "test-password" })
    .expect(200);
  expect(login).toHaveBeenCalledWith(
    expect.objectContaining({ email: "user@example.com", password: "test-password" }),
  );
});
it("still validates invalid login fields", async () => {
  const result = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ password: "test-password" })
    .expect(400);
  expect(result.body.details).toContainEqual(expect.objectContaining({ path: "email" }));
});
it("preserves invalid-credential rejection after parsing", async () => {
  login.mockRejectedValueOnce(AppError.unauthorized("Invalid credentials"));
  const result = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email: "user@example.com", password: "wrong-password" })
    .expect(401);
  expect(result.body.message).toBe("Invalid credentials");
});
it("allows preview JSON above the default 100kb limit", async () => {
  const result = await request(app.getHttpServer())
    .post("/v1/previews")
    .send({ content: "x".repeat(150000) })
    .expect(201);
  expect(result.body.length).toBe(150000);
});
it("keeps the default JSON limit on login and the 200kb preview limit", async () => {
  await request(app.getHttpServer())
    .post("/auth/login")
    .send({ content: "x".repeat(150000) })
    .expect(413);
  await request(app.getHttpServer())
    .post("/v1/previews")
    .send({ content: "x".repeat(210000) })
    .expect(413);
});
it("returns a safe validation error for malformed JSON", async () => {
  const result = await request(app.getHttpServer())
    .post("/auth/login")
    .set("Content-Type", "application/json")
    .send('{"email":')
    .expect(400);
  expect(result.body.retryable).toBe(false);
  expect(JSON.stringify(result.body)).not.toContain('{"email":');
});
