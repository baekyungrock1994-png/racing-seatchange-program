// src/engine/SoundSystem.ts

/**
 * 브라우저 Web Audio API 합성 엔진과 외부 MP3 오디오 파일 재생을 결합한 하이브리드 사운드 시스템입니다.
 * 
 * public/sounds/ 폴더에 mp3 파일이 있으면 해당 음원을 우선 재생하고,
 * 파일이 없거나 로드 중일 때는 Web Audio 합성 효과음으로 매끄럽게 대체 재생합니다.
 */
export class SoundSystem {
  private static ctx: AudioContext | null = null;
  private static isMuted: boolean = false;
  private static bgmAudio: HTMLAudioElement | null = null;
  private static currentBgmTrack: string | null = null;
  private static bgmVolume: number = 0.35;
  private static sfxVolume: number = 0.6;

  private static getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  static toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.bgmAudio) {
      this.bgmAudio.muted = this.isMuted;
    }
    return this.isMuted;
  }

  static setBGMVolume(volume: number) {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.bgmVolume;
    }
  }

  static setSFXVolume(volume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  // ==========================================
  // 1. 배경음악 (BGM) 재생 제어
  // ==========================================

  /**
   * 배경음악(BGM)을 재생합니다.
   * @param trackName 'lobby' | 'racing' | 'finish' 또는 커스텀 파일명(확장자 제외)
   * 예: 'racing' 전달 시 -> public/sounds/racing.mp3 또는 public/sounds/bgm.mp3 탐색
   */
  static playBGM(trackName: 'lobby' | 'racing' | 'finish' | string) {
    if (typeof window === 'undefined') return;
    if (this.currentBgmTrack === trackName && this.bgmAudio && !this.bgmAudio.paused) {
      return; // 이미 같은 음악이 재생 중
    }

    this.stopBGM();

    const candidateUrls = [
      `/sounds/${trackName}.mp3`,
      `/sounds/${trackName}.mp3.mp3`,
      `/sounds/${trackName}_bgm.mp3`,
      `/sounds/bgm.mp3`
    ];

    const tryPlay = (index: number) => {
      if (index >= candidateUrls.length) return;

      const audio = new Audio(candidateUrls[index]);
      audio.loop = true;
      audio.volume = this.bgmVolume;
      audio.muted = this.isMuted;

      audio.play().then(() => {
        this.bgmAudio = audio;
        this.currentBgmTrack = trackName;
      }).catch(() => {
        // 다음 후보 파일 시도
        tryPlay(index + 1);
      });
    };

    tryPlay(0);
  }

  /**
   * 현재 재생 중인 배경음악을 부드럽게 정지합니다.
   */
  static stopBGM() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
      this.bgmAudio = null;
      this.currentBgmTrack = null;
    }
  }

  // ==========================================
  // 2. 효과음 (SFX) MP3 & 합성 하이브리드 재생
  // ==========================================

  /**
   * 외부 MP3 효과음 재생 시도 후, 없으면 신시사이저 폴백을 실행합니다.
   */
  private static tryPlayAudioFile(fileName: string, fallbackFn: () => void) {
    if (this.isMuted) return;
    if (typeof window === 'undefined') return;

    const urls = [
      `/sounds/${fileName}.mp3`,
      `/sounds/${fileName}.mp3.mp3`
    ];

    const trySFX = (index: number) => {
      if (index >= urls.length) {
        fallbackFn();
        return;
      }
      const audio = new Audio(urls[index]);
      audio.volume = this.sfxVolume;
      audio.play().catch(() => {
        trySFX(index + 1);
      });
    };

    trySFX(0);
  }

  /**
   * 카운트다운 비프음 (3, 2, 1은 단음, GO!는 높은 화음)
   * MP3 파일: public/sounds/countdown_go.mp3 또는 public/sounds/countdown.mp3
   */
  static playCountdown(isGo: boolean = false) {
    if (this.isMuted) return;

    this.tryPlayAudioFile(isGo ? 'countdown_go' : 'countdown', () => {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isGo ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isGo ? 880 : 440, ctx.currentTime);

      gain.gain.setValueAtTime(0.3 * this.sfxVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (isGo ? 0.6 : 0.25));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + (isGo ? 0.6 : 0.25));
    });
  }

  /**
   * 아이템 상자 획득 효과음
   * MP3 파일: public/sounds/item.mp3
   */
  static playItemPickup() {
    if (this.isMuted) return;

    this.tryPlayAudioFile('item', () => {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.25 * this.sfxVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    });
  }

  /**
   * 벽 또는 장애물 충돌음
   * MP3 파일: public/sounds/crash.mp3
   */
  static playCrash() {
    if (this.isMuted) return;

    this.tryPlayAudioFile('crash', () => {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.18);

      gain.gain.setValueAtTime(0.35 * this.sfxVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    });
  }

  /**
   * 좌석 선점 성공 축하 팡파르
   * MP3 파일: public/sounds/seat.mp3 또는 public/sounds/finish.mp3
   */
  static playSeatSuccess() {
    if (this.isMuted) return;

    this.tryPlayAudioFile('seat', () => {
      const ctx = this.getContext();
      if (!ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const startTime = ctx.currentTime + index * 0.09;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.25 * this.sfxVolume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.35);
      });
    });
  }
}
