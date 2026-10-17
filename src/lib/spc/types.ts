export type IndividualsChartResult = {
  mean: number;
  sigmaEstimate: number;
  mrAverage: number;
  ucl: number;
  cl: number;
  lcl: number;
  points: number[];
};

export type MovingRangeChartResult = {
  mrAverage: number;
  ucl: number;
  cl: number;
  lcl: number;
  points: number[];
};

export type WesternElectricRule = "RULE_1" | "RULE_2" | "RULE_3" | "RULE_4";

export type SpcAlert = {
  rule: WesternElectricRule;
  index: number;
  value: number;
  message: string;
};

export type ControlLimitsResult = {
  individuals: IndividualsChartResult;
  movingRange: MovingRangeChartResult;
};
