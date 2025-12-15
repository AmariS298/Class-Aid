

chrome.runtime.onInstalled.addListener(() => {
  console.log("ClassAid background service worker installed");
});


function getISOWeekKey(date = new Date()) {
  
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function defaultPreferences() {
  return { showMinutes: false, multiplier: 1.0, remindMinutesBefore: 60 };
}

function scheduleReminder(taskId, dueTimestamp, remindMinutesBefore) {
  
  const when = dueTimestamp - remindMinutesBefore * 60 * 1000;
  if (when <= Date.now()) return; 

  const alarmName = `TASK_REMINDER:${taskId}`;
  chrome.alarms.create(alarmName, { when });
  console.log("Scheduled alarm:", alarmName, "at", new Date(when).toLocaleString());
}

function clearReminder(taskId) {
  const alarmName = `TASK_REMINDER:${taskId}`;
  chrome.alarms.clear(alarmName);
}


chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith("TASK_REMINDER:")) return;

  const taskId = alarm.name.split(":")[1];

  chrome.storage.local.get(["tasks"], (result) => {
    const tasks = result.tasks || [];
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    
    if (task.completed) return;

    chrome.notifications.create(`notify:${taskId}`, {
      type: "basic",
      iconUrl: "icon.png",
      title: "ClassAid Reminder",
      message: `Upcoming: ${task.title}${task.course ? " (" + task.course + ")" : ""}`
    });
  });
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background got message:", message);

  
  if (message.type === "SAVE_ESTIMATE") {
    const { url, estimate, timestamp, minutes } = message.payload || {};

    if (!url || !estimate || !timestamp) {
      sendResponse({ status: "error", error: "Invalid SAVE_ESTIMATE payload" });
      return false;
    }

    chrome.storage.local.get(["history"], (result) => {
      const history = result.history || [];
      const newEntry = { url, estimate, minutes, timestamp };
      history.push(newEntry);

      chrome.storage.local.set({ history }, () => {
        sendResponse({ status: "ok" });
      });
    });

    return true;
  }

  if (message.type === "GET_HISTORY") {
    chrome.storage.local.get(["history"], (result) => {
      sendResponse({ status: "ok", history: result.history || [] });
    });
    return true;
  }

  if (message.type === "CLEAR_HISTORY") {
    chrome.storage.local.set({ history: [] }, () => {
      sendResponse({ status: "ok" });
    });
    return true;
  }

 
  if (message.type === "GET_PREFERENCES") {
    chrome.storage.local.get(["preferences"], (result) => {
      sendResponse({ status: "ok", preferences: result.preferences || defaultPreferences() });
    });
    return true;
  }

  if (message.type === "SET_PREFERENCES") {
    chrome.storage.local.get(["preferences"], (result) => {
      const current = result.preferences || defaultPreferences();
      const next = { ...current, ...(message.payload || {}) };

      chrome.storage.local.set({ preferences: next }, () => {
        sendResponse({ status: "ok", preferences: next });
      });
    });
    return true;
  }

  
  if (message.type === "APPLY_FEEDBACK") {
    const { direction } = message.payload || {};
    chrome.storage.local.get(["preferences"], (result) => {
      const prefs = result.preferences || defaultPreferences();
      let m = prefs.multiplier ?? 1.0;

      if (direction === "LONGER") m = Math.min(2.0, m + 0.05);
      if (direction === "SHORTER") m = Math.max(0.5, m - 0.05);

      const next = { ...prefs, multiplier: m };
      chrome.storage.local.set({ preferences: next }, () => {
        sendResponse({ status: "ok", preferences: next });
      });
    });
    return true;
  }

  
  if (message.type === "GET_TASKS") {
    chrome.storage.local.get(["tasks"], (result) => {
      sendResponse({ status: "ok", tasks: result.tasks || [] });
    });
    return true;
  }

  if (message.type === "ADD_TASK") {
    const { title, course, dueTimestamp } = message.payload || {};
    if (!title || !dueTimestamp) {
      sendResponse({ status: "error", error: "Task needs title and due date/time" });
      return false;
    }

    chrome.storage.local.get(["tasks", "preferences"], (result) => {
      const tasks = result.tasks || [];
      const prefs = result.preferences || defaultPreferences();

      const id = crypto.randomUUID();
      const task = {
        id,
        title,
        course: course || "",
        dueTimestamp,
        completed: false,
        createdAt: Date.now()
      };

      tasks.push(task);
      chrome.storage.local.set({ tasks }, () => {
        scheduleReminder(id, dueTimestamp, prefs.remindMinutesBefore ?? 60);
        sendResponse({ status: "ok", task });
      });
    });

    return true;
  }

  if (message.type === "DELETE_TASK") {
    const { id } = message.payload || {};
    chrome.storage.local.get(["tasks"], (result) => {
      const tasks = (result.tasks || []).filter(t => t.id !== id);
      chrome.storage.local.set({ tasks }, () => {
        clearReminder(id);
        sendResponse({ status: "ok" });
      });
    });
    return true;
  }

  if (message.type === "TOGGLE_TASK_COMPLETE") {
    const { id } = message.payload || {};
    chrome.storage.local.get(["tasks"], (result) => {
      const tasks = result.tasks || [];
      const idx = tasks.findIndex(t => t.id === id);
      if (idx === -1) {
        sendResponse({ status: "error", error: "Task not found" });
        return;
      }

      tasks[idx].completed = !tasks[idx].completed;

      // If completed, clear reminder
      if (tasks[idx].completed) clearReminder(id);

      chrome.storage.local.set({ tasks }, () => {
        sendResponse({ status: "ok", task: tasks[idx] });
      });
    });
    return true;
  }

  
  if (message.type === "GET_ANALYTICS") {
    chrome.storage.local.get(["history", "tasks"], (result) => {
      const history = result.history || [];
      const tasks = result.tasks || [];

      
      const now = new Date();
      const weekKey = getISOWeekKey(now);

      
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);

      const historyThisWeek = history.filter(h => h.timestamp >= weekStart.getTime());
      const totalEstimatedMinutes = historyThisWeek.reduce((sum, h) => sum + (h.minutes || 0), 0);

      const tasksCompletedThisWeek = tasks.filter(t => t.completed && t.createdAt >= weekStart.getTime()).length;

      sendResponse({
        status: "ok",
        analytics: {
          weekKey,
          estimatesCount: historyThisWeek.length,
          totalEstimatedMinutes,
          tasksCount: tasks.length,
          tasksCompletedThisWeek
        }
      });
    });
    return true;
  }

  sendResponse({ status: "error", error: "Unknown message type" });
  return false;
});

