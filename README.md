# pi-extension-llmgateway-provider

A [pi coding agent](https://github.com/earendil-works/pi-coding-agent) extension
that **auto-discovers** models from [LLMGateway](https://www.llmgateway.io/) and
registers them as a single `llmgateway` provider.

## What it does

On load, the extension fetches `https://api.llmgateway.io/v1/models` and turns
every advertised model into a `ProviderModelConfig`:

- **Naming** — each model is registered as `<providerId>/<modelId>`, where
  `<providerId>` is the upstream provider LLMGateway routes to (e.g. `openai`,
  `anthropic`, `google`, `deepseek`) and `<modelId>` is LLMGateway's own model id
  (e.g. `gpt-4o`, `claude-3-5-sonnet`). Models without provider routes fall back
  to `<family>/<modelId>` or just `<modelId>`.
- **Reasoning** — when a route reports `reasoning: true`, a `thinkingLevelMap`
  is attached from the route's `reasoning_efforts` (mapped onto
  `off`/`minimal`/`low`/`medium`/`high`/`xhigh`/`max`; unsupported levels are
  dropped).
- **Modalities** — `input` is `["text","image"]` when the route/model reports
  vision support, otherwise `["text"]`.
- **Limits & cost** — `contextWindow`, `maxTokens`, and per-million `cost` are
  derived from the gateway response (with sane defaults if absent).

The provider is registered with the OpenAI-completions API shape and reads its
API key from a file at runtime (see below).

> Autodiscovery happens **once at startup**. If LLMGateway's catalog changes,
> restart pi to pick up new models.

## Requirements

- A LLMGateway API key placed at `~/.omp/agent/llmgateway.key` (the extension
  reads this file's contents via the `!cat …` secret reference).
- `pi` with extension support (global extensions live in `~/.pi/agent/extensions/`).

## Install

### As a pi package (recommended)

```bash
pi install git:github.com/KinoThe-Kafkaesque/pi-extension-llmgateway-provider
```

This installs the extension and pi will load it on the next start. Restart pi
afterwards.

### Manual

Copy or symlink the extension into pi's global extensions directory:

```bash
ln -s "$(pwd)/llmgateway-provider.ts" ~/.pi/agent/extensions/llmgateway-provider.ts
```

Then restart pi.

## Usage

Once loaded, select the `llmgateway` provider and a model such as
`openai/gpt-4o` or `anthropic/claude-3-5-sonnet`. The `/` separates the upstream
provider from the model id.

## Recent models

Model discovery is **live** — every model LLMGateway advertises is registered
automatically, so the extension always covers the current generation without
any hardcoded list. The table below (cross-checked against
[Artificial Analysis](https://artificialanalysis.ai/leaderboards/models)) shows
the recent families that are already served. Models are registered as
`<providerId>/<modelId>`; `*` = the route exposes reasoning, `V` = vision.

| Registered model id | Context | `*` | `V` |
|---|---|---|---|
| `openai/gpt-5.6-luna` | 1M | ✓ | ✓ |
| `openai/gpt-5.5` / `-pro` | 1M | ✓ | ✓ |
| `openai/gpt-5.4` / `-mini` / `-nano` | 1M / 1M / 400k | ✓ | ✓ / ✓ / ✗ |
| `openai/gpt-5.2` / `-pro` / `-codex` | 1M | ✓ | ✓ |
| `openai/gpt-5.1` / `-codex` | 1M | ✓ | ✓ |
| `openai/gpt-5` / `-mini` / `-nano` / `-pro` | 1M | ✓ | ✓ |
| `anthropic/claude-opus-5` | 1M | ✓ | ✓ |
| `anthropic/claude-opus-4-8` … `4-6` `4-5` `4-1` | 1M | ✓ | ✓ |
| `anthropic/claude-sonnet-5` / `4-6` / `4-5` | 1M | ✓ | ✓ |
| `anthropic/claude-haiku-4-5` | 1M | ✓ | ✓ |
| `google-ai-studio/gemini-3.7-flash` | 1M+ | ✓ | ✓ |
| `google-ai-studio/gemini-3.6` / `3.5` / `3.1-pro` / `3.1-flash-lite` | var | ✓ | ✓ |
| `google-ai-studio/gemini-2.5-pro` / `-flash` / `-flash-lite` | 1M | ✓ | ✓ |
| `deepseek/deepseek-v4-pro` / `deepseek-v4-flash` | var | ✓ | ✗ |
| `zai/glm-5.3` / `glm-5.2` / `glm-5.1` / `glm-5` | var | ✓ | ✗ |

Notes:
- **252 of 256** discovered models carry an explicit `context_length` (the rest
  fall back to the 128k default in the extension).
- Multi-provider routing is preserved: e.g. `claude-opus-5` is also exposed as
  `aws-bedrock/claude-opus-5` and `vertex-anthropic/claude-opus-5`;
  `deepseek-v4-flash` spans 13 provider routes. Each route becomes its own
  selectable model id.
- Per-route `pricing`, `maxTokens`, `reasoning_efforts`, and input modalities
  are taken from the gateway response, so cost and capability metadata stay
  accurate as models change.

Because discovery is live, newer models appear automatically after a pi restart
— no extension update required.

## Files

| File | Purpose |
|------|---------|
| `llmgateway-provider.ts` | The extension (single source file) |
| `package.json` | pi package manifest (`pi.extensions` points at the entry) |
| `tsconfig.json` | Editor/type-check settings (no build step required) |
