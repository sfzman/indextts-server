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

	// SMS (Aliyun)
	SMSAccessKeyID      string
	SMSAccessKeySecret  string
	SMSSignName         string
	SMSTemplateCode     string
	SMSCodeExpireMinutes int
	SMSCodeCooldownSeconds int

	// User Auth
	AuthJWTSecret      string
	AuthJWTExpireHours int

	// Credits
	CreditsInitial    int      // Initial credits for new users
	CreditsPerTask    int      // Credits deducted per task
	CreditsPerYuan    int      // Credits per 1 yuan
	PhoneWhitelist    []string // Phone numbers that don't consume credits

	// Alipay
	AlipayAppID        string
	AlipayPrivateKey   string
	AlipayPublicKey    string // Alipay public key for signature verification
	AlipayNotifyURL    string // Callback URL for payment notification
	AlipayReturnURL    string // Return URL after payment
	AlipaySandbox      bool   // Use sandbox environment
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

		// SMS configuration
		SMSAccessKeyID:         getEnv("SMS_ACCESS_KEY_ID", ""),
		SMSAccessKeySecret:     getEnv("SMS_ACCESS_KEY_SECRET", ""),
		SMSSignName:            getEnv("SMS_SIGN_NAME", ""),
		SMSTemplateCode:        getEnv("SMS_TEMPLATE_CODE", ""),
		SMSCodeExpireMinutes:   getEnvInt("SMS_CODE_EXPIRE_MINUTES", 5),
		SMSCodeCooldownSeconds: getEnvInt("SMS_CODE_COOLDOWN_SECONDS", 60),

		// User Auth configuration
		AuthJWTSecret:      getEnv("AUTH_JWT_SECRET", ""),
		AuthJWTExpireHours: getEnvInt("AUTH_JWT_EXPIRE_HOURS", 168),

		// Credits configuration
		CreditsInitial: getEnvInt("CREDITS_INITIAL", 30),
		CreditsPerTask: getEnvInt("CREDITS_PER_TASK", 10),
		CreditsPerYuan: getEnvInt("CREDITS_PER_YUAN", 20),
		PhoneWhitelist: getEnvList("PHONE_WHITELIST", ","),

		// Alipay configuration
		AlipayAppID:      getEnv("ALIPAY_APP_ID", ""),
		AlipayPrivateKey: strings.ReplaceAll(getEnv("ALIPAY_PRIVATE_KEY", ""), `\n`, "\n"),
		AlipayPublicKey:  strings.ReplaceAll(getEnv("ALIPAY_PUBLIC_KEY", ""), `\n`, "\n"),
		AlipayNotifyURL:  getEnv("ALIPAY_NOTIFY_URL", ""),
		AlipayReturnURL:  getEnv("ALIPAY_RETURN_URL", ""),
		AlipaySandbox:    getEnvBool("ALIPAY_SANDBOX", false),
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

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		return value == "true" || value == "1" || value == "yes"
	}
	return defaultValue
}

func getEnvList(key, sep string) []string {
	value := os.Getenv(key)
	if value == "" {
		return []string{}
	}
	parts := strings.Split(value, sep)
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}
