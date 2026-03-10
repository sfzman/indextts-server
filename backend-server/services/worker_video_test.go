package services

import (
	"testing"

	"backend-server/models"
)

func TestBuildVideoTaskProviderUpdatesProcessing(t *testing.T) {
	task := models.VideoTask{Model: "hailuo-2.3"}
	result := &VideoProviderTaskResult{
		Status:    "PROCESSING",
		Message:   "working",
		RequestID: "req-1",
		ResultURL: "",
		RawMeta: map[string]interface{}{
			"provider_progress": "60%",
		},
	}

	updates, err := buildVideoTaskProviderUpdates(task, result)
	if err != nil {
		t.Fatalf("expected updates to succeed: %v", err)
	}

	if updates["status"] != models.TaskStatusProcessing {
		t.Fatalf("expected processing status, got %#v", updates["status"])
	}

	meta, ok := updates["meta"].(string)
	if !ok {
		t.Fatalf("expected meta json string, got %#v", updates["meta"])
	}
	if meta == "" {
		t.Fatal("expected meta json to be populated")
	}
}

func TestBuildVideoTaskProviderUpdatesFailed(t *testing.T) {
	task := models.VideoTask{Model: "hailuo-2.3"}
	result := &VideoProviderTaskResult{
		Status:  "FAILED",
		Message: "provider failed",
	}

	updates, err := buildVideoTaskProviderUpdates(task, result)
	if err != nil {
		t.Fatalf("expected updates to succeed: %v", err)
	}

	if updates["status"] != models.TaskStatusFailed {
		t.Fatalf("expected failed status, got %#v", updates["status"])
	}
	if updates["error_message"] != "provider failed" {
		t.Fatalf("unexpected error message: %#v", updates["error_message"])
	}
}

func TestBuildVideoTaskProviderUpdatesCompleted(t *testing.T) {
	task := models.VideoTask{Model: "hailuo-2.3"}
	result := &VideoProviderTaskResult{
		Status:    "SUCCESS",
		Message:   "success",
		ResultURL: "https://example.com/output.mp4",
	}

	updates, err := buildVideoTaskProviderUpdates(task, result)
	if err != nil {
		t.Fatalf("expected updates to succeed: %v", err)
	}

	if updates["status"] != models.TaskStatusCompleted {
		t.Fatalf("expected completed status, got %#v", updates["status"])
	}
	meta, ok := updates["meta"].(string)
	if !ok || meta == "" {
		t.Fatalf("expected completion meta json, got %#v", updates["meta"])
	}
}
