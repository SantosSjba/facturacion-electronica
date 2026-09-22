import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { describe, expect, it } from "vitest";

/**
 * Integration against local/CI MinIO (Compose / GHA service).
 */
describe("MinIO put/get/presign", () => {
  const endpoint = process.env["MINIO_ENDPOINT"] ?? "http://localhost:9000";
  const bucket = process.env["MINIO_BUCKET"] ?? "factosys-dev";
  const accessKeyId = process.env["MINIO_ACCESS_KEY"] ?? "factosys";
  const secretAccessKey = process.env["MINIO_SECRET_KEY"] ?? "factosysdev";
  const region = process.env["MINIO_REGION"] ?? "us-east-1";

  const s3 = new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  it("put → get → presign → delete", async () => {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    }

    const key = `infra-test/${Date.now()}-object.txt`;
    const body = Buffer.from("hello-minio-presign", "utf8");

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "text/plain",
      }),
    );

    const got = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const bytes = await got.Body?.transformToByteArray();
    expect(bytes).toBeTruthy();
    expect(Buffer.from(bytes as Uint8Array).toString("utf8")).toBe(
      "hello-minio-presign",
    );

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 300 },
    );
    expect(url).toMatch(/X-Amz-Signature=/i);
    expect(url).toContain(bucket);

    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }, 30_000);
});
