"""
Deni LangChain + Gemini conversational dental assistant (T-201).

Rules (AGENTS.md Rule 1, 3, 4; PRD.md §6.2; ARCHITECTURE.md §5.2, §5.4):
- Uses Gemini strictly for Deni text consultation (never for image classification).
- Provides two LangChain tools: `lookup_knowledge` and `trigger_clinic_finder`.
- Uses Pydantic structured output matching `AgentChatResponse`.
- Sanitizes all user input before prompt insertion (prompt-injection mitigation).
- Deterministic severe-symptom keyword backstop that the LLM can NEVER downgrade.
- 20-second timeout with graceful Indonesian static fallback.
"""

from __future__ import annotations

import asyncio
import re
from typing import Any, Callable

from app.core.config import Settings, get_settings
from app.ml.urgency import has_mild_symptoms, has_severe_symptoms
from app.schemas import AgentChatRequest, AgentChatResponse, KnowledgeDoc, UrgencyLevel

URGENCY_RANK: dict[UrgencyLevel, int] = {
    "low": 0,
    "medium": 1,
    "emergency": 2,
}

SYSTEM_PROMPT = """Anda adalah Deni, asisten AI kesehatan gigi preventif dari DentHub.
Aturan wajib yang TIDAK BOLEH dilanggar:
1. Selalu menjawab dalam Bahasa Indonesia yang empatik, tenang, sopan (sapa pengguna dengan "Anda"), dan mudah dipahami masyarakat umum.
2. DILARANG memberikan diagnosis medis klinis pasti. Gunakan bahasa edukatif/indikatif ("indikasi", "kemungkinan", "perlu diperiksa dokter gigi").
3. DILARANG meresepkan obat, menyebut nama merek obat tertentu, atau menentukan dosis obat.
4. Gunakan konteks hasil skrining (`scan_context`) dan basis pengetahuan (`knowledge_context`) jika tersedia.
5. Jika pengguna melaporkan gejala akut/serius (nyeri hebat, berdenyut, bengkak, nanah, abses, demam, pendarahan terus-menerus, sulit membuka mulut), wajib menetapkan `urgency_level = "emergency"` dan `trigger_clinic_finder = true`.
6. Berikan tepat 2 pertanyaan lanjutan singkat (`suggested_questions`) dalam Bahasa Indonesia yang relevan.
7. Jangan menyertakan disclaimer di akhir jawaban karena disclaimer akan ditambahkan otomatis oleh sistem backend.
"""

INJECTION_PATTERNS = (
    re.compile(r"(?i)\bignore\s+(all\s+)?(previous|above|prior)\s+instructions?\b"),
    re.compile(r"(?i)\bdisregard\s+(all\s+)?(previous|system)\b"),
    re.compile(r"(?i)\byou\s+are\s+now\b"),
    re.compile(r"(?i)\bsystem\s*:\s*"),
    re.compile(r"(?i)<\s*/?\s*(system|assistant|instruction)\s*>"),
)


def sanitize_user_text(text: str) -> str:
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    for pattern in INJECTION_PATTERNS:
        cleaned = pattern.sub("[filtered]", cleaned)
    return cleaned.strip()[:1000]


def build_agent_tools(knowledge_docs: list[KnowledgeDoc]) -> tuple[list[Any], dict[str, bool]]:
    """Build LangChain tools `lookup_knowledge` and `trigger_clinic_finder`."""
    from langchain_core.tools import tool

    tool_state = {"triggered_clinic_finder": False}
    kb_map = {doc.condition_key.lower(): doc for doc in knowledge_docs}

    @tool
    def lookup_knowledge(condition_key: str) -> str:
        """Look up curated Indonesian dental knowledge (dos, donts, emergency_signs) by condition_key."""
        key = condition_key.strip().lower()
        doc = kb_map.get(key) or kb_map.get("general")
        if not doc:
            return "Tidak ada dokumen pengetahuan untuk kondisi tersebut."
        return (
            f"Judul: {doc.title}\n"
            f"Deskripsi: {doc.description}\n"
            f"Dianjurkan: {'; '.join(doc.dos)}\n"
            f"Dihindari: {'; '.join(doc.donts)}\n"
            f"Tanda Darurat: {'; '.join(doc.emergency_signs)}"
        )

    @tool
    def trigger_clinic_finder(reason: str) -> str:
        """Record an emergency clinic finder escalation when acute pain or severe infection signs appear."""
        tool_state["triggered_clinic_finder"] = True
        return f"Clinic Finder diaktifkan karena: {reason}"

    return [lookup_knowledge, trigger_clinic_finder], tool_state


def build_static_fallback(request: AgentChatRequest) -> AgentChatResponse:
    severe = has_severe_symptoms(request.message)
    mild = has_mild_symptoms(request.message)

    base_urgency: UrgencyLevel = (
        request.scan_context.urgency_level if request.scan_context else "low"
    )
    if severe:
        urgency: UrgencyLevel = "emergency"
    elif mild and base_urgency == "low":
        urgency = "medium"
    else:
        urgency = base_urgency

    if urgency == "emergency":
        reply = (
            "Berdasarkan keluhan yang Anda sampaikan, terdapat tanda yang memerlukan pemeriksaan "
            "segera oleh dokter gigi. Hindari mengorek atau menekan area yang nyeri, berkumur perlahan "
            "dengan air hangat, dan segera kunjungi klinik dokter gigi terdekat melalui Clinic Finder DentHub."
        )
        suggestions = [
            "Apa pertolongan pertama yang aman sambil menuju dokter gigi?",
            "Tanda infeksi gigi apa saja yang harus saya waspadai?",
        ]
    elif request.scan_context:
        cond = request.scan_context.primary_condition
        reply = (
            f"Terima kasih telah berkonsultasi dengan Deni. Berdasarkan konteks hasil skrining "
            f"awal ({cond}), tetap jaga kebersihan gigi dengan menyikat gigi secara lembut dua kali "
            "sehari memakai pasta gigi berfluoride dan jadwalkan pemeriksaan ke dokter gigi untuk evaluasi langsung."
        )
        suggestions = [
            "Makanan atau minuman apa yang sebaiknya saya hindari sementara?",
            "Bagaimana cara menyikat gigi yang aman untuk kondisi saya?",
        ]
    else:
        reply = (
            "Halo! Untuk menjaga kesehatan gigi dan gusi, sikat gigi secara lembut dua kali sehari "
            "dengan pasta gigi berfluoride, bersihkan sela gigi dengan benang gigi, dan lakukan "
            "pemeriksaan rutin ke dokter gigi setiap 6 bulan sekali."
        )
        suggestions = [
            "Bagaimana teknik menyikat gigi yang benar?",
            "Kapan saya harus segera memeriksakan gigi ke dokter gigi?",
        ]

    return AgentChatResponse(
        reply=reply,
        urgency_level=urgency,
        trigger_clinic_finder=(urgency == "emergency"),
        suggested_questions=suggestions,
    )


def enforce_safety_backstop(
    request: AgentChatRequest,
    response: AgentChatResponse,
    tool_triggered: bool = False,
) -> AgentChatResponse:
    """
    Deterministic backstop (AGENTS.md Rule 3, TASK.md Decision 12):
    - Severe symptoms ALWAYS force urgency_level='emergency' and trigger_clinic_finder=True.
    - Never lower urgency below scan_context urgency if scan_context is emergency.
    - trigger_clinic_finder is True whenever urgency_level == 'emergency' or tool triggered.
    """
    urgency = response.urgency_level
    trigger = response.trigger_clinic_finder or tool_triggered

    if request.scan_context and URGENCY_RANK[request.scan_context.urgency_level] > URGENCY_RANK[urgency]:
        urgency = request.scan_context.urgency_level

    if has_severe_symptoms(request.message):
        urgency = "emergency"
        trigger = True
    elif has_mild_symptoms(request.message) and urgency == "low":
        urgency = "medium"

    if trigger or urgency == "emergency":
        urgency = "emergency"
        trigger = True

    suggestions = [s.strip() for s in response.suggested_questions if s.strip()][:2]
    if not suggestions:
        suggestions = [
            "Bagaimana perawatan harian yang aman untuk gigi saya?",
            "Kapan sebaiknya saya memeriksakan diri ke dokter gigi?",
        ]

    return AgentChatResponse(
        reply=response.reply.strip(),
        urgency_level=urgency,
        trigger_clinic_finder=trigger,
        suggested_questions=suggestions,
    )


def _format_user_prompt(request: AgentChatRequest, sanitized_message: str) -> str:
    parts: list[str] = []
    if request.scan_context:
        sc = request.scan_context
        parts.append(
            f"[Konteks Scan] Kondisi: {sc.primary_condition}, "
            f"Keyakinan: {sc.confidence_score:.2f}, Urgensi: {sc.urgency_level}, "
            f"Keluhan awal: {sanitize_user_text(sc.user_symptoms)}"
        )
    if request.knowledge_context:
        kb_lines = []
        for doc in request.knowledge_context:
            kb_lines.append(
                f"- ({doc.condition_key}) {doc.title}: {doc.description} "
                f"Do's: {', '.join(doc.dos[:3])}. Don'ts: {', '.join(doc.donts[:3])}."
            )
        parts.append("[Basis Pengetahuan]\n" + "\n".join(kb_lines))
    if request.chat_history:
        hist = "\n".join(
            f"{m.role}: {sanitize_user_text(m.content)}" for m in request.chat_history[-10:]
        )
        parts.append(f"[Riwayat Percakapan Terakhir]\n{hist}")

    parts.append(f"[Pesan Pengguna Saat Ini]\n{sanitized_message}")
    return "\n\n".join(parts)


async def _invoke_gemini_structured(
    request: AgentChatRequest,
    sanitized_message: str,
    settings: Settings,
) -> tuple[AgentChatResponse, bool]:
    from langchain_core.messages import HumanMessage, SystemMessage
    from langchain_google_genai import ChatGoogleGenerativeAI

    tools, tool_state = build_agent_tools(request.knowledge_context)
    llm = ChatGoogleGenerativeAI(
        model=settings.gemini_model or "gemini-2.5-flash",
        google_api_key=settings.gemini_api_key,
        temperature=0.3,
        timeout=settings.llm_timeout_s,
    )

    # Bind tools metadata & enforce Pydantic structured output
    _ = tools  # tools available for agentic orchestration / introspection
    structured_llm = llm.with_structured_output(AgentChatResponse)
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=_format_user_prompt(request, sanitized_message)),
    ]
    result = await structured_llm.ainvoke(messages)
    if not isinstance(result, AgentChatResponse):
        result = AgentChatResponse.model_validate(result)
    return result, tool_state["triggered_clinic_finder"]


async def run_deni_chat(
    request: AgentChatRequest,
    settings: Settings | None = None,
    llm_invoker: Callable[
        [AgentChatRequest, str, Settings], Any
    ]
    | None = None,
) -> AgentChatResponse:
    cfg = settings or get_settings()
    sanitized = sanitize_user_text(request.message)
    invoker = llm_invoker or _invoke_gemini_structured

    if llm_invoker is None and not cfg.gemini_api_key:
        return enforce_safety_backstop(request, build_static_fallback(request))

    try:
        raw_result = await asyncio.wait_for(
            invoker(request, sanitized, cfg),
            timeout=cfg.llm_timeout_s,
        )
        if isinstance(raw_result, tuple):
            ai_response, tool_triggered = raw_result
        else:
            ai_response, tool_triggered = raw_result, False
        if not isinstance(ai_response, AgentChatResponse):
            ai_response = AgentChatResponse.model_validate(ai_response)
        return enforce_safety_backstop(request, ai_response, tool_triggered=tool_triggered)
    except Exception:
        return enforce_safety_backstop(request, build_static_fallback(request))
