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
const priorityList = document.getElementById('priority-list');
const autoArrangeBtn = document.getElementById('auto-arrange-btn'); // 자동 배치 버튼

// 검색 및 필터링 관련 DOM 요소
const itemSearchInput = document.getElementById('item-search');
const tagFiltersContainer = document.getElementById('tag-filters');

let artifacts = [];
let slates = [];
let selectedArtifacts = [];
let selectedSlates = [];
// 각 슬롯의 현재 상태를 저장하는 배열. 아이템 객체와 함께 rotation 정보도 포함
let currentGridItems = new Array(maxSlots).fill(null);

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
        // 버프 재계산을 위해 모든 슬롯을 다시 렌더링
        updateAllSlotsUI();
        return;
    }

    // 기존에 드래그된 아이템이 있던 슬롯을 비움 (그리드 내부 이동 또는 외부에서 그리드로 이동 시)
    const oldSlotIndex = currentGridItems.findIndex(item => item && item.id === draggedItem.id);
    if (oldSlotIndex !== -1 && oldSlotIndex !== targetIndex) { // 타겟 슬롯과 다른 경우에만 비움
        currentGridItems[oldSlotIndex] = null;
        document.querySelector(`.slot[data-index="${oldSlotIndex}"]`).innerHTML = `<div class="name">빈 슬롯 ${oldSlotIndex + 1}</div>`;
    }
    
    const itemAtTarget = currentGridItems[targetIndex]; // 타겟 슬롯에 이미 있던 아이템

    // 그리드 내에서 아이템 이동 처리 (교환 로직)
    if (sourceSlotIndex !== "") { // sourceSlotIndex가 있으면 그리드 내 이동
        const srcIndex = parseInt(sourceSlotIndex);

        // 타겟 슬롯에 아이템이 있으면 원래 위치로 되돌리거나 교환
        if (itemAtTarget && srcIndex !== targetIndex) { // 타겟에 아이템이 있고 자기 자신이 아니면
            currentGridItems[srcIndex] = itemAtTarget; // 타겟 아이템을 원본 위치로
            renderItemInSlot(document.querySelector(`.slot[data-index="${srcIndex}"]`), itemAtTarget);
        } else if (!itemAtTarget && srcIndex !== targetIndex) { // 타겟이 비어있으면 원본만 비움
            currentGridItems[srcIndex] = null;
            document.querySelector(`.slot[data-index="${srcIndex}"]`).innerHTML = `<div class="name">빈 슬롯 ${srcIndex + 1}</div>`;
        }
    }

    // 드래그된 아이템을 타겟 위치에 배치
    // 선택 목록에서 처음 드래그된 아이템은 rotation 속성이 없을 수 있으므로 0으로 초기화
    if (draggedItem.rotation === undefined) {
        draggedItem.rotation = 0; // 0, 90, 180, 270
    }
    currentGridItems[targetIndex] = draggedItem;
    renderItemInSlot(slot, draggedItem);

    // 모든 슬롯의 버프 및 condition을 재계산하고 UI를 업데이트
    updateAllSlotsUI();
  });

  return slot;
}

// renderItemInSlot 함수 수정: 슬롯 내 아이템을 드래그 가능하게 설정, 회전 버튼 추가
function renderItemInSlot(slotElement, item) {
    const slotIndex = parseInt(slotElement.dataset.index);
    const slotBuffs = calculateSlotBuffs(); // 슬롯 버프 계산
    const additionalUpgrade = slotBuffs[slotIndex] || 0; // 해당 슬롯의 추가 강화 수치

    const displayLevel = (item.level || 0) + additionalUpgrade; // 표시할 최종 레벨
    let levelColorClass = '';
    // MaxUpgrade가 0보다 클 때만 초록색 적용 (아이템에 강화 레벨이 없으면 의미 없음)
    if (item.maxUpgrade > 0 && displayLevel >= item.maxUpgrade) {
        levelColorClass = 'level-maxed';
    }

    // condition 충족 여부 확인
    let isConditionMet = false;
    // item.condition은 배열일 수 있으므로, 배열의 첫 번째 요소 또는 빈 문자열을 전달
    const itemCondition = item.condition && Array.isArray(item.condition) && item.condition.length > 0 ? item.condition[0] : '';
    
    if (itemCondition) { // condition 문자열이 존재하는 경우
        const tempGridForCheck = [...currentGridItems]; // 현재 그리드 상태 복사
        tempGridForCheck[slotIndex] = item; // 해당 슬롯에 임시로 아이템 배치 (검사용)
        isConditionMet = isSlotAvailable(slotIndex, itemCondition, tempGridForCheck);
    } else {
        isConditionMet = true; // condition이 없으면 항상 충족
    }
    const conditionClass = isConditionMet ? 'condition-met' : 'condition-unmet';

    // 아이콘 회전 클래스 설정
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

    // 슬롯 내 아이템의 드래그 이벤트 리스너
    const itemInSlotDiv = slotElement.querySelector('.item-in-slot');
    if (itemInSlotDiv) {
        itemInSlotDiv.addEventListener('dragstart', e => {
            e.dataTransfer.setData('itemId', item.id);
            e.dataTransfer.setData('isArtifact', item.id.startsWith('aritifact_'));
            e.dataTransfer.setData('sourceSlotIndex', slotIndex); // 드래그 시작 슬롯 인덱스 추가
            e.currentTarget.classList.add('dragging');
        });

        itemInSlotDiv.addEventListener('dragend', e => {
            e.currentTarget.classList.remove('dragging');
        });
    }

    // 회전 버튼 이벤트 리스너 (동적으로 생성되므로 여기서 추가)
    const rotateButton = slotElement.querySelector('.rotate-button');
    if (rotateButton) {
        rotateButton.addEventListener('click', (e) => {
            e.stopPropagation(); // 드래그 이벤트와 중복 방지
            handleRotation(item, slotIndex);
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
    if (currentSelectedList.some(sItem => sItem.id === item.id)) {
      div.classList.add('selected');
    }
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
      applyFilterAndRenderList();
      updatePriorityList();
    });
    itemList.appendChild(div);
  });
}

function toggleItemSelection(item, selectedList, container, isArtifact) {
  const foundIndex = selectedList.findIndex(i => i.id === item.id);
  if (foundIndex !== -1) {
    selectedList.splice(foundIndex, 1);
  } else {
    // 아티팩트의 초기 레벨은 0으로 유지 (autoArrange에서 일괄 강화)
    // 석판의 경우 rotatable 속성을 추가하고 rotation 속성 초기화
    selectedList.push({
      ...item,
      level: 0,
      rotation: 0 // 초기 회전 각도 0으로 설정
    });
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

  // 레벨 변경 후 모든 슬롯의 버프 및 condition을 재계산하고 UI를 업데이트
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

    // 아이템 제거 후에도 모든 슬롯의 버프 및 condition을 재계산하고 UI를 업데이트
    updateAllSlotsUI();
}


// ==========================
// 우선순위 목록 (드래그 앤 드롭 정렬)
// ==========================

function updatePriorityList() {
  priorityList.innerHTML = '';
  selectedArtifacts.forEach(item => { // 아티팩트만 우선순위 리스트에 추가 (석판은 현재 포함하지 않음)
    const li = document.createElement('li');
    li.textContent = `${item.name} (★${item.maxUpgrade})`;
    li.dataset.id = item.id;
    li.draggable = true;

    li.addEventListener('dragstart', e => {
      e.dataTransfer.setData('priorityItemId', item.id); // 우선순위 리스트에서 드래그 중임을 알림
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      // 드래그 종료 후 순서 업데이트 (실제 배열에 반영)
      const newOrder = [...priorityList.querySelectorAll('li')].map(li => li.dataset.id);
      selectedArtifacts.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
      // 순서가 변경되었으므로 자동 배치 다시 실행
      // autoArrange(); // 필요 시 주석 해제
    });
    li.addEventListener('dragover', e => {
      e.preventDefault();
      const dragging = document.querySelector('.priority-list .dragging');
      if (dragging && dragging !== li) {
        const afterElement = getDragAfterElement(priorityList, e.clientY);
        if (afterElement == null) {
          priorityList.appendChild(dragging);
        } else {
          priorityList.insertBefore(dragging, afterElement);
        }
      }
    });

    priorityList.appendChild(li);
  });
}

// 드래그 오버 시 요소 위치 판단 헬퍼 함수
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: -Infinity }).element;
}

// ==========================
// 아이템 필터링/검색 기능
// ==========================

let activeTags = new Set(); // 현재 활성화된 태그 필터

function generateTagFilters() {
    tagFiltersContainer.innerHTML = ''; // 기존 태그 버튼 초기화
    const tagsArray = Array.from(allTags).sort(); // Set을 배열로 변환하고 정렬

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
    } else { // currentActiveTab === 'slates'
        filteredItems = slates.filter(item => {
            const nameMatch = item.name.toLowerCase().includes(searchTerm);
            const tagMatch = true; // slates는 tags가 없으므로 항상 true
            return nameMatch && tagMatch;
        });
        renderItemList(filteredItems, false);
    }
}


// ==========================
// 배치 알고리즘 (Condition 고려)
// ==========================

/**
 * 그리드의 특정 슬롯이 아이템의 조건을 만족하는지 확인합니다.
 * @param {number} slotIndex - 확인할 슬롯의 인덱스.
 * @param {string} condition - 아이템의 조건 문자열.
 * @param {Array} currentGrid - 현재 그리드 상태를 나타내는 배열.
 * @returns {boolean} 조건 충족 여부.
 */
function isSlotAvailable(slotIndex, condition, currentGrid) {
    const row = Math.floor(slotIndex / 6); // 그리드 열이 6개 (0부터 시작)
    const col = slotIndex % 6; // 그리드 행 (0부터 시작)
    const totalRows = Math.ceil(calculateSlots() / 6); // 현재 활성화된 슬롯 수에 기반한 전체 행 수
    const totalCols = 6; // 그리드 열 고정

    switch (condition) {
        case "최상단": // 그리드의 첫 번째 행
            return row === 0;
        case "최하단": // 그리드의 마지막 행
            return row === totalRows - 1;
        case "가장자리": // 그리드의 가장 외각 슬롯 (첫행, 마지막행, 첫열, 마지막열)
            return row === 0 || row === totalRows - 1 || col === 0 || col === totalCols - 1;
        case "안쪽": // 가장자리를 제외한 내부
            return row > 0 && row < totalRows - 1 && col > 0 && col < totalCols - 1;
        case "양쪽칸이 공백": // 아이템의 좌우 슬롯이 비어있어야 함(석판도 불가능)
            // 현재 슬롯의 좌우 인덱스
            const leftSlotIndex = slotIndex - 1;
            const rightSlotIndex = slotIndex + 1;

            // 좌우 슬롯이 그리드 범위 내에 있는지 확인
            const isLeftInBounds = (col > 0);
            const isRightInBounds = (col < totalCols - 1);

            // 좌우 슬롯이 비어있는지 확인
            // 그리드 범위를 벗어나면 빈 것으로 간주 (즉, 벽 옆이면 공백으로 취급)
            const isLeftEmpty = !isLeftInBounds || currentGrid[leftSlotIndex] === null;
            const isRightEmpty = !isRightInBounds || currentGrid[rightSlotIndex] === null;

            return isLeftEmpty && isRightEmpty;
        default: // 조건이 없거나 알 수 없는 조건은 항상 가능
            return true;
    }
}

/**
 * 그리드의 각 슬롯에 적용되는 추가 강화 수치를 계산합니다.
 * 석판의 buffcoords 정보를 활용하며, 석판의 회전 상태에 따라 버프 좌표를 변환합니다.
 * @returns {number[]} 각 슬롯의 인덱스에 해당하는 추가 강화 수치 배열
 */
function calculateSlotBuffs() {
    const slotBuffs = new Array(maxSlots).fill(0); // 모든 슬롯의 버프를 0으로 초기화

    currentGridItems.forEach((item, slotIndex) => {
        // 석판(slate)이고 buffcoords 정보가 있을 때만 처리
        if (item && item.id.startsWith('slate_') && item.buffcoords && item.buffcoords.length > 0) {
            const baseRow = Math.floor(slotIndex / 6);
            const baseCol = slotIndex % 6;
            const rotation = item.rotation || 0; // 석판의 현재 회전 각도 (0, 90, 180, 270)

            item.buffcoords.forEach(buff => {
                let transformedX = buff.x || 0;
                let transformedY = buff.y || 0;

                // 회전 각도에 따라 buffcoords 변환 (시계 방향 회전)
                if (rotation === 90) { // 90도 회전: (x, y) -> (-y, x)
                    [transformedX, transformedY] = [-transformedY, transformedX];
                } else if (rotation === 180) { // 180도 회전: (x, y) -> (-x, -y)
                    [transformedX, transformedY] = [-transformedX, -transformedY];
                } else if (rotation === 270) { // 270도 회전: (x, y) -> (y, -x)
                    [transformedX, transformedY] = [transformedY, -transformedX];
                }

                const targetRow = baseRow + transformedY;
                const targetCol = baseCol + transformedX;
                const targetIndex = targetRow * 6 + targetCol;

                // 유효한 슬롯 인덱스인지 확인
                const currentActiveSlotsCount = calculateSlots();
                if (targetIndex >= 0 && targetIndex < currentActiveSlotsCount &&
                    targetRow >= 0 && targetRow < Math.ceil(currentActiveSlotsCount / 6) && // 행 범위 확인
                    targetCol >= 0 && targetCol < 6) { // 열 범위 확인

                    let buffValue = 0;
                    // buff.v 필드 (기존 형식: "v": "+1" 또는 "v": "limitUnlock") 처리
                    if (buff.v !== undefined) {
                        if (buff.v === "limitUnlock") {
                            buffValue = 1; // "limitUnlock"은 1로 처리
                        } else if (!isNaN(parseInt(buff.v))) { // 숫자 값인 경우
                            buffValue = parseInt(buff.v);
                        }
                    }
                    // buff.value 필드 (새로운 형식: "value": 1) 처리 (slates.json에서 이 형식이 보임)
                    else if (buff.value !== undefined && !isNaN(parseInt(buff.value))) {
                        buffValue = parseInt(buff.value);
                    }
                    // buff.type 필드 (예: "downside", "edge")는 현재 강화 수치에 영향 주지 않으므로 무시

                    slotBuffs[targetIndex] += buffValue;
                }
            });
        }
    });
    return slotBuffs;
}

/**
 * 모든 활성화된 슬롯의 UI를 현재 currentGridItems 상태에 맞춰 업데이트합니다.
 * 버프, 컨디션, 회전 상태 등을 재계산하고 반영합니다.
 */
function updateAllSlotsUI() {
    const currentSlotsCount = calculateSlots();
    for(let i = 0; i < currentSlotsCount; i++) {
        const slotElement = document.querySelector(`.slot[data-index="${i}"]`);
        if (slotElement) {
            if(currentGridItems[i]) {
                renderItemInSlot(slotElement, currentGridItems[i]);
            } else {
                slotElement.innerHTML = `<div class="name">빈 슬롯 ${i + 1}</div>`;
            }
        }
    }
}


function autoArrange() {
  const currentSlotsCount = calculateSlots();
  const allSlotsElements = [...document.querySelectorAll('.slot')];

  // 모든 슬롯을 일단 비움
  allSlotsElements.forEach(slot => {
    slot.innerHTML = `<div class="name">빈 슬롯 ${parseInt(slot.dataset.index) + 1}</div>`;
    slot.classList.remove('disabled');
  });
  currentGridItems.fill(null); // 그리드 상태 배열도 완전히 비움

  // 슬롯 수에 따라 disabled 클래스 다시 적용
  for (let i = 0; i < maxSlots; i++) { // maxSlots까지 순회하여 disabled 처리
      if (i >= currentSlotsCount) {
          allSlotsElements[i].classList.add('disabled');
      }
  }

  // 아티팩트의 레벨은 autoArrange 이후에 강화되도록 변경.
  // 여기서는 단순히 배치만 수행합니다.

  // 선택된 아티팩트와 석판을 우선순위에 따라 정렬
  const allPrioritizedItems = [...selectedArtifacts];
  selectedSlates.forEach(slate => {
      allPrioritizedItems.push(slate);
  });

  let placedCount = 0;
  for (const item of allPrioritizedItems) {
    if (placedCount >= currentSlotsCount) break;

    let placed = false;
    const itemCondition = item.condition && Array.isArray(item.condition) && item.condition.length > 0 ? item.condition[0] : '';

    // 슬롯 탐색 (가장 먼저 조건을 만족하는 빈 슬롯)
    for (let i = 0; i < currentSlotsCount; i++) {
        if (currentGridItems[i] === null) {
            if (isSlotAvailable(i, itemCondition, currentGridItems)) {
                // 배치 시 아이템의 rotation 속성 초기화
                if (item.rotation === undefined) { // 선택 목록에서 온 아이템인 경우
                    item.rotation = 0;
                }
                currentGridItems[i] = item; // 임시 배치
                placed = true;
                placedCount++;
                break;
            }
        }
    }
  }

  // 자동 배치 완료 후 아티팩트 레벨을 maxUpgrade까지 강화
  selectedArtifacts.forEach(item => {
    item.level = item.maxUpgrade;
    renderSelectedItems(selectedArtifacts, selectedArtifactsEl, true); // 선택된 목록 UI 업데이트
  });


  // 배치 완료 후 모든 슬롯의 UI를 업데이트하여 버프, 컨디션, 강화 상태를 정확히 반영
  updateAllSlotsUI();
}

/**
 * 석판을 90도 회전시키고, 해당 슬롯 및 주변 슬롯의 UI를 업데이트합니다.
 * @param {object} item - 회전할 석판 아이템 객체.
 * @param {number} slotIndex - 석판이 위치한 슬롯의 인덱스.
 */
function handleRotation(item, slotIndex) {
    if (!item.rotatable) return; // 회전 불가능한 석판이면 중단

    // 회전 각도 변경: 0 -> 90 -> 180 -> 270 -> 0
    item.rotation = (item.rotation || 0) + 90;
    if (item.rotation >= 360) {
        item.rotation = 0;
    }

    // currentGridItems에 있는 해당 아이템의 rotation 값 업데이트 (상태 동기화)
    currentGridItems[slotIndex].rotation = item.rotation;

    // 아이템 객체의 rotation 속성을 업데이트했으므로, 해당 슬롯을 다시 렌더링
    const slotElement = document.querySelector(`.slot[data-index="${slotIndex}"]`);
    if (slotElement) {
        renderItemInSlot(slotElement, item);
    }

    // 회전으로 인해 주변 슬롯의 버프가 변경될 수 있으므로 모든 슬롯의 UI를 업데이트
    updateAllSlotsUI();
}


// ==========================
// 이벤트 리스너 및 초기화
// ==========================

tabArtifacts.addEventListener('click', () => {
  tabArtifacts.classList.add('active');
  tabSlates.classList.remove('active');
  currentActiveTab = 'artifacts'; // 현재 활성화된 탭 상태 업데이트
  itemSearchInput.value = ''; // 탭 변경 시 검색어 초기화
  activeTags.clear(); // 탭 변경 시 태그 필터 초기화
  generateTagFilters(); // 태그 필터 다시 생성
  applyFilterAndRenderList(); // 아이템 목록 렌더링
});

tabSlates.addEventListener('click', () => {
  tabSlates.classList.add('active');
  tabArtifacts.classList.remove('active');
  currentActiveTab = 'slates'; // 현재 활성화된 탭 상태 업데이트
  itemSearchInput.value = ''; // 탭 변경 시 검색어 초기화
  activeTags.clear(); // 탭 변경 시 태그 필터 초기화
  generateTagFilters(); // 태그 필터 다시 생성
  applyFilterAndRenderList(); // 아이템 목록 렌더링
});

checkboxes.forEach(chk => {
  chk.addEventListener('change', () => {
    renderSlots(calculateSlots()); // 슬롯 수 변경 시 전체 그리드 다시 그리기
    updateAllSlotsUI(); // 슬롯 수 변경 시 버프/컨디션 재계산 및 UI 업데이트
  });
});

autoArrangeBtn.addEventListener('click', autoArrange); // 자동 배치 버튼에 이벤트 리스너 추가

// 검색 입력 필드 이벤트 리스너
itemSearchInput.addEventListener('input', applyFilterAndRenderList);

// R키 회전을 위한 키보드 이벤트 리스너 추가
document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        if (hoveredSlotIndex !== -1) { // 마우스가 슬롯 위에 있는 경우
            const itemInSlot = currentGridItems[hoveredSlotIndex];
            if (itemInSlot && itemInSlot.id.startsWith('slate_')) { // 슬롯에 석판이 있는 경우
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

  // artifacts 데이터 처리: tags, condition 배열화 및 upgrade, maxUpgrade 기본값 설정
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
    // condition 필드가 배열이 아닌 경우 배열로 변환
    if (typeof item.condition === 'string' && item.condition !== '') {
        item.condition = [item.condition];
    } else if (!Array.isArray(item.condition)) {
        item.condition = [];
    }
  });

  // slates 데이터 처리: tags, upgrade, maxUpgrade, condition, rotatable, rotation 속성 추가
  slates.forEach(item => {
    item.tags = []; // slates는 tags가 없으므로 빈 배열
    item.upgrade = 0;
    item.maxUpgrade = 0;
    // condition 필드 처리
    if (typeof item.condition === 'string' && item.condition !== '') {
        item.condition = [item.condition];
    } else if (!Array.isArray(item.condition)) {
        item.condition = [];
    }
    // slates.json에 rotatable 필드가 명시되어 있지 않으므로, 기본적으로 true로 설정
    // 만약 slates.json에 rotatable: false 같은 명시적인 필드가 있다면 그것을 따릅니다.
    // 현재 slates.json에는 rotatable 필드가 명시되어 있지 않지만, rotatable: true로 가정하여 회전 가능하게 함
    item.rotatable = true; // 모든 석판이 회전 가능하다고 가정
    item.rotation = 0; // 초기 회전 각도 0
  });


  // 초기 로드 시 아티팩트 목록 렌더링 및 슬롯 렌더링
  renderSlots(calculateSlots());
  generateTagFilters(); // 태그 필터 버튼 생성
  applyFilterAndRenderList(); // 초기 아이템 목록 렌더링 (필터링 적용)
}

loadData();
