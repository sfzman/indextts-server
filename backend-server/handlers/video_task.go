package handlers

import (
	"fmt"
	"net/http"
	"slices"
	"strings"

	"backend-server/middleware"
	"backend-server/models"
	"backend-server/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// CreateVideoTaskRequest is the create request body for one video generation task.
type CreateVideoTaskRequest struct {
	Model          string `json:"model" binding:"required"`
	Prompt         string `json:"prompt" binding:"required,min=1,max=5000"`
	NegativePrompt string `json:"negative_prompt" binding:"max=2000"`
	Template       string `json:"template" binding:"max=128"`

	ImageFileID    string `json:"image_file_id" binding:"omitempty,len=36"`
	ImageURL       string `json:"image_url"`
	EndFrameFileID string `json:"end_frame_file_id" binding:"omitempty,len=36"`

	AudioFileID string `json:"audio_file_id" binding:"omitempty,len=36"`
	AudioURL    string `json:"audio_url"`

	Resolution   string `json:"resolution" binding:"omitempty"`
	Duration     *int   `json:"duration" binding:"omitempty,min=1,max=30"`
	PromptExtend *bool  `json:"prompt_extend"`
	Audio        *bool  `json:"audio"`
	Seed         *int64 `json:"seed"`
	Watermark    *bool  `json:"watermark"`
}

// VideoTaskResponse is returned by get/list APIs.
type VideoTaskResponse struct {
	ID     string                 `json:"id"`
	Status models.TaskStatus      `json:"status"`
	Model  string                 `json:"model"`
	Prompt string                 `json:"prompt"`
	Meta   map[string]interface{} `json:"meta,omitempty"`

	NegativePrompt    string `json:"negative_prompt,omitempty"`
	Template          string `json:"template,omitempty"`
	ImageFileID       string `json:"image_file_id,omitempty"`
	ImageURL          string `json:"image_url,omitempty"`
	EndFrameFileID    string `json:"end_frame_file_id,omitempty"`
	AudioFileID       string `json:"audio_file_id,omitempty"`
	AudioURL          string `json:"audio_url,omitempty"`
	Resolution        string `json:"resolution,omitempty"`
	Duration          *int   `json:"duration,omitempty"`
	PromptExtend      *bool  `json:"prompt_extend,omitempty"`
	Audio             *bool  `json:"audio,omitempty"`
	Seed              *int64 `json:"seed,omitempty"`
	Watermark         *bool  `json:"watermark,omitempty"`
	ResultVideoFileID string `json:"result_video_file_id,omitempty"`
	ErrorMessage      string `json:"error_message,omitempty"`
	ProviderTaskID    string `json:"provider_task_id,omitempty"`
	ProviderStatus    string `json:"provider_status,omitempty"`
	ProviderMessage   string `json:"provider_message,omitempty"`
	CreatedAt         string `json:"created_at"`
	UpdatedAt         string `json:"updated_at"`
}

func buildVideoTaskResponse(task models.VideoTask) VideoTaskResponse {
	meta := task.GetMetaMap()

	return VideoTaskResponse{
		ID:                task.ID,
		Status:            task.Status,
		Model:             task.Model,
		Prompt:            task.Prompt,
		Meta:              meta,
		NegativePrompt:    getMetaString(meta, "negative_prompt"),
		Template:          getMetaString(meta, "template"),
		ImageFileID:       getMetaString(meta, "image_file_id"),
		ImageURL:          getMetaString(meta, "image_url"),
		EndFrameFileID:    getMetaString(meta, "end_frame_file_id"),
		AudioFileID:       getMetaString(meta, "audio_file_id"),
		AudioURL:          getMetaString(meta, "audio_url"),
		Resolution:        getMetaString(meta, "resolution"),
		Duration:          getMetaIntPointer(meta, "duration"),
		PromptExtend:      getMetaBoolPointer(meta, "prompt_extend"),
		Audio:             getMetaBoolPointer(meta, "audio"),
		Seed:              getMetaInt64Pointer(meta, "seed"),
		Watermark:         getMetaBoolPointer(meta, "watermark"),
		ResultVideoFileID: task.ResultVideoFileID,
		ErrorMessage:      task.ErrorMessage,
		ProviderTaskID:    task.ProviderTaskID,
		ProviderStatus:    getMetaString(meta, "provider_status"),
		ProviderMessage:   getMetaString(meta, "provider_message"),
		CreatedAt:         task.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:         task.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// CreateVideoTask creates one new video generation task.
func CreateVideoTask(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	var req CreateVideoTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request: " + err.Error(),
		})
		return
	}

	if !services.IsSupportedVideoModel(req.Model) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Unsupported model",
		})
		return
	}

	modelDef, _ := services.GetVideoModelDefinition(req.Model)
	if err := validateVideoTaskRequest(modelDef, req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	hasCredits, err := services.CheckCredits(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to check credits",
		})
		return
	}
	if !hasCredits {
		c.JSON(http.StatusPaymentRequired, gin.H{
			"error": "Insufficient credits",
		})
		return
	}

	imageFilename := ""
	endFrameFilename := ""
	audioFilename := ""
	imageURL := ""
	audioURL := ""

	if strings.TrimSpace(req.ImageFileID) != "" {
		var imageFile models.File
		if err := models.DB.First(&imageFile, "id = ? AND user_id = ?", req.ImageFileID, userID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Image file not found",
			})
			return
		}

		signedImageURL, err := services.GetSignedURL(imageFile.OSSKey, 86400)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to sign image URL: " + err.Error(),
			})
			return
		}
		imageURL = signedImageURL
		imageFilename = imageFile.Filename
	} else {
		imageURL = strings.TrimSpace(req.ImageURL)
	}

	if strings.TrimSpace(req.EndFrameFileID) != "" {
		var endFrameFile models.File
		if err := models.DB.First(&endFrameFile, "id = ? AND user_id = ?", req.EndFrameFileID, userID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "End frame file not found",
			})
			return
		}
		endFrameFilename = endFrameFile.Filename
	}

	if strings.TrimSpace(req.AudioFileID) != "" {
		var audioFile models.File
		if err := models.DB.First(&audioFile, "id = ? AND user_id = ?", req.AudioFileID, userID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Audio file not found",
			})
			return
		}

		signedAudioURL, err := services.GetSignedURL(audioFile.OSSKey, 86400)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to sign audio URL: " + err.Error(),
			})
			return
		}
		audioURL = signedAudioURL
		audioFilename = audioFile.Filename
	} else if strings.TrimSpace(req.AudioURL) != "" {
		audioURL = strings.TrimSpace(req.AudioURL)
	}

	provider, err := services.GetVideoProvider(req.Model)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	upstreamResp, err := provider.Submit(&services.VideoProviderSubmitRequest{
		ModelCode:      req.Model,
		Prompt:         strings.TrimSpace(req.Prompt),
		NegativePrompt: strings.TrimSpace(req.NegativePrompt),
		Template:       strings.TrimSpace(req.Template),
		ImageURL:       imageURL,
		AudioURL:       audioURL,
		Resolution:     strings.TrimSpace(req.Resolution),
		Duration:       req.Duration,
		PromptExtend:   req.PromptExtend,
		Audio:          req.Audio,
		Seed:           req.Seed,
		Watermark:      req.Watermark,
	})
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"error": "Failed to submit video task: " + err.Error(),
		})
		return
	}

	initialStatus := provider.MapStatus(upstreamResp.Status)
	if initialStatus != models.TaskStatusFailed && strings.TrimSpace(upstreamResp.TaskID) == "" {
		c.JSON(http.StatusBadGateway, gin.H{
			"error": "Provider did not return task_id",
		})
		return
	}
	// Keep task in polling queue even if provider says SUCCEEDED immediately.
	if initialStatus == models.TaskStatusCompleted {
		initialStatus = models.TaskStatusProcessing
	}

	task := models.VideoTask{
		ID:             uuid.New().String(),
		UserID:         userID,
		Status:         initialStatus,
		Model:          req.Model,
		Prompt:         strings.TrimSpace(req.Prompt),
		ProviderTaskID: upstreamResp.TaskID,
	}

	meta := map[string]interface{}{
		"negative_prompt":     strings.TrimSpace(req.NegativePrompt),
		"template":            strings.TrimSpace(req.Template),
		"image_file_id":       strings.TrimSpace(req.ImageFileID),
		"image_url":           strings.TrimSpace(req.ImageURL),
		"image_filename":      imageFilename,
		"end_frame_file_id":   strings.TrimSpace(req.EndFrameFileID),
		"end_frame_filename":  endFrameFilename,
		"audio_file_id":       strings.TrimSpace(req.AudioFileID),
		"audio_url":           strings.TrimSpace(req.AudioURL),
		"audio_filename":      audioFilename,
		"resolution":          req.Resolution,
		"duration":            req.Duration,
		"prompt_extend":       req.PromptExtend,
		"audio":               req.Audio,
		"seed":                req.Seed,
		"watermark":           req.Watermark,
		"provider":            provider.Name(),
		"provider_request_id": upstreamResp.RequestID,
		"provider_status":     upstreamResp.Status,
		"provider_message":    upstreamResp.Message,
	}
	for key, value := range upstreamResp.RawMeta {
		meta[key] = value
	}
	if err := task.SetMetaMap(compactMeta(meta)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to serialize video task metadata: " + err.Error(),
		})
		return
	}

	// If upstream returns immediate failure, we still keep local failed task for visibility.
	if task.Status == models.TaskStatusFailed {
		task.ErrorMessage = firstNonEmpty(upstreamResp.Message, "Video task failed at provider")
	}

	if err := models.DB.Create(&task).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create video task: " + err.Error(),
		})
		return
	}

	// Deduct credits for accepted tasks.
	if task.Status != models.TaskStatusFailed {
		_ = services.DeductCreditsWithRemark(userID, task.ID, "Video task consumption")
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":               task.ID,
		"status":           task.Status,
		"provider_task_id": task.ProviderTaskID,
		"created_at":       task.CreatedAt,
	})
}

func validateVideoTaskRequest(modelDef services.VideoModelDefinition, req CreateVideoTaskRequest) error {
	hasFirstFrame := strings.TrimSpace(req.ImageFileID) != "" || strings.TrimSpace(req.ImageURL) != ""
	hasEndFrame := strings.TrimSpace(req.EndFrameFileID) != ""
	hasAudio := strings.TrimSpace(req.AudioFileID) != "" || strings.TrimSpace(req.AudioURL) != ""

	if !modelDef.SupportsFirstFrame && hasFirstFrame {
		return fmt.Errorf("current model does not support first frame input")
	}
	if modelDef.SupportsFirstFrame && !modelDef.SupportsTextOnly && !hasFirstFrame {
		return fmt.Errorf("image_file_id or image_url is required")
	}
	if hasEndFrame && !modelDef.SupportsEndFrame {
		return fmt.Errorf("current model does not support end frame input")
	}
	if hasAudio && !modelDef.SupportsAudio {
		return fmt.Errorf("current model does not support audio input")
	}

	resolution := strings.TrimSpace(req.Resolution)
	if resolution != "" {
		if !slices.Contains(modelDef.Resolutions, resolution) {
			return fmt.Errorf("current model does not support resolution %s", resolution)
		}
	}

	if req.Duration != nil {
		if resolution == "" {
			return fmt.Errorf("resolution is required when duration is specified")
		}

		durationOptions, ok := modelDef.DurationOptionsByResolution[resolution]
		if !ok || !slices.Contains(durationOptions, *req.Duration) {
			return fmt.Errorf("%s only supports durations %v", resolution, durationOptions)
		}
	}

	return nil
}

// GetVideoTask returns task detail.
func GetVideoTask(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	taskID := c.Param("id")
	var task models.VideoTask
	if err := models.DB.First(&task, "id = ? AND user_id = ?", taskID, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Video task not found",
		})
		return
	}

	c.JSON(http.StatusOK, buildVideoTaskResponse(task))
}

// ListVideoTasks lists current user's video tasks with pagination.
func ListVideoTasks(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	page := 1
	pageSize := 20

	if p := c.Query("page"); p != "" {
		v := int(jsonNumber(p))
		if v > 0 {
			page = v
		}
	}
	if ps := c.Query("page_size"); ps != "" {
		v := int(jsonNumber(ps))
		if v > 0 && v <= 100 {
			pageSize = v
		}
	}

	query := models.DB.Model(&models.VideoTask{}).Where("user_id = ?", userID)
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var tasks []models.VideoTask
	offset := (page - 1) * pageSize
	query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&tasks)

	items := make([]VideoTaskResponse, len(tasks))
	for i, task := range tasks {
		items[i] = buildVideoTaskResponse(task)
	}

	c.JSON(http.StatusOK, gin.H{
		"tasks":     items,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// DeleteVideoTask deletes one video task by ID.
func DeleteVideoTask(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	taskID := c.Param("id")
	result := models.DB.Where("id = ? AND user_id = ?", taskID, userID).Delete(&models.VideoTask{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete video task: " + result.Error.Error(),
		})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Video task not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":      taskID,
		"deleted": true,
	})
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func compactMeta(input map[string]interface{}) map[string]interface{} {
	if len(input) == 0 {
		return map[string]interface{}{}
	}

	result := make(map[string]interface{}, len(input))
	for k, v := range input {
		switch value := v.(type) {
		case nil:
			continue
		case string:
			if strings.TrimSpace(value) == "" {
				continue
			}
			result[k] = strings.TrimSpace(value)
		case *string:
			if value == nil || strings.TrimSpace(*value) == "" {
				continue
			}
			result[k] = strings.TrimSpace(*value)
		case *int:
			if value == nil {
				continue
			}
			result[k] = *value
		case *int64:
			if value == nil {
				continue
			}
			result[k] = *value
		case *bool:
			if value == nil {
				continue
			}
			result[k] = *value
		default:
			result[k] = value
		}
	}

	return result
}

func getMetaString(meta map[string]interface{}, key string) string {
	value, ok := meta[key]
	if !ok || value == nil {
		return ""
	}
	if s, ok := value.(string); ok {
		return s
	}
	return ""
}

func getMetaBoolPointer(meta map[string]interface{}, key string) *bool {
	value, ok := meta[key]
	if !ok || value == nil {
		return nil
	}
	if b, ok := value.(bool); ok {
		result := b
		return &result
	}
	return nil
}

func getMetaIntPointer(meta map[string]interface{}, key string) *int {
	value, ok := meta[key]
	if !ok || value == nil {
		return nil
	}
	switch n := value.(type) {
	case float64:
		result := int(n)
		return &result
	case int:
		result := n
		return &result
	}
	return nil
}

func getMetaInt64Pointer(meta map[string]interface{}, key string) *int64 {
	value, ok := meta[key]
	if !ok || value == nil {
		return nil
	}
	switch n := value.(type) {
	case float64:
		result := int64(n)
		return &result
	case int64:
		result := n
		return &result
	case int:
		result := int64(n)
		return &result
	}
	return nil
}
