from fastapi import APIRouter, Depends

from app.agent.deni_agent import run_deni_chat
from app.core.security import verify_internal_key
from app.schemas import AgentChatRequest, AgentChatResponse

router = APIRouter(prefix="/internal", tags=["internal-agent"])


@router.post(
    "/agent/chat",
    response_model=AgentChatResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def internal_agent_chat(payload: AgentChatRequest) -> AgentChatResponse:
    return await run_deni_chat(payload)
