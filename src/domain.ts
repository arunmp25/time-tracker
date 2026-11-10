export type Session = { id: string; start: number; end?: number };
export type Entry = { id: string; start: number; end?: number; sessionId?: string; manual?: boolean };
export type Task = { id: string; name: string; description?: string; parentId?: string; parentIds?: string[]; kind?: 'project' | 'task'; category?: string; categoryColor?: string; projectColor?: string; priority?: 'low'|'medium'|'high'|'urgent'; importance?: 'low'|'medium'|'high'; plannedDate?: string; createdAt?: number; completedAt?: number; mapWidth?: number; mapHeight?: number; notes?: string; notesColor?: string; dependencies?: string[]; done: boolean; entries: Entry[] };
export type MindmapNote = { id: string; rootTaskId: string; text: string; color: string; x: number; y: number; width?: number; height?: number };
export type CalendarEvent = { id: string; title: string; date: string; time?: string; notes?: string; color: string; reminder: boolean };
export type CategorySetting = { name: string; color: string };
export type AppSettings = { theme: 'light'|'dark'|'classic'; fontSize: 'small'|'medium'|'large'; weekStart: 'Monday'|'Sunday'; categories: CategorySetting[] };
export type Store = { sessions: Session[]; tasks: Task[]; mindmapNotes: MindmapNote[]; calendarEvents: CalendarEvent[]; settings: AppSettings; activeTaskId?: string; resumeTaskId?: string };
const KEY = 'tempo-local-v1';
export const defaultSettings: AppSettings = { theme:'light', fontSize:'medium', weekStart:'Monday', categories:[{name:'Work',color:'#4f9d69'},{name:'Personal',color:'#886bd1'},{name:'Admin',color:'#5182c4'},{name:'Learning',color:'#d89237'},{name:'Health',color:'#df6f7b'}] };
export const emptyStore: Store = { sessions: [], tasks: [], mindmapNotes: [], calendarEvents: [], settings: defaultSettings };
export function normalizeStore(saved: Partial<Store>): Store {
  const tasks = saved.tasks ?? [];
  const existingNotes = saved.mindmapNotes ?? [];
  const migratedNotes = tasks.flatMap(task => {
    if (!task.notes?.trim()) return [];
    let root = task; while (root.parentId) { const parent = tasks.find(t => t.id === root.parentId); if (!parent) break; root = parent; }
    return [{ id: uid(), rootTaskId: root.id, text: task.notes, color: task.notesColor ?? 'yellow', x: 700, y: 80 + existingNotes.length * 170 }];
  });
  const normalizedAt = Date.now();
  const taskIds = new Set(tasks.map(task => task.id));
  const cleanedTasks = tasks.map(({ notes: _notes, notesColor: _notesColor, ...task }) => ({
    ...task,
    ...(() => { const parentIds = task.kind === 'project' ? [] : [...new Set(parentIdsOf(task))].filter(id => id !== task.id && taskIds.has(id)); return { parentIds, parentId: parentIds[0] }; })(),
    createdAt: task.createdAt ?? task.entries?.[0]?.start ?? normalizedAt,
    completedAt: task.done ? task.completedAt ?? (Math.max(0, ...(task.entries ?? []).map(entry => entry.end ?? entry.start)) || task.createdAt || undefined) : undefined,
    priority: task.kind === 'project' ? undefined : task.priority ?? 'medium',
    importance: task.kind === 'project' ? undefined : task.importance ?? 'medium',
    entries: task.kind === 'project' ? (task.entries ?? []).map(entry => entry.end ? entry : { ...entry, end: normalizedAt }) : task.entries ?? [],
  }));
  return {
    ...emptyStore,
    ...saved,
    calendarEvents: saved.calendarEvents ?? [],
    settings: { ...defaultSettings, ...saved.settings, categories: saved.settings?.categories ?? defaultSettings.categories },
    tasks: cleanedTasks,
    activeTaskId: tasks.find(task => task.id === saved.activeTaskId && task.kind !== 'project')?.id,
    resumeTaskId: tasks.find(task => task.id === saved.resumeTaskId && task.kind !== 'project')?.id,
    mindmapNotes: [...existingNotes, ...migratedNotes],
  };
}
export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeStore(JSON.parse(raw) as Partial<Store>) : emptyStore;
  } catch { return emptyStore; }
}
export function saveStore(s: Store) { localStorage.setItem(KEY, JSON.stringify(s)); }
export function clearLegacyStore() { localStorage.removeItem(KEY); }
export const activeSession = (s: Store) => s.sessions.find(x => !x.end);
export function elapsed(items: { start: number; end?: number }[], now = Date.now()) { return items.reduce((n, x) => n + Math.max(0, (x.end ?? now) - x.start), 0); }
export const totalTaskMs = (t: Task, s: Store, now = Date.now()): number => { const ids = descendantIds(t.id, s.tasks); return (t.kind === 'project' ? 0 : elapsed(t.entries, now)) + s.tasks.filter(x => ids.has(x.id) && x.kind !== 'project').reduce((n, x) => n + elapsed(x.entries, now), 0); };
/* ---- Task graph helpers: a task may have several parents and several children ---- */
export function parentIdsOf(task: Pick<Task, 'parentId' | 'parentIds'>): string[] { return task.parentIds?.length ? task.parentIds : task.parentId ? [task.parentId] : []; }
export function childrenOf(id: string, tasks: Task[]): Task[] { return tasks.filter(task => parentIdsOf(task).includes(id)); }
export function ancestorIds(id: string, tasks: Task[]): Set<string> { const out = new Set<string>(); const queue = [...parentIdsOf(tasks.find(t => t.id === id) ?? {})]; while (queue.length) { const next = queue.shift()!; if (out.has(next)) continue; out.add(next); const task = tasks.find(t => t.id === next); if (task) queue.push(...parentIdsOf(task)); } return out; }
export function descendantIds(id: string, tasks: Task[]): Set<string> { const out = new Set<string>(); const queue = [id]; while (queue.length) { const next = queue.shift()!; for (const child of childrenOf(next, tasks)) if (!out.has(child.id) && child.id !== id) { out.add(child.id); queue.push(child.id); } } return out; }
export function projectsOf(task: Task, tasks: Task[]): Task[] { const ids = ancestorIds(task.id, tasks); return tasks.filter(t => t.kind === 'project' && ids.has(t.id)); }
export function withParents(task: Task, parentIds: string[]): Task { const unique = [...new Set(parentIds)].filter(id => id !== task.id); return { ...task, parentIds: unique, parentId: unique[0] }; }
/** True when making `parentId` a parent of `childId` would create a loop. */
export function wouldCreateParentCycle(childId: string, parentId: string, tasks: Task[]): boolean { return childId === parentId || descendantIds(childId, tasks).has(parentId); }
export function fmt(ms: number) { const sec = Math.floor(ms / 1000), h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
export function fmtTimer(ms: number) { return `${fmt(ms)}.${String(Math.floor(Math.max(0,ms)%1000/10)).padStart(2,'0')}`; }
export const uid = () => crypto.randomUUID();
export function localDay(ts: number) { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function durationOnDay(start:number,end:number,day:string) { const [y,m,d]=day.split('-').map(Number);const from=new Date(y,m-1,d).getTime();const to=new Date(y,m-1,d+1).getTime();return Math.max(0,Math.min(end,to)-Math.max(start,from)); }

/** Local midnight that starts the day after `ts`. */
export function nextMidnight(ts: number): number { const d = new Date(ts); d.setHours(24, 0, 0, 0); return d.getTime(); }

/**
 * Sessions belong to a single calendar day. If the running session started on an earlier day,
 * close it at midnight and continue in a new session for each following day. The running task's
 * open time entry is split the same way and moved to the new session, so tracking never stops.
 */
export function rolloverSessions(store: Store, now = Date.now()): Store {
  let current = activeSession(store);
  if (!current || localDay(current.start) === localDay(now)) return store;
  let sessions = store.sessions, tasks = store.tasks;
  while (current && nextMidnight(current.start) <= now) {
    const boundary = nextMidnight(current.start);
    const closing: Session = current;
    const next: Session = { id: uid(), start: boundary };
    sessions = [...sessions.map(s => s.id === closing.id ? { ...s, end: boundary } : s), next];
    tasks = tasks.map(task => {
      const open = task.entries.find(e => !e.end && e.sessionId === closing.id);
      if (!open) return task;
      return { ...task, entries: [...task.entries.map(e => e.id === open.id ? { ...e, end: boundary } : e), { id: uid(), start: boundary, sessionId: next.id }] };
    });
    current = next;
  }
  return { ...store, sessions, tasks };
}
