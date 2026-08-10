import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, auth } from './config';

// The schema is strictly typed according to backend requirements, bridging with the existing UI
export type TaskStatus = 'planned' | 'active' | 'paused' | 'done' | 'revision';

export type Task = {
  id: string;
  topic: string; // The UI uses "topic" for the title
  subject: string;
  plannedMinutes: number; // For UI mapping
  actualActiveSeconds: number; // Will be aggregated via backend logic
  status: TaskStatus;
  priority: 'high' | 'medium' | 'low';
  goal: string;
  deadline: string;
  resources: string[];
  notes: string;
  createdAt: string;
  // New backend fields
  startedAt?: string;
  completedAt?: string;
  lastResumedAt?: string;
  totalPausedDuration: number; // in seconds
};

export const subscribeToTasks = (callback: (tasks: Task[]) => void) => {
  if (!auth.currentUser) return () => {};
  
  const q = query(collection(db, `users/${auth.currentUser.uid}/tasks`));
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => doc.data() as Task);
    callback(tasks);
  });
};

const VALID_PRIORITIES = ['high', 'medium', 'low'] as const;
const MAX_STRING_LENGTH = 500;

function validateTaskData(data: Record<string, any>) {
  if (!data.topic || typeof data.topic !== 'string' || data.topic.trim().length === 0) {
    throw new Error('Topic is required');
  }
  if (data.topic.length > MAX_STRING_LENGTH) {
    throw new Error('Topic is too long');
  }
  if (!data.subject || typeof data.subject !== 'string' || data.subject.trim().length === 0) {
    throw new Error('Subject is required');
  }
  if (typeof data.plannedMinutes !== 'number' || data.plannedMinutes < 1 || data.plannedMinutes > 480 || !Number.isFinite(data.plannedMinutes)) {
    throw new Error('Planned minutes must be between 1 and 480');
  }
  if (!VALID_PRIORITIES.includes(data.priority)) {
    throw new Error('Invalid priority');
  }
  if (data.goal && typeof data.goal === 'string' && data.goal.length > MAX_STRING_LENGTH) {
    throw new Error('Goal is too long');
  }
}

export const createTask = async (taskData: Omit<Task, 'id' | 'actualActiveSeconds' | 'totalPausedDuration' | 'status' | 'createdAt'>) => {
  if (!auth.currentUser) throw new Error("Not authenticated");
  
  validateTaskData(taskData as Record<string, any>);
  
  const taskId = `task-${Date.now()}`;
  const taskRef = doc(db, `users/${auth.currentUser.uid}/tasks`, taskId);
  
  // Only write known fields — never spread raw input
  await setDoc(taskRef, {
    id: taskId,
    topic: String(taskData.topic).trim().slice(0, MAX_STRING_LENGTH),
    subject: String(taskData.subject).trim().slice(0, MAX_STRING_LENGTH),
    plannedMinutes: Math.round(Math.max(1, Math.min(480, taskData.plannedMinutes))),
    priority: taskData.priority,
    goal: String(taskData.goal || '').trim().slice(0, MAX_STRING_LENGTH),
    deadline: taskData.deadline || new Date().toISOString(),
    resources: Array.isArray(taskData.resources) ? taskData.resources.slice(0, 20).map(r => String(r).slice(0, 500)) : [],
    notes: String(taskData.notes || '').slice(0, 2000),
    status: 'planned',
    actualActiveSeconds: 0,
    totalPausedDuration: 0,
    createdAt: new Date().toISOString()
  });
};

export const updateTask = async (taskId: string, updates: Partial<Task>) => {
  if (!auth.currentUser) return;
  const taskRef = doc(db, `users/${auth.currentUser.uid}/tasks`, taskId);
  await updateDoc(taskRef, updates);
};

export const startTask = async (taskId: string, currentTasks: Task[]) => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const now = new Date().toISOString();

  // Enforce one active task logic
  const activeTask = currentTasks.find(t => t.status === 'active');
  
  const batch = writeBatch(db);
  
  if (activeTask && activeTask.id !== taskId) {
    // Pause the currently active task automatically
    const activeRef = doc(db, `users/${uid}/tasks`, activeTask.id);
    const elapsedSinceResume = activeTask.lastResumedAt ? 
      (new Date(now).getTime() - new Date(activeTask.lastResumedAt).getTime()) / 1000 : 0;
    
    batch.update(activeRef, {
      status: 'paused',
      actualActiveSeconds: activeTask.actualActiveSeconds + elapsedSinceResume
    });
    
    // Log pause event
    const eventRef = doc(collection(db, `users/${uid}/events`));
    batch.set(eventRef, {
      type: 'pause',
      taskId: activeTask.id,
      timestamp: now,
      reason: 'switching_task',
      duration: elapsedSinceResume
    });
  }

  // Start the new task
  const targetTask = currentTasks.find(t => t.id === taskId);
  if (targetTask) {
    const targetRef = doc(db, `users/${uid}/tasks`, taskId);
    batch.update(targetRef, {
      status: 'active',
      startedAt: targetTask.startedAt || now,
      lastResumedAt: now
    });
    
    // Log focus event
    const focusEventRef = doc(collection(db, `users/${uid}/events`));
    batch.set(focusEventRef, {
      type: 'focus_recovered',
      taskId: taskId,
      timestamp: now
    });

    // Start a new session document if it's the first time
    if (!targetTask.startedAt) {
      const sessionRef = doc(collection(db, `users/${uid}/sessions`));
      batch.set(sessionRef, {
        taskId: taskId,
        startedAt: now,
        activeDuration: 0,
        pausedDuration: 0
      });
    }
  }

  await batch.commit();
};

export const pauseTask = async (task: Task, reason: string) => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const now = new Date().toISOString();
  
  const elapsedSinceResume = task.lastResumedAt ? 
      (new Date(now).getTime() - new Date(task.lastResumedAt).getTime()) / 1000 : 0;

  const batch = writeBatch(db);
  const taskRef = doc(db, `users/${uid}/tasks`, task.id);
  
  batch.update(taskRef, {
    status: 'paused',
    actualActiveSeconds: task.actualActiveSeconds + elapsedSinceResume
  });

  const eventRef = doc(collection(db, `users/${uid}/events`));
  batch.set(eventRef, {
    type: 'pause',
    taskId: task.id,
    timestamp: now,
    reason: reason,
    duration: elapsedSinceResume
  });

  await batch.commit();
};

export const finishTask = async (task: Task) => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const now = new Date().toISOString();

  let finalActiveSeconds = task.actualActiveSeconds;
  if (task.status === 'active' && task.lastResumedAt) {
    finalActiveSeconds += (new Date(now).getTime() - new Date(task.lastResumedAt).getTime()) / 1000;
  }

  const batch = writeBatch(db);
  const taskRef = doc(db, `users/${uid}/tasks`, task.id);
  
  batch.update(taskRef, {
    status: 'done',
    completedAt: now,
    actualActiveSeconds: finalActiveSeconds
  });

  // Schedule Revision
  const revisionRef = doc(collection(db, `users/${uid}/revisions`));
  batch.set(revisionRef, {
    taskId: task.id,
    topic: task.topic,
    subject: task.subject,
    intervalDays: 2,
    nextReviewDate: new Date(Date.now() + 2 * 86400000).toISOString(),
    status: 'upcoming'
  });

  await batch.commit();
};

export const deleteTask = async (taskId: string) => {
  if (!auth.currentUser) return;
  const taskRef = doc(db, `users/${auth.currentUser.uid}/tasks`, taskId);
  await deleteDoc(taskRef);
};
