# Hailuo Video Provider Design

**Goal:** Add `MiniMax-Hailuo-2.3` video generation support and unify it with the existing Wan models behind a shared video model registry and provider abstraction.

**Context**

The current video implementation is coupled to one upstream request shape in `backend-server/services/mobi_video.go`, while the frontend hard-codes model capabilities and parameter options. This creates three problems:

1. A new provider payload cannot be added cleanly.
2. Model capability mismatches exist in the UI.
3. Validation rules are duplicated or implicit instead of being model-driven.

**Requirements**

- Support only `MiniMax-Hailuo-2.3` for Hailuo.
- Show it in the frontend as `Hailuo 2.3`.
- Hailuo does not support audio input.
- Hailuo does not support end frame input.
- Hailuo supports text-to-video when `first_frame_image` is omitted.
- Hailuo supports image-to-video when `first_frame_image` is provided.
- Hailuo supports only `768P` and `1080P`.
- `768P` supports `6s` and `10s`.
- `1080P` supports `6s` only.
- Wan models support audio input.
- Wan models do not support end frame input.
- Frontend should gray out unsupported inputs and show hover tooltip text.

**Architecture**

Use two layers:

1. A video model registry.
2. A provider interface.

The video model registry is the single source of truth for:

- display name and description
- credits
- provider name
- supported input types
- supported resolution and duration combinations

The provider interface handles:

- submit request mapping
- query request mapping
- provider status mapping
- provider result URL extraction

`CreateVideoTask` and the worker polling loop should depend on the registry and provider interface rather than a single provider-specific implementation.

**Backend Design**

Create a registry that returns a `VideoModelDefinition` for a model code. Each definition includes:

- `Code`
- `Name`
- `Description`
- `Credits`
- `Provider`
- `SupportsTextOnly`
- `SupportsFirstFrame`
- `SupportsEndFrame`
- `SupportsAudio`
- `Resolutions`
- `DurationOptionsByResolution`

Add a normalized provider input struct for internal use:

- `ModelCode`
- `Prompt`
- `ImageURL`
- `AudioURL`
- `Resolution`
- `Duration`

Add a normalized provider response struct for both submit and query:

- `TaskID`
- `Status`
- `Message`
- `RequestID`
- `ResultURL`
- `RawMeta`

Implement two providers:

- `wan`
- `hailuo`

`wan` continues to use the existing Mobi credentials and base URL. Its implementation adapts the current Alibaba Bailian endpoints into the normalized provider interface.

`hailuo` also uses `MOBI_API_BASE_URL` and `MOBI_API_KEY`, but calls:

- `POST /minimax/v1/video_generation`
- `GET /minimax/v1/query/video_generation?task_id=...`

The Hailuo submit payload contains:

- `prompt`
- `first_frame_image` only when available
- `model: "MiniMax-Hailuo-2.3"`
- `duration`
- `resolution`

The Hailuo query logic should extract:

- task status from `data.status`
- result URL from `data.data.file.download_url`
- fallback result URL from `data.data.file.backup_download_url`

Task metadata remains in `video_tasks.meta`. Normalize stored keys for both providers:

- `provider`
- `provider_status`
- `provider_message`
- `provider_request_id`
- `provider_result_url`
- `resolution`
- `duration`
- `image_file_id`
- `image_url`
- `audio_file_id`
- `audio_url`

**Validation Rules**

Validation becomes model-driven:

- reject unsupported model codes
- reject unsupported input types
- reject unsupported resolution and duration combinations
- require first frame for models that do not support text-only mode

Expected rules:

- Wan: first frame required, end frame forbidden, audio allowed
- Hailuo: first frame optional, end frame forbidden, audio forbidden

**Frontend Design**

The frontend should consume capability data from `/video/models` instead of local hard-coded capability maps.

Behavior changes:

- model picker shows `Hailuo 2.3`
- resolution and duration controls reflect the selected model definition
- end frame upload is disabled for Wan and Hailuo with a hover tooltip
- audio upload is enabled for Wan and disabled for Hailuo with a hover tooltip
- first frame upload helper text becomes model-aware
- submit validation requires a first frame only when the selected model requires it

The task list continues to display stored metadata and resolved media URLs as before.

**Testing Strategy**

Add backend unit tests around:

- model registry capability lookup
- request validation rules
- provider selection
- Hailuo response parsing and status mapping

Run verification:

- `cd backend-server && go test ./...`
- `cd frontend && npm run build`

**Non-Goals**

- No database schema change.
- No end frame support for either provider.
- No new provider credentials.
- No frontend redesign outside the capability-driven controls needed for this feature.
