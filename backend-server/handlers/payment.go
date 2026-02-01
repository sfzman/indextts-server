package handlers

import (
	"fmt"
	"net/http"

	"backend-server/middleware"
	"backend-server/models"
	"backend-server/services"

	"github.com/gin-gonic/gin"
	"github.com/go-pay/gopay"
)

// CreateOrderRequest represents the request to create a recharge order
type CreateOrderRequest struct {
	Amount int `json:"amount" binding:"required,min=1,max=10000"` // Amount in yuan
}

// CreateOrderResponse represents the response after creating an order
type CreateOrderResponse struct {
	OrderID    string `json:"order_id"`
	OutTradeNo string `json:"out_trade_no"`
	Amount     int    `json:"amount"`
	Credits    int    `json:"credits"`
	PayURL     string `json:"pay_url"`
}

// CreateOrder creates a new recharge order
// POST /api/v1/payment/orders
func CreateOrder(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request: " + err.Error(),
		})
		return
	}

	// Create order
	order, err := services.CreateRechargeOrder(userID, req.Amount)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create order: " + err.Error(),
		})
		return
	}

	// Generate payment URL
	payURL, err := services.GetAlipayPaymentURL(order)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to generate payment URL: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, CreateOrderResponse{
		OrderID:    order.ID,
		OutTradeNo: order.OutTradeNo,
		Amount:     order.Amount,
		Credits:    order.Credits,
		PayURL:     payURL,
	})
}

// CreateWapOrder creates a new recharge order for mobile WAP payment
// POST /api/v1/payment/orders/wap
func CreateWapOrder(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request: " + err.Error(),
		})
		return
	}

	order, err := services.CreateRechargeOrder(userID, req.Amount)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create order: " + err.Error(),
		})
		return
	}

	payURL, err := services.GetAlipayWapPaymentURL(order)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to generate payment URL: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, CreateOrderResponse{
		OrderID:    order.ID,
		OutTradeNo: order.OutTradeNo,
		Amount:     order.Amount,
		Credits:    order.Credits,
		PayURL:     payURL,
	})
}

// GetOrder retrieves an order by ID
// GET /api/v1/payment/orders/:id
func GetOrder(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	orderID := c.Param("id")
	order, err := services.GetOrderByID(orderID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Order not found",
		})
		return
	}

	c.JSON(http.StatusOK, order)
}

// ListOrders lists user's orders
// GET /api/v1/payment/orders
func ListOrders(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	page := 1
	pageSize := 20

	if p := c.Query("page"); p != "" {
		var v int
		if _, err := parsePositiveInt(p); err == nil {
			v = parsePositiveIntValue(p)
			if v > 0 {
				page = v
			}
		}
	}

	if ps := c.Query("page_size"); ps != "" {
		var v int
		if _, err := parsePositiveInt(ps); err == nil {
			v = parsePositiveIntValue(ps)
			if v > 0 && v <= 100 {
				pageSize = v
			}
		}
	}

	orders, total, err := services.ListUserOrders(userID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list orders",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"orders":    orders,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// AlipayNotify handles Alipay payment notification callback
// POST /api/v1/payment/alipay/notify
func AlipayNotify(c *gin.Context) {
	// Parse form data
	if err := c.Request.ParseForm(); err != nil {
		c.String(http.StatusBadRequest, "fail")
		return
	}

	// Convert to BodyMap
	notifyData := make(gopay.BodyMap)
	for k, v := range c.Request.Form {
		if len(v) > 0 {
			notifyData.Set(k, v[0])
		}
	}

	// Handle notification
	if err := services.HandleAlipayNotify(notifyData); err != nil {
		c.String(http.StatusOK, "fail")
		return
	}

	// Return success to Alipay
	c.String(http.StatusOK, "success")
}

// GetCredits returns user's current credits
// GET /api/v1/credits
func GetCredits(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	credits, err := services.GetUserCredits(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get credits",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"credits": credits,
	})
}

// GetCreditLogs returns user's credit transaction logs
// GET /api/v1/credits/logs
func GetCreditLogs(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	page := 1
	pageSize := 20

	if p := c.Query("page"); p != "" {
		if v := parsePositiveIntValue(p); v > 0 {
			page = v
		}
	}

	if ps := c.Query("page_size"); ps != "" {
		if v := parsePositiveIntValue(ps); v > 0 && v <= 100 {
			pageSize = v
		}
	}

	var logs []models.CreditLog
	var total int64

	query := models.DB.Model(&models.CreditLog{}).Where("user_id = ?", userID)
	query.Count(&total)

	offset := (page - 1) * pageSize
	query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&logs)

	c.JSON(http.StatusOK, gin.H{
		"logs":      logs,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// helper functions
func parsePositiveInt(s string) (int, error) {
	var v int
	_, err := fmt.Sscanf(s, "%d", &v)
	return v, err
}

func parsePositiveIntValue(s string) int {
	v, _ := parsePositiveInt(s)
	return v
}
