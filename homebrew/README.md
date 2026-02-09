# Homebrew

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

Connect the ESP32-C6 via USB, then:

```bash
uv run mpremote connect /dev/ttyUSB0 run main.py
```

To flash main.py permanently to the device:

```bash
uv run mpremote connect /dev/ttyUSB0 reset
uv run mpremote connect /dev/ttyUSB0 fs cp main.py :main.py
```

## Configuration

Edit `WIFI_SSID` and `WIFI_PASSWORD` in `main.py` before running.
