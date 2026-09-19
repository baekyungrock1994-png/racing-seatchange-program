// src/lib/syncBridge.ts
import { GameRoom, Player, SeatConfig, RoomStatus } from '@/types/game';
import { db, isFirebaseConfigured } from './firebase';
import { 
  ref, 
  set, 
  onValue, 
  update, 
  runTransaction, 
  Unsubscribe 
} from 'firebase/database';

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
      await set(ref(db, `rooms/${room.code}`), room);
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
      const roomRef = ref(db, `rooms/${roomCode}`);
      const unsub: Unsubscribe = onValue(roomRef, (snapshot) => {
        const val = snapshot.val();
        onUpdate(val ? (val as GameRoom) : null);
      });
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
      await update(ref(db, `rooms/${roomCode}/players/${player.id}`), {
        x: Math.round(player.x * 10) / 10,
        y: Math.round(player.y * 10) / 10,
        angle: Math.round(player.angle),
        speed: Math.round(player.speed * 10) / 10,
        vx: Math.round(player.vx * 10) / 10,
        vy: Math.round(player.vy * 10) / 10,
        activeEffect: player.activeEffect,
        effectEndTime: player.effectEndTime,
        isSeated: player.isSeated,
        seatedId: player.seatedId,
        lastActive: Date.now()
      });
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
      await set(ref(db, `rooms/${roomCode}/players/${player.id}`), player);
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
      await update(ref(db, `rooms/${roomCode}`), {
        status,
        countdown,
        startedAt: status === 'RACING' ? Date.now() : undefined,
        finishedAt: status === 'FINISHED' ? Date.now() : undefined
      });
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
   * 원자적 좌석 선점 (Atomic Transaction)
   */
  static async claimSeat(
    roomCode: string,
    seatId: string,
    player: Player
  ): Promise<boolean> {
    if (isFirebaseConfigured && db) {
      const seatRef = ref(db, `rooms/${roomCode}/seatConfig/seats/${seatId}`);
      const result = await runTransaction(seatRef, (currentSeat) => {
        if (!currentSeat) return currentSeat;
        if (currentSeat.occupiedBy !== null) {
          // 이미 선점됨 -> 중단
          return;
        }
        currentSeat.occupiedBy = player.id;
        currentSeat.studentName = player.name;
        currentSeat.studentNumber = player.number;
        currentSeat.characterId = player.characterId;
        return currentSeat;
      });

      if (result.committed) {
        // 플레이어 상태도 갱신
        await update(ref(db, `rooms/${roomCode}/players/${player.id}`), {
          isSeated: true,
          seatedId: seatId,
          seatTime: Date.now()
        });
        return true;
      }
      return false;
    } else {
      // 로컬 원자적 판정
      const room = this.getLocalRoom(roomCode);
      if (room && room.seatConfig?.seats?.[seatId]) {
        const seat = room.seatConfig.seats[seatId];
        if (seat.occupiedBy === null) {
          seat.occupiedBy = player.id;
          seat.studentName = player.name;
          seat.studentNumber = player.number;
          seat.characterId = player.characterId;

          if (room.players?.[player.id]) {
            room.players[player.id].isSeated = true;
            room.players[player.id].seatedId = seatId;
            room.players[player.id].seatTime = Date.now();
          }

          this.saveLocalRoom(room);
          return true;
        }
      }
      return false;
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
