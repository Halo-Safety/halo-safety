# Halo Blind Spot Simulator

Requires Node.js. Open a terminal in this folder and run:

```sh
node server.cjs
```

Open http://localhost:8080 on that computer. On a phone using the same Wi-Fi, open the address printed next to **Same Wi-Fi** that matches the computer’s Wi-Fi adapter. Local firewall and network settings may affect phone access. Stop the server with Ctrl+C.

The built-in sample is ready to use. Move the blue worker dot through the red rear zone to trigger the two warning panels and record a crossing.

To use your own drawing, upload a top-down PNG, JPEG, or WebP under 15 MB. Enter a known reference length in metres, click **Set scale**, and mark both ends of the reference. Choose **Trace zone**, click the corners of a blind area in order, and choose **Finish zone**. Move the worker by tapping, dragging, or focusing the map and using the arrow keys.

Each browser runs its own simulation. The diagram and event history stay in memory in that tab and reset on reload. The scale records pixels per metre, and the warning decision checks whether the worker enters the traced polygon. This is a tabletop-style simulation driven by map input.
