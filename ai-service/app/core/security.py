import hmac
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.core.config import Settings, get_settings


def verify_internal_key(
    x_internal_key: Annotated[str | None, Header(alias="X-Internal-Key")] = None,
    settings: Settings = Depends(get_settings),
) -> str:
    expected = settings.normalized_internal_key()
    provided = (x_internal_key or "").strip()
    if not provided or not expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHENTICATED",
                "message": "Kunci autentikasi internal tidak valid atau tidak ditemukan.",
            },
        )
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHENTICATED",
                "message": "Kunci autentikasi internal tidak valid.",
            },
        )
    return provided
