package models

import (
	"time"
)

// CodePurpose represents the purpose of a verification code
type CodePurpose string

const (
	CodePurposeLogin CodePurpose = "login"
)

// VerificationCode represents a SMS verification code
type VerificationCode struct {
	ID        string      `gorm:"type:varchar(36);primaryKey" json:"id"`
	Phone     string      `gorm:"type:varchar(20);index;not null" json:"phone"`
	Code      string      `gorm:"type:varchar(6);not null" json:"code"`
	Purpose   CodePurpose `gorm:"type:varchar(20);default:login" json:"purpose"`
	Used      bool        `gorm:"default:false" json:"used"`
	ExpiresAt time.Time   `gorm:"not null" json:"expires_at"`
	CreatedAt time.Time   `json:"created_at"`
}

// TableName specifies the table name for VerificationCode
func (VerificationCode) TableName() string {
	return "verification_codes"
}

// IsExpired checks if the verification code has expired
func (v *VerificationCode) IsExpired() bool {
	return time.Now().After(v.ExpiresAt)
}

// IsValid checks if the verification code is valid (not used and not expired)
func (v *VerificationCode) IsValid() bool {
	return !v.Used && !v.IsExpired()
}
