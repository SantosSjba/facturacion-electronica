/**
 * Resolve xsltproc (libxslt + libexslt) for XSLT 1.0 / EXSLT SUNAT stylesheets.
 * - Linux/macOS: system `xsltproc` on PATH
 * - Windows: bootstrap pinned MSYS2 mingw64 packages into .cache/xsltproc-win/
 */
import { execFileSync } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { get as httpsGet } from "node:https";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const cacheRoot = join(packageRoot, ".cache/xsltproc-win");
const manifest = JSON.parse(
  readFileSync(join(here, "xsltproc-win-manifest.json"), "utf8"),
);

function which(cmd) {
  try {
    const out = execFileSync(
      process.platform === "win32" ? "where.exe" : "which",
      [cmd],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return out.split(/\r?\n/).map((s) => s.trim()).find(Boolean) || null;
  } catch {
    return null;
  }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (current, redirectsLeft) => {
      httpsGet(current, (res) => {
        const status = res.statusCode ?? 0;
        if (
          redirectsLeft > 0 &&
          status >= 300 &&
          status < 400 &&
          res.headers.location
        ) {
          res.resume();
          follow(res.headers.location, redirectsLeft - 1);
          return;
        }
        if (status !== 200) {
          res.resume();
          reject(new Error(`GET ${current} → ${status}`));
          return;
        }
        const out = createWriteStream(dest);
        res.pipe(out);
        out.on("finish", () => resolve());
        out.on("error", reject);
      }).on("error", reject);
    };
    follow(url, 5);
  });
}

function extractPkg(pkgPath, destRoot) {
  mkdirSync(destRoot, { recursive: true });
  execFileSync("tar", ["-xf", pkgPath, "-C", destRoot], { stdio: "pipe" });
}

/**
 * @returns {Promise<{ bin: string, envPathPrefix?: string }>}
 */
export async function ensureXsltproc() {
  const system = which("xsltproc");
  if (system && process.platform !== "win32") {
    return { bin: system };
  }
  if (system && process.platform === "win32") {
    try {
      execFileSync(system, ["--version"], { stdio: "pipe" });
      return { bin: system };
    } catch {
      /* fall through to bootstrap */
    }
  }

  if (process.platform !== "win32") {
    throw new Error(
      "xsltproc not found. Install: sudo apt-get install -y xsltproc (or libxslt)",
    );
  }

  const bin = join(cacheRoot, manifest.binRel);
  const marker = join(cacheRoot, ".manifest.json");
  const expected = JSON.stringify(manifest.packages);
  if (existsSync(bin) && existsSync(marker)) {
    const cached = readFileSync(marker, "utf8");
    if (cached.trim() === expected) {
      return { bin, envPathPrefix: dirname(bin) };
    }
  }

  mkdirSync(cacheRoot, { recursive: true });
  const pkgDir = join(cacheRoot, "pkgs");
  mkdirSync(pkgDir, { recursive: true });

  for (const name of manifest.packages) {
    const dest = join(pkgDir, name);
    if (!existsSync(dest)) {
      const url = `${manifest.baseUrl}/${name}`;
      console.log(`[ensure-xsltproc] Downloading ${name}`);
      await download(url, dest);
    }
    console.log(`[ensure-xsltproc] Extracting ${name}`);
    extractPkg(dest, cacheRoot);
  }

  if (!existsSync(bin)) {
    throw new Error(`[ensure-xsltproc] Missing binary after bootstrap: ${bin}`);
  }
  writeFileSync(marker, `${expected}\n`, "utf8");
  console.log(`[ensure-xsltproc] OK → ${bin}`);
  return { bin, envPathPrefix: dirname(bin) };
}
