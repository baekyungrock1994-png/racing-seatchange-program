// src/engine/CircuitMaps.ts
import { CircuitMapData, CircuitThemeId, Obstacle, ItemBox } from '@/types/game';
import { THEMES } from '@/constants/themes';

/**
 * [정밀 서킷 기하학 설계]
 * 1. 카트 3대가 나란히 주행할 수 있는 균일한 트랙 폭: 정확히 170px
 * 2. 출발선 -> 1번 코너 -> 2번 코너 -> S자 슬라럼 -> 결승선(FINISH) -> 교실로 단 하나의 막힘없는 경로
 * 3. 도로 바깥으로 절대 이탈할 수 없는 완벽한 좌우 밀폐 가드레일
 */
export class CircuitMaps {
  static getMap(themeId: CircuitThemeId): CircuitMapData {
    const theme = THEMES[themeId] || THEMES.classic;
    const worldWidth = 2400;
    const worldHeight = 1600;

    const TRACK_WIDTH = 170; // 카트 3대 폭 (34px * 3 + 간격)
    const WALL_THICK = 24;

    // 1. 출발선 (남서쪽 트랙 직선로)
    const startLine = {
      x: 200,
      y: 1250,
      width: TRACK_WIDTH,
      height: 40,
      angle: 0 // 북쪽을 바라보고 출발
    };

    // 2. 결승선 (트랙 끝 지점, 북쪽 교실 진입구)
    const finishLine = {
      x: 1430,
      y: 500,
      width: TRACK_WIDTH,
      height: 40
    };

    // 3. 교실 좌석 구역 (결승선 바로 위쪽)
    const classroomArea = {
      x: 1200,
      y: 50,
      width: 1000,
      height: 440
    };

    // 4. 단 하나의 단절 없는 트랙을 감싸는 완벽한 가드레일 벽들
    const walls: Obstacle[] = [
      // --- 트랙 구간 1: 출발선 및 서쪽 직선 주로 (x: 200 ~ 370, y: 370 ~ 1350) ---
      // 뒤쪽 막힘 벽 (출발선 뒤로 후진 불가)
      { id: 'w_start_back', type: 'wall', x: 200 - WALL_THICK, y: 1350, width: TRACK_WIDTH + WALL_THICK * 2, height: WALL_THICK, color: theme.wallColor },
      // 좌측 외벽 (출발선 ~ 1번 코너)
      { id: 'w_s1_left', type: 'wall', x: 200 - WALL_THICK, y: 200 - WALL_THICK, width: WALL_THICK, height: 1150 + WALL_THICK, color: theme.wallColor },
      // 우측 내측벽 (출발선 ~ 1번 코너 안쪽)
      { id: 'w_s1_right', type: 'wall', x: 200 + TRACK_WIDTH, y: 370, width: WALL_THICK, height: 980, color: theme.wallColor },

      // --- 트랙 구간 2: 1번 코너 및 상단 수평 주로 (x: 200 ~ 1000, y: 200 ~ 370) ---
      // 상단 외벽
      { id: 'w_s2_top', type: 'wall', x: 200 - WALL_THICK, y: 200 - WALL_THICK, width: 800 + TRACK_WIDTH + WALL_THICK * 2, height: WALL_THICK, color: theme.wallColor },
      // 하단 내측벽
      { id: 'w_s2_bottom', type: 'wall', x: 200 + TRACK_WIDTH, y: 200 + TRACK_WIDTH, width: 460, height: WALL_THICK, color: theme.wallColor },

      // --- 트랙 구간 3: 2번 코너 및 1차 하강 주로 (x: 830 ~ 1000, y: 370 ~ 900) ---
      // 우측 외벽
      { id: 'w_s3_right', type: 'wall', x: 1000, y: 200 - WALL_THICK, width: WALL_THICK, height: 700 + TRACK_WIDTH + WALL_THICK * 2, color: theme.wallColor },
      // 좌측 내측벽
      { id: 'w_s3_left', type: 'wall', x: 830 - WALL_THICK, y: 370, width: WALL_THICK, height: 530, color: theme.wallColor },

      // --- 트랙 구간 4: 3번 코너 및 중앙 수평 주로 (x: 830 ~ 1600, y: 900 ~ 1070) ---
      // 하단 외벽
      { id: 'w_s4_bottom', type: 'wall', x: 830 - WALL_THICK, y: 1070, width: 770 + WALL_THICK * 2, height: WALL_THICK, color: theme.wallColor },
      // 상단 내측벽
      { id: 'w_s4_top', type: 'wall', x: 1000, y: 900 - WALL_THICK, width: 430, height: WALL_THICK, color: theme.wallColor },

      // --- 트랙 구간 5: 4번 코너 및 교실 진입 상승 주로 (x: 1430 ~ 1600, y: 500 ~ 900) ---
      // 우측 외벽
      { id: 'w_s5_right', type: 'wall', x: 1600, y: 500, width: WALL_THICK, height: 570 + WALL_THICK, color: theme.wallColor },
      // 좌측 내측벽
      { id: 'w_s5_left', type: 'wall', x: 1430 - WALL_THICK, y: 500, width: WALL_THICK, height: 400 - WALL_THICK, color: theme.wallColor },

      // --- 교실 영역 외벽 (남쪽 입구 x: 1430 ~ 1600 만 뚫려 있음) ---
      // 교실 상단 벽
      { id: 'w_cls_top', type: 'wall', x: 1200 - WALL_THICK, y: 50 - WALL_THICK, width: 1000 + WALL_THICK * 2, height: WALL_THICK, color: '#64748B' },
      // 교실 좌측 벽
      { id: 'w_cls_left', type: 'wall', x: 1200 - WALL_THICK, y: 50 - WALL_THICK, width: WALL_THICK, height: 440 + WALL_THICK, color: '#64748B' },
      // 교실 우측 벽
      { id: 'w_cls_right', type: 'wall', x: 2200, y: 50 - WALL_THICK, width: WALL_THICK, height: 440 + WALL_THICK, color: '#64748B' },
      // 교실 하단 벽 (입구 좌측: x: 1200 ~ 1430)
      { id: 'w_cls_bot_l', type: 'wall', x: 1200 - WALL_THICK, y: 490, width: 230 + WALL_THICK, height: WALL_THICK, color: '#64748B' },
      // 교실 하단 벽 (입구 우측: x: 1600 ~ 2200)
      { id: 'w_cls_bot_r', type: 'wall', x: 1600, y: 490, width: 600 + WALL_THICK, height: WALL_THICK, color: '#64748B' }
    ];

    // 도로 중간 고유 테마 장애물 (카트 3대 폭 중 1대 분량만 차지하여 회피 가능)
    const obstacles: Obstacle[] = [];
    if (themeId === 'classic') {
      obstacles.push(
        { id: 'obs_1', type: 'oil', x: 270, y: 800, width: 60, height: 60, color: '#0F172A' },
        { id: 'obs_2', type: 'rock', x: 600, y: 260, width: 50, height: 50, color: '#475569' },
        { id: 'obs_3', type: 'oil', x: 890, y: 650, width: 60, height: 60, color: '#0F172A' },
        { id: 'obs_4', type: 'oil', x: 1250, y: 960, width: 60, height: 60, color: '#0F172A' },
        { id: 'obs_5', type: 'rock', x: 1490, y: 700, width: 50, height: 50, color: '#475569' }
      );
    } else if (themeId === 'classroom') {
      obstacles.push(
        { id: 'obs_1', type: 'oil', x: 260, y: 800, width: 70, height: 70, color: '#F8FAFC' }, // 우유
        { id: 'obs_2', type: 'rock', x: 600, y: 260, width: 65, height: 40, color: '#F43F5E' }, // 지우개
        { id: 'obs_3', type: 'oil', x: 890, y: 650, width: 70, height: 70, color: '#F8FAFC' },
        { id: 'obs_4', type: 'rock', x: 1250, y: 960, width: 65, height: 40, color: '#3B82F6' },
        { id: 'obs_5', type: 'oil', x: 1490, y: 700, width: 70, height: 70, color: '#F8FAFC' }
      );
    } else if (themeId === 'space') {
      obstacles.push(
        { id: 'obs_1', type: 'speed_pad', x: 260, y: 800, width: 55, height: 80, color: '#06B6D4' },
        { id: 'obs_2', type: 'rock', x: 600, y: 260, width: 50, height: 50, color: '#4C1D95' },
        { id: 'obs_3', type: 'speed_pad', x: 890, y: 650, width: 55, height: 80, color: '#06B6D4' },
        { id: 'obs_4', type: 'rock', x: 1250, y: 960, width: 50, height: 50, color: '#4C1D95' },
        { id: 'obs_5', type: 'speed_pad', x: 1490, y: 700, width: 55, height: 80, color: '#06B6D4' }
      );
    } else if (themeId === 'ice') {
      obstacles.push(
        { id: 'obs_1', type: 'ice_patch', x: 250, y: 800, width: 80, height: 80, color: '#E0F2FE' },
        { id: 'obs_2', type: 'rock', x: 600, y: 260, width: 50, height: 50, color: '#FFFFFF' },
        { id: 'obs_3', type: 'ice_patch', x: 880, y: 650, width: 80, height: 80, color: '#E0F2FE' },
        { id: 'obs_4', type: 'rock', x: 1250, y: 960, width: 50, height: 50, color: '#FFFFFF' },
        { id: 'obs_5', type: 'ice_patch', x: 1480, y: 700, width: 80, height: 80, color: '#E0F2FE' }
      );
    } else if (themeId === 'colosseum') {
      obstacles.push(
        { id: 'obs_1', type: 'oil', x: 260, y: 800, width: 65, height: 65, color: '#EA580C' },
        { id: 'obs_2', type: 'rock', x: 600, y: 260, width: 50, height: 50, color: '#FEF08A' },
        { id: 'obs_3', type: 'oil', x: 890, y: 650, width: 65, height: 65, color: '#EA580C' },
        { id: 'obs_4', type: 'rock', x: 1250, y: 960, width: 50, height: 50, color: '#FEF08A' },
        { id: 'obs_5', type: 'oil', x: 1490, y: 700, width: 65, height: 65, color: '#EA580C' }
      );
    } else if (themeId === 'europe') {
      obstacles.push(
        { id: 'obs_1', type: 'rock', x: 260, y: 800, width: 60, height: 60, color: '#38BDF8' },
        { id: 'obs_2', type: 'wall', x: 600, y: 260, width: 50, height: 50, color: '#713F12' },
        { id: 'obs_3', type: 'rock', x: 890, y: 650, width: 60, height: 60, color: '#38BDF8' },
        { id: 'obs_4', type: 'wall', x: 1250, y: 960, width: 50, height: 50, color: '#713F12' },
        { id: 'obs_5', type: 'rock', x: 1490, y: 700, width: 60, height: 60, color: '#38BDF8' }
      );
    }

    // 아이템 상자 (? 박스) 배치 - 트랙 정중앙에 균일하게 배치
    const itemBoxes: ItemBox[] = [
      { id: 'ib_1', x: 285, y: 1050, size: 34, isAvailable: true, respawnTimer: 0 },
      { id: 'ib_2', x: 285, y: 550, size: 34, isAvailable: true, respawnTimer: 0 },
      { id: 'ib_3', x: 500, y: 285, size: 34, isAvailable: true, respawnTimer: 0 },
      { id: 'ib_4', x: 750, y: 285, size: 34, isAvailable: true, respawnTimer: 0 },
      { id: 'ib_5', x: 915, y: 500, size: 34, isAvailable: true, respawnTimer: 0 },
      { id: 'ib_6', x: 915, y: 800, size: 34, isAvailable: true, respawnTimer: 0 },
      { id: 'ib_7', x: 1150, y: 985, size: 34, isAvailable: true, respawnTimer: 0 },
      { id: 'ib_8', x: 1400, y: 985, size: 34, isAvailable: true, respawnTimer: 0 },
      { id: 'ib_9', x: 1515, y: 750, size: 34, isAvailable: true, respawnTimer: 0 }
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
      obstacles,
      itemBoxes
    };
  }
}
