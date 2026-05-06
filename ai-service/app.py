"""
FastAPI application for AI-based Intrusion Detection
Provides REST API for model inference
"""

import os
import logging
import time
import joblib
import numpy as np
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict
import tensorflow as tf
from dotenv import load_dotenv

from fastapi import WebSocket, WebSocketDisconnect

class ConnectionManager:
    def __init__(self):
        self.active_connections = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, data: dict):
        for connection in self.active_connections:
            await connection.send_json(data)

manager = ConnectionManager()


# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)




class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_to_all(self, data: dict):
        for connection in self.active_connections:
            await connection.send_json(data)

manager = ConnectionManager()
# ============================================================================
# INITIALIZE FASTAPI APP
# ============================================================================

app = FastAPI(
    title="AI Intrusion Detection System",
    description="Hybrid AI IDS with K-Means and LSTM",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# LOAD MODELS
# ============================================================================

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')

try:
    logger.info("Loading models...")
    
    # Load K-Means and Scaler
    kmeans_path = os.path.join(MODELS_DIR, 'kmeans.pkl')
    scaler_path = os.path.join(MODELS_DIR, 'scaler.pkl')
    
    if os.path.exists(kmeans_path) and os.path.exists(scaler_path):
        kmeans = joblib.load(kmeans_path)
        scaler = joblib.load(scaler_path)
        logger.info("✅ K-Means and Scaler loaded")
    else:
        logger.warning("⚠️ K-Means models not found. Run train.py first.")
        kmeans = None
        scaler = None
    
    # Load LSTM
    lstm_path = os.path.join(MODELS_DIR, 'lstm_model.h5')
    
    if os.path.exists(lstm_path):
        # Suppress TensorFlow logging
        tf.get_logger().setLevel('ERROR')
        lstm_model = tf.keras.models.load_model(lstm_path)
        logger.info("✅ LSTM model loaded")
    else:
        logger.warning("⚠️ LSTM model not found. Run train.py first.")
        lstm_model = None

except Exception as e:
    logger.error(f"❌ Failed to load models: {e}")
    kmeans = None
    scaler = None
    lstm_model = None

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class Features(BaseModel):
    """Input features for prediction"""
    protocol: int = Field(..., ge=0, le=4, description="Protocol (0-4)")
    src_port: int = Field(..., ge=1, le=65535, description="Source port")
    dst_port: int = Field(..., ge=1, le=65535, description="Destination port")
    duration: float = Field(..., ge=0, description="Duration in ms")
    bytes_sent: float = Field(..., ge=0, description="Bytes sent")
    bytes_received: float = Field(..., ge=0, description="Bytes received")
    flags: int = Field(default=0, ge=0, le=63, description="Flags")

    @validator('src_port', 'dst_port')
    def validate_ports(cls, v):
        if not 1 <= v <= 65535:
            raise ValueError('Port must be between 1 and 65535')
        return v

class PredictionRequest(BaseModel):
    """Prediction request"""
    features: Features

class PredictionResponse(BaseModel):
    """Prediction response"""
    status: str
    isAnomaly: bool
    anomaly_score: float
    cluster: int
    attack_type: str
    confidence: float
    attack_probabilities: Dict[str, float]
    processingTime: float

class BatchPredictionRequest(BaseModel):
    """Batch prediction request"""
    features_list: List[Features] = Field(..., max_items=1000)

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    models_loaded: bool
    kmeans: bool
    lstm: bool
    scaler: bool

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

ATTACK_TYPES = {
    0: 'Normal',
    1: 'DDoS',
    2: 'Port Scan',
    3: 'Brute Force',
    4: 'Malware',
}

def features_to_array(features: Features) -> np.ndarray:
    """
    Convert Features object to numpy array
    """
    return np.array([[
        features.protocol,
        features.src_port,
        features.dst_port,
        features.duration,
        features.bytes_sent,
        features.bytes_received,
        features.flags,
    ]])

def detect_anomaly(X_scaled: np.ndarray) -> tuple:
    """
    Detect anomalies using K-Means
    Returns: (is_anomaly, anomaly_score, cluster)
    """
    if kmeans is None or scaler is None:
        logger.warning("K-Means models not loaded")
        return False, 0.0, -1
    
    try:
        # Get cluster assignment
        cluster = kmeans.predict(X_scaled)[0]
        
        # Calculate distance from cluster center
        distances = np.linalg.norm(
            X_scaled[0] - kmeans.cluster_centers_[cluster]
        )
        
        # Normalize distance to [0, 1]
        max_distance = np.max([
            np.linalg.norm(
                X_scaled[0] - kmeans.cluster_centers_[i]
            )
            for i in range(kmeans.n_clusters)
        ])
        
        anomaly_score = min(distances / (max_distance + 1e-5), 1.0)
        
        # Threshold for anomaly
        is_anomaly = anomaly_score > 0.7
        
        return is_anomaly, float(anomaly_score), int(cluster)
    
    except Exception as e:
        logger.error(f"Anomaly detection error: {e}")
        return False, 0.0, -1

def classify_attack(X_scaled: np.ndarray) -> tuple:
    """
    Classify attack type using LSTM
    Returns: (attack_type, confidence, probabilities)
    """
    if lstm_model is None or scaler is None:
        logger.warning("LSTM model not loaded")
        return 'Unknown', 0.0, {}
    
    try:
        # LSTM expects sequences, so we repeat the data
        X_seq = np.repeat(X_scaled, 10, axis=0).reshape(1, 10, 7)
        
        # Predict
        prediction = lstm_model.predict(X_seq, verbose=0)[0][0]
        
        # Convert to attack type (binary: normal=0, attack=1)
        is_attack = prediction > 0.5
        confidence = prediction if is_attack else (1 - prediction)
        
        # Multi-class classification (simplified)
        attack_type = 'Normal' if prediction < 0.5 else 'DDoS'
        
        probabilities = {
            'Normal': float(1 - prediction),
            'DDoS': float(prediction),
            'Port Scan': 0.0,
            'Brute Force': 0.0,
            'Malware': 0.0,
        }
        
        return attack_type, float(confidence), probabilities
    
    except Exception as e:
        logger.error(f"Attack classification error: {e}")
        return 'Unknown', 0.0, {}

# ============================================================================
# ROUTES
# ============================================================================

@app.get('/')
async def root():
    return {"message": "AI IDS Service is running"}

@app.get('/health', response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    """
    return {
        'status': 'healthy',
        'models_loaded': kmeans is not None and lstm_model is not None,
        'kmeans': kmeans is not None,
        'lstm': lstm_model is not None,
        'scaler': scaler is not None,
    }

@app.post('/predict', response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """
    Single prediction endpoint
    """
    start_time = time.time()
    
    try:
        # Validate models
        if scaler is None:
            raise HTTPException(status_code=503, detail="Scaler not loaded")
        
        # Convert features
        X = features_to_array(request.features)
        X_scaled = scaler.transform(X)
        
        # Anomaly detection
        is_anomaly, anomaly_score, cluster = detect_anomaly(X_scaled)
        
        # Attack classification
        attack_type, confidence, probabilities = classify_attack(X_scaled)
        
        # Adjust confidence based on anomaly
        if is_anomaly:
            confidence = max(confidence, anomaly_score)
        else:
            confidence = 0.1
            attack_type = 'Normal'
        
        processing_time = (time.time() - start_time) * 1000  # Convert to ms
        await manager.broadcast({
    "isAnomaly": is_anomaly,
    "attack_type": attack_type,
    "confidence": confidence
})
        return {
            'status': 'success',
            'isAnomaly': is_anomaly,
            'anomaly_score': anomaly_score,
            'cluster': cluster,
            'attack_type': attack_type,
            'confidence': confidence,
            'attack_probabilities': probabilities,
            'processingTime': processing_time,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)    

@app.post('/batch-predict')
async def batch_predict(request: BatchPredictionRequest):
    """
    Batch prediction endpoint
    """
    start_time = time.time()
    results = []
    
    try:
        if scaler is None:
            raise HTTPException(status_code=503, detail="Scaler not loaded")
        
        for features in request.features_list:
            try:
                X = features_to_array(features)
                X_scaled = scaler.transform(X)
                
                is_anomaly, anomaly_score, cluster = detect_anomaly(X_scaled)
                attack_type, confidence, probabilities = classify_attack(X_scaled)
                
                if is_anomaly:
                    confidence = max(confidence, anomaly_score)
                else:
                    confidence = 0.1
                    attack_type = 'Normal'
                
                results.append({
                    'status': 'success',
                    'isAnomaly': is_anomaly,
                    'anomaly_score': anomaly_score,
                    'cluster': cluster,
                    'attack_type': attack_type,
                    'confidence': confidence,
                    'attack_probabilities': probabilities,
                })
            except Exception as e:
                logger.error(f"Batch prediction error: {e}")
                results.append({
                    'status': 'error',
                    'error': str(e),
                })
        
        processing_time = (time.time() - start_time) * 1000
        
        return {
            'status': 'success',
            'total': len(request.features_list),
            'successful': sum(1 for r in results if r.get('status') == 'success'),
            'results': results,
            'processingTime': processing_time,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/model-info')
async def model_info():
    """
    Get model information
    """
    info = {
        'kmeans': None,
        'lstm': None,
        'scaler': None,
    }
    
    if kmeans is not None:
        info['kmeans'] = {
            'type': 'KMeans',
            'n_clusters': kmeans.n_clusters,
            'n_features': kmeans.n_features_in_,
            'inertia': float(kmeans.inertia_),
        }
    
    if lstm_model is not None:
        info['lstm'] = {
            'type': 'LSTM',
            'layers': len(lstm_model.layers),
            'parameters': int(lstm_model.count_params()),
        }
    
    if scaler is not None:
        info['scaler'] = {
            'type': 'StandardScaler',
            'n_features': scaler.n_features_in_,
        }
    
    return info

@app.on_event('startup')
async def startup_event():
    """
    Startup event
    """
    logger.info("="*60)
    logger.info("AI INTRUSION DETECTION SERVICE")
    logger.info("="*60)
    logger.info(f"✅ FastAPI application started")
    logger.info(f"   K-Means: {'✅ Loaded' if kmeans else '❌ Not loaded'}")
    logger.info(f"   LSTM: {'✅ Loaded' if lstm_model else '❌ Not loaded'}")
    logger.info(f"   Scaler: {'✅ Loaded' if scaler else '❌ Not loaded'}")
    logger.info("="*60)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(
    "app:app",
    host="0.0.0.0",
    port=int(os.getenv("PORT", 8000)),
)


