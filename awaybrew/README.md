# Awaybrew

## Setup

If you haven't already, [install `uv`](https://docs.astral.sh/uv/getting-started/installation/).

This will create a virtual environment (a "venv") and install dependencies. 
```bash
uv sync
```

Activate the venv:

Linux:
```bash
source .venv/bin/activate
```

Windows:
```ps
.venv\Scripts\activate 
```

## Usage

```bash
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

## Description of the endpoints.

`/telemetry`

Receives telemetry data from Homebrew. Returns an ACK response.

Expected packet format:
```
    {
        "sender_id" : Sender.HOMEBREW
        "type" : "telemetry",
        <READINGS>
    }
```

`/brew`

Receives a brew request from Overbrew. Returns "brew accepted" or error messages when applicable.
If Overbrew requests that a profile is created, this function will populate Databrew with the new profile.

Expected packet format:
```
{
    "sender_id" : Sender.OVERBREW,
    "type" : "brew",
    "create_profile" : True | False,
    "intent" : <Intent for the MCP server>
}
```

`/brew/{request_id}`

Takes the status of a brew job via a GET request.

Input: request ID.

Returns:
```
{
    "sender_id" : Sender.AWAYBREW
    "type" : "brew status",
    "request_id" : <REQUEST ID>
}
```

## Working with Awaybrew in Python (does not apply to MicroPython)
### Sending packets to Awaybrew:
```python
from utils.packet import Packet
from utils.sender import Sender

data = {
    "param1" : "a",
    "param2" : "b"
}
Packet(Sender.<SENDER_ID>, "message type", res).to_response() # Returns a FastAPI response
```

### Receiving packets from Awaybrew
```python
from utils.packet import Packet
from utils.sender import Sender

try:
    msg = await Packet.request_to_dict(request: Request) # returns a dict
except Exception:
    return Packet.error(Sender.AWAYBREW, "invalid_message").to_response(
        status_code=400
    )
```
