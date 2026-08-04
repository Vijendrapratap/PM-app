export interface MetricSource { metric: string; value: number; sourceType: string; sourceIds: string[] }
export const validateCaseStudyMetrics = (metrics: MetricSource[]) => metrics.every((metric) => metric.metric.trim().length > 0 && Number.isFinite(metric.value) && metric.sourceType.trim().length > 0 && Array.isArray(metric.sourceIds));
