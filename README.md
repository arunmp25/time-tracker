# Time Tracker

A local-first time tracker for recording daily work sessions and time spent on tasks.

## Product direction

- Start and pause a daily work timer. Each uninterrupted period is recorded as a separate session with timestamps.
- Track tasks and nested subtasks independently. Task time can accumulate across multiple days.
- Pausing the daily timer pauses any active task timer.
- Add dependencies between tasks and subtasks, and explore the hierarchy in a mind map.
- Review calendar views and weekly or monthly reports.
- Keep data on the user's device. Device-to-device sync is not part of the initial scope.

## Technology

- Electron provides the desktop window and operating system bridge.
- React and TypeScript power the user interface.
- Contributors run the desktop app from source; installer packaging is not part of the current workflow.
- App data is stored locally in the Electron profile; cloud sync and SQLite are not wired up.

## Installation and build guide

See [INSTALL.md](INSTALL.md) for setup and run commands.

## Run the interface

Install dependencies with `npm ci`, then start the browser interface with `npm run dev`.

## Desktop app

The project uses Electron for its desktop shell. Contributors need Git and Node.js with npm; Electron and the frontend tools are installed as npm dependencies. Run `npm run desktop:run` to build and open the app, or `npm run desktop:dev` for the live-reload development window. See [INSTALL.md](INSTALL.md) for details.

## Implementation status

The app includes work sessions and task timers, nested projects/tasks, a draggable mind map with notes and dependencies, configurable categories, local calendar events and reminders, reports, light/dark themes, and text-size settings. Desktop profile names come from the operating system account. Data remains local to the user's application profile and is not synced.
