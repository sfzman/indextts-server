package services

import "backend-server/models"

type wanVideoProvider struct{}

func (wanVideoProvider) Name() string {
	return videoProviderWan
}

func (wanVideoProvider) Submit(req *VideoProviderSubmitRequest) (*VideoProviderTaskResult, error) {
	upstreamReq := &MobiVideoSynthesisRequest{
		Model: req.ModelCode,
		Input: MobiVideoInput{
			Prompt:         req.Prompt,
			NegativePrompt: req.NegativePrompt,
			ImgURL:         req.ImageURL,
			AudioURL:       req.AudioURL,
			Template:       req.Template,
		},
		Parameters: &MobiVideoParameters{
			Audio:        req.Audio,
			Duration:     req.Duration,
			PromptExtend: req.PromptExtend,
			Resolution:   req.Resolution,
			Seed:         req.Seed,
			Watermark:    req.Watermark,
		},
	}

	resp, err := SubmitMobiVideoTask(upstreamReq)
	if err != nil {
		return nil, err
	}

	rawMeta := map[string]interface{}{
		"provider_submit_time":    resp.Output.SubmitTime,
		"provider_scheduled_time": resp.Output.ScheduleTime,
		"provider_end_time":       resp.Output.EndTime,
		"provider_video_url":      resp.Output.VideoURL,
		"provider_orig_prompt":    resp.Output.OrigPrompt,
		"provider_actual_prompt":  resp.Output.ActualPrompt,
		"provider_usage":          resp.Usage,
	}

	return &VideoProviderTaskResult{
		TaskID:    resp.Output.TaskID,
		Status:    resp.Output.TaskStatus,
		Message:   resp.Output.Message,
		RequestID: resp.RequestID,
		ResultURL: resp.Output.VideoURL,
		RawMeta:   compactTaskMeta(rawMeta),
	}, nil
}

func (wanVideoProvider) Query(taskID string) (*VideoProviderTaskResult, error) {
	resp, err := QueryMobiVideoTask(taskID)
	if err != nil {
		return nil, err
	}

	rawMeta := map[string]interface{}{
		"provider_submit_time":    resp.Output.SubmitTime,
		"provider_scheduled_time": resp.Output.ScheduleTime,
		"provider_end_time":       resp.Output.EndTime,
		"provider_video_url":      resp.Output.VideoURL,
		"provider_orig_prompt":    resp.Output.OrigPrompt,
		"provider_actual_prompt":  resp.Output.ActualPrompt,
		"provider_usage":          resp.Usage,
	}

	return &VideoProviderTaskResult{
		TaskID:    resp.Output.TaskID,
		Status:    resp.Output.TaskStatus,
		Message:   resp.Output.Message,
		RequestID: resp.RequestID,
		ResultURL: resp.Output.VideoURL,
		RawMeta:   compactTaskMeta(rawMeta),
	}, nil
}

func (wanVideoProvider) MapStatus(status string) models.TaskStatus {
	return MapMobiTaskStatus(status)
}
