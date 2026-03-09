"""
report_generator.py
══════════════════════════════════════════════════════════════════
CAP³S Weekly Nutrition PDF Report Generator
Stolen from: NeoPulse report_generator.py (patient wellness PDF)
Change: Clinical nutrition macros, compliance chart, PQC signature footer

Requires: pip install reportlab
══════════════════════════════════════════════════════════════════
"""

import io
import logging
from datetime import date, timedelta
from typing import Dict, Optional, Callable

logger = logging.getLogger(__name__)

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm, cm
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, KeepTogether
    )
    from reportlab.graphics.shapes import Drawing, Rect, String, Line
    from reportlab.graphics.charts.barcharts import VerticalBarChart
    from reportlab.graphics import renderPDF
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    logger.warning("reportlab not installed — PDF generation unavailable. pip install reportlab")


# ── Brand colours ─────────────────────────────────────────────────
TEAL       = colors.HexColor("#00C9B1")
DARK_BG    = colors.HexColor("#0D1117")
CARD_BG    = colors.HexColor("#161B22")
AMBER      = colors.HexColor("#F0A500")
RED        = colors.HexColor("#FF4C6A")
GREEN      = colors.HexColor("#2ECC71")
TEXT_MAIN  = colors.HexColor("#E6EDF3")
TEXT_DIM   = colors.HexColor("#8B949E")
BORDER     = colors.HexColor("#30363D")
WHITE      = colors.white
BLACK      = colors.black


def _compliance_colour(pct: float):
    if pct >= 80:
        return GREEN
    if pct >= 60:
        return AMBER
    return RED


def _mini_bar_chart(daily_data: list, calorie_target: int, width: float = 460, height: float = 110) -> Drawing:
    """
    Draw a minimal vertical bar chart of daily calorie plan vs target.
    daily_data: list of {"day": int, "calories": float}
    """
    d = Drawing(width, height)

    if not daily_data:
        d.add(String(width / 2, height / 2, "No meal plan data", textAnchor="middle",
                     fontSize=9, fillColor=TEXT_DIM))
        return d

    bar_count  = len(daily_data)
    bar_width  = min(40, (width - 60) / bar_count - 4)
    x_start    = 50
    chart_h    = height - 20
    max_cal    = max(max(r.get("calories", 0) for r in daily_data), calorie_target, 1)

    # Target line
    target_y = (calorie_target / max_cal) * chart_h
    d.add(Line(x_start, target_y, width - 10, target_y,
               strokeColor=AMBER, strokeWidth=1, strokeDashArray=[4, 3]))
    d.add(String(x_start - 2, target_y + 2, f"{calorie_target}", fontSize=7,
                 fillColor=AMBER, textAnchor="end"))

    # Bars
    for i, row in enumerate(daily_data):
        cal = row.get("calories", 0)
        bar_h = max(2, (cal / max_cal) * chart_h)
        x = x_start + i * ((width - 60) / bar_count) + 2
        col = _compliance_colour((cal / calorie_target * 100) if calorie_target else 0)
        d.add(Rect(x, 0, bar_width, bar_h, fillColor=col, strokeColor=None))
        d.add(String(x + bar_width / 2, bar_h + 2, str(int(cal)), fontSize=6,
                     fillColor=TEXT_DIM, textAnchor="middle"))
        d.add(String(x + bar_width / 2, -10, f"D{row['day']}", fontSize=6,
                     fillColor=TEXT_DIM, textAnchor="middle"))

    return d


async def build_weekly_nutrition_report(
    patient_id: str,
    patients_db: Dict,
    con,  # DuckDB connection
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    pqc_sign: Optional[Callable] = None,
) -> bytes:
    """
    Build a clinical PDF nutrition report.
    Returns raw PDF bytes for streaming to client.

    Raises ImportError if reportlab is not installed.
    """
    if not REPORTLAB_AVAILABLE:
        raise ImportError(
            "reportlab is not installed. Run: pip install reportlab"
        )

    p = patients_db.get(patient_id, {})
    if not p:
        raise ValueError(f"Patient {patient_id} not found")

    _end   = end_date   or str(date.today())
    _start = start_date or str(date.today() - timedelta(days=6))

    # ── Query DuckDB ───────────────────────────────────────────────
    try:
        stats = con.execute("""
            SELECT consumption_level, COUNT(*) FROM meal_logs
            WHERE patient_id=? AND log_date BETWEEN ? AND ?
            GROUP BY consumption_level
        """, [patient_id, _start, _end]).fetchall()
    except Exception:
        stats = []

    try:
        daily = con.execute("""
            SELECT day_number, SUM(calories), SUM(protein_g), SUM(sodium_mg), SUM(potassium_mg)
            FROM meal_plans WHERE patient_id=?
            GROUP BY day_number ORDER BY day_number
        """, [patient_id]).fetchall()
    except Exception:
        daily = []

    total     = sum(r[1] for r in stats)
    fully     = next((r[1] for r in stats if r[0] == "Ate fully"),  0)
    partially = next((r[1] for r in stats if r[0] == "Partially"),  0)
    refused   = next((r[1] for r in stats if r[0] == "Refused"),    0)
    compliance = round((fully / total * 100) if total > 0 else 0.0, 1)
    avg_cals  = round(sum(r[1] or 0 for r in daily) / max(len(daily), 1), 1)

    daily_data = [{"day": r[0], "calories": r[1] or 0, "protein_g": r[2] or 0} for r in daily]

    # PQC signature
    sig_str = ""
    if pqc_sign:
        try:
            sig_raw = pqc_sign(f"PDF|{patient_id}|{_start}|{_end}|{compliance}")
            sig_str = sig_raw[:48] + "..." if len(sig_raw) > 48 else sig_raw
        except Exception:
            sig_str = "SIG_UNAVAILABLE"

    # ── Build PDF ──────────────────────────────────────────────────
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=14 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()

    def S(name, **kw):
        """Quick ParagraphStyle factory."""
        return ParagraphStyle(name, **kw)

    sTitle    = S("sTitle",    fontSize=18, textColor=TEAL,      leading=22, fontName="Helvetica-Bold")
    sSubtitle = S("sSubtitle", fontSize=10, textColor=TEXT_DIM,  leading=14, fontName="Helvetica")
    sH2       = S("sH2",       fontSize=12, textColor=TEXT_MAIN, leading=16, fontName="Helvetica-Bold", spaceAfter=4)
    sH3       = S("sH3",       fontSize=10, textColor=TEAL,      leading=14, fontName="Helvetica-Bold")
    sBody     = S("sBody",     fontSize=9,  textColor=TEXT_DIM,  leading=13, fontName="Helvetica")
    sMono     = S("sMono",     fontSize=8,  textColor=TEXT_DIM,  leading=11, fontName="Courier", spaceAfter=2)
    sCaption  = S("sCaption",  fontSize=7,  textColor=TEXT_DIM,  leading=10, fontName="Helvetica", alignment=TA_CENTER)
    sRight    = S("sRight",    fontSize=8,  textColor=TEXT_DIM,  leading=11, fontName="Helvetica", alignment=TA_RIGHT)

    story = []

    # ── Header bar ────────────────────────────────────────────────
    header_data = [[
        Paragraph("🏥 CAP³S Clinical Nutrition Care Agent", sTitle),
        Paragraph(f"G. Kathir Memorial Hospital<br/>Report Date: {date.today()}", sRight),
    ]]
    header_tbl = Table(header_data, colWidths=["65%", "35%"])
    header_tbl.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), CARD_BG),
        ("TOPPADDING",   (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 10),
        ("LEFTPADDING",  (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(header_tbl)
    story.append(Spacer(1, 8))

    # ── Patient identity block ────────────────────────────────────
    story.append(Paragraph("PATIENT RECORD", sH3))
    story.append(Spacer(1, 3))

    patient_rows = [
        ["Patient Name", p.get("name", "—"),          "Patient ID",  patient_id],
        ["Diagnosis",    p.get("diagnosis", "—"),      "Ward / Bed",  f"{p.get('ward','—')} / {p.get('bed','—')}"],
        ["Diet Stage",   p.get("diet_stage", "—").upper(), "Language",    p.get("language_name", "—")],
        ["Calorie Target", f"{p.get('calorie_target', 0)} kcal/day", "Dietitian", p.get("attending_dietitian", "—")],
        ["Report Period", f"{_start}  →  {_end}", "Meals Logged", str(total)],
    ]

    def label_cell(txt):
        return Paragraph(txt, S("lc", fontSize=8, textColor=TEXT_DIM, fontName="Helvetica-Bold"))
    def value_cell(txt):
        return Paragraph(str(txt), S("vc", fontSize=9, textColor=TEXT_MAIN, fontName="Helvetica"))

    pid_data = [[label_cell(r[0]), value_cell(r[1]), label_cell(r[2]), value_cell(r[3])] for r in patient_rows]
    pid_tbl  = Table(pid_data, colWidths=["22%", "28%", "22%", "28%"])
    pid_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), CARD_BG),
        ("GRID",          (0, 0), (-1, -1), 0.3, BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS",(0, 0), (-1, -1), [CARD_BG, DARK_BG]),
    ]))
    story.append(pid_tbl)
    story.append(Spacer(1, 10))

    # ── Compliance KPI row ────────────────────────────────────────
    story.append(Paragraph("WEEKLY COMPLIANCE SUMMARY", sH3))
    story.append(Spacer(1, 4))

    comp_colour = _compliance_colour(compliance)
    kpi_data = [[
        Paragraph(f"<font color='#{TEAL.hexval()[2:]}'>{compliance}%</font>", S("kpi", fontSize=28, fontName="Helvetica-Bold", textColor=TEAL, alignment=TA_CENTER)),
        Paragraph(f"<font color='#2ECC71'>{fully}</font>", S("kpi2", fontSize=22, fontName="Helvetica-Bold", textColor=GREEN, alignment=TA_CENTER)),
        Paragraph(f"<font color='#F0A500'>{partially}</font>", S("kpi3", fontSize=22, fontName="Helvetica-Bold", textColor=AMBER, alignment=TA_CENTER)),
        Paragraph(f"<font color='#FF4C6A'>{refused}</font>", S("kpi4", fontSize=22, fontName="Helvetica-Bold", textColor=RED, alignment=TA_CENTER)),
        Paragraph(f"<font color='#8B949E'>{round(avg_cals)}</font>", S("kpi5", fontSize=22, fontName="Helvetica-Bold", textColor=TEXT_DIM, alignment=TA_CENTER)),
    ]]
    kpi_labels = [[
        Paragraph("Overall Compliance", sCaption),
        Paragraph("Ate Fully", sCaption),
        Paragraph("Partially Eaten", sCaption),
        Paragraph("Refused", sCaption),
        Paragraph("Avg Daily kcal", sCaption),
    ]]

    kpi_tbl = Table(kpi_data + kpi_labels, colWidths=["20%"] * 5)
    kpi_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), CARD_BG),
        ("GRID",          (0, 0), (-1, -1), 0.3, BORDER),
        ("TOPPADDING",    (0, 0), (-1, 0), 12),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
        ("TOPPADDING",    (0, 1), (-1, 1), 2),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
    ]))
    story.append(kpi_tbl)
    story.append(Spacer(1, 10))

    # ── Daily calorie chart ───────────────────────────────────────
    story.append(Paragraph("DAILY CALORIE PLAN vs TARGET", sH3))
    story.append(Spacer(1, 4))

    chart_drawing = _mini_bar_chart(daily_data, p.get("calorie_target", 1800), width=460, height=100)
    story.append(chart_drawing)
    story.append(Paragraph(f"⬛ Bars = planned calories per day    ─── Amber dashed = {p.get('calorie_target', 1800)} kcal target", sCaption))
    story.append(Spacer(1, 10))

    # ── Daily breakdown table ─────────────────────────────────────
    if daily_data:
        story.append(Paragraph("DAY-BY-DAY NUTRITIONAL BREAKDOWN", sH3))
        story.append(Spacer(1, 4))

        th_style = S("th", fontSize=8, textColor=TEAL, fontName="Helvetica-Bold", alignment=TA_CENTER)
        td_style = S("td", fontSize=8, textColor=TEXT_MAIN, fontName="Helvetica", alignment=TA_CENTER)
        tbl_data = [[
            Paragraph("Day", th_style),
            Paragraph("Planned kcal", th_style),
            Paragraph("vs Target", th_style),
            Paragraph("Protein (g)", th_style),
            Paragraph("Sodium (mg)", th_style),
        ]]
        for row in daily_data:
            cal = row.get("calories", 0)
            tgt = p.get("calorie_target", 1800)
            vs_pct = round((cal / tgt * 100) if tgt else 0, 1)
            colour_hex = "#2ECC71" if vs_pct >= 90 else ("#F0A500" if vs_pct >= 70 else "#FF4C6A")
            tbl_data.append([
                Paragraph(str(row["day"]), td_style),
                Paragraph(str(int(cal)), td_style),
                Paragraph(f"<font color='{colour_hex}'>{vs_pct}%</font>", S("td_c", fontSize=8, fontName="Helvetica", alignment=TA_CENTER)),
                Paragraph(str(round(row.get("protein_g", 0), 1)), td_style),
                Paragraph("—", td_style),
            ])
        tbl_data.append([
            Paragraph("AVG", th_style),
            Paragraph(str(int(avg_cals)), th_style),
            Paragraph(f"{round(avg_cals / p.get('calorie_target', 1800) * 100, 1)}%", th_style),
            Paragraph("—", th_style),
            Paragraph("—", th_style),
        ])

        daily_tbl = Table(tbl_data, colWidths=["10%", "22%", "18%", "22%", "28%"])
        daily_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), DARK_BG),
            ("BACKGROUND",    (0, -1), (-1, -1), DARK_BG),
            ("ROWBACKGROUNDS",(0, 1), (-1, -2), [CARD_BG, DARK_BG]),
            ("GRID",          (0, 0), (-1, -1), 0.3, BORDER),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(daily_tbl)
        story.append(Spacer(1, 10))

    # ── Restrictions block ────────────────────────────────────────
    restrictions = p.get("restrictions", [])
    if restrictions:
        story.append(Paragraph("ACTIVE DIETARY RESTRICTIONS", sH3))
        story.append(Spacer(1, 4))
        r_text = "   •   ".join(r.replace("_", " ").title() for r in restrictions)
        story.append(Paragraph(r_text, sBody))
        story.append(Spacer(1, 6))

    # ── Medications ───────────────────────────────────────────────
    medications = p.get("medications", [])
    if medications:
        story.append(Paragraph("CURRENT MEDICATIONS (for food-drug interaction awareness)", sH3))
        story.append(Spacer(1, 4))
        med_data = [[
            Paragraph("Medication", S("mth", fontSize=8, fontName="Helvetica-Bold", textColor=TEAL)),
            Paragraph("Dose", S("mth", fontSize=8, fontName="Helvetica-Bold", textColor=TEAL)),
            Paragraph("Class", S("mth", fontSize=8, fontName="Helvetica-Bold", textColor=TEAL)),
            Paragraph("Frequency", S("mth", fontSize=8, fontName="Helvetica-Bold", textColor=TEAL)),
        ]]
        for m in medications:
            med_data.append([
                Paragraph(m.get("name", "—"), sBody),
                Paragraph(m.get("dose", "—"), sBody),
                Paragraph(m.get("class", "—"), sBody),
                Paragraph(m.get("frequency", "—"), sBody),
            ])
        med_tbl = Table(med_data, colWidths=["30%", "15%", "35%", "20%"])
        med_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), DARK_BG),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [CARD_BG, DARK_BG]),
            ("GRID",          (0, 0), (-1, -1), 0.3, BORDER),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ]))
        story.append(med_tbl)
        story.append(Spacer(1, 10))

    # ── Clinical flags ────────────────────────────────────────────
    flags = []
    if avg_cals < p.get("calorie_target", 1800) * 0.85:
        flags.append(f"⚠️  Average calorie intake ({int(avg_cals)} kcal) is more than 15% below target — nutritional support review recommended")
    if compliance < 70:
        flags.append(f"⚠️  Overall meal compliance {compliance}% — below 70% threshold. Dietitian review within 24 hours.")
    if refused >= 4:
        flags.append(f"⚠️  {refused} meal refusals in reporting period — consider route change (NG/supplementation)")
    if flags:
        story.append(Paragraph("CLINICAL FLAGS", S("cflag", fontSize=10, fontName="Helvetica-Bold", textColor=RED)))
        story.append(Spacer(1, 4))
        for flag in flags:
            story.append(Paragraph(flag, S("fl", fontSize=9, textColor=AMBER, fontName="Helvetica", leading=14)))
        story.append(Spacer(1, 8))

    # ── PQC signature footer ──────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 4))
    footer_rows = [
        [
            Paragraph("⬡ NIST FIPS 204 CRYSTALS-Dilithium3 + HMAC-SHA3-256 + UOV-sim", sMono),
            Paragraph(f"Pr[Forge] ≤ 2⁻¹²⁸", sRight),
        ],
        [
            Paragraph(f"Signature: {sig_str}", sMono),
            Paragraph(f"Generated: {date.today()}  |  CAP³S v1.0", sRight),
        ],
    ]
    foot_tbl = Table(footer_rows, colWidths=["70%", "30%"])
    foot_tbl.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(foot_tbl)

    # ── Build ──────────────────────────────────────────────────────
    def _dark_canvas(canvas, doc):
        """Dark background page canvas."""
        canvas.saveState()
        canvas.setFillColor(DARK_BG)
        canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
        canvas.restoreState()

    doc.build(story, onFirstPage=_dark_canvas, onLaterPages=_dark_canvas)
    return buf.getvalue()
