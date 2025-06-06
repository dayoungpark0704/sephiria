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
      document.querySelector(`.slot[data-index="${index}"]`).innerHTML = ``; 

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

    const itemId = e.dataTransfer.getData('itemId');
    const isArtifactStr = e.dataTransfer.getData('isArtifact');
    const isArtifact = isArtifactStr === 'true';
    const sourceSlotInstanceId = e.dataTransfer.getData('sourceSlotInstanceId');
    const sourceSlotIndex = e.dataTransfer.getData('sourceSlotIndex');

    let draggedItem;
    if (sourceSlotInstanceId) {
        const srcItem = currentGridItems.find(item => item && item.instanceId === sourceSlotInstanceId);
        if (srcItem) {
            draggedItem = srcItem;
        } else {
            console.error("Draggged item not found in currentGridItems:", sourceSlotInstanceId);
            return;
        }
    } else {
        const originalItem = (isArtifact ? artifacts : slates).find(item => item.id === itemId);
        if (originalItem) {
            draggedItem = {
                ...originalItem,
                level: 0,
                rotation: 0,
                instanceId: `instance_${nextInstanceId++}`
            };
            if (isArtifact) {
                selectedArtifacts.push(draggedItem);
                renderSelectedItems(selectedArtifacts, selectedArtifactsEl, true);
                updatePriorityList();
            } else {
                selectedSlates.push(draggedItem);
                renderSelectedItems(selectedSlates, selectedSlatesEl, false);
            }
        } else {
            console.error("Original item not found:", itemId);
            return;
        }
    }

    const targetIndex = parseInt(slot.dataset.index);

    if (sourceSlotIndex !== "" && parseInt(sourceSlotIndex) === targetIndex) {
        updateAllSlotsUI();
        return;
    }

    const itemAtTarget = currentGridItems[targetIndex];

    if (sourceSlotIndex !== "") {
        const srcIndex = parseInt(sourceSlotIndex);
        currentGridItems[srcIndex] = null;
        document.querySelector(`.slot[data-index="${srcIndex}"]`).innerHTML = ``;
    } else {
        if (itemAtTarget) {
            currentGridItems[targetIndex] = null;
            document.querySelector(`.slot[data-index="${targetIndex}"]`).innerHTML = ``;
        }
    }

    currentGridItems[targetIndex] = draggedItem;
    renderItemInSlot(slot, draggedItem);

    updateAllSlotsUI();
  });

  return slot;
}

function renderItemInSlot(slotElement, item) {
    const slotIndex = parseInt(slotElement.dataset.index);
    const slotBuffs = calculateSlotBuffs();
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
        tempGridForCheck[slotIndex] = item;
        isConditionMet = isSlotAvailable(slotIndex, itemCondition, tempGridForCheck);
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
            renderItemInSlot(slot, previousGridItems[i]);
        }
    }
    grid.appendChild(slot);
  }
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
    div.addEventListener('click', () => {
      if (isArtifact) {
        addArtifactInstance(originalItem, selectedArtifacts, selectedArtifactsEl, true);
      } else {
        addSlateInstance(originalItem, selectedSlates, selectedSlatesEl, false);
      }
      applyFilterAndRenderList();
      updatePriorityList();
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
    div.dataset.sourceSlotIndex = "";

    div.addEventListener('dragstart', e => {
      e.dataTransfer.setData('itemId', itemInstance.id);
      e.dataTransfer.setData('instanceId', itemInstance.instanceId);
      e.dataTransfer.setData('isArtifact', isArtifact);
      e.dataTransfer.setData('sourceSlotIndex', "");
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
        document.querySelector(`.slot[data-index="${slotIndexToRemove}"]`).innerHTML = ``;
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
// 배치 알고리즘 (Condition 고려)
// ==========================

function isSlotAvailable(slotIndex, condition, currentGrid) {
    const row = Math.floor(slotIndex / 6);
    const col = slotIndex % 6;
    const totalRows = Math.ceil(calculateSlots() / 6);
    const totalCols = 6;

    switch (condition) {
        case "최상단": return row === 0;
        case "최하단": return row === totalRows - 1;
        case "가장자리": return row === 0 || row === totalRows - 1 || col === 0 || col === totalCols - 1;
        case "안쪽": return row > 0 && row < totalRows - 1 && col > 0 && col < totalCols - 1;
        case "양쪽칸이 공백":
            const leftSlotIndex = slotIndex - 1;
            const rightSlotIndex = slotIndex + 1;
            const isLeftInBounds = (col > 0);
            const isRightInBounds = (col < totalCols - 1);
            const isLeftEmpty = !isLeftInBounds || currentGrid[leftSlotIndex] === null;
            const isRightEmpty = !isRightInBounds || currentGrid[rightSlotIndex] === null;
            return isLeftEmpty && isRightEmpty;
        default: return true;
    }
}

function calculateSlotBuffs() {
    const slotBuffs = new Array(maxSlots).fill(0);

    currentGridItems.forEach((itemInstance, slotIndex) => {
        if (itemInstance && itemInstance.id.startsWith('slate_') && itemInstance.buffcoords && itemInstance.buffcoords.length > 0) {
            const baseRow = Math.floor(slotIndex / 6);
            const baseCol = slotIndex % 6;
            const rotation = itemInstance.rotation || 0;

            itemInstance.buffcoords.forEach(buff => {
                let transformedX = buff.x || 0;
                let transformedY = buff.y || 0;

                if (rotation === 90) { [transformedX, transformedY] = [-transformedY, transformedX]; }
                else if (rotation === 180) { [transformedX, transformedY] = [-transformedX, -transformedY]; }
                else if (rotation === 270) { [transformedX, transformedY] = [transformedY, -transformedX]; }

                const targetRow = baseRow + transformedY;
                const targetCol = baseCol + transformedX;
                const targetIndex = targetRow * 6 + targetCol;

                const currentActiveSlotsCount = calculateSlots();
                if (targetIndex >= 0 && targetIndex < currentActiveSlotsCount &&
                    targetRow >= 0 && targetRow < Math.ceil(currentActiveSlotsCount / 6) &&
                    targetCol >= 0 && targetCol < 6) {

                    let buffValue = 0;
                    if (buff.v !== undefined) {
                        if (buff.v === "limitUnlock") { buffValue = 1; }
                        else if (!isNaN(parseInt(buff.v))) { buffValue = parseInt(buff.v); }
                    }
                    else if (buff.value !== undefined && !isNaN(parseInt(buff.value))) {
                        buffValue = parseInt(buff.value);
                    }
                    slotBuffs[targetIndex] += buffValue;
                }
            });
        }
    });
    return slotBuffs;
}

function updateAllSlotsUI() {
    const currentSlotsCount = calculateSlots();
    const slotBuffs = calculateSlotBuffs();

    for(let i = 0; i < currentSlotsCount; i++) {
        const slotElement = document.querySelector(`.slot[data-index="${i}"]`);
        if (slotElement) {
            if(currentGridItems[i]) {
                renderItemInSlot(slotElement, currentGridItems[i]);
            } else {
                const additionalUpgrade = slotBuffs[i] || 0;
                slotElement.innerHTML = `${additionalUpgrade > 0 ? `<div class="slot-buff-indicator">+${additionalUpgrade}</div>` : ''}`;
            }
        }
    }
    for(let i = currentSlotsCount; i < maxSlots; i++) {
        const slotElement = document.querySelector(`.slot[data-index="${i}"]`);
        if (slotElement) {
            slotElement.classList.add('disabled');
            slotElement.innerHTML = ``;
        }
    }
}

// 백트래킹 함수 (똑똑한 배치 알고리즘)
function findSolution(itemIndex, currentGridState, allItemsToPlace, totalActiveSlots) {
    if (itemIndex === allItemsToPlace.length) {
        return true;
    }

    const currentItemInstance = allItemsToPlace[itemIndex];
    const itemCondition = currentItemInstance.condition && Array.isArray(currentItemInstance.condition) && currentItemInstance.condition.length > 0 ? currentItemInstance.condition[0] : '';

    for (let slotCandidateIndex = 0; slotCandidateIndex < totalActiveSlots; slotCandidateIndex++) {
        if (currentGridState[slotCandidateIndex] === null &&
            isSlotAvailable(slotCandidateIndex, itemCondition, currentGridState)) {

            currentGridState[slotCandidateIndex] = currentItemInstance;

            if (currentItemInstance.id.startsWith('slate_') && currentItemInstance.rotatable) {
                const originalRotation = currentItemInstance.rotation;
                for (let rot = 0; rot < 360; rot += 90) {
                    currentItemInstance.rotation = rot;
                    if (findSolution(itemIndex + 1, currentGridState, allItemsToPlace, totalActiveSlots)) {
                        return true;
                    }
                }
                currentItemInstance.rotation = originalRotation;
            } else {
                if (findSolution(itemIndex + 1, currentGridState, allItemsToPlace, totalActiveSlots)) {
                    return true;
                }
            }
            currentGridState[slotCandidateIndex] = null;
        }
    }
    return false;
}

// getNumberOfAvailableSlots 함수 (autoArrange 함수 외부에 위치)
function getNumberOfAvailableSlots(item, currentGrid, totalActiveSlots) {
    let count = 0;
    const itemCondition = item.condition && Array.isArray(item.condition) && item.condition.length > 0 ? item.condition[0] : '';

    for (let i = 0; i < totalActiveSlots; i++) {
        if (currentGrid[i] === null && isSlotAvailable(i, itemCondition, currentGrid)) {
            count++;
        }
    }
    return count;
}

function autoArrange() {
  const currentSlotsCount = calculateSlots();
  const allSlotsElements = [...document.querySelectorAll('.slot')];

  allSlotsElements.forEach(slot => {
    slot.innerHTML = ``;
    slot.classList.remove('disabled');
  });
  const tempGridForArrangement = new Array(maxSlots).fill(null); // tempGridForArrangement 선언을 이리로 옮김

  for (let i = 0; i < maxSlots; i++) {
      if (i >= currentSlotsCount) {
          allSlotsElements[i].classList.add('disabled');
      }
  }

  let allItemsToPlace = [...selectedArtifacts, ...selectedSlates];

  allItemsToPlace.sort((a, b) => {
    const conditionA = a.condition && Array.isArray(a.condition) && a.condition.length > 0 ? a.condition[0] : '';
    const conditionB = b.condition && Array.isArray(b.condition) && b.condition.length > 0 ? b.condition[0] : '';

    const conditionPriority = {
        "양쪽칸이 공백": 5,
        "안쪽": 4,
        "최상단": 3,
        "최하단": 3,
        "가장자리": 2,
        "": 1
    };

    const priorityA = conditionPriority[conditionA] || 0;
    const priorityB = conditionPriority[conditionB] || 0;

    if (priorityA !== priorityB) {
        return priorityB - priorityA;
    }

    if (a.id.startsWith('aritifact_') && !b.id.startsWith('aritifact_')) {
        return -1;
    }
    if (!a.id.startsWith('aritifact_') && b.id.startsWith('aritifact_')) {
        return 1;
    }

    if (a.id.startsWith('aritifact_') && b.id.startsWith('aritifact_')) {
        const orderA = selectedArtifacts.findIndex(itemInstance => itemInstance.instanceId === a.instanceId);
        const orderB = selectedArtifacts.findIndex(itemInstance => itemInstance.instanceId === b.instanceId);
        return orderA - orderB;
    }

    const availableSlotsForA = getNumberOfAvailableSlots(a, tempGridForArrangement, currentSlotsCount);
    const availableSlotsForB = getNumberOfAvailableSlots(b, tempGridForArrangement, currentSlotsCount);
    
    if (availableSlotsForA !== availableSlotsForB) {
        return availableSlotsForA - availableSlotsForB;
    }
    
    return 0;
  });

  if (findSolution(0, tempGridForArrangement, allItemsToPlace, currentSlotsCount)) {
      console.log("모든 아이템 배치 성공!");
      currentGridItems = [...tempGridForArrangement];

      selectedArtifacts.forEach(itemInstance => {
          const itemInGrid = currentGridItems.find(gridItem => gridItem && gridItem.instanceId === itemInstance.instanceId);
          if (itemInGrid) {
              itemInGrid.level = itemInGrid.maxUpgrade;
              itemInstance.level = itemInstance.maxUpgrade;
          }
      });
  } else {
      console.log("모든 아이템을 배치할 수 없습니다.");
      alert("모든 아이템을 그리드에 배치할 수 없습니다. 슬롯 수를 늘리거나 조건을 재조정해보세요.");
  }

  updateAllSlotsUI();
}

/**
 * 석판을 90도 회전시키고, 해당 슬롯 및 주변 슬롯의 UI를 업데이트합니다.
 * @param {object} itemInstance - 회전할 석판 아이템 인스턴스 객체 (instanceId 포함).
 * @param {number} slotIndex - 석판이 위치한 슬롯의 인덱스.
 */
function handleRotation(itemInstance, slotIndex) {
    if (!itemInstance.rotatable) return;

    itemInstance.rotation = (itemInstance.rotation || 0) + 90;
    if (itemInstance.rotation >= 360) {
        itemInstance.rotation = 0;
    }

    const itemInGrid = currentGridItems.find(gridItem => gridItem && gridItem.instanceId === itemInstance.instanceId);
    if (itemInGrid) {
        itemInGrid.rotation = itemInstance.rotation;
    }
    const itemInSelectedList = selectedSlates.find(sItem => sItem.instanceId === itemInstance.instanceId);
    if (itemInSelectedList) {
        itemInSelectedList.rotation = itemInstance.rotation;
    }

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
    renderSlots(calculateSlots());
    updateAllSlotsUI();
  });
});

document.addEventListener('DOMContentLoaded', () => {
    // autoArrangeBtn은 전역 상수이므로, DOMContentLoaded 이후에 접근 가능합니다.
    // HTML에 id="auto-arrange-btn"이 있다면 정상적으로 할당됩니다.
    if (autoArrangeBtn) { // autoArrangeBtn이 null이 아닌지 다시 한번 확인
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

    if (item.upgrade === undefined) {
        item.upgrade = 0;
    }
    if (item.maxUpgrade === undefined) {
        item.maxUpgrade = 0;
    }
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
    if (item.rotatable === undefined) {
        item.rotatable = false;
    }
  });


  renderSlots(calculateSlots());
  generateTagFilters();
  applyFilterAndRenderList();
}

loadData();
