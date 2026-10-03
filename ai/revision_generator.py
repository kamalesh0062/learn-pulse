"""
LearnPulse AI - AI Revision Material Generator
Generates personalized revision summaries, flashcards, key concepts, and practice questions
using Google Gemini API / OpenAI API, with a fallback local generator.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import re
from typing import Dict, Any, List, Optional
from config import GEMINI_API_KEY, OPENAI_API_KEY

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

KIT_SCHEMA_HINT = """{
  "summary": "two short paragraphs",
  "key_takeaways": ["...", "...", "..."],
  "flashcards": [{"question": "...", "answer": "..."}],
  "practice_questions": [
    {"question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct": "A", "explanation": "..."}
  ]
}"""

class AIRevisionGenerator:
    """Generates revision materials for topics identified as difficult for a student."""

    def __init__(self):
        self.gemini_key = os.getenv("GEMINI_API_KEY", GEMINI_API_KEY)
        self.openai_key = os.getenv("OPENAI_API_KEY", OPENAI_API_KEY)

    def generate_revision_kit(
        self,
        topic_title: str,
        course_title: str = "",
        topic_description: str = "",
        quizzes: Optional[List[Dict[str, Any]]] = None,
        weak_points: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Returns a revision kit dict. `source` says where it came from: "gemini", "openai",
        or "local" when no provider is configured or the provider call failed.
        `quizzes` are the topic's quiz questions (question, options, correct, explanation),
        used as grounding for the LLM and as the content of the local kit.
        """
        quizzes = quizzes or []
        prompt = self._build_prompt(topic_title, course_title, topic_description, quizzes, weak_points or [])

        for source, key, call in [
            ("gemini", self.gemini_key, self._call_gemini),
            ("openai", self.openai_key, self._call_openai),
        ]:
            if not key:
                continue
            try:
                kit = self._parse_llm_response(call(prompt))
                if kit:
                    return {"topic_title": topic_title, "course_title": course_title, "source": source, **kit}
                print(f"[WARNING] {source} returned a revision kit that could not be parsed; trying next provider.")
            except Exception as e:
                print(f"[WARNING] {source} revision kit generation failed: {e}")

        return self._generate_fallback_kit(topic_title, course_title, topic_description, quizzes)

    def _build_prompt(
        self, topic_title: str, course_title: str, topic_description: str,
        quizzes: List[Dict[str, Any]], weak_points: List[str]
    ) -> str:
        lines = [
            "You are a tutor preparing a revision kit for a university student.",
            f"Topic: {topic_title}",
        ]
        if course_title:
            lines.append(f"Course: {course_title}")
        if topic_description:
            lines.append(f"Topic description from the lecturer: {topic_description}")
        if weak_points:
            lines.append("What the analytics say about this student on this topic: " + "; ".join(weak_points))
        if quizzes:
            lines.append("Quiz questions the lecturer uses for this topic (write new questions, do not repeat these):")
            lines += [f"- {q['question']}" for q in quizzes[:8]]
        lines += [
            "",
            "Write a 2-paragraph summary, 3 key takeaways, 3 flashcards and 2 multiple-choice practice questions",
            "with exactly four options each. Respond with a single JSON object and nothing else, in this shape:",
            KIT_SCHEMA_HINT,
        ]
        return "\n".join(lines)

    def _call_gemini(self, prompt: str) -> str:
        import google.generativeai as genai
        genai.configure(api_key=self.gemini_key)
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        return response.text or ""

    def _call_openai(self, prompt: str) -> str:
        from openai import OpenAI
        client = OpenAI(api_key=self.openai_key)
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return response.choices[0].message.content or ""

    def _parse_llm_response(self, text: str) -> Optional[Dict[str, Any]]:
        """Validates the model's JSON and normalizes it; returns None if it is unusable."""
        if not text:
            return None
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
        if not isinstance(data, dict) or not str(data.get("summary", "")).strip():
            return None

        flashcards = []
        for card in data.get("flashcards") or []:
            if isinstance(card, dict) and card.get("question") and card.get("answer"):
                flashcards.append({
                    "id": len(flashcards) + 1,
                    "question": str(card["question"]),
                    "answer": str(card["answer"])
                })

        practice = []
        for item in data.get("practice_questions") or []:
            if not isinstance(item, dict) or not item.get("question"):
                continue
            options = [str(o) for o in (item.get("options") or [])]
            correct = str(item.get("correct", "")).strip().upper()[:1]
            if len(options) != 4 or correct not in ["A", "B", "C", "D"]:
                continue
            practice.append({
                "id": len(practice) + 1,
                "question": str(item["question"]),
                "options": options,
                "correct": correct,
                "explanation": str(item.get("explanation", ""))
            })

        return {
            "summary": str(data["summary"]).strip(),
            "key_takeaways": [str(t) for t in (data.get("key_takeaways") or []) if str(t).strip()],
            "flashcards": flashcards,
            "practice_questions": practice
        }

    def _generate_fallback_kit(
        self, topic_title: str, course_title: str, topic_description: str = "",
        quizzes: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Offline kit assembled only from what the lecturer entered for the topic
        (description, quiz questions and explanations). It contains no generated subject matter.
        """
        quizzes = quizzes or []
        in_course = f" in {course_title}" if course_title else ""

        if topic_description:
            summary = f"{topic_title}{in_course}: {topic_description}"
        else:
            summary = f"{topic_title}{in_course}. The lecturer has not added a description for this topic yet."
        if not quizzes:
            summary += " No quiz questions you have answered are available for this topic, so this kit has no flashcards or practice questions yet."

        explanations = [q["explanation"] for q in quizzes if q.get("explanation")]
        key_takeaways = explanations[:3] if explanations else (
            [topic_description] if topic_description else []
        )

        flashcards = []
        practice = []
        for q in quizzes:
            letter = q["correct"]
            answer_text = q["options"].get(letter, "")
            answer = answer_text + (f" - {q['explanation']}" if q.get("explanation") else "")
            flashcards.append({"id": len(flashcards) + 1, "question": q["question"], "answer": answer})
            practice.append({
                "id": len(practice) + 1,
                "question": q["question"],
                "options": [f"{k}) {q['options'][k]}" for k in ["A", "B", "C", "D"]],
                "correct": letter,
                "explanation": q.get("explanation") or ""
            })

        return {
            "topic_title": topic_title,
            "course_title": course_title,
            "source": "local",
            "summary": summary,
            "key_takeaways": key_takeaways,
            "flashcards": flashcards,
            "practice_questions": practice
        }
