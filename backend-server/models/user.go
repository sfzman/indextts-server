package models

import (
	"time"

	"gorm.io/gorm"
)

// UserStatus represents the status of a user
type UserStatus string

const (
	UserStatusActive   UserStatus = "active"
	UserStatusDisabled UserStatus = "disabled"
)

// User represents a registered user
type User struct {
	ID          string         `gorm:"type:varchar(36);primaryKey" json:"id"`
	Phone       string         `gorm:"type:varchar(20);uniqueIndex;not null" json:"phone"`
	Nickname    string         `gorm:"type:varchar(100)" json:"nickname,omitempty"`
	Avatar      string         `gorm:"type:varchar(512)" json:"avatar,omitempty"`
	Status      UserStatus     `gorm:"type:varchar(20);default:active" json:"status"`
	LastLoginAt *time.Time     `json:"last_login_at,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for User
func (User) TableName() string {
	return "users"
}
