---
title: 'In praise of boring interfaces'
date: 2026-07-18
description: 'Stable seams are often a better optimization target than clever implementations.'
tags: ['architecture', 'apis']
---

Interfaces become expensive when every caller has to know how they work internally. A boring interface hides that knowledge and gives the implementation room to change. {{< note >}}This is less about REST versus RPC and more about minimizing the amount of shared context required between components.{{< /note >}}

## A seam is a promise

A useful seam says less than the implementation behind it. The smaller the promise, the more freedom exists on both sides.

```go
type Store interface {
    Get(ctx context.Context, key string) ([]byte, error)
    Put(ctx context.Context, key string, value []byte) error
}
```

### Make failure visible

Failures should be explicit enough to be handled, without forcing callers to understand the storage engine.

## Optimize for replacement

The best boundary is often one that allows an implementation to disappear. {{< note >}}Replacement is a useful design test even if you never plan to swap the implementation. It exposes accidental coupling early.{{< /note >}}

That pushes complexity inward, where it can be tested and changed without spreading through the rest of the system.

## Closing thought

Clever internals can be valuable. Clever contracts usually become somebody else's maintenance problem.
