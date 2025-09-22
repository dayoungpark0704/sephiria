import json
import random
import copy
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- 1. 설정 및 데이터 로딩 ---

app = Flask(__name__)
CORS(app) 

RARITY_WEIGHTS = {
    "Common": 1.0, "UnCommon": 1.2, "Rare": 1.5, "Legendary": 2.5
}

try:
    with open('artifacts.json', 'r', encoding='utf-8') as f:
        artifact_db = {item['id']: item for item in json.load(f)}
    with open('slates.json', 'r', encoding='utf-8') as f:
        slate_db = {item['id']: item for item in json.load(f)}
except FileNotFoundError:
    print("오류: artifacts.json 또는 slates.json 파일을 찾을 수 없습니다.")
    artifact_db, slate_db = {}, {}

# --- 2. 핵심 함수: 점수 계산기 ---

def calculate_score(board, board_width, board_height):
    total_score = 0
    
    # 2-1. 석판 효과 맵 생성
    level_map = [[0 for _ in range(board_width)] for _ in range(board_height)]
    effect_map = [[None for _ in range(board_width)] for _ in range(board_height)]
    
    for y in range(board_height):
        for x in range(board_width):
            cell = board[y][x]
            if cell and cell['id'] in slate_db:
                slate_id, rotation = cell['id'], str(cell.get('rotation', 0))
                slate = slate_db[slate_id]
                
                condition = slate.get('condition')
                if condition == 'bottom_row' and y != board_height - 1: total_score -= 500; continue
                elif condition == 'top_row' and y != 0: total_score -= 500; continue
                elif condition == 'horizontal_ends' and not (x == 0 or x == board_width - 1): total_score -= 500; continue
                
                buffcoords_data = slate.get('buffcoords', [])
                buffcoords = buffcoords_data.get(rotation, []) if slate.get('rotatable') else buffcoords_data

                for buff in buffcoords:
                    eff_x, eff_y = x + buff[0], y - buff[1]
                    if 0 <= eff_y < board_height and 0 <= eff_x < board_width:
                        if buff[3] != "none":
                            effect_map[eff_y][eff_x] = buff[3]
                        level_map[eff_y][eff_x] += buff[2]

    # 2-2. 아티팩트 점수 계산
    for y in range(board_height):
        for x in range(board_width):
            cell = board[y][x]
            if cell and cell['id'] in artifact_db:
                artifact_id = cell['id']
                artifact = artifact_db[artifact_id]
                upgrade_level = cell.get('upgrade', 0)
                user_priority = cell.get('priority', 1.0)
                
                additional_level = upgrade_level * 1 
                artifact_level = level_map[y][x] + additional_level
                
                is_violated = False
                condition_obj = artifact.get('condition')
                
                # ★★★ 거대 망원경 보너스 점수 로직 ★★★
                if artifact_id == 'artifact_60':
                    planet_bonus = 0
                    surrounding_coords = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]
                    for dx, dy in surrounding_coords:
                        nx, ny = x + dx, y - dy
                        if 0 <= nx < board_width and 0 <= ny < board_height:
                            neighbor_cell = board[ny][nx]
                            if neighbor_cell and neighbor_cell['id'] in artifact_db:
                                if "행성" in artifact_db[neighbor_cell['id']].get("tags", []):
                                    planet_bonus += 1000  # 주변 행성 하나당 +1000점 보너스
                    artifact_level += planet_bonus
                
                if isinstance(condition_obj, dict):
                    condition_type = condition_obj.get('type')
                    is_unlockable = condition_obj.get('unlockable', False)
                    is_unlocked_by_slate = (effect_map[y][x] == "limitUnlock")

                    if not (is_unlocked_by_slate and is_unlockable):
                        if condition_type == 'top_row' and y != 0: is_violated = True
                        elif condition_type == 'bottom_row' and y != board_height - 1: is_violated = True
                        elif condition_type == 'edge' and not (x == 0 or x == board_width - 1 or y == 0 or y == board_height - 1): is_violated = True
                        elif condition_type == 'inner' and (x == 0 or x == board_width - 1 or y == 0 or y == board_height - 1): is_violated = True
                        elif condition_type == 'adjacent_horizontal_empty':
                            if (x > 0 and board[y][x-1]) or (x < board_width - 1 and board[y][x+1]):
                                is_violated = True
                        elif condition_type == 'requires_grimoire_right':
                            is_violated = True
                            if x < board_width - 1 and board[y][x+1] and board[y][x+1]['id'] in artifact_db:
                                if "마법서" in artifact_db[board[y][x+1]['id']].get("tags", []):
                                    is_violated = False
                
                if is_violated:
                    artifact_level -= 1000

                if artifact_level >= 0:
                    rarity = artifact.get('rarity', 'Common')
                    weight = RARITY_WEIGHTS.get(rarity, 1.0)
                    total_score += (artifact_level * weight * user_priority)
                    
    return total_score

# --- 3. 최적 배치 탐색기 ---
def find_optimal_placement(items_with_settings, board_width, board_height, iterations=20000):
    current_board = [[None for _ in range(board_width)] for _ in range(board_height)]
    empty_cells = [(y, x) for y in range(board_height) for x in range(board_width)]
    random.shuffle(empty_cells)
    
    placed_items_coords = []
    for i, item_data in enumerate(items_with_settings):
        if i < len(empty_cells):
            y, x = empty_cells[i]
            item_data['rotation'] = 0
            current_board[y][x] = item_data
            placed_items_coords.append((y,x))

    current_score = calculate_score(current_board, board_width, board_height)

    for _ in range(iterations):
        temp_board = copy.deepcopy(current_board)
        action = random.choice([0, 0, 0, 1])
        
        if action == 0 and len(placed_items_coords) >= 2:
            y1, x1 = random.choice(placed_items_coords)
            y2, x2 = random.choice(placed_items_coords)
            temp_board[y1][x1], temp_board[y2][x2] = temp_board[y2][x2], temp_board[y1][x1]
        elif action == 1 and placed_items_coords:
            y, x = random.choice(placed_items_coords)
            cell = temp_board[y][x]
            if cell and cell['id'] in slate_db and slate_db[cell['id']].get('rotatable'):
                cell['rotation'] = random.choice([0, 90, 180, 270])

        new_score = calculate_score(temp_board, board_width, board_height)
        
        if new_score > current_score:
            current_board = temp_board
            current_score = new_score
            
    return current_board, current_score

# --- 4. API 엔드포인트 ---
@app.route('/optimize', methods=['POST'])
def optimize_placement_api():
    data = request.get_json()
    items_with_settings = data.get('items')
    board_width = data.get('width')
    board_height = data.get('height')
    
    if not all([items_with_settings, board_width, board_height]):
        return jsonify({"error": "필요한 데이터가 누락되었습니다."}), 400

    optimal_board, best_score = find_optimal_placement(items_with_settings, board_width, board_height)

    return jsonify({
        "board": optimal_board,
        "score": best_score
    })

# --- 5. 서버 실행 ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)