# Halo Blind Spot Simulator

Requires Node.js. Open a terminal in this folder and run:

```sh
node server.cjs
```

Open http://localhost:8080 on that computer. On a phone using the same Wi-Fi, open the address printed next to **Same Wi-Fi** that matches the computer’s Wi-Fi adapter. Local firewall and network settings may affect phone access. Stop the server with Ctrl+C.

The built-in sample is ready to use. Move the blue worker dot through the red rear zone to trigger the two warning panels and record a crossing.

To use your own drawing, upload a top-down PNG, JPEG, or WebP under 15 MB. If its scale bar says 5 m, enter **5**, click **Set scale**, and click the two ends of that 5 m span. The diagram fits the screen while the grid shows real distances and the sidebar shows the diagram's width and height in metres.

Choose **Add blind zone**, click the corners of a blind area in order, and choose **Finish zone**. Repeat for each blind zone. You can remove zones in the sidebar. Move the worker by tapping, dragging, or focusing the map and using the arrow keys. With a calibrated diagram, the worker marker represents a 0.5 m diameter and each arrow key press moves it 0.25 m.

Each browser runs its own simulation. The diagram and event history stay in memory in that tab and reset on reload. Halo checks the centre of the worker marker against every zone. The warnings stay active while the centre is inside any zone, and the log records each zone crossing separately.

## Move a vehicle and its blind zones

1. Upload a top-down diagram and calibrate it using the scale bar.
2. Enter the vehicle name, overall length, and overall width. Choose **Mark vehicle**, then click the centre of the rear edge followed by the centre of the front edge. These two points set the vehicle's centre and heading.
3. Trace the blind zones while the outline is aligned with the reference. Each zone attaches to that vehicle. The outline uses the dimensions you entered.
4. Choose **Move vehicle** and drag or tap on the map. Use **Heading** to rotate it. Hide **Show reference** to view the moving outline without the original drawing. Choose **Move worker** to control the worker again.

The sample loader is ready to move as soon as you open the app. Its starting proportions are illustrative.
