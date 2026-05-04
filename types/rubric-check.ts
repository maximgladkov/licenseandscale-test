export type RubricCheck = {
  name: string;
  pass: boolean;
  value: number;
  threshold: number;
  thresholdMin?: number;
};
