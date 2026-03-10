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
	hailuoVideoSubmitPath = "/minimax/v1/video_generation"
	hailuoVideoQueryPath  = "/minimax/v1/query/video_generation"
	hailuoAPIModelName    = "MiniMax-Hailuo-2.3"
)

type hailuoVideoProvider struct{}

type hailuoVideoSubmitRequest struct {
	Prompt          string `json:"prompt"`
	FirstFrameImage string `json:"first_frame_image,omitempty"`
	Model           string `json:"model"`
	Duration        int    `json:"duration"`
	Resolution      string `json:"resolution"`
}

type hailuoVideoSubmitResponse struct {
	TaskID   string `json:"task_id"`
	BaseResp struct {
		StatusCode int    `json:"status_code"`
		StatusMsg  string `json:"status_msg"`
	} `json:"base_resp"`
}

type hailuoVideoQueryResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Data    struct {
		TaskID     string `json:"task_id"`
		Action     string `json:"action"`
		Status     string `json:"status"`
		FailReason string `json:"fail_reason"`
		SubmitTime int64  `json:"submit_time"`
		StartTime  int64  `json:"start_time"`
		FinishTime int64  `json:"finish_time"`
		Progress   string `json:"progress"`
		Data       struct {
			File struct {
				Bytes             int64  `json:"bytes"`
				FileID            int64  `json:"file_id"`
				Purpose           string `json:"purpose"`
				Filename          string `json:"filename"`
				CreatedAt         int64  `json:"created_at"`
				DownloadURL       string `json:"download_url"`
				BackupDownloadURL string `json:"backup_download_url"`
			} `json:"file"`
			Status      string `json:"status"`
			FileID      string `json:"file_id"`
			TaskID      string `json:"task_id"`
			VideoWidth  int    `json:"video_width"`
			VideoHeight int    `json:"video_height"`
			BaseResp    struct {
				StatusMsg  string `json:"status_msg"`
				StatusCode int    `json:"status_code"`
			} `json:"base_resp"`
		} `json:"data"`
	} `json:"data"`
}

func (hailuoVideoProvider) Name() string {
	return videoProviderHailuo
}

func (hailuoVideoProvider) Submit(req *VideoProviderSubmitRequest) (*VideoProviderTaskResult, error) {
	if req.Duration == nil {
		return nil, fmt.Errorf("hailuo duration is required")
	}

	payload := hailuoVideoSubmitRequest{
		Prompt:     req.Prompt,
		Model:      hailuoAPIModelName,
		Duration:   *req.Duration,
		Resolution: req.Resolution,
	}
	if strings.TrimSpace(req.ImageURL) != "" {
		payload.FirstFrameImage = strings.TrimSpace(req.ImageURL)
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal hailuo request: %w", err)
	}

	request, err := newVideoProviderRequest(http.MethodPost, mobiBaseURL()+hailuoVideoSubmitPath, body, false)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("failed to call hailuo video API: %w", err)
	}
	defer resp.Body.Close()

	decoded, err := decodeHailuoSubmitResponseFromReader(resp.Body, resp.StatusCode)
	if err != nil {
		return nil, err
	}

	return decoded, nil
}

func (hailuoVideoProvider) Query(taskID string) (*VideoProviderTaskResult, error) {
	if strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("empty provider task id")
	}

	url := fmt.Sprintf("%s%s?task_id=%s", mobiBaseURL(), hailuoVideoQueryPath, taskID)
	request, err := newVideoProviderRequest(http.MethodGet, url, nil, false)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("failed to query hailuo task: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read hailuo response: %w", err)
	}

	return decodeHailuoQueryResponse(body, resp.StatusCode)
}

func (hailuoVideoProvider) MapStatus(status string) models.TaskStatus {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "SUCCESS":
		return models.TaskStatusCompleted
	case "QUEUEING", "PENDING", "PROCESSING", "RUNNING":
		return models.TaskStatusProcessing
	case "FAIL", "FAILED":
		return models.TaskStatusFailed
	default:
		return models.TaskStatusFailed
	}
}

func newVideoProviderRequest(method, url string, body []byte, async bool) (*http.Request, error) {
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
	if async {
		req.Header.Set("X-DashScope-Async", "enable")
	}

	return req, nil
}

func decodeHailuoSubmitResponseFromReader(reader io.Reader, statusCode int) (*VideoProviderTaskResult, error) {
	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read hailuo response: %w", err)
	}

	var parsed hailuoVideoSubmitResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		if statusCode >= 200 && statusCode < 300 {
			return nil, fmt.Errorf("failed to decode hailuo submit response: %w", err)
		}
		return nil, fmt.Errorf("hailuo API returned status %d: %s", statusCode, string(body))
	}

	if statusCode < 200 || statusCode >= 300 {
		errMsg := parsed.BaseResp.StatusMsg
		if errMsg == "" {
			errMsg = string(body)
		}
		return nil, fmt.Errorf("hailuo API status %d: %s", statusCode, errMsg)
	}

	if parsed.BaseResp.StatusCode != 0 {
		return nil, fmt.Errorf("hailuo API error %d: %s", parsed.BaseResp.StatusCode, parsed.BaseResp.StatusMsg)
	}

	return &VideoProviderTaskResult{
		TaskID:  parsed.TaskID,
		Status:  "PROCESSING",
		Message: parsed.BaseResp.StatusMsg,
		RawMeta: compactTaskMeta(map[string]interface{}{
			"provider_base_status_code": parsed.BaseResp.StatusCode,
			"provider_base_status_msg":  parsed.BaseResp.StatusMsg,
		}),
	}, nil
}

func decodeHailuoQueryResponse(body []byte, statusCode int) (*VideoProviderTaskResult, error) {
	var parsed hailuoVideoQueryResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		if statusCode >= 200 && statusCode < 300 {
			return nil, fmt.Errorf("failed to decode hailuo query response: %w", err)
		}
		return nil, fmt.Errorf("hailuo API returned status %d: %s", statusCode, string(body))
	}

	if statusCode < 200 || statusCode >= 300 {
		errMsg := parsed.Message
		if errMsg == "" {
			errMsg = string(body)
		}
		return nil, fmt.Errorf("hailuo API status %d: %s", statusCode, errMsg)
	}

	if !strings.EqualFold(parsed.Code, "success") {
		errMsg := parsed.Message
		if errMsg == "" {
			errMsg = "hailuo query failed"
		}
		return nil, fmt.Errorf("%s", errMsg)
	}

	resultURL := strings.TrimSpace(parsed.Data.Data.File.DownloadURL)
	if resultURL == "" {
		resultURL = strings.TrimSpace(parsed.Data.Data.File.BackupDownloadURL)
	}

	return &VideoProviderTaskResult{
		TaskID:    parsed.Data.TaskID,
		Status:    parsed.Data.Status,
		Message:   firstNonEmptyString(parsed.Message, parsed.Data.Data.BaseResp.StatusMsg, parsed.Data.FailReason),
		ResultURL: resultURL,
		RawMeta: compactTaskMeta(map[string]interface{}{
			"provider_action":            parsed.Data.Action,
			"provider_fail_reason":       parsed.Data.FailReason,
			"provider_progress":          parsed.Data.Progress,
			"provider_submit_time":       parsed.Data.SubmitTime,
			"provider_start_time":        parsed.Data.StartTime,
			"provider_finish_time":       parsed.Data.FinishTime,
			"provider_result_status":     parsed.Data.Data.Status,
			"provider_result_file_id":    parsed.Data.Data.FileID,
			"provider_result_filename":   parsed.Data.Data.File.Filename,
			"provider_result_file_bytes": parsed.Data.Data.File.Bytes,
			"provider_result_file_url":   resultURL,
			"provider_video_width":       parsed.Data.Data.VideoWidth,
			"provider_video_height":      parsed.Data.Data.VideoHeight,
			"provider_base_status_code":  parsed.Data.Data.BaseResp.StatusCode,
			"provider_base_status_msg":   parsed.Data.Data.BaseResp.StatusMsg,
		}),
	}, nil
}
