# Time Tracker — Product Specification

**Status:** Draft for review  
**Date:** 2026-11-05  
**Initial platform:** Windows and macOS desktop  
**Storage model:** Local-first; no account or device sync in the initial release

## 1. Product summary

Time Tracker is a personal work-time recorder. The user starts a daily work timer when work begins, starts timers on tasks or subtasks to allocate that work, and pauses the daily timer for breaks. Work sessions and task entries retain their start and end timestamps. A task can remain open across several days and accumulate time from multiple sessions.

The app also provides an activity calendar, weekly and monthly reports, and a mind map for nested tasks and dependencies. All initial-release data stays on the device.

## 2. Goals

- Make starting, pausing, and resuming work quick and clear.
- Record daily working time separately from task-level allocations.
- Preserve accurate, timestamped work history across pauses, app restarts, and multiple days.
- Support tasks with recursively nested subtasks and their own time tracking.
- Show task hierarchy and dependencies in a navigable mind map.
- Summarize work by day, week, month, task, and subtask.
- Keep initial-release data local to the user's computer.

## 3. Out of scope for the initial release

- Cloud accounts or syncing between devices.
- Shared workspaces, teams, or multiple users.
- Calendar scheduling or external calendar integrations. The calendar is a view of recorded time.
- Automatic activity detection or idle detection.
- Mobile distribution. The architecture should leave room for a later iPhone client, but the initial product targets desktop.

## 4. Core concepts

### 4.1 Daily work timer

The daily timer represents the user's active working day. It is independent of task selection: starting a task does not pause the daily timer. Daily working time is the sum of its completed and currently running work sessions; paused time is excluded.

The Today screen should focus on the total working time and the daily timer's start, pause/resume, and end controls. It should not display the calendar. Session history is available in the Calendar view.

### 4.2 Work sessions

A work session is one uninterrupted interval of an active daily timer. Starting the daily timer creates a session. Pausing or ending the daily timer closes that session. Resuming creates a new session. There is no separate lap feature.

Each session records a start timestamp and, when closed, an end timestamp. Breaks are the gaps between sessions and are not counted as work time.

### 4.3 Tasks and subtasks

Tasks are managed in a separate Tasks area. A task may contain multiple subtasks; subtasks may themselves contain subtasks. Each task or subtask can be started, paused, resumed, or stopped independently and can accumulate time over multiple dates.

A task remains available until the user marks it complete. Completing a task stops its active timer. Reopening a completed task is allowed only through an explicit user action.

### 4.4 Task time entries

Every uninterrupted task or subtask timer interval is a time entry linked to that item and to the applicable daily work session. Entries retain their own start and end timestamps. Pausing the daily timer closes the active work-item entry as well as the daily work session; resuming begins new intervals.

The daily timer measures total working time. Task and subtask entries allocate some of that time. Reports must not add the daily total to task totals as if they were separate work; task allocations are a breakdown of the workday. Time that has no task allocation may be shown as unassigned.

### 4.5 Dependencies

A dependency is a directed relation between any two tasks or subtasks, including items in different task trees. The relation means the prerequisite must be completed before the dependent item is ready. Dependency cycles are invalid.

In the mind map, solid connectors represent parent/subtask relationships. Dashed arrows represent dependencies and point toward the dependent item. A blocked item should show its incomplete prerequisite(s).

**Proposed default:** an item with incomplete dependencies cannot be started. See Open decisions.

## 5. Timer behavior and state rules

1. A task or subtask timer can start only while the daily timer is running. If the daily timer is paused, the user must resume the day before starting task time.
2. Starting a task leaves the daily timer running.
3. Pausing the daily timer closes the current daily session and pauses the currently running task/subtask timer, closing its active time entry.
4. Resuming the daily timer starts a new daily session. The previously active task/subtask resumes only if it was running when the day was paused and was not manually stopped or paused.
5. Manually pausing or stopping a task/subtask does not pause the daily timer.
6. Stopping a task timer ends its current time entry but does not complete the task. The task can be started again later, including on another date.
7. Ending the daily timer closes the current daily session and any active task/subtask entry. A later start begins a new session.
8. The elapsed display is derived from timestamps, not from assuming a periodic one-second tick was delivered. The app recalculates elapsed time when it returns to the foreground or is reopened.
9. Only one daily timer is active at a time. Handling attempts to start a second daily timer should be prevented or resolved by switching/ending the current day.
10. **Proposed default:** only one task-tree item timer accrues time at a time. Starting a subtask pauses its parent's direct timer; child time rolls up into the parent aggregate. This avoids counting the same minutes against both parent and child. See Open decisions.

## 6. Main screens and user flows

### 6.1 Today

- Shows the selected local date, total working time, and whether the daily timer is running or paused.
- Provides Start workday, Pause/Resume, and End workday actions as appropriate to the state.
- Shows a small session count or a link to session history; no calendar grid appears here.
- Starting the workday does not require choosing a task first.

### 6.2 Tasks

- Separate module for creating, editing, completing, and browsing tasks and nested subtasks.
- Each item shows its name, status, accumulated time, and timer controls.
- Task detail shows timestamped entries across all dates, with the date, start time, end time or running state, duration, and subtask attribution where relevant.
- Starting a blocked item follows the dependency rule in Section 4.5.

### 6.3 Mind map

- Provides a visual representation of task trees and cross-tree dependencies.
- Nodes show item name, item type, timer state, accumulated duration, and blocked/completed state.
- Users can open an item's details and access its timer controls from the node or its detail panel.
- Users can create subtasks and dependencies from the map, remove a dependency, and navigate large maps using zoom, pan, and collapse/expand controls.
- A user cannot create a dependency cycle.

### 6.4 Calendar

- Separate navigation destination, not part of the Today screen.
- Shows recorded daily work sessions by date. Selecting a date opens its sessions and associated task entries.
- Supports navigating days and weeks; a month overview may summarize which days contain recorded work.
- This is an activity calendar, not a planner.

### 6.5 Reports

- Weekly and monthly report ranges, based on the user's local calendar and week-start preference.
- Show total daily working time, total time by task and subtask, session counts, and unassigned working time where applicable.
- Allow drilling from a summary into the underlying timestamped entries.
- Clearly distinguish daily work totals from task allocations to avoid double counting.

## 7. Date, time, and reporting rules

- Persist timestamps as absolute instants (UTC) and retain the time-zone context needed to display the original local date and time accurately.
- Display dates and times in the user's configured local time zone.
- Report week and month boundaries are evaluated in that local time zone.
- A session that crosses midnight remains one uninterrupted session in history, while reports attribute its elapsed time to the local dates it overlaps.
- Durations are calculated from stored start/end timestamps. Paused gaps are not included.

## 8. Data and privacy

- Store tasks, parent/subtask relationships, dependency edges, work sessions, task time entries, preferences, and schema version in a local SQLite database.
- No network connection is required for normal timer, task, calendar, or report use.
- No telemetry, remote account, or remote copy of the user's time data is included in the initial release.
- Database schema changes use ordered migrations so future versions can add fields without discarding existing records.
- Each device has its own local data store. Sync or shared storage is a future feature and must not be implied by installing on more than one device.

## 9. Current technology

- **Electron:** desktop application shell, run from source without creating an installer.
- **React + TypeScript:** shared interface and product UI.
- **Electron preload + IPC:** narrow bridge for operating system information.
- **SQLite (`sql.js` WebAssembly):** relational on-device persistence written to `.tempo-data/tempo.sqlite` in the project directory.
- **Custom React mind map:** interactive task hierarchy, notes, and dependency edges.

Keep timer rules, storage access, reporting calculations, and UI components behind clear module boundaries. This allows later additions such as an iPhone client, exports, or device sync without requiring those features in the first release.

## 10. Reliability and usability requirements

- Starting, pausing, resuming, stopping, completing, or changing a timer must persist its state transition before the UI reports success.
- On app restart, the app must recover the last known timer state and calculate elapsed time from timestamps without duplicating an interval.
- If the app is closed while a timer is active, reopening should present the active timer and its elapsed duration. The user can then continue or close the interval; the app must not silently discard it.
- Timer controls and statuses must be understandable without relying only on color.
- The desktop interface must support keyboard navigation and readable layouts at common window sizes.
- Mind-map controls must remain usable when task trees are larger than the visible canvas.

## 11. Acceptance criteria for the initial release

1. A user can start a daily work timer without selecting a task.
2. The Today screen displays total active working time and allows pause, resume, and end actions.
3. Pauses divide daily work into distinct timestamped sessions; no lap action is required.
4. A task can be started while the daily timer runs without stopping the daily timer.
5. Pausing the daily timer closes the active work session and active task/subtask entry; paused time is excluded from totals.
6. A task and its nested subtasks can accumulate entries over multiple dates, and each entry retains start/end timestamps.
7. Tasks and subtasks appear in both a list/detail workflow and a mind map.
8. Dependencies can connect items across task trees, are shown as directed links, and cannot form cycles.
9. The calendar is a separate view and can show recorded sessions for a selected date.
10. Weekly and monthly reports reconcile to the stored sessions and task entries without double-counting.
11. Stopping or restarting the app does not lose already persisted time entries or cause elapsed time to reset.
12. All initial-release data remains local and the app's core functions work offline.
13. The app can be packaged for Windows and macOS from the same product codebase, with platform-specific builds.

## 12. Open decisions

1. **Parent and subtask timers:** Proposed default is that starting a subtask pauses the parent's direct timer, while the parent aggregate includes descendant time. Confirm whether the parent should instead continue timing concurrently.
2. **Dependency enforcement:** Proposed default is to block starting an item until all dependencies are complete. Confirm whether dependencies should block the timer or only display a warning.
3. **Daily timer after midnight:** Should an active daily timer continue until manually paused/ended, or should the app prompt the user at a chosen day boundary?
4. **Week start:** Should reports use the operating system locale's week start, or a user-selected preference?
5. **Task completion:** Should completing a task with incomplete subtasks or dependencies be allowed with a warning, or prevented?
6. **Data portability:** Is a manual backup/export feature required in the initial release, even though automatic device sync is out of scope?
