const { app, BrowserWindow, ipcMain, shell, Menu, Tray, Notification, nativeImage, screen } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const initSqlJs = require('sql.js');

const PROJECT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_DIR, '.tempo-data');
const DATABASE_FILE = path.join(DATA_DIR, 'tempo.sqlite');
const LEGACY_ELECTRON_PROFILE = path.join(app.getPath('appData'), 'time-tracker');
const isDev = process.argv.includes('--dev');
const hasSingleInstanceLock = app.requestSingleInstanceLock();
let databasePromise;
let legacyProfilePendingCleanup;
let mainWindow;
let tray;
let trayTaskItem;
let traySessionItem;
let quitInProgress = false;
let notifiedBreakSessionId;
const BREAK_REMINDER_AFTER_MS = 60 * 1000; // Temporary one-minute threshold for notification testing.

// Keep both Tempo's database and Chromium's profile/cache inside the project.
app.setName('Tempo');
for (const name of ['profile', 'session', 'crash-dumps']) {
  fs.mkdirSync(path.join(DATA_DIR, name), { recursive: true });
}
const legacyLocalStorage = path.join(LEGACY_ELECTRON_PROFILE, 'Local Storage');
const projectLocalStorage = path.join(DATA_DIR, 'session', 'Local Storage');
if (!fs.existsSync(DATABASE_FILE) && fs.existsSync(legacyLocalStorage) && !fs.existsSync(projectLocalStorage)) {
  try {
    fs.cpSync(legacyLocalStorage, projectLocalStorage, { recursive: true });
    legacyProfilePendingCleanup = LEGACY_ELECTRON_PROFILE;
  } catch (error) {
    console.error('Could not copy the previous Electron profile into the project data folder', error);
  }
}
app.setPath('userData', path.join(DATA_DIR, 'profile'));
app.setPath('sessionData', path.join(DATA_DIR, 'session'));
app.setPath('crashDumps', path.join(DATA_DIR, 'crash-dumps'));

function createWindow() {
  const window = new BrowserWindow({
    title: 'Tempo · Time Tracker',
    icon: path.join(__dirname, 'app-icon.png'),
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow = window;
  window.once('ready-to-show', () => window.show());
  window.on('minimize', event => { event.preventDefault(); window.hide(); });
  window.on('closed', () => { if (mainWindow === window) mainWindow = null; });
  const resizeForDisplay = () => {
    if (window.isDestroyed()) return;
    const display = screen.getDisplayMatching(window.getBounds());
    const scale = Math.min(display.workAreaSize.width / 1280, display.workAreaSize.height / 820);
    const factor = Math.max(0.95, Math.min(1.3, scale * 1.18));
    window.setMinimumSize(Math.max(960, Math.ceil(900 * factor)), 640);
    window.webContents.setZoomFactor(factor);
  };
  window.once('did-finish-load', resizeForDisplay);
  window.on('move', resizeForDisplay);
  if (isDev) {
    window.loadURL('http://127.0.0.1:1420');
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}


function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

if (hasSingleInstanceLock) {
  app.on('second-instance', showMainWindow);
}

async function stopRunningTimers() {
  const db = await getDatabase();
  const stamp = Date.now();
  db.run('UPDATE sessions SET end = ? WHERE end IS NULL', [stamp]);
  db.run('UPDATE task_entries SET end = ? WHERE end IS NULL', [stamp]);
  db.run('UPDATE app_state SET active_task_id = NULL, resume_task_id = NULL WHERE id = 1');
  persistDatabase(db);
}

app.on('before-quit', event => {
  if (!hasSingleInstanceLock || quitInProgress) return;
  event.preventDefault();
  quitInProgress = true;
  stopRunningTimers()
    .catch(error => console.error('Could not stop active timers before quitting', error))
    .finally(() => app.quit());
});

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'tray.png'));
  tray = new Tray(icon.resize({ width: 20, height: 20 }));
  tray.setToolTip('Tempo · Time Tracker');
  const menu = Menu.buildFromTemplate([
    { label: 'Current task: None', enabled: false },
    { label: 'Work session: Not running', enabled: false },
    { type: 'separator' },
    { label: 'Show Tempo', click: showMainWindow },
    { type: 'separator' },
    { label: 'Quit Tempo', role: 'quit' },
  ]);
  trayTaskItem = menu.items[0];
  traySessionItem = menu.items[1];
  tray.setContextMenu(menu);
  tray.on('click', showMainWindow);
  tray.on('double-click', showMainWindow);
  refreshTrayStatus();
}

function formatTrayDuration(ms) {
  const centiseconds = Math.floor(Math.max(0, ms) / 10);
  const seconds = Math.floor(centiseconds / 100);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
}

function showBreakReminder() {
  const thresholdLabel = BREAK_REMINDER_AFTER_MS < 60 * 60 * 1000 ? 'one minute' : 'one hour';
  const body = `Your work session has passed ${thresholdLabel}. Take a short break when you can.`;
  if (process.platform === 'darwin') {
    execFile('/usr/bin/osascript', ['-e', `display notification "${body}" with title "Tempo" sound name "Glass"`], error => {
      if (error) console.error('Could not show the macOS break reminder', error);
    });
    return;
  }
  if (!Notification.isSupported()) {
    console.error('System notifications are not supported on this computer');
    return;
  }
  const notification = new Notification({
    title: 'Time for a break',
    body,
    icon: path.join(__dirname, 'app-icon.png'),
  });
  notification.on('failed', (_event, error) => console.error('Could not show the break reminder', error));
  notification.show();
}

async function refreshTrayStatus() {
  if (!trayTaskItem || !traySessionItem) return;
  try {
    const store = loadStoreFromDatabase(await getDatabase());
    const task = store?.tasks.find(item => item.id === store.activeTaskId && !item.done);
    const session = store?.sessions.find(item => !item.end);
    const name = task?.name ?? 'None';
    trayTaskItem.label = `Current task: ${name.length > 48 ? `${name.slice(0, 45)}…` : name}`;
    traySessionItem.label = `Work session: ${session ? formatTrayDuration(Date.now() - session.start) : 'Not running'}`;
    if (!session) notifiedBreakSessionId = undefined;
    else if (session.id !== notifiedBreakSessionId && Date.now() - session.start >= BREAK_REMINDER_AFTER_MS) {
      notifiedBreakSessionId = session.id;
      showBreakReminder();
    }
  } catch (error) {
    console.error('Could not refresh tray status', error);
  }
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') });
      const db = fs.existsSync(DATABASE_FILE)
        ? new SQL.Database(new Uint8Array(fs.readFileSync(DATABASE_FILE)))
        : new SQL.Database();
      db.exec(`
        PRAGMA foreign_keys = ON;
        PRAGMA user_version = 3;
        CREATE TABLE IF NOT EXISTS app_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          settings_json TEXT NOT NULL,
          active_task_id TEXT,
          resume_task_id TEXT
        );
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          start INTEGER NOT NULL,
          end INTEGER
        );
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          parent_id TEXT,
          kind TEXT,
          category TEXT,
          category_color TEXT,
          dependencies_json TEXT NOT NULL,
          done INTEGER NOT NULL,
          project_color TEXT,
          map_width REAL,
          map_height REAL,
          priority TEXT,
          importance TEXT,
          planned_date TEXT,
          created_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS task_entries (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          start INTEGER NOT NULL,
          end INTEGER,
          session_id TEXT,
          manual INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS mindmap_notes (
          id TEXT PRIMARY KEY,
          root_task_id TEXT NOT NULL,
          text TEXT NOT NULL,
          color TEXT NOT NULL,
          x REAL NOT NULL,
          y REAL NOT NULL,
          width REAL,
          height REAL
        );
        CREATE TABLE IF NOT EXISTS calendar_events (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          date TEXT NOT NULL,
          time TEXT,
          notes TEXT,
          color TEXT NOT NULL,
          reminder INTEGER NOT NULL DEFAULT 0
        );
      `);
      const taskColumns = new Set((db.exec('PRAGMA table_info(tasks)')[0]?.values ?? []).map(column => column[1]));
      if (!taskColumns.has('project_color')) db.run('ALTER TABLE tasks ADD COLUMN project_color TEXT');
      if (!taskColumns.has('map_width')) db.run('ALTER TABLE tasks ADD COLUMN map_width REAL');
      if (!taskColumns.has('map_height')) db.run('ALTER TABLE tasks ADD COLUMN map_height REAL');
      if (!taskColumns.has('priority')) db.run('ALTER TABLE tasks ADD COLUMN priority TEXT');
      if (!taskColumns.has('importance')) db.run('ALTER TABLE tasks ADD COLUMN importance TEXT');
      if (!taskColumns.has('planned_date')) db.run('ALTER TABLE tasks ADD COLUMN planned_date TEXT');
      if (!taskColumns.has('created_at')) db.run('ALTER TABLE tasks ADD COLUMN created_at INTEGER');
      const noteColumns = new Set((db.exec('PRAGMA table_info(mindmap_notes)')[0]?.values ?? []).map(column => column[1]));
      if (!noteColumns.has('width')) db.run('ALTER TABLE mindmap_notes ADD COLUMN width REAL');
      if (!noteColumns.has('height')) db.run('ALTER TABLE mindmap_notes ADD COLUMN height REAL');
      return db;
    })();
  }
  return databasePromise;
}

function rows(db, sql) {
  const result = db.exec(sql)[0];
  if (!result) return [];
  return result.values.map(values => Object.fromEntries(result.columns.map((column, index) => [column, values[index]])));
}

function persistDatabase(db) {
  const temporaryFile = `${DATABASE_FILE}.tmp`;
  fs.writeFileSync(temporaryFile, Buffer.from(db.export()));
  fs.renameSync(temporaryFile, DATABASE_FILE);
}

function loadStoreFromDatabase(db) {
  const [metadata] = rows(db, 'SELECT settings_json, active_task_id, resume_task_id FROM app_state WHERE id = 1');
  if (!metadata) return null;
  const entries = rows(db, 'SELECT id, task_id, start, end, session_id, manual FROM task_entries');
  const tasks = rows(db, 'SELECT id, name, description, parent_id, kind, category, category_color, dependencies_json, done, project_color, map_width, map_height, priority, importance, planned_date, created_at FROM tasks')
    .map(task => ({
      id: task.id,
      name: task.name,
      description: task.description ?? undefined,
      parentId: task.parent_id ?? undefined,
      kind: task.kind ?? undefined,
      category: task.category ?? undefined,
      categoryColor: task.category_color ?? undefined,
      projectColor: task.project_color ?? undefined,
      mapWidth: task.map_width ?? undefined,
      mapHeight: task.map_height ?? undefined,
      priority: task.priority ?? undefined,
      importance: task.importance ?? undefined,
      plannedDate: task.planned_date ?? undefined,
      createdAt: task.created_at ?? undefined,
      dependencies: JSON.parse(task.dependencies_json || '[]'),
      done: Boolean(task.done),
      entries: entries.filter(entry => entry.task_id === task.id).map(entry => ({
        id: entry.id,
        start: entry.start,
        end: entry.end ?? undefined,
        sessionId: entry.session_id ?? undefined,
        manual: Boolean(entry.manual),
      })),
    }));
  return {
    sessions: rows(db, 'SELECT id, start, end FROM sessions').map(session => ({ ...session, end: session.end ?? undefined })),
    tasks,
    mindmapNotes: rows(db, 'SELECT id, root_task_id, text, color, x, y, width, height FROM mindmap_notes').map(note => ({
      id: note.id, rootTaskId: note.root_task_id, text: note.text, color: note.color, x: note.x, y: note.y,
      width: note.width ?? undefined, height: note.height ?? undefined,
    })),
    calendarEvents: rows(db, 'SELECT id, title, date, time, notes, color, reminder FROM calendar_events').map(event => ({
      id: event.id, title: event.title, date: event.date, time: event.time ?? undefined,
      notes: event.notes ?? undefined, color: event.color, reminder: Boolean(event.reminder),
    })),
    settings: JSON.parse(metadata.settings_json),
    activeTaskId: metadata.active_task_id ?? undefined,
    resumeTaskId: metadata.resume_task_id ?? undefined,
  };
}

function runInsert(db, sql, records, valuesForRecord) {
  const statement = db.prepare(sql);
  try {
    for (const record of records) statement.run(valuesForRecord(record));
  } finally {
    statement.free();
  }
}

function saveStoreToDatabase(db, store) {
  db.run('BEGIN TRANSACTION');
  try {
    db.exec('DELETE FROM task_entries; DELETE FROM tasks; DELETE FROM sessions; DELETE FROM mindmap_notes; DELETE FROM calendar_events; DELETE FROM app_state;');
    runInsert(db, 'INSERT INTO sessions (id, start, end) VALUES (?, ?, ?)', store.sessions ?? [], session => [session.id, session.start, session.end ?? null]);
    runInsert(db, 'INSERT INTO tasks (id, name, description, parent_id, kind, category, category_color, dependencies_json, done, project_color, map_width, map_height, priority, importance, planned_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', store.tasks ?? [], task => [
      task.id, task.name, task.description ?? null, task.parentId ?? null, task.kind ?? null,
      task.category ?? null, task.categoryColor ?? null, JSON.stringify(task.dependencies ?? []), task.done ? 1 : 0,
      task.projectColor ?? null, task.mapWidth ?? null, task.mapHeight ?? null,
      task.priority ?? null, task.importance ?? null, task.plannedDate ?? null, task.createdAt ?? null,
    ]);
    runInsert(db, 'INSERT INTO task_entries (id, task_id, start, end, session_id, manual) VALUES (?, ?, ?, ?, ?, ?)', (store.tasks ?? []).flatMap(task => (task.entries ?? []).map(entry => ({ ...entry, taskId: task.id }))), entry => [
      entry.id, entry.taskId, entry.start, entry.end ?? null, entry.sessionId ?? null, entry.manual ? 1 : 0,
    ]);
    runInsert(db, 'INSERT INTO mindmap_notes (id, root_task_id, text, color, x, y, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', store.mindmapNotes ?? [], note => [note.id, note.rootTaskId, note.text, note.color, note.x, note.y, note.width ?? null, note.height ?? null]);
    runInsert(db, 'INSERT INTO calendar_events (id, title, date, time, notes, color, reminder) VALUES (?, ?, ?, ?, ?, ?, ?)', store.calendarEvents ?? [], event => [
      event.id, event.title, event.date, event.time ?? null, event.notes ?? null, event.color, event.reminder ? 1 : 0,
    ]);
    runInsert(db, 'INSERT INTO app_state (id, settings_json, active_task_id, resume_task_id) VALUES (1, ?, ?, ?)', [store], value => [
      JSON.stringify(value.settings), value.activeTaskId ?? null, value.resumeTaskId ?? null,
    ]);
    db.run('COMMIT');
    persistDatabase(db);
  } catch (error) {
    try { db.run('ROLLBACK'); } catch {}
    throw error;
  }
}

ipcMain.handle('tempo:get-system-username', () => os.userInfo().username);
ipcMain.handle('tempo:get-data-directory', () => DATA_DIR);
ipcMain.handle('tempo:open-data-directory', async () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return shell.openPath(DATA_DIR);
});
ipcMain.handle('tempo:load-store', async () => loadStoreFromDatabase(await getDatabase()));
ipcMain.handle('tempo:save-store', async (_event, store) => {
  saveStoreToDatabase(await getDatabase(), store);
  refreshTrayStatus();
  if (legacyProfilePendingCleanup) {
    try { fs.rmSync(legacyProfilePendingCleanup, { recursive: true, force: true }); legacyProfilePendingCleanup = undefined; }
    catch (error) { console.error('Tempo data was migrated, but the old Electron profile could not be removed', error); }
  }
});
ipcMain.handle('tempo:clear-store', async () => {
  const db = await getDatabase();
  db.run('BEGIN TRANSACTION');
  try {
    db.exec('DELETE FROM task_entries; DELETE FROM tasks; DELETE FROM sessions; DELETE FROM mindmap_notes; DELETE FROM calendar_events; DELETE FROM app_state;');
    db.run('COMMIT');
    persistDatabase(db);
  } catch (error) {
    try { db.run('ROLLBACK'); } catch {}
    throw error;
  }
});

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) return;
  if (process.platform === 'darwin') app.dock.setIcon(path.join(__dirname, 'app-icon.png'));
  createTray();
  setInterval(refreshTrayStatus, 1000);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => { /* Keep Tempo alive so the tray can reopen it. */ });
