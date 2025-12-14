

document.addEventListener("DOMContentLoaded", () => {
  const historyContainer = document.getElementById("history");
  const clearButton = document.getElementById("clearHistory");
  const showMinutesCheckbox = document.getElementById("showMinutes");
  const btnLonger = document.getElementById("btnLonger");
  const btnShorter = document.getElementById("btnShorter");

  const taskTitle = document.getElementById("taskTitle");
  const taskCourse = document.getElementById("taskCourse");
  const taskDue = document.getElementById("taskDue");
  const addTaskBtn = document.getElementById("addTask");
  const tasksContainer = document.getElementById("tasks");

  const analyticsContainer = document.getElementById("analytics");

  let preferences = { showMinutes: false, multiplier: 1.0, remindMinutesBefore: 60 };

  function send(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (resp) => resolve(resp));
    });
  }

  function renderHistory(history) {
    if (!history || history.length === 0) {
      historyContainer.textContent = "No estimates saved yet.";
      return;
    }

    historyContainer.innerHTML = "";
    history.slice().reverse().forEach((entry) => {
      const wrapper = document.createElement("div");
      wrapper.className = "entry";

      const minutesText =
        preferences.showMinutes && entry.minutes != null ? ` (${entry.minutes} min)` : "";

      const estimateEl = document.createElement("div");
      estimateEl.textContent = `Estimate: ${entry.estimate}${minutesText}`;

      const urlEl = document.createElement("div");
      urlEl.className = "muted";
      urlEl.textContent = entry.url;

      const timeEl = document.createElement("div");
      timeEl.className = "muted";
      timeEl.textContent = new Date(entry.timestamp).toLocaleString();

      wrapper.appendChild(estimateEl);
      wrapper.appendChild(urlEl);
      wrapper.appendChild(timeEl);
      historyContainer.appendChild(wrapper);
    });
  }

  function renderTasks(tasks) {
    if (!tasks || tasks.length === 0) {
      tasksContainer.textContent = "No tasks yet.";
      return;
    }

    tasksContainer.innerHTML = "";
    tasks
      .slice()
      .sort((a, b) => a.dueTimestamp - b.dueTimestamp)
      .forEach((t) => {
        const wrap = document.createElement("div");
        wrap.className = "task";

        const title = document.createElement("div");
        title.className = "task-title";
        title.textContent = `${t.completed ? "✅ " : ""}${t.title}${t.course ? " — " + t.course : ""}`;

        const due = document.createElement("div");
        due.className = "muted";
        due.textContent = `Due: ${new Date(t.dueTimestamp).toLocaleString()}`;

        const row = document.createElement("div");
        row.className = "row";
        row.style.marginTop = "6px";

        const toggle = document.createElement("button");
        toggle.textContent = t.completed ? "Mark Incomplete" : "Mark Complete";
        toggle.addEventListener("click", async () => {
          await send({ type: "TOGGLE_TASK_COMPLETE", payload: { id: t.id } });
          await refreshAll();
        });

        const del = document.createElement("button");
        del.textContent = "Delete";
        del.addEventListener("click", async () => {
          await send({ type: "DELETE_TASK", payload: { id: t.id } });
          await refreshAll();
        });

        row.appendChild(toggle);
        row.appendChild(del);

        wrap.appendChild(title);
        wrap.appendChild(due);
        wrap.appendChild(row);
        tasksContainer.appendChild(wrap);
      });
  }

  function renderAnalytics(a) {
    if (!a) {
      analyticsContainer.textContent = "No analytics yet.";
      return;
    }

    analyticsContainer.innerHTML = `
      <div>Week: <strong>${a.weekKey}</strong></div>
      <div>Estimates this week: <strong>${a.estimatesCount}</strong></div>
      <div>Total estimated minutes: <strong>${a.totalEstimatedMinutes}</strong></div>
      <div>Tasks: <strong>${a.tasksCount}</strong></div>
      <div>Tasks completed this week: <strong>${a.tasksCompletedThisWeek}</strong></div>
      <div class="muted">Multiplier (feedback): ${preferences.multiplier.toFixed(2)}</div>
    `;
  }

  async function refreshAll() {
    const prefsResp = await send({ type: "GET_PREFERENCES" });
    preferences = prefsResp?.preferences || preferences;
    if (showMinutesCheckbox) showMinutesCheckbox.checked = !!preferences.showMinutes;

    const histResp = await send({ type: "GET_HISTORY" });
    renderHistory(histResp?.history || []);

    const tasksResp = await send({ type: "GET_TASKS" });
    renderTasks(tasksResp?.tasks || []);

    const analyticsResp = await send({ type: "GET_ANALYTICS" });
    renderAnalytics(analyticsResp?.analytics);
  }

  
  clearButton.addEventListener("click", async () => {
    await send({ type: "CLEAR_HISTORY" });
    await refreshAll();
  });

  showMinutesCheckbox.addEventListener("change", async () => {
    await send({
      type: "SET_PREFERENCES",
      payload: { showMinutes: showMinutesCheckbox.checked }
    });
    await refreshAll();
  });

  btnLonger.addEventListener("click", async () => {
    await send({ type: "APPLY_FEEDBACK", payload: { direction: "LONGER" } });
    await refreshAll();
  });

  btnShorter.addEventListener("click", async () => {
    await send({ type: "APPLY_FEEDBACK", payload: { direction: "SHORTER" } });
    await refreshAll();
  });

  addTaskBtn.addEventListener("click", async () => {
    const title = (taskTitle.value || "").trim();
    const course = (taskCourse.value || "").trim();
    const dueValue = taskDue.value;

    if (!title) {
      alert("Task title is required.");
      return;
    }
    if (!dueValue) {
      alert("Due date/time is required.");
      return;
    }

    const dueTimestamp = new Date(dueValue).getTime();

    const resp = await send({
      type: "ADD_TASK",
      payload: { title, course, dueTimestamp }
    });

    if (resp?.status !== "ok") {
      alert(resp?.error || "Failed to add task.");
      return;
    }

    taskTitle.value = "";
    taskCourse.value = "";
    taskDue.value = "";

    await refreshAll();
  });

  refreshAll();
});
