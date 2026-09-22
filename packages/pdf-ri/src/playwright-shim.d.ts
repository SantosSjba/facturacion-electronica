declare module "playwright" {
  export const chromium: {
    launch(options?: { headless?: boolean }): Promise<{
      newPage(): Promise<{
        setContent(html: string, opts?: { waitUntil?: string }): Promise<void>;
        pdf(opts?: Record<string, unknown>): Promise<Buffer>;
      }>;
      close(): Promise<void>;
    }>;
  };
}
