package handlers

import (
	"net/http"
	"strconv"

	"backend-server/models"
	"backend-server/services"

	"github.com/gin-gonic/gin"
)

// GetFileURL generates a signed URL for accessing a file
func GetFileURL(c *gin.Context) {
	id := c.Param("id")

	var file models.File
	if err := models.DB.First(&file, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "File not found",
		})
		return
	}

	// Get expire seconds from query param, default 3600 (1 hour)
	expireSeconds := int64(3600)
	if expireStr := c.Query("expire"); expireStr != "" {
		if exp, err := strconv.ParseInt(expireStr, 10, 64); err == nil && exp > 0 {
			// Max 7 days
			if exp > 604800 {
				exp = 604800
			}
			expireSeconds = exp
		}
	}

	signedURL, err := services.GetSignedURL(file.OSSKey, expireSeconds)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to generate signed URL: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         file.ID,
		"filename":   file.Filename,
		"url":        signedURL,
		"expires_in": expireSeconds,
	})
}

// GetFile proxies file content from OSS with 12-hour cache
func GetFile(c *gin.Context) {
	id := c.Param("id")

	var file models.File
	if err := models.DB.First(&file, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "File not found",
		})
		return
	}

	// TODO: Add authentication check here
	// if !isAuthenticated(c) {
	//     c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
	//     return
	// }

	// Get file content from OSS
	reader, err := services.GetObject(file.OSSKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get file: " + err.Error(),
		})
		return
	}
	defer reader.Close()

	// Set cache headers (12 hours = 43200 seconds)
	c.Header("Cache-Control", "public, max-age=43200")
	c.Header("Content-Disposition", "inline; filename=\""+file.Filename+"\"")

	// Stream file content to response
	c.DataFromReader(http.StatusOK, file.Size, file.ContentType, reader, nil)
}

// GetFileMetadata retrieves file metadata by ID (without content)
func GetFileMetadata(c *gin.Context) {
	id := c.Param("id")

	var file models.File
	if err := models.DB.First(&file, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "File not found",
		})
		return
	}

	// Return metadata without sensitive OSS key
	c.JSON(http.StatusOK, gin.H{
		"id":           file.ID,
		"filename":     file.Filename,
		"content_type": file.ContentType,
		"size":         file.Size,
		"created_at":   file.CreatedAt,
		"updated_at":   file.UpdatedAt,
	})
}
