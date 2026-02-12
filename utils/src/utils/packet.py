# utils/packet.py
from typing import Any, Mapping, Optional

import msgpack
from fastapi import Request, Response


class Packet:
    def __init__(
        self, sender_id: int, type: str, payload: dict[str, Any] | None = None
    ):
        self.sender_id = sender_id
        self.type = type
        self.payload = payload or {}

    def to_dict(self) -> dict[str, Any]:
        return {
            "sender_id": int(self.sender_id),
            "type": self.type,
            **self.payload,
        }

    def to_response(
        self,
        status_code: int = 200,
        headers: Optional[Mapping[str, str]] = None,
    ) -> Response:
        return Response(
            content=msgpack.packb(self.to_dict(), use_bin_type=True),
            status_code=status_code,
            media_type="application/msgpack",
            headers=headers,
        )

    @staticmethod
    async def request_to_dict(request: Request) -> dict:
        return msgpack.unpackb(await request.body(), raw=False)

    @staticmethod
    def ack(sender_id: int) -> "Packet":
        return Packet(sender_id=sender_id, type="ack")

    @staticmethod
    def error(sender_id: int, error: str, **extra: Any) -> "Packet":
        return Packet(
            sender_id=sender_id,
            type="error",
            payload={"error": error, **extra},
        )
