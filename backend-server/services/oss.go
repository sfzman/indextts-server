package services

import (
	"fmt"
	"io"
	"path"
	"time"

	"backend-server/config"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
	"github.com/google/uuid"
)

var ossClient *oss.Client
var ossBucket *oss.Bucket

// InitOSS initializes the OSS client
func InitOSS() error {
	cfg := config.Cfg

	var err error
	ossClient, err = oss.New(cfg.OSSEndpoint, cfg.OSSAccessKeyID, cfg.OSSAccessKeySecret)
	if err != nil {
		return fmt.Errorf("failed to create OSS client: %w", err)
	}

	ossBucket, err = ossClient.Bucket(cfg.OSSBucketName)
	if err != nil {
		return fmt.Errorf("failed to get OSS bucket: %w", err)
	}

	return nil
}

// UploadFile uploads a file to OSS and returns the public URL
func UploadFile(reader io.Reader, filename string, contentType string) (string, error) {
	// Generate unique object key
	ext := path.Ext(filename)
	objectKey := fmt.Sprintf("audio/%s/%s%s",
		time.Now().Format("2006/01/02"),
		uuid.New().String(),
		ext,
	)

	// Upload to OSS
	err := ossBucket.PutObject(objectKey, reader, oss.ContentType(contentType))
	if err != nil {
		return "", fmt.Errorf("failed to upload to OSS: %w", err)
	}

	// Generate public URL
	cfg := config.Cfg
	url := fmt.Sprintf("https://%s.%s/%s", cfg.OSSBucketName, cfg.OSSEndpoint, objectKey)

	return url, nil
}

// UploadBytes uploads byte data to OSS
func UploadBytes(data []byte, filename string, contentType string) (string, error) {
	ext := path.Ext(filename)
	objectKey := fmt.Sprintf("audio/%s/%s%s",
		time.Now().Format("2006/01/02"),
		uuid.New().String(),
		ext,
	)

	err := ossBucket.PutObject(objectKey, io.NopCloser(
		&bytesReader{data: data, offset: 0},
	), oss.ContentType(contentType))
	if err != nil {
		return "", fmt.Errorf("failed to upload to OSS: %w", err)
	}

	cfg := config.Cfg
	url := fmt.Sprintf("https://%s.%s/%s", cfg.OSSBucketName, cfg.OSSEndpoint, objectKey)

	return url, nil
}

// bytesReader implements io.Reader for byte slice
type bytesReader struct {
	data   []byte
	offset int
}

func (r *bytesReader) Read(p []byte) (n int, err error) {
	if r.offset >= len(r.data) {
		return 0, io.EOF
	}
	n = copy(p, r.data[r.offset:])
	r.offset += n
	return n, nil
}
