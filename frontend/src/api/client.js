/**
 * NutriGuide API Client
 * ==================
 * Pattern from AgriSahayak api/client.js + api/idb.js
 * Original: offline farming app with spotty rural connectivity
 * Now:      hospital demo environment — WiFi can fail mid-demo
 *
 * Features:
 *  - Exponential backoff retry (3 attempts)
 *  - In-memory cache for GET requests (sessionStorage fallback)
 *  - isOnline detection — shows "cached data" banner when offline
 *  - Single BASE_URL constant — easy to switch for production
 */

const BASE_URL = '/api/v1'
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes

// ── In-memory cache (survives component re-renders, not page refresh) ─────────
const _cache = new Map()

function cacheKey(url, params) {
  return url + (params ? '?' + new URLSearchParams(params).toString() : '')
}

function cacheGet(key) {
  const entry = _cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(key); return null }
  return entry.data
}

function cacheSet(key, data) {
  _cache.set(key, { data, ts: Date.now() })
  // Also persist to sessionStorage for page-refresh survival
  try { sessionStorage.setItem(`nutriguide_${key}`, JSON.stringify({ data, ts: Date.now() })) } catch { }
}

function cacheGetFallback(key) {
  // SessionStorage fallback when network is completely down
  try {
    const raw = sessionStorage.getItem(`nutriguide_${key}`)
    if (raw) { const e = JSON.parse(raw); return e.data }
  } catch { }
  return null
}

// ── Retry with exponential backoff (AgriSahayak pattern) ─────────────────────
async function fetchWithRetry(url, options = {}, retries = 3) {
  let lastErr
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const timeoutMs = options.timeout || 15000
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`)
      }
      return await res.json()
    } catch (err) {
      lastErr = err
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 400 * Math.pow(2, attempt))) // 400ms, 800ms, 1600ms
      }
    }
  }
  throw lastErr
}

// ── Main API functions ────────────────────────────────────────────────────────

export async function apiGet(path, params) {
  const key = cacheKey(path, params)
  const url = BASE_URL + path + (params ? '?' + new URLSearchParams(params).toString() : '')

  // 1. Try cache first
  const cached = cacheGet(key)
  if (cached) return { data: cached, fromCache: true, offline: false }

  // 2. Try network
  try {
    const data = await fetchWithRetry(url)
    cacheSet(key, data)
    return { data, fromCache: false, offline: false }
  } catch (err) {
    // 3. Network failed — try sessionStorage fallback (offline mode)
    const fallback = cacheGetFallback(key)
    if (fallback) {
      console.warn(`[NutriGuide] Offline — serving cached data for ${path}`)
      return { data: fallback, fromCache: true, offline: true }
    }
    throw err
  }
}

export async function apiPost(path, body, options = {}, retries = 3) {
  const url = BASE_URL + path
  return fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...options
  }, retries)
}

export function invalidateCache(path) {
  for (const key of _cache.keys()) {
    if (key.startsWith(path)) _cache.delete(key)
  }
}

// ── Network status hook (AgriSahayak isOnline pattern) ───────────────────────
import { useState, useEffect } from 'react'

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

// ── Typed endpoint helpers ────────────────────────────────────────────────────
export const dashboardApi = {
  get: () => apiGet('/dashboard'),
}

export const patientApi = {
  getDietaryOrders: (id) => apiGet(`/get_dietary_orders/${id}`),
  update: (id, body) => {
    const url = BASE_URL + `/patients/${id}`
    return fetchWithRetry(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  },
}

export const mealPlanApi = {
  generate: (body) => apiPost('/generate_meal_plan', body),
  checkCompliance: (body) => apiPost('/check_meal_compliance', body),
  logConsumption: (body) => apiPost('/log_meal_consumption', body),
  update: (body) => apiPost('/update_meal_plan', body),
}

export const nutritionApi = {
  getSummary: (id) => apiGet(`/generate_nutrition_summary/${id}`),
  getTimeline: (id, n = 7) => apiGet(`/timeline/${id}`, { n_days: n }),
}

export const ragApi = {
  query: (body) => apiPost('/rag/query', body),
  explainRestriction: (r) => apiGet(`/rag/explain/${r}`),
}

export const reportsApi = {
  downloadPDF: async (patientId, name) => {
    const res = await fetch(`${BASE_URL}/reports/weekly/${patientId}`)
    if (!res.ok) {
      let msg
      try { msg = await res.text() } catch { msg = `HTTP ${res.status}` }
      throw new Error(msg)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Nutriguide_Report_${name}_${new Date().toISOString().slice(0, 10)}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 30_000)  // revoke after browser queues download
  },
  discharge: (id) => apiPost(`/discharge/${id}`, {}),
}

export const pqcApi = {
  benchmark: () => apiGet('/pqc/benchmark'),
  status: () => apiGet('/pqc/status'),
}

// ── Auth API ──────────────────────────────────────────────────────────────────
export async function authLogin(username, password) {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.detail || `Login failed (HTTP ${res.status})`)
  }
  return res.json()
}

export async function authRegister(data) {
  const res = await fetch('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.detail || `Registration failed (HTTP ${res.status})`)
  }
  return res.json()
}

export async function authMe(token) {
  const res = await fetch('/api/v1/auth/me', {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Session expired')
  return res.json()
}

export const aiApi = {
  askDietitian: (body) => apiPost('/ask_dietitian_ai', body),
}

// ── SOTA feature endpoints ────────────────────────────────────────────────────

export const trayApi = {
  analyze: (body) => apiPost('/tray/analyze', body),
  demo: (patientId, mealTime = 'lunch') => apiGet('/tray/demo', { patient_id: patientId, meal_time: mealTime }),
}

export const foodDrugApi = {
  getPatient: (patientId) => apiGet(`/food-drug/patient/${patientId}`),
  checkMeal: (body) => apiPost('/food-drug/check-meal', body),
}

export const kitchenApi = {
  getInventory: (date) => apiGet('/get_kitchen_inventory', date ? { query_date: date } : undefined),
  burnRate: (forecastDays = 3) => apiGet('/kitchen/burn-rate', { forecast_days: forecastDays }),
  inventoryStatus: () => apiGet('/kitchen/inventory-status'),
}

export const ragSignedApi = {
  signKnowledge: () => apiPost('/rag/sign-knowledge', {}),
  verifiedQuery: (body) => apiPost('/rag/verified-query', body),
}

export const wasteApi = {
  getAnalytics: () => apiGet('/reports/waste-analytics'),
}

export const nurseApi = {
  getPatient: (id) => apiGet(`/get_dietary_orders/${id}`),
  logConsumption: (body) => apiPost('/log_meal_consumption', body),
}

export const malnutritionApi = {
  getRisk: (patientId) => apiGet(`/malnutrition-risk/${patientId}`),
}

export const ollamaApi = {
  /**
   * GPU-accelerated plain-language summary of clinical graph data.
   * context_type: "food_drug" | "restrictions"
   * data: the graph data to explain (interactions array or conflicts)
   */
  summarize: (body) => apiPost('/ollama/summarize', body, { timeout: 120000 }, 1),
}
