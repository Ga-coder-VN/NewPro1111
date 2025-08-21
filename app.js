import { initializeApp } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBhWWsm4eaMSQGhPcOAXzs1_hzZ81C7y_Y",
  authDomain: "quanlychitieu-a48d9.firebaseapp.com",
  projectId: "quanlychitieu-a48d9",
  storageBucket: "quanlychitieu-a48d9.appspot.com",
  messagingSenderId: "975716106270",
  appId: "1:975716106270:web:79f0cfd65c3b79b9f7ae0f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app');
let currentUserData = null;
let editId = null;

// Giao diện
function showApp() {
  authSection.classList.add('hidden');
  appSection.classList.remove('hidden');
  render();
}

function showAuth() {
  authSection.classList.remove('hidden');
  appSection.classList.add('hidden');
}

// Theme
document.getElementById('toggle-theme').onclick = () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
};
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark');
}

// Đăng ký
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", userCredential.user.uid), {
      email, budget: 0, transactions: []
    });
    alert("Đăng ký thành công! Vui lòng đăng nhập.");
    document.getElementById('register').classList.add('hidden');
  } catch (err) {
    alert("Lỗi đăng ký: " + err.message);
  }
});

document.getElementById('show-register').onclick = () =>
  document.getElementById('register').classList.toggle('hidden');
document.getElementById('show-reset').onclick = () =>
  document.getElementById('reset').classList.toggle('hidden');

// Đăng nhập
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    alert("Lỗi đăng nhập: " + err.message);
  }
});

// Đăng xuất
document.getElementById('logout').onclick = async () => {
  await signOut(auth);
};

// Theo dõi trạng thái đăng nhập
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      currentUserData = { ...docSnap.data(), uid: user.uid };
      showApp();
    }
  } else {
    currentUserData = null;
    showAuth();
  }
});

// Quên mật khẩu
document.getElementById('reset-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('reset-email').value;
  try {
    await sendPasswordResetEmail(auth, email);
    alert("Đã gửi liên kết đặt lại mật khẩu.");
    document.getElementById('reset').classList.add('hidden');
  } catch (err) {
    alert("Lỗi: " + err.message);
  }
});

// Thêm giao dịch
document.getElementById('add-transaction-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    id: editId || Date.now(),
    type: document.getElementById('type').value,
    amount: parseFloat(document.getElementById('amount').value),
    description: document.getElementById('description').value,
    date: document.getElementById('date').value,
    category: document.getElementById('category').value
  };

  const userRef = doc(db, "users", currentUserData.uid);
  let updated = [...currentUserData.transactions];
  if (editId) {
    updated = updated.map(t => t.id === editId ? data : t);
    editId = null;
  } else {
    updated.push(data);
  }
  await updateDoc(userRef, { transactions: updated });
  const docSnap = await getDoc(userRef);
  currentUserData = { ...docSnap.data(), uid: currentUserData.uid };
  e.target.reset();
  render();
});

// Đặt ngân sách
document.getElementById('set-budget-btn').onclick = async () => {
  const b = prompt('Nhập ngân sách:', currentUserData.budget || 0);
  const userRef = doc(db, "users", currentUserData.uid);
  await updateDoc(userRef, { budget: parseFloat(b) || 0 });
  const docSnap = await getDoc(userRef);
  currentUserData = { ...docSnap.data(), uid: currentUserData.uid };
  render();
};

// Export dữ liệu
document.getElementById('export-data').onclick = () => {
  const dataStr = JSON.stringify(currentUserData);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sao_luu.json';
  a.click();
};

// Import dữ liệu
document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      const userRef = doc(db, "users", currentUserData.uid);
      await setDoc(userRef, data);
      const docSnap = await getDoc(userRef);
      currentUserData = { ...docSnap.data(), uid: currentUserData.uid };
      render();
    } catch (err) {
      alert('Tệp không hợp lệ');
    }
  };
  reader.readAsText(file);
});

// Hiển thị giao dịch
function render() {
  if (!currentUserData) return;
  document.getElementById('budget-display').textContent = currentUserData.budget;
  const tbody = document.getElementById('transaction-table');
  tbody.innerHTML = '';
  const search = document.getElementById('search').value.toLowerCase();
  const fDate = document.getElementById('filter-date').value;
  const fCat = document.getElementById('filter-category').value;
  let balance = 0, expenses = 0;

  currentUserData.transactions
    .filter(t => t.description.toLowerCase().includes(search))
    .filter(t => !fDate || t.date === fDate)
    .filter(t => !fCat || t.category === fCat)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach(t => {
      if (t.type === 'income') balance += t.amount;
      else { balance -= t.amount; expenses += t.amount; }
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${t.date}</td><td>${t.description}</td><td>${t.category}</td><td>${t.type === 'income' ? '+' : '-'}${t.amount}</td><td><button data-id="${t.id}" class="edit">Sửa</button><button data-id="${t.id}" class="del">Xóa</button></td>`;
      tbody.appendChild(tr);
    });

    // Cập nhật tổng số dư và chi tiêu
      document.getElementById('balance').textContent = balance.toFixed(2);
  if (currentUserData.budget && expenses > currentUserData.budget) {
    alert('⚠️ Bạn đã vượt quá ngân sách!');
  }

  // Xử lý nút Xóa
  tbody.querySelectorAll('.del').forEach(btn => btn.onclick = async (e) => {
    const id = Number(e.target.dataset.id);
    const updated = currentUserData.transactions.filter(t => t.id !== id);
    await updateDoc(doc(db, "users", currentUserData.uid), { transactions: updated });
    currentUserData.transactions = updated;
    render();
  });

  // Xử lý nút Sửa
  tbody.querySelectorAll('.edit').forEach(btn => btn.onclick = (e) => {
    const id = Number(e.target.dataset.id);
    const t = currentUserData.transactions.find(t => t.id === id);
    editId = id;
    document.getElementById('type').value = t.type;
    document.getElementById('amount').value = t.amount;
    document.getElementById('description').value = t.description;
    document.getElementById('date').value = t.date;
    document.getElementById('category').value = t.category;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  updateCharts(currentUserData.transactions);
}
let categoryChart, timeChart;

function updateCharts(transactions) {
  const ctxCategory = document.getElementById('category-chart').getContext('2d');
  const ctxTime = document.getElementById('time-chart').getContext('2d');

  const categories = {};
  const timeline = {};

  transactions.forEach(t => {
    if (t.type === 'expense') {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
      const month = t.date.slice(0, 7); // YYYY-MM
      timeline[month] = (timeline[month] || 0) + t.amount;
    }
  });

  // Hủy biểu đồ cũ nếu có
  if (categoryChart) categoryChart.destroy();
  if (timeChart) timeChart.destroy();

  categoryChart = new Chart(ctxCategory, {
    type: 'doughnut',
    data: {
      labels: Object.keys(categories),
      datasets: [{
        data: Object.values(categories),
        backgroundColor: ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#2ecc71', '#e67e22']
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Chi tiêu theo danh mục'
        }
      }
    }
  });

  timeChart = new Chart(ctxTime, {
    type: 'line',
    data: {
      labels: Object.keys(timeline),
      datasets: [{
        label: 'Chi tiêu theo tháng',
        data: Object.values(timeline),
        borderColor: '#667eea',
        backgroundColor: 'rgba(102,126,234,0.2)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Chi tiêu theo thời gian'
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}
