package middleware

import (
	"net/http"
	"strings"

	"backend-server/services"

	"github.com/gin-gonic/gin"
)

const (
	// UserIDKey is the context key for user ID
	UserIDKey = "user_id"
	// UserPhoneKey is the context key for user phone
	UserPhoneKey = "user_phone"
)

// AuthRequired is a middleware that requires a valid JWT token
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization header is required",
			})
			c.Abort()
			return
		}

		// Check Bearer token format
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid authorization header format, expected 'Bearer <token>'",
			})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Validate token
		claims, err := services.ValidateUserToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid or expired token",
			})
			c.Abort()
			return
		}

		// Set user info in context
		c.Set(UserIDKey, claims.UserID)
		c.Set(UserPhoneKey, claims.Phone)

		c.Next()
	}
}

// GetUserID extracts the user ID from the context
func GetUserID(c *gin.Context) string {
	if userID, exists := c.Get(UserIDKey); exists {
		return userID.(string)
	}
	return ""
}

// GetUserPhone extracts the user phone from the context
func GetUserPhone(c *gin.Context) string {
	if phone, exists := c.Get(UserPhoneKey); exists {
		return phone.(string)
	}
	return ""
}
