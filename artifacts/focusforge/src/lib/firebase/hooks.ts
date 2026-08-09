import { useState, useEffect } from 'react';
import { subscribeToTasks, startTask, pauseTask, finishTask, createTask, updateTask, deleteTask, Task } from './tasks';
import { syncTaskToCalendar } from './googleCalendar';
import { auth, db } from './config';
import { collection, onSnapshot, query } from 'firebase/firestore';

export type SessionEvent = { id: string; taskId: string; startedAt: string; pausedAt?: string; resumedAt?: string; endedAt?: string; pauseReason?: string; distractionReason?: string; type?: string; timestamp?: string; duration?: number };
export type RevisionItem = { id: string; topic: string; subject: string; dueDate: string; intervalDays: number; status: 'due' | 'upcoming' | 'reviewed' };
export type Store = { tasks: Task[]; events: SessionEvent[]; revisions: RevisionItem[]; timer: { focusMinutes: number; breakMinutes: number; autoBreak: boolean; notifications: boolean }; activeTaskId?: string; activeStartedAt?: string; pausedAt?: string; };

export function useFirebaseForge() {
  const [store, setStore] = useState<Store>({
    tasks: [],
    events: [],
    revisions: [],
    timer: { focusMinutes: 45, breakMinutes: 10, autoBreak: true, notifications: true }
  });
  const [now, setNow] = useState(Date.now());
  const [focusId, setFocusId] = useState<string>();
  const [toast, setToast] = useState('');

  // Clock
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  
  // Toast
  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Subscriptions
  useEffect(() => {
    if (!auth.currentUser) return;
    
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

    const unsubEvents = onSnapshot(query(collection(db, `users/${auth.currentUser.uid}/events`)), (snap) => {
       setStore(s => ({ ...s, events: snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionEvent)) }));
    });
    
    const unsubRevisions = onSnapshot(query(collection(db, `users/${auth.currentUser.uid}/revisions`)), (snap) => {
       setStore(s => ({ ...s, revisions: snap.docs.map(d => ({ id: d.id, ...d.data() } as RevisionItem)) }));
    });

    return () => { unsubTasks(); unsubEvents(); unsubRevisions(); };
  }, []);

  const activeSeconds = (task: Task) => {
    const elapsed = task.status === 'active' && task.lastResumedAt ? Math.max(0, (now - new Date(task.lastResumedAt).getTime()) / 1000) : 0;
    return task.actualActiveSeconds + elapsed;
  };

  const handleStartTask = (id: string) => {
    if (store.activeTaskId === id) { setFocusId(id); return; }
    startTask(id, store.tasks);
    setFocusId(id);
  };

  const handlePauseActive = (reason?: string) => {
    const active = store.tasks.find(t => t.status === 'active');
    if (active) pauseTask(active, reason || 'paused');
  };

  const handleFinishTask = (id: string) => {
    const task = store.tasks.find(t => t.id === id);
    if (task) {
      finishTask(task);
      setFocusId(undefined);
      setToast('Task finished — it is now in your revision queue.');
    }
  };

  const handleAddTask = async (data: any) => {
    await createTask(data);
    const synced = await syncTaskToCalendar(data);
    
    if (synced) {
      setToast('Added to plan and synced to Google Calendar!');
    } else {
      setToast('Added to today’s plan.');
    }
  };

  const handleUpdateTask = (id: string, changes: Partial<Task>) => updateTask(id, changes);
  
  // Reorder is purely visual in frontend normally, but we can sync priority/order index. Leaving as local optimistic for now
  const handleReorder = (from: number, to: number) => {
    setStore(s => { const tasks = [...s.tasks]; const [moved] = tasks.splice(from, 1); tasks.splice(to, 0, moved); return { ...s, tasks }; });
  };

  const handleDeleteTask = (id: string) => deleteTask(id);

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
    deleteTask: handleDeleteTask
  };
}
