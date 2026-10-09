# Tick Scheduler

`OMLScheduler` queues work for the game's own thread. It is the supported way to leave a
non-game thread: a network inbound handler runs on a Netty thread, and the game objects it hands over —
a `ServerLevel`, a `ServerPlayer`, an inventory — are only safe to mutate from the thread that ticks them.

```kotlin
OMLScheduler.schedule(OMLSide.SERVER) {
    OMLGame.server?.broadcastMessage("synced from the packet thread")
}
```

## API

| Call                                                                   | Runs                      |
|------------------------------------------------------------------------|---------------------------|
| `schedule(side, delayTicks = 0, task)`                                  | once, after `delayTicks`   |
| `repeat(side, intervalTicks, initialDelay = 0, task)`                   | every `intervalTicks`      |
| `OMLTask.cancel()` / `OMLTask.canceled`                                 | stops it, idempotent        |

- `delayTicks = 0` means "the next tick". A task never runs earlier than the tick after it was
  queued, and queueing is safe from any thread.
- `repeat` requires `intervalTicks >= 1` — a zero period would re-enter the same tick forever.
- `cancel()` is safe from any thread and takes effect at the task's next due tick, so a repeating
  task does not run again after it.
- A task that throws is logged and dropped; the rest of that tick's queue still runs.

## Sides

`OMLSide` selects the queue, and each queue advances with its own tick event:

| Side     | Advanced by                                             |
|----------|---------------------------------------------------------|
| `CLIENT` | `CLIENT_TICK` — the client's logic/render thread         |
| `SERVER` | `SERVER_TICK` — dedicated or integrated server thread    |

::: warning A side that does not tick never runs your task
There is no client tick on a dedicated server, so a task queued for `OMLSide.CLIENT` there stays in
the queue indefinitely. Same in reverse: a client-only mod that queues for `OMLSide.SERVER` at the
main menu waits for a server that may never start. Queue for the side that owns the state you are
touching.
:::

In singleplayer both queues advance — the client thread and the integrated server thread are both
present — so one mod can hand work to either.

## Ordering

Tasks due on the same tick run in the order they were queued, and a task scheduled from inside a
running task is due on the next tick, not the current one. The scheduler has no wall-clock notion:
delays are ticks, so a paused game pauses the queue with it.
