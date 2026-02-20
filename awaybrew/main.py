import asyncio
import base64
import copy
import json
import os
import uuid

import firebase_admin
import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth, credentials
from utils.packet import Packet
from utils.sender import Sender

# Load environment variables
load_dotenv()

BREW_JOBS: dict[str, dict] = {}

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

# Add CORS middleware to allow requests from the frontend dev server and production URL
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

# Set up the HTTPBearer scheme for token authentication
bearer_scheme = HTTPBearer()

# Verify the Firebase ID token from the Authorization header
async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:        
    print(credentials)
    try:
        decoded = auth.verify_id_token(credentials.credentials)
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid ID token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {e}")
    return decoded


@app.get("/")
def read_root():
    return {"Hello": "World"}


#####################
# TEST ENDPOINTS
#####################


@app.get("/test/protected")
async def protected_test(token: dict = Depends(verify_token)):
    return {"status": "authorized", "user": token}


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
        "create_profile" : True | False,
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
    create_profile = msg.get("create_profile")
    intent = msg.get("intent")

    if sender_id != Sender.OVERBREW or msg_type != "brew":
        return Response(
            content='{"type":"error","error":"invalid_message"}',
            media_type="application/json",
            status_code=400,
        )

    if (
        not isinstance(create_profile, bool)
        or not isinstance(intent, str)
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

    # TODO: enqueue into DB here
    if create_profile:
        pass

    # DUMMY CODE
    await continually_send_brew_status()

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
async def continually_send_brew_status():
    """
    Sends the brew status continually to Overbrew as the brew progresses.

    For now, the temperature will start at a hardcoded 10 degrees.
    It will continually send Overbrew the current "temperature" and
    increment the value every time it does so. It will do this until
    the desired temperature is reached.
    """

    OVERBREW_URL = "https://cafe.miarolfe.com/overbrew"

    async with httpx.AsyncClient() as client:
        temp = 10
        backoff = 0.25
        desired_temp = 90
        while temp < desired_temp:
            msg = {"sender_id": Sender.AWAYBREW, "type": "brew_progress", "temp": temp}

            try:
                r = await client.post(OVERBREW_URL, json=msg, timeout=10.0)

                if r.status_code >= 500:
                    raise httpx.HTTPStatusError(
                        "overbrew 5xx", request=r.request, response=r
                    )

                ctype = (r.headers.get("content-type") or "").lower()
                if ctype.startswith("application/json"):
                    ack = r.json()
                else:
                    ack = {"raw": r.text}

                if isinstance(ack, dict) and ack.get("type") == "ack":
                    temp += 1
                    backoff = 0.25
                    continue

            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError):
                pass

            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 5.0)
