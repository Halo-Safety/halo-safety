# Halo — 2:20 screen-recorded business demo

**Purpose:** A software-first video showing how Halo helps a safety team go from observations to reviewed cases and corrective action. The ESP32 hardware is an experimental integration, *not* a precise or certified safety sensor.

## Recording preparation

1. Use the invited demo account `test@ualberta.ca` and open `https://halo-safety.vercel.app/#overview`. The Overview now combines **sample business cases/actions** with a separate clearly labeled **live sensor activity** panel on the same screen. There is no mode toggle. Business demo data are explicitly fictional.
2. Record at 1920×1080 or 1600×900 in a desktop browser, ideally 100% scaling, no notification pop-ups. Collapse unrelated tabs, keep cursor movement slow.
3. Familiarize yourself with a sample Case and the simulator's controls before recording. Do the simulation portion as a separate clip if setup takes too long.
4. Changes to sample case classifications, notes and actions exist **in browser memory only** and reset after refresh. Avoid refreshing between running the simulation and showing its Case. When replaying, start from a fresh session to keep the story clean.
5. Do not claim that FTM positions are accurate, that the sample cases are real, or that simulation events go into live Supabase events. Keep visible **Fictional demo** / **Experimental** labels.
6. For hardware footage, power three anchor ESP32s and the worker ESP32 as usual. Show the actual connected setup and the raw ranges in Hardware; the FTM map is for illustration, not a reliability claim.

## Shot-by-shot sequence (total 140 seconds)

| Time | Show on screen | Spoken focus |
| --- | --- | --- |
| **0:00–0:10** | Halo logo, logged-in main workspace | “Halo is a safety intelligence platform for teams working around heavy equipment.” |
| **0:10–0:33** | **Overview**. Move cursor across four KPI cards and priority queue. | “Managers see the cases needing attention, reviewed near misses, open corrective actions, and the equipment involved. The numbers in this walkthrough are fictional examples.” |
| **0:33–0:56** | Open priority **Case**. Select a sample record; show classification, separate case status, supporting observations and existing action. | “A detection is not automatically a confirmed near miss. Halo preserves observations so a person can review the event and decide what needs investigation.” |
| **0:56–1:12** | **Vehicles**. Select a loader/forklift and show equipment ownership, operator and linked cases. | “Cases are connected to the equipment, location and operating context, helping teams find recurring issues.” |
| **1:12–1:42** | **Simulation**. Start a prepared worker approach into a blind zone. Capture the warning. Click **Review as sample case**. | “The simulator demonstrates how a proximity alert could be generated. We keep it isolated from live data, then turn the simulated observation into a candidate for human review.” |
| **1:42–2:00** | **Cases**. The new `SIM-...` case appears. Expand **Review & corrective action** in the new SIM case (it opens automatically). Choose **Reviewed near miss**, enter a short fictional reviewer comment, set **Case status** to **Action assigned**, fill out the automatically expanded corrective action (owner and due date), then click **Save review**. | “An observed hazard can lead to a tracked task, such as reviewing blind-zone layout and pedestrian routing. In this walkthrough, the case and action are temporary demo data.” |
| **2:00–2:14** | **Telemetry** tab; briefly show raw FTM anchor ranges and the experimental map. | “Halo can also ingest measurements from physical hardware. Our ESP32 setup is an experimental source, and its positioning accuracy is still limited.” |
| **2:14–2:20** | Short physical ESP32 shot and Halo end card. | “The goal is actionable safety follow-up, regardless of which sensor produced the initial observation.” |

### Editing tips

- Cut between screens; do not include long scrolling, login typing, calibration or loading waits.
- Keep the business workflow at least ~110 seconds and hardware footage ~6–12 seconds.
- Pause briefly on the **SIM-** candidate before assigning the example action so reviewers see the end-to-end connection.
- Use a clear corner overlay such as **Illustrative demo — not real incidents** during fictional case footage and **Experimental hardware** during ESP32 footage.
- If the hardware upload is stale, show the last measurement timestamp rather than claiming real-time connectivity.

## Honest scope of the prototype

**Working:** Supabase auth and organization data, sample workflow and cloud record editing, browser simulation, sandbox candidate/action handoff, FTM cloud ingestion and experimental 2D map.

**Not implemented/validated:** trustworthy high-accuracy ESP32 worker positioning, physical warning devices, automatic incident classification from FTM readings, or safety-certified detection. The candidate/review/action workflow in this video is **demo-only** (stored in browser memory), not a production ingestion workflow.
