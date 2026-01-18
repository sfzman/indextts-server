# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VoxClone is a voice cloning web application using React + Vite frontend with Google Gemini API integration. The frontend is part of a larger indextts-server project (backend in `../backend/`).

## Development Commands

```bash
npm run dev      # Start dev server on port 3000
npm run build    # Production build
npm run preview  # Preview production build
```

## Tech Stack

- React 19 with TypeScript
- Vite 6 build tool
- Tailwind CSS (via CDN)
- Google Gemini API (@google/genai) for voice analysis and TTS generation

## Architecture

### Component Structure
- `App.tsx` - Root component with auth state management
- `components/Auth.tsx` - Phone + verification code login flow
- `components/VoiceStudio.tsx` - Main voice cloning interface
- `components/TaskList.tsx` - Paginated task history management

### Service Layer
- `services/geminiService.ts` - Gemini API integration for voice analysis and TTS
- `services/audioUtils.ts` - Audio encoding/decoding (Base64, WAV, AudioContext)

### Types
- `types.ts` - Core interfaces: VoiceProject, CloneTask, EmotionVectors, EmotionType

### Audio Processing Pipeline
File → Base64 encoding → Gemini analysis → Gemini TTS → WAV blob → ObjectURL for playback

### Emotion Control System
Three modes defined in `EmotionType` enum:
- `VECTORS` - 8-dimensional emotion vector (happy, angry, sad, fear, disgust, depressed, surprised, calm)
- `SAME_AS_VOICE` - Use same emotion as voice reference
- `REFERENCE_AUDIO` - Extract emotion from separate audio file

### State Persistence
Tasks and balance stored in localStorage:
- `voxclone_tasks` - Task history as JSON
- `voxclone_balance` - User credit balance

## Environment Variables

Create `.env.local` with:
```
GEMINI_API_KEY=<your-api-key>
```

The key is injected at build time via `vite.config.ts` as `process.env.GEMINI_API_KEY`.

## Path Aliases

`@/*` resolves to the root frontend directory (configured in `vite.config.ts` and `tsconfig.json`).
