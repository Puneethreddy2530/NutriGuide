"""
DuckDB Analytics Engine — CAP³S (Clinical Nutrition Care Agent)
================================================================
High-performance analytics on clinical nutrition + legacy AgriSahayak data.

Schemas initialised here:
  AgriSahayak (retained for schema completeness):
    disease_analytics, price_analytics, yield_analytics,
    land_polygons, crop_analytics, satellite_analyses
  CAP³S clinical tables:
    meal_logs, meal_plans, diet_updates

DuckDB Features:
- Columnar storage for fast aggregations
- OLAP-optimized query engine
- In-process analytics (no server needed)
- SQL interface with advanced analytics

NOTE: main.py opens its own `con` directly (to avoid DuckDB's single
read-write lock) and does NOT call get_duckdb() from this module.
"""

import duckdb
import os
import threading
import time
from functools import lru_cache
from typing import List, Dict
from datetime import datetime, timedelta
from contextlib import contextmanager
import pandas as pd
import logging

logger = logging.getLogger(__name__)

# DuckDB database file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "analytics.duckdb")

# Thread-local storage for connections
_local = threading.local()

# Lock for initialization
_init_lock = threading.Lock()
_disease_sync_lock = threading.Lock()
_initialized = False


def get_duckdb(read_only: bool = False) -> duckdb.DuckDBPyConnection:
    """
    Get a fresh DuckDB connection for the current request.
    Using request-scoped connections is safer for concurrent 
    analytics and avoids thread-local locking issues.
    """
    if not _initialized:
        init_duckdb()
    
    # Return a new connection per call (DuckDB connections are lightweight)
    return duckdb.connect(DB_PATH, read_only=read_only)


@contextmanager
def get_duckdb_context(read_only: bool = False):
    """Get a DuckDB connection as context manager"""
    conn = get_duckdb(read_only=read_only)
    try:
        yield conn
    except Exception as e:
        logger.error(f"DuckDB error: {e}")
        raise
    finally:
        try:
            conn.close()
        except:
            pass


def close_duckdb():
    """No-op for per-request connections (connections close themselves in context)"""
    pass


def init_duckdb():
    """Initialize DuckDB with schema (thread-safe, idempotent)"""
    global _initialized
    
    if _initialized:
        return
    
    with _init_lock:
        if _initialized:
            return
        
        # Use a temporary connection for schema setup
        conn = duckdb.connect(DB_PATH)
        try:
            # Performance optimizations (dynamic scaling)
            conn.execute(f"PRAGMA threads={max(1, os.cpu_count() or 4)}")
            conn.execute("PRAGMA enable_object_cache")

            try:
                conn.execute("INSTALL spatial")
                conn.execute("LOAD spatial")
                logger.info("✅ DuckDB spatial extension loaded")
            except Exception as e:
                logger.warning(f"DuckDB spatial extension unavailable (non-critical): {e}")
            
            # Create disease analytics table with auto-increment ID
            conn.execute("CREATE SEQUENCE IF NOT EXISTS disease_id_seq")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS disease_analytics (
                    id INTEGER PRIMARY KEY DEFAULT nextval('disease_id_seq'),
                    disease_name VARCHAR,
                    disease_hindi VARCHAR,
                    crop VARCHAR,
                    confidence FLOAT,
                    severity VARCHAR,
                    district VARCHAR,
                    state VARCHAR,
                    latitude FLOAT,
                    longitude FLOAT,
                    farmer_id VARCHAR,
                    detected_at TIMESTAMP
                )
            """)
            
            # Create price analytics table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS price_analytics (
                    id INTEGER PRIMARY KEY,
                    commodity VARCHAR,
                    market VARCHAR,
                    state VARCHAR,
                    district VARCHAR,
                    min_price FLOAT,
                    max_price FLOAT,
                    modal_price FLOAT,
                    date DATE
                )
            """)
            
            # Create yield analytics table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS yield_analytics (
                    id INTEGER PRIMARY KEY,
                    crop VARCHAR,
                    area_acres FLOAT,
                    predicted_yield_kg FLOAT,
                    actual_yield_kg FLOAT,
                    confidence FLOAT,
                    district VARCHAR,
                    state VARCHAR,
                    season VARCHAR,
                    predicted_at TIMESTAMP
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS land_polygons (
                    id VARCHAR PRIMARY KEY,
                    farmer_id VARCHAR NOT NULL,
                    land_name VARCHAR,
                    polygon GEOMETRY,
                    area_acres FLOAT,
                    state VARCHAR,
                    district VARCHAR,
                    centroid_lat FLOAT,
                    centroid_lng FLOAT,
                    crop_planted VARCHAR,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_land_farmer ON land_polygons(farmer_id)")
            
            # Create crop recommendation analytics
            conn.execute("""
                CREATE TABLE IF NOT EXISTS crop_analytics (
                    id INTEGER PRIMARY KEY,
                    recommended_crop VARCHAR,
                    nitrogen FLOAT,
                    phosphorus FLOAT,
                    potassium FLOAT,
                    temperature FLOAT,
                    humidity FLOAT,
                    ph FLOAT,
                    rainfall FLOAT,
                    confidence FLOAT,
                    district VARCHAR,
                    state VARCHAR,
                    farmer_id VARCHAR,
                    recommended_at TIMESTAMP
                )
            """)
            
            # Create indexes for common queries
            conn.execute("CREATE INDEX IF NOT EXISTS idx_disease_district ON disease_analytics(district)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_disease_date ON disease_analytics(detected_at)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_disease_name ON disease_analytics(disease_name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_price_commodity ON price_analytics(commodity)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_price_date ON price_analytics(date)")
            
            # Composite indexes for performance
            conn.execute("CREATE INDEX IF NOT EXISTS idx_disease_district_date ON disease_analytics(district, detected_at)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_disease_name_date ON disease_analytics(disease_name, detected_at)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_disease_lat_lon ON disease_analytics(latitude, longitude)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_price_commodity_date ON price_analytics(commodity, date)")

            # Create satellite analyses table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS satellite_analyses (
                    id VARCHAR,
                    lat FLOAT, lng FLOAT, area_acres FLOAT,
                    crop VARCHAR,
                    ndvi FLOAT, ndwi FLOAT, soil_moisture FLOAT,
                    crop_health VARCHAR, risk_level VARCHAR,
                    carbon_tons FLOAT, data_source VARCHAR,
                    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            # Migration: add crop column if the table already existed without it.
            # Must run BEFORE creating indexes — DuckDB refuses ALTER TABLE when
            # dependent indexes exist.
            # NOTE: PRAGMA table_info is SQLite-only; DuckDB uses information_schema.
            existing_cols = [
                row[0] for row in conn.execute(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = 'satellite_analyses'"
                ).fetchall()
            ]
            if 'crop' not in existing_cols:
                # Drop indexes first — DuckDB won't ALTER TABLE with dependents
                conn.execute("DROP INDEX IF EXISTS idx_satellite_id")
                conn.execute("DROP INDEX IF EXISTS idx_satellite_analyzed_at")
                conn.execute("ALTER TABLE satellite_analyses ADD COLUMN crop VARCHAR")
                logger.info("Migration: added 'crop' column to satellite_analyses")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_satellite_id ON satellite_analyses(id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_satellite_analyzed_at ON satellite_analyses(analyzed_at)")

            # ── CAP³S clinical tables ─────────────────────────────────────
            conn.execute("""
                CREATE TABLE IF NOT EXISTS meal_logs (
                    patient_id VARCHAR,
                    log_date DATE,
                    meal_time VARCHAR,
                    consumption_level VARCHAR,
                    logged_at TIMESTAMP,
                    notes VARCHAR
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS meal_plans (
                    patient_id VARCHAR,
                    day_number INTEGER,
                    meal_time VARCHAR,
                    dish_name VARCHAR,
                    ingredients VARCHAR,
                    calories FLOAT,
                    protein_g FLOAT,
                    carb_g FLOAT,
                    fat_g FLOAT,
                    sodium_mg FLOAT,
                    potassium_mg FLOAT,
                    compliance_status VARCHAR,
                    violations VARCHAR,
                    created_at TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS diet_updates (
                    update_id VARCHAR,
                    patient_id VARCHAR,
                    effective_from_day INTEGER,
                    previous_order VARCHAR,
                    new_order VARCHAR,
                    physician_note VARCHAR,
                    pqc_signature VARCHAR,
                    updated_at TIMESTAMP
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_meal_logs_patient ON meal_logs(patient_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_meal_logs_date ON meal_logs(log_date)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_meal_plans_patient ON meal_plans(patient_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_diet_updates_patient ON diet_updates(patient_id)")
        finally:
            # Close temporary initialization connection
            conn.close()

        logger.info("✅ DuckDB schema initialized (AgriSahayak + CAP³S tables)")
        _initialized = True


def analytics_health() -> Dict:
    """Quick health check for analytics DB"""
    try:
        with get_duckdb_context() as conn:
            conn.execute("SELECT 1").fetchone()
        return {"status": "healthy", "engine": "duckdb"}
    except Exception as e:
        logger.error(f"Analytics health check failed: {e}")
        return {"status": "unhealthy", "error": str(e)}


def sync_disease_data(disease_logs: List[Dict]):
    """Sync disease logs from PostgreSQL to DuckDB without full-table rewrites."""
    if not disease_logs:
        logger.warning("No disease logs to sync")
        return 0

    df = pd.DataFrame(disease_logs).copy()
    required_defaults = {
        "id": None,
        "disease_name": "Unknown",
        "disease_hindi": "",
        "crop": "Unknown",
        "confidence": 0.0,
        "severity": "unknown",
        "district": "Unknown",
        "state": "Unknown",
        "latitude": None,
        "longitude": None,
        "farmer_id": None,
        "detected_at": datetime.utcnow().isoformat(),
    }
    for col, default_value in required_defaults.items():
        if col not in df.columns:
            df[col] = default_value
    df = df[list(required_defaults.keys())]
    count = len(df)

    # Serialize disease sync writes in-process to avoid concurrent upsert collisions.
    with _disease_sync_lock:
        with get_duckdb_context() as conn:
            conn.register("temp_disease_df", df)
            try:
                conn.execute("BEGIN TRANSACTION")
                conn.execute("""
                    CREATE TEMP TABLE temp_disease_sync AS
                    SELECT
                        TRY_CAST(id AS INTEGER) AS id,
                        COALESCE(CAST(disease_name AS VARCHAR), 'Unknown') AS disease_name,
                        COALESCE(CAST(disease_hindi AS VARCHAR), '') AS disease_hindi,
                        COALESCE(CAST(crop AS VARCHAR), 'Unknown') AS crop,
                        COALESCE(TRY_CAST(confidence AS FLOAT), 0.0) AS confidence,
                        COALESCE(CAST(severity AS VARCHAR), 'unknown') AS severity,
                        COALESCE(CAST(district AS VARCHAR), 'Unknown') AS district,
                        COALESCE(CAST(state AS VARCHAR), 'Unknown') AS state,
                        TRY_CAST(latitude AS FLOAT) AS latitude,
                        TRY_CAST(longitude AS FLOAT) AS longitude,
                        CAST(farmer_id AS VARCHAR) AS farmer_id,
                        COALESCE(TRY_CAST(detected_at AS TIMESTAMP), CURRENT_TIMESTAMP) AS detected_at
                    FROM temp_disease_df
                """)

                conn.execute("""
                    UPDATE disease_analytics AS target
                    SET
                        disease_name = source.disease_name,
                        disease_hindi = source.disease_hindi,
                        crop = source.crop,
                        confidence = source.confidence,
                        severity = source.severity,
                        district = source.district,
                        state = source.state,
                        latitude = source.latitude,
                        longitude = source.longitude,
                        farmer_id = source.farmer_id,
                        detected_at = source.detected_at
                    FROM temp_disease_sync AS source
                    WHERE source.id IS NOT NULL
                      AND target.id = source.id
                """)

                conn.execute("""
                    INSERT INTO disease_analytics (
                        id,
                        disease_name,
                        disease_hindi,
                        crop,
                        confidence,
                        severity,
                        district,
                        state,
                        latitude,
                        longitude,
                        farmer_id,
                        detected_at
                    )
                    SELECT
                        source.id,
                        source.disease_name,
                        source.disease_hindi,
                        source.crop,
                        source.confidence,
                        source.severity,
                        source.district,
                        source.state,
                        source.latitude,
                        source.longitude,
                        source.farmer_id,
                        source.detected_at
                    FROM temp_disease_sync AS source
                    WHERE source.id IS NOT NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM disease_analytics AS target
                          WHERE target.id = source.id
                      )
                """)

                # Preserve auto-increment ID behavior for records that do not provide an ID.
                conn.execute("""
                    INSERT INTO disease_analytics (
                        disease_name,
                        disease_hindi,
                        crop,
                        confidence,
                        severity,
                        district,
                        state,
                        latitude,
                        longitude,
                        farmer_id,
                        detected_at
                    )
                    SELECT
                        disease_name,
                        disease_hindi,
                        crop,
                        confidence,
                        severity,
                        district,
                        state,
                        latitude,
                        longitude,
                        farmer_id,
                        detected_at
                    FROM temp_disease_sync
                    WHERE id IS NULL
                """)

                conn.execute("COMMIT")
            except Exception:
                conn.execute("ROLLBACK")
                raise
            finally:
                conn.execute("DROP TABLE IF EXISTS temp_disease_sync")
                conn.unregister("temp_disease_df")

    del df

    # Invalidate analytics caches
    get_disease_heatmap.cache_clear()
    get_disease_by_crop.cache_clear()
    get_district_health_score.cache_clear()

    logger.info(f"Upsert-synced {count} disease records to DuckDB")

    return count

def sync_price_data(price_logs: List[Dict]):
    """Sync price data from external API to DuckDB"""
    if not price_logs:
        logger.warning("⚠️ No price logs to sync")
        return 0
    
    df = pd.DataFrame(price_logs)
    count = len(df)
    
    with get_duckdb_context() as conn:
        conn.register("temp_price_df", df)
        conn.execute("DELETE FROM price_analytics")
        conn.execute("INSERT INTO price_analytics SELECT * FROM temp_price_df")
        conn.unregister("temp_price_df")
    
    del df
    
    # Invalidate price caches
    get_price_trends.cache_clear()
    
    logger.info(f"✅ Synced {count} price records to DuckDB")
    
    return count


def sync_yield_data(yield_logs: List[Dict]):
    """Sync yield predictions to DuckDB"""
    if not yield_logs:
        return 0
    
    df = pd.DataFrame(yield_logs)
    count = len(df)
    
    with get_duckdb_context() as conn:
        conn.register("temp_yield_df", df)
        conn.execute("DELETE FROM yield_analytics")
        conn.execute("INSERT INTO yield_analytics SELECT * FROM temp_yield_df")
        conn.unregister("temp_yield_df")
    
    del df
    logger.info(f"✅ Synced {count} yield records to DuckDB")
    
    return count


# ==================================================
# DISEASE ANALYTICS
# ==================================================

@lru_cache(maxsize=32)
def get_disease_heatmap(days: int = 30) -> List[Dict]:
    """
    Get disease outbreak heatmap data
    
    Returns district-wise disease counts
    """
    days = max(1, min(days, 365))
    
    # Use daily resolution for better caching stability
    cutoff = datetime.utcnow().date() - timedelta(days=days)
    
    with get_duckdb_context() as conn:
        result = conn.execute("""
            SELECT 
                district,
                state,
                disease_name,
                COUNT(*) as case_count,
                AVG(confidence) as avg_confidence,
                MAX(detected_at) as last_detected
            FROM disease_analytics
            WHERE detected_at >= ?
            GROUP BY district, state, disease_name
            ORDER BY case_count DESC
            LIMIT 100
        """, [cutoff]).fetchall()
    
    heatmap = []
    for row in result:
        heatmap.append({
            "district": row[0],
            "state": row[1],
            "disease": row[2],
            "cases": row[3],
            "avg_confidence": round(row[4], 3) if row[4] else 0,
            "last_seen": row[5].isoformat() if row[5] else None
        })
    
    return tuple(heatmap)


def get_disease_trends(disease: str = None, days: int = 90) -> List[Dict]:
    """
    Get disease trend over time
    
    Returns weekly aggregation
    """
    days = max(1, min(days, 365))
    
    # Use daily resolution
    cutoff = datetime.utcnow().date() - timedelta(days=days)
    
    with get_duckdb_context() as conn:
        if disease:
            result = conn.execute("""
                SELECT 
                    DATE_TRUNC('week', detected_at) as week,
                    disease_name,
                    COUNT(*) as cases,
                    AVG(confidence) as avg_confidence
                FROM disease_analytics
                WHERE detected_at >= ? AND disease_name = ?
                GROUP BY week, disease_name
                ORDER BY week DESC
            """, [cutoff, disease]).fetchall()
        else:
            result = conn.execute("""
                SELECT 
                    DATE_TRUNC('week', detected_at) as week,
                    disease_name,
                    COUNT(*) as cases,
                    AVG(confidence) as avg_confidence
                FROM disease_analytics
                WHERE detected_at >= ?
                GROUP BY week, disease_name
                ORDER BY week DESC
            """, [cutoff]).fetchall()
    
    trends = []
    for row in result:
        trends.append({
            "week": row[0].isoformat() if row[0] else None,
            "disease": row[1],
            "cases": row[2],
            "avg_confidence": round(row[3], 3) if row[3] else 0
        })
    
    return trends


@lru_cache(maxsize=32)
def get_disease_by_crop(days: int = 30) -> List[Dict]:
    """Get disease distribution by crop type"""
    days = max(1, min(days, 365))
    
    # Use daily resolution
    cutoff = datetime.utcnow().date() - timedelta(days=days)
    
    with get_duckdb_context() as conn:
        result = conn.execute("""
            SELECT 
                crop,
                disease_name,
                COUNT(*) as cases,
                AVG(confidence) as avg_confidence,
                COUNT(CASE WHEN severity = 'severe' THEN 1 END) as severe_count
            FROM disease_analytics
            WHERE detected_at >= ?
            GROUP BY crop, disease_name
            ORDER BY cases DESC
        """, [cutoff]).fetchall()
    
    data = []
    for row in result:
        data.append({
            "crop": row[0],
            "disease": row[1],
            "cases": row[2],
            "avg_confidence": round(row[3], 3) if row[3] else 0,
            "severe_count": row[4] or 0
        })
    
    return tuple(data)


@lru_cache(maxsize=128)
def get_district_health_score(district: str) -> Dict:
    """
    Calculate health score for a district (0-100)
    
    Based on:
    - Disease case count (last 30 days)
    - Severity distribution
    - Trend (increasing/decreasing)
    """
    # Use daily resolution
    cutoff = datetime.utcnow().date() - timedelta(days=30)
    
    with get_duckdb_context() as conn:
        # Get disease stats
        result = conn.execute("""
            SELECT 
                COUNT(*) as total_cases,
                AVG(confidence) as avg_confidence,
                COUNT(CASE WHEN severity IN ('severe', 'critical') THEN 1 END) as severe_cases
            FROM disease_analytics
            WHERE district = ? AND detected_at >= ?
        """, [district, cutoff]).fetchone()
    
    if not result:
        return {
            "district": district,
            "health_score": 100,
            "risk_level": "low",
            "total_cases": 0,
            "severe_cases": 0,
            "period_days": 30
        }
    
    total_cases = result[0] if result[0] else 0
    severe_cases = result[2] if result[2] else 0
    
    # Calculate score (100 = perfectly healthy)
    base_score = 100
    case_penalty = min(total_cases * 2, 50)  # Max -50 points
    severe_penalty = severe_cases * 5  # -5 per severe case
    
    score = max(0, base_score - case_penalty - severe_penalty)
    
    # Determine risk level
    if score >= 80:
        risk_level = "low"
    elif score >= 60:
        risk_level = "medium"
    elif score >= 40:
        risk_level = "high"
    else:
        risk_level = "critical"
    
    return {
        "district": district,
        "health_score": score,
        "risk_level": risk_level,
        "total_cases": total_cases,
        "severe_cases": severe_cases,
        "period_days": 30
    }


# ==================================================
# PRICE ANALYTICS
# ==================================================

@lru_cache(maxsize=64)
def get_price_trends(commodity: str, days: int = 30) -> List[Dict]:
    """Get price trends for a commodity"""
    days = max(1, min(days, 365))
    
    # Use daily resolution
    cutoff = datetime.utcnow().date() - timedelta(days=days)
    
    with get_duckdb_context() as conn:
        result = conn.execute("""
            SELECT 
                date,
                AVG(modal_price) as avg_price,
                MIN(min_price) as min_price,
                MAX(max_price) as max_price,
                COUNT(DISTINCT market) as market_count
            FROM price_analytics
            WHERE commodity = ? AND date >= ?
            GROUP BY date
            ORDER BY date DESC
        """, [commodity, cutoff]).fetchall()
    
    trends = []
    for row in result:
        trends.append({
            "date": row[0].isoformat() if row[0] else None,
            "avg_price": round(row[1], 2) if row[1] else 0,
            "min_price": round(row[2], 2) if row[2] else 0,
            "max_price": round(row[3], 2) if row[3] else 0,
            "market_count": row[4]
        })
    
    return tuple(trends)


def get_market_comparison(commodity: str) -> List[Dict]:
    """Compare prices across markets"""
    with get_duckdb_context() as conn:
        result = conn.execute("""
            SELECT 
                market,
                state,
                AVG(modal_price) as avg_price,
                STDDEV(modal_price) as price_volatility,
                COUNT(*) as data_points
            FROM price_analytics
            WHERE commodity = ?
            GROUP BY market, state
            ORDER BY avg_price DESC
            LIMIT 50
        """, [commodity]).fetchall()
    
    markets = []
    for row in result:
        markets.append({
            "market": row[0],
            "state": row[1],
            "avg_price": round(row[2], 2) if row[2] else 0,
            "volatility": round(row[3], 2) if row[3] else 0,
            "data_points": row[4]
        })
    
    return markets


# ==================================================
# YIELD ANALYTICS
# ==================================================

def get_yield_summary(crop: str = None, state: str = None) -> Dict:
    """Get yield prediction summary"""
    query = """
        SELECT 
            COUNT(*) as total_predictions,
            AVG(predicted_yield_kg) as avg_predicted,
            AVG(actual_yield_kg) as avg_actual,
            AVG(confidence) as avg_confidence,
            CORR(predicted_yield_kg, actual_yield_kg) as prediction_accuracy
        FROM yield_analytics
        WHERE 1=1
    """
    
    params = []
    
    if crop:
        query += " AND crop = ?"
        params.append(crop)
    if state:
        query += " AND state = ?"
        params.append(state)
    
    with get_duckdb_context() as conn:
        result = conn.execute(query, params).fetchone()
    
    if not result:
        return {
            "total_predictions": 0,
            "avg_predicted_yield": 0,
            "avg_actual_yield": 0,
            "avg_confidence": 0,
            "prediction_accuracy": None,
            "filters": {"crop": crop, "state": state}
        }
    
    return {
        "total_predictions": result[0] or 0,
        "avg_predicted_yield": round(result[1], 2) if result[1] else 0,
        "avg_actual_yield": round(result[2], 2) if result[2] else 0,
        "avg_confidence": round(result[3], 3) if result[3] else 0,
        "prediction_accuracy": round(result[4], 3) if result[4] else None,
        "filters": {"crop": crop, "state": state}
    }


# ==================================================
# ADVANCED ANALYTICS
# ==================================================

def get_seasonal_patterns(crop: str = None) -> List[Dict]:
    """Analyze seasonal disease patterns"""
    query = """
        SELECT 
            EXTRACT(MONTH FROM detected_at) as month,
            disease_name,
            COUNT(*) as cases,
            AVG(confidence) as avg_confidence
        FROM disease_analytics
        WHERE detected_at IS NOT NULL
    """
    
    params = []
    
    if crop:
        query += " AND crop = ?"
        params.append(crop)
        
    query += """
        GROUP BY month, disease_name
        ORDER BY month, cases DESC
    """
    
    with get_duckdb_context() as conn:
        result = conn.execute(query, params).fetchall()
    
    patterns = []
    for row in result:
        patterns.append({
            "month": int(row[0]) if row[0] else 0,
            "disease": row[1],
            "cases": row[2],
            "avg_confidence": round(row[3], 3) if row[3] else 0
        })
    
    return patterns


def get_outbreak_alerts(threshold: int = 10, days: int = 7) -> List[Dict]:
    """
    Detect potential disease outbreaks
    
    Alert if a disease has more than threshold cases in recent days
    """
    days = max(1, min(days, 365))
    threshold = max(1, min(threshold, 1000))
    
    # Use daily resolution
    cutoff = datetime.utcnow().date() - timedelta(days=days)
    
    with get_duckdb_context() as conn:
        result = conn.execute("""
            SELECT 
                disease_name,
                district,
                state,
                COUNT(*) as case_count,
                AVG(confidence) as avg_confidence,
                MAX(detected_at) as latest_case
            FROM disease_analytics
            WHERE detected_at >= ?
            GROUP BY disease_name, district, state
            HAVING COUNT(*) >= ?
            ORDER BY case_count DESC
        """, [cutoff, threshold]).fetchall()
    
    alerts = []
    for row in result:
        severity = "critical" if row[3] >= threshold * 3 else ("high" if row[3] >= threshold * 2 else "medium")
        
        alerts.append({
            "disease": row[0],
            "district": row[1],
            "state": row[2],
            "cases": row[3],
            "avg_confidence": round(row[4], 3) if row[4] else 0,
            "latest_case": row[5].isoformat() if row[5] else None,
            "severity": severity,
            "alert_type": "outbreak"
        })
    
    return alerts


# ==================================================
# STRESS TEST
# ==================================================

def run_stress_test():
    """
    Stress test DuckDB with large queries
    
    Simulates research-grade analytics
    """
    logger.info("🔥 DuckDB Stress Test")
    
    with get_duckdb_context() as conn:
    
        # Test 1: Complex aggregation
        logger.info("1. Complex Aggregation (district + disease + time)...")
        start = time.perf_counter()
        result = conn.execute("""
            SELECT 
                district,
                disease_name,
                DATE_TRUNC('month', detected_at) as month,
                COUNT(*) as cases,
                AVG(confidence) as avg_conf,
                MAX(confidence) as max_conf,
                STDDEV(confidence) as std_conf
            FROM disease_analytics
            GROUP BY district, disease_name, month
            ORDER BY cases DESC
            LIMIT 1000
        """).fetchall()
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(f"   ✅ Processed {len(result)} rows in {elapsed:.2f}ms")
        
        # Test 2: Window functions
        logger.info("2. Window Functions (moving averages)...")
        start = time.perf_counter()
        result = conn.execute("""
            SELECT 
                disease_name,
                detected_at,
                confidence,
                AVG(confidence) OVER (
                    PARTITION BY disease_name 
                    ORDER BY detected_at 
                    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
                ) as moving_avg_7day
            FROM disease_analytics
            ORDER BY detected_at DESC
            LIMIT 1000
        """).fetchall()
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(f"   ✅ Processed {len(result)} rows in {elapsed:.2f}ms")
        
        # Test 3: Geospatial clustering (bucketed neighbor join, avoids full cross join)
        logger.info("3. Geospatial Analysis (bucketed distance calculations)...")
        start = time.perf_counter()
        result = conn.execute("""
            WITH binned AS (
                SELECT
                    id,
                    district,
                    disease_name,
                    latitude,
                    longitude,
                    CAST(FLOOR(latitude * 10) AS BIGINT) AS lat_bin,
                    CAST(FLOOR(longitude * 10) AS BIGINT) AS lon_bin
                FROM disease_analytics
                WHERE latitude IS NOT NULL
                  AND longitude IS NOT NULL
                LIMIT 5000
            )
            SELECT
                a.district,
                a.disease_name,
                COUNT(*) AS nearby_cases,
                AVG(
                    SQRT(
                        POW(a.latitude - b.latitude, 2) +
                        POW(a.longitude - b.longitude, 2)
                    )
                ) AS avg_distance
            FROM binned a
            JOIN binned b
              ON a.id < b.id
             AND a.disease_name = b.disease_name
             AND ABS(a.lat_bin - b.lat_bin) <= 1
             AND ABS(a.lon_bin - b.lon_bin) <= 1
             AND ABS(a.latitude - b.latitude) <= 0.25
             AND ABS(a.longitude - b.longitude) <= 0.25
            GROUP BY a.district, a.disease_name
            ORDER BY nearby_cases DESC
            LIMIT 100
        """).fetchall()
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(f"   ✅ Processed {len(result)} clusters in {elapsed:.2f}ms")
        
        # Test 4: Statistical analysis
        logger.info("4. Statistical Analysis (percentiles + correlations)...")
        start = time.perf_counter()
        result = conn.execute("""
            SELECT 
                disease_name,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY confidence) as median_conf,
                PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY confidence) as p90_conf,
                CORR(latitude, longitude) as geo_corr
            FROM disease_analytics
            GROUP BY disease_name
        """).fetchall()
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(f"   ✅ Processed {len(result)} statistics in {elapsed:.2f}ms")
        
        logger.info("✅ DuckDB Stress Test Complete!")
        
        return {
            "status": "complete",
            "tests_run": 4,
            "message": "All analytics stress tests passed"
        }


# ==================================================
# DEMO / TEST
# ==================================================

def create_sample_data(count: int = 1000) -> List[Dict]:
    """Create sample disease data for testing - spread across all India"""
    import random
    
    diseases = ["Late Blight", "Early Blight", "Leaf Curl", "Bacterial Wilt", "Powdery Mildew", "Mosaic Virus", "Bacterial Spot", "Root Rot"]
    hindi_names = ["à¤ªà¤›à¥‡à¤¤à¥€ à¤…à¤‚à¤—à¤®à¤¾à¤°à¥€", "à¤œà¤²à¥à¤¦à¥€ à¤…à¤‚à¤—à¤®à¤¾à¤°à¥€", "à¤ªà¤¤à¥à¤¤à¥€ à¤®à¥‹à¤¡à¤¼", "à¤œà¥€à¤µà¤¾à¤£à¥ à¤®à¥à¤°à¤à¤¾à¤¨", "à¤šà¥‚à¤°à¥à¤£à¥€ à¤«à¤«à¥‚à¤‚à¤¦à¥€", "à¤®à¥‹à¤œà¤¼à¥‡à¤• à¤µà¤¾à¤¯à¤°à¤¸", "à¤œà¥€à¤µà¤¾à¤£à¥ à¤§à¤¬à¥à¤¬à¤¾", "à¤œà¤¡à¤¼ à¤¸à¤¡à¤¼à¤¨"]
    
    # Comprehensive India states and districts with coordinates
    india_locations = {
        "Maharashtra": {
            "districts": {
                "Pune": (18.5204, 73.8567), "Mumbai": (19.0760, 72.8777), "Nashik": (19.9975, 73.7898),
                "Nagpur": (21.1458, 79.0882), "Aurangabad": (19.8762, 75.3433), "Kolhapur": (16.7050, 74.2433),
                "Solapur": (17.6599, 75.9064), "Ahmednagar": (19.0948, 74.7480), "Satara": (17.6805, 74.0183)
            },
            "crops": ["Sugarcane", "Cotton", "Tomato", "Soybean", "Onion"]
        },
        "Punjab": {
            "districts": {
                "Ludhiana": (30.9010, 75.8573), "Amritsar": (31.6340, 74.8723), "Jalandhar": (31.3260, 75.5762),
                "Patiala": (30.3398, 76.3869), "Bathinda": (30.2110, 74.9455), "Mohali": (30.7046, 76.7179),
                "Gurdaspur": (32.0414, 75.4033), "Sangrur": (30.2314, 75.8413)
            },
            "crops": ["Wheat", "Rice", "Cotton", "Maize", "Sugarcane"]
        },
        "Uttar Pradesh": {
            "districts": {
                "Lucknow": (26.8467, 80.9462), "Varanasi": (25.3176, 82.9739), "Agra": (27.1767, 78.0081),
                "Kanpur": (26.4499, 80.3319), "Allahabad": (25.4358, 81.8463), "Meerut": (28.9845, 77.7064),
                "Gorakhpur": (26.7606, 83.3732), "Mathura": (27.4924, 77.6737), "Jhansi": (25.4484, 78.5685)
            },
            "crops": ["Wheat", "Rice", "Sugarcane", "Potato", "Mustard"]
        },
        "Karnataka": {
            "districts": {
                "Bangalore": (12.9716, 77.5946), "Mysore": (12.2958, 76.6394), "Belgaum": (15.8497, 74.4977),
                "Hubli": (15.3647, 75.1240), "Mangalore": (12.9141, 74.8560), "Gulbarga": (17.3297, 76.8343),
                "Bellary": (15.1394, 76.9214), "Shimoga": (13.9299, 75.5681)
            },
            "crops": ["Rice", "Sugarcane", "Cotton", "Ragi", "Groundnut"]
        },
        "Telangana": {
            "districts": {
                "Hyderabad": (17.3850, 78.4867), "Warangal": (17.9784, 79.5941), "Nizamabad": (18.6725, 78.0940),
                "Karimnagar": (18.4386, 79.1288), "Khammam": (17.2473, 80.1514), "Nalgonda": (17.0575, 79.2680),
                "Mahbubnagar": (16.7488, 77.9850)
            },
            "crops": ["Rice", "Cotton", "Maize", "Chilli", "Turmeric"]
        },
        "Gujarat": {
            "districts": {
                "Ahmedabad": (23.0225, 72.5714), "Surat": (21.1702, 72.8311), "Vadodara": (22.3072, 73.1812),
                "Rajkot": (22.3039, 70.8022), "Bhavnagar": (21.7645, 72.1519), "Jamnagar": (22.4707, 70.0577),
                "Junagadh": (21.5222, 70.4579), "Gandhinagar": (23.2156, 72.6369)
            },
            "crops": ["Cotton", "Groundnut", "Wheat", "Bajra", "Cumin"]
        },
        "Tamil Nadu": {
            "districts": {
                "Chennai": (13.0827, 80.2707), "Coimbatore": (11.0168, 76.9558), "Madurai": (9.9252, 78.1198),
                "Tiruchirappalli": (10.7905, 78.7047), "Salem": (11.6643, 78.1460), "Tirunelveli": (8.7139, 77.7567),
                "Erode": (11.3410, 77.7172), "Vellore": (12.9165, 79.1325)
            },
            "crops": ["Rice", "Sugarcane", "Cotton", "Banana", "Groundnut"]
        },
        "West Bengal": {
            "districts": {
                "Kolkata": (22.5726, 88.3639), "Howrah": (22.5958, 88.2636), "Durgapur": (23.5204, 87.3119),
                "Siliguri": (26.7271, 88.6393), "Asansol": (23.6889, 86.9661), "Bardhaman": (23.2324, 87.8615),
                "Malda": (25.0108, 88.1411), "Midnapore": (22.4249, 87.3198)
            },
            "crops": ["Rice", "Jute", "Potato", "Wheat", "Tea"]
        },
        "Madhya Pradesh": {
            "districts": {
                "Bhopal": (23.2599, 77.4126), "Indore": (22.7196, 75.8577), "Jabalpur": (23.1815, 79.9864),
                "Gwalior": (26.2183, 78.1828), "Ujjain": (23.1765, 75.7885), "Sagar": (23.8388, 78.7378),
                "Rewa": (24.5310, 81.2979), "Satna": (24.5702, 80.8329)
            },
            "crops": ["Soybean", "Wheat", "Rice", "Cotton", "Gram"]
        },
        "Rajasthan": {
            "districts": {
                "Jaipur": (26.9124, 75.7873), "Jodhpur": (26.2389, 73.0243), "Udaipur": (24.5854, 73.7125),
                "Kota": (25.2138, 75.8648), "Ajmer": (26.4499, 74.6399), "Bikaner": (28.0229, 73.3119),
                "Alwar": (27.5530, 76.6346), "Bharatpur": (27.2152, 77.5030)
            },
            "crops": ["Wheat", "Bajra", "Mustard", "Cotton", "Gram"]
        },
        "Andhra Pradesh": {
            "districts": {
                "Visakhapatnam": (17.6868, 83.2185), "Vijayawada": (16.5062, 80.6480), "Guntur": (16.3067, 80.4365),
                "Tirupati": (13.6288, 79.4192), "Nellore": (14.4426, 79.9865), "Kakinada": (16.9891, 82.2475),
                "Rajahmundry": (17.0050, 81.7787), "Kurnool": (15.8281, 78.0373)
            },
            "crops": ["Rice", "Cotton", "Chilli", "Sugarcane", "Groundnut"]
        },
        "Kerala": {
            "districts": {
                "Thiruvananthapuram": (8.5241, 76.9366), "Kochi": (9.9312, 76.2673), "Kozhikode": (11.2588, 75.7804),
                "Thrissur": (10.5276, 76.2144), "Kannur": (11.8745, 75.3704), "Kollam": (8.8932, 76.6141),
                "Alappuzha": (9.4981, 76.3388), "Palakkad": (10.7867, 76.6548)
            },
            "crops": ["Rice", "Coconut", "Rubber", "Tea", "Banana"]
        },
        "Odisha": {
            "districts": {
                "Bhubaneswar": (20.2961, 85.8245), "Cuttack": (20.4625, 85.8830), "Rourkela": (22.2604, 84.8536),
                "Berhampur": (19.3150, 84.7941), "Sambalpur": (21.4669, 83.9812), "Puri": (19.8135, 85.8312),
                "Balasore": (21.4942, 86.9317), "Bhadrak": (21.0548, 86.4972)
            },
            "crops": ["Rice", "Sugarcane", "Jute", "Groundnut", "Cotton"]
        },
        "Bihar": {
            "districts": {
                "Patna": (25.5941, 85.1376), "Gaya": (24.7914, 85.0002), "Bhagalpur": (25.2538, 86.9834),
                "Muzaffarpur": (26.1209, 85.3647), "Darbhanga": (26.1542, 85.8918), "Purnia": (25.7771, 87.4753),
                "Bihar Sharif": (25.2042, 85.5218), "Arrah": (25.5544, 84.6631)
            },
            "crops": ["Rice", "Wheat", "Maize", "Sugarcane", "Potato"]
        },
        "Jharkhand": {
            "districts": {
                "Ranchi": (23.3441, 85.3096), "Jamshedpur": (22.8046, 86.2029), "Dhanbad": (23.7957, 86.4304),
                "Bokaro": (23.6693, 86.1511), "Hazaribagh": (23.9966, 85.3619), "Deoghar": (24.4764, 86.6931)
            },
            "crops": ["Rice", "Wheat", "Maize", "Vegetables", "Fruits"]
        },
        "Assam": {
            "districts": {
                "Guwahati": (26.1445, 91.7362), "Dibrugarh": (27.4728, 94.9120), "Jorhat": (26.7509, 94.2037),
                "Silchar": (24.8333, 92.7789), "Tezpur": (26.6528, 92.7926), "Nagaon": (26.3465, 92.6840)
            },
            "crops": ["Rice", "Tea", "Jute", "Sugarcane", "Potato"]
        },
        "Haryana": {
            "districts": {
                "Chandigarh": (30.7333, 76.7794), "Gurugram": (28.4595, 77.0266), "Faridabad": (28.4089, 77.3178),
                "Panipat": (29.3909, 76.9635), "Ambala": (30.3752, 76.7821), "Karnal": (29.6857, 76.9905),
                "Hisar": (29.1492, 75.7217), "Rohtak": (28.8955, 76.6066)
            },
            "crops": ["Wheat", "Rice", "Cotton", "Sugarcane", "Mustard"]
        },
        "Chhattisgarh": {
            "districts": {
                "Raipur": (21.2514, 81.6296), "Bilaspur": (22.0797, 82.1409), "Durg": (21.1904, 81.2849),
                "Korba": (22.3595, 82.7501), "Rajnandgaon": (21.0972, 81.0290), "Raigarh": (21.8974, 83.3950)
            },
            "crops": ["Rice", "Maize", "Soybean", "Groundnut", "Sugarcane"]
        },
        "Uttarakhand": {
            "districts": {
                "Dehradun": (30.3165, 78.0322), "Haridwar": (29.9457, 78.1642), "Nainital": (29.3919, 79.4542),
                "Haldwani": (29.2183, 79.5130), "Roorkee": (29.8543, 77.8880), "Rishikesh": (30.0869, 78.2676)
            },
            "crops": ["Rice", "Wheat", "Sugarcane", "Soybean", "Vegetables"]
        }
    }
    
    severities = ["mild", "moderate", "severe"]
    
    sample_data = []
    states = list(india_locations.keys())
    
    for i in range(count):
        # Randomly select state
        state = random.choice(states)
        state_data = india_locations[state]
        
        # Randomly select district
        district = random.choice(list(state_data["districts"].keys()))
        base_lat, base_lng = state_data["districts"][district]
        
        # Add small random offset for realistic spread within district
        lat = round(base_lat + random.uniform(-0.15, 0.15), 6)
        lng = round(base_lng + random.uniform(-0.15, 0.15), 6)
        
        # Select disease and crop
        disease_idx = random.randint(0, len(diseases) - 1)
        crop = random.choice(state_data["crops"])
        
        sample_data.append({
            "id": i + 1,
            "disease_name": diseases[disease_idx],
            "disease_hindi": hindi_names[disease_idx],
            "crop": crop,
            "confidence": round(random.uniform(0.65, 0.98), 3),
            "severity": random.choice(severities),
            "district": district,
            "state": state,
            "latitude": lat,
            "longitude": lng,
            "farmer_id": f"F{state[:2].upper()}{random.randint(1000, 9999)}",
            "detected_at": datetime.utcnow() - timedelta(days=random.randint(0, 90))
        })
    
    return sample_data


def upsert_land_polygon(land_id: str, farmer_id: str, land_name: str,
                        lat: float, lng: float, area_acres: float,
                        state: str, district: str, crop: str = None):
    """Store a farmer's land as a spatial point (upgradeable to full polygon later)"""
    with get_duckdb_context() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO land_polygons
                (id, farmer_id, land_name, polygon, area_acres, state, district,
                 centroid_lat, centroid_lng, crop_planted, created_at)
            VALUES (?, ?, ?, ST_Point(?, ?), ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, [land_id, farmer_id, land_name, lng, lat, area_acres, state, district,
              lat, lng, crop])


def get_lands_in_bbox(min_lat: float, max_lat: float, min_lng: float, max_lng: float) -> List[Dict]:
    """Spatial query: all lands within a bounding box"""
    try:
        with get_duckdb_context() as conn:
            result = conn.execute("""
                SELECT id, farmer_id, land_name, centroid_lat, centroid_lng,
                       area_acres, state, district, crop_planted
                FROM land_polygons
                WHERE centroid_lat BETWEEN ? AND ?
                  AND centroid_lng BETWEEN ? AND ?
            """, [min_lat, max_lat, min_lng, max_lng]).fetchall()
        return [
            {"id": r[0], "farmer_id": r[1], "land_name": r[2],
             "lat": r[3], "lng": r[4], "area_acres": r[5],
             "state": r[6], "district": r[7], "crop": r[8]}
            for r in result
        ]
    except Exception as e:
        logger.warning(f"Spatial query failed (spatial extension may be unavailable): {e}")
        return []


if __name__ == "__main__":
    print("🧪 Testing DuckDB Analytics Engine")
    print("=" * 60)
    
    # Initialize
    init_duckdb()
    
    # Create sample data
    print("\n📊 Creating sample disease data...")
    sample_data = create_sample_data(1000)
    
    # Sync data
    sync_disease_data(sample_data)
    
    # Test queries
    print("\n📈 Testing analytics queries...")
    
    print("\n1. Disease Heatmap:")
    heatmap = get_disease_heatmap(30)
    for item in heatmap[:5]:
        print(f"   {item['district']}: {item['disease']} - {item['cases']} cases")
    
    print("\n2. Disease Trends:")
    trends = get_disease_trends("Late Blight", 30)
    for item in trends[:3]:
        print(f"   Week {item['week']}: {item['cases']} cases")
    
    print("\n3. District Health Score:")
    score = get_district_health_score("Pune")
    print(f"   Pune: {score['health_score']}/100 ({score['risk_level']} risk)")
    
    print("\n4. Outbreak Alerts:")
    alerts = get_outbreak_alerts(threshold=5, days=30)
    for alert in alerts[:3]:
        print(f"   ⚠️ {alert['disease']} in {alert['district']}: {alert['cases']} cases ({alert['severity']})")
    
    print("\n5. Seasonal Patterns:")
    patterns = get_seasonal_patterns()
    for p in patterns[:5]:
        print(f"   Month {p['month']}: {p['disease']} - {p['cases']} cases")
    
    # Stress test
    run_stress_test()
