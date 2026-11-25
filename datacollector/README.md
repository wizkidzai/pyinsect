# PyInsect Data Collector

**PyInsect Data Collector** builds photo datasets of insects. You put an insect on a turntable. A phone web app spins the turntable, changes the lighting and takes a photo at every angle. Then you review the photos and save them as a folder.

```
index.html, app.js, style.css   phone web app (plain HTML/CSS/JS, no build step)
firmware/turntable/main.py       MicroPython controller used by the web app
firmware/turntable/turntable.ino  Arduino alternative for the ESP32-C3
```

## User flow

1. **Start**: type the insect's name (optional), then press **Start**, the only button. The app connects to the turntable over USB and opens the camera.
2. **Photos**: put the bug in the ring. After 3 seconds the insect finder AI (the one the website uses) looks for it and zooms in on it, up to 4×. Then the app takes 50 photos in 8 seconds while the turntable spins, and shows how many are taken. After that it finds the bug in every photo and crops around it, so it stays in the picture as it moves. If it can't find the bug, or the bug already fills the view, it doesn't zoom. The first load needs internet to download the finder (about 20 MB).
   - Camera with a flashlight (phone): the exposure steps through normal, dim, dark, bright and very bright, while the flashlight strobes on and off every 0.2 s on its own clock. Flashlight photos end in `_flash`. Photos taken while the light is switching are labelled `changing`.
   - No flashlight (laptop webcam): the screen glows white, warm and cool, plus room light
3. **Sending**: the app zips the photos (named after the insect, or `insect` if no name was typed, with a `labels.csv`) and sends them to the computer by itself: first over the USB cable, then over the hotspot or Wi-Fi. The first time, tap **Allow** if Chrome asks about the local network. If no computer answers it keeps trying, and **Save to phone instead** downloads the zip.

## Turntable hardware

| Servo wire | Connect to |
|---|---|
| Signal (orange / yellow / white) | GPIO6 (board pin marked `6`). Change `SERVO_PIN` in the sketch if you use another pin |
| + (red) | **5V** (USB 5V / VBUS pin), **never 3V3** |
| − (brown / black) | GND |

The firmware drives a continuous-rotation servo at 50 Hz: 1750 µs turns forward, 1250 µs turns in reverse, and 1500 µs stops. The slower default speed offset is +250 µs; set it to −250 µs in calibration to reverse direction.

- Small 360° servos (SG90/MG90-type) can run from the board's 5V pin while it's on USB. For bigger servos (MG995/MG996R), use a separate 5V supply rated at 2 A or more, and connect its GND to the ESP32's GND.
- A 470 µF capacitor across the servo's 5V and GND helps stop resets when the motor starts.
- Avoid GPIO 2, 8 and 9 for the servo. They're strapping pins on the ESP32-C3.

### Installing the MicroPython controller
The web app expects the controller to run on the ESP32-C3's USB serial connection. The ESP32-C3 must already have MicroPython installed.

1. Install `mpremote` from the repository folder: `python -m pip install mpremote`.
2. Close the web app's serial connection and any serial monitor.
3. Copy the controller to the board as `main.py`: `python -m mpremote connect COM4 fs cp firmware/turntable/main.py :main.py`.
4. Restart the board so `main.py` starts: `python -m mpremote connect COM4 reset`.

The Arduino sketch is an alternative controller. To use it instead, install the Espressif **esp32** board package and **ESP32Servo** library, select **ESP32-C3 Dev Module**, enable **USB CDC On Boot**, then upload `firmware/turntable/turntable.ino`. Use only one controller at a time.

## Running the web app

The turntable connects over **USB serial** using Web Serial, which works in **Chrome or Edge on a computer**. Plug the ESP32 into the same computer that runs the app.

**Android phones (Samsung Galaxy etc.):** use **Chrome** and a plain **USB-C to USB-C cable** from the phone to the ESP32-C3's USB-C port. The app uses WebUSB there. Press *Start*, pick the ESP32 and tap *Allow*. If the ESP32 board has its own 5V supply, use it for big servos, since a phone gives limited power.

```
python3 -m http.server 8000
```
Open `http://localhost:8000`. The first time you press **Start**, pick the ESP32's port (often "USB JTAG/serial debug unit"). After that it reconnects automatically. Close the Arduino Serial Monitor first, because only one program can use the port at a time.

### Calibration
The app no longer has calibration controls. It uses the settings already stored on the turntable. To change them, send `C<ms>` (time for one spin), `V<us>` (speed) or `T<us>` (stop trim) from a serial monitor.

## Using it offline on a phone
Open https://wizkidzai.github.io/pyinsect/datacollector/ once with internet, then use the browser menu's **Add to Home screen**. After that it opens and takes photos with no internet.
