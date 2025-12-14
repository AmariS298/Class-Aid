

console.log("ClassAid content script running");


function findAssignmentElement() {
  const selectors = [".description", ".assignment-description", ".user_content", "#assignment-details"];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

const assignmentElement = findAssignmentElement();
const assignmentText = assignmentElement?.innerText || null;

function estimateMinutes(text) {
  if (!text) return 15;

  const words = text.trim().split(/\s+/).length;
  const lower = text.toLowerCase();

  let minutes = Math.max(10, Math.round((words / 180) * 1.5 * 60));

  if (lower.includes("essay") || lower.includes("reflection")) minutes += 25;
  if (lower.includes("short answer") || lower.includes("show your work")) minutes += 10;
  if (lower.includes("project") || lower.includes("presentation") || lower.includes("group")) minutes += 40;
  if (lower.includes("quiz") || lower.includes("multiple choice")) minutes -= 10;

  return Math.max(5, minutes);
}

function formatDuration(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} minute${m === 1 ? "" : "s"}`;
  if (m === 0) return `${h} hour${h === 1 ? "" : "s"}`;
  return `${h} hour${h === 1 ? "" : "s"} ${m} minute${m === 1 ? "" : "s"}`;
}

// Remove any existing overlay
const existing = document.getElementById("classaid-estimate-box");
if (existing) existing.remove();

function showOverlay(text) {
  const box = document.createElement("div");
  box.id = "classaid-estimate-box";
  box.style.position = "fixed";
  box.style.bottom = "20px";
  box.style.right = "20px";
  box.style.padding = "15px";
  box.style.background = "#2d3748";
  box.style.color = "white";
  box.style.borderRadius = "8px";
  box.style.zIndex = 9999;
  box.innerText = text;
  document.body.appendChild(box);
}


if (!assignmentText) {
  showOverlay("⏳ Estimated Completion Time: 30 minutes");
} else {
  
  chrome.runtime.sendMessage({ type: "GET_PREFERENCES" }, (resp) => {
    const prefs = resp?.preferences || { multiplier: 1.0 };
    const multiplier = prefs.multiplier ?? 1.0;

    const base = estimateMinutes(assignmentText);
    const adjustedMinutes = Math.max(5, Math.round(base * multiplier));
    const estimateString = formatDuration(adjustedMinutes);

    showOverlay("⏳ Estimated Completion Time: " + estimateString);

    chrome.runtime.sendMessage({
      type: "SAVE_ESTIMATE",
      payload: {
        url: window.location.href,
        estimate: estimateString,
        minutes: adjustedMinutes,
        timestamp: Date.now()
      }
    });
  });
}
