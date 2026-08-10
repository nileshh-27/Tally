import { useState, useEffect, useRef, useCallback } from 'react';
import { subscribeToTasks, startTask, pauseTask, finishTask, createTask, updateTask, deleteTask, Task } from './tasks';
import { syncTaskToCalendar } from './googleCalendar';
import { auth, db } from './config';
import { collection, onSnapshot, query, doc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export type SessionEvent = { id: string; taskId: string; startedAt: string; pausedAt?: string; resumedAt?: string; endedAt?: string; pauseReason?: string; distractionReason?: string; type?: string; timestamp?: string; duration?: number };
export type RevisionItem = { id: string; topic: string; subject: string; dueDate: string; intervalDays: number; status: 'due' | 'upcoming' | 'reviewed'; nextReviewDate?: string; taskId?: string };
export type Store = { tasks: Task[]; events: SessionEvent[]; revisions: RevisionItem[]; timer: { focusMinutes: number; breakMinutes: number; autoBreak: boolean; notifications: boolean }; activeTaskId?: string; activeStartedAt?: string; pausedAt?: string; };

const SETTINGS_KEY = 'focusforge-settings';

function loadSettings(): Store['timer'] {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore parse errors */ }
  return { focusMinutes: 45, breakMinutes: 10, autoBreak: true, notifications: true };
}

function saveSettings(timer: Store['timer']) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(timer));
  } catch { /* ignore storage errors */ }
}

export function useFirebaseForge() {
  const [store, setStore] = useState<Store>({
    tasks: [],
    events: [],
    revisions: [],
    timer: loadSettings() // M5: Load persisted settings
  });
  const [now, setNow] = useState(Date.now());
  const [focusId, setFocusId] = useState<string>();
  const [toast, setToast] = useState('');
  const [authUser, setAuthUser] = useState(auth.currentUser);

  // H1: Debounce guard — prevent rapid-fire task mutations
  const busyRef = useRef(false);
  const guardAction = useCallback(async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await action();
    } finally {
      // Small delay to let Firestore snapshot arrive before allowing next action
      setTimeout(() => { busyRef.current = false; }, 400);
    }
  }, []);

  // H2: Listen for auth state changes so subscriptions re-run when user signs in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
    });
    return unsub;
  }, []);

  // M3: Only tick the clock when a task is active
  useEffect(() => {
    if (!store.activeTaskId) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [store.activeTaskId]);
  
  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  // M5: Persist settings whenever they change
  useEffect(() => {
    saveSettings(store.timer);
  }, [store.timer]);

  // H2: Subscriptions depend on authUser so they re-run after login
  useEffect(() => {
    if (!authUser) return;
    
    const unsubTasks = subscribeToTasks((tasks) => {
      setStore(s => {
        const active = tasks.find(t => t.status === 'active');
        return {
          ...s,
          tasks,
          activeTaskId: active ? active.id : undefined,
          activeStartedAt: active ? active.lastResumedAt || active.startedAt : undefined
        };
      });
    });

    const unsubEvents = onSnapshot(query(collection(db, `users/${authUser.uid}/events`)), (snap) => {
       setStore(s => ({ ...s, events: snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionEvent)) }));
    });
    
    const unsubRevisions = onSnapshot(query(collection(db, `users/${authUser.uid}/revisions`)), (snap) => {
       setStore(s => ({ ...s, revisions: snap.docs.map(d => ({ id: d.id, ...d.data() } as RevisionItem)) }));
    });

    return () => { unsubTasks(); unsubEvents(); unsubRevisions(); };
  }, [authUser]);

  const activeSeconds = (task: Task) => {
    const elapsed = task.status === 'active' && task.lastResumedAt ? Math.max(0, (now - new Date(task.lastResumedAt).getTime()) / 1000) : 0;
    return task.actualActiveSeconds + elapsed;
  };

  const handleStartTask = (id: string) => {
    if (store.activeTaskId === id) { setFocusId(id); return; }
    guardAction(() => startTask(id, store.tasks));
    setFocusId(id);
  };

  const handlePauseActive = (reason?: string) => {
    const active = store.tasks.find(t => t.status === 'active');
    if (active) guardAction(() => pauseTask(active, reason || 'paused'));
  };

  const handleFinishTask = (id: string) => {
    const task = store.tasks.find(t => t.id === id);
    if (task) {
      guardAction(() => finishTask(task));
      setFocusId(undefined);
      setToast('Task finished — it is now in your revision queue.');
    }
  };

  const handleAddTask = async (data: any) => {
    await createTask(data);
    const synced = await syncTaskToCalendar(data);
    
    if (synced === true) {
      setToast('Added to plan and synced to Google Calendar!');
    } else if (synced === 'token_expired') {
      setToast('Added to plan. Calendar sync expired — sign out and back in to reconnect.');
    } else {
      setToast('Added to today\'s plan.');
    }
  };

  const handleUpdateTask = (id: string, changes: Partial<Task>) => updateTask(id, changes);
  
  // Reorder is purely visual in frontend
  const handleReorder = (from: number, to: number) => {
    setStore(s => { const tasks = [...s.tasks]; const [moved] = tasks.splice(from, 1); tasks.splice(to, 0, moved); return { ...s, tasks }; });
  };

  const handleDeleteTask = (id: string) => deleteTask(id);

  // H3: Persist revision review to Firestore
  const handleReviewRevision = async (revisionId: string, intervalDays: number) => {
    if (!authUser) return;
    const revRef = doc(db, `users/${authUser.uid}/revisions`, revisionId);
    const nextReviewDate = new Date(Date.now() + intervalDays * 2 * 86400000).toISOString();
    await updateDoc(revRef, {
      status: 'upcoming',
      intervalDays: intervalDays * 2,
      nextReviewDate
    });
    setToast('Reviewed. Next revisit is scheduled.');
  };

  return { 
    store, 
    setStore, 
    now, 
    activeSeconds, 
    focusId, 
    setFocusId, 
    toast, 
    setToast, 
    startTask: handleStartTask, 
    resumeTask: handleStartTask, 
    pauseActive: handlePauseActive, 
    finishTask: handleFinishTask, 
    addTask: handleAddTask, 
    updateTask: handleUpdateTask, 
    reorder: handleReorder,
    deleteTask: handleDeleteTask,
    reviewRevision: handleReviewRevision
  };
}
