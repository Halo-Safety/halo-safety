<a id="top"></a>
<div align="center">

# 🦺 Halo Safety

**Context-aware worker safety monitoring around heavy machinery.**

*natHacks 2026 · Debug Warriors · Construction & Manufacturing*

[**Web App**](https://halo-safety.vercel.app) · [**Try the Simulator**](https://halo-safety.vercel.app/#simulation) · [**FTM Gateway Setup**](docs/ftm-cloud-uplink.md) · [**Project Roadmap**](roadmap.md)

<sub>Access to the web app is invitation-managed. Ask the team for a walkthrough account.</sub>

</div>

---

## Contents

- [About Halo](#about-halo)
- [Try Halo](#try-halo)
- [The Problem](#the-problem)
- [Our Approach](#our-approach)
- [What We Built](#what-we-built)
- [Challenges & What We Learned](#challenges--what-we-learned)
- [What's Next](#whats-next)
- [Team & Links](#team--links)

## About Halo

**Halo** is a worker-safety prototype exploring how to reduce struck-by hazards around construction and industrial equipment. Our idea is to go beyond a simple *worker nearby* alarm: **where is the worker relative to the vehicle, which areas are hazardous, and what should happen after a warning?**

Halo combines ESP32 wireless-ranging experiments with a configurable blind-zone simulator and a web platform for reviewing alerts, investigating potential near misses, and tracking corrective actions.

## Try Halo

1. Open the [Halo web app](https://halo-safety.vercel.app) and sign in with a team-provided account. The app does not offer public self-registration. Use the demo account.
   - Email: `test@ualberta.ca`
   - Password: `abcde12345`
2. **Overview:** Explore cases awaiting review, corrective actions, equipment, and the sensor-activity section.
3. **Active alerts & Event history:** See proximity warnings, their timestamps, and alert-cleared events.
4. **Simulation:** [Open the simulator](https://halo-safety.vercel.app/#simulation), move a worker into a vehicle's blind zone, or configure worker/vehicle routes and run a scenario.
5. **Cases:** Choose **Review case** after a simulated alert. Classify the observation, add a review note, and assign a corrective action. Return to Overview to see the updated workflow.
6. **Vehicles & Telemetry:** Explore equipment records, ESP32 ranging measurements, and the experimental 2D worker-position map.

**Walkthrough note:** The invited presentation account uses example cases and events for the software demonstration. Its simulator-generated cases and edits stay in the browser session rather than being written to the incident database. Other organization accounts access their permitted persistent records in Supabase.

## The Problem

Loaders, forklifts, dump trucks, and other heavy machines have blind spots that make nearby workers hard to see. Conventional proximity alarms can be noisy or lack context, creating alarm fatigue. We wanted to explore clearer warnings for **both workers and operators**, backed by a way for safety teams to follow up on hazardous situations.

For background, see [NIOSH construction-equipment visibility research](https://www.cdc.gov/niosh/motor-vehicle/constructionequipmentvisibilitydiagram/).

## Our Approach

Our proposed system places wireless-ranging anchors at known positions around a vehicle, with a portable device carried by a worker. Distance measurements from multiple anchors can be used for **trilateration** to estimate the worker's position relative to the vehicle.

That estimated position could then be checked against **configurable, vehicle-specific danger zones**. Future versions would also consider operating state, travel direction, and movement to make warnings more relevant and reduce unnecessary alarms.

The prototype explores this architecture in two complementary parts:

- **Software:** A browser simulator detects when a virtual worker enters a defined blind zone. The dashboard visualizes alerts and supports investigation and corrective-action workflows.
- **Hardware:** ESP32 experiments use wireless communication and ranging techniques, including RSSI, ESP-NOW, and Wi-Fi FTM. A Python gateway can upload experimental FTM distances to Supabase, where the web app computes and plots a 2D estimate using a nonlinear least-squares solver.

These two parts are **not yet an end-to-end validated physical hazard detector**. The FTM data stream does not automatically create confirmed safety incidents or trigger physical warning devices.

## What We Built

- **Interactive scenario simulator:** Define blind zones, customize vehicle geometry, move workers and vehicles, set routes and speeds, and observe warning and clearance transitions.
- **Safety operations dashboard:** React/Vite app with Supabase authentication, an overview of cases and corrective actions, proximity alerts, event history, and a seven-day activity chart.
- **Case review & corrective actions:** Review candidate observations, classify near misses, false alarms, or device faults, add investigation notes, assign follow-up tasks, and track case status. Organization records can be stored in Supabase; walkthrough case edits are session-only.
- **Vehicles:** Equipment inventory, ownership and operating context, assigned operators, and linked safety cases.
- **Cloud-connected experimental telemetry:** A local Python gateway sends ESP32 Wi-Fi FTM measurements through a scoped Supabase Edge Function into an organization-protected database. The Telemetry page shows received ranges and gateway activity.
- **Live 2D worker map (experimental):** Configure three vehicle-relative anchor positions and visualize a least-squares position estimate with quality checks and recent position traces.
- **Embedded hardware experiments:** Explored ESP32/ESP-NOW communication, RSSI variability, Wi-Fi FTM ranging, and a local Flask/SQLite prototype.

### System overview

```text
ESP32 FTM anchors ── wireless ranging ── Worker ESP32
                                              │ USB serial
                                              ▼
                                   Local Python gateway
                                              │ HTTPS
                                              ▼
                                Supabase FTM measurements
                                              │
                                              ▼
                                  Halo Telemetry / 2D map

Browser simulation ── local warning events ── Case review / corrective action
```

The simulator's event flow is independent of the hardware telemetry pipeline. They are not represented as a single connected physical detection system.

[Frontend source](frontend/) · [Run the frontend locally](frontend/README.md) · [Authentication setup](frontend/AUTH_SETUP.md) · [FTM cloud uplink details](docs/ftm-cloud-uplink.md)

## Challenges & What We Learned

**Wireless ranging accuracy was our main hardware challenge.** RSSI fluctuated with interference, obstruction, device orientation, and the surrounding environment. We experimented with smoothing and explored Wi-Fi FTM as an alternative, but the measurements were not reliable enough to validate accurate real-world worker positioning.

We also learned a lot about integrating ESP32 firmware, Python collection, a React simulator, Supabase authentication, and a safety-management workflow into one project. A particularly useful design decision was **not treating every proximity trigger as a confirmed near miss**: potential incidents require human review and appropriate follow-up.

## What's Next

- Improve ranging accuracy and validate trilateration across different distances, orientations, and environments.
- Finish physical worker vibration and operator visual/audio alerts, then measure their detection and warning latency.
- Connect validated hardware detection to the event and case workflows, including device-failure and stale-reading handling.
- Expand danger-zone logic to account for vehicle operating state, direction, and motion.
- Test with multiple workers and machines, and evaluate false-alarm rates under realistic site conditions.

**Halo is an early-stage research/hackathon prototype, not certified safety equipment or a replacement for established worksite safety procedures.** Position estimates, dynamic zone adaptation, and physical alerting require further validation.

## Team & Links

Built by **Debug Warriors** — Thomas, Jerry, Vlad, and Ruslan — for **natHacks 2026**.

[Contributors](https://github.com/Halo-Safety/halo-safety/graphs/contributors) · [Pull requests](https://github.com/Halo-Safety/halo-safety/pulls) · [Project roadmap](roadmap.md)

<div align="center">

[Back to top](#top)

</div>
