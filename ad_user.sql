-- database_setup.sql
-- Run this script to create the database and tables

CREATE DATABASE IF NOT EXISTS ad_system;
USE ad_system;

-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    credits INT DEFAULT 5000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Ads table
CREATE TABLE ads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    link VARCHAR(500) NOT NULL,
    format ENUM('regular', 'banner', 'popup', 'modal', 'video', 'audio') NOT NULL,
    media_url VARCHAR(500),
    budget INT NOT NULL CHECK (budget >= 2000 AND budget <= 20000),
    spent INT DEFAULT 0,
    reward INT DEFAULT 0 CHECK (reward >= 0 AND reward <= 100),
    frequency ENUM('low', 'light', 'moderate', 'high', 'aggressive') DEFAULT 'moderate',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_active (active),
    INDEX idx_format (format),
    INDEX idx_frequency (frequency)
);

-- Quiz questions table
CREATE TABLE quiz_questions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ad_id INT NOT NULL,
    question TEXT NOT NULL,
    type ENUM('multiple', 'short') NOT NULL,
    options JSON, -- For multiple choice options (array of 4 options)
    correct_answer INT, -- Index of correct option for multiple choice (0-3)
    short_answer TEXT, -- Correct answer for short answer questions
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE,
    INDEX idx_ad_id (ad_id),
    INDEX idx_type (type)
);

-- Ad interactions table (views, completions, skips, rewards)
CREATE TABLE ad_interactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ad_id INT NOT NULL,
    user_id INT NOT NULL,
    interaction_type ENUM('view', 'completion', 'skip', 'reward_claimed') NOT NULL,
    credits_earned INT DEFAULT 0,
    quiz_question_id INT NULL, -- Reference to quiz question if reward was claimed
    answer_correct BOOLEAN NULL, -- Whether quiz answer was correct
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (quiz_question_id) REFERENCES quiz_questions(id) ON DELETE SET NULL,
    INDEX idx_ad_id (ad_id),
    INDEX idx_user_id (user_id),
    INDEX idx_interaction_type (interaction_type),
    INDEX idx_created_at (created_at)
);

-- Credit transactions table (for detailed tracking)
CREATE TABLE credit_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    transaction_type ENUM('earned', 'spent', 'refund', 'bonus') NOT NULL,
    amount INT NOT NULL,
    description TEXT,
    ad_id INT NULL, -- Reference to ad if transaction is ad-related
    interaction_id INT NULL, -- Reference to interaction if applicable
    balance_after INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE SET NULL,
    FOREIGN KEY (interaction_id) REFERENCES ad_interactions(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_transaction_type (transaction_type),
    INDEX idx_created_at (created_at)
);

-- Ad performance summary table (for faster analytics queries)
CREATE TABLE ad_performance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ad_id INT NOT NULL,
    date DATE NOT NULL,
    views INT DEFAULT 0,
    completions INT DEFAULT 0,
    skips INT DEFAULT 0,
    rewards_claimed INT DEFAULT 0,
    credits_spent INT DEFAULT 0,
    credits_rewarded INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE,
    UNIQUE KEY unique_ad_date (ad_id, date),
    INDEX idx_ad_id (ad_id),
    INDEX idx_date (date)
);

-- User sessions table (optional - for tracking user activity)
CREATE TABLE user_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    session_token VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_session_token (session_token),
    INDEX idx_expires_at (expires_at)
);

-- Insert some sample data for testing
INSERT INTO users (name, email, password, credits) VALUES 
('John Doe', 'john@example.com', '$2b$10$example.hash.here', 10000),
('Jane Smith', 'jane@example.com', '$2b$10$example.hash.here', 15000),
('Bob Wilson', 'bob@example.com', '$2b$10$example.hash.here', 8000);

-- Sample ad data
INSERT INTO ads (user_id, title, description, link, format, budget, reward, frequency) VALUES 
(1, 'Amazing Product Launch', 'Check out our revolutionary new product that will change your life!', 'https://example.com/product', 'video', 5000, 50, 'moderate'),
(1, 'Summer Sale Event', 'Huge discounts on all items. Limited time offer!', 'https://example.com/sale', 'banner', 3000, 25, 'high'),
(2, 'Learn Programming', 'Master coding with our comprehensive online courses', 'https://example.com/courses', 'regular', 4000, 35, 'light');

-- Sample quiz questions
INSERT INTO quiz_questions (ad_id, question, type, options, correct_answer) VALUES 
(1, 'What is the main benefit of this product?', 'multiple', '["Time saving", "Cost effective", "Revolutionary", "Easy to use"]', 2),
(1, 'What color was prominently featured in the ad?', 'multiple', '["Red", "Blue", "Green", "Yellow"]', 1);

INSERT INTO quiz_questions (ad_id, question, type, short_answer) VALUES 
(1, 'What was the main call to action?', 'short', 'try now');

INSERT INTO quiz_questions (ad_id, question, type, options, correct_answer) VALUES 
(2, 'What type of sale is being advertised?', 'multiple', '["Winter Sale", "Summer Sale", "Spring Sale", "Black Friday"]', 1);

INSERT INTO quiz_questions (ad_id, question, type, short_answer) VALUES 
(2, 'What is being offered?', 'short', 'discounts');

-- Create views for common queries
CREATE VIEW ad_stats AS
SELECT 
    a.id,
    a.title,
    a.user_id,
    a.budget,
    a.spent,
    a.reward,
    a.active,
    COUNT(DISTINCT CASE WHEN ai.interaction_type = 'view' THEN ai.id END) as total_views,
    COUNT(DISTINCT CASE WHEN ai.interaction_type = 'completion' THEN ai.id END) as total_completions,
    COUNT(DISTINCT CASE WHEN ai.interaction_type = 'skip' THEN ai.id END) as total_skips,
    COUNT(DISTINCT CASE WHEN ai.interaction_type = 'reward_claimed' THEN ai.id END) as total_rewards,
    COALESCE(SUM(CASE WHEN ai.interaction_type = 'reward_claimed' THEN ai.credits_earned END), 0) as total_credits_rewarded,
    CASE 
        WHEN COUNT(DISTINCT CASE WHEN ai.interaction_type = 'view' THEN ai.id END) > 0 
        THEN ROUND(COUNT(DISTINCT CASE WHEN ai.interaction_type = 'completion' THEN ai.id END) * 100.0 / COUNT(DISTINCT CASE WHEN ai.interaction_type = 'view' THEN ai.id END), 2)
        ELSE 0 
    END as completion_rate
FROM ads a
LEFT JOIN ad_interactions ai ON a.id = ai.ad_id
GROUP BY a.id, a.title, a.user_id, a.budget, a.spent, a.reward, a.active;

CREATE VIEW user_stats AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.credits,
    COUNT(DISTINCT a.id) as total_ads,
    SUM(a.budget) as total_budget,
    SUM(a.spent) as total_spent,
    COUNT(DISTINCT CASE WHEN ai.interaction_type = 'view' AND ai.user_id != u.id THEN ai.id END) as ads_viewed,
    COUNT(DISTINCT CASE WHEN ai.interaction_type = 'reward_claimed' AND ai.user_id = u.id THEN ai.id END) as rewards_earned,
    COALESCE(SUM(CASE WHEN ai.interaction_type = 'reward_claimed' AND ai.user_id = u.id THEN ai.credits_earned END), 0) as total_credits_earned
FROM users u
LEFT JOIN ads a ON u.id = a.user_id
LEFT JOIN ad_interactions ai ON (a.id = ai.ad_id OR ai.user_id = u.id)
GROUP BY u.id, u.name, u.email, u.credits;

-- Triggers for maintaining data integrity and performance summaries

DELIMITER //

-- Trigger to update ad performance table when interactions are added
CREATE TRIGGER update_ad_performance_after_interaction
AFTER INSERT ON ad_interactions
FOR EACH ROW
BEGIN
    INSERT INTO ad_performance (ad_id, date, views, completions, skips, rewards_claimed, credits_rewarded)
    VALUES (NEW.ad_id, DATE(NEW.created_at), 
            CASE WHEN NEW.interaction_type = 'view' THEN 1 ELSE 0 END,
            CASE WHEN NEW.interaction_type = 'completion' THEN 1 ELSE 0 END,
            CASE WHEN NEW.interaction_type = 'skip' THEN 1 ELSE 0 END,
            CASE WHEN NEW.interaction_type = 'reward_claimed' THEN 1 ELSE 0 END,
            NEW.credits_earned)
    ON DUPLICATE KEY UPDATE
        views = views + CASE WHEN NEW.interaction_type = 'view' THEN 1 ELSE 0 END,
        completions = completions + CASE WHEN NEW.interaction_type = 'completion' THEN 1 ELSE 0 END,
        skips = skips + CASE WHEN NEW.interaction_type = 'skip' THEN 1 ELSE 0 END,
        rewards_claimed = rewards_claimed + CASE WHEN NEW.interaction_type = 'reward_claimed' THEN 1 ELSE 0 END,
        credits_rewarded = credits_rewarded + NEW.credits_earned;
END//

-- Trigger to log credit transactions
CREATE TRIGGER log_credit_transaction
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    IF OLD.credits != NEW.credits THEN
        INSERT INTO credit_transactions (user_id, transaction_type, amount, balance_after, description)
        VALUES (NEW.id, 
                CASE WHEN NEW.credits > OLD.credits THEN 'earned' ELSE 'spent' END,
                ABS(NEW.credits - OLD.credits),
                NEW.credits,
                CASE WHEN NEW.credits > OLD.credits THEN 'Credits earned' ELSE 'Credits spent' END);
    END IF;
END//

-- Trigger to deactivate ads when budget is exhausted
CREATE TRIGGER check_ad_budget
AFTER UPDATE ON ads
FOR EACH ROW
BEGIN
    IF NEW.spent >= NEW.budget AND NEW.active = 1 THEN
        UPDATE ads SET active = 0 WHERE id = NEW.id;
    END IF;
END//

DELIMITER ;

-- Indexes for better performance
CREATE INDEX idx_ad_interactions_composite ON ad_interactions(ad_id, interaction_type, created_at);
CREATE INDEX idx_users_email_password ON users(email, password);
CREATE INDEX idx_ads_active_budget ON ads(active, spent, budget);

-- Clean up old sessions (can be run as a scheduled job)
-- DELETE FROM user_sessions WHERE expires_at < NOW();

-- Performance optimization queries (run periodically)
-- ANALYZE TABLE users, ads, quiz_questions, ad_interactions, credit_transactions, ad_performance;
-- OPTIMIZE TABLE users, ads, quiz_questions, ad_interactions, credit_transactions, ad_performance;