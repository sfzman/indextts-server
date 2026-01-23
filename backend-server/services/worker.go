package services

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"backend-server/models"
)

// Worker processes TTS tasks in the background
type Worker struct {
	ctx    context.Context
	cancel context.CancelFunc
}

// NewWorker creates a new worker
func NewWorker() *Worker {
	ctx, cancel := context.WithCancel(context.Background())
	return &Worker{
		ctx:    ctx,
		cancel: cancel,
	}
}

// Start begins processing tasks
func (w *Worker) Start() {
	go w.run()
}

// Stop stops the worker
func (w *Worker) Stop() {
	w.cancel()
}

func (w *Worker) run() {
	log.Println("Worker started")

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-w.ctx.Done():
			log.Println("Worker stopped")
			return
		case <-ticker.C:
			w.processNextTask()
		}
	}
}

func (w *Worker) processNextTask() {
	// Find the next pending task
	var task models.Task
	result := models.DB.Where("status = ?", models.TaskStatusPending).
		Order("created_at ASC").
		First(&task)

	if result.Error != nil {
		// No pending tasks
		return
	}

	log.Printf("Processing task %s", task.ID)

	// Mark as processing
	models.DB.Model(&task).Update("status", models.TaskStatusProcessing)

	// Build inference request
	req := &TTSRequest{
		Text:           task.Text,
		ReferenceAudio: task.ReferenceAudioURL,
	}

	// Set emotion parameters based on mode
	switch task.EmotionMode {
	case models.EmotionModeSameAsReference:
		// No additional parameters needed
	case models.EmotionModePrompt:
		req.EmotionPrompt = task.EmotionPromptURL
	case models.EmotionModeVector:
		if task.EmotionVector != "" {
			var vector []float64
			if err := json.Unmarshal([]byte(task.EmotionVector), &vector); err == nil {
				req.EmotionVector = vector
			}
		}
	case models.EmotionModeText:
		useText := true
		req.UseEmotionText = &useText
	}

	if task.EmotionAlpha != nil {
		req.EmotionAlpha = task.EmotionAlpha
	}

	// Call inference API
	audioData, err := CallInference(req)
	if err != nil {
		log.Printf("Task %s failed: %v", task.ID, err)
		models.DB.Model(&task).Updates(map[string]interface{}{
			"status":        models.TaskStatusFailed,
			"error_message": err.Error(),
		})
		return
	}

	// Upload result to OSS
	resultURL, err := UploadBytes(audioData, "result.wav", "audio/wav")
	if err != nil {
		log.Printf("Task %s failed to upload result: %v", task.ID, err)
		models.DB.Model(&task).Updates(map[string]interface{}{
			"status":        models.TaskStatusFailed,
			"error_message": "Failed to upload result: " + err.Error(),
		})
		return
	}

	// Mark as completed
	models.DB.Model(&task).Updates(map[string]interface{}{
		"status":           models.TaskStatusCompleted,
		"result_audio_url": resultURL,
	})

	log.Printf("Task %s completed successfully", task.ID)
}
