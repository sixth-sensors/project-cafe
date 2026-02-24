import asyncio
import base64
import copy
import json
import os
import uuid
from datetime import datetime

import firebase_admin
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth, credentials
from utils.packet import Packet
from utils.sender import Sender

# Load environment variables
load_dotenv()

# TODO: STORE THESE IN DATABREW
BREW_JOBS: dict[str, dict] = {}
SSE_QUEUES: set[asyncio.Queue] = (
    set()
)  # List of queues for all connected SSE clients. Each client has its own queue.

# TODO: DELETE HARDCODED DUMMY JOB
BREW_JOBS["dummy-job"] = {
    "state": "queued",
    "intent": "make a coffee",
    "plan": [
        {"tool": "set_target_temperature", "args": {"celsius": 65}},
        {"tool": "start_brew", "args": {}},
    ],
    "explanation": "Test job generated for debugging",
}

app = FastAPI()

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


#####################
# TEST ENDPOINTS
#####################


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    try:
        decoded = auth.verify_id_token(credentials.credentials)
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid ID token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {e}")
    return decoded


@app.get("/test/protected")
async def protected_test(token: dict = Depends(verify_token)):
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

                now = datetime.now()
                yield {
                    "temp": round(current_temp, 1),
                    "target_temp": target_temp,
                    "time": now.strftime("%H:%M:%S"),
                    "timestamp": int(now.timestamp() * 1000),
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
        auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    queue = asyncio.Queue()
    SSE_QUEUES.add(queue)

    async def sse_generator():
        yield f"data: {json.dumps({'type': 'connected'})}\n\n"
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
            SSE_QUEUES.discard(queue)

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
        "sender_id" : Sender.HOMEBREW
        "type" : "telemetry",
        <READINGS>
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

    # TODO: We should modify this response to contain physical instructions for
    # Homebrew to take, given the telemetry readings.

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
    If Overbrew requests that a profile is created, this function will populate Databrew with the new profile.

    Expected packet format:
    {
        "sender_id" : Sender.OVERBREW,
        "type" : "brew",
        "user_id" : <ID OF THE USER LOGGED IN>
        "create_profile" : True | False,

        "temperature" : <TARGET TEMPERATURE>

        "intent" : <Intent for the MCP server>
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

    print(f"Received: {msg}")

    if not isinstance(msg, dict):
        return {"type": "error", "error": "invalid_message"}

    sender_id = msg.get("sender_id")
    msg_type = msg.get("type")
    user_id = msg.get("user_id")
    create_profile = msg.get("create_profile")
    intent = msg.get("intent")

    target_temperature = msg.get("temperature")

    if sender_id != Sender.OVERBREW or msg_type != "brew":
        return Response(
            content='{"type":"error","error":"invalid_message"}',
            media_type="application/json",
            status_code=400,
        )

    if (
        not isinstance(create_profile, bool)
        or not isinstance(intent, str)
        or not isinstance(target_temperature, (float, int))
        or not sender_id
        or not msg_type
        or not user_id
        or not intent
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
        "intent": intent,
        "context": context,
        "constraints": constraints,
    }

    #####
    # TODO: the above dictionary will be sent to the MCP server at some point.
    #####

    commands = []  # List of commands that will be taken by the brew.
    request_id = str(uuid.uuid4())

    # SSE: let the user know the brew started immediately
    await broadcast(
        {
            "type": "brew_started",
            "request_id": request_id,
        },
    )

    # TODO: enqueue into DB here
    if create_profile:
        pass

    # DUMMY CODE
    await continually_send_brew_status(
        user_id=user_id, request_id=request_id, target_temperature=target_temperature
    )

    # SSE: let the user know the brew finished
    await broadcast(
        {
            "type": "brew_finished",
            "request_id": request_id,
            "plan": commands,
        },
    )

    return {
        "sender_id": Sender.AWAYBREW,
        "type": "brew_finished",
        "request_id": request_id,
        "plan": commands,
    }


#####################
# AUTOBREW ENDPOINTS
#####################


@app.get("/brew/{request_id}")
async def brew_status(request_id: str):
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

    job = BREW_JOBS.get(request_id)
    if not job:
        return Packet.error(Sender.AWAYBREW, "unknown_request_id").to_response(
            status_code=404
        )

    res = copy.deepcopy(job)

    return Packet(Sender.AWAYBREW, "brew status", res).to_response()


# TODO: check if this is even neccessary. Could be that the other functions work just fine.
@app.post("/mcp")
async def mcp_endpoint_stub(request: Request):
    return Packet.ack(Sender.AWAYBREW).to_response()


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
    for queue in list(SSE_QUEUES):
        await queue.put(event)
