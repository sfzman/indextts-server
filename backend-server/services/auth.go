package services

import (
	"errors"
	"fmt"
	"time"

	"backend-server/config"
	"backend-server/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// UserClaims represents the JWT claims for user authentication
type UserClaims struct {
	UserID string `json:"user_id"`
	Phone  string `json:"phone"`
	jwt.RegisteredClaims
}

// GenerateUserToken generates a JWT token for the user
func GenerateUserToken(user *models.User) (string, error) {
	cfg := config.Cfg

	if cfg.AuthJWTSecret == "" {
		return "", errors.New("AUTH_JWT_SECRET is not configured")
	}

	now := time.Now()
	expiresAt := now.Add(time.Duration(cfg.AuthJWTExpireHours) * time.Hour)

	claims := UserClaims{
		UserID: user.ID,
		Phone:  user.Phone,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "indextts-server",
			Subject:   user.ID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(cfg.AuthJWTSecret))
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return tokenString, nil
}

// ValidateUserToken validates a JWT token and returns the claims
func ValidateUserToken(tokenString string) (*UserClaims, error) {
	cfg := config.Cfg

	if cfg.AuthJWTSecret == "" {
		return nil, errors.New("AUTH_JWT_SECRET is not configured")
	}

	token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(cfg.AuthJWTSecret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if claims, ok := token.Claims.(*UserClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

// LoginWithPhone logs in a user with phone verification code
// Creates a new user if the phone number is not registered
func LoginWithPhone(phone, code string) (*models.User, string, error) {
	// Verify the code
	_, err := VerifyCode(phone, code, models.CodePurposeLogin)
	if err != nil {
		return nil, "", err
	}

	// Find or create user
	var user models.User
	result := models.DB.Where("phone = ?", phone).First(&user)

	if result.Error != nil {
		// User doesn't exist, create new user with initial credits
		initialCredits := config.Cfg.CreditsInitial
		user = models.User{
			ID:      uuid.New().String(),
			Phone:   phone,
			Credits: initialCredits,
			Status:  models.UserStatusActive,
		}
		if err := models.DB.Create(&user).Error; err != nil {
			return nil, "", fmt.Errorf("failed to create user: %w", err)
		}

		// Record credit log for registration bonus
		creditLog := models.CreditLog{
			ID:      uuid.New().String(),
			UserID:  user.ID,
			Amount:  initialCredits,
			Balance: initialCredits,
			Type:    "register",
			Remark:  "Registration bonus",
		}
		models.DB.Create(&creditLog)
	}

	// Check if user is disabled
	if user.Status == models.UserStatusDisabled {
		return nil, "", errors.New("user account is disabled")
	}

	// Update last login time
	now := time.Now()
	if err := models.DB.Model(&user).Update("last_login_at", now).Error; err != nil {
		return nil, "", fmt.Errorf("failed to update last login time: %w", err)
	}
	user.LastLoginAt = &now

	// Generate token
	token, err := GenerateUserToken(&user)
	if err != nil {
		return nil, "", err
	}

	return &user, token, nil
}

// GetUserByID retrieves a user by ID
func GetUserByID(userID string) (*models.User, error) {
	var user models.User
	if err := models.DB.First(&user, "id = ?", userID).Error; err != nil {
		return nil, fmt.Errorf("user not found")
	}
	return &user, nil
}
