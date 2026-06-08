import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, dirname } from "node:path";

const execFileAsync = promisify(execFile);

/** Resolve the lfit binary. Priority: config.binaryPath > LFIT_BIN env > bundled bin/lfit */
function resolveBinary(configBinary?: string): string {
  if (configBinary) return configBinary;
  if (process.env.LFIT_BIN) return process.env.LFIT_BIN;
  return resolve(dirname(new URL(import.meta.url).pathname), "..", "bin", "lfit");
}

/** Resolve the lfit-quick binary. */
function resolveQuickBinary(): string {
  if (process.env.LFIT_QUICK_BIN) return process.env.LFIT_QUICK_BIN;
  return resolve(dirname(new URL(import.meta.url).pathname), "..", "bin", "lfit-quick");
}

/** Run an lfit command and return output. */
async function runLfit(
  args: string[],
  config?: { binaryPath?: string; serverUrl?: string },
  timeoutMs = 900000
): Promise<Record<string, unknown> | string> {
  const bin = resolveBinary(config?.binaryPath);
  const allArgs = [...args];
  if (config?.serverUrl) allArgs.push("--server-url", config.serverUrl);
  try {
    const { stdout, stderr } = await execFileAsync(bin, allArgs, { timeout: timeoutMs, maxBuffer: 1024 * 1024 });
    const output = stdout.trim() || stderr.trim();
    // lfit prints the PNG path to stdout — return it as structured data
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
    "Local Free Image Tool — HD image generation on Vulkan iGPU. Zero cost, fully private. Three presets: standard (fast), background (scenes), hero (max quality).",
  configSchema: Type.Object({
    binaryPath: Type.Optional(
      Type.String({
        description: "Absolute path to the lfit binary. Defaults to bundled bin/lfit.",
      })
    ),
    serverUrl: Type.Optional(
      Type.String({
        description: "URL of the stable-diffusion.cpp server (default: http://127.0.0.1:7860).",
      })
    ),
  }),
  tools: (tool) => [
    tool({
      name: "image_generate",
      label: "LFIT Generate",
      description:
        "Generate HD images locally via Vulkan iGPU. Three presets: standard (characters/items, ~2.5min), background (scenes/environments, ~2.5min), hero (max quality, ~13min, ask-first). All generation is private — nothing leaves your machine.",
      parameters: Type.Object({
        prompt: Type.String({ description: "Image prompt" }),
        preset: Type.Optional(
          Type.String({ description: "Preset: standard (default), background, or hero", default: "standard" })
        ),
        seed: Type.Optional(Type.Integer({ description: "Seed for reproducibility" })),
        width: Type.Optional(Type.Integer({ description: "Override default width" })),
        height: Type.Optional(Type.Integer({ description: "Override default height" })),
        shallow_dof: Type.Optional(
          Type.Boolean({ description: "Skip auto deep-focus for background preset" })
        ),
      }),
      async execute({ prompt, preset, seed, width, height, shallow_dof }, config) {
        const args = ["--preset", preset || "standard", "--prompt", prompt];
        if (seed !== undefined) args.push("--seed", String(seed));
        if (width) args.push("--width", String(width));
        if (height) args.push("--height", String(height));
        if (shallow_dof) args.push("--shallow-dof");
        if (preset === "hero") args.push("--yes");
        const timeout = (preset === "hero") ? 900000 : 300000;
        return runLfit(args, config, timeout);
      },
    }),
  ],
});
