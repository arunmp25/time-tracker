# Time Tracker

A local-first time tracker for recording daily work sessions and time spent on tasks.

## Product direction

- Start and pause a daily work timer. Each uninterrupted period is recorded as a separate session with timestamps.
- Track tasks and nested subtasks independently. Task time can accumulate across multiple days.
- Pausing the daily timer pauses any active task timer.
- Add dependencies between tasks and subtasks, and explore the hierarchy in a mind map.
- Review calendar views and weekly or monthly reports.
- Keep data on the user's device. Device-to-device sync is not part of the initial scope.

## Proposed technology

- Tauri 2 for desktop packaging, with Windows and macOS as initial targets.
- React and TypeScript for the user interface.
- Rust for timer operations and local data access.
- SQLite for local storage.
- React Flow for the task and dependency mind map.

The technology choices are a proposal and may be refined before implementation.

## Status

This repository is a starting point for the product specification and implementation.
