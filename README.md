# Deep-learning-base-skin-cancer-data-cleaning-and-diagnosis-system
 A deep learning-based skin cancer data cleaning and diagnosis system. It uses a multi-stage image cleaning pipeline with fixed, rule-based, and learned cleaning, followed by EfficientNet-based feature extraction and classification. The system analyzes dermoscopic images to support accurate skin cancer risk assessment.
 # Dermanova AI

### Deep Learning Based Skin Cancer Data Cleaning and Diagnosis System

## Project Overview

Dermanova AI is a deep learning-based skin cancer data cleaning and diagnosis system designed to process and analyze dermoscopic skin lesion images. The system focuses on improving image quality through a multi-stage cleaning pipeline before performing deep learning-based classification.

The proposed system combines automated image preprocessing, rule-based image quality checking, learned cleaning, and EfficientNet-based deep feature extraction to support skin cancer classification.

## Problem Statement

Dermoscopic skin cancer datasets may contain different image-quality issues such as corrupted files, duplicate images, low-quality images, unreadable data, hair artifacts, and class imbalance. These issues can negatively affect the performance of deep learning models during classification.

Dermanova AI addresses these challenges by introducing an automated image cleaning and diagnosis workflow that prepares dermoscopic images before classification.

## Proposed Solution

The proposed system uses a multi-stage image cleaning pipeline. Initially, images are loaded and validated using OpenCV. The images are resized to 224×224 pixels, converted from BGR to RGB, and normalized.

After fixed preprocessing, rule-based cleaning is performed using image-quality conditions such as brightness and contrast analysis. Images with unsuitable brightness can be rejected, while low-contrast images can be enhanced using CLAHE.

The cleaned images are then processed using deep learning techniques. EfficientNet is used for deep feature extraction, followed by classification of the skin lesion images.

## Key Features

* Automated dermoscopic image preprocessing
* Image loading and validation
* Image resizing to 224×224 pixels
* BGR to RGB conversion
* Image normalization
* Brightness-based image quality checking
* Contrast analysis
* CLAHE-based contrast enhancement
* Multi-stage image cleaning
* EfficientNet-based deep feature extraction
* Skin lesion classification
* User authentication
* Prediction interface
* Feedback functionality

## System Workflow

The overall workflow of Dermanova AI is:

**Input Image → Image Validation → Fixed Preprocessing → Rule-Based Cleaning → Learned Cleaning → EfficientNet Feature Extraction → Classification → Prediction Result**

The preprocessing stage prepares the input image, while the cleaning stages improve the quality of the data before deep feature extraction and classification.

## Technologies Used

### Frontend

* HTML
* CSS
* JavaScript

### Backend

* PHP
* MySQL

### Artificial Intelligence and Deep Learning

* Python
* TensorFlow / Keras
* EfficientNet
* OpenCV

### Development Tools

* Visual Studio Code
* XAMPP
* GitHub

## Dataset

The proposed system uses the ISIC dataset for dermoscopic skin lesion image processing and classification.

The dataset provides dermoscopic images that can be used for image preprocessing, cleaning, feature extraction, and skin lesion classification.

## Project Structure

```text
Dermanova-AI/
│
├── index.html
├── login.html
├── login.php
├── signup.html
├── signup.php
├── logout.php
│
├── predict.php
├── app.js
├── style.css
│
├── db_connect.php
├── setup_db.php
├── update_table.php
├── update_profile.php
│
├── check_session.php
├── save_feedback.php
├── get_feedback.php
│
├── chatgpt.js
├── chatgpt_proxy.php
├── openai_config.php
│
├── send.php
├── test_mail.php
│
└── README.md
```

## Installation and Setup

### 1. Clone the Repository

Download or clone the project repository from GitHub.

### 2. Install XAMPP

Install XAMPP and start the following services:

* Apache
* MySQL

### 3. Place the Project

Copy the project folder into the XAMPP `htdocs` directory.

### 4. Configure the Database

Create the required MySQL database and configure the database connection details in:

```text
db_connect.php
```

### 5. Setup the Database

Run the required database setup file or import the required database structure into MySQL.

### 6. Run the Project

Open the project through the local XAMPP server in a web browser.

## Results

The proposed Dermanova AI system is designed to improve the quality of dermoscopic images before classification through automated cleaning and preprocessing.

The current reported system accuracy is approximately **92%**.

## Disclaimer

Dermanova AI is developed as an academic and research project. The system is intended for educational and research purposes and should not be considered a replacement for professional medical diagnosis.


