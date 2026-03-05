package models

import (
	"time"

	"gorm.io/gorm"
)

// FavoriteCategory represents favorite type
type FavoriteCategory string

const (
	FavoriteCategoryVoice   FavoriteCategory = "voice"
	FavoriteCategoryEmotion FavoriteCategory = "emotion"
)

// Favorite stores user favorite audio references
type Favorite struct {
	ID          string           `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID      string           `gorm:"type:varchar(36);index;not null;uniqueIndex:uniq_user_category_audio" json:"user_id"`
	Category    FavoriteCategory `gorm:"type:varchar(20);index;not null;uniqueIndex:uniq_user_category_audio" json:"category"`
	Name        string           `gorm:"type:varchar(255);not null" json:"name"`
	AudioFileID string           `gorm:"column:audio_file_id;type:varchar(36);index;not null;uniqueIndex:uniq_user_category_audio" json:"audio_file_id"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
	DeletedAt   gorm.DeletedAt   `gorm:"index" json:"-"`
}

// TableName specifies the table name for Favorite
func (Favorite) TableName() string {
	return "favorites"
}
