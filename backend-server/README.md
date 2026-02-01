# IndexTTS Backend Server

Go 后端服务，用于 IndexTTS 语音克隆和合成服务。

## 快速开始

```bash
# 复制并配置环境变量
cp .env.example .env

# 启动服务
go run .
```

## 积分系统

### 规则
- 新用户注册赠送 30 积分
- 每次成功创建 TTS 任务消耗 10 积分
- 充值 1 元 = 20 积分
- 白名单用户使用不消耗积分

### 配置
```bash
CREDITS_INITIAL=30       # 新用户初始积分
CREDITS_PER_TASK=10      # 每次任务消耗积分
CREDITS_PER_YUAN=20      # 每元对应积分数
PHONE_WHITELIST=13800138000,13900139000  # 白名单手机号
```

### API 接口
- `GET /api/v1/credits` - 获取当前积分
- `GET /api/v1/credits/logs` - 获取积分变动记录
- `POST /api/v1/payment/orders` - 创建充值订单 (PC 网页支付)
- `POST /api/v1/payment/orders/wap` - 创建充值订单 (手机网页支付)
- `GET /api/v1/payment/orders` - 获取订单列表
- `GET /api/v1/payment/orders/:id` - 获取订单详情

## 支付宝开通指南

### 1. 注册支付宝开放平台账号

访问 [支付宝开放平台](https://open.alipay.com/) 注册并登录。

### 2. 创建应用

1. 进入控制台，点击「创建应用」
2. 选择「网页&移动应用」
3. 填写应用名称、图标等信息
4. 提交审核

### 3. 配置密钥

#### 3.1 生成 RSA2 密钥对

使用支付宝提供的密钥生成工具，或使用 OpenSSL：

```bash
# 生成私钥
openssl genrsa -out app_private_key.pem 2048

# 生成公钥
openssl rsa -in app_private_key.pem -pubout -out app_public_key.pem
```

#### 3.2 配置应用公钥

1. 在应用详情页，点击「设置」->「开发设置」
2. 在「接口加签方式」处选择「公钥」
3. 将 `app_public_key.pem` 的内容（去掉头尾标识）粘贴进去
4. 保存后，支付宝会返回「支付宝公钥」，保存下来用于验签

### 4. 添加功能

在应用管理页面，添加以下功能：
- **电脑网站支付** (`alipay.trade.page.pay`)
- **手机网站支付** (`alipay.trade.wap.pay`)

### 5. 签约

1. 进入「产品中心」
2. 搜索「电脑网站支付」和「手机网站支付」
3. 点击「立即签约」
4. 按照指引完成签约流程

**签约要求：**
- 需要企业支付宝账户
- 需要有效的营业执照
- 需要提供网站备案信息

### 6. 配置环境变量

```bash
# 应用 ID (在应用详情页获取)
ALIPAY_APP_ID=2021000000000000

# 应用私钥 (步骤 3.1 生成的私钥)
ALIPAY_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----"

# 支付宝公钥 (步骤 3.2 支付宝返回的公钥)
ALIPAY_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...
-----END PUBLIC KEY-----"

# 支付结果异步通知地址 (必须是公网 HTTPS 地址)
ALIPAY_NOTIFY_URL=https://your-domain.com/api/v1/payment/alipay/notify

# 支付完成后前端跳转地址
ALIPAY_RETURN_URL=https://your-domain.com/payment/success

# 沙箱环境 (测试用)
ALIPAY_SANDBOX=false
```

### 7. 测试

#### 沙箱环境测试

1. 在开放平台进入「沙箱环境」
2. 获取沙箱应用的 AppID 和密钥
3. 设置 `ALIPAY_SANDBOX=true`
4. 使用沙箱版支付宝 App 扫码支付

#### 回调地址测试

在本地开发时，可以使用 [ngrok](https://ngrok.com/) 或 [frp](https://github.com/fatedier/frp) 将本地服务暴露到公网：

```bash
ngrok http 8080
```

然后将生成的 HTTPS 地址配置到 `ALIPAY_NOTIFY_URL`。

### 8. 上线

1. 提交应用上线审核
2. 审核通过后，将沙箱配置改为正式环境配置
3. 确保 `ALIPAY_SANDBOX=false`
4. 确保回调地址已配置为正式域名

## 常见问题

### Q: 支付后积分没有到账？
A: 检查以下几点：
1. `ALIPAY_NOTIFY_URL` 是否配置正确且可访问
2. 服务器日志是否有收到回调请求
3. 支付宝公钥是否配置正确

### Q: 如何查看支付回调日志？
A: 在支付宝开放平台的「运维中心」->「交易查询」可以查看交易记录和回调状态。

### Q: 个人账户可以使用吗？
A: 支付宝电脑/手机网站支付需要企业账户签约。个人开发者可以使用沙箱环境测试。
