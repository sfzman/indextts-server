package models

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// VideoTask represents a video synthesis task.
type VideoTask struct {
	ID     string     `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID string     `gorm:"type:varchar(36);index;not null" json:"user_id"`
	Status TaskStatus `gorm:"type:varchar(20);index;default:pending" json:"status"`

	// Core display fields.
	Model  string `gorm:"type:varchar(64);not null" json:"model"`
	Prompt string `gorm:"type:text;not null" json:"prompt"`

	// Required for upstream polling.
	ProviderTaskID string `gorm:"type:varchar(128);index" json:"provider_task_id,omitempty"`

	// Provider/input/model-specific data are stored in JSON metadata for extensibility.
	Meta string `gorm:"type:json" json:"meta,omitempty"`

	ResultVideoFileID string `gorm:"type:varchar(36)" json:"result_video_file_id,omitempty"`
	ErrorMessage      string `gorm:"type:text" json:"error_message,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for VideoTask.
func (VideoTask) TableName() string {
	return "video_tasks"
}

// GetMetaMap parses JSON metadata to map.
func (t *VideoTask) GetMetaMap() map[string]interface{} {
	if t.Meta == "" {
		return map[string]interface{}{}
	}

	var data map[string]interface{}
	if err := json.Unmarshal([]byte(t.Meta), &data); err != nil {
		return map[string]interface{}{}
	}
	return data
}

// SetMetaMap serializes metadata map to JSON string.
func (t *VideoTask) SetMetaMap(data map[string]interface{}) error {
	if len(data) == 0 {
		t.Meta = ""
		return nil
	}

	raw, err := json.Marshal(data)
	if err != nil {
		return err
	}
	t.Meta = string(raw)
	return nil
}
