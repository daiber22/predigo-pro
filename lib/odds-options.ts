import { OddsMarketKey } from '@/lib/types';

export type BookmakerOption = {
  value: string;
  label: string;
  note?: string;
};

export type MarketOption = {
  value: OddsMarketKey;
  label: string;
  helper: string;
};

export const BOOKMAKER_OPTIONS: BookmakerOption[] = [
  { value: 'auto', label: 'Auto (mejor disponible)', note: 'Usa el primer bookmaker que llegue para ese partido.' },
  { value: 'pinnacle', label: 'Pinnacle', note: 'Clave documentada en región EU.' },
  { value: 'betfair_ex_eu', label: 'Betfair Exchange', note: 'Clave documentada en región EU.' },
  { value: 'williamhill', label: 'William Hill', note: 'Clave documentada en UK/EU.' },
  { value: 'matchbook', label: 'Matchbook', note: 'Clave documentada en UK/EU.' },
  { value: 'betsson', label: 'Betsson', note: 'Clave documentada en EU/SE.' },
  { value: 'sport888', label: '888sport', note: 'Clave documentada en UK/EU.' },
  { value: 'onexbet', label: '1xBet', note: 'Clave documentada en EU.' },
];

export const MARKET_OPTIONS: MarketOption[] = [
  { value: '1x2', label: '1X2', helper: 'Local, empate o visitante' },
  { value: 'totals', label: 'Totales', helper: 'Over/Under' },
  { value: 'btts', label: 'Ambos anotan', helper: 'Sí / No' },
  { value: 'double_chance', label: 'Doble oportunidad', helper: '1X / X2' },
];
