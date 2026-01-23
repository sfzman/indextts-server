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
	Text              string   `json:"text" binding:"required,min=1,max=5000"`
	ReferenceAudioURL string   `json:"reference_audio_url" binding:"required,url"`
	EmotionMode       string   `json:"emotion_mode" binding:"required,oneof=same_as_reference emotion_prompt emotion_vector emotion_text"`
	EmotionPromptURL  string   `json:"emotion_prompt_url" binding:"omitempty,url"`
	EmotionVector     []float64 `json:"emotion_vector" binding:"omitempty,len=8"`
	EmotionAlpha      *float64 `json:"emotion_alpha" binding:"omitempty,min=0,max=2"`
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

	// Validate emotion mode parameters
	switch models.EmotionMode(req.EmotionMode) {
	case models.EmotionModePrompt:
		if req.EmotionPromptURL == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "emotion_prompt_url is required when emotion_mode is emotion_prompt",
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
		ID:                uuid.New().String(),
		Status:            models.TaskStatusPending,
		Text:              req.Text,
		ReferenceAudioURL: req.ReferenceAudioURL,
		EmotionMode:       models.EmotionMode(req.EmotionMode),
		EmotionPromptURL:  req.EmotionPromptURL,
		EmotionAlpha:      req.EmotionAlpha,
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

	c.JSON(http.StatusOK, task)
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

	c.JSON(http.StatusOK, gin.H{
		"tasks":     tasks,
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
