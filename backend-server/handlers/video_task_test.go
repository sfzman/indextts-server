package handlers

import (
	"testing"

	"backend-server/services"
)

func TestValidateVideoTaskRequest(t *testing.T) {
	wanDef, ok := services.GetVideoModelDefinition("wan2.6-i2v")
	if !ok {
		t.Fatal("expected wan model definition")
	}
	hailuoDef, ok := services.GetVideoModelDefinition("hailuo-2.3")
	if !ok {
		t.Fatal("expected hailuo model definition")
	}

	t.Run("wan requires first frame", func(t *testing.T) {
		req := CreateVideoTaskRequest{
			Model:      "wan2.6-i2v",
			Prompt:     "test",
			Resolution: "720P",
		}
		duration := 5
		req.Duration = &duration

		if err := validateVideoTaskRequest(wanDef, req); err == nil {
			t.Fatal("expected wan validation to reject missing first frame")
		}
	})

	t.Run("wan rejects end frame", func(t *testing.T) {
		req := CreateVideoTaskRequest{
			Model:          "wan2.6-i2v",
			Prompt:         "test",
			ImageURL:       "https://example.com/start.png",
			EndFrameFileID: "12345678-1234-1234-1234-123456789012",
			Resolution:     "720P",
		}
		duration := 5
		req.Duration = &duration

		if err := validateVideoTaskRequest(wanDef, req); err == nil {
			t.Fatal("expected wan validation to reject end frame")
		}
	})

	t.Run("wan accepts optional audio", func(t *testing.T) {
		req := CreateVideoTaskRequest{
			Model:      "wan2.6-i2v",
			Prompt:     "test",
			ImageURL:   "https://example.com/start.png",
			AudioURL:   "https://example.com/audio.mp3",
			Resolution: "720P",
		}
		duration := 5
		req.Duration = &duration

		if err := validateVideoTaskRequest(wanDef, req); err != nil {
			t.Fatalf("expected wan validation to accept audio: %v", err)
		}
	})

	t.Run("hailuo accepts prompt only", func(t *testing.T) {
		req := CreateVideoTaskRequest{
			Model:      "hailuo-2.3",
			Prompt:     "test",
			Resolution: "768P",
		}
		duration := 6
		req.Duration = &duration

		if err := validateVideoTaskRequest(hailuoDef, req); err != nil {
			t.Fatalf("expected hailuo validation to accept prompt-only mode: %v", err)
		}
	})

	t.Run("hailuo accepts prompt plus first frame", func(t *testing.T) {
		req := CreateVideoTaskRequest{
			Model:      "hailuo-2.3",
			Prompt:     "test",
			ImageURL:   "https://example.com/start.png",
			Resolution: "1080P",
		}
		duration := 6
		req.Duration = &duration

		if err := validateVideoTaskRequest(hailuoDef, req); err != nil {
			t.Fatalf("expected hailuo validation to accept first frame mode: %v", err)
		}
	})

	t.Run("hailuo rejects audio", func(t *testing.T) {
		req := CreateVideoTaskRequest{
			Model:      "hailuo-2.3",
			Prompt:     "test",
			AudioURL:   "https://example.com/audio.mp3",
			Resolution: "768P",
		}
		duration := 6
		req.Duration = &duration

		if err := validateVideoTaskRequest(hailuoDef, req); err == nil {
			t.Fatal("expected hailuo validation to reject audio")
		}
	})

	t.Run("hailuo rejects end frame", func(t *testing.T) {
		req := CreateVideoTaskRequest{
			Model:          "hailuo-2.3",
			Prompt:         "test",
			EndFrameFileID: "12345678-1234-1234-1234-123456789012",
			Resolution:     "768P",
		}
		duration := 6
		req.Duration = &duration

		if err := validateVideoTaskRequest(hailuoDef, req); err == nil {
			t.Fatal("expected hailuo validation to reject end frame")
		}
	})

	t.Run("hailuo rejects invalid resolution duration combinations", func(t *testing.T) {
		req := CreateVideoTaskRequest{
			Model:      "hailuo-2.3",
			Prompt:     "test",
			Resolution: "1080P",
		}
		duration := 10
		req.Duration = &duration

		if err := validateVideoTaskRequest(hailuoDef, req); err == nil {
			t.Fatal("expected hailuo validation to reject 1080P 10s")
		}
	})
}
