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
let currentGridItems = new Array(maxSlots).fill(null); // 그리드 슬롯의 현재 상태를 저장하는 배열

let currentActiveTab = 'artifacts'; // 현재 활성화된 탭 ('artifacts' 또는 'slates')
let allTags = new Set(); // 모든 아티팩트의 태그를 저장할 Set (slates에는 tags가 없으므로 아티팩트만)

// ==========================
// 슬롯 관련 함수
// ==========================

function createSlot(index) {
  const slot = document.createElement('div');
  slot.className = 'slot';
  slot.dataset.index = index; // 슬롯 인덱스 추가

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
        const currentSlotsCount = calculateSlots();
        for(let i = 0; i < currentSlotsCount; i++) {
            if(currentGridItems[i]) {
                const slotElement = document.querySelector(`.slot[data-index="${i}"]`);
                if (slotElement) {
                    renderItemInSlot(slotElement, currentGridItems[i]);
                }
            }
        }
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
    currentGridItems[targetIndex] = draggedItem;
    renderItemInSlot(slot, draggedItem);

    // 모든 슬롯의 버프 및 condition을 재계산하고 UI를 업데이트
    const currentSlotsCount = calculateSlots();
    for(let i = 0; i < currentSlotsCount; i++) {
        if(currentGridItems[i]) {
            const slotElement = document.querySelector(`.slot[data-index="${i}"]`);
            if (slotElement) {
                renderItemInSlot(slotElement, currentGridItems[i]);
            }
        } else { // 빈 슬롯도 버프 영향을 받을 수 있으므로 빈 슬롯으로 다시 그림
             const slotElement = document.querySelector(`.slot[data-index="${i}"]`);
             if (slotElement) {
                 slotElement.innerHTML = `<div class="name">빈 슬롯 ${i + 1}</div>`;
             }
        }
    }
  });

  // 초기 빈 슬롯 텍스트 (renderSlots에서 이미 처리됨)
  // slot.innerHTML = `<div class="name">빈 슬롯 ${index + 1}</div>`;
  return slot;
}

// renderItemInSlot 함수 수정: 슬롯 내 아이템을 드래그 가능하게 설정
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
    if (item.condition && item.condition.length > 0) { // item.condition이 존재하고 비어있지 않은 경우
        const tempGridForCheck = [...currentGridItems]; // 현재 그리드 상태 복사
        tempGridForCheck[slotIndex] = item; // 해당 슬롯에 임시로 아이템 배치 (검사용)
        isConditionMet = isSlotAvailable(slotIndex, item.condition[0], tempGridForCheck); // condition은 배열이므로 첫 번째 요소를 사용
    } else {
        isConditionMet = true; // condition이 없으면 항상 충족
    }
    const conditionClass = isConditionMet ? 'condition-met' : 'condition-unmet';

    slotElement.innerHTML = `
        <div class="item-in-slot ${conditionClass}" data-item-id="${item.id}" data-is-artifact="${item.id.startsWith('aritifact_')}" draggable="true">
            <img src="images/${item.icon}" alt="${item.name}" />
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-level ${levelColorClass}">★${displayLevel}/${item.maxUpgrade}</div>
            </div>
            ${additionalUpgrade > 0 ? `<div class="slot-buff-indicator">+${additionalUpgrade}</div>` : ''}
        </div>
    `;

    // !!! 새롭게 추가할 부분: 슬롯 내 아이템의 드래그 이벤트 리스너 !!!
    const itemInSlotDiv = slotElement.querySelector('.item-in-slot');
    if (itemInSlotDiv) {
        itemInSlotDiv.addEventListener('dragstart', e => {
            // 드래그되는 아이템의 정보와 '어디에서' 드래그되었는지에 대한 정보 추가
            e.dataTransfer.setData('itemId', item.id);
            e.dataTransfer.setData('isArtifact', item.id.startsWith('aritifact_'));
            e.dataTransfer.setData('sourceSlotIndex', slotIndex); // 드래그 시작 슬롯 인덱스 추가
            e.currentTarget.classList.add('dragging');
        });

        itemInSlotDiv.addEventListener('dragend', e => {
            e.currentTarget.classList.remove('dragging');
        });
    }
}


function renderSlots(count) {
  grid.innerHTML = '';
  // currentGridItems 초기화 (새로운 슬롯 수에 맞춰)
  // 기존에 배치된 아이템은 유지되어야 하므로 완전히 비우지 않고, disabled 처리만
  const previousGridItems = [...currentGridItems]; // 현재 배치 상태 저장
  currentGridItems = new Array(maxSlots).fill(null); // 새 배열 생성 (초기 null로 채움)

  for (let i = 0; i < maxSlots; i++) {
    const slot = createSlot(i);
    if (i >= count) {
        slot.classList.add('disabled');
    } else {
        // 이전 배치 상태에서 아이템이 있었다면 다시 그리기
        if (previousGridItems[i]) {
            currentGridItems[i] = previousGridItems[i]; // 새 배열에 아이템 복사
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

  itemsToRender.forEach(item => { // 필터링된 아이템만 렌더링
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
      // 아이템 목록에서 클릭 시 선택/해제 토글
      if (isArtifact) {
        toggleItemSelection(item, selectedArtifacts, selectedArtifactsEl, true);
      } else {
        toggleItemSelection(item, selectedSlates, selectedSlatesEl, false);
      }
      // 선택/해제 후 현재 탭의 아이템 목록을 다시 렌더링하여 'selected' 클래스를 업데이트
      applyFilterAndRenderList(); // 필터링 상태를 유지하며 다시 렌더링
      updatePriorityList();
    });
    itemList.appendChild(div);
  });
}

function toggleItemSelection(item, selectedList, container, isArtifact) {
  const foundIndex = selectedList.findIndex(i => i.id === item.id);
  if (foundIndex !== -1) {
    // 이미 선택된 아이템이면 제거
    selectedList.splice(foundIndex, 1);
  } else {
    // 선택되지 않은 아이템이면 추가
    // maxUpgrade까지 강화하는 시스템을 고려하여, 여기에 level = item.maxUpgrade를 넣을 수도 있지만,
    // autoArrange에서 일괄 처리하므로 여기서는 초기값 0을 유지합니다.
    selectedList.push({ ...item, level: 0 });
  }
  renderSelectedItems(selectedList, container, isArtifact);
}

function renderSelectedItems(list, container, isArtifact) {
  container.innerHTML = '';
  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'item';
    div.draggable = true; // 선택된 아이템을 드래그 가능하게 설정
    div.dataset.itemId = item.id;
    div.dataset.isArtifact = isArtifact; // 아티팩트인지 석판인지 구분
    div.dataset.sourceSlotIndex = ""; // 이 아이템은 슬롯 밖에서 드래그되므로 빈 값

    // 드래그 시작 이벤트
    div.addEventListener('dragstart', e => {
      e.dataTransfer.setData('itemId', item.id);
      e.dataTransfer.setData('isArtifact', isArtifact);
      e.dataTransfer.setData('sourceSlotIndex', ""); // 슬롯 밖에서 왔음을 알림
      e.currentTarget.classList.add('dragging');
    });

    // 드래그 종료 이벤트
    div.addEventListener('dragend', e => {
      e.currentTarget.classList.remove('dragging');
    });

    // slates.json에는 tags 필드가 없으므로 isArtifact일 경우에만 tags를 표시
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
  const currentSlotsCount = calculateSlots();
  for(let i = 0; i < currentSlotsCount; i++) {
      if(currentGridItems[i]) {
          const slotElement = document.querySelector(`.slot[data-index="${i}"]`);
          if (slotElement) {
              renderItemInSlot(slotElement, currentGridItems[i]);
          }
      } else { // 빈 슬롯도 버프 영향이 사라질 수 있으므로 다시 그림
           const slotElement = document.querySelector(`.slot[data-index="${i}"]`);
           if (slotElement) {
               slotElement.innerHTML = `<div class="name">빈 슬롯 ${i + 1}</div>`;
           }
      }
  }
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
    const currentSlotsCount = calculateSlots();
    for(let i = 0; i < currentSlotsCount; i++) {
        if(currentGridItems[i]) {
            const slotElement = document.querySelector(`.slot[data-index="${i}"]`);
            if (slotElement) {
                renderItemInSlot(slotElement, currentGridItems[i]);
            }
        } else { // 빈 슬롯도 버프 영향이 사라질 수 있으므로 다시 그림
            const slotElement = document.querySelector(`.slot[data-index="${i}"]`);
            if (slotElement) {
                slotElement.innerHTML = `<div class="name">빈 슬롯 ${i + 1}</div>`;
            }
        }
    }
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
      // autoArrange(); // 알고리즘 구현 후에 주석 해제 (원치 않으면 그대로 주석)
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
            // item.tags는 이제 항상 배열이거나 빈 배열이므로 안전하게 .some() 사용
            const tagMatch = activeTags.size === 0 || item.tags.some(tag => activeTags.has(tag));
            return nameMatch && tagMatch;
        });
        renderItemList(filteredItems, true);
    } else { // currentActiveTab === 'slates'
        filteredItems = slates.filter(item => {
            const nameMatch = item.name.toLowerCase().includes(searchTerm);
            // slates.json에 tags 필드가 없으므로, 태그 필터는 아티팩트 탭에서만 유효
            // 여기서는 항상 true로 처리 (혹은 태그 필터 버튼을 숨기거나 비활성화)
            const tagMatch = true;
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
 * 석판의 buffcoords 정보를 활용합니다.
 * @returns {number[]} 각 슬롯의 인덱스에 해당하는 추가 강화 수치 배열
 */
function calculateSlotBuffs() {
    const slotBuffs = new Array(maxSlots).fill(0); // 모든 슬롯의 버프를 0으로 초기화

    currentGridItems.forEach((item, slotIndex) => {
        // 석판(slate)이고 buffcoords 정보가 있을 때만 처리
        if (item && item.id.startsWith('slate_') && item.buffcoords && item.buffcoords.length > 0) {
            const baseRow = Math.floor(slotIndex / 6);
            const baseCol = slotIndex % 6;

            item.buffcoords.forEach(buff => {
                const targetRow = baseRow + (buff.y || 0); // y가 없을 경우 0으로 처리
                const targetCol = baseCol + (buff.x || 0); // x가 없을 경우 0으로 처리
                const targetIndex = targetRow * 6 + targetCol;

                // 유효한 슬롯 인덱스인지 확인
                // maxSlots 대신 calculateSlots()를 사용하여 현재 활성화된 슬롯 수로 제한
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
                    // buff.value 필드 (새로운 형식: "value": 1) 처리
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


function autoArrange() {
  const currentSlotsCount = calculateSlots();
  const allSlotsElements = [...document.querySelectorAll('.slot')]; // 모든 슬롯 요소 가져오기

  // 모든 슬롯을 일단 비움
  allSlotsElements.forEach(slot => {
    slot.innerHTML = `<div class="name">빈 슬롯 ${parseInt(slot.dataset.index) + 1}</div>`;
    // disabled 클래스도 초기화 (슬롯 수가 변경될 때 renderSlots에서 다시 적용)
    slot.classList.remove('disabled');
  });
  currentGridItems.fill(null); // 그리드 상태 배열도 완전히 비움

  // 슬롯 수에 따라 disabled 클래스 다시 적용
  for (let i = 0; i < maxSlots; i++) { // maxSlots까지 순회하여 disabled 처리
      if (i >= currentSlotsCount) {
          allSlotsElements[i].classList.add('disabled');
      }
  }

  // 1. 선택된 아티팩트의 레벨을 maxUpgrade까지 자동으로 올림
  selectedArtifacts.forEach(item => {
    item.level = item.maxUpgrade;
    // UI 업데이트 (선택된 아이템 목록)
    renderSelectedItems(selectedArtifacts, selectedArtifactsEl, true);
  });

  // 선택된 아티팩트와 석판을 우선순위에 따라 정렬
  // selectedArtifacts는 우선순위 리스트에서 드래그 순서에 따라 이미 정렬되어 있습니다.
  const allPrioritizedItems = [...selectedArtifacts];

  // 선택된 석판을 아티팩트 뒤에 추가 (석판은 현재 우선순위 정렬이 없으므로 단순히 추가)
  selectedSlates.forEach(slate => {
      allPrioritizedItems.push(slate);
  });

  let placedCount = 0;
  for (const item of allPrioritizedItems) {
    if (placedCount >= currentSlotsCount) break; // 사용 가능한 슬롯을 초과하면 중단

    let placed = false;
    // 아이템의 condition을 고려하여 슬롯 탐색
    for (let i = 0; i < currentSlotsCount; i++) {
        if (currentGridItems[i] === null) { // 슬롯이 비어있는 경우
            // isSlotAvailable의 condition은 배열이 아닌 문자열 하나이므로 item.condition[0] 사용
            const conditionToCheck = item.condition && item.condition.length > 0 ? item.condition[0] : '';

            if (isSlotAvailable(i, conditionToCheck, currentGridItems)) {
                const slotElement = document.querySelector(`.slot[data-index="${i}"]`);
                if (slotElement) {
                    currentGridItems[i] = item; // 임시 배치
                    renderItemInSlot(slotElement, item); // 배치된 모습 렌더링
                    placed = true;
                    placedCount++;
                    break; // 아이템을 배치했으므로 다음 아이템으로
                }
            }
        }
    }
  }
  // currentGridItems는 이미 배치 결과를 담고 있음
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
    // autoArrange(); // 슬롯 수 변경 시 자동 배치를 원하면 주석 해제 (UX상 자동 실행은 혼란 줄 수 있음)
  });
});

autoArrangeBtn.addEventListener('click', autoArrange); // 자동 배치 버튼에 이벤트 리스너 추가

// 검색 입력 필드 이벤트 리스너
itemSearchInput.addEventListener('input', applyFilterAndRenderList);


async function loadData() {
  const res1 = await fetch('artifacts.json');
  artifacts = await res1.json();
  const res2 = await fetch('slates.json');
  slates = await res2.json();

  // artifacts 데이터 처리: tags가 문자열인 경우 배열로 변환 및 maxUpgrade, upgrade 기본값 설정
  artifacts.forEach(item => {
    // tags 필드가 문자열이고 콤마가 포함된 경우 배열로 분할
    if (typeof item.tags === 'string' && item.tags.includes(',')) {
      item.tags = item.tags.split(',').map(tag => tag.trim());
    }
    // tags 필드가 문자열이지만 콤마가 없고 비어있지 않은 경우 단일 요소 배열로
    else if (typeof item.tags === 'string' && item.tags !== '') {
      item.tags = [item.tags];
    }
    // tags 필드가 없거나 다른 타입인 경우 빈 배열로 초기화
    else {
      item.tags = [];
    }

    // upgrade, maxUpgrade 필드가 없는 경우 0으로 초기화
    // artifacts.json에 공백 필드를 제거했으므로 직접 접근
    if (item.upgrade === undefined) {
        item.upgrade = 0;
    }
    if (item.maxUpgrade === undefined) {
        item.maxUpgrade = 0;
    }
    // condition 필드가 배열이 아닌 경우 배열로 변환 (예: "최상단" -> ["최상단"])
    if (typeof item.condition === 'string' && item.condition !== '') {
        item.condition = [item.condition];
    } else if (!Array.isArray(item.condition)) {
        item.condition = [];
    }

    // 모든 아티팩트 태그 수집
    item.tags.forEach(tag => allTags.add(tag));
  });

  // slates 데이터 처리: tags, upgrade, maxUpgrade, condition 필드 처리
  slates.forEach(item => {
    // tags 필드가 slates.json에 없으므로, 빈 배열로 강제 초기화
    item.tags = [];
    // upgrade, maxUpgrade 필드가 slates.json에 없으므로, 0으로 초기화
    item.upgrade = 0;
    item.maxUpgrade = 0;
    // condition 필드도 artifacts와 유사하게 처리
    if (typeof item.condition === 'string' && item.condition !== '') {
        item.condition = [item.condition];
    } else if (!Array.isArray(item.condition)) {
        item.condition = [];
    }
  });


  // 초기 로드 시 아티팩트 목록 렌더링 및 슬롯 렌더링
  renderSlots(calculateSlots());
  generateTagFilters(); // 태그 필터 버튼 생성
  applyFilterAndRenderList(); // 초기 아이템 목록 렌더링 (필터링 적용)
}

loadData();
