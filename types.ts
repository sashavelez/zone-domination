
export enum TileType {
  SUBJECT = 'SUBJECT',
  BONUS = 'BONUS',
  EMPTY = 'EMPTY',
  MYSTERY = 'MYSTERY',
}

export enum ZoneType {
  CRITICAL_THINKING = 'Critical Thinking',
  MEMORY = 'Memory',
  CREATIVITY = 'Creativity',
  MOTOR = 'Motor',
}

export interface Player {
  id: number;
  name: string;
  avatar: string;
  color: string;
  currentTileIndex: number;
  zonePoints: number;
  conqueredZones: ZoneType[];
  inventory: string[]; // Cartas de poder
}

export interface Question {
  subject: string;
  difficulty: number;
  question: string;
  answer: string;
}

export interface MysteryEvent {
  title: string;
  description: string;
  effectType: 'POINTS' | 'MOVE' | 'NONE' | 'POWERUP';
  value: number;
}

export type GamePhase = 'SETUP' | 'BOARD' | 'DICE_ROLLING' | 'QUESTION' | 'MYSTERY_EVENT' | 'ZONE_CONQUEST' | 'WIN_SCREEN';

export const ZONE_COSTS: Record<ZoneType, number> = {
  [ZoneType.CRITICAL_THINKING]: 4,
  [ZoneType.MEMORY]: 4,
  [ZoneType.CREATIVITY]: 4,
  [ZoneType.MOTOR]: 6,
};
