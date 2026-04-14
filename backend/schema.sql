-- ================================================
-- Animal Adoption Platform - Full Database Schema
-- ================================================

CREATE DATABASE IF NOT EXISTS animal_adoption;
USE animal_adoption;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS Donation_Transactions;
DROP TABLE IF EXISTS Donations;
DROP TABLE IF EXISTS Toys;
DROP TABLE IF EXISTS Medicine;
DROP TABLE IF EXISTS BuySell;
DROP TABLE IF EXISTS Adoptions;
DROP TABLE IF EXISTS Delete_Post;
DROP TABLE IF EXISTS Moderation;
DROP TABLE IF EXISTS Posts;
DROP TABLE IF EXISTS AnimalTypes;
DROP TABLE IF EXISTS Users;
DROP TABLE IF EXISTS Admins;
DROP TABLE IF EXISTS Accounts;

SET FOREIGN_KEY_CHECKS = 1;

-- =========================
-- ACCOUNTS (Supertype)
-- =========================
CREATE TABLE Accounts (
    account_id    INT PRIMARY KEY AUTO_INCREMENT,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(100) UNIQUE NOT NULL,
    mobile        VARCHAR(20),
    date_of_birth DATE,
    balance       DECIMAL(10,2) DEFAULT 500.00,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('user','admin') DEFAULT 'user',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- USER
CREATE TABLE Users (
    user_id INT PRIMARY KEY,
    FOREIGN KEY (user_id) REFERENCES Accounts(account_id) ON DELETE CASCADE
);

-- ADMIN
CREATE TABLE Admins (
    admin_id INT PRIMARY KEY,
    FOREIGN KEY (admin_id) REFERENCES Accounts(account_id) ON DELETE CASCADE
);

-- =========================
-- ANIMAL TYPES (DYNAMIC)
-- =========================
CREATE TABLE AnimalTypes (
    animal_type_id INT PRIMARY KEY AUTO_INCREMENT,
    name           VARCHAR(50) UNIQUE NOT NULL
);

-- =========================
-- POSTS
-- =========================
CREATE TABLE Posts (
    post_id     INT PRIMARY KEY AUTO_INCREMENT,
    account_id  INT NOT NULL,
    description TEXT,
    post_date   DATE NOT NULL,
    post_type   VARCHAR(20) NOT NULL COMMENT 'Adoption or BuySell',
    image_url   VARCHAR(255),
    FOREIGN KEY (account_id) REFERENCES Accounts(account_id)
);

-- =========================
-- ADMIN ACTIONS
-- =========================
CREATE TABLE Moderation (
    admin_id     INT,
    post_id      INT,
    moderated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes        TEXT,
    PRIMARY KEY (admin_id, post_id),
    FOREIGN KEY (admin_id) REFERENCES Admins(admin_id),
    FOREIGN KEY (post_id)  REFERENCES Posts(post_id) ON DELETE CASCADE
);

CREATE TABLE Delete_Post (
    admin_id   INT,
    post_id    INT,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (admin_id, post_id),
    FOREIGN KEY (admin_id) REFERENCES Admins(admin_id)
    -- No FK to Posts since post will be deleted
);

-- =========================
-- ADOPTION POSTS
-- =========================
CREATE TABLE Adoptions (
    adoption_id     INT PRIMARY KEY AUTO_INCREMENT,
    post_id         INT UNIQUE NOT NULL,
    animal_type_id  INT NOT NULL,
    animal_name     VARCHAR(100),
    gender          VARCHAR(10),
    age             INT,
    location        VARCHAR(100),
    FOREIGN KEY (post_id)        REFERENCES Posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (animal_type_id) REFERENCES AnimalTypes(animal_type_id)
);

-- =========================
-- BUY/SELL POSTS
-- =========================
CREATE TABLE BuySell (
    buysell_id INT PRIMARY KEY AUTO_INCREMENT,
    post_id    INT UNIQUE NOT NULL,
    category   VARCHAR(50) NOT NULL COMMENT 'Medicine or Toys',
    FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE
);

-- MEDICINE DETAILS
CREATE TABLE Medicine (
    medicine_id INT PRIMARY KEY AUTO_INCREMENT,
    buysell_id  INT UNIQUE NOT NULL,
    expire_date DATE,
    FOREIGN KEY (buysell_id) REFERENCES BuySell(buysell_id) ON DELETE CASCADE
);

-- TOYS DETAILS (FK corrected)
CREATE TABLE Toys (
    toy_id     INT PRIMARY KEY AUTO_INCREMENT,
    buysell_id INT UNIQUE NOT NULL,
    FOREIGN KEY (buysell_id) REFERENCES BuySell(buysell_id) ON DELETE CASCADE
);

-- =========================
-- DONATION CAMPAIGNS
-- =========================
CREATE TABLE Donations (
    donation_id    INT PRIMARY KEY AUTO_INCREMENT,
    title          VARCHAR(100) NOT NULL,
    description    TEXT,
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    target_amount  DECIMAL(10,2) NOT NULL,
    current_amount DECIMAL(10,2) DEFAULT 0.00,
    animal_type_id INT,
    FOREIGN KEY (animal_type_id) REFERENCES AnimalTypes(animal_type_id)
);

-- DONATION TRANSACTIONS
CREATE TABLE Donation_Transactions (
    transaction_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id        INT NOT NULL,
    donation_id    INT NOT NULL,
    amount         DECIMAL(10,2) NOT NULL,
    date           DATE NOT NULL,
    FOREIGN KEY (user_id)    REFERENCES Users(user_id),
    FOREIGN KEY (donation_id) REFERENCES Donations(donation_id)
);
