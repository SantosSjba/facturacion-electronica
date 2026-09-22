import { SpanStatusCode, trace, type Span } from "@opentelemetry/api";

const TRACER_NAME = "factosys-api";

export function getTracer() {
  return trace.getTracer(TRACER_NAME);
}

/**
 * Runs `fn` inside an active span. Safe when OTel SDK is not started
 * (API uses a no-op tracer by default).
 */
export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, async (span) => {
    try {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (cause) {
      if (cause instanceof Error) {
        span.recordException(cause);
      }
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: cause instanceof Error ? cause.message : String(cause),
      });
      throw cause;
    } finally {
      span.end();
    }
  });
}

let started = false;

/**
 * Bootstrap Node OTel SDK when OTEL_ENABLED=1.
 * Console exporter by default; OTLP HTTP if OTEL_EXPORTER_OTLP_ENDPOINT is set.
 */
export async function startOtelIfEnabled(): Promise<void> {
  if (started) return;
  if (process.env["OTEL_ENABLED"] !== "1") return;

  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { resourceFromAttributes } = await import("@opentelemetry/resources");
  const { ATTR_SERVICE_NAME } = await import(
    "@opentelemetry/semantic-conventions"
  );

  let traceExporter;
  const endpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];
  if (endpoint) {
    const { OTLPTraceExporter } = await import(
      "@opentelemetry/exporter-trace-otlp-http"
    );
    traceExporter = new OTLPTraceExporter({
      url: endpoint.replace(/\/$/, "") + "/v1/traces",
    });
  } else {
    const { ConsoleSpanExporter } = await import(
      "@opentelemetry/sdk-trace-base"
    );
    traceExporter = new ConsoleSpanExporter();
  }

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "factosys-api",
    }),
    traceExporter,
  });

  await sdk.start();
  started = true;

  const shutdown = async () => {
    try {
      await sdk.shutdown();
    } catch {
      /* ignore */
    }
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
}
