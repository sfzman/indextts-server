package services

// VideoModelDefinition describes one supported video model and its capabilities.
type VideoModelDefinition struct {
	Name                        string           `json:"name"`
	Code                        string           `json:"code"`
	Description                 string           `json:"description"`
	Provider                    string           `json:"provider"`
	Credits                     int              `json:"credits"`
	SupportsTextOnly            bool             `json:"supports_text_only"`
	SupportsFirstFrame          bool             `json:"supports_first_frame"`
	SupportsEndFrame            bool             `json:"supports_end_frame"`
	SupportsAudio               bool             `json:"supports_audio"`
	Resolutions                 []string         `json:"resolutions"`
	DurationOptionsByResolution map[string][]int `json:"duration_options_by_resolution"`
}

var videoModelDefinitions = []VideoModelDefinition{
	{
		Name:               "Wan 2.6",
		Code:               "wan2.6-i2v",
		Description:        "万相2.6。新增多镜头叙事能力，同时支持自动配音和传入自定义音频文件。",
		Provider:           "wan",
		Credits:            20,
		SupportsFirstFrame: true,
		SupportsAudio:      true,
		Resolutions:        []string{"480P", "720P", "1080P"},
		DurationOptionsByResolution: map[string][]int{
			"480P":  {5, 10, 15},
			"720P":  {5, 10, 15},
			"1080P": {5, 10, 15},
		},
	},
	{
		Name:               "Wan 2.6 Flash",
		Code:               "wan2.6-i2v-flash",
		Description:        "万相2.6-图生视频-Flash，生成更快更高性价比。智能分镜调度支持多镜头叙事，多人稳定对话，更自然真实音色，最高支持15秒时长生成",
		Provider:           "wan",
		Credits:            20,
		SupportsFirstFrame: true,
		SupportsAudio:      true,
		Resolutions:        []string{"480P", "720P", "1080P"},
		DurationOptionsByResolution: map[string][]int{
			"480P":  {5, 10, 15},
			"720P":  {5, 10, 15},
			"1080P": {5, 10, 15},
		},
	},
	{
		Name:               "Wan 2.5",
		Code:               "wan2.5-i2v-preview",
		Description:        "万相2.5。图生视频预览版。",
		Provider:           "wan",
		Credits:            15,
		SupportsFirstFrame: true,
		SupportsAudio:      true,
		Resolutions:        []string{"480P", "720P", "1080P"},
		DurationOptionsByResolution: map[string][]int{
			"480P":  {5, 10, 15},
			"720P":  {5, 10, 15},
			"1080P": {5, 10, 15},
		},
	},
	// 调不通了，先下架
	// {
	// 	Name:               "Hailuo 2.3",
	// 	Code:               "hailuo-2.3",
	// 	Description:        "海螺 2.3。支持文生视频与图生视频，不支持音频和尾帧输入。",
	// 	Provider:           "hailuo",
	// 	Credits:            20,
	// 	SupportsTextOnly:   true,
	// 	SupportsFirstFrame: true,
	// 	Resolutions:        []string{"768P", "1080P"},
	// 	DurationOptionsByResolution: map[string][]int{
	// 		"768P":  {6, 10},
	// 		"1080P": {6},
	// 	},
	// },
}

// ListVideoModelOptions returns a copy of supported video model definitions.
func ListVideoModelOptions() []VideoModelDefinition {
	result := make([]VideoModelDefinition, 0, len(videoModelDefinitions))
	for _, def := range videoModelDefinitions {
		result = append(result, cloneVideoModelDefinition(def))
	}
	return result
}

// GetVideoModelDefinition returns one model definition by code.
func GetVideoModelDefinition(modelCode string) (VideoModelDefinition, bool) {
	for _, def := range videoModelDefinitions {
		if def.Code == modelCode {
			return cloneVideoModelDefinition(def), true
		}
	}
	return VideoModelDefinition{}, false
}

// IsSupportedVideoModel checks whether model code exists in supported list.
func IsSupportedVideoModel(modelCode string) bool {
	_, ok := GetVideoModelDefinition(modelCode)
	return ok
}

func cloneVideoModelDefinition(def VideoModelDefinition) VideoModelDefinition {
	cloned := def
	if def.Resolutions != nil {
		cloned.Resolutions = append([]string(nil), def.Resolutions...)
	}
	if def.DurationOptionsByResolution != nil {
		cloned.DurationOptionsByResolution = make(map[string][]int, len(def.DurationOptionsByResolution))
		for resolution, durations := range def.DurationOptionsByResolution {
			cloned.DurationOptionsByResolution[resolution] = append([]int(nil), durations...)
		}
	}
	return cloned
}
