package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"backend-server/config"
	"backend-server/models"

	"github.com/go-pay/gopay"
	"github.com/go-pay/gopay/alipay"
	"github.com/google/uuid"
)

var alipayClient *alipay.Client

// InitAlipay initializes the Alipay client
func InitAlipay() error {
	cfg := config.Cfg

	if cfg.AlipayAppID == "" {
		log.Println("Alipay not configured, payment feature disabled")
		return nil
	}

	var err error
	alipayClient, err = alipay.NewClient(cfg.AlipayAppID, cfg.AlipayPrivateKey, !cfg.AlipaySandbox)
	if err != nil {
		return fmt.Errorf("failed to create alipay client: %w", err)
	}

	// Set notify and return URLs
	alipayClient.NotifyUrl = cfg.AlipayNotifyURL
	alipayClient.ReturnUrl = cfg.AlipayReturnURL

	// Set Alipay public key for signature verification
	if cfg.AlipayPublicKey != "" {
		alipayClient.AutoVerifySign([]byte(cfg.AlipayPublicKey))
	}

	log.Println("Alipay client initialized successfully")
	return nil
}

// CreateRechargeOrder creates a new recharge order
func CreateRechargeOrder(userID string, amountYuan int) (*models.Order, error) {
	if amountYuan <= 0 {
		return nil, errors.New("amount must be positive")
	}

	// Calculate credits: 1 yuan = CREDITS_PER_YUAN credits
	credits := amountYuan * config.Cfg.CreditsPerYuan

	// Create order
	order := &models.Order{
		ID:         uuid.New().String(),
		UserID:     userID,
		OutTradeNo: fmt.Sprintf("TTS%d%s", time.Now().UnixNano(), uuid.New().String()[:8]),
		Amount:     amountYuan * 100, // Convert to cents
		Credits:    credits,
		Status:     models.OrderStatusPending,
		PayMethod:  "alipay",
	}

	if err := models.DB.Create(order).Error; err != nil {
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	return order, nil
}

// GetAlipayPaymentURL generates the Alipay payment URL for an order
func GetAlipayPaymentURL(order *models.Order) (string, error) {
	if alipayClient == nil {
		return "", errors.New("alipay not configured")
	}

	// Build payment request
	bm := gopay.BodyMap{}
	bm.Set("subject", fmt.Sprintf("IndexTTS Credits Recharge - %d credits", order.Credits))
	bm.Set("out_trade_no", order.OutTradeNo)
	bm.Set("total_amount", fmt.Sprintf("%.2f", float64(order.Amount)/100))
	bm.Set("product_code", "FAST_INSTANT_TRADE_PAY")

	// Generate payment URL
	payURL, err := alipayClient.TradePagePay(context.Background(), bm)
	if err != nil {
		return "", fmt.Errorf("failed to generate payment URL: %w", err)
	}

	return payURL, nil
}

// GetAlipayWapPaymentURL generates the Alipay WAP payment URL for mobile
func GetAlipayWapPaymentURL(order *models.Order) (string, error) {
	if alipayClient == nil {
		return "", errors.New("alipay not configured")
	}

	bm := gopay.BodyMap{}
	bm.Set("subject", fmt.Sprintf("IndexTTS Credits - %d", order.Credits))
	bm.Set("out_trade_no", order.OutTradeNo)
	bm.Set("total_amount", fmt.Sprintf("%.2f", float64(order.Amount)/100))
	bm.Set("product_code", "QUICK_WAP_WAY")
	bm.Set("quit_url", config.Cfg.AlipayReturnURL)

	payURL, err := alipayClient.TradeWapPay(context.Background(), bm)
	if err != nil {
		return "", fmt.Errorf("failed to generate wap payment URL: %w", err)
	}

	return payURL, nil
}

// HandleAlipayNotify processes the Alipay payment notification
func HandleAlipayNotify(notifyData gopay.BodyMap) error {
	if alipayClient == nil {
		return errors.New("alipay not configured")
	}

	// Verify signature
	ok, err := alipay.VerifySign(config.Cfg.AlipayPublicKey, notifyData)
	if err != nil || !ok {
		return errors.New("invalid signature")
	}

	outTradeNo := notifyData.Get("out_trade_no")
	tradeNo := notifyData.Get("trade_no")
	tradeStatus := notifyData.Get("trade_status")

	// Find order
	var order models.Order
	if err := models.DB.First(&order, "out_trade_no = ?", outTradeNo).Error; err != nil {
		return fmt.Errorf("order not found: %w", err)
	}

	// Skip if already processed
	if order.Status != models.OrderStatusPending {
		return nil
	}

	// Update order based on trade status
	if tradeStatus == "TRADE_SUCCESS" || tradeStatus == "TRADE_FINISHED" {
		now := time.Now()
		order.Status = models.OrderStatusPaid
		order.TradeNo = tradeNo
		order.PaidAt = &now

		if err := models.DB.Save(&order).Error; err != nil {
			return fmt.Errorf("failed to update order: %w", err)
		}

		// Add credits to user
		if err := AddCredits(order.UserID, order.Credits, order.ID, fmt.Sprintf("Recharge %d yuan", order.Amount/100)); err != nil {
			log.Printf("Failed to add credits for order %s: %v", order.ID, err)
			return err
		}

		log.Printf("Order %s paid successfully, added %d credits to user %s", order.ID, order.Credits, order.UserID)
	} else if tradeStatus == "TRADE_CLOSED" {
		order.Status = models.OrderStatusFailed
		order.ErrorMessage = "Trade closed"
		models.DB.Save(&order)
	}

	return nil
}

// GetOrderByID retrieves an order by ID
func GetOrderByID(orderID, userID string) (*models.Order, error) {
	var order models.Order
	if err := models.DB.First(&order, "id = ? AND user_id = ?", orderID, userID).Error; err != nil {
		return nil, err
	}
	return &order, nil
}

// GetOrderByOutTradeNo retrieves an order by out_trade_no
func GetOrderByOutTradeNo(outTradeNo string) (*models.Order, error) {
	var order models.Order
	if err := models.DB.First(&order, "out_trade_no = ?", outTradeNo).Error; err != nil {
		return nil, err
	}
	return &order, nil
}

// ListUserOrders lists orders for a user
func ListUserOrders(userID string, page, pageSize int) ([]models.Order, int64, error) {
	var orders []models.Order
	var total int64

	query := models.DB.Model(&models.Order{}).Where("user_id = ?", userID)
	query.Count(&total)

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&orders).Error; err != nil {
		return nil, 0, err
	}

	return orders, total, nil
}
