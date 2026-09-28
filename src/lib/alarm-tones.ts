export const alarmTones = ["siren", "alarm", "high", "burst"] as const;

export type AlarmTone = (typeof alarmTones)[number];

export type AlarmToneFlags = Record<AlarmTone, boolean>;

export function alarmToneFlags(value: string | null | undefined): AlarmToneFlags {
  const flags: AlarmToneFlags = { siren: true, alarm: true, high: true, burst: true };
  if (!value?.includes("=")) return flags;
  for (const part of value.split(",")) {
    const [key, bit] = part.split("=");
    if (alarmTones.includes(key as AlarmTone)) flags[key as AlarmTone] = bit === "1";
  }
  return flags;
}

export function alarmToneValue(flags: AlarmToneFlags): string {
  return alarmTones.map((tone) => `${tone}=${flags[tone] ? "1" : "0"}`).join(",");
}

export function playAlarm(tone: string) {
  const context = new AudioContext();
  const now = context.currentTime;
  const note = (frequency: number, start: number, duration: number) => {
    const oscillator = context.createOscillator();
    const level = context.createGain();
    oscillator.frequency.value = frequency;
    level.gain.setValueAtTime(0.05, now + start);
    level.gain.setValueAtTime(0.05, now + start + Math.max(0, duration - 0.03));
    level.gain.linearRampToValueAtTime(0.0001, now + start + duration);
    oscillator.connect(level);
    level.connect(context.destination);
    oscillator.start(now + start);
    oscillator.stop(now + start + duration);
  };
  const sweep = (from: number, to: number, start: number, duration: number) => {
    const oscillator = context.createOscillator();
    const level = context.createGain();
    oscillator.frequency.setValueAtTime(from, now + start);
    oscillator.frequency.linearRampToValueAtTime(to, now + start + duration);
    level.gain.setValueAtTime(0.05, now + start);
    level.gain.setValueAtTime(0.05, now + start + Math.max(0, duration - 0.04));
    level.gain.linearRampToValueAtTime(0.0001, now + start + duration);
    oscillator.connect(level);
    level.connect(context.destination);
    oscillator.start(now + start);
    oscillator.stop(now + start + duration);
  };
  let length = 0.4;
  if (tone === "high") {
    note(1400, 0, 0.22);
  } else if (tone === "siren") {
    sweep(520, 1280, 0, 0.7);
    sweep(1280, 520, 0.7, 0.7);
    length = 1.5;
  } else if (tone === "alarm") {
    [0, 0.28, 0.56, 0.84, 1.12].forEach((start, index) => note(index % 2 === 0 ? 740 : 1040, start, 0.2));
    length = 1.4;
  } else if (tone === "burst") {
    [0, 0.16, 0.32, 0.48, 0.64, 0.8].forEach((start) => note(980, start, 0.08));
    length = 1;
  }
  window.setTimeout(() => void context.close(), Math.ceil(length * 1000) + 200);
}

export function startSiren(): () => void {
  const context = new AudioContext();
  let stopped = false;
  let wait = 0;
  const sweep = (from: number, to: number, start: number, duration: number) => {
    const oscillator = context.createOscillator();
    const level = context.createGain();
    const at = context.currentTime + start;
    oscillator.frequency.setValueAtTime(from, at);
    oscillator.frequency.linearRampToValueAtTime(to, at + duration);
    level.gain.setValueAtTime(0.05, at);
    level.gain.linearRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(level);
    level.connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  };
  const cycle = () => {
    if (stopped) return;
    sweep(520, 1280, 0, 0.7);
    sweep(1280, 520, 0.7, 0.7);
    wait = window.setTimeout(cycle, 1500);
  };
  cycle();
  return () => {
    stopped = true;
    window.clearTimeout(wait);
    void context.close();
  };
}
