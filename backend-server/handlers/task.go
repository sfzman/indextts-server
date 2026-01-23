package handlers

import (
	"encoding/json"
	"net/http"

	"backend-server/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// CreateTaskRequest represents the request to create a new task
type CreateTaskRequest struct {
	Text                 string    `json:"text" binding:"required,min=1,max=5000"`
	ReferenceAudioFileID string    `json:"reference_audio_file_id" binding:"required,len=36"`
	EmotionMode          string    `json:"emotion_mode" binding:"required,oneof=same_as_reference emotion_prompt emotion_vector emotion_text"`
	EmotionPromptFileID  string    `json:"emotion_prompt_file_id" binding:"omitempty,len=36"`
	EmotionVector        []float64 `json:"emotion_vector" binding:"omitempty,len=8"`
	EmotionAlpha         *float64  `json:"emotion_alpha" binding:"omitempty,min=0,max=1"`
}

// CreateTask creates a new TTS task
func CreateTask(c *gin.Context) {
	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request: " + err.Error(),
		})
		return
	}

	// Validate reference audio file exists
	var refFile models.File
	if err := models.DB.First(&refFile, "id = ?", req.ReferenceAudioFileID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Reference audio file not found",
		})
		return
	}

	// Validate emotion mode parameters
	switch models.EmotionMode(req.EmotionMode) {
	case models.EmotionModePrompt:
		if req.EmotionPromptFileID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "emotion_prompt_file_id is required when emotion_mode is emotion_prompt",
			})
			return
		}
		// Validate emotion prompt file exists
		var emotionFile models.File
		if err := models.DB.First(&emotionFile, "id = ?", req.EmotionPromptFileID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Emotion prompt file not found",
			})
			return
		}
	case models.EmotionModeVector:
		if len(req.EmotionVector) != 8 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "emotion_vector must have exactly 8 elements when emotion_mode is emotion_vector",
			})
			return
		}
		// Validate vector values
		for i, v := range req.EmotionVector {
			if v < 0 || v > 1 {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "emotion_vector values must be between 0 and 1",
					"index": i,
				})
				return
			}
		}
	}

	// Create task
	task := models.Task{
		ID:                   uuid.New().String(),
		Status:               models.TaskStatusPending,
		Text:                 req.Text,
		ReferenceAudioFileID: req.ReferenceAudioFileID,
		EmotionMode:          models.EmotionMode(req.EmotionMode),
		EmotionPromptFileID:  req.EmotionPromptFileID,
		EmotionAlpha:         req.EmotionAlpha,
	}

	// Store emotion vector as JSON string
	if len(req.EmotionVector) > 0 {
		vectorJSON, _ := json.Marshal(req.EmotionVector)
		task.EmotionVector = string(vectorJSON)
	}

	// Save to database
	if err := models.DB.Create(&task).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create task: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":         task.ID,
		"status":     task.Status,
		"created_at": task.CreatedAt,
	})
}

// TaskResponse represents the response for a task
type TaskResponse struct {
	ID                   string             `json:"id"`
	Status               models.TaskStatus  `json:"status"`
	Text                 string             `json:"text"`
	ReferenceAudioFileID string             `json:"reference_audio_file_id"`
	EmotionMode          models.EmotionMode `json:"emotion_mode"`
	EmotionPromptFileID  string             `json:"emotion_prompt_file_id,omitempty"`
	EmotionVector        string             `json:"emotion_vector,omitempty"`
	EmotionAlpha         *float64           `json:"emotion_alpha,omitempty"`
	ResultAudioFileID    string             `json:"result_audio_file_id,omitempty"`
	ErrorMessage         string             `json:"error_message,omitempty"`
	CreatedAt            string             `json:"created_at"`
	UpdatedAt            string             `json:"updated_at"`
}

// GetTask retrieves a task by ID
func GetTask(c *gin.Context) {
	id := c.Param("id")

	var task models.Task
	if err := models.DB.First(&task, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Task not found",
		})
		return
	}

	// Build response with file IDs (no sensitive OSS keys)
	resp := TaskResponse{
		ID:                   task.ID,
		Status:               task.Status,
		Text:                 task.Text,
		ReferenceAudioFileID: task.ReferenceAudioFileID,
		EmotionMode:          task.EmotionMode,
		EmotionPromptFileID:  task.EmotionPromptFileID,
		EmotionVector:        task.EmotionVector,
		EmotionAlpha:         task.EmotionAlpha,
		ResultAudioFileID:    task.ResultAudioFileID,
		ErrorMessage:         task.ErrorMessage,
		CreatedAt:            task.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:            task.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	c.JSON(http.StatusOK, resp)
}

// TaskListItem represents a task item in list response (without sensitive data)
type TaskListItem struct {
	ID                   string             `json:"id"`
	Status               models.TaskStatus  `json:"status"`
	Text                 string             `json:"text"`
	ReferenceAudioFileID string             `json:"reference_audio_file_id"`
	EmotionMode          models.EmotionMode `json:"emotion_mode"`
	EmotionPromptFileID  string             `json:"emotion_prompt_file_id,omitempty"`
	ResultAudioFileID    string             `json:"result_audio_file_id,omitempty"`
	ErrorMessage         string             `json:"error_message,omitempty"`
	CreatedAt            string             `json:"created_at"`
	UpdatedAt            string             `json:"updated_at"`
}

// ListTasks lists tasks with pagination
func ListTasks(c *gin.Context) {
	var tasks []models.Task

	// Pagination
	page := 1
	pageSize := 20

	if p, exists := c.GetQuery("page"); exists {
		var v int
		if _, err := json.Number(p).Int64(); err == nil {
			v = int(jsonNumber(p))
			if v > 0 {
				page = v
			}
		}
	}

	if ps, exists := c.GetQuery("page_size"); exists {
		var v int
		if _, err := json.Number(ps).Int64(); err == nil {
			v = int(jsonNumber(ps))
			if v > 0 && v <= 100 {
				pageSize = v
			}
		}
	}

	offset := (page - 1) * pageSize

	// Query with optional status filter
	query := models.DB.Model(&models.Task{})
	if status, exists := c.GetQuery("status"); exists {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&tasks)

	// Convert to response items (without sensitive OSS keys)
	items := make([]TaskListItem, len(tasks))
	for i, task := range tasks {
		items[i] = TaskListItem{
			ID:                   task.ID,
			Status:               task.Status,
			Text:                 task.Text,
			ReferenceAudioFileID: task.ReferenceAudioFileID,
			EmotionMode:          task.EmotionMode,
			EmotionPromptFileID:  task.EmotionPromptFileID,
			ResultAudioFileID:    task.ResultAudioFileID,
			ErrorMessage:         task.ErrorMessage,
			CreatedAt:            task.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			UpdatedAt:            task.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"tasks":     items,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// helper function to parse json number
func jsonNumber(s string) int64 {
	n, _ := json.Number(s).Int64()
	return n
}
