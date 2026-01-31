package services

import (
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
	"time"

	"backend-server/config"
	"backend-server/models"

	openapi "github.com/alibabacloud-go/darabonba-openapi/v2/client"
	dysmsapi "github.com/alibabacloud-go/dysmsapi-20170525/v4/client"
	"github.com/alibabacloud-go/tea/tea"
	"github.com/google/uuid"
)

var smsClient *dysmsapi.Client
var smsEnabled bool

// InitSMS initializes the Aliyun SMS client
func InitSMS() error {
	cfg := config.Cfg

	// Check if SMS is configured
	if cfg.SMSAccessKeyID == "" || cfg.SMSAccessKeySecret == "" {
		log.Println("SMS service not configured, running in development mode (codes will be printed to console)")
		smsEnabled = false
		return nil
	}

	clientConfig := &openapi.Config{
		AccessKeyId:     tea.String(cfg.SMSAccessKeyID),
		AccessKeySecret: tea.String(cfg.SMSAccessKeySecret),
		Endpoint:        tea.String("dysmsapi.aliyuncs.com"),
	}

	client, err := dysmsapi.NewClient(clientConfig)
	if err != nil {
		return fmt.Errorf("failed to create SMS client: %w", err)
	}

	smsClient = client
	smsEnabled = true
	log.Println("SMS service initialized successfully")
	return nil
}

// GenerateVerificationCode generates a random 6-digit code
func GenerateVerificationCode() (string, error) {
	code := ""
	for i := 0; i < 6; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", fmt.Errorf("failed to generate random number: %w", err)
		}
		code += fmt.Sprintf("%d", n.Int64())
	}
	return code, nil
}

// SendVerificationCode sends a verification code to the specified phone number
func SendVerificationCode(phone string, purpose models.CodePurpose) (*models.VerificationCode, error) {
	cfg := config.Cfg

	// Check cooldown - find the most recent code for this phone
	var recentCode models.VerificationCode
	result := models.DB.Where("phone = ? AND purpose = ?", phone, purpose).
		Order("created_at DESC").
		First(&recentCode)

	if result.Error == nil {
		// Check if cooldown period has passed
		cooldownEnd := recentCode.CreatedAt.Add(time.Duration(cfg.SMSCodeCooldownSeconds) * time.Second)
		if time.Now().Before(cooldownEnd) {
			remainingSeconds := int(time.Until(cooldownEnd).Seconds())
			return nil, fmt.Errorf("please wait %d seconds before requesting a new code", remainingSeconds)
		}
	}

	// Generate verification code
	code, err := GenerateVerificationCode()
	if err != nil {
		return nil, fmt.Errorf("failed to generate verification code: %w", err)
	}

	// Calculate expiration time
	expiresAt := time.Now().Add(time.Duration(cfg.SMSCodeExpireMinutes) * time.Minute)

	// Create verification code record
	verificationCode := &models.VerificationCode{
		ID:        uuid.New().String(),
		Phone:     phone,
		Code:      code,
		Purpose:   purpose,
		Used:      false,
		ExpiresAt: expiresAt,
	}

	if err := models.DB.Create(verificationCode).Error; err != nil {
		return nil, fmt.Errorf("failed to save verification code: %w", err)
	}

	// Send SMS
	if smsEnabled {
		err = sendAliyunSMS(phone, code)
		if err != nil {
			return nil, fmt.Errorf("failed to send SMS: %w", err)
		}
		log.Printf("Verification code sent to %s", phone)
	} else {
		// Development mode - print to console
		log.Printf("[DEV MODE] Verification code for %s: %s (expires at %s)", phone, code, expiresAt.Format("15:04:05"))
	}

	return verificationCode, nil
}

// sendAliyunSMS sends SMS via Aliyun SMS service
func sendAliyunSMS(phone, code string) error {
	cfg := config.Cfg

	request := &dysmsapi.SendSmsRequest{
		PhoneNumbers:  tea.String(phone),
		SignName:      tea.String(cfg.SMSSignName),
		TemplateCode:  tea.String(cfg.SMSTemplateCode),
		TemplateParam: tea.String(fmt.Sprintf(`{"code":"%s"}`, code)),
	}

	response, err := smsClient.SendSms(request)
	if err != nil {
		return fmt.Errorf("SMS API error: %w", err)
	}

	if *response.Body.Code != "OK" {
		return fmt.Errorf("SMS send failed: %s - %s", *response.Body.Code, *response.Body.Message)
	}

	return nil
}

// VerifyCode verifies a verification code and marks it as used
func VerifyCode(phone, code string, purpose models.CodePurpose) (*models.VerificationCode, error) {
	var verificationCode models.VerificationCode

	// Find the most recent unused code for this phone and purpose
	result := models.DB.Where("phone = ? AND purpose = ? AND used = ?", phone, purpose, false).
		Order("created_at DESC").
		First(&verificationCode)

	if result.Error != nil {
		return nil, fmt.Errorf("verification code not found")
	}

	// Check if code matches
	if verificationCode.Code != code {
		return nil, fmt.Errorf("invalid verification code")
	}

	// Check if code has expired
	if verificationCode.IsExpired() {
		return nil, fmt.Errorf("verification code has expired")
	}

	// Mark code as used
	if err := models.DB.Model(&verificationCode).Update("used", true).Error; err != nil {
		return nil, fmt.Errorf("failed to mark code as used: %w", err)
	}

	return &verificationCode, nil
}
