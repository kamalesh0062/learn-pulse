from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.database.models import User
from backend.app.api.deps import get_current_user
from backend.app.services.learning import student_analytics
from fpdf import FPDF

router = APIRouter(prefix="/reports", tags=["Reports"])

class PDFReport(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 16)
        self.set_text_color(30, 41, 59)
        self.cell(0, 10, 'LearnPulse AI - Student Analytics & Learning Report', border=False, new_x='LMARGIN', new_y='NEXT', align='C')
        self.set_font('Helvetica', 'I', 10)
        self.set_text_color(100, 116, 139)
        self.cell(0, 5, 'Privacy-First Educational Insights & Difficulty Analysis', border=False, new_x='LMARGIN', new_y='NEXT', align='C')
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(148, 163, 184)
        self.cell(0, 10, f'Page {self.page_no()} | Confidential Student Report', align='C')

def _pdf_text(value) -> str:
    """Core PDF fonts are Latin-1 only; replace anything else instead of failing the export."""
    return str(value).encode("latin-1", "replace").decode("latin-1")

def _fmt(value, suffix: str = "") -> str:
    return "not recorded" if value is None else f"{value}{suffix}"

@router.get("/download")
def download_student_report(
    student_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    student = current_user
    if student_id and student_id != current_user.id:
        if current_user.role not in ["teacher", "admin"]:
            raise HTTPException(status_code=403, detail="You can only download your own report")
        student = db.query(User).filter(User.id == student_id, User.role == "student").first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
    elif current_user.role != "student":
        raise HTTPException(status_code=400, detail="Pass student_id to download a report for one of your students")

    data = student_analytics(db, student.id)

    pdf = PDFReport()
    pdf.add_page()
    pdf.set_text_color(15, 23, 42)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, _pdf_text(f"Student: {student.name} ({student.email})"), new_x='LMARGIN', new_y='NEXT')
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, _pdf_text(f"Enrollment ID: {student.enrollment_no or 'not assigned'}"), new_x='LMARGIN', new_y='NEXT')
    pdf.cell(0, 6, f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", new_x='LMARGIN', new_y='NEXT')
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 9, "Summary", new_x='LMARGIN', new_y='NEXT')
    pdf.set_font("Helvetica", "", 10)
    summary_rows = [
        ("Overall learning score", _fmt(data["overall_learning_score"], " / 100")),
        ("Quiz average", f"{_fmt(data['quiz_average'], '%')} ({data['quizzes_answered']} questions answered)"),
        ("Visual engagement", f"{_fmt(data['engagement_score'], '%')} ({data['engagement_samples']} camera samples)"),
        ("Course progress", f"{data['course_progress']}%"),
        ("Study streak", f"{data['study_streak_days']} day(s)"),
    ]
    for label, value in summary_rows:
        pdf.cell(60, 7, label)
        pdf.cell(0, 7, _pdf_text(value), new_x='LMARGIN', new_y='NEXT')
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 9, "Topic Difficulty Breakdown", new_x='LMARGIN', new_y='NEXT')

    topics = data["difficult_topics"]
    if not topics:
        pdf.set_font("Helvetica", "I", 10)
        pdf.cell(0, 8, "No topic activity has been recorded for this student yet.", new_x='LMARGIN', new_y='NEXT')
    else:
        columns = [("Topic", 74), ("Difficulty", 38), ("Quiz", 22), ("Engagement", 26), ("Replays", 15), ("Pauses", 15)]
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(226, 232, 240)
        for title, width in columns:
            pdf.cell(width, 7, title, border=1, fill=True)
        pdf.ln()
        pdf.set_font("Helvetica", "", 9)
        for t in topics:
            title = t["topic_title"] if len(t["topic_title"]) <= 44 else t["topic_title"][:41] + "..."
            row = [
                title,
                f"{t['difficulty_score']} ({t['difficulty_label']})",
                _fmt(t["quiz_score"], "%") if t["quiz_score"] is not None else "-",
                _fmt(t["engagement_score"], "%") if t["engagement_score"] is not None else "-",
                str(t["replay_count"]),
                str(t["pause_count"]),
            ]
            for (_, width), value in zip(columns, row):
                pdf.cell(width, 7, _pdf_text(value), border=1)
            pdf.ln()

    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 9, "Recommendation", new_x='LMARGIN', new_y='NEXT')
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6, _pdf_text(data["recommendation"]))

    pdf_output = bytes(pdf.output())
    return Response(content=pdf_output, media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=LearnPulse_Report_{student.id}.pdf"
    })
