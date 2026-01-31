package handlers

import (
	"net/http"
	"regexp"

	"backend-server/middleware"
	"backend-server/models"
	"backend-server/services"

	"github.com/gin-gonic/gin"
)

// SendCodeRequest represents the request body for sending verification code
type SendCodeRequest struct {
	Phone string `json:"phone" binding:"required"`
}

// LoginRequest represents the request body for login
type LoginRequest struct {
	Phone string `json:"phone" binding:"required"`
	Code  string `json:"code" binding:"required"`
}

// LoginResponse represents the response body for successful login
type LoginResponse struct {
	Token string       `json:"token"`
	User  *models.User `json:"user"`
}

// validatePhone validates Chinese phone number format
func validatePhone(phone string) bool {
	// Chinese mobile phone number: 11 digits starting with 1
	pattern := `^1[3-9]\d{9}$`
	matched, _ := regexp.MatchString(pattern, phone)
	return matched
}

// SendCode handles sending verification code
// POST /api/v1/auth/send-code
func SendCode(c *gin.Context) {
	var req SendCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	// Validate phone number format
	if !validatePhone(req.Phone) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid phone number format",
		})
		return
	}

	// Send verification code
	_, err := services.SendVerificationCode(req.Phone, models.CodePurposeLogin)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Verification code sent successfully",
	})
}

// Login handles user login with verification code
// POST /api/v1/auth/login
func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	// Validate phone number format
	if !validatePhone(req.Phone) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid phone number format",
		})
		return
	}

	// Validate code format (6 digits)
	if len(req.Code) != 6 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Verification code must be 6 digits",
		})
		return
	}

	// Login with phone and code
	user, token, err := services.LoginWithPhone(req.Phone, req.Code)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, LoginResponse{
		Token: token,
		User:  user,
	})
}

// GetCurrentUser returns the current authenticated user
// GET /api/v1/auth/me
func GetCurrentUser(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	user, err := services.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "User not found",
		})
		return
	}

	c.JSON(http.StatusOK, user)
}
