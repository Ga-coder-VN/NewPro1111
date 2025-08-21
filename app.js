let transactions = [];
let budget = 0;
let editId = null;

// Theme
document.getElementById('toggle-theme').onclick = () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
};
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark');
}

// Thêm giao dịch
document.getElementById('add-transaction-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = {
    id: editId || Date.now(),
    type: document.getElementById('type').value,
    amount: parseFloat(document.getElementById('amount').value),
    description: document.getElementById('description').value,
    date: document.getElementById('date').value,
    category: document.getElementById('category').value
  };

  if (editId) {
    transactions = transactions.map(t => t.id === editId ? data : t);
    editId = null;
  } else {
    transactions.push(data);
  }

  e.target.reset();
  render();
});

// Đặt ngân sách
document.getElementById('set-budget-btn').onclick = () => {
  const b = prompt('Nhập ngân sách:', budget || 0);
  budget = parseFloat(b) || 0;
  render();
};

// Export dữ liệu
document.getElementById('export-data').onclick = () => {
  const dataStr = JSON.stringify({ budget, transactions });
  const blob = new Blob([dataStr], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sao_luu.json';
  a.click();
};

// Import dữ liệu
document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      budget = data.budget || 0;
      transactions = data.transactions || [];
      render();
    } catch (err) {
      alert('Tệp không hợp lệ');
    }
  };
  reader.readAsText(file);
});

// Hiển thị giao dịch
function render() {
  document.getElementById('budget-display').textContent = budget;
  const tbody = document.getElementById('transaction-table');
  tbody.innerHTML = '';
  const search = document.getElementById('search').value.toLowerCase();
  const fDate = document.getElementById('filter-date').value;
  const fCat = document.getElementById('filter-category').value;
  let balance = 0, expenses = 0;

  transactions
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

  document.getElementById('balance').textContent = balance.toFixed(2);
  if (budget && expenses > budget) alert('⚠️ Bạn đã vượt quá ngân sách!');

  tbody.querySelectorAll('.del').forEach(btn => btn.onclick = (e) => {
    const id = Number(e.target.dataset.id);
    transactions = transactions.filter(t => t.id !== id);
    render();
  });

  tbody.querySelectorAll('.edit').forEach(btn => btn.onclick = (e) => {
    const id = Number(e.target.dataset.id);
    const t = transactions.find(t => t.id === id);
    editId = id;
    document.getElementById('type').value = t.type;
    document.getElementById('amount').value = t.amount;
    document.getElementById('description').value = t.description;
    document.getElementById('date').value = t.date;
    document.getElementById('category').value = t.category;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  updateCharts(transactions);
}

// Biểu đồ
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
        backgroundColor: [
          '#ff6384', '#36a2eb', '#cc65fe',
          '#ffce56', '#2ecc71', '#e67e22'
        ]
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Chi tiêu theo danh mục'
        },
        legend: {
          position: 'bottom'
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

// Khởi động ban đầu
render();
