package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"backend-server/models"

	"github.com/google/uuid"
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

	// Get signed URL for reference audio
	var refFile models.File
	if err := models.DB.First(&refFile, "id = ?", task.ReferenceAudioFileID).Error; err != nil {
		log.Printf("Task %s failed: reference audio file not found", task.ID)
		models.DB.Model(&task).Updates(map[string]interface{}{
			"status":        models.TaskStatusFailed,
			"error_message": "Reference audio file not found",
		})
		return
	}

	refAudioURL, err := GetSignedURL(refFile.OSSKey, 3600)
	if err != nil {
		log.Printf("Task %s failed to get signed URL for reference audio: %v", task.ID, err)
		models.DB.Model(&task).Updates(map[string]interface{}{
			"status":        models.TaskStatusFailed,
			"error_message": "Failed to get signed URL for reference audio: " + err.Error(),
		})
		return
	}

	// Build inference request
	req := &TTSRequest{
		Text:           task.Text,
		ReferenceAudio: refAudioURL,
	}

	// Set emotion parameters based on mode
	switch task.EmotionMode {
	case models.EmotionModeSameAsReference:
		// No additional parameters needed
	case models.EmotionModePrompt:
		// Get signed URL for emotion prompt
		var emotionFile models.File
		if err := models.DB.First(&emotionFile, "id = ?", task.EmotionPromptFileID).Error; err != nil {
			log.Printf("Task %s failed: emotion prompt file not found", task.ID)
			models.DB.Model(&task).Updates(map[string]interface{}{
				"status":        models.TaskStatusFailed,
				"error_message": "Emotion prompt file not found",
			})
			return
		}
		emotionURL, err := GetSignedURL(emotionFile.OSSKey, 3600)
		if err != nil {
			log.Printf("Task %s failed to get signed URL for emotion prompt: %v", task.ID, err)
			models.DB.Model(&task).Updates(map[string]interface{}{
				"status":        models.TaskStatusFailed,
				"error_message": "Failed to get signed URL for emotion prompt: " + err.Error(),
			})
			return
		}
		req.EmotionPrompt = emotionURL
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

	// Upload result to OSS (returns OSS key, not URL)
	resultOSSKey, err := UploadBytes(audioData, "result.wav", "audio/wav")
	if err != nil {
		log.Printf("Task %s failed to upload result: %v", task.ID, err)
		models.DB.Model(&task).Updates(map[string]interface{}{
			"status":        models.TaskStatusFailed,
			"error_message": "Failed to upload result: " + err.Error(),
		})
		return
	}

	// Create file record for the result audio
	resultFile := models.File{
		ID:          uuid.New().String(),
		Filename:    fmt.Sprintf("result_%s.wav", task.ID),
		OSSKey:      resultOSSKey,
		ContentType: "audio/wav",
		Size:        int64(len(audioData)),
	}
	if err := models.DB.Create(&resultFile).Error; err != nil {
		log.Printf("Task %s failed to create file record: %v", task.ID, err)
		models.DB.Model(&task).Updates(map[string]interface{}{
			"status":        models.TaskStatusFailed,
			"error_message": "Failed to create file record: " + err.Error(),
		})
		return
	}

	// Mark as completed with file ID
	models.DB.Model(&task).Updates(map[string]interface{}{
		"status":               models.TaskStatusCompleted,
		"result_audio_file_id": resultFile.ID,
	})

	log.Printf("Task %s completed successfully, result file: %s", task.ID, resultFile.ID)
}
