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

## Files

| File | Purpose |
|------|---------|
| `llmgateway-provider.ts` | The extension (single source file) |
| `package.json` | pi package manifest (`pi.extensions` points at the entry) |
| `tsconfig.json` | Editor/type-check settings (no build step required) |
