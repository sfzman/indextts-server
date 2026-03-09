package models

import (
	"fmt"
	"log"
	"strings"

	"backend-server/config"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() error {
	cfg := config.Cfg

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.DBUser,
		cfg.DBPassword,
		cfg.DBHost,
		cfg.DBPort,
		cfg.DBName,
	)

	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Auto migrate
	if err := DB.AutoMigrate(&Task{}, &VideoTask{}, &File{}, &User{}, &VerificationCode{}, &Order{}, &CreditLog{}, &Favorite{}); err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	if err := ensureFileUniqueIndexes(); err != nil {
		return fmt.Errorf("failed to migrate file indexes: %w", err)
	}

	log.Println("Database connected and migrated successfully")
	return nil
}

type fileUniqueIndexRow struct {
	IndexName  string `gorm:"column:index_name"`
	ColumnName string `gorm:"column:column_name"`
	SeqInIndex int    `gorm:"column:seq_in_index"`
}

func ensureFileUniqueIndexes() error {
	var rows []fileUniqueIndexRow
	if err := DB.Raw(`
		SELECT INDEX_NAME AS index_name, COLUMN_NAME AS column_name, SEQ_IN_INDEX AS seq_in_index
		FROM INFORMATION_SCHEMA.STATISTICS
		WHERE TABLE_SCHEMA = DATABASE()
		  AND TABLE_NAME = ?
		  AND NON_UNIQUE = 0
		ORDER BY INDEX_NAME, SEQ_IN_INDEX
	`, "files").Scan(&rows).Error; err != nil {
		return err
	}

	indexColumns := make(map[string][]string)
	for _, row := range rows {
		indexColumns[row.IndexName] = append(indexColumns[row.IndexName], strings.ToLower(row.ColumnName))
	}

	for indexName, cols := range indexColumns {
		// Drop the legacy global unique index on oss_key so different users can
		// upload the same file hash/key.
		if indexName != "PRIMARY" && len(cols) == 1 && cols[0] == "oss_key" {
			escapedIndexName := strings.ReplaceAll(indexName, "`", "``")
			if err := DB.Exec(fmt.Sprintf("ALTER TABLE files DROP INDEX `%s`", escapedIndexName)).Error; err != nil {
				return err
			}
		}
	}

	const newIndexName = "idx_files_user_oss_key"
	if !DB.Migrator().HasIndex(&File{}, newIndexName) {
		if err := DB.Exec("CREATE UNIQUE INDEX idx_files_user_oss_key ON files (user_id, oss_key)").Error; err != nil {
			return err
		}
	}

	return nil
}
