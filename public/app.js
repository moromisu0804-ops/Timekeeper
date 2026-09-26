// Timekeeper - トグルスイッチで作業時間を記録するアプリのメインロジック
// ビルド不要のシンプル構成にするため、Firebase SDKはCDNのESモジュールを直接読み込んでいます。

import { firebaseConfig, ALLOWED_EMAILS } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- DOM要素 ----------
const loginScreen = document.getElementById("login-screen");
const deniedScreen = document.getElementById("denied-screen");
const appScreen = document.getElementById("app");

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const deniedLogoutBtn = document.getElementById("denied-logout-btn");
const userEmailEl = document.getElementById("user-email");

const toggleBtn = document.getElementById("toggle-btn");
const elapsedDisplay = document.getElementById("elapsed-display");
const statusLabel = document.getElementById("status-label");

const rangeStartInput = document.getElementById("range-start");
const rangeEndInput = document.getElementById("range-end");
const aggregateBtn = document.getElementById("aggregate-btn");
const quickRangeButtons = document.querySelectorAll("[data-range]");
const statsTotalValue = document.getElementById("stats-total-value");
const chartCanvas = document.getElementById("chart");

const recordsBody = document.getElementById("records-body");
const recordsEmpty = document.getElementById("records-empty");

// ---------- 状態管理 ----------
let currentUser = null;
let currentMeta = { isRunning: false, startedAt: null };
let metaUnsub = null;
let sessionsUnsub = null;
let tickInterval = null;
let chartInstance = null;

// ---------- ユーティリティ ----------
function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatHMS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
}

function formatDurationJP(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}時間${m}分`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// YYYY-MM-DD (ローカル時刻基準)
function dateInputValue(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// datetime-local用 (YYYY-MM-DDTHH:mm, ローカル時刻基準)
function toDatetimeLocalValue(date) {
  const d = new Date(date);
  return `${dateInputValue(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function showScreen(name) {
  loginScreen.classList.toggle("hidden", name !== "login");
  deniedScreen.classList.toggle("hidden", name !== "denied");
  appScreen.classList.toggle("hidden", name !== "app");
}

function cleanupListeners() {
  if (metaUnsub) {
    metaUnsub();
    metaUnsub = null;
  }
  if (sessionsUnsub) {
    sessionsUnsub();
    sessionsUnsub = null;
  }
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  currentMeta = { isRunning: false, startedAt: null };
}

// ---------- 認証 ----------
loginBtn.addEventListener("click", () => {
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider).catch((err) => {
    alert("ログインに失敗しました: " + err.message);
  });
});

logoutBtn.addEventListener("click", () => signOut(auth));
deniedLogoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  cleanupListeners();

  if (!user) {
    currentUser = null;
    showScreen("login");
    return;
  }

  if (!ALLOWED_EMAILS.includes(user.email)) {
    showScreen("denied");
    return;
  }

  currentUser = user;
  userEmailEl.textContent = user.email;
  showScreen("app");

  subscribeMeta(user.uid);
  subscribeRecords(user.uid);
  setQuickRange("today");
  runAggregate();
});

// ---------- トグルスイッチ ----------
function subscribeMeta(uid) {
  const metaRef = doc(db, "users", uid, "meta", "current");
  metaUnsub = onSnapshot(metaRef, (snap) => {
    currentMeta = snap.exists()
      ? snap.data()
      : { isRunning: false, startedAt: null };
    updateToggleUI();
  });
}

function updateToggleUI() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }

  if (currentMeta.isRunning && currentMeta.startedAt) {
    toggleBtn.textContent = "作業終了";
    toggleBtn.classList.add("running");
    statusLabel.textContent = "作業中";

    const startMs = currentMeta.startedAt.toDate().getTime();
    const update = () => {
      elapsedDisplay.textContent = formatHMS((Date.now() - startMs) / 1000);
    };
    update();
    tickInterval = setInterval(update, 1000);
  } else {
    toggleBtn.textContent = "作業開始";
    toggleBtn.classList.remove("running");
    statusLabel.textContent = currentMeta.isRunning
      ? "開始時刻を同期中..."
      : "停止中";
    elapsedDisplay.textContent = "00:00:00";
  }
}

toggleBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  toggleBtn.disabled = true;
  try {
    const uid = currentUser.uid;
    const metaRef = doc(db, "users", uid, "meta", "current");

    if (currentMeta.isRunning) {
      if (!currentMeta.startedAt) {
        alert("開始時刻を同期中です。数秒待ってから再度お試しください。");
        return;
      }
      const start = currentMeta.startedAt;
      const endDate = new Date();
      const durationSeconds = Math.max(
        0,
        Math.round((endDate.getTime() - start.toDate().getTime()) / 1000)
      );
      await addDoc(collection(db, "users", uid, "sessions"), {
        start,
        end: Timestamp.fromDate(endDate),
        durationSeconds,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(metaRef, { isRunning: false, startedAt: null });
      runAggregate();
    } else {
      await setDoc(metaRef, { isRunning: true, startedAt: serverTimestamp() });
    }
  } catch (err) {
    alert("エラーが発生しました: " + err.message);
  } finally {
    toggleBtn.disabled = false;
  }
});

// ---------- 記録一覧 ----------
function subscribeRecords(uid) {
  const q = query(
    collection(db, "users", uid, "sessions"),
    orderBy("start", "desc"),
    limit(200)
  );
  sessionsUnsub = onSnapshot(q, (snap) => {
    renderRecords(snap.docs);
  });
}

function renderRecords(docs) {
  recordsBody.innerHTML = "";
  recordsEmpty.classList.toggle("hidden", docs.length > 0);

  docs.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;
    const tr = document.createElement("tr");

    const startTd = document.createElement("td");
    const startInput = document.createElement("input");
    startInput.type = "datetime-local";
    startInput.value = toDatetimeLocalValue(data.start.toDate());
    startTd.appendChild(startInput);

    const endTd = document.createElement("td");
    const endInput = document.createElement("input");
    endInput.type = "datetime-local";
    endInput.value = toDatetimeLocalValue(data.end.toDate());
    endTd.appendChild(endInput);

    const durationTd = document.createElement("td");
    durationTd.textContent = formatDurationJP(data.durationSeconds);

    const actionsTd = document.createElement("td");
    const actionsWrap = document.createElement("div");
    actionsWrap.className = "row-actions";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "更新";
    saveBtn.className = "btn-secondary btn-small";
    saveBtn.addEventListener("click", () =>
      saveRecord(id, startInput.value, endInput.value, durationTd)
    );

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "削除";
    deleteBtn.className = "btn-danger btn-small";
    deleteBtn.addEventListener("click", () => deleteRecord(id));

    actionsWrap.appendChild(saveBtn);
    actionsWrap.appendChild(deleteBtn);
    actionsTd.appendChild(actionsWrap);

    tr.appendChild(startTd);
    tr.appendChild(endTd);
    tr.appendChild(durationTd);
    tr.appendChild(actionsTd);
    recordsBody.appendChild(tr);
  });
}

async function saveRecord(id, startStr, endStr, durationTd) {
  if (!currentUser || !startStr || !endStr) return;
  const startDate = new Date(startStr);
  const endDate = new Date(endStr);

  if (endDate <= startDate) {
    alert("終了時刻は開始時刻より後にしてください。");
    return;
  }

  const durationSeconds = Math.round((endDate - startDate) / 1000);
  try {
    await updateDoc(
      doc(db, "users", currentUser.uid, "sessions", id),
      {
        start: Timestamp.fromDate(startDate),
        end: Timestamp.fromDate(endDate),
        durationSeconds,
        updatedAt: serverTimestamp(),
      }
    );
    if (durationTd) durationTd.textContent = formatDurationJP(durationSeconds);
    runAggregate();
  } catch (err) {
    alert("更新に失敗しました: " + err.message);
  }
}

async function deleteRecord(id) {
  if (!currentUser) return;
  if (!confirm("この記録を削除しますか？")) return;
  try {
    await deleteDoc(doc(db, "users", currentUser.uid, "sessions", id));
    runAggregate();
  } catch (err) {
    alert("削除に失敗しました: " + err.message);
  }
}

// ---------- 集計・グラフ ----------
function getRangeForToday() {
  const start = startOfDay(new Date());
  return { start, end: start };
}

function getRangeForWeek() {
  const now = new Date();
  const day = now.getDay(); // 0=日,1=月,...6=土
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = addDays(startOfDay(now), diffToMonday);
  const sunday = addDays(monday, 6);
  return { start: monday, end: sunday };
}

function getRangeForMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
}

function setQuickRange(kind) {
  let range;
  if (kind === "today") range = getRangeForToday();
  else if (kind === "week") range = getRangeForWeek();
  else if (kind === "month") range = getRangeForMonth();
  else return;

  rangeStartInput.value = dateInputValue(range.start);
  rangeEndInput.value = dateInputValue(range.end);
}

quickRangeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    setQuickRange(btn.dataset.range);
    runAggregate();
  });
});

aggregateBtn.addEventListener("click", () => runAggregate());

async function runAggregate() {
  if (!currentUser) return;
  const startStr = rangeStartInput.value;
  const endStr = rangeEndInput.value;
  if (!startStr || !endStr) return;

  const queryStart = new Date(`${startStr}T00:00:00`);
  const queryEndExclusive = addDays(new Date(`${endStr}T00:00:00`), 1);

  if (queryEndExclusive <= queryStart) {
    alert("終了日は開始日以降にしてください。");
    return;
  }

  const totalDays = Math.round(
    (queryEndExclusive - queryStart) / (1000 * 60 * 60 * 24)
  );
  if (totalDays > 180) {
    alert("期間が長すぎます。180日以内で指定してください。");
    return;
  }

  try {
    const uid = currentUser.uid;
    const sessionsRef = collection(db, "users", uid, "sessions");
    const q = query(
      sessionsRef,
      where("start", ">=", Timestamp.fromDate(queryStart)),
      where("start", "<", Timestamp.fromDate(queryEndExclusive)),
      orderBy("start", "asc")
    );
    const snap = await getDocs(q);

    const totalsByDate = new Map();
    let totalSeconds = 0;
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const key = dateInputValue(data.start.toDate());
      totalsByDate.set(key, (totalsByDate.get(key) || 0) + data.durationSeconds);
      totalSeconds += data.durationSeconds;
    });

    statsTotalValue.textContent = formatDurationJP(totalSeconds);

    const labels = [];
    const values = [];
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(queryStart, i);
      const key = dateInputValue(d);
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
      values.push(
        Math.round(((totalsByDate.get(key) || 0) / 3600) * 100) / 100
      );
    }

    renderChart(labels, values);
  } catch (err) {
    alert("集計に失敗しました: " + err.message);
  }
}

function renderChart(labels, values) {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  chartInstance = new Chart(chartCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "作業時間(時間)",
          data: values,
          backgroundColor: "#3b82f6",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "時間" },
        },
      },
    },
  });
}
