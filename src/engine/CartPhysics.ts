// src/engine/CartPhysics.ts
import { Player, ItemType, CircuitThemeId, Seat } from '@/types/game';

export interface ControlInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  drift?: boolean;
}

export interface PhysicsConfig {
  maxSpeed: number;
  reverseMaxSpeed: number;
  acceleration: number;
  braking: number;
  friction: number;
  turnSpeed: number;
  cartWidth: number;
  cartHeight: number;
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  maxSpeed: 7.5,
  reverseMaxSpeed: -3.0,
  acceleration: 0.22,
  braking: 0.35,
  friction: 0.965,
  turnSpeed: 3.8,     // 도/frame
  cartWidth: 32,
  cartHeight: 52
};

export class CartPhysics {
  /**
   * 단일 프레임(약 16.6ms) 동안 플레이어의 물리 상태를 업데이트합니다.
   */
  static update(
    player: Player,
    input: ControlInput,
    themeId: CircuitThemeId,
    config: PhysicsConfig = DEFAULT_PHYSICS_CONFIG
  ): Player {
    if (player.isSeated) {
      // 이미 좌석에 착석한 카트는 정지 상태 유지
      return {
        ...player,
        speed: 0,
        vx: 0,
        vy: 0
      };
    }

    const now = Date.now();
    let currentMaxSpeed = config.maxSpeed;
    let friction = config.friction;

    // 테마별 노면 특성 반영
    if (themeId === 'ice') {
      friction = 0.985; // 빙판에서는 매우 미끄러움
    } else if (themeId === 'colosseum') {
      friction = 0.95;  // 모래사장은 저항이 좀 더 큼
    }

    // 활성 아이템 / 디버프 효과 확인
    let steerLeft = input.left;
    let steerRight = input.right;

    if (player.activeEffect && player.effectEndTime > now) {
      if (player.activeEffect === 'confuse') {
        // 좌우 반전
        steerLeft = input.right;
        steerRight = input.left;
      } else if (player.activeEffect === 'booster') {
        currentMaxSpeed *= 1.45;
      }
    } else if (player.activeEffect && player.effectEndTime <= now) {
      player.activeEffect = null;
    }

    // 1. 가속 및 감속 처리
    let speed = player.speed;

    if (input.forward) {
      speed += config.acceleration;
      if (speed > currentMaxSpeed) speed = currentMaxSpeed;
    } else if (input.backward) {
      if (speed > 0) {
        speed -= config.braking;
        if (speed < 0) speed = 0;
      } else {
        speed -= config.acceleration * 0.7;
        if (speed < config.reverseMaxSpeed) speed = config.reverseMaxSpeed;
      }
    } else {
      // 액셀을 떼면 자연 감속
      speed *= friction;
      if (Math.abs(speed) < 0.05) speed = 0;
    }

    // 2. 조향 (차가 움직이고 있을 때만 회전 가능)
    let angle = player.angle;
    if (Math.abs(speed) > 0.1) {
      const direction = speed > 0 ? 1 : -1; // 후진 시 조향 반전
      const turnAmount = config.turnSpeed * (Math.min(Math.abs(speed), 4.5) / 4.5);

      if (steerLeft) {
        angle -= turnAmount * direction;
      }
      if (steerRight) {
        angle += turnAmount * direction;
      }
    }

    // 각도를 0 ~ 360도로 정규화
    angle = (angle % 360 + 360) % 360;

    // 3. 각도에 따른 속도 벡터(vx, vy) 계산 (0도가 위쪽/북쪽 기준)
    // 수학적으로 0도가 북쪽이면: x = sin(rad), y = -cos(rad)
    const rad = (angle * Math.PI) / 180;
    const targetVx = Math.sin(rad) * speed;
    const targetVy = -Math.cos(rad) * speed;

    // 드리프트 느낌을 위해 이전 vx, vy와 부드럽게 보간 (노면 마찰에 따름)
    const driftFactor = themeId === 'ice' ? 0.08 : 0.22;
    const vx = player.vx * (1 - driftFactor) + targetVx * driftFactor;
    const vy = player.vy * (1 - driftFactor) + targetVy * driftFactor;

    // 4. 위치 갱신
    const x = player.x + vx;
    const y = player.y + vy;

    return {
      ...player,
      x,
      y,
      vx,
      vy,
      speed,
      angle,
      lastActive: now
    };
  }

  /**
   * 직사각형 장애물 또는 벽과의 충돌을 검사하고 반사 처리합니다.
   */
  static handleWallCollision(
    player: Player,
    wall: { x: number; y: number; width: number; height: number },
    cartRadius: number = 18
  ): Player {
    // 쉴드가 활성화되어 있다면 충돌 반사 완화
    const isShielded = player.activeEffect === 'shield' && player.effectEndTime > Date.now();

    // 원형 카트 vs 사각형 충돌 검사
    const closestX = Math.max(wall.x, Math.min(player.x, wall.x + wall.width));
    const closestY = Math.max(wall.y, Math.min(player.y, wall.y + wall.height));

    const distX = player.x - closestX;
    const distY = player.y - closestY;
    const distSquared = distX * distX + distY * distY;

    if (distSquared < cartRadius * cartRadius) {
      const distance = Math.sqrt(distSquared) || 0.01;
      const overlap = cartRadius - distance;

      // 밖으로 밀어내기
      const normalX = distX / distance;
      const normalY = distY / distance;

      let newX = player.x + normalX * overlap;
      let newY = player.y + normalY * overlap;

      // 충돌 반사 및 속도 감소
      const bounciness = isShielded ? 0.1 : 0.45;
      const speedDrop = isShielded ? 0.8 : 0.4;

      return {
        ...player,
        x: newX,
        y: newY,
        speed: player.speed * speedDrop,
        vx: normalX * Math.abs(player.speed) * bounciness,
        vy: normalY * Math.abs(player.speed) * bounciness,
        activeEffect: isShielded ? null : player.activeEffect // 쉴드 소모
      };
    }

    return player;
  }

  /**
   * 결승선 교실 좌석(아래가 열린 상자 모양) 진입 여부를 감지합니다.
   * 첫 번째로 도착한 자동차가 열려있는 곳의 선(입구 선)을 밟으면 즉시 감지됩니다.
   */
  static checkSeatEntry(
    player: Player,
    seat: Seat
  ): boolean {
    if (!seat.active || seat.occupiedBy !== null) return false;

    const halfW = seat.width / 2;
    const halfH = seat.height / 2;
    const entranceY = seat.y + halfH; // 상자의 열려있는 하단 입구 선

    // 1. 좌석 입구 가로 폭 내에 있는지 (약간의 여유 마진 10px 허용)
    const isWithinX = Math.abs(player.x - seat.x) <= halfW + 10;

    // 2. 카트의 앞범퍼나 바퀴가 하단 열린 입구 선을 밟았거나 살짝 넘어왔는지 검사
    const hasSteppedOnEntranceLine =
      player.y >= seat.y - 15 &&
      player.y <= entranceY + 26;

    return isWithinX && hasSteppedOnEntranceLine;
  }
}
