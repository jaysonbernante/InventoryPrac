const dbName = "BrewStockDB";
let db;

const request = indexedDB.open(dbName, 1);
request.onupgradeneeded = e => {
  db = e.target.result;
  db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
};
request.onsuccess = e => {
  db = e.target.result;
  loadItems();
};
request.onerror = e => console.error("IndexedDB error:", e);

const modal = document.getElementById("edit-modal");
const form = document.getElementById("edit-form");
let editingId = null;

document.getElementById("add-item-btn").onclick = () => openModal();
document.getElementById("cancel-btn").onclick = () => modal.close();
document.getElementById("delete-btn").onclick = deleteItem;

form.onsubmit = e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  data.stock = parseFloat(data.stock);
  data.lowAlert = parseFloat(data.lowAlert) || 0;

  const tx = db.transaction("items", "readwrite");
  const store = tx.objectStore("items");
  if (editingId) {
    data.id = editingId;
    store.put(data);
  } else {
    store.add(data);
  }
  tx.oncomplete = () => {
    modal.close();
    loadItems();
  };
};

function openModal(item = null) {
  editingId = item?.id || null;
  document.getElementById("modal-title").textContent = item ? "Edit Item" : "Add New Item";
  form.reset();
  if (item) {
    form.name.value = item.name;
    form.category.value = item.category;
    form.stock.value = item.stock;
    form.unit.value = item.unit;
    form.lowAlert.value = item.lowAlert;
    document.getElementById("delete-btn").style.display = "block";
  } else {
    document.getElementById("delete-btn").style.display = "none";
  }
  modal.showModal();
}

function deleteItem() {
  if (!editingId) return;
  if (!confirm("Delete this item permanently?")) return;
  const tx = db.transaction("items", "readwrite");
  tx.objectStore("items").delete(editingId);
  tx.oncomplete = () => {
    modal.close();
    loadItems();
  };
}

function loadItems() {
  const container = document.getElementById("inventory");
  container.innerHTML = "";
  const tx = db.transaction("items");
  const store = tx.objectStore("items");
  store.getAll().onsuccess = e => {
    const items = e.target.result.sort((a,b) => a.name.localeCompare(b.name));
    items.forEach(item => {
      const card = document.createElement("div");
      card.className = "card";
      const isLow = item.stock <= item.lowAlert;
      card.innerHTML = `
        <h3>${item.name}</h3>
        <div class="stock ${isLow ? 'low' : ''}">${item.stock.toFixed(2)}</div>
        <div class="unit">${item.unit} • ${item.category}</div>
        ${isLow ? '<div style="color:#c44; margin-top:0.5rem">⚠️ Low stock!</div>' : ''}
        <div class="use-buttons">
          <button class="use-btn" data-id="${item.id}" data-amt="1">Use 1</button>
          <button class="use-btn" data-id="${item.id}" data-amt="0.5">Use 0.5</button>
          <button class="use-btn" data-id="${item.id}" data-amt="0.1">Use 0.1</button>
          <button onclick="openModal(${JSON.stringify(item).split('"').join("&quot;")})">Edit</button>
        </div>
      `;
      container.appendChild(card);
    });

    // Attach use-button handlers
    document.querySelectorAll(".use-btn[data-amt]").forEach(btn => {
      btn.onclick = () => {
        const id = parseInt(btn.dataset.id);
        const amt = parseFloat(btn.dataset.amt);
        adjustStock(id, -amt);
      };
    });
  };
}

function adjustStock(id, amount) {
  const tx = db.transaction("items", "readwrite");
  const store = tx.objectStore("items");
  const req = store.get(id);
  req.onsuccess = () => {
    const item = req.result;
    item.stock = Math.max(0, item.stock + amount);
    store.put(item);
    tx.oncomplete = loadItems;
  };
}

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}