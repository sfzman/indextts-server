package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"backend-server/config"
	"backend-server/handlers"
	"backend-server/models"
	"backend-server/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	if err := config.Load(); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize database
	if err := models.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Initialize OSS
	if err := services.InitOSS(); err != nil {
		log.Fatalf("Failed to initialize OSS: %v", err)
	}

	// Initialize inference service
	if err := services.InitInference(); err != nil {
		log.Fatalf("Failed to initialize inference service: %v", err)
	}

	// Start background worker
	worker := services.NewWorker()
	worker.Start()

	// Set Gin mode
	gin.SetMode(config.Cfg.GinMode)

	// Create router
	r := gin.Default()

	// CORS middleware
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
		})
	})

	// API routes
	api := r.Group("/api/v1")
	{
		// Upload
		api.POST("/upload", handlers.UploadAudio)

		// Tasks
		api.POST("/tasks", handlers.CreateTask)
		api.GET("/tasks", handlers.ListTasks)
		api.GET("/tasks/:id", handlers.GetTask)
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh

		log.Println("Shutting down...")
		worker.Stop()
		os.Exit(0)
	}()

	// Start server
	addr := ":" + config.Cfg.ServerPort
	log.Printf("Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
