```markdown
# NeoPulse Frontend Guide

Welcome to the NeoPulse frontend development! This guide outlines the necessary platforms, tools, and the backend API structure you will need to build the interactive UI for this Holistic Health Platform.

## 🚀 Minimum Requirements & Stack

To successfully integrate with the backend and run the planned "Wow Factor" components, you will need the following stack:

1. **Node.js & npm/yarn/pnpm**: For managing frontend dependencies (React, Vite, etc.).
2. **React (via Vite)**: The expected framework for building the UI components.
3. **Three.js / React Three Fiber**: Required for the 3D `HealthOrbit` visualization.
4. **D3.js**: Required for the `DrugInteractionGraph` data visualization.
5. **Tailwind CSS (optional but recommended)**: For rapid, clean UI styling.
6. **MediaPipe (Client-side)**: We are using Google's MediaPipe for client-side face mesh extraction before streaming it to the backend via WebSockets.

## 🔌 Connecting to the Backend

The FastAPI backend runs locally during development on `http://127.0.0.1:8000`. It uses JWT for authentication, meaning most endpoints will require an `Authorization: Bearer <token>` header.

### Start the Backend Locally
Ensure you have Python 3.11 installed, then from the root directory run:
```bash
# If using the virtual environment
.\.venv\Scripts\activate
# Start the server
cd backend
uvicorn main_complete:app --reload
```
You can view the interactive API documentation (Swagger) by navigating to `http://127.0.0.1:8000/docs`.

---

## 📡 Key API Endpoints to Consume

Here are the primary integration points for the React frontend:

### 1. Authentication (`routers/auth.py`)
- **`POST /auth/register`**: Expects `username`, `email`, and `password`. Use this for the signup form.
- **`POST /auth/token`**: Standard OAuth2 token endpoint. Send `username` and `password` as `application/x-www-form-urlencoded`. Returns an `access_token` you must store (e.g., in `localStorage`) and attach to subsequent requests.

### 2. Journaling & Voice Notes (`routers/journal.py`)
- **`POST /journals/voice`**: Expects a multipart form data upload with a `file` (the audio blob from the browser's MediaRecorder API). Optionally accepts `emotion_tag` (str) and `stress_tag` (float).
- **`GET /journals/`**: Retrieves the user's past journal entries and their sentiment scores.

### 3. Real-Time Emotion Detection (WebSockets) (`routers/emotion.py`)
- **`ws://127.0.0.1:8000/ws/{user_id}?token={your_jwt}`**: This is the core of the "Wow Factor".
  - **Your Job**: Capture the webcam stream via `getUserMedia`, extract frames, and send them to this WebSocket.
  - **Backend Response**: A JSON object containing `primary_emotion` (e.g., "joy", "stressed", "focused") and `stress_score` (0.0 to 1.0).
  - **UI Interaction**: Pipe this `stress_score` directly into the `BreathingExercise.jsx` animation (e.g., higher stress = faster pulsing, red colors).

### 4. PQVector RAG (Crypto-Secure Chat) (`routers/rag.py`)
- **`POST /rag/query`**: The secure chat interface. Send `{ query: "user's medical question" }`. Note: The backend handles the CKKS post-quantum encryption internally before searching the vector database.

### 5. Drug Interaction Graph (`routers/drugs.py`)
- **`GET /drugs/interactions`**: Returns a JSON structure representing the graph nodes (drugs) and edges (interactions/severity). Pipe this directly into your D3.js component (`DrugInteractionGraph.jsx`).

### 6. Timeline / Dashboard (`timeline_endpoint.py`)
- **`GET /dashboard/timeline?days=30`**: Returns the "Life Tape" data (combined journal sentiment, stress trends, and medication adherence). Pipe this into your `HealthTimeline.jsx` component.

---

## 🎨 UI Architecture (The "Wow Factor")

The user interface should be extremely premium, utilizing modern web design aesthetics (glassmorphism, dark cohesive themes, dynamic animations).

### Expected Components (in `frontend/src/components/`):
- **`App.jsx`**: The main shell and router. Handles the authentication flow and the global "High Stress" red banner if the WebSocket returns a critical stress score.
- **`HealthOrbit.jsx`**: A Three.js interactive 3D solar system.
- **`BreathingExercise.jsx`**: A WebGL particle system that syncs its animation speed/color to the live emotion WebSocket stream.
- **`HealthTimeline.jsx`**: A horizontal, swipeable/zoomable timeline representing the user's historical data.
- **`EmotionDetector.jsx`**: The UI wrapper for the user's webcam and the WebSocket connection logic.
- **`DrugInteractionGraph.jsx`**: The D3.js force-directed graph visualization.

Happy Coding! 💻🚀
```
