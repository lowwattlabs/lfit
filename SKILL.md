# LFIT — Local Free Image Tool

HD image generation on Vulkan iGPU. Free, private on default settings. Three presets: standard, background, hero.

## Tools

| Tool | Description |
|------|-------------|
| `image_generate` | Generate HD images on local Vulkan iGPU. Three presets. Local by default. |

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

3. Fast drafts (free, no GPU needed — prompts sent to Pollinations.ai):
```bash
lfit-quick --prompt "concept sketch of a space station"
```

## Presets

| Preset | Use for | Size | Steps | LoRA | Time |
|--------|---------|------|-------|------|------|
| `standard` | Characters, items, single subjects | 1024×1024 | 8 | Lightning 8-step | ~2.5 min |
| `background` | Scenes, environments, wallpapers | 1344×768 | 8 | Lightning 8-step | ~2.5 min |
| `hero` | Max-quality final assets | 1024×1024 | 32 | None (base SDXL) | ~13 min |

## ⚠️ Network & Privacy Disclosures

- `lfit` connects to a **local** sd-server (127.0.0.1:7860 by default). No image data leaves your machine.
- `lfit-quick` connects to **Pollinations.ai** (free, no API key) for cloud FLUX drafts. **Prompts leave your machine.** Blocked unless `allowRemote: true` is set in plugin config.
- Remote SD servers (non-localhost `serverUrl`) send prompts and parameters to the configured endpoint. Blocked unless `allowRemote: true`.
- Telegram auto-push sends generated PNG files to the configured chat. **Blocked unless `allowTelegram: true`.** Use `--no-telegram` to disable for a single generation.
- Binary is resolved from absolute path (not PATH) to prevent hijacking.

## Who is this for?

Mini PC homelabbers running Vulkan-capable iGPUs (AMD RENOIR, Intel Arc, etc.) who want private, zero-cost image generation without renting cloud GPUs. If you've got a Beelink, MinisForum, or similar box with Vulkan support, LFIT turns it into an image generation workstation.