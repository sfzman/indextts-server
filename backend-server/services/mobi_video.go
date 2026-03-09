package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"backend-server/config"
	"backend-server/models"
)

const (
	mobiVideoSynthesisPath = "/alibailian/api/v1/services/aigc/video-generation/video-synthesis"
)

// MobiVideoSynthesisRequest is the upstream request payload for video synthesis.
type MobiVideoSynthesisRequest struct {
	Model      string               `json:"model"`
	Input      MobiVideoInput       `json:"input"`
	Parameters *MobiVideoParameters `json:"parameters,omitempty"`
}

// MobiVideoInput contains prompt/image/audio level fields.
type MobiVideoInput struct {
	Prompt         string `json:"prompt,omitempty"`
	NegativePrompt string `json:"negative_prompt,omitempty"`
	ImgURL         string `json:"img_url"`
	AudioURL       string `json:"audio_url,omitempty"`
	Template       string `json:"template,omitempty"`
}

// MobiVideoParameters contains generation controls.
type MobiVideoParameters struct {
	Audio        *bool  `json:"audio,omitempty"`
	Duration     *int   `json:"duration,omitempty"`
	PromptExtend *bool  `json:"prompt_extend,omitempty"`
	Resolution   string `json:"resolution,omitempty"`
	Seed         *int64 `json:"seed,omitempty"`
	Watermark    *bool  `json:"watermark,omitempty"`
}

// MobiVideoTaskResponse is used by both create/query endpoints.
type MobiVideoTaskResponse struct {
	RequestID string                 `json:"request_id"`
	Usage     map[string]interface{} `json:"usage,omitempty"`
	Output    struct {
		TaskID       string `json:"task_id"`
		TaskStatus   string `json:"task_status"`
		SubmitTime   string `json:"submit_time,omitempty"`
		ScheduleTime string `json:"scheduled_time,omitempty"`
		EndTime      string `json:"end_time,omitempty"`
		VideoURL     string `json:"video_url,omitempty"`
		OrigPrompt   string `json:"orig_prompt,omitempty"`
		ActualPrompt string `json:"actual_prompt,omitempty"`
		Code         string `json:"code,omitempty"`
		Message      string `json:"message,omitempty"`
	} `json:"output"`
}

func mobiBaseURL() string {
	return strings.TrimRight(config.Cfg.MobiAPIBaseURL, "/")
}

func newMobiRequest(method, url string, body []byte) (*http.Request, error) {
	if config.Cfg.MobiAPIKey == "" {
		return nil, fmt.Errorf("MOBI_API_KEY is not configured")
	}

	var reader io.Reader
	if len(body) > 0 {
		reader = bytes.NewReader(body)
	}

	req, err := http.NewRequest(method, url, reader)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+config.Cfg.MobiAPIKey)
	req.Header.Set("Content-Type", "application/json")
	// Upstream task creation uses async mode.
	if method == http.MethodPost {
		req.Header.Set("X-DashScope-Async", "enable")
	}

	return req, nil
}

func decodeMobiResponse(resp *http.Response) (*MobiVideoTaskResponse, error) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read mobi response: %w", err)
	}

	var parsed MobiVideoTaskResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return nil, fmt.Errorf("failed to decode mobi response: %w", err)
		}
		return nil, fmt.Errorf("mobi API returned status %d: %s", resp.StatusCode, string(body))
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		errMsg := parsed.Output.Message
		if errMsg == "" {
			errMsg = string(body)
		}
		if parsed.Output.Code != "" {
			return nil, fmt.Errorf("mobi API status %d, code=%s: %s", resp.StatusCode, parsed.Output.Code, errMsg)
		}
		return nil, fmt.Errorf("mobi API status %d: %s", resp.StatusCode, errMsg)
	}

	return &parsed, nil
}

// SubmitMobiVideoTask submits one video synthesis request and returns provider task metadata.
func SubmitMobiVideoTask(reqBody *MobiVideoSynthesisRequest) (*MobiVideoTaskResponse, error) {
	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal mobi request: %w", err)
	}

	req, err := newMobiRequest(http.MethodPost, mobiBaseURL()+mobiVideoSynthesisPath, body)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call mobi video API: %w", err)
	}
	defer resp.Body.Close()

	return decodeMobiResponse(resp)
}

// QueryMobiVideoTask polls one provider task by task ID.
func QueryMobiVideoTask(taskID string) (*MobiVideoTaskResponse, error) {
	if taskID == "" {
		return nil, fmt.Errorf("empty provider task id")
	}

	url := fmt.Sprintf("%s/alibailian/api/v1/tasks/%s", mobiBaseURL(), taskID)
	req, err := newMobiRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query mobi task: %w", err)
	}
	defer resp.Body.Close()

	return decodeMobiResponse(resp)
}

// MapMobiTaskStatus maps provider task status into internal status.
func MapMobiTaskStatus(status string) models.TaskStatus {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "SUCCEEDED":
		return models.TaskStatusCompleted
	case "FAILED", "CANCELED":
		return models.TaskStatusFailed
	case "UNKNOWN":
		return models.TaskStatusFailed
	case "RUNNING":
		return models.TaskStatusProcessing
	case "PENDING":
		return models.TaskStatusPending
	default:
		return models.TaskStatusFailed
	}
}
