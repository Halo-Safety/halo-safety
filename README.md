# Halo Safety 🦺

**Most systems warn you after you're already in danger. Halo stops the machine before it reaches you.**

Halo is a collision-prevention and safety-analytics platform for construction and
industrial sites. It warns a ground worker *and* the equipment operator the instant
a worker is on a path to enter a machine's blind zone - it can trigger the machine
to stop - and it turns every near-miss into site safety intelligence.

*natHacks 2026 · Construction & Manufacturing*

---

## Why this isn't "just another proximity alarm"

A basic proximity buzzer warns the operator once a worker is already close. That's
the baseline - and it's the thing everyone ignores. Halo is three steps past that:

1. **It predicts the collision**, not just detects proximity - it reacts to a
   worker *converging* on a moving machine, a moment earlier than a fixed radius.
2. **It can stop the machine**, not just beep - the danger signal drives a machine
   interlock (demonstrated live on our rig: the machine physically halts).
3. **It produces safety intelligence** - every near-miss becomes a heatmap and a
   shift report that tells a site *where, when, and which machine* is dangerous, so
   they fix the process, not just react to one alarm.

That's the difference between a gadget and a system a safety officer would buy.

---

## The problem

On construction and industrial sites, being struck by moving equipment is a leading
cause of worker death. The operator physically cannot see a worker in the machine's
blind spot, and the standard backup beeper warns the already-desensitized operator
while giving the worker on the ground nothing. Per NIOSH, ground-worker struck-by
incidents are about 73% of transportation-related work-zone fatalities, and roughly
half happen while a vehicle is backing up.

**Who we protect:** the ground worker in the blind spot, and the operator who can't
see them.

---

## What it does

- Each **worker** wears a tag (built into a hard hat / hi-vis vest).
- Each **machine** carries beacon anchors and knows its own blind zones.
- When a worker is converging on a machine's blind zone while the machine is active,
  Halo responds in under 100 ms:
  - the worker's tag **vibrates**,
  - the operator's cab unit **buzzes, flashes, and shows the threat on an OLED**,
  - and the **machine interlock halts the drive** (shown live on our model).
- The **analytics dashboard** logs every close call and renders a site heatmap plus
  an auto-generated shift safety report.

---

## Standout features (what makes Halo win)

### 1. Predictive convergence, not just proximity
Halo watches the *rate of change* of the signal. A worker walking away at 1.9 m is
fine; a worker closing fast at 2.5 m while the machine reverses toward them is not.
We alarm on the trajectory, earlier than a static radius.

### 2. Machine interlock (auto-stop)
The danger signal doesn't only warn - it can command the machine to slow or stop.
On our demo rig, a servo representing the machine's drive physically halts the
instant danger fires. Production integrates with the equipment's existing interlock.

### 3. Safety-analytics layer
Near-misses are data. The dashboard shows a **site heatmap** (which zone/machine/
time is most dangerous) and generates a **shift safety report**. This is the
continuation story - the thing insurers and safety officers pay for.

### 4. Grounded, worker-specific, infrastructure-free
Only tagged people trigger it (not a pile of rebar). No GPS, no internet - devices
talk directly over radio. Blind sectors come from NIOSH's *measured* blind-area
diagrams, not guesses.

---

## How it works

```
 Worker Tag (ESP32)        Machine (ESP32 anchors + IMU + interlock)      Laptop
 +-------------+   radio    +-------------------------------+   radio    +-----------+
 | scans RSSI  |<---------->| beacons ID + blind zones;     |<---------->| Gateway   |
 | predicts    | heartbeat  | IMU = moving? cab OLED+buzzer; |  alerts    | heatmap + |
 | convergence |            | servo interlock halts drive   |            | shift     |
 | vibrates    |            +-------------------------------+            | report    |
 +-------------+                                                         +-----------+
```

Pipeline:

1. **Heartbeat.** Every device broadcasts a small radio packet ~10x/second (ESP-NOW
   or BLE advertising).
2. **Distance.** On each packet, read signal strength (RSSI), smooth it, convert to
   an estimated distance.
3. **Convergence.** Track how fast distance is closing (rate of change) to predict a
   collision before the worker is in the zone.
4. **Sector.** 2-3 anchors on the machine -> compare RSSI -> which side the worker is
   on (front / rear / left / right).
5. **Machine state.** An IMU tells us whether the machine is moving / reversing.
6. **Response (on the device).** When a worker is converging on a blind sector while
   the machine is active: vibrate the tag, fire the cab alert, and trigger the
   interlock. Filtering (smoothing + hysteresis + dwell) prevents false alarms.

### The distance math

```
distance = 10 ^ ( ( measuredPower - rssi ) / ( 10 * n ) )
```

- `measuredPower` = RSSI calibrated at exactly 1 metre (e.g. -59 dBm).
- `n` = path-loss exponent (about 2 open air, 3-4 near metal).
- Example: measuredPower -59, n 2.5, rssi -80 -> `10^(21/25) = 6.8 m`.

You tune the threshold empirically; you need a stable in/out decision, not exact
metres.

---

## Implementation guide

Build in this order. Each step is demonstrable on its own, so you always have
something working.

### Step 1 - Two ESP32s + smoothed RSSI (MVP core)

```cpp
// Worker tag: keep a smoothed RSSI so one noisy packet does not trigger us.
float smoothedRssi = -70.0;          // start near a typical value
const float smoothingFactor = 0.2;   // 0..1; lower = smoother but slower

void onHeartbeatReceived(int rawRssi) {
  // Exponential moving average: blend the new reading into the running value.
  smoothedRssi = (smoothingFactor * rawRssi) + ((1.0 - smoothingFactor) * smoothedRssi);
}

float estimateDistanceMeters(float rssi) {
  // Log-distance path-loss model. Calibrate these two per environment.
  float measuredPowerAtOneMeter = -59.0;  // RSSI measured at exactly 1 m
  float pathLossExponent = 2.5;           // ~2 open air, 3-4 near metal
  float exponent = (measuredPowerAtOneMeter - rssi) / (10.0 * pathLossExponent);
  return pow(10.0, exponent);
}
```

### Step 2 - Predictive convergence (standout feature #1)

```cpp
// Track whether the worker is closing in, not just how far away they are.
float previousDistance = 99.0;
unsigned long previousTime = 0;

bool isConverging(float currentDistance) {
  unsigned long now = millis();
  float secondsElapsed = (now - previousTime) / 1000.0;
  if (secondsElapsed <= 0) {
    return false;  // avoid dividing by zero on the first call
  }

  // Closing speed in metres per second. Negative means getting closer.
  float closingSpeed = (currentDistance - previousDistance) / secondsElapsed;

  previousDistance = currentDistance;
  previousTime = now;

  // Worker is approaching fast enough to matter (tune the threshold).
  if (closingSpeed < -0.5) {
    return true;
  }
  return false;
}
```

### Step 3 - The response (alert + interlock, with anti-chatter)

```cpp
const float enterZoneMeters = 2.0;   // fire when closer than this
const float clearZoneMeters = 3.0;   // clear only when farther than this (hysteresis)
const unsigned long dwellMs = 300;   // must stay dangerous this long before firing

bool alarmActive = false;
unsigned long inZoneSince = 0;

void updateResponse(float distance, bool converging, bool inBlindSector, bool machineMoving) {
  // Danger = in range OR converging fast, AND in a blind sector, AND machine active.
  bool inRange = (distance < enterZoneMeters) || converging;
  bool dangerous = inRange && inBlindSector && machineMoving;

  if (dangerous) {
    if (inZoneSince == 0) {
      inZoneSince = millis();          // start the dwell timer
    }
    if (millis() - inZoneSince >= dwellMs) {
      alarmActive = true;              // sustained danger: fire
    }
  } else if (distance > clearZoneMeters || !machineMoving) {
    alarmActive = false;               // clear with hysteresis / machine stopped
    inZoneSince = 0;
  }

  if (alarmActive) {
    startVibration();                  // warn the worker locally, now
    sendAlertPacket();                 // tell the cab unit + gateway
    triggerMachineInterlock();         // standout feature #2: stop the drive
  } else {
    stopVibration();
    releaseMachineInterlock();
  }
}
```

### Step 4 - Sector detection

```cpp
// Decide which side of the machine the worker is on by strongest anchor signal.
String whichSector(float rssiFront, float rssiLeftRear, float rssiRightRear) {
  if (rssiFront >= rssiLeftRear && rssiFront >= rssiRightRear) {
    return "front";
  }
  if (rssiLeftRear >= rssiRightRear) {
    return "left-rear";
  }
  return "right-rear";
}
```

### Step 5 - Machine motion (IMU)
Read the 9-DOF IMU; if acceleration/rotation exceeds a small threshold, the machine
is "moving." If the IMU falls through, a push button simulates reverse for the demo.

### Step 6 - Interlock (standout feature #2)
On alarm, drive a micro servo on the machine model to the "stopped" position (and an
on-board LED/relay in a real build). This is what makes the demo unforgettable.

### Step 7 - Blind-zone data (credibility)
Use NIOSH's measured blind-area diagrams, not invented zones.
- Index: https://www.cdc.gov/niosh/motor-vehicle/constructionequipmentvisibilitydiagram/
- All machines (PDF): https://www.cdc.gov/niosh/motor-vehicle/constructionequipmentvisibilitydiagram/pdfs/catreport2.pdf

Pick 2-3 machines (wheel loader, dump truck, skid steer). Read each at the 1500 mm
plane (standing-worker height); the gray wedge is the blind area. Encode per machine
ID a list of blind sectors + a danger radius; the beacon broadcasts its machine type.

### Step 8 - Safety-analytics dashboard (standout feature #3)
Gateway ESP32 forwards every event to the laptop. The dashboard (Python + WebSocket
+ simple HTML) shows:
- a live feed of near-misses,
- a **site heatmap** (count by machine / sector / time),
- an auto-generated **shift safety report**.

---

## What you need (from the natHacks hardware list)

- 4x ESP32 V2 *(MVP needs 2)* - tag + machine anchors / cab / gateway
- 1x Vibrating disk motor + 1x Vibrating motor Driver Board - worker alert
- 1x Buzzer (Assorted Buzzers) - cab alarm
- 1x Miniature wired multicolor LED - cab warning light
- 1x OLED Module (128x64) - cab threat display
- 1x 9-DOF IMU + 1x STEMMA QT 4-pin cable - machine motion (no soldering)
- 1x Micro servo - the machine interlock (auto-stop demo)
- 1x Switch (button) - manual reverse trigger / testing
- 1x Li-po 3.7V 400mAh - powers the wearable tag (ESP32 V2 charges it over USB-C)
- 2x 400 Points Breadboard
- 1x Wire pack male-male, 1x Wire pack female-male
- 1x Assorted Resistors (~220-330Ω for the LED)

**Why these:** ESP32 V2 has onboard LiPo charging + USB-C + STEMMA QT, so battery and
IMU plug in with no soldering. Drive the vibrating motor through its driver board, not
straight off a GPIO pin (back-EMF).

**MVP if stock is low:** 2x ESP32 V2 + disk motor + driver + buzzer + LED + breadboard
+ jumpers. Zero ESP32 -> two phones.

---

## Scope tiers

- **MVP:** 2 devices, proximity alarm, worker + cab alert, dashboard log.
- **Standout:** + predictive convergence + machine interlock (auto-stop) + analytics
  heatmap + hard-hat form factor.
- **Production (say in the pitch):** swap RSSI for UWB (10-30 cm ranging, true angle);
  integrate with the machine's real interlock.

---

## Roles (5 people)
 
Two clear duties per person.
 
**1. Firmware & Radio**
- Get the ESP32s exchanging heartbeats and reading RSSI (plus the IMU and anchors).
- Drive the outputs: vibration motor, cab buzzer/LED, and the interlock servo.
**2. Decision Logic (the brains)**
- Turn RSSI into distance + predictive convergence (closing speed).
- Write the fire/clear rule using sector + machine-motion, with anti-chatter filtering.
**3. Analytics & Dashboard**
- Gateway: log every event from the devices to the laptop.
- Build the web dashboard: live feed + site heatmap + shift report.
**4. Hardware & Product**
- Build the wearable tag (hard hat / vest) and the cab unit.
- Build the machine model with the auto-stop servo rig so the demo looks real.
**5. Research, Safety & Pitch**
- NIOSH blind-zone data + the 250/600-word submissions.
- Slides, demo script, and the backup video.
**Handoffs:** Firmware feeds raw anchor RSSI + IMU to Decision Logic (it computes
sector and motion). Research hands the NIOSH zone numbers to Decision Logic to plug
in. Everyone tests their own piece; Role 5 runs the dress rehearsal.
 
---

## Demo (and why it can't fail)

1. Worker near the machine, machine idle / facing forward -> silent (operator sees you).
2. Worker converges on the rear sector, machine "reverses" -> tag vibrates, cab buzzes
   + OLED shows "WORKER - REAR - 1.8 m", and **the machine servo halts**.
3. Step back -> system clears, machine releases.
4. Show the dashboard heatmap filling with near-misses + the shift report.

**Record a clean run Sunday** as a backup video (natHacks allows video inside the live
demo). If the live radio misbehaves, play the clip and keep talking.

---

## 64-hour timeline (Fri 7 PM -> Mon 11 AM)

- **Fri night:** repo + toolchains; 2 ESP32s exchanging heartbeats; raw RSSI printing.
- **Sat AM:** smoothing + distance + threshold -> tag vibrates on approach. MVP alarm.
- **Sat PM:** cab alert + OLED + gateway + basic dashboard. Lock the MVP.
- **Sat night:** sector detection + NIOSH zones; add the servo interlock.
- **Sun AM:** predictive convergence; IMU motion; tune filtering/hysteresis/dwell.
- **Sun PM:** analytics heatmap + shift report; hard-hat form factor; record backup
  video; write 250/600-word submissions; slides.
- **Sun night:** full dress rehearsal + Q&A; freeze code.
- **Mon AM:** submit by 11:00, buffer for breakage.

---

## Risks & mitigations

- **RSSI noisy near metal** -> smoothing + hysteresis + dwell; generous demo threshold;
  name UWB as the production fix.
- **Body blocks 2.4 GHz** -> wear the tag high (hard hat / shoulder); acknowledge it.
- **Hardware shortage** -> MVP needs 2 boards; phones are the fallback.
- **Live demo flakes** -> pre-recorded backup video.
- **Scope creep** -> MVP is locked before any standout feature is attempted.

## Sources
- NIOSH Construction Equipment Visibility - blind-area diagrams.
