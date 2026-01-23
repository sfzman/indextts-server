package services

import (
	"bytes"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"time"

	"backend-server/config"

	"github.com/golang-jwt/jwt/v5"
)

var privateKey *rsa.PrivateKey

// InitInference initializes the inference service (loads JWT private key)
func InitInference() error {
	cfg := config.Cfg

	if cfg.JWTPrivateKey == "" {
		// JWT auth disabled
		return nil
	}

	block, _ := pem.Decode([]byte(cfg.JWTPrivateKey))
	if block == nil {
		return fmt.Errorf("failed to parse PEM block containing private key")
	}

	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		// Try PKCS1 format
		key, err = x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			return fmt.Errorf("failed to parse private key: %w", err)
		}
	}

	var ok bool
	privateKey, ok = key.(*rsa.PrivateKey)
	if !ok {
		return fmt.Errorf("private key is not RSA")
	}

	return nil
}

// generateJWT generates a JWT token for inference API
func generateJWT() (string, error) {
	if privateKey == nil {
		return "", nil // No auth configured
	}

	cfg := config.Cfg
	claims := jwt.MapClaims{
		"exp": time.Now().Add(time.Duration(cfg.JWTExpireSeconds) * time.Second).Unix(),
		"iat": time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return token.SignedString(privateKey)
}

// TTSRequest represents the request to inference API
type TTSRequest struct {
	Text           string    `json:"text"`
	ReferenceAudio string    `json:"reference_audio,omitempty"`
	EmotionPrompt  string    `json:"emotion_prompt,omitempty"`
	EmotionVector  []float64 `json:"emotion_vector,omitempty"`
	EmotionAlpha   *float64  `json:"emotion_alpha,omitempty"`
	UseEmotionText *bool     `json:"use_emotion_text,omitempty"`
}

// CallInference calls the inference API and returns the audio data
func CallInference(req *TTSRequest) ([]byte, error) {
	cfg := config.Cfg

	// Generate JWT token
	token, err := generateJWT()
	if err != nil {
		return nil, fmt.Errorf("failed to generate JWT: %w", err)
	}

	// Prepare request body
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	httpReq, err := http.NewRequest("POST", cfg.InferenceURL+"/api/v1/tts", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if token != "" {
		httpReq.Header.Set("Authorization", "Bearer "+token)
	}

	// Send request
	client := &http.Client{
		Timeout: 5 * time.Minute, // TTS can take a while
	}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to call inference API: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check status
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("inference API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}
