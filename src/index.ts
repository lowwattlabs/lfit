import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, dirname, isAbsolute } from "node:path";

const execFileAsync = promisify(execFile);

/** Resolve the lfit binary. Priority: config.binaryPath > LFIT_BIN env > bundled bin/lfit.
 *  configBinary and LFIT_BIN must be absolute paths; relative values are rejected
 *  to prevent PATH hijacking. Falls back to the bundled binary on invalid or missing paths. */
function resolveBinary(configBinary?: string): string {
  if (configBinary) {
    if (!isAbsolute(configBinary)) {
      console.error('[lfit] configBinary must be an absolute path, ignoring:', configBinary);
    } else {
      return configBinary;
    }
  }
  if (process.env.LFIT_BIN) {
    if (!isAbsolute(process.env.LFIT_BIN)) {
      console.error('[lfit] LFIT_BIN must be an absolute path, ignoring:', process.env.LFIT_BIN);
    } else {
      return process.env.LFIT_BIN;
    }
  }
  return resolve(dirname(new URL(import.meta.url).pathname), "..", "bin", "lfit");
}

type LfitConfig = { binaryPath?: string; serverUrl?: string };

/** Run an lfit command and return output. Local-only — no network features. */
async function runLfit(
  args: string[],
  config?: LfitConfig,
  timeoutMs = 900000
): Promise<Record<string, unknown> | string> {
  const bin = resolveBinary(config?.binaryPath);
  const allArgs = [...args];
  // Pass serverUrl only if it points to localhost (local generation only)
  if (config?.serverUrl) {
    if (!config.serverUrl.includes("127.0.0.1") && !config.serverUrl.includes("localhost")) {
      throw new Error(
        "Blocked: serverUrl points to a remote host (" + config.serverUrl + "). " +
        "LFIT only supports local generation. Remote servers are not permitted."
      );
    }
    allArgs.push("--server-url", config.serverUrl);
  }

  try {
    const { stdout, stderr } = await execFileAsync(bin, allArgs, { timeout: timeoutMs, maxBuffer: 1024 * 1024 });
    const output = stdout.trim() || stderr.trim();
    if (output.endsWith(".png")) {
      return { path: output, preset: args.includes("--preset") ? args[args.indexOf("--preset") + 1] : "unknown" };
    }
    return output;
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    const detail = error.stderr || error.message || String(err);
    throw new Error(`lfit ${args.join(" ")} failed: ${detail}`);
  }
}

export default defineToolPlugin({
  id: "lfit",
  name: "LFIT",
  description:
    "Local HD image generation on Vulkan iGPU. Free, fully private. Three presets: standard (characters/items, ~2.5min), background (scenes/environments, ~2.5min), hero (max quality, ~13min). All generation is local — no data leaves your machine.",
  configSchema: Type.Object({
    binaryPath: Type.Optional(
      Type.String({
        description: "Absolute path to the lfit binary. Defaults to bundled bin/lfit. Not PATH-resolved, to prevent hijacking.",
      })
    ),
    serverUrl: Type.Optional(
      Type.String({
        description: "URL of the stable-diffusion.cpp server (default: http://127.0.0.1:7860). Only localhost URLs are accepted.",
      })
    ),
  }),
  activation: {
    onStartup: false
  },
  tools: (tool) => [
    tool({
      name: "image_generate",
      label: "LFIT Generate",
      description:
        "Generate HD images on local Vulkan iGPU. Three presets: standard (fast, ~2.5min), background (scenes, ~2.5min), hero (max quality, ~13min). Hero preset requires explicit confirmation. All generation is local and private — no network calls, no data leaves your machine.",
      parameters: Type.Object({
        prompt: Type.String({ description: "Image prompt" }),
        preset: Type.Optional(
          Type.String({ description: "Preset: standard (default), background, or hero", default: "standard" })
        ),
        confirm: Type.Optional(
          Type.Boolean({ description: "Required for hero preset. Set to true to confirm that hero takes ~13 minutes and should proceed." })
        ),
        seed: Type.Optional(Type.Integer({ description: "Seed for reproducibility" })),
        width: Type.Optional(Type.Integer({ description: "Override default width" })),
        height: Type.Optional(Type.Integer({ description: "Override default height" })),
        shallow_dof: Type.Optional(
          Type.Boolean({ description: "Skip auto deep-focus for background preset" })
        ),
      }),
      async execute({ prompt, preset, confirm, seed, width, height, shallow_dof }, config) {
        // Hero preset requires explicit confirmation
        if (preset === "hero" && !confirm) {
          return "Hero preset requires ~13 minutes of GPU time and explicit confirmation. Set confirm: true to proceed.";
        }

        const args = ["--preset", preset || "standard", "--prompt", prompt];
        if (seed !== undefined) args.push("--seed", String(seed));
        if (width) args.push("--width", String(width));
        if (height) args.push("--height", String(height));
        if (shallow_dof) args.push("--shallow-dof");
        // Only pass --yes for hero when explicitly confirmed
        if (preset === "hero" && confirm) args.push("--yes");
        const timeout = (preset === "hero") ? 900000 : 300000;
        return runLfit(args, config, timeout);
      },
    }),
  ],
});