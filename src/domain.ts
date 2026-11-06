export type Session = { id: string; start: number; end?: number };
export type Entry = { id: string; start: number; end?: number; sessionId?: string; manual?: boolean };
export type Task = { id: string; name: string; description?: string; parentId?: string; kind?: 'project' | 'task'; category?: string; categoryColor?: string; notes?: string; notesColor?: string; dependencies?: string[]; done: boolean; entries: Entry[] };
export type MindmapNote = { id: string; rootTaskId: string; text: string; color: string; x: number; y: number };
export type CalendarEvent = { id: string; title: string; date: string; time?: string; notes?: string; color: string; reminder: boolean };
export type CategorySetting = { name: string; color: string };
export type AppSettings = { theme: 'light'|'dark'; fontSize: 'small'|'medium'|'large'; weekStart: 'Monday'|'Sunday'; categories: CategorySetting[] };
export type Store = { sessions: Session[]; tasks: Task[]; mindmapNotes: MindmapNote[]; calendarEvents: CalendarEvent[]; settings: AppSettings; activeTaskId?: string; resumeTaskId?: string };
const KEY = 'tempo-local-v1';
export const defaultSettings: AppSettings = { theme:'light', fontSize:'medium', weekStart:'Monday', categories:[{name:'Work',color:'#4f9d69'},{name:'Personal',color:'#886bd1'},{name:'Admin',color:'#5182c4'},{name:'Learning',color:'#d89237'},{name:'Health',color:'#df6f7b'}] };
export const emptyStore: Store = { sessions: [], tasks: [], mindmapNotes: [], calendarEvents: [], settings: defaultSettings };
export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return emptyStore;
    const saved = JSON.parse(raw) as Partial<Store>; const tasks = saved.tasks ?? [];
    const existingNotes = saved.mindmapNotes ?? [];
    const migratedNotes = tasks.flatMap(task => {
      if (!task.notes?.trim()) return [];
      let root = task; while (root.parentId) { const parent = tasks.find(t => t.id === root.parentId); if (!parent) break; root = parent; }
      return [{ id: uid(), rootTaskId: root.id, text: task.notes, color: task.notesColor ?? 'yellow', x: 700, y: 80 + existingNotes.length * 170 }];
    });
    const cleanedTasks = tasks.map(({ notes: _notes, notesColor: _notesColor, ...task }) => task);
    return { ...emptyStore, ...saved, calendarEvents:saved.calendarEvents??[], settings:{...defaultSettings,...saved.settings,categories:saved.settings?.categories??defaultSettings.categories}, tasks: cleanedTasks, mindmapNotes: [...existingNotes, ...migratedNotes] };
  }
  catch { return emptyStore; }
}
export function saveStore(s: Store) { localStorage.setItem(KEY, JSON.stringify(s)); }
export const activeSession = (s: Store) => s.sessions.find(x => !x.end);
export function elapsed(items: { start: number; end?: number }[], now = Date.now()) { return items.reduce((n, x) => n + Math.max(0, (x.end ?? now) - x.start), 0); }
export const totalTaskMs = (t: Task, s: Store, now = Date.now()): number => elapsed(t.entries, now) + s.tasks.filter(x => x.parentId === t.id).reduce((n, x) => n + totalTaskMs(x, s, now), 0);
export function fmt(ms: number) { const sec = Math.floor(ms / 1000), h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
export function fmtTimer(ms: number) { return `${fmt(ms)}.${String(Math.floor(Math.max(0,ms)%1000)).padStart(3,'0')}`; }
export const uid = () => crypto.randomUUID();
export function localDay(ts: number) { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function durationOnDay(start:number,end:number,day:string) { const [y,m,d]=day.split('-').map(Number);const from=new Date(y,m-1,d).getTime();const to=new Date(y,m-1,d+1).getTime();return Math.max(0,Math.min(end,to)-Math.max(start,from)); }
