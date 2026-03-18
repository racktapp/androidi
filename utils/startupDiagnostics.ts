export type StartupDiagnosticEntry = {
  id: number;
  message: string;
  level: 'info' | 'error';
  timestamp: string;
};

type Listener = (entries: StartupDiagnosticEntry[]) => void;

let nextId = 1;
let entries: StartupDiagnosticEntry[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener(entries));
}

function pushEntry(message: string, level: 'info' | 'error') {
  const entry: StartupDiagnosticEntry = {
    id: nextId++,
    message,
    level,
    timestamp: new Date().toISOString(),
  };

  entries = [...entries.slice(-39), entry];

  const tag = level === 'error' ? 'error' : 'log';
  console[tag](`[startup] ${message}`);
  emit();
}

export function logStartup(message: string) {
  pushEntry(message, 'info');
}

export function logStartupError(message: string) {
  pushEntry(message, 'error');
}

export function getStartupEntries() {
  return entries;
}

export function subscribeToStartupDiagnostics(listener: Listener) {
  listeners.add(listener);
  listener(entries);

  return () => {
    listeners.delete(listener);
  };
}
