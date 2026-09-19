// src/engine/SeatManager.ts
import { Seat, SeatConfig, Player } from '@/types/game';

export class SeatManager {
  /**
   * 교사가 설정한 행, 열, 활성화 상태에 따라 교실 구역(classroomArea) 내에 좌석 물리 좌표를 생성합니다.
   */
  static generateSeats(
    rows: number,
    cols: number,
    activeGrid: boolean[][],
    classroomArea: { x: number; y: number; width: number; height: number }
  ): SeatConfig {
    const seats: Record<string, Seat> = {};

    // 칠판 및 입구 여백
    const paddingX = 80;
    const paddingTop = 160; // 칠판/교탁 영역을 위한 상단 여유
    const paddingBottom = 90;
    const availableWidth = classroomArea.width - paddingX * 2;
    const availableHeight = classroomArea.height - (paddingTop + paddingBottom);

    const slotWidth = availableWidth / cols;
    const slotHeight = availableHeight / rows;

    // 카트 폭(32px) 기준 2대(64px) 이상이 넉넉하게 교행할 수 있는 통로 폭(최소 105px) 보장
    const seatWidth = Math.min(74, Math.max(56, slotWidth - 105));
    const seatHeight = Math.min(68, Math.max(52, slotHeight - 100));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = `seat_${r}_${c}`;
        const isActive = activeGrid[r]?.[c] ?? true;

        const centerX = classroomArea.x + paddingX + c * slotWidth + slotWidth / 2;
        const centerY = classroomArea.y + paddingTop + r * slotHeight + slotHeight / 2;

        seats[id] = {
          id,
          row: r,
          col: c,
          active: isActive,
          occupiedBy: null,
          studentName: null,
          studentNumber: null,
          characterId: null,
          x: centerX,
          y: centerY,
          width: seatWidth,
          height: seatHeight,
          openSide: 'bottom' // 아래쪽이 열린 상자 모양 구조
        };
      }
    }

    return {
      rows,
      cols,
      seats
    };
  }

  /**
   * 카트가 좌석의 열려있는 하단 입구 선을 밟았는지 검사합니다.
   * 입구 선에 닿으면 즉시 착석 성공을 반환합니다.
   */
  static tryOccupySeat(
    seat: Seat,
    player: Player
  ): { success: boolean; updatedSeat?: Seat } {
    if (!seat.active || seat.occupiedBy !== null) {
      return { success: false };
    }

    const halfW = seat.width / 2;
    const halfH = seat.height / 2;
    const entranceY = seat.y + halfH; // 하단 개방 입구 선의 y좌표

    // 1. 좌우가 열린 입구 폭 안에 위치하는지 (약간의 자석 유도 마진 포함)
    const isWithinX = Math.abs(player.x - seat.x) <= halfW + 8;

    // 2. 카트의 앞부분이나 중심이 하단 입구 선을 밟았거나 살짝 넘어왔는지 감지
    // 카트 높이(52px)의 앞범퍼가 입구 선을 밟는 순간(y = entranceY + 25 ~ seat.y) 즉시 감지
    const hasSteppedOnLine = 
      player.y >= seat.y - 10 && 
      player.y <= entranceY + 25;

    if (isWithinX && hasSteppedOnLine) {
      const updatedSeat: Seat = {
        ...seat,
        occupiedBy: player.id,
        studentName: player.name,
        studentNumber: player.number,
        characterId: player.characterId
      };
      return { success: true, updatedSeat };
    }

    return { success: false };
  }

  /**
   * [교사 비상 권한] 아직 착석하지 못한 학생들을 남은 빈 좌석에 무작위로 자동 배치합니다.
   */
  static forceRandomAssignment(
    seatConfig: SeatConfig,
    players: Record<string, Player>
  ): { updatedSeats: Record<string, Seat>; updatedPlayers: Record<string, Player> } {
    const updatedSeats = { ...seatConfig.seats };
    const updatedPlayers = { ...players };

    // 1. 남은 빈 활성 좌석 ID 목록 추출
    const emptySeatIds = Object.keys(updatedSeats).filter(
      id => updatedSeats[id].active && updatedSeats[id].occupiedBy === null
    );

    // 2. 아직 착석하지 못한 학생 ID 목록 추출
    const unseatedPlayerIds = Object.keys(updatedPlayers).filter(
      id => !updatedPlayers[id].isSeated
    );

    // 셔플 알고리즘 (Fisher-Yates)
    for (let i = emptySeatIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [emptySeatIds[i], emptySeatIds[j]] = [emptySeatIds[j], emptySeatIds[i]];
    }

    // 3. 1:1 매칭 배정
    unseatedPlayerIds.forEach((playerId, index) => {
      if (index < emptySeatIds.length) {
        const seatId = emptySeatIds[index];
        const player = updatedPlayers[playerId];
        const seat = updatedSeats[seatId];

        // 좌석 정보 갱신
        updatedSeats[seatId] = {
          ...seat,
          occupiedBy: playerId,
          studentName: player.name,
          studentNumber: player.number,
          characterId: player.characterId
        };

        // 플레이어 정보 갱신 (좌석 중심 좌표로 순간이동 안착)
        updatedPlayers[playerId] = {
          ...player,
          isSeated: true,
          seatedId: seatId,
          x: seat.x,
          y: seat.y,
          speed: 0,
          vx: 0,
          vy: 0,
          seatTime: Date.now()
        };
      }
    });

    return { updatedSeats, updatedPlayers };
  }
}
