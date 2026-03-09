```markdown
# NeoPulse Frontend: Single-Page Architecture Guide

NeoPulse is a high-performance, AI-driven mental health and medication safety platform. The goal is a **vibrant, interactive, and premium** single-page experience that "wows" at first glance.

---

## 🎨 Visual Identity (Aesthetic Goals)
- **Glassmorphism**: Use translucent cards with backdrop-blur.
- **Micro-Animations**: Smooth transitions when toggling AI features.
- **Dynamic Colors**: UI accents that shift based on current EmotionNet sentiment (e.g., Soft Blue = Calm, Amber = Stressed).
- **Interactive Data**: D3.js and Three.js should be used for **living** visualizations, not static charts.

---

## 🏛️ Page Strategy: "The Pulse Dashboard"

### 1. Hero Section: The Pulse Waveform (Top)
*   **Feature**: Real-time Sine wave visualization (Three.js) that reacts to user activity.
*   **Emotion Portal**: Floating bubble to toggle **Webcam Emotion Detection**.
*   **Quick Check-in**: A prominent "Journal Now" button (Voice-to-Text).

### 2. MindCast Insight: The 3-Day Forecast (Middle-Left)
*   **Frontend logic**: Call `/dashboard/timeline`.
*   **Visualization**: A D3.js **Area Chart** showing the 6 sentiment signals (Sleep, Med Adherence, Pitch, etc.).
*   **Prediction Layer**: A dashed line extending 3 days into the future showing the **TFT-predicted risk score**.
*   **Interactive**: Hovering over future days shows a "Potential Trigger" tooltip.

### 3. Medication & Safety Hub (Middle-Right)
*   **Medication List**: Clean list with "Check Interaction" button.
*   **The Safety Spider (GNN)**: A D3.js **Force-Directed Graph**. 
    *   Nodes = Current Medications.
    *   Edges = Connections color-coded by the Drug GNN (Green = Safe, Red = Dangerous).
    *   **Interaction**: Click a red edge to see the "Mechanism" and "Effect" returned by the API.

### 4. The Neo-RAG Conversation (Bottom Column)
*   **Persona**: "NeoPulse AI" (Secure, empathetic health assistant).
*   **Technical**: Uses PQVector RAG behind the scenes.
*   **UI**: Floating chat island at the bottom right or a dedicated full-width glass card.
*   **Suggested queries**: "How has my sleep affected my mood this week?" or "Am I at risk of a medication interaction with Ibuprofen?"

---

## 🛠️ Feature Hierarchy & Placement Suggestions

| Widget | Component Name | Data Endpoint | UI Library | Placement |
| :--- | :--- | :--- | :--- | :--- |
| **Emotion Ring** | `EmotionMonitor.js` | WebSocket (`/ws/emotion`) | CSS / Three.js | Top Left |
| **Journal Stream** | `AudioJournal.js` | `POST /journals/voice` | Web Audio API | Top Center |
| **Risk Timeline** | `MindCastChart.js` | `GET /dashboard/timeline` | D3.js | Middle Left (Large) |
| **Medication Hub** | `SafetyGNN.js` | `POST /medications/check` | D3.js | Middle Right |
| **Analytics Grid** | `MetricStats.js` | `GET /dashboard` | Tailwind Grids | Lower Center |
| **SafeQuest Chat**| `RAGAssistant.js` | `POST /rag/ask` | Framer Motion | Bottom Global |

---

## 🚀 Pro Tips for the "Wow" Factor
1.  **Emotion-Driven Contrast**: Dark mode as default, but "glow" the edges of the cards based on the sentiment data.
2.  **Audio Feedback**: Subtle ambient hum sounds when the AI is "Thinking" (RAG response).
3.  **3D Geometry**: Use a Three.js rotating "Soul" (low-poly sphere) in the center that vibrates more intensely if the MindCast risk score is high.

---

## 🔗 Technical Integration Summary
- **Base Style**: `backend/static/index.css` (Already seeded with premium glassmorphism tokens).
- **Core Scripts**: `backend/static/app.js` (Handle WebSockets and fetch calls).
- **Renders**: Keep everything in `backend/static/`, served via FastAPI's `StaticFiles`.

```
