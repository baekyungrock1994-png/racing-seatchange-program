// src/engine/CameraSystem.ts

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  targetZoom: number;
}

export class CameraSystem {
  /**
   * 학생 화면: 플레이어 카트 위치를 부드럽게 추적합니다.
   */
  static updateStudentCamera(
    camera: CameraState,
    targetX: number,
    targetY: number,
    canvasWidth: number,
    canvasHeight: number,
    smoothing: number = 0.12
  ): CameraState {
    const desiredX = targetX - canvasWidth / 2;
    const desiredY = targetY - canvasHeight / 2;

    const x = camera.x + (desiredX - camera.x) * smoothing;
    const y = camera.y + (desiredY - camera.y) * smoothing;

    return {
      ...camera,
      x,
      y,
      zoom: 1.0,
      targetZoom: 1.0
    };
  }

  /**
   * 교사 화면: 전체 맵을 뷰포트에 맞추거나 마우스 휠 줌 및 패닝을 처리합니다.
   */
  static updateTeacherCamera(
    camera: CameraState,
    canvasWidth: number,
    canvasHeight: number,
    worldWidth: number,
    worldHeight: number
  ): CameraState {
    // 줌 레벨 스무딩 보간
    const zoom = camera.zoom + (camera.targetZoom - camera.zoom) * 0.15;

    // 만약 카메라가 초기 상태(0, 0)라면 전체 맵 중앙에 오도록 맞춤
    if (camera.x === 0 && camera.y === 0) {
      const fitZoomX = canvasWidth / worldWidth;
      const fitZoomY = canvasHeight / worldHeight;
      const fitZoom = Math.min(fitZoomX, fitZoomY) * 0.95;

      return {
        x: worldWidth / 2 - canvasWidth / (2 * fitZoom),
        y: worldHeight / 2 - canvasHeight / (2 * fitZoom),
        zoom: fitZoom,
        targetZoom: fitZoom
      };
    }

    return {
      ...camera,
      zoom
    };
  }

  /**
   * 학생 화면용 Fog of War (스포트라이트 시야) 마스크를 캔버스에 그립니다.
   */
  static applyFogOfWar(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    playerScreenX: number,
    playerScreenY: number,
    sightRadius: number = 280
  ) {
    ctx.save();

    // 1. 전체 화면을 칠흑의 어둠으로 덮기 전, 라디얼 그라데이션으로 시야 구멍 뚫기
    const gradient = ctx.createRadialGradient(
      playerScreenX,
      playerScreenY,
      sightRadius * 0.65,
      playerScreenX,
      playerScreenY,
      sightRadius
    );

    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.85, 'rgba(3, 7, 18, 0.85)');
    gradient.addColorStop(1, 'rgba(3, 7, 18, 0.98)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 시야 가장자리 빛무리 비네팅 효과 추가
    ctx.beginPath();
    ctx.arc(playerScreenX, playerScreenY, sightRadius, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.stroke();

    ctx.restore();
  }
}
