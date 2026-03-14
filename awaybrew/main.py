import asyncio
import base64
import copy
import json
import os
import uuid
from datetime import datetime

import firebase_admin
import mysql.connector
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth, credentials
from utils.packet import Packet
from utils.sender import Sender

MAXIMUM_NUMBER_OF_BREW_REQUESTS = 10

# Load environment variables
load_dotenv()

app = FastAPI()

# TODO: STORE THESE IN DATABREW
app.state.BREW_JOBS = {}
app.state.SSE_QUEUES = (
    set()
)  # List of queues for all connected SSE clients. Each client has its own queue.

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

# Initialize Databrew connection
databrew_connection = mysql.connector.connect(
    host=os.getenv("DB_HOST"),
    port=os.getenv("DB_PORT"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database=os.getenv("DB_NAME"),
    ssl_disabled=False,
)

cursor = databrew_connection.cursor(dictionary=True)

cursor.execute("""
    CREATE TABLE IF NOT EXISTS brew_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        temperature FLOAT NOT NULL,
        flow_rate FLOAT NOT NULL,
        start_timestamp TIMESTAMP NOT NULL,
        favourite BOOLEAN DEFAULT FALSE
    )
    """)

print("Databrew connection initialized successfully")


@app.get("/")
def read_root():
    return {"Hello": "World"}

#####################
# DATABREW FUNCTIONS
#####################

def create_brew_request(user_id: str, temperature: float, flow_rate: float, start_timestamp: datetime, favourite: bool):
    cursor.execute("""
    INSERT INTO brew_requests (user_id, temperature, flow_rate, start_timestamp, favourite) 
    VALUES (%s, %s, %s, %s, %s)
    """, (user_id, temperature, flow_rate, start_timestamp, favourite))
    databrew_connection.commit()
    return

def favourite_brew_request(brew_id: int, favourite_status: bool):
    cursor.execute("""
    UPDATE brew_requests SET favourite = %s WHERE id = %s
    """, (favourite_status, brew_id))
    databrew_connection.commit()
    return

def get_user_brew_requests(user_id: str, number_of_requests: int):
    cursor.execute("""
    SELECT id, temperature, flow_rate, start_timestamp, favourite 
    FROM brew_requests 
    WHERE user_id = %s 
    ORDER BY start_timestamp DESC 
    LIMIT %s
    """, (user_id, number_of_requests))
    return cursor.fetchall()

def get_user_favourites(user_id: str):
    cursor.execute("""
    SELECT id, temperature, flow_rate, start_timestamp, favourite 
    FROM brew_requests 
    WHERE user_id = %s AND favourite = TRUE
    ORDER BY start_timestamp DESC
    """, (user_id,))
    return cursor.fetchall()

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

                yield {
                    "temp": round(current_temp, 1),
                    "target_temp": target_temp,
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
        auth.verify_id_token(token)
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
                "temp": msg["temp"],
                "target_temp": app.state.ACTIVE_BREW["target_temperature"],
                "timestamp": int(datetime.now().timestamp() * 1000),
            }
        )

        if (
            msg["temp"] is not None
            and msg["temp"] >= app.state.ACTIVE_BREW["target_temperature"]
        ):
            await broadcast(
                {
                    "type": "brew_finished",
                    "request_id": app.state.ACTIVE_BREW["request_id"],
                }
            )
            app.state.ACTIVE_BREW = None

    return Packet.ack(Sender.AWAYBREW).to_response()


# Running a web server on homebrew is unviable so it just polls every second or so for the current brew
@app.get("/homebrew/brew")
async def get_homebrew_brew():
    """
    Polled by Homebrew to check for pending brew commands.
    Returns the active brew target or an ACK if no brew is active.
    """

    if app.state.ACTIVE_BREW is not None:
        return Packet(
            sender_id=Sender.AWAYBREW,
            type="brew",
            payload={"target_temperature": app.state.ACTIVE_BREW["target_temperature"]},
        ).to_response()

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
    intent = msg.get("intent")

    target_temperature = msg.get("temperature")
    flow_rate = msg.get("flow_rate")

    if sender_id != Sender.OVERBREW or msg_type != "brew":
        return Response(
            content='{"type":"error","error":"invalid_message"}',
            media_type="application/json",
            status_code=400,
        )

    if (
        not isinstance(intent, str)
        or not isinstance(target_temperature, (float, int))
        or not isinstance(flow_rate, (float, int))
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
    print(commands)
    request_id = str(uuid.uuid4())

    app.state.ACTIVE_BREW = {
        "request_id": request_id,
        "target_temperature": float(target_temperature),
        "flow_rate": float(flow_rate),
        "started_at": datetime.now(),
    }

    # SSE: let the user know the brew started immediately
    await broadcast(
        {
            "type": "brew_started",
            "request_id": request_id,
        },
    )

    create_brew_request(user_id=user_id, temperature=float(target_temperature), flow_rate=float(flow_rate), start_timestamp=datetime.now(), favourite=False)

    return {
        "sender_id": Sender.AWAYBREW,
        "type": "brew_started",
        "request_id": request_id,
    }


@app.put("/favourite_brew")
async def favourite_brew(request):
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

    sender_id = msg["sender_id"]
    msg_type = msg["type"]
    brew_id = msg["brew_id"]
    user_id = msg["user_id"]
    toggle_favourite = msg["user_id"]

    if (
        sender_id != Sender.OVERBREW
        or msg_type != "favourite"
        or not isinstance(msg, dict)
        or not brew_id
        or not user_id
        or not toggle_favourite
    ):
        return Response(
            content='{"type":"error","error":"invalid_message"}',
            media_type="application/json",
            status_code=400,
        )

    print(f"Received: {msg}")

    favourite_brew_request(brew_id=brew_id, favourite_status=toggle_favourite)

    return {
        "sender_id": Sender.AWAYBREW,
        "type": "brew favourite status changed to " + str(toggle_favourite),
        "request_id": request_id,
    }


#####################
# DATABREW ENDPOINTS
#####################


@app.get("/fetch-recents/{user_id}")
async def fetch_recent_brews(user_id: str):
    """
    Fetch a list of the most recent brews from Databrew
    """

    brews = get_user_brew_requests(user_id=user_id, number_of_requests=MAXIMUM_NUMBER_OF_BREW_REQUESTS)

    return {
        "sender_id": Sender.AWAYBREW,
        "type": "fetched recent brews",
        "brews": brews
    }


@app.get("/fetch-favourites/{user_id}")
async def fetch_favourites(user_id: str):
    """
    Fetch a list of favourited brews from Databrew
    """

    favourites = get_user_favourites(user_id=user_id)

    return {
        "sender_id": Sender.AWAYBREW,
        "type": "fetched favourites",
        "favourites": favourites
    }

@app.post("/abort")
async def abort_brew(request: Request):
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
