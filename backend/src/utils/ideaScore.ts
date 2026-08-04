export const calculateIdeaPriority = (businessValue: number, strategicAlignment: number, urgency: number, deliveryEffort: number) => businessValue + strategicAlignment + urgency - deliveryEffort;
