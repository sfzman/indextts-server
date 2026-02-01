package services

import (
	"errors"
	"fmt"

	"backend-server/config"
	"backend-server/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IsPhoneWhitelisted checks if a phone number is in the whitelist
func IsPhoneWhitelisted(phone string) bool {
	for _, p := range config.Cfg.PhoneWhitelist {
		if p == phone {
			return true
		}
	}
	return false
}

// DeductCredits deducts credits from user for a task
// Returns error if insufficient credits
// Skips deduction for whitelisted users
func DeductCredits(userID, taskID string) error {
	// Get user
	var user models.User
	if err := models.DB.First(&user, "id = ?", userID).Error; err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Check if user is whitelisted
	if IsPhoneWhitelisted(user.Phone) {
		return nil
	}

	creditsToDeduct := config.Cfg.CreditsPerTask

	// Check if user has enough credits
	if user.Credits < creditsToDeduct {
		return errors.New("insufficient credits")
	}

	// Deduct credits using transaction
	return models.DB.Transaction(func(tx *gorm.DB) error {
		// Lock the user row and deduct credits
		result := tx.Model(&models.User{}).
			Where("id = ? AND credits >= ?", userID, creditsToDeduct).
			Update("credits", gorm.Expr("credits - ?", creditsToDeduct))

		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("insufficient credits")
		}

		// Get updated balance
		var updatedUser models.User
		if err := tx.First(&updatedUser, "id = ?", userID).Error; err != nil {
			return err
		}

		// Record credit log
		creditLog := models.CreditLog{
			ID:      uuid.New().String(),
			UserID:  userID,
			Amount:  -creditsToDeduct,
			Balance: updatedUser.Credits,
			Type:    "consume",
			RefID:   taskID,
			Remark:  "TTS task consumption",
		}
		return tx.Create(&creditLog).Error
	})
}

// AddCredits adds credits to user (for recharge)
func AddCredits(userID string, amount int, orderID, remark string) error {
	return models.DB.Transaction(func(tx *gorm.DB) error {
		// Add credits
		result := tx.Model(&models.User{}).
			Where("id = ?", userID).
			Update("credits", gorm.Expr("credits + ?", amount))

		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("user not found")
		}

		// Get updated balance
		var user models.User
		if err := tx.First(&user, "id = ?", userID).Error; err != nil {
			return err
		}

		// Record credit log
		creditLog := models.CreditLog{
			ID:      uuid.New().String(),
			UserID:  userID,
			Amount:  amount,
			Balance: user.Credits,
			Type:    "recharge",
			RefID:   orderID,
			Remark:  remark,
		}
		return tx.Create(&creditLog).Error
	})
}

// GetUserCredits returns user's current credits
func GetUserCredits(userID string) (int, error) {
	var user models.User
	if err := models.DB.First(&user, "id = ?", userID).Error; err != nil {
		return 0, err
	}
	return user.Credits, nil
}

// CheckCredits checks if user has enough credits for a task
// Returns true if user is whitelisted or has enough credits
func CheckCredits(userID string) (bool, error) {
	var user models.User
	if err := models.DB.First(&user, "id = ?", userID).Error; err != nil {
		return false, err
	}

	// Whitelisted users always have "enough" credits
	if IsPhoneWhitelisted(user.Phone) {
		return true, nil
	}

	return user.Credits >= config.Cfg.CreditsPerTask, nil
}
