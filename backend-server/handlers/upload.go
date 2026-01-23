package handlers

import (
	"net/http"
	"path/filepath"
	"strings"

	"backend-server/services"

	"github.com/gin-gonic/gin"
)

// allowedAudioExtensions defines allowed audio file extensions
var allowedAudioExtensions = map[string]bool{
	".wav":  true,
	".mp3":  true,
	".flac": true,
	".ogg":  true,
	".m4a":  true,
}

// UploadAudio handles audio file upload
func UploadAudio(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "No file uploaded",
		})
		return
	}

	// Check file extension
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedAudioExtensions[ext] {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid file type. Allowed: wav, mp3, flac, ogg, m4a",
		})
		return
	}

	// Check file size (max 50MB)
	if file.Size > 50*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "File too large. Maximum size is 50MB",
		})
		return
	}

	// Open file
	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to read file",
		})
		return
	}
	defer src.Close()

	// Determine content type
	contentType := "audio/wav"
	switch ext {
	case ".mp3":
		contentType = "audio/mpeg"
	case ".flac":
		contentType = "audio/flac"
	case ".ogg":
		contentType = "audio/ogg"
	case ".m4a":
		contentType = "audio/mp4"
	}

	// Upload to OSS
	url, err := services.UploadFile(src, file.Filename, contentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to upload file: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url": url,
	})
}
