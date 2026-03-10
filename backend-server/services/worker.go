package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
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
			w.processNextVideoTask()
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

	// Create file record for the result audio (inherit user_id from task)
	resultFile := models.File{
		ID:          uuid.New().String(),
		UserID:      task.UserID,
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

func (w *Worker) processNextVideoTask() {
	var task models.VideoTask
	result := models.DB.
		Where("status IN ? AND provider_task_id <> ''", []models.TaskStatus{models.TaskStatusPending, models.TaskStatusProcessing}).
		Order("created_at ASC").
		First(&task)
	if result.Error != nil {
		return
	}

	log.Printf("Polling video task %s (provider task=%s)", task.ID, task.ProviderTaskID)
	provider, err := GetVideoProvider(task.Model)
	if err != nil {
		log.Printf("Video task %s provider lookup failed: %v", task.ID, err)
		models.DB.Model(&task).Updates(map[string]interface{}{
			"status":        models.TaskStatusFailed,
			"error_message": "Unsupported video provider: " + err.Error(),
		})
		return
	}

	providerResp, err := provider.Query(task.ProviderTaskID)
	if err != nil {
		log.Printf("Video task %s polling failed: %v", task.ID, err)
		meta := task.GetMetaMap()
		meta["provider_message"] = err.Error()
		updateTaskMetaOnly(&task, meta)
		return
	}

	updates, err := buildVideoTaskProviderUpdates(task, providerResp)
	if err != nil {
		log.Printf("Video task %s failed to serialize metadata: %v", task.ID, err)
		models.DB.Model(&task).Updates(map[string]interface{}{
			"status":        models.TaskStatusFailed,
			"error_message": "Failed to serialize video metadata",
		})
		return
	}

	nextStatus, _ := updates["status"].(models.TaskStatus)
	if nextStatus == models.TaskStatusFailed {
		models.DB.Model(&task).Updates(updates)
		return
	}

	if nextStatus != models.TaskStatusCompleted {
		models.DB.Model(&task).Updates(updates)
		return
	}

	if providerResp.ResultURL == "" {
		updates["status"] = models.TaskStatusFailed
		updates["error_message"] = "Provider returned SUCCEEDED but no video_url"
		models.DB.Model(&task).Updates(updates)
		return
	}

	videoData, contentType, err := downloadRemoteFile(providerResp.ResultURL)
	if err != nil {
		log.Printf("Video task %s failed to download provider result: %v", task.ID, err)
		updates["status"] = models.TaskStatusFailed
		updates["error_message"] = "Failed to download generated video: " + err.Error()
		models.DB.Model(&task).Updates(updates)
		return
	}

	if contentType == "" {
		contentType = "video/mp4"
	}

	resultOSSKey, err := UploadBytes(videoData, fmt.Sprintf("video_%s.mp4", task.ID), contentType)
	if err != nil {
		log.Printf("Video task %s failed to upload result: %v", task.ID, err)
		updates["status"] = models.TaskStatusFailed
		updates["error_message"] = "Failed to upload generated video: " + err.Error()
		models.DB.Model(&task).Updates(updates)
		return
	}

	resultFile := models.File{
		ID:          uuid.New().String(),
		UserID:      task.UserID,
		Filename:    fmt.Sprintf("video_%s.mp4", task.ID),
		OSSKey:      resultOSSKey,
		ContentType: contentType,
		Size:        int64(len(videoData)),
	}
	if err := models.DB.Create(&resultFile).Error; err != nil {
		log.Printf("Video task %s failed to create file record: %v", task.ID, err)
		updates["status"] = models.TaskStatusFailed
		updates["error_message"] = "Failed to create result file record: " + err.Error()
		models.DB.Model(&task).Updates(updates)
		return
	}

	updates["status"] = models.TaskStatusCompleted
	updates["result_video_file_id"] = resultFile.ID
	updates["error_message"] = ""
	models.DB.Model(&task).Updates(updates)

	log.Printf("Video task %s completed successfully, result file: %s", task.ID, resultFile.ID)
}

func buildVideoTaskProviderUpdates(task models.VideoTask, result *VideoProviderTaskResult) (map[string]interface{}, error) {
	provider, err := GetVideoProvider(task.Model)
	if err != nil {
		return nil, err
	}

	meta := task.GetMetaMap()
	meta["provider"] = provider.Name()
	meta["provider_status"] = result.Status
	meta["provider_message"] = result.Message
	if result.RequestID != "" {
		meta["provider_request_id"] = result.RequestID
	}
	if result.ResultURL != "" {
		meta["provider_result_url"] = result.ResultURL
	}
	for key, value := range result.RawMeta {
		meta[key] = value
	}

	metaJSON, err := marshalTaskMeta(meta)
	if err != nil {
		return nil, err
	}

	updates := map[string]interface{}{
		"status": provider.MapStatus(result.Status),
		"meta":   metaJSON,
	}
	if updates["status"] == models.TaskStatusFailed {
		updates["error_message"] = firstNonEmptyString(result.Message, "Video generation failed")
	}

	return updates, nil
}

func downloadRemoteFile(url string) ([]byte, string, error) {
	client := &http.Client{Timeout: 10 * time.Minute}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, "", err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return nil, "", fmt.Errorf("status %d: %s", resp.StatusCode, string(body))
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}

	return data, resp.Header.Get("Content-Type"), nil
}

func firstNonEmptyString(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func marshalTaskMeta(meta map[string]interface{}) (string, error) {
	cleaned := compactTaskMeta(meta)
	if len(cleaned) == 0 {
		return "", nil
	}
	raw, err := json.Marshal(cleaned)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func updateTaskMetaOnly(task *models.VideoTask, meta map[string]interface{}) {
	metaJSON, err := marshalTaskMeta(meta)
	if err != nil {
		return
	}
	models.DB.Model(task).Update("meta", metaJSON)
}

func compactTaskMeta(input map[string]interface{}) map[string]interface{} {
	if len(input) == 0 {
		return map[string]interface{}{}
	}
	result := make(map[string]interface{}, len(input))
	for k, v := range input {
		if v == nil {
			continue
		}
		if s, ok := v.(string); ok {
			if s == "" {
				continue
			}
			result[k] = s
			continue
		}
		result[k] = v
	}
	return result
}
