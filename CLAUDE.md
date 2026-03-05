# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IndexTTS Server - 语音克隆与合成服务，包含三个子项目：

- **frontend** - React 前端应用 (VoxClone)
- **backend-server** - Go 后端服务 (任务管理、文件上传、用户认证、支付)
- **backend-inference** - Python TTS 推理服务 (IndexTTS-2, 需要 GPU)

## Architecture

```
┌─────────────────┐         ┌─────────────────────────┐         ┌──────────────────────┐
│  Frontend       │  ────→  │  Backend Server         │  ────→  │  Backend Inference   │
│  React + Vite   │  HTTP   │  Go + Gin (Port 8080)   │  HTTP   │  Python + FastAPI    │
│  Port 80 (SAE)  │  REST   │  Port 8080 (SAE)        │  JWT    │  Port 8000 (GPU)     │
└─────────────────┘         └───────────┬─────────────┘         └──────────────────────┘
                                        │
                                        ↓
                              ┌─────────────────────┐
                              │  MySQL + Aliyun OSS │
                              └─────────────────────┘
```

### Authentication

Two separate JWT systems in backend-server:
1. **User auth (HS256)** - `AUTH_JWT_SECRET` - 用户短信验证码登录
2. **Inference auth (RS256)** - `JWT_PRIVATE_KEY` - 后端调用推理服务

### Task Processing Flow

1. 用户创建 TTS 任务 → `POST /api/v1/tasks`
2. `Worker` (services/worker.go) 每 5 秒轮询 pending 任务
3. 从 OSS 下载参考音频 → 调用推理服务 API → 上传结果 WAV 到 OSS
4. 更新任务状态到数据库

## Build & Run Commands

### Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
npm run build    # 生产构建
```

### Backend Server

```bash
cd backend-server
cp .env.example .env  # 配置环境变量
go run .              # http://localhost:8080
go build -o main .    # 编译二进制
```

### Backend Inference

```bash
cd backend-inference
# 首次需要下载模型 (~5GB)
make download-model

# Docker 运行 (推荐)
make build
make run         # GPU 模式
make run-cpu     # CPU 模式
make logs        # 查看日志
make test        # 测试 TTS 端点
```

## Deployment

### GitHub Actions

部署在 push 到 `main` 分支时自动触发：

- **Frontend**: 修改 `frontend/` 目录 → `deploy-frontend.yml`
- **Backend Server**: 修改 `backend-server/` 目录 → `deploy-backend-server.yml`

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `ALIYUN_ACCESS_KEY_ID` | RAM 用户 AccessKey |
| `ALIYUN_ACCESS_KEY_SECRET` | RAM 用户 AccessKey Secret |
| `ALIYUN_ACR_USERNAME` | ACR 登录用户名 |
| `ALIYUN_ACR_PASSWORD` | ACR 登录密码 |
| `ALIYUN_REGION` | 阿里云地域 (如 `cn-beijing`) |
| `ALIYUN_ACR_NAMESPACE` | ACR 命名空间 |
| `SAE_FRONTEND_APP_ID` | Frontend SAE 应用 ID |
| `SAE_BACKEND_SERVER_APP_ID` | Backend Server SAE 应用 ID |
| `VITE_API_BASE_URL` | 后端 API 地址 |

### SAE Environment Variables

配置见 README.md "SAE 环境变量配置" 章节，关键变量：

- **Backend Server**: `DB_*`, `OSS_*`, `INFERENCE_URL`, `JWT_*`, `SMS_*`, `AUTH_*`, `ALIPAY_*`
- **Backend Inference**: `MODEL_DIR`, `DEFAULT_REFERENCE`, `JWT_PUBLIC_KEY`

## Key Configuration Files

- `backend-server/.env.example` - 后端环境变量模板
- `backend-inference/.env.example` - 推理服务环境变量模板
- `frontend/vite.config.ts` - 前端 Vite 配置 (含 `GEMINI_API_KEY`)

## API Routes (Backend Server)

**Public** (无需认证):
- `POST /api/v1/auth/send-code` - 发送验证码
- `POST /api/v1/auth/login` - 手机号 + 验证码登录
- `POST /api/v1/payment/alipay/notify` - 支付宝回调

**Protected** (需要 JWT):
- `GET /api/v1/auth/me` - 获取当前用户
- `POST /api/v1/upload` - 上传音频文件
- `GET /api/v1/files/:id` - 获取文件信息
- `POST /api/v1/tasks` - 创建 TTS 任务
- `GET /api/v1/tasks` - 任务列表
- `GET /api/v1/credits` - 积分查询
- `GET /api/v1/credits/logs` - 积分日志
- `POST /api/v1/payment/orders` - 创建支付订单

## Emotion System

IndexTTS-2 支持 8 维情感向量：`[happy, angry, sad, afraid, disgusted, melancholic, surprised, calm]`

三种控制方式：
1. `emotion_prompt` - 情感参考音频 URL
2. `emotion_vector` - 直接指定 8 维浮点数组
3. `use_emotion_text` - 通过 QwenEmotion 从合成文本自动检测

## Credits System

- 新用户初始 30 积分
- 每次 TTS 任务消耗 10 积分
- 支持支付宝充值 (1 元 = 20 积分)
- 白名单用户不扣积分
