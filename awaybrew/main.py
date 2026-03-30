import base64
import copy
import json
import os
import uuid
from datetime import datetime
from typing import Any

from ai import (
    AI_CONTEXT_LIMIT,
    AI_MAX_FLOW_RATE,
    AI_MAX_TEMPERATURE_C,
    AI_MIN_FLOW_RATE,
    AI_MIN_TEMPERATURE_C,
    anthropic_structured_reply,
    extract_settings_from_text,
    is_cancellation_intent,
    is_confirmation_intent,
    is_explicit_start_intent,
    normalize_ai_output,
    clamp,
)
from db import (
    create_brew_request,
    favourite_brew_request,
    get_user_brew_requests,
    get_user_favourites,
)
from dotenv import load_dotenv

import asyncio
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import firebase_admin
from firebase_admin import auth, credentials
from utils.packet import Packet
from utils.sender import Sender

MAXIMUM_NUMBER_OF_BREW_REQUESTS = 10
DEFAULT_BREW_QUANTITY_ML = 30.0


# Load environment variables
load_dotenv()

app = FastAPI()

# TODO: STORE THESE IN DATABREW
app.state.BREW_JOBS = {}
app.state.SSE_QUEUES = (
    set()
)  # List of queues for all connected SSE clients. Each client has its own queue.
app.state.AI_CHAT_SESSIONS = {}

# TODO: DELETE HARDCODED DUMMY JOB
app.state.BREW_JOBS["dummy-job"] = {
    "state": "queued",
    "intent": "make a coffee",
    "plan": [
        {"tool": "set_target_temperature", "args": {"celsius": 65}},
        {"tool": "start_brew", "args": {}},
    ],
    "explanation": "Test job generated for debugging",
}

# Active brew state — set by /brew, read by /telemetry to send instructions to HOMEBREW
app.state.ACTIVE_BREW = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://cafe.miarolfe.com",
        "http://localhost",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the Firebase app
firebase_admin_json = os.environ["FIREBASE_CREDENTIALS"]

if not firebase_admin_json:
    raise ValueError("Firebase credentials not set")

firebase_admin_json = base64.b64decode(firebase_admin_json)
service_account_info = json.loads(firebase_admin_json)
cred = credentials.Certificate(service_account_info)
firebase_admin.initialize_app(cred)
print("Firebase Admin initialized successfully")

bearer_scheme = HTTPBearer()


@app.get("/")
def read_root():
    return {"Hello": "World"}


async def _start_brew_job(
    user_id: str,
    title: str,
    target_temperature: float,
    flow_rate: float,
    quantity: float = DEFAULT_BREW_QUANTITY_ML,
    favourite: bool = False,
) -> dict[str, Any]:
    request_id = str(uuid.uuid4())

    app.state.ACTIVE_BREW = {
        "request_id": request_id,
        "target_temperature": float(target_temperature),
        "flow_rate": float(flow_rate),
        "quantity": float(quantity),
        "started_at": datetime.now(),
    }

    await broadcast(
        {
            "type": "brew_started",
            "request_id": request_id,
        },
    )

    db_id = create_brew_request(
        user_id=user_id,
        title=title,
        temperature=float(target_temperature),
        flow_rate=float(flow_rate),
        quantity=float(quantity),
        start_timestamp=datetime.now(),
        favourite=favourite,
    )

    return {
        "sender_id": Sender.AWAYBREW,
        "type": "brew_started",
        "request_id": request_id,
        "id": db_id,
    }


#####################
# TEST ENDPOINTS
#####################


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    try:
        decoded = auth.verify_id_token(credentials.credentials)
        uid = decoded.get("uid")
        
        allowed_uids = [
            u.strip()
            for u in os.getenv("ALLOWED_UIDS", "").split(",")
            if u.strip()
        ]
        
        if uid not in allowed_uids:
            raise HTTPException(status_code=403, detailww="User not authorized for this device")
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid ID token")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {e}")
    return decoded


@app.get("/auth/verify")
async def verify_auth(token: dict = Depends(verify_token)):
    return {"status": "authorized", "user": token}


@app.post("/mock-brew")
async def mock_brew(token: dict = Depends(verify_token)):
    async def run():
        async def mock_telemetry_data(
            target_temp: float = 95.0, interval_s: float = 2.0
        ):
            import random

            ROOM_TEMPERATURE = 21.0
            TARGET_THRESHOLD = 3.0
            HEATING_RATE_BASE = 4.0
            HEATING_RATE_VARIANCE = 3.0
            FLUCTUATION_RANGE = 1.5

            current_temp = ROOM_TEMPERATURE + (random.random() - 0.5) * 2
            while True:
                distance = target_temp - current_temp
                if abs(distance) > TARGET_THRESHOLD:
                    heating_rate = (
                        HEATING_RATE_BASE
                        + (random.random() - 0.5) * HEATING_RATE_VARIANCE
                    )
                    current_temp += heating_rate
                    if current_temp > target_temp:
                        current_temp = (
                            target_temp + (random.random() - 0.5) * FLUCTUATION_RANGE
                        )
                else:
                    current_temp = (
                        target_temp + (random.random() - 0.5) * FLUCTUATION_RANGE * 2
                    )

                yield {
                    "temp": round(current_temp, 1),
                    "target_temp": target_temp,
                    "flow_rate": 0,
                    "timestamp": int(datetime.now().timestamp() * 1000),
                }
                await asyncio.sleep(interval_s)

        request_id = str(uuid.uuid4())

        count = 0
        async for reading in mock_telemetry_data():
            await broadcast({"type": "telemetry", "request_id": request_id, **reading})
            count += 1
            if count >= 100:
                break

    asyncio.create_task(run())
    return {"status": "started"}


#####################
# SSE ENDPOINT
#####################


@app.get("/telemetry/stream")
async def get_telemetry_data(request: Request, token: str = Query(...)):
    try:
        decoded = auth.verify_id_token(token)
        uid = decoded.get("uid")
        
        allowed_uids = [
            u.strip()
            for u in os.getenv("ALLOWED_UIDS", "").split(",")
            if u.strip()
        ]
        
        if uid not in allowed_uids:
            raise HTTPException(status_code=403, detail="User not authorised for this device")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    queue = asyncio.Queue()
    app.state.SSE_QUEUES.add(queue)

    async def sse_generator():
        yield f"data: {json.dumps({'type': 'connected', 'brew_status': bool(app.state.ACTIVE_BREW)})}\n\n"
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"  # keepalive comment
        finally:
            app.state.SSE_QUEUES.discard(queue)

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


#####################
# HOMEBREW ENDPOINTS
#####################


@app.post("/telemetry")
async def receive_telemetry(request: Request):
    """
    Receives telemetry data from Homebrew. Returns an ACK response.

    Expected packet format:
    {
        "sender_id" : Sender.HOMEBREW,
        "type" : "telemetry",
        "temperature" : <TEMPERATURE>,
        "flow_rate" : <FLOW RATE>
    }
    """
    try:
        msg = await Packet.request_to_dict(request)
    except Exception:
        return Packet.error(Sender.AWAYBREW, "invalid_message").to_response(
            status_code=400
        )

    print(f"Telemetry received: {msg}")

    if msg["type"] == "ack":
        return Response(status_code=204)

    if msg["sender_id"] != Sender.HOMEBREW or msg["type"] != "telemetry":
        return Packet.error(Sender.AWAYBREW, "forbidden_sender").to_response(
            status_code=403
        )

    # app.ACTIVE_BREW  # TODO: Maybe encapsulating state better, FastAPI has some good stuff for this
    if app.state.ACTIVE_BREW is not None:
        await broadcast(
            {
                "type": "telemetry",
                "request_id": app.state.ACTIVE_BREW["request_id"],
                "temp": msg.get("temp", 0),
                "target_temp": app.state.ACTIVE_BREW["target_temperature"],
                "flow_rate": msg.get("flow_rate", 0),
                "timestamp": int(datetime.now().timestamp() * 1000),
            }
        )

    return Packet.ack(Sender.AWAYBREW).to_response()


# Running a web server on homebrew is unviable so it just polls every second or so for the current brew
@app.get("/homebrew/brew")
async def get_homebrew_brew(request: Request):
    """
    Polled by Homebrew to check for pending brew commands.
    Returns the active brew target or an ACK if no brew is active.
    """
    accept_header = request.headers.get("accept", "")

    if app.state.ACTIVE_BREW is not None:
        payload = {
            "target_temperature": app.state.ACTIVE_BREW["target_temperature"],
            "flow_rate": app.state.ACTIVE_BREW["flow_rate"],
            "quantity": app.state.ACTIVE_BREW["quantity"],
        }
        if "started_at" in app.state.ACTIVE_BREW:
            payload["started_at"] = app.state.ACTIVE_BREW["started_at"].isoformat()

        packet = Packet(
            sender_id=Sender.AWAYBREW,
            type="brew",
            payload=payload,
        )
        if "application/json" in accept_header:
            return Response(
                content=json.dumps(packet.to_dict()), media_type="application/json"
            )
        return packet.to_response()

    packet = Packet.ack(Sender.AWAYBREW)
    if "application/json" in accept_header:
        return Response(
            content=json.dumps(packet.to_dict()), media_type="application/json"
        )
    return packet.to_response()


@app.get("/homebrew/finish")
async def finish_brew(request: Request):
    """
    Called by Homebrew when a brew is finished. Resets the active brew state and broadcasts the update to the frontend.
    """
    app.state.ACTIVE_BREW = None

    await broadcast(
        {
            "type": "brew_finished",
        },
    )

    return Packet.ack(Sender.AWAYBREW).to_response()


##################################################
# OVERBREW ENDPOINTS
# (These endpoints use JSON instead of msgpack,
# as JSON is easier for React integration.)
##################################################


@app.post("/brew")
async def brew(request: Request):
    """
    Receives a brew request from Overbrew. Returns "brew accepted" or error messages when applicable.

    Expected packet format:
    {
        "sender_id" : Sender.OVERBREW,
        "type" : "brew",
        "user_id" : <ID OF THE USER LOGGED IN>

        "temperature" : <TARGET TEMPERATURE>
        "flow_rate" : <TARGET FLOW RATE>
        "quantity" : <TOTAL QUANTITY IN ML>
    }
    """

    try:
        msg = await request.json()
    except Exception:
        return Response(
            content='{"error":"invalid_json"}',
            media_type="application/json",
            status_code=400,
        )

    if not isinstance(msg, dict):
        return {"type": "error", "error": "invalid_message"}

    sender_id = msg.get("sender_id")
    msg_type = msg.get("type")
    user_id = msg.get("user_id")
    title = msg.get("title", "My Brew")

    target_temperature = msg.get("temperature")
    flow_rate = msg.get("flow_rate")
    quantity = msg.get("quantity")

    if sender_id not in (Sender.OVERBREW, Sender.AUTOBREW) or msg_type != "brew":
        return Response(
            content='{"type":"error","error":"invalid_message"}',
            media_type="application/json",
            status_code=400,
        )

    if (
        not isinstance(target_temperature, (float, int))
        or not isinstance(flow_rate, (float, int))
        or not isinstance(quantity, (float, int))
        or not sender_id
        or not msg_type
        or not user_id
    ):
        return Response(
            content='{"type":"error","error":"invalid_payload"}',
            media_type="application/json",
            status_code=400,
        )

    # Hardcoded context
    context = {"device": {"online": True, "temp_c": 62.1, "last_seen_ms": 1200}}
    constraints = {"max_temp_c": 90, "max_fill_percent": 90}

    # TODO: Decide on payload for the MCP server
    _ = {
        "sender_id": Sender.AWAYBREW,
        "context": context,
        "constraints": constraints,
    }

    #####
    # TODO: the above dictionary will be sent to the MCP server at some point.
    #####

    commands = []  # List of commands that will be taken by the brew.
    print(commands)
    return await _start_brew_job(
        user_id=str(user_id),
        title=str(title),
        target_temperature=float(target_temperature),
        flow_rate=float(flow_rate),
        quantity=float(quantity),
    )


@app.post("/ai/chat")
async def ai_chat(request: Request, token: dict = Depends(verify_token)):
    try:
        msg = await request.json()
    except Exception:
        return Response(
            content='{"error":"invalid_json"}',
            media_type="application/json",
            status_code=400,
        )

    if not isinstance(msg, dict):
        return Response(
            content='{"type":"error","error":"invalid_message"}',
            media_type="application/json",
            status_code=400,
        )

    sender_id = msg.get("sender_id")
    msg_type = msg.get("type")
    user_id = msg.get("user_id")
    session_id = msg.get("session_id") or user_id
    user_message = msg.get("message", "")

    if sender_id != Sender.OVERBREW or msg_type != "ai_chat":
        return Response(
            content='{"type":"error","error":"invalid_message"}',
            media_type="application/json",
            status_code=400,
        )

    if not isinstance(session_id, str) or not session_id.strip():
        return Response(
            content='{"type":"error","error":"invalid_session"}',
            media_type="application/json",
            status_code=400,
        )

    if not isinstance(user_id, str) or not user_id.strip():
        return Response(
            content='{"type":"error","error":"invalid_user"}',
            media_type="application/json",
            status_code=400,
        )

    token_uid = token.get("uid")
    if token_uid != user_id:
        return Response(
            content='{"type":"error","error":"forbidden_user"}',
            media_type="application/json",
            status_code=403,
        )

    if not isinstance(user_message, str) or not user_message.strip():
        return Response(
            content='{"type":"error","error":"invalid_prompt"}',
            media_type="application/json",
            status_code=400,
        )

    chat_state = app.state.AI_CHAT_SESSIONS.setdefault(
        session_id,
        {
            "temperature_c": None,
            "flow_rate": None,
            "quantity_ml": None,
            "awaiting_confirmation": False,
            "messages": [],
        },
    )

    history: list[dict[str, str]] = chat_state.get("messages", [])
    history.append({"role": "user", "content": user_message.strip()})
    history = history[-AI_CONTEXT_LIMIT:]

    recent_brews = get_user_brew_requests(user_id=user_id, number_of_requests=5)
    favourite_brews = get_user_favourites(user_id=user_id)

    def format_brew(b: dict) -> str:
        return f"- {b.get('title', 'Unknown')} (Temp: {b.get('temperature')}°C, Flow: {b.get('flow_rate')} ml/s, Qty: {b.get('quantity')} ml)"

    context_lines = []
    if recent_brews:
        context_lines.append(
            "### User's Recent Brews:\n"
            + "\n".join(format_brew(b) for b in recent_brews)
        )
    if favourite_brews:
        context_lines.append(
            "### User's Favourite Brews:\n"
            + "\n".join(format_brew(b) for b in favourite_brews)
        )

    if context_lines:
        context_lines.insert(
            0,
            "## User Brew Database Context\nYou have access to the following historical brew data for this user:\n",
        )

    additional_context = "\n\n".join(context_lines)

    llm_output = await anthropic_structured_reply(
        history, additional_context=additional_context
    )
    normalized = normalize_ai_output(llm_output)

    fallback = extract_settings_from_text(user_message)

    resolved_temperature = normalized.get("temperature_c")
    resolved_flow_rate = normalized.get("flow_rate")
    resolved_quantity = normalized.get("quantity_ml")

    if resolved_temperature is None:
        resolved_temperature = fallback.get("temperature_c")
    if resolved_flow_rate is None:
        resolved_flow_rate = fallback.get("flow_rate")
    if resolved_quantity is None:
        resolved_quantity = fallback.get("quantity_ml")

    if resolved_temperature is not None:
        resolved_temperature = clamp(
            resolved_temperature, AI_MIN_TEMPERATURE_C, AI_MAX_TEMPERATURE_C
        )
        chat_state["temperature_c"] = resolved_temperature

    if resolved_flow_rate is not None:
        resolved_flow_rate = clamp(
            resolved_flow_rate, AI_MIN_FLOW_RATE, AI_MAX_FLOW_RATE
        )
        chat_state["flow_rate"] = resolved_flow_rate

    if resolved_quantity is not None:
        resolved_quantity = clamp(resolved_quantity, 30.0, 500.0)
        chat_state["quantity_ml"] = resolved_quantity

    normalized["temperature_c"] = chat_state.get("temperature_c")
    normalized["flow_rate"] = chat_state.get("flow_rate")
    normalized["quantity_ml"] = chat_state.get("quantity_ml")

    missing_fields: list[str] = []
    if normalized["temperature_c"] is None:
        missing_fields.append("temperature")
    if normalized["flow_rate"] is None:
        missing_fields.append("flow_rate")
    if normalized["quantity_ml"] is None:
        missing_fields.append("quantity")

    normalized["missing_fields"] = missing_fields
    normalized["needs_more_info"] = len(missing_fields) > 0

    explicit_start = is_explicit_start_intent(user_message)
    confirmation_reply = is_confirmation_intent(user_message)
    cancellation_reply = is_cancellation_intent(user_message)
    awaiting_confirmation = bool(chat_state.get("awaiting_confirmation"))

    normalized["brew_now"] = False
    if normalized["needs_more_info"]:
        chat_state["awaiting_confirmation"] = False
    else:
        if cancellation_reply:
            chat_state["awaiting_confirmation"] = False
            normalized["brew_now"] = False
            normalized["assistant_message"] = (
                "Okay, I will not start brewing. Tell me any setting changes when you're ready."
            )
        elif explicit_start:
            chat_state["awaiting_confirmation"] = False
            normalized["brew_now"] = True
        elif awaiting_confirmation and confirmation_reply:
            chat_state["awaiting_confirmation"] = False
            normalized["brew_now"] = True
        else:
            chat_state["awaiting_confirmation"] = True
            normalized["brew_now"] = False
            normalized["assistant_message"] = (
                "I have your settings ready: "
                f"{float(normalized['temperature_c']):.0f}°C, "
                f"{float(normalized['flow_rate']):.1f} ml/s, "
                f"{float(normalized['quantity_ml']):.0f} ml. "
                "Reply 'confirm' to start brewing."
            )

    assistant_message = str(normalized["assistant_message"])
    history.append({"role": "assistant", "content": assistant_message})
    chat_state["messages"] = history[-AI_CONTEXT_LIMIT:]

    response: dict[str, Any] = {
        "sender_id": Sender.AWAYBREW,
        "type": "ai_chat",
        "assistant_message": assistant_message,
        "inferred": {
            "temperature": normalized["temperature_c"],
            "flow_rate": normalized["flow_rate"],
            "quantity": normalized["quantity_ml"],
        },
        "missing_fields": normalized["missing_fields"],
        "needs_more_info": normalized["needs_more_info"],
        "ready_to_brew": not normalized["needs_more_info"],
        "brew_started": False,
    }

    if normalized["brew_now"]:
        brew_title = normalized.get("brew_title") or "AI Brew"
        is_favourite = bool(normalized.get("save_as_favourite"))

        brew_result = await _start_brew_job(
            user_id=user_id,
            title=brew_title,
            target_temperature=float(normalized["temperature_c"]),
            flow_rate=float(normalized["flow_rate"]),
            quantity=float(normalized["quantity_ml"]),
            favourite=is_favourite,
        )
        response["brew_started"] = True
        response["brew_saved"] = is_favourite
        response["brew_title"] = brew_title
        response["request_id"] = brew_result["request_id"]
        response["id"] = brew_result["id"]
    elif (
        bool(normalized.get("save_as_favourite")) and not normalized["needs_more_info"]
    ):
        brew_title = normalized.get("brew_title") or "Saved AI Brew"
        db_id = create_brew_request(
            user_id=user_id,
            title=brew_title,
            temperature=float(normalized["temperature_c"]),
            flow_rate=float(normalized["flow_rate"]),
            quantity=float(normalized["quantity_ml"]),
            start_timestamp=datetime.now(),
            favourite=True,
        )
        response["brew_saved"] = True
        response["brew_title"] = brew_title
        response["id"] = db_id

    return response


@app.put("/favourite_brew")
async def favourite_brew(request: Request, token: dict = Depends(verify_token)):
    """
    Label/unlabel a brew as a "favourite" brew. Favourited brews are surfaced. Return a message if successful
    at the top of the frontend service.

    Expected packet format:
    {
        "sender_id" : Sender.OVERBREW,
        "type" : "favourite",
        "brew_id" : <BREW ID>,
        "user_id" : <USER ID>,
        "toggle_favourite" : True | False
    }
    """

    try:
        msg = await request.json()
    except Exception:
        return Response(
            content='{"error":"invalid_json"}',
            media_type="application/json",
            status_code=400,
        )

    sender_id = msg.get("sender_id")
    msg_type = msg.get("type")
    brew_id = msg.get("brew_id")
    user_id = msg.get("user_id")
    toggle_favourite = msg.get("toggle_favourite")

    if (
        sender_id != Sender.OVERBREW
        or msg_type != "favourite"
        or not isinstance(msg, dict)
        or not brew_id
        or not user_id
        or toggle_favourite is None
    ):
        return Response(
            content='{"type":"error","error":"invalid_message"}',
            media_type="application/json",
            status_code=400,
        )

    favourite_brew_request(brew_id=brew_id, favourite_status=toggle_favourite)

    return {
        "sender_id": Sender.AWAYBREW,
        "type": "brew favourite status changed to " + str(toggle_favourite),
        "brew_id": brew_id,
    }


#####################
# DATABREW ENDPOINTS
#####################


@app.get("/fetch-recents/{user_id}")
async def fetch_recent_brews(user_id: str, token: dict = Depends(verify_token)):
    """
    Fetch a list of the most recent brews from Databrew
    """

    brews = get_user_brew_requests(
        user_id=user_id, number_of_requests=MAXIMUM_NUMBER_OF_BREW_REQUESTS
    )

    return {
        "sender_id": Sender.AWAYBREW,
        "type": "fetched recent brews",
        "brews": brews,
    }


@app.get("/fetch-favourites/{user_id}")
async def fetch_favourites(user_id: str, token: dict = Depends(verify_token)):
    """
    Fetch a list of favourited brews from Databrew
    """

    favourites = get_user_favourites(user_id=user_id)

    return {
        "sender_id": Sender.AWAYBREW,
        "type": "fetched favourites",
        "favourites": favourites,
    }


@app.post("/abort")
async def abort_brew(request: Request, token: dict = Depends(verify_token)):
    """
    Sets the active brew to None, which signals Homebrew to stop the brew and resets the state for the next brew.
    """
    try:
        msg = await request.json()
    except Exception:
        return Response(
            content='{"error":"invalid_json"}',
            media_type="application/json",
            status_code=400,
        )

    sender_id = msg.get("sender_id")
    user_id = msg.get("user_id")

    if sender_id != Sender.OVERBREW or not user_id:
        return Response(
            content='{"type":"error","error":"invalid_message"}',
            media_type="application/json",
            status_code=400,
        )

    print(f"Received abort request from user {user_id}")

    app.state.ACTIVE_BREW = None

    await broadcast(
        {
            "type": "brew_aborted",
            "request_id": app.state.ACTIVE_BREW["request_id"]
            if app.state.ACTIVE_BREW
            else None,
        },
    )

    return {"status": "aborted"}


#####################
# AUTOBREW ENDPOINTS
#####################


@app.get("/brew/{request_id}")
async def brew_status(request_id: str, token: dict = Depends(verify_token)):
    """
    Takes the status of a brew job via a GET request.

    Input: request ID.

    Returns:
    {
        "sender_id" : Sender.AWAYBREW
        "type" : "brew status",
        "request_id" : <REQUEST ID>
    }
    """

    job = app.state.BREW_JOBS.get(request_id)
    if not job:
        return Packet.error(Sender.AWAYBREW, "unknown_request_id").to_response(
            status_code=404
        )

    res = copy.deepcopy(job)

    return Packet(Sender.AWAYBREW, "brew status", res).to_response()


##########
# HELPERS
##########
async def continually_send_brew_status(
    user_id: str, request_id: str, target_temperature: float
):
    """
    Sends the brew status continually to Overbrew as the brew progresses.

    For now, the temperature will start at a hardcoded 10 degrees.
    It will continually send Overbrew the current "temperature" and
    increment the value every time it does so. It will do this until
    the desired temperature is reached.
    """

    # OVERBREW_URL = "https://cafe.miarolfe.com/overbrew"

    temp = 10
    interval_s = 2

    # Stream the current temperature to the frontend via Server-side events
    while temp < target_temperature:
        await broadcast(
            {
                "type": "brew_progress",
                "request_id": request_id,
                "temp": temp,
            },
        )

        temp += 1
        await asyncio.sleep(interval_s)

    # Streaming the final temperature of the coffee to show that the job is done :D
    await broadcast(
        {
            "type": "brew_progress",
            "request_id": request_id,
            "temp": temp,
        },
    )


async def broadcast(event: dict):
    """
    Broadcasts an event to all subscribed users. Events added
    to the user's queue will be picked up by the SSE endpoint
    and sent to the frontend.
    """
    for queue in list(app.state.SSE_QUEUES):
        await queue.put(event)
