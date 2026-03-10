package services

import (
	"fmt"

	"backend-server/models"
)

const (
	videoProviderWan    = "wan"
	videoProviderHailuo = "hailuo"
)

// VideoProviderSubmitRequest is the normalized provider submit input.
type VideoProviderSubmitRequest struct {
	ModelCode      string
	Prompt         string
	NegativePrompt string
	Template       string
	ImageURL       string
	AudioURL       string
	Resolution     string
	Duration       *int
	PromptExtend   *bool
	Audio          *bool
	Seed           *int64
	Watermark      *bool
}

// VideoProviderTaskResult is the normalized provider submit/query output.
type VideoProviderTaskResult struct {
	TaskID    string
	Status    string
	Message   string
	RequestID string
	ResultURL string
	RawMeta   map[string]interface{}
}

// VideoProvider abstracts upstream provider calls.
type VideoProvider interface {
	Name() string
	Submit(*VideoProviderSubmitRequest) (*VideoProviderTaskResult, error)
	Query(taskID string) (*VideoProviderTaskResult, error)
	MapStatus(status string) models.TaskStatus
}

func GetVideoProvider(modelCode string) (VideoProvider, error) {
	def, ok := GetVideoModelDefinition(modelCode)
	if !ok {
		return nil, fmt.Errorf("unsupported video model: %s", modelCode)
	}

	switch def.Provider {
	case videoProviderWan:
		return wanVideoProvider{}, nil
	case videoProviderHailuo:
		return hailuoVideoProvider{}, nil
	default:
		return nil, fmt.Errorf("unsupported video provider: %s", def.Provider)
	}
}
