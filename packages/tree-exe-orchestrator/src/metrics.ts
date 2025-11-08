const CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

interface Metric {
  render(): string;
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function formatLabels(labels: Record<string, string> | undefined): string {
  if (!labels || Object.keys(labels).length === 0) {
    return '';
  }
  const parts = Object.entries(labels)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}="${escapeLabelValue(String(value))}"`);
  return `{${parts.join(',')}}`;
}

export class MetricsRegistry {
  private readonly metricsList: Metric[] = [];

  register(metric: Metric): void {
    this.metricsList.push(metric);
  }

  render(): string {
    return this.metricsList.map((metric) => metric.render()).join('\n');
  }

  get contentType(): string {
    return CONTENT_TYPE;
  }
}

interface CounterEntry {
  labels: Record<string, string>;
  value: number;
}

export class Counter implements Metric {
  private readonly values = new Map<string, CounterEntry>();

  constructor(
    registry: MetricsRegistry,
    private readonly name: string,
    private readonly help: string,
    private readonly labelNames: string[] = [],
  ) {
    registry.register(this);
  }

  inc(labels: Record<string, string> = {}, value = 1): void {
    this.assertLabels(labels);
    const key = this.serialize(labels);
    const entry = this.values.get(key);
    if (entry) {
      entry.value += value;
    } else {
      this.values.set(key, { labels: { ...labels }, value });
    }
  }

  private assertLabels(labels: Record<string, string>): void {
    for (const label of this.labelNames) {
      if (!(label in labels)) {
        throw new Error(`Missing label "${label}" for metric "${this.name}"`);
      }
    }
  }

  private serialize(labels: Record<string, string>): string {
    return this.labelNames
      .map((label) => `${label}:${labels[label] ?? ''}`)
      .join('|');
  }

  render(): string {
    const lines = [`# HELP ${this.name} ${this.help.replace(/\n/g, '\\n')}`, `# TYPE ${this.name} counter`];
    if (this.values.size === 0) {
      lines.push(`${this.name} 0`);
      return lines.join('\n');
    }
    for (const entry of this.values.values()) {
      lines.push(`${this.name}${formatLabels(entry.labels)} ${entry.value}`);
    }
    return lines.join('\n');
  }
}

interface HistogramEntry {
  labels: Record<string, string>;
  bucketCounts: number[];
  sum: number;
  count: number;
}

export class Histogram implements Metric {
  private readonly values = new Map<string, HistogramEntry>();
  private readonly bucketLabels: string[];

  constructor(
    registry: MetricsRegistry,
    private readonly name: string,
    private readonly help: string,
    private readonly labelNames: string[] = [],
    private readonly buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  ) {
    this.bucketLabels = [...this.buckets.map((bucket) => bucket.toString()), '+Inf'];
    registry.register(this);
  }

  observe(labels: Record<string, string>, value: number): void {
    this.assertLabels(labels);
    const key = this.serialize(labels);
    let entry = this.values.get(key);
    if (!entry) {
      entry = {
        labels: { ...labels },
        bucketCounts: new Array(this.bucketLabels.length).fill(0),
        sum: 0,
        count: 0,
      };
      this.values.set(key, entry);
    }

    let recorded = false;
    for (let i = 0; i < this.buckets.length; i += 1) {
      if (value <= this.buckets[i]) {
        entry.bucketCounts[i] += 1;
        recorded = true;
        break;
      }
    }
    if (!recorded) {
      entry.bucketCounts[this.bucketLabels.length - 1] += 1;
    }
    entry.sum += value;
    entry.count += 1;
  }

  private assertLabels(labels: Record<string, string>): void {
    for (const label of this.labelNames) {
      if (!(label in labels)) {
        throw new Error(`Missing label "${label}" for histogram "${this.name}"`);
      }
    }
  }

  private serialize(labels: Record<string, string>): string {
    return this.labelNames
      .map((label) => `${label}:${labels[label] ?? ''}`)
      .join('|');
  }

  render(): string {
    const lines = [`# HELP ${this.name} ${this.help.replace(/\n/g, '\\n')}`, `# TYPE ${this.name} histogram`];
    if (this.values.size === 0) {
      const emptyLabels = formatLabels({});
      const bucketLabels = this.buckets.map((bucket) => bucket.toString()).concat('+Inf');
      let cumulative = 0;
      bucketLabels.forEach((label) => {
        lines.push(`${this.name}_bucket${formatLabels({ le: label })} ${cumulative}`);
      });
      lines.push(`${this.name}_sum${emptyLabels} 0`);
      lines.push(`${this.name}_count${emptyLabels} 0`);
      return lines.join('\n');
    }

    for (const entry of this.values.values()) {
      let cumulative = 0;
      for (let i = 0; i < this.bucketLabels.length; i += 1) {
        cumulative += entry.bucketCounts[i];
        const labels = { ...entry.labels, le: this.bucketLabels[i] };
        lines.push(`${this.name}_bucket${formatLabels(labels)} ${cumulative}`);
      }
      lines.push(`${this.name}_sum${formatLabels(entry.labels)} ${entry.sum}`);
      lines.push(`${this.name}_count${formatLabels(entry.labels)} ${entry.count}`);
    }
    return lines.join('\n');
  }
}
