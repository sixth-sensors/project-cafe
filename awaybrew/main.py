import sys
from pathlib import Path

import httpx
import msgpack
from fastapi import FastAPI, HTTPException, Request, Response

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from utils.sender import Sender

MCP_URL = "http://mcp-server:9000/decide"

app = FastAPI()


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.post("/telemetry")
async def receive_telemetry(request: Request):
    msg = msgpack.unpackb(await request.body())
    print(f"Received: {msg}")

    if msg["ack"] == True:
        return

    if msg["sender_id"] != Sender.HOMEBREW:
        return Response(status_code=403, media_type="application/msgpack")

    return Response(
        content=msgpack.packb({"sender_id": Sender.AWAYBREW, "ack": True}),
        media_type="application/msgpack",
    )


@app.post("/api/brew")
async def brew(request: Request):
    msg = msgpack.unpackb(await request.body())
    print(f"Received: {msg}")

    if msg["sender_id"] != Sender.AUTOBREW:
        return Response(status_code=403, media_type="application/msgpack")

    # Hardcoded context
    context = {
        "devices": {
            msg.device_id: {"online": True, "temp_c": 62.1, "last_seen_ms": 1200}
        }
    }
    constraints = {"max_temp_c": 90, "max_fill_percent": 90}

    # TODO: Decide on payload for the MCP server
    payload = {
        "sender_id": Sender.AWAYBREW,
        "intent": msg["intent"],
        "context": context,
        "constraints": constraints,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(MCP_URL, json=payload)
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="MCP server error")
    decision = r.json()

    plan = decision.get("plan", [])

    allowed = {"set_target_temperature", "set_fill_percent", "start_brew", "stop"}
    commands = []
    for step in plan:
        tool = step.get("tool")
        args = step.get("args", {})
        if tool not in allowed:
            continue

        if tool == "set_target_temperature":
            c = args.get("celsius")
            if not isinstance(c, (int, float)) or c > constraints["max_temp_c"]:
                continue

        if tool == "set_fill_percent":
            p = args.get("percent")
            if not isinstance(p, (int, float)) or p > constraints["max_fill_percent"]:
                continue

        commands.append({"tool": tool, "args": args})

        # TODO: enqueue into DB here

    return Response(status_code=200, media_type="application/msgpack")


BREW_JOBS: dict[str, dict] = {}

# TODO: DELETE HARDCODED DUMMY JOB
BREW_JOBS["dummy-job"] = {
    "request_id": "classicRALFmOMENT67",
    "state": "queued",
    "device_id": "homebrew-1",
    "intent": "make a coffee",
    "plan": [
        {"tool": "set_target_temperature", "args": {"celsius": 65}},
        {"tool": "start_brew", "args": {}},
    ],
    "explanation": "Test job generated for debugging",
}


@app.get("/api/brew/{request_id}")
async def brew_status(request_id: str):
    job = BREW_JOBS.get(request_id)
    if not job:
        raise HTTPException(status_code=404, detail="unknown request_id")

    return Response(
        content=msgpack.packb(job, use_bin_type=True),
        status_code=200,
        media_type="application/msgpack",
    )
