import socket
import time

import ds18x20
import machine
import onewire
import urequests
from neopixel import NeoPixel
from network import WLAN

import umsgpack


class Sender:
    AWAYBREW = 0
    HOMEBREW = 1
    OVERBREW = 2
    AUTOBREW = 3


class BrewPhase:
    IDLE = "idle"
    HEATING = "heating"
    PUMPING = "pumping"
    COMPLETE = "complete"


class Homebrew:
    WIFI_SSID = "Mia"
    WIFI_PASSWORD = "password"

    LED_RED = (255, 0, 0)
    LED_ORANGE = (255, 165, 0)
    LED_GREEN = (0, 255, 0)

    AWAYBREW_HOST = "cafe.miarolfe.com"
    PLUGBREW_MAC = "14:08:08:69:4F:FF"

    BREW_MSG_REQUIRED_KEYS = {"sender_id", "type", "target_temperature"}
    BREW_MSG_OPTIONAL_KEYS = {"flow_rate", "quantity"}
    BREW_MSG_SCHEMA = {
        "sender_id": Sender.AWAYBREW,
        "type": "brew",
        "target_temperature": 0.0,
        "flow_rate": 0.0,
        "quantity": 0.0,
    }
    TELEMETRY_MSG_SCHEMA = {
        "sender_id": Sender.HOMEBREW,
        "type": "telemetry",
        "temp": 0.0,
        "flow_rate": 0.0,
    }
    POLLING_INTERVAL_SECONDS = 1.0
    # Degrees C band to prevent rapid power cycling
    ACCEPTABLE_MIN_TEMPERATURE_DEGREES_CELSIUS = 0.0  # temporary value
    ACCEPTABLE_MAX_TEMPERATURE_DEGREES_CELSIUS = 100.0  # temporary value
    ACCEPTABLE_TEMPERATURE_MARGIN_DEGREES_CELSIUS = 1.0
    TEMP_SENSOR_PIN_NUMBER = 4
    PUMP_PIN_NUMBER = 3
    PUMP_DUTY_ALL_OFF = 0
    PUMP_DUTY_ALL_ON = 1023
    MAX_BREW_BASKET_ML = 425
    MAX_KETTLE_ML = 1000
    MAX_KETTLE_TO_BASKET_FLOW_RATE_ML_PER_SEC = 25
    MAX_BASKET_TO_POT_FLOW_RATE_ML_PER_SEC = 0.83

    def __init__(self):
        self.temp_sensor_pin = machine.Pin(self.TEMP_SENSOR_PIN_NUMBER)
        self.temp_sensor = ds18x20.DS18X20(onewire.OneWire(self.temp_sensor_pin))
        self.pump_pin = machine.Pin(self.PUMP_PIN_NUMBER, mode=machine.Pin.OUT)
        self.pump = machine.PWM(self.pump_pin, freq=1000)
        self.temp_results = self.temp_sensor.scan()
        self.wlan_interface = WLAN(WLAN.IF_STA)
        self.plugbrew_ip_address = None
        # No target temperature means no active brew
        self.target_temperature = None
        self.plug_is_on = False
        self.last_valid_temp = None
        # Brew state machine
        self.brew_phase = BrewPhase.IDLE
        self.brew_flow_rate = 0.0  # ml/sec from order
        self.brew_quantity = 0.0  # ml total to transfer
        self.volume_transferred = 0.0  # ml accumulated
        self.last_pump_ticks = None  # time.ticks_ms() snapshot

    def _find_plugbrew_ip(self):
        homebrew_ip, _, _, _ = self.wlan_interface.ifconfig()
        base = homebrew_ip.rsplit(".", 1)[0]

        print(f"Scanning {base}.0/24 for PLUGBREW...")
        for i in range(1, 255):
            candidate = f"{base}.{i}"
            if candidate is not homebrew_ip:
                try:
                    r = urequests.get(f"http://{candidate}/switch/Plugbrew", timeout=1)
                    is_plugbrew = r.status_code == 200
                    r.close()
                    if is_plugbrew:
                        print(f"Found PLUGBREW at {candidate}")
                        return candidate
                except OSError:
                    pass

        return None

    def _set_led_colour(self, colour):
        led = NeoPixel(machine.Pin(8), 1)
        led[0] = colour
        led.write()

    # rssi = Received Signal Strength Indicator
    def _signal_strength_bars(self, rssi):
        bars = 4 if rssi >= -50 else 3 if rssi >= -60 else 2 if rssi >= -70 else 1
        return "▂▄▆█"[:bars]

    def _scan_networks(self):
        def print_visible_networks(networks):
            auth_names = [
                "open",
                "WEP",
                "WPA-PSK",
                "WPA2-PSK",
                "WPA/WPA2-PSK",
                "WPA2-ENT",
            ]

            print("  SIG\tSSID\t\t\t\tAUTH")
            print("  ---\t----\t\t\t\t----")
            for ssid, _, _, rssi, auth, _ in networks:
                auth_str = (
                    auth_names[auth] if auth < len(auth_names) else f"Unknown ({auth})"
                )
                name = ssid.decode()
                tabs = "\t\t\t" if len(name) < 8 else "\t\t" if len(name) < 16 else "\t"
                print(f"  {self._signal_strength_bars(rssi)}\t{name}{tabs}\t{auth_str}")

            print(end="\n")

        print("Scanning for networks...")
        networks = self.wlan_interface.scan()
        print(f"Found {len(networks)} networks:\n")
        print_visible_networks(networks)

        return networks

    def _connect(self, networks):
        for ssid, *_ in networks:
            if self.WIFI_SSID.encode() in ssid:
                target = ssid.decode()
                print(f"Connecting to: {target}")
                self.wlan_interface.connect(target, self.WIFI_PASSWORD)

                # Count down to 0 from 10
                for i in range(10, 0, -1):
                    if self.wlan_interface.isconnected():
                        ip, _, _, _ = self.wlan_interface.ifconfig()
                        print(f"\nConnected! IP: {ip}")
                        return True

                    print(f"  Waiting... {i}")
                    time.sleep(1)

                print("Failed to connect")
                return False

        print(f"Network containing '{self.WIFI_SSID}' not found")
        return False

    def _send_msg(self, msg):
        url = f"https://{self.AWAYBREW_HOST}/telemetry"
        req = urequests.post(
            url,
            data=umsgpack.dumps(msg),
            headers={"Content-Type": "application/msgpack"},
        )
        print(f"Sent: {msg}, Response: {req.status_code}")
        req.close()

    def _poll_brew(self):
        url = f"https://{self.AWAYBREW_HOST}/homebrew/brew"
        try:
            req = urequests.get(url)
            if req.status_code == 200:
                response = umsgpack.loads(req.content)
                req.close()
                return response
            req.close()
        except Exception as e:
            print(f"Failed to poll brew: {e}")
        return None

    def _ping(self, host, num_pings=4):
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

    def _validate_msg(self, msg):
        print(msg)
        if "type" not in msg.keys():
            return False

        def validate_brew_msg(brew_msg):
            msg_keys = set(brew_msg.keys())
            all_valid_keys = self.BREW_MSG_REQUIRED_KEYS | self.BREW_MSG_OPTIONAL_KEYS
            if not self.BREW_MSG_REQUIRED_KEYS.issubset(msg_keys):
                print("Missing required brew msg keys")
                return False
            if not msg_keys.issubset(all_valid_keys):
                print("Unknown keys in brew msg")
                return False

            is_sender_valid = int(brew_msg["sender_id"]) == int(
                self.BREW_MSG_SCHEMA["sender_id"]
            )

            if not is_sender_valid:
                print("Sender ID is invalid - brew msgs must come from AWAYBREW")
                return False

            if type(brew_msg["target_temperature"]) is not float:
                print("Target temperature is not float")
                return False

            target_temperature = brew_msg["target_temperature"]
            if (
                target_temperature < self.ACCEPTABLE_MIN_TEMPERATURE_DEGREES_CELSIUS
                or target_temperature > self.ACCEPTABLE_MAX_TEMPERATURE_DEGREES_CELSIUS
            ):
                print("Invalid target temperature")
                return False

            if "flow_rate" in brew_msg:
                if not isinstance(brew_msg["flow_rate"], (float, int)):
                    print("Flow rate is not a number")
                    return False
                if (
                    brew_msg["flow_rate"] < 0
                    or brew_msg["flow_rate"]
                    > self.MAX_KETTLE_TO_BASKET_FLOW_RATE_ML_PER_SEC
                ):
                    print("Flow rate out of range")
                    return False

            if "quantity" in brew_msg:
                if not isinstance(brew_msg["quantity"], (float, int)):
                    print("Quantity is not a number")
                    return False
                if (
                    brew_msg["quantity"] < 0
                    or brew_msg["quantity"] > self.MAX_COFFEE_POT_ML
                ):
                    print("Quantity out of range")
                    return False

            return True

        def validate_telemetry_msg(telemetry_msg):
            valid_keys = set(self.TELEMETRY_MSG_SCHEMA.keys())

            is_sender_valid = (
                telemetry_msg["sender_id"] == self.TELEMETRY_MSG_SCHEMA["sender_id"]
            )
            if not is_sender_valid:
                print("Sender ID is invalid - telemetry msgs must come from HOMEBREW")
                return False

            are_keys_valid = set(telemetry_msg.keys()) == valid_keys
            if not are_keys_valid:
                print("Msg does not match schema, invalidating msg")
                return False

            if type(telemetry_msg["temp"]) is not float:
                print("Msg temperature is not float, invalidating msg")
                return False

            if type(telemetry_msg["flow_rate"]) is not float:
                print("Msg flow rate is not float, invalidating msg")
                return False

            return True

        if msg["type"] == "brew":
            return validate_brew_msg(msg)
        elif msg["type"] == "telemetry":
            return validate_telemetry_msg(msg)
        else:
            return False

    def _set_plug_enabled(self, set_plug_enabled=False):
        if not self.plugbrew_ip_address:
            return False

        assert isinstance(set_plug_enabled, bool)

        if set_plug_enabled:
            urequests.post(f"http://{self.plugbrew_ip_address}/switch/Plugbrew/turn_on")
        else:
            urequests.post(
                f"http://{self.plugbrew_ip_address}/switch/Plugbrew/turn_off"
            )

        return True

    def _set_pump_percent(self, percent):
        percent = max(0, percent)
        percent = min(100, percent)

        duty_val = int((1 - percent / 100) * self.PUMP_DUTY_ALL_ON)
        self.pump.duty(duty_val)

    def _reset_brew_state(self):
        self.target_temperature = None
        self.brew_phase = BrewPhase.IDLE
        self.brew_flow_rate = 0.0
        self.brew_quantity = 0.0
        self.volume_transferred = 0.0
        self.last_pump_ticks = None
        self._set_pump_percent(0)
        self._set_plug_enabled(False)
        self.plug_is_on = False

    def _handle_instructions(self, response):
        if response is None:
            return

        if response.get("type") == "ack":
            # No active brew
            if self.target_temperature is not None:
                print("Brew cleared")
                self._reset_brew_state()
            return

        if not self._validate_msg(response):
            print(f"Invalid brew message: {response}")
            return

        new_target = response["target_temperature"]
        flow_rate = float(response.get("flow_rate", 0.0))
        quantity = float(response.get("quantity", 0.0))

        if self.target_temperature != new_target:
            print(f"New target temperature: {new_target}C")
        self.target_temperature = new_target

        # Only start brew state machine if this is a new brew with pump params
        if flow_rate > 0 and quantity > 0 and self.brew_phase == BrewPhase.IDLE:
            self.brew_flow_rate = flow_rate
            self.brew_quantity = quantity
            self.volume_transferred = 0.0
            self.brew_phase = BrewPhase.HEATING
            print(f"Brew started: {quantity}ml at {flow_rate}ml/s")

    def _execute_brew_phase(self, current_temp):
        if self.brew_phase == BrewPhase.IDLE or self.brew_phase == BrewPhase.COMPLETE:
            return

        if self.brew_phase == BrewPhase.HEATING:
            if current_temp is not None and current_temp >= self.target_temperature:
                pump_percent = (
                    self.brew_flow_rate / self.MAX_KETTLE_TO_BASKET_FLOW_RATE_ML_PER_SEC
                ) * 100
                self._set_pump_percent(pump_percent)
                self.last_pump_ticks = time.ticks_ms()
                self.brew_phase = BrewPhase.PUMPING
                print(f"Target temp reached, pumping at {pump_percent:.1f}%")

        elif self.brew_phase == BrewPhase.PUMPING:
            now = time.ticks_ms()
            elapsed_ms = time.ticks_diff(now, self.last_pump_ticks)
            self.last_pump_ticks = now
            self.volume_transferred += self.brew_flow_rate * (elapsed_ms / 1000.0)
            print(f"Volume: {self.volume_transferred:.1f}/{self.brew_quantity:.1f}ml")

            if self.volume_transferred >= self.brew_quantity:
                self._set_pump_percent(0)
                self.brew_phase = BrewPhase.COMPLETE
                print(f"Brew complete: {self.volume_transferred:.1f}ml transferred")

    def _control_temperature(self, current_temp):
        if self.target_temperature is None or current_temp is None:
            return

        if not self.plugbrew_ip_address:
            return

        # Turn ON when temp drops below (target - margin)
        should_turn_plug_on = not self.plug_is_on and current_temp < (
            self.target_temperature - self.ACCEPTABLE_TEMPERATURE_MARGIN_DEGREES_CELSIUS
        )

        # Turn OFF when temp reaches or exceeds target
        should_turn_plug_off = (
            self.plug_is_on and current_temp >= self.target_temperature
        )

        if should_turn_plug_on:
            print(
                f"Temp {current_temp}C < {self.target_temperature - self.ACCEPTABLE_TEMPERATURE_MARGIN_DEGREES_CELSIUS}C, turning plug on"
            )
            if self._set_plug_enabled(True):
                self.plug_is_on = True
        elif should_turn_plug_off:
            print(
                f"Temp {current_temp}C >= {self.target_temperature}C, turning plug off"
            )
            if self._set_plug_enabled(False):
                self.plug_is_on = False

    def _setup_connectivity(self):
        # Red to indicate disconnected
        self._set_led_colour(self.LED_RED)

        # Flush WiFI interface
        self.wlan_interface.active(False)
        time.sleep(0.5)
        self.wlan_interface.active(True)

        # Don't touch this value
        self.wlan_interface.config(txpower=8)
        time.sleep(0.5)

        networks = self._scan_networks()

        # Orange to indicate in-progress connection
        self._set_led_colour(self.LED_ORANGE)

        if self._connect(networks):
            self._ping(self.AWAYBREW_HOST)
            print("HOMEBREW is online.")
        else:
            # Red to indicate disconnected
            self._set_led_colour(self.LED_RED)
            print("HOMEBREW is offline - no network accessible.")
            return False

        if self.plugbrew_ip_address is None:
            self.plugbrew_ip_address = self._find_plugbrew_ip()

        if self.plugbrew_ip_address is None:
            print("HOMEBREW cannot connect to PLUGBREW.")
            return False

        # Green to indicate connected
        self._set_led_colour(self.LED_GREEN)
        return True

    def _get_current_temperature(self):
        if not self.temp_results:
            print("No temperature sensors found")
            return self.last_valid_temp

        self.temp_sensor.convert_temp()

        for result in self.temp_results:
            temp = self.temp_sensor.read_temp(result)
            if temp is not None:
                self.last_valid_temp = temp

        return self.last_valid_temp

    def run(self):
        print("--- HOMEBREW ---")

        self._setup_connectivity()
        self._set_plug_enabled(False)
        self._set_pump_percent(0)

        # Main loop
        while True:
            current_temperature = self._get_current_temperature()

            if current_temperature is not None:
                telemetry_msg = {
                    "sender_id": Sender.HOMEBREW,
                    "type": "telemetry",
                    "temp": current_temperature,
                    "flow_rate": self.brew_flow_rate
                    if self.brew_phase == BrewPhase.PUMPING
                    else 0.0,
                }

                if self._validate_msg(telemetry_msg):
                    self._send_msg(telemetry_msg)

            self._handle_instructions(self._poll_brew())

            self._control_temperature(current_temperature)
            self._execute_brew_phase(current_temperature)

            time.sleep(self.POLLING_INTERVAL_SECONDS)


if __name__ == "__main__":
    Homebrew().run()
