package services

import "testing"

func TestVideoProviderLookup(t *testing.T) {
	testCases := []struct {
		modelCode        string
		expectedProvider string
	}{
		{modelCode: "wan2.6-i2v", expectedProvider: "wan"},
		{modelCode: "wan2.6-i2v-flash", expectedProvider: "wan"},
		{modelCode: "wan2.5-i2v-preview", expectedProvider: "wan"},
		{modelCode: "hailuo-2.3", expectedProvider: "hailuo"},
	}

	for _, tc := range testCases {
		provider, err := GetVideoProvider(tc.modelCode)
		if err != nil {
			t.Fatalf("expected provider lookup for %s to succeed: %v", tc.modelCode, err)
		}
		if provider.Name() != tc.expectedProvider {
			t.Fatalf("expected provider %s for %s, got %s", tc.expectedProvider, tc.modelCode, provider.Name())
		}
	}
}

func TestHailuoStatusMapping(t *testing.T) {
	provider := hailuoVideoProvider{}

	if got := provider.MapStatus("SUCCESS"); got != "completed" {
		t.Fatalf("expected SUCCESS to map to completed, got %s", got)
	}
	if got := provider.MapStatus("PROCESSING"); got != "processing" {
		t.Fatalf("expected PROCESSING to map to processing, got %s", got)
	}
	if got := provider.MapStatus("QUEUEING"); got != "processing" {
		t.Fatalf("expected QUEUEING to map to processing, got %s", got)
	}
	if got := provider.MapStatus("FAILED"); got != "failed" {
		t.Fatalf("expected FAILED to map to failed, got %s", got)
	}
}

func TestHailuoQueryDecodingUsesPrimaryDownloadURL(t *testing.T) {
	body := []byte(`{
		"code": "success",
		"message": "",
		"data": {
			"task_id": "306792606023824",
			"action": "video_generation",
			"status": "SUCCESS",
			"progress": "100%",
			"data": {
				"file": {
					"download_url": "https://example.com/output.mp4",
					"backup_download_url": "https://backup.example.com/output.mp4"
				}
			}
		}
	}`)

	result, err := decodeHailuoQueryResponse(body, 200)
	if err != nil {
		t.Fatalf("expected decode to succeed: %v", err)
	}
	if result.ResultURL != "https://example.com/output.mp4" {
		t.Fatalf("unexpected result url: %s", result.ResultURL)
	}
	if result.Status != "SUCCESS" {
		t.Fatalf("unexpected status: %s", result.Status)
	}
}

func TestHailuoQueryDecodingFallsBackToBackupURL(t *testing.T) {
	body := []byte(`{
		"code": "success",
		"message": "",
		"data": {
			"task_id": "306792606023824",
			"action": "video_generation",
			"status": "SUCCESS",
			"progress": "100%",
			"data": {
				"file": {
					"download_url": "",
					"backup_download_url": "https://backup.example.com/output.mp4"
				}
			}
		}
	}`)

	result, err := decodeHailuoQueryResponse(body, 200)
	if err != nil {
		t.Fatalf("expected decode to succeed: %v", err)
	}
	if result.ResultURL != "https://backup.example.com/output.mp4" {
		t.Fatalf("unexpected fallback result url: %s", result.ResultURL)
	}
}
