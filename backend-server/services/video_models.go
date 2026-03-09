package services

// VideoModelOption represents one selectable video generation model.
type VideoModelOption struct {
	Name        string `json:"name"`
	Code        string `json:"code"`
	Description string `json:"description"`
}

var videoModelOptions = []VideoModelOption{
	{
		Name:        "Wan 2.6",
		Code:        "wan2.6-i2v",
		Description: "万相2.6。新增多镜头叙事能力，同时支持自动配音和传入自定义音频文件。",
	},
	{
		Name:        "Wan 2.6 Flash",
		Code:        "wan2.6-i2v-flash",
		Description: "万相2.6-图生视频-Flash，生成更快更高性价比。智能分镜调度支持多镜头叙事，多人稳定对话，更自然真实音色，最高支持15秒时长生成",
	},
	{
		Name:        "Wan 2.5",
		Code:        "wan2.5-i2v-preview",
		Description: "万相2.5。图生视频预览版。",
	},
}

// ListVideoModelOptions returns a copy of supported video models.
func ListVideoModelOptions() []VideoModelOption {
	result := make([]VideoModelOption, len(videoModelOptions))
	copy(result, videoModelOptions)
	return result
}

// IsSupportedVideoModel checks whether model code exists in supported list.
func IsSupportedVideoModel(modelCode string) bool {
	for _, option := range videoModelOptions {
		if option.Code == modelCode {
			return true
		}
	}
	return false
}
