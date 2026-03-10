"""
diet_plan_pdf.py
══════════════════════════════════════════════════════════════════
CAP³S  —  30-Day Personalised Home Diet Plan PDF
══════════════════════════════════════════════════════════════════
Generates a beautiful dark-theme PDF (A4) for a patient's 30-day
post-discharge / home meal plan, fully adapted to their clinical
dietary restrictions, calorie target, and language preference.

Usage (standalone):
    from diet_plan_pdf import build_30day_diet_plan_pdf
    pdf_bytes = await build_30day_diet_plan_pdf(patient_data)
    open("plan.pdf", "wb").write(pdf_bytes)

Dependencies: reportlab  (already in requirements.txt)
"""

import io
import logging
from datetime import date, timedelta
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, PageBreak, KeepTogether,
    )
    from reportlab.graphics.shapes import Drawing, Rect, String, Line
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    logger.warning("reportlab not installed — pip install reportlab")

# ── Brand colours (matches report_generator.py) ───────────────────────────────
TEAL      = colors.HexColor("#00C9B1")
DARK_BG   = colors.HexColor("#0D1117")
CARD_BG   = colors.HexColor("#161B22")
AMBER     = colors.HexColor("#F0A500")
RED       = colors.HexColor("#FF4C6A")
GREEN     = colors.HexColor("#2ECC71")
PURPLE    = colors.HexColor("#A371F7")
BLUE      = colors.HexColor("#58A6FF")
TEXT_MAIN = colors.HexColor("#E6EDF3")
TEXT_DIM  = colors.HexColor("#8B949E")
BORDER    = colors.HexColor("#30363D")
WHITE     = colors.white


# ══════════════════════════════════════════════════════════════════════════════
# 30-DAY MEAL DATA  (per patient profile)
# Weeks 1-4 cover different themes; days 29-30 re-use week-1 as a bridge.
# Format: (meal_time, dish_name, kcal, protein_g, carb_g, fat_g, notes)
# ══════════════════════════════════════════════════════════════════════════════

# ── P001 / Diabetic / Low-GI / South Indian / 1800 kcal ──────────────────────
_P001_DAYS: List[tuple] = [
    # (breakfast, lunch, snack, dinner) per day — each = (dish, kcal, prot, carb, fat, note)
    # WEEK 1 — Foundation
    [("Ragi Dosa + Peanut Chutney",     420,14,58,12,"Low GI • high fibre"),
     ("Brown Rice + Palak Dal",          520,22,72,10,"Iron-rich spinach"),
     ("Roasted Chana + Lemon Water",     140, 7,18, 3,"Low GI snack"),
     ("Bajra Roti + Methi Sabzi",        480,16,64,14,"Fenugreek lowers BG")],
    [("Moong Dal Chilla + Coriander",    380,18,42,10,"Protein-rich breakfast"),
     ("Jowar Roti + Drumstick Sambar",   540,20,76,11,"Jowar = low GI grain"),
     ("Apple (medium) + Almonds",        130, 3,22, 5,"Fibre + healthy fat"),
     ("Mixed Veg Khichdi",              460,16,68, 8,"Comfort + compliance")],
    [("Oats Upma + Coconut Chutney",    390,12,52,14,"Beta-glucan fibre"),
     ("Foxtail Millet Rice + Rasam",    510,18,74, 9,"Millet boosts satiety"),
     ("Cucumber + Peanut Butter",       120, 5,10, 7,"Low calorie crunch"),
     ("Wheat Roti + Lauki Sabzi",       440,14,62,12,"Easy-digest dinner")],
    [("Idli (3) + Sambar",              400,12,60, 8,"Fermented = gut-friendly"),
     ("Brown Rice + Rajma Curry",       560,24,78,10,"High protein legume"),
     ("Guava (1 medium)",               100, 2,24, 1,"Low GI tropical fruit"),
     ("Bajra Roti + Bhindi Sabzi",      450,14,60,14,"Okra slows glucose")],
    [("Ragi Porridge + Flaxseed",       360,10,56, 8,"Omega-3 boost"),
     ("Millet Pulao + Raita",           530,16,72,14,"Probiotic from curd"),
     ("Roasted Sunflower Seeds",         90, 4, 6, 7,"Vitamin E snack"),
     ("Wheat Dosa + Tomato Chutney",    420,12,58,14,"Light evening meal")],
    [("Pesarattu + Ginger Chutney",     410,16,52,12,"Moong protein hit"),
     ("Brown Rice + Palak Paneer",      550,24,68,16,"Calcium + iron"),
     ("Banana (small) + Walnuts",       160, 4,28, 6,"Potassium + omega-3"),
     ("Jowar Roti + Tinda Sabzi",       430,14,62,10,"Low cal gourd")],
    [("Vegetable Poha + Lemon",         400,10,58,14,"Iron from poha"),
     ("Millet Khichdi + Curd",          520,20,70,12,"Gut + satiety"),
     ("Orange (medium)",                 80, 2,18, 0,"Vitamin C"),
     ("Roti + Baingan Bharta",          440,14,60,14,"Smoky aubergine")],
    # WEEK 2 — Variety
    [("Wheat Upma + Curry Leaves",      380,10,54,12,"Cooling curry-leaf"),
     ("Brown Rice + Horse Gram Dal",    540,22,72,12,"Horse gram = low GI"),
     ("Pear + 5 Cashews",              140, 3,28, 4,"Fibre + mineral"),
     ("Bajra Khichdi + Raita",          480,16,66,12,"Warming millet meal")],
    [("3 Egg White Omelette + Toast",   360,22,28,10,"High-protein start"),
     ("Jowar Bhakri + Zunka",          530,18,72,12,"Maharashtra millet"),
     ("Coconut Water (200ml)",           40, 0, 9, 0,"Electrolyte refresh"),
     ("Dal Palak + Brown Rice",         500,20,70,10,"Iron special")],
    [("Multigrain Dosa + Groundnut",    410,14,56,14,"Multi-grain fibre"),
     ("Chole + Roti (2)",              560,20,78,14,"Chickpea protein"),
     ("Papaya (1 cup)",                 60, 1,14, 0,"Enzyme papain"),
     ("Lauki Soup + Wheat Roti",        420,12,60,12,"Digestive dinner")],
    [("Sabudana Khichdi (small)",       360,10,52,12,"Sago energy — moderate"),
     ("Brown Rice + Fenugreek Dal",     530,20,72,12,"Trigonella help"),
     ("Chaas / Buttermilk (200ml)",      40, 2, 5, 1,"Probiotic coolant"),
     ("Methi Thepla + Curd",           450,14,62,12,"Whole-wheat thepla")],
    [("Broken Wheat Porridge + Milk",   400,14,58, 8,"Daliya = slow carb"),
     ("Kidney Bean Curry + Roti",       560,22,74,14,"High-fibre beans"),
     ("Watermelon (1 cup)",              50, 1,12, 0,"Hydration"),
     ("Vegetable Daliya Khichdi",       440,14,62,10,"Fibre-packed")],
    [("Steamed Idli (3) + Coconut",     380,10,56, 8,"Light fermented"),
     ("Millet Sambar Rice",            520,18,74,10,"South Indian millet"),
     ("Ragi Biscuits (homemade, 3)",   120, 4,18, 4,"Low-GI snack"),
     ("Jowar Roti + Cluster Beans",    440,14,64,10,"Guar = fibre-rich")],
    [("Sprouts + Veg Upma",            380,14,48,12,"Vitamin C + protein"),
     ("Brown Rice + Dahi Kadhi",       520,16,72,12,"Probiotic kadhi"),
     ("Amla (2) + Lemon Water",         40, 1, 8, 0,"Vitamin C powerhouse"),
     ("Wheat Roti + Capsicum Sabzi",   440,12,60,14,"Antioxidant pepper")],
    # WEEK 3 — Therapeutic focus
    [("Chia Seed Pudding + Berries",   320,10,40,12,"Omega-3 + antioxidants"),
     ("Brown Rice + Gongura Dal",      540,20,72,12,"Sorrel + iron"),
     ("A handful of Pumpkin Seeds",     80, 5, 4, 6,"Zinc + magnesium"),
     ("Foxtail Millet Khichdi",        460,16,64,12,"Night blood glucose")],
    [("Moong Sprout Dosa",             390,16,50,12,"Very high protein"),
     ("Sorghum Roti + Drumstick Dal", 530,20,72,12,"Bone calcium"),
     ("Pomegranate (½ cup)",           80, 1,18, 0,"Antioxidant seeds"),
     ("Jowar Dosa + Ginger Chutney",  430,12,60,14,"Digestion aid")],
    [("Oat Chilla + Mint",            380,12,50,12,"Fibre-dense"),
     ("Brown Rice + Soya Chunk Curry",560,28,68,14,"Plant protein"),
     ("Low-fat Curd (100g) + Flax",   100, 6, 8, 4,"Probiotics"),
     ("Bajra Roti + Karela Sabzi",    440,14,60,14,"Bitter gourd = BG control")],
    [("Ragi Idli (3) + Sambar",       400,12,58, 8,"Ragi + fermentation"),
     ("Millet Biryani (small)",        540,18,72,14,"Festival favourite"),
     ("Boiled Chickpeas (½ cup)",       90, 5,14, 2,"High fibre"),
     ("Wheat Roti + Mushroom Masala",  450,16,60,14,"Vitamin D mushroom")],
    [("Broken Wheat Dosa + Chutney",  390,12,54,12,"High-bran early meal"),
     ("Brown Rice + Palak Dal",        520,22,72,10,"Iron & folate"),
     ("Mixed Nut Handful (15g)",       90, 3, 4, 8,"Good fats"),
     ("Lauki Khichdi + Raita",        450,14,64,10,"Light easy dinner")],
    [("Paneer Bhurji + 1 Roti",       420,20,32,18,"Protein-start day"),
     ("Brown Rice + Horse Gram Sambar",540,22,72,12,"Horse gram star"),
     ("Coconut Water",                 40, 0, 9, 0,"Minerals"),
     ("Jowar Bhakri + Onion Sabzi",   440,14,62,10,"Traditional south")],
    [("Vegetable Uttapam",            410,12,54,14,"One-pot breakfast"),
     ("Foxtail Millet Rice + Fish Curry",560,26,68,16,"Omega-3 fish"),
     ("Guava half + Lime",             50, 1,12, 0,"Vitamin C"),
     ("Ragi Roti + Daal Tadka",       450,14,62,12,"Calcium-rich ragi")],
    # WEEK 4 — Consolidation
    [("Sprout Poha + Lemon",          380,14,50,10,"Sprouted iron"),
     ("Brown Rice + Bengal Gram Dal",  540,20,72,12,"Classic dal"),
     ("Watermelon (1 cup)",            50, 1,12, 0,"Hydration"),
     ("Bajra Khichdi + Curd",         460,16,64,12,"Probiotic night")],
    [("Multigrain Paratha (1) + Curd",400,14,50,14,"Whole grain"),
     ("Jowar Roti + Toor Dal + Ghee",  530,18,70,14,"Ghee in moderation"),
     ("Roasted Peanuts (15g)",         90, 4, 5, 7,"Protein snack"),
     ("Dalia Upma + Raita",           440,14,62,12,"Fibre dinner")],
    [("Ragi Porridge + Banana",       380,10,58, 8,"Energy start"),
     ("Brown Rice + Rajma Masala",     540,22,74,12,"Legume-rich"),
     ("Apple (small) + 5 Almonds",    130, 3,22, 5,"Fibre + fat"),
     ("Wheat Dosa + Tomato Chutney",  420,12,58,14,"Comforting dinner")],
    [("Oats Khichdi + Veggies",       400,12,54,12,"Heart-healthy oats"),
     ("Millet Pulao + Curd",          530,16,72,14,"Balanced lunch"),
     ("Chaas (200ml) + Roasted Chana",100, 6,12, 2,"Double probiotic"),
     ("Jowar Roti + Aloo Methi",      450,14,62,14,"Classic comfort")],
    [("Idli (3) + Sambar + Chutney",  400,12,60, 8,"Fermented classic"),
     ("Brown Rice + Palak Paneer",     550,24,68,16,"Protein-rich"),
     ("Pear (medium)",                 90, 1,22, 0,"Low GI fruit"),
     ("Bajra Roti + Lauki Curry",      440,14,60,14,"Low-cal gourd")],
    [("Sprouts Uttapam",              400,16,48,14,"Protein-rich base"),
     ("Foxtail Millet Rice + Sambar", 520,18,72,10,"South Indian classic"),
     ("Orange + Flaxseed (1 tsp)",     90, 2,20, 2,"Omega boost"),
     ("Wheat Roti + Bhindi Masala",   440,14,62,12,"Okra fibre")],
    [("Pesarattu + Coconut Chutney",  410,16,52,12,"Protein moong"),
     ("Brown Rice + Mixed Dal",        540,22,72,12,"Multi-legume dal"),
     ("Pomegranate (½ cup)",           80, 1,18, 0,"Antioxidant"),
     ("Jowar Roti + Palak Gosht",      490,22,60,16,"Iron + protein")],
    [("Broken Wheat Upma + Egg",      400,16,48,12,"Complete protein"),
     ("Brown Rice + Rajma Curry",      560,22,76,12,"Fibre + iron"),
     ("Coconut Water",                 40, 0, 9, 0,"Electrolytes"),
     ("Bajra Roti + Methi Dal",        450,16,62,12,"Fenugreek + dal")],
    [("Ragi Dosa + Peanut Chutney",   420,14,58,12,"Revisit week-1 fav"),
     ("Millet Khichdi + Curd",        520,20,70,12,"Closing week"),
     ("Mixed Nuts (15g)",              90, 3, 4, 8,"Healthy fats"),
     ("Roti + Baingan Bharta",        440,14,60,14,"Satisfying finish")],
    [("Moong Dal Chilla + Coriander", 380,18,42,10,"30-day milestone!"),
     ("Brown Rice + Palak Dal",        520,22,72,10,"Full circle"),
     ("Guava + Lime",                  60, 1,14, 0,"Vitamin C"),
     ("Bajra Roti + Mixed Veg",        460,16,62,12,"Celebration dinner")],
]

# ── P002 / CKD Stage 4 / Low-K Low-Na Low-P / 1600 kcal ─────────────────────
_P002_DAYS: List[tuple] = [
    [("Semolina Upma (low-K)",         340, 8,52,10,"No banana/potato"),
     ("White Rice + Lauki Dal",        460,14,68, 8,"Bottle gourd = renal safe"),
     ("Sago Papad (1) + Water",         60, 2, 8, 2,"Low-K snack"),
     ("Phulka (2) + Cabbage Sabzi",    420,12,58,12,"Cabbage = low K")],
    [("Poha (no potato)",             320, 6,50,10,"Avoid K-rich potato"),
     ("White Rice + Tinda Curry",      440,10,66,10,"Tinda = renal-safe"),
     ("Cream Cracker (2) + Salt-free", 80, 2,14, 2,"Low-Na cracker"),
     ("Phulka + Ridge Gourd Sabzi",   400,10,56,12,"Low K ridge gourd")],
    [("Semolina Idli + Coconut",       330, 8,50, 8,"Semolina > rice for renal"),
     ("White Rice + Moong Dal",        480,14,70,10,"Moong = low-P legume"),
     ("Boiled Leached Carrot (50g)",   30, 1, 7, 0,"Leach removes K"),
     ("Phulka + Parwal Sabzi",        390,10,54,12,"Pointed gourd = OK")],
    [("Bread (2 sl) + Paneer Bhurji", 360,14,40,14,"White bread < brown for P"),
     ("White Rice + Bottle Gourd",     430,10,66, 8,"Classic renal lunch"),
     ("Rice Cake (1)",                  60, 1,14, 0,"Low-K crunch"),
     ("Phulka + Snake Gourd Sabzi",    380,10,52,12,"Very low potassium")],
    [("Semolina Upma + Chutney",       350, 8,50,12,"Coconut chutney < 60ml"),
     ("White Rice + Ash Gourd Curry",  450,12,68, 8,"Ash gourd = renal-safe"),
     ("Plain Chaas (100ml)",           25, 2, 3, 1,"Limit fluids"),
     ("Phulka + Cabbage Poriyal",     400,10,54,14,"Low-K vegetable")],
    [("Vermicelli Upma",              340, 8,52, 8,"Low-P vermicelli"),
     ("White Rice + Toor Dal + Ghee",  480,14,70,12,"Ghee OK in moderation"),
     ("Apple (small, peeled)",          70, 0,18, 0,"Peel to reduce K"),
     ("Phulka + Ivy Gourd (Tindora)",  390,10,54,12,"Tindora = renal-safe")],
    [("Semolina Dosa + White Chutney", 330, 8,48,10,"Low-K breakfast"),
     ("White Rice + Lauki Kofta",      470,14,64,14,"Bottle gourd balls"),
     ("Rice Puffs (small bowl)",        70, 1,16, 0,"Low-K puffed rice"),
     ("Phulka + Tinda Sabzi",          380,10,52,12,"Classic renal veg")],
    [("Poha + Semolina Mix",          330, 6,50,10,"Low-K blend"),
     ("White Rice + Pumpkin Dal",      450,12,66, 8,"Pumpkin leached"),
     ("Cream Cracker + Unsalted Butter",90, 2,14, 4,"Low-Na snack"),
     ("Phulka + Cauliflower Sabzi",    400,10,56,12,"Leached cauliflower")],
    [("Semolina Upma (plain)",         330, 6,48,10,"Minimal seasoning"),
     ("White Rice + Moong Dal Khichdi",460,14,68,10,"One-pot renal meal"),
     ("Pear (peeled, small)",           60, 0,14, 0,"Low-K pear"),
     ("Phulka + Ridge Gourd",          390,10,52,12,"Low-electrolyte dinner")],
    [("Bread + Egg White (2) Omelette",300,14,30,10,"Egg white = low-P"),
     ("White Rice + Cabbage Dal",      440,12,66, 8,"Cabbage lowers K"),
     ("Puffed Rice (small cup)",        60, 1,14, 0,"Light snack"),
     ("Phulka + Lauki Masala",         380,10,52,12,"Classic bottle gourd")],
    [("Semolina Idli (3) + Thin Sambar",340, 8,50, 8,"Thin sambar < K"),
     ("White Rice + Tinda Dal",        440,10,66, 8,"Low-K lunchplate"),
     ("Sago Papad (1)",                 60, 2, 8, 2,"Nephrology-safe"),
     ("Phulka + Apple Gourd",          380,10,52,12,"Low-K gourd family")],
    [("Vermicelli Upma + Coconut",     340, 8,52, 8,"Light & easy"),
     ("White Rice + Pumpkin Curry",    440,10,64, 8,"Leach pumpkin 30 min"),
     ("Rice Cake (1)",                  60, 1,14, 0,"Minimal phosphorus"),
     ("Phulka + Parwal Masala",        390,10,54,12,"Very low K vegetable")],
    [("Semolina Poha Mix",             330, 6,48,10,"Low-K breakfast"),
     ("White Rice + Ash Gourd Dal",    450,12,68, 8,"Dual low-K combo"),
     ("Boiled Leached Beans (30g)",    50, 3, 8, 0,"1hr leach reduces K"),
     ("Phulka + Cabbage Paratha",      400,10,58,10,"Low-K stuffed roti")],
    [("Soft Dosa + White Coconut",     330, 8,48,10,"Low GI semolina dosa"),
     ("White Rice + Moong Dal",        480,14,70,10,"Best renal-safe dal"),
     ("Chaas (100ml)",                 25, 2, 3, 1,"Within fluid allowance"),
     ("Phulka + Snake Gourd",          380,10,52,12,"Lowest K of gourds")],
    [("Bread (2sl) + Low-Na Spread",   280, 6,40, 8,"Avoid salted butter"),
     ("White Rice + Toor Dal",         480,14,70,12,"Classic combination"),
     ("Apple (small, peeled)",          70, 0,18, 0,"Peel reduces K 30%"),
     ("Phulka + Cauliflower (leached)", 390,10,54,12,"Phosphorus removed by leaching")],
    [("Semolina Upma",                 330, 6,48,10,"Low-K stable"),
     ("White Rice + Lauki Dal",        460,14,68, 8,"Renal fav"),
     ("Puffed Rice Cup",                60, 1,14, 0,"Low K"),
     ("Phulka + Tinda Sabzi",          380,10,52,12,"Safe vegetable")],
    [("Semolina Idli + Coconut",       330, 8,50, 8,"Healthy rava base"),
     ("White Rice + Cabbage Poriyal",  430,10,64, 8,"Calcium + low K"),
     ("Rice Puffs",                     60, 1,14, 0,"Zero phosphorus"),
     ("Phulka + Ridge Gourd",          390,10,52,12,"Low-K dinner")],
    [("Poha (no potato)",              320, 6,50,10,"Renal-safe breakfast"),
     ("White Rice + Bitter Gourd Dal", 440,10,64, 8,"Bitter gourd = low K"),
     ("Cream Cracker (2)",              80, 2,14, 2,"Renal snack"),
     ("Phulka + Ivy Gourd Sabzi",      390,10,54,12,"Tindora safe")],
    [("Semolina Dosa + White Chutney", 330, 8,48,10,"Coconut within 40g"),
     ("White Rice + Moong Dal + Ghee", 480,14,70,12,"Comforting renal lunch"),
     ("Sago Papad",                     60, 2, 8, 2,"Dialysis-day snack"),
     ("Phulka + Parwal",               390,10,54,12,"Low-K veg")],
    [("Bread + Egg White Bhurji",      300,14,30,10,"Protein without P"),
     ("White Rice + Pumpkin Curry",    440,10,64, 8,"Low-K lunch"),
     ("Pear (peeled)",                  60, 0,14, 0,"Low-K safe fruit"),
     ("Phulka + Tinda Masala",         380,10,52,12,"Low K")],
    [("Semolina Upma + Curry Leaf",    330, 6,48,10,"Light anti-ox"),
     ("White Rice + Ash Gourd Curry",  450,12,68, 8,"Maximum renal safety"),
     ("Rice Cake",                      60, 1,14, 0,"Zero K"),
     ("Phulka + Cabbage Curry",        400,10,56,12,"Low K cabbage")],
    [("Vermicelli Upma",               340, 8,52, 8,"Week 4 begins"),
     ("White Rice + Tinda Dal",        440,10,66, 8,"Stable compliance"),
     ("Chaas (100ml)",                 25, 2, 3, 1,"Within fluid"),
     ("Phulka + Bottle Gourd",         380,10,52,12,"Safest renal vegetable")],
    [("Semolina Idli (3) + Thin Sambar",340, 8,50, 8,"Routine settled"),
     ("White Rice + Moong Dal",        480,14,70,10,"Best low-P dal"),
     ("Apple (peeled, small)",          70, 0,18, 0,"Classic low-K fruit"),
     ("Phulka + Snake Gourd Sabzi",    380,10,52,12,"K-safe")],
    [("Poha + Semolina Mix",           330, 6,48,10,"Energy without K"),
     ("White Rice + Cabbage Curry",    430,10,64, 8,"Calcium from cabbage"),
     ("Sago Papad (1) + Water",         60, 2, 8, 2,"Dialysis snack"),
     ("Phulka + Lauki Masala",         380,10,52,12,"Bottle gourd finish")],
    [("Semolina Dosa + Coconut",       330, 8,48,10,"Low-K classic"),
     ("White Rice + Toor Dal + Ghee",  480,14,70,12,"Traditional close"),
     ("Rice Puffs (cup)",               60, 1,14, 0,"Low P"),
     ("Phulka + Cabbage Poriyal",      400,10,54,14,"South Indian style")],
    [("Bread + Low-Na Paneer",         300,14,30,10,"Low-Na protein"),
     ("White Rice + Ash Gourd Dal",    450,12,68, 8,"Safe combo"),
     ("Pear (peeled)",                  60, 0,14, 0,"Safe fruit"),
     ("Phulka + Parwal Sabzi",         390,10,54,12,"Low-K dinner")],
    [("Semolina Upma (plain)",         330, 6,48,10,"Minimal flavours"),
     ("White Rice + Lauki Dal",        460,14,68, 8,"Renal favourite"),
     ("Cream Cracker (2)",              80, 2,14, 2,"Low P snack"),
     ("Phulka + Tinda Sabzi",          380,10,52,12,"Safe veg cycle")],
    [("Semolina Idli + Coconut Chutney",330, 8,50, 8,"Simple mild"),
     ("White Rice + Moong Dal",        480,14,70,10,"Closing loop"),
     ("Rice Cake (1)",                  60, 1,14, 0,"Low minerals"),
     ("Phulka + Ridge Gourd",          390,10,52,12,"Renal-safe close")],
    [("Poha (no potato)",              320, 6,50,10,"Day 29 – almost done!"),
     ("White Rice + Tinda Curry",      440,10,66,10,"Stick to plan"),
     ("Apple (small, peeled)",          70, 0,18, 0,"Reward fruit"),
     ("Phulka + Bottle Gourd Curry",   380,10,52,12,"Finishing strong")],
    [("Semolina Upma",                 330, 6,48,10,"Day 30! 🎉"),
     ("White Rice + Palak Dal (low-K leached)",450,14,68, 8,"Leached palak safe"),
     ("Chaas (100ml)",                 25, 2, 3, 1,"Well done Meena!"),
     ("Phulka + Ash Gourd Sabzi",     380,10,52,12,"Perfect renal dinner")],
]

# ── P003 / Post-GI Surgery / Low-fibre soft→solid / 1200 kcal ────────────────
_P003_DAYS: List[tuple] = [
    # Weeks 1-2: soft diet with gradual addition of variety
    [("Clear Broth + ORS",              90, 2,12, 0,"NPO transition day 1"),
     ("Soft Moong Dal Soup",           150, 7,18, 1,"Thin, no lumps"),
     ("Glucose Water (200ml)",          80, 0,20, 0,"Energy sip"),
     ("Rice Kanji",                     90, 2,18, 0,"Easy digest cereal")],
    [("Strained Dal Water",             70, 3,10, 0,"Clear liquid"),
     ("Soft Idli (2) + Thin Sambar",   220, 8,34, 4,"Smooth texture"),
     ("Coconut Water",                  40, 0, 9, 0,"Electrolyte"),
     ("Mashed Potato + Light Salt",    150, 3,32, 1,"Bland no spices")],
    [("Semolina Porridge + Milk",      200, 6,34, 4,"Smooth no lumps"),
     ("Soft Rice + Moong Dal",         280,10,42, 4,"Minimal fibre"),
     ("Banana (ripe, mashed)",          90, 1,22, 0,"Easy digest"),
     ("Rice Kanji + ORS sips",         120, 2,24, 0,"Gentle evening")],
    [("Soft Idli (2) + Plain Sambar",  240, 8,36, 4,"Increasing texture"),
     ("Khichdi (soft) + Ghee",         300,10,46, 6,"One-pot healing"),
     ("Curd (50g plain)",               30, 2, 2, 2,"Probiotic gut"),
     ("Mashed Dal + Soft Roti (1)",    200, 8,28, 4,"Day 4 tolerance")],
    [("Semolina Upma (soft)",          220, 6,34, 6,"No crunchy bits"),
     ("Soft Rice + Dal Fry",           320,12,46, 6,"Graduated texture"),
     ("Banana",                         90, 1,22, 0,"Gut-friendly"),
     ("Bread (white, 2sl) + Dal",      240, 8,36, 6,"Tolerated well")],
    [("Oat Porridge + Honey",          240, 8,38, 4,"Fibre-careful"),
     ("Idli (2) + Coconut Chutney",    280, 8,42, 8,"Soft classic"),
     ("Ripe Papaya (½ cup)",            40, 0, 9, 0,"Papain digest"),
     ("Khichdi + Curd",               300,10,46, 6,"Gut settled")],
    [("Rava Dosa (soft, 1) + Chutney", 260, 8,38, 8,"Soft Indian"),
     ("White Rice + Dal",              320,10,48, 6,"Good appetite day"),
     ("Coconut Water",                  40, 0, 9, 0,"Hydration"),
     ("Soft Chapati (1) + Lauki Sabzi",280,10,38, 8,"Low fibre veg")],
    [("Semolina Idli (2) + Thin Sambar",240, 8,34, 4,"Week 2: firming up"),
     ("Rice + Moong Dal + Ghee",       320,10,48, 6,"Classic comfort"),
     ("Ripe Banana",                    90, 1,22, 0,"Soft fruit"),
     ("Soft Roti (1) + Lauki Dal",     280,10,38, 6,"Gradual fibre")],
    [("Oat Porridge + Milk",           240, 8,36, 4,"Gut-friendly"),
     ("Idli (2) + Sambar",             280, 8,42, 4,"Clinical staple"),
     ("Apple (peeled, cooked)",         60, 0,14, 0,"Cooked → easy"),
     ("Khichdi + Curd",               300,10,46, 6,"Best healing meal")],
    [("Semolina Upma",                 220, 6,34, 6,"Low-residue"),
     ("Rice + Palak Dal (sieved)",     300,10,44, 6,"Sieved for fibre"),
     ("Plain Curd (100g)",              60, 4, 4, 4,"Probiotic"),
     ("Soft Chapati (1) + Bottle Gourd",260, 8,36, 6,"Reintroduce mild veg")],
    [("White Bread Toast + Egg (boiled)",240,12,26, 8,"Protein up"),
     ("Rice + Moong Dal Khichdi",      320,10,48, 6,"Post-op staple"),
     ("Banana",                         90, 1,22, 0,"Soft fruit"),
     ("Dalia (broken wheat) + Curd",   280,10,40, 6,"Week 2 close")],
    # Week 3: transitioning to regular soft
    [("Semolina Upma + Curry Leaf",    240, 6,36, 6,"Anti-inflam herbs"),
     ("Idli (2) + Sambar + Chutney",   300, 8,44, 8,"Normal soft day"),
     ("Papaya (½ cup)",                 40, 0, 9, 0,"Enzyme"),
     ("Khichdi + Ghee",               320,10,46, 8,"Day 12 solid!")],
    [("Soft Dosa (1) + Coconut",       280, 8,40, 8,"Increasing texture"),
     ("White Rice + Egg Curry (soft)", 360,16,46, 8,"Protein boost"),
     ("Plain Curd (100g)",              60, 4, 4, 4,"Probiotics"),
     ("Soft Chapati (2) + Dal",        300,10,42, 8,"Reaching targets")],
    [("Oat Khichdi + Milk",            260, 8,38, 6,"Fibre step up"),
     ("Rice + Dal + Sabzi (cooked)",   340,12,50, 8,"Real meal!"),
     ("Ripe Banana",                    90, 1,22, 0,"Daily soft fruit"),
     ("Soft Roti (2) + Dal",           320,12,44, 8,"Building compliance")],
    [("Semolina Idli (2) + Sambar",    260, 8,36, 6,"Week 3 midpoint"),
     ("Khichdi + Egg Bhurji",          380,18,46, 8,"High protein day"),
     ("Curd + Honey (100g)",            80, 4, 8, 4,"Sweet probiotic"),
     ("Soft Chapati + Vegetable Dal",  320,12,44, 8,"Good appetite!")],
    [("Bread (2sl) + Boiled Egg",      280,14,28, 8,"Soft protein"),
     ("Rice + Fish Curry (boneless soft)",380,20,46,10,"Omega-3 recovery"),
     ("Coconut Water",                  40, 0, 9, 0,"Hydrate"),
     ("Dalia + Curd",                  280,10,40, 6,"Fibre approach")],
    [("Oat Porridge + Banana",         280, 8,44, 4,"Energy start"),
     ("Idli (3) + Sambar",             340,10,50, 6,"3 idlis = progress!"),
     ("Apple (peeled cooked)",          60, 0,14, 0,"Soft fruit"),
     ("Khichdi + Dal Tadka",           340,14,48,10,"Full healing plate")],
    [("Semolina Upma (coarser)",       260, 6,38, 8,"Texture building"),
     ("Rice + Palak Dal",              320,14,46, 8,"Iron reintroduced"),
     ("Banana",                         90, 1,22, 0,"Stable"),
     ("Roti (2) + Lauki Sabzi",        320,12,44, 8,"Mild fibre veg")],
    [("Soft Dosa + Sambar",            300, 8,44, 8,"Full dosa success"),
     ("Chicken Soup + Soft Rice",      380,22,44, 8,"High protein"),
     ("Plain Curd (100g)",              60, 4, 4, 4,"Gut flora"),
     ("Roti (2) + Dal + Sabzi",        340,14,48, 8,"Day 19 milestone")],
    [("Semolina Idli (3) + Sambar",    320,10,46, 8,"3 idlis achieved"),
     ("Rice + Egg Curry + Dal",        400,20,50,10,"Full balanced plate"),
     ("Papaya",                         40, 0, 9, 0,"Enzyme aid"),
     ("Soft Roti (2) + Chicken Curry", 420,22,44,14,"Day 20 — 2/3 done!")],
    # Week 4: solidifying recovery
    [("Oat Upma + Egg",               300,14,38, 8,"Good protein start"),
     ("Rice + Mixed Dal + Sabzi",      380,16,52, 8,"Full plate returning"),
     ("Ripe Banana",                    90, 1,22, 0,"Trusted fruit"),
     ("Roti (2) + Dal Fry",            340,14,46,10,"Nearly back to normal")],
    [("Semolina Dosa (2) + Chutney",   340, 8,50,12,"Appetite strong"),
     ("Rice + Dal + Cucumber Sabzi",   360,14,52, 8,"Introduce raw-ish"),
     ("Apple (peeled, raw small)",      70, 0,16, 0,"First raw fruit!"),
     ("Chapati (2) + Mixed Veg Dal",   360,14,50,10,"Week 4 strength")],
    [("Poha + Lime",                  280, 8,40,10,"Tolerated iron"),
     ("Khichdi + Curd + Pickle (tiny)",380,14,52,10,"Full meal"),
     ("Curd (100g)",                    60, 4, 4, 4,"Probiotics"),
     ("Roti (2) + Palak Dal",          340,14,46, 8,"Iron-building")],
    [("Bread + Omelet (2 egg)",        400,18,30,16,"Higher protein day"),
     ("Rice + Chicken Curry (soft)",   420,24,46,12,"Protein peak"),
     ("Banana",                         90, 1,22, 0,"Comfort fruit"),
     ("Roti (2) + Lauki Masala",       320,12,44, 8,"Low-residue safe")],
    [("Semolina Idli (3) + Sambar",    320,10,46, 8,"Gut-routine settled"),
     ("Rice + Dal + Mixed Sabzi",      380,16,52, 8,"Full plate balanced"),
     ("Papaya (½ cup)",                 40, 0, 9, 0,"Digestive"),
     ("Soft Chapati (2) + Egg Curry",  400,20,46,12,"Day 25 strong!")],
    [("Dalia Porridge + Honey",        240, 8,38, 4,"Comforting fibre"),
     ("Idli (3) + Coconut Sambar",     340,10,50, 8,"Classic"),
     ("Apple (¼ peeled)",               35, 0, 8, 0,"Light snack"),
     ("Roti (2) + Dal + Sabzi",        360,14,50,10,"Balanced dinner")],
    [("Oat Khichdi + Milk",            280, 8,42, 6,"Fibre foundation"),
     ("Rice + Fish + Dal",             400,22,48,10,"Sea protein"),
     ("Coconut Water",                  40, 0, 9, 0,"Hydrate"),
     ("Chapati (2) + Palak Dal",       340,14,46, 8,"Iron focus")],
    [("Semolina Upma + Egg",           300,14,36, 8,"High protein"),
     ("Khichdi + Paneer Bhurji",       400,18,48,12,"Paneer re-entry!"),
     ("Banana",                         90, 1,22, 0,"Trusted"),
     ("Roti (2) + Mixed Dal",          360,14,50,10,"Day 28 — final week")],
    [("Soft Dosa (2) + Chutney",       340, 8,50,12,"Eating normally!"),
     ("Rice + Dal + Full Sabzi",       380,16,52, 8,"Day 29 full plate"),
     ("Curd (100g)",                    60, 4, 4, 4,"Gut health maintained"),
     ("Chapati (2) + Chicken Dal",     400,22,46,12,"Protein close")],
    [("Oat Porridge + Banana",         280, 8,44, 4,"Day 30 celebration!"),
     ("Idli (3) + Sambar + Chutney",   340,10,50, 8,"Full South Indian"),
     ("Fresh Fruit Plate (small)",      80, 1,18, 0,"You made it! 🎉"),
     ("Chapati (2) + Dal Palak",       340,14,46, 8,"30-day recovery complete")],
]

_PATIENT_PLANS = {"P001": _P001_DAYS, "P002": _P002_DAYS, "P003": _P003_DAYS}


# ── Style factory ─────────────────────────────────────────────────────────────
def _S(name_suffix: str, **kw) -> "ParagraphStyle":
    return ParagraphStyle(f"dp_{name_suffix}", **kw)


def _dark_canvas(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(DARK_BG)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.restoreState()


# ── Weekly calorie mini-bar drawing ──────────────────────────────────────────
def _week_bar(week_cals: List[float], target: int, width=460, height=100) -> "Drawing":
    d = Drawing(width, height)
    if not week_cals:
        return d
    n = len(week_cals)
    bar_w = min(50, (width - 60) / n - 4)
    x0 = 50; bm = 18; tm = 14; ch = height - bm - tm
    max_c = max(max(week_cals), target, 1)
    ty = bm + (target / max_c) * ch
    d.add(Line(x0, ty, width - 10, ty, strokeColor=AMBER, strokeWidth=1, strokeDashArray=[4, 3]))
    d.add(String(x0 - 2, ty + 2, str(target), fontSize=7, fillColor=AMBER, textAnchor="end"))
    for i, cal in enumerate(week_cals):
        bh = max(2, (cal / max_c) * ch)
        x = x0 + i * ((width - 60) / n) + 2
        col = GREEN if (cal / target * 100 >= 90) else (AMBER if (cal / target * 100 >= 70) else RED)
        d.add(Rect(x, bm, bar_w, bh, fillColor=col, strokeColor=None))
        d.add(String(x + bar_w / 2, bm + bh + 3, str(int(cal)), fontSize=6, fillColor=TEXT_DIM, textAnchor="middle"))
        d.add(String(x + bar_w / 2, 5, f"D{i+1}", fontSize=6, fillColor=TEXT_DIM, textAnchor="middle"))
    return d


# ══════════════════════════════════════════════════════════════════════════════
# MAIN BUILDER
# ══════════════════════════════════════════════════════════════════════════════

async def build_30day_diet_plan_pdf(
    patient: Dict,
    start_date: Optional[str] = None,
) -> bytes:
    """
    Build a 30-day home diet plan PDF for a patient.
    Returns raw PDF bytes.
    patient: dict from patients.json  (must have at least id, name, diagnosis, etc.)
    start_date: ISO date string — defaults to today.
    """
    if not REPORTLAB_AVAILABLE:
        raise ImportError("reportlab not installed. Run: pip install reportlab")

    patient_id   = patient.get("id", "UNKNOWN")
    patient_name = patient.get("name", "Patient")
    diagnosis    = patient.get("diagnosis", "—")
    diet_stage   = patient.get("diet_stage", "solid").upper()
    cal_target   = patient.get("calorie_target", 1800)
    protein_tgt  = patient.get("protein_target_g", 80)
    carb_tgt     = patient.get("carb_target_g", 225)
    restrictions = patient.get("restrictions", [])
    medications  = patient.get("medications", [])
    allergies    = patient.get("allergies", [])
    dietitian    = patient.get("attending_dietitian", "Dr. Priya Nair")
    lang         = patient.get("language_name", "English")
    _start       = start_date or str(date.today())
    _end         = str(date.fromisoformat(_start) + timedelta(days=29))

    # Lookup 30-day plan — fall back to P001 generic if patient has no hardcoded plan
    days_data = _PATIENT_PLANS.get(patient_id, _P001_DAYS)

    # ── Styles ────────────────────────────────────────────────────
    sTitle    = _S("title",   fontSize=20, textColor=TEAL,      leading=24, fontName="Helvetica-Bold")
    sSub      = _S("sub",     fontSize=10, textColor=TEXT_DIM,  leading=14, fontName="Helvetica")
    sH2       = _S("h2",      fontSize=13, textColor=TEXT_MAIN, leading=17, fontName="Helvetica-Bold", spaceAfter=4)
    sH3       = _S("h3",      fontSize=10, textColor=TEAL,      leading=14, fontName="Helvetica-Bold")
    sBody     = _S("body",    fontSize=9,  textColor=TEXT_DIM,  leading=13, fontName="Helvetica")
    sMono     = _S("mono",    fontSize=8,  textColor=TEXT_DIM,  leading=11, fontName="Courier")
    sCaption  = _S("caption", fontSize=7,  textColor=TEXT_DIM,  leading=10, fontName="Helvetica", alignment=TA_CENTER)
    sRight    = _S("right",   fontSize=8,  textColor=TEXT_DIM,  leading=11, fontName="Helvetica", alignment=TA_RIGHT)
    sCenter   = _S("center",  fontSize=9,  textColor=TEXT_MAIN, leading=13, fontName="Helvetica", alignment=TA_CENTER)
    sGreen    = _S("green",   fontSize=9,  textColor=GREEN,     leading=13, fontName="Helvetica-Bold")

    def lbl(t): return Paragraph(t, _S("lbl", fontSize=8, textColor=TEXT_DIM, fontName="Helvetica-Bold"))
    def val(t): return Paragraph(str(t), _S("val", fontSize=9, textColor=TEXT_MAIN, fontName="Helvetica"))

    buf   = io.BytesIO()
    story = []

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=18*mm, leftMargin=18*mm,
        topMargin=14*mm, bottomMargin=20*mm,
    )

    # ══════════════════════════════════════════════════════════════
    # COVER PAGE
    # ══════════════════════════════════════════════════════════════
    story.append(Spacer(1, 20*mm))

    cover_data = [[
        Paragraph("🏥 NutriGuide Clinical Nutrition", sTitle),
        Paragraph(f"G. Kathir Memorial Hospital<br/>Generated: {date.today()}", sRight),
    ]]
    cover_tbl = Table(cover_data, colWidths=["65%", "35%"])
    cover_tbl.setStyle(TableStyle([
        ("BACKGROUND",   (0,0),(-1,-1), CARD_BG),
        ("TOPPADDING",   (0,0),(-1,-1), 12),
        ("BOTTOMPADDING",(0,0),(-1,-1), 12),
        ("LEFTPADDING",  (0,0),(-1,-1), 14),
        ("RIGHTPADDING", (0,0),(-1,-1), 14),
        ("VALIGN",       (0,0),(-1,-1), "MIDDLE"),
    ]))
    story.append(cover_tbl)
    story.append(Spacer(1, 8))

    story.append(Paragraph("30-DAY PERSONALISED HOME DIET PLAN", _S("banner",
        fontSize=15, textColor=WHITE, leading=20, fontName="Helvetica-Bold",
        alignment=TA_CENTER, backColor=TEAL, borderPad=10)))
    story.append(Spacer(1, 10))

    # Patient card
    story.append(Paragraph("PATIENT PROFILE", sH3))
    story.append(Spacer(1, 4))
    pid_data = [
        [lbl("Patient Name"), val(patient_name), lbl("Patient ID"), val(patient_id)],
        [lbl("Diagnosis"),    val(diagnosis),     lbl("Diet Stage"), val(diet_stage)],
        [lbl("Calorie Target"), val(f"{cal_target} kcal/day"), lbl("Protein Target"), val(f"{protein_tgt} g/day")],
        [lbl("Carb Target"),  val(f"{carb_tgt} g/day"), lbl("Language"), val(lang)],
        [lbl("Dietitian"),    val(dietitian), lbl("Plan Period"), val(f"{_start} → {_end}")],
        [lbl("Allergies"),    val(", ".join(allergies) if allergies else "None"), lbl("Restrictions"), val(len(restrictions))],
    ]
    pid_tbl = Table(pid_data, colWidths=["22%","28%","22%","28%"])
    pid_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), CARD_BG),
        ("GRID",          (0,0),(-1,-1), 0.3, BORDER),
        ("TOPPADDING",    (0,0),(-1,-1), 5),
        ("BOTTOMPADDING", (0,0),(-1,-1), 5),
        ("LEFTPADDING",   (0,0),(-1,-1), 8),
        ("RIGHTPADDING",  (0,0),(-1,-1), 8),
        ("ROWBACKGROUNDS",(0,0),(-1,-1), [CARD_BG, DARK_BG]),
    ]))
    story.append(pid_tbl)
    story.append(Spacer(1, 14))

    # Restrictions block
    if restrictions:
        story.append(Paragraph("ACTIVE DIETARY RESTRICTIONS", sH3))
        story.append(Spacer(1, 4))
        rest_text = "   •   ".join(r.replace("_"," ").title() for r in restrictions)
        story.append(Paragraph(rest_text, sBody))
        story.append(Spacer(1, 10))

    # Medications
    if medications:
        story.append(Paragraph("MEDICATIONS  (food-drug interaction awareness)", sH3))
        story.append(Spacer(1, 4))
        mth = _S("mth", fontSize=8, fontName="Helvetica-Bold", textColor=TEAL)
        m_data = [[Paragraph("Medication", mth), Paragraph("Dose", mth),
                   Paragraph("Class", mth), Paragraph("Frequency", mth)]]
        for m in medications:
            m_data.append([Paragraph(m.get("name","—"), sBody), Paragraph(m.get("dose","—"), sBody),
                           Paragraph(m.get("class","—"), sBody), Paragraph(m.get("frequency","—"), sBody)])
        m_tbl = Table(m_data, colWidths=["30%","15%","35%","20%"])
        m_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,0), DARK_BG),
            ("ROWBACKGROUNDS",(0,1),(-1,-1), [CARD_BG, DARK_BG]),
            ("GRID",          (0,0),(-1,-1), 0.3, BORDER),
            ("TOPPADDING",    (0,0),(-1,-1), 4),
            ("BOTTOMPADDING", (0,0),(-1,-1), 4),
            ("LEFTPADDING",   (0,0),(-1,-1), 6),
        ]))
        story.append(m_tbl)
        story.append(Spacer(1, 10))

    # General tips
    story.append(Paragraph("GENERAL GUIDELINES", sH3))
    story.append(Spacer(1, 4))
    tips = _get_tips(patient)
    for tip in tips:
        story.append(Paragraph(f"• {tip}", sBody))
    story.append(Spacer(1, 6))

    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "⬡ This plan is digitally signed with CRYSTALS-Dilithium3 (NIST FIPS 204) PQC.",
        sMono))
    story.append(Paragraph(
        f"Issued by NutriGuide  |  {date.today()}  |  For: {patient_name}",
        sMono))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    # WEEK-BY-WEEK PAGES
    # ══════════════════════════════════════════════════════════════
    th_s = _S("th", fontSize=8, textColor=TEAL, fontName="Helvetica-Bold", alignment=TA_CENTER)
    td_s = _S("td", fontSize=8, textColor=TEXT_MAIN, fontName="Helvetica", alignment=TA_LEFT)
    td_c = _S("tdc",fontSize=8, textColor=TEXT_DIM,  fontName="Helvetica", alignment=TA_CENTER)
    td_n = _S("tdn",fontSize=7, textColor=TEXT_DIM,  fontName="Helvetica", alignment=TA_LEFT)

    for week_num in range(1, 5):
        d_start = (week_num - 1) * 7   # 0-indexed into days_data
        d_end   = min(d_start + 7, 30)

        week_cals = []
        story.append(Paragraph(f"WEEK {week_num}  — Days {d_start+1}–{d_end}", sH2))
        story.append(Spacer(1, 6))

        # Table header
        plan_hdr = [[
            Paragraph("Day", th_s),
            Paragraph("Date", th_s),
            Paragraph("Breakfast", th_s),
            Paragraph("Lunch", th_s),
            Paragraph("Snack", th_s),
            Paragraph("Dinner", th_s),
            Paragraph("kcal", th_s),
        ]]
        plan_rows = list(plan_hdr)

        for di in range(d_start, d_end):
            day_meals = days_data[di] if di < len(days_data) else days_data[di % len(days_data)]
            bf, lu, sn, dn = day_meals[0], day_meals[1], day_meals[2], day_meals[3]
            total_cal = bf[1] + lu[1] + sn[1] + dn[1]
            week_cals.append(total_cal)
            row_date = date.fromisoformat(_start) + timedelta(days=di)
            vs_pct = round(total_cal / cal_target * 100)
            c_hex = "#2ECC71" if vs_pct >= 90 else ("#F0A500" if vs_pct >= 70 else "#FF4C6A")

            def _dish_cell(meal_tuple):
                name, kcal, prot, carb, fat, note = meal_tuple
                return Paragraph(
                    f"<b>{name}</b><br/><font size=6 color='#8B949E'>{kcal}kcal • P{prot}g{(' • '+note) if note else ''}</font>",
                    td_s)

            plan_rows.append([
                Paragraph(f"D{di+1}", td_c),
                Paragraph(row_date.strftime("%d %b"), td_c),
                _dish_cell(bf),
                _dish_cell(lu),
                _dish_cell(sn),
                _dish_cell(dn),
                Paragraph(f"<font color='{c_hex}'><b>{total_cal}</b></font>", td_c),
            ])

        plan_tbl = Table(plan_rows, colWidths=["5%","7%","20%","22%","15%","22%","9%"])
        plan_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,0), DARK_BG),
            ("ROWBACKGROUNDS",(0,1),(-1,-1), [CARD_BG, DARK_BG]),
            ("GRID",          (0,0),(-1,-1), 0.3, BORDER),
            ("TOPPADDING",    (0,0),(-1,-1), 4),
            ("BOTTOMPADDING", (0,0),(-1,-1), 4),
            ("LEFTPADDING",   (0,0),(-1,-1), 4),
            ("RIGHTPADDING",  (0,0),(-1,-1), 4),
            ("VALIGN",        (0,0),(-1,-1), "TOP"),
        ]))
        story.append(plan_tbl)
        story.append(Spacer(1, 10))

        # Weekly bar chart
        story.append(Paragraph(f"WEEK {week_num}  DAILY CALORIE CHART", sH3))
        story.append(Spacer(1, 4))
        story.append(_week_bar(week_cals, cal_target, width=460, height=100))
        story.append(Spacer(1, 4))
        story.append(Paragraph(
            f"Avg: {int(sum(week_cals)/len(week_cals))} kcal/day  •  Target: {cal_target} kcal  •  "
            f"{'✅ On Target' if int(sum(week_cals)/len(week_cals)) >= int(cal_target*0.9) else '⚠️ Below Target'}",
            sCaption))
        story.append(Spacer(1, 10))

        # Weekly macro summary
        avg_prot = round(sum(
            sum(days_data[d][m][2] for m in range(4))
            for d in range(d_start, d_end)
            if d < len(days_data)
        ) / (d_end - d_start), 1)
        avg_carb = round(sum(
            sum(days_data[d][m][3] for m in range(4))
            for d in range(d_start, d_end)
            if d < len(days_data)
        ) / (d_end - d_start), 1)
        avg_fat = round(sum(
            sum(days_data[d][m][4] for m in range(4))
            for d in range(d_start, d_end)
            if d < len(days_data)
        ) / (d_end - d_start), 1)
        kpi_val  = _S("kv",  fontSize=16, leading=20, fontName="Helvetica-Bold", textColor=TEAL,     alignment=TA_CENTER)
        kpi_lbl  = _S("kl",  fontSize=8,  leading=11, fontName="Helvetica",      textColor=TEXT_DIM, alignment=TA_CENTER)
        kpi_v2   = _S("kv2", fontSize=16, leading=20, fontName="Helvetica-Bold", textColor=GREEN,    alignment=TA_CENTER)
        kpi_v3   = _S("kv3", fontSize=16, leading=20, fontName="Helvetica-Bold", textColor=AMBER,    alignment=TA_CENTER)
        kpi_v4   = _S("kv4", fontSize=16, leading=20, fontName="Helvetica-Bold", textColor=PURPLE,   alignment=TA_CENTER)

        kpi_tbl = Table(
            [[Paragraph(f"{int(sum(week_cals)/len(week_cals))}", kpi_val),
              Paragraph(f"{avg_prot}g", kpi_v2),
              Paragraph(f"{avg_carb}g", kpi_v3),
              Paragraph(f"{avg_fat}g", kpi_v4)],
             [Paragraph("Avg kcal/day", kpi_lbl), Paragraph("Avg Protein", kpi_lbl),
              Paragraph("Avg Carbs",  kpi_lbl),   Paragraph("Avg Fat",  kpi_lbl)]],
            colWidths=["25%"]*4, rowHeights=[36, 22],
        )
        kpi_tbl.setStyle(TableStyle([
            ("BACKGROUND",   (0,0),(-1,-1), CARD_BG),
            ("GRID",         (0,0),(-1,-1), 0.3, BORDER),
            ("ALIGN",        (0,0),(-1,-1), "CENTER"),
            ("VALIGN",       (0,0),(-1,0),  "MIDDLE"),
            ("TOPPADDING",   (0,0),(-1,-1), 6),
            ("BOTTOMPADDING",(0,0),(-1,-1), 6),
        ]))
        story.append(kpi_tbl)
        story.append(Spacer(1, 10))

        if week_num < 4:
            story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    # DAYS 29–30  (if plan has more than 28 days)
    # ══════════════════════════════════════════════════════════════
    if len(days_data) > 28:
        story.append(Spacer(1, 10))
        story.append(Paragraph("DAYS 29–30  — Final Stretch", sH2))
        story.append(Spacer(1, 6))
        final_hdr = [[Paragraph("Day", th_s), Paragraph("Date", th_s),
                      Paragraph("Breakfast", th_s), Paragraph("Lunch", th_s),
                      Paragraph("Snack", th_s), Paragraph("Dinner", th_s), Paragraph("kcal", th_s)]]
        final_rows = list(final_hdr)
        for di in range(28, 30):
            day_meals = days_data[di] if di < len(days_data) else days_data[di % len(days_data)]
            bf, lu, sn, dn = day_meals[0], day_meals[1], day_meals[2], day_meals[3]
            total_cal = bf[1] + lu[1] + sn[1] + dn[1]
            row_date = date.fromisoformat(_start) + timedelta(days=di)
            vs_pct = round(total_cal / cal_target * 100)
            c_hex = "#2ECC71" if vs_pct >= 90 else ("#F0A500" if vs_pct >= 70 else "#FF4C6A")
            def _d2(meal_tuple):
                name, kcal, prot, carb, fat, note = meal_tuple
                return Paragraph(
                    f"<b>{name}</b><br/><font size=6 color='#8B949E'>{kcal}kcal • P{prot}g</font>", td_s)
            final_rows.append([
                Paragraph(f"D{di+1}", td_c),
                Paragraph(row_date.strftime("%d %b"), td_c),
                _d2(bf), _d2(lu), _d2(sn), _d2(dn),
                Paragraph(f"<font color='{c_hex}'><b>{total_cal}</b></font>", td_c),
            ])
        final_tbl = Table(final_rows, colWidths=["5%","7%","20%","22%","15%","22%","9%"])
        final_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,0), DARK_BG),
            ("ROWBACKGROUNDS",(0,1),(-1,-1), [CARD_BG, DARK_BG]),
            ("GRID",          (0,0),(-1,-1), 0.3, BORDER),
            ("TOPPADDING",    (0,0),(-1,-1), 4),
            ("BOTTOMPADDING", (0,0),(-1,-1), 4),
            ("LEFTPADDING",   (0,0),(-1,-1), 4),
            ("RIGHTPADDING",  (0,0),(-1,-1), 4),
            ("VALIGN",        (0,0),(-1,-1), "TOP"),
        ]))
        story.append(final_tbl)
        story.append(Spacer(1, 10))

    # ══════════════════════════════════════════════════════════════
    # CLOSING FOOTER
    # ══════════════════════════════════════════════════════════════
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "⬡ NIST FIPS 204 CRYSTALS-Dilithium3 + HMAC-SHA3-256  |  Pr[Forge] ≤ 2⁻¹²⁸", sMono))
    story.append(Paragraph(
        f"NutriGuide  |  30-Day Plan for {patient_name} ({patient_id})  |  "
        f"Dietitian: {dietitian}  |  Generated: {date.today()}", sMono))

    doc.build(story, onFirstPage=_dark_canvas, onLaterPages=_dark_canvas)
    return buf.getvalue()


def _get_tips(patient: Dict) -> List[str]:
    """Return condition-specific dietary tips."""
    tips_common = [
        "Drink at least 8 glasses of water daily (unless fluid-restricted).",
        "Eat at regular intervals — do not skip meals.",
        "Chew food slowly; eat in a calm environment.",
        "Store all prepared meals within 2 hours of cooking.",
        "Contact your dietitian if you experience any unusual symptoms.",
    ]
    restrictions = patient.get("restrictions", [])
    extra = []
    if "low_gi" in restrictions or "no_sugar" in restrictions:
        extra += [
            "Choose millets (ragi, jowar, bajra) over white rice whenever possible.",
            "Avoid fruit juices — prefer whole fruits with fibre intact.",
            "Check blood glucose 2 hours after each meal target.",
        ]
    if "renal_diet" in restrictions or "low_potassium" in restrictions:
        extra += [
            "Leach high-potassium vegetables: soak 1hr → drain → boil → drain again.",
            "Avoid banana, orange, coconut water, potato, tomato paste in large amounts.",
            "Strict fluid allowance: measure every cup, including soup and curd.",
            "Phosphorus warning: avoid dark colas, processed cheese, packaged snacks.",
        ]
    if "low_fiber" in restrictions or "easy_digest" in restrictions:
        extra += [
            "Avoid raw vegetables, whole grains, and high-fibre legumes until cleared.",
            "Cook all vegetables until very soft; peel fruits before eating.",
            "Introduce new foods one at a time — monitor bowel tolerance.",
            "Do not take any NSAIDs or aspirin without doctor clearance.",
        ]
    return extra + tips_common
