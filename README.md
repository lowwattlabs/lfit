# LFIT — Local Free Image Tool

HD image generation on your Vulkan iGPU. Zero cost. Fully private. On your hardware.

LFIT is for homelabbers and mini PC users who have Vulkan-capable iGPUs sitting idle. If you're running a Beelink, MinisForum, or any small-form-factor box with AMD RENOIR / Intel Arc / similar Vulkan support, LFIT turns it into a private image generation workstation with no cloud GPU rental, no API keys, no per-image cost.

## How it works

LFIT talks to [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp) running on your Vulkan device. SDXL base stays resident in VRAM; LoRAs are applied per-request (non-destructive, zero drift). One generation runs at a time — the server queues.

Two tools:

- **`lfit`** — Real HD assets via your local Vulkan GPU. Private. Pick a preset, get a PNG.
- **`lfit-quick`** — Fast drafts via Pollinations (free cloud FLUX). No GPU needed. Lower fidelity, good for iteration.

## Requirements

- **stable-diffusion.cpp** built with Vulkan support
- **Vulkan-capable GPU** (tested on AMD RADV RENOIR; Intel/AMD Vulkan should work)
- **SDXL base model** — download from [HuggingFace](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0)
- **SDXL Lightning 8-step LoRA** — download from [HuggingFace](https://huggingface.co/ByteDance/SDXL-Lightning)

## Install

```bash
# Clone
git clone https://github.com/lowwattlabs/lfit.git
cd lfit

# Make scripts executable
chmod +x bin/lfit bin/lfit-quick

# Add to PATH (optional)
export PATH="$PWD/bin:$PATH"
```

## Setup the server

```bash
# Start sd-server (adjust paths to your model locations)
sd-server \
  --listen-ip 127.0.0.1 --listen-port 7860 \
  --model ~/models/sdxl/sd_xl_base_1.0.safetensors \
  --lora-model-dir ~/models/loras \
  --type f16 --vae-tiling --lora-apply-mode at_runtime
```

Key flags:
- `--type f16` — keeps VRAM usage sane on iGPUs
- `--vae-tiling` — avoids VAE OOM at 1024+ resolutions on shared-memory architectures
- `--lora-apply-mode at_runtime` — applies LoRA non-destructively per request (no cumulative drift)

## Generate

```bash
# Standard — characters, items, single subjects (~2.5 min)
lfit --preset standard --prompt "a knight at a castle gate"

# Background — scenes, environments, wallpapers (~2.5 min)
lfit --preset background --prompt "misty mountain valley at dawn"

# Hero — max quality, no LoRA, full SDXL (~13 min, requires --yes)
lfit --preset hero --prompt "ancient dragon, key art" --yes

# Quick draft — free cloud FLUX, no GPU needed (~1.4s)
lfit-quick --prompt "concept sketch of a space station"
```

## Presets

| Preset | Use for | Size | Steps | LoRA | Time |
|--------|---------|------|-------|------|------|
| `standard` | Characters, items, single subjects | 1024×1024 | 8 | Lightning 8-step | ~2.5 min |
| `background` | Scenes, environments, wallpapers | 1344×768 | 8 | Lightning 8-step | ~2.5 min |
| `hero` | Max quality final assets | 1024×1024 | 32 | None (base SDXL) | ~13 min |

## Important: How LoRA actually works

The sd-server **ignores `<lora:...>` prompt tags**. LoRAs must be sent as a structured `"lora"` JSON field in the txt2img request. `lfit` handles this automatically per preset. Do not add `<lora:>` tags to prompts — they pass through as literal text and produce blurry output.

## Self-check before you ship

A correct `standard` or `background` image is **sharp**. If output is soft/hazy/mushy, the LoRA did not apply — that is a failure, not "just how it looks." Check the server logs for `LoRA tensors have been applied`.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SD_SERVER_URL` | `http://127.0.0.1:7860` | sd-server endpoint |
| `TELEGRAM_BOT_TOKEN` | — | Optional: auto-push PNGs to Telegram |
| `TELEGRAM_CHAT_ID` | — | Optional: Telegram chat ID for delivery |

## Network Disclosures

- `lfit` connects to a **local** sd-server (127.0.0.1:7860 by default). No image data leaves your machine.
- `lfit-quick` connects to **Pollinations.ai** (free, no API key) for cloud FLUX drafts. Images are generated on their servers.
- Optional Telegram delivery sends images to the configured chat. Requires env vars, no credentials are baked into the scripts.

## License

MIT
