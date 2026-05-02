"""
AI Training Script
Trains K-Means and LSTM models for intrusion detection
"""

import os
import logging

# IMPORT TENSORFLOW FIRST TO AVOID SEGFAULT ON WINDOWS
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import joblib

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Models directory
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(MODELS_DIR, exist_ok=True)

# ============================================================================
# GENERATE TRAINING DATA
# ============================================================================

def generate_training_data(n_normal=500, n_anomaly=100):
    """
    Generate synthetic network traffic data for training
    
    Features:
    - protocol (TCP=0, UDP=1, ICMP=2, HTTP=3, HTTPS=4)
    - src_port (0-65535)
    - dst_port (0-65535)
    - duration (0-3600000 ms)
    - bytes_sent (0-1000000)
    - bytes_received (0-1000000)
    - flags (0-63)
    """
    
    logger.info(f"Generating {n_normal} normal traffic samples...")
    
    # Normal traffic (baseline)
    normal_data = np.random.randn(n_normal, 7) * [0.5, 10000, 10000, 50000, 50000, 50000, 5]
    normal_data = np.abs(normal_data)
    normal_data[:, 0] = np.random.randint(0, 5, n_normal)  # protocol
    normal_labels = np.zeros(n_normal)
    
    logger.info(f"Generating {n_anomaly} attack/anomaly samples...")
    
    # Attack traffic
    attack_data = np.random.randn(n_anomaly, 7) * [0.5, 5000, 5000, 10000, 10000, 10000, 10]
    attack_data = np.abs(attack_data)
    attack_data[:, 0] = np.random.randint(0, 5, n_anomaly)  # protocol
    # Add noise to make them anomalous
    attack_data += np.random.uniform(5, 15, (n_anomaly, 7))
    attack_labels = np.ones(n_anomaly)
    
    # Combine
    X = np.vstack([normal_data, attack_data])
    y = np.concatenate([normal_labels, attack_labels])
    
    # Shuffle
    shuffle_idx = np.random.permutation(len(X))
    X = X[shuffle_idx]
    y = y[shuffle_idx]
    
    return X, y

# ============================================================================
# TRAIN K-MEANS
# ============================================================================

def train_kmeans(X, n_clusters=10):
    """
    Train K-Means for anomaly detection
    """
    logger.info(f"Training K-Means with {n_clusters} clusters...")
    
    # Normalize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Train K-Means
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    kmeans.fit(X_scaled)
    
    logger.info(f"K-Means training completed")
    logger.info(f"  - Inertia: {kmeans.inertia_:.2f}")
    
    # Save models
    kmeans_path = os.path.join(MODELS_DIR, 'kmeans.pkl')
    scaler_path = os.path.join(MODELS_DIR, 'scaler.pkl')
    
    joblib.dump(kmeans, kmeans_path)
    joblib.dump(scaler, scaler_path)
    
    logger.info(f"✅ K-Means saved to {kmeans_path}")
    logger.info(f"✅ Scaler saved to {scaler_path}")
    
    return kmeans, scaler

# ============================================================================
# TRAIN LSTM
# ============================================================================

def train_lstm(X, y, seq_length=10):
    """
    Train LSTM for attack classification
    """
    logger.info(f"Training LSTM for attack classification...")
    
    # Normalize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Create sequences
    X_seq = []
    y_seq = []
    for i in range(len(X_scaled) - seq_length):
        X_seq.append(X_scaled[i:i+seq_length])
        # Use the label of the last timestep
        y_seq.append(y[i+seq_length])
    
    X_seq = np.array(X_seq)
    y_seq = np.array(y_seq)
    
    logger.info(f"  - Sequence shape: {X_seq.shape}")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X_seq, y_seq, test_size=0.2, random_state=42, stratify=y_seq
    )
    
    # Build LSTM model
    model = Sequential([
        LSTM(64, activation='relu', input_shape=(seq_length, 7), return_sequences=True),
        Dropout(0.2),
        LSTM(32, activation='relu'),
        Dropout(0.2),
        Dense(16, activation='relu'),
        Dropout(0.1),
        Dense(1, activation='sigmoid')  # Binary classification
    ])
    
    model.compile(
        optimizer=Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=['accuracy']
    )
    
    logger.info(f"Model summary:")
    model.summary()
    
    # Train
    logger.info(f"Training LSTM...")
    early_stop = EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True)
    
    history = model.fit(
        X_train, y_train,
        epochs=5,
        batch_size=32,
        validation_split=0.2,
        callbacks=[early_stop],
        verbose=1
    )
    
    # Evaluate
    test_loss, test_acc = model.evaluate(X_test, y_test)
    logger.info(f"✅ LSTM Training completed")
    logger.info(f"  - Test Loss: {test_loss:.4f}")
    logger.info(f"  - Test Accuracy: {test_acc:.4f}")
    
    # Save model
    lstm_path = os.path.join(MODELS_DIR, 'lstm_model.h5')
    model.save(lstm_path)
    logger.info(f"✅ LSTM saved to {lstm_path}")
    
    return model

# ============================================================================
# MAIN
# ============================================================================

def main():
    """
    Main training function
    """
    print("="*60)
    print("AI MODEL TRAINING")
    print("="*60)
    
    try:
        # Generate data
        X, y = generate_training_data(n_normal=5000, n_anomaly=1000)
        print(f"Generated {len(X)} samples with {X.shape[1]} features")
        
        # Train K-Means
        kmeans, scaler = train_kmeans(X)
        
        # Train LSTM
        lstm = train_lstm(X, y)
        
        print("="*60)
        print("ALL MODELS TRAINED SUCCESSFULLY")
        print("="*60)
        print(f"""
Models saved in: {MODELS_DIR}
- kmeans.pkl          (K-Means anomaly detection)
- scaler.pkl          (Feature scaler)
- lstm_model.h5       (LSTM attack classifier)

Next: Start the FastAPI service
$ uvicorn app:app --host 0.0.0.0 --port 8000
        """)
        
    except Exception as e:
        print(f"Training failed: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == '__main__':
    main()
