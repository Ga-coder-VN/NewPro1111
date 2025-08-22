import { initializeApp } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";

/* ---------------- Firebase ---------------- */
const firebaseConfig = {
  apiKey: "AIzaSyAliTR-e-24mHTfTHJL-h4WIUI7SzZaeNQ",
  authDomain: "newpro-9b95b.firebaseapp.com",
  projectId: "newpro-9b95b",
  storageBucket: "newpro-9b95b.appspot.com",
  messagingSenderId: "855723554312",
  appId: "1:855723554312:web:01c5af147d6f00ee6b43bd",
  measurementId: "G-F8F1JZD5ME"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------------- State & UI ---------------- */
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app');
let currentUserData = null;
let editId = null;

function showApp() {
  authSection.classList.add('hidden');
  appSection.classList.remove('hidden');
  render();
}
function showAuth() {
  authSection.classList.remove('hidden');
  appSection.classList.add('hidden');
}
document.getElementById('toggle-theme').onclick = () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
};
if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');

/* ---------------- Auth ---------------- */
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", userCredential.user.uid), {
      name, email, budget: 0, transactions: []
    });
    alert("Đăng ký thành công! Vui lòng đăng nhập.");
    document.getElementById('register').classList.add('hidden');
  } catch (err) { alert("Lỗi đăng ký: " + err.message); }
});

document.getElementById('show-register').onclick = () =>
  document.getElementById('register').classList.toggle('hidden');
document.getElementById('show-reset').onclick = () =>
  document.getElementById('reset').classList.toggle('hidden');

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById('login-email').value,
      document.getElementById('login-password').value
    );
  } catch (err) { alert("Lỗi đăng nhập: " + err.message); }
});

document.getElementById('logout').onclick = async () => { await signOut(auth); };

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) { currentUserData = { ...snap.data(), uid: user.uid }; showApp(); }
  } else { currentUserData = null; showAuth(); }
});

document.getElementById('reset-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await sendPasswordResetEmail(auth, document.getElementById('reset-email').value);
    alert("Đã gửi liên kết đặt lại mật khẩu.");
    document.getElementById('reset').classList.add('hidden');
  } catch (err) { alert("Lỗi: " + err.message); }
});

/* ---------------- Giao dịch ---------------- */
document.getElementById('add-transaction-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const rawAmount = document.getElementById('amount').value;
  const data = {
    id: editId || Date.now(),
    type: document.getElementById('type').value,
    amount: !isNaN(Number(rawAmount)) ? Number(rawAmount) : 0,
    description: document.getElementById('description').value,
    date: document.getElementById('date').value,
    category: document.getElementById('category').value
  };

  const ref = doc(db, "users", currentUserData.uid);
  let updated = [...currentUserData.transactions];
  if (editId) { updated = updated.map(t => t.id === editId ? data : t); editId = null; }
  else updated.push(data);

  await updateDoc(ref, { transactions: updated });
  currentUserData = { ...(await getDoc(ref)).data(), uid: currentUserData.uid };
  e.target.reset();

  const totalExpenses = currentUserData.transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + (!isNaN(Number(t.amount)) ? Number(t.amount) : 0), 0);

  const safeBudget = !isNaN(Number(currentUserData.budget)) ? Number(currentUserData.budget) : 0;
  if (safeBudget > 0 && totalExpenses > safeBudget) alert('⚠️ Bạn đã vượt quá ngân sách!');
  render();
});

/* ---------------- Ngân sách ---------------- */
document.getElementById('set-budget-btn').onclick = async () => {
  const b = prompt('Nhập ngân sách:', currentUserData.budget || 0);
  const ref = doc(db, "users", currentUserData.uid);
  await updateDoc(ref, { budget: !isNaN(Number(b)) ? Number(b) : 0 });
  currentUserData = { ...(await getDoc(ref)).data(), uid: currentUserData.uid };
  render();
};

/* ---------------- Export CSV ---------------- */
document.getElementById('export-data').onclick = () => {
  if (!currentUserData?.transactions?.length) return alert("Không có dữ liệu để xuất.");
  const escapeCSV = (v) => `"${String(v).replace(/"/g, '""')}"`;
  let csv = 'Ngày,Mô tả,Danh mục,Loại,Số tiền\n';
  currentUserData.transactions.forEach(t => {
    const amt = !isNaN(Number(t.amount)) ? Number(t.amount) : 0;
    csv += [
      escapeCSV(t.date),
      escapeCSV(t.description),
      escapeCSV(t.category),
      escapeCSV(t.type === 'income' ? 'Thu' : 'Chi'),
      escapeCSV(amt)
    ].join(',') + '\n';
  });
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'chi_tieu.csv';
  a.click();
};

/* ---------------- Import helpers (encoding + CSV) ---------------- */
// 1) Đọc text theo nhiều encoding để tránh lỗi "�"
async function readFileAsTextBestEffort(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const tryEnc = async (enc) => {
    try { return new TextDecoder(enc).decode(buf); } catch { return null; }
  };
  const encs = ['utf-8', 'utf-16le', 'utf-16be', 'windows-1258', 'windows-1252', 'iso-8859-1'];
  for (const enc of encs) {
    const t = await tryEnc(enc);
    if (t && !/�/.test(t)) return t.replace(/^\uFEFF/, '');
  }
  // fallback
  return (await tryEnc('utf-8') || '').replace(/^\uFEFF/, '');
}

// 2) Phát hiện delimiter
function detectDelimiter(line) {
  const cands = [',', ';', '\t', '|'];
  let best = ',', bestCnt = 0;
  for (const d of cands) {
    const cnt = line.split(d).length;
    if (cnt > bestCnt) { best = d; bestCnt = cnt; }
  }
  return best;
}

// 3) Parse 1 dòng có ngoặc kép + escape ""
function parseDelimitedLine(line, delimiter) {
  const out = [];
  let cur = '', inside = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inside && line[i + 1] === '"') { cur += '"'; i++; }
      else inside = !inside;
    } else if (ch === delimiter && !inside) {
      out.push(cur); cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map(v => v.replace(/^"|"$/g, '')); // bỏ " ở đầu/cuối
}

// 4) Parse toàn bộ CSV
function parseCSV(text) {
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const lines = clean.split('\n').filter(l => l.trim() !== '');
  if (!lines.length) return [];
  const delimiter = detectDelimiter(lines[0]);
  return lines.map(l => parseDelimitedLine(l, delimiter));
}

/* ---------------- Import (CSV/JSON) ---------------- */
document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files?.[0]; if (!file) return;

  try {
    let newDoc = null;

    if (file.name.toLowerCase().endsWith('.json')) {
      const text = await file.text();
      const parsed = JSON.parse(text);
      newDoc = Array.isArray(parsed)
        ? { ...currentUserData, transactions: parsed }
        : {
          name: parsed.name ?? currentUserData.name,
          email: parsed.email ?? currentUserData.email,
          budget: !isNaN(Number(parsed.budget)) ? Number(parsed.budget) : 0,
          transactions: parsed.transactions ?? []
        };

    } else if (file.name.toLowerCase().endsWith('.csv')) {
      const text = await readFileAsTextBestEffort(file);
      const rows = parseCSV(text);
      // Bỏ header nếu đúng mẫu "Ngày,Mô tả,..."
      const header = (rows[0] || []).map(h => h.trim().toLowerCase());
      const hasHeader =
        header.join(',').includes('ngày') ||
        header.join(',').includes('mo ta') || header.join(',').includes('mô tả');
      const body = rows.slice(hasHeader ? 1 : 0);

      const transactions = body.map((cols, i) => {
        // Đảm bảo đủ 5 cột
        const [date = '', desc = '', cat = '', loai = '', amtRaw = ''] = cols;
        const amt = Number(String(amtRaw).replace(/\s/g, '').replace(/[^\d.-]/g, ''));
        return {
          id: Date.now() + i,
          date: date || new Date().toISOString().slice(0, 10),
          description: desc || '',
          category: cat || '',
          type: (loai || '').toLowerCase().includes('thu') ? 'income' : 'expense',
          amount: !isNaN(amt) ? amt : 0
        };
      });

      newDoc = { ...currentUserData, transactions };

    } else {
      throw new Error('UNSUPPORTED');
    }

    const ref = doc(db, "users", currentUserData.uid);
    await setDoc(ref, {
      name: newDoc.name,
      email: newDoc.email,
      budget: !isNaN(Number(newDoc.budget)) ? Number(newDoc.budget) : 0,
      transactions: newDoc.transactions
    });
    currentUserData = { ...(await getDoc(ref)).data(), uid: currentUserData.uid };
    render();
    e.target.value = '';
  } catch (err) {
    console.error(err);
    alert('Tệp không hợp lệ hoặc định dạng không được hỗ trợ.');
  }
});

/* ---------------- Tài khoản ---------------- */
document.getElementById('edit-name-btn').onclick = async () => {
  const newName = prompt('Nhập tên mới:', currentUserData.name);
  if (newName) {
    const ref = doc(db, "users", currentUserData.uid);
    await updateDoc(ref, { name: newName });
    currentUserData = { ...(await getDoc(ref)).data(), uid: currentUserData.uid };
    render();
  }
};

/* ---------------- Render ---------------- */
function render() {
  if (!currentUserData) return;
  document.getElementById('welcome-message').textContent = `Xin chào, ${currentUserData.name}!`;

  const safeBudget = !isNaN(Number(currentUserData.budget)) ? Number(currentUserData.budget) : 0;
  document.getElementById('budget-display').textContent = safeBudget.toLocaleString('vi-VN') + ' ₫';
  document.getElementById('user-name-display').textContent = currentUserData.name;
  document.getElementById('user-email-display').textContent = currentUserData.email;

  let income = 0, expenses = 0;
  currentUserData.transactions.forEach(t => {
    const amt = !isNaN(Number(t.amount)) ? Number(t.amount) : 0;
    if (t.type === 'income') income += amt; else expenses += amt;
  });
  document.getElementById('balance').textContent = (income - expenses).toLocaleString('vi-VN') + ' ₫';

  const tbody = document.getElementById('transaction-table'); tbody.innerHTML = '';
  const search = document.getElementById('search').value.toLowerCase();
  const fDate = document.getElementById('filter-date').value;
  const fCat = document.getElementById('filter-category').value;

  currentUserData.transactions
    .filter(t => t.description.toLowerCase().includes(search))
    .filter(t => !fDate || t.date === fDate)
    .filter(t => !fCat || t.category === fCat)
    .sort((a,b) => new Date(b.date) - new Date(a.date))
    .forEach(t => {
      const amt = !isNaN(Number(t.amount)) ? Number(t.amount) : 0;
      const sign = (t.type === 'income') ? '+' : '-';
      const prefix = amt === 0 ? '' : sign;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${t.date}</td>
        <td>${t.description}</td>
        <td>${t.category}</td>
        <td>${prefix}${amt.toLocaleString('vi-VN')} ₫</td>
        <td>
          <button data-id="${t.id}" class="edit">Sửa</button>
          <button data-id="${t.id}" class="del">Xóa</button>
        </td>`;
      tbody.appendChild(tr);
    });

  tbody.querySelectorAll('.del').forEach(btn => btn.onclick = async e => {
    const id = Number(e.target.dataset.id);
    const updated = currentUserData.transactions.filter(t => t.id !== id);
    await updateDoc(doc(db, "users", currentUserData.uid), { transactions: updated });
    currentUserData.transactions = updated; render();
  });

  tbody.querySelectorAll('.edit').forEach(btn => btn.onclick = e => {
    const t = currentUserData.transactions.find(x => x.id === Number(e.target.dataset.id));
    editId = t.id;
    document.getElementById('type').value = t.type;
    document.getElementById('amount').value = !isNaN(Number(t.amount)) ? Number(t.amount) : 0;
    document.getElementById('description').value = t.description;
    document.getElementById('date').value = t.date;
    document.getElementById('category').value = t.category;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  updateCharts(currentUserData.transactions);
}
['search','filter-date','filter-category'].forEach(id =>
  document.getElementById(id).addEventListener('input', render));
document.getElementById('apply-filter').onclick = render;

/* ---------------- Charts ---------------- */
let incomeChart, expenseChart, timeChart;
function updateCharts(transactions) {
  const ctxIncome = document.getElementById('income-chart').getContext('2d');
  const ctxExpense = document.getElementById('expense-chart').getContext('2d');
  const ctxTime = document.getElementById('time-chart').getContext('2d');

  const incomeData = {}, expenseData = {}, timeline = {};
  transactions.forEach(t => {
    const amt = !isNaN(Number(t.amount)) ? Number(t.amount) : 0;
    const month = (t.date || '').slice(0,7);
    if (t.type === 'income') {
      incomeData[t.category] = (incomeData[t.category] || 0) + amt;
      timeline[month] = (timeline[month] || 0) + amt;
    } else {
      expenseData[t.category] = (expenseData[t.category] || 0) + amt;
      timeline[month] = (timeline[month] || 0) + amt;
    }
  });

  if (incomeChart) incomeChart.destroy();
  if (expenseChart) expenseChart.destroy();
  if (timeChart) timeChart.destroy();

  incomeChart = new Chart(ctxIncome, {
    type: 'doughnut',
    data: { labels: Object.keys(incomeData), datasets: [{ data: Object.values(incomeData), backgroundColor: ['#2ecc71','#27ae60','#1abc9c','#16a085'] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Thu theo danh mục' }, legend: { position: 'bottom' } } }
  });

  expenseChart = new Chart(ctxExpense, {
    type: 'doughnut',
    data: { labels: Object.keys(expenseData), datasets: [{ data: Object.values(expenseData), backgroundColor: ['#e74c3c','#c0392b','#d35400','#e67e22'] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Chi theo danh mục' }, legend: { position: 'bottom' } } }
  });

  timeChart = new Chart(ctxTime, {
    type: 'line',
    data: { labels: Object.keys(timeline), datasets: [{ label: 'Chi tiêu theo tháng', data: Object.values(timeline), borderColor: '#764ba2', backgroundColor: 'rgba(118,75,162,0.2)', fill: true, tension: 0.3 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Chi tiêu theo thời gian' } }, scales: { y: { beginAtZero: true } } }
  });
}// moi ngay hom nay
