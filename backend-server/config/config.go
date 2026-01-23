package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	// Server
	AppEnv     string
	ServerPort string
	GinMode    string

	// Database
	DBDriver   string
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string

	// OSS
	OSSEndpoint        string
	OSSAccessKeyID     string
	OSSAccessKeySecret string
	OSSBucketName      string

	// CORS
	CORSOrigins string

	// Inference service
	InferenceURL     string
	JWTPrivateKey    string
	JWTExpireSeconds int
}

var Cfg *Config

func Load() error {
	_ = godotenv.Load()

	Cfg = &Config{
		AppEnv:             getEnv("APP_ENV", "local"),
		ServerPort:         getEnv("SERVER_PORT", "8080"),
		GinMode:            getEnv("GIN_MODE", "debug"),
		DBDriver:           getEnv("DB_DRIVER", "mysql"),
		DBHost:             getEnv("DB_HOST", "localhost"),
		DBPort:             getEnv("DB_PORT", "3306"),
		DBUser:             getEnv("DB_USER", "root"),
		DBPassword:         getEnv("DB_PASSWORD", ""),
		DBName:             getEnv("DB_NAME", "tts"),
		OSSEndpoint:        getEnv("OSS_ENDPOINT", ""),
		OSSAccessKeyID:     getEnv("OSS_ACCESS_KEY_ID", ""),
		OSSAccessKeySecret: getEnv("OSS_ACCESS_KEY_SECRET", ""),
		OSSBucketName:      getEnv("OSS_BUCKET_NAME", ""),
		CORSOrigins:        getEnv("CORS_ORIGINS", "*"),
		InferenceURL:       getEnv("INFERENCE_URL", "http://localhost:8000"),
		JWTPrivateKey:      strings.ReplaceAll(getEnv("JWT_PRIVATE_KEY", ""), `\n`, "\n"),
		JWTExpireSeconds:   getEnvInt("JWT_EXPIRE_SECONDS", 60),
	}

	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		var result int
		if _, err := fmt.Sscanf(value, "%d", &result); err == nil {
			return result
		}
	}
	return defaultValue
}
