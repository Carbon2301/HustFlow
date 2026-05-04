export const hasContiguousOrders = (items: Array<{ order: number }>) =>
  items.every((item, index) => item.order === index);

export const sortItemIds = (items: Array<{ id: string; order: number }>) =>
  [...items].sort((a, b) => a.order - b.order).map((item) => item.id);
