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
let selectedArtifacts = []; // 이제 각 아이템은 고유한 instanceId를 가짐
let selectedSlates = []; // 이제 각 아이템은 고유한 instanceId를 가짐
let currentGridItems = new Array(maxSlots).fill(null); // 각 슬롯에는 instanceId를 가진 아이템 객체가 저장됨

let currentActiveTab = 'artifacts';
let allTags = new Set();
let nextInstanceId = 0; // 고유 instanceId 생성을 위한 카운터
let hoveredSlotIndex = -1;

let selectedPriorityItemInstanceId = null; // 우선순위 목록에서 현재 선택된 아이템의 instanceId

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

  // 슬롯 우클릭으로 아이템 제거 기능 추가
  slot.addEventListener('contextmenu', e => {
    e.preventDefault(); // 기본 컨텍스트 메뉴 방지

    const itemInSlot = currentGridItems[index];
    if (itemInSlot) { // 슬롯에 아이템이 있는 경우
      // currentGridItems에서 해당 아이템 제거
      currentGridItems[index] = null;
      document.querySelector(`.slot[data-index="${index}"]`).innerHTML = `<div class="name">빈 슬롯 ${index + 1}</div>`;

      // selectedArtifacts 또는 selectedSlates에서도 해당 instanceId를 가진 아이템 제거
      const list = itemInSlot.id.startsWith('aritifact_') ? selectedArtifacts : selectedSlates;
      const instanceIndexInList = list.findIndex(i => i.instanceId === itemInSlot.instanceId);
      if (instanceIndexInList !== -1) {
        list.splice(instanceIndexInList, 1);
        // 선택 목록 UI 업데이트
        if (itemInSlot.id.startsWith('aritifact_')) {
          renderSelectedItems(selectedArtifacts, selectedArtifactsEl, true);
          updatePriorityList(); // 아티팩트 제거 시 우선순위 목록도 업데이트
        } else {
          renderSelectedItems(selectedSlates, selectedSlatesEl, false);
        }
      }

      // 그리드 및 주변 슬롯 UI 업데이트
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
    const sourceSlotInstanceId = e.dataTransfer.getData('sourceSlotInstanceId'); // 드래그 시작 아이템의 instanceId
    const sourceSlotIndex = e.dataTransfer.getData('sourceSlotIndex'); // 드래그 시작 슬롯 인덱스

    let draggedItem;
    // instanceId로 draggedItem을 찾음 (선택 목록 또는 그리드에서 온 아이템)
    if (sourceSlotInstanceId) { // 그리드 내 아이템 이동
        const srcItem = currentGridItems.find(item => item && item.instanceId === sourceSlotInstanceId);
        if (srcItem) {
            draggedItem = srcItem;
        } else { // 예외 처리: 그리드 내에서 아이템을 못 찾은 경우 (발생해서는 안 됨)
            console.error("Draggged item not found in currentGridItems:", sourceSlotInstanceId);
            return;
        }
    } else { // 선택 목록에서 온 아이템 (새로운 인스턴스 생성)
        const originalItem = (isArtifact ? artifacts : slates).find(item => item.id === itemId);
        if (originalItem) {
            draggedItem = {
                ...originalItem,
                level: 0, // 초기 레벨 0
                rotation: 0, // 초기 회전 0
                instanceId: `instance_${nextInstanceId++}` // 고유 instanceId 부여
            };
            // 선택 목록에도 추가 (중복 선택 허용)
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

    // 자기 자신 슬롯에 드롭하는 경우
    if (sourceSlotIndex !== "" && parseInt(sourceSlotIndex) === targetIndex) {
        updateAllSlotsUI(); // 버프 재계산 및 UI 업데이트
        return;
    }

    const itemAtTarget = currentGridItems[targetIndex]; // 타겟 슬롯에 이미 있던 아이템

    // 원래 슬롯 비우기 (그리드 내 이동 시)
    if (sourceSlotIndex !== "") {
        const srcIndex = parseInt(sourceSlotIndex);
        currentGridItems[srcIndex] = null;
        document.querySelector(`.slot[data-index="${srcIndex}"]`).innerHTML = `<div class="name">빈 슬롯 ${srcIndex + 1}</div>`;
    } else { // 선택 목록에서 드래그된 새 아이템이 타겟 슬롯에 놓이는 경우
        // 기존 타겟 슬롯의 아이템을 제거 (selected list에는 남아있음)
        if (itemAtTarget) {
            currentGridItems[targetIndex] = null;
            document.querySelector(`.slot[data-index="${targetIndex}"]`).innerHTML = `<div class="name">빈 슬롯 ${targetIndex + 1}</div>`;
        }
    }

    // 드래그된 아이템을 타겟 위치에 배치
    currentGridItems[targetIndex] = draggedItem;
    renderItemInSlot(slot, draggedItem); // 타겟 슬롯 렌더링

    updateAllSlotsUI(); // 전체 그리드 UI 업데이트
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
        document.querySelector(`.slot[data-index="${slotIndexToRemove}"]`).innerHTML = `<div class="name">빈 슬롯 ${slotIndexToRemove + 1}</div>`;
    }

    applyFilterAndRenderList();
    updatePriorityList();

    updateAllSlotsUI();
}


// ==========================
// 우선순위 목록 (클릭 순서로)
// ==========================

// 우선순위 아이템을 특정 위치로 이동시키는 함수
function movePriorityItemToIndex(instanceId, targetIndex) {
    const currentInstance = selectedArtifacts.find(item => item.instanceId === instanceId);
    if (!currentInstance) return;

    const oldIndex = selectedArtifacts.indexOf(currentInstance);
    if (oldIndex === -1) return;

    // 배열에서 해당 아이템을 제거하고, 새로운 위치에 삽입
    selectedArtifacts.splice(oldIndex, 1);
    selectedArtifacts.splice(targetIndex, 0, currentInstance);

    updatePriorityList(); // UI 업데이트
}


function updatePriorityList() {
  priorityList.innerHTML = '';
  selectedArtifacts.forEach((itemInstance, index) => {
    const div = document.createElement('div');
    div.className = 'priority-item';
    div.dataset.id = itemInstance.id;
    div.dataset.instanceId = itemInstance.instanceId;

    // 이미지 아이콘 추가
    const img = document.createElement('img');
    img.src = `images/${itemInstance.icon}`;
    img.alt = itemInstance.name;
    img.style.width = '30px'; // 아이콘 크기
    img.style.height = '30px';
    img.style.marginBottom = '5px'; // 번호와의 간격
    div.appendChild(img);

    // 순서 번호 추가
    const orderNumberSpan = document.createElement('span');
    orderNumberSpan.className = 'order-number';
    orderNumberSpan.textContent = index + 1;
    div.appendChild(orderNumberSpan); // 아이콘 아래에 번호 표시

    // 클릭 이벤트 리스너 추가 (순서 변경)
    div.addEventListener('click', () => {
        // 우선순위 목록에서 클릭된 아이템을 선택
        selectedPriorityItemInstanceId = itemInstance.instanceId;
        updatePriorityList(); // 선택 효과를 반영하기 위해 UI 다시 렌더링
    });
    
    // 현재 선택된 아이템이라면 초록색 배경 추가
    if (selectedPriorityItemInstanceId === itemInstance.instanceId) {
        div.classList.add('selected');
    }

    priorityList.appendChild(div);
  });

  // 우선순위 목록에 아이템이 추가될 때마다 슬롯 클릭 이벤트 리스너를 추가 (순서 배치 기능)
  priorityList.removeEventListener('click', handlePriorityListClick); // 중복 방지
  priorityList.addEventListener('click', handlePriorityListClick);
}

// 우선순위 목록에서 아이템 클릭 시 순서 변경 처리
function handlePriorityListClick(e) {
    const clickedItemDiv = e.target.closest('.priority-item');
    if (!clickedItemDiv) return;

    const clickedInstanceId = clickedItemDiv.dataset.instanceId;

    if (selectedPriorityItemInstanceId === null) {
        // 첫 번째 클릭: 아이템 선택
        selectedPriorityItemInstanceId = clickedInstanceId;
    } else if (selectedPriorityItemInstanceId === clickedInstanceId) {
        // 같은 아이템을 두 번 클릭: 선택 해제
        selectedPriorityItemInstanceId = null;
    } else {
        // 다른 아이템 클릭: 순서 교환
        const targetInstanceId = selectedPriorityItemInstanceId; // 이전에 선택된 아이템
        const currentInstanceId = clickedInstanceId; // 새로 클릭된 아이템

        const targetIndex = selectedArtifacts.findIndex(item => item.instanceId === targetInstanceId);
        const currentIndex = selectedArtifacts.findIndex(item => item.instanceId === currentInstanceId);

        if (targetIndex !== -1 && currentIndex !== -1) {
            // 배열 내에서 아이템의 위치를 교환
            const temp = selectedArtifacts[targetIndex];
            selectedArtifacts[targetIndex] = selectedArtifacts[currentIndex];
            selectedArtifacts[currentIndex] = temp;
        }
        selectedPriorityItemInstanceId = null; // 교환 후 선택 해제
    }
    updatePriorityList(); // UI 업데이트
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
                slotElement.innerHTML = `
                    <div class="name">빈 슬롯 ${i + 1}</div>
                    ${additionalUpgrade > 0 ? `<div class="slot-buff-indicator">+${additionalUpgrade}</div>` : ''}
                `;
            }
        }
    }
    for(let i = currentSlotsCount; i < maxSlots; i++) {
        const slotElement = document.querySelector(`.slot[data-index="${i}"]`);
        if (slotElement) {
            slotElement.classList.add('disabled');
            slotElement.innerHTML = `<div class="name">빈 슬롯 ${i + 1}</div>`;
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


function autoArrange() {
  const currentSlotsCount = calculateSlots();
  const allSlotsElements = [...document.querySelectorAll('.slot')];

  allSlotsElements.forEach(slot => {
    slot.innerHTML = `<div class="name">빈 슬롯 ${parseInt(slot.dataset.index) + 1}</div>`;
    slot.classList.remove('disabled');
  });
  const tempGridForArrangement = new Array(maxSlots).fill(null);

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

autoArrangeBtn.addEventListener('click', autoArrange);

itemSearchInput.addEventListener('input', applyFilterAndRenderList);

// R키 회전을 위한 키보드 이벤트 리스너
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
