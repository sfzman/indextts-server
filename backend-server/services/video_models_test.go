package services

import "testing"

func TestVideoModelDefinitions(t *testing.T) {
	t.Run("wan models support audio but not end frame", func(t *testing.T) {
		models := []string{"wan2.6-i2v", "wan2.6-i2v-flash", "wan2.5-i2v-preview"}
		for _, code := range models {
			def, ok := GetVideoModelDefinition(code)
			if !ok {
				t.Fatalf("expected model %s to exist", code)
			}
			if !def.SupportsAudio {
				t.Fatalf("expected model %s to support audio", code)
			}
			if def.SupportsEndFrame {
				t.Fatalf("expected model %s to reject end frame", code)
			}
			if !def.SupportsFirstFrame {
				t.Fatalf("expected model %s to support first frame", code)
			}
			if def.SupportsTextOnly {
				t.Fatalf("expected model %s to require first frame", code)
			}
		}
	})

	t.Run("hailuo supports text only and first frame but not audio or end frame", func(t *testing.T) {
		def, ok := GetVideoModelDefinition("hailuo-2.3")
		if !ok {
			t.Fatal("expected hailuo-2.3 to exist")
		}

		if !def.SupportsTextOnly {
			t.Fatal("expected hailuo-2.3 to support text-only mode")
		}
		if !def.SupportsFirstFrame {
			t.Fatal("expected hailuo-2.3 to support first-frame mode")
		}
		if def.SupportsAudio {
			t.Fatal("expected hailuo-2.3 to reject audio")
		}
		if def.SupportsEndFrame {
			t.Fatal("expected hailuo-2.3 to reject end frame")
		}

		got768P := def.DurationOptionsByResolution["768P"]
		if len(got768P) != 2 || got768P[0] != 6 || got768P[1] != 10 {
			t.Fatalf("unexpected 768P durations: %#v", got768P)
		}

		got1080P := def.DurationOptionsByResolution["1080P"]
		if len(got1080P) != 1 || got1080P[0] != 6 {
			t.Fatalf("unexpected 1080P durations: %#v", got1080P)
		}
	})
}
