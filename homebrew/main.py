import socket
import time

import ds18x20
import machine
import onewire
import urequests
from neopixel import NeoPixel
from network import WLAN

import umsgpack

WIFI_SSID = "Mia"
WIFI_PASSWORD = "password"

LED_RED = (255, 0, 0)
LED_ORANGE = (255, 165, 0)
LED_GREEN = (0, 255, 0)

AWAYBREW_HOST = "cafe.miarolfe.com"

TELEMETRY_MSG_SCHEMA = {"type": "telemetry", "temp": 0.0}


def set_led_colour(colour):
    led = NeoPixel(machine.Pin(8), 1)
    led[0] = colour
    led.write()


# rssi = Received Signal Strength Indicator
def signal_strength_bars(rssi):
    bars = 4 if rssi >= -50 else 3 if rssi >= -60 else 2 if rssi >= -70 else 1
    return "▂▄▆█"[:bars]


def scan_networks(wlan):
    def print_visible_networks(networks):
        auth_names = ["open", "WEP", "WPA-PSK", "WPA2-PSK", "WPA/WPA2-PSK", "WPA2-ENT"]

        print("  SIG\tSSID\t\t\t\tAUTH")
        print("  ---\t----\t\t\t\t----")
        for ssid, _, _, rssi, auth, _ in networks:
            auth_str = (
                auth_names[auth] if auth < len(auth_names) else f"Unknown ({auth})"
            )
            name = ssid.decode()
            tabs = "\t\t\t" if len(name) < 8 else "\t\t" if len(name) < 16 else "\t"
            print(f"  {signal_strength_bars(rssi)}\t{name}{tabs}\t{auth_str}")

        print(end="\n")

    print("Scanning for networks...")
    networks = wlan.scan()
    print(f"Found {len(networks)} networks:\n")
    print_visible_networks(networks)

    return networks


def connect(wlan, networks):
    for ssid, *_ in networks:
        if WIFI_SSID.encode() in ssid:
            target = ssid.decode()
            print(f"Connecting to: {target}")
            wlan.connect(target, WIFI_PASSWORD)

            # Count down to 0 from 10
            for i in range(10, 0, -1):
                if wlan.isconnected():
                    ip, _, _, _ = wlan.ifconfig()
                    print(f"\nConnected! IP: {ip}")
                    return True

                print(f"  Waiting... {i}")
                time.sleep(1)

            print("Failed to connect")
            return False

    print(f"Network containing '{WIFI_SSID}' not found")
    return False


def send_msg(msg):
    url = f"https//{AWAYBREW_HOST}/msg"
    r = urequests.post(url, data=umsgpack.dumps(msg))
    print(f"Sent: {msg}, Response: {r.status_code}")
    r.close()


def ping(host, num_pings=4):
    print(f"Pinging {host}...")
    try:
        addr = socket.getaddrinfo(host, 80)[0][-1]
        print(f"Resolved to {addr[0]}")
    except OSError as e:
        print(f"DNS failed: {e}")
        return

    for i in range(num_pings):
        try:
            start = time.ticks_ms()
            s = socket.socket()
            s.settimeout(5)
            s.connect(addr)
            s.close()
            print(
                f"  [{i + 1}/{num_pings}] {time.ticks_diff(time.ticks_ms(), start)}ms"
            )
        except OSError as e:
            print(f"  [{i + 1}/{num_pings}] Failed: {e}")
        time.sleep(1)


def validate_msg(msg):
    if "type" not in msg:
        return False

    def validate_telemetry_msg(telemetry_msg):
        valid_keys = ["temp"]
        are_keys_valid = msg.keys() == valid_keys
        if not are_keys_valid:
            return False

        if type(msg["temp"]) is not float:
            return False

    if msg["type"] == "telemetry":
        return validate_telemetry_msg(msg)

    return False


def main():
    print("--- HOMEBREW ---")

    temp_sensor_pin = machine.Pin(3)
    temp_sensor = ds18x20.DS18X20(onewire.OneWire(temp_sensor_pin))
    temp_results = temp_sensor.scan()

    # Red to indicate disconnected
    set_led_colour(LED_RED)

    wlan_interface = WLAN(WLAN.IF_STA)

    # Flush WiFI interface
    wlan_interface.active(False)
    time.sleep(0.5)
    wlan_interface.active(True)

    # Don't touch this value
    wlan_interface.config(txpower=8)
    time.sleep(0.5)

    networks = scan_networks(wlan_interface)

    # Orange to indicate in-progress connection
    set_led_colour(LED_ORANGE)

    if connect(wlan_interface, networks):
        # Green to indicate connected
        set_led_colour(LED_GREEN)
        ping(AWAYBREW_HOST)
        print("HOMEBREW is online.")
    else:
        # Red to indicate disconnected
        set_led_colour(LED_RED)
        print("HOMEBREW is offline - no network accessible.")
        return

    # Main loop
    while True:
        current_temp = None

        if not temp_results:
            print("No temperature sensors found")
        else:
            temp_sensor.convert_temp()

            for result in temp_results:
                current_temp = temp_sensor.read_temp(result)

        telemetry_msg = {"temp": current_temp}
        if validate_msg(telemetry_msg):
            send_msg(telemetry_msg)

        time.sleep(0.5)


if __name__ == "__main__":
    main()
