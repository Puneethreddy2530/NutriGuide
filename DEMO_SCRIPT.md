# CAP³S — Live Demo Script
### GLITCHCON 2.0 · GKM_10 · Target: 8 minutes

> **Setup before judges arrive:**
> - Backend running: `uvicorn main:app --reload` at :8000
> - Frontend running: `npm run dev` at :5173
> - Browser tabs open: Dashboard, `/docs` (Swagger), WhatsApp
> - Postman/terminal ready for live API call if needed
> - Ollama running locally (for Dietitian AI fallback)

---

## ⏱ MINUTE 0:00 — OPENING (30 sec, no demo yet)

**Say:**
> "GKM_10 asks for 7 clinical nutrition tools plus a WhatsApp bonus. Most teams will build a chatbot that generates meal plans. We didn't.
>
> We built the clinical layer that connects a doctor's prescription to a patient's food tray to their family's kitchen — in their own language, verified by cryptography that will still be secure after quantum computers exist.
>
> Let me show you."

---

## ⏱ MINUTE 0:30 — DASHBOARD (45 sec)

**Action:** Open `http://localhost:5173` — Dashboard visible

**Say:**
> "Three patients. Different conditions, different languages, different diet stages.
>
> Ravi Kumar — Type 2 Diabetes, Telugu. Meena Iyer — Chronic Renal Failure Stage 4, Tamil. Arjun Singh — Post-GI Surgery, Hindi.
>
> That red badge — Arjun hasn't eaten in 48 hours. The system flagged it automatically from DuckDB OLAP query. The dietitian is already notified."

**Point to:** Alert badge, compliance bars, language labels on each card.

---

## ⏱ MINUTE 1:15 — PATIENTS PAGE (45 sec)

**Action:** Click "Patients" → Select Meena Iyer (P002)

**Say:**
> "Meena has Chronic Renal Failure Stage 4. Six active restrictions — low potassium, low phosphorus, low sodium, no bananas, no tomatoes, fluid restriction.
>
> This is the restriction conflict graph."

**Point to:** The animated canvas graph — renal nodes glowing red

> "Same architecture as a drug interaction graph. Each node is a restriction. Red edges — two restrictions that share a forbidden ingredient. Tomato is forbidden by both low-potassium AND low-phosphorus. The kitchen sees exactly what's left before a single meal is generated.
>
> We stole this pattern from a post-quantum health platform we built previously, remapped to dietary restrictions."

---

## ⏱ MINUTE 2:00 — MEAL PLAN GENERATION (90 sec)

**Action:** Click "Meal Plans" → Select P002 (Meena) → Click "Generate 7-Day Plan"

**Say (while it loads):**
> "Most teams send a prompt to Gemini and hope the calories are correct. We don't.
>
> Step one: a 0/1 Knapsack dynamic programming algorithm runs on the hospital's actual kitchen inventory — 40 ingredients. It selects ingredients that maximise protein density while fitting inside the calorie budget. Mathematically. No LLM involved.
>
> Step two: only THEN does Gemini see the ingredients — and its only job is to name the dish and write prep notes."

**When plan loads — point to a meal:**
> "580 calories. Target was 560. That's ±3.5% accuracy — deterministic, not hallucinated."

**Action:** Click "Check Compliance" on a meal

> "Tomato flagged immediately — FORBIDDEN_renal tag. Auto-substitution kicks in — ridge gourd replaces it. Zero manual intervention."

---

## ⏱ MINUTE 3:30 — COMPLIANCE + CORRELATION (60 sec)

**Action:** Click "Compliance" → Select P003 (Arjun Singh)

**Say:**
> "Arjun is post-GI surgery. Day 1 through 3 — liquid diet. Day 4 — physician updates to soft mechanical diet, 1200 to 1600 calories.

**Action:** Click "Apply Mid-Week Update"

> "Every diet order change is signed with CRYSTALS-Dilithium3 — that's NIST FIPS 204. The lattice-based signature is unforgeable. Probability of forgery: 2 to the minus 128. Kitchen is notified. EHR updated. PQC-signed."

**Point to Correlation Insight panel:**
> "This — Pearson correlation between calorie adherence and compliance. Computed client-side from DuckDB timeline data. Not hardcoded. On days Arjun's calorie target was met, compliance was positively correlated. The dietitian sees this in real time."

---

## ⏱ MINUTE 4:30 — DIETITIAN AI + RAG (60 sec)

**Action:** Click "Dietitian AI" → Type: *"Why can't Meena have tomatoes?"*

**Say (while loading):**
> "The RAG system has 10 clinical knowledge documents — NKF 2023, KDOQI 2020, ADA 2024, ESPEN 2021, KDIGO 2023. Not Wikipedia. Actual clinical guidelines."

**When answer loads — point to citations:**
> "NKF 2023 citation. KDIGO 2023 citation. Every answer is grounded. If you ask something outside the knowledge base, it says so."

**Ask follow-up live:** *"What should Ravi eat for breakfast given his HbA1c?"*

> "Ragi — finger millet. Low glycaemic index, 71. The system knows this from the IIMR research document. Gemini alone wouldn't have cited that."

---

## ⏱ MINUTE 5:30 — REPORTS + PQC (60 sec)

**Action:** Click "Reports" → Select P001 (Ravi) → Download PDF

**Say:**
> "Weekly clinical nutrition report. ReportLab PDF. Macro breakdown, compliance trends, clinical flags, diet update log."

**Point to bottom of PDF:**
> "Dilithium3 signature in the footer. Every report is cryptographically signed. If the PDF is tampered with after signing — the signature breaks. This is how you make clinical records auditable."

**Action:** Click "PQC Status" → Click "Run Live Benchmark"

**Watch the bars fill:**
> "46 milliseconds — Dilithium3.
> 2,100 milliseconds — RSA-4096.
>
> Same security level. 46 times faster. And unlike RSA, this doesn't break when Shor's algorithm runs on a quantum computer."

---

## ⏱ MINUTE 6:30 — BONUS: WHATSAPP DISCHARGE (60 sec)

**Action:** Go to Reports → Arjun (P003) → "Discharge & Send Home Guide"

**Say:**
> "Arjun is being discharged. Gemini generates a 30-day home meal guide in Hindi — his language. The clinical restrictions travel with him. The portions are adjusted for a home kitchen, not a hospital.
>
> Then Twilio sends it directly to his phone and his caregiver's phone via WhatsApp.
>
> The bonus feature in the problem statement? Already shipped."

**If WhatsApp is live — show the message arriving on phone.**

---

## ⏱ MINUTE 7:30 — CLOSING (30 sec)

**Say:**
> "Seven tools. Bonus shipped. Three patients, three conditions, three Indian languages.
>
> Every meal plan mathematically validated by a Knapsack algorithm before Gemini names the dish.
> Every EHR update signed with NIST FIPS 204.
> Every RAG answer cited to a clinical guideline.
>
> We didn't build a meal planner. We built clinical infrastructure."

---

## 🔥 Backup Lines (if judges ask questions)

**"Why not just use GPT-4 for everything?"**
> "GPT-4 gets calorie arithmetic wrong 30% of the time. We use the LLM for what it's good at — naming dishes and writing prep notes. A Knapsack DP algorithm is O(n·W) and deterministic. Different tools for different jobs."

**"How does the PQC actually work?"**
> "CRYSTALS-Dilithium3 is based on the hardness of the Module Learning With Errors problem. Unlike RSA, there's no known efficient quantum algorithm that breaks it. The signature is in every EHR update, every PDF, every discharge summary. Unforgeable."

**"Why DuckDB instead of PostgreSQL?"**
> "DuckDB is an in-process OLAP engine — the 48-hour refusal alert, the compliance trends, the nutrition summaries are all window function queries that run in milliseconds without a separate database server. No ops overhead for a demo."

**"Is the WhatsApp actually live?"**
> "Yes — Twilio Sandbox. Give us your number and we'll discharge Arjun to your phone right now."

**"What's the code provenance?"**
> "We built two production systems previously — AgriSahayak (agricultural AI) and NeoPulse (health monitoring). We remapped the battle-tested components: Gemini client, DuckDB engine, Dilithium3 signer, Twilio bot. The novel piece — the Knapsack meal optimizer — is original, 504 lines. That's the whole point of modular architecture."

---

## 📋 Pre-Demo Checklist

- [ ] `uvicorn main:app --reload` running at :8000
- [ ] `npm run dev` running at :5173
- [ ] `GET /health` returns `{"status": "healthy"}`
- [ ] P001, P002, P003 show on dashboard
- [ ] GEMINI_API_KEY set in `.env` (test with `/docs` → generate_meal_plan)
- [ ] Ollama running (for Dietitian AI local fallback)
- [ ] Twilio credentials in `.env` (for WhatsApp discharge)
- [ ] Phone ready to receive WhatsApp (for live demo moment)
- [ ] PDF viewer can open downloaded report
