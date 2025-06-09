// optimizer.worker.js

// [ 여기에 algorithms.js 의 모든 코드를 그대로 복사하여 붙여넣으세요 ]
// isSlotAvailable, calculateSlotBuffs, calculateScore, findBestSolution 등...
// ... (이전 단계에서 제공한 algorithms.js 전체 코드)


// Web Worker의 메인 로직
self.onmessage = function(e) {
    console.log('Worker: 메시지 수신', e.data);
    const { allItemsToPlace, totalActiveSlots, maxSlots, timeout } = e.data; // 💡 timeout 변수 추가

    bestGrid = new Array(maxSlots).fill(null);
    maxScore = -1;
    maxPossibleScoreCache.clear();

    const calculateSlotsInWorker = () => totalActiveSlots;

    // =============== 💡 수정된 부분 시작 💡 ===============
    let calculationFinished = false;
    // 메인 스레드에서 받은 timeout 값으로 타임아웃 설정
    const timeoutId = setTimeout(() => {
        if (!calculationFinished) {
            console.log(`Worker: ${timeout/1000}초 시간 초과! 현재까지의 최선의 결과 전송.`);
            self.postMessage({ bestGrid, maxScore, timeout: true });
            self.close(); // Worker 강제 종료
        }
    }, timeout);
    // =============== 💡 수정된 부분 끝 💡 ===============

    findBestSolution(0, new Array(maxSlots).fill(null), allItemsToPlace, totalActiveSlots, isSlotAvailable, calculateSlotsInWorker, calculateScore);

    calculationFinished = true;
    clearTimeout(timeoutId);

    console.log('Worker: 계산 완료, 결과 전송', { bestGrid, maxScore });
    self.postMessage({ bestGrid, maxScore, timeout: false });
};