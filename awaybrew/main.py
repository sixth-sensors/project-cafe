import copy
import uuid

import msgpack
from fastapi import FastAPI, Request, Response
from utils.sender import Sender

MCP_URL = "https://cafe.miarolfe.com/mcp"

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


@app.get("/")
def read_root():
    return {"Hello": "World"}


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
        msg = msgpack.unpackb(await request.body(), raw=False)
    except Exception:
        err = {
            "sender_id": Sender.AWAYBREW,
            "type": "error",
            "error": "forbidden_sender",
        }
        return Response(
            content=msgpack.packb(err, use_bin_type=True),
            status_code=400,
            media_type="application/msgpack",
        )

    print(f"Telemetry received: {msg}")

    if msg["type"] == "ack":
        return Response(status_code=204)

    if msg["sender_id"] != Sender.HOMEBREW or msg["type"] != "telemetry":
        err = {
            "sender_id": Sender.AWAYBREW,
            "type": "error",
            "error": "forbidden_sender",
        }
        return Response(
            content=msgpack.packb(err, use_bin_type=True),
            status_code=403,
            media_type="application/msgpack",
        )

    # TODO: We should modify this response to contain physical instructions for
    # Homebrew to take, given the telemetry readings.

    return Response(
        content=msgpack.packb(
            {"sender_id": Sender.AWAYBREW, "type": "ack"}, use_bin_type=True
        ),
        media_type="application/msgpack",
    )


#####################
# OVERBREW ENDPOINTS
#####################


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
        msg = msgpack.unpackb(await request.body(), raw=False)
    except Exception:
        err = {
            "sender_id": Sender.AWAYBREW,
            "type": "error",
            "error": "forbidden_sender",
        }
        return Response(
            content=msgpack.packb(err, use_bin_type=True),
            status_code=400,
            media_type="application/msgpack",
        )

    print(f"Received: {msg}")

    if msg["sender_id"] != Sender.OVERBREW or msg["type"] != "brew":
        err = {
            "sender_id": Sender.AWAYBREW,
            "type": "error",
            "error": "forbidden_sender",
        }
        return Response(
            content=msgpack.packb(err, use_bin_type=True),
            status_code=403,
            media_type="application/msgpack",
        )

    # Hardcoded context
    context = {"device": {"online": True, "temp_c": 62.1, "last_seen_ms": 1200}}
    constraints = {"max_temp_c": 90, "max_fill_percent": 90}

    # TODO: Decide on payload for the MCP server
    _ = {
        "sender_id": Sender.AWAYBREW,
        "intent": msg["intent"],
        "context": context,
        "constraints": constraints,
    }
    #####
    # TODO: the above dictionary will be sent to the MCP server at some point.
    #####
    #
    commands = []  # List of commands that will be taken by the brew.

    # TODO: enqueue into DB here
    if msg["create_profile"]:
        pass

    request_id = uuid.uuid4().int

    res = {
        "sender_id": Sender.AWAYBREW,
        "type": "brew accepted",
        "request_id": request_id,
        "plan": commands,
    }
    return Response(
        content=msgpack.packb(res, use_bin_type=True),
        status_code=200,
        media_type="application/msgpack",
    )


#####################
# AUTOBREW ENDPOINTS
#####################


@app.get("/api/brew/{request_id}")
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
        err = {
            "sender_id": Sender.AWAYBREW,
            "type": "error",
            "error": "unknown request_id",
        }
        return Response(
            content=msgpack.packb(err, use_bin_type=True),
            status_code=404,
            media_type="application/msgpack",
        )

    res = copy.deepcopy(job)
    res["sender_id"] = Sender.AWAYBREW
    res["type"] = "brew status"

    return Response(
        content=msgpack.packb(res, use_bin_type=True),
        status_code=200,
        media_type="application/msgpack",
    )


# TODO: check if this is even neccessary. Could be that the other functions work just fine.
@app.post("/mcp")
async def mcp_endpoint_stub(request: Request):
    res = {
        "sender_id": Sender.AWAYBREW,
        "type": "ack",
        "plan": [],
    }
    return Response(
        content=msgpack.packb(res, use_bin_type=True),
        media_type="application/msgpack",
    )
