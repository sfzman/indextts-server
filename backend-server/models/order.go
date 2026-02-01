package models

import (
	"time"

	"gorm.io/gorm"
)

// OrderStatus represents the status of a payment order
type OrderStatus string

const (
	OrderStatusPending  OrderStatus = "pending"  // Waiting for payment
	OrderStatusPaid     OrderStatus = "paid"     // Payment completed
	OrderStatusFailed   OrderStatus = "failed"   // Payment failed
	OrderStatusRefunded OrderStatus = "refunded" // Refunded
)

// Order represents a credit recharge order
type Order struct {
	ID            string         `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID        string         `gorm:"type:varchar(36);index;not null" json:"user_id"`
	OutTradeNo    string         `gorm:"type:varchar(64);uniqueIndex;not null" json:"out_trade_no"` // Our order number
	TradeNo       string         `gorm:"type:varchar(64)" json:"trade_no,omitempty"`                // Alipay trade number
	Amount        int            `gorm:"not null" json:"amount"`                                    // Amount in cents (分)
	Credits       int            `gorm:"not null" json:"credits"`                                   // Credits to add
	Status        OrderStatus    `gorm:"type:varchar(20);index;default:pending" json:"status"`
	PayMethod     string         `gorm:"type:varchar(20);default:alipay" json:"pay_method"`
	PaidAt        *time.Time     `json:"paid_at,omitempty"`
	ErrorMessage  string         `gorm:"type:text" json:"error_message,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for Order
func (Order) TableName() string {
	return "orders"
}

// CreditLog records credit changes
type CreditLog struct {
	ID        string    `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID    string    `gorm:"type:varchar(36);index;not null" json:"user_id"`
	Amount    int       `gorm:"not null" json:"amount"`        // Positive for add, negative for deduct
	Balance   int       `gorm:"not null" json:"balance"`       // Balance after this transaction
	Type      string    `gorm:"type:varchar(20)" json:"type"`  // register, recharge, consume, refund
	RefID     string    `gorm:"type:varchar(36)" json:"ref_id"` // Reference ID (order_id or task_id)
	Remark    string    `gorm:"type:varchar(256)" json:"remark,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// TableName specifies the table name for CreditLog
func (CreditLog) TableName() string {
	return "credit_logs"
}
