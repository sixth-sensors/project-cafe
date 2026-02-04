from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("autobrew")

# Constants
API_BASE = ""
USER_AGENT = "autobrew/1.0"


# Helper function for error handling requests
async def make_request(url: str) -> dict[str, Any] | None:
    headers = {"Accept": "json"}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, timeout=30.0)
            response.raise_for_status()
            return response.json()
        except Exception:
            return None


# User functions
@mcp.tool()
async def get_users() -> str:
    """
    Get list of stored user profiles

    """

    url = f"{API_BASE}/users"
    data = await make_request(url)

    if not data:
        return "Unable to fetch user profiles."

    # Format properly once data struct is known
    return data


@mcp.tool()
async def check_user(user: str) -> str:
    """
    Get the details of a specific stored user profile

    Args:
        user: Requested user profile
    """

    url = f"{API_BASE}/users?user={user}"
    data = await make_request(url)

    if not data:
        return "Unable to fetch user."

    # Format properly once data struct is known
    return data


@mcp.tool()
async def order_user_coffee(user: str) -> str:
    """
    Order a stored user profile's coffee

    Args:
        user: Requested user profile
    """

    url = f"{API_BASE}/users?user={user}"
    data = await make_request(url)

    if not data:
        return "User does not exist"

    # Order coffee
    # client.post / url

    # Format properly once data struct is known
    return data


# Order functions
@mcp.tool()
async def order_coffee(coffee_type: str) -> str:
    """
    Order a coffee of a specific type

    Args:
        coffee_type: Type of coffee to order
    """

    url = f"{API_BASE}/order?type={coffee_type}"
    data = await make_request(url)

    if not data:
        return "Unable to place order."

    # Format properly once data struct is known
    return data


# Unsure of coffee params, leaving unimplemented for now
# inputs: size:str, acidity:int, temp:int   etc...


# Initialize and run the server
def main():
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
