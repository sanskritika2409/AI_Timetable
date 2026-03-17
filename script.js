const { useState, useEffect } = React;

function solveTimetableCSP(subjects, days, slots, slotDuration) {
  if (!subjects || subjects.length === 0) return null;
  const isLab = (s) => s.name.toLowerCase().includes("lab");
  const doubleLab = slotDuration >= 40;

  const domains = subjects.map((s) => {
    const dom = [];
    for (let d = 0; d < days.length; d++) {
      for (let si = 0; si < slots.length; si++) {
        if (isLab(s) && doubleLab && si >= slots.length - 1) continue;
        dom.push({ day: days[d], slotIndex: si });
      }
    }
    return dom;
  });

  const n = subjects.length;
  const assignments = Array(n).fill(null);

  function conflicts(subjIndex, candidate, assignmentsSnapshot) {
    const subj = subjects[subjIndex];
    const teacher = subj.teacher;
    const room = subj.classroom;
    const batch = subj.batch;
    const needTwo = isLab(subj) && doubleLab;

    for (let i = 0; i < n; i++) {
      if (!assignmentsSnapshot[i] || i === subjIndex) continue;
      const a = assignmentsSnapshot[i];
      const s = subjects[i];
      const sIsLab = isLab(s);

      if (a.day !== candidate.day) continue;
      const occA = sIsLab && doubleLab ? [a.slotIndex, a.slotIndex + 1] : [a.slotIndex];
      const occC = needTwo ? [candidate.slotIndex, candidate.slotIndex + 1] : [candidate.slotIndex];
      if (occA.some((x) => occC.includes(x))) {
        if (s.teacher === teacher) return true;
        if (s.classroom === room) return true;
        if (s.batch === batch) return true;
      }
    }
    return false;
  }

  function cloneDomains(domains) {
    return domains.map((d) => d.slice());
  }
  function mrvVar(unassignedSet, curDomains) {
    let best = null,
      bestSize = Infinity;
    for (let idx of unassignedSet) {
      const size = curDomains[idx].length;
      if (size < bestSize) {
        bestSize = size;
        best = idx;
      }
    }
    return best;
  }

  function forwardChecking(varIdx, value, curDomains, unassigned) {
    const newDomains = cloneDomains(curDomains);
    for (let other of unassigned) {
      if (other === varIdx) continue;
      newDomains[other] = newDomains[other].filter((candidate) => {
        if (candidate.day !== value.day) return true;
        const aIsLab = isLab(subjects[other]);
        const bIsLab = isLab(subjects[varIdx]);
        const aOcc = aIsLab && doubleLab ? [candidate.slotIndex, candidate.slotIndex + 1] : [candidate.slotIndex];
        const bOcc = bIsLab && doubleLab ? [value.slotIndex, value.slotIndex + 1] : [value.slotIndex];
        if (aOcc.some((x) => bOcc.includes(x))) {
          if (subjects[other].teacher === subjects[varIdx].teacher) return false;
          if (subjects[other].classroom === subjects[varIdx].classroom) return false;
          if (subjects[other].batch === subjects[varIdx].batch) return false;
        }
        return true;
      });
      if (newDomains[other].length === 0) return null;
    }
    return newDomains;
  }
  function backtrack(curDomains, unassignedSet, assignmentsSnapshot) {
    if (unassignedSet.size === 0) {
      const table = {};
      for (let i = 0; i < n; i++) {
        const a = assignmentsSnapshot[i];
        if (!a) continue;
        const day = a.day,
          slotIndex = a.slotIndex;
        const subj = subjects[i];
        table[day] = table[day] || {};
        const slotKey = slotIndex;
        table[day][slotKey] = table[day][slotKey] || [];
        table[day][slotKey].push(subj);
        if (isLab(subj) && doubleLab) {
          const nextKey = slotIndex + 1;
          table[day][nextKey] = table[day][nextKey] || [];
          table[day][nextKey].push(subj);
        }
      }
      return table;
    }
    const varIdx = mrvVar(unassignedSet, curDomains);
    if (varIdx === null) return null;
    const domainList = curDomains[varIdx].slice();
    for (let candidate of domainList) {
      if (conflicts(varIdx, candidate, assignmentsSnapshot)) continue;
      assignmentsSnapshot[varIdx] = candidate;
      const remaining = new Set(unassignedSet);
      remaining.delete(varIdx);
      const newDomains = forwardChecking(varIdx, candidate, curDomains, remaining);
      if (newDomains !== null) {
        const result = backtrack(newDomains, remaining, assignmentsSnapshot);
        if (result) return result;
      }
      assignmentsSnapshot[varIdx] = null;
    }
    return null;
  }
  const startDomains = domains.map((d) => d.slice());
  const unassigned = new Set([...Array(n).keys()]);
  return backtrack(startDomains, unassigned, Array(n).fill(null));
}

function fallbackTimetable(subjects, days, slots, slotDuration) {
  const doubleLab = slotDuration >= 40;
  const table = {};
  let idx = 0;
  for (const day of days) {
    table[day] = {};
    for (let s = 0; s < slots.length; s++) {
      table[day][s] = [];
      if (idx < subjects.length) {
        table[day][s].push(subjects[idx++]);
        if (
          subjects[idx - 1].name.toLowerCase().includes("lab") &&
          ((doubleLab && s < slots.length - 1) || !doubleLab)
        ) {
          const nextSlot = doubleLab ? s + 1 : s;
          table[day][nextSlot] = table[day][nextSlot] || [];
          table[day][nextSlot].push(subjects[idx - 1]);
          if (doubleLab) s++;
        }
      }
    }
  }
  return table;
}

const STORAGEKEYS = {
  SUBJECTS: "tt_subjects_v1",
  IMPORTED: "tt_imported_v1",
  TIMETABLE: "tt_table_v1",
  SETTINGS: "tt_settings_v1",
};

function saveToStorage(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}
function loadFromStorage(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}

function App() {
  const defaultSettings = {
    startTime: "09:00",
    endTime: "16:00",
    slotDuration: 60,
    recessSlotIndex: null, // ⬅ Added dynamic recess slot index
  };

  const [subjects, setSubjects] = useState([]);
  const [newSubject, setNewSubject] = useState({
    name: "",
    teacher: "",
    classroom: "",
    batch: "",
    department: " ",
    slot: " ",
  });
  const [importedSubjects, setImportedSubjects] = useState([]);
  const [timetable, setTimetable] = useState({});
  const [settings, setSettings] = useState(defaultSettings);
  const [filterDept, setFilterDept] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [filterBatch, setFilterBatch] = useState("");

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function generateSlots() {
    const { startTime, endTime, slotDuration } = settings;
    let [sh, sm] = startTime.split(":").map(Number);
    let [eh, em] = endTime.split(":").map(Number);
    let current = new Date(2000, 0, 1, sh, sm),
      end = new Date(2000, 0, 1, eh, em);
    const pad = (n) => (n < 10 ? "0" : "") + n;
    const out = [];
    while (current < end) {
      let next = new Date(current.getTime() + slotDuration * 60000);
      if (next > end) break;
      out.push(
        `${pad(current.getHours())}:${pad(current.getMinutes())}-${pad(
          next.getHours()
        )}:${pad(next.getMinutes())}`
      );
      current = next;
    }
    return out;
  }
  const slots = generateSlots();

  const allSubjects = [...importedSubjects, ...subjects];

  useEffect(() => saveToStorage(STORAGEKEYS.SUBJECTS, subjects), [subjects]);
  useEffect(() => saveToStorage(STORAGEKEYS.IMPORTED, importedSubjects), [importedSubjects]);
  useEffect(() => saveToStorage(STORAGEKEYS.TIMETABLE, timetable), [timetable]);
  useEffect(() => saveToStorage(STORAGEKEYS.SETTINGS, settings), [settings]);

  function addSubject() {
    if (
      !newSubject.name ||
      !newSubject.teacher ||
      !newSubject.classroom ||
      !newSubject.batch ||
      !newSubject.department ||
      !newSubject.day ||
      !newSubject.slot
    ) {
      alert("Please fill all fields, including day and slot");
      return;
    }

    const slotIndex = slots.findIndex((s) => s === newSubject.slot);
    if (slotIndex === -1) {
      alert("Invalid slot selected");
      return;
    }

    const subjectEntry = {
      name: newSubject.name.trim(),
      teacher: newSubject.teacher.trim(),
      classroom: newSubject.classroom.trim(),
      batch: newSubject.batch.trim(),
      department: newSubject.department.trim().toLowerCase(),
      day: newSubject.day,
      slotIndex: slotIndex,
    };

    setSubjects((prev) => [...prev, subjectEntry]);

    setNewSubject({
      name: "",
      teacher: "",
      classroom: "",
      batch: "",
      department: "",
      day: days[0],
      slot: slots[0],
    });
  }

  function generateTimetableCSP() {
    if (allSubjects.length === 0) {
      alert("No subjects to schedule");
      return;
    }
    const subjectsCopy = allSubjects.map((s) => ({ ...s }));
    const result = solveTimetableCSP(subjectsCopy, days, slots, settings.slotDuration);
    if (!result) {
      alert("CSP scheduling failed, falling back to auto-assignment (may violate constraints)");
      setTimetable(fallbackTimetable(subjectsCopy, days, slots, settings.slotDuration));
    } else {
      setTimetable(result);
    }
  }

  function importCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const rows = text
        .split("\n")
        .map((r) => r.trim())
        .filter((r) => r.length);
      const parsed = [];
      const headers = rows[0].split(",").map((h) => h.trim().toLowerCase());
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(",").map((c) => c.trim());
        const obj = {};
        headers.forEach((h, idx) => (obj[h] = cols[idx]));
        let slotIdx = slots.findIndex((s) => s === obj.slot);
        if (slotIdx === -1) slotIdx = 0;
        parsed.push({
          day: obj.day,
          slotIndex: slotIdx,
          name: obj.subject || obj.name,
          teacher: obj.teacher,
          classroom: obj.classroom,
          batch: obj.batch,
          department: (obj.department || "").trim().toLowerCase(),
        });
      }
      setImportedSubjects((prev) => [...prev, ...parsed]);
      alert("Imported " + parsed.length + " rows");
    };
    reader.readAsText(file);
  }

  function generateFromCSVFile() {
    if (!importedSubjects.length) {
      alert("No imported subjects");
      return;
    }
    const table = {};
    const doubleLab = settings.slotDuration >= 40;
    for (const subj of importedSubjects) {
      if (!subj.day || typeof subj.slotIndex !== "number") continue;
      table[subj.day] = table[subj.day] || {};
      table[subj.day][subj.slotIndex] = table[subj.day][subj.slotIndex] || [];
      table[subj.day][subj.slotIndex].push(subj);
      if (
        subj.name &&
        subj.name.toLowerCase().includes("lab") &&
        doubleLab &&
        subj.slotIndex < slots.length - 1
      ) {
        table[subj.day][subj.slotIndex + 1] = table[subj.day][subj.slotIndex + 1] || [];
        table[subj.day][subj.slotIndex + 1].push(subj);
      }
    }
    setTimetable(table);
  }

  function exportCSV() {
    const rows = [
      ["Day", "Slot", "Subject", "Teacher", "Classroom", "Batch", "Department"],
    ];
    for (const day of days) {
      for (let i = 0; i < slots.length; i++) {
        if (timetable[day] && timetable[day][i]) {
          for (const subj of timetable[day][i]) {
            rows.push([
              day,
              slots[i],
              subj.name,
              subj.teacher,
              subj.classroom,
              subj.batch,
              subj.department,
            ]);
          }
        }
      }
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Timetable");
    XLSX.writeFile(wb, "timetable.xlsx");
  }

  function exportPDF() {
    const table = document.querySelector(".timetable-table");
    if (!table) {
      alert("No timetable to export");
      return;
    }

    const originalBodyWidth = document.body.style.width;
    const originalBodyHeight = document.body.style.height;
    const originalBodyOverflow = document.body.style.overflow;

    document.body.style.width = "auto";
    document.body.style.height = "auto";
    document.body.style.overflow = "visible";

    const originalTableWidth = table.style.width;
    const originalTableHeight = table.style.height;
    table.style.width = table.scrollWidth + "px";
    table.style.height = table.scrollHeight + "px";

    html2canvas(table, { backgroundColor: "#fafafe", scale: 2 }).then((canvas) => {
      table.style.width = originalTableWidth;
      table.style.height = originalTableHeight;
      document.body.style.width = originalBodyWidth;
      document.body.style.height = originalBodyHeight;
      document.body.style.overflow = originalBodyOverflow;

      const imgData = canvas.toDataURL("image/png");
      const pdf = new window.jspdf.jsPDF("l", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const totalPages = Math.ceil(imgHeight / pageHeight);

      for (let i = 0; i < totalPages; i++) {
        const srcY = (canvas.height / totalPages) * i;
        const sectionHeight = canvas.height / totalPages;

        const canvasPart = document.createElement("canvas");
        canvasPart.width = canvas.width;
        canvasPart.height = sectionHeight;
        const ctx = canvasPart.getContext("2d");
        ctx.drawImage(canvas, 0, srcY, canvas.width, sectionHeight, 0, 0, canvas.width, sectionHeight);

        const imgPart = canvasPart.toDataURL("image/png");
        if (i > 0) pdf.addPage();
        pdf.addImage(imgPart, "PNG", 10, 10, imgWidth, pageHeight - 20);
      }

      pdf.save("TimetableReport.pdf");
    });
  }

  const teacherNames = [
    ...new Set(allSubjects.map((s) => s.teacher).filter(Boolean)),
  ];
  const teacherWorkload = allSubjects.reduce((acc, s) => {
    if (!s.teacher) return acc;
    acc[s.teacher] = (acc[s.teacher] || 0) + 1;
    return acc;
  }, {});
  const roomUsage = allSubjects.reduce((acc, s) => {
    const r = s.classroom || "Unknown";
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});

  function busiestDayForTeacher(teacherName) {
    const perDay = {};
    for (const day of days) perDay[day] = 0;
    for (const slot of slots.keys()) {
      for (const day of days) {
        const items = timetable[day] && timetable[day][slot] ? timetable[day][slot] : [];
        for (const item of items) {
          if (item.teacher === teacherName) perDay[day]++;
        }
      }
    }
    let bestDay = null,
      bestVal = -1;
    for (const d of days) {
      if (perDay[d] > bestVal) {
        bestVal = perDay[d];
        bestDay = d;
      }
    }
    return { day: bestDay, count: bestVal };
  }

  function timetableForTeacher(teacherName) {
    const table = {};
    for (const day of days) {
      table[day] = {};
      for (let idx = 0; idx < slots.length; idx++) {
        const items = timetable[day] && timetable[day][idx] ? timetable[day][idx] : [];
        const filtered = items.filter((i) => i.teacher === teacherName);
        if (filtered.length) table[day][idx] = filtered;
      }
    }
    return table;
  }

  const deptOptions = [
    ...new Set(
      allSubjects
        .map((s) => s.department?.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  function renderTable(filteredTeacher = null) {
    const table = filteredTeacher ? timetableForTeacher(filteredTeacher) : timetable;
    return (
      <div className="timetable-wrapper">
        <table className="timetable-table" key={filteredTeacher || "main"}>
          <thead>
            <tr>
              <th>Time</th>
              {days.map((d) => (
                <th key={d}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, si) => {
              // Dynamic recess: show break if slot matches selected recess index
              if (settings.recessSlotIndex !== null && si === settings.recessSlotIndex) {
                return (
                  <tr key={"recess"}>
                    <td className="time-slot recess-cell" colSpan={days.length + 1}>
                      Recess Break ({slots[si]})
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={si}>
                  <td className="time-slot">{slot}</td>
                  {days.map((day) => {
                    let items = table[day] && table[day][si] ? table[day][si] : [];
                    if (filterDept) items = items.filter((i) => i.department === filterDept);
                    if (filterBatch) items = items.filter((i) => i.batch === filterBatch);
                    if (filteredTeacher) items = items.filter((i) => i.teacher === filteredTeacher);
                    return (
                      <td key={day}>
                        {items.length === 0
                          ? null
                          : items.map((it, idx) => (
                              <div
                                className={`slot-card${
                                  it.name && it.name.toLowerCase().includes("lab") ? " lab" : ""
                                }`}
                                key={idx}
                              >
                                <strong>{it.name}</strong>
                                <div className="details">
                                  {it.teacher} / {it.classroom} / {it.batch}
                                </div>
                                <div className="dept">{it.department}</div>
                              </div>
                            ))}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function clearAll() {
    if (!window.confirm("Clear all saved data?")) return;
    setSubjects([]);
    setImportedSubjects([]);
    setTimetable({});
    localStorage.clear();
  }
  function updateSetting(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="container">
      <div className="header">
        <h1 className="heading-underline">AI Timetable Generator</h1>
        <div className="small-note">
          CSP scheduling · teacher analytics · colorful Excel/PDF · fully responsive UI
        </div>
      </div>
      <div className="main-row">
        <div className="sidebar">
          <h3 className="heading-underline">Settings</h3>
          <div className="form-group">
            <label>Start Time</label>
            <input
              type="time"
              value={settings.startTime}
              onChange={(e) => updateSetting("startTime", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>End Time</label>
            <input
              type="time"
              value={settings.endTime}
              onChange={(e) => updateSetting("endTime", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Slot Duration (minutes)</label>
            <input
              type="number"
              value={settings.slotDuration}
              onChange={(e) => updateSetting("slotDuration", Number(e.target.value))}
            />
          </div>
          {/* === Added Recess Slot selector === */}
          <div className="form-group">
            <label>Recess Slot</label>
            <select
              value={settings.recessSlotIndex !== null ? settings.recessSlotIndex : ""}
              onChange={(e) =>
                updateSetting(
                  "recessSlotIndex",
                  e.target.value === "" ? null : parseInt(e.target.value)
                )
              }
            >
              <option value="">None</option>
              {slots.map((slot, idx) => (
                <option key={idx} value={idx}>
                  {slot}
                </option>
              ))}
            </select>
          </div>
          {/* === End of Recess selector addition === */}
          <h3 className="heading-underline">Add Subject</h3>
          {["name", "teacher", "classroom", "batch", "department"].map((f) => (
            <div className="form-group" key={f}>
              <label>{f.charAt(0).toUpperCase() + f.slice(1)}</label>
              <input
                type="text"
                value={newSubject[f]}
                onChange={(e) => setNewSubject((prev) => ({ ...prev, [f]: e.target.value }))}
              />
            </div>
          ))}
          <div className="form-group">
            <label>Day</label>
            <select
              value={newSubject.day}
              onChange={(e) => setNewSubject({ ...newSubject, day: e.target.value })}
            >
              {days.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Slot</label>
            <select
              value={newSubject.slot}
              onChange={(e) => setNewSubject({ ...newSubject, slot: e.target.value })}
            >
              {slots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary btn-full" onClick={addSubject}>
            Add Subject
          </button>
          <button className="btn btn-success btn-full" onClick={generateTimetableCSP}>
            Generate Timetable (Smart CSP)
          </button>
          <hr style={{ margin: "12px 0" }} />
          <h3 className="heading-underline">Import CSV</h3>
          <input type="file" accept=".csv" onChange={importCSV} />
          <button className="btn btn-warning btn-full" onClick={generateFromCSVFile}>
            Generate from CSV
          </button>
          <hr style={{ margin: "12px 0" }} />
          <button className="btn btn-secondary btn-full" onClick={exportCSV}>
            Export Excel
          </button>
          <button className="btn btn-secondary btn-full" onClick={exportPDF}>
            Export PDF
          </button>
          <button className="btn btn-secondary btn-full" onClick={clearAll}>
            Clear All Data
          </button>
        </div>
        <div className="panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontWeight: 600 }}>Filter Dept</label>
              <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
                <option value="">All</option>
                {deptOptions.map((d) => (
                  <option key={d} value={d}>
                    {d.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontWeight: 600 }}>Filter Batch</label>
                 <select value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
                    <option value="">All</option>
                    {allSubjects
                    .map((s) => s.batch)
                    .filter((v, i, self) => v && self.indexOf(v) === i)
                    .map((b) => (
                    <option key={b} value={b}>{b}</option>
                    ))}
                 </select>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontWeight: 600 }}>Teacher View</label>
              <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
                <option value="">All Teachers</option>
                {teacherNames.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            {teacherFilter ? (
              <>
                <h3>{`Timetable for ${teacherFilter}`}</h3>
                {renderTable(teacherFilter)}
              </>
            ) : (
              <>
                <h3>Full Timetable</h3>
                {renderTable()}
              </>
            )}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 32, marginBottom: 8 }}>
        <h3>Teacher Analytics</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{teacherNames.length}</div>
            <div>Total Teachers</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{Object.keys(roomUsage).length}</div>
            <div>Rooms Used</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{allSubjects.length}</div>
            <div>Total Classes</div>
          </div>
        </div>
        <h4 style={{ margin: "12px 0 2px 0" }}>Workload by Teacher</h4>
        <div className="workload-cards-wrap">
          {teacherNames.map((t) => {
            const c = teacherWorkload[t];
            const busiest = busiestDayForTeacher(t);
            return (
              <div className="workload-card" key={t}>
                <div className="teacher-name">{t}</div>
                <div className="classes">{c} classes</div>
                <div className="busiest-day">
                  Busiest Day: <span style={{ fontWeight: 700 }}>{busiest.day || "-"}</span>
                  <span className="tt-detail"> ({busiest.count || 0} periods)</span>
                </div>
                <div className="tt-detail">
                  Rooms:{" "}
                  {allSubjects
                    .filter((s) => s.teacher === t)
                    .map((s) => s.classroom)
                    .filter((v, i, self) => self.indexOf(v) === i)
                    .join(", ") || "-"}
                </div>
                <div className="tt-detail">
                  Batches:{" "}
                  {allSubjects
                    .filter((s) => s.teacher === t)
                    .map((s) => s.batch)
                    .filter((v, i, self) => self.indexOf(v) === i)
                    .join(", ") || "-"}
                </div>
                <div className="tt-detail">
                  Departments:{" "}
                  {allSubjects
                    .filter((s) => s.teacher === t)
                    .map((s) => s.department)
                    .filter((v, i, self) => self.indexOf(v) === i)
                    .map((d) => (d ? d.toUpperCase() : "-"))
                    .join(", ") || "-"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));
