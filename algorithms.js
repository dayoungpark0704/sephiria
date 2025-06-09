// algorithms.js

/**
 * 그리드의 특정 슬롯이 아이템의 조건을 만족하는지 확인합니다.
 * @param {number} slotIndex - 확인할 슬롯의 인덱스.
 * @param {string} condition - 아이템의 조건 문자열.
 * @param {Array} currentGrid - 현재 그리드 상태를 나타내는 배열.
 * @param {function} calculateSlotsFunc - calculateSlots 함수 (인자로 전달받음).
 * @returns {boolean} 조건 충족 여부.
 */
function isSlotAvailable(slotIndex, condition, currentGrid, calculateSlotsFunc) {
    const row = Math.floor(slotIndex / 6);
    const col = slotIndex % 6;
    const totalRows = Math.ceil(calculateSlotsFunc() / 6);
    const totalCols = 6;

    switch (condition) {
        case "최상단": 
            return row === 0;
        case "최하단":
            const slotBelowIndex = slotIndex + 6;
            return slotBelowIndex >= calculateSlotsFunc();
        case "가장자리": 
            return row === 0 || row === totalRows - 1 || col === 0 || col === totalCols - 1;
        case "안쪽": 
            return row > 0 && row < totalRows - 1 && col > 0 && col < totalCols - 1;
        case "양쪽칸이 공백":
            const leftSlotIndex = slotIndex - 1;
            const rightSlotIndex = slotIndex + 1;
            const isLeftInBounds = (col > 0);
            const isRightInBounds = (col < totalCols - 1);
            const isLeftEmpty = !isLeftInBounds || currentGrid[leftSlotIndex] === null;
            const isRightEmpty = !isRightInBounds || currentGrid[rightSlotIndex] === null;
            return isLeftEmpty && isRightEmpty;
        default: 
            return true;
    }
}

/**
 * 그리드의 각 슬롯에 적용되는 추가 강화 수치를 계산합니다.
 * 석판의 buffcoords 정보를 활용하며, 석판의 회전 상태에 따라 버프 좌표를 변환합니다.
 * @param {Array} currentGridItemsState - 현재 그리드 아이템 상태 배열 (인자로 전달받음).
 * @param {number} maxSlotsConst - maxSlots 상수 (인자로 전달받음).
 * @param {function} calculateSlotsFunc - calculateSlots 함수 (인자로 전달받음).
 * @returns {number[]} 각 슬롯의 인덱스에 해당하는 추가 강화 수치 배열
 */
function calculateSlotBuffs(currentGridItemsState, maxSlotsConst, calculateSlotsFunc) {
    const slotBuffs = new Array(maxSlotsConst).fill(0);

    currentGridItemsState.forEach((itemInstance, slotIndex) => {
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

                const currentActiveSlotsCount = calculateSlotsFunc();
                if (targetIndex >= 0 && targetIndex < currentActiveSlotsCount &&
                    targetRow >= 0 && targetRow < Math.ceil(currentActiveSlotsCount / 6) &&
                    targetCol >= 0 && targetCol < 6) {

                    let buffValue = 0;
                    
                    if (buff.type) {
                        if (buff.type === 'edge' && isSlotAvailable(targetIndex, '가장자리', currentGridItemsState, calculateSlotsFunc)) {
                            buffValue = !isNaN(parseInt(buff.value)) ? parseInt(buff.value) : 0;
                        } 
                        else if (buff.type === 'downside' && isSlotAvailable(targetIndex, '최하단', currentGridItemsState, calculateSlotsFunc)) {
                            buffValue = !isNaN(parseInt(buff.value)) ? parseInt(buff.value) : 0;
                        }
                    } 
                    else if (buff.value !== undefined) {
                        if (buff.value === "limitUnlock") {
                            buffValue = 1;
                        } else if (!isNaN(parseInt(buff.value))) {
                            buffValue = parseInt(buff.value);
                        }
                    }

                    slotBuffs[targetIndex] += buffValue;
                }
            });
        }
    });
    return slotBuffs;
}

/**
 * 백트래킹을 사용하여 아이템을 그리드에 최적으로 배치하는 함수.
 * @param {number} itemIndex - 현재 배치할 아이템의 allItemsToPlace 배열 내 인덱스.
 * @param {Array} currentGridState - 현재까지의 그리드 배치 상태 (임시 배열).
 * @param {Array} allItemsToPlace - 배치해야 할 모든 아이템 (정렬된 상태).
 * @param {number} totalActiveSlots - 현재 활성화된 총 슬롯 수.
 * @param {function} isSlotAvailableFunc - isSlotAvailable 함수 (인자로 전달받음).
 * @param {function} calculateSlotsFunc - calculateSlots 함수 (인자로 전달받음).
 * @returns {boolean} 모든 아이템을 성공적으로 배치했으면 true, 아니면 false.
 */
function findSolution(itemIndex, currentGridState, allItemsToPlace, totalActiveSlots, isSlotAvailableFunc, calculateSlotsFunc) {
    if (itemIndex === allItemsToPlace.length) {
        return true;
    }

    const currentItemInstance = allItemsToPlace[itemIndex];
    const itemCondition = currentItemInstance.condition && Array.isArray(currentItemInstance.condition) && currentItemInstance.condition.length > 0 ? currentItemInstance.condition[0] : '';

    for (let slotCandidateIndex = 0; slotCandidateIndex < totalActiveSlots; slotCandidateIndex++) {
        if (currentGridState[slotCandidateIndex] === null &&
            isSlotAvailableFunc(slotCandidateIndex, itemCondition, currentGridState, calculateSlotsFunc)) {

            currentGridState[slotCandidateIndex] = currentItemInstance;

            if (currentItemInstance.id.startsWith('slate_') && currentItemInstance.rotatable) {
                const originalRotation = currentItemInstance.rotation;
                for (let rot = 0; rot < 360; rot += 90) {
                    currentItemInstance.rotation = rot;
                    if (findSolution(itemIndex + 1, currentGridState, allItemsToPlace, totalActiveSlots, isSlotAvailableFunc, calculateSlotsFunc)) {
                        return true;
                    }
                }
                currentItemInstance.rotation = originalRotation;
            } else {
                if (findSolution(itemIndex + 1, currentGridState, allItemsToPlace, totalActiveSlots, isSlotAvailableFunc, calculateSlotsFunc)) {
                    return true;
                }
            }
            currentGridState[slotCandidateIndex] = null;
        }
    }
    return false;
}

/**
 * 특정 아이템을 배치할 수 있는 빈 슬롯의 개수를 계산합니다.
 * @param {object} item - 계산할 아이템 객체.
 * @param {Array} currentGrid - 현재 그리드 상태 (임시 배열).
 * @param {number} totalActiveSlots - 현재 활성화된 총 슬롯 수.
 * @param {function} isSlotAvailableFunc - isSlotAvailable 함수 (인자로 전달받음).
 * @param {function} calculateSlotsFunc - calculateSlots 함수 (인자로 전달받음).
 * @returns {number} 배치 가능한 슬롯의 개수.
 */
function getNumberOfAvailableSlots(item, currentGrid, totalActiveSlots, isSlotAvailableFunc, calculateSlotsFunc) {
    let count = 0;
    const itemCondition = item.condition && Array.isArray(item.condition) && item.condition.length > 0 ? item.condition[0] : '';

    for (let i = 0; i < totalActiveSlots; i++) {
        if (currentGrid[i] === null && isSlotAvailableFunc(i, itemCondition, currentGrid, calculateSlotsFunc)) {
            count++;
        }
    }
    return count;
}