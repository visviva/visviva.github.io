+++
title = "Understanding the Vis-Viva Equation"
description = "A quick introduction to the equation that connects orbital speed, distance, and energy."
date = "2026-08-16"
draft = false
tags = ["orbital-mechanics", "physics"]
+++

The vis-viva equation is one of the most useful shortcuts in orbital mechanics. It gives an object's speed at any point in a Keplerian orbit:

`v² = μ(2/r − 1/a)`

Here, `v` is orbital speed, `μ` is the central body's standard gravitational parameter, `r` is the current distance from its center, and `a` is the orbit's semi-major axis.

<!--more-->

## Why speed changes

In an elliptical orbit, distance and speed change together. A spacecraft moves fastest near periapsis, where `r` is smallest, and slowest near apoapsis, where `r` is largest. The equation expresses conservation of orbital energy in a compact form.

For a circular orbit, `r` and `a` are equal, so the equation simplifies to:

`v = √(μ/r)`

## A simple workflow

To use the equation:

1. Choose consistent units for distance and `μ`.
2. Determine the current radius `r` and semi-major axis `a`.
3. Substitute the values and solve for the positive value of `v`.
4. Check that the result uses the expected speed units.

This same relationship helps estimate transfer-orbit velocities, compare circular and elliptical trajectories, and calculate the velocity changes required for orbital maneuvers.
