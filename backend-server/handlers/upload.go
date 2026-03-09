package handlers

import (
	"errors"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"

	"backend-server/middleware"
	"backend-server/models"
	"backend-server/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var allowedAudioContentTypes = map[string]string{
	".wav":  "audio/wav",
	".mp3":  "audio/mpeg",
	".flac": "audio/flac",
	".ogg":  "audio/ogg",
	".m4a":  "audio/mp4",
}

var allowedMediaContentTypes = map[string]string{
	".wav":  "audio/wav",
	".mp3":  "audio/mpeg",
	".flac": "audio/flac",
	".ogg":  "audio/ogg",
	".m4a":  "audio/mp4",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".webp": "image/webp",
	".bmp":  "image/bmp",
}

// UploadAudio handles audio file upload
func UploadAudio(c *gin.Context) {
	uploadByContentTypes(c, allowedAudioContentTypes, "Invalid file type. Allowed: wav, mp3, flac, ogg, m4a")
}

// UploadMedia handles media upload for video workflows (audio + images).
func UploadMedia(c *gin.Context) {
	uploadByContentTypes(c, allowedMediaContentTypes, "Invalid file type. Allowed: wav, mp3, flac, ogg, m4a, jpg, jpeg, png, webp, bmp")
}

func uploadByContentTypes(c *gin.Context, allowed map[string]string, invalidTypeMessage string) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "No file uploaded",
		})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	contentType, ok := allowed[ext]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": invalidTypeMessage,
		})
		return
	}

	if file.Size > 50*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "File too large. Maximum size is 50MB",
		})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to read file",
		})
		return
	}
	defer src.Close()

	ossKey, err := services.UploadFile(src, file.Filename, contentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to upload file: " + err.Error(),
		})
		return
	}

	persistUploadedFile(c, userID, file, contentType, ossKey)
}

func persistUploadedFile(c *gin.Context, userID string, file *multipart.FileHeader, contentType, ossKey string) {
	fileRecord := models.File{
		ID:          uuid.New().String(),
		UserID:      userID,
		Filename:    file.Filename,
		OSSKey:      ossKey,
		ContentType: contentType,
		Size:        file.Size,
	}

	createResult := models.DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&fileRecord)
	if createResult.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to save file record: " + createResult.Error.Error(),
		})
		return
	}

	if createResult.RowsAffected == 0 {
		var existing models.File
		err := models.DB.Unscoped().First(&existing, "user_id = ? AND oss_key = ?", userID, ossKey).Error
		if err == nil {
			if existing.DeletedAt.Valid {
				if err := models.DB.Unscoped().
					Model(&models.File{}).
					Where("id = ?", existing.ID).
					Updates(map[string]interface{}{
						"filename":     file.Filename,
						"content_type": contentType,
						"size":         file.Size,
						"deleted_at":   nil,
					}).Error; err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{
						"error": "Failed to restore existing file record: " + err.Error(),
					})
					return
				}

				if err := models.DB.First(&existing, "id = ?", existing.ID).Error; err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{
						"error": "Failed to load restored file record: " + err.Error(),
					})
					return
				}
			}

			c.JSON(http.StatusOK, gin.H{
				"id":       existing.ID,
				"filename": existing.Filename,
				"size":     existing.Size,
			})
			return
		}

		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusConflict, gin.H{
				"error": "Identical file already exists",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to load existing file record: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":       fileRecord.ID,
		"filename": fileRecord.Filename,
		"size":     fileRecord.Size,
	})
}
