# LFIT — Local Free Image Tool

HD image generation on Vulkan iGPU. Free, fully private. Three presets: standard, background, hero.

## Tools

| Tool | Description |
|------|-------------|
| `image_generate` | Generate HD images on local Vulkan iGPU. Three presets. All generation is local — no data leaves your machine. |

## Requirements

- **stable-diffusion.cpp** built with Vulkan support ([GitHub](https://github.com/leejet/stable-diffusion.cpp))
- **Vulkan-capable iGPU or dGPU** (tested on AMD RADV RENOIR; Intel/AMD Vulkan should work)
- **SDXL base model** (`sd_xl_base_1.0.safetensors`)
- **SDXL Lightning 8-step LoRA** (`sdxl_lightning_8step_lora.safetensors`) for standard/background presets

## Quick start

1. Start the sd-server:
```bash
sd-server --listen-ip 127.0.0.1 --listen-port 7860 \
  --model ~/models/sdxl/sd_xl_base_1.0.safetensors \
  --lora-model-dir ~/models/loras \
  --type f16 --vae-tiling --lora-apply-mode at_runtime
```

2. Generate:
```bash
lfit --preset standard --prompt "a knight at a castle gate"
lfit --preset background --prompt "misty mountain valley at dawn"
lfit --preset hero --prompt "ancient dragon, key art" --yes
```

## Presets

| Preset | Use for | Size | Steps | LoRA | Time |
|--------|---------|------|-------|------|------|
| `standard` | Characters, items, single subjects | 1024×1024 | 8 | Lightning 8-step | ~2.5 min |
| `background` | Scenes, environments, wallpapers | 1344×768 | 8 | Lightning 8-step | ~2.5 min |
| `hero` | Max-quality final assets | 1024×1024 | 32 | None (base SDXL) | ~13 min |

## Privacy & Safety

- **All generation is local.** LFIT only connects to a local sd-server (127.0.0.1:7860 by default). No image data, prompts, or generated content ever leaves your machine.
- **Hero preset requires confirmation.** The hero preset takes ~13 minutes of GPU time. The `confirm: true` parameter must be explicitly set to proceed — LFIT will not execute hero without it.
- **Binary path is absolute.** Resolved from config or bundled path, not PATH, to prevent hijacking.
- **No network features.** Draft mode (Pollinations.ai), remote SD servers, and Telegram push have been removed. The plugin's scope is local generation only. Use the agent's built-in tools for delivery and remote operations.

## Who is this for?

Mini PC homelabbers running Vulkan-capable iGPUs (AMD RENOIR, Intel Arc, etc.) who want private, zero-cost image generation without renting cloud GPUs. If you've got a Beelink, MinisForum, or similar box with Vulkan support, LFIT turns it into an image generation workstation.