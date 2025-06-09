/** script.js **/

const baseSlots = 30;
const maxSlots = 39;
const grid = document.getElementById('main-grid');
const checkboxes = document.querySelectorAll('.option');
const itemList = document.getElementById('item-list');
const tabArtifacts = document.getElementById('tab-artifacts');
const tabSlates = document.getElementById('tab-slates');
const selectedArtifactsEl = document.getElementById('selected-artifacts');
const selectedSlatesEl = document.getElementById('selected-slates');
const priorityList = document.getElementById('priority-list');

const itemSearchInput = document.getElementById('item-search');
const tagFiltersContainer = document.getElementById('tag-filters');

let artifacts = [];
let slates = [];
let selectedArtifacts = [];
let selectedSlates = [];
let currentGridItems = new Array(maxSlots).fill(null);

let currentActiveTab = 'artifacts';
let allTags = new Set();
let nextInstanceId = 0;
let hoveredSlotIndex = -1;

let selectedPriorityItemInstanceId = null;

// ==========================
// 슬롯 관련 함수
// ==========================

function createSlot(index) {
  const slot = document.createElement('div');
  slot.className = 'slot';
  slot.dataset.index = index;

  slot.addEventListener('mouseenter', () => {
    hoveredSlotIndex = index;
  });
  slot.addEventListener('mouseleave', () => {
    hoveredSlotIndex = -1;
  });

  slot.addEventListener('contextmenu', e => {
    e.preventDefault();

    const itemInSlot = currentGridItems[index];
    if (itemInSlot) {
      currentGridItems[index] = null;

      const list = itemInSlot.id.startsWith('aritifact_') ? selectedArtifacts : selectedSlates;
      const instanceIndexInList = list.findIndex(i => i.instanceId === itemInSlot.instanceId);
      if (instanceIndexInList !== -1) {
        list.splice(instanceIndexInList, 1);
        if (itemInSlot.id.startsWith('aritifact_')) {
          renderSelectedItems(selectedArtifacts, selectedArtifactsEl, true);
          updatePriorityList();
        } else {
          renderSelectedItems(selectedSlates, selectedSlatesEl, false);
        }
      }

      updateAllSlotsUI();
    }
  });

  slot.addEventListener('dragover', e => {
    e.preventDefault();
    const draggingItem = document.querySelector('.item.dragging, .item-in-slot.dragging');
    if (draggingItem && !slot.classList.contains('disabled')) {
      slot.classList.add('drag-over');
    }
  });

  slot.addEventListener('dragleave', () => {
    slot.classList.remove('drag-over');
  });

  slot.addEventListener('drop', e => {
    e.preventDefault();
    slot.classList.remove('drag-over');

    if (slot.classList.contains('disabled')) return;

    const instanceId = e.dataTransfer.getData('instanceId');
    const sourceSlotIndexStr = e.dataTransfer.getData('sourceSlotIndex');
    const targetIndex = parseInt(slot.dataset.index);

    const draggedItem = currentGridItems.find(item => item && item.instanceId === instanceId) ||
                      selectedArtifacts.find(item => item.instanceId === instanceId) ||
                      selectedSlates.find(item => item.instanceId === instanceId);

    if (!draggedItem) {
        console.error("드래그된 아이템을 찾을 수 없습니다:", instanceId);
        return;
    }

    // 자기 자신에게 드롭하는 경우 무시
    if (sourceSlotIndexStr && parseInt(sourceSlotIndexStr) === targetIndex) {
        return;
    }

    const itemAtTarget = currentGridItems[targetIndex];
    const sourceIndexNum = sourceSlotIndexStr ? parseInt(sourceSlotIndexStr) : null;

    if (sourceIndexNum !== null) {
        // --- 경우 1: 그리드 내에서 아이템을 드래그한 경우 ---
        // 대상 슬롯에 있는 아이템을 소스 슬롯으로 이동 (비어있으면 null이 됨)
        currentGridItems[sourceIndexNum] = itemAtTarget;
        // 드래그한 아이템을 대상 슬롯으로 이동
        currentGridItems[targetIndex] = draggedItem;
    } else {
        // --- 경우 2: 목록에서 아이템을 드래그한 경우 ---
        if (itemAtTarget) {
            // 대상 슬롯이 비어있지 않으면 드롭 취소 (아이템 소실 방지)
            alert("이미 아이템이 있는 칸에는 목록의 아이템을 놓을 수 없습니다. 먼저 칸을 비우거나 다른 아이템과 위치를 교체해주세요.");
            return;
        } else {
            // 대상 슬롯이 비어있으면 아이템 배치
            // (버그 방지) 만약 이 아이템이 다른 슬롯에 있었다면 그 슬롯을 비움
            const existingSlotIndex = currentGridItems.findIndex(i => i && i.instanceId === instanceId);
            if (existingSlotIndex > -1) {
                currentGridItems[existingSlotIndex] = null;
            }
            currentGridItems[targetIndex] = draggedItem;
        }
    }

    // 그리드 전체 UI 업데이트
    updateAllSlotsUI();
  });

  return slot;
}

function renderItemInSlot(slotElement, item) {
    const slotIndex = parseInt(slotElement.dataset.index);
    const slotBuffs = calculateSlotBuffs(currentGridItems, maxSlots, calculateSlots);
    const additionalUpgrade = slotBuffs[slotIndex] || 0;

    const displayLevel = (item.level || 0) + additionalUpgrade;
    let levelColorClass = '';
    if (item.maxUpgrade > 0 && displayLevel >= item.maxUpgrade) {
        levelColorClass = 'level-maxed';
    }

    let isConditionMet = false;
    const itemCondition = item.condition && Array.isArray(item.condition) && item.condition.length > 0 ? item.condition[0] : '';
    
    if (itemCondition) {
        const tempGridForCheck = [...currentGridItems];
        isConditionMet = isSlotAvailable(slotIndex, itemCondition, tempGridForCheck, calculateSlots);
    } else {
        isConditionMet = true;
    }
    const conditionClass = isConditionMet ? 'condition-met' : 'condition-unmet';

    let rotateClass = '';
    if (item.rotation === 90) rotateClass = 'rotate-90';
    else if (item.rotation === 180) rotateClass = 'rotate-180';
    else if (item.rotation === 270) rotateClass = 'rotate-270';

    slotElement.innerHTML = `
        <div class="item-in-slot ${conditionClass}" data-item-id="${item.id}" data-instance-id="${item.instanceId}" data-is-artifact="${item.id.startsWith('aritifact_')}" draggable="true">
            <img src="images/${item.icon}" alt="${item.name}" class="${rotateClass}" />
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-level ${levelColorClass}">★${displayLevel}/${item.maxUpgrade}</div>
            </div>
            ${additionalUpgrade > 0 ? `<div class="slot-buff-indicator">+${additionalUpgrade}</div>` : ''}
        </div>
    `;

    const itemInSlotDiv = slotElement.querySelector('.item-in-slot');
    if (itemInSlotDiv) {
        itemInSlotDiv.addEventListener('dragstart', e => {
            e.dataTransfer.setData('itemId', item.id);
            e.dataTransfer.setData('instanceId', item.instanceId);
            e.dataTransfer.setData('isArtifact', item.id.startsWith('aritifact_'));
            e.dataTransfer.setData('sourceSlotIndex', slotIndex);
            e.currentTarget.classList.add('dragging');
        });

        itemInSlotDiv.addEventListener('dragend', e => {
            e.currentTarget.classList.remove('dragging');
        });
    }
}

function renderSlots(count) {
  grid.innerHTML = '';
  const previousGridItems = [...currentGridItems];
  currentGridItems = new Array(maxSlots).fill(null);

  for (let i = 0; i < maxSlots; i++) {
    const slot = createSlot(i);
    if (i >= count) {
        slot.classList.add('disabled');
    } else {
        if (previousGridItems[i]) {
            currentGridItems[i] = previousGridItems[i];
        }
    }
    grid.appendChild(slot);
  }
  updateAllSlotsUI();
}

function calculateSlots() {
  let total = baseSlots;
  checkboxes.forEach(chk => {
    if (chk.checked) total += parseInt(chk.value);
  });
  return Math.max(0, Math.min(maxSlots, total));
}

// ==========================
// 아이템 목록 및 선택 관련 함수
// ==========================

function renderItemList(itemsToRender, isArtifact = true) {
  itemList.innerHTML = '';
  const currentSelectedList = isArtifact ? selectedArtifacts : selectedSlates;

  itemsToRender.forEach(originalItem => {
    const div = document.createElement('div');
    div.className = 'item';
    
    if (currentSelectedList.some(selectedItemInstance => selectedItemInstance.id === originalItem.id)) {
      div.classList.add('selected');
    }

    div.innerHTML = `
      <img src="images/${originalItem.icon}" alt="${originalItem.name}" />
      <div>${originalItem.name}</div>
    `;
    div.addEventListener('click', (e) => {
        if (e.button === 0) {
            if (isArtifact) {
                addArtifactInstance(originalItem, selectedArtifacts, selectedArtifactsEl, true);
            } else {
                addSlateInstance(originalItem, selectedSlates, selectedSlatesEl, false);
            }
            applyFilterAndRenderList();
            updatePriorityList();
        }
    });
    div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const list = isArtifact ? selectedArtifacts : selectedSlates;
        const indexToRemove = list.slice().reverse().findIndex(itemInstance => itemInstance.id === originalItem.id);
        if (indexToRemove !== -1) {
            const actualIndex = list.length - 1 - indexToRemove;
            const removedItem = list.splice(actualIndex, 1)[0];

            const slotIndexToRemove = currentGridItems.findIndex(itemInGrid => itemInGrid && itemInGrid.instanceId === removedItem.instanceId);
            if (slotIndexToRemove !== -1) {
                currentGridItems[slotIndexToRemove] = null;
            }

            if (isArtifact) {
                renderSelectedItems(selectedArtifacts, selectedArtifactsEl, true);
                updatePriorityList();
            } else {
                renderSelectedItems(selectedSlates, selectedSlatesEl, false);
            }
            updateAllSlotsUI();
        }
        applyFilterAndRenderList();
    });
    itemList.appendChild(div);
  });
}

function addArtifactInstance(originalItem, selectedList, container, isArtifact) {
    const newItemInstance = {
        ...originalItem,
        level: 0,
        instanceId: `instance_${nextInstanceId++}`
    };
    selectedList.push(newItemInstance);
    renderSelectedItems(selectedList, container, isArtifact);
}

function addSlateInstance(originalItem, selectedList, container, isArtifact) {
    const newItemInstance = {
        ...originalItem,
        level: 0,
        rotation: 0,
        instanceId: `instance_${nextInstanceId++}`
    };
    selectedList.push(newItemInstance);
    renderSelectedItems(selectedList, container, isArtifact);
}


function renderSelectedItems(list, container, isArtifact) {
  container.innerHTML = '';
  list.forEach(itemInstance => {
    const div = document.createElement('div');
    div.className = 'item';
    div.draggable = true;
    div.dataset.itemId = itemInstance.id;
    div.dataset.instanceId = itemInstance.instanceId;
    div.dataset.isArtifact = isArtifact;
    div.dataset.sourceSlotIndex = ""; // 목록에서 드래그할 땐 sourceSlotIndex가 비어있음

    div.addEventListener('dragstart', e => {
      e.dataTransfer.setData('itemId', itemInstance.id);
      e.dataTransfer.setData('instanceId', itemInstance.instanceId);
      e.dataTransfer.setData('isArtifact', isArtifact);
      e.dataTransfer.setData('sourceSlotIndex', ""); // 목록에서 시작했음을 명시
      e.currentTarget.classList.add('dragging');
    });

    div.addEventListener('dragend', e => {
      e.currentTarget.classList.remove('dragging');
    });

    const tags = (isArtifact && itemInstance.tags) ? (Array.isArray(itemInstance.tags) ? itemInstance.tags.map(tag => `#${tag}`).join(' ') : `#${itemInstance.tags}`) : '';

    div.innerHTML = `
      <img src="images/${itemInstance.icon}" />
      <div style="flex: 1">
        <div><strong>${itemInstance.name}</strong></div>
        <div class="tags">${tags}</div>
      </div>
      <div class="controls">
        <button onclick="adjustLevel('${itemInstance.instanceId}', ${isArtifact}, -1)">-</button>
        <span>${itemInstance.level || 0} / ${itemInstance.maxUpgrade}</span>
        <button onclick="adjustLevel('${itemInstance.instanceId}', ${isArtifact}, 1)">+</button>
      </div>
      <button class="remove-btn" onclick="removeItemFromSelection('${itemInstance.instanceId}', ${isArtifact})">x</button>
    `;
    container.appendChild(div);
  });
}

function adjustLevel(instanceId, isArtifact, delta) {
  const list = isArtifact ? selectedArtifacts : selectedSlates;
  const itemInstance = list.find(i => i.instanceId === instanceId);
  if (!itemInstance) return;
  itemInstance.level = Math.max(0, Math.min(itemInstance.maxUpgrade, (itemInstance.level || 0) + delta));
  renderSelectedItems(list, isArtifact ? selectedArtifactsEl : selectedSlatesEl, isArtifact);

  const itemInGrid = currentGridItems.find(gridItem => gridItem && gridItem.instanceId === instanceId);
  if (itemInGrid) {
      itemInGrid.level = itemInstance.level;
  }
  updateAllSlotsUI();
}

function removeItemFromSelection(instanceId, isArtifact) {
    const list = isArtifact ? selectedArtifacts : selectedSlates;
    const updatedList = list.filter(itemInstance => itemInstance.instanceId !== instanceId);
    if (isArtifact) {
        selectedArtifacts = updatedList;
        renderSelectedItems(selectedArtifacts, selectedArtifactsEl, true);
    } else {
        selectedSlates = updatedList;
        renderSelectedItems(selectedSlates, selectedSlatesEl, false);
    }

    const slotIndexToRemove = currentGridItems.findIndex(itemInstance => itemInstance && itemInstance.instanceId === instanceId);
    if (slotIndexToRemove !== -1) {
        currentGridItems[slotIndexToRemove] = null;
    }

    applyFilterAndRenderList();
    updatePriorityList();
    updateAllSlotsUI();
}


// ==========================
// 우선순위 목록 (클릭 순서로)
// ==========================

function movePriorityItemToIndex(instanceId, targetIndex) {
    const currentInstance = selectedArtifacts.find(item => item.instanceId === instanceId);
    if (!currentInstance) return;

    const oldIndex = selectedArtifacts.indexOf(currentInstance);
    if (oldIndex === -1) return;

    selectedArtifacts.splice(oldIndex, 1);
    selectedArtifacts.splice(targetIndex, 0, currentInstance);

    selectedPriorityItemInstanceId = null;
    updatePriorityList();
}


function updatePriorityList() {
  priorityList.innerHTML = '';
  selectedArtifacts.forEach((itemInstance, index) => {
    const div = document.createElement('div');
    div.className = 'priority-item';
    div.dataset.id = itemInstance.id;
    div.dataset.instanceId = itemInstance.instanceId;

    const img = document.createElement('img');
    img.src = `images/${itemInstance.icon}`;
    img.alt = itemInstance.name;
    img.style.width = '30px';
    img.style.height = '30px';
    div.appendChild(img);

    const orderNumberSpan = document.createElement('span');
    orderNumberSpan.className = 'order-number';
    orderNumberSpan.textContent = index + 1;
    div.appendChild(orderNumberSpan);

    div.addEventListener('click', (e) => {
        const clickedItemInstanceId = e.currentTarget.dataset.instanceId;

        if (selectedPriorityItemInstanceId === null) {
            selectedPriorityItemInstanceId = clickedItemInstanceId;
        } else if (selectedPriorityItemInstanceId === clickedItemInstanceId) {
            selectedPriorityItemInstanceId = null;
        } else {
            const targetInstanceId = selectedPriorityItemInstanceId;
            const currentIndex = selectedArtifacts.findIndex(item => item.instanceId === clickedItemInstanceId);
            
            movePriorityItemToIndex(targetInstanceId, currentIndex);
            selectedPriorityItemInstanceId = null;
        }
        updatePriorityList();
    });
    
    if (selectedPriorityItemInstanceId === itemInstance.instanceId) {
        div.classList.add('selected');
    }

    priorityList.appendChild(div);
  });
}


// ==========================
// 아이템 필터링/검색 기능
// ==========================

let activeTags = new Set();

function generateTagFilters() {
    tagFiltersContainer.innerHTML = '';
    const tagsArray = Array.from(allTags).sort();

    tagsArray.forEach(tag => {
        const button = document.createElement('button');
        button.className = 'tag-button';
        button.textContent = `#${tag}`;
        if (activeTags.has(tag)) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            if (activeTags.has(tag)) {
                activeTags.delete(tag);
            } else {
                activeTags.add(tag);
            }
            button.classList.toggle('active');
            applyFilterAndRenderList();
        });
        tagFiltersContainer.appendChild(button);
    });
}

function applyFilterAndRenderList() {
    const searchTerm = itemSearchInput.value.toLowerCase().trim();
    let filteredItems = [];

    if (currentActiveTab === 'artifacts') {
        filteredItems = artifacts.filter(item => {
            const nameMatch = item.name.toLowerCase().includes(searchTerm);
            const tagMatch = activeTags.size === 0 || item.tags.some(tag => activeTags.has(tag));
            return nameMatch && tagMatch;
        });
        renderItemList(filteredItems, true);
    } else {
        filteredItems = slates.filter(item => {
            const nameMatch = item.name.toLowerCase().includes(searchTerm);
            const tagMatch = true;
            return nameMatch && tagMatch;
        });
        renderItemList(filteredItems, false);
    }
}


// ==========================
// 배치 알고리즘 및 UI 업데이트
// ==========================

function autoArrange() {
  const currentSlotsCount = calculateSlots();
  // 최종 결과를 저장할 전역 변수 초기화 (algorithms.js에서 사용)
  bestGrid = new Array(maxSlots).fill(null);
  maxScore = -1;

  let allItemsToPlace = [...selectedArtifacts, ...selectedSlates];

  // 새로운 정렬 로직: 조건 > 석판 > 아티팩트 순서
  allItemsToPlace.sort((a, b) => {
    // 1. 배치 조건 우선순위 (가장 중요)
    const conditionA = a.condition && Array.isArray(a.condition) && a.condition.length > 0 ? a.condition[0] : '';
    const conditionB = b.condition && Array.isArray(b.condition) && b.condition.length > 0 ? b.condition[0] : '';
    const conditionPriority = { "양쪽칸이 공백": 5, "안쪽": 4, "최상단": 3, "최하단": 3, "가장자리": 2, "": 1 };
    const priorityA = conditionPriority[conditionA] || 0;
    const priorityB = conditionPriority[conditionB] || 0;
    if (priorityA !== priorityB) return priorityB - priorityA;

    // 2. 석판을 아티팩트보다 우선 배치
    const isASlate = a.id.startsWith('slate_');
    const isBSlate = b.id.startsWith('slate_');
    if (isASlate && !isBSlate) return -1;
    if (!isASlate && isBSlate) return 1;

    return 0;
  });

  // 백트래킹 알고리즘 실행 (최적화 버전)
  findBestSolution(0, new Array(maxSlots).fill(null), allItemsToPlace, currentSlotsCount, isSlotAvailable, calculateSlots, calculateScore);

  if (maxScore > -1) {
      console.log("최적 배치 탐색 성공! 최고 점수:", maxScore);
      currentGridItems = [...bestGrid]; // 찾은 최적의 결과를 현재 그리드에 반영
  } else {
      console.log("모든 아이템을 배치할 수 있는 경우를 찾지 못했습니다.");
      alert("모든 아이템을 그리드에 배치할 수 없습니다. 슬롯 수를 늘리거나 아이템을 줄여보세요.");
      currentGridItems = new Array(maxSlots).fill(null); // 배치 실패 시 그리드 초기화
  }

  updateAllSlotsUI(); // 최종 UI 업데이트
}

/**
 * 그리드의 모든 슬롯 UI를 현재 상태(currentGridItems)에 맞게 다시 렌더링합니다.
 * 스왑, 제거 등 그리드 상태에 변경이 있을 때 호출됩니다.
 */
function updateAllSlotsUI() {
    const slotElements = document.querySelectorAll('.slot');
    const currentSlotsCount = calculateSlots();

    slotElements.forEach((slot, index) => {
        slot.innerHTML = ''; // 슬롯 비우기
        slot.classList.remove('disabled');

        if (index >= currentSlotsCount) {
            slot.classList.add('disabled');
        }

        const item = currentGridItems[index];
        if (item) {
            // 해당 슬롯에 아이템이 있으면 렌더링
            renderItemInSlot(slot, item);
        }
    });
}


function handleRotation(itemInstance, slotIndex) {
    if (!itemInstance.rotatable) return;

    itemInstance.rotation = (itemInstance.rotation || 0) + 90;
    if (itemInstance.rotation >= 360) {
        itemInstance.rotation = 0;
    }

    // 그리드와 선택 목록 양쪽의 회전 상태를 동기화
    const itemInGrid = currentGridItems.find(gridItem => gridItem && gridItem.instanceId === itemInstance.instanceId);
    if (itemInGrid) itemInGrid.rotation = itemInstance.rotation;
    
    const itemInSelectedList = selectedSlates.find(sItem => sItem.instanceId === itemInstance.instanceId);
    if (itemInSelectedList) itemInSelectedList.rotation = itemInstance.rotation;

    updateAllSlotsUI();
}


// ==========================
// 이벤트 리스너 및 초기화
// ==========================

tabArtifacts.addEventListener('click', () => {
  tabArtifacts.classList.add('active');
  tabSlates.classList.remove('active');
  currentActiveTab = 'artifacts';
  itemSearchInput.value = '';
  activeTags.clear();
  generateTagFilters();
  applyFilterAndRenderList();
});

tabSlates.addEventListener('click', () => {
  tabSlates.classList.add('active');
  tabArtifacts.classList.remove('active');
  currentActiveTab = 'slates';
  itemSearchInput.value = '';
  activeTags.clear();
  generateTagFilters();
  applyFilterAndRenderList();
});

checkboxes.forEach(chk => {
  chk.addEventListener('change', () => {
    const newCount = calculateSlots();
    // 슬롯 수가 줄어들 때 아이템이 잘리는 것을 방지하기 위해 렌더링 전에 아이템을 옮김
    if(newCount < currentGridItems.length) {
        for(let i = newCount; i < currentGridItems.length; i++) {
            currentGridItems[i] = null; // 비활성화 될 슬롯의 아이템 제거
        }
    }
    renderSlots(newCount);
  });
});

document.addEventListener('DOMContentLoaded', () => {
    const autoArrangeBtn = document.getElementById('auto-arrange-btn');
    if (autoArrangeBtn) {
        autoArrangeBtn.addEventListener('click', autoArrange);
    } else {
        console.error("Error: autoArrangeBtn element not found in HTML. Check its ID.");
    }
});


itemSearchInput.addEventListener('input', applyFilterAndRenderList);

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        if (hoveredSlotIndex !== -1) {
            const itemInSlot = currentGridItems[hoveredSlotIndex];
            if (itemInSlot && itemInSlot.id.startsWith('slate_') && itemInSlot.rotatable) {
                e.preventDefault();
                handleRotation(itemInSlot, hoveredSlotIndex);
            }
        }
    }
});


async function loadData() {
  const res1 = await fetch('artifacts.json');
  artifacts = await res1.json();
  const res2 = await fetch('slates.json');
  slates = await res2.json();

  artifacts.forEach(item => {
    if (typeof item.tags === 'string' && item.tags.includes(',')) {
      item.tags = item.tags.split(',').map(tag => tag.trim());
    } else if (typeof item.tags === 'string' && item.tags !== '') {
      item.tags = [item.tags];
    } else {
      item.tags = [];
    }

    item.upgrade = item.upgrade ?? 0;
    item.maxUpgrade = item.maxUpgrade ?? 0;
    
    if (typeof item.condition === 'string' && item.condition !== '') {
        item.condition = [item.condition];
    } else if (!Array.isArray(item.condition)) {
        item.condition = [];
    }
    item.tags.forEach(tag => allTags.add(tag));
  });

  slates.forEach(item => {
    item.tags = [];
    item.upgrade = 0;
    item.maxUpgrade = 0;
    if (typeof item.condition === 'string' && item.condition !== '') {
        item.condition = [item.condition];
    } else if (!Array.isArray(item.condition)) {
        item.condition = [];
    }
    item.rotatable = item.rotatable ?? false;
  });

  renderSlots(calculateSlots());
  generateTagFilters();
  applyFilterAndRenderList();
}

loadData();