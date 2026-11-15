const $ = (selector) => document.querySelector(selector);
const state = { students: [], reports: [], subjects: [], dailyAttendance: [], view: "overview", belowThreshold: false, search: "" };
const today = new Date();
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const initials = (name) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

async function api(url, options = {}) {
    const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `Request failed (${response.status})`);
    }
    return response.status === 204 ? null : response.json();
}

function notify(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(notify.timeout);
    notify.timeout = setTimeout(() => toast.classList.remove("visible"), 2800);
}

async function loadData() {
    const params = new URLSearchParams();
    if (state.search) params.set("search", state.search);
    const reportParams = new URLSearchParams();
    const subject = $("#subject-filter").value;
    if (subject) reportParams.set("subject", subject);
    if (state.search) reportParams.set("search", state.search);
    if (state.belowThreshold) reportParams.set("belowThreshold", "true");
    const activityDate = $("#activity-date").value || localDate(today);
    [state.students, state.reports, state.subjects, state.dailyAttendance] = await Promise.all([
        api(`/api/students?${params}`), api(`/api/reports?${reportParams}`), api("/api/subjects"),
        api(`/api/attendance?date=${encodeURIComponent(activityDate)}`)
    ]);
    render();
}

function render() {
    renderFilters();
    renderStats();
    renderTable();
    renderAttendanceStudents();
    renderRecentSubjects();
    renderActivity();
    const labels = { overview: ["Overview", "Student overview", "A quick look at your students and their attendance."],
        students: ["Students", "All students", "Manage your student directory."],
        attendance: ["Attendance", "Attendance overview", "Review recorded attendance and mark a new class."],
        reports: ["Reports", state.belowThreshold ? "Below 75% attendance" : "Attendance reports", "Subject-wise attendance and students who need support."] };
    const [label, title, caption] = labels[state.view];
    $("#breadcrumb-current").textContent = label;
    $("#table-title").textContent = title;
    $("#table-caption").textContent = caption;
    $("#heading-eyebrow").textContent = state.view === "overview" ? "YOUR CAMPUS AT A GLANCE" : `MANAGE YOUR ${label.toUpperCase()}`;
    $("#page-title").innerHTML = state.view === "overview" ? "Good morning <span class=\"wave\">✦</span>" : label;
    $("#page-subtitle").textContent = state.view === "overview"
        ? "A little consistency goes a long way. Here’s your attendance snapshot."
        : caption;
}

function renderFilters() {
    const select = $("#subject-filter");
    const selected = select.value;
    select.innerHTML = `<option value="">All subjects</option>${state.subjects.map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`).join("")}`;
    select.value = state.subjects.includes(selected) ? selected : "";
}

function renderStats() {
    $("#total-students").textContent = state.students.length;
    const totalHeld = state.reports.reduce((sum, item) => sum + Number(item.classesHeld), 0);
    const totalAttended = state.reports.reduce((sum, item) => sum + Number(item.classesAttended), 0);
    const attendanceRate = totalHeld ? Math.round(totalAttended / totalHeld * 100) : 0;
    $("#attendance-rate").innerHTML = `${attendanceRate}<small>%</small>`;
    $("#hero-rate").textContent = `${attendanceRate}%`;
    $("#hero-ring").style.setProperty("--rate-angle", `${attendanceRate * 3.6}deg`);
    $("#classes-recorded").textContent = totalHeld;
    $("#students-at-risk").textContent = new Set(state.reports
        .filter((item) => Number(item.percentage) < 75)
        .map((item) => item.studentId)).size;
}

function renderTable() {
    const rows = state.view === "students"
        ? state.students.map((student) => ({ ...student, subject: "—", classesHeld: "—", classesAttended: "—", percentage: null }))
        : state.reports;
    $("#student-rows").innerHTML = rows.map((row) => {
        const percentage = row.percentage == null ? null : Number(row.percentage);
        const status = percentage == null ? "" : percentage >= 75
            ? `<span class="status-pill status-good">On track</span>`
            : `<span class="status-pill status-low">Needs attention</span>`;
        const classes = percentage == null ? "—" : `${row.classesAttended}/${row.classesHeld}`;
        return `<tr>
            <td><div class="student-cell"><span class="student-avatar">${escapeHtml(initials(row.name))}</span><span class="student-meta">${escapeHtml(row.name)}<small>${escapeHtml(row.rollNumber)}</small></span></div></td>
            <td>${escapeHtml(row.subject)}</td><td>${classes}</td>
            <td>${percentage == null ? "—" : `<span class="attendance-bar"><i class="${percentage < 75 ? "low" : ""}" style="width:${Math.max(0, Math.min(100, percentage))}%"></i></span><span class="percentage">${percentage}%</span>`}</td>
            <td>${status}</td>
            <td>${state.view === "students" ? `<span class="row-actions"><button class="mini-action edit-student" data-id="${row.id}" title="Edit student">✎</button><button class="mini-action delete-student" data-id="${row.id}" title="Delete student">×</button></span>` : ""}</td>
        </tr>`;
    }).join("");
    $("#empty-state").hidden = rows.length > 0;
    $("#results-count").textContent = `${rows.length} ${rows.length === 1 ? "record" : "records"}`;
}

function renderAttendanceStudents() {
    $("#attendance-students").innerHTML = state.students.map((student) =>
        `<option value="${student.id}">${escapeHtml(student.name)} · ${escapeHtml(student.rollNumber)}</option>`).join("");
}

function renderRecentSubjects() {
    $("#recent-subjects").innerHTML = state.subjects.length
        ? state.subjects.slice(0, 4).map((subject) => `<span class="subject-chip">${escapeHtml(subject)}</span>`).join("")
        : `<span class="subject-chip">No subjects yet</span>`;
}

function renderActivity() {
    const selectedDate = $("#activity-date").value || localDate(today);
    const dateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "long", month: "long", day: "numeric"
    });
    const records = state.dailyAttendance;
    const present = records.filter((record) => record.status === "PRESENT").length;
    const absent = records.length - present;
    $("#activity-summary-text").textContent = records.length
        ? `${records.length} ${records.length === 1 ? "student" : "students"} marked · ${present} present · ${absent} absent`
        : "No class records yet";
    $("#activity-summary-date").textContent = dateLabel;
    $("#activity-empty").hidden = records.length > 0;
    $("#activity-list").hidden = records.length === 0;
    $("#activity-list").innerHTML = records.map((record) => {
        const isPresent = record.status === "PRESENT";
        const status = isPresent ? "present" : "absent";
        return `<article class="activity-item">
            <span class="activity-status ${status}">${isPresent ? "✓" : "−"}</span>
            <span class="activity-info"><strong>${escapeHtml(record.name)}</strong><span>${escapeHtml(record.rollNumber)} · ${escapeHtml(record.subject)}</span></span>
            <span class="activity-pill ${status}">${isPresent ? "Present" : "Absent"}</span>
        </article>`;
    }).join("");
}

function openStudent(student) {
    const form = $("#student-form");
    form.reset();
    form.elements.id.value = student?.id || "";
    form.elements.name.value = student?.name || "";
    form.elements.rollNumber.value = student?.rollNumber || "";
    form.elements.department.value = student?.department || "";
    form.elements.email.value = student?.email || "";
    $("#student-dialog-title").textContent = student ? "Edit student" : "Add a student";
    $("#save-student-button").textContent = student ? "Save changes" : "Save student";
    $("#student-dialog").showModal();
}

$("#today-label").textContent = today.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
$("[name=date]").value = localDate(today);
$("#activity-date").value = localDate(today);
const addStudentButton = $("#add-student-button") || document.createElement("button");
if (!addStudentButton.isConnected) {
    addStudentButton.id = "add-student-button";
    addStudentButton.className = "button button-hero-outline";
    addStudentButton.textContent = "Add student";
    $(".hero-actions").append(addStudentButton);
}
addStudentButton.addEventListener("click", () => openStudent());
$("#hero-attendance-button").addEventListener("click", () => {
    $("#quick-attendance-panel").scrollIntoView({ behavior: "smooth", block: "center" });
    $("#attendance-form").elements.subject.focus({ preventScroll: true });
});
$("#hero-students-button").addEventListener("click", () => setView("students"));
$("#activity-take-attendance")?.addEventListener("click", () => {
    $("#quick-attendance-panel").scrollIntoView({ behavior: "smooth", block: "center" });
    $("#attendance-form").elements.subject.focus({ preventScroll: true });
});
$("#activity-date").addEventListener("change", () => loadData().catch((error) => notify(error.message)));
$("#close-dialog").addEventListener("click", () => $("#student-dialog").close());
$("#cancel-dialog").addEventListener("click", () => $("#student-dialog").close());
$("#student-dialog").addEventListener("click", (event) => {
    if (event.target === $("#student-dialog")) $("#student-dialog").close();
});
$("#student-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = form.get("id");
    const payload = Object.fromEntries(["name", "rollNumber", "department", "email"].map((key) => [key, form.get(key)]));
    try {
        await api(id ? `/api/students/${id}` : "/api/students", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
        $("#student-dialog").close();
        await loadData();
        notify(id ? "Student details updated." : "Student added successfully.");
    } catch (error) { notify(error.message); }
});

$("#student-search").addEventListener("input", (event) => {
    state.search = event.target.value;
    clearTimeout($("#student-search").timer);
    $("#student-search").timer = setTimeout(() => loadData().catch((error) => notify(error.message)), 220);
});
$("#subject-filter").addEventListener("change", () => loadData().catch((error) => notify(error.message)));
$("#view-all-button").addEventListener("click", () => setView("students"));
$("#below-threshold-button").addEventListener("click", () => {
    state.belowThreshold = !state.belowThreshold;
    setView("reports");
    $("#below-threshold-button").innerHTML = state.belowThreshold ? "View all reports <span>→</span>" : "View below 75% <span>→</span>";
});
document.querySelectorAll(".nav-link").forEach((button) => button.addEventListener("click", () => {
    state.belowThreshold = false;
    $("#below-threshold-button").innerHTML = "View below 75% <span>→</span>";
    setView(button.dataset.view);
}));

function setView(view) {
    state.view = view;
    document.querySelectorAll(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    loadData().catch((error) => notify(error.message));
}

$("#student-rows").addEventListener("click", async (event) => {
    const edit = event.target.closest(".edit-student");
    const remove = event.target.closest(".delete-student");
    if (edit) openStudent(state.students.find((student) => student.id === Number(edit.dataset.id)));
    if (remove) {
        const student = state.students.find((item) => item.id === Number(remove.dataset.id));
        if (!student || !window.confirm(`Delete ${student.name} and their attendance records?`)) return;
        try {
            await api(`/api/students/${student.id}`, { method: "DELETE" });
            await loadData();
            notify("Student deleted.");
        } catch (error) { notify(error.message); }
    }
});

async function markAttendance(status) {
    const form = $("#attendance-form");
    const studentIds = [...form.elements.studentIds.selectedOptions].map((option) => Number(option.value));
    const subject = form.elements.subject.value.trim();
    if (!subject || !studentIds.length || !form.elements.date.value) {
        notify("Choose a subject, date, and at least one student.");
        return;
    }
    try {
        await Promise.all(studentIds.map((studentId) => api("/api/attendance", {
            method: "POST",
            body: JSON.stringify({ studentId, subject, date: form.elements.date.value, status })
        })));
        form.elements.studentIds.selectedIndex = -1;
        await loadData();
        notify(`Attendance marked ${status.toLowerCase()} for ${studentIds.length} ${studentIds.length === 1 ? "student" : "students"}.`);
    } catch (error) { notify(error.message); }
}
$("#mark-present").addEventListener("click", () => markAttendance("PRESENT"));
$("#mark-absent").addEventListener("click", () => markAttendance("ABSENT"));

loadData().catch((error) => notify(error.message));
