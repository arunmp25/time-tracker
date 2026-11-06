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

## Installation and build guide

See [INSTALL.md](INSTALL.md) for per-OS prerequisites, development setup, packaging, installation, and troubleshooting.

## Run the interface

Install dependencies with `npm install`, then start the development server with `npm run dev`.
The current UI scaffold uses browser storage to preserve timer state while the interface is being built.

## Desktop app

The project now includes a Tauri 2 desktop shell targeting macOS and Windows. After installing the JavaScript and Rust prerequisites, run `npm run desktop:dev` for the desktop development window or `npm run desktop:build` to package it. The window has a desktop sized minimum layout and the frontend is loaded locally.

## Implementation status

The first React + TypeScript interface is in place: Today workday timer with Sessions and Tasks tabs, nested task list, task detail drawer, a day-selectable Reports view, and Settings for themes, text size, week start, and configurable task categories. Desktop profile names come from the operating system user account. The Mind map has a full task tree, collapsible nodes, drag positioning, independent sticky notes, and dependency connectors. Task details support descriptions, dependencies, and manual past-time entries. Timer elapsed time is derived from timestamps and the current browser storage model survives reloads on the same app profile.

SQLite persistence is not wired up yet. The current calendar/report screens are early views and need full date-range calculations, dependency editing/cycle checks, and database-backed migrations before they meet the product specification.
