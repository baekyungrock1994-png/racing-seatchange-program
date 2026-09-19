// src/engine/AIBotManager.ts
import { Player, CharacterId, CircuitThemeId, CircuitMapData, SeatConfig, Seat, ItemType } from '@/types/game';
import { CHARACTERS } from '@/constants/characters';
import { CartPhysics } from './CartPhysics';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export interface AIBotState {
  player: Player;
  targetWaypointIdx: number;
  laneOffsetX: number;
  laneOffsetY: number;
  targetSeatId: string | null;
  difficulty: BotDifficulty;
  baseSpeed: number;
  turnRate: number;
}

const BOT_NAMES = [
  '⚡ 번개 라이더',
  '🌪️ 질주 요정',
  '🚀 터보 드리프터',
  '🏎️ 스피드 마스터',
  '🔥 네온 레이서',
  '🏁 포뮬러 챔프',
  '❄️ 눈꽃 썰매왕'
];

const BOT_CHARACTERS: CharacterId[] = [
  'speed_racer',
  'cosmo_rider',
  'winter_penguin',
  'gladiator',
  'pencil_scholar'
];

export class AIBotManager {
  /**
   * 연습방에 참여할 AI 봇들을 생성합니다.
   */
  static createBots(
    count: number,
    difficulty: BotDifficulty,
    map: CircuitMapData
  ): AIBotState[] {
    const sl = map.startLine;
    const bots: AIBotState[] = [];

    const difficultyConfig = {
      easy: { speed: 3.1, turn: 3.8 },
      normal: { speed: 3.65, turn: 4.8 },
      hard: { speed: 4.05, turn: 5.8 }
    }[difficulty];

    for (let i = 0; i < count; i++) {
      const charId = BOT_CHARACTERS[i % BOT_CHARACTERS.length];
      const botId = `bot_${i + 1}_${Math.random().toString(36).substring(2, 6)}`;
      const botName = BOT_NAMES[i % BOT_NAMES.length];
      const botNumber = i + 2; // 학생이 보통 1번을 쓰므로 2번부터 부여

      // 3차선 폭(200px) 내부 출발선에 격자 배치
      const laneCol = i % 3;
      const laneRow = Math.floor(i / 3);
      const startX = sl.x + 30 + laneCol * 55;
      const startY = sl.y + 40 + laneRow * 45;

      const player: Player = {
        id: botId,
        name: botName,
        number: botNumber,
        characterId: charId,
        color: CHARACTERS[charId].themeColor,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        angle: sl.angle || 0,
        speed: 0,
        isSeated: false,
        seatedId: null,
        activeEffect: null,
        effectEndTime: 0,
        lastActive: Date.now()
      };

      bots.push({
        player,
        targetWaypointIdx: 1, // 출발선 이후 1번 타일 향해 출발
        laneOffsetX: (Math.random() - 0.5) * 60, // -30 ~ +30px 차선 분산
        laneOffsetY: (Math.random() - 0.5) * 40,
        targetSeatId: null,
        difficulty,
        baseSpeed: difficultyConfig.speed + (Math.random() - 0.5) * 0.2,
        turnRate: difficultyConfig.turn
      });
    }

    return bots;
  }

  /**
   * 트랙 셀 데이터를 바탕으로 주행 웨이포인트 목록을 생성합니다.
   */
  static getWaypoints(map: CircuitMapData): Array<{ x: number; y: number }> {
    const cs = map.cellSize || 200;
    const waypoints: Array<{ x: number; y: number }> = [];

    // 1. 서킷 트랙 셀 중심점들
    (map.trackCells || []).forEach((c) => {
      waypoints.push({
        x: c.col * cs + cs / 2,
        y: c.row * cs + cs / 2
      });
    });

    // 2. 교실 정문 진입점 및 교실 내부 진입점 추가
    const ca = map.classroomArea;
    waypoints.push({
      x: 11 * cs + cs / 2,
      y: ca.y + ca.height - 30
    });
    waypoints.push({
      x: ca.x + ca.width / 2,
      y: ca.y + ca.height - 120
    });

    return waypoints;
  }

  /**
   * 60FPS 프레임마다 모든 AI 봇의 주행, 물리 충돌, 좌석 진입을 업데이트합니다.
   */
  static updateBots(
    botStates: AIBotState[],
    map: CircuitMapData,
    seatConfig: SeatConfig,
    onBotClaimSeat: (seatId: string, bot: Player) => void,
    now: Date = new Date()
  ): Player[] {
    const waypoints = this.getWaypoints(map);
    const updatedPlayers: Player[] = [];

    botStates.forEach((bot) => {
      let p = { ...bot.player };

      // 이미 자리에 안착한 봇은 정지 상태 유지
      if (p.isSeated) {
        updatedPlayers.push(p);
        return;
      }

      // 1. 현재 목표 지점(Target Point) 결정
      let targetX = 0;
      let targetY = 0;
      const isApproachingClassroom = bot.targetWaypointIdx >= waypoints.length - 1;

      if (!isApproachingClassroom) {
        // 서킷 주행 모드: 웨이포인트 추종
        const wp = waypoints[bot.targetWaypointIdx];
        targetX = wp.x + bot.laneOffsetX;
        targetY = wp.y + bot.laneOffsetY;

        const distToWp = Math.hypot(p.x - targetX, p.y - targetY);
        if (distToWp < 100) {
          bot.targetWaypointIdx = Math.min(bot.targetWaypointIdx + 1, waypoints.length - 1);
        }
      } else {
        // 교실 내부 모드: 빈 좌석 탐색 및 도킹
        if (!bot.targetSeatId || !seatConfig.seats[bot.targetSeatId] || Boolean(seatConfig.seats[bot.targetSeatId].occupiedBy)) {
          // 비어있는 유효 좌석 탐색 (봇마다 고유 좌석 선택 유도)
          const emptySeats = Object.values(seatConfig.seats).filter(
            s => s.active && !Boolean(s.occupiedBy)
          );
          if (emptySeats.length > 0) {
            // 봇 번호에 따라 분산 선택
            const chosen = emptySeats[bot.player.number % emptySeats.length] || emptySeats[0];
            bot.targetSeatId = chosen.id;
          }
        }

        const seat = bot.targetSeatId ? seatConfig.seats[bot.targetSeatId] : null;
        if (seat) {
          const entranceY = seat.y + seat.height / 2 + 25;
          const distToEntrance = Math.hypot(p.x - seat.x, p.y - entranceY);

          if (distToEntrance > 35 && p.y > entranceY) {
            // 입구 아래쪽 접근 지점으로 먼저 이동
            targetX = seat.x;
            targetY = entranceY;
          } else {
            // 입구를 통해 위쪽(북쪽) 책상 중심을 향해 직진 진입
            targetX = seat.x;
            targetY = seat.y;
          }

          // 좌석 입구 선 밟기 검사
          if (!Boolean(seat.occupiedBy) && CartPhysics.checkSeatEntry(p, seat)) {
            p.isSeated = true;
            p.seatedId = seat.id;
            p.x = seat.x;
            p.y = seat.y;
            p.angle = 0;
            p.speed = 0;
            p.vx = 0;
            p.vy = 0;
            bot.player = p;
            onBotClaimSeat(seat.id, p);
            updatedPlayers.push(p);
            return;
          }
        } else {
          // 잔여 좌석이 없을 때 교실 중앙 대기
          targetX = map.classroomArea.x + map.classroomArea.width / 2;
          targetY = map.classroomArea.y + map.classroomArea.height / 2;
        }
      }

      // 2. 조향(Steering) 및 주행 속도 연산
      const targetAngle = ((Math.atan2(targetX - p.x, -(targetY - p.y)) * (180 / Math.PI)) + 360) % 360;
      let angleDiff = ((targetAngle - p.angle + 540) % 360) - 180;

      // 부드러운 회전 조향
      const turnAmount = Math.max(-bot.turnRate, Math.min(bot.turnRate, angleDiff));
      p.angle = (p.angle + turnAmount + 360) % 360;

      // 부스터 효과 여부
      const isBoosted = p.activeEffect === 'booster' && p.effectEndTime > Date.now();
      const currentSpeed = isBoosted ? bot.baseSpeed * 1.45 : bot.baseSpeed;

      const rad = (p.angle * Math.PI) / 180;
      p.vx = Math.sin(rad) * currentSpeed;
      p.vy = -Math.cos(rad) * currentSpeed;
      p.speed = currentSpeed;
      p.x += p.vx;
      p.y += p.vy;

      // 3. 벽 및 장애물 충돌 검사
      map.walls.forEach((wall) => {
        p = CartPhysics.handleWallCollision(p, wall);
      });
      map.obstacles.forEach((obs) => {
        if (obs.type === 'wall' || obs.type === 'rock') {
          p = CartPhysics.handleWallCollision(p, obs);
        }
      });

      // 4. 교실 책상 물리 벽 충돌 검사
      if (!p.isSeated && seatConfig?.seats) {
        const dThick = 8;
        for (const s of Object.values(seatConfig.seats)) {
          if (!s.active) continue;
          const sLeft = s.x - s.width / 2;
          const sRight = s.x + s.width / 2;
          const sTop = s.y - s.height / 2;
          const sBot = s.y + s.height / 2;
          const isOcc = Boolean(s.occupiedBy);

          // 위쪽, 왼쪽, 오른쪽 벽 막힘
          p = CartPhysics.handleWallCollision(p, { x: sLeft - dThick, y: sTop - dThick, width: s.width + dThick * 2, height: dThick });
          p = CartPhysics.handleWallCollision(p, { x: sLeft - dThick, y: sTop, width: dThick, height: s.height });
          p = CartPhysics.handleWallCollision(p, { x: sRight, y: sTop, width: dThick, height: s.height });
          if (isOcc) {
            // 점유된 자리는 아래쪽도 막힘
            p = CartPhysics.handleWallCollision(p, { x: sLeft - dThick, y: sBot, width: s.width + dThick * 2, height: dThick });
          }
        }
      }

      // 5. 아이템 상자 상호작용 (봇도 랜덤 아이템 획득 및 부스터 자동 사용)
      map.itemBoxes.forEach((box) => {
        if (box.isAvailable && Math.hypot(p.x - box.x, p.y - box.y) < box.size + 18) {
          box.isAvailable = false;
          box.respawnTimer = Date.now() + 12000;
          const items: ItemType[] = ['booster', 'shield', 'confuse'];
          const chosen = items[Math.floor(Math.random() * items.length)];
          p.activeEffect = chosen;
          p.effectEndTime = Date.now() + 2500;
        }
      });

      // 월드 경계 클램핑
      p.x = Math.max(30, Math.min(map.worldWidth - 30, p.x));
      p.y = Math.max(30, Math.min(map.worldHeight - 30, p.y));

      bot.player = p;
      updatedPlayers.push(p);
    });

    return updatedPlayers;
  }
}
