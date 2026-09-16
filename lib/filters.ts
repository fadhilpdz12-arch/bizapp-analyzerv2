import { Order } from "./types";

export interface FilterState {
  months: string[];
  products: string[];
  couriers: string[];
  agents: string[];
  shipTypes: string[];
  statuses: string[];
}

export const EMPTY_FILTER: FilterState = {
  months: [],
  products: [],
  couriers: [],
  agents: [],
  shipTypes: [],
  statuses: [],
};

export interface FilterOptions {
  months: { key: string; label: string }[];
  products: string[];
  couriers: string[];
  agents: string[];
  shipTypes: string[];
  statuses: string[];
}

export function buildFilterOptions(orders: Order[]): FilterOptions {
  const monthMap = new Map<string, string>();
  const products = new Set<string>();
  const couriers = new Set<string>();
  const agents = new Set<string>();
  const shipTypes = new Set<string>();
  const statuses = new Set<string>();

  for (const o of orders) {
    if (o.monthKey) monthMap.set(o.monthKey, o.monthLabel);
    if (o.product) products.add(o.product);
    if (o.courierProvider) couriers.add(o.courierProvider);
    if (o.agent) agents.add(o.agent);
    if (o.shipType) shipTypes.add(o.shipType);
    if (o.status) statuses.add(o.status);
  }

  return {
    months: Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, label]) => ({ key, label })),
    products: Array.from(products).sort(),
    couriers: Array.from(couriers).sort(),
    agents: Array.from(agents).sort(),
    shipTypes: Array.from(shipTypes).sort(),
    statuses: Array.from(statuses).sort(),
  };
}

export function applyFilters(orders: Order[], f: FilterState): Order[] {
  return orders.filter((o) => {
    if (f.months.length && !f.months.includes(o.monthKey)) return false;
    if (f.products.length && !f.products.includes(o.product)) return false;
    if (f.couriers.length && !f.couriers.includes(o.courierProvider)) return false;
    if (f.agents.length && !f.agents.includes(o.agent)) return false;
    if (f.shipTypes.length && !f.shipTypes.includes(o.shipType)) return false;
    if (f.statuses.length && !f.statuses.includes(o.status)) return false;
    return true;
  });
}

export function countActive(f: FilterState): number {
  return (
    f.months.length + f.products.length + f.couriers.length + f.agents.length + f.shipTypes.length + f.statuses.length
  );
}
