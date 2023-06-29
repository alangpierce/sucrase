/**
 * Given an exactly-typed object (where T specifies all keys), enumerate entries.
 */
export function entriesExact<T extends object>(obj: T): Array<[keyof T, T[keyof T]]> {
  return Object.entries(obj) as Array<[keyof T, T[keyof T]]>;
}

/**
 * Given an exactly-typed object (where T specifies all keys), check for key existence.
 */
export function hasKeyExact<T>(obj: T, key: string | number | symbol): key is keyof T {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
