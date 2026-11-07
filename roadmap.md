# Halo — Hackathon Project Roadmap

Based on `halo-safety/message.txt` for natHacks 2026.

## Goal and scope

Build a demonstrable worker-safety prototype: a worker tag detects proximity to a machine beacon, both devices alert, and a dashboard records the encounter. Device alerts must work without internet or the dashboard.

The brief's under-100 ms warning is a target to measure, not an established capability. RSSI provides a rough proximity estimate; this prototype must not be presented as certified safety equipment or as proving a precise distance.

**MVP:** two ESP32 devices, proximity detection, worker vibration, operator buzzer and LED, and dashboard event logging.

**Stretch:** multiple anchors for rough sectors, IMU motion gating, and live dashboard updates.

**Future:** UWB ranging and systematic field validation.

## 1. Agree on the demo and divide responsibilities

- [ ] Confirm hackathon deadline, submission format, available hardware, and team availability.
- [ ] Assign owners for firmware, sensing, dashboard, demo assembly, and research/pitch. Combine roles if needed.
- [ ] Choose one core scenario: a tagged worker approaches a stationary tabletop machine model, both alerts activate, and the dashboard records it.
- [ ] Explain that the MVP uses proximity alone; blind-sector and moving-machine conditions belong to the stretch version.
- [ ] Choose ESP-NOW or BLE after a small hardware feasibility check; avoid maintaining both implementations.
- [ ] Agree on a demo threshold, event format, and hardware-to-dashboard connection.

**Done when:** everyone knows their task, the MVP boundary, and how the components will connect.

## 2. Prove the hardware and radio link

- [ ] Inventory two ESP32 boards, a vibration motor, suitable motor driver and power supply, buzzer, LED, resistors, and wiring.
- [ ] Verify board flashing and serial output on both boards.
- [ ] Test vibration and cab buzzer/LED independently. Drive the motor through suitable circuitry rather than directly from a GPIO.
- [ ] Send identified heartbeats between tag and beacon; confirm the selected radio stack exposes usable RSSI.
- [ ] Measure packet reception and RSSI at several marked near/far positions and tag orientations.
- [ ] Decide early whether the hardware can support the demo. If necessary, use a clearly labeled phone or simulated-input fallback; document which hardware behavior it does not reproduce.

**Done when:** the radio link and both physical alert outputs work independently.

## 3. Build the two-device alert loop

- [ ] Include device ID and sequence number in heartbeat messages.
- [ ] Smooth RSSI readings and calibrate a near/far threshold in the demo environment.
- [ ] Add separate entry and exit thresholds, plus a brief stability rule, to reduce alarm chatter.
- [ ] Implement clear states: normal, danger, and connection fault.
- [ ] Define which device decides proximity and how the other device receives and acknowledges an alert.
- [ ] Activate worker vibration and operator buzzer/LED on a danger transition.
- [ ] Detect missed heartbeats; show a visible fault instead of silently treating disconnection as safe.
- [ ] Keep alarm processing independent of dashboard delivery. Verify alerts with the laptop disconnected.

**Done when:** entering and leaving the configured proximity zone produces stable two-way alerts without a dashboard connection.

## 4. Build event logging and the dashboard

Dashboard work can start alongside firmware once the event format is agreed.

- [ ] Define a shared event record: event ID, worker ID, machine ID, event type, sequence number, timestamp, RSSI, and optional estimated distance.
- [ ] Label distance as an estimate. Distinguish device time from laptop receipt time if clocks are not synchronized.
- [ ] Select a bridge, such as machine ESP32 serial output to a Python collector. Local collection should not require internet.
- [ ] Build a Flask dashboard with encounter history and device connection status.
- [ ] Store events locally in SQLite or another agreed persistent format.
- [ ] Record an encounter once per danger entry, with an exit or duration where practical, rather than logging every heartbeat as a new near-miss.
- [ ] Deduplicate retransmitted events and test that records survive a dashboard restart.
- [ ] Label staged demonstration events as simulated near-misses.

**Done when:** a physical alert generates an identifiable, persistent dashboard record without the dashboard controlling the alarm.

## 5. Integrate and validate the MVP

- [ ] Run repeated approach/retreat trials using marked positions and different orientations.
- [ ] Check boundary behavior: lingering near the threshold should not rapidly toggle alerts.
- [ ] Measure local detection and both alert outputs separately; report sample count, typical latency, worst observed latency, and misses.
- [ ] Separate radio/processing latency from filtering delay and physical threshold-crossing detection. Do not claim under 100 ms from dashboard timestamps alone.
- [ ] Turn off either device and confirm the remaining device reports the connection fault.
- [ ] Disconnect the dashboard and verify both local alerts still work.
- [ ] Reconnect and verify new event logging resumes; document whether disconnected events are buffered or lost.
- [ ] Test restart behavior and remove duplicate or stale event displays.
- [ ] Record RSSI limitations, including obstruction and orientation sensitivity, in the README.

**Done when:** the complete demonstration is repeatable and its measured limits are documented. Fix failures here before adding stretch features.

## 6. Add stretch features only after MVP validation

### Rough sector detection

- [ ] Add machine anchors and identify which anchors provide usable directional differences.
- [ ] Select and cite a specific NIOSH blind-area diagram for the demo machine type.
- [ ] Map the diagram to prototype sectors and label uncertain readings as unknown.
- [ ] Test front, rear, and side approaches; measure classification errors before using sectors to suppress alerts.

### Motion sensing

- [ ] Connect and calibrate the MPU6050 for a stationary-versus-moving experiment.
- [ ] Test vibration and sensor drift before enabling any motion-based alarm gating.
- [ ] Define behavior for missing or uncertain sensor readings.
- [ ] Treat reversing detection as a separate experiment: an IMU alone may not reliably establish travel direction. Use a reliable direction input or clearly labeled simulated signal if necessary.

### Live dashboard

- [ ] Add WebSocket updates, active encounters, and device last-seen indicators.
- [ ] Preserve local alarm behavior if live updates fail.

**Done when:** each added feature improves the demo without making the core alerts unreliable.

## 7. Prepare the pitch and submission

- [ ] Update the README with board types, wiring, flashing, dependencies, startup steps, and demo procedure.
- [ ] Verify the safety statistics and cite their original sources before including them in the pitch.
- [ ] Explain the problem, show the approach-alert-log sequence, and identify the intended site-safety audience.
- [ ] Present measured results and distinguish implemented features from planned features.
- [ ] Explain the production path: UWB evaluation, multi-worker/multi-machine testing, interference testing, enclosure and battery work, and qualified safety validation.
- [ ] Rehearse within the allotted presentation time.
- [ ] Prepare a backup recording and screenshots if permitted.
- [ ] Submit the repository, demo links, and required materials before the deadline.

**Done when:** the submission opens correctly and the team can deliver the demo consistently.

## Suggested allocation of remaining time

| Work | Share |
| --- | --- |
| Scope, setup, and hardware feasibility | 15% |
| Firmware alerts and dashboard MVP | 40% |
| Integration, calibration, and validation | 25% |
| Documentation, pitch, and submission | 20% |

Stretch work uses spare time after MVP validation. Set actual checkpoints once the deadline is known.

## First team checkpoint

1. Assign owners and confirm the hardware inventory.
2. Prove one radio heartbeat and both alert outputs.
3. Agree on the event record and dashboard bridge.
4. Build the first complete approach-alert-log demonstration.
