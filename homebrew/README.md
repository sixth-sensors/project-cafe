# Homebrew

Make sure you have uv installed - it's how we handle the Python components of this project.

## Setup

```bash
uv sync
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
