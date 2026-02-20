const STORAGE_KEY = "maintenanceTasks";
const LIMIT_KEY = "maintenanceLimit";
const SCHEDULE_KEY = "maintenanceSchedule";

const FIXED_CATEGORIES = [
  "Appliance Maintenance",
  "Auto Maintenance",
  "Energy Efficiency",
  "Home Safety",
  "HVAC",
  "Seasonal",
  "Plumbing",
];

const PERIODS = [
  "Jan - Feb",
  "Mar - Apr",
  "May - Jun",
  "Jul - Aug",
  "Sep - Oct",
  "Nov - Dec",
];

const planOutput = document.getElementById("plan-output");
const timeLimitInput = document.getElementById("time-limit");
const taskTable = document.getElementById("task-table");
const form = document.getElementById("task-form");
const categorySelect = document.getElementById("task-category");

const state = {
  tasks: normalizeTasks(loadTasks()),
  schedule: loadSchedule(),
};

if (state.tasks.length === 0) {
  state.tasks = seedTasks();
  saveTasks();
}

const limit = loadLimit();
if (limit) {
  timeLimitInput.value = limit;
}

if (categorySelect) {
  renderCategorySelect();
}
if (taskTable) {
  renderTasks();
}
renderPlan();

timeLimitInput.addEventListener("change", () => {
  const value = Number(timeLimitInput.value) || 75;
  localStorage.setItem(LIMIT_KEY, String(value));
  renderPlan();
});

if (form) {
  form.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = document.getElementById("task-name").value.trim();
  const minutes = Number(document.getElementById("task-minutes").value);
  const category = document.getElementById("task-category").value;
  const frequency = document.getElementById("task-frequency").value;

  if (!name || !minutes || !category) {
    return;
  }

  addTask({ name, minutes, category, frequency, include: true });
  form.reset();
  renderTasks();
  renderPlan();
  });
}

function loadTasks() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function normalizeTasks(tasks) {
  return tasks.map((task) => {
    if (!FIXED_CATEGORIES.includes(task.category)) {
      return { ...task, category: FIXED_CATEGORIES[0] };
    }
    return task;
  });
}

function loadLimit() {
  const raw = localStorage.getItem(LIMIT_KEY);
  return raw ? Number(raw) : 75;
}

function loadSchedule() {
  const raw = localStorage.getItem(SCHEDULE_KEY);
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

function saveSchedule() {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(state.schedule));
}

function getAllCategories() {
  return [...FIXED_CATEGORIES];
}

function renderCategorySelect() {
  if (!categorySelect) {
    return;
  }
  categorySelect.innerHTML = FIXED_CATEGORIES.map(
    (category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
  ).join("");
}

function getAvailableTasks() {
  return state.tasks;
}

function getScheduleIdsForPeriod(period) {
  const list = state.schedule[period];
  return Array.isArray(list) ? list : [];
}

function setScheduleIdsForPeriod(period, ids) {
  state.schedule[period] = ids;
  saveSchedule();
}

function pruneSchedule() {
  const availableIds = new Set(getAvailableTasks().map((task) => task.id));
  PERIODS.forEach((period) => {
    const ids = getScheduleIdsForPeriod(period).filter((id) => availableIds.has(id));
    setScheduleIdsForPeriod(period, ids);
  });
}

function renderTasks() {
  if (!taskTable) {
    return;
  }
  taskTable.innerHTML = "";

  const categories = getAllCategories();

  categories.forEach((category) => {
    const group = document.createElement("div");
    group.className = "category-group";

    const headerRow = document.createElement("div");
    headerRow.className = "category-header";
    headerRow.innerHTML = `<h3>${escapeHtml(category)}</h3>`;
    group.appendChild(headerRow);

    const list = document.createElement("div");
    list.className = "category-list";

    state.tasks
      .filter((task) => (task.category || "Uncategorized") === category)
      .forEach((task) => {
        const row = document.createElement("div");
        row.className = "task-row";
        row.innerHTML = `
          <input data-field="name" data-id="${task.id}" type="text" value="${escapeHtml(task.name)}" />
          <input data-field="minutes" data-id="${task.id}" type="number" min="1" value="${task.minutes}" />
          <select data-field="frequency" data-id="${task.id}">
            <option value="every" ${task.frequency === "every" ? "selected" : ""}>Every visit</option>
            <option value="annual" ${task.frequency === "annual" ? "selected" : ""}>Annual</option>
            <option value="adhoc" ${task.frequency === "adhoc" ? "selected" : ""}>Ad hoc</option>
          </select>
          <div class="task-row__actions">
            <button data-action="remove" data-id="${task.id}" class="ghost danger">Remove</button>
          </div>
        `;

        list.appendChild(row);
      });

    group.appendChild(list);
    taskTable.appendChild(group);
  });
}

taskTable?.addEventListener("input", (event) => {
  const target = event.target;
  if (!target.dataset.field) {
    return;
  }

  const task = state.tasks.find((item) => item.id === target.dataset.id);
  if (!task) {
    return;
  }

  const field = target.dataset.field;
  if (field === "name") {
    task.name = target.value.trim();
  }
  if (field === "minutes") {
    task.minutes = Number(target.value) || task.minutes;
  }
  if (field === "frequency") {
    task.frequency = target.value;
  }

  saveTasks();
  renderPlan();
});

taskTable?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  const taskId = target.dataset.id;
  if (action !== "remove" || !taskId) {
    return;
  }

  state.tasks = state.tasks.filter((item) => item.id !== taskId);
  saveTasks();
  pruneSchedule();
  renderTasks();
  renderPlan();
});


planOutput.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.dataset.action !== "toggle-task") {
    return;
  }
  const period = target.dataset.period;
  const taskId = target.dataset.id;
  if (!period || !taskId) {
    return;
  }
  const ids = getScheduleIdsForPeriod(period);
  if (target.checked && !ids.includes(taskId)) {
    ids.push(taskId);
  }
  if (!target.checked) {
    const next = ids.filter((id) => id !== taskId);
    setScheduleIdsForPeriod(period, next);
    renderPlan();
    return;
  }
  setScheduleIdsForPeriod(period, ids);
  renderPlan();
});

function addTask({ name, minutes, category, frequency, include }) {
  const safeCategory = FIXED_CATEGORIES.includes(category)
    ? category
    : FIXED_CATEGORIES[0];
  state.tasks.push({
    id: crypto.randomUUID(),
    name,
    minutes,
    category: safeCategory,
    frequency,
    include,
  });
  saveTasks();
}

function renderPlan() {
  const limitMinutes = Number(timeLimitInput.value) || 75;
  const available = getAvailableTasks();
  pruneSchedule();

  const periods = PERIODS.map((label) => ({
    label,
    taskIds: getScheduleIdsForPeriod(label),
  }));

  planOutput.innerHTML = "";

  const categories = getAllCategories();

  planOutput.appendChild(
    buildScheduleTable({
      periods,
      categories,
      limitMinutes,
      tasks: available,
    })
  );
}

function buildScheduleTable({ periods, categories, limitMinutes, tasks }) {
  const table = document.createElement("table");
  table.className = "schedule-table";

  // Calculate which periods are over the limit
  const periodTotals = periods.map((period) => {
    const total = period.taskIds
      .map((id) => tasks.find((task) => task.id === id))
      .filter(Boolean)
      .reduce((sum, task) => sum + task.minutes, 0);
    return { label: period.label, total, isOver: total > limitMinutes };
  });

  const headerRow = `
    <tr>
      <th>Category</th>
      ${periods.map((period) => `<th>${period.label}</th>`).join("")}
    </tr>
  `;

  const bodyRows = categories
    .map((category) => {
      const categoryTasks = tasks.filter((task) => (task.category || "Uncategorized") === category);
      const cells = periods
        .map((period, index) => {
          const items = categoryTasks
            .map((task) => {
              const checked = period.taskIds.includes(task.id) ? "checked" : "";
              return `
                <label class="schedule-choice">
                  <input type="checkbox" data-action="toggle-task" data-period="${period.label}" data-id="${task.id}" ${checked} />
                  <span class="schedule-choice__name">${escapeHtml(task.name)}</span>
                  <span class="schedule-choice__time">${task.minutes}m</span>
                </label>
              `;
            })
            .join("");

          const overClass = periodTotals[index].isOver ? " period-over-limit" : "";
          return `<td class="${overClass}">${items || "<span>No tasks</span>"}</td>`;
        })
        .join("");
      return `
        <tr>
          <th>${escapeHtml(category)}</th>
          ${cells}
        </tr>
      `;
    })
    .join("");

  const totalsRow = `
    <tr class="schedule-total">
      <th>Total minutes</th>
      ${periods
        .map((period) => {
          const total = period.taskIds
            .map((id) => tasks.find((task) => task.id === id))
            .filter(Boolean)
            .reduce((sum, task) => sum + task.minutes, 0);
          const overLimit = total > limitMinutes ? " schedule-total--over" : "";
          return `<td class="${overLimit}">${total} / ${limitMinutes}m</td>`;
        })
        .join("")}
    </tr>
  `;

  table.innerHTML = `
    <thead>${headerRow}</thead>
    <tbody>${bodyRows}${totalsRow}</tbody>
  `;

  return table;
}


function seedTasks() {
  const tasks = [
    { id: crypto.randomUUID(), name: "Refrigerator Filter", minutes: 5, category: "Appliance Maintenance", frequency: "every", include: true },
    { id: crypto.randomUUID(), name: "Dishwasher Cleaning", minutes: 12, category: "Appliance Maintenance", frequency: "annual", include: true },
    { id: crypto.randomUUID(), name: "Stove Exhaust Filter Replacement", minutes: 15, category: "Appliance Maintenance", frequency: "annual", include: true },
    { id: crypto.randomUUID(), name: "Dryer Vent Cleaning", minutes: 20, category: "Appliance Maintenance", frequency: "annual", include: true },
    { id: crypto.randomUUID(), name: "Car Maintenance (Filters/Wipers/Air)", minutes: 30, category: "Auto Maintenance", frequency: "annual", include: false },
    { id: crypto.randomUUID(), name: "Exterior Door/Window Maintenance", minutes: 25, category: "Energy Efficiency", frequency: "annual", include: true },
    { id: crypto.randomUUID(), name: "Thermal Imaging for Heat Loss", minutes: 15, category: "Energy Efficiency", frequency: "annual", include: true },
    { id: crypto.randomUUID(), name: "Light Bulbs/Fan Switch", minutes: 8, category: "Energy Efficiency", frequency: "every", include: true },
    { id: crypto.randomUUID(), name: "Thermal Imaging for AC Loss", minutes: 12, category: "Energy Efficiency", frequency: "annual", include: true },
    { id: crypto.randomUUID(), name: "Drone Inspection", minutes: 15, category: "Energy Efficiency", frequency: "adhoc", include: false },
    { id: crypto.randomUUID(), name: "Garage Door Tune Up", minutes: 30, category: "Home Safety", frequency: "annual", include: true },
    { id: crypto.randomUUID(), name: "Smoke-CO Detector Batteries", minutes: 5, category: "Home Safety", frequency: "every", include: true },
    { id: crypto.randomUUID(), name: "Attic/Basement/Crawl Inspection", minutes: 15, category: "Home Safety", frequency: "annual", include: true },
    { id: crypto.randomUUID(), name: "Camera/Doorbell Inspection", minutes: 5, category: "Home Safety", frequency: "annual", include: true },
    { id: crypto.randomUUID(), name: "Basic Gutter/Downspout Clearing", minutes: 25, category: "Home Safety", frequency: "annual", include: true },
    { id: crypto.randomUUID(), name: "Air Filter Furnace", minutes: 5, category: "HVAC", frequency: "every", include: true },
    { id: crypto.randomUUID(), name: "AC Unit Check", minutes: 8, category: "HVAC", frequency: "annual", include: true },
    { id: crypto.randomUUID(), name: "Fall Prep", minutes: 40, category: "Seasonal", frequency: "annual", include: true },
    { id: crypto.randomUUID(), name: "Spring Prep", minutes: 20, category: "Seasonal", frequency: "annual", include: true },
    { id: crypto.randomUUID(), name: "Water Softener Salt Delivery/Refill", minutes: 8, category: "Plumbing", frequency: "every", include: true },
    { id: crypto.randomUUID(), name: "Whole House Water Filter Replacement", minutes: 10, category: "Plumbing", frequency: "annual", include: true },
    { id: crypto.randomUUID(), name: "Hot Water Heater Drain/Flush", minutes: 45, category: "Plumbing", frequency: "annual", include: true },
    { id: crypto.randomUUID(), name: "Sewer Grinder Cleaning", minutes: 20, category: "Plumbing", frequency: "adhoc", include: false },
    { id: crypto.randomUUID(), name: "Drain/Trap Cleaning", minutes: 14, category: "Plumbing", frequency: "adhoc", include: false },
    { id: crypto.randomUUID(), name: "Shower/Tub/Faucet Descaling", minutes: 20, category: "Plumbing", frequency: "annual", include: true },
  ];

  return tasks;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Print Schedule functionality
const printScheduleBtn = document.getElementById("print-schedule-btn");
const printView = document.getElementById("print-view");
const printBtn = document.getElementById("print-btn");
const closePrintBtn = document.getElementById("close-print-btn");
const printScheduleOutput = document.getElementById("print-schedule-output");

printScheduleBtn?.addEventListener("click", () => {
  generatePrintView();
  printView.style.display = "block";
  document.body.style.overflow = "hidden";
});

closePrintBtn?.addEventListener("click", () => {
  printView.style.display = "none";
  document.body.style.overflow = "";
});

printBtn?.addEventListener("click", () => {
  window.print();
});

function generatePrintView() {
  const available = getAvailableTasks();
  const periods = PERIODS.map((label) => ({
    label,
    taskIds: getScheduleIdsForPeriod(label),
  }));

  // Build schedule organized by period, then category
  let html = "";

  periods.forEach((period) => {
    if (period.taskIds.length === 0) {
      return; // Skip periods with no tasks
    }

    html += `<div class="print-period">`;
    html += `<h3 class="print-period-title">${escapeHtml(period.label)}</h3>`;

    // Get tasks for this period
    const periodTasks = period.taskIds
      .map((id) => available.find((task) => task.id === id))
      .filter(Boolean);

    // Group by category
    const tasksByCategory = {};
    periodTasks.forEach((task) => {
      const cat = task.category || "Uncategorized";
      if (!tasksByCategory[cat]) {
        tasksByCategory[cat] = [];
      }
      tasksByCategory[cat].push(task);
    });

    // Render each category
    FIXED_CATEGORIES.forEach((category) => {
      if (tasksByCategory[category] && tasksByCategory[category].length > 0) {
        html += `<div class="print-category">`;
        html += `<h4 class="print-category-title">${escapeHtml(category)}</h4>`;
        html += `<ul class="print-task-list">`;
        tasksByCategory[category].forEach((task) => {
          html += `<li>${escapeHtml(task.name)}</li>`;
        });
        html += `</ul>`;
        html += `</div>`;
      }
    });

    html += `</div>`;
  });

  if (html === "") {
    html = "<p>No tasks scheduled yet. Please select tasks in the calendar view.</p>";
  }

  printScheduleOutput.innerHTML = html;
}

