package handlers

import (
	"net/http"

	"backend-server/middleware"
	"backend-server/services"

	"github.com/gin-gonic/gin"
)

// ListVideoModels returns all selectable video generation models.
func ListVideoModels(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"models": services.ListVideoModelOptions(),
	})
}
