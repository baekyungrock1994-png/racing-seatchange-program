// src/lib/syncBridge.ts
import { GameRoom, Player, SeatConfig, RoomStatus, SeatDuel } from '@/types/game';
import { db, isFirebaseConfigured } from './firebase';
import { 
  ref, 
  set, 
  onValue, 
  update, 
  runTransaction, 
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
