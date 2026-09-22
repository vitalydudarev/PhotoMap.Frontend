export class SnakeCaseHelper {
  public static keysToCamel(o: unknown): unknown {
    if (Array.isArray(o)) {
      return o.map((i) => this.keysToCamel(i));
    }

    if (o === Object(o) && typeof o !== 'function') {
      const n: Record<string, unknown> = {};
      Object.entries(o as Record<string, unknown>).forEach(([k, v]) => {
        n[this.toCamel(k)] = this.keysToCamel(v);
      });
      return n;
    }

    return o;
  }

  public static toCamel(s: string) {
    return s.replace(/([-_][a-z])/gi, ($1) => {
      return $1.toUpperCase().replace('-', '').replace('_', '');
    });
  }
}
