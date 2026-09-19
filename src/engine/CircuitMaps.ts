// src/engine/CircuitMaps.ts
import { CircuitMapData, CircuitThemeId, Obstacle, ItemBox } from '@/types/game';
import { THEMES } from '@/constants/themes';

/**
 * 트랙을 벗어날 수 없도록 양옆 가드레일이 완벽히 가이드하며,
 * 출발선 -> 메인 직선로 -> 헤어핀 코너 -> S자 슬라럼 -> 교실 진입로 -> 교실 좌석 구역으로
 * 물 흐르듯이 자연스럽게 연결되는 3200x2400 대형 서킷 맵 생성기입니다.
 */
export class CircuitMaps {
  static getMap(themeId: CircuitThemeId): CircuitMapData {
    const theme = THEMES[themeId] || THEMES.classic;
    const worldWidth = 3200;
    const worldHeight = 2400;

    // 1. 출발선 (남서쪽 트랙 내부)
    const startLine = {
      x: 180,
      y: 1950,
      width: 340,
      height: 60,
      angle: 0 // 북쪽을 바라보고 출발
    };

    // 2. 결승선 (교실 정문 입구)
    const finishLine = {
      x: 1980,
      y: 1250,
      width: 440,
      height: 60
    };

    // 3. 교실 좌석 구역 (우측 상단 넉넉한 공간)
    const classroomArea = {
      x: 1950,
      y: 160,
      width: 1150,
      height: 1050
    };

    // 4. 완벽한 트랙 밀폐 가드레일 (서킷 밖으로 절대 이탈 불가)
    const walls: Obstacle[] = [
      // === 맵 최외곽 방벽 ===
      { id: 'w_out_top', type: 'wall', x: 0, y: 0, width: worldWidth, height: 60, color: theme.wallColor },
      { id: 'w_out_bottom', type: 'wall', x: 0, y: worldHeight - 60, width: worldWidth, height: 60, color: theme.wallColor },
      { id: 'w_out_left', type: 'wall', x: 0, y: 0, width: 60, height: worldHeight, color: theme.wallColor },
      { id: 'w_out_right', type: 'wall', x: worldWidth - 60, y: 0, width: 60, height: worldHeight, color: theme.wallColor },

      // === 구간 1: 출발선 뒤쪽 차단벽 (뒤로 후진 불가) ===
      { id: 'w_start_back', type: 'wall', x: 60, y: 2080, width: 520, height: 60, color: theme.wallColor },

      // === 구간 1: 1차 직선로 우측 가드레일 (출발선 ~ 1번 코너) ===
      { id: 'w_trk_1_r', type: 'wall', x: 580, y: 480, width: 60, height: 1660, color: theme.wallColor },

      // === 구간 2: 1번 코너 (상단 우회전) 내측/외측 가드레일 ===
      // 외측은 w_out_top (y: 0~60), w_out_left (x: 0~60)
      // 상단 수평 트랙의 하단 가드레일
      { id: 'w_top_straight_bottom', type: 'wall', x: 580, y: 480, width: 1300, height: 60, color: theme.wallColor },

      // === 구간 3: 중앙 슬라럼 가벽들 (S자 코너링 유도) ===
      // 우측 코너에서 아래로 꺾이는 외측 벽
      { id: 'w_turn2_out', type: 'wall', x: 1900, y: 60, width: 60, height: 1100, color: theme.wallColor },
      // 중앙 지그재그 유도 벽 1
      { id: 'w_slalom_1', type: 'wall', x: 1050, y: 850, width: 550, height: 60, color: theme.wallColor },
      // 중앙 지그재그 유도 벽 2
      { id: 'w_slalom_2', type: 'wall', x: 1400, y: 1250, width: 560, height: 60, color: theme.wallColor },
      // 하단 턴 유도 벽
      { id: 'w_slalom_3', type: 'wall', x: 1050, y: 1650, width: 550, height: 60, color: theme.wallColor },

      // === 구간 4: 교실 진입로 (하단에서 북쪽 교실 문으로 직진) ===
      // 교실 진입로 좌측 가드레일
      { id: 'w_entry_left', type: 'wall', x: 1920, y: 1350, width: 60, height: 800, color: theme.wallColor },
      // 교실 진입로 우측 가드레일
      { id: 'w_entry_right', type: 'wall', x: 2450, y: 1350, width: 60, height: 800, color: theme.wallColor },
      // 진입로 하단 차단벽
      { id: 'w_entry_bottom', type: 'wall', x: 1920, y: 2150, width: 590, height: 60, color: theme.wallColor },

      // === 구간 5: 교실 영역 외벽 (교실은 정문 게이트로만 진입 가능) ===
      // 교실 좌측 벽 (정문 게이트 제외하고 밀폐)
      { id: 'w_class_left', type: 'wall', x: 1920, y: 60, width: 60, height: 1190, color: '#64748B' },
      // 교실 하단 벽 (좌측)
      { id: 'w_class_bot_left', type: 'wall', x: 1920, y: 1250, width: 60, height: 60, color: '#64748B' },
      // 교실 하단 벽 (우측 - 정문 입구 440px 열어둠)
      { id: 'w_class_bot_right', type: 'wall', x: 2420, y: 1250, width: 720, height: 60, color: '#64748B' }
    ];

    // 테마별 고유 장애물 배치 (트랙 중간 적재적소에 배치)
    const themeObstacles: Obstacle[] = [];
    if (themeId === 'classic') {
      themeObstacles.push(
        { id: 'oil_1', type: 'oil', x: 300, y: 1400, width: 100, height: 100, color: '#0F172A' },
        { id: 'oil_2', type: 'oil', x: 1100, y: 250, width: 110, height: 110, color: '#0F172A' },
        { id: 'rock_1', type: 'rock', x: 1650, y: 700, width: 80, height: 80, color: '#475569' },
        { id: 'oil_3', type: 'oil', x: 1250, y: 1450, width: 100, height: 100, color: '#0F172A' },
        { id: 'rock_2', type: 'rock', x: 2150, y: 1750, width: 85, height: 85, color: '#475569' }
      );
    } else if (themeId === 'classroom') {
      themeObstacles.push(
        { id: 'milk_1', type: 'oil', x: 300, y: 1350, width: 110, height: 110, color: '#F8FAFC' },
        { id: 'eraser_1', type: 'rock', x: 1050, y: 240, width: 130, height: 70, color: '#F43F5E' },
        { id: 'eraser_2', type: 'rock', x: 1680, y: 750, width: 130, height: 70, color: '#3B82F6' },
        { id: 'milk_2', type: 'oil', x: 1300, y: 1450, width: 120, height: 120, color: '#F8FAFC' },
        { id: 'eraser_3', type: 'rock', x: 2150, y: 1750, width: 130, height: 70, color: '#10B981' }
      );
    } else if (themeId === 'space') {
      themeObstacles.push(
        { id: 'warp_1', type: 'speed_pad', x: 300, y: 1250, width: 100, height: 140, color: '#06B6D4' },
        { id: 'asteroid_1', type: 'rock', x: 1150, y: 240, width: 90, height: 90, color: '#4C1D95' },
        { id: 'warp_2', type: 'speed_pad', x: 1650, y: 1050, width: 100, height: 140, color: '#06B6D4' },
        { id: 'asteroid_2', type: 'rock', x: 1250, y: 1450, width: 90, height: 90, color: '#4C1D95' },
        { id: 'warp_3', type: 'speed_pad', x: 2150, y: 1700, width: 100, height: 140, color: '#06B6D4' }
      );
    } else if (themeId === 'ice') {
      themeObstacles.push(
        { id: 'ice_1', type: 'ice_patch', x: 260, y: 1250, width: 180, height: 180, color: '#E0F2FE' },
        { id: 'snow_1', type: 'rock', x: 1150, y: 240, width: 90, height: 90, color: '#FFFFFF' },
        { id: 'ice_2', type: 'ice_patch', x: 1550, y: 1000, width: 190, height: 190, color: '#E0F2FE' },
        { id: 'snow_2', type: 'rock', x: 1250, y: 1450, width: 90, height: 90, color: '#FFFFFF' },
        { id: 'ice_3', type: 'ice_patch', x: 2100, y: 1650, width: 180, height: 180, color: '#E0F2FE' }
      );
    } else if (themeId === 'colosseum') {
      themeObstacles.push(
        { id: 'fire_1', type: 'oil', x: 300, y: 1300, width: 120, height: 120, color: '#EA580C' },
        { id: 'pillar_1', type: 'rock', x: 1150, y: 240, width: 90, height: 90, color: '#FEF08A' },
        { id: 'fire_2', type: 'oil', x: 1650, y: 950, width: 120, height: 120, color: '#EA580C' },
        { id: 'pillar_2', type: 'rock', x: 1250, y: 1450, width: 90, height: 90, color: '#FEF08A' },
        { id: 'fire_3', type: 'oil', x: 2150, y: 1700, width: 120, height: 120, color: '#EA580C' }
      );
    } else if (themeId === 'europe') {
      themeObstacles.push(
        { id: 'fountain_1', type: 'rock', x: 300, y: 1300, width: 110, height: 110, color: '#38BDF8' },
        { id: 'cafe_1', type: 'wall', x: 1150, y: 240, width: 100, height: 90, color: '#713F12' },
        { id: 'fountain_2', type: 'rock', x: 1650, y: 950, width: 110, height: 110, color: '#38BDF8' },
        { id: 'cafe_2', type: 'wall', x: 1250, y: 1450, width: 90, height: 90, color: '#713F12' },
        { id: 'fountain_3', type: 'rock', x: 2150, y: 1700, width: 110, height: 110, color: '#38BDF8' }
      );
    }

    // 아이템 상자 (? 박스) 배치
    const itemBoxes: ItemBox[] = [
      { id: 'ib_1', x: 350, y: 1650, size: 38, isAvailable: true, respawnTimer: 0 },
      { id: 'ib_2', x: 350, y: 900, size: 38, isAvailable: true, respawnTimer: 0 },
      { id: 'ib_3', x: 1000, y: 270, size: 38, isAvailable: true, respawnTimer: 0 },
      { id: 'ib_4', x: 1550, y: 270, size: 38, isAvailable: true, respawnTimer: 0 },
      { id: 'ib_5', x: 1750, y: 650, size: 38, isAvailable: true, respawnTimer: 0 },
      { id: 'ib_6', x: 1250, y: 1050, size: 38, isAvailable: true, respawnTimer: 0 },
      { id: 'ib_7', x: 1750, y: 1450, size: 38, isAvailable: true, respawnTimer: 0 },
      { id: 'ib_8', x: 2200, y: 1900, size: 38, isAvailable: true, respawnTimer: 0 },
      { id: 'ib_9', x: 2200, y: 1450, size: 38, isAvailable: true, respawnTimer: 0 }
    ];

    return {
      id: themeId,
      name: theme.name,
      description: theme.description,
      worldWidth,
      worldHeight,
      bgColors: {
        primary: theme.bgColor,
        secondary: '#0F172A',
        track: theme.trackColor,
        curb1: theme.curbColor1,
        curb2: theme.curbColor2,
        wall: theme.wallColor
      },
      startLine,
      finishLine,
      classroomArea,
      trackPolygons: [],
      walls,
      obstacles: themeObstacles,
      itemBoxes
    };
  }
}
