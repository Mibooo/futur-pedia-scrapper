import type { Stats } from "../types";

export function createStats(): Stats {
  return {
    startTime: Date.now(),
    toolsFound: 0,
    categoriesDone: 0,
    categoriesTotal: 0,
    detailsDone: 0,
    detailsTotal: 0,
    detailsFailed: 0,
    pagesScraped: 0,
    retries: 0,
    phase: "init",
    currentWorkers: [],
    errors: [],
    categoryTools: {},

    get elapsed(): number {
      return (Date.now() - this.startTime) / 1000;
    },

    get rate(): number {
      if (this.elapsed < 1) return 0;
      return this.phase === "details"
        ? this.detailsDone / this.elapsed
        : this.toolsFound / this.elapsed;
    },

    addWorker(name: string) {
      this.currentWorkers.push(name);
    },

    removeWorker(name: string) {
      const idx = this.currentWorkers.indexOf(name);
      if (idx !== -1) this.currentWorkers.splice(idx, 1);
    },

    addError(msg: string) {
      this.errors.push(msg);
    },
  };
}
