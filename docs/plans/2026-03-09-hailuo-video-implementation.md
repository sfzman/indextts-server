# Hailuo Video Provider Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `Hailuo 2.3` video generation support and refactor video generation to use a shared model registry plus provider interface across backend and frontend.

**Architecture:** The backend will introduce a capability-driven model registry and a provider abstraction used by both task creation and worker polling. The frontend will consume model capabilities from the backend to drive validation, resolution and duration options, and disabled input affordances for unsupported media types.

**Tech Stack:** Go, Gin, GORM, React, TypeScript, Vite

---

### Task 1: Add video model registry and validation tests

**Files:**
- Create: `backend-server/services/video_models_test.go`
- Modify: `backend-server/services/video_models.go`

**Step 1: Write the failing test**

Write tests that assert:

- `wan2.6-i2v` supports audio and does not support end frame
- `wan2.6-i2v-flash` supports audio and does not support end frame
- `wan2.5-i2v-preview` supports audio and does not support end frame
- `hailuo-2.3` supports text-only and first-frame modes, but not audio or end frame
- `hailuo-2.3` supports `768P -> [6, 10]` and `1080P -> [6]`

**Step 2: Run test to verify it fails**

Run: `cd backend-server && go test ./services -run TestVideoModelDefinitions`

Expected: FAIL because capability metadata does not exist yet.

**Step 3: Write minimal implementation**

Refactor `backend-server/services/video_models.go` to add:

- model definition struct
- capability fields
- resolution and duration metadata
- lookup helpers

Keep list response generation derived from this registry.

**Step 4: Run test to verify it passes**

Run: `cd backend-server && go test ./services -run TestVideoModelDefinitions`

Expected: PASS

### Task 2: Add provider abstraction tests and implement Hailuo provider parsing

**Files:**
- Create: `backend-server/services/video_provider_test.go`
- Create: `backend-server/services/video_provider.go`
- Create: `backend-server/services/video_provider_wan.go`
- Create: `backend-server/services/video_provider_hailuo.go`
- Modify: `backend-server/services/mobi_video.go`

**Step 1: Write the failing test**

Write tests that assert:

- provider lookup returns the Wan provider for Wan models
- provider lookup returns the Hailuo provider for `hailuo-2.3`
- Hailuo query parsing extracts `SUCCESS` and `download_url`
- Hailuo query parsing falls back to `backup_download_url`
- Hailuo status mapping turns `SUCCESS` into completed and running-like states into processing

**Step 2: Run test to verify it fails**

Run: `cd backend-server && go test ./services -run 'TestVideoProvider|TestHailuo'`

Expected: FAIL because provider abstraction does not exist yet.

**Step 3: Write minimal implementation**

Implement:

- normalized provider request and response types
- provider interface
- Wan adapter backed by existing Mobi request code
- Hailuo adapter backed by the Minimax endpoints

**Step 4: Run test to verify it passes**

Run: `cd backend-server && go test ./services -run 'TestVideoProvider|TestHailuo'`

Expected: PASS

### Task 3: Add create-task validation tests and refactor backend task creation

**Files:**
- Create: `backend-server/handlers/video_task_test.go`
- Modify: `backend-server/handlers/video_task.go`

**Step 1: Write the failing test**

Write tests around extracted validation helpers that assert:

- Wan requires a first frame
- Wan rejects audio only if omitted? No. Wan accepts optional audio
- Wan rejects end frame
- Hailuo accepts prompt-only requests
- Hailuo accepts prompt plus first frame
- Hailuo rejects audio
- Hailuo rejects end frame
- Hailuo rejects invalid resolution-duration combinations

**Step 2: Run test to verify it fails**

Run: `cd backend-server && go test ./handlers -run TestValidateVideoTaskRequest`

Expected: FAIL because validation is still hard-coded and incomplete.

**Step 3: Write minimal implementation**

Extract request validation into helper logic and refactor `CreateVideoTask` to:

- use the model registry
- use the normalized provider interface
- store normalized provider metadata

**Step 4: Run test to verify it passes**

Run: `cd backend-server && go test ./handlers -run TestValidateVideoTaskRequest`

Expected: PASS

### Task 4: Add worker polling tests and refactor video polling to provider interface

**Files:**
- Create: `backend-server/services/worker_video_test.go`
- Modify: `backend-server/services/worker.go`

**Step 1: Write the failing test**

Write focused tests for helper logic that assert:

- polling uses the correct provider based on task model
- provider result URL is stored into metadata
- completed polling with a provider result URL proceeds to result handling
- failed provider polling writes provider message

**Step 2: Run test to verify it fails**

Run: `cd backend-server && go test ./services -run TestProcessVideoTask`

Expected: FAIL because the worker still calls the Wan-specific polling function directly.

**Step 3: Write minimal implementation**

Refactor video polling to:

- resolve provider by model
- use normalized provider query results
- preserve provider metadata in task meta

**Step 4: Run test to verify it passes**

Run: `cd backend-server && go test ./services -run TestProcessVideoTask`

Expected: PASS

### Task 5: Add frontend capability-driven model tests and refactor VideoStudio

**Files:**
- Modify: `frontend/services/videoService.ts`
- Modify: `frontend/components/VideoStudio.tsx`

**Step 1: Write the failing test**

If frontend test harness is unavailable, use a compile-driven approach:

- first, encode capability fields into TypeScript types in a way that causes current `VideoStudio.tsx` to fail type or build expectations
- then make the component consume those fields

Behavior to cover:

- `Hailuo 2.3` appears in selectable models
- end frame zone is disabled for Wan and Hailuo
- audio zone is disabled for Hailuo and enabled for Wan
- submit no longer requires a first frame for Hailuo
- duration options change with model and resolution

**Step 2: Run verification to show current implementation is insufficient**

Run: `cd frontend && npm run build`

Expected: build or behavior gap confirms the current implementation cannot satisfy capability-driven logic.

**Step 3: Write minimal implementation**

Refactor the frontend to:

- extend `VideoModelOption` with capability fields
- remove hard-coded capability maps
- derive available durations from backend data
- disable unsupported input zones with hover tooltip copy
- make first frame optional only for text-capable models

**Step 4: Run verification**

Run: `cd frontend && npm run build`

Expected: PASS

### Task 6: Final verification

**Files:**
- Modify as needed based on prior tasks

**Step 1: Run backend test suite**

Run: `cd backend-server && go test ./...`

Expected: PASS

**Step 2: Run frontend production build**

Run: `cd frontend && npm run build`

Expected: PASS

**Step 3: Inspect diff**

Run: `git status --short`

Expected: only intended files are modified.
