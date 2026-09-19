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
  maxSpeed: 3.8,      // 너무 빠르지 않고 안정적인 순항 속도
  reverseMaxSpeed: -2.2,
  acceleration: 1.2,
  braking: 0.8,
  friction: 0.88,
  turnSpeed: 4.0,     // 쾌적하고 정확한 코너링 조향
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
    // 부스터 아이템 사용 시 일시적 가속, 평상시에는 일정한 정속(3.8) 주행
    let cruiseSpeed = config.maxSpeed;

    // 활성 아이템 / 디버프 효과 확인
    let steerLeft = input.left;
    let steerRight = input.right;

    if (player.activeEffect && player.effectEndTime > now) {
      if (player.activeEffect === 'confuse') {
        // 좌우 반전
        steerLeft = input.right;
        steerRight = input.left;
      } else if (player.activeEffect === 'booster') {
        cruiseSpeed = 5.5; // 부스터 순간 순항 속도
      }
    } else if (player.activeEffect && player.effectEndTime <= now) {
      player.activeEffect = null;
    }

    // 1. 일정한 정속 주행 (가속이 끝없이 붙지 않고 키를 누르면 바로 동일한 편안한 속도로 주행)
    let speed = player.speed;

    if (input.forward) {
      speed = cruiseSpeed; // 가속도 누적 없이 일정한 편안한 속도 유지
    } else if (input.backward) {
      speed = config.reverseMaxSpeed;
    } else {
      // 액셀을 떼면 부드럽고 빠르게 정지
      speed *= config.friction;
      if (Math.abs(speed) < 0.1) speed = 0;
    }

    // 2. 조향 (차가 움직이고 있을 때 회전)
    let angle = player.angle;
    if (Math.abs(speed) > 0.05) {
      const direction = speed > 0 ? 1 : -1; // 후진 시 조향 반전
      const turnAmount = config.turnSpeed;

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
    const rad = (angle * Math.PI) / 180;
    const targetVx = Math.sin(rad) * speed;
    const targetVy = -Math.cos(rad) * speed;

    // 빙판에서는 약간의 슬라이딩, 일반 서킷에서는 즉각 반응
    const driftFactor = themeId === 'ice' ? 0.15 : 0.45;
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
   * 직사각형 장애물 또는 벽과의 충돌을 검사하고 완벽하게 반사 밀어내기 처리합니다.
   * 터널링(벽 뚫기 및 갇힘) 현상을 원천 방지합니다.
   */
  static handleWallCollision(
    player: Player,
    wall: { x: number; y: number; width: number; height: number },
    cartRadius: number = 18
  ): Player {
    const isShielded = player.activeEffect === 'shield' && player.effectEndTime > Date.now();

    // 벽 사각형 상에서 플레이어 중심과 가장 가까운 지점 계산
    const closestX = Math.max(wall.x, Math.min(player.x, wall.x + wall.width));
    const closestY = Math.max(wall.y, Math.min(player.y, wall.y + wall.height));

    const distX = player.x - closestX;
    const distY = player.y - closestY;
    const distSquared = distX * distX + distY * distY;

    if (distSquared < cartRadius * cartRadius) {
      let normalX = 0;
      let normalY = 0;
      let overlap = 0;

      if (distX === 0 && distY === 0) {
        // [터널링 복구] 카트 중심이 이미 벽 내부에 진입한 경우: 가장 가까운 바깥 모서리로 강제 탈출
        const dLeft = player.x - wall.x;
        const dRight = (wall.x + wall.width) - player.x;
        const dTop = player.y - wall.y;
        const dBottom = (wall.y + wall.height) - player.y;
        const minD = Math.min(dLeft, dRight, dTop, dBottom);

        if (minD === dLeft) { normalX = -1; overlap = dLeft + cartRadius + 2; }
        else if (minD === dRight) { normalX = 1; overlap = dRight + cartRadius + 2; }
        else if (minD === dTop) { normalY = -1; overlap = dTop + cartRadius + 2; }
        else { normalY = 1; overlap = dBottom + cartRadius + 2; }
      } else {
        const distance = Math.sqrt(distSquared) || 0.01;
        overlap = cartRadius - distance + 1;
        normalX = distX / distance;
        normalY = distY / distance;
      }

      // 안전하게 벽 바깥으로 카트 좌표 이동
      const newX = player.x + normalX * overlap;
      const newY = player.y + normalY * overlap;

      // 충돌 반사
      const bounciness = 0.2;
      return {
        ...player,
        x: newX,
        y: newY,
        speed: Math.max(0, player.speed * 0.4),
        vx: normalX * Math.abs(player.speed) * bounciness,
        vy: normalY * Math.abs(player.speed) * bounciness,
        activeEffect: isShielded ? null : player.activeEffect
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
    // 점유된 좌석은 Boolean()으로 확실하게 제외
    if (!seat.active || Boolean(seat.occupiedBy)) return false;

    const halfW = seat.width / 2;
    const halfH = seat.height / 2;
    const entranceY = seat.y + halfH; // 상자의 열려있는 하단 입구 선

    // 1. 좌석 입구 가로 폭 내에 있는지
    const isWithinX = Math.abs(player.x - seat.x) <= halfW + 12;

    // 2. 카트의 앞범퍼나 바퀴가 하단 열린 입구 선을 밟았거나 살짝 넘어왔는지 검사
    const hasSteppedOnEntranceLine =
      player.y >= seat.y - 15 &&
      player.y <= entranceY + 28;

    return isWithinX && hasSteppedOnEntranceLine;
  }
}
