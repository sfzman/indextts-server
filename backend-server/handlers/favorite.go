package handlers

import (
	"errors"
	"net/http"
	"strings"

	"backend-server/middleware"
	"backend-server/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// FavoriteResponse represents favorite data returned to frontend
type FavoriteResponse struct {
	ID          string                  `json:"id"`
	Name        string                  `json:"name"`
	Category    models.FavoriteCategory `json:"category"`
	AudioFileID string                  `json:"audio_file_id"`
	CreatedAt   string                  `json:"created_at"`
	UpdatedAt   string                  `json:"updated_at"`
}

// CreateFavoriteRequest represents create favorite request
type CreateFavoriteRequest struct {
	Name        string `json:"name" binding:"required,max=255"`
	Category    string `json:"category" binding:"required,oneof=voice emotion"`
	AudioFileID string `json:"audio_file_id" binding:"required,len=36"`
}

// UpdateFavoriteRequest represents rename favorite request
type UpdateFavoriteRequest struct {
	Name string `json:"name" binding:"required,max=255"`
}

// ListFavorites returns current user's favorites
func ListFavorites(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	query := models.DB.Where("user_id = ?", userID)
	if category := c.Query("category"); category != "" {
		if category != string(models.FavoriteCategoryVoice) && category != string(models.FavoriteCategoryEmotion) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid category, expected voice or emotion",
			})
			return
		}
		query = query.Where("category = ?", category)
	}

	var favorites []models.Favorite
	if err := query.Order("created_at DESC").Find(&favorites).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list favorites: " + err.Error(),
		})
		return
	}

	items := make([]FavoriteResponse, len(favorites))
	for i, favorite := range favorites {
		items[i] = buildFavoriteResponse(favorite)
	}

	c.JSON(http.StatusOK, gin.H{
		"favorites": items,
	})
}

// CreateFavorite creates a favorite for current user
func CreateFavorite(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	var req CreateFavoriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request: " + err.Error(),
		})
		return
	}

	trimmedName := strings.TrimSpace(req.Name)
	if trimmedName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "name cannot be empty",
		})
		return
	}

	// Validate referenced file exists and belongs to current user
	var file models.File
	if err := models.DB.First(&file, "id = ? AND user_id = ?", req.AudioFileID, userID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Audio file not found",
		})
		return
	}

	category := models.FavoriteCategory(req.Category)

	var existing models.Favorite
	err := models.DB.Unscoped().First(&existing, "user_id = ? AND category = ? AND audio_file_id = ?", userID, category, req.AudioFileID).Error
	if err == nil {
		// Restore soft-deleted record to avoid unique index conflict
		if existing.DeletedAt.Valid {
			if err := models.DB.Unscoped().
				Model(&models.Favorite{}).
				Where("id = ?", existing.ID).
				Updates(map[string]interface{}{
					"name":       trimmedName,
					"deleted_at": nil,
				}).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": "Failed to restore favorite: " + err.Error(),
				})
				return
			}

			if err := models.DB.First(&existing, "id = ?", existing.ID).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": "Failed to load restored favorite: " + err.Error(),
				})
				return
			}

			c.JSON(http.StatusCreated, gin.H{
				"added":    true,
				"favorite": buildFavoriteResponse(existing),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"added":    false,
			"favorite": buildFavoriteResponse(existing),
		})
		return
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to check favorite duplication: " + err.Error(),
		})
		return
	}

	favorite := models.Favorite{
		ID:          uuid.New().String(),
		UserID:      userID,
		Category:    category,
		Name:        trimmedName,
		AudioFileID: req.AudioFileID,
	}

	if err := models.DB.Create(&favorite).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create favorite: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"added":    true,
		"favorite": buildFavoriteResponse(favorite),
	})
}

// UpdateFavorite updates favorite name
func UpdateFavorite(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	id := c.Param("id")

	var req UpdateFavoriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request: " + err.Error(),
		})
		return
	}

	trimmedName := strings.TrimSpace(req.Name)
	if trimmedName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "name cannot be empty",
		})
		return
	}

	var favorite models.Favorite
	if err := models.DB.First(&favorite, "id = ? AND user_id = ?", id, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Favorite not found",
		})
		return
	}

	favorite.Name = trimmedName
	if err := models.DB.Save(&favorite).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update favorite: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, buildFavoriteResponse(favorite))
}

// DeleteFavorite deletes one favorite for current user
func DeleteFavorite(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	id := c.Param("id")
	result := models.DB.Where("id = ? AND user_id = ?", id, userID).Delete(&models.Favorite{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete favorite: " + result.Error.Error(),
		})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Favorite not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":      id,
		"deleted": true,
	})
}

func buildFavoriteResponse(favorite models.Favorite) FavoriteResponse {
	return FavoriteResponse{
		ID:          favorite.ID,
		Name:        favorite.Name,
		Category:    favorite.Category,
		AudioFileID: favorite.AudioFileID,
		CreatedAt:   favorite.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:   favorite.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}
