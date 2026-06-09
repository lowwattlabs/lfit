import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, dirname } from "node:path";

const execFileAsync = promisify(execFile);

/** Resolve the lfit binary. Priority: config.binaryPath > LFIT_BIN env > bundled bin/lfit.
 *  Always resolves to an absolute path to prevent PATH hijacking. */
function resolveBinary(configBinary?: string): string {
  if (configBinary) return configBinary;
  if (process.env.LFIT_BIN) return process.env.LFIT_BIN;
  return resolve(dirname(new URL(import.meta.url).pathname), "..", "bin", "lfit");
}

type LfitConfig = { binaryPath?: string; serverUrl?: string; allowRemote?: boolean; allowTelegram?: boolean };

/** Check whether the operation requires network access and block if not allowed.
 *  - serverUrl config pointing to non-localhost = remote server
 *  - lfit-quick (Pollinations) = remote service
 *  - Telegram delivery = external transmission
 *  Throws if network access is attempted without the appropriate config opt-in. */
function checkNetworkAccess(args: string[], config: LfitConfig): string[] {
  const warnings: string[] = [];
  const isQuickDraft = args.includes("--quick") || args[0] === "quick";
  const hasTelegramEnv = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  const hasNoTelegram = args.includes("--no-telegram");
  const isRemoteServer = !!(config?.serverUrl && !config.serverUrl.includes("127.0.0.1") && !config.serverUrl.includes("localhost"));

  // Block remote SD server unless allowRemote
  if (isRemoteServer) {
    if (!config?.allowRemote) {
      throw new Error(
        "Blocked: serverUrl points to a remote host (" + config.serverUrl + "). " +
        "Prompts and generation data would be sent to that server. " +
        "Set allowRemote: true in plugin config to enable. Only enable if you trust the remote server."
      );
    }
    warnings.push("⚠ Generation prompts are being sent to a remote server: " + config.serverUrl);
  }

  // Block Pollinations drafts unless allowRemote
  if (isQuickDraft) {
    if (!config?.allowRemote) {
      throw new Error(
        "Blocked: draft mode (lfit-quick) sends your full prompt to Pollinations.ai over HTTPS. " +
        "Set allowRemote: true in plugin config to enable. Only enable if you accept that prompts leave your machine."
      );
    }
    warnings.push("⚠ Prompt will be sent to Pollinations.ai (external service). Do not include sensitive content in prompts when using draft mode.");
  }

  // Block Telegram auto-push unless allowTelegram
  if (hasTelegramEnv && !hasNoTelegram) {
    if (!config?.allowTelegram) {
      throw new Error(
        "Blocked: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set, which would auto-push " +
        "generated images to Telegram. Set allowTelegram: true in plugin config to enable, " +
        "or pass --no-telegram to disable for a single generation."
      );
    }
    warnings.push("⚠ Generated image will be auto-pushed to Telegram (external transmission).");
  }

  return warnings;
}

/** Run an lfit command and return output. */
async function runLfit(
  args: string[],
  config?: LfitConfig,
  timeoutMs = 900000
): Promise<Record<string, unknown> | string> {
  const warnings = checkNetworkAccess(args, config || {});
  const bin = resolveBinary(config?.binaryPath);
  const allArgs = [...args];
  // Pass serverUrl only if allowRemote is enabled (checked above)
  if (config?.serverUrl) allArgs.push("--server-url", config.serverUrl);

  try {
    const { stdout, stderr } = await execFileAsync(bin, allArgs, { timeout: timeoutMs, maxBuffer: 1024 * 1024 });
    const output = stdout.trim() || stderr.trim();
    // lfit prints the PNG path to stdout — return it as structured data
    if (output.endsWith(".png")) {
      const result: Record<string, unknown> = { path: output, preset: args.includes("--preset") ? args[args.indexOf("--preset") + 1] : "unknown" };
      if (warnings.length > 0) result.warnings = warnings;
      return result;
    }
    if (warnings.length > 0) return { output, warnings };
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
    "HD image generation on Vulkan iGPU. Free, private on default settings. Three presets: standard, background, hero. Network features (draft mode, remote servers, Telegram delivery) require explicit opt-in via config and produce runtime warnings.",
  configSchema: Type.Object({
    binaryPath: Type.Optional(
      Type.String({
        description: "Absolute path to the lfit binary. Defaults to bundled bin/lfit. Not PATH-resolved, to prevent hijacking.",
      })
    ),
    serverUrl: Type.Optional(
      Type.String({
        description: "URL of the stable-diffusion.cpp server (default: http://127.0.0.1:7860). Non-localhost URLs require allowRemote: true and will trigger a runtime warning.",
      })
    ),
    allowRemote: Type.Optional(
      Type.Boolean({
        description: "Allow network operations: Pollinations.ai drafts (lfit-quick) and remote SD servers. Default: false. Prompts leave your machine when enabled.",
      })
    ),
    allowTelegram: Type.Optional(
      Type.Boolean({
        description: "Allow auto-pushing generated images to Telegram when TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set. Default: false. Images leave your machine when enabled.",
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
        "Generate HD images on local Vulkan iGPU. Three presets: standard (characters/items, ~2.5min), background (scenes/environments, ~2.5min), hero (max quality, ~13min, ask-first). Local generation by default — network features require explicit config opt-in and produce runtime warnings. Draft mode (Pollinations.ai) sends prompts off-host. Telegram auto-push sends images off-host.",
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