-- 添加消息文件关联表
CREATE TABLE IF NOT EXISTS message_files (
  id VARCHAR(36) PRIMARY KEY,
  message_id VARCHAR(36) NOT NULL,
  file_id VARCHAR(36) NOT NULL,
  dialog_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_message_id (message_id),
  INDEX idx_file_id (file_id),
  INDEX idx_dialog_id (dialog_id),
  FOREIGN KEY (message_id) REFERENCES dialog_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);
