# IndexTTS Server

语音克隆与合成服务，包含三个子项目：

- **frontend** - React 前端应用
- **backend-server** - Go 后端服务（任务管理、文件上传、用户认证）
- **backend-inference** - Python TTS 推理服务（需要 GPU）

## 项目架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                       │
│                        Port: 80 (SAE)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────────┐
│                 Backend Server (Go + Gin)                        │
│                      Port: 8080 (SAE)                           │
│  - 文件上传 (Aliyun OSS)                                        │
│  - 任务管理 (MySQL)                                              │
│  - JWT 认证                                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓ HTTP/REST (JWT)
┌─────────────────────────────────────────────────────────────────┐
│            Backend Inference (Python + FastAPI)                  │
│                     Port: 8000 (GPU 实例)                        │
│  - IndexTTS-2 语音合成                                          │
│  - 情感控制                                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 部署指南

### 前置准备

#### 1. 阿里云账号配置

需要开通以下阿里云服务：

- **ACR (容器镜像服务)** - 存储 Docker 镜像
- **SAE (Serverless 应用引擎)** - 部署前端和后端服务
- **OSS (对象存储)** - 存储上传的文件
- **RDS MySQL** - 数据库（或使用其他 MySQL 服务）

#### 2. 创建 RAM 子账号

1. 登录阿里云 RAM 控制台
2. 创建新用户，勾选 "OpenAPI 调用访问"
3. 为用户授予以下权限策略：
   - `AliyunContainerRegistryFullAccess` - ACR 完全访问权限
   - `AliyunSAEFullAccess` - SAE 完全访问权限
   - `AliyunDysmsFullAccess` - 短信服务完全访问权限（用于用户登录验证码）
4. 创建并保存 AccessKey ID 和 AccessKey Secret

#### 3. 创建 ACR 镜像仓库

1. 登录阿里云容器镜像服务控制台
2. 创建命名空间（如：`indextts`）
3. 创建镜像仓库：
   - `indextts-frontend` - 前端镜像
   - `indextts-backend-server` - 后端服务镜像
4. 获取 ACR 登录凭证：
   - Registry 地址：`registry.cn-beijing.aliyuncs.com`（根据地域选择）
   - 用户名：阿里云账号全名
   - 密码：在 ACR 控制台设置的固定密码

#### 4. 配置阿里云短信服务（用户认证）

用户通过手机验证码登录，需要配置阿里云短信服务：

1. 登录阿里云短信服务控制台
2. 申请短信签名（如：`IndexTTS`）
3. 申请短信模板，模板内容示例：
   ```
   您的验证码为：${code}，有效期5分钟，请勿泄露给他人。
   ```
   - 模板类型选择：验证码
   - 记录模板代码（如：`SMS_xxxxxxxx`）
4. 等待签名和模板审核通过

> **开发模式**：如果不配置 `SMS_ACCESS_KEY_ID`，系统会进入开发模式，验证码会打印到控制台而不是发送短信。

#### 5. 创建 SAE 应用

##### Frontend 应用

1. 登录 SAE 控制台
2. 创建应用：
   - **应用名称**: `indextts-frontend`
   - **部署方式**: 镜像
   - **应用实例数**: 1（可按需调整）
   - **CPU**: 0.5 核
   - **内存**: 1 GB
   - **端口**: 80
3. 配置 SLB（负载均衡）或绑定公网地址
4. 记录 **应用 ID**（格式如：`xxx-xxx-xxx`）

##### Backend Server 应用

1. 创建应用：
   - **应用名称**: `indextts-backend-server`
   - **部署方式**: 镜像
   - **应用实例数**: 1
   - **CPU**: 1 核
   - **内存**: 2 GB
   - **端口**: 8080
2. 配置环境变量（见下方环境变量配置）
3. 配置 SLB 或绑定公网地址
4. 记录 **应用 ID**

---

### GitHub Actions 配置

#### 1. 配置 Repository Secrets

在 GitHub 仓库的 `Settings > Secrets and variables > Actions > Secrets` 中添加：

| Secret 名称 | 说明 | 示例 |
|------------|------|-----|
| `ALIYUN_ACCESS_KEY_ID` | RAM 用户的 AccessKey ID | `LTAI5txxxxxxxxx` |
| `ALIYUN_ACCESS_KEY_SECRET` | RAM 用户的 AccessKey Secret | `xxxxxxxxxxxxxxxxxx` |
| `ALIYUN_ACR_USERNAME` | ACR 登录用户名（阿里云账号全名） | `your-aliyun-account` |
| `ALIYUN_ACR_PASSWORD` | ACR 登录密码（在 ACR 控制台设置） | `your-acr-password` |
| `ALIYUN_REGION` | 阿里云地域 | `cn-beijing` |
| `ALIYUN_ACR_NAMESPACE` | ACR 命名空间 | `indextts` |
| `SAE_FRONTEND_APP_ID` | Frontend SAE 应用 ID | `xxx-xxx-xxx` |
| `SAE_BACKEND_SERVER_APP_ID` | Backend Server SAE 应用 ID | `xxx-xxx-xxx` |
| `VITE_API_BASE_URL` | 后端 API 地址（供前端调用） | `https://api.example.com` |

#### 2. 触发部署

部署会在以下情况自动触发：

- **Frontend**: 推送到 `main` 分支且修改了 `frontend/` 目录下的文件
- **Backend Server**: 推送到 `main` 分支且修改了 `backend-server/` 目录下的文件

也可以在 GitHub Actions 页面手动触发（workflow_dispatch）。

---

### SAE 环境变量配置

#### Backend Server 环境变量

在 SAE 控制台为 backend-server 应用配置以下环境变量：

| 环境变量 | 说明 | 示例 |
|---------|------|-----|
| `APP_ENV` | 运行环境 | `production` |
| `SERVER_PORT` | 服务端口 | `8080` |
| `GIN_MODE` | Gin 运行模式 | `release` |
| `DB_DRIVER` | 数据库驱动 | `mysql` |
| `DB_HOST` | 数据库主机 | `rm-xxx.mysql.rds.aliyuncs.com` |
| `DB_PORT` | 数据库端口 | `3306` |
| `DB_USER` | 数据库用户 | `your_db_user` |
| `DB_PASSWORD` | 数据库密码 | `your_db_password` |
| `DB_NAME` | 数据库名 | `indextts` |
| `OSS_ENDPOINT` | OSS Endpoint | `oss-cn-beijing.aliyuncs.com` |
| `OSS_ACCESS_KEY_ID` | OSS AccessKey ID | `LTAI5txxxxxxxxx` |
| `OSS_ACCESS_KEY_SECRET` | OSS AccessKey Secret | `xxxxxxxxxxxxxxxxxx` |
| `OSS_BUCKET_NAME` | OSS Bucket 名称 | `your-bucket-name` |
| `CORS_ORIGINS` | CORS 允许的域名 | `https://your-frontend.com` |
| `INFERENCE_URL` | 推理服务地址 | `https://your-inference-url.com` |
| `JWT_PRIVATE_KEY` | JWT 私钥 (RS256, 用于推理服务) | `-----BEGIN RSA PRIVATE KEY-----...` |
| `JWT_EXPIRE_SECONDS` | JWT 过期时间（秒, 用于推理服务） | `3600` |
| `SMS_ACCESS_KEY_ID` | 阿里云短信 AccessKey ID | `LTAI5txxxxxxxxx` |
| `SMS_ACCESS_KEY_SECRET` | 阿里云短信 AccessKey Secret | `xxxxxxxxxxxxxxxxxx` |
| `SMS_SIGN_NAME` | 短信签名 | `IndexTTS` |
| `SMS_TEMPLATE_CODE` | 短信模板代码 | `SMS_xxxxxxxx` |
| `SMS_CODE_EXPIRE_MINUTES` | 验证码有效期（分钟） | `5` |
| `SMS_CODE_COOLDOWN_SECONDS` | 发送冷却时间（秒） | `60` |
| `AUTH_JWT_SECRET` | 用户认证 JWT 密钥 (HS256) | `your-secret-at-least-32-chars` |
| `AUTH_JWT_EXPIRE_HOURS` | 用户 Token 有效期（小时） | `168` |

> **注意**:
> - 对于多行的 JWT 私钥，在 SAE 控制台中可以直接粘贴完整内容。
> - `AUTH_JWT_SECRET` 用于用户登录认证，与 `JWT_PRIVATE_KEY`（推理服务认证）是独立的。

---

### 部署检查清单

#### 部署前

- [ ] 创建 RAM 子账号并授权
- [ ] 创建 ACR 命名空间和镜像仓库
- [ ] 创建 SAE 应用并获取应用 ID
- [ ] 创建 RDS MySQL 数据库
- [ ] 创建 OSS Bucket
- [ ] 配置 GitHub Secrets
- [ ] 为 SAE 应用配置环境变量

#### 部署后

- [ ] 检查 SAE 应用状态是否为 RUNNING
- [ ] 测试 Frontend 访问
- [ ] 测试 Backend Server `/health` 接口
- [ ] 测试前后端通信

---

### 常见问题

#### Q: 镜像推送失败

检查以下配置：
1. ACR 用户名和密码是否正确
2. ACR Registry 地址是否与创建的地域一致
3. 镜像仓库是否已创建

#### Q: SAE 部署失败

1. 检查 SAE 应用 ID 是否正确
2. 检查 RAM 用户是否有 SAE 权限
3. 查看 SAE 控制台的部署日志

#### Q: 应用启动失败

1. 检查 SAE 环境变量配置是否完整
2. 检查数据库连接是否正常
3. 查看 SAE 应用的运行日志

#### Q: 前后端通信失败

1. 检查 `VITE_API_BASE_URL` 是否配置正确
2. 检查 Backend Server 的 `CORS_ORIGINS` 配置
3. 检查 SLB/公网地址是否配置正确

---

### 本地开发

#### Frontend

```bash
cd frontend
npm install
npm run dev     # 开发服务器 (http://localhost:3000)
npm run build   # 生产构建
```

#### Backend Server

```bash
cd backend-server
cp .env.example .env  # 复制并修改环境变量
go run .              # 启动服务 (http://localhost:8080)
```

#### Backend Inference

```bash
cd backend-inference
make build    # 构建 Docker 镜像
make run      # 启动服务 (GPU 模式)
make run-cpu  # 启动服务 (CPU 模式)
```

---

### 文件结构

```
indextts-server/
├── .github/
│   └── workflows/
│       ├── deploy-frontend.yml        # Frontend 部署 workflow
│       └── deploy-backend-server.yml  # Backend Server 部署 workflow
├── frontend/
│   ├── Dockerfile                     # Frontend Docker 镜像
│   ├── nginx.conf                     # Nginx 配置
│   └── ...
├── backend-server/
│   ├── Dockerfile                     # Backend Server Docker 镜像
│   └── ...
├── backend-inference/
│   ├── Dockerfile                     # Inference GPU 版本镜像
│   ├── Dockerfile.cpu                 # Inference CPU 版本镜像
│   └── ...
└── README.md                          # 本文档
```

---

### 相关链接

- [阿里云 SAE 文档](https://help.aliyun.com/product/82031.html)
- [阿里云 ACR 文档](https://help.aliyun.com/product/25972.html)
- [阿里云 OSS 文档](https://help.aliyun.com/product/31815.html)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
