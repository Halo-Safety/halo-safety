<div align="center">

# 🦺 Halo Safety

**Context-aware safety monitoring for workers around heavy equipment.**

*natHacks 2026 · Construction & Manufacturing*

[**Web App**](https://halo-safety.vercel.app) · [**Simulation**](https://halo-safety.vercel.app/#simulation) · [**Project Roadmap**](roadmap.md)

<sub>The web app requires an invited account.</sub>

</div>

---

## Contents

- [About Halo](#about-halo)
- [The Problem](#the-problem)
- [Our Approach](#our-approach)
- [What We Built](#what-we-built)
- [Challenges & What We Learned](#challenges--what-we-learned)
- [What's Next](#whats-next)
- [Team & Links](#team--links)

---

## About Halo

**Halo** is a worker-safety prototype exploring ways to reduce struck-by hazards involving construction and industrial machinery. Instead of relying on proximity alone, our goal is to consider **where a worker is relative to a vehicle's blind zones** and whether a warning is relevant to the situation.

We combine wireless hardware experiments with a browser-based simulator and an event-monitoring dashboard.

## The Problem

Heavy equipment often has blind spots that make nearby workers difficult to see. Conventional warnings can be repetitive and lack context, contributing to alarm fatigue. We wanted to explore a system that could give both **workers and operators** clearer information about potential danger.

For background on the hazard, see [NIOSH construction equipment visibility research](https://www.cdc.gov/niosh/motor-vehicle/constructionequipmentvisibilitydiagram/).

## Our Approach

Our proposed system uses ESP32-based devices on the worker and vehicle to exchange wireless signals. RSSI measurements offer rough proximity estimates, while configurable blind zones and vehicle context could help distinguish a risky approach from ordinary nearby activity.

The aim is to notify both people involved, then record relevant events for later safety analysis. **Reliable positioning and physical warning devices still require integration and testing**; the current simulation demonstrates the scenario logic rather than real-world detection accuracy.

## What We Built

- **Scenario simulator:** Plan worker and vehicle routes, set speeds, define blind zones, and see warnings as their paths interact.
- **Halo dashboard:** A React web app with Supabase sign-in, event history, active alerts, and a seven-day activity chart.
- **Simulation activity:** Test alerts appear in their own workspace timeline, separate from real database records.
- **Hardware experiments:** Explored ESP32/ESP-NOW communication and RSSI readings, alongside a local Flask/SQLite event-logging prototype and a Python positioning experiment.

[Explore the code](frontend/) · [Frontend setup](frontend/README.md) · [Authentication setup](frontend/AUTH_SETUP.md)

## Challenges & What We Learned

RSSI readings fluctuate with interference, obstacles, and device orientation, making accurate distance estimation difficult. We experimented with averaging measurements and learned why wireless ranging needs careful calibration and validation.

We also worked through the challenges of connecting a teammate-built simulator, a React interface, and authenticated database access into one coherent experience.

## What's Next

Our priorities are to complete two-sided physical alerts, test positioning and warning latency under controlled conditions, and connect real devices to the dashboard securely. Longer-term ideas include improved ranging, richer hazard analysis, and tools for understanding recurring near misses.

These are **future goals**, not validated safety features. Halo is a research prototype, **not certified equipment or a replacement for established worksite safety procedures**.

## Team & Links

Built collaboratively for **natHacks 2026**. See our [contributors](https://github.com/Halo-Safety/halo-safety/graphs/contributors), [pull requests](https://github.com/Halo-Safety/halo-safety/pulls), and [project roadmap](roadmap.md).

<div align="center">

[Back to top](#-halo-safety)

</div>
