---
title: 'Queues, backpressure, and the lie of infinite buffers'
date: 2025-11-03
description: 'A queue is not just storage between two components; it is part of the control system.'
tags: ['distributed-systems', 'performance']
---

A queue lets producers and consumers disagree temporarily about pace. The word that matters is *temporarily*.

## Buffers move the problem

Large buffers can turn an overload signal into latency. {{< note >}}This is why queue depth is often more informative when paired with queue age. A short queue of very old work can be worse than a longer queue moving quickly.{{< /note >}}

## Backpressure is a protocol

Backpressure needs an observable signal, a policy, and a place where work can be rejected or delayed.
