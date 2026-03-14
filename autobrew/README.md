# autobrew

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
Make sure you're in the autobrew directory before running the following command
```bash
python main.py
```

From here you can run the Autobrew MCP server locally through claude desktop. Ensure you update your "claude_desktop_config" file through the developer settings panel with your equivalent of the following:
```json
{
  "mcpServers": {
    "autobrew": {
      "command": "C:\\Users\\darra\\.local\\bin\\uv.exe",
      "args": [
        "--directory",
        "C:\\Users\\darra\\Desktop\\Documents\\College\\Year 5\\IOT\\internet-of-things\\autobrew",
        "run",
        "python",
        "main.py"
      ],
      "env": {
        "AWAYBREW_URL": "http://localhost:8000"
      }
    }
  }
}
```

With the server running and the appropriate config files, you should be able to access commands through the Claude Desktop client. Without other services running there will be no functionality behind these tools.