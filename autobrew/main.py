import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("autobrew")

# Constants
API_BASE = os.environ.get("AWAYBREW_URL", "http://localhost:8000")
USER_AGENT = "autobrew/1.0"
SENDER_ID = 3  # Sender.AUTOBREW


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


async def _get(path: str) -> dict[str, Any] | None:
    """Issue a GET request to awaybrew and return the parsed JSON, or None on failure."""
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{API_BASE}{path}", headers=headers, timeout=30.0
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            print(f"HTTP error on GET {path}: {e.response.status_code}")
            return None
        except Exception as e:
            print(f"Request error on GET {path}: {e}")
            return None


async def _post(path: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    """Issue a POST request to awaybrew and return the parsed JSON, or None on failure."""
    headers = {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{API_BASE}{path}", json=payload, headers=headers, timeout=30.0
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            print(
                f"HTTP error on POST {path}: {e.response.status_code} – {e.response.text}"
            )
            return None
        except Exception as e:
            print(f"Request error on POST {path}: {e}")
            return None


# ---------------------------------------------------------------------------
# User tools
# ---------------------------------------------------------------------------


@mcp.tool()
async def get_users() -> str:
    """
    Get the list of all stored user profiles from the coffee machine system.

    Returns a list of users and their saved coffee preferences.
    """
    data = await _get("/users")
    if data is None:
        return "Unable to fetch user profiles. Is awaybrew running and reachable?"
    return str(data)


@mcp.tool()
async def get_user(user_id: str) -> str:
    """
    Get the details of a specific user profile, including their saved coffee preferences.

    Args:
        user_id: The unique identifier of the user whose profile to retrieve.
    """
    data = await _get(f"/users/{user_id}")
    if data is None:
        return f"Unable to fetch profile for user '{user_id}'. The user may not exist."
    return str(data)


# ---------------------------------------------------------------------------
# Brew tools
# ---------------------------------------------------------------------------


@mcp.tool()
async def order_coffee(
    intent: str,
    temperature: float = 90.0,
    flow_rate: float = 1.0,
    user_id: str = "anonymous",
    create_profile: bool = False,
) -> str:
    """
    Order a coffee from the IoT coffee machine.

    This sends a brew request to the awaybrew backend, which will instruct
    the physical coffee machine (homebrew) to start brewing.

    Args:
        intent: A plain-English description of the coffee you want, e.g.
                "a strong espresso", "a mild long black", "a hot americano".
                This is logged and may be used to tune future preferences.
        temperature: Target brew temperature in Celsius (default 90.0).
                     Typical range: 70–96 °C. Higher = stronger extraction.
        flow_rate: Water flow rate as a multiplier (default 1.0).
                   Lower values produce a slower, stronger brew.
        user_id: The ID of the user ordering the coffee. Defaults to
                 "anonymous" if no user is logged in.
        create_profile: If True, save these settings as a new profile for
                        the user. Defaults to False.

    Returns:
        A confirmation message with the brew request ID, or an error message.
    """
    payload = {
        "sender_id": SENDER_ID,
        "type": "brew",
        "user_id": user_id,
        "create_profile": create_profile,
        "intent": intent,
        "temperature": temperature,
        "flow_rate": flow_rate,
    }

    data = await _post("/brew", payload)
    if data is None:
        return (
            "Failed to place the brew order. "
            "Check that awaybrew is running and the coffee machine is online."
        )

    request_id = data.get("request_id", "unknown")
    return (
        f"Brew order placed successfully!\n"
        f"  Request ID : {request_id}\n"
        f"  Intent     : {intent}\n"
        f"  Temperature: {temperature}°C\n"
        f"  Flow rate  : {flow_rate}\n\n"
        f"You can check progress with: get_brew_status('{request_id}')"
    )


@mcp.tool()
async def order_coffee_for_user(user_id: str, intent: str = "my usual coffee") -> str:
    """
    Order a coffee using a saved user profile's preferences.

    First fetches the user's stored temperature and flow-rate settings, then
    places a brew order using those values.

    Args:
        user_id: The ID of the user whose saved preferences should be used.
        intent: Optional description of the coffee. Defaults to "my usual coffee".

    Returns:
        A confirmation message with the brew request ID, or an error message.
    """
    # Fetch the user's saved profile
    user_data = await _get(f"/users/{user_id}")
    if user_data is None:
        return (
            f"Could not find a profile for user '{user_id}'. "
            "Use get_users() to see available profiles, or order_coffee() to brew without a profile."
        )

    # Extract preferences – fall back to sensible defaults if the profile omits them
    temperature = user_data.get("temperature", 90.0)
    flow_rate = user_data.get("flow_rate", 1.0)

    payload = {
        "sender_id": SENDER_ID,
        "type": "brew",
        "user_id": user_id,
        "create_profile": False,
        "intent": intent,
        "temperature": temperature,
        "flow_rate": flow_rate,
    }

    data = await _post("/brew", payload)
    if data is None:
        return "Failed to place the brew order. Check that awaybrew is running."

    request_id = data.get("request_id", "unknown")
    return (
        f"Brew order placed for user '{user_id}'!\n"
        f"  Request ID : {request_id}\n"
        f"  Temperature: {temperature}°C\n"
        f"  Flow rate  : {flow_rate}\n\n"
        f"You can check progress with: get_brew_status('{request_id}')"
    )


@mcp.tool()
async def get_brew_status(request_id: str) -> str:
    """
    Check the current status of a brew job.

    Args:
        request_id: The request ID returned when the brew was ordered.

    Returns:
        The current status of the brew job (e.g. queued, in_progress, done),
        or an error if the request ID is not found.
    """
    data = await _get(f"/brew/{request_id}")
    if data is None:
        return (
            f"No brew job found for request ID '{request_id}'. "
            "The job may have completed and been cleared, or the ID is incorrect."
        )
    return str(data)


# ---------------------------------------------------------------------------
# Machine status tool
# ---------------------------------------------------------------------------


@mcp.tool()
async def get_machine_status() -> str:
    """
    Check whether the coffee machine is currently online and get its last known state.

    Returns a summary of the machine's connectivity and any active brew.
    """
    data = await _get("/")
    if data is None:
        return "Could not reach awaybrew. The backend may be offline."

    return f"awaybrew is reachable. Response: {data}"


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
