"""
rag_engine.py
══════════════════════════════════════════════════════════════════
CAP³S Clinical Nutrition RAG Engine
Stolen from: AgriSahayak chatbot/rag_engine.py
Change: 10 clinical nutrition guideline chunks replacing crop knowledge

Architecture:
  - TF-IDF vector similarity (no external vector DB needed for hackathon)
  - Ollama (local LLM) primary → Gemini fallback
  - Every citation is PQC-signed by /api/v1/rag/sign-knowledge
  - CLINICAL_KNOWLEDGE is the importable knowledge base used by main.py
══════════════════════════════════════════════════════════════════
"""

import math
import re
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════
# 10 CLINICAL KNOWLEDGE DOCUMENTS
# Stolen concept from AgriSahayak RAG chunks (crop disease → nutrition)
# ══════════════════════════════════════════════════════════════════

CLINICAL_KNOWLEDGE = [
    {
        "id": "CKB_001",
        "title": "Potassium Restriction in CKD",
        "source": "NKF KDOQI 2020",
        "category": "Renal Nutrition",
        "keywords": ["potassium", "CKD", "renal", "hyperkalaemia", "banana", "tomato", "dialysis", "K+"],
        "content": """
Potassium restriction is mandatory in CKD Stage 3b-5 and dialysis patients. Target dietary potassium: < 2000mg/day
in advanced CKD; < 2500mg/day in Stage 3b-4.

HIGH-POTASSIUM FOODS TO AVOID (>200mg K+ per 100g):
Banana (358mg), Orange (181mg), Tomato (237mg), Potato (421mg), Spinach (558mg),
Coconut Water (250mg), Avocado (485mg), Dried fruits (>500mg), Beans/Lentils (>400mg).

SAFE LOW-POTASSIUM FOODS (<150mg K+ per 100g):
Apple (107mg), Pear (116mg), Papaya (182mg — moderate), Bottle Gourd (150mg),
Ridge Gourd (139mg), Ash Gourd (80mg), White rice (35mg — if phosphorus allows),
Semolina (186mg — moderate), Egg whites (163mg).

COOKING TIP: Leaching technique reduces potassium by 30-50%. Peel vegetables, cut small,
soak in water 2+ hours, boil in FRESH water (discard), then cook. Never steam high-K+ vegetables.

CLINICAL ALERT: Serum K+ > 6.0 mEq/L = EMERGENCY. Peaked T-waves on ECG indicate imminent
cardiac arrhythmia. Call code if untreated. Dietary restriction is non-negotiable.

DIETITIAN PROTOCOL: Review serum K+ at every dialysis session. Adjust dietary advice based on:
pre-dialysis K+ level, dialysis frequency, residual renal function, and constipation status
(constipation raises K+ significantly — treat proactively).
        """.strip()
    },
    {
        "id": "CKB_002",
        "title": "Phosphorus Restriction in Renal Failure",
        "source": "KDOQI 2020",
        "category": "Renal Nutrition",
        "keywords": ["phosphorus", "phosphate", "CKD", "renal", "calcium", "parathyroid", "bone", "dairy", "nuts"],
        "content": """
Phosphorus restriction is critical in CKD Stage 3-5 to prevent secondary hyperparathyroidism,
renal osteodystrophy, and vascular calcification. Target: < 800mg phosphorus/day.

HIGH-PHOSPHORUS FOODS TO RESTRICT:
Dairy milk (93mg/100ml), Hard cheese (>500mg/100g), Nuts (>300mg/100g), Seeds (>600mg/100g),
Dark cola drinks (phosphoric acid — 400mg per can), Beer (50mg/100ml), Dark chocolate (308mg/100g),
Processed/preserved meats (phosphate additives — bioavailability 100%), Oysters (280mg/100g).

PHOSPHATE ADDITIVE WARNING: Inorganic phosphate in processed foods (E338-E341, E450-E452)
is 100% bioavailable vs 40-60% from natural food sources. Read labels meticulously.
Instant noodles, packaged snacks, deli meats — all contain additive phosphates.

SAFE LOW-PHOSPHORUS FOODS (<100mg per 100g):
Egg whites (15mg — excellent protein source for dialysis patients), Bottle Gourd (13mg),
Ash Gourd (19mg), Apple (11mg), Papaya (10mg), Vegetable broth (10mg).

PHOSPHATE BINDERS: Calcium Carbonate must be taken WITH meals (not before or after) to bind
dietary phosphate in the GI tract. Dose timing is as important as the restriction itself.

CLINICAL TARGET: Serum phosphorus 3.5-5.5 mg/dL (CKD non-dialysis), 3.5-5.5 mg/dL (dialysis).
Above 5.5 = cardiovascular calcification risk escalates exponentially.
        """.strip()
    },
    {
        "id": "CKB_003",
        "title": "Sodium Restriction Guidelines",
        "source": "IHA 2023 — Indian Hypertension Guidelines; KDIGO 2023",
        "category": "Cardiovascular & Renal",
        "keywords": ["sodium", "salt", "hypertension", "blood pressure", "pickles", "papad", "oedema", "fluid"],
        "content": """
Sodium restriction is the most impactful single dietary intervention for hypertension, heart failure,
and CKD progression. Indian diets average 8-12g salt/day (3200-4800mg Na). Target: < 2g/day (2000mg).

HIDDEN SODIUM IN INDIAN DIETS:
- Papad (1 piece): 250mg sodium
- Pickle (1 tbsp): 400-600mg sodium
- Idli (1 piece with sambar): 350mg sodium  
- Buttermilk (200ml): 200mg sodium
- Processed paneer (100g): 30-80mg (brand-dependent)
- Baking soda in cooking: 1 tsp = 1200mg sodium

SALT SUBSTITUTES: Potassium chloride salt substitutes (Lo-Salt, Tata Salt Lite) are
CONTRAINDICATED in CKD — the potassium load is dangerous. Do not recommend to renal patients.

COOKING GUIDANCE FOR KITCHEN STAFF:
1. Use no added salt during cooking — add post-cook if needed for palatability
2. Use lemon, cumin, and coriander to enhance flavour without sodium
3. Avoid ajinomoto (MSG) — 12% sodium by weight
4. Make rasam/sambar without store-bought masalas (high sodium) — use fresh spices

CLINICAL IMPACT: Each 1g/day sodium reduction lowers BP by ~1.1/0.6 mmHg.
For renal patients, sodium restriction directly reduces proteinuria and slows GFR decline.
        """.strip()
    },
    {
        "id": "CKB_004",
        "title": "Diabetic Diet & Glycaemic Index Management",
        "source": "ADA Standards of Medical Care 2024",
        "category": "Diabetes Nutrition",
        "keywords": ["diabetes", "GI", "glycaemic index", "glucose", "HbA1c", "insulin", "carbohydrate", "ragi", "brown rice", "low GI"],
        "content": """
Glycaemic Index (GI) measures how rapidly a carbohydrate food raises blood glucose.
Low GI < 55. Medium GI 55-69. High GI ≥ 70.

SOUTH INDIAN STAPLES — GI VALUES:
- White rice (cooked): GI 72 — HIGH (dominant staple, major concern)
- Brown rice: GI 55 — LOW (recommended substitute)
- Idli (fermented): GI 35-40 — LOW (fermentation reduces GI significantly)
- Dosa: GI 50-55 — LOW-MEDIUM (acceptable)
- Ragi mudde/ragi flour: GI 68 — MEDIUM (but high calcium and fibre benefit)
- Chapati (whole wheat): GI 62 — MEDIUM (better than white rice)
- Upma (semolina): GI 55 — LOW-MEDIUM (acceptable)

PLATE METHOD FOR T2DM:
- 1/2 plate: non-starchy vegetables (bottle gourd, ridge gourd, drumstick)
- 1/4 plate: lean protein (dal, paneer, egg white, chicken)
- 1/4 plate: complex carbs (brown rice, ragi, whole wheat chapati)

TIMING IS CRITICAL:
- Carbohydrates should be spread evenly across 3 main meals + 1-2 snacks
- No single meal should exceed 60g carbohydrate (= ~1.5 cups cooked rice)
- Protein-fat-carb sequence: eating protein first reduces postprandial glucose by 20-30%

FOODS THAT LOWER GI OF A MEAL:
- Adding 1 tsp fenugreek seeds (methi) to dough reduces GI by 10-15 points
- Vinegar/lemon juice with meal reduces GI by 20-30%
- Soluble fibre (oats, barley) forms viscous gel slowing glucose absorption

HbA1c TARGET: < 7.0% for most T2DM patients. Dietary adherence accounts for 70% of glycaemic control.
        """.strip()
    },
    {
        "id": "CKB_005",
        "title": "Post-Surgical Nutrition: Liquid to Soft Diet Progression",
        "source": "ESPEN 2021 — Perioperative Clinical Nutrition Guidelines",
        "category": "Surgical Nutrition",
        "keywords": ["post-surgery", "liquid", "soft", "progression", "GI surgery", "anastomosis", "bowel", "NPO", "ileus"],
        "content": """
Post-GI surgery nutritional progression follows a structured protocol to protect surgical sites
while restoring nutritional adequacy as quickly as possible.

STANDARD PROGRESSION (Colostomy Reversal / GI Surgery):
Day 0-1: NPO or clear liquids only (water, clear broth, strained juice, ice chips)
Day 1-2: Full liquid diet (strained dal, smooth idli water, vegetable broth, buttermilk)
Day 2-4: Soft diet (mashed dal, soft idli, curd, well-cooked semolina/upma)
Day 4+: Regular diet with fibre restriction for 2-4 weeks

CLEAR LIQUID DIET (Day 0-1):
✓ Clear chicken/vegetable broth (low sodium)
✓ Strained coconut water (if K+ not restricted)
✓ Apple juice (no pulp, strained)
✓ Ice chips, plain water
✗ Milk, dairy (causes bloating), pulpy juices, fibre

FULL LIQUID (Day 1-2):
✓ Smooth moong dal water (no solids)
✓ Strained vegetable soup
✓ Buttermilk (chaas) — probiotic, easy digest
✓ Smooth idli dipped until very soft
✓ Rice kanji (rice gruel, well-strained)
✗ Pulpy foods, whole grains, raw anything

SOFT DIET (Day 2-4):
✓ Soft idli (1-2 at a time), dosa without crisp edges
✓ Khichdi (very soft, moong dal + rice, well-cooked)
✓ Mashed steamed vegetables (bottle gourd, ash gourd)
✓ Scrambled egg whites (soft, not fried)
✓ Curd (room temperature, not cold)
✗ Raw vegetables, whole grains, nuts, fried foods, spicy foods

ADVANCE DIET ONLY WHEN: Bowel sounds present, no distension, tolerating previous stage × 24 hours,
no nausea/vomiting, no signs of anastomotic leak (pain, fever, discharge).

CALORIE TARGET POST-OP: 25-30 kcal/kg actual body weight. Protein: 1.5-2.0 g/kg/day to support healing.
        """.strip()
    },
    {
        "id": "CKB_006",
        "title": "Protein Requirements in ICU and Post-Surgical Patients",
        "source": "ASPEN Clinical Guidelines 2022",
        "category": "Surgical Nutrition",
        "keywords": ["protein", "ICU", "post-surgery", "healing", "nitrogen", "sarcopenia", "albumin", "amino acids"],
        "content": """
Protein requirements increase significantly post-surgery due to catabolism, wound healing,
immune function, and acute phase response.

POST-SURGICAL PROTEIN TARGETS:
- General post-op: 1.2-1.5 g/kg actual body weight/day
- Major GI surgery: 1.5-2.0 g/kg/day
- ICU / critically ill: 1.2-2.0 g/kg/day (higher in obese patients with complications)
- Renal patients (CKD non-dialysis): 0.6-0.8 g/kg/day (to slow CKD progression)
- Renal patients (dialysis): 1.2-1.5 g/kg/day (dialysis removes protein)

BEST PROTEIN SOURCES FOR POST-SURGICAL PATIENTS:
1. Egg whites: Complete amino acid profile, very low fat, 10.9g protein/100g, easily digestible
2. Moong dal soup (strained): 6g protein/100ml, anti-inflammatory, gut-friendly
3. Paneer (soft, low-fat): High biological value protein, soft texture suitable for progression
4. Chicken breast (steamed/boiled): 31g protein/100g, no residue, high BV
5. Buttermilk (chaas): 3.3g protein/100ml, probiotic, easy on GI tract

PROTEIN QUALITY: Biological Value (BV) matters more than quantity.
Egg white BV = 100 (reference standard), Milk BV = 91, Fish = 83, Chicken = 79, Dal BV = 60-70.
For renal patients: higher BV foods preferred to minimise urea production from incomplete protein.

SIGNS OF PROTEIN DEFICIENCY: Delayed wound healing, oedema (low albumin), muscle wasting,
poor immunity (frequent infections), hair loss. Monitor serum albumin weekly.

ASSESSMENT: Serum albumin < 3.5 g/dL = protein malnourished → aggressive enteral nutrition support.
Serum albumin < 3.0 g/dL = severe — consider parenteral nutrition consultation.
        """.strip()
    },
    {
        "id": "CKB_007",
        "title": "Idli and Fermented Foods in Clinical Diets",
        "source": "IDA 2022 — Indian Dietetic Association Clinical Nutrition Manual",
        "category": "Indian Clinical Nutrition",
        "keywords": ["idli", "fermented", "probiotic", "dosa", "GI", "diabetes", "post-surgery", "South Indian", "fermentation"],
        "content": """
Fermented South Indian foods hold unique advantages in clinical nutrition due to probiotic content,
reduced glycaemic index, and improved digestibility — making them suitable across multiple clinical conditions.

FERMENTATION BENEFITS:
1. GI REDUCTION: Fermentation of idli batter reduces GI from ~70 (unfermented rice) to 35-40.
   This makes idli one of the lowest-GI South Indian staples — ideal for diabetics.
2. PROBIOTIC EFFECT: Lactobacillus fermentation produces probiotic bacteria that restore gut
   microbiome — critical post-GI surgery and antibiotic therapy.
3. IMPROVED DIGESTIBILITY: Phytates in rice are broken down, improving mineral absorption.
   Starch gelatinisation makes idli extremely easy to digest.
4. PROTEIN QUALITY: Black gram (urad dal) in idli batter provides complementary amino acids
   to rice protein — together approaching complete protein.

IDLI IN DIABETES (P001 Ravi Kumar protocol):
- Serve 2-3 idlis (150-200g total) per meal
- Use ragi idli variant (50% ragi flour) to further reduce GI
- Serve with sambar (dal + vegetables) for protein + fibre
- Avoid coconut chutney in large amounts (high fat in coconut — drug interaction with Glipizide)
- Tomato chutney SHOULD be avoided (high potassium if concurrent renal restrictions)

IDLI POST-SURGERY (P003 Arjun Singh protocol):
- Day 2: Soak idli in warm water until very soft — semi-liquid consistency
- Day 3: Regular soft idli with sambar (ensure sambar is soft, no whole vegetables)
- Day 4+: Normal idli with full accompaniments (if progressing to soft diet)

CLINICAL NOTE: Idli is clinically superior to bread for hospital diets:
- No added preservatives, no refined flour, no trans fats
- Predictable glycaemic response, probiotic benefit, traditional patient acceptance
        """.strip()
    },
    {
        "id": "CKB_008",
        "title": "Fluid Restriction Management in Renal Failure",
        "source": "KDIGO 2023 — CKD Management Guidelines",
        "category": "Renal Nutrition",
        "keywords": ["fluid", "fluid restriction", "renal", "CKD", "dialysis", "oedema", "urine output", "thirst", "fluid balance"],
        "content": """
Fluid restriction in CKD and dialysis patients is one of the most challenging aspects of management.
Non-compliance leads to pulmonary oedema, hypertension, and emergency dialysis.

FLUID ALLOWANCE CALCULATION:
Dialysis patients: Residual urine output (ml/day) + 500ml (insensible losses) = daily fluid allowance.
Example: Patient passes 200ml urine/day → fluid allowance = 700ml/day total.
Non-dialysis CKD: Generally 1500-2000ml/day unless oedema or heart failure present.

WHAT COUNTS AS FLUID:
ALL of the following must be counted toward daily fluid allowance:
- Water, tea, coffee, juices, soups, broths
- Milk, lassi, buttermilk, coconut water
- Ice cream, ice cubes, gelatin desserts, custard
- High-water-content fruits (watermelon 92% water, orange 87%, grapes 80%)
- IV fluids administered (coordinate with nursing team)

PRACTICAL FLUID MANAGEMENT TIPS:
1. Use small cups (150ml) instead of large glasses — visual satisfaction with less fluid
2. Ice chips satisfy thirst with minimal fluid (1 cup ice = 120ml water)
3. Sour candy/lemon wedge stimulates saliva — reduces thirst perception
4. Keep fluid in a single measured container — patient sees exactly what's left
5. Cold beverages feel more satisfying than warm (reduces total intake)
6. Address mouth dryness with mouth rinses (swish and spit, don't swallow)

FLUID MONITORING: Document ALL fluid intake on nursing chart. Include IV medications,
IV flushes, and oral medications dissolved in water. Weigh patient daily — same time, same scale.
Target: No more than 0.5kg weight gain per day between dialysis sessions.
Interdialytic weight gain > 2kg = DANGER ZONE. Alert dialysis team immediately.
        """.strip()
    },
    {
        "id": "CKB_009",
        "title": "Ragi (Finger Millet) in Diabetic Management",
        "source": "IIMR (Indian Institute of Millets Research) — Clinical Nutrition Evidence Summary",
        "category": "Indian Clinical Nutrition",
        "keywords": ["ragi", "finger millet", "diabetes", "calcium", "iron", "low GI", "millets", "traditional", "HbA1c"],
        "content": """
Ragi (Eleusine coracana / Finger Millet) is a nutritionally exceptional South Indian staple
with clinically validated benefits for diabetes management and malnutrition.

NUTRITIONAL PROFILE (per 100g ragi flour):
- Calories: 328 kcal
- Protein: 7.3g (higher than white rice 2.7g, wheat flour 7g)
- Carbohydrates: 72g (but complex, with 16g fibre — mostly insoluble)
- Calcium: 344mg (HIGHEST among cereals — 3x that of milk per 100g!)
- Iron: 3.9mg (excellent for anaemia)
- Glycaemic Index: 68 (medium — but substantial fibre modifies postprandial response)

CLINICAL BENEFITS IN DIABETES:
1. POLYPHENOL CONTENT: Ragi contains significant tannins and phenolic acids that inhibit
   alpha-glucosidase and alpha-amylase — the enzymes that digest starch. This directly
   slows glucose absorption, reducing postprandial glucose spike by 30-40% vs white rice.
2. FIBRE MATRIX: Insoluble fibre creates physical barrier to starch digestion.
3. GI OPTIMISATION: Mixed with buttermilk or curd, ragi fermented overnight further reduces
   effective GI to 50-55 range.
4. SATIETY: High protein + fibre reduces hunger, improving meal compliance in diabetics
   who are often calorie-conscious.

CLINICAL STUDY DATA:
IIMR trial (n=120, T2DM patients): Replacing 50% of rice calories with ragi for 12 weeks
reduced postprandial glucose by 25.7mg/dL and HbA1c by 0.5% compared to control.

PREPARATION FOR CLINICAL DIETS:
- Ragi porridge (kanji): 1 tbsp ragi flour in 200ml water, cook 10 min → smooth, easily digestible
- Ragi dosa: 50% ragi + 50% rice batter, fermented — low GI, probiotic benefit
- Ragi roti: Less preferred post-surgery due to drier texture
- Ragi mudde (balls): Traditional Karnataka dish — high satiety, good for outpatient T2DM

CONTRAINDICATION: High potassium (408mg/100g) and phosphorus (235mg/100g) make ragi unsuitable
for CKD/renal failure patients. For P002 Meena Iyer (Renal), ragi should be AVOIDED.
Suitable for P001 Ravi Kumar (Diabetes) — excellent clinical choice.
        """.strip()
    },
    {
        "id": "CKB_010",
        "title": "30-Day Home Nutrition Plan Post-Hospital Discharge",
        "source": "WHO 2023 — Hospital to Home Nutritional Continuity Guidelines",
        "category": "Discharge Nutrition",
        "keywords": ["discharge", "home", "outpatient", "30-day", "transition", "caregiver", "meal plan", "follow-up"],
        "content": """
Nutritional continuity from hospital to home is critical for preventing readmission.
30-60% of post-discharge complications are nutrition-related. A structured home plan reduces
readmission rates by 25-30% (WHO 2023 meta-analysis, n=12,400 patients).

THE DISCHARGE NUTRITION PRESCRIPTION MUST INCLUDE:
1. CURRENT DIET STAGE: liquid / soft / regular (and when to advance)
2. SPECIFIC RESTRICTIONS with food lists (what to eat, what to avoid)
3. CALORIE TARGET and how to estimate at home
4. FLUIDS: target, what counts, how to measure
5. WARNING SIGNS requiring immediate return to hospital
6. FOLLOW-UP SCHEDULE: dietitian review at 1 week, 2 weeks, 1 month

HOME COOKING GUIDANCE FOR CAREGIVERS:
- Use a food scale until portion sizes become intuitive
- Prepare extra food and refrigerate — prevents non-compliant eating when fatigued
- Batch-cook dals, khichdi, soft rice — reheat with added water to adjust consistency
- Keep approved snack foods visible, non-approved foods out of sight
- Involve the whole household — patient compliance falls 60% if family eats differently

READMISSION WARNING SIGNS — RETURN TO ER IF:
For Renal patients: weight gain > 1kg in 24h, breathlessness, serum K+ symptoms (palpitations),
urine output drops to < 100ml/day.
For Diabetic patients: blood glucose > 14 mmol/L on home meter, hypoglycaemia episodes > 2/day.
For Post-surgical: wound pain, fever > 38°C, failure to pass flatus, abdomen distension.

TELEHEALTH FOLLOW-UP PROTOCOL:
WhatsApp photo of each meal → dietitian reviews within 4 hours.
Multilingual support essential — 67% of Indian patients in WHO study had lower literacy.
Audio messages in native language improve compliance by 40% vs written discharge instructions.

MEDICATION WITH FOOD REMINDERS:
- Metformin: ALWAYS with or after food (reduces nausea)
- Calcium Carbonate: WITH every meal (phosphate binding requires food)
- Glipizide: IMMEDIATELY before meal (do not take and skip meal — hypoglycaemia)
- Omeprazole: 30 minutes BEFORE meal (requires acid-free environment for absorption)
        """.strip()
    }
]


# ══════════════════════════════════════════════════════════════════
# TF-IDF RAG ENGINE (no external vector DB)
# Stolen architecture from AgriSahayak — keyword cosine similarity
# ══════════════════════════════════════════════════════════════════

def _tokenise(text: str) -> List[str]:
    """Simple tokeniser — lowercase, strip punctuation, split on whitespace."""
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return [t for t in text.split() if len(t) > 2]


def _tf(tokens: List[str]) -> Dict[str, float]:
    """Term frequency for a token list."""
    freq: Dict[str, int] = {}
    for t in tokens:
        freq[t] = freq.get(t, 0) + 1
    total = max(len(tokens), 1)
    return {t: count / total for t, count in freq.items()}


def _build_idf(docs: List[List[str]]) -> Dict[str, float]:
    """Inverse document frequency over a corpus of token lists."""
    n = len(docs)
    df: Dict[str, int] = {}
    for doc in docs:
        for term in set(doc):
            df[term] = df.get(term, 0) + 1
    return {term: math.log((n + 1) / (count + 1)) + 1 for term, count in df.items()}


def _cosine(vec_a: Dict[str, float], vec_b: Dict[str, float]) -> float:
    """Cosine similarity between two TF-IDF vectors."""
    shared = set(vec_a) & set(vec_b)
    dot = sum(vec_a[t] * vec_b[t] for t in shared)
    mag_a = math.sqrt(sum(v ** 2 for v in vec_a.values()))
    mag_b = math.sqrt(sum(v ** 2 for v in vec_b.values()))
    return dot / (mag_a * mag_b + 1e-9)


class ClinicalRAGEngine:
    """
    Simple TF-IDF RAG engine — no external dependencies.
    Stolen from AgriSahayak rag_engine.py pattern (keyword cosine match).
    Used for /api/v1/rag/query and /api/v1/rag/verified-query.
    """

    def __init__(self):
        self._docs = CLINICAL_KNOWLEDGE
        self._corpus_tokens = [
            _tokenise(d["content"] + " " + " ".join(d["keywords"]) + " " + d["title"])
            for d in self._docs
        ]
        self._idf = _build_idf(self._corpus_tokens)
        self._doc_vecs = []
        for tokens in self._corpus_tokens:
            tf = _tf(tokens)
            self._doc_vecs.append({
                term: tf_val * self._idf.get(term, 1.0)
                for term, tf_val in tf.items()
            })

    def retrieve(self, query: str, top_k: int = 3) -> List[Dict]:
        """Retrieve top-k relevant documents for a query."""
        q_tokens = _tokenise(query)
        q_tf = _tf(q_tokens)
        q_vec = {
            term: tf_val * self._idf.get(term, 1.0)
            for term, tf_val in q_tf.items()
        }
        scores = [
            (_cosine(q_vec, doc_vec), i)
            for i, doc_vec in enumerate(self._doc_vecs)
        ]
        scores.sort(reverse=True)
        top = scores[:top_k]
        results = []
        for score, idx in top:
            doc = self._docs[idx]
            results.append({
                "id":       doc["id"],
                "title":    doc["title"],
                "source":   doc["source"],
                "category": doc["category"],
                "score":    round(score, 4),
                "excerpt":  doc["content"][:300] + "...",
                "full_content": doc["content"],
            })
        return results

    def get_restriction_explanation(self, restriction: str) -> Dict:
        """Explain WHY a dietary restriction exists — for the /rag/explain endpoint."""
        docs = self.retrieve(restriction, top_k=2)
        return {
            "restriction": restriction,
            "explanation": docs[0]["excerpt"] if docs else "No specific clinical documentation found for this restriction.",
            "sources": [{"id": d["id"], "title": d["title"], "source": d["source"]} for d in docs],
            "found": len(docs) > 0,
        }

    async def ask_with_rag(self, question: str, patient_id: str = "", restrictions: List[str] = None) -> Dict:
        """
        Full RAG pipeline:
        1. Retrieve relevant clinical documents
        2. Build context-rich prompt
        3. Ask Ollama (local) → Gemini fallback
        4. Return answer + cited sources
        """
        relevant = self.retrieve(question, top_k=3)
        context_blocks = "\n\n".join(
            f"[{doc['title']} — {doc['source']}]\n{doc['full_content']}"
            for doc in relevant
        )

        restriction_str = ""
        if restrictions:
            restriction_str = f"Patient dietary restrictions: {', '.join(restrictions)}\n"

        system_prompt = (
            "You are a clinical dietitian AI at G. Kathir Memorial Hospital. "
            "Answer ONLY from the provided clinical guidelines. "
            "Always cite the source document. "
            "Be concise, actionable, and safe. "
            "If the answer is not in the context, say so."
        )
        user_prompt = (
            f"{restriction_str}"
            f"Clinical guidelines context:\n{context_blocks}\n\n"
            f"Dietitian question: {question}\n\n"
            f"Provide a clinical answer with source citations."
        )

        answer = ""

        # Try Ollama first (local, private)
        try:
            from ollama_client import quick_response
            answer = await quick_response(user_prompt)
            source_used = "ollama"
        except Exception as e:
            logger.warning(f"Ollama RAG call failed: {e}, falling back to Gemini")
            answer = ""
            source_used = "none"

        # Gemini fallback
        if not answer:
            try:
                from gemini_client import ask_gemini
                answer = await ask_gemini(user_prompt, system=system_prompt, max_tokens=1024, timeout=30.0)
                source_used = "gemini"
            except Exception as e:
                logger.error(f"Gemini RAG fallback also failed: {e}")
                answer = (
                    "I was unable to reach the AI backend. "
                    "Please refer to the clinical knowledge documents directly:\n\n"
                    + "\n".join(f"• {d['title']} ({d['source']}): {d['excerpt']}" for d in relevant)
                )
                source_used = "static_fallback"

        return {
            "patient_id":  patient_id,
            "question":    question,
            "answer":      answer,
            "sources":     relevant,
            "total_docs_searched": len(self._docs),
            "docs_retrieved": len(relevant),
            "ai_source":   source_used,
        }


# Singleton instance — imported by main.py endpoints
_engine_instance: Optional[ClinicalRAGEngine] = None


def get_rag_engine() -> ClinicalRAGEngine:
    """Get or create the singleton RAG engine."""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = ClinicalRAGEngine()
        logger.info(f"✅ Clinical RAG engine initialised — {len(CLINICAL_KNOWLEDGE)} knowledge documents indexed")
    return _engine_instance
