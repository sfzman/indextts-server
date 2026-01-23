package models

import (
	"time"

	"gorm.io/gorm"
)

// File represents an uploaded file stored in OSS
type File struct {
	ID          string         `gorm:"type:varchar(36);primaryKey" json:"id"`
	Filename    string         `gorm:"type:varchar(255);not null" json:"filename"`
	OSSKey      string         `gorm:"type:varchar(512);not null;uniqueIndex" json:"oss_key"`
	ContentType string         `gorm:"type:varchar(100);not null" json:"content_type"`
	Size        int64          `gorm:"type:bigint;not null" json:"size"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for File
func (File) TableName() string {
	return "files"
}
