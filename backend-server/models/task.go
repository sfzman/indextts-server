package models

import (
	"time"

	"gorm.io/gorm"
)

// TaskStatus represents the status of a TTS task
type TaskStatus string

const (
	TaskStatusPending    TaskStatus = "pending"
	TaskStatusProcessing TaskStatus = "processing"
	TaskStatusCompleted  TaskStatus = "completed"
	TaskStatusFailed     TaskStatus = "failed"
)

// EmotionMode represents how emotion is controlled
type EmotionMode string

const (
	EmotionModeSameAsReference EmotionMode = "same_as_reference" // Use same emotion as reference audio
	EmotionModePrompt          EmotionMode = "emotion_prompt"    // Use emotion reference audio
	EmotionModeVector          EmotionMode = "emotion_vector"    // Use emotion vector
	EmotionModeText            EmotionMode = "emotion_text"      // Auto-detect from text
)

// Task represents a TTS synthesis task
type Task struct {
	ID        string         `gorm:"type:varchar(36);primaryKey" json:"id"`
	Status    TaskStatus     `gorm:"type:varchar(20);index;default:pending" json:"status"`
	Text      string         `gorm:"type:text;not null" json:"text"`

	// Reference audio for voice cloning (required)
	ReferenceAudioURL string `gorm:"type:varchar(512);not null" json:"reference_audio_url"`

	// Emotion control
	EmotionMode      EmotionMode `gorm:"type:varchar(20);default:same_as_reference" json:"emotion_mode"`
	EmotionPromptURL string      `gorm:"type:varchar(512)" json:"emotion_prompt_url,omitempty"`
	EmotionVector    string      `gorm:"type:varchar(256)" json:"emotion_vector,omitempty"` // JSON array string [8]float
	EmotionAlpha     *float64    `gorm:"type:decimal(3,2)" json:"emotion_alpha,omitempty"`

	// Result
	ResultAudioURL string `gorm:"type:varchar(512)" json:"result_audio_url,omitempty"`
	ErrorMessage   string `gorm:"type:text" json:"error_message,omitempty"`

	// Timestamps
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for Task
func (Task) TableName() string {
	return "tasks"
}
