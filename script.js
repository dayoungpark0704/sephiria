/** script.js **/

const baseSlots = 30;
const maxSlots = 39;
const grid = document.getElementById('main-grid');
const extra = document.getElementById('extra-slots');
const checkboxes = document.querySelectorAll('.option');
const itemList = document.getElementById('item-list');
const tabArtifacts = document.getElementById('tab-artifacts');
const tabSlates = document.getElementById('tab-slates');
const selectedArtifactsEl = document.getElementById('selected-artifacts');
const selectedSlatesEl = document.getElementById('selected-slates');
const priorityList = document.getElementById('priority-list');

let artifacts = [], slates = [];
let selectedArtifacts = [], selectedSlates = [];

function createSlot(index) {
  const slot = document.createElement('div');
  slot.className = 'slot';
  slot.innerHTML = `<div class="name">빈 슬롯 ${index + 1}</div>`;
  return slot;
}

function renderSlots(count) {
  grid.innerHTML = '';
  extra.innerHTML = '';

  for (let i = 0; i < 36; i++) {
    const slot = createSlot(i);
    if (i >= count) slot.classList.add('disabled');
    grid.appendChild(slot);
  }
  for (let i = 36; i < maxSlots; i++) {
    const slot = createSlot(i);
    if (i >= count) slot.classList.add('disabled');
    extra.appendChild(slot);
  }
}

function calculateSlots() {
  let total = baseSlots;
  checkboxes.forEach(chk => {
    if (chk.checked) total += parseInt(chk.value);
  });
  return Math.max(0, Math.min(maxSlots, total));
}

function renderItemList(items, isArtifact = true) {
  itemList.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <img src="images/${item.icon}" alt="${item.name}" />
      <div>${item.name}</div>
    `;
    div.addEventListener('click', () => {
      if (isArtifact) {
        toggleItemSelection(item, selectedArtifacts, selectedArtifactsEl, true);
      } else {
        toggleItemSelection(item, selectedSlates, selectedSlatesEl, false);
      }
      updatePriorityList();
    });
    itemList.appendChild(div);
  });
}

function toggleItemSelection(item, selectedList, container, isArtifact) {
  const found = selectedList.find(i => i.id === item.id);
  if (found) {
    selectedList.splice(selectedList.indexOf(found), 1);
  } else {
    selectedList.push({ ...item, level: 0 });
  }
  renderSelectedItems(selectedList, container, isArtifact);
}

function renderSelectedItems(list, container, isArtifact) {
  container.innerHTML = '';
  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'item';

    const tags = item.tags?.map(tag => `#${tag}`).join(' ') || '';

    div.innerHTML = `
      <img src="images/${item.icon}" />
      <div style="flex: 1">
        <div><strong>${item.name}</strong></div>
        <div class="tags">${tags}</div>
      </div>
      <div class="controls">
        <button onclick="adjustLevel('${item.id}', ${isArtifact}, -1)">-</button>
        <span>${item.level || 0} / ${item.maxUpgrade}</span>
        <button onclick="adjustLevel('${item.id}', ${isArtifact}, 1)">+</button>
      </div>
    `;
    container.appendChild(div);
  });
}

function adjustLevel(id, isArtifact, delta) {
  const list = isArtifact ? selectedArtifacts : selectedSlates;
  const item = list.find(i => i.id === id);
  if (!item) return;
  item.level = Math.max(0, Math.min(item.maxUpgrade, (item.level || 0) + delta));
  renderSelectedItems(list, isArtifact ? selectedArtifactsEl : selectedSlatesEl, isArtifact);
}

function updatePriorityList() {
  priorityList.innerHTML = '';
  selectedArtifacts.forEach(item => {
    const li = document.createElement('li');
    li.textContent = `${item.name} (★${item.maxUpgrade})`;
    li.dataset.id = item.id;
    li.draggable = true;

    li.addEventListener('dragstart', () => li.classList.add('dragging'));
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      const newOrder = [...priorityList.querySelectorAll('li')].map(li => li.dataset.id);
      selectedArtifacts.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
    });
    li.addEventListener('dragover', e => {
      e.preventDefault();
      const dragging = document.querySelector('.dragging');
      if (dragging && dragging !== li) {
        priorityList.insertBefore(dragging, li.nextSibling);
      }
    });

    priorityList.appendChild(li);
  });
}

function autoArrange() {
  const slots = [...document.querySelectorAll('.slot')].filter(slot => !slot.classList.contains('disabled'));
  slots.forEach(slot => slot.innerHTML = `<div class="name">빈 슬롯</div>`);

  const allItems = [...selectedArtifacts, ...selectedSlates];
  allItems.slice(0, slots.length).forEach((item, idx) => {
    const slot = slots[idx];
    slot.innerHTML = `
      <img src="images/${item.icon}" />
      <div>${item.name}</div>
      <div>★${item.level}/${item.maxUpgrade}</div>
    `;
  });
}

tabArtifacts.addEventListener('click', () => {
  tabArtifacts.classList.add('active');
  tabSlates.classList.remove('active');
  renderItemList(artifacts, true);
});

tabSlates.addEventListener('click', () => {
  tabSlates.classList.add('active');
  tabArtifacts.classList.remove('active');
  renderItemList(slates, false);
});

checkboxes.forEach(chk => {
  chk.addEventListener('change', () => {
    renderSlots(calculateSlots());
  });
});

async function loadData() {
  const res1 = await fetch('artifacts.json');
  artifacts = await res1.json();
  const res2 = await fetch('slates.json');
  slates = await res2.json();

  artifacts.sort((a, b) => b.maxUpgrade - a.maxUpgrade);
  renderItemList(artifacts, true);
}

renderSlots(calculateSlots());
loadData();
