// src/lib/syncBridge.ts
import { GameRoom, Player, SeatConfig, RoomStatus, SeatDuel } from '@/types/game';
import { db, isFirebaseConfigured } from './firebase';
import { 
  ref, 
  set, 
  onValue, 
  update, 
  runTransaction, 
  get,
  Unsubscribe 
} from 'firebase/database';

export type ClaimSeatResult = 
  | { type: 'success'; seatId: string }
  | { type: 'duel'; duel: SeatDuel }
  | { type: 'rejected'; seatId: string };

/**
 * Firebase Realtime Database 또는 브라우저 탭 간 BroadcastChannel을 통해 
 * 렉 없이 방 상태, 플레이어 좌표, 좌석 선점을 동기화하는 통합 브리지입니다.
 */
export class SyncBridge {
  private static localRooms: Record<string, GameRoom> = {};
  private static localChannels: Record<string, BroadcastChannel> = {};

  /**
   * 새 방을 생성하고 등록합니다.
   */
  static async createRoom(room: GameRoom): Promise<void> {
    if (isFirebaseConfigured && db) {
      console.log(`[SyncBridge] Creating room in Firebase: rooms/${room.code}`);
      try {
        await set(ref(db, `rooms/${room.code}`), room);
        console.log(`[SyncBridge] Room created successfully in Firebase: ${room.code}`);
      } catch (err) {
        console.error(`[SyncBridge] Error creating room in Firebase:`, err);
      }
    } else {
      this.localRooms[room.code] = room;
      if (typeof window !== 'undefined') {
        localStorage.setItem(`room_${room.code}`, JSON.stringify(room));
        const bc = this.getChannel(room.code);
        bc.postMessage({ type: 'ROOM_UPDATE', room });
      }
    }
  }

  /**
   * 방 상태 실시간 구독
   */
  static subscribeRoom(roomCode: string, onUpdate: (room: GameRoom | null) => void): () => void {
    if (isFirebaseConfigured && db) {
      console.log(`[SyncBridge] Subscribing to Firebase rooms/${roomCode}`);
      const roomRef = ref(db, `rooms/${roomCode}`);
      const unsub: Unsubscribe = onValue(
        roomRef,
        (snapshot) => {
          const val = snapshot.val();
          console.log(`[SyncBridge] Firebase rooms/${roomCode} snapshot:`, val);
          onUpdate(val ? (val as GameRoom) : null);
        },
        (error) => {
          console.error(`[SyncBridge] Firebase onValue Error on room ${roomCode}:`, error);
        }
      );
      return () => unsub();
    } else {
      // Local BroadcastChannel 모드
      const loadLocal = () => {
        if (typeof window === 'undefined') return;
        const stored = localStorage.getItem(`room_${roomCode}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            this.localRooms[roomCode] = parsed;
            onUpdate(parsed);
          } catch {
            onUpdate(null);
          }
        } else if (this.localRooms[roomCode]) {
          onUpdate(this.localRooms[roomCode]);
        } else {
          onUpdate(null);
        }
      };

      loadLocal();

      const bc = this.getChannel(roomCode);
      const handler = (e: MessageEvent) => {
        if (e.data?.type === 'ROOM_UPDATE' && e.data.room?.code === roomCode) {
          this.localRooms[roomCode] = e.data.room;
          if (typeof window !== 'undefined') {
            localStorage.setItem(`room_${roomCode}`, JSON.stringify(e.data.room));
          }
          onUpdate(e.data.room);
        }
      };

      bc.addEventListener('message', handler);
      return () => {
        bc.removeEventListener('message', handler);
      };
    }
  }

  /**
   * 학생 카트 위치 및 물리 상태 업데이트 (10~15Hz Throttled)
   */
  static async updatePlayerPosition(
    roomCode: string,
    player: Player
  ): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        await update(ref(db, `rooms/${roomCode}/players/${player.id}`), {
          x: Math.round(player.x * 10) / 10,
          y: Math.round(player.y * 10) / 10,
          angle: Math.round(player.angle),
          speed: Math.round(player.speed * 10) / 10,
          vx: Math.round(player.vx * 10) / 10,
          vy: Math.round(player.vy * 10) / 10,
          activeEffect: player.activeEffect ?? null,
          effectEndTime: player.effectEndTime ?? 0,
          isSeated: player.isSeated ?? false,
          seatedId: player.seatedId ?? null,
          teleportedAt: player.teleportedAt ?? null,
          lastActive: Date.now()
        });
      } catch (err) {
        console.error('[SyncBridge] Error updating player position:', err);
      }
    } else {
      const room = this.getLocalRoom(roomCode);
      if (room && room.players) {
        room.players[player.id] = { ...player };
        this.saveLocalRoom(room);
      }
    }
  }

  /**
   * 학생 입장 등록
   */
  static async joinPlayer(roomCode: string, player: Player): Promise<void> {
    if (isFirebaseConfigured && db) {
      console.log(`[SyncBridge] Joining player ${player.id} to rooms/${roomCode}`);
      try {
        await set(ref(db, `rooms/${roomCode}/players/${player.id}`), player);
        console.log(`[SyncBridge] Player joined successfully: ${player.name}`);
      } catch (err) {
        console.error(`[SyncBridge] Error joining player to Firebase:`, err);
      }
    } else {
      const room = this.getLocalRoom(roomCode);
      if (room) {
        if (!room.players) room.players = {};
        room.players[player.id] = player;
        this.saveLocalRoom(room);
      }
    }
  }

  /**
   * 게임 상태 변경 (COUNTDOWN, RACING, FINISHED 등)
   */
  static async updateRoomStatus(roomCode: string, status: RoomStatus, countdown: number = 3): Promise<void> {
    if (isFirebaseConfigured && db) {
      const payload: Record<string, unknown> = {
        status,
        countdown
      };
      if (status === 'RACING') {
        payload.startedAt = Date.now();
      }
      if (status === 'FINISHED') {
        payload.finishedAt = Date.now();
      }

      try {
        await update(ref(db, `rooms/${roomCode}`), payload);
        console.log(`[SyncBridge] Room ${roomCode} status updated to ${status}`);
      } catch (err) {
        console.error(`[SyncBridge] Error updating room status:`, err);
      }
    } else {
      const room = this.getLocalRoom(roomCode);
      if (room) {
        room.status = status;
        room.countdown = countdown;
        if (status === 'RACING') room.startedAt = Date.now();
        if (status === 'FINISHED') room.finishedAt = Date.now();
        this.saveLocalRoom(room);
      }
    }
  }

  /**
   * 원자적 좌석 선점 (Atomic Transaction) & 동시 진입 시 주사위 대결(Dice Duel) 발동
   */
  static async claimSeat(
    roomCode: string,
    seatId: string,
    player: Player
  ): Promise<ClaimSeatResult> {
    if (isFirebaseConfigured && db) {
      let duelCreated: SeatDuel | null = null;
      const seatRef = ref(db, `rooms/${roomCode}/seatConfig/seats/${seatId}`);
      const result = await runTransaction(seatRef, (currentSeat) => {
        if (!currentSeat) return currentSeat;
        const now = Date.now();

        // 1. 빈 좌석 정상 선점
        if (!Boolean(currentSeat.occupiedBy)) {
          currentSeat.occupiedBy = player.id;
          currentSeat.studentName = player.name;
          currentSeat.studentNumber = player.number;
          currentSeat.characterId = player.characterId;
          currentSeat.claimTime = now;
          currentSeat.underDuel = false;
          return currentSeat;
        }

        // 본인이 이미 정상 점유 중
        if (currentSeat.occupiedBy === player.id) {
          return currentSeat;
        }

        // 2. 다른 플레이어가 점유 중이나, 3초 이내에 동시 진입한 경우 (주사위 대결 발동!)
        const elapsed = now - (currentSeat.claimTime || 0);
        if (elapsed < 3000 && !currentSeat.underDuel) {
          currentSeat.underDuel = true;

          // 공정한 1~6 주사위 추첨 (무승부 방지)
          let roll1 = Math.floor(Math.random() * 6) + 1;
          let roll2 = Math.floor(Math.random() * 6) + 1;
          while (roll1 === roll2) {
            roll2 = Math.floor(Math.random() * 6) + 1;
          }

          const p1 = {
            id: currentSeat.occupiedBy || player.id,
            name: currentSeat.studentName || '선수 1',
            number: currentSeat.studentNumber || 1,
            characterId: currentSeat.characterId || 'speed_racer',
            roll: roll1
          };
          const p2 = {
            id: player.id,
            name: player.name,
            number: player.number,
            characterId: player.characterId,
            roll: roll2
          };

          const winner = roll1 > roll2 ? p1 : p2;
          const loser = roll1 > roll2 ? p2 : p1;

          const seatRow = typeof currentSeat.row === 'number' ? currentSeat.row + 1 : 1;
          const seatCol = typeof currentSeat.col === 'number' ? currentSeat.col + 1 : 1;
          const seatName = `${seatRow}분단 ${seatCol}열 자리`;

          duelCreated = {
            id: `duel_${seatId}_${now}`,
            seatId,
            seatName,
            player1: p1,
            player2: p2,
            winnerId: winner.id,
            loserId: loser.id,
            status: 'rolling',
            createdAt: now
          };

          // 승자 정보로 좌석 확정
          currentSeat.occupiedBy = winner.id;
          currentSeat.studentName = winner.name;
          currentSeat.studentNumber = winner.number;
          currentSeat.characterId = winner.characterId;
          currentSeat.claimTime = now;
          return currentSeat;
        }

        // 3. 이미 3초 이상 경과하여 완전히 선점된 좌석 -> 거절
        return;
      });

      if (duelCreated) {
        const duel = duelCreated as SeatDuel;
        // 방 전체에 활성 대결 전송 (학생 및 교사 화면 중계)
        await set(ref(db, `rooms/${roomCode}/activeDuel`), duel);
        // 승자 플레이어 정보 갱신
        await update(ref(db, `rooms/${roomCode}/players/${duel.winnerId}`), {
          isSeated: true,
          seatedId: seatId,
          seatTime: Date.now()
        });
        // 패자 플레이어 정보 미착석 상태로 확실히 초기화
        await update(ref(db, `rooms/${roomCode}/players/${duel.loserId}`), {
          isSeated: false,
          seatedId: null
        });

        // 5초 후 activeDuel 자동 정리 (대결 완료 후 안전장치)
        setTimeout(() => {
          this.clearActiveDuel(roomCode);
        }, 5000);

        return { type: 'duel', duel };
      }

      if (result.committed) {
        await update(ref(db, `rooms/${roomCode}/players/${player.id}`), {
          isSeated: true,
          seatedId: seatId,
          seatTime: Date.now(),
          x: Math.round(player.x * 10) / 10,
          y: Math.round(player.y * 10) / 10,
          angle: 0,
          speed: 0,
          vx: 0,
          vy: 0
        });
        return { type: 'success', seatId };
      }

      return { type: 'rejected', seatId };
    } else {
      // 로컬 원자적 판정
      const room = this.getLocalRoom(roomCode);
      if (room && room.seatConfig?.seats?.[seatId]) {
        const seat = room.seatConfig.seats[seatId];
        const now = Date.now();

        if (!Boolean(seat.occupiedBy)) {
          seat.occupiedBy = player.id;
          seat.studentName = player.name;
          seat.studentNumber = player.number;
          seat.characterId = player.characterId;
          seat.claimTime = now;
          seat.underDuel = false;

          if (room.players?.[player.id]) {
            room.players[player.id].isSeated = true;
            room.players[player.id].seatedId = seatId;
            room.players[player.id].seatTime = now;
            room.players[player.id].angle = 0;
            room.players[player.id].speed = 0;
            room.players[player.id].vx = 0;
            room.players[player.id].vy = 0;
          }

          this.saveLocalRoom(room);
          return { type: 'success', seatId };
        } else if (seat.occupiedBy !== player.id) {
          const elapsed = now - (seat.claimTime || 0);
          if (elapsed < 3000 && !seat.underDuel) {
            seat.underDuel = true;
            let roll1 = Math.floor(Math.random() * 6) + 1;
            let roll2 = Math.floor(Math.random() * 6) + 1;
            while (roll1 === roll2) roll2 = Math.floor(Math.random() * 6) + 1;

            const p1 = {
              id: seat.occupiedBy || player.id,
              name: seat.studentName || '선수 1',
              number: seat.studentNumber || 1,
              characterId: seat.characterId || 'speed_racer',
              roll: roll1
            };
            const p2 = {
              id: player.id,
              name: player.name,
              number: player.number,
              characterId: player.characterId,
              roll: roll2
            };

            const winner = roll1 > roll2 ? p1 : p2;
            const loser = roll1 > roll2 ? p2 : p1;

            const seatRow = typeof seat.row === 'number' ? seat.row + 1 : 1;
            const seatCol = typeof seat.col === 'number' ? seat.col + 1 : 1;
            const seatName = `${seatRow}분단 ${seatCol}열 자리`;

            const duel: SeatDuel = {
              id: `duel_${seatId}_${now}`,
              seatId,
              seatName,
              player1: p1,
              player2: p2,
              winnerId: winner.id,
              loserId: loser.id,
              status: 'rolling',
              createdAt: now
            };

            seat.occupiedBy = winner.id;
            seat.studentName = winner.name;
            seat.studentNumber = winner.number;
            seat.characterId = winner.characterId;
            seat.claimTime = now;

            room.activeDuel = duel;
            if (room.players?.[winner.id]) {
              room.players[winner.id].isSeated = true;
              room.players[winner.id].seatedId = seatId;
            }
            if (room.players?.[loser.id]) {
              room.players[loser.id].isSeated = false;
              room.players[loser.id].seatedId = null;
            }

            this.saveLocalRoom(room);

            // 5초 후 activeDuel 자동 정리
            setTimeout(() => {
              this.clearActiveDuel(roomCode);
            }, 5000);

            return { type: 'duel', duel };
          }
        }
      }
      return { type: 'rejected', seatId };
    }
  }

  /**
   * 패배자 또는 퇴장 플레이어 좌석 해제
   */
  static async releasePlayerFromSeat(roomCode: string, playerId: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await update(ref(db, `rooms/${roomCode}/players/${playerId}`), {
        isSeated: false,
        seatedId: null
      });
    } else {
      const room = this.getLocalRoom(roomCode);
      if (room?.players?.[playerId]) {
        room.players[playerId].isSeated = false;
        room.players[playerId].seatedId = null;
        this.saveLocalRoom(room);
      }
    }
  }

  /**
   * 주사위 대결 완료 후 activeDuel 정리
   */
  static async clearActiveDuel(roomCode: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await set(ref(db, `rooms/${roomCode}/activeDuel`), null);
    } else {
      const room = this.getLocalRoom(roomCode);
      if (room) {
        room.activeDuel = null;
        this.saveLocalRoom(room);
      }
    }
  }

  /**
   * 좌석 배치 및 플레이어 일괄 업데이트 (교사 비상 종료 등)
   */
  static async updateSeatsAndPlayers(
    roomCode: string,
    seats: SeatConfig,
    players: Record<string, Player>
  ): Promise<void> {
    if (isFirebaseConfigured && db) {
      await update(ref(db, `rooms/${roomCode}`), {
        seatConfig: seats,
        players,
        status: 'FINISHED',
        finishedAt: Date.now()
      });
    } else {
      const room = this.getLocalRoom(roomCode);
      if (room) {
        room.seatConfig = seats;
        room.players = players;
        room.status = 'FINISHED';
        room.finishedAt = Date.now();
        this.saveLocalRoom(room);
      }
    }
  }

  /**
   * 두 플레이어의 위치를 맞교환하고 텔레포트 타임스탬프를 부여합니다.
   */
  static async teleportPlayers(
    roomCode: string,
    p1: Player,
    p2: Player,
    p1NewPos: { x: number; y: number },
    p2NewPos: { x: number; y: number }
  ): Promise<void> {
    const now = Date.now();
    if (isFirebaseConfigured && db) {
      try {
        const updates: Record<string, any> = {};
        updates[`rooms/${roomCode}/players/${p1.id}/x`] = Math.round(p1NewPos.x * 10) / 10;
        updates[`rooms/${roomCode}/players/${p1.id}/y`] = Math.round(p1NewPos.y * 10) / 10;
        updates[`rooms/${roomCode}/players/${p1.id}/speed`] = 0;
        updates[`rooms/${roomCode}/players/${p1.id}/vx`] = 0;
        updates[`rooms/${roomCode}/players/${p1.id}/vy`] = 0;
        updates[`rooms/${roomCode}/players/${p1.id}/teleportedAt`] = now;
        updates[`rooms/${roomCode}/players/${p1.id}/lastActive`] = now;

        updates[`rooms/${roomCode}/players/${p2.id}/x`] = Math.round(p2NewPos.x * 10) / 10;
        updates[`rooms/${roomCode}/players/${p2.id}/y`] = Math.round(p2NewPos.y * 10) / 10;
        updates[`rooms/${roomCode}/players/${p2.id}/speed`] = 0;
        updates[`rooms/${roomCode}/players/${p2.id}/vx`] = 0;
        updates[`rooms/${roomCode}/players/${p2.id}/vy`] = 0;
        updates[`rooms/${roomCode}/players/${p2.id}/teleportedAt`] = now;
        updates[`rooms/${roomCode}/players/${p2.id}/lastActive`] = now;

        await update(ref(db), updates);
      } catch (err) {
        console.error('[SyncBridge] Error in teleportPlayers:', err);
      }
    } else {
      const room = this.getLocalRoom(roomCode);
      if (room && room.players) {
        if (room.players[p1.id]) {
          room.players[p1.id].x = p1NewPos.x;
          room.players[p1.id].y = p1NewPos.y;
          room.players[p1.id].speed = 0;
          room.players[p1.id].vx = 0;
          room.players[p1.id].vy = 0;
          room.players[p1.id].teleportedAt = now;
        }
        if (room.players[p2.id]) {
          room.players[p2.id].x = p2NewPos.x;
          room.players[p2.id].y = p2NewPos.y;
          room.players[p2.id].speed = 0;
          room.players[p2.id].vx = 0;
          room.players[p2.id].vy = 0;
          room.players[p2.id].teleportedAt = now;
        }
        this.saveLocalRoom(room);
      }
    }
  }

  /**
   * 교사용: 결과 화면에서 학생의 위치를 강제로 이동하거나 맞교환(Swap)합니다.
   * - 빈 좌석으로 이동 시: 이전 좌석은 비우고 대상 좌석에 배정
   * - 다른 학생이 이미 있는 좌석으로 이동 시: 두 학생의 좌석을 서로 교환(Swap)
   * - 중복 배치되어 있던 학생의 경우: 해당 학생만 분리 이동
   */
  static async moveOrSwapSeat(
    roomCode: string,
    source: { playerId: string; seatId?: string | null },
    targetSeatId: string
  ): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const roomSnapshot = await get(ref(db, `rooms/${roomCode}`));
        if (!roomSnapshot.exists()) return;
        const roomData = roomSnapshot.val() as GameRoom;
        const seats = roomData.seatConfig?.seats;
        const players = roomData.players;
        if (!seats || !players) return;

        const sourcePlayer = players[source.playerId];
        const targetSeat = seats[targetSeatId];
        if (!sourcePlayer || !targetSeat) return;

        const updates: Record<string, any> = {};
        const targetOccupantId = targetSeat.occupiedBy;
        const targetPlayer = targetOccupantId && players[targetOccupantId] ? players[targetOccupantId] : null;

        if (targetPlayer && targetPlayer.id !== sourcePlayer.id) {
          // 대상 좌석에 다른 학생이 이미 있음 -> Swap 또는 교체
          if (source.seatId && source.seatId !== targetSeatId) {
            // 맞교환 (Swap)
            updates[`rooms/${roomCode}/seatConfig/seats/${source.seatId}/occupiedBy`] = targetPlayer.id;
            updates[`rooms/${roomCode}/seatConfig/seats/${source.seatId}/studentName`] = targetPlayer.name;
            updates[`rooms/${roomCode}/seatConfig/seats/${source.seatId}/studentNumber`] = targetPlayer.number;
            updates[`rooms/${roomCode}/seatConfig/seats/${source.seatId}/characterId`] = targetPlayer.characterId;

            updates[`rooms/${roomCode}/players/${targetPlayer.id}/seatedId`] = source.seatId;
            updates[`rooms/${roomCode}/players/${targetPlayer.id}/isSeated`] = true;
          } else {
            // source 좌석이 없었던 경우: 기존 학생은 미배치 상태로 변경
            updates[`rooms/${roomCode}/players/${targetPlayer.id}/seatedId`] = null;
            updates[`rooms/${roomCode}/players/${targetPlayer.id}/isSeated`] = false;
          }
        } else {
          // 대상 좌석이 비어있음 -> 이전 좌석 정리
          if (source.seatId && source.seatId !== targetSeatId) {
            // 이전 좌석에 혹시 다른 학생이 겹쳐 있었는지 확인
            const otherInSource = Object.values(players).find(
              p => p.id !== sourcePlayer.id && p.seatedId === source.seatId
            );
            if (otherInSource) {
              // 겹쳐있던 다른 학생 정보로 좌석 정상화
              updates[`rooms/${roomCode}/seatConfig/seats/${source.seatId}/occupiedBy`] = otherInSource.id;
              updates[`rooms/${roomCode}/seatConfig/seats/${source.seatId}/studentName`] = otherInSource.name;
              updates[`rooms/${roomCode}/seatConfig/seats/${source.seatId}/studentNumber`] = otherInSource.number;
              updates[`rooms/${roomCode}/seatConfig/seats/${source.seatId}/characterId`] = otherInSource.characterId;
            } else {
              // 완전한 빈 좌석으로 리셋
              updates[`rooms/${roomCode}/seatConfig/seats/${source.seatId}/occupiedBy`] = null;
              updates[`rooms/${roomCode}/seatConfig/seats/${source.seatId}/studentName`] = null;
              updates[`rooms/${roomCode}/seatConfig/seats/${source.seatId}/studentNumber`] = null;
              updates[`rooms/${roomCode}/seatConfig/seats/${source.seatId}/characterId`] = null;
            }
          }
        }

        // 대상 좌석에 sourcePlayer 배정
        updates[`rooms/${roomCode}/seatConfig/seats/${targetSeatId}/occupiedBy`] = sourcePlayer.id;
        updates[`rooms/${roomCode}/seatConfig/seats/${targetSeatId}/studentName`] = sourcePlayer.name;
        updates[`rooms/${roomCode}/seatConfig/seats/${targetSeatId}/studentNumber`] = sourcePlayer.number;
        updates[`rooms/${roomCode}/seatConfig/seats/${targetSeatId}/characterId`] = sourcePlayer.characterId;

        updates[`rooms/${roomCode}/players/${sourcePlayer.id}/seatedId`] = targetSeatId;
        updates[`rooms/${roomCode}/players/${sourcePlayer.id}/isSeated`] = true;

        await update(ref(db), updates);
      } catch (err) {
        console.error('[SyncBridge] Error in moveOrSwapSeat:', err);
      }
    } else {
      // 로컬 스토리지 기반
      const room = this.getLocalRoom(roomCode);
      if (room && room.seatConfig?.seats && room.players) {
        const seats = room.seatConfig.seats;
        const players = room.players;
        const sourcePlayer = players[source.playerId];
        const targetSeat = seats[targetSeatId];
        if (!sourcePlayer || !targetSeat) return;

        const targetOccupantId = targetSeat.occupiedBy;
        const targetPlayer = targetOccupantId && players[targetOccupantId] ? players[targetOccupantId] : null;

        if (targetPlayer && targetPlayer.id !== sourcePlayer.id) {
          if (source.seatId && source.seatId !== targetSeatId && seats[source.seatId]) {
            // 맞교환 (Swap)
            const sSeat = seats[source.seatId];
            sSeat.occupiedBy = targetPlayer.id;
            sSeat.studentName = targetPlayer.name;
            sSeat.studentNumber = targetPlayer.number;
            sSeat.characterId = targetPlayer.characterId;

            targetPlayer.seatedId = source.seatId;
            targetPlayer.isSeated = true;
          } else {
            targetPlayer.seatedId = null;
            targetPlayer.isSeated = false;
          }
        } else {
          if (source.seatId && source.seatId !== targetSeatId && seats[source.seatId]) {
            const sSeat = seats[source.seatId];
            const otherInSource = Object.values(players).find(
              p => p.id !== sourcePlayer.id && p.seatedId === source.seatId
            );
            if (otherInSource) {
              sSeat.occupiedBy = otherInSource.id;
              sSeat.studentName = otherInSource.name;
              sSeat.studentNumber = otherInSource.number;
              sSeat.characterId = otherInSource.characterId;
            } else {
              sSeat.occupiedBy = null;
              sSeat.studentName = null;
              sSeat.studentNumber = null;
              sSeat.characterId = null;
            }
          }
        }

        // 대상 좌석에 sourcePlayer 배정
        targetSeat.occupiedBy = sourcePlayer.id;
        targetSeat.studentName = sourcePlayer.name;
        targetSeat.studentNumber = sourcePlayer.number;
        targetSeat.characterId = sourcePlayer.characterId;

        sourcePlayer.seatedId = targetSeatId;
        sourcePlayer.isSeated = true;

        this.saveLocalRoom(room);
      }
    }
  }

  // --- 헬퍼 메서드 ---
  private static getChannel(roomCode: string): BroadcastChannel {
    if (!this.localChannels[roomCode]) {
      this.localChannels[roomCode] = new BroadcastChannel(`racing_room_${roomCode}`);
    }
    return this.localChannels[roomCode];
  }

  private static getLocalRoom(roomCode: string): GameRoom | null {
    if (this.localRooms[roomCode]) return this.localRooms[roomCode];
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem(`room_${roomCode}`);
      if (s) {
        try {
          this.localRooms[roomCode] = JSON.parse(s);
          return this.localRooms[roomCode];
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  private static saveLocalRoom(room: GameRoom) {
    this.localRooms[room.code] = room;
    if (typeof window !== 'undefined') {
      localStorage.setItem(`room_${room.code}`, JSON.stringify(room));
      const bc = this.getChannel(room.code);
      bc.postMessage({ type: 'ROOM_UPDATE', room });
    }
  }
}
