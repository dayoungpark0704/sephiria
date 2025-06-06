/** script.js **/

const baseSlots = 30;
const maxSlots = 39; // 6x6 그리드 + 3개 추가 슬롯
const grid = document.getElementById('main-grid');
const checkboxes = document.querySelectorAll('.option'); // 슬롯 설정 체크박스
const itemList = document.getElementById('item-list');
const tabArtifacts = document.getElementById('tab-artifacts');
const tabSlates = document.getElementById('tab-slates');
const selectedArtifactsEl = document.getElementById('selected-artifacts');
const selectedSlatesEl = document.getElementById('selected-slates');
const priorityList = document.getElementById('priority-list'); // div로 변경됨
const autoArrangeBtn = document.getElementById('auto-arrange-btn'); // 자동 배치 버튼

// 검색 및 필터링 관련 DOM 요소
const itemSearchInput = document.getElementById('item-search');
const tagFiltersContainer = document.getElementById('tag-filters');

let artifacts = [];
let slates = [];
let selectedArtifacts = []; // 클릭 순서대로 정렬될 아티팩트 목록
let selectedSlates = [];
let currentGridItems = new Array(maxSlots).fill(null); // 그리드 슬롯의 현재 상태를 저장하는 배열

let currentActiveTab = 'artifacts'; // 현재 활성화된 탭 ('artifacts' 또는 'slates')
let allTags = new Set(); // 모든 아티팩트의 태그를 저장할 Set (slates에는 tags가 없으므로 아티팩트만)

let hoveredSlotIndex = -1; // 현재 마우스가 올라가 있는 슬롯의 인덱스

// ==========================
// 슬롯 관련 함수
// ==========================

function createSlot(index) {
  const slot = document.createElement('div');
  slot.className = 'slot';
  slot.dataset.index = index; // 슬롯 인덱스 추가

  // 마우스 오버/리브 이벤트 추가
  slot.addEventListener('mouseenter', () => {
    hoveredSlotIndex = index;
  });
  slot.addEventListener('mouseleave', () => {
    hoveredSlotIndex = -1;
  });

  // 드래그 앤 드롭 이벤트 리스너 추가
  slot.addEventListener('dragover', e => {
    e.preventDefault(); // 드롭 허용
    // .item.dragging (선택 목록에서 드래그) 또는 .item-in-slot.dragging (그리드 내에서 드래그)
    const draggingItem = document.querySelector('.item.dragging, .item-in-slot.dragging');
    if (draggingItem && !slot.classList.contains('disabled')) { // 비활성화된 슬롯에는 드롭 불가
      slot.classList.add('drag-over');
    }
  });

  slot.addEventListener('dragleave', () => {
    slot.classList.remove('drag-over');
  });

  slot.addEventListener('drop', e => {
    e.preventDefault();
    slot.classList.remove('drag-over');

    if (slot.classList.contains('disabled')) return; // 비활성화된 슬롯에는 드롭 불가

    const itemId = e.dataTransfer.getData('itemId');
    const isArtifactStr = e.dataTransfer.getData('isArtifact');
    const isArtifact = isArtifactStr === 'true';
    const sourceSlotIndex = e.dataTransfer.getData('sourceSlotIndex'); // 드래그 시작 슬롯 인덱스 (그리드 내부 이동 시)

    let draggedItem;
    if (isArtifact) {
      draggedItem = selectedArtifacts.find(item => item.id === itemId);
    } else {
      draggedItem = selectedSlates.find(item => item.id === itemId);
    }

    if (!draggedItem) return; // 드래그된 아이템을 찾을 수 없으면 중단

    const targetIndex = parseInt(slot.dataset.index);

    // 그리드 내에서 아이템을 자기 자신 슬롯에 드롭하는 경우
    if (sourceSlotIndex !== "" && parseInt(sourceSlotIndex) === targetIndex) {
        updateAllSlotsUI();
        return;
    }

    const itemAtTarget = currentGridItems[targetIndex]; // 타겟 슬롯에 이미 있던 아이템

    // 그리드 밖에서 아이템이 온 경우 (selected 목록에서 드래그)
    if (sourceSlotIndex === "") {
        // 타겟 슬롯에 이미 아이템이 있다면 그 아이템은 빈 슬롯으로 돌려보낼 수 없으므로 무시하거나,
        // 아니면 교환 로직을 추가해야 함. 여기서는 기존 아이템을 먼저 제거하고 배치합니다.
        // (이 부분은 사용자 경험에 따라 교환 또는 거부 로직으로 변경 가능)
        if (itemAtTarget) { // 타겟 슬롯에 이미 아이템이 있다면, 해당 아이템을 제거 (선택 목록으로 돌아가지 않음)
            // 선택 목록에서도 제거 (원치 않으면 제거하지 않고, 그냥 그리드에서만 비움)
            // 현재는 선택 목록에 남아있게 두겠습니다. 그리드에서만 비웁니다.
            currentGridItems[targetIndex] = null; // 타겟 슬롯 비움
            document.querySelector(`.slot[data-index="${targetIndex}"]`).innerHTML = `<div class="name">빈 슬롯 ${targetIndex + 1}</div>`;
        }
    }
    // 그리드 내에서 아이템 이동 처리 (교환 로직)
    else { // sourceSlotIndex가 있으면 그리드 내 이동
        const srcIndex = parseInt(sourceSlotIndex);

        // 원래 위치 비우기
        currentGridItems[srcIndex] = null;
        document.querySelector(`.slot[data-index="${srcIndex}"]`).innerHTML = `<div class="name">빈 슬롯 ${srcIndex + 1}</div>`;

        // 타겟 위치에 원래 있던 아이템을 원래 위치로 되돌리거나 (교환)
        if (itemAtTarget) {
            currentGridItems[srcIndex] = itemAtTarget; // 타겟 아이템을 원본 위치로
            renderItemInSlot(document.querySelector(`.slot[data-index="${srcIndex}"]`), itemAtTarget);
        }
    }

    // 드래그된 아이템을 타겟 위치에 배치
    if (draggedItem.rotation === undefined) {
        draggedItem.rotation = 0; // 초기 회전 각도 0으로 설정
    }
    currentGridItems[targetIndex] = draggedItem;
    renderItemInSlot(slot, draggedItem);

    updateAllSlotsUI();
  });

  return slot;
}

// renderItemInSlot 함수 유지 (회전 버튼 삭제 및 이미지 회전 CSS 클래스 추가)
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
        <div class="item-in-slot ${conditionClass}" data-item-id="${item.id}" data-is-artifact="${item.id.startsWith('aritifact_')}" draggable="true">
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

  itemsToRender.forEach(item => {
    const div = document.createElement('div');
    div.className = 'item';
    // 선택된 아이템인 경우 'selected' 클래스 추가
    if (currentSelectedList.some(sItem => sItem.id === item.id)) {
      div.classList.add('selected');
    }
    div.innerHTML = `
      <img src="images/${item.icon}" alt="${item.name}" />
      <div>${item.name}</div>
    `;
    div.addEventListener('click', () => {
      if (isArtifact) {
        // 클릭 순서대로 우선순위 부여
        toggleItemSelectionWithOrder(item, selectedArtifacts, selectedArtifactsEl, true);
      } else {
        toggleItemSelection(item, selectedSlates, selectedSlatesEl, false);
      }
      applyFilterAndRenderList();
      updatePriorityList(); // 우선순위 목록을 업데이트
    });
    itemList.appendChild(div);
  });
}

// 아티팩트 클릭 시 우선순위 부여 로직 (클릭 순서대로 selectedArtifacts 정렬)
function toggleItemSelectionWithOrder(item, selectedList, container, isArtifact) {
  const foundIndex = selectedList.findIndex(i => i.id === item.id);
  if (foundIndex !== -1) {
    // 이미 선택된 아티팩트면 제거
    selectedList.splice(foundIndex, 1);
  } else {
    // 선택되지 않은 아티팩트면 마지막에 추가 (클릭 순서대로)
    selectedList.push({ ...item, level: 0 }); // level 초기값 0 유지
  }
  renderSelectedItems(selectedList, container, isArtifact);
}

// 기존 toggleItemSelection 함수는 석판에만 사용되도록 남겨둠 (아티팩트용은 WithOrder 함수 사용)
function toggleItemSelection(item, selectedList, container, isArtifact) {
    const foundIndex = selectedList.findIndex(i => i.id === item.id);
    if (foundIndex !== -1) {
        selectedList.splice(foundIndex, 1);
    } else {
        selectedList.push({ ...item, level: 0, rotation: 0 }); // 석판은 rotation 초기화
    }
    renderSelectedItems(selectedList, container, isArtifact);
}


function renderSelectedItems(list, container, isArtifact) {
  container.innerHTML = '';
  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'item';
    div.draggable = true;
    div.dataset.itemId = item.id;
    div.dataset.isArtifact = isArtifact;
    div.dataset.sourceSlotIndex = ""; // 이 아이템은 슬롯 밖에서 드래그되므로 빈 값

    div.addEventListener('dragstart', e => {
      e.dataTransfer.setData('itemId', item.id);
      e.dataTransfer.setData('isArtifact', isArtifact);
      e.dataTransfer.setData('sourceSlotIndex', ""); // 슬롯 밖에서 왔음을 알림
      e.currentTarget.classList.add('dragging');
    });

    div.addEventListener('dragend', e => {
      e.currentTarget.classList.remove('dragging');
    });

    const tags = (isArtifact && item.tags) ? (Array.isArray(item.tags) ? item.tags.map(tag => `#${tag}`).join(' ') : `#${item.tags}`) : '';

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
      <button class="remove-btn" onclick="removeItemFromSelection('${item.id}', ${isArtifact})">x</button>
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

  updateAllSlotsUI();
}

function removeItemFromSelection(id, isArtifact) {
    const list = isArtifact ? selectedArtifacts : selectedSlates;
    const updatedList = list.filter(item => item.id !== id);
    if (isArtifact) {
        selectedArtifacts = updatedList;
        renderSelectedItems(selectedArtifacts, selectedArtifactsEl, true);
    } else {
        selectedSlates = updatedList;
        renderSelectedItems(selectedSlates, selectedSlatesEl, false);
    }

    const slotIndexToRemove = currentGridItems.findIndex(item => item && item.id === id);
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

function updatePriorityList() {
  priorityList.innerHTML = ''; // div로 변경되었으므로 innerHTML 초기화
  selectedArtifacts.forEach((item, index) => { // 아티팩트만 우선순위 리스트에 추가
    const div = document.createElement('div');
    div.className = 'priority-item'; // 새 클래스명
    div.textContent = `${item.name}`; // 순서 번호는 따로 표시
    div.dataset.id = item.id;

    const orderNumberSpan = document.createElement('span');
    orderNumberSpan.className = 'order-number';
    orderNumberSpan.textContent = index + 1; // 1부터 시작하는 순서 번호
    div.prepend(orderNumberSpan); // 아이템 이름 앞에 추가

    priorityList.appendChild(div);
  });
  // 이제 드래그 관련 이벤트 리스너는 필요 없음 (ul->div로 변경되었고, 클릭 순서 우선순위임)
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

    currentGridItems.forEach((item, slotIndex) => {
        if (item && item.id.startsWith('slate_') && item.buffcoords && item.buffcoords.length > 0) {
            const baseRow = Math.floor(slotIndex / 6);
            const baseCol = slotIndex % 6;
            const rotation = item.rotation || 0;

            item.buffcoords.forEach(buff => {
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

    const currentItem = allItemsToPlace[itemIndex];
    const itemCondition = currentItem.condition && Array.isArray(currentItem.condition) && currentItem.condition.length > 0 ? currentItem.condition[0] : '';

    for (let slotCandidateIndex = 0; slotCandidateIndex < totalActiveSlots; slotCandidateIndex++) {
        if (currentGridState[slotCandidateIndex] === null &&
            isSlotAvailable(slotCandidateIndex, itemCondition, currentGridState)) {

            currentGridState[slotCandidateIndex] = currentItem;

            if (currentItem.id.startsWith('slate_') && currentItem.rotatable) {
                const originalRotation = currentItem.rotation;
                for (let rot = 0; rot < 360; rot += 90) {
                    currentItem.rotation = rot;
                    if (findSolution(itemIndex + 1, currentGridState, allItemsToPlace, totalActiveSlots)) {
                        return true;
                    }
                }
                currentItem.rotation = originalRotation;
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

  let allItemsToPlace = [...selectedArtifacts]; // 아티팩트는 클릭 순서가 곧 우선순위
  selectedSlates.forEach(slate => {
      allItemsToPlace.push(slate);
  });

  // ===== 아이템 정렬 기준 강화 (휴리스틱) =====
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
        const orderA = selectedArtifacts.findIndex(item => item.id === a.id);
        const orderB = selectedArtifacts.findIndex(item => item.id === b.id);
        return orderA - orderB;
    }
    return 0;
  });
  // ======================================

  if (findSolution(0, tempGridForArrangement, allItemsToPlace, currentSlotsCount)) {
      console.log("모든 아이템 배치 성공!");
      currentGridItems = [...tempGridForArrangement];

      selectedArtifacts.forEach(item => {
          const itemInGrid = currentGridItems.find(gridItem => gridItem && gridItem.id === item.id);
          if (itemInGrid) {
              itemInGrid.level = itemInGrid.maxUpgrade;
              item.level = item.maxUpgrade;
          }
      });
      renderSelectedItems(selectedArtifacts, selectedArtifactsEl, true);
  } else {
      console.log("모든 아이템을 배치할 수 없습니다.");
      alert("모든 아이템을 그리드에 배치할 수 없습니다. 슬롯 수를 늘리거나 조건을 재조정해보세요.");
  }

  updateAllSlotsUI();
}

/**
 * 석판을 90도 회전시키고, 해당 슬롯 및 주변 슬롯의 UI를 업데이트합니다.
 * @param {object} item - 회전할 석판 아이템 객체.
 * @param {number} slotIndex - 석판이 위치한 슬롯의 인덱스.
 */
function handleRotation(item, slotIndex) {
    // slates.json의 rotatable 필드를 따르도록 변경
    if (!item.rotatable) return;

    item.rotation = (item.rotation || 0) + 90;
    if (item.rotation >= 360) {
        item.rotation = 0;
    }

    const itemInGrid = currentGridItems[slotIndex];
    if (itemInGrid) {
        itemInGrid.rotation = item.rotation;
    }
    const itemInSelectedList = selectedSlates.find(sItem => sItem.id === item.id);
    if (itemInSelectedList) {
        itemInSelectedList.rotation = item.rotation;
    }

    const slotElement = document.querySelector(`.slot[data-index="${slotIndex}"]`);
    if (slotElement) {
        renderItemInSlot(slotElement, item);
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
                e.preventDefault(); // R키 기본 동작(새로고침 등) 방지
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
    // slates.json의 rotatable 필드를 따름. 필드가 없으면 false.
    // (slates.json에서 rotatable 필드 존재 확인)
    if (item.rotatable === undefined) { // slates.json에 rotatable 필드가 없는 경우
        item.rotatable = false; // 기본값 false로 설정
    }
    item.rotation = 0;
  });


  renderSlots(calculateSlots());
  generateTagFilters();
  applyFilterAndRenderList();
}

loadData();
